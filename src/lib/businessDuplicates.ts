export interface DuplicateGroup {
  keep_id: number; remove_ids: number[]; confidence: "likely" | "possible"; reason: string; preview_token?: string;
}
export interface Snapshot {
  service: Record<string, unknown> & { id: number; name: string; description?: string; city?: string; address?: string };
  contacts: { title: string; value: string; is_visible: boolean }[];
  categories: { category_id: number; is_primary: boolean }[];
  bookmarks: unknown[];
}
export interface MergeResult extends DuplicateGroup {
  action: string; message?: string; records?: Snapshot[];
  proposals?: DuplicateGroup[];
  requested_group?: DuplicateGroup;
  resolved_ids?: Record<string, number>;
  plan?: { blocked: string[]; operation: "keep_unchanged_archive_others"; keep_id: number; archive_ids: number[]; bookmarks?: string; sources?: string };
}
export interface CompactPage { records: import("./duplicateReviewExport").CompactRecord[]; ceiling: number; next_after: number | null }
export interface ArchivePage { records: { original_id: number; survivor_id: number | null; reason: string; archived_at: string }[]; next_after: number | null }

export function parseDuplicateFile(text: string): DuplicateGroup[] {
  const value = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (value?.schema_version !== "1.0" || !Array.isArray(value.groups) || value.groups.length > 2000) throw new Error("قالب فایل معتبر نیست (حداکثر ۲۰۰۰ گروه).");
  const seen = new Set<number>();
  for (const g of value.groups) {
    if (!g || !Array.isArray(g.remove_ids) || !g.remove_ids.length || g.remove_ids.length > 19 ||
      !["likely", "possible"].includes(g.confidence) || typeof g.reason !== "string" || !g.reason.trim() || g.reason.length > 2000 ||
      Object.keys(g).some(k => !["keep_id", "remove_ids", "confidence", "reason"].includes(k))) throw new Error("ساختار گروه تکراری معتبر نیست.");
    for (const id of [g.keep_id, ...g.remove_ids]) {
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) throw new Error("شناسه نامعتبر یا گروه‌های هم‌پوشان در فایل وجود دارد.");
      seen.add(id);
    }
  }
  return value.groups;
}

export const duplicateGroupKey = (g: DuplicateGroup) => [g.keep_id, ...g.remove_ids].sort((a, b) => a - b).join(":");

export interface LoadedDuplicateFile { name: string; text: string }

/** Selecting files adds/replaces parts; it does not discard the earlier work. */
export function addDuplicateFiles(previous: LoadedDuplicateFile[], incoming: LoadedDuplicateFile[]): LoadedDuplicateFile[] {
  const key = (file: LoadedDuplicateFile) => {
    parseDuplicateFile(file.text);
    const data = JSON.parse(file.text.replace(/^\uFEFF/, ""));
    return data.export_id !== undefined && data.part_number !== undefined
      ? `part:${data.export_id}:${data.part_number}` : `file:${file.name}`;
  };
  const combined = new Map(previous.map(f => [key(f), f]));
  for (const file of incoming) combined.set(key(file), file);
  const files = [...combined.values()];
  if (files.length > 5000) throw new Error("حداکثر ۵۰۰۰ فایل در هر بررسی وارد کنید.");
  if (files.some(f => new TextEncoder().encode(f.text).length > 2 * 1024 * 1024) ||
      files.reduce((n, f) => n + new TextEncoder().encode(f.text).length, 0) > 25 * 1024 * 1024) throw new Error("حداکثر هر فایل ۲ مگابایت و مجموع فایل‌ها ۲۵ مگابایت است.");
  combineDuplicateFiles(files.map(f => f.text));
  return files;
}

