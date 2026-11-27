import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { fetchCategories, fetchLocationCatalogue } from "@/lib/serviceApi";
import { Category } from "@/types/service";
import { addDuplicateFiles, archivePage, archivedRecord, combineDuplicateFiles, downloadDuplicateFile, duplicateGroupKey, exportDuplicatePage, mergeDuplicateGroups,
  readableDuplicateReport, type ArchivePage, type DuplicateGroup, type LoadedDuplicateFile, type MergeResult } from "@/lib/businessDuplicates";
import { buildReviewFiles, reviewZip, type CompactRecord } from "@/lib/duplicateReviewExport";
import prompt from "@/data/business-duplicates-prompt.txt?raw";
import "./service-management.css";
import "./business-duplicates.css";

const errorMessage = (e: unknown) => e instanceof Error ? e.message : "عملیات ناموفق بود؛ دوباره تلاش کنید.";

export default function BusinessDuplicates() {
  const [cities, setCities] = useState<string[]>([]);
  const [parents, setParents] = useState<Category[]>([]);
  const [city, setCity] = useState("");
  const [parent, setParent] = useState("");
  const [incremental, setIncremental] = useState(false);
  const [cutoff, setCutoff] = useState("");
  const [maxRecords, setMaxRecords] = useState(300);
  const [reviews, setReviews] = useState<Record<string, DuplicateGroup[]>>({});
  const [coverage, setCoverage] = useState<{ received: number; total: number | null; complete: boolean } | null>(null);
  const [keeperChoices, setKeeperChoices] = useState<Record<string, number>>({});
  const [loadedFiles, setLoadedFiles] = useState<LoadedDuplicateFile[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [results, setResults] = useState<MergeResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archives, setArchives] = useState<ArchivePage>({ records: [], next_after: null });
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(true), fetchLocationCatalogue()]).then(([cats, places]) => {
      if (cancelled) return;
      setParents(cats.filter(c => c.parent_id == null));
      setCities([...new Set(places.flatMap(c => c.states.flatMap(s => s.cities.map(x => x.city))))].sort());
    }).catch(() => { if (!cancelled) setError("دریافت فیلترها ناموفق بود؛ خروجی همه کسب‌وکارها همچنان در دسترس است."); });
    return () => { cancelled = true; };
  }, []);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  async function exportData() {
    await perform(async () => {
      const startedAt = new Date().toISOString();
      const checkedThrough = incremental && cutoff ? new Date(cutoff).toISOString() : null;
      if (incremental && !checkedThrough) throw new Error("زمان آخرین بررسی کامل را وارد کنید یا حالت بررسی تازه‌ها را خاموش کنید.");
      if (incremental && (!Number.isInteger(maxRecords) || maxRecords < 2 || maxRecords > 5000)) throw new Error("تعداد رکورد هر فایل باید بین ۲ و ۵۰۰۰ باشد.");
      if (checkedThrough && checkedThrough > startedAt) throw new Error("زمان آخرین بررسی نمی‌تواند در آینده باشد.");
      let after = 0, ceiling: number | undefined, bytes = 0;
      const records: CompactRecord[] = [];
      do {
        const params = new URLSearchParams({ after: String(after), size: "200" });
        if (city.trim()) params.set("city", city.trim());
        if (parent) params.set("parent_id", parent);
        if (checkedThrough) params.set("checked_through", checkedThrough);
        if (ceiling !== undefined) params.set("ceiling", String(ceiling));
        const page = await exportDuplicatePage(params);
        ceiling = page.ceiling;
        bytes += new TextEncoder().encode(JSON.stringify(page.records)).length;
        if (bytes > 25 * 1024 * 1024) throw new Error("خروجی بیش از ۲۵ مگابایت است؛ شهر یا گروه را محدود کنید. فایل ناقص دانلود نشد.");
        records.push(...page.records);
        setMessage(`دریافت ${records.length} کسب‌وکار…`);
        if (page.next_after === null) break;
        if (page.next_after <= after) throw new Error("صفحه‌بندی خروجی معتبر نیست.");
        after = page.next_after;
      } while (after > 0);
      const filters = { city: city || null, parent_id: parent || null };
      if (checkedThrough) {
        const exportId = crypto.randomUUID();
        setMessage("در حال آماده‌سازی بخش‌ها و فایل ZIP…");
        await new Promise(resolve => setTimeout(resolve, 0));
        const files = buildReviewFiles(records, { exportId, checkedThrough, startedAt, filters, maxRecords });
        if (!files.length) { setMessage("رکورد تازه‌ای پس از زمان انتخاب‌شده نیست؛ برای بررسی همه، حالت بررسی تازه‌ها را خاموش کنید."); return; }
        const blob = reviewZip([...files, { name: "analysis-prompt.txt", content: prompt }]);
        const url = URL.createObjectURL(new Blob([blob], { type: "application/zip" }));
        const link = document.createElement("a"); link.href = url; link.download = `business-review-${exportId.slice(0, 8)}.zip`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        const fresh = records.filter(r => r.review_status === "new").length;
        setMessage(`بسته ${files.length - 1} بخشی آماده شد: ${fresh} تازه و ${records.length - fresh} قبلی. فایل ZIP را باز کنید؛ هر بخش را همراه دستور در یک جلسه جدا بدهید. نتیجه هر بخش را جداگانه یا چندتایی به صفحه اضافه کنید.`);
      } else {
        downloadDuplicateFile("business-duplicate-candidates.json", JSON.stringify({ schema_version: "1.0", filters, records }, null, 2));
        setMessage(`خروجی ${records.length} کسب‌وکار آماده شد. آن را همراه دستور تحلیل به هوش مصنوعی بدهید.`);
      }
    });
  }

  async function loadFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    await perform(async () => {
      if (files.length > 5000 || files.some(f => f.size > 2 * 1024 * 1024) || files.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) throw new Error("حداکثر هر فایل ۲ مگابایت و مجموع فایل‌ها ۲۵ مگابایت است.");
      const incoming = await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() })));
      await installFiles(addDuplicateFiles(loadedFiles, incoming));
    });
  }

  async function installFiles(files: LoadedDuplicateFile[]) {
    const parsed = combineDuplicateFiles(files.map(f => f.text));
    setLoadedFiles(files); setResults([]); setSelected(new Set()); setKeeperChoices({});
    setGroups(parsed.groups); setReviews(parsed.reviews); setCoverage(files.length ? parsed.coverage : null);
    if (files.length) await loadComparisons(parsed.groups, parsed.reviews);
    else setMessage("فایل‌های این صفحه پاک شدند؛ اطلاعات پایگاه داده تغییری نکرد.");
  }

  async function loadComparisons(proposals = groups, originalReviews = reviews) {
      setResults([]); setSelected(new Set());
      const collected: MergeResult[] = [];
      for (let i = 0; i < proposals.length; i += 20) {
        const page = await mergeDuplicateGroups(proposals.slice(i, i + 20), true);
        collected.push(...page.results.map(r => ({ ...r, proposals: originalReviews[duplicateGroupKey(r.requested_group ?? r)] }))); setResults([...collected]);
        setMessage(`دریافت مقایسه ${Math.min(i + 20, proposals.length)} از ${proposals.length} کسب‌وکار…`);
      }
      setMessage(proposals.length ? "مقایسه‌ها آماده‌اند؛ تا وقتی دکمه حذف را نزنید، هیچ رکوردی تغییر نمی‌کند." : "در فایل‌های فعلی، کسب‌وکار تکراری پیشنهاد نشده است.");
  }

  async function removePossible(result: MergeResult) {
    await perform(async () => {
      const key = duplicateGroupKey(result), originalKey = duplicateGroupKey(result.requested_group ?? result), keep = keeperChoices[key] ?? result.keep_id;
      const confirmedGroup: DuplicateGroup = { keep_id: keep, remove_ids: [result.keep_id, ...result.remove_ids].filter(id => id !== keep), confidence: "likely",
        reason: (`مدیر یکسان بودن همه موارد و نگه‌داری رکورد ${keep} را پس از بررسی تأیید کرد. ` + (result.proposals ?? [result]).map(g => g.reason).join("؛ ")).slice(0, 2000) };
      const preview = (await mergeDuplicateGroups([confirmedGroup], true)).results[0];
      if (!result.requested_group) setGroups(old => old.map(g => duplicateGroupKey(g) === originalKey ? confirmedGroup : g));
      const refreshed = { ...preview, proposals: result.proposals };
      const updated = results.map(r => duplicateGroupKey(r) === key ? refreshed : r);
      setResults(updated);
      if (refreshed.action !== "preview" || refreshed.confidence !== "likely") {
        setMessage("این مورد قابل حذف نیست؛ توضیح کنار مقایسه را بررسی کنید.");
        return;
      }
      await removeRecords([refreshed], updated);
    });
  }

  async function removeRecords(chosen: MergeResult[], currentResults = results) {
      if (!chosen.length || chosen.some(r => r.action !== "preview" || r.confidence !== "likely" || !r.preview_token)) throw new Error("ابتدا مقایسه فعلی را بررسی کنید.");
      const updated = [...currentResults];
      for (const r of chosen) {
        const { results: applied } = await mergeDuplicateGroups([{
          keep_id: r.keep_id, remove_ids: r.remove_ids, reason: r.reason, confidence: r.confidence, preview_token: r.preview_token,
        }], false);
        const index = updated.findIndex(x => duplicateGroupKey(x) === duplicateGroupKey(r));
        updated[index] = { ...r, ...applied[0] };
        setResults([...updated]);
        setSelected(previous => new Set([...previous].filter(key => key !== duplicateGroupKey(r))));
      }
      setArchiveLoaded(false);
      const failed = updated.filter(r => r.action === "error").length;
      setMessage(failed ? "بعضی موارد حذف نشدند؛ توضیح خطا را ببینید و مقایسه را دوباره دریافت کنید." : "نسخه‌های تکراری حذف و بایگانی شدند؛ نسخه نگه‌داری‌شده تغییری نکرد.");
  }

  const actionable = results.filter(r => r.action === "preview" && r.confidence === "likely");
  const chosen = actionable.filter(r => selected.has(duplicateGroupKey(r)));
  const selectedRecords = chosen.reduce((count, r) => count + r.remove_ids.length, 0);

  async function loadArchives(after = 0) {
    await perform(async () => {
      const page = await archivePage(after);
      setArchives(old => ({ ...page, records: after ? [...old.records, ...page.records] : page.records }));
      setArchiveLoaded(true);
    });
  }

  return <div dir="rtl"><Header /><main className="business-workspace duplicate-workspace">
    <header className="business-workspace__heading"><div><h1>حذف کسب‌وکارهای تکراری</h1><p>فایل نتیجه را اضافه کنید، نسخه‌ها را ببینید و دکمه حذف را بزنید. هر مقایسه، نسخه‌های یک کسب‌وکار مثل «داتو» را نشان می‌دهد.</p></div><Link to="/services">بازگشت به کسب‌وکارها</Link></header>
    {error && <p role="alert" className="duplicate-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <section className="duplicate-panel"><h2>۱. دریافت خروجی برای تحلیل</h2>
      <div className="duplicate-controls">
        <label>شهر (اختیاری)<input list="duplicate-cities" value={city} disabled={busy} onChange={e => setCity(e.target.value)} placeholder="همه شهرها" /><datalist id="duplicate-cities">{cities.map(c => <option key={c} value={c} />)}</datalist></label>
        <label>دسته اصلی (اختیاری)<select value={parent} disabled={busy} onChange={e => setParent(e.target.value)}><option value="">همه دسته‌ها</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <Button disabled={busy} onClick={exportData}>{incremental ? "دانلود بسته بخش‌بندی‌شده" : "دانلود JSON کسب‌وکارها"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => downloadDuplicateFile("business-duplicates-prompt.txt", prompt, "text/plain")}>دانلود دستور تحلیل</Button>
      </div><p>فقط عنوان، تلفن‌ها، شهر، نشانی، تاریخ ایجاد و ۱۲۰ نویسه اول توضیحات صادر می‌شود. فیلترها اختیاری‌اند؛ رکوردهای بایگانی‌شده وارد خروجی نمی‌شوند.</p>
      <p>فیلتر شهر یا گروه ممکن است بعضی تکراری‌های میان گروه‌ها را از دید تحلیل پنهان کند.</p>
      <label className="duplicate-check"><input type="checkbox" disabled={busy} checked={incremental} onChange={e => setIncremental(e.target.checked)} />فقط رکوردهای تازه را با داده‌های قبلی مقایسه کن</label>
      {incremental && <div className="duplicate-incremental"><div className="duplicate-controls">
        <label>بررسی کامل انجام‌شده تا<input type="datetime-local" value={cutoff} disabled={busy} onChange={e => setCutoff(e.target.value)} /></label>
        <label>حداکثر رکورد در هر فایل<input type="number" min={2} max={5000} value={maxRecords} disabled={busy} onChange={e => setMaxRecords(Number(e.target.value))} /></label>
      </div><p>زمان بر اساس ساعت این دستگاه است. موارد ایجاد یا ویرایش‌شده پس از آن، تازه‌اند. همه تازه‌ها در هر بخش تکرار می‌شوند؛ داده‌های قبلی بین بخش‌ها تقسیم می‌شوند. فقط بخش اول تازه‌ها را با یکدیگر مقایسه می‌کند.</p><p>این تاریخ فرضِ بررسی قبلی شماست؛ خروجی گرفتن چیزی را بررسی‌شده علامت نمی‌زند. فقط پس از پایان همه بخش‌ها و رسیدگی به نتایج، تاریخ را جلو ببرید؛ بررسی یک شهر یا گروه به معنی بررسی کل پایگاه نیست.</p></div>}
    </section>
    <section className="duplicate-panel"><h2>۲. بررسی نتیجه هوش مصنوعی</h2>
      <div className="duplicate-controls"><label>افزودن فایل نتیجه JSON<input type="file" multiple accept=".json,application/json" disabled={busy} onChange={e => { void loadFiles(e.target.files); e.target.value = ""; }} /></label></div>
      <p>مقایسه‌ها پس از انتخاب فایل خودکار باز می‌شوند. اطلاعات تا وقتی دکمه حذف را نزنید، تغییر نمی‌کنند.</p>
      {coverage && <p role="status">{coverage.total === null ? `${coverage.received} فایل نتیجه خوانده شد.` : `${coverage.received} از ${coverage.total} بخش دریافت شد.`}{!coverage.complete && " می‌توانید تکراری‌های همین بخش را حذف کنید؛ بخش‌های باقی‌مانده را بعداً اضافه کنید. تا پایان همه بخش‌ها، تاریخ آخرین بررسی را جلو نبرید."}</p>}
      {loadedFiles.length > 0 && <details className="duplicate-loaded-files"><summary>گزارش و مدیریت فایل‌ها (اختیاری)</summary>
        <div className="duplicate-controls"><Button variant="outline" disabled={busy || !groups.length} onClick={() => perform(() => loadComparisons())}>تازه‌سازی مقایسه‌ها</Button>
          <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.json", JSON.stringify({ schema_version: "1.0", results }, null, 2))}>دانلود گزارش JSON</Button>
          <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.txt", readableDuplicateReport(results), "text/plain")}>دانلود گزارش متنی</Button></div>
        <ul>{loadedFiles.map((file, index) => <li key={index}><bdi>{file.name}</bdi><Button variant="ghost" disabled={busy} onClick={() => perform(() => installFiles(loadedFiles.filter((_, i) => i !== index)))}>برداشتن فایل از صفحه</Button></li>)}</ul>
        <Button variant="outline" disabled={busy} onClick={() => perform(() => installFiles([]))}>شروع بررسی جدید</Button>
      </details>}
      {results.map((r, index) => <article className="duplicate-group" key={`${duplicateGroupKey(r)}:${index}`}>
        <header><h3>{r.records?.find(record => record.service.id === r.keep_id)?.service.name || `کسب‌وکار #${r.keep_id}`}</h3><span>{({ preview: "آماده بررسی", blocked: "قابل حذف نیست", merged: "تکراری‌ها حذف و بایگانی شدند", already_applied: "قبلاً انجام شده", error: "خطا" } as Record<string, string>)[r.action] ?? r.action}{r.action === "preview" && ` · ${r.confidence === "possible" ? "نیاز به انتخاب نسخه" : "پیشنهاد هوش مصنوعی"}`}</span></header>
        <p>{r.reason}</p>{r.message && <p role="alert">{r.message}</p>}
        {r.resolved_ids && <p>برخی شناسه‌ها قبلاً بایگانی شده‌اند. رکوردهای فعلی در پایین نمایش داده می‌شوند؛ انتخاب نسخه را دوباره تأیید کنید.</p>}
        {r.proposals && <details><summary>پیشنهادهای اولیه بخش‌های مختلف؛ هم‌پوشانی به معنی تأیید یکسان بودن نیست</summary>{r.proposals.map((g, i) => <p key={i}>نگه‌داری #{g.keep_id} · بایگانی {g.remove_ids.join("، ")} · {g.reason}</p>)}</details>}
        {r.plan?.blocked.map(text => <p className="duplicate-error" key={text}>{text}</p>)}
        <div className="duplicate-records">{r.records?.map(record => <section key={record.service.id} className={record.service.id === r.keep_id ? "duplicate-keeper" : ""}>
          <h4>{record.service.id === r.keep_id ? "نسخه پیشنهادی برای نگه‌داری" : "نسخه تکراری پیشنهادی"}: <Link to={`/services/${record.service.id}`} target="_blank">{record.service.name} · #{record.service.id}</Link></h4>
          <p>{record.service.city || "شهر نامشخص"} · {record.service.address || "نشانی نامشخص"}</p><p className="whitespace-pre-wrap">{record.service.description || "بدون توضیحات"}</p>
          <ul>{record.contacts.map((c, i) => <li key={i}>{c.title}: <bdi>{c.value}</bdi>{!c.is_visible && " (پنهان)"}</li>)}</ul>
          <p>{record.categories.length} دسته · {record.bookmarks.length} ذخیره</p>
          <details><summary>تمام جزئیات و متن منبع</summary><pre dir="ltr">{JSON.stringify(record, null, 2)}</pre></details>
        </section>)}</div>
        {r.plan && r.action === "preview" && <p>نسخه #{r.keep_id} نگه داشته می‌شود و {r.remove_ids.length} نسخه دیگر حذف می‌شود. نسخه کامل موارد حذف‌شده در بایگانی باقی می‌ماند.</p>}
        {r.action === "preview" && r.confidence === "possible" && <div className="duplicate-incremental"><p>اگر همه این موارد مربوط به یک کسب‌وکارند، نسخه کامل‌تر را انتخاب کنید؛ در شرایط برابر، جدیدتر اولویت دارد. دکمه زیر نسخه انتخابی را نگه می‌دارد و بقیه را حذف می‌کند.</p><div className="duplicate-controls"><label>نسخه قابل نگه‌داری<select disabled={busy} value={keeperChoices[duplicateGroupKey(r)] ?? r.keep_id} onChange={e => setKeeperChoices(old => ({ ...old, [duplicateGroupKey(r)]: Number(e.target.value) }))}>{r.records?.map(record => <option value={record.service.id} key={record.service.id}>#{record.service.id} · {record.service.name}</option>)}</select></label><Button variant="destructive" disabled={busy} onClick={() => removePossible(r)}>نگه‌داری این نسخه و حذف بقیه</Button></div></div>}
        {r.action === "preview" && r.confidence === "likely" && <div className="duplicate-actions">
          <Button variant="destructive" disabled={busy} aria-label={`حذف نسخه‌های تکراری کسب‌وکار #${r.keep_id}`} onClick={() => perform(() => removeRecords([r]))}>{r.remove_ids.length === 1 ? "حذف نسخه تکراری" : `حذف ${r.remove_ids.length} نسخه تکراری`}</Button>
          {(actionable.length > 1 || selected.has(duplicateGroupKey(r))) && <label className="duplicate-check"><input type="checkbox" disabled={busy} checked={selected.has(duplicateGroupKey(r))} onChange={e => setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(duplicateGroupKey(r)); else next.delete(duplicateGroupKey(r)); return next; })} />انتخاب برای حذف چندتایی</label>}
        </div>}
        {r.action === "error" && <Button variant="outline" disabled={busy} onClick={() => perform(() => loadComparisons())}>بررسی دوباره مقایسه</Button>}
      </article>)}
    </section>
    {selectedRecords > 0 && <section className="duplicate-panel duplicate-bulk"><p>{chosen.length} کسب‌وکار انتخاب شده؛ نسخه پیشنهادی هرکدام نگه داشته می‌شود.</p><Button variant="destructive" disabled={busy} onClick={() => perform(() => removeRecords(chosen))}>حذف {selectedRecords} رکورد تکراری انتخاب‌شده</Button></section>}
    <details className="duplicate-panel"><summary>بایگانی نسخه‌های حذف‌شده (اختیاری)</summary><Button variant="outline" disabled={busy} onClick={() => loadArchives()}>دریافت بایگانی</Button>
      {archiveLoaded && !archives.records.length && <p>بایگانی خالی است.</p>}
      <ul>{archives.records.map(a => <li key={a.original_id}>#{a.original_id} ← {a.survivor_id ? <Link to={`/services/${a.survivor_id}`}>#{a.survivor_id}</Link> : "رکورد اصلی دیگر موجود نیست"} · {a.reason} <Button variant="outline" disabled={busy} onClick={() => perform(async () => downloadDuplicateFile(`business-archive-${a.original_id}.json`, JSON.stringify(await archivedRecord(a.original_id), null, 2)))}>دانلود نسخه کامل</Button></li>)}</ul>
      {archives.next_after !== null && <Button disabled={busy} onClick={() => loadArchives(archives.next_after!)}>موارد بیشتر</Button>}
    </details>
  </main></div>;
}
