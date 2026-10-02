import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassBox } from "@/components/GlassBox";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createService,
  fetchCategories,
  fetchService,
  saveServiceAggregate,
  searchOwnerCandidates,
} from "@/lib/serviceApi";
import {
  BUNDESLAENDER,
  CONTACT_TYPE_HINTS,
  CONTACT_TYPE_LABELS,
  DEFAULT_COUNTRY,
  PERSIAN_FLAG_OPTIONS,
  RELEVANCE_ANSWER_LABELS,
  RELEVANCE_ANSWER_OPTIONS,
  STATUS_HINTS,
  STATUS_LABELS,
  checkPublishRequirements,
  ownerLabel,
  platformLabel,
} from "@/lib/serviceDisplay";
import {
  Category,
  ContactType,
  CONTACT_TYPES,
  OwnerCandidate,
  RelevanceAnswerChoice,
  ServiceCategoryInput,
  ServiceContactInput,
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
 * Save order matters for an existing service: contacts and categories are written
 * first, then the scalar patch. Publishing is validated against the stored
 * categories, so writing them first means switching to "published" in the same
 * save works.
 */

type ContactRow = ServiceContactInput & { key: string };

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
  <GlassBox className="space-y-4 p-5">
    <div>
      <h3 className="font-bold text-charcoal">{title}</h3>
      {description && <p className="mt-1 text-xs text-silver">{description}</p>}
    </div>
    {children}
  </GlassBox>
);

