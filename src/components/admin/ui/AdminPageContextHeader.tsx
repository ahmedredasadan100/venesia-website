import type { ReactNode } from "react";

export type AdminPageContextHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
  /** Optional status badge shown above the title (placeholder / draft screens). */
  badge?: ReactNode;
  /** Semantic state used by loading, error and empty experiences. */
  status?: "ready" | "loading" | "error" | "empty" | "under-construction";
  /** A restrained header for utility states while preserving the contract. */
  variant?: "default" | "minimal";
};

const SHELL_CLASSES =
  "relative overflow-hidden rounded-[34px] border border-white/10 bg-[#080B10]/78 p-4 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl md:p-5";

const SHELL_GLOW_CLASSES =
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(216,184,122,0.10),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(33,70,132,0.10),transparent_32%)]";

const ACTIONS_DOCK_CLASSES =
  "relative isolate flex flex-wrap items-center gap-3 overflow-hidden rounded-[26px] border border-white/10 bg-black/25 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl";

const ACTIONS_DOCK_GLOW_CLASSES =
  "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,rgba(216,184,122,0.10),transparent_38%),radial-gradient(circle_at_88%_20%,rgba(33,70,132,0.10),transparent_36%)]";

export default function AdminPageContextHeader({
  title,
  description,
  actions,
  eyebrow,
  meta,
  breadcrumb,
  className = "",
  badge,
  status = "ready",
  variant = "default",
}: AdminPageContextHeaderProps) {
  const hasActionsDock = Boolean(actions || meta);

  return (
    <section
      className={`${SHELL_CLASSES} ${variant === "minimal" ? "md:p-4" : ""} ${className}`.trim()}
      dir="rtl"
      data-admin-page-header
      data-admin-page-header-status={status}
      data-admin-page-header-variant={variant}
    >
      <div className={SHELL_GLOW_CLASSES} aria-hidden="true" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 lg:flex-1">
          {badge ? (
            <span className="inline-flex rounded-full border border-[var(--admin-accent)]/25 bg-[var(--admin-accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--admin-accent)]">
              {badge}
            </span>
          ) : null}

          {eyebrow ? (
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] text-[var(--admin-accent)]/70${badge ? " mt-5" : ""}`}>
              {eyebrow}
            </p>
          ) : null}

          <h1 className={`${badge ? "mt-5" : "mt-2"} text-2xl font-semibold text-white md:text-3xl break-words [text-wrap:balance]`}>
            {title}
          </h1>

          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56">{description}</p>
          ) : null}

          {breadcrumb ? (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm text-white/45">
              {breadcrumb}
            </div>
          ) : null}
        </div>

        {hasActionsDock ? (
          <div className="lg:shrink-0">
            <div className={ACTIONS_DOCK_CLASSES}>
              <div className={ACTIONS_DOCK_GLOW_CLASSES} aria-hidden="true" />
              {meta ? (
                <div className="rounded-2xl border border-[var(--admin-accent)]/20 bg-[var(--admin-accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--admin-accent)]">
                  {meta}
                </div>
              ) : null}
              {actions}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
