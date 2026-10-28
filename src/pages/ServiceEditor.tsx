import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Store,
  Tags,
  Phone,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createService,
  fetchCategories,
  fetchService,
  fetchLocationCatalogue,
  createLocationCity,
  type LocationCountry,
  saveServiceAggregate,
  searchOwnerCandidates,
  uploadServiceCoverImage,
  removeServiceCoverImage,
  ServiceApiError,
} from "@/lib/serviceApi";
import ServiceCoverImage from "@/components/services/ServiceCoverImage";
import { CONTACT_METHODS, buildGuidedContact, contactMethodOf, contactValueIssue, friendlyContactValue, type ContactMethodKey } from "@/lib/serviceContacts";
import "./service-editor.css";
import {
  CONTACT_TYPE_LABELS,
  DEFAULT_COUNTRY_CODE,
  PERSIAN_FLAG_OPTIONS,
  RELEVANCE_ANSWER_LABELS,
  RELEVANCE_ANSWER_OPTIONS,
  STATUS_HINTS,
  STATUS_LABELS,
  checkPublishRequirements,
  ownerLabel,
  formatDateTime,
} from "@/lib/serviceDisplay";
import {
  Category,
  ContactType,
  CONTACT_TYPES,
  OwnerCandidate,
  RelevanceAnswerChoice,
  ServiceCategoryInput,
  ServiceContactInput,
  ServiceCreatePayload,
  ServiceStatus,
  SERVICE_STATUSES,
  relevanceAnswerToChoice,
  relevanceChoiceToAnswer,
} from "@/types/service";

/**
 * Create / edit a service.
 *
 * Organised into sections instead of one flat form, because the backend has
 * several independent concerns (identity, location, relevance, categories,
 * contacts, ownership, publishing, provenance) and mixing them made review hard.
 *
 * The backend stays authoritative. This page mirrors a few rules to avoid an
 * obviously invalid submit (publish needs one primary category, provenance is
 * paired, coordinates are a pair), but every server message is surfaced as-is.
 *
 * Existing services save their whole editable aggregate atomically, including
 * contacts and categories, with a token that detects concurrent changes.
 */

type ContactRow = ServiceContactInput & { key: string; method: ContactMethodKey };

let contactKeySeed = 0;
const nextKey = () => {
  contactKeySeed += 1;
  return `contact-${contactKeySeed}`;
};

type SectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const Section = ({ title, description, children }: SectionProps) => (
  <section className="se-section"><header className="se-section__heading"><h3>{title}</h3>{description && <p>{description}</p>}</header><div className="se-section__body">{children}</div></section>
);

const FieldLabel = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <label className="se-field">
    {children}
    {hint && <small>{hint}</small>}
  </label>
);

