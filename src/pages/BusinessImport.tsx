import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { prepareImport, sendImport, splitImport, type ImportResult, type PreparedImport } from "@/lib/businessImport";
import { baseDefinitions, categoryDocument, prepareCategoryImport, sendCategories, type CategoryImportResult } from "@/lib/categoryImport";
import "./business-import.css";

const actions = { created: "افزودن", updated: "به‌روزرسانی", skipped: "بدون تغییر", error: "خطا" };
export default function BusinessImport() {
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [content, setContent] = useState<"combined" | "categories">(() => new URLSearchParams(window.location.search).get("type") === "categories" ? "categories" : "combined");
  const [categoryResults, setCategoryResults] = useState<CategoryImportResult[]>([]);
  const [phase, setPhase] = useState("");
  const [mode, setMode] = useState<"add" | "update">("add");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]), [previewed, setPreviewed] = useState(false), [applied, setApplied] = useState(false);
  const [progress, setProgress] = useState(0), [filter, setFilter] = useState("");
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const invalidate = () => { setPreviewed(false); setApplied(false); setResults([]); setCategoryResults([]); setProgress(0); setPhase(""); };
  const run = async (preview: boolean) => {
    if (!prepared || busy) return;
    setBusy(true); setError(""); stop.current = false; setProgress(0);
    const versions = new Map(results.map(r => [r.external_id, r.expected_updated_at]));
    const incoming = prepared.rows.map(row => ({ ...row, expected_updated_at: versions.get(row.service.external_id) ?? null }));
    const collected: ImportResult[] = [];
    setResults([]); setCategoryResults([]); setPreviewed(false); setApplied(false);
    try {
      setPhase("بررسی دسته‌ها");
      const categories = new Map<string, CategoryImportResult>();
      for (let i = 0; i < prepared.definitions.length; i += 25) {
        if (stop.current) throw new Error("عملیات متوقف شد؛ برای ادامه دوباره پیش‌نمایش بگیرید.");
        const result = await sendCategories(prepared.definitions, prepared.definitions.slice(i, i + 25).map(d => d.key), preview);
        result.forEach(r => categories.set(r.key, r));
        setCategoryResults([...categories.values()]);
        setProgress(Math.min(i + 25, prepared.definitions.length));
      }
      setPhase(content === "categories" ? "دسته‌ها" : "کسب‌وکارها");
      for (const batch of splitImport(incoming)) {
        if (stop.current) throw new Error("عملیات متوقف شد. برای ادامه، دوباره پیش‌نمایش بگیرید؛ رکوردهای ذخیره‌شده تکرار نمی‌شوند.");
        const result = await sendImport(batch, prepared.definitions, mode, preview, status);
        collected.push(...result); setResults([...collected]); setProgress(prepared.definitions.length + collected.length);
      }
      if (preview) setPreviewed(!collected.some(r => r.action === "error"));
      else setApplied(!collected.some(r => r.action === "error"));
    } catch (e) { setError((e instanceof Error ? e.message : "ارتباط قطع شد.") + (!preview ? " رکوردهای قبلی ممکن است ذخیره شده باشند؛ پیش‌نمایش و اجرای دوباره امن است." : "")); }
    finally { setBusy(false); }
  };
  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ files: prepared?.files, mode, results, category_results: categoryResults, skipped: prepared?.skipped }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "business-import-report.json"; a.click(); URL.revokeObjectURL(url);
  };
  const downloadCategories = () => {
    if (!prepared) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(categoryDocument(prepared.definitions), null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "category-catalogue.json"; a.click(); URL.revokeObjectURL(url);
  };
  const renderCategory = (d: PreparedImport["definitions"][number]) => {
    const result = categoryResults.find(r => r.key === d.key);
    return <details key={d.key}><summary><bdi>{d.name}</bdi><span>{result ? actions[result.action] : "آماده بررسی"}</span></summary><p dir="ltr">{d.key}</p>{d.reason && <p>{d.reason}</p>}</details>;
  };
  return <div dir="rtl" className="business-import"><Header /><main>
    <Link to="/services">← مدیریت کسب‌وکارها</Link><h1>ورود اطلاعات از JSON</h1>
    <p>فایل‌ها ابتدا در مرورگر خوانده می‌شوند. پیش‌نمایش چیزی ذخیره نمی‌کند؛ ثبت نهایی در دسته‌های کوچک انجام می‌شود.</p>
    <div className="import-buttons" role="group" aria-label="نوع ورود"><button disabled={busy} aria-pressed={content === "combined"} onClick={() => { setContent("combined"); setPrepared(null); setError(""); invalidate(); }}>کسب‌وکارها و دسته‌ها</button><button disabled={busy} aria-pressed={content === "categories"} onClick={() => { setContent("categories"); setPrepared(null); setError(""); invalidate(); }}>فقط دسته‌بندی‌ها</button></div>
    <section>
    <p>{content === "combined" ? "ابتدا فهرست پایه و همه دسته‌های پیشنهادی ثبت می‌شوند؛ سپس کسب‌وکارها وارد می‌شوند." : "فایل دسته‌بندی یا فایل استخراج را انتخاب کنید. فقط دسته‌ها ثبت می‌شوند و کسب‌وکارها تغییری نمی‌کنند."}</p>
    {content === "categories" && <div className="import-buttons"><button disabled={busy} onClick={() => { invalidate(); setError(""); setPrepared({ definitions: baseDefinitions(), rows: [], skipped: [], files: ["فهرست پایه"] }); }}>استفاده از فهرست پایه</button></div>}
    <label className="import-file">انتخاب یک یا چند فایل JSON<input key={content} type="file" accept=".json,application/json" multiple disabled={busy} onChange={async e => {
      const files = Array.from(e.target.files || []); invalidate(); setPrepared(null); setError(""); setBusy(true);
      try { if (files.length) setPrepared(content === "combined" ? await prepareImport(files) : { definitions: await prepareCategoryImport(files), rows: [], skipped: [], files: files.map(f => f.name) }); } catch (e) { setError(e instanceof Error ? e.message : "فایل معتبر نیست."); } finally { setBusy(false); }
    }} /></label>
    {content === "combined" && <div className="import-options"><label>رکوردهای تکراری<select value={mode} disabled={busy} onChange={e => { setMode(e.target.value as typeof mode); invalidate(); }}><option value="add">فقط افزودن جدید؛ قبلی‌ها تغییر نکنند</option><option value="update">به‌روزرسانی رکوردهای با منبع یکسان</option></select></label>
    <label>وضعیت کسب‌وکارهای جدید<select value={status} disabled={busy} onChange={e => { setStatus(e.target.value as typeof status); invalidate(); }}><option value="published">منتشرشده</option><option value="draft">پیش‌نویس</option></select></label></div>}
    {content === "combined" && mode === "update" && <p className="import-warning">در حالت به‌روزرسانی، نام، توضیحات، موقعیت، تماس‌ها و دسته‌ها با داده جدید جایگزین می‌شوند. مالک، تنظیمات نمایش فرد، عکس و وضعیت انتشار قبلی حفظ می‌شوند.</p>}
    {prepared && <><p>{prepared.definitions.length.toLocaleString("fa-IR")} گروه و دسته · {prepared.rows.length.toLocaleString("fa-IR")} کسب‌وکار · {prepared.files.join("، ")}</p>
      <div className="import-buttons"><button disabled={busy} onClick={() => run(true)}>۱. بررسی و پیش‌نمایش</button><button disabled={busy || !previewed || applied} onClick={() => run(false)}>۲. ثبت در پایگاه داده</button>{busy && <button onClick={() => { stop.current = true; }}>توقف پس از دسته فعلی</button>}{(results.length > 0 || categoryResults.length > 0) && <button disabled={busy} onClick={downloadReport}>دریافت گزارش</button>}<button disabled={busy} onClick={downloadCategories}>دریافت JSON دسته‌ها</button></div>
      {(busy || progress > 0) && <p role="status">{busy ? "در حال پردازش" : applied ? "ثبت پایان یافت" : "پیش‌نمایش"} · {phase}: {progress} از {prepared.rows.length + prepared.definitions.length}</p>}
      <progress max={prepared.rows.length + prepared.definitions.length} value={progress} aria-label="پیشرفت ورود" />
    </>}
    {error && <p role="alert" className="import-error">{error}</p>}
    </section>
    {prepared && <section><h2>گروه‌ها و دسته‌ها</h2><p>دسته‌های موجود بدون تغییر می‌مانند. اختلاف نام یا والد باید پیش از ثبت برطرف شود.</p>
      {prepared.definitions.filter(d => !d.parent_keys?.length).map(group => {
        const children = prepared.definitions.filter(d => d.parent_keys?.includes(group.key));
        const result = categoryResults.find(r => r.key === group.key);
        return <details key={group.key}><summary><bdi>{group.name}</bdi><span>{children.length.toLocaleString("fa-IR")} دسته {result ? `· ${actions[result.action]}` : ""}</span></summary><p dir="ltr">{group.key}</p>{children.map(renderCategory)}</details>;
      })}
      {prepared.definitions.filter(d => d.parent_keys?.length && !d.parent_keys.some(k => prepared.definitions.some(p => p.key === k))).map(d => <div key={d.key}>{renderCategory(d)}<p>گروه موجود: {d.parent_keys.join("، ")}</p></div>)}
    </section>}
    {prepared && content === "combined" && <section><h2>رکوردها و نتیجه بررسی</h2><input type="search" placeholder="جست‌وجوی نام یا شناسه منبع" value={filter} onChange={e => setFilter(e.target.value)} />
      {prepared.rows.filter(r => (r.service.name + r.service.external_id).toLowerCase().includes(filter.toLowerCase())).map(row => {
        const result = results.find(r => r.external_id === row.service.external_id);
        return <details key={row.service.external_id}><summary><bdi>{row.service.name}</bdi><span className={result?.action === "error" ? "import-error" : ""}>{result ? actions[result.action] : "آماده بررسی"}</span></summary>
          <p dir="auto">{String(row.service.description || "")}</p><p dir="ltr">{row.service.external_id}</p><p>{row.category_assignments.map(a => a.category_key + (a.is_primary ? " (اصلی)" : "")).join("، ")}</p>
          {result?.message && <p className={result.action === "error" ? "import-error" : ""}>{result.message}</p>}
          {!!result?.new_categories?.length && <p>دسته‌های جدید: {result.new_categories.map(c => c.name).join("، ")}</p>}
          <details><summary>متن اصلی و اطلاعات استخراج</summary><pre dir="auto">{JSON.stringify(row, null, 2)}</pre></details>
        </details>;
      })}
      <details><summary>موارد کنارگذاشته‌شده (وارد نمی‌شوند)</summary><pre dir="auto">{JSON.stringify(prepared.skipped, null, 2)}</pre></details>
    </section>}
  </main></div>;
}
