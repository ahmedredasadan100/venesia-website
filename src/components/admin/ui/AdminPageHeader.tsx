import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export default function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = "Admin Panel",
  meta,
  className = "",
}: AdminPageHeaderProps) {
  return (
    <section
      className={`rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
              {eyebrow}
            </p>
          ) : null}

          <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
            {title}
          </h1>

          {description ? (
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
              {description}
            </p>
          ) : null}
        </div>

        {(actions || meta) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {meta ? (
              <div className="rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/10 px-4 py-3 text-sm font-semibold text-[#D8B87A]">
                {meta}
              </div>
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
