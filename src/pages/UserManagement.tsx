import { API_BASE_URL } from "@/config";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  LayoutGrid, 
  List, 
  AlertTriangle, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  X,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GlassModal } from "@/components/GlassModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, getProfileImageUrl } from "@/types/user";
import { dateTimeLocalToUnixSeconds, formatDateTime, formatUnixDateTime, getMembershipKind } from "@/lib/userDisplay";

type ViewMode = "card" | "list";
type FilterValues = Record<string, string>;

type AdvancedFilterOption = {
  param: string;
  label: string;
  type?: "text" | "number" | "datetime-local";
  choices?: { value: string; label: string }[];
  transport?: "unix-seconds" | "iso-datetime";
  zeroLabel?: string;
};

const yesNoChoices = [
  { value: "true", label: "بله" },
  { value: "false", label: "خیر" },
];

const emptyChoices = [
  { value: "true", label: "خالی باشد" },
  { value: "false", label: "خالی نباشد" },
];

const textFields = [
  ["username", "نام کاربری تلگرام"], ["first_name", "نام"], ["last_name", "نام خانوادگی"],
  ["nickname", "نام مستعار"], ["country", "کشور"], ["phone_number", "شماره تلفن"],
  ["whatsapp_number", "شماره واتساپ"], ["profile_path", "مسیر تصویر پروفایل"],
  ["accounting_code", "کد حسابداری"], ["password", "رمز عبور"], ["mode", "حالت"],
  ["hilfen_status", "وضعیت هیلفن"], ["hilfen_command", "دستور هیلفن"],
  ["hilfen_data", "اطلاعات هیلفن"], ["hilfen_id_card_photo", "تصویر کارت شناسایی هیلفن"],
] as const;

const exactOnlyFields = [
  ["telegram_message_id", "شناسه پیام تلگرام"], ["group_message_id", "شناسه پیام گروه"],
  ["public_message_id", "شناسه پیام عمومی"], ["public_group_message_id", "شناسه پیام گروه عمومی"],
] as const;

const numericFields = [
  ["user_id", "شناسه عددی تلگرام"], ["counter", "شماره کاربر یوروبات"],
  ["score", "امتیاز"], ["hilfen_id", "شناسه هیلفن"],
  ["hilfen_all_projects", "تعداد پروژه‌های هیلفن"],
  ["hilfen_all_projects_done", "پروژه‌های تکمیل‌شده هیلفن"],
  ["hilfen_message_id", "شناسه پیام هیلفن"],
  ["hilfen_group_message_id", "شناسه پیام گروه هیلفن"],
] as const;

