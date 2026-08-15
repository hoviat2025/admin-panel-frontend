import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Pencil, Loader2, AlertTriangle, Check, Phone, Calendar, Globe, User as UserIcon, AtSign, Hash } from "lucide-react";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GlassModal } from "@/components/GlassModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, getProfileImageUrl } from "@/types/user";
import { API_BASE_URL } from "@/config";
import { Badge } from "@/components/ui/badge";
import { dateTimeLocalToUnixSeconds, formatDateTime, formatUnixDateTime, getMembershipKind, getSyncStatus, parseMaybeJson, unixSecondsToDateTimeLocal } from "@/lib/userDisplay";

type EditableUserKey =
  | "counter" | "accounting_code" | "username" | "first_name" | "last_name" | "nickname"
  | "phone_number" | "whatsapp_number" | "country" | "password" | "mode"
  | "is_ban" | "is_registered" | "chat_not_found" | "is_in_eurobot" | "is_in_hilfen_bot"
  | "score" | "ban_time" | "join_date" | "profile_path" | "telegram_message_id"
  | "group_message_id" | "public_message_id" | "public_group_message_id"
  | "hilfen_id" | "hilfen_status" | "hilfen_date_join" | "hilfen_command" | "hilfen_data"
  | "hilfen_id_card_photo" | "hilfen_all_projects" | "hilfen_all_projects_done"
  | "hilfen_limits_time" | "hilfen_message_id" | "hilfen_group_message_id";

type EditData = Record<EditableUserKey, string | boolean>;

type EditField = {
  key: EditableUserKey;
  label: string;
  type?: "text" | "number" | "password" | "datetime-local";
  dir?: "rtl" | "ltr";
  multiline?: boolean;
  hint?: string;
};

const profileFields: EditField[] = [
  { key: "counter", label: "شماره کاربر یوروبات", type: "number", dir: "ltr" },
  { key: "accounting_code", label: "کد حسابداری", dir: "ltr" },
  { key: "first_name", label: "نام" },
  { key: "last_name", label: "نام خانوادگی" },
  { key: "nickname", label: "نام مستعار" },
  { key: "username", label: "نام کاربری تلگرام", dir: "ltr", hint: "بدون علامت @" },
  { key: "phone_number", label: "شماره تلفن", dir: "ltr" },
  { key: "whatsapp_number", label: "شماره واتساپ", dir: "ltr" },
  { key: "country", label: "کشور" },
  { key: "password", label: "رمز عبور کاربر", type: "password", dir: "ltr" },
  { key: "mode", label: "حالت", dir: "ltr" },
  { key: "join_date", label: "تاریخ و زمان عضویت", type: "datetime-local", dir: "ltr" },
  { key: "profile_path", label: "مسیر تصویر پروفایل", dir: "ltr" },
];

const statusNumberFields: EditField[] = [
  { key: "score", label: "امتیاز", type: "number", dir: "ltr" },
  { key: "ban_time", label: "تاریخ و زمان مسدودی", type: "datetime-local", dir: "ltr", hint: "خالی یعنی تاریخ مسدودی ثبت نشده است" },
];

const booleanFields: { key: EditableUserKey; label: string; trueLabel: string; falseLabel: string }[] = [
  { key: "is_ban", label: "وضعیت مسدودی", trueLabel: "مسدود", falseLabel: "فعال" },
  { key: "is_registered", label: "وضعیت ثبت‌نام", trueLabel: "ثبت‌نام‌شده", falseLabel: "ثبت‌نام‌نشده" },
  { key: "chat_not_found", label: "دسترسی به گفتگوی تلگرام", trueLabel: "گفتگو پیدا نشده", falseLabel: "گفتگو در دسترس است" },
  { key: "is_in_eurobot", label: "عضویت یوروبات", trueLabel: "عضو است", falseLabel: "عضو نیست" },
  { key: "is_in_hilfen_bot", label: "عضویت هیلفن", trueLabel: "عضو است", falseLabel: "عضو نیست" },
];

const messageFields: EditField[] = [
  { key: "telegram_message_id", label: "شناسه پیام تلگرام", dir: "ltr" },
  { key: "group_message_id", label: "شناسه پیام گروه", dir: "ltr" },
  { key: "public_message_id", label: "شناسه پیام کانال عمومی", dir: "ltr" },
  { key: "public_group_message_id", label: "شناسه پیام گروه عمومی", dir: "ltr" },
];