const ServiceEditor = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const isNew = !serviceId || serviceId === "new";
  const numericId = serviceId && serviceId !== "new" ? Number(serviceId) : null;

  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [openCategoryGroups, setOpenCategoryGroups] = useState<Set<number>>(new Set());
  const [isChoosingContact, setIsChoosingContact] = useState(false);
  const tabs = [
    { key: "identity", label: "اطلاعات و تصویر", icon: Store },
    { key: "classification", label: "دسته و ویژگی‌ها", icon: Tags },
    { key: "contacts", label: "راه‌های ارتباط", icon: Phone },
    { key: "ownership", label: "مالک و منبع", icon: User },
  ];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [locationCatalogue, setLocationCatalogue] = useState<LocationCountry[]>([]);
  const [locationError, setLocationError] = useState("");
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [newCity, setNewCity] = useState("");
  const [isAddingCity, setIsAddingCity] = useState(false);
  /** The backend validates the region using the selected country's vocabulary. */
  const [state, setState] = useState("");
  // Germany is the normal default, so the admin does not retype it every time.
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // The four Iranian/Persian signals are independent and tri-state: an admin
  // picks unknown / yes / no, which maps to null / true / false.
  const [persianOwned, setPersianOwned] = useState<RelevanceAnswerChoice>("unknown");
  const [persianProvider, setPersianProvider] = useState<RelevanceAnswerChoice>("unknown");
  const [persianLanguage, setPersianLanguage] = useState<RelevanceAnswerChoice>("unknown");
  const [persianService, setPersianService] = useState<RelevanceAnswerChoice>("unknown");

  const [status, setStatus] = useState<ServiceStatus>("published");

  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [showOwner, setShowOwner] = useState(true);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerResults, setOwnerResults] = useState<OwnerCandidate[]>([]);
  const [isSearchingOwner, setIsSearchingOwner] = useState(false);

  const [source, setSource] = useState("");
  const [externalId, setExternalId] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<number | null>(null);

  /** The service's updated_at as loaded, used for optimistic concurrency. */
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const [contacts, setContacts] = useState<ContactRow[]>([]);

  /* ------------------------------------------------------------------ load */

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await fetchCategories(true));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: error instanceof Error ? error.message : "دریافت دسته‌بندی‌ها ناموفق بود.",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const service = await fetchService(numericId as number);
        if (cancelled) return;
        setLoadedUpdatedAt(service.updated_at);
        setIsStale(false);
        setName(service.name ?? "");
        setDescription(service.description ?? "");
        setCoverImageUrl(service.cover_image_url ?? null);
        setPendingImage(null);
        setRemoveImageRequested(false);
        setAddress(service.address ?? "");
        setPostalCode(service.postal_code ?? "");
        setCity(service.city ?? "");
        setState(service.state ?? "");
        setCountryCode(service.country_code ?? "");
        setLatitude(service.latitude === null ? "" : String(service.latitude));
        setLongitude(service.longitude === null ? "" : String(service.longitude));
        setPersianOwned(relevanceAnswerToChoice(service.persian_owned));
        setPersianProvider(relevanceAnswerToChoice(service.persian_provider));
        setPersianLanguage(relevanceAnswerToChoice(service.persian_language));
        setPersianService(relevanceAnswerToChoice(service.persian_service));
        setStatus(service.status);
        setOwnerUserId(service.owner_user_id);
        setShowOwner(service.show_owner);
        setSource(service.source ?? "");
        setExternalId(service.external_id ?? "");
        setSelectedCategoryIds((service.categories ?? []).map((item) => item.category_id));
        setPrimaryCategoryId(
          (service.categories ?? []).find((item) => item.is_primary)?.category_id ?? null,
        );
        setContacts(
          (service.contacts ?? []).map((contact) => ({
            key: nextKey(),
            method: contactMethodOf(contact),
            title: contact.title,
            type: contact.type,
            value: contact.value,
            platform: contact.platform ?? "",
            display_order: contact.display_order,
            is_visible: contact.is_visible,
          })),
        );
      } catch (error) {
        if (cancelled) return;
        toast({
          variant: "destructive",
          title: "خطا",
          description: error instanceof Error ? error.message : "دریافت سرویس ناموفق بود.",
        });
        navigate("/services");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNew, numericId, navigate, toast]);

  const loadLocations = useCallback(async () => {
    setIsLoadingLocations(true);
    try {
      const next = await fetchLocationCatalogue();
      setLocationCatalogue(next);
      setLocationError("");
      return next;
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "دریافت شهرها ناموفق بود.");
      return null;
    } finally { setIsLoadingLocations(false); }
  }, []);
  useEffect(() => { loadLocations(); }, [loadLocations]);
  const locationStates = locationCatalogue.find((country) => country.country_code === countryCode)?.states ?? [];
  const selectedLocationState = locationStates.find((region) => region.state.localeCompare(state, undefined, { sensitivity: "base" }) === 0);
  const selectedLocationCity = selectedLocationState?.cities.find((place) => place.city.localeCompare(city, undefined, { sensitivity: "base" }) === 0);
  const addCity = async () => {
    if (!selectedLocationState || !newCity.trim() || isAddingCity) return;
    setIsAddingCity(true);
    try {
      await createLocationCity(selectedLocationState.id, newCity.trim());
      const next = await loadLocations();
      const saved = next?.find((country) => country.country_code === countryCode)?.states.find((region) => region.id === selectedLocationState.id)?.cities.find((place) => place.city.localeCompare(newCity.trim(), undefined, { sensitivity: "base" }) === 0);
      if (saved) { setState(selectedLocationState.state); setCity(saved.city); setNewCity(""); }
      toast({ title: "شهر به فهرست مشترک اضافه شد" });
    } catch (error) { toast({ variant: "destructive", title: "افزودن شهر انجام نشد", description: error instanceof Error ? error.message : "دوباره تلاش کنید." }); }
    finally { setIsAddingCity(false); }
  };

  /* -------------------------------------------------------------- category UI */

  const categoryGroups = useMemo(() => {
    const ordered = [...categories].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
    return ordered.filter((category) => category.level === 1).map((group) => ({
      group,
      children: ordered.filter((category) => category.level === 2 && (category.parent_ids ?? [category.parent_id]).includes(group.id)),
    }));
  }, [categories]);
  const assignableCategoryIds = useMemo(() => new Set(categories.filter((category) => category.level === 2).map((category) => category.id)), [categories]);

  const toggleCategory = (categoryId: number) => {
    if (!assignableCategoryIds.has(categoryId)) return;
    if (selectedCategoryIds.includes(categoryId)) {
      removeCategory(categoryId);
      return;
    }
    if (!categories.find((category) => category.id === categoryId)?.is_active) return;
    setSelectedCategoryIds([...selectedCategoryIds, categoryId]);
    if (primaryCategoryId === null || !assignableCategoryIds.has(primaryCategoryId)) {
      setPrimaryCategoryId(categoryId);
    }
  };

  const removeCategory = (categoryId: number) => {
    const remaining = selectedCategoryIds.filter((id) => id !== categoryId);
    setSelectedCategoryIds(remaining);
    if (primaryCategoryId === categoryId) {
      setPrimaryCategoryId(remaining.find((id) => assignableCategoryIds.has(id) && categories.find((category) => category.id === id)?.is_active) ?? null);
    }
  };

  const choosePrimary = (categoryId: number) => {
    if (!assignableCategoryIds.has(categoryId)) return;
    if (categoryId !== primaryCategoryId && !categories.find((category) => category.id === categoryId)?.is_active) return;
    setSelectedCategoryIds((previous) =>
      previous.includes(categoryId) ? previous : [...previous, categoryId],
    );
    setPrimaryCategoryId(categoryId);
  };

  /* -------------------------------------------------------------- contacts UI */

  const addContact = (methodKey: ContactMethodKey) => {
    const method = CONTACT_METHODS.find((option) => option.key === methodKey)!;
    setIsChoosingContact(false);
    setContacts((previous) => [
      ...previous,
      {
        key: nextKey(),
        method: method.key,
        title: method.label,
        type: method.type as ContactType,
        value: "",
        platform: method.platform ?? "",
        display_order: previous.length,
        is_visible: true,
      },
    ]);
  };

  const updateContact = (key: string, patch: Partial<Omit<ContactRow, "key">>) => {
    setContacts((previous) =>
      previous.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const removeContact = (key: string) => {
    setContacts((previous) => previous.filter((row) => row.key !== key));
  };

  const moveContact = (index: number, direction: -1 | 1) => {
    setContacts((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  /* ---------------------------------------------------------------- owner UI */

  const runOwnerSearch = async () => {
    setIsSearchingOwner(true);
    try {
      setOwnerResults(await searchOwnerCandidates(ownerSearch, 10));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: error instanceof Error ? error.message : "جست‌وجوی کاربر ناموفق بود.",
      });
    } finally {
      setIsSearchingOwner(false);
    }
  };

  /* ----------------------------------------------------------------- saving */

  const publishCheck = checkPublishRequirements(
    status,
    selectedCategoryIds,
    primaryCategoryId === null ? [] : [primaryCategoryId],
  );

  const localIssue = useMemo(() => {
    if (!name.trim()) return "نام سرویس الزامی است.";
    if (countryCode.trim() && !/^[A-Za-z]{2}$/.test(countryCode.trim())) {
      return "کد کشور باید دو حرف لاتین باشد؛ مثلاً DE، AT یا CH.";
    }
    if (state && !selectedLocationState) return "ایالت را از فهرست تعریف‌شده انتخاب کنید.";
    if (city && !selectedLocationCity) return "شهر را از فهرست تعریف‌شده انتخاب کنید.";
    if ((latitude === "") !== (longitude === "")) {
      return "عرض جغرافیایی و طول جغرافیایی باید با هم وارد شوند.";
    }
    if (latitude !== "" && (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90)) return "عرض جغرافیایی باید عددی بین ۹۰- و ۹۰ باشد.";
    if (longitude !== "" && (!Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180)) return "طول جغرافیایی باید عددی بین ۱۸۰- و ۱۸۰ باشد.";
    if ((source.trim() === "") !== (externalId.trim() === "")) {
      return "منبع و شناسه خارجی باید با هم وارد شوند یا هر دو خالی بمانند.";
    }
    const incomplete = contacts.find((row) => !row.title.trim() || contactValueIssue(row));
    if (incomplete) return !incomplete.title.trim() ? "عنوان راه ارتباطی را مشخص کنید." : contactValueIssue(incomplete);
    if (selectedCategoryIds.some((id) => !assignableCategoryIds.has(id))) return "گروه‌ها قابل انتساب نیستند؛ دسته‌های سطح دوم را انتخاب کنید.";
    if (!publishCheck.ok) return publishCheck.message;
    return null;
  }, [name, countryCode, latitude, longitude, source, externalId, contacts, publishCheck, selectedCategoryIds, assignableCategoryIds, state, city, selectedLocationState, selectedLocationCity]);

  const buildCategoryPayload = (): ServiceCategoryInput[] =>
    selectedCategoryIds.map((categoryId) => ({
      category_id: categoryId,
      is_primary: categoryId === primaryCategoryId,
    }));

  const buildContactPayload = (): ServiceContactInput[] => contacts.map(buildGuidedContact);

  const handleSave = async () => {
    if (isSaving || isStale) return;
    if (localIssue) {
      toast({ variant: "destructive", title: "بررسی فرم", description: localIssue });
      return;
    }

    setIsSaving(true);
    try {
      const aggregate: ServiceCreatePayload = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: selectedLocationCity?.city ?? null,
        state: selectedLocationState?.state ?? null,
        country_code: countryCode.trim().toUpperCase() || null,
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
        // "unknown" is sent as null, never as false.
        persian_owned: relevanceChoiceToAnswer(persianOwned),
        persian_provider: relevanceChoiceToAnswer(persianProvider),
        persian_language: relevanceChoiceToAnswer(persianLanguage),
        persian_service: relevanceChoiceToAnswer(persianService),
        status,
        source: source.trim() || null,
        external_id: externalId.trim() || null,
        show_owner: showOwner,
        owner_user_id: ownerUserId,
        contacts: buildContactPayload(),
        categories: buildCategoryPayload(),
      };

      /* One request for the whole aggregate: scalars, owner, show_owner,
         contacts and categories commit together or not at all. The loaded
         updated_at is mandatory and lets the backend refuse a stale save. */
      if (!isNew && !loadedUpdatedAt) {
        throw new Error("اطلاعات کسب‌وکار کامل بارگذاری نشده است؛ صفحه را دوباره بارگذاری کنید.");
      }
      let saved = isNew ? await createService(aggregate) : await saveServiceAggregate(numericId as number, {
        ...aggregate, expected_updated_at: loadedUpdatedAt as string,
      });
      setLoadedUpdatedAt(saved.updated_at);
      setIsStale(false);
      if (pendingImage || removeImageRequested) {
        try {
          saved = pendingImage
            ? await uploadServiceCoverImage(saved.id, pendingImage, saved.updated_at)
            : await removeServiceCoverImage(saved.id, saved.updated_at);
          setLoadedUpdatedAt(saved.updated_at);
          setCoverImageUrl(saved.cover_image_url ?? null);
          setPendingImage(null);
          setRemoveImageRequested(false);
        } catch (error) {
          const stale = error instanceof ServiceApiError && error.status === 409;
          if (stale) setIsStale(true);
          toast({ variant: "destructive", title: "اطلاعات ذخیره شد؛ تغییر تصویر انجام نشد", description: error instanceof Error ? error.message : "تصویر را دوباره انتخاب و ذخیره کنید." });
          setActiveTab("identity");
          // A created listing already exists even if image storage is unavailable.
          // Opening its editor prevents a retry from creating a duplicate listing.
          if (isNew) navigate(`/services/${saved.id}`);
          return;
        }
      }
      toast({ title: isNew ? "کسب‌وکار ایجاد شد" : "تغییرات کسب‌وکار ذخیره شد" });
      navigate(isNew ? `/services/${saved.id}` : "/services");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ذخیره سرویس ناموفق بود.";
      /* 409 means another admin saved this service since it was loaded. The
         data on screen is stale, so offer a reload rather than retrying. */
      if ((error instanceof ServiceApiError && error.status === 409 && /reload/i.test(message)) || /changed by someone else/i.test(message)) {
        setIsStale(true);
      }
      toast({
        variant: "destructive",
        title: /changed by someone else/i.test(message) ? "تغییر همزمان" : "ذخیره نشد",
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="service-editor-page" dir="rtl"><Header /><div className="se-loading" role="status"><Loader2 className="animate-spin" size={28} /><p>در حال دریافت اطلاعات کسب‌وکار…</p></div></div>;
  }

  const mainCategory = categories.find((category) => category.id === primaryCategoryId)?.name;
  const assessments = [persianOwned, persianProvider, persianLanguage, persianService];
  const changeImage = (file: File | null, remove: boolean) => { setPendingImage(file); setRemoveImageRequested(remove); };

  return <div className="service-editor-page" dir="rtl">
    <Header />
    <main className="se-shell">
      <header className="se-page-heading">
        <div><button type="button" className="se-back" onClick={() => navigate("/services")}><ArrowRight size={16} />کسب‌وکارها</button><div className="se-title-row"><h1>{isNew ? "افزودن کسب‌وکار" : "ویرایش کسب‌وکار"}</h1>{!isNew && <span className="se-record-id">#{numericId}</span>}</div><p>{isNew ? "اطلاعات، تصویر و راه‌های ارتباط کسب‌وکار را یک‌جا ثبت کنید." : name || "اطلاعات کسب‌وکار را بررسی و به‌روز کنید."}</p></div>
        <span className={`se-status se-status--${status}`}>{STATUS_LABELS[status]}</span>
      </header>

      {isStale && <div className="se-alert" role="alert"><AlertCircle size={21} /><div><strong>اطلاعات این کسب‌وکار تغییر کرده است.</strong><p>برای دریافت آخرین تغییرات، صفحه را دوباره بارگذاری کنید. تغییرات ذخیره‌نشدهٔ شما از دست می‌روند.</p></div><button className="se-button se-button--outline" type="button" onClick={() => window.location.reload()}>بارگذاری دوباره</button></div>}

      <div className="se-layout">
        <div className="se-main-column">
          <nav className="se-tabs" role="tablist" aria-label="بخش‌های ویرایش کسب‌وکار">
            {tabs.map((tab, index) => <button key={tab.key} id={`se-tab-${tab.key}`} data-editor-tab={tab.key} type="button" role="tab" tabIndex={activeTab === tab.key ? 0 : -1} aria-selected={activeTab === tab.key} aria-controls={`se-panel-${tab.key}`} onClick={() => setActiveTab(tab.key)} onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowLeft") next = (index + 1) % tabs.length;
              else if (event.key === "ArrowRight") next = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = tabs.length - 1;
              else return;
              event.preventDefault(); setActiveTab(tabs[next].key);
              event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-editor-tab="${tabs[next].key}"]`)?.focus();
            }}><tab.icon size={18} /><span>{tab.label}</span></button>)}
          </nav>

          <fieldset className="se-editable" disabled={isSaving}><legend className="sr-only">اطلاعات کسب‌وکار</legend><div role="tabpanel" id={`se-panel-${activeTab}`} aria-labelledby={`se-tab-${activeTab}`} className="se-tab-panel">
            {activeTab === "identity" && <>
              <Section title="اطلاعات اصلی" description="نام و معرفی‌ای که در صفحهٔ کسب‌وکار دیده می‌شود.">
                <FieldLabel>نام کسب‌وکار <span className="se-required">ضروری</span><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={300} placeholder="مثلاً رستوران، کلینیک یا فروشگاه…" /></FieldLabel>
                <FieldLabel hint="خدمات و ویژگی‌های کسب‌وکار را کوتاه و روشن معرفی کنید.">معرفی کسب‌وکار<Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="چه خدماتی ارائه می‌شود؟" /></FieldLabel>
              </Section>
              <Section title="تصویر معرفی" description="این تصویر در فهرست و صفحهٔ عمومی کسب‌وکار استفاده می‌شود."><ServiceCoverImage savedUrl={coverImageUrl} file={pendingImage} removeRequested={removeImageRequested} disabled={isSaving} onChange={changeImage} /></Section>
              <Section title="نشانی و موقعیت" description="کشور، ایالت و شهر به پیدا شدن کسب‌وکار در جستجو کمک می‌کنند.">
                <div className="se-form-grid">
                  <FieldLabel>کشور<select value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setState(""); setCity(""); }} disabled={isLoadingLocations}><option value="">انتخاب کشور</option>{locationCatalogue.map((country) => <option key={country.country_code} value={country.country_code}>{country.country_code === "DE" ? "آلمان" : country.country_code}</option>)}{countryCode && !locationCatalogue.some((country) => country.country_code === countryCode) && <option value={countryCode}>{countryCode}</option>}</select></FieldLabel>
                  <FieldLabel>ایالت<select value={selectedLocationState?.state ?? state} disabled={isLoadingLocations || !countryCode} onChange={(event) => { setState(event.target.value); setCity(""); setNewCity(""); }}><option value="">انتخاب ایالت</option>{locationStates.map((region) => <option key={region.id} value={region.state}>{region.state}</option>)}{state && !selectedLocationState && <option value={state} disabled>{state} — نیاز به انتخاب مجدد</option>}</select></FieldLabel>
                  <FieldLabel>شهر<select value={selectedLocationCity?.city ?? city} disabled={isLoadingLocations || !selectedLocationState} onChange={(event) => setCity(event.target.value)}><option value="">{selectedLocationState ? "انتخاب شهر" : "ابتدا ایالت را انتخاب کنید"}</option>{selectedLocationState?.cities.map((place) => <option key={place.id} value={place.city}>{place.city}</option>)}{city && !selectedLocationCity && <option value={city} disabled>{city} — نیاز به انتخاب مجدد</option>}</select></FieldLabel>
                  <FieldLabel>کد پستی<Input dir="ltr" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="60311" /></FieldLabel>
                  <div className="se-full-width"><FieldLabel>نشانی کامل<Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="خیابان، پلاک و جزئیات نشانی" /></FieldLabel></div>
                </div>
                {locationError && <p className="se-small-note" role="alert">{locationError} <button type="button" onClick={loadLocations}>تلاش دوباره</button></p>}
                {selectedLocationState && <details className="se-add-city"><summary>شهر موردنظر در فهرست نیست؟</summary><p>نام رسمی شهر در {selectedLocationState.state} را وارد کنید. این شهر به فهرست مشترک همهٔ کسب‌وکارها اضافه می‌شود.</p><div><Input dir="auto" aria-label="نام رسمی شهر جدید" value={newCity} onChange={(event) => setNewCity(event.target.value)} placeholder="نام رسمی شهر" /><button type="button" className="se-button se-button--outline" disabled={!newCity.trim() || isAddingCity} onClick={addCity}>{isAddingCity ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}افزودن شهر</button></div></details>}
                <details className="se-details" open={Boolean(latitude || longitude)}><summary>مختصات جغرافیایی <span>اختیاری</span></summary><p className="se-coordinate-help"><a href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([address, city, state, countryCode].filter(Boolean).join(", ") || "Germany")} target="_blank" rel="noopener noreferrer">یافتن موقعیت در Google Maps ↗</a><span>روی محل راست‌کلیک کنید؛ عدد اول عرض و عدد دوم طول جغرافیایی است.</span></p><div className="se-form-grid"><FieldLabel hint="بین ۹۰- و ۹۰؛ همراه با طول جغرافیایی.">عرض جغرافیایی<Input dir="ltr" type="number" step="any" min={-90} max={90} value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="50.1109" /></FieldLabel><FieldLabel hint="بین ۱۸۰- و ۱۸۰؛ همراه با عرض جغرافیایی.">طول جغرافیایی<Input dir="ltr" type="number" step="any" min={-180} max={180} value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="8.6821" /></FieldLabel></div></details>
              </Section>
            </>}

            {activeTab === "classification" && <>
              <Section title="دسته‌بندی خدمات" description="ابتدا گروه را باز کنید، سپس دسته‌های مرتبط را انتخاب کنید. اولین دستهٔ انتخاب‌شده، اصلی می‌شود؛ می‌توانید آن را تغییر دهید.">
                <Input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} type="search" placeholder="جستجو در دسته‌بندی‌ها…" aria-label="جستجوی دسته‌بندی" />
                {categoryGroups.length === 0 ? <div className="se-empty"><Tags size={25} /><p>هنوز دسته‌بندی‌ای در دسترس نیست.</p></div> : <div className="se-category-groups">
                  {categoryGroups.map(({ group, children }) => {
                    const search = categorySearch.trim().toLocaleLowerCase();
                    const groupMatches = group.name.toLocaleLowerCase().includes(search);
                    const visible = children.filter((category) => !search || groupMatches || category.name.toLocaleLowerCase().includes(search));
                    if (search && !groupMatches && !visible.length) return null;
                    const expanded = Boolean(search) || openCategoryGroups.has(group.id);
                    const chosenCount = children.filter((category) => selectedCategoryIds.includes(category.id)).length;
                    return <section key={group.id} className="se-category-group">
                      <button className="se-category-group__heading" type="button" aria-expanded={expanded} onClick={() => setOpenCategoryGroups((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>
                        <span><Tags size={17} /><strong>{group.name}</strong><small>{children.length.toLocaleString("fa-IR")} دسته{chosenCount ? ` · ${chosenCount.toLocaleString("fa-IR")} انتخاب‌شده` : ""}</small></span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
                      </button>
                      {expanded && <div className="se-category-list">{visible.map((category) => {
                        const selected = selectedCategoryIds.includes(category.id);
                        const isPrimary = primaryCategoryId === category.id;
                        const retired = !category.is_active;
                        return <div key={category.id} className={`se-category ${selected ? "is-selected" : ""} ${retired ? "is-retired" : ""}`}><label><input type="checkbox" checked={selected} disabled={retired && !selected} onChange={() => toggleCategory(category.id)} /><span>{category.name}{retired && <small>غیرفعال</small>}</span></label><button type="button" onClick={() => choosePrimary(category.id)} disabled={retired && !isPrimary} aria-pressed={isPrimary} aria-label={`انتخاب ${category.name} به‌عنوان دستهٔ اصلی`} className={isPrimary ? "se-primary-category is-active" : "se-primary-category"}>{isPrimary && <Check size={13} />}{isPrimary ? "دستهٔ اصلی" : "انتخاب اصلی"}</button></div>;
                      })}{!visible.length && <p className="se-small-note">این گروه هنوز دسته‌ای ندارد.</p>}</div>}
                    </section>;
                  })}
                </div>}
                {selectedCategoryIds.some((id) => !assignableCategoryIds.has(id)) && <div className="se-legacy-categories"><p>گروه‌های قدیمی را حذف و یک دستهٔ سطح دوم انتخاب کنید:</p>{selectedCategoryIds.filter((id) => !assignableCategoryIds.has(id)).map((id) => <button type="button" key={id} onClick={() => removeCategory(id)}>{categories.find((category) => category.id === id)?.name ?? id}<X size={14} /></button>)}</div>}
                <p className="se-small-note">{selectedCategoryIds.length.toLocaleString("fa-IR")} دسته انتخاب شده · اصلی: {mainCategory ?? "تعیین نشده"}</p>
              </Section>
              <Section title="ویژگی‌های ایرانی و فارسی" description="این چهار ویژگی مستقل‌اند. اگر اطلاعات کافی ندارید «نامشخص» را نگه دارید.">
                <div className="se-relevance-list">{PERSIAN_FLAG_OPTIONS.map((option) => {
                  const item = option.key === "persian_owned" ? { value: persianOwned, setter: setPersianOwned } : option.key === "persian_provider" ? { value: persianProvider, setter: setPersianProvider } : option.key === "persian_language" ? { value: persianLanguage, setter: setPersianLanguage } : { value: persianService, setter: setPersianService };
                  return <fieldset key={option.key} className="se-relevance"><legend>{option.label}</legend><p>{option.hint}</p><div className="se-answer-group">{RELEVANCE_ANSWER_OPTIONS.map((choice) => <label key={choice} className={item.value === choice ? "is-selected" : ""}><input type="radio" name={`relevance-${option.key}`} checked={item.value === choice} onChange={() => item.setter(choice)} /><span>{RELEVANCE_ANSWER_LABELS[choice]}</span></label>)}</div></fieldset>;
                })}</div>
              </Section>
            </>}

            {activeTab === "contacts" && <Section title="راه‌های ارتباط با کسب‌وکار" description="روش ارتباط را انتخاب کنید و شماره، ایمیل یا شناسهٔ آن را بنویسید. پیوند صفحه به‌صورت خودکار آماده می‌شود.">
              {contacts.length === 0 ? <div className="se-empty"><Phone size={27} /><h4>راه ارتباطی ثبت نشده است</h4><p>تلفن، ایمیل، وب‌سایت یا شبکهٔ اجتماعی کسب‌وکار را اضافه کنید.</p></div> : <div className="se-contact-list">{contacts.map((row, index) => {
                const method = CONTACT_METHODS.find((option) => option.key === row.method)!;
                return <article key={row.key} className="se-contact"><header><div><span className="se-contact__number">{(index + 1).toLocaleString("fa-IR")}</span><strong>{row.title || method.label}</strong></div><div className="se-contact__tools"><button type="button" aria-label="انتقال به بالا" disabled={index === 0} onClick={() => moveContact(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label="انتقال به پایین" disabled={index === contacts.length - 1} onClick={() => moveContact(index, 1)}><ArrowDown size={16} /></button><button type="button" className="se-danger-icon" aria-label="حذف روش تماس" onClick={() => removeContact(row.key)}><Trash2 size={16} /></button></div></header>
                  <div className="se-form-grid se-guided-contact-fields"><FieldLabel>روش ارتباط<select value={row.method} onChange={(event) => {
                    const next = CONTACT_METHODS.find((option) => option.key === event.target.value)!;
                    updateContact(row.key, {
                      method: next.key,
                      title: !row.title.trim() || row.title === method.label ? next.label : row.title,
                      ...(next.key === "custom" ? {} : { type: next.type as ContactType, platform: next.platform }),
                      value: friendlyContactValue(row),
                    });
                  }}>{CONTACT_METHODS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></FieldLabel><FieldLabel hint={method.hint}>{row.method === "phone" || row.method === "whatsapp" ? "شمارهٔ تماس" : row.method === "email" ? "نشانی ایمیل" : row.method === "instagram" || row.method === "telegram" ? "نام کاربری یا پیوند صفحه" : row.method === "website" || row.method === "linkedin" ? "نشانی صفحه" : "اطلاعات ارتباط"}<Input dir={row.method === "custom" ? "auto" : "ltr"} value={friendlyContactValue(row)} onChange={(event) => updateContact(row.key, { value: event.target.value })} placeholder={method.placeholder} inputMode={row.method === "phone" || row.method === "whatsapp" ? "tel" : row.method === "email" ? "email" : "text"} /></FieldLabel></div>
                  <details className="se-contact-custom" open={row.method === "custom"}><summary>{row.method === "custom" ? "جزئیات روش سفارشی" : "عنوان دلخواه برای این روش ارتباط"}</summary><div className="se-form-grid"><FieldLabel>عنوان نمایشی<Input value={row.title} onChange={(event) => updateContact(row.key, { title: event.target.value })} maxLength={200} placeholder={method.label} /></FieldLabel>{row.method === "custom" && <><FieldLabel>نوع مقدار<select value={row.type} onChange={(event) => updateContact(row.key, { type: event.target.value as ContactType })}>{CONTACT_TYPES.map((type) => <option key={type} value={type}>{CONTACT_TYPE_LABELS[type]}</option>)}</select></FieldLabel><FieldLabel hint="فقط برای شبکه‌های خارج از گزینه‌های آماده.">نام شبکه / پلتفرم<Input dir="ltr" value={row.platform ?? ""} onChange={(event) => updateContact(row.key, { platform: event.target.value })} placeholder="نام شبکه" /></FieldLabel></>}</div></details>
                  <div className="se-contact-visibility"><label htmlFor={`se-contact-visible-${row.key}`}><strong>نمایش عمومی</strong><span>این راه ارتباط در صفحهٔ کسب‌وکار دیده شود.</span></label><Switch id={`se-contact-visible-${row.key}`} checked={row.is_visible} onCheckedChange={(checked) => updateContact(row.key, { is_visible: checked })} aria-label={"نمایش عمومی " + (row.title || method.label)} /></div>
                </article>;
              })}</div>}
              {isChoosingContact ? <div className="se-contact-picker"><header><strong>کدام راه ارتباط را اضافه می‌کنید؟</strong><button type="button" aria-label="بستن انتخاب روش ارتباط" onClick={() => setIsChoosingContact(false)}><X size={17} /></button></header><div>{CONTACT_METHODS.map((method) => <button key={method.key} type="button" onClick={() => addContact(method.key)}>{method.label}<Plus size={14} /></button>)}</div></div> : <button type="button" className="se-button se-button--outline" onClick={() => setIsChoosingContact(true)}><Plus size={17} />افزودن راه ارتباط</button>}
            </Section>}

            {activeTab === "ownership" && <>
              <Section title="مالک کسب‌وکار" description="حساب مرتبط با این کسب‌وکار را پیدا و انتخاب کنید.">
                <div className="se-owner-search"><Input value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runOwnerSearch(); } }} placeholder="نام، نام کاربری یا شناسهٔ کاربر" aria-label="جستجوی مالک" /><button type="button" className="se-button se-button--outline" onClick={runOwnerSearch} disabled={isSearchingOwner}>{isSearchingOwner ? <Loader2 size={17} className="animate-spin" /> : "جستجو"}</button></div>
                {ownerResults.length > 0 && <div className="se-owner-results">{ownerResults.map((candidate) => <button key={candidate.user_id} type="button" onClick={() => { setOwnerUserId(candidate.user_id); setOwnerResults([]); setOwnerSearch(""); }}><span>{ownerLabel(candidate)}</span><bdi>{candidate.user_id}</bdi></button>)}</div>}
                <div className="se-owner-selected"><span className="se-owner-avatar"><User size={23} /></span><div><strong>{ownerUserId === null ? "مالک تعیین نشده" : "حساب مالک انتخاب شده"}</strong><p>{ownerUserId === null ? "این کسب‌وکار می‌تواند بدون مالک ثبت شود." : "شناسهٔ کاربر: " + ownerUserId}</p></div>{ownerUserId !== null && <button type="button" className="se-button se-button--quiet" onClick={() => setOwnerUserId(null)}><X size={15} />حذف</button>}</div>
                <div className="se-switch-row"><div><strong>اجازهٔ نمایش فرد مرتبط</strong><p>نمایش عمومی فقط با اجازهٔ خود فرد برای این کسب‌وکار و عمومی بودن پروفایل او انجام می‌شود.</p></div><Switch checked={showOwner} onCheckedChange={setShowOwner} aria-label="اجازه نمایش عمومی فرد مرتبط" /></div>
              </Section>
              <Section title="منبع ثبت اطلاعات" description="اختیاری؛ برای شناسایی رکوردهای واردشده از یک منبع دیگر."><div className="se-form-grid"><FieldLabel hint="منبع و شناسهٔ خارجی باید با هم تکمیل شوند.">منبع<Input dir="ltr" value={source} onChange={(event) => setSource(event.target.value)} placeholder="مثلاً atlas" /></FieldLabel><FieldLabel>شناسه در منبع<Input dir="ltr" value={externalId} onChange={(event) => setExternalId(event.target.value)} placeholder="شناسهٔ پایدار و یکتا" /></FieldLabel></div></Section>
            </>}
          </div></fieldset>
        </div>

        <aside className="se-sidebar" aria-label="انتشار و ذخیرهٔ کسب‌وکار"><section className="se-save-card"><header><span className="se-save-icon"><Store size={23} /></span><div><h2>انتشار و ذخیره</h2><p>{isNew ? "کسب‌وکار جدید" : "رکورد " + numericId}</p></div></header><label className="se-field">وضعیت انتشار<select value={status} onChange={(event) => setStatus(event.target.value as ServiceStatus)} disabled={isSaving}>{SERVICE_STATUSES.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}</select></label><p className="se-status-hint">{STATUS_HINTS[status]}</p>
          <div className="se-summary-checks"><div className={name.trim() ? "is-complete" : ""}>{name.trim() ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>نام کسب‌وکار</span></div><div className={mainCategory ? "is-complete" : ""}>{mainCategory ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>{mainCategory ? "دستهٔ اصلی: " + mainCategory : "دستهٔ اصلی تعیین نشده"}</span></div><div><Phone size={16} /><span>{contacts.filter((contact) => contact.is_visible).length.toLocaleString("fa-IR")} راه ارتباط عمومی</span></div><div><Tags size={16} /><span>{assessments.filter((value) => value !== "unknown").length.toLocaleString("fa-IR")} از ۴ ویژگی بررسی شده</span></div></div>
          {(pendingImage || removeImageRequested) && <p className="se-pending-note">{removeImageRequested ? "تصویر فعلی پس از ذخیره حذف می‌شود." : "تصویر جدید آمادهٔ بارگذاری است."}</p>}
          {localIssue && <p className="se-validation-note" role="status"><AlertCircle size={16} />{localIssue}</p>}
          <button type="button" className="se-button se-button--save" onClick={handleSave} disabled={isSaving || isStale}>{isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{isSaving ? "در حال ذخیره…" : isNew ? "ایجاد کسب‌وکار" : "ذخیرهٔ تغییرات"}</button>
          <button type="button" className="se-button se-button--cancel" disabled={isSaving} onClick={() => navigate("/services")}>بازگشت به فهرست</button>
          {loadedUpdatedAt && <p className="se-last-update">آخرین ذخیره<br />{formatDateTime(loadedUpdatedAt)}</p>}
        </section></aside>
      </div>
      <div className="se-mobile-save"><span>{STATUS_LABELS[status]}</span><button type="button" className="se-button se-button--save" onClick={handleSave} disabled={isSaving || isStale}>{isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{isSaving ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}</button></div>
    </main>
  </div>;
};

export default ServiceEditor;
