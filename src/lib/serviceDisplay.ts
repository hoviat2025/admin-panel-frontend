import {
  ContactType,
  OwnerCandidate,
  Service,
  ServiceStatus,
} from "@/types/service";

/**
 * Presentation helpers for the service directory.
 *
 * The three Persian-relevance flags are deliberately labelled as three separate
 * facts, with help text, because collapsing them into one "Persian" idea is
 * exactly the confusion this milestone is meant to prevent.
 */

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشر شده",
  hidden: "پنهان",
  archived: "بایگانی",
};

export const STATUS_HINTS: Record<ServiceStatus, string> = {
  draft: "در عمومی دیده نمی‌شود و می‌تواند ناقص باشد.",
  published: "در عمومی نمایش داده می‌شود. نیازمند حداقل یک دسته‌بندی و دقیقاً یک دسته‌بندی اصلی است.",
  hidden: "عمداً از نمایش عمومی حذف شده اما داده‌ها حفظ می‌شوند.",
  archived: "رکورد قدیمی و غیرفعال؛ برای حذف استفاده نمی‌شود.",
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  phone: "تلفن",
  email: "ایمیل",
  url: "نشانی وب",
  username: "نام کاربری",
  other: "سایر",
};

export const CONTACT_TYPE_HINTS: Record<ContactType, string> = {
  phone: "شماره تماس، با کد کشور.",
  email: "نشانی ایمیل کامل.",
  url: "نشانی کامل، مثلاً https://example.de",
  username: "نام کاربری در یک شبکه، همراه با انتخاب شبکه در فیلد «شبکه».",
  other: "هر مقدار دیگری که در دسته‌های بالا نیست.",
};

/** Friendly labels for known platforms; unknown ones fall back to the raw value. */
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "اینستاگرام",
  telegram: "تلگرام",
  whatsapp: "واتساپ",
  facebook: "فیسبوک",
  linkedin: "لینکدین",
  x: "ایکس (توییتر)",
  website: "وب‌سایت",
  tiktok: "تیک‌تاک",
  youtube: "یوتیوب",
};

export function platformLabel(platform: string | null | undefined): string {
  if (!platform) return "—";
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform;
}

/**
 * The three Persian-relevance flags, as independent facts.
 *
 * `persian_owned` is about OWNERSHIP, not about the owner being able to speak
 * Persian, so its label deliberately says "Iranian/Persian-owned" rather than
 * anything about language.
 */
export const PERSIAN_FLAG_OPTIONS: Array<{
  key: "persian_owned" | "persian_language" | "persian_service";
  label: string;
  hint: string;
  short: string;
}> = [
  {
    key: "persian_owned",
    label: "مالکیت ایرانی یا فارسی",
    hint: "کسب‌وکار توسط ایرانی یا فارسی‌زبان اداره می‌شود. این درباره مالکیت است، نه درباره زبانی که مالک صحبت می‌کند.",
    short: "مالک ایرانی/فارسی",
  },
  {
    key: "persian_language",
    label: "ارائه خدمات به زبان فارسی",
    hint: "مشتری می‌تواند با این سرویس به فارسی صحبت کند یا کار را پیش ببرد.",
    short: "زبان فارسی",
  },
  {
    key: "persian_service",
    label: "خدمت یا محصول مخصوص ایرانی و فارسی",
    hint: "خودِ محصول ذاتاً ایرانی یا فارسی است؛ مثل غذای ایرانی، فرش ایرانی یا محصولات وارداتی ایران.",
    short: "خدمت ایرانی/فارسی",
  },
];

export function persianFlags(service: Pick<Service, "persian_owned" | "persian_language" | "persian_service">) {
  return PERSIAN_FLAG_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    short: option.short,
    active: service[option.key],
  }));
}

export function activePersianFlagCount(service: Service): number {
  return [service.persian_owned, service.persian_language, service.persian_service].filter(Boolean).length;
}

export function primaryCategoryName(service: Service): string {
  const primary = service.categories?.find((item) => item.is_primary);
  return primary?.category?.name ?? "—";
}

export function categoryNames(service: Service): string[] {
  return (service.categories ?? [])
    .map((item) => item.category?.name)
    .filter((name): name is string => Boolean(name));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ownerLabel(candidate: OwnerCandidate | null | undefined): string {
  if (!candidate) return "—";
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (candidate.nickname) return candidate.nickname;
  if (candidate.username) return `@${candidate.username}`;
  return `کاربر ${candidate.user_id}`;
}

export function ownerIdLabel(ownerUserId: number | null): string {
  if (ownerUserId === null || ownerUserId === undefined) return "بدون مالک";
  return String(ownerUserId);
}

/**
 * Client-side mirror of the backend publish rule, used only to block an
 * obviously invalid submit. The backend remains authoritative and its message
 * is what the admin sees if the two ever disagree.
 */
export interface PublishCheckResult {
  ok: boolean;
  message: string | null;
}

export function checkPublishRequirements(
  status: ServiceStatus,
  categoryIds: number[],
  primaryIds: number[],
): PublishCheckResult {
  if (status !== "published") return { ok: true, message: null };
  if (categoryIds.length === 0) {
    return { ok: false, message: "برای انتشار، حداقل یک دسته‌بندی لازم است." };
  }
  if (primaryIds.length === 0) {
    return { ok: false, message: "برای انتشار، دقیقاً یک دسته‌بندی باید به‌عنوان اصلی انتخاب شود." };
  }
  if (primaryIds.length > 1) {
    return { ok: false, message: "فقط یک دسته‌بندی می‌تواند اصلی باشد." };
  }
  return { ok: true, message: null };
}
