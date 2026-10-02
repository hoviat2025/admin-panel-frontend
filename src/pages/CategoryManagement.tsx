import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassBox } from "@/components/GlassBox";
import { GlassModal } from "@/components/GlassModal";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createCategory,
  fetchCategories,
  updateCategory,
} from "@/lib/serviceApi";
import { Category } from "@/types/service";

/**
 * Category tree management.
 *
 * Create, rename, move under a parent, and activate/deactivate. There is no
 * delete: the backend refuses to remove a category that has children or is
 * assigned to a service (ON DELETE RESTRICT), and deactivating is the intended
 * way to retire one.
 */

type CategoryForm = {
  id: number | null;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string;
  display_order: number;
  is_active: boolean;
};

const emptyForm: CategoryForm = {
  id: null,
  name: "",
  slug: "",
  parent_id: null,
  description: "",
  display_order: 0,
  is_active: true,
};

/** Latin slug preview while typing; the backend normalises and validates it. */
const suggestSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

const CategoryManagement = () => {
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setCategories(await fetchCategories(true));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: error instanceof Error ? error.message : "دریافت دسته‌بندی‌ها ناموفق بود.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  /** Depth-annotated tree; a category whose parent is missing is shown at root. */
  const tree = useMemo(() => {
    const known = new Set(categories.map((category) => category.id));
    const byParent = new Map<number | null, Category[]>();
    categories.forEach((category) => {
      const key = category.parent_id !== null && known.has(category.parent_id) ? category.parent_id : null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(category);
      byParent.set(key, bucket);
    });
    byParent.forEach((bucket) =>
      bucket.sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    );

    const rows: Array<{ category: Category; depth: number; childCount: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      (byParent.get(parentId) ?? []).forEach((category) => {
        rows.push({
          category,
          depth,
          childCount: (byParent.get(category.id) ?? []).length,
        });
        walk(category.id, depth + 1);
      });
    };
    walk(null, 0);
    return rows;
  }, [categories]);

  const openCreate = () => {
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (category: Category) => {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent_id,
      description: category.description ?? "",
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "بررسی فرم", description: "نام الزامی است." });
      return;
    }

    setIsSaving(true);
    try {
      if (form.id === null) {
        await createCategory({
          name: form.name.trim(),
          slug: form.slug.trim() || suggestSlug(form.name),
          parent_id: form.parent_id,
          description: form.description.trim() || null,
          display_order: form.display_order,
          is_active: form.is_active,
        });
        toast({ title: "دسته‌بندی ایجاد شد" });
      } else {
        await updateCategory(form.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          parent_id: form.parent_id,
          description: form.description.trim() || null,
          display_order: form.display_order,
          is_active: form.is_active,
        });
        toast({ title: "دسته‌بندی به‌روزرسانی شد" });
      }
      setIsFormOpen(false);
      load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "ذخیره نشد",
        description: error instanceof Error ? error.message : "ذخیره دسته‌بندی ناموفق بود.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (category: Category, isActive: boolean) => {
    try {
      await updateCategory(category.id, { is_active: isActive });
      load();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: error instanceof Error ? error.message : "تغییر وضعیت ناموفق بود.",
      });
    }
  };

  const parentOptions = categories.filter((category) => category.id !== form.id);

  return (
    <div className="min-h-screen pb-24">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-charcoal">مدیریت دسته‌بندی‌ها</h2>
          <Button variant="gold" className="rounded-xl" onClick={openCreate}>
            <Plus className="ml-1 h-4 w-4" />
            دسته‌بندی جدید
          </Button>
        </div>

        <p className="mb-4 text-sm text-silver">
          حذف دسته‌بندی انجام نمی‌شود؛ برای کنار گذاشتن آن را غیرفعال کنید.
        </p>

        {isLoading ? (
          <div className="flex h-[40vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-gold" />
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-silver">
            <Tag className="mb-2 h-12 w-12 opacity-50" />
            <p>هنوز دسته‌بندی‌ای وجود ندارد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tree.map(({ category, depth, childCount }) => (
              <GlassBox key={category.id} className="p-3">
                <div
                  className="flex items-center justify-between gap-3"
                  style={{ paddingInlineStart: `${depth * 20}px` }}
                >
                  <div className="flex items-center gap-2">
                    <span className={category.is_active ? "text-sm font-bold text-charcoal" : "text-sm text-silver line-through"}>
                      {category.name}
                    </span>
                    <span className="text-[10px] text-silver" dir="ltr">
                      {category.slug}
                    </span>
                    {childCount > 0 && (
                      <Badge variant="outline">
                        {childCount} زیر‌دسته
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={(checked) => toggleActive(category, checked)}
                      aria-label={`فعال بودن ${category.name}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(category)}
                      aria-label={`ویرایش ${category.name}`}
                      className="rounded-full"
                    >
                      <Pencil className="h-4 w-4 text-charcoal" />
                    </Button>
                  </div>
                </div>
              </GlassBox>
            ))}
          </div>
        )}
      </main>

      <GlassModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={form.id === null ? "دسته‌بندی جدید" : "ویرایش دسته‌بندی"}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pb-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">نام</span>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                  slug: prev.id === null ? suggestSlug(event.target.value) : prev.slug,
                }))
              }
              className="rounded-xl bg-secondary/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">اسلاگ (لاتین)</span>
            <Input
              dir="ltr"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="restaurant"
              className="rounded-xl bg-secondary/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">دسته والد</span>
            <select
              value={form.parent_id ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  parent_id: event.target.value === "" ? null : Number(event.target.value),
                }))
              }
              className="h-10 w-full rounded-xl border border-silver-light/50 bg-secondary/50 px-3 text-charcoal"
            >
              <option value="">بدون والد (سطح اول)</option>
              {parentOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">توضیح</span>
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              className="rounded-xl bg-secondary/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-silver">ترتیب نمایش</span>
            <Input
              type="number"
              dir="ltr"
              value={form.display_order}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, display_order: Number(event.target.value) }))
              }
              className="rounded-xl bg-secondary/50"
            />
          </label>

          <div className="flex items-center justify-between rounded-xl border bg-secondary/30 p-3">
            <span className="text-sm text-charcoal">فعال</span>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>

          <div className="sticky bottom-0 flex gap-3 border-t bg-white/95 pt-4">
            <Button variant="gold" className="flex-1 rounded-xl" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
              ذخیره
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsFormOpen(false)}>
              انصراف
            </Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default CategoryManagement;
