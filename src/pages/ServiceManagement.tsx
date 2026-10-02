import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Search,
  Store,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassBox } from "@/components/GlassBox";
import { GlassModal } from "@/components/GlassModal";
import { Header } from "@/components/Header";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchCategories, fetchServices } from "@/lib/serviceApi";
import {
  STATUS_LABELS,
  activePersianFlagCount,
  formatDateTime,
  primaryCategoryName,
} from "@/lib/serviceDisplay";
import {
  Category,
  PaginationMeta,
  Service,
  ServiceListFilters,
  ServiceStatus,
  SERVICE_STATUSES,
} from "@/types/service";

/**
 * Service list.
 *
 * Read-only view over the admin service endpoint: search, filter, paginate, and
 * jump into the editor. Editing lives on its own route (/services/:id) so this
 * page stays a fast list, mirroring how /users and /users/:userId are split.
 */

const PAGE_SIZE = 20;

const emptyFilters: ServiceListFilters = {};

const yesNo = [
  { value: "true", label: "بله" },
  { value: "false", label: "خیر" },
];

const ServiceManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, size: PAGE_SIZE, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ServiceListFilters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<ServiceListFilters>({ ...emptyFilters });

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await fetchCategories(true));
    } catch {
      /* Filters degrade to free text if the list cannot load. */
    }
  }, []);

  const loadServices = useCallback(
    async (page: number, active: ServiceListFilters) => {
      setIsLoading(true);
      try {
        const result = await fetchServices(active, page, PAGE_SIZE);
        setServices(result.services);
        setMeta(result.meta);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "خطا",
          description: error instanceof Error ? error.message : "دریافت فهرست سرویس‌ها ناموفق بود.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadServices(meta.page, appliedFilters);
  }, [loadServices, meta.page, appliedFilters]);

  const setFilter = (name: keyof ServiceListFilters, value: string) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const activeFilterCount = Object.values(appliedFilters).filter(
    (value) => value !== undefined && value !== "" ,
  ).length;

  const DataBlock = ({
    label,
    value,
    dir = "rtl",
  }: {
    label: string;
    value: React.ReactNode;
    dir?: "rtl" | "ltr";
  }) => (
    <div className="flex min-w-fit flex-col gap-1">
      <span className="whitespace-nowrap text-[10px] font-medium text-silver">{label}</span>
      <span className="whitespace-nowrap text-sm font-bold text-charcoal" dir={dir}>
        {value}
      </span>
    </div>
  );

  const PersianBadges = ({ service }: { service: Service }) => {
    const count = activePersianFlagCount(service);
    if (count === 0) {
      return <span className="text-xs text-silver">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {service.persian_owned && <Badge variant="outline">مالک ایرانی/فارسی</Badge>}
        {service.persian_language && <Badge variant="outline">زبان فارسی</Badge>}
        {service.persian_service && <Badge variant="outline">خدمت فارسی</Badge>}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">مدیریت سرویس‌ها</h2>
          <Button variant="gold" className="rounded-xl" onClick={() => navigate("/services/new")}>
            <Plus className="ml-1 h-4 w-4" />
            سرویس جدید
          </Button>
        </div>

        <p className="mb-4 text-sm text-silver">
          نمایش {services.length} از {meta.total} سرویس
        </p>

        {isLoading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-gold" />
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-silver">
            <Store className="mb-2 h-12 w-12 opacity-50" />
            <p>سرویسی یافت نشد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <GlassBox
                  className="overflow-hidden transition-colors duration-300 hover:border-gold/50"
                  onClick={() => navigate(`/services/${service.id}`)}
                >
                  <div className="hide-scrollbar w-full cursor-pointer overflow-x-auto">
                    <div className="flex min-w-max items-center gap-6 px-4 py-3">
                      <div className="flex min-w-fit flex-col gap-1">
                        <span className="whitespace-nowrap text-sm font-bold text-charcoal">
                          {service.name}
                        </span>
                        <span className="whitespace-nowrap text-[10px] text-silver" dir="ltr">
                          #{service.id}
                        </span>
                      </div>

                      <Badge variant={service.status === "published" ? "secondary" : "outline"}>
                        {STATUS_LABELS[service.status]}
                      </Badge>

                      <DataBlock
                        label="شهر"
                        value={
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-silver" />
                            {service.city || "—"}
                          </span>
                        }
                      />

                      <DataBlock label="دسته‌بندی اصلی" value={primaryCategoryName(service)} />

                      <DataBlock
                        label="مالک"
                        value={
                          <span className="inline-flex items-center gap-1" dir="auto">
                            <User className="h-3 w-3 text-silver" />
                            {service.owner_user_id ?? "—"}
                            {service.owner_user_id !== null && !service.show_owner && (
                              <span className="text-[10px] text-silver">(پنهان)</span>
                            )}
                          </span>
                        }
                      />

                      <DataBlock label="نشانه‌های فارسی" value={<PersianBadges service={service} />} />

                      <DataBlock label="آخرین تغییر" value={formatDateTime(service.updated_at)} />
                    </div>
                  </div>
                </GlassBox>
              </div>
            ))}
          </div>
        )}

        {meta.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={meta.page === 1}
              className="h-10 w-10 rounded-full"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-charcoal">
              صفحه {meta.page} از {meta.pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={meta.page === meta.pages}
              className="h-10 w-10 rounded-full"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        )}
      </main>

      {activeFilterCount > 0 && (
        <div className="pointer-events-none fixed bottom-24 left-4 z-40">
          <span className="glass rounded-full px-3 py-1 text-xs text-charcoal">
            {activeFilterCount} فیلتر فعال
          </span>
        </div>
      )}

      <FloatingActionButton onClick={() => setIsFilterOpen(true)}>
        <Search className="h-6 w-6 text-charcoal" />
      </FloatingActionButton>

      <GlassModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="جست‌وجو و فیلتر سرویس‌ها">
        <div className="max-h-[65vh] space-y-4 overflow-y-auto overscroll-contain pb-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">جست‌وجوی عمومی</span>
            <Input
              value={filters.q ?? ""}
              onChange={(event) => setFilter("q", event.target.value)}
              placeholder="نام، توضیح، شهر یا نشانی"
              className="rounded-xl bg-secondary/50"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">وضعیت</span>
              <select
                value={filters.status ?? ""}
                onChange={(event) =>
                  setFilter("status", event.target.value as ServiceStatus | "")
                }
                className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
              >
                <option value="">همه</option>
                {SERVICE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">شهر</span>
              <Input
                value={filters.city ?? ""}
                onChange={(event) => setFilter("city", event.target.value)}
                placeholder="نام شهر"
                className="rounded-xl bg-secondary/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">دسته‌بندی</span>
              <select
                value={filters.category_id ?? ""}
                onChange={(event) => setFilter("category_id", event.target.value)}
                className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
              >
                <option value="">همه</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">منبع داده</span>
              <Input
                dir="ltr"
                value={filters.source ?? ""}
                onChange={(event) => setFilter("source", event.target.value)}
                placeholder="مثلاً atlas"
                className="rounded-xl bg-secondary/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">شناسه مالک</span>
              <Input
                dir="ltr"
                value={filters.owner_user_id ?? ""}
                onChange={(event) => setFilter("owner_user_id", event.target.value)}
                placeholder="شناسه عددی کاربر"
                className="rounded-xl bg-secondary/50"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["persian_owned", "مالک ایرانی/فارسی"],
              ["persian_language", "ارائه با زبان فارسی"],
              ["persian_service", "خدمت ایرانی/فارسی"],
            ].map(([param, label]) => (
              <label key={param} className="space-y-2">
                <span className="text-sm font-medium text-silver">{label}</span>
                <select
                  value={(filters as Record<string, string | undefined>)[param] ?? ""}
                  onChange={(event) =>
                    setFilter(param as keyof ServiceListFilters, event.target.value)
                  }
                  className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
                >
                  <option value="">همه</option>
                  {yesNo.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t bg-white/95 pt-4">
            <Button
              variant="gold"
              className="flex-1 rounded-xl"
              onClick={() => {
                setAppliedFilters(filters);
                setMeta((prev) => ({ ...prev, page: 1 }));
                setIsFilterOpen(false);
              }}
            >
              اعمال فیلتر
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setFilters({ ...emptyFilters });
                setAppliedFilters({ ...emptyFilters });
                setMeta((prev) => ({ ...prev, page: 1 }));
                setIsFilterOpen(false);
              }}
            >
              <X className="ml-1 h-4 w-4" />
              پاک کردن
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default ServiceManagement;
