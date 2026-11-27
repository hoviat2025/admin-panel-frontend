/** Compact, self-contained AI sessions. No record is marked checked by exporting. */
export interface CompactRecord {
  id: number; title: string; phones: string[]; city: string | null; address: string | null;
  created_at: string; updated_at: string; description_excerpt: string | null;
  review_status: "new" | "previously_checked";
}
export interface ReviewFile { name: string; content: string }
export interface ReviewOptions {
  exportId: string; checkedThrough: string; maxRecords: number; startedAt: string;
  filters: { city: string | null; parent_id: string | null };
}

export function buildReviewFiles(records: CompactRecord[], options: ReviewOptions): ReviewFile[] {
  if (!Number.isInteger(options.maxRecords) || options.maxRecords < 2 || options.maxRecords > 5000) throw new Error("تعداد رکورد هر فایل باید بین ۲ و ۵۰۰۰ باشد.");
  const ids = records.map(r => r.id);
  if (new Set(ids).size !== ids.length) throw new Error("خروجی شناسه تکراری دارد؛ دوباره دریافت کنید.");
  if (records.some(r => !["new", "previously_checked"].includes(r.review_status))) throw new Error("برچسب تازه/قبلی در خروجی سرور موجود نیست؛ ابتدا نسخه جدید بک‌اند را فعال کنید.");
  const fresh = records.filter(r => r.review_status === "new");
  const old = records.filter(r => r.review_status === "previously_checked");
  if (!fresh.length) return [];
  const oldPerPart = options.maxRecords - fresh.length;
  if (oldPerPart < 0 || (old.length > 0 && oldPerPart === 0)) {
    throw new Error(`${fresh.length} رکورد تازه وجود دارد و باید در هر فایل تکرار شود. اندازه فایل را بیشتر از این تعداد بگذارید یا فیلترها را محدود کنید.`);
  }
  const total = old.length ? Math.ceil(old.length / oldPerPart) : 1;
  if (total > 5000) throw new Error("بسته بیش از ۵۰۰۰ بخش می‌شود؛ اندازه هر فایل را افزایش دهید یا فیلترها را محدود کنید.");
  const files: ReviewFile[] = [];
  const encoder = new TextEncoder();
  let bytes = 0;
  for (let index = 0; index < total; index++) {
    const context = {
      mode: "incremental", export_id: options.exportId, checked_through: options.checkedThrough,
      part_number: index + 1, total_parts: total, include_new_new: index === 0,
      instructions: index === 0 ? "Compare new vs old and new vs new. Skip old vs old." : "Compare new vs old only. New vs new is covered in part 1. Skip old vs old.",
    };
    const file = { name: `part-${String(index + 1).padStart(3, "0")}.json`, content: JSON.stringify({
      schema_version: "1.0", review_context: context, filters: options.filters,
      records: [...fresh, ...old.slice(index * oldPerPart, (index + 1) * oldPerPart)],
    }, null, 2) };
    bytes += encoder.encode(file.content).length;
    if (bytes > 25 * 1024 * 1024) throw new Error("تکرار رکوردهای تازه بسته را بیش از ۲۵ مگابایت می‌کند؛ فیلترها را محدود کنید یا در صورت امکان اندازه هر فایل را افزایش دهید.");
    files.push(file);
  }
  const manifest = {
    schema_version: "1.0", export_id: options.exportId, export_started_at: options.startedAt,
    checked_through: options.checkedThrough, filters: options.filters,
    new_count: fresh.length, old_count: old.length, total_parts: total,
    parts: files.map(f => f.name),
    instructions: "Use one part plus the prompt in each AI session. Collect ALL result files, then upload them together before applying anything. All new records repeat in every part; old records occur once. Only part 1 checks new vs new. Exporting does not mark records checked. Advance the cutoff only after all parts and findings are handled, and only for the reviewed filter scope. This is a paged read, not a frozen database snapshot; edits/new arrivals during export need a later review.",
  };
  return [{ name: "manifest.json", content: JSON.stringify(manifest, null, 2) }, ...files];
}

/** Standard uncompressed ZIP, bounded to 25 MiB; avoids automatic multi-download prompts. */
export function reviewZip(files: ReviewFile[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const prepared = files.map(f => ({ name: encoder.encode(f.name), body: encoder.encode(f.content) }));
  const size = prepared.reduce((n, f) => n + 30 + f.name.length + f.body.length + 46 + f.name.length, 22);
  if (prepared.length > 65535 || size > 25 * 1024 * 1024) throw new Error("بسته خروجی بیش از ۲۵ مگابایت است؛ فیلترها را محدود کنید یا در صورت امکان اندازه هر فایل را افزایش دهید.");
  const output = new Uint8Array(size), view = new DataView(output.buffer);
  let pos = 0;
  const u16 = (n: number) => { view.setUint16(pos, n, true); pos += 2; };
  const u32 = (n: number) => { view.setUint32(pos, n, true); pos += 4; };
  const bytes = (data: Uint8Array) => { output.set(data, pos); pos += data.length; };
  const central: { name: Uint8Array; length: number; crc: number; offset: number }[] = [];
  for (const file of prepared) {
    let crc = 0xffffffff;
    for (const byte of file.body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    central.push({ name: file.name, length: file.body.length, crc, offset: pos });
    u32(0x04034b50); u16(20); u16(0x800); u16(0); u16(0); u16(33);
    u32(crc); u32(file.body.length); u32(file.body.length); u16(file.name.length); u16(0);
    bytes(file.name); bytes(file.body);
  }
  const start = pos;
  for (const file of central) {
    u32(0x02014b50); u16(20); u16(20); u16(0x800); u16(0); u16(0); u16(33);
    u32(file.crc); u32(file.length); u32(file.length); u16(file.name.length);
    u16(0); u16(0); u16(0); u16(0); u32(0); u32(file.offset); bytes(file.name);
  }
  const centralLength = pos - start;
  u32(0x06054b50); u16(0); u16(0); u16(central.length); u16(central.length);
  u32(centralLength); u32(start); u16(0);
  return output;
}
