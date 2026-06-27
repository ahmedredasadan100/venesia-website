import type { ReactNode } from "react";

export type FooterBlockIcon = "brand" | "none" | ReactNode;

export type FooterBlockHeaderProps = {
  /** Optional section label (slot.heading / Eyebrow) */
  eyebrow?: string | null;
  /** Optional main title (e.g. text block config.title) */
  title?: string | null;
  icon?: FooterBlockIcon;
  className?: string;
  /** Admin preview uses slightly muted tones */
  variant?: "public" | "admin";
};

function BrandIcon({ variant }: { variant: "public" | "admin" }) {
  const size = variant === "admin" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/[0.06] ${size}`}
    >
      <span className="text-[#D8B87A]">◆</span>
    </div>
  );
}

function renderIcon(icon: FooterBlockIcon, variant: "public" | "admin") {
  if (icon === "none" || icon == null) return null;
  if (icon === "brand") return <BrandIcon variant={variant} />;
  return <span className="shrink-0">{icon}</span>;
}

export default function FooterBlockHeader({
  eyebrow,
  title,
  icon = "none",
  className = "",
  variant = "public",
}: FooterBlockHeaderProps) {
  const eyebrowText = eyebrow?.trim() || null;
  const titleText = title?.trim() || null;
  const iconNode = renderIcon(icon, variant);

  if (!eyebrowText && !titleText && !iconNode) return null;

  const eyebrowClass =
    variant === "admin"
      ? "text-[11px] font-medium text-[#D8B87A]/75"
      : "text-[12px] font-medium text-[#D8B87A]/80";
  const titleClass =
    variant === "admin"
      ? "text-sm font-semibold tracking-wide text-white/88"
      : "text-base font-medium tracking-wide text-white/90";

  const hasTopRow = Boolean(iconNode || eyebrowText);

  return (
    <header className={`text-right ${className}`} dir="rtl">
      {hasTopRow ? (
        <div className="flex items-center justify-start gap-3">
          {iconNode}
          {eyebrowText ? <p className={eyebrowClass}>{eyebrowText}</p> : null}
        </div>
      ) : null}

      {titleText ? (
        <h3 className={`${titleClass} ${hasTopRow ? "mt-2" : ""} w-full`}>{titleText}</h3>
      ) : null}
    </header>
  );
}
