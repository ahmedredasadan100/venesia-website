type AdminNoticeVariant = "success" | "warning" | "danger" | "info";

type AdminNoticeProps = {
  title?: string;
  message: string;
  variant?: AdminNoticeVariant;
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
}: AdminNoticeProps) {
  return (
    <div
      className={`rounded-[22px] border px-5 py-4 ${variantClasses[variant]}`}
    >
      {title ? <p className="text-sm font-semibold">{title}</p> : null}

      <p className={title ? "mt-1 text-sm leading-7" : "text-sm leading-7"}>
        {message}
      </p>
    </div>
  );
}