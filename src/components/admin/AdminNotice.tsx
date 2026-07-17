import Link from "next/link";
import type {
  AdminActionFeedbackAction,
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
  action?: AdminActionFeedbackAction;
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
  dismissible = false,
  action,
}: AdminNoticeProps) {
  const role = variant === "danger" ? "alert" : "status";
  const ariaLive = variant === "danger" ? "assertive" : "polite";
  const content =
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
    );
  const stackedClassName = `rounded-[22px] border px-5 py-4 ${variantClasses[variant]}`;
  const className =
    layout === "inline"
      ? `flex min-w-0 flex-nowrap items-center gap-3 rounded-[18px] border px-4 py-2.5 ${inlineVariantClasses[variant]}`
      : dismissible
        ? `${stackedClassName} relative ps-14`
        : stackedClassName;

  if (dismissible) {
    return (
      <AdminNoticeDismissibleFrame
        role={role}
        ariaLive={ariaLive}
        layout={layout}
        className={className}
      >
        {content}
      </AdminNoticeDismissibleFrame>
    );
  }

  return (
    <div
      role={role}
      aria-live={ariaLive}
      data-admin-notice-layout={layout}
      className={className}
    >
      {content}
    </div>
  );
}