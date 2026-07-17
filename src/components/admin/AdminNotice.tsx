import Link from "next/link";

type AdminNoticeVariant = "success" | "warning" | "danger" | "info";

type AdminNoticeProps = {
  title?: string;
  message: string;
  variant?: AdminNoticeVariant;
  action?: {
    href: string;
    label: string;
  };
};

const variantClasses: Record<AdminNoticeVariant, string> = {
  success: "border-emerald-400/25 bg-emerald-400/8 text-emerald-100",
  warning: "border-[#D8B87A]/30 bg-[#D8B87A]/10 text-[#F2D99B]",
  danger: "border-red-400/25 bg-red-400/8 text-red-100",
  info: "border-white/10 bg-white/[0.04] text-white/70",
};

export default function AdminNotice({
  title,
  message,
  variant = "info",
  action,
}: AdminNoticeProps) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      aria-live={variant === "danger" ? "assertive" : "polite"}
      className={`rounded-[22px] border px-5 py-4 ${variantClasses[variant]}`}
    >
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
    </div>
  );
}