import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassBoxProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  intense?: boolean;
}

export const GlassBox = ({ 
  children, 
  className, 
  disabled = false, 
  onClick,
  // CHANGE THIS LINE: Default to true so it matches the Header
  intense = true
}: GlassBoxProps) => {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={cn(
        // It will now always use "glass-intense" unless you specifically say false
        intense ? "glass-intense" : "glass",
        "rounded-2xl p-6 transition-all duration-300",
        onClick && !disabled && "cursor-pointer hover:scale-[1.02] hover:shadow-lg",
        disabled && "disabled-overlay cursor-not-allowed",
        className
      )}
    >
      {children}
    </div>
  );
};