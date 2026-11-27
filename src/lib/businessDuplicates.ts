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
  plan?: { blocked: string[]; conflicts: unknown[]; fill_empty_fields: Record<string, unknown>; add_contacts: unknown[]; add_category_ids: number[] };
}
export interface CompactPage { records: unknown[]; ceiling: number; next_after: number | null }
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
    ...(r.records ?? []).map(record => `${record.service.id === r.keep_id ? "نگه‌داری" : "بایگانی"} #${record.service.id}\n${JSON.stringify(record, null, 2)}`),
    `تغییرات پیشنهادی:\n${JSON.stringify(r.plan ?? {}, null, 2)}`,
  ].join("\n")).join("\n\n====================\n\n");
}
