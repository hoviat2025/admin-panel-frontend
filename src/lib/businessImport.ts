import { API_BASE_URL } from "@/config";
import { authenticatedFetch } from "@/lib/authSession";
import catalogue from "@/data/import-category-catalogue.json";

type JsonObject = Record<string, unknown>;
export type Definition = { key: string; name: string; primary_parent_key?: string | null; parent_keys?: string[]; reason?: string };
export type ImportRow = {
  service: JsonObject & { name: string; source: string; external_id: string };
  description_original: string | null; google_maps_url: string | null;
  category_assignments: { category_key: string; is_primary: boolean }[];
  metadata: JsonObject; sources: JsonObject[]; expected_updated_at?: string | null;
};
export type ImportDocument = { schema_version: string; sources: JsonObject[]; businesses: Omit<ImportRow, "sources">[]; skipped: JsonObject[]; category_suggestions: { parents: Definition[]; categories: Definition[] } };
export type ImportResult = { external_id: string; name?: string; service_id?: number; action: "created" | "updated" | "skipped" | "error"; message?: string; expected_updated_at?: string | null; new_categories?: { key: string; name: string }[] };
export type PreparedImport = { rows: ImportRow[]; definitions: Definition[]; skipped: JsonObject[]; files: string[] };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export async function prepareImport(files: File[]): Promise<PreparedImport> {
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) throw new Error("مجموع فایل‌ها باید کمتر از ۲۵ مگابایت باشد.");
  const definitions = new Map<string, Definition>([...catalogue.parents, ...catalogue.categories].map(d => [d.key.toLowerCase(), d]));
  const rows: ImportRow[] = [], skipped: JsonObject[] = [], seen = new Set<string>();
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: حداکثر اندازه هر فایل ۱۰ مگابایت است.`);
    const doc = JSON.parse((await file.text()).replace(/^\uFEFF/, "")) as ImportDocument;
    if (doc.schema_version !== "1.0" || !Array.isArray(doc.businesses) || !Array.isArray(doc.sources) || !Array.isArray(doc.skipped) || !Array.isArray(doc.category_suggestions?.parents) || !Array.isArray(doc.category_suggestions?.categories)) throw new Error(`${file.name}: قالب فایل استخراج معتبر نیست.`);
    for (const d of [...doc.category_suggestions.parents, ...doc.category_suggestions.categories]) {
      if (!d || typeof d.key !== "string" || typeof d.name !== "string") throw new Error("تعریف دسته ناقص است.");
      const key = d.key.toLowerCase(), old = definitions.get(key);
      if (old && (old.name !== d.name || old.primary_parent_key !== d.primary_parent_key || JSON.stringify([...(old.parent_keys || [])].sort()) !== JSON.stringify([...(d.parent_keys || [])].sort()))) throw new Error(`تعریف‌های ناسازگار برای دسته ${d.key}`);
      definitions.set(key, d);
    }
    const sources = new Map(doc.sources.map(s => [s.source_ref, s]));
    if (sources.size !== doc.sources.length) throw new Error(`${file.name}: شناسه منبع تکراری است.`);
    for (const row of doc.businesses) {
      if (!row.service?.external_id || row.service.source !== "telegram") throw new Error(`${row.service?.name || file.name}: منبع باید شناسه مشخص داشته باشد.`);
      if (seen.has(row.service.external_id)) throw new Error(`رکورد تکراری در فایل‌های انتخابی: ${row.service.external_id}`);
      seen.add(row.service.external_id);
      if (!Array.isArray(row.category_assignments) || !row.metadata) throw new Error("اطلاعات دسته یا منبع ناقص است.");
      const context = row.metadata.batch_context as { source_refs?: string[] } | undefined;
      const refs = [...new Set([row.metadata.source_ref, ...(context?.source_refs || [])])];
      const selectedSources = refs.map(ref => sources.get(ref));
      if (selectedSources.some(s => !s)) throw new Error(`${row.service.name}: منبع ارجاع‌داده‌شده موجود نیست.`);
      rows.push({ service: row.service, description_original: row.description_original ?? null,
        google_maps_url: row.google_maps_url ?? null, category_assignments: row.category_assignments,
        metadata: row.metadata, sources: selectedSources as JsonObject[] });
    }
    skipped.push(...doc.skipped.map(item => ({ ...item, file: file.name })));
  }
  if (!rows.length) throw new Error("هیچ کسب‌وکاری برای ورود وجود ندارد.");
  // Keep only definitions needed by these rows, recursively including parents.
  const needed = new Map<string, Definition>();
  const visit = (key: string, stack = new Set<string>()) => {
    key = key.toLowerCase();
    if (stack.has(key)) throw new Error("چرخه در دسته‌بندی‌ها پیدا شد.");
    if (needed.has(key)) return;
    const d = definitions.get(key);
    if (!d) return; // May already exist in the live catalogue; server resolves it.
    needed.set(key, d);
    for (const p of d.parent_keys || []) visit(p, new Set([...stack, key]));
  };
  rows.forEach(row => row.category_assignments.forEach(a => visit(a.category_key)));
  return { rows, definitions: [...needed.values()], skipped, files: files.map(f => f.name) };
}

export function splitImport(rows: ImportRow[]): ImportRow[][] {
  const batches: ImportRow[][] = []; let batch: ImportRow[] = [];
  for (const row of rows) {
    if (new Blob([JSON.stringify(row)]).size > 900_000) throw new Error(`${row.service.name}: متن منبع این رکورد بیش از حد بزرگ است.`);
    if (batch.length && (batch.length === 10 || new Blob([JSON.stringify([...batch, row])]).size > 900_000)) { batches.push(batch); batch = []; }
    batch.push(row);
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export async function sendImport(rows: ImportRow[], definitions: Definition[], mode: "add" | "update", preview: boolean, status: "published" | "draft"): Promise<ImportResult[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/admin/service-management/imports/businesses`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
    body: JSON.stringify({ rows, definitions, mode, preview, status }),
  });
  const body = await response.json();
  if (!response.ok) {
    const validation = Array.isArray(body.detail) ? body.detail.map((d: { msg?: string }) => d.msg).join("؛ ") : "";
    throw new Error(body.error?.message || validation || `خطا در ورود اطلاعات (${response.status})`);
  }
  return body.data.results;
}