const hilfenFields: EditField[] = [
  { key: "hilfen_id", label: "شناسه هیلفن", type: "number", dir: "ltr" },
  { key: "hilfen_status", label: "وضعیت هیلفن" },
  { key: "hilfen_date_join", label: "تاریخ و زمان عضویت هیلفن", type: "datetime-local", dir: "ltr" },
  { key: "hilfen_command", label: "دستور هیلفن", dir: "ltr" },
  { key: "hilfen_data", label: "اطلاعات هیلفن", multiline: true, dir: "ltr", hint: "متن یا JSON ذخیره‌شده برای هیلفن" },
  { key: "hilfen_id_card_photo", label: "مسیر تصویر کارت شناسایی هیلفن", dir: "ltr" },
  { key: "hilfen_all_projects", label: "تعداد کل پروژه‌های هیلفن", type: "number", dir: "ltr" },
  { key: "hilfen_all_projects_done", label: "تعداد پروژه‌های تکمیل‌شده هیلفن", type: "number", dir: "ltr" },
  { key: "hilfen_limits_time", label: "تاریخ و زمان محدودیت هیلفن", type: "datetime-local", dir: "ltr", hint: "خالی یعنی بدون تاریخ محدودیت" },
  { key: "hilfen_message_id", label: "شناسه پیام هیلفن", type: "number", dir: "ltr" },
  { key: "hilfen_group_message_id", label: "شناسه پیام گروه هیلفن", type: "number", dir: "ltr" },
];

const allEditFields = [...profileFields, ...statusNumberFields, ...messageFields, ...hilfenFields];
const numericEditKeys = new Set(allEditFields.filter((field) => field.type === "number").map((field) => field.key));
const unixDateEditKeys = new Set(allEditFields.filter((field) => field.type === "datetime-local").map((field) => field.key));
const zeroWhenEmptyUnixKeys = new Set<EditableUserKey>(["ban_time", "hilfen_limits_time"]);

const createEditData = (user?: User): EditData => {
  const data = {} as EditData;
  allEditFields.forEach(({ key }) => {
    const value = user?.[key];
    data[key] = unixDateEditKeys.has(key)
      ? unixSecondsToDateTimeLocal(value as string | number | null | undefined)
      : value === null || value === undefined ? "" : String(value);
  });
  booleanFields.forEach(({ key }) => {
    data[key] = user ? Boolean(user[key]) : false;
  });
  return data;
};

const UserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // New state for save button
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [editData, setEditData] = useState<EditData>(() => createEditData());

  const { token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users-management/${userId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const json = await response.json();

      if (response.ok && json.data) {
        const foundUser = json.data;
        setUser(foundUser);
        
        setEditData(createEditData(foundUser));
      } else {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "کاربر یافت نشد",
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مشکلی در دریافت اطلاعات کاربر پیش آمد",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const payload: Record<string, string | number | boolean | null> = {
        user_id: user.user_id,
      };
      Object.entries(editData).forEach(([key, value]) => {
        if (typeof value === "boolean") {
          payload[key] = value;
        } else if (numericEditKeys.has(key as EditableUserKey)) {
          payload[key] = value.trim() === "" ? null : Number(value);
        } else if (unixDateEditKeys.has(key as EditableUserKey)) {
          payload[key] = value
            ? dateTimeLocalToUnixSeconds(value)
            : zeroWhenEmptyUnixKeys.has(key as EditableUserKey) && user[key as "ban_time" | "hilfen_limits_time"] !== null
              ? 0
              : null;
        } else {
          payload[key] = value;
        }
      });

      const response = await fetch(`${API_BASE_URL}/admin/users-management/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      if (response.ok && json.data) {
        // Update local state with the server response (Source of Truth)
        setUser(json.data);
        setEditData(createEditData(json.data));
        setIsEditOpen(false);
        toast({
          title: "موفقیت",
          description: "اطلاعات کاربر با موفقیت بروزرسانی شد",
        });
      } else {
        // Handle API errors (e.g., 404 or validation error)
        const errorMsg = json.error?.message || "خطا در بروزرسانی اطلاعات";
        toast({
          variant: "destructive",
          title: "خطا",
          description: errorMsg,
        });
      }
    } catch (error) {
      console.error("Update error:", error);
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مشکلی در برقراری ارتباط با سرور پیش آمد",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Formatters ---
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-10 h-10 text-gold animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-silver">کاربر یافت نشد</p>
        </div>
      </div>
    );
  }

  const InfoRow = ({ 
    label, 
    value, 
    icon: Icon 
  }: { 
    label: string; 
    value: string | number | boolean | null; 
    icon?: React.ElementType;
  }) => (
    <div className="flex items-center gap-3 py-3 border-b border-silver-light/30 last:border-0">
      {Icon && <Icon className="w-4 h-4 text-silver flex-shrink-0" />}
      <span className="text-silver text-sm flex-shrink-0">{label}</span>
      <span className="text-charcoal font-medium mr-auto text-left" dir="ltr">
        {value === null || value === "" ? "-" : String(value)}
      </span>
    </div>
  );

  const setEditValue = (key: EditableUserKey, value: string | boolean) => {
    setEditData((previous) => ({ ...previous, [key]: value }));
  };

  const EditInput = ({ field }: { field: EditField }) => {
    const value = String(editData[field.key] ?? "");
    return (
      <label className="block space-y-2">
        <span className="text-sm font-medium text-silver">{field.label}</span>
        {field.multiline ? (
          <Textarea
            value={value}
            onChange={(event) => setEditValue(field.key, event.target.value)}
            className="min-h-28 rounded-xl border-silver-light/50 bg-secondary/50 text-charcoal"
            dir={field.dir}
          />
        ) : (
          <Input
            type={field.type ?? "text"}
            step={field.type === "number" || field.type === "datetime-local" ? "1" : undefined}
            value={value}
            onChange={(event) => setEditValue(field.key, event.target.value)}
            className="rounded-xl border-silver-light/50 bg-secondary/50 text-charcoal"
            dir={field.dir}
          />
        )}
        {field.hint && <span className="block text-xs text-silver">{field.hint}</span>}
      </label>
    );
  };

  const openEditForm = () => {
    setEditData(createEditData(user));
    setIsEditOpen(true);
  };

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="animate-slide-up">
          <GlassBox intense className="flex flex-col items-center text-center p-8 mb-6">
            {user.is_ban && (
              <div className="flex items-center gap-2 bg-destructive/20 text-destructive px-4 py-2 rounded-full mb-4">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">کاربر بن شده</span>
              </div>
            )}
            <img
              src={getProfileImageUrl(user.profile_path)}
              alt={user.first_name}
              className="w-28 h-28 rounded-full object-cover border-4 border-silver-light mb-4"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name || 'User'}+${user.last_name || ''}&background=e5e5e5&color=333&size=128`;
              }}
            />
            <h1 className="text-2xl font-bold text-charcoal">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-silver mt-1">@{user.username || '---'}</p>
            <div className="flex items-center gap-2 mt-2 text-silver text-sm">
              <Globe className="w-4 h-4" />
              <span>{user.country}</span>
            </div>
          </GlassBox>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <GlassBox className="mb-6">
            <h2 className="font-bold text-charcoal mb-4">اطلاعات اصلی</h2>
            <InfoRow icon={Hash} label="شناسه کاربر" value={user.user_id} />
            <InfoRow icon={UserIcon} label="نام مستعار" value={user.nickname} />
            <InfoRow icon={AtSign} label="نام کاربری" value={user.username} />
            <InfoRow icon={Phone} label="شماره تلفن" value={user.phone_number} />
            <InfoRow icon={Phone} label="واتساپ" value={user.whatsapp_number} />
            <InfoRow icon={Calendar} label="تاریخ عضویت" value={formatUnixDateTime(user.join_date)} />
          </GlassBox>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <GlassBox className="mb-6">
            <h2 className="font-bold text-charcoal mb-4">اطلاعات سیستم</h2>
            <InfoRow label="امتیاز" value={user.score} />
            <InfoRow label="تاریخ مسدودی" value={user.ban_time > 0 ? formatUnixDateTime(user.ban_time) : "ثبت نشده"} />
            <InfoRow label="وضعیت ثبت نام" value={user.is_registered ? "ثبت نام شده" : "ثبت نام نشده"} />
            <InfoRow label="حالت" value={user.mode} />
            <InfoRow label="کد حسابداری" value={user.accounting_code} />
            <InfoRow label="آخرین به‌روزرسانی" value={formatDateTime(user.updated_at)} />
            <InfoRow label="به‌روزرسانی کانال" value={formatDateTime(user.channel_updated_at)} />
            <InfoRow label="وضعیت همگام‌سازی" value={getSyncStatus(user)} />
            <InfoRow label="عضویت" value={getMembershipKind(user)} />
          </GlassBox>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
          <GlassBox className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">تاریخچه فعالیت مدیران</h2>
              <Button variant="outline" onClick={() => navigate(`/audit-history?target_user_id=${userId}`)}>مشاهده تغییرات کاربر</Button>
            </div>
          </GlassBox>
          <GlassBox className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-charcoal">اطلاعات هیلفن</h2>
              <div className="flex gap-1">
                {user.is_in_hilfen_bot && <Badge variant="outline">عضو هیلفن</Badge>}
                {user.is_in_eurobot && <Badge variant="secondary">عضو یوروبات</Badge>}
              </div>
            </div>
            {!user.is_in_hilfen_bot ? (
              <p className="text-sm text-silver">این کاربر عضو هیلفن نیست.</p>
            ) : (
              <>
                <InfoRow label="شناسه هیلفن" value={user.hilfen_id} />
                <InfoRow label="وضعیت" value={user.hilfen_status} />
                <InfoRow label="تاریخ عضویت" value={formatUnixDateTime(user.hilfen_date_join)} />
                <InfoRow label="دستور" value={user.hilfen_command} />
                <InfoRow label="پروژه‌ها" value={user.hilfen_all_projects} />
                <InfoRow label="پروژه‌های انجام‌شده" value={user.hilfen_all_projects_done} />
                <InfoRow label="تاریخ محدودیت" value={user.hilfen_limits_time && user.hilfen_limits_time > 0 ? formatUnixDateTime(user.hilfen_limits_time) : "بدون محدودیت"} />
                <InfoRow label="مرجع کارت شناسایی" value={user.hilfen_id_card_photo} />
                <InfoRow label="شناسه پیام هیلفن" value={user.hilfen_message_id} />
                <InfoRow label="شناسه پیام گروه هیلفن" value={user.hilfen_group_message_id} />
                <div className="mt-3 rounded-xl bg-secondary/40 p-3">
                  <p className="text-xs text-silver mb-2">داده هیلفن</p>
                  <pre className="text-xs text-charcoal whitespace-pre-wrap break-words max-h-48 overflow-auto" dir="ltr">{parseMaybeJson(user.hilfen_data)}</pre>
                </div>
              </>
            )}
          </GlassBox>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <GlassBox>
            <h2 className="font-bold text-charcoal mb-4">اطلاعات پیام‌رسانی</h2>
            <InfoRow label="شناسه پیام تلگرام" value={user.telegram_message_id} />
            <InfoRow label="شناسه پیام گروه" value={user.group_message_id} />
            <InfoRow label="شناسه پیام عمومی" value={user.public_message_id} />
            <InfoRow label="شناسه پیام گروه عمومی" value={user.public_group_message_id} />
            <InfoRow label="چت یافت نشد" value={user.chat_not_found ? "بله" : "خیر"} />
          </GlassBox>
        </div>
      </main>

      <FloatingActionButton onClick={openEditForm}>
        <Pencil className="w-6 h-6 text-charcoal" />
      </FloatingActionButton>

      {/* EDIT MODAL */}
      <GlassModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="ویرایش اطلاعات"
      >
        <div className="max-h-[65vh] overflow-y-auto overscroll-contain">
          <div className="mb-4 rounded-xl border border-silver-light/50 bg-secondary/30 p-3 text-xs text-silver">
            شناسه عددی تلگرام: <span className="font-mono text-charcoal" dir="ltr">{user.user_id}</span>
            <span className="mr-2">این شناسه و زمان‌های ثبت تغییرات قابل ویرایش نیستند.</span>
          </div>

          <Tabs defaultValue="profile" dir="rtl">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger value="profile">اطلاعات اصلی</TabsTrigger>
              <TabsTrigger value="status">وضعیت</TabsTrigger>
              <TabsTrigger value="messages">پیام‌ها</TabsTrigger>
              <TabsTrigger value="hilfen">هیلفن</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <p className="text-xs text-silver">خالی گذاشتن یک فیلد اختیاری، مقدار آن را پاک می‌کند.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {profileFields.map((field) => <EditInput key={field.key} field={field} />)}
              </div>
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {statusNumberFields.map((field) => <EditInput key={field.key} field={field} />)}
                {booleanFields.map((field) => (
                  <label key={field.key} className="block space-y-2">
                    <span className="text-sm font-medium text-silver">{field.label}</span>
                    <select
                      value={editData[field.key] === true ? "true" : "false"}
                      onChange={(event) => setEditValue(field.key, event.target.value === "true")}
                      className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
                    >
                      <option value="true">{field.trueLabel}</option>
                      <option value="false">{field.falseLabel}</option>
                    </select>
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="messages" className="space-y-4">
              <p className="text-xs text-silver">شناسه‌های مربوط به پیام‌های کاربر در کانال‌ها و گروه‌ها.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {messageFields.map((field) => <EditInput key={field.key} field={field} />)}
              </div>
            </TabsContent>

            <TabsContent value="hilfen" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hilfenFields.map((field) => (
                  <div key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                    <EditInput field={field} />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 mt-5 flex gap-3 border-t bg-white/95 pt-4">
            <Button 
              variant="gold" 
              className="flex-1 rounded-xl" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                 <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                 <Check className="w-4 h-4 ml-2" />
              )}
              ذخیره تغییرات
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              انصراف
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default UserDetail;
