export type AdminMetricCardTone = "gold" | "blue" | "green" | "amber" | "violet" | "cyan";

export type AdminMetricCardProps = {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: AdminMetricCardTone;
  align?: "center" | "start";
  compact?: boolean;
  className?: string;
};

const TONE_STYLES: Record<
  AdminMetricCardTone,
  {
    accent: string;
    valueClass: string;
    hoverBorder: string;
    hoverGlow: string;
  }
> = {
  gold: {
    accent: "rgba(216,184,122,0.18)",
    valueClass: "text-[#D8B87A]",
    hoverBorder: "hover:border-[#D8B87A]/28",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(216,184,122,0.08)]",
  },
  blue: {
    accent: "rgba(56,132,255,0.18)",
    valueClass: "text-[#8BB1FF]",
    hoverBorder: "hover:border-[#4A8DFF]/28",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(56,132,255,0.10)]",
  },
  green: {
    accent: "rgba(52,211,153,0.16)",
    valueClass: "text-emerald-200",
    hoverBorder: "hover:border-emerald-400/24",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(52,211,153,0.08)]",
  },
  amber: {
    accent: "rgba(251,191,36,0.16)",
    valueClass: "text-amber-200",
    hoverBorder: "hover:border-amber-400/24",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(251,191,36,0.08)]",
  },
  violet: {
    accent: "rgba(167,139,250,0.16)",
    valueClass: "text-violet-200",
    hoverBorder: "hover:border-violet-400/24",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(167,139,250,0.08)]",
  },
  cyan: {
    accent: "rgba(34,211,238,0.14)",
    valueClass: "text-cyan-200",
    hoverBorder: "hover:border-cyan-400/22",
    hoverGlow: "hover:shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_28px_rgba(34,211,238,0.08)]",
  },
};

export default function AdminMetricCard({
  label,
  value,
  suffix = "",
  tone = "gold",
  align = "center",
  compact = false,
  className = "",
}: AdminMetricCardProps) {
  const styles = TONE_STYLES[tone];
  const alignClasses = align === "center" ? "items-center text-center" : "items-start text-right";
  const sizeClasses = compact ? "min-h-[84px] gap-1.5 px-4 py-3" : "min-h-[96px] gap-2 p-4";
  const valueSizeClass = compact ? "text-2xl" : "text-3xl";

  return (
    <div
      className={[
        "group relative isolate flex flex-col justify-center overflow-hidden rounded-[26px] border border-white/10 bg-[#080B10]/70 shadow-[0_20px_70px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1",
        sizeClasses,
        alignClasses,
        styles.hoverBorder,
        styles.hoverGlow,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-300 ease-out group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 85% 12%, ${styles.accent}, transparent 42%)` }}
        aria-hidden="true"
      />
      <p className={`font-en ${valueSizeClass} font-semibold leading-none ${styles.valueClass}`}>
        {value}
        {suffix}
      </p>
      <p className="text-sm font-semibold leading-snug text-white/62">{label}</p>
    </div>
  );
}
