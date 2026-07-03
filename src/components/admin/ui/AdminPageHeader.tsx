import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
  /**
   * Layout variant.
   * - "default" (unchanged legacy layout) — identity on one side, actions/meta on the other.
   * - "context" (opt-in Page Context Header) — split identity | divider | description on top,
   *   with a dedicated Page Actions Bar docked at the bottom of the same block.
   */
  variant?: "default" | "context";
  /** Small contextual line under the title (used by the "context" variant). */
  contextLine?: ReactNode;
};

export default function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow = "Admin Panel",
  meta,
  breadcrumb,
  className = "",
  variant = "default",
  contextLine,
}: AdminPageHeaderProps) {
  if (variant === "context") {
    return (
      <section
        className={`rounded-[34px] border border-white/10 bg-[#080B10]/78 p-5 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl md:p-6 ${className}`}
        dir="rtl"
      >
        {/* Top: page identity (right) · divider (center) · description (left) */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-7">
          <div className="min-w-0 lg:flex-1">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
                {eyebrow}
              </p>
            ) : null}

            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl break-words [text-wrap:balance]">
              {title}
            </h1>

            {contextLine ? (
              <p className="mt-3 text-sm text-white/45 break-words">{contextLine}</p>
            ) : null}

            {breadcrumb ? (
              <div className="mt-4 flex items-center justify-end gap-3 text-sm text-white/45">
                {breadcrumb}
              </div>
            ) : null}
          </div>

          {description ? (
            <>
              {/* Premium subtle divider — vertical on desktop with a small diamond accent. */}
              <div className="relative hidden self-stretch bg-gradient-to-b from-transparent via-[#D8B87A]/55 to-transparent lg:flex lg:w-px lg:shrink-0 lg:items-center lg:justify-center">
                <span className="relative h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[#D8B87A]/85 shadow-[0_0_11px_rgba(216,184,122,0.55)]" />
              </div>
              {/* Mobile fallback: quiet horizontal divider. */}
              <div className="h-px w-full bg-gradient-to-l from-transparent via-[#D8B87A]/25 to-transparent lg:hidden" />

              <div className="min-w-0 lg:flex-1 lg:flex lg:items-center lg:justify-start">
                <p className="max-w-md text-sm leading-7 text-white/56">{description}</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Bottom: Page Actions Bar docked inside the same block. */}
        {(actions || meta) ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-4">
            {meta ? (
              <div className="rounded-2xl border border-[#D8B87A]/20 bg-[#D8B87A]/10 px-4 py-3 text-sm font-semibold text-[#D8B87A]">
                {meta}
              </div>
            ) : null}
            {actions}
          </div>
        ) : null}
      </section>
    );
  }

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

          {breadcrumb ? (
            <div className="mt-5 flex items-center justify-end gap-3 text-sm text-white/45">
              {breadcrumb}
            </div>
          ) : null}

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
