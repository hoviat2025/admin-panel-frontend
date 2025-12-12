import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FloatingActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}

export const FloatingActionButton = ({
  children,
  onClick,
  className,
}: FloatingActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "gold-fab fixed bottom-6 left-6 z-40 animate-pulse-glow",
        className
      )}
    >
      {children}
    </button>
  );
};