const FieldLabel = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-silver">{children}</span>
    {hint && <span className="block text-[11px] text-silver">{hint}</span>}
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  /** Bundesland. Free text in the backend; the list below only suggests values. */
  const [state, setState] = useState("");
  // Germany is the normal default, so the admin does not retype it every time.
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // The four Iranian/Persian signals are independent and tri-state: an admin
  // picks unknown / yes / no, which maps to null / true / false.
  const [persianOwned, setPersianOwned] = useState<RelevanceAnswerChoice>("unknown");
  const [persianProvider, setPersianProvider] = useState<RelevanceAnswerChoice>("unknown");
  const [persianLanguage, setPersianLanguage] = useState<RelevanceAnswerChoice>("unknown");
  const [persianService, setPersianService] = useState<RelevanceAnswerChoice>("unknown");

  const [status, setStatus] = useState<ServiceStatus>("draft");

  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  const [showOwner, setShowOwner] = useState(false);
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
        setAddress(service.address ?? "");
        setPostalCode(service.postal_code ?? "");
        setCity(service.city ?? "");
        setState(service.state ?? "");
        setCountry(service.country ?? "");
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

  /* -------------------------------------------------------------- category UI */

  /** Categories ordered by their parent, so the tree reads top-down. */
  const orderedCategories = useMemo(() => {
    const byParent = new Map<number | null, Category[]>();
    categories.forEach((category) => {
      const key = category.parent_id ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(category);
      byParent.set(key, bucket);
    });
    byParent.forEach((bucket) =>
      bucket.sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    );

    const result: Array<{ category: Category; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      (byParent.get(parentId) ?? []).forEach((category) => {
        result.push({ category, depth });
        walk(category.id, depth + 1);
      });
    };
    walk(null, 0);
    // Any category whose parent is inactive/missing still needs to be selectable.
    categories
      .filter((category) => !result.some((item) => item.category.id === category.id))
      .forEach((category) => result.push({ category, depth: 0 }));
    return result;
  }, [categories]);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((previous) => {
      if (previous.includes(categoryId)) {
        if (primaryCategoryId === categoryId) setPrimaryCategoryId(null);
        return previous.filter((id) => id !== categoryId);
      }
      return [...previous, categoryId];
    });
  };

  const choosePrimary = (categoryId: number) => {
    setSelectedCategoryIds((previous) =>
      previous.includes(categoryId) ? previous : [...previous, categoryId],
    );
    setPrimaryCategoryId(categoryId);
  };

  /* -------------------------------------------------------------- contacts UI */

  const addContact = () => {
    setContacts((previous) => [
      ...previous,
      {
        key: nextKey(),
        title: "",
        type: "phone",
        value: "",
        platform: "",
        display_order: previous.length,
        is_visible: true,
      },
    ]);
  };

  const updateContact = (key: string, patch: Partial<ServiceContactInput>) => {
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
    if ((latitude === "") !== (longitude === "")) {
      return "عرض جغرافیایی و طول جغرافیایی باید با هم وارد شوند.";
    }
    if ((source.trim() === "") !== (externalId.trim() === "")) {
      return "منبع و شناسه خارجی باید با هم وارد شوند یا هر دو خالی بمانند.";
    }
    const incomplete = contacts.find(
      (row) => !row.title.trim() || !row.value.trim(),
    );
    if (incomplete) return "هر ردیف اطلاعات تماس به عنوان و مقدار نیاز دارد.";
    if (!publishCheck.ok) return publishCheck.message;
    return null;
  }, [name, latitude, longitude, source, externalId, contacts, publishCheck]);

  const buildCategoryPayload = (): ServiceCategoryInput[] =>
    selectedCategoryIds.map((categoryId) => ({
      category_id: categoryId,
      is_primary: categoryId === primaryCategoryId,
    }));

  const buildContactPayload = (): ServiceContactInput[] =>
    contacts.map((row, index) => ({
      title: row.title.trim(),
      type: row.type,
      value: row.value.trim(),
      platform: row.platform.trim() || null,
      display_order: index,
      is_visible: row.is_visible,
    }));

  const handleSave = async () => {
    if (localIssue) {
      toast({ variant: "destructive", title: "بررسی فرم", description: localIssue });
      return;
    }

    setIsSaving(true);
    try {
      const aggregate = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        postal_code: postalCode.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        country: country.trim() || null,
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

      if (isNew) {
        const created = await createService(aggregate);
        toast({ title: "سرویس ایجاد شد", description: created.name });
        navigate(`/services/${created.id}`);
        return;
      }

      /* One request for the whole aggregate: scalars, owner, show_owner,
         contacts and categories commit together or not at all. The loaded
         updated_at is mandatory and lets the backend refuse a stale save. */
      if (!loadedUpdatedAt) {
        throw new Error("this service could not be loaded, so a safe save is not possible");
      }
      const saved = await saveServiceAggregate(numericId as number, {
        ...aggregate,
        expected_updated_at: loadedUpdatedAt,
      });
      setLoadedUpdatedAt(saved.updated_at);
      setIsStale(false);
      toast({ title: "سرویس به‌روزرسانی شد" });
      navigate("/services");
    } catch (error) {
      const message = error instanceof Error ? error.message : "ذخیره سرویس ناموفق بود.";
      /* 409 means another admin saved this service since it was loaded. The
         data on screen is stale, so offer a reload rather than retrying. */
      if (/changed by someone else/i.test(message)) {
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
    return (
      <div className="min-h-screen pb-24">
        <Header />
        <div className="flex h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-gold" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h2 className="text-xl font-bold text-charcoal">
          {isNew ? "سرویس جدید" : `ویرایش سرویس #${numericId}`}
        </h2>

        {/* Shown when the save was refused because someone else changed this
            service after it was loaded. Retrying would overwrite their work. */}
        {isStale && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div>
              <p className="font-bold text-charcoal">
                این سرویس در فاصلهٔ باز کردن صفحه توسط شخص دیگری تغییر کرده است.
              </p>
              <p className="text-silver">
                برای اینکه تغییرات آن شخص بازنویسی نشود، صفحه را دوباره بارگذاری کنید و
                سپس تغییرات خود را دوباره اعمال کنید.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              بارگذاری دوباره
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------- basic */}
        <Section title="اطلاعات پایه">
          <FieldLabel>
            نام سرویس
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثلاً رستوران کاپریزه"
              className="mt-1 rounded-xl bg-secondary/50"
            />
          </FieldLabel>
          <FieldLabel>
            توضیح
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="معرفی کوتاه سرویس"
              className="mt-1 rounded-xl bg-secondary/50"
            />
          </FieldLabel>
        </Section>

        {/* ---------------------------------------------------- location */}
        <Section
          title="موقعیت"
          description="این سرویس در آلمان واقع شده است. نشانی ساختاریافته است و در جست‌وجو استفاده می‌شود."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldLabel>
              نشانی
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel>
              کد پستی
              <Input
                dir="ltr"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel>
              شهر
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="مثلاً فرانکفورت"
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel hint="ایالت آلمان. اگر در فهرست نبود می‌توانید دستی بنویسید.">
              Bundesland
              <Input
                dir="ltr"
                list="bundeslaender"
                value={state}
                onChange={(event) => setState(event.target.value)}
                placeholder="مثلاً Hessen"
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel hint="پیش‌فرض این سامانه آلمان است.">
              کشور
              <Input
                dir="ltr"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel hint="هر دو یا هیچ‌کدام.">
              عرض جغرافیایی
              <Input
                dir="ltr"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="50.1109"
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel hint="هر دو یا هیچ‌کدام.">
              طول جغرافیایی
              <Input
                dir="ltr"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="8.6821"
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
          </div>
          <datalist id="bundeslaender">
            {BUNDESLAENDER.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Section>

        {/* ------------------------------------- iranian / persian relevance */}
        <Section
          title="نشانه‌های ایرانی و فارسی"
          description="این چهار مورد مستقل هستند و هر ترکیبی مجاز است. هیچ‌کدام ربطی به محل سرویس ندارد؛ سرویس در آلمان است و این‌ها ویژگی مالک، ارائه‌دهنده، زبان یا نوع خدمت هستند. اگر چیزی را نمی‌دانید «نامشخص» را انتخاب کنید تا با «خیر» اشتباه نشود."
        >
          {PERSIAN_FLAG_OPTIONS.map((option) => {
            const item =
              option.key === "persian_owned"
                ? { label: option.label, hint: option.hint, value: persianOwned, setter: setPersianOwned }
                : option.key === "persian_provider"
                  ? { label: option.label, hint: option.hint, value: persianProvider, setter: setPersianProvider }
                  : option.key === "persian_language"
                    ? { label: option.label, hint: option.hint, value: persianLanguage, setter: setPersianLanguage }
                    : { label: option.label, hint: option.hint, value: persianService, setter: setPersianService };
            return (
              <div
                key={option.key}
                className="flex flex-col gap-3 rounded-xl border bg-secondary/30 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-charcoal">{option.label}</p>
                  <p className="mt-1 text-xs text-silver">{option.hint}</p>
                </div>
                {/* Three explicit states. A two-way switch could not express
                    "not assessed", which is the whole point of the field. */}
                <div
                  role="radiogroup"
                  aria-label={option.label}
                  className="flex shrink-0 gap-1 rounded-full bg-secondary/60 p-1"
                >
                  {RELEVANCE_ANSWER_OPTIONS.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={item.value === choice}
                      onClick={() => item.setter(choice)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        item.value === choice
                          ? "bg-white font-bold text-charcoal shadow-sm"
                          : "text-silver hover:text-charcoal"
                      }`}
                    >
                      {RELEVANCE_ANSWER_LABELS[choice]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>

        {/* --------------------------------------------------- categories */}
        <Section
          title="دسته‌بندی‌ها"
          description="یک سرویس می‌تواند چند دسته داشته باشد، اما فقط یکی می‌تواند اصلی باشد. سرویس پیش‌نویس می‌تواند بدون دسته بماند."
        >
          {orderedCategories.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-center text-xs text-silver">
              هنوز دسته‌بندی‌ای ساخته نشده است.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-2">
              {orderedCategories.map(({ category, depth }) => {
                const selected = selectedCategoryIds.includes(category.id);
                const isPrimary = primaryCategoryId === category.id;
                const retired = !category.is_active;
                /* A retired category cannot be newly assigned, but an existing
                   assignment stays visible and removable. */
                const cannotAssign = retired && !selected;
                const cannotBePrimary = retired && !isPrimary;
                return (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                      retired ? "opacity-60" : "hover:bg-secondary/40"
                    }`}
                    style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
                  >
                    <label className="flex flex-1 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={cannotAssign}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4"
                      />
                      <span className={selected ? "text-charcoal" : "text-silver"}>
                        {category.name}
                      </span>
                      {retired && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-silver">
                          {selected ? "غیرفعال (نگه داشته شده)" : "غیرفعال"}
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => choosePrimary(category.id)}
                      disabled={cannotBePrimary}
                      className={`rounded-full px-2 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${
                        isPrimary
                          ? "bg-secondary font-bold text-charcoal"
                          : "text-silver hover:bg-secondary/50"
                      }`}
                    >
                      {isPrimary ? "اصلی" : "انتخاب به‌عنوان اصلی"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-silver">
            انتخاب‌شده: {selectedCategoryIds.length} — اصلی:{" "}
            {primaryCategoryId === null
              ? "تعیین نشده"
              : categories.find((c) => c.id === primaryCategoryId)?.name ?? primaryCategoryId}
          </p>
        </Section>

        {/* ----------------------------------------------------- contacts */}
        <Section
          title="اطلاعات تماس"
          description="مدل عمومی است: هر ردیف یک روش تماس با عنوان، نوع و مقدار. چند ردیف با نوع یکسان مجاز است."
        >
          {contacts.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-center text-xs text-silver">
              ردیفی اضافه نشده است.
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map((row, index) => (
                <div key={row.key} className="rounded-xl border bg-secondary/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-silver">
                      ردیف {index + 1}
                      {row.platform && ` — ${platformLabel(row.platform)}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="انتقال به بالا"
                        onClick={() => moveContact(index, -1)}
                        disabled={index === 0}
                        className="rounded-full p-1 text-silver hover:bg-secondary disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="انتقال به پایین"
                        onClick={() => moveContact(index, 1)}
                        disabled={index === contacts.length - 1}
                        className="rounded-full p-1 text-silver hover:bg-secondary disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="حذف ردیف"
                        onClick={() => removeContact(row.key)}
                        className="rounded-full p-1 text-destructive hover:bg-secondary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      value={row.title}
                      onChange={(event) => updateContact(row.key, { title: event.target.value })}
                      placeholder="عنوان، مثلاً تلفن رزرو"
                      className="rounded-xl bg-secondary/50"
                    />
                    <select
                      value={row.type}
                      onChange={(event) =>
                        updateContact(row.key, { type: event.target.value as ContactType })
                      }
                      className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
                    >
                      {CONTACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CONTACT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={row.value}
                      onChange={(event) => updateContact(row.key, { value: event.target.value })}
                      placeholder={CONTACT_TYPE_HINTS[row.type]}
                      className="rounded-xl bg-secondary/50"
                    />
                    <Input
                      dir="ltr"
                      value={row.platform ?? ""}
                      onChange={(event) =>
                        updateContact(row.key, { platform: event.target.value })
                      }
                      placeholder="شبکه، مثلاً instagram یا telegram"
                      className="rounded-xl bg-secondary/50"
                    />
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-xs text-silver">
                    <input
                      type="checkbox"
                      checked={row.is_visible}
                      onChange={(event) =>
                        updateContact(row.key, { is_visible: event.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    در صفحه عمومی نمایش داده شود
                  </label>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" className="rounded-xl" onClick={addContact}>
            <Plus className="ml-1 h-4 w-4" />
            افزودن روش تماس
          </Button>
        </Section>

        {/* -------------------------------------------- owner / visibility */}
        <Section
          title="مالک و نمایش عمومی"
          description="مالک فقط یک اطلاعات است و به‌تنهایی هیچ دسترسی ویرایشی ایجاد نمی‌کند."
        >
          <div className="space-y-2">
            <span className="text-sm font-medium text-silver">جست‌وجوی کاربر برای مالک</span>
            <div className="flex gap-2">
              <Input
                value={ownerSearch}
                onChange={(event) => setOwnerSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runOwnerSearch();
                  }
                }}
                placeholder="نام، نام کاربری یا شناسه"
                className="rounded-xl bg-secondary/50"
              />
              <Button variant="outline" className="rounded-xl" onClick={runOwnerSearch} disabled={isSearchingOwner}>
                {isSearchingOwner ? <Loader2 className="h-4 w-4 animate-spin" /> : "جست‌وجو"}
              </Button>
            </div>

            {ownerResults.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                {ownerResults.map((candidate) => (
                  <button
                    key={candidate.user_id}
                    type="button"
                    onClick={() => {
                      setOwnerUserId(candidate.user_id);
                      setOwnerResults([]);
                      setOwnerSearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-right text-sm hover:bg-secondary/50"
                  >
                    <span className="text-charcoal">{ownerLabel(candidate)}</span>
                    <span className="text-xs text-silver" dir="ltr">
                      {candidate.user_id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-secondary/30 p-3">
            <div>
              <p className="text-sm font-medium text-charcoal">مالک فعلی</p>
              <p className="mt-1 text-xs text-silver" dir="ltr">
                {ownerUserId ?? "بدون مالک"}
              </p>
            </div>
            {ownerUserId !== null && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOwnerUserId(null)}
              >
                <X className="ml-1 h-4 w-4" />
                حذف مالک
              </Button>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border bg-secondary/30 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-charcoal">
                <User className="h-4 w-4" />
                نمایش عمومی مالک
              </p>
              <p className="mt-1 text-xs text-silver">
                پیش‌فرض خاموش است. حتی با روشن بودن، نمایش عمومی به تنظیمات حریم خصوصی خود
                کاربر هم وابسته است.
              </p>
            </div>
            <Switch checked={showOwner} onCheckedChange={setShowOwner} />
          </div>
        </Section>

        {/* --------------------------------------------- status / publish */}
        <Section title="وضعیت انتشار" description={STATUS_HINTS[status]}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SERVICE_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  status === option
                    ? "border-gold bg-secondary font-bold text-charcoal"
                    : "text-silver hover:bg-secondary/40"
                }`}
              >
                {STATUS_LABELS[option]}
              </button>
            ))}
          </div>
          {!publishCheck.ok && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {publishCheck.message}
            </p>
          )}
        </Section>

        {/* ---------------------------------------------------- provenance */}
        <Section
          title="منبع داده"
          description="برای سرویس‌های واردشده از بیرون. منبع و شناسه باید با هم وارد شوند یا هر دو خالی بمانند."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldLabel hint="مثلاً atlas یا manual">
              منبع
              <Input
                dir="ltr"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
            <FieldLabel hint="شناسه پایدار در همان منبع؛ نباید تکراری باشد.">
              شناسه خارجی
              <Input
                dir="ltr"
                value={externalId}
                onChange={(event) => setExternalId(event.target.value)}
                className="mt-1 rounded-xl bg-secondary/50"
              />
            </FieldLabel>
          </div>
        </Section>

        {localIssue && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {localIssue}
          </p>
        )}

        <div className="sticky bottom-0 flex gap-3 border-t bg-white/95 py-4">
          <Button variant="gold" className="flex-1 rounded-xl" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Save className="ml-1 h-4 w-4" />}
            ذخیره
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/services")}>
            انصراف
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ServiceEditor;