/** Cross-session overlaps are review-only, never an automatic transitive merge. */
export function combineDuplicateFiles(texts: string[]): { groups: DuplicateGroup[]; reviews: Record<string, DuplicateGroup[]>; coverage: { received: number; total: number | null; complete: boolean } } {
  const proposals: DuplicateGroup[] = [];
  const seen = new Set<string>(), exportIds = new Set<string>(), partNumbers = new Set<number>();
  const totals = new Set<number>();
  let metadataFiles = 0;
  for (const text of texts) {
    const parsedGroups = parseDuplicateFile(text);
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (parsed.export_id !== undefined || parsed.part_number !== undefined || parsed.total_parts !== undefined) {
      metadataFiles++;
      if (typeof parsed.export_id !== "string" || !parsed.export_id.trim() || !Number.isSafeInteger(parsed.part_number) ||
        !Number.isSafeInteger(parsed.total_parts) || parsed.total_parts < 1 || parsed.total_parts > 5000 ||
        parsed.part_number < 1 || parsed.part_number > parsed.total_parts) throw new Error("اطلاعات بسته و شماره بخش در نتیجه هوش مصنوعی کامل نیست.");
      totals.add(parsed.total_parts);
    }
    if (parsed.export_id !== undefined) {
      if (typeof parsed.export_id !== "string" || !parsed.export_id.trim()) throw new Error("شناسه بسته خروجی معتبر نیست.");
      exportIds.add(parsed.export_id);
    }
    if (parsed.part_number !== undefined) {
      if (!Number.isSafeInteger(parsed.part_number) || parsed.part_number < 1 || partNumbers.has(parsed.part_number)) throw new Error("شماره بخش نامعتبر یا تکراری است؛ فقط یک نتیجه برای هر بخش وارد کنید.");
      partNumbers.add(parsed.part_number);
    }
    for (const g of parsedGroups) {
      const key = `${g.keep_id}|${[...g.remove_ids].sort((a, b) => a - b)}|${g.confidence}`;
      if (!seen.has(key)) { seen.add(key); proposals.push(g); }
    }
  }
  if (exportIds.size > 1 || totals.size > 1 || (metadataFiles > 0 && metadataFiles !== texts.length)) throw new Error("فایل‌ها متعلق به بسته‌های متفاوت‌اند یا اطلاعات بخش‌ها کامل نیست؛ نتایج یک بسته را با هم وارد کنید.");
  if (proposals.length > 2000) throw new Error("حداکثر ۲۰۰۰ گروه در هر نوبت وارد کنید.");
  const owners = new Map<number, number[]>();
  proposals.forEach((g, index) => [g.keep_id, ...g.remove_ids].forEach(id => owners.set(id, [...(owners.get(id) ?? []), index])));
  const visited = new Set<number>(), groups: DuplicateGroup[] = [], reviews: Record<string, DuplicateGroup[]> = {};
  proposals.forEach((_, start) => {
    if (visited.has(start)) return;
    const queue = [start], component: DuplicateGroup[] = [];
    while (queue.length) {
      const index = queue.pop()!;
      if (visited.has(index)) continue;
      visited.add(index); const g = proposals[index]; component.push(g);
      for (const id of [g.keep_id, ...g.remove_ids]) for (const other of owners.get(id) ?? []) if (!visited.has(other)) queue.push(other);
    }
    if (component.length === 1) { groups.push(component[0]); return; }
    const ids = [...new Set(component.flatMap(g => [g.keep_id, ...g.remove_ids]))].sort((a, b) => a - b);
    if (ids.length > 20) throw new Error("پیشنهادهای هم‌پوشان بیش از ۲۰ رکورد دارند؛ این بخش را جداگانه بررسی کنید. هیچ حذفی انجام نشد.");
    const combined: DuplicateGroup = { keep_id: component[0].keep_id, remove_ids: ids.filter(id => id !== component[0].keep_id),
      confidence: "possible", reason: "پیشنهادهای چند بخش شناسه مشترک دارند. یکسان بودن همه موارد و نسخه قابل نگه‌داری باید در پیش‌نمایش تأیید شود." };
    groups.push(combined); reviews[duplicateGroupKey(combined)] = component;
  });
  const total = totals.size ? [...totals][0] : null;
  return { groups, reviews, coverage: { received: partNumbers.size || texts.length, total, complete: total === null || partNumbers.size === total } };
}

export async function exportDuplicatePage(params: URLSearchParams): Promise<CompactPage> {
  const { directoryDuplicateRequest } = await import("./serviceApi");
  return directoryDuplicateRequest(`/export?${params}`);
}
export async function mergeDuplicateGroups(groups: DuplicateGroup[], preview: boolean): Promise<{ results: MergeResult[] }> {
  const { directoryDuplicateRequest } = await import("./serviceApi");
  return directoryDuplicateRequest("/merge", { method: "POST", body: JSON.stringify({ schema_version: "1.0", groups, preview }) });
}
export async function archivePage(after = 0): Promise<ArchivePage> { const { directoryDuplicateRequest } = await import("./serviceApi"); return directoryDuplicateRequest(`/archive?after=${after}`); }
export async function archivedRecord(id: number): Promise<unknown> { const { directoryDuplicateRequest } = await import("./serviceApi"); return directoryDuplicateRequest(`/archive/${id}`); }

export function downloadDuplicateFile(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readableDuplicateReport(results: MergeResult[]): string {
  return results.map(r => [
    `نگه‌داری: ${r.keep_id} | انتقال به بایگانی: ${r.remove_ids.join(", ")} | ${r.action}`,
    r.reason, r.message ?? "",
    ...(r.resolved_ids ? [`شناسه‌های قبلاً بایگانی‌شده و رکورد فعلی:\n${JSON.stringify(r.resolved_ids, null, 2)}`] : []),
    ...(r.proposals?.length ? [`پیشنهادهای اولیه بخش‌ها:\n${JSON.stringify(r.proposals, null, 2)}`] : []),
    ...(r.records ?? []).map(record => `${record.service.id === r.keep_id ? "نگه‌داری" : "بایگانی"} #${record.service.id}\n${JSON.stringify(record, null, 2)}`),
    `تغییرات پیشنهادی:\n${JSON.stringify(r.plan ?? {}, null, 2)}`,
  ].join("\n")).join("\n\n====================\n\n");
}
