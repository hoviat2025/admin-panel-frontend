import { User } from "@/types/user";

export type MembershipKind = "both" | "eurobot" | "hilfen" | "neither";

export function getMembershipKind(user: Pick<User, "is_in_eurobot" | "is_in_hilfen_bot">): MembershipKind {
  if (user.is_in_eurobot && user.is_in_hilfen_bot) return "both";
  if (user.is_in_eurobot) return "eurobot";
  if (user.is_in_hilfen_bot) return "hilfen";
  return "neither";
}

export function formatUnixDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(numeric * 1000));
}

export function formatUnixDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(numeric * 1000));
}

export function unixSecondsToDateTimeLocal(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const date = new Date(numeric * 1000);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 19);
}

export function dateTimeLocalToUnixSeconds(value: string): number | null {
  if (!value) return null;
  const milliseconds = new Date(value).getTime();
  return Number.isNaN(milliseconds) ? null : Math.floor(milliseconds / 1000);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export function getSyncStatus(user: Pick<User, "updated_at" | "channel_updated_at">): string {
  if (!user.channel_updated_at) return "هرگز همگام‌سازی نشده";
  const updated = new Date(user.updated_at).getTime();
  const channel = new Date(user.channel_updated_at).getTime();
  if (!Number.isFinite(updated) || !Number.isFinite(channel)) return "نامشخص";
  return updated > channel ? "اطلاعات کاربر جدیدتر از کانال است" : "همگام‌سازی‌شده";
}

export function parseMaybeJson(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function prettyValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function getProfileImageUrlSafe(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://pub-4036d35baed54ee7a9504072ea49740f.r2.dev/${path}`;
}
