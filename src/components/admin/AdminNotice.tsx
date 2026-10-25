import Link from "next/link";
import type { ReactNode } from "react";
import type {
  AdminActionFeedbackAction,
  AdminFeedbackLifecycle,
  AdminFeedbackLayout,
  AdminFeedbackVariant,
} from "../../lib/admin/admin-action-feedback";
import AdminNoticeDismissibleFrame from "./AdminNoticeDismissibleFrame";

export type AdminNoticeVariant = AdminFeedbackVariant;
export type AdminNoticeLayout = AdminFeedbackLayout;

export type AdminNoticeProps = {
  title?: string;
  message: string;
  variant?: AdminNoticeVariant;
  layout?: AdminNoticeLayout;
  dismissible?: boolean;
  lifecycle?: AdminFeedbackLifecycle;
  dismissSearchParams?: readonly string[];
  action?: AdminActionFeedbackAction;
  onDismiss?: () => void;
  /** Opt-in compact status row; other notices retain their current presentation. */
  presentation?: "default" | "compact";
  /** State-specific controls and metadata in the compact status row. */
  actionContent?: ReactNode;
  /** Optional composed notice content; omitted consumers retain the message layout. */
  children?: ReactNode;
};

const variantClasses: Record<AdminNoticeVariant, string> = {
  success: "border-emerald-400/25 bg-emerald-400/8 text-emerald-100",
  warning: "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F2D99B]",
  danger: "border-red-400/25 bg-red-400/8 text-red-100",
  info: "border-white/10 bg-white/[0.04] text-white/70",
};

const inlineVariantClasses: Record<AdminNoticeVariant, string> = {
  success: "border-emerald-400/25 bg-emerald-400/8 text-emerald-300",
  warning: "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F2D99B]",
  danger: "border-red-400/25 bg-red-400/8 text-red-300",
  info: "border-sky-400/25 bg-sky-400/8 text-sky-300",
};

export default function AdminNotice({
  title,
  message,
  variant = "info",
  layout = "stacked",
  dismissible = true,
  lifecycle = "persistent",
  dismissSearchParams,
  action,
  onDismiss,
  children,
  presentation = "default",
  actionContent,
}: AdminNoticeProps) {
  const role = variant === "danger" ? "alert" : "status";
  const ariaLive = variant === "danger" ? "assertive" : "polite";
  const content = children ?? (
    layout === "inline" ? (
      <>
        {title ? (
          <p className="shrink-0 whitespace-nowrap text-sm font-bold">
            {title}
          </p>
        ) : null}
        <p
          title={message}
          className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-white/68"
        >
          {message}
        </p>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-current/20 px-4 py-1.5 text-sm font-bold transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {action.label}
          </Link>
        ) : null}
      </>
    ) : (
      <>
        {title ? <p className="text-sm font-semibold">{title}</p> : null}

        <p className={title ? "mt-1 text-sm leading-7" : "text-sm leading-7"}>
          {message}
        </p>
        {action ? (
          <Link
            href={action.href}
            className="mt-3 inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-current/20 px-4 py-2 text-sm font-bold transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {action.label}
          </Link>
        ) : null}
      </>
    ));
  const stackedClassName = `rounded-[22px] border px-5 py-4 ${variantClasses[variant]}`;
  const className =
    layout === "inline"
      ? `flex min-w-0 flex-nowrap items-center gap-3 rounded-[18px] border px-4 py-2.5 ${inlineVariantClasses[variant]}`
      : dismissible
        ? `${stackedClassName} relative pl-14`
        : stackedClassName;
  const compact = presentation === "compact";
  const compactContent = compact ? (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-2 lg:min-h-11 lg:flex-row lg:items-center lg:gap-3" data-admin-notice-row="">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg data-admin-notice-icon={variant} className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d={variant === "success" ? "m8 12 3 3 5-6" : variant === "danger" ? "m9 9 6 6m0-6-6 6" : variant === "info" ? "M12 11v5m0-9h.01" : "M12 7v6m0 4h.01"} />
          </svg>
          <p title={message} className="min-w-0 flex-1 text-sm leading-6 lg:truncate lg:whitespace-nowrap" data-admin-notice-message="">
            {title ? <strong className="me-2 font-semibold">{title}</strong> : null}{message}
          </p>
        </div>
        {actionContent || action ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap" data-admin-notice-actions="">
            {actionContent}
            {action ? <Link href={action.href} className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-current/20 px-4 py-1.5 text-sm font-bold transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">{action.label}</Link> : null}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-3 min-w-0" data-admin-notice-details="">{children}</div> : null}
    </div>
  ) : null;
  const renderedClassName = compact
    ? `grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-[22px] border px-4 py-2.5 ${variantClasses[variant]}`
    : className;

  if (dismissible) {
    return (
      <AdminNoticeDismissibleFrame
        role={role}
        ariaLive={ariaLive}
        layout={layout}
        className={renderedClassName}
        presentation={presentation}
        dismissSearchParams={dismissSearchParams}
        lifecycle={lifecycle}
        onDismiss={onDismiss}
      >
        {compact ? compactContent : content}
      </AdminNoticeDismissibleFrame>
    );
  }

  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-admin-notice-dismissible="false"
      data-admin-notice-layout={layout}
      data-admin-notice-presentation={compact ? "compact" : undefined}
      className={renderedClassName}
    >
      {compact ? compactContent : content}
    </div>
  );
}
