export const AUDIT_ACTION_OPTIONS = [
  { value: "user.update", label: "ویرایش کاربر" },
];

export const AUDIT_FIELD_OPTIONS = [
  ["counter", "شماره کاربر یوروبات"],
  ["accounting_code", "کد حسابداری"],
  ["username", "نام کاربری تلگرام"],
  ["first_name", "نام"],
  ["last_name", "نام خانوادگی"],
  ["nickname", "نام مستعار"],
  ["phone_number", "شماره تلفن"],
  ["whatsapp_number", "شماره واتساپ"],
  ["country", "کشور"],
  ["password", "رمز عبور"],
  ["mode", "حالت"],
  ["is_ban", "وضعیت مسدودی"],
  ["is_registered", "وضعیت ثبت‌نام"],
  ["chat_not_found", "در دسترس نبودن گفتگو"],
  ["is_in_eurobot", "عضویت در یوروبات"],
  ["is_in_hilfen_bot", "عضویت در هیلفن"],
  ["score", "امتیاز"],
  ["ban_time", "زمان مسدودی"],
  ["join_date", "تاریخ عضویت"],
  ["profile_path", "تصویر پروفایل"],
  ["telegram_message_id", "شناسه پیام تلگرام"],
  ["group_message_id", "شناسه پیام گروه"],
  ["public_message_id", "شناسه پیام کانال عمومی"],
  ["public_group_message_id", "شناسه پیام گروه عمومی"],
  ["hilfen_id", "شناسه هیلفن"],
  ["hilfen_status", "وضعیت هیلفن"],
  ["hilfen_date_join", "تاریخ عضویت هیلفن"],
  ["hilfen_command", "دستور هیلفن"],
  ["hilfen_data", "اطلاعات هیلفن"],
  ["hilfen_id_card_photo", "تصویر کارت شناسایی هیلفن"],
  ["hilfen_all_projects", "تعداد پروژه‌های هیلفن"],
  ["hilfen_all_projects_done", "پروژه‌های تکمیل‌شده هیلفن"],
  ["hilfen_limits_time", "زمان محدودیت هیلفن"],
  ["hilfen_message_id", "شناسه پیام هیلفن"],
  ["hilfen_group_message_id", "شناسه پیام گروه هیلفن"],
] as const;

const fieldLabels = Object.fromEntries(AUDIT_FIELD_OPTIONS);

export const auditActionLabel = (action: string) =>
  AUDIT_ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;

export const auditFieldLabel = (field: string) => fieldLabels[field] ?? field;

