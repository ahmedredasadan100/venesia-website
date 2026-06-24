import type { ReactNode } from "react";

type AdminPaginationProps = {
  children?: ReactNode;
  className?: string;
};

type AdminPaginationButtonProps = {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export default function AdminPagination({ children, className = "" }: AdminPaginationProps) {
  return <nav className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>{children}</nav>;
}

export function AdminPaginationButton({
  children,
  active = false,
  disabled = false,
  onClick,
  className = "",
}: AdminPaginationButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-bold transition ${
        active
          ? "border-[#D8B87A]/40 bg-[#D8B87A] text-[#080B10]"
          : "border-white/10 bg-[#080B10]/70 text-white/62 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
      } ${disabled ? "cursor-not-allowed opacity-35 hover:border-white/10 hover:text-white/62" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
