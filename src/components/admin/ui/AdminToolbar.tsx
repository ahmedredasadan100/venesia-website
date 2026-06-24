import type { ReactNode } from "react";

type AdminToolbarProps = {
  children?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export default function AdminToolbar({ children, meta, className = "" }: AdminToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {meta ? <div className="text-sm text-white/48">{meta}</div> : null}
    </div>
  );
}
