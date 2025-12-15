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
  ChevronLeft 
} from "lucide-react";
import { Header } from "@/components/Header";
import { GlassBox } from "@/components/GlassBox";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GlassModal } from "@/components/GlassModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { User, getProfileImageUrl } from "@/types/user";

type ViewMode = "card" | "list";

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

  // Filter State
  // 'filters' is the temporary state inside the modal form
  const [filters, setFilters] = useState({
    name: "", // Maps to first_name
    userId: "",
    username: "",
    phoneNumber: "",
    country: "",
    isBanned: "",
    isRegistered: "",
  });

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

      // 2. Map Frontend Filters to Backend API Params
      if (appliedFilters.name) params.append("first_name", appliedFilters.name);
      if (appliedFilters.userId) params.append("user_id", appliedFilters.userId);
      if (appliedFilters.username) params.append("username", appliedFilters.username);
      if (appliedFilters.phoneNumber) params.append("phone_number", appliedFilters.phoneNumber);
      if (appliedFilters.country) params.append("country", appliedFilters.country);
      
      // Booleans need "true" or "false" strings
      if (appliedFilters.isBanned) params.append("is_ban", appliedFilters.isBanned);
      if (appliedFilters.isRegistered) params.append("is_registered", appliedFilters.isRegistered);

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
    const emptyFilters = { 
      name: "", 
      userId: "", 
      username: "", 
      phoneNumber: "", 
      country: "", 
      isBanned: "", 
      isRegistered: "" 
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setMeta(prev => ({ ...prev, page: 1 }));
    setIsFilterOpen(false);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= meta.pages) {
      setMeta(prev => ({ ...prev, page: newPage }));
      // Scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const formatDate = (timestamp: string | number | null) => {
    if (!timestamp) return "---";
    
    // Convert to number safely
    const timeValue = Number(timestamp);
    
    if (isNaN(timeValue)) return "---";

    const date = new Date(timeValue * 1000);
    return new Intl.DateTimeFormat("fa-IR").format(date);
  };

  // Helper component for "Field Top / Value Bottom"
  const DataBlock = ({ label, value, dir = "rtl", className = "" }: { label: string, value: React.ReactNode, dir?: "rtl" | "ltr", className?: string }) => (
    <div className={`flex flex-col gap-1 min-w-fit ${className}`}>
      <span className="text-[10px] text-silver font-medium whitespace-nowrap">{label}</span>
      <span className="text-sm font-bold text-charcoal whitespace-nowrap" dir={dir}>{value}</span>
    </div>
  );

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
                    key={user.counter}
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
                    </GlassBox>
                  </div>
                ))}
              </div>
            ) : (
              // CONTENT: List View (Horizontal Scroll)
              <div className="space-y-3">
                {users.map((user, index) => (
                  <div
                    key={user.counter}
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
        title="جست و جو و فیلتر پیشرفته"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain pb-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام (کوچک/بزرگ)</label>
            <Input
              type="text"
              value={filters.name}
              onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="جست و جو در نام ها"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">شناسه عددی (User ID)</label>
            <Input
              type="number"
              value={filters.userId}
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              placeholder="مثلا: 12345678"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام کاربری (Username)</label>
            <Input
              type="text"
              value={filters.username}
              onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="بدون @"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">شماره تلفن</label>
            <Input
              type="text"
              value={filters.phoneNumber}
              onChange={(e) => setFilters((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="جست و جو شماره"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">کشور</label>
            <Input
              type="text"
              value={filters.country}
              onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
              placeholder="نام کشور"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">وضعیت بن</label>
              <select
                value={filters.isBanned}
                onChange={(e) => setFilters((prev) => ({ ...prev, isBanned: e.target.value }))}
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl focus:outline-none"
              >
                <option value="">همه</option>
                <option value="true">بن شده</option>
                <option value="false">فعال</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">وضعیت ثبت‌نام</label>
              <select
                value={filters.isRegistered}
                onChange={(e) => setFilters((prev) => ({ ...prev, isRegistered: e.target.value }))}
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl focus:outline-none"
              >
                <option value="">همه</option>
                <option value="true">ثبت‌نام شده</option>
                <option value="false">ثبت‌نام نشده</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 sticky bottom-0 bg-transparent">
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