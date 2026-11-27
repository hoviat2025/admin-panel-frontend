import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { fetchCategories, fetchLocationCatalogue } from "@/lib/serviceApi";
import { Category } from "@/types/service";
import { archivePage, archivedRecord, downloadDuplicateFile, exportDuplicatePage, mergeDuplicateGroups,
  parseDuplicateFile, readableDuplicateReport, type ArchivePage, type DuplicateGroup, type MergeResult } from "@/lib/businessDuplicates";
import prompt from "@/data/business-duplicates-prompt.txt?raw";
import "./service-management.css";
import "./business-duplicates.css";

const errorMessage = (e: unknown) => e instanceof Error ? e.message : "عملیات ناموفق بود؛ دوباره تلاش کنید.";

export default function BusinessDuplicates() {
  const [cities, setCities] = useState<string[]>([]);
  const [parents, setParents] = useState<Category[]>([]);
  const [city, setCity] = useState("");
  const [parent, setParent] = useState("");
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [results, setResults] = useState<MergeResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
      let after = 0, ceiling: number | undefined, bytes = 0;
      const records: unknown[] = [];
      do {
        const params = new URLSearchParams({ after: String(after), size: "200" });
        if (city.trim()) params.set("city", city.trim());
        if (parent) params.set("parent_id", parent);
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
      downloadDuplicateFile("business-duplicate-candidates.json", JSON.stringify({ schema_version: "1.0", filters: { city: city || null, parent_id: parent || null }, records }, null, 2));
      setMessage(`خروجی ${records.length} کسب‌وکار آماده شد. آن را همراه دستور تحلیل به هوش مصنوعی بدهید.`);
    });
  }

  async function loadFile(file?: File) {
    if (!file) return;
    await perform(async () => {
      setGroups([]); setResults([]); setSelected(new Set()); setConfirmed(false);
      if (file.size > 2 * 1024 * 1024) throw new Error("حداکثر حجم نتیجه هوش مصنوعی ۲ مگابایت است.");
      const parsed = parseDuplicateFile(await file.text());
      setGroups(parsed); setMessage(`${parsed.length} گروه خوانده شد؛ ابتدا پیش‌نمایش را بگیرید.`);
    });
  }

  async function preview() {
    await perform(async () => {
      setResults([]); setSelected(new Set()); setConfirmed(false);
      const collected: MergeResult[] = [];
      for (let i = 0; i < groups.length; i += 20) {
        const page = await mergeDuplicateGroups(groups.slice(i, i + 20), true);
        collected.push(...page.results); setResults([...collected]);
        setMessage(`بررسی ${Math.min(i + 20, groups.length)} از ${groups.length} گروه`);
      }
      setMessage("پیش‌نمایش آماده است. گروه‌های قطعی مورد تأییدتان را انتخاب کنید؛ موارد احتمالی فقط برای بررسی هستند.");
    });
  }

  async function apply() {
    await perform(async () => {
      const chosen = results.filter(r => selected.has(r.keep_id) && r.action === "preview" && r.confidence === "likely");
      if (!confirmed || !chosen.length) throw new Error("ابتدا گروه‌ها و تأیید بایگانی را انتخاب کنید.");
      const updated = [...results];
      for (const r of chosen) {
        const { results: applied } = await mergeDuplicateGroups([{
          keep_id: r.keep_id, remove_ids: r.remove_ids, reason: r.reason, confidence: r.confidence, preview_token: r.preview_token,
        }], false);
        const index = updated.findIndex(x => x.keep_id === r.keep_id);
        updated[index] = { ...r, ...applied[0] };
        setResults([...updated]);
        setSelected(previous => new Set([...previous].filter(id => id !== r.keep_id)));
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
        <Button disabled={busy} onClick={exportData}>دانلود JSON کسب‌وکارها</Button>
        <Button variant="outline" disabled={busy} onClick={() => downloadDuplicateFile("business-duplicates-prompt.txt", prompt, "text/plain")}>دانلود دستور تحلیل</Button>
      </div><p>فقط عنوان، تلفن‌ها، شهر، نشانی، تاریخ ایجاد و ۱۲۰ نویسه اول توضیحات صادر می‌شود. فیلترها اختیاری‌اند؛ رکوردهای بایگانی‌شده وارد خروجی نمی‌شوند.</p>
      <p>فیلتر شهر یا گروه ممکن است بعضی تکراری‌های میان گروه‌ها را از دید تحلیل پنهان کند.</p>
    </section>
    <section className="duplicate-panel"><h2>۲. بررسی نتیجه هوش مصنوعی</h2>
      <div className="duplicate-controls"><label>فایل نتیجه JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={e => loadFile(e.target.files?.[0])} /></label>
        <Button disabled={busy || !groups.length} onClick={preview}>پیش‌نمایش بدون تغییر</Button>
        <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.json", JSON.stringify({ schema_version: "1.0", results }, null, 2))}>دانلود گزارش کامل JSON</Button>
        <Button variant="outline" disabled={busy || !results.length} onClick={() => downloadDuplicateFile("business-duplicates-report.txt", readableDuplicateReport(results), "text/plain")}>دانلود گزارش متنی</Button>
      </div>
      {results.map(r => <article className="duplicate-group" key={r.keep_id}>
        <header><h3>نگه‌داری #{r.keep_id} · بایگانی {r.remove_ids.map(id => `#${id}`).join("، ")}</h3><span>{({ preview: "آماده بررسی", blocked: "مسدود", merged: "تکراری‌ها بایگانی شدند", already_applied: "قبلاً انجام شده", error: "خطا" } as Record<string, string>)[r.action] ?? r.action} · {r.confidence === "possible" ? "احتمالی" : "پیشنهاد قطعی"}</span></header>
        <p>{r.reason}</p>{r.message && <p role="alert">{r.message}</p>}
        {r.plan?.blocked.map(text => <p className="duplicate-error" key={text}>{text}</p>)}
        <div className="duplicate-records">{r.records?.map(record => <section key={record.service.id} className={record.service.id === r.keep_id ? "duplicate-keeper" : ""}>
          <h4>{record.service.id === r.keep_id ? "نگه‌داری" : "بایگانی"}: <Link to={`/services/${record.service.id}`} target="_blank">{record.service.name} · #{record.service.id}</Link></h4>
          <p>{record.service.city || "شهر نامشخص"} · {record.service.address || "نشانی نامشخص"}</p><p className="whitespace-pre-wrap">{record.service.description || "بدون توضیحات"}</p>
          <ul>{record.contacts.map((c, i) => <li key={i}>{c.title}: <bdi>{c.value}</bdi>{!c.is_visible && " (پنهان)"}</li>)}</ul>
          <p>{record.categories.length} دسته · {record.bookmarks.length} ذخیره</p>
          <details><summary>تمام جزئیات و متن منبع</summary><pre dir="ltr">{JSON.stringify(record, null, 2)}</pre></details>
        </section>)}</div>
        {r.plan && <p>رکورد #{r.keep_id} بدون تغییر باقی می‌ماند. نسخه کامل رکوردهای دیگر بایگانی و از فهرست فعال حذف می‌شود.</p>}
        {r.action === "preview" && r.confidence === "likely" && <label className="duplicate-check"><input type="checkbox" disabled={busy} checked={selected.has(r.keep_id)} onChange={e => { setConfirmed(false); setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(r.keep_id); else next.delete(r.keep_id); return next; }); }} />نگه‌داری این نسخه و حذف تکراری‌های این گروه را تأیید می‌کنم</label>}
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
