import { AuditLog } from "@/types/audit";
import { formatDateTime, formatUnixDateTime, prettyValue } from "@/lib/userDisplay";
import { auditActionLabel, auditFieldLabel } from "@/lib/auditDisplay";

const unixDateFields = new Set(["ban_time", "join_date", "hilfen_date_join", "hilfen_limits_time"]);

const prettyAuditValue = (field: string, value: unknown) => {
  if (value === null) return "خالی";
  if (value === undefined) return "تعریف‌نشده";
  if (value === true) return "بله";
  if (value === false) return "خیر";
  if (unixDateFields.has(field)) {
    const numeric = Number(value);
    if (numeric === 0) return field === "hilfen_limits_time" ? "بدون محدودیت" : "ثبت نشده";
    return formatUnixDateTime(numeric);
  }
  return prettyValue(value);
};

export function AuditDetail({ log }: { log: AuditLog }) {
  return (
    <div className="space-y-4 text-sm" dir="rtl">
      <div className="grid gap-2 sm:grid-cols-2">
        <p><span className="text-muted-foreground">مدیر:</span> {log.admin_username} (#{log.admin_id})</p>
        <p><span className="text-muted-foreground">کاربر هدف:</span> #{log.target_id}</p>
        <p><span className="text-muted-foreground">عملیات:</span> {auditActionLabel(log.action)}</p>
        <p><span className="text-muted-foreground">زمان:</span> {formatDateTime(log.created_at)}</p>
        <p><span className="text-muted-foreground">درخواست همگام‌سازی:</span> {log.sync_channels === null || log.sync_channels === undefined ? "—" : log.sync_channels ? "بله" : "خیر"}</p>
        <p><span className="text-muted-foreground">آدرس IP:</span> <span dir="ltr">{log.ip_address || "—"}</span></p>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">تغییرات</h3>
        {Object.entries(log.changes).map(([field, change]) => (
          <div key={field} className="rounded-lg border border-border/60 p-3">
            <p className="font-medium">{auditFieldLabel(field)}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <pre className="overflow-auto rounded bg-muted/40 p-2 text-xs"><span className="text-muted-foreground">قبل: </span>{prettyAuditValue(field, change.before)}</pre>
              <pre className="overflow-auto rounded bg-muted/40 p-2 text-xs"><span className="text-muted-foreground">بعد: </span>{prettyAuditValue(field, change.after)}</pre>
            </div>
          </div>
        ))}
      </div>
      {log.user_agent && <p className="break-words text-xs text-muted-foreground">مشخصات مرورگر: {log.user_agent}</p>}
    </div>
  );
}
