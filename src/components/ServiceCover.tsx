import { useState } from "react";
import { Store } from "lucide-react";

export default function ServiceCover({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  let source: string | null = null;
  try {
    const parsed = new URL(url || "");
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) source = parsed.href;
  } catch { /* Listings without an image keep the category artwork. */ }
  return source && failed !== source
    ? <img src={source} alt="" loading="lazy" decoding="async" onError={() => setFailed(source)} />
    : <Store size={28} aria-hidden="true" />;
}
