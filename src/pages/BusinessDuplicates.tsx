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
  const [confirmed, setConfirmed] = useState(false);

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
      installFiles(addDuplicateFiles(loadedFiles, incoming));
    });
  }

  function installFiles(files: LoadedDuplicateFile[]) {
    const parsed = combineDuplicateFiles(files.map(f => f.text));
    setLoadedFiles(files); setResults([]); setSelected(new Set()); setConfirmed(false); setKeeperChoices({});
    setGroups(parsed.groups); setReviews(parsed.reviews); setCoverage(files.length ? parsed.coverage : null);
    setMessage(files.length ? `${files.length} فایل و ${parsed.groups.length} گروه آماده بررسی است. برای فایل‌های تازه پیش‌نمایش بگیرید؛ مواردی که قبلاً اعمال شده‌اند تشخیص داده می‌شوند.` : "فایل‌های این صفحه پاک شدند؛ اطلاعات پایگاه داده تغییری نکرد.");
  }

  async function preview() {
    await perform(async () => {
      setResults([]); setSelected(new Set()); setConfirmed(false);
      const collected: MergeResult[] = [];
      for (let i = 0; i < groups.length; i += 20) {
        const page = await mergeDuplicateGroups(groups.slice(i, i + 20), true);
        collected.push(...page.results.map(r => ({ ...r, proposals: reviews[duplicateGroupKey(r.requested_group ?? r)] }))); setResults([...collected]);
        setMessage(`بررسی ${Math.min(i + 20, groups.length)} از ${groups.length} گروه`);
      }
      setMessage("پیش‌نمایش آماده است. گروه‌های قطعی مورد تأییدتان را انتخاب کنید؛ موارد احتمالی فقط برای بررسی هستند.");
    });
  }

  async function confirmPossible(result: MergeResult) {
    await perform(async () => {
      const key = duplicateGroupKey(result), originalKey = duplicateGroupKey(result.requested_group ?? result), keep = keeperChoices[key] ?? result.keep_id;
      const confirmedGroup: DuplicateGroup = { keep_id: keep, remove_ids: [result.keep_id, ...result.remove_ids].filter(id => id !== keep), confidence: "likely",
        reason: (`مدیر یکسان بودن همه موارد و نگه‌داری رکورد ${keep} را پس از بررسی تأیید کرد. ` + (result.proposals ?? [result]).map(g => g.reason).join("؛ ")).slice(0, 2000) };
      const preview = (await mergeDuplicateGroups([confirmedGroup], true)).results[0];
      if (!result.requested_group) setGroups(old => old.map(g => duplicateGroupKey(g) === originalKey ? confirmedGroup : g));
      setResults(old => old.map(r => duplicateGroupKey(r) === key ? { ...preview, proposals: result.proposals } : r));
      setSelected(new Set()); setConfirmed(false);
      setMessage("انتخاب شما در پیش‌نمایش به‌روزرسانی شد؛ هنوز هیچ رکوردی حذف نشده است.");
    });
  }

  async function apply() {
    await perform(async () => {
      const chosen = results.filter(r => selected.has(duplicateGroupKey(r)) && r.action === "preview" && r.confidence === "likely");
      if (!confirmed || !chosen.length) throw new Error("ابتدا گروه‌های انتخابی و تأیید بایگانی را بررسی کنید.");
      const updated = [...results];
      for (const r of chosen) {
        const { results: applied } = await mergeDuplicateGroups([{
          keep_id: r.keep_id, remove_ids: r.remove_ids, reason: r.reason, confidence: r.confidence, preview_token: r.preview_token,
        }], false);
        const index = updated.findIndex(x => duplicateGroupKey(x) === duplicateGroupKey(r));
        updated[index] = { ...r, ...applied[0] };
        setResults([...updated]);
        setSelected(previous => new Set([...previous].filter(key => key !== duplicateGroupKey(r))));
      }
      setConfirmed(false); setArchiveLoaded(false);
      setMessage("عملیات پایان یافت؛ وضعیت هر گروه را بررسی و گزارش را ذخیره کنید. موارد خطادار نیاز به پیش‌نمایش دوباره دارند.");
    });
  }

  async function loadArchives(after = 0) {
    await perform(async () => {
      const page = await archivePage(after);
      setArchives(old => ({ ...page, records: after ? [...old.records, ...page.records] : page.records }));
      setArchiveLoaded(true);
    });
  }

  return <div dir="rtl"><Header /><main className="business-workspace duplicate-workspace">
    <header className="business-workspace__heading"><div><h1>مدیریت تکراری‌ها</h1><p>نسخه کامل‌تر را نگه دارید؛ در شرایط برابر، نسخه جدیدتر اولویت دارد.</p></div><Link to="/services">بازگشت به کسب‌وکارها</Link></header>
    {error && <p role="alert" className="duplicate-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <section className="duplicate-panel"><h2>۱. دریافت خروجی برای تحلیل</h2>
      <div className="duplicate-controls">
        <label>شهر (اختیاری)<input list="duplicate-cities" value={city} disabled={busy} onChange={e => setCity(e.target.value)} placeholder="همه شهرها" /><datalist id="duplicate-cities">{cities.map(c => <option key={c} value={c} />)}</datalist></label>
        <label>گروه اصلی (اختیاری)<select value={parent} disabled={busy} onChange={e => setParent(e.target.value)}><option value="">همه گروه‌ها</option>{parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
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
      <div className="duplicate-controls"><label>افزودن فایل نتیجه JSON<input type="file" multiple accept=".json,application/json" disabled={busy} onChange={e => { void loadFiles(e.target.files); e.target.value = ""; }} /></label>
        <Button disabled={busy || !groups.length} onClick={preview}>پیش‌نمایش بدون تغییر</Button>
        <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.json", JSON.stringify({ schema_version: "1.0", results }, null, 2))}>دانلود گزارش کامل JSON</Button>
        <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.txt", readableDuplicateReport(results), "text/plain")}>دانلود گزارش متنی</Button>
      </div>
      {coverage && <p role="status">{coverage.total === null ? `${coverage.received} فایل نتیجه خوانده شد.` : `${coverage.received} از ${coverage.total} بخش دریافت شد.`}{!coverage.complete && " می‌توانید همین بخش را بررسی و اعمال کنید؛ بخش‌های باقی‌مانده را بعداً اضافه کنید. تا پایان همه بخش‌ها، تاریخ آخرین بررسی را جلو نبرید."}</p>}
      {loadedFiles.length > 0 && <div className="duplicate-loaded-files"><ul>{loadedFiles.map((file, index) => <li key={index}><bdi>{file.name}</bdi><Button variant="ghost" disabled={busy} onClick={() => installFiles(loadedFiles.filter((_, i) => i !== index))}>حذف از این صفحه</Button></li>)}</ul><Button variant="outline" disabled={busy} onClick={() => installFiles([])}>شروع بررسی جدید</Button></div>}
      {results.map((r, index) => <article className="duplicate-group" key={`${duplicateGroupKey(r)}:${index}`}>
        <header><h3>نگه‌داری #{r.keep_id} · بایگانی {r.remove_ids.map(id => `#${id}`).join("، ")}</h3><span>{({ preview: "آماده بررسی", blocked: "مسدود", merged: "تکراری‌ها بایگانی شدند", already_applied: "قبلاً انجام شده", error: "خطا" } as Record<string, string>)[r.action] ?? r.action} · {r.confidence === "possible" ? "احتمالی" : "پیشنهاد قطعی"}</span></header>
        <p>{r.reason}</p>{r.message && <p role="alert">{r.message}</p>}
        {r.resolved_ids && <p>برخی شناسه‌ها قبلاً بایگانی شده‌اند. رکوردهای فعلی در پایین نمایش داده می‌شوند؛ انتخاب نسخه را دوباره تأیید کنید.</p>}
        {r.proposals && <details><summary>پیشنهادهای اولیه بخش‌های مختلف؛ هم‌پوشانی به معنی تأیید یکسان بودن نیست</summary>{r.proposals.map((g, i) => <p key={i}>نگه‌داری #{g.keep_id} · بایگانی {g.remove_ids.join("، ")} · {g.reason}</p>)}</details>}
        {r.plan?.blocked.map(text => <p className="duplicate-error" key={text}>{text}</p>)}
        <div className="duplicate-records">{r.records?.map(record => <section key={record.service.id} className={record.service.id === r.keep_id ? "duplicate-keeper" : ""}>
          <h4>{record.service.id === r.keep_id ? "نگه‌داری" : "بایگانی"}: <Link to={`/services/${record.service.id}`} target="_blank">{record.service.name} · #{record.service.id}</Link></h4>
          <p>{record.service.city || "شهر نامشخص"} · {record.service.address || "نشانی نامشخص"}</p><p className="whitespace-pre-wrap">{record.service.description || "بدون توضیحات"}</p>
          <ul>{record.contacts.map((c, i) => <li key={i}>{c.title}: <bdi>{c.value}</bdi>{!c.is_visible && " (پنهان)"}</li>)}</ul>
          <p>{record.categories.length} دسته · {record.bookmarks.length} ذخیره</p>
          <details><summary>تمام جزئیات و متن منبع</summary><pre dir="ltr">{JSON.stringify(record, null, 2)}</pre></details>
        </section>)}</div>
        {r.plan && <p>رکورد #{r.keep_id} بدون تغییر باقی می‌ماند. نسخه کامل رکوردهای دیگر بایگانی و از فهرست فعال حذف می‌شود.</p>}
        {r.action === "preview" && r.confidence === "possible" && <div className="duplicate-incremental"><p>فقط اگر پس از دیدن جزئیات، همه این موارد را یک کسب‌وکار می‌دانید، نسخه کامل‌تر را انتخاب کنید؛ در شرایط برابر، جدیدتر اولویت دارد.</p><div className="duplicate-controls"><label>نسخه قابل نگه‌داری<select disabled={busy} value={keeperChoices[duplicateGroupKey(r)] ?? r.keep_id} onChange={e => setKeeperChoices(old => ({ ...old, [duplicateGroupKey(r)]: Number(e.target.value) }))}>{r.records?.map(record => <option value={record.service.id} key={record.service.id}>#{record.service.id} · {record.service.name}</option>)}</select></label><Button variant="outline" disabled={busy} onClick={() => confirmPossible(r)}>تأیید یکسان بودن و انتخاب نسخه</Button></div></div>}
        {r.action === "preview" && r.confidence === "likely" && <label className="duplicate-check"><input type="checkbox" disabled={busy} checked={selected.has(duplicateGroupKey(r))} onChange={e => { setConfirmed(false); setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(duplicateGroupKey(r)); else next.delete(duplicateGroupKey(r)); return next; }); }} />نگه‌داری این نسخه و حذف تکراری‌های این گروه را تأیید می‌کنم</label>}
      </article>)}
    </section>
    <section className="duplicate-panel"><h2>۳. اعمال گروه‌های انتخاب‌شده</h2><p>اطلاعات، تماس‌ها و دسته‌های رکورد اصلی تغییر نمی‌کنند. نسخه‌های تکراری از فهرست فعال حذف و به‌طور کامل بایگانی می‌شوند. ذخیره‌های کاربران به رکورد باقی‌مانده هدایت می‌شوند.</p>
      <label className="duplicate-check"><input type="checkbox" disabled={busy || !selected.size} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />انتقال رکوردهای انتخاب‌شده از فهرست فعال به بایگانی را تأیید می‌کنم.</label>
      <Button disabled={busy || !selected.size || !confirmed} onClick={apply}>اعمال {selected.size} گروه انتخاب‌شده</Button>
    </section>
    <section className="duplicate-panel"><h2>بایگانی خصوصی</h2><Button variant="outline" disabled={busy} onClick={() => loadArchives()}>دریافت بایگانی</Button>
      {archiveLoaded && !archives.records.length && <p>بایگانی خالی است.</p>}
      <ul>{archives.records.map(a => <li key={a.original_id}>#{a.original_id} ← {a.survivor_id ? <Link to={`/services/${a.survivor_id}`}>#{a.survivor_id}</Link> : "رکورد اصلی دیگر موجود نیست"} · {a.reason} <Button variant="outline" disabled={busy} onClick={() => perform(async () => downloadDuplicateFile(`business-archive-${a.original_id}.json`, JSON.stringify(await archivedRecord(a.original_id), null, 2)))}>دانلود نسخه کامل</Button></li>)}</ul>
      {archives.next_after !== null && <Button disabled={busy} onClick={() => loadArchives(archives.next_after!)}>موارد بیشتر</Button>}
    </section>
  </main></div>;
}
