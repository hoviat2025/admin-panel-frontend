import { ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import "./glass-modal.css";

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

/** Native modal supplies an inert background, focus containment and Escape. */
export const GlassModal = ({ isOpen, onClose, children, title }: GlassModalProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!isOpen || !dialog.current) return;
    const element = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isOpen]);
  return <dialog ref={dialog} className="admin-glass-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className="admin-glass-dialog__header"><h2 id={titleId}>{title || "جزئیات"}</h2><button type="button" aria-label="بستن" onClick={onClose}><X size={20} /></button></header>
    <div className="admin-glass-dialog__body">{isOpen && children}</div>
  </dialog>;
};
