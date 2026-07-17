import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";

type AdminActionButtonProps = {
  children: ReactNode;
  href?: string;
  disabled?: boolean;
  variant?: "gold" | "primary" | "dark" | "ghost";
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const variants: Record<NonNullable<AdminActionButtonProps["variant"]>, string> = {
  gold: "border-[#D8B87A]/30 bg-[#D8B87A]/12 text-[#D8B87A] hover:bg-[#D8B87A]/18",
  primary: "border-[#D8B87A]/30 bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]",
  dark: "border-white/10 bg-[#080B10]/70 text-white/72 hover:border-white/18 hover:bg-white/[0.05]",
  ghost: "border-transparent bg-transparent text-white/50 hover:text-white/80",
};

export default function AdminActionButton({
  children,
  href,
  disabled = false,
  variant = "dark",
  className = "",
  onClick,
}: AdminActionButtonProps) {
  const classes = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${variants[variant]} ${
    disabled ? "cursor-not-allowed opacity-45" : ""
  } ${className}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
