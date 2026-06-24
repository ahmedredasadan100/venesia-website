import type { ReactNode } from "react";

type AdminInfoBarProps = {
  label: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export default function AdminInfoBar({
  label,
  description,
  meta,
  className = "",
}: AdminInfoBarProps) {
  return (
    <section
      className={`rounded-[24px] border border-white/10 bg-[#0A0D12]/82 px-5 py-4 shadow-[0_18px_70px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl ${className}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-[#D8B87A]/20 bg-[#D8B87A]/10 px-3.5 py-1.5 text-xs font-semibold text-[#D8B87A]">
            {label}
          </span>
          {description ? (
            <span className="text-sm leading-7 text-white/52">{description}</span>
          ) : null}
        </div>
        {meta ? <div className="text-sm font-semibold text-white/48">{meta}</div> : null}
      </div>
    </section>
  );
}