const ADVANCED_FILTER_OPTIONS: AdvancedFilterOption[] = [
  ...textFields.flatMap(([param, label]) => [
    { param, label: `${label}؛ دقیق` },
    { param: `${param}_contains`, label: `${label}؛ شامل عبارت` },
  ]),
  ...exactOnlyFields.map(([param, label]) => ({ param, label: `${label}؛ دقیق` })),
  ...numericFields.map(([param, label]) => ({ param, label: `${label}؛ دقیق`, type: "number" as const })),
  { param: "ban_time", label: "تاریخ مسدودی؛ دقیق", type: "datetime-local", transport: "unix-seconds", zeroLabel: "بدون تاریخ مسدودی" },
  { param: "join_date", label: "تاریخ عضویت؛ دقیق", type: "datetime-local", transport: "unix-seconds" },
  { param: "hilfen_date_join", label: "تاریخ عضویت هیلفن؛ دقیق", type: "datetime-local", transport: "unix-seconds" },
  { param: "hilfen_limits_time", label: "تاریخ محدودیت هیلفن؛ دقیق", type: "datetime-local", transport: "unix-seconds", zeroLabel: "بدون محدودیت" },
  { param: "min_counter", label: "شماره کاربر یوروبات؛ حداقل", type: "number" },
  { param: "max_counter", label: "شماره کاربر یوروبات؛ حداکثر", type: "number" },
  { param: "min_score", label: "امتیاز؛ حداقل", type: "number" },
  { param: "max_score", label: "امتیاز؛ حداکثر", type: "number" },
  { param: "min_ban_time", label: "تاریخ مسدودی؛ از", type: "datetime-local", transport: "unix-seconds" },
  { param: "max_ban_time", label: "تاریخ مسدودی؛ تا", type: "datetime-local", transport: "unix-seconds" },
  { param: "joined_after_unix", label: "تاریخ عضویت؛ از", type: "datetime-local", transport: "unix-seconds" },
  { param: "joined_before_unix", label: "تاریخ عضویت؛ تا", type: "datetime-local", transport: "unix-seconds" },
  { param: "min_hilfen_id", label: "شناسه هیلفن؛ حداقل", type: "number" },
  { param: "max_hilfen_id", label: "شناسه هیلفن؛ حداکثر", type: "number" },
  { param: "hilfen_joined_after_unix", label: "تاریخ عضویت هیلفن؛ از", type: "datetime-local", transport: "unix-seconds" },
  { param: "hilfen_joined_before_unix", label: "تاریخ عضویت هیلفن؛ تا", type: "datetime-local", transport: "unix-seconds" },
  { param: "min_hilfen_all_projects", label: "تعداد پروژه‌های هیلفن؛ حداقل", type: "number" },
  { param: "max_hilfen_all_projects", label: "تعداد پروژه‌های هیلفن؛ حداکثر", type: "number" },
  { param: "min_hilfen_projects_done", label: "پروژه‌های تکمیل‌شده هیلفن؛ حداقل", type: "number" },
  { param: "max_hilfen_projects_done", label: "پروژه‌های تکمیل‌شده هیلفن؛ حداکثر", type: "number" },
  { param: "min_hilfen_limits_time", label: "تاریخ محدودیت هیلفن؛ از", type: "datetime-local", transport: "unix-seconds" },
  { param: "max_hilfen_limits_time", label: "تاریخ محدودیت هیلفن؛ تا", type: "datetime-local", transport: "unix-seconds" },
  { param: "updated_after", label: "آخرین تغییر؛ از", type: "datetime-local", transport: "iso-datetime" },
  { param: "updated_before", label: "آخرین تغییر؛ تا", type: "datetime-local", transport: "iso-datetime" },
  { param: "channel_updated_after", label: "آخرین همگام‌سازی کانال؛ از", type: "datetime-local", transport: "iso-datetime" },
  { param: "channel_updated_before", label: "آخرین همگام‌سازی کانال؛ تا", type: "datetime-local", transport: "iso-datetime" },
  { param: "is_ban", label: "کاربر مسدود است", choices: yesNoChoices },
  { param: "is_registered", label: "کاربر ثبت‌نام کرده است", choices: yesNoChoices },
  { param: "chat_not_found", label: "گفتگوی کاربر پیدا نشده است", choices: yesNoChoices },
  { param: "is_in_eurobot", label: "عضو یوروبات است", choices: yesNoChoices },
  { param: "is_in_hilfen_bot", label: "عضو هیلفن است", choices: yesNoChoices },
  ...[
    ["no_counter", "شماره کاربر یوروبات"], ["no_accounting_code", "کد حسابداری"],
    ["no_username", "نام کاربری تلگرام"], ["no_first_name", "نام"], ["no_last_name", "نام خانوادگی"],
    ["no_nickname", "نام مستعار"], ["no_phone_number", "شماره تلفن"], ["no_whatsapp_number", "شماره واتساپ"],
    ["no_country", "کشور"], ["no_password", "رمز عبور"], ["no_mode", "حالت"],
    ["no_join_date", "تاریخ عضویت"], ["no_profile_path", "تصویر پروفایل"],
    ["no_telegram_msg_id", "شناسه پیام تلگرام"], ["no_group_msg_id", "شناسه پیام گروه"],
    ["no_public_msg_id", "شناسه پیام عمومی"], ["no_public_group_msg_id", "شناسه پیام گروه عمومی"],
    ["no_hilfen_id", "شناسه هیلفن"], ["no_hilfen_status", "وضعیت هیلفن"],
    ["no_hilfen_date_join", "تاریخ عضویت هیلفن"], ["no_hilfen_command", "دستور هیلفن"],
    ["no_hilfen_data", "اطلاعات هیلفن"], ["no_hilfen_id_card_photo", "تصویر کارت شناسایی هیلفن"],
    ["no_hilfen_all_projects", "تعداد پروژه‌های هیلفن"],
    ["no_hilfen_all_projects_done", "پروژه‌های تکمیل‌شده هیلفن"],
    ["no_hilfen_limits_time", "زمان محدودیت هیلفن"], ["no_hilfen_msg_id", "شناسه پیام هیلفن"],
    ["no_hilfen_group_msg_id", "شناسه پیام گروه هیلفن"], ["no_channel_update", "زمان همگام‌سازی کانال"],
  ].map(([param, label]) => ({ param, label: `${label}؛ خالی یا غیرخالی`, choices: emptyChoices })),
];

