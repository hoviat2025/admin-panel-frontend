import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export const GlassModal = ({
  isOpen,
  onClose,
  children,
  title,
}: GlassModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40"
      style={{ backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-lg max-h-[85vh] rounded-3xl p-6",
          "bg-white border border-white/80 shadow-2xl"
        )}
        style={{ direction: 'rtl' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          {title && (
            <h2 className="text-xl font-bold text-charcoal">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-silver-light/50 transition-colors mr-auto"
          >
            <X className="h-5 w-5 text-charcoal" />
          </button>
        </div>
        <div className="text-charcoal">
          {children}
        </div>
      </div>
    </div>
  );
};
