import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditDetail } from "@/components/AuditDetail";
import { AuditFilters, fetchAuditLog, fetchAuditLogs, toIsoDateTime } from "@/lib/auditApi";
import { AUDIT_ACTION_OPTIONS, AUDIT_FIELD_OPTIONS, auditActionLabel, auditFieldLabel } from "@/lib/auditDisplay";
import { AuditLog, AuditListMeta } from "@/types/audit";
import { formatDateTime } from "@/lib/userDisplay";

const emptyMeta: AuditListMeta = { total: 0, page: 1, size: 20, pages: 0 };

const AuditHistory = () => {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [draft, setDraft] = useState<AuditFilters>({});
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState(emptyMeta);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const target = searchParams.get("target_user_id");
    if (target) {
      const initial = { target_user_id: target };
      setDraft(initial);
      setFilters(initial);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAuditLogs(filters, page)
      .then((result) => {
        setLogs(result.data);
        setMeta(result.meta);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "دریافت تاریخچه فعالیت‌ها ممکن نشد"))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const applyFilters = () => {
    const adminId = draft.admin_id?.trim();
    const targetUserId = draft.target_user_id?.trim();
    if ((adminId && !/^\d+$/.test(adminId)) || (targetUserId && !/^\d+$/.test(targetUserId))) {
      setError("شناسه مدیر و شناسه کاربر باید عدد باشند.");
      return;
    }
    const after = toIsoDateTime(draft.created_after ?? "");
    const before = toIsoDateTime(draft.created_before ?? "");
    if ((draft.created_after && !after) || (draft.created_before && !before)) {
      setError("تاریخ واردشده معتبر نیست.");
      return;
    }
    if (after && before && after > before) {
      setError("تاریخ شروع باید قبل از تاریخ پایان باشد.");
      return;
    }
    setError(null);
    setPage(1);
    setFilters({ ...draft, created_after: after, created_before: before });
  };

  const clearFilters = () => {
    setDraft({});
    setPage(1);
    setFilters({});
  };

  const updateChangedField = (field: string, checked: boolean) => {
    const current = draft.changed_field ?? [];
    const next = checked ? [...current, field] : current.filter((item) => item !== field);
    setDraft({ ...draft, changed_field: next.length ? next : undefined });
  };

  const openDetails = async (log: AuditLog) => {
    setSelectedId(log.id);
    setSelected(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setSelected(await fetchAuditLog(log.id));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "دریافت جزئیات ممکن نشد");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main className="container mx-auto space-y-6 px-4 pb-10" dir="rtl">
        <div>
          <h1 className="text-2xl font-semibold">تاریخچه فعالیت مدیران</h1>
          <p className="text-muted-foreground">تغییراتی را که مدیران روی اطلاعات کاربران انجام داده‌اند بررسی کنید.</p>
        </div>

        <GlassBox>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span>نام کاربری مدیر</span>
              <Input placeholder="بخشی از نام کاربری" value={draft.admin_username ?? ""} onChange={(event) => setDraft({ ...draft, admin_username: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>شناسه مدیر</span>
              <Input type="number" placeholder="شناسه عددی مدیر" dir="ltr" value={draft.admin_id ?? ""} onChange={(event) => setDraft({ ...draft, admin_id: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>شناسه کاربر هدف</span>
              <Input type="number" placeholder="شناسه عددی تلگرام" dir="ltr" value={draft.target_user_id ?? ""} onChange={(event) => setDraft({ ...draft, target_user_id: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>نوع عملیات</span>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.action ?? ""} onChange={(event) => setDraft({ ...draft, action: event.target.value || undefined })}>
                <option value="">همه عملیات‌ها</option>
                {AUDIT_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>از تاریخ</span>
              <Input type="datetime-local" dir="ltr" value={draft.created_after ?? ""} onChange={(event) => setDraft({ ...draft, created_after: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>تا تاریخ</span>
              <Input type="datetime-local" dir="ltr" value={draft.created_before ?? ""} onChange={(event) => setDraft({ ...draft, created_before: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>همگام‌سازی کانال‌ها</span>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.sync_channels ?? ""} onChange={(event) => setDraft({ ...draft, sync_channels: (event.target.value || undefined) as AuditFilters["sync_channels"] })}>
                <option value="">همه حالت‌ها</option>
                <option value="true">درخواست شده</option>
                <option value="false">درخواست نشده</option>
              </select>
            </label>
          </div>

          <fieldset className="mt-5 rounded-xl border border-border/60 p-4">
            <legend className="px-2 text-sm font-medium">فیلدهای تغییرکرده</legend>
            <p className="mb-3 text-xs text-muted-foreground">می‌توانید چند مورد را انتخاب کنید. نتیجه شامل فعالیت‌هایی است که حداقل یکی از موارد انتخاب‌شده در آن‌ها تغییر کرده باشد.</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {AUDIT_FIELD_OPTIONS.map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                  <input type="checkbox" checked={draft.changed_field?.includes(value) ?? false} onChange={(event) => updateChangedField(value, event.target.checked)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 flex gap-2">
            <Button onClick={applyFilters}>اعمال فیلترها</Button>
            <Button variant="outline" onClick={clearFilters}>پاک کردن</Button>
          </div>
        </GlassBox>

        <GlassBox>
          {loading ? (
            <p>در حال دریافت تاریخچه…</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">فعالیتی با این شرایط پیدا نشد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead><tr className="border-b"><th className="p-2">زمان</th><th className="p-2">مدیر</th><th className="p-2">کاربر هدف</th><th className="p-2">عملیات</th><th className="p-2">فیلدهای تغییرکرده</th><th className="p-2">همگام‌سازی</th><th className="p-2" /></tr></thead>
                <tbody>{logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap p-2">{formatDateTime(log.created_at)}</td>
                    <td className="p-2">{log.admin_username}</td>
                    <td className="p-2" dir="ltr">#{log.target_id}</td>
                    <td className="p-2">{auditActionLabel(log.action)}</td>
                    <td className="p-2">{Object.keys(log.changes).map(auditFieldLabel).join("، ") || "—"}</td>
                    <td className="p-2">{log.sync_channels === undefined || log.sync_channels === null ? "—" : log.sync_channels ? "بله" : "خیر"}</td>
                    <td className="p-2"><Button size="sm" variant="outline" onClick={() => openDetails(log)}>جزئیات</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{meta.total} فعالیت</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</Button>
              <span className="px-2 py-1 text-sm">صفحه {meta.page} از {Math.max(meta.pages, 1)}</span>
              <Button size="sm" variant="outline" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>بعدی</Button>
            </div>
          </div>
        </GlassBox>

        {selectedId && (
          <GlassBox>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">جزئیات فعالیت شماره {selectedId}</h2>
              <Button variant="ghost" onClick={() => { setSelected(null); setSelectedId(null); setDetailError(null); }}>بستن</Button>
            </div>
            {detailLoading ? <p>در حال دریافت جزئیات…</p> : detailError ? <p className="text-destructive">{detailError}</p> : selected ? <AuditDetail log={selected} /> : null}
          </GlassBox>
        )}
      </main>
    </>
  );
};

export default AuditHistory;