const advancedOptionByParam = Object.fromEntries(ADVANCED_FILTER_OPTIONS.map((option) => [option.param, option]));

interface PaginationMeta {
  total: number;
  page: number;
  size: number;
  pages: number;
}

const UserManagement = () => {
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, size: 20, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState("simple");
  const [advancedParam, setAdvancedParam] = useState(ADVANCED_FILTER_OPTIONS[0].param);
  const [advancedValue, setAdvancedValue] = useState("");

  // Filter State
  // 'filters' is the temporary state inside the modal form
  const [filters, setFilters] = useState<FilterValues>({});

  // 'appliedFilters' is what actually triggers the API call
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();

  // Fetch when Page or Applied Filters change
  useEffect(() => {
    fetchUsers(meta.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.page, appliedFilters]);

  const fetchUsers = async (pageToFetch: number) => {
    setIsLoading(true);
    try {
      // 1. Construct Query Params
      const params = new URLSearchParams();
      params.append("page", pageToFetch.toString());
      params.append("size", meta.size.toString());
      // Default Sort
      params.append("order_by", "-counter"); 

      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (!value) return;
        const option = advancedOptionByParam[key];
        if (option?.transport === "unix-seconds" && value !== "0") {
          const unixValue = dateTimeLocalToUnixSeconds(value);
          if (unixValue !== null) params.append(key, String(unixValue));
        } else if (option?.transport === "iso-datetime") {
          params.append(key, new Date(value).toISOString());
        } else {
          params.append(key, value);
        }
      });

      // 3. Call API
      const response = await fetch(
        `${API_BASE_URL}/admin/users-management/?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        // The API returns { data: [...], meta: { ... } }
        setUsers(result.data);
        setMeta(result.meta);
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "خطا",
          description: errorData.error?.message || "مشکلی در دریافت لیست کاربران پیش آمد",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مشکلی در برقراری ارتباط پیش آمد",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    // 1. Update the Applied Filters to trigger the effect
    setAppliedFilters(filters);
    // 2. Reset to page 1 to avoid being on page 5 of a 1-page result
    setMeta(prev => ({ ...prev, page: 1 }));
    // 3. Close Modal
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    const emptyFilters: FilterValues = {};
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setMeta(prev => ({ ...prev, page: 1 }));
    setIsFilterOpen(false);
  };

  const setFilter = (name: string, value: string) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const addAdvancedFilter = () => {
    if (!advancedValue) return;
    setFilter(advancedParam, advancedValue);
    setAdvancedValue("");
  };

  const addAdvancedZeroValue = () => {
    if (!selectedAdvancedOption?.zeroLabel) return;
    setFilter(advancedParam, "0");
    setAdvancedValue("");
  };

  const removeFilter = (name: string) => {
    setFilters((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.pages) {
      setMeta(prev => ({ ...prev, page: newPage }));
      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const formatDate = (timestamp: string | number | null) => {
    return formatUnixDateTime(timestamp);
  };

  // Helper component for "Field Top / Value Bottom"
  const DataBlock = ({ label, value, dir = "rtl", className = "" }: { label: string, value: React.ReactNode, dir?: "rtl" | "ltr", className?: string }) => (
    <div className={`flex flex-col gap-1 min-w-fit ${className}`}>
      <span className="text-[10px] text-silver font-medium whitespace-nowrap">{label}</span>
      <span className="text-sm font-bold text-charcoal whitespace-nowrap" dir={dir}>{value}</span>
    </div>
  );

  const selectedAdvancedOption = advancedOptionByParam[advancedParam];
  const activeFilters = Object.entries(filters).filter(([, value]) => value !== "");
  const displayFilterValue = (param: string, value: string) => {
    const option = advancedOptionByParam[param];
    if (value === "0" && option?.zeroLabel) return option.zeroLabel;
    const choice = option?.choices?.find((item) => item.value === value);
    if (choice) return choice.label;
    if (option?.transport) return formatDateTime(value);
    return value;
  };

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto px-4 py-6">
        
        {/* Top Bar: Title & View Toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-charcoal">مدیریت کاربران</h2>
          <div className="glass rounded-full p-1 flex gap-1">
            <button
              onClick={() => setViewMode("card")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "card"
                  ? "bg-secondary text-charcoal"
                  : "text-silver hover:text-charcoal"
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "list"
                  ? "bg-secondary text-charcoal"
                  : "text-silver hover:text-charcoal"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Bar: Count */}
        <p className="text-silver text-sm mb-4">
          نمایش {users.length} از {meta.total} کاربر
        </p>

        {/* Loading State */}
        {isLoading ? (
           <div className="flex items-center justify-center h-[40vh]">
             <Loader2 className="w-10 h-10 text-gold animate-spin" />
           </div>
        ) : (
          <>
            {/* CONTENT: Card View */}
            {viewMode === "card" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {users.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <GlassBox
                      onClick={() => navigate(`/users/${user.user_id}`)}
                      className="relative flex flex-col items-center text-center p-4 cursor-pointer hover:border-gold/50 transition-colors"
                    >
                      {user.is_ban && (
                        <div className="absolute top-2 right-2 bg-destructive/20 p-1.5 rounded-full">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        </div>
                      )}
                      <img
                        src={getProfileImageUrl(user.profile_path)}
                        alt={user.first_name || "User"}
                        className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-silver-light"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name || 'U'}+${user.last_name || 'N'}&background=e5e5e5&color=333`;
                        }}
                      />
                      <h3 className="font-bold text-charcoal text-sm truncate w-full">
                        {user.first_name} {user.last_name}
                      </h3>
                      <p className="text-xs text-charcoal mt-1 font-mono" dir="ltr">
                        {user.user_id}
                      </p>
                      <p className="text-xs text-charcoal mt-1">{user.country || "---"}</p>
                      <MembershipBadges user={user} />
                    </GlassBox>
                  </div>
                ))}
              </div>
            ) : (
              // CONTENT: List View (Horizontal Scroll)
              <div className="space-y-3">
                {users.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <GlassBox
                      className="p-0 overflow-hidden group hover:border-gold/50 transition-colors duration-300"
                    >
                      <div 
                        className="overflow-x-auto w-full hide-scrollbar cursor-pointer"
                        onClick={() => navigate(`/users/${user.user_id}`)}
                      >
                        <div className="flex items-center px-4 py-3 min-w-max gap-8">
                          
                          <img
                            src={getProfileImageUrl(user.profile_path)}
                            alt={user.first_name || "User"}
                            className="w-10 h-10 rounded-lg object-cover border border-silver-light flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e5e5e5&color=333`;
                            }}
                          />

                          <DataBlock 
                            label="نام" 
                            value={`${user.first_name || ''} ${user.last_name || ''}`} 
                          />
                          <MembershipBadges user={user} />
                          <DataBlock label="شناسه" value={user.user_id} dir="ltr" />
                          <DataBlock label="نام کاربری" value={`@${user.username || '---'}`} dir="ltr" />
                          <DataBlock label="تلفن" value={user.phone_number || '---'} dir="ltr" />
                          <DataBlock label="امتیاز" value={user.score} className="text-gold"/>
                          <DataBlock label="کشور" value={user.country || '---'} />
                          <DataBlock 
                            label="وضعیت" 
                            value={user.is_ban ? <span className="text-destructive">مسدود</span> : <span className="text-emerald-600">فعال</span>} 
                          />
                          <DataBlock label="تاریخ عضویت" value={formatDate(user.join_date)} />
                        </div>
                      </div>
                    </GlassBox>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {meta.pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="rounded-full w-10 h-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
                
                <span className="text-charcoal font-medium text-sm">
                  صفحه {meta.page} از {meta.pages}
                </span>

                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page === meta.pages}
                  className="rounded-full w-10 h-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-silver">
                <Search className="w-12 h-12 mb-2 opacity-50" />
                <p>کاربری یافت نشد</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Action Button for Filter */}
      <FloatingActionButton onClick={() => setIsFilterOpen(true)}>
        <Search className="w-6 h-6 text-charcoal" />
      </FloatingActionButton>

      {/* Filter Modal */}
      <GlassModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="جست‌وجو و فیلتر کاربران"
      >
        <div className="max-h-[65vh] overflow-y-auto overscroll-contain pb-2">
          <Tabs value={filterMode} onValueChange={setFilterMode} dir="rtl">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="simple">فیلترهای ساده</TabsTrigger>
              <TabsTrigger value="advanced">فیلترهای پیشرفته</TabsTrigger>
            </TabsList>

            <TabsContent value="simple" className="space-y-4">
              <p className="text-xs text-silver">برای جست‌وجوی سریع از موارد پرکاربرد زیر استفاده کنید.</p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-silver">جست‌وجوی عمومی</span>
                <Input value={filters.search ?? ""} onChange={(e) => setFilter("search", e.target.value)} placeholder="نام، شماره تلفن، کد حسابداری، کشور و اطلاعات هیلفن" className="rounded-xl bg-secondary/50" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-silver">شناسه عددی تلگرام</span>
                  <Input type="number" dir="ltr" value={filters.user_id ?? ""} onChange={(e) => setFilter("user_id", e.target.value)} placeholder="مثلاً 12345678" className="rounded-xl bg-secondary/50" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-silver">نام کاربری تلگرام</span>
                  <Input dir="ltr" value={filters.username_contains ?? ""} onChange={(e) => setFilter("username_contains", e.target.value.replace(/^@/, ""))} placeholder="بدون @" className="rounded-xl bg-secondary/50" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-silver">شماره تلفن</span>
                  <Input dir="ltr" value={filters.phone_number_contains ?? ""} onChange={(e) => setFilter("phone_number_contains", e.target.value)} placeholder="تمام یا بخشی از شماره" className="rounded-xl bg-secondary/50" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-silver">کشور</span>
                  <Input value={filters.country_contains ?? ""} onChange={(e) => setFilter("country_contains", e.target.value)} placeholder="تمام یا بخشی از نام کشور" className="rounded-xl bg-secondary/50" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["is_ban", "وضعیت مسدودی", "مسدود", "فعال"],
                  ["is_registered", "وضعیت ثبت‌نام", "ثبت‌نام‌شده", "ثبت‌نام‌نشده"],
                  ["is_in_eurobot", "عضویت یوروبات", "عضو است", "عضو نیست"],
                  ["is_in_hilfen_bot", "عضویت هیلفن", "عضو است", "عضو نیست"],
                ].map(([param, label, trueLabel, falseLabel]) => (
                  <label key={param} className="space-y-2">
                    <span className="text-sm font-medium text-silver">{label}</span>
                    <select value={filters[param] ?? ""} onChange={(e) => setFilter(param, e.target.value)} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal">
                      <option value="">همه</option><option value="true">{trueLabel}</option><option value="false">{falseLabel}</option>
                    </select>
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div>
                <p className="text-sm font-medium">ساخت فیلتر پیشرفته</p>
                <p className="mt-1 text-xs text-silver">نوع شرط را انتخاب کنید، مقدار را وارد کنید و «افزودن» را بزنید. همه شرط‌های افزوده‌شده باید هم‌زمان برقرار باشند.</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm text-silver">فیلد و نوع شرط</span>
                <select value={advancedParam} onChange={(e) => { setAdvancedParam(e.target.value); setAdvancedValue(""); }} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal">
                  {ADVANCED_FILTER_OPTIONS.map((option) => <option key={option.param} value={option.param}>{option.label}</option>)}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <label className="flex-1 space-y-2">
                  <span className="text-sm text-silver">مقدار</span>
                  {selectedAdvancedOption?.choices ? (
                    <select value={advancedValue} onChange={(e) => setAdvancedValue(e.target.value)} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal">
                      <option value="">انتخاب کنید</option>
                      {selectedAdvancedOption.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                    </select>
                  ) : (
                    <Input type={selectedAdvancedOption?.type ?? "text"} step={selectedAdvancedOption?.type === "number" || selectedAdvancedOption?.type === "datetime-local" ? "1" : undefined} dir={selectedAdvancedOption?.type === "number" || selectedAdvancedOption?.type === "datetime-local" ? "ltr" : "rtl"} value={advancedValue} onChange={(e) => setAdvancedValue(e.target.value)} className="rounded-xl bg-secondary/50" />
                  )}
                  {selectedAdvancedOption?.zeroLabel && (
                    <button type="button" onClick={addAdvancedZeroValue} className="text-xs text-charcoal underline underline-offset-4">
                      {selectedAdvancedOption.zeroLabel}
                    </button>
                  )}
                </label>
                <Button type="button" variant="outline" onClick={addAdvancedFilter} disabled={!advancedValue} className="rounded-xl">
                  <Plus className="ml-1 h-4 w-4" /> افزودن
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">شرط‌های فعال ({activeFilters.length})</p>
                {activeFilters.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-center text-xs text-silver">هنوز شرطی اضافه نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {activeFilters.map(([param, value]) => (
                      <div key={param} className="flex items-center justify-between gap-3 rounded-xl border bg-secondary/30 p-3 text-sm">
                        <div><p className="font-medium">{advancedOptionByParam[param]?.label ?? param}</p><p className="mt-1 break-all text-xs text-silver" dir="auto">{displayFilterValue(param, value)}</p></div>
                        <button type="button" onClick={() => removeFilter(param)} aria-label="حذف شرط" className="rounded-full p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 mt-4 flex gap-3 border-t bg-white/95 pt-4">
            <Button variant="gold" className="flex-1 rounded-xl" onClick={handleApplyFilters}>
              اعمال فیلتر
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={handleClearFilters}>
              پاک کردن
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default UserManagement;

const MembershipBadges = ({ user }: { user: User }) => {
  const kind = getMembershipKind(user);
  if (kind === "both") return <div className="flex gap-1 mt-2"><Badge variant="secondary">Eurobot</Badge><Badge variant="outline">Hilfen</Badge></div>;
  if (kind === "eurobot") return <Badge variant="secondary" className="mt-2">Eurobot</Badge>;
  if (kind === "hilfen") return <Badge variant="outline" className="mt-2">Hilfen</Badge>;
  return <Badge variant="outline" className="mt-2 opacity-60">بدون ربات</Badge>;
};
