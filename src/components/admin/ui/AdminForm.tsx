import type { ReactNode } from "react";
import AdminCard from "./AdminCard";
import { AdminFormControlHeader, AdminModuleSectionHeader, AdminModuleTabIcon } from "./AdminModuleTabs";
export { AdminFormControlHeader } from "./AdminModuleTabs";
import { ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME, adminFormHintClassName, adminFormLabelClassName } from "../../../lib/admin/admin-ui-styles";

export const ADMIN_FORM_STACK_CLASS_NAME = "space-y-5";

type AdminFormLayoutProps = {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
  asideClassName?: string;
  mobileAsideFirst?: boolean;
  /** @deprecated Both values use the canonical layout; kept for existing consumers. */
  presentation?: "default" | "panel";
  /** Lets the canonical Grid compose direct cards while this owner retains the panel geometry. */
  renderGrid?: (props: { children: ReactNode; className: string }) => ReactNode;
  secondary?: ReactNode;
};

export function AdminFormLayout({
  children,
  aside,
  className = "",
  asideClassName = "",
  mobileAsideFirst = false,
  renderGrid,
  secondary,
}: AdminFormLayoutProps) {
    if (renderGrid) {
      return renderGrid({
        className: `min-w-0 gap-x-3 gap-y-3 ${aside ? "xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]" : ""} ${className}`.trim(),
        children: <>{children}{aside}{secondary ? <div className="min-w-0 xl:col-start-1">{secondary}</div> : null}</>,
      });
    }
    return (
      <section
        data-admin-form-layout="panel"
        className={`grid min-w-0 items-start gap-3 ${aside ? "xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]" : ""} ${className}`.trim()}
      >
        <div className={`min-w-0 ${ADMIN_FORM_STACK_CLASS_NAME}`}>{children}</div>
        {aside ? (
          <aside className={`min-w-0 xl:row-span-2 ${mobileAsideFirst ? "order-first xl:order-none" : ""} ${asideClassName}`.trim()}>
            {aside}
          </aside>
        ) : null}
        {secondary ? <div className="min-w-0 xl:col-start-1">{secondary}</div> : null}
      </section>
    );
}

export const ADMIN_FORM_SECTION_CLASSES =
  `relative ${ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME} min-w-0 p-3`;

/** @deprecated Module sections share the same canonical panel surface. */
export const ADMIN_FORM_MODULE_SECTION_CLASSES =
  ADMIN_FORM_SECTION_CLASSES;

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
  /** @deprecated Both values resolve to the canonical Panel owner. */
  presentation?: "default" | "panel";
  /** Neutral sections retain semantic/header ownership inside an existing visual panel. */
  surface?: "panel" | "neutral";
  header?: ReactNode;
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
  header,
  surface = "panel",
  className = "",
}: AdminFormSectionProps) {
  const hasHeader = eyebrow || title || description || actions;
  const sectionHeader = header ?? (title || eyebrow ? (
    <AdminModuleSectionHeader
      id={id ?? "admin-form-section"}
      standalone={surface === "neutral"}
      sectionHeading={title ?? eyebrow}
      sectionDescription={description || (title && eyebrow) ? <>{title && eyebrow ? <span className={eyebrowClassName}>{eyebrow}</span> : null}{description}</> : undefined}
      sectionSummary={actions}
    />
  ) : hasHeader ? (
    <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
      {description ? <p className={adminFormHintClassName({ textInset: true })}>{description}</p> : null}
      {actions}
    </div>
  ) : null);
  if (surface === "neutral") {
    return (
      <section id={id} data-admin-form-section-surface="neutral" className={`min-w-0 ${className}`.trim()}>
        {sectionHeader}
        {children}
      </section>
    );
  }
  return (
    <AdminCard id={id} className={`min-w-0 p-3 ${className}`.trim()}>
      {sectionHeader}
      {children}
    </AdminCard>
  );
}

type AdminFormFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Optional title-only presentation; field spacing and controls retain their existing contract. */
  labelClassName?: string;
  /** @deprecated Both values use the canonical field presentation. */
  presentation?: "default" | "panel";
};

export function AdminFormField({ label, hint, error, required, children, className = "", labelClassName }: AdminFormFieldProps) {
    return (
      <label data-admin-form-field="" className={`${labelClassName ?? adminFormLabelClassName({ textInset: true })} ${className}`.trim()}>
        <span data-admin-form-label-text>
          {label}{required ? <> <span className="text-red-400">*</span></> : null}
        </span>
        <div data-admin-form-field-control="" className="min-w-0">{children}</div>
        {hint ? <span className={adminFormHintClassName({ textInset: true })}>{hint}</span> : null}
        {error ? <span role="alert" className="mt-2 block text-xs font-semibold text-red-300">{error}</span> : null}
      </label>
    );
}

type AdminStickyFormBarProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminStickyFormBar({ title, description, icon = <AdminModuleTabIcon name="content" />, children, className = "" }: AdminStickyFormBarProps) {
  return (
    <div
      className={`sticky bottom-5 z-40 rounded-[26px] border border-white/10 bg-[#080B10]/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <AdminFormControlHeader title={title} description={description} icon={icon} presentation="leading-icon" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
      </div>
    </div>
  );
}
