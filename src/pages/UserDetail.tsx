import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Loader2, AlertTriangle, Check, Phone, Calendar, Globe, User as UserIcon, AtSign, Hash } from "lucide-react";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GlassModal } from "@/components/GlassModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, getProfileImageUrl } from "@/types/user";

const UserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    nickname: "",
    username: "",
    phone_number: "",
    whatsapp_number: "",
    country: "",
    score: 0,
    is_ban: false,
    is_registered: true,
  });
  const { token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(
        "https://pseudo-admin-panel.safaee1361.workers.dev/users",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data: User[] = await response.json();
        const foundUser = data.find((u) => u.user_id === userId);
        if (foundUser) {
          setUser(foundUser);
          setEditData({
            first_name: foundUser.first_name,
            last_name: foundUser.last_name,
            nickname: foundUser.nickname,
            username: foundUser.username,
            phone_number: foundUser.phone_number || "",
            whatsapp_number: foundUser.whatsapp_number || "",
            country: foundUser.country,
            score: foundUser.score,
            is_ban: foundUser.is_ban,
            is_registered: foundUser.is_registered,
          });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مشکلی در دریافت اطلاعات کاربر پیش آمد",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    // In a real app, this would call an API
    if (user) {
      setUser({
        ...user,
        ...editData,
      });
    }
    setIsEditOpen(false);
    toast({
      title: "ذخیره شد",
      description: "تغییرات با موفقیت اعمال شد",
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

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
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e5e5e5&color=333&size=128`;
              }}
            />
            <h1 className="text-2xl font-bold text-charcoal">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-silver mt-1">@{user.username}</p>
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
            <InfoRow icon={Calendar} label="تاریخ عضویت" value={formatDate(user.join_date)} />
          </GlassBox>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <GlassBox className="mb-6">
            <h2 className="font-bold text-charcoal mb-4">اطلاعات سیستم</h2>
            <InfoRow label="امتیاز" value={user.score} />
            <InfoRow label="وضعیت ثبت نام" value={user.is_registered ? "ثبت نام شده" : "ثبت نام نشده"} />
            <InfoRow label="حالت" value={user.mode} />
            <InfoRow label="کد حسابداری" value={user.accounting_code} />
            <InfoRow label="آخرین به‌روزرسانی" value={formatDateTime(user.updated_at)} />
            <InfoRow label="به‌روزرسانی کانال" value={formatDateTime(user.channel_updated_at)} />
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

      <FloatingActionButton onClick={() => setIsEditOpen(true)}>
        <Pencil className="w-6 h-6 text-charcoal" />
      </FloatingActionButton>

      <GlassModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="ویرایش اطلاعات"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">نام</label>
              <Input
                type="text"
                value={editData.first_name}
                onChange={(e) => setEditData((prev) => ({ ...prev, first_name: e.target.value }))}
                className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">نام خانوادگی</label>
              <Input
                type="text"
                value={editData.last_name}
                onChange={(e) => setEditData((prev) => ({ ...prev, last_name: e.target.value }))}
                className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام مستعار</label>
            <Input
              type="text"
              value={editData.nickname}
              onChange={(e) => setEditData((prev) => ({ ...prev, nickname: e.target.value }))}
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام کاربری</label>
            <Input
              type="text"
              value={editData.username}
              onChange={(e) => setEditData((prev) => ({ ...prev, username: e.target.value }))}
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">شماره تلفن</label>
              <Input
                type="text"
                value={editData.phone_number}
                onChange={(e) => setEditData((prev) => ({ ...prev, phone_number: e.target.value }))}
                className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">شماره واتساپ</label>
              <Input
                type="text"
                value={editData.whatsapp_number || ""}
                onChange={(e) => setEditData((prev) => ({ ...prev, whatsapp_number: e.target.value }))}
                className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">کشور</label>
            <Input
              type="text"
              value={editData.country}
              onChange={(e) => setEditData((prev) => ({ ...prev, country: e.target.value }))}
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">امتیاز</label>
            <Input
              type="number"
              value={editData.score}
              onChange={(e) => setEditData((prev) => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">وضعیت بن</label>
              <select
                value={editData.is_ban ? "true" : "false"}
                onChange={(e) => setEditData((prev) => ({ ...prev, is_ban: e.target.value === "true" }))}
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl"
              >
                <option value="false">فعال</option>
                <option value="true">بن شده</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">وضعیت ثبت‌نام</label>
              <select
                value={editData.is_registered ? "true" : "false"}
                onChange={(e) => setEditData((prev) => ({ ...prev, is_registered: e.target.value === "true" }))}
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl"
              >
                <option value="true">ثبت‌نام شده</option>
                <option value="false">ثبت‌نام نشده</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="gold" className="flex-1 rounded-xl" onClick={handleSave}>
              <Check className="w-4 h-4 ml-2" />
              ذخیره تغییرات
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default UserDetail;
