import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpLeft, ChevronLeft, ChevronRight, Loader2, MapPin, Plus, RefreshCw, Search, SlidersHorizontal, Store, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassModal } from "@/components/GlassModal";
import { Header } from "@/components/Header";
import ServiceCover from "@/components/ServiceCover";
import { Input } from "@/components/ui/input";
import { fetchCategories, fetchServices, fetchLocationCatalogue, type LocationCountry } from "@/lib/serviceApi";
import { PERSIAN_FLAG_OPTIONS, RELEVANCE_ANSWER_LABELS, RELEVANCE_ANSWER_OPTIONS, STATUS_LABELS, formatDateTime, persianFlags, primaryCategoryName, unassessedRelevanceCount } from "@/lib/serviceDisplay";
import { Category, PaginationMeta, RelevanceAnswerChoice, Service, ServiceListFilters, ServiceStatus, SERVICE_STATUSES } from "@/types/service";
import "./service-management.css";

const PAGE_SIZE = 20;
const emptyFilters: ServiceListFilters = {};
const filterLabel: Record<string, string> = { q: "جست‌وجو", status: "وضعیت", city: "شهر", state: "ایالت", country_code: "کشور", category_id: "دسته‌بندی", source: "منبع", owner_user_id: "مالک" };

const ServiceManagement = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, size: PAGE_SIZE, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [locationCatalogue, setLocationCatalogue] = useState<LocationCountry[]>([]);
  const [locationError, setLocationError] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ServiceListFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<ServiceListFilters>({});
  const [keyword, setKeyword] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchLocationCatalogue().then((items) => { if (!cancelled) setLocationCatalogue(items); }).catch(() => { if (!cancelled) setLocationError(true); });
    fetchCategories(true).then((items) => { if (!cancelled) setCategories(items); }).catch(() => { if (!cancelled) setCategoryError(true); });
    return () => { cancelled = true; };
  }, []);

  const loadServices = useCallback(async (page: number, active: ServiceListFilters) => {
    const current = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchServices(active, page, PAGE_SIZE);
      if (current !== requestId.current) return;
      setServices(result.services);
      setMeta(result.meta);
    } catch (failure) {
      if (current === requestId.current) setError(failure instanceof Error ? failure.message : "دریافت فهرست کسب‌وکارها ناموفق بود.");
    } finally { if (current === requestId.current) setIsLoading(false); }
  }, []);

  useEffect(() => {
    loadServices(meta.page, appliedFilters);
    return () => { requestId.current += 1; };
  }, [loadServices, meta.page, appliedFilters]);
  useEffect(() => { setKeyword(appliedFilters.q ?? ""); }, [appliedFilters.q]);

  const apply = (next: ServiceListFilters) => { setAppliedFilters(next); setMeta((previous) => ({ ...previous, page: 1 })); };
  const setFilter = (name: keyof ServiceListFilters, value: string) => setFilters((previous) => ({ ...previous, [name]: value }));
  const locationStates = locationCatalogue.filter((country) => !filters.country_code || country.country_code === filters.country_code).flatMap((country) => country.states);
  const locationCities = locationStates.filter((region) => !filters.state || region.state === filters.state).flatMap((region) => region.cities);
  const activeEntries = Object.entries(appliedFilters).filter(([, value]) => value !== undefined && value !== "");
  const activeFilterCount = activeEntries.length;
  const openFilters = () => { setFilters({ ...appliedFilters }); setIsFilterOpen(true); };
  const describeFilter = (key: string, value: unknown) => {
    if (key === "status") return STATUS_LABELS[value as ServiceStatus];
    if (key === "category_id") return categories.find((item) => String(item.id) === String(value))?.name ?? String(value);
    if (key.startsWith("persian_")) return RELEVANCE_ANSWER_LABELS[value as RelevanceAnswerChoice] ?? String(value);
    return String(value);
  };

  return (<div className="min-h-screen pb-16 admin-business-list">
    <Header />
    <main className="business-workspace">
      <header className="business-workspace__heading">
        <div><p className="business-workspace__eyebrow">فهرست خدمات و کسب‌وکارها</p><h1>مدیریت کسب‌وکارها</h1><p>اطلاعات، وضعیت انتشار و مالک هر کسب‌وکار را مدیریت کنید.</p></div>
        <Link className="business-create" to="/services/new"><Plus size={19} />افزودن کسب‌وکار</Link>
      </header>

      <section className="business-toolbar" aria-label="جست‌وجو و فیلترها">
        <form className="business-list-search" onSubmit={(event) => { event.preventDefault(); apply({ ...appliedFilters, q: keyword.trim() }); }}>
          <Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="business-keyword">جست‌وجوی کسب‌وکار</label>
          <input id="business-keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="جست‌وجو در نام، شهر یا توضیحات…" />
          <button type="submit">جست‌وجو</button>
        </form>
        <button type="button" className="business-filter-button" onClick={openFilters}><SlidersHorizontal size={18} />فیلترها{activeFilterCount > 0 && <span>{activeFilterCount.toLocaleString("fa-IR")}</span>}</button>
        <button type="button" className="business-refresh" aria-label="دریافت دوباره فهرست" disabled={isLoading} onClick={() => loadServices(meta.page, appliedFilters)}><RefreshCw size={18} className={isLoading ? "animate-spin" : ""} /></button>
      </section>

      <div className="business-status-tabs" role="group" aria-label="فیلتر وضعیت انتشار">
        <button type="button" aria-pressed={!appliedFilters.status} onClick={() => apply({ ...appliedFilters, status: "" })}>همه</button>
        {SERVICE_STATUSES.map((status) => <button key={status} type="button" aria-pressed={appliedFilters.status === status} onClick={() => apply({ ...appliedFilters, status })}>{STATUS_LABELS[status]}</button>)}
      </div>
      {activeFilterCount > 0 && <div className="business-filter-chips" aria-label="فیلترهای فعال">{activeEntries.map(([key, value]) => <button type="button" key={key} onClick={() => { const next = { ...appliedFilters }; delete next[key as keyof ServiceListFilters]; apply(next); }} aria-label={`حذف فیلتر ${filterLabel[key] ?? PERSIAN_FLAG_OPTIONS.find((item) => item.key === key)?.short ?? key}`}><span>{filterLabel[key] ?? PERSIAN_FLAG_OPTIONS.find((item) => item.key === key)?.short ?? key}: {describeFilter(key, value)}</span><X size={13} /></button>)}<button type="button" onClick={() => apply({})}>پاک کردن همه</button></div>}
      <div className="business-list-caption"><h2>کسب‌وکارها</h2><span aria-live="polite">{isLoading ? "در حال دریافت…" : error ? "دریافت ناموفق" : `${meta.total.toLocaleString("fa-IR")} نتیجه`}</span></div>

      {isLoading ? <div className="business-list-state" role="status"><Loader2 className="animate-spin" size={30} /><p>در حال دریافت کسب‌وکارها…</p></div>
        : error ? <div className="business-list-state" role="alert"><p>{error}</p><Button variant="outline" onClick={() => loadServices(meta.page, appliedFilters)}>تلاش دوباره</Button></div>
        : services.length === 0 ? <div className="business-list-state"><span className="business-empty-icon"><Store size={32} /></span><h3>{activeFilterCount ? "نتیجه‌ای با این فیلترها پیدا نشد" : "هنوز کسب‌وکاری در این فهرست نیست"}</h3><p>{activeFilterCount ? "عبارت جست‌وجو یا فیلترها را تغییر دهید." : "اولین کسب‌وکار را اضافه کنید و اطلاعاتش را تکمیل کنید."}</p>{activeFilterCount ? <Button variant="outline" onClick={() => apply({})}>پاک کردن فیلترها</Button> : <Link className="business-create" to="/services/new"><Plus size={17} />افزودن کسب‌وکار</Link>}</div>
        : <div className="business-records">{services.map((service) => <Link className="business-record" key={service.id} to={`/services/${service.id}`} aria-label={`ویرایش کسب‌وکار ${service.name}`}>
          <div className="business-record__identity"><span className="business-record__art"><ServiceCover url={service.cover_image_url} /></span><div><div className="business-record__title"><h3>{service.name}</h3><span className={`business-record__status business-record__status--${service.status}`}>{STATUS_LABELS[service.status]}</span></div><p className="business-record__location"><MapPin size={14} /><bdi>{[service.city, service.state, service.country_code].filter(Boolean).join("، ") || "موقعیت ثبت نشده"}</bdi></p><p className="business-record__id">شناسه <bdi>{service.id}</bdi></p></div></div>
          <div className="business-record__classification"><span className="business-record__category">{primaryCategoryName(service) === "—" ? "بدون دسته‌بندی اصلی" : primaryCategoryName(service)}</span><div className="business-relevance-tags">{persianFlags(service).filter((flag) => flag.active).map((flag) => <Badge key={flag.key} variant="outline">{flag.short}</Badge>)}{unassessedRelevanceCount(service) > 0 && <span className="business-unassessed">{unassessedRelevanceCount(service).toLocaleString("fa-IR")} ویژگی بررسی‌نشده</span>}</div></div>
          <span className="business-record__edit">ویرایش<ArrowUpLeft size={17} /></span>
          <footer className="business-record__footer"><span><User size={13} />{service.owner_user_id == null ? "بدون مالک اختصاص‌یافته" : <>مالک: <bdi>{service.owner_user_id}</bdi>{!service.show_owner && " · نمایش عمومی خاموش"}</>}</span><span>آخرین تغییر: {formatDateTime(service.updated_at)}</span></footer>
        </Link>)}</div>}

      {!isLoading && !error && meta.pages > 1 && <nav className="business-list-pagination" aria-label="صفحه‌های کسب‌وکارها"><Button variant="outline" size="icon" aria-label="صفحه قبل" onClick={() => setMeta((previous) => ({ ...previous, page: previous.page - 1 }))} disabled={meta.page <= 1}><ChevronRight size={18} /></Button><span>صفحه {meta.page.toLocaleString("fa-IR")} از {meta.pages.toLocaleString("fa-IR")}</span><Button variant="outline" size="icon" aria-label="صفحه بعد" onClick={() => setMeta((previous) => ({ ...previous, page: previous.page + 1 }))} disabled={meta.page >= meta.pages}><ChevronLeft size={18} /></Button></nav>}
    </main>
      <GlassModal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="فیلتر کسب‌وکارها">
        <div className="space-y-4">{categoryError && <p className="text-sm text-destructive">دریافت دسته‌بندی‌ها ناموفق بود. برای دریافت دوباره، صفحه را بازخوانی کنید.</p>}
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
              <span className="text-sm font-medium text-silver">کشور</span>
              <select value={filters.country_code ?? ""} onChange={(event) => setFilters((current) => ({ ...current, country_code: event.target.value, state: "", city: "" }))} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"><option value="">همهٔ کشورها</option>{locationCatalogue.map((country) => <option key={country.country_code} value={country.country_code}>{country.country_code === "DE" ? "آلمان" : country.country_code}</option>)}</select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">ایالت</span>
              <select value={filters.state ?? ""} onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value, city: "" }))} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"><option value="">همهٔ ایالت‌ها</option>{locationStates.map((region) => <option key={region.id} value={region.state}>{region.state}</option>)}</select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">شهر</span>
              <select value={filters.city ?? ""} onChange={(event) => setFilter("city", event.target.value)} className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"><option value="">همهٔ شهرها</option>{locationCities.map((place) => <option key={place.id} value={place.city}>{place.city}</option>)}</select>
            </label>
            {locationError && <p role="alert" className="text-sm text-destructive">دریافت فهرست شهرها ناموفق بود؛ صفحه را بازخوانی کنید.</p>}

            <label className="space-y-2">
              <span className="text-sm font-medium text-silver">دسته‌بندی</span>
              <select
                value={filters.category_id ?? ""}
                onChange={(event) => setFilter("category_id", event.target.value)}
                className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
              >
                <option value="">همه</option>
                {categories.filter((category) => category.level === 1).map((group) => <optgroup key={group.id} label={group.name}>{categories.filter((category) => category.level === 2 && (category.parent_ids ?? [category.parent_id]).includes(group.id)).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</optgroup>)}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PERSIAN_FLAG_OPTIONS.map((option) => (
              <label key={option.key} className="space-y-2">
                <span className="text-sm font-medium text-silver">{option.short}</span>
                <select
                  value={filters[option.key] ?? ""}
                  onChange={(event) =>
                    setFilter(option.key, event.target.value as RelevanceAnswerChoice | "")
                  }
                  className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
                >
                  <option value="">همه</option>
                  {/* Tri-state: "نامشخص" selects the records nobody has
                      assessed, which a plain yes/no filter cannot reach. */}
                  {RELEVANCE_ANSWER_OPTIONS.map((choice) => (
                    <option key={choice} value={choice}>
                      {RELEVANCE_ANSWER_LABELS[choice]}
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
