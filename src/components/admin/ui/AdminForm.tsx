import type { ReactNode } from "react";

export const ADMIN_FORM_STACK_CLASS_NAME = "space-y-7";

type AdminFormLayoutProps = {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  asideClassName?: string;
  mobileAsideFirst?: boolean;
};

export function AdminFormLayout({
  children,
  aside,
  className = "",
  asideClassName = "",
  mobileAsideFirst = false,
}: AdminFormLayoutProps) {
  return (
    <section className={`grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px] ${className}`.trim()}>
      <div className="space-y-7">{children}</div>
      {aside ? (
        <aside
          className={`space-y-7 ${mobileAsideFirst ? "order-first xl:order-none" : ""} ${asideClassName}`.trim()}
        >
          {aside}
        </aside>
      ) : null}
    </section>
  );
}

const ADMIN_FORM_SECTION_SURFACE_CLASSES =
  "rounded-[28px] border border-white/10 bg-[#080B10]/92 shadow-[0_24px_80px_rgba(0,0,0,0.28)]";

export const ADMIN_FORM_SECTION_CLASSES =
  `${ADMIN_FORM_SECTION_SURFACE_CLASSES} p-6`;

const ADMIN_FORM_SECTION_COMPACT_CLASSES =
  `${ADMIN_FORM_SECTION_SURFACE_CLASSES} px-6 py-4`;

export const ADMIN_FORM_MODULE_SECTION_CLASSES =
  "space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5";

type AdminFormSectionProps = {
  id?: string;
  children: ReactNode;
  title?: ReactNode;
  eyebrow?: ReactNode;
  eyebrowClassName?: string;
  description?: ReactNode;
  actions?: ReactNode;
  compactHeader?: boolean;
  density?: "default" | "compact";
  variant?: "default" | "module";
  className?: string;
};

export function AdminFormSection({
  id,
  children,
  title,
  eyebrow,
  eyebrowClassName = "text-[#D8B87A]/70",
  description,
  actions,
  compactHeader = false,
  density = "default",
  variant = "default",
  className = "",
}: AdminFormSectionProps) {
  const hasHeader = eyebrow || title || description || actions;
  const sectionClassName =
    variant === "module"
      ? ADMIN_FORM_MODULE_SECTION_CLASSES
      : density === "compact"
      ? ADMIN_FORM_SECTION_COMPACT_CLASSES
      : ADMIN_FORM_SECTION_CLASSES;

  return (
    <section id={id} className={`${sectionClassName} ${className}`.trim()}>
      {hasHeader ? (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${compactHeader ? "mb-4" : "mb-6"}`}>
          <div>
            {eyebrow ? (
              <p className={`font-en text-xs tracking-[0.28em] ${eyebrowClassName}`}>{eyebrow}</p>
            ) : null}
            {title ? (
              <h2 className={`mt-2 font-semibold text-white ${compactHeader ? "text-lg font-bold" : "text-xl"}`}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-sm text-white/45">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type AdminFormFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function AdminFormField({ label, hint, error, required, children, className = "" }: AdminFormFieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="text-sm font-medium text-white/70">
        {label}
        {required ? " *" : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-white/45">{hint}</span> : null}
      <div className="mt-3">{children}</div>
      {error ? (
        <span role="alert" className="mt-2 block text-xs font-semibold text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type AdminStickyFormBarProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminStickyFormBar({ title, description, children, className = "" }: AdminStickyFormBarProps) {
  return (
    <div
      className={`sticky bottom-5 z-40 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {description ? <p className="mt-1 text-xs text-white/45">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
      </div>
    </div>
  );
}
