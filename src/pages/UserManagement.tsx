import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, LayoutGrid, List, AlertTriangle, Loader2 } from "lucide-react";
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

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: "",
    userId: "",
    username: "",
    phoneNumber: "",
    country: "",
    isBanned: "",
    isRegistered: "",
  });
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
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
        const data = await response.json();
        setUsers(data);
        setFilteredUsers(data);
      } else {
        toast({
          variant: "destructive",
          title: "خطا",
          description: "مشکلی در دریافت لیست کاربران پیش آمد",
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

  const applyFilters = () => {
    let result = [...users];

    if (filters.name) {
      result = result.filter(
        (user) =>
          user.first_name.toLowerCase().includes(filters.name.toLowerCase()) ||
          user.last_name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.userId) {
      result = result.filter((user) =>
        user.user_id.includes(filters.userId)
      );
    }

    if (filters.username) {
      result = result.filter((user) =>
        user.username.toLowerCase().includes(filters.username.toLowerCase())
      );
    }

    if (filters.phoneNumber) {
      result = result.filter((user) =>
        user.phone_number?.includes(filters.phoneNumber)
      );
    }

    if (filters.country) {
      result = result.filter((user) =>
        user.country.includes(filters.country)
      );
    }

    if (filters.isBanned) {
      const isBanned = filters.isBanned === "true";
      result = result.filter((user) => user.is_ban === isBanned);
    }

    if (filters.isRegistered) {
      const isRegistered = filters.isRegistered === "true";
      result = result.filter((user) => user.is_registered === isRegistered);
    }

    setFilteredUsers(result);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setFilters({ name: "", userId: "", username: "", phoneNumber: "", country: "", isBanned: "", isRegistered: "" });
    setFilteredUsers(users);
    setIsFilterOpen(false);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return new Intl.DateTimeFormat("fa-IR").format(date);
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

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto px-4 py-6">
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

        <p className="text-silver text-sm mb-4">
          {filteredUsers.length} کاربر
        </p>

        {viewMode === "card" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredUsers.map((user, index) => (
              <div
                key={user.user_id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <GlassBox
                  onClick={() => navigate(`/users/${user.user_id}`)}
                  className="relative flex flex-col items-center text-center p-4"
                >
                  {user.is_ban && (
                    <div className="absolute top-2 right-2 bg-destructive/20 p-1.5 rounded-full">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                  )}
                  <img
                    src={getProfileImageUrl(user.profile_path)}
                    alt={user.first_name}
                    className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-silver-light"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e5e5e5&color=333`;
                    }}
                  />
                  <h3 className="font-bold text-charcoal text-sm truncate w-full">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-xs text-charcoal mt-1 font-mono" dir="ltr">
                    {user.user_id}
                  </p>
                  <p className="text-xs text-charcoal mt-1">{user.country}</p>
                </GlassBox>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user, index) => (
              <div
                key={user.user_id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <GlassBox
                  onClick={() => navigate(`/users/${user.user_id}`)}
                  className="flex items-center gap-4 p-4"
                >
                  {user.is_ban && (
                    <div className="bg-destructive/20 p-1.5 rounded-full flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </div>
                  )}
                  <img
                    src={getProfileImageUrl(user.profile_path)}
                    alt={user.first_name}
                    className="w-12 h-12 rounded-lg object-cover border border-silver-light flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e5e5e5&color=333`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-charcoal truncate">
                      {user.first_name} {user.last_name}
                    </h3>
                    <p className="text-xs text-silver mt-0.5">
                      @{user.username}
                    </p>
                  </div>
                  <div className="text-left flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-silver">
                      <span className="text-charcoal font-mono" dir="ltr">
                        {user.user_id}
                      </span>
                    </p>
                    <p className="text-xs text-silver mt-1">{user.country}</p>
                  </div>
                  <div className="text-left flex-shrink-0 hidden md:block">
                    <p className="text-xs text-silver">تاریخ عضویت</p>
                    <p className="text-xs text-charcoal">
                      {formatDate(user.join_date)}
                    </p>
                  </div>
                </GlassBox>
              </div>
            ))}
          </div>
        )}
      </main>

      <FloatingActionButton onClick={() => setIsFilterOpen(true)}>
        <Search className="w-6 h-6 text-charcoal" />
      </FloatingActionButton>

      <GlassModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="جست و جو و فیلتر"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto overscroll-contain">
          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام کاربر</label>
            <Input
              type="text"
              value={filters.name}
              onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="جست و جو بر اساس نام"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">شناسه کاربر</label>
            <Input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              placeholder="جست و جو بر اساس شناسه"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-silver">نام کاربری</label>
            <Input
              type="text"
              value={filters.username}
              onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="جست و جو بر اساس نام کاربری"
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
              placeholder="جست و جو بر اساس شماره"
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
              placeholder="فیلتر بر اساس کشور"
              className="bg-secondary/50 border-silver-light/50 text-charcoal rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-silver">وضعیت بن</label>
              <select
                value={filters.isBanned}
                onChange={(e) => setFilters((prev) => ({ ...prev, isBanned: e.target.value }))}
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl"
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
                className="w-full h-10 px-3 bg-secondary/50 border border-silver-light/50 text-charcoal rounded-xl"
              >
                <option value="">همه</option>
                <option value="true">ثبت‌نام شده</option>
                <option value="false">ثبت‌نام نشده</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="gold" className="flex-1 rounded-xl" onClick={applyFilters}>
              اعمال فیلتر
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
              پاک کردن
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default UserManagement;
