import catalogue from "@/data/import-category-catalogue.json";
import { API_BASE_URL } from "@/config";
import { authenticatedFetch } from "@/lib/authSession";

export type Definition = { key: string; name: string; primary_parent_key?: string | null; parent_keys?: string[]; reason?: string };
export type CategoryImportResult = { key: string; name: string; action: "created" | "skipped"; level: number; category_id: number | null };
const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function canonicalCategoryKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("کلید دسته باید متن باشد.");
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  if (!keyPattern.test(key) || key.length > 200) throw new Error("کلید دسته معتبر نیست.");
  return key;
}

export function mergeDefinitions(groups: unknown[]): Definition[] {
  const merged = new Map<string, Definition>();
  for (const group of groups) {
    if (!group || typeof group !== "object" || !Array.isArray((group as { parents?: unknown }).parents) || !Array.isArray((group as { categories?: unknown }).categories)) throw new Error("فهرست دسته‌ها باید parents و categories داشته باشد.");
    const { parents, categories } = group as { parents: Definition[]; categories: Definition[] };
    for (const [items, child] of [[parents, false], [categories, true]] as const) {
      for (const raw of items) {
        if (!raw || typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 200) throw new Error("نام دسته معتبر نیست.");
        const key = canonicalCategoryKey(raw.key);
        if (raw.parent_keys !== undefined && !Array.isArray(raw.parent_keys)) throw new Error(`والدهای دسته ${raw.key} معتبر نیستند.`);
        const parentKeys = (raw.parent_keys || []).map(canonicalCategoryKey);
        const primary = raw.primary_parent_key == null ? null : canonicalCategoryKey(raw.primary_parent_key);
        if (parentKeys.length > 30 || new Set(parentKeys).size !== parentKeys.length || parentKeys.includes(key)) throw new Error(`والدهای دسته ${raw.key} معتبر نیستند.`);
        if (child ? !parentKeys.length || !primary || !parentKeys.includes(primary) : parentKeys.length > 0 || !!primary) throw new Error(`ساختار دو سطحی دسته ${raw.key} معتبر نیست.`);
        const d: Definition = { key, name: raw.name.trim(), parent_keys: parentKeys, primary_parent_key: primary };
        if (typeof raw.reason === "string") d.reason = raw.reason;
        const old = merged.get(d.key);
        if (old && (old.name !== d.name || old.primary_parent_key !== d.primary_parent_key || JSON.stringify([...(old.parent_keys || [])].sort()) !== JSON.stringify([...parentKeys].sort()))) throw new Error(`تعریف‌های ناسازگار برای دسته ${d.key}`);
        merged.set(d.key, d);
      }
    }
  }
  const definitions = [...merged.values()];
  if (definitions.length > 500) throw new Error("هر بار حداکثر ۵۰۰ دسته انتخاب کنید.");
  if (definitions.filter(d => !d.parent_keys?.length).length > 30) throw new Error("حداکثر ۳۰ گروه اصلی مجاز است.");
  for (const d of definitions) for (const key of d.parent_keys || []) {
    if (merged.get(key)?.parent_keys?.length) throw new Error("فقط دو سطح دسته‌بندی مجاز است؛ والد باید گروه اصلی باشد.");
  }
  return definitions.sort((a, b) => Number(!!a.parent_keys?.length) - Number(!!b.parent_keys?.length));
}

export function categoryDocument(definitions: Definition[]) {
  return { schema_version: "1.0", parents: definitions.filter(d => !d.parent_keys?.length), categories: definitions.filter(d => !!d.parent_keys?.length) };
}

export function baseDefinitions(): Definition[] {
  return mergeDefinitions([catalogue]);
}

export async function readImportFiles(files: File[]): Promise<unknown[]> {
  if (files.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) throw new Error("مجموع فایل‌ها باید کمتر از ۲۵ مگابایت باشد.");
  const docs: unknown[] = [];
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: حداکثر اندازه هر فایل ۱۰ مگابایت است.`);
    docs.push(JSON.parse((await file.text()).replace(/^\uFEFF/, "")));
  }
  return docs;
}

export async function prepareCategoryImport(files: File[]): Promise<Definition[]> {
  const docs = await readImportFiles(files);
  const definitions = mergeDefinitions(docs.map(doc => {
    if (!doc || typeof doc !== "object" || (doc as { schema_version?: unknown }).schema_version !== "1.0") throw new Error("نسخه فایل دسته‌بندی معتبر نیست.");
    return (doc as { category_suggestions?: unknown }).category_suggestions ?? doc;
  }));
  if (!definitions.length) throw new Error("هیچ دسته‌ای در فایل‌ها وجود ندارد.");
  return definitions;
}

export async function sendCategories(definitions: Definition[], keys: string[], preview: boolean): Promise<CategoryImportResult[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/admin/service-management/imports/categories`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
    body: JSON.stringify({ definitions, keys, preview }),
  });
  const body = await response.json();
  if (!response.ok) {
    const validation = Array.isArray(body.detail) ? body.detail.map((d: { msg?: string }) => d.msg).join("؛ ") : "";
    throw new Error(body.error?.message || validation || `خطا در ورود دسته‌ها (${response.status})`);
  }
  return body.data.results;
}
