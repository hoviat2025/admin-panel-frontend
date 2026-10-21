import type { ContactType, ServiceContactInput } from "@/types/service";

export const CONTACT_METHODS = [
  { key: "phone", label: "تلفن", type: "phone", platform: null, placeholder: "+49 30 123456", hint: "شمارهٔ تماس کسب‌وکار، ترجیحاً با کد کشور." },
  { key: "whatsapp", label: "واتساپ", type: "url", platform: "whatsapp", placeholder: "+49 170 1234567", hint: "شمارهٔ واتساپ را با کد کشور وارد کنید؛ پیوند گفتگو ساخته می‌شود." },
  { key: "email", label: "ایمیل", type: "email", platform: null, placeholder: "hello@example.de", hint: "نشانی ایمیل کسب‌وکار." },
  { key: "website", label: "وب‌سایت", type: "url", platform: "website", placeholder: "example.de", hint: "نشانی سایت؛ افزودن https:// لازم نیست." },
  { key: "instagram", label: "اینستاگرام", type: "url", platform: "instagram", placeholder: "@business_name", hint: "نام کاربری یا پیوند کامل صفحهٔ اینستاگرام." },
  { key: "telegram", label: "تلگرام", type: "url", platform: "telegram", placeholder: "@business_name", hint: "نام کاربری یا پیوند کامل تلگرام." },
  { key: "linkedin", label: "لینکدین", type: "url", platform: "linkedin", placeholder: "linkedin.com/company/example", hint: "پیوند کامل صفحهٔ شخص یا شرکت در لینکدین." },
  { key: "twitter", label: "ایکس / توییتر", type: "url", platform: "twitter", placeholder: "@business_name", hint: "نام کاربری یا پیوند صفحه در X / Twitter." },
  { key: "bluesky", label: "بلواسکای", type: "url", platform: "bluesky", placeholder: "business.bsky.social", hint: "شناسهٔ کامل یا پیوند پروفایل بلواسکای." },
  { key: "discord", label: "دیسکورد", type: "url", platform: "discord", placeholder: "discord.gg/example", hint: "پیوند دعوت به سرور یا پیوند پروفایل دیسکورد." },
  { key: "custom", label: "سایر / روش سفارشی", type: "other", platform: null, placeholder: "اطلاعات ارتباط", hint: "برای روش‌های دیگر، عنوان و جزئیات را مشخص کنید." },
] as const;

export type ContactMethodKey = typeof CONTACT_METHODS[number]["key"];
export type GuidedContact = ServiceContactInput & { method?: ContactMethodKey };

export function contactMethodOf(contact: ServiceContactInput): ContactMethodKey {
  const rawPlatform = contact.platform?.trim().toLowerCase();
  const platform = rawPlatform === "x" ? "twitter" : rawPlatform;
  const known = CONTACT_METHODS.find((method) => method.platform && method.platform === platform);
  if (known) return known.key;
  if (platform) return "custom";
  if (contact.type === "phone") return "phone";
  if (contact.type === "email") return "email";
  if (contact.type === "url") return "website";
  return "custom";
}

export function friendlyContactValue(contact: GuidedContact): string {
  const value = contact.value;
  const method = contact.method ?? contactMethodOf(contact);
  if (method === "whatsapp") {
    const match = value.match(/^https?:\/\/(?:www\.)?wa\.me\/(\d+)\/?(?:\?.*)?$/i);
    if (match) return "+" + match[1];
  }
  return value;
}

function webUrl(value: string): string {
  const parsed = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : "https://" + value);
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error("نشانی وب معتبر وارد کنید.");
  return parsed.href;
}

export function contactValueIssue(contact: GuidedContact): string | null {
  const value = friendlyContactValue(contact).trim();
  const method = contact.method ?? contactMethodOf(contact);
  if (!value) return "مقدار هر راه ارتباطی را وارد کنید.";
  if ((method === "phone" || method === "whatsapp") && (!/^[+\d\s().-]+$/.test(value) || value.replace(/\D/g, "").length < 5)) return "شمارهٔ تلفن یا واتساپ معتبر وارد کنید.";
  if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "نشانی ایمیل معتبر وارد کنید.";
  if (["website", "linkedin", "discord"].includes(method)) { try { webUrl(value); } catch { return "نشانی وب معتبر وارد کنید."; } }
  if (method === "twitter" && !/^https?:\/\//i.test(value) && !/^@?[a-z\d_]{1,15}$/i.test(value)) return "نام کاربری ایکس یا پیوند کامل صفحه را وارد کنید.";
  if (method === "bluesky" && !/^https?:\/\//i.test(value) && !/^@?[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(value)) return "شناسهٔ کامل بلواسکای یا پیوند پروفایل را وارد کنید.";
  if (["twitter", "bluesky"].includes(method) && /^https?:\/\//i.test(value)) { try { webUrl(value); } catch { return "پیوند صفحه معتبر نیست."; } }
  if ((method === "instagram" || method === "telegram") && !/^https?:\/\//i.test(value) && !/^(?:@)?[a-z\d_.]+$/i.test(value)) return "نام کاربری را بدون فاصله یا پیوند کامل صفحه را وارد کنید.";
  if ((method === "instagram" || method === "telegram") && /^https?:\/\//i.test(value)) { try { webUrl(value); } catch { return "پیوند صفحه معتبر نیست."; } }
  return null;
}

export function buildGuidedContact(contact: GuidedContact, index: number): ServiceContactInput {
  const method = CONTACT_METHODS.find((option) => option.key === (contact.method ?? contactMethodOf(contact)))!;
  let value = friendlyContactValue(contact).trim();
  if (method.key === "whatsapp") value = "https://wa.me/" + value.replace(/\D/g, "").replace(/^00/, "");
  if (["website", "linkedin", "discord"].includes(method.key)) value = webUrl(value);
  if (method.key === "twitter" || method.key === "bluesky") value = /^https?:\/\//i.test(value) ? webUrl(value) : (method.key === "twitter" ? "https://x.com/" : "https://bsky.app/profile/") + value.replace(/^@/, "");
  if (method.key === "instagram" || method.key === "telegram") value = /^https?:\/\//i.test(value) ? webUrl(value) : (method.key === "instagram" ? "https://www.instagram.com/" : "https://t.me/") + value.replace(/^@/, "");
  return {
    title: contact.title.trim() || method.label,
    type: method.key === "custom" ? contact.type : method.type as ContactType,
    platform: method.key === "custom" ? contact.platform?.trim() || null : method.platform,
    value, display_order: index, is_visible: contact.is_visible,
  };
}
