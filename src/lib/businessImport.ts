import { API_BASE_URL } from "@/config";
import { authenticatedFetch } from "@/lib/authSession";
import catalogue from "@/data/import-category-catalogue.json";
import { canonicalCategoryKey, mergeDefinitions, readImportFiles, type Definition } from "@/lib/categoryImport";

type JsonObject = Record<string, unknown>;
export type { Definition } from "@/lib/categoryImport";
export type ImportRow = {
  service: JsonObject & { name: string; source: string; external_id: string };
  description_original: string | null; google_maps_url: string | null;
  category_assignments: { category_key: string; is_primary: boolean }[];
  metadata: JsonObject; sources: JsonObject[]; expected_updated_at?: string | null;
};
export type ImportDocument = { schema_version: string; sources: JsonObject[]; businesses: Omit<ImportRow, "sources">[]; skipped: JsonObject[]; category_suggestions: { parents: Definition[]; categories: Definition[] } };
export type ImportResult = { external_id: string; name?: string; service_id?: number; action: "created" | "updated" | "skipped" | "error"; message?: string; expected_updated_at?: string | null; new_categories?: { key: string; name: string }[] };
export type PreparedImport = { rows: ImportRow[]; definitions: Definition[]; skipped: JsonObject[]; files: string[] };

export async function prepareImport(files: File[]): Promise<PreparedImport> {
  const docs = await readImportFiles(files);
  const groups: unknown[] = [catalogue];
  const rows: ImportRow[] = [], skipped: JsonObject[] = [], seen = new Set<string>();
  for (const [index, file] of files.entries()) {
    const doc = docs[index] as ImportDocument;
    if (doc.schema_version !== "1.0" || !Array.isArray(doc.businesses) || !Array.isArray(doc.sources) || !Array.isArray(doc.skipped) || !Array.isArray(doc.category_suggestions?.parents) || !Array.isArray(doc.category_suggestions?.categories)) throw new Error(`${file.name}: قالب فایل استخراج معتبر نیست.`);
    groups.push(doc.category_suggestions);
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
        google_maps_url: row.google_maps_url ?? null, category_assignments: row.category_assignments.map(a => ({ ...a, category_key: canonicalCategoryKey(a.category_key) })),
        metadata: row.metadata, sources: selectedSources as JsonObject[] });
    }
    skipped.push(...doc.skipped.map(item => ({ ...item, file: file.name })));
  }
  if (!rows.length) throw new Error("هیچ کسب‌وکاری برای ورود وجود ندارد.");
  // Import the entire catalogue before businesses, including unused suggestions.
  const definitions = mergeDefinitions(groups);
  const byKey = new Map(definitions.map(d => [d.key, d]));
  for (const row of rows) for (const assignment of row.category_assignments) {
    const d = byKey.get(assignment.category_key);
    if (!d?.parent_keys?.length) throw new Error(`${row.service.name}: دسته دومرحله‌ای معتبر برای ${assignment.category_key} وجود ندارد.`);
  }
  return { rows, definitions, skipped, files: files.map(f => f.name) };
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
