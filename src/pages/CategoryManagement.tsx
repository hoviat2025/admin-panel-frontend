import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, Folder, FolderOpen, GitBranch, Info, Layers3, Loader2, Pencil, Plus, RefreshCw, Search, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createCategory, fetchCategories, updateCategory } from "@/lib/serviceApi";
import type { Category } from "@/types/service";
import "./category-management.css";

type CategoryForm = { id: number | null; name: string; slug: string; level: 1 | 2; parent_ids: number[]; parent_id: number | null; description: string; display_order: string; is_active: boolean };
type TreeRow = { category: Category; depth: number; ancestors: number[]; path: string; childCount: number };
type StatusFilter = "all" | "active" | "inactive";
const emptyForm: CategoryForm = { id: null, name: "", slug: "", level: 1, parent_ids: [], parent_id: null, description: "", display_order: "0", is_active: true };
const parentsOf = (category: Category) => category.parent_ids ?? (category.parent_id === null ? [] : [category.parent_id]);
const isMainCategory = (category: Category) => category.level ? category.level === 1 : parentsOf(category).length === 0;
const suggestSlug = (value: string) => value.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
const normalizeSearch = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f\u064b-\u065f]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
const number = (value: number) => value.toLocaleString("fa-IR");

const CategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [changingStatus, setChangingStatus] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const initializedGroups = useRef(false);
  const isBusy = isLoading || isSaving || changingStatus !== null;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const next = await fetchCategories(true);
      setCategories(next);
      if (!initializedGroups.current) {
        setCollapsed(new Set(next.filter(isMainCategory).map((category) => category.id)));
        initializedGroups.current = true;
      }
      setSelectedId((current) => next.some((item) => item.id === current) ? current : next.find(isMainCategory)?.id ?? next[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "دریافت دسته‌بندی‌ها ناموفق بود.");
    } finally { setIsLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const ordered = [...categories].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
    const roots = ordered.filter(isMainCategory);
    const rows: TreeRow[] = [];
    roots.forEach((root) => {
      const children = ordered.filter((child) => !isMainCategory(child) && parentsOf(child).includes(root.id));
      rows.push({ category: root, depth: 0, ancestors: [], path: root.name, childCount: children.length });
      // A single shared subcategory is shown beneath every assigned main group.
      children.forEach((child) => rows.push({ category: child, depth: 1, ancestors: [root.id], path: `${root.name} / ${child.name}`, childCount: 0 }));
    });
    // Preserve inspectability of legacy orphan data while the hierarchy is repaired.
    ordered.filter((category) => !rows.some((row) => row.category.id === category.id)).forEach((category) => rows.push({ category, depth: 0, ancestors: [], path: category.name, childCount: 0 }));
    return rows;
  }, [categories]);

  const selected = tree.find((row) => row.category.id === selectedId);
  const activeCount = categories.filter((category) => category.is_active).length;
  const isFiltering = Boolean(query.trim() || statusFilter !== "all");
  const matches = useMemo(() => new Set(tree.filter(({ category }) => {
    const statusMatches = statusFilter === "all" || category.is_active === (statusFilter === "active");
    return statusMatches && normalizeSearch(`${category.name} ${category.slug} ${category.description ?? ""}`).includes(normalizeSearch(query.trim()));
  }).map(({ category }) => category.id)), [tree, query, statusFilter]);
  const visibleRows = useMemo(() => {
    if (!isFiltering) return tree.filter((row) => row.ancestors.every((id) => !collapsed.has(id)));
    const visible = new Set(matches);
    tree.forEach((row) => { if (matches.has(row.category.id)) row.ancestors.forEach((id) => visible.add(id)); });
    return tree.filter((row) => visible.has(row.category.id));
  }, [tree, isFiltering, matches, collapsed]);
  const parentOptions = categories.filter((category) => isMainCategory(category) && category.id !== form.id).sort((a, b) => a.display_order - b.display_order || a.id - b.id);
  const editedHasChildren = form.id !== null && categories.some((category) => parentsOf(category).includes(form.id as number));

  const openCreate = (parentId: number | null = null) => {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setForm({ ...emptyForm, level: parentId === null ? 1 : 2, parent_ids: parentId === null ? [] : [parentId], parent_id: parentId }); setSlugEdited(false); setFormError(""); setIsFormOpen(true);
  };
  const openEdit = (category: Category) => {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(category.id);
    setForm({ ...category, level: isMainCategory(category) ? 1 : 2, parent_ids: [...parentsOf(category)], description: category.description ?? "", display_order: String(category.display_order) });
    setSlugEdited(true); setFormError(""); setIsFormOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const slug = form.slug.trim() || (form.id === null ? suggestSlug(form.name) : "");
    if (!form.name.trim()) { setFormError("نام دسته‌بندی را وارد کنید."); return; }
    if (!slug) { setFormError("یک شناسهٔ آدرس لاتین وارد کنید؛ مثلاً health-services."); return; }
    if (form.level === 2 && !form.parent_ids.length) { setFormError("برای زیر‌دسته، دست‌کم یک دستهٔ اصلی انتخاب کنید."); return; }
    if (form.display_order.trim() === "" || !Number.isSafeInteger(Number(form.display_order))) { setFormError("ترتیب نمایش باید یک عدد صحیح باشد."); return; }
    setIsSaving(true); setFormError("");
    try {
      const rootIds = form.level === 1 ? [] : form.parent_ids;
      const payload = { name: form.name.trim(), slug, level: form.level, parent_ids: rootIds, parent_id: rootIds.includes(form.parent_id as number) ? form.parent_id : rootIds[0] ?? null, description: form.description.trim() || null, display_order: Number(form.display_order), is_active: form.is_active };
      const saved = form.id === null ? await createCategory(payload) : await updateCategory(form.id, payload);
      setCategories((current) => [...current.filter((item) => item.id !== saved.id), saved]); setSelectedId(saved.id);
      setCollapsed((current) => {
        const next = new Set(current);
        parentsOf(saved).forEach((id) => next.delete(id));
        return next;
      });
      setIsFormOpen(false);
      toast({ title: form.id === null ? "دسته‌بندی ایجاد شد" : "دسته‌بندی به‌روزرسانی شد", description: saved.name });
      await load();
    } catch (error) { setFormError(error instanceof Error ? error.message : "ذخیره دسته‌بندی ناموفق بود."); }
    finally { setIsSaving(false); }
  };

  const toggleActive = async (category: Category) => {
    if (isBusy) return;
    setChangingStatus(category.id);
    try {
      const saved = await updateCategory(category.id, { is_active: !category.is_active });
      setCategories((current) => current.map((item) => item.id === saved.id ? saved : item));
      toast({ title: saved.is_active ? "دسته‌بندی فعال شد" : "دسته‌بندی غیرفعال شد", description: saved.name });
    } catch (error) { toast({ variant: "destructive", title: "تغییر وضعیت انجام نشد", description: error instanceof Error ? error.message : "دوباره تلاش کنید." }); }
    finally { setChangingStatus(null); }
  };

  return <div className="category-workspace">
    <Header />
    <main className="category-main">
      <header className="category-heading">
        <div className="category-heading__copy"><div className="category-heading__eyebrow"><span><Layers3 size={18} /></span>ساختار فهرست خدمات</div><h2>مدیریت دسته‌بندی‌ها</h2><p>گروه را باز کنید تا دسته‌های آن را ببینید. فقط دسته‌های سطح دوم به کسب‌وکار اختصاص داده می‌شوند.</p></div>
        <div className="category-heading__actions"><Link to="/services" className="category-services-link">فهرست سرویس‌ها <ArrowLeft size={16} /></Link><Button variant="gold" onClick={() => openCreate()} disabled={isBusy}><Plus size={18} />گروه جدید</Button></div>
      </header>
      {loadError && <div className="category-load-error" role="alert"><Info size={19} /><p>{loadError}</p><Button variant="outline" size="sm" onClick={load} disabled={isLoading}>تلاش دوباره</Button></div>}
      <div className="category-layout">
        <section className="category-tree-panel" aria-labelledby="category-tree-title">
          <div className="category-tree-panel__heading"><div><h3 id="category-tree-title"><GitBranch size={19} />گروه‌ها و دسته‌ها</h3><p>{number(categories.length)} دسته در {number(tree.filter((row) => row.depth === 0).length)} گروه اصلی</p></div><button type="button" className="category-icon-button" onClick={load} disabled={isLoading || changingStatus !== null} aria-label="دریافت دوباره دسته‌بندی‌ها"><RefreshCw size={18} className={isLoading ? "animate-spin" : ""} /></button></div>
          <div className="category-toolbar"><label className="category-search"><Search size={18} /><span className="sr-only">جستجوی دسته‌بندی</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو با نام، شناسه یا توضیحات…" />{query && <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جستجو"><X size={15} /></button>}</label><div className="category-toolbar__bottom"><div className="category-filters" aria-label="فیلتر وضعیت">{([{ value: "all", label: "همه", count: categories.length }, { value: "active", label: "فعال", count: activeCount }, { value: "inactive", label: "غیرفعال", count: categories.length - activeCount }] as const).map((filter) => <button type="button" key={filter.value} className={statusFilter === filter.value ? "is-active" : ""} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}>{filter.label}<span>{number(filter.count)}</span></button>)}</div><button type="button" className="category-collapse" disabled={isFiltering || tree.every((row) => row.childCount === 0)} onClick={() => setCollapsed((current) => current.size ? new Set() : new Set(tree.filter((row) => row.childCount > 0).map((row) => row.category.id)))}>{collapsed.size ? "باز کردن همه" : "جمع‌کردن همه"}</button></div></div>
          {isLoading && categories.length === 0 ? <div className="category-empty" role="status"><Loader2 className="animate-spin" size={30} /><h4>در حال دریافت دسته‌بندی‌ها</h4></div>
            : categories.length === 0 && !loadError ? <div className="category-empty"><span className="category-empty__icon"><Folder size={32} /></span><h4>ساختار فهرست را بسازید</h4><p>اولین دسته را اضافه کنید؛ سپس خدمات مرتبط را به‌صورت زیر‌دسته مرتب کنید.</p><Button variant="gold" onClick={() => openCreate()}><Plus size={17} />افزودن اولین دسته</Button></div>
              : categories.length > 0 && visibleRows.length === 0 ? <div className="category-empty"><Search size={29} /><h4>دسته‌ای پیدا نشد</h4><p>نام دیگری جستجو کنید یا فیلتر وضعیت را تغییر دهید.</p><Button variant="outline" onClick={() => { setQuery(""); setStatusFilter("all"); }}>پاک کردن فیلترها</Button></div>
                : <><div className="category-tree-list" aria-label="دسته‌های اصلی و زیر‌دسته‌ها">{visibleRows.map(({ category, depth, childCount, ancestors }) => <div key={[...ancestors, category.id].join("-")} className={["category-tree-row", selectedId === category.id ? "is-selected" : "", isFiltering && !matches.has(category.id) ? "is-context" : ""].join(" ")} style={{ marginInlineStart: depth * 17 }}>
                  <button type="button" className="category-branch-toggle" disabled={!childCount || isFiltering} aria-label={collapsed.has(category.id) && !isFiltering ? `باز کردن زیر‌دسته‌های ${category.name}` : `جمع کردن زیر‌دسته‌های ${category.name}`} aria-expanded={childCount > 0 ? isFiltering || !collapsed.has(category.id) : undefined} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(category.id)) next.delete(category.id); else next.add(category.id); return next; })}>{childCount > 0 ? collapsed.has(category.id) && !isFiltering ? <ChevronLeft size={16} /> : <ChevronDown size={16} /> : <span className="category-leaf-dot" />}</button>
                  <button type="button" className="category-row-select" aria-pressed={selectedId === category.id} onClick={() => {
                    setSelectedId(category.id);
                    if (isMainCategory(category) && !isFiltering) setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(category.id)) next.delete(category.id); else next.add(category.id);
                      return next;
                    });
                  }}><span className="category-row-icon">{isMainCategory(category) ? <FolderOpen size={19} /> : <Tag size={18} />}</span><span className="category-row-copy"><span className="category-row-name" title={category.name}>{category.name}</span><span className="category-row-slug" dir="ltr">{category.slug}</span></span><span className="category-row-meta">{childCount > 0 && <span className="category-child-count">{number(childCount)} زیر‌دسته</span>}{parentsOf(category).length > 1 && <span className="category-shared">در {number(parentsOf(category).length)} گروه</span>}<span className={category.is_active ? "category-status category-status--active" : "category-status"}><i />{category.is_active ? "فعال" : "غیرفعال"}</span></span></button>
                  <button type="button" className="category-row-edit" onClick={() => openEdit(category)} disabled={isBusy} aria-label={`ویرایش ${category.name}`}><Pencil size={15} /></button>
                </div>)}</div>{isFiltering && <p className="category-search-summary">{number(matches.size)} نتیجه؛ دسته‌های والد برای نمایش مسیر حفظ شده‌اند.</p>}</>}
        </section>
        <aside className="category-details" aria-label="جزئیات دسته‌بندی انتخاب‌شده">
          {selected ? <>
            <div className="category-details__top"><span className="category-details__icon"><FolderOpen size={27} /></span><span className={selected.category.is_active ? "category-status category-status--active" : "category-status"}><i />{selected.category.is_active ? "فعال" : "غیرفعال"}</span></div>
            <p className="category-details__eyebrow">دستهٔ انتخاب‌شده</p><h3>{selected.category.name}</h3><p className="category-details__slug" dir="ltr">{selected.category.slug}</p>
            <div className="category-details__path"><span>{isMainCategory(selected.category) ? "دستهٔ اصلی" : "گروه‌های اصلی این زیر‌دسته"}</span><p>{isMainCategory(selected.category) ? selected.category.name : parentsOf(selected.category).map((id) => categories.find((category) => category.id === id)?.name ?? number(id)).join("، ")}</p></div><p className="category-details__description">{selected.category.description || "هنوز توضیحی برای این دسته ثبت نشده است."}</p>
            <dl className="category-details__facts"><div><dt>زیر‌دسته‌های مستقیم</dt><dd>{number(selected.childCount)}</dd></div><div><dt>ترتیب نمایش</dt><dd>{number(selected.category.display_order)}</dd></div><div><dt>شناسه دسته‌بندی</dt><dd dir="ltr">#{selected.category.id}</dd></div></dl>
            <div className="category-details__visibility"><div><b>فعال بودن دسته‌بندی</b><p>دسته‌های کنارگذاشته‌شده را غیرفعال کنید.</p></div>{changingStatus === selected.category.id ? <Loader2 className="animate-spin" size={19} /> : <Switch dir="ltr" checked={selected.category.is_active} disabled={isBusy} onCheckedChange={() => toggleActive(selected.category)} aria-label={`فعال بودن ${selected.category.name}`} />}</div>
            <div className="category-details__actions"><Button variant="default" onClick={() => openEdit(selected.category)} disabled={isBusy}><Pencil size={16} />ویرایش دسته‌بندی</Button>{isMainCategory(selected.category) && <Button variant="outline" onClick={() => openCreate(selected.category.id)} disabled={isBusy}><Plus size={16} />افزودن زیر‌دسته</Button>}</div>
          </> : <div className="category-details__placeholder"><GitBranch size={34} /><h3>یک دسته را انتخاب کنید</h3><p>جزئیات، وضعیت و مسیر دسته‌بندی در این بخش نمایش داده می‌شود.</p></div>}
          <div className="category-guidance"><Info size={16} /><p>فهرست دو سطح دارد: گروه و دستهٔ خدمات. یک زیر‌دستهٔ مشترک را به چند گروه اضافه کنید؛ نیازی به ساخت نسخه‌های تکراری نیست.</p></div>
        </aside>
      </div>
    </main>
    <Dialog.Root open={isFormOpen} onOpenChange={(open) => { if (!isSaving) setIsFormOpen(open); }}><Dialog.Portal><Dialog.Overlay className="category-editor-overlay" /><Dialog.Content className="category-editor" dir="rtl" onOpenAutoFocus={(event) => { event.preventDefault(); document.getElementById("category-name")?.focus(); }} onCloseAutoFocus={(event) => { event.preventDefault(); if (editorTrigger.current?.isConnected) editorTrigger.current.focus(); }} onEscapeKeyDown={(event) => { if (isSaving) event.preventDefault(); }} onPointerDownOutside={(event) => { if (isSaving) event.preventDefault(); }}>
      <div className="category-editor__header"><span className="category-editor__icon"><Tag size={23} /></span><div><Dialog.Title>{form.id === null ? "دسته‌بندی جدید" : "ویرایش دسته‌بندی"}</Dialog.Title><Dialog.Description>نام، جایگاه و وضعیت این دسته را تنظیم کنید.</Dialog.Description></div><Dialog.Close asChild><button type="button" className="category-icon-button" disabled={isSaving} aria-label="بستن ویرایشگر"><X size={19} /></button></Dialog.Close></div>
      <form onSubmit={handleSave} className="category-editor__form"><div className="category-editor__body"><fieldset disabled={isSaving}>
        <section className="category-editor__section"><h4><Tag size={16} />اطلاعات دسته‌بندی</h4><label htmlFor="category-name">نام دسته‌بندی<span className="category-required">الزامی</span></label><Input id="category-name" value={form.name} maxLength={200} placeholder="مثلاً خدمات سلامت" onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value, slug: previous.id === null && !slugEdited ? suggestSlug(event.target.value) : previous.slug }))} />
          <label htmlFor="category-slug">شناسهٔ آدرس (slug)<span className="category-required">الزامی</span></label><Input id="category-slug" dir="ltr" value={form.slug} maxLength={200} placeholder="health-services" onChange={(event) => { setSlugEdited(true); setForm((previous) => ({ ...previous, slug: event.target.value })); }} /><p className="category-field-hint">یک شناسهٔ لاتین و یکتا؛ مانند health-services. برای نام فارسی، شناسه را جداگانه وارد کنید.</p>
          <label htmlFor="category-description">توضیحات<span className="category-optional">اختیاری</span></label><Textarea id="category-description" value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={3} placeholder="چه خدماتی در این دسته قرار می‌گیرند؟" />
        </section>
        <section className="category-editor__section"><h4><GitBranch size={17} />جایگاه در فهرست</h4><fieldset className="category-level-options"><legend>سطح دسته‌بندی</legend><label><input type="radio" name="category-level" checked={form.level === 1} onChange={() => setForm((previous) => ({ ...previous, level: 1, parent_ids: [], parent_id: null }))} />دستهٔ اصلی</label><label><input type="radio" name="category-level" checked={form.level === 2} disabled={editedHasChildren} onChange={() => setForm((previous) => ({ ...previous, level: 2 }))} />زیر‌دسته</label></fieldset>
          {editedHasChildren && <p className="category-field-hint">این دسته زیر‌دسته دارد؛ برای تبدیل آن به زیر‌دسته ابتدا جایگاه زیر‌دسته‌هایش را تغییر دهید.</p>}
          {form.level === 2 && <fieldset className="category-parent-options"><legend>گروه‌های اصلی <span>یک یا چند گروه</span></legend>{parentOptions.map((category) => <label key={category.id}><input type="checkbox" checked={form.parent_ids.includes(category.id)} onChange={() => setForm((previous) => {
            const ids = previous.parent_ids.includes(category.id) ? previous.parent_ids.filter((id) => id !== category.id) : [...previous.parent_ids, category.id];
            return { ...previous, parent_ids: ids, parent_id: ids.includes(previous.parent_id as number) ? previous.parent_id : ids[0] ?? null };
          })} /><span>{category.name}{!category.is_active && <small>غیرفعال</small>}</span></label>)}{parentOptions.length === 0 && <p className="category-field-hint">ابتدا یک دستهٔ اصلی بسازید.</p>}</fieldset>}
          <p className="category-field-hint">{form.level === 1 ? "دسته‌های اصلی بالاترین سطح فهرست‌اند." : "این زیر‌دسته زیر هر گروه انتخاب‌شده نمایش داده می‌شود."}</p>
          <label htmlFor="category-order">ترتیب نمایش</label><Input id="category-order" type="number" step={1} dir="ltr" value={form.display_order} onChange={(event) => setForm((previous) => ({ ...previous, display_order: event.target.value }))} /><p className="category-field-hint">عدد کمتر، جایگاه بالاتر میان دسته‌های هم‌سطح.</p>
        </section>
        <section className="category-editor__section category-editor__activation"><div><h4>وضعیت دسته‌بندی</h4><p>این دسته {form.is_active ? "فعال" : "غیرفعال"} ذخیره می‌شود.</p></div><Switch dir="ltr" checked={form.is_active} onCheckedChange={(checked) => setForm((previous) => ({ ...previous, is_active: checked }))} aria-label="فعال بودن دسته‌بندی" disabled={isSaving} /></section>
      </fieldset>{formError && <p className="category-form-error" role="alert"><Info size={17} />{formError}</p>}</div>
        <div className="category-editor__footer"><Button variant="gold" type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin" size={17} /> : <Check size={17} />}{isSaving ? "در حال ذخیره…" : form.id === null ? "ایجاد دسته‌بندی" : "ذخیره تغییرات"}</Button><Button variant="outline" type="button" disabled={isSaving} onClick={() => setIsFormOpen(false)}>انصراف</Button></div>
      </form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
};
export default CategoryManagement;
