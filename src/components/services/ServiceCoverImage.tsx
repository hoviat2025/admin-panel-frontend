import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Trash2, Upload } from "lucide-react";

export default function ServiceCoverImage({ savedUrl, file, removeRequested, disabled, onChange }: {
  savedUrl: string | null;
  file: File | null;
  removeRequested: boolean;
  disabled: boolean;
  onChange: (file: File | null, remove: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const image = removeRequested ? null : preview ?? savedUrl;
  const selectFile = (next: File | undefined) => {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("تصویر باید JPEG، PNG یا WebP باشد."); return; }
    if (next.size > 5 * 1024 * 1024) { setError("حجم تصویر باید حداکثر ۵ مگابایت باشد."); return; }
    if (next.size === 0) { setError("فایل تصویر خالی است."); return; }
    setError(null);
    onChange(next, false);
  };
  return <div className="se-cover">
    <div className="se-cover__preview">
      {image && failedUrl !== image ? <img src={image} alt="پیش‌نمایش تصویر کسب‌وکار" onError={() => setFailedUrl(image)} /> : <div className="se-cover__empty"><ImagePlus size={34} strokeWidth={1.4} /><span>{image ? "پیش‌نمایش تصویر در دسترس نیست" : "تصویر کسب‌وکار"}</span><small>لوگو، نمای فروشگاه یا تصویری از خدمات</small></div>}
      {(file || removeRequested) && <span className="se-cover__pending">{removeRequested ? "حذف پس از ذخیره" : "تصویر جدید · در انتظار ذخیره"}</span>}
    </div>
    <div className="se-cover__controls">
      <div><h4>{savedUrl ? "تصویر معرفی کسب‌وکار" : "کسب‌وکار را با یک تصویر معرفی کنید"}</h4><p>JPEG، PNG یا WebP · حداکثر ۵ مگابایت</p><p>تغییر تصویر همراه با دکمهٔ ذخیره اعمال می‌شود.</p></div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} aria-label="انتخاب تصویر کسب‌وکار" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="se-image-actions"><button type="button" className="se-button se-button--outline" disabled={disabled} onClick={() => input.current?.click()}><Upload size={16} />{savedUrl || file ? "جایگزینی تصویر" : "انتخاب تصویر"}</button>
        {(file || removeRequested) && <button type="button" className="se-button se-button--quiet" disabled={disabled} onClick={() => { setError(null); onChange(null, false); }}><RotateCcw size={15} />لغو تغییر تصویر</button>}
        {savedUrl && !removeRequested && <button type="button" className="se-button se-button--danger" disabled={disabled} onClick={() => { setError(null); onChange(null, true); }}><Trash2 size={15} />حذف تصویر</button>}
        {file && !savedUrl && <button type="button" className="se-button se-button--quiet" disabled={disabled} onClick={() => onChange(null, false)}><Trash2 size={15} />حذف انتخاب</button>}
      </div>
      {error && <p className="se-field-error" role="alert">{error}</p>}
    </div>
  </div>;
}
