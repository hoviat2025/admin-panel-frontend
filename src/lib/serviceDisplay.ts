import {
  ContactType,
  OwnerCandidate,
  RELEVANCE_KEYS,
  RelevanceAnswerChoice,
  RelevanceKey,
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
 * The four Iranian/Persian relevance signals, as four independent facts.
 *
 * The distinctions that matter, and that the wording must not blur:
 *   ownership  - who owns the business
 *   provider   - who actually performs the service
 *   language   - what language the customer can be served in
 *   service    - what the product itself is
 *
 * Ownership and provider are deliberately separate because they often differ
 * (a German-owned clinic with an Iranian dentist), and none of them is about
 * where the service is located: this directory is German, and these attributes
 * say nothing about geography.
 */
export const PERSIAN_FLAG_OPTIONS: Array<{
  key: RelevanceKey;
  label: string;
  hint: string;
  short: string;
}> = [
  {
    key: "persian_owned",
    label: "مالکیت ایرانی یا فارسی",
    hint: "مالک کسب‌وکار ایرانی یا فارسی‌تبار است. این فقط دربارهٔ مالکیت است، نه دربارهٔ زبانی که مالک صحبت می‌کند و نه دربارهٔ کسی که کار را انجام می‌دهد.",
    short: "مالک ایرانی/فارسی",
  },
  {
    key: "persian_provider",
    label: "ارائه‌دهندهٔ ایرانی یا فارسی",
    hint: "کسی که واقعاً خدمت را انجام می‌دهد ایرانی یا فارسی‌تبار است. برای نمونه یک کلینیک با مالکیت آلمانی و دندان‌پزشش ایرانی: مالکیت خیر، ارائه‌دهنده بله.",
    short: "ارائه‌دهندهٔ ایرانی/فارسی",
  },
  {
    key: "persian_language",
    label: "ارائه خدمات به زبان فارسی",
    hint: "مشتری می‌تواند این خدمت را به زبان فارسی دریافت کند. این هیچ چیزی دربارهٔ ملیت مالک یا ارائه‌دهنده نمی‌گوید.",
    short: "زبان فارسی",
  },
  {
    key: "persian_service",
    label: "خدمت یا محصول ایرانی و فارسی",
    hint: "خودِ محصول یا خدمت ذاتاً ایرانی یا فارسی است؛ مثل غذای ایرانی، فرش ایرانی یا خدمات فرهنگی ایرانی. لازم نیست مالک یا ارائه‌دهنده ایرانی باشد.",
    short: "خدمت ایرانی/فارسی",
  },
];

/** Labels for the tri-state control. Admins never see nullable-boolean wording. */
export const RELEVANCE_ANSWER_LABELS: Record<RelevanceAnswerChoice, string> = {
  unknown: "نامشخص",
  yes: "بله",
  no: "خیر",
};

export const RELEVANCE_ANSWER_OPTIONS: RelevanceAnswerChoice[] = ["unknown", "yes", "no"];

export function persianFlags(service: Pick<Service, RelevanceKey>) {
  return PERSIAN_FLAG_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    short: option.short,
    /** null means "not assessed", which is not the same as "no". */
    answer: service[option.key],
    active: service[option.key] === true,
  }));
}

export function activePersianFlagCount(service: Service): number {
  return RELEVANCE_KEYS.filter((key) => service[key] === true).length;
}

/** How many signals have not been assessed yet, for the list display. */
export function unassessedRelevanceCount(service: Service): number {
  return RELEVANCE_KEYS.filter((key) => service[key] === null).length;
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

/* --------------------------------------------------------------- location */

/** This directory covers services located in Germany. */
export const DEFAULT_COUNTRY = "Germany";

export const DEFAULT_COUNTRY_LABEL = "آلمان";

/**
 * The 16 German Bundeslaender, offered as suggestions in the editor.
 *
 * This is a convenience list for data entry, not a controlled reference system:
 * `state` is stored as free text so the product is not locked to Germany
 * forever, and an admin can always type a value that is not listed.
 */
export const BUNDESLAENDER = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
] as const;

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
