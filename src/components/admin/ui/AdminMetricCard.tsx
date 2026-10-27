import type { ReactNode } from "react";
import { ADMIN_CINEMATIC_GOLD_V1, resolveAdminCollectionPresentation } from "../../../lib/admin/admin-ui-styles";

export type AdminMetricCardTone = "gold" | "blue" | "green" | "amber" | "violet" | "cyan" | "neutral" | "red";
export type AdminMetricCardArtwork = "content" | "published" | "projects" | "pages" | "media" | "taxonomy" | "unpublished" | "series" | "featured" | "seo";

export type AdminMetricCardProps = {
  label: string;
  value: number | string;
  suffix?: string;
  /** Optional explanatory copy; omitted consumers keep their existing markup. */
  description?: ReactNode;
  tone?: AdminMetricCardTone;
  align?: "center" | "start";
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
  /** Decorative semantic glyph supplied by the consumer's existing icon owner. */
  icon?: ReactNode;
  /** Compatibility sizing port; the official presentation owns current geometry. */
  iconSize?: "default" | "prominent";
  /** Omitted and legacy default resolve to the same official Admin presentation. */
  presentation?: "default" | "cinematic";
  /** Semantic color supplied by the shared Cinematic Gold palette. */
  cinematicTone?: keyof typeof ADMIN_CINEMATIC_GOLD_V1.tones;
  /** Optional decorative scene; no statistics or duplicated foreground glyph. */
  artwork?: AdminMetricCardArtwork;
};

// Lightweight line scenes belong to this existing card owner. They use the
// consumer's semantic color without another asset request, ID or animation loop.
const ARTWORK_PATHS: Record<AdminMetricCardArtwork, readonly string[]> = {
  content: [
    "M18 44 86 21l49 78-68 23Z M31 43 84 26l43 71-53 18Z M38 56l43-14 M45 68l43-14 M53 80l30-10",
    "M39 31 99 13l45 78 M58 20l59-15 42 73 M8 126c55-36 124-35 218-5",
  ],
  published: [
    "M14 113V45c28-9 46-7 71 10v68c-25-17-43-19-71-10Z M85 55c26-17 44-19 72-10v68c-28-9-46-7-72 10 M27 62c13-2 24 0 42 9 M27 78c13-2 24 0 42 9 M102 71c17-9 28-11 42-9",
    "M149 24l8-11 M168 38l14-6 M124 17l1-13 M2 131c75-14 142-8 225 5",
  ],
  projects: [
    "M17 124V65l39-17v76 M56 124V30l48-20v114 M104 124V55l37-13v82 M141 124V77l31-10v57 M10 124h174",
    "M30 78v11 M43 72v11 M70 45v12 M88 38v12 M70 68v12 M88 61v12 M70 92v12 M88 85v12 M116 70v13 M130 65v13 M116 95v13 M154 89v13 M192 126l32-16",
  ],
  pages: [
    "M30 22h63l31 31v76H30Z M93 22v31h31 M46 69h56 M46 85h56 M46 101h39",
    "M45 11h61l31 32v75 M60 2h61l30 31v73 M7 134c63-21 128-22 220-4",
  ],
  media: [
    "M10 51 126 25l21 94-116 26Z M24 66l89-20 12 55-89 20Z M34 112l21-34 28 16 16-27 24 35",
    "M151 36h40v88h-40Z M159 47h23 M159 61h23 M159 99h23 M159 113h23 M4 135c73-12 134-9 223 1",
  ],
  taxonomy: [
    "M82 19v30 M30 49h103 M30 49v26 M82 49v26 M133 49v26 M12 75h36v25H12Z M64 75h36v25H64Z M115 75h36v25h-36Z M64 1h36v18H64Z",
    "M30 100v18 M82 100v18 M133 100v18 M12 118h139 M4 136c66-9 130-6 223 1",
  ],
  unpublished: [
    "M31 21h87v112H31Z M45 41h59 M45 57h43 M45 73h59 M45 89h29 M45 105h50",
    "M102 121 151 26l16 8-49 95-19 10Z M147 35l16 8 M6 141c73-24 142-25 221-8",
  ],
  series: [
    "M13 14h64v34H13Z M46 48v19h52 M98 50h64v34H98Z M130 84v18H76 M12 102h64v34H12Z",
    "M24 26h42 M24 36h29 M109 62h42 M109 72h29 M23 114h42 M23 124h29 M175 35c25 21 29 65 6 91",
  ],
  featured: [
    "M25 126 77 17h41l51 109 M41 126 87 17 M153 126 108 17 M11 126c0-10 39-19 86-19s86 9 86 19-39 18-86 18-86-8-86-18Z",
    "M42 126c18-12 91-12 110 0 M72 8h52 M16 32l20 10 M178 32l-20 10 M8 66l23 4 M185 66l-23 4",
  ],
  seo: [
    "M17 16h97v113H17Z M31 34h66 M31 51h46 M31 68h57 M31 85h33 M31 102h42",
    "M104 89a29 29 0 1 0 58 0 29 29 0 0 0-58 0 M154 110l26 26 M119 89h28 M133 75v28 M5 139c74-13 141-11 223-1",
  ],
};

export default function AdminMetricCard({
  label,
  value,
  suffix = "",
  description,
  tone = "gold",
  className = "",
  onClick,
  active = false,
  ariaLabel,
  icon,
  presentation = "default",
  cinematicTone,
  artwork,
}: AdminMetricCardProps) {
  const Component = onClick ? "button" : "div";
  const resolvedPresentation = resolveAdminCollectionPresentation(presentation);
  if (resolvedPresentation === "cinematic") {
    const cinematic = ADMIN_CINEMATIC_GOLD_V1.metric;
    return (
      <Component
        {...(onClick
          ? {
              type: "button" as const,
              onClick,
              "aria-pressed": active,
              "aria-label": ariaLabel ?? label,
            }
          : {})}
        data-admin-metric-presentation="cinematic"
        className={[
          cinematic.surfaceClassName,
          ADMIN_CINEMATIC_GOLD_V1.tones[cinematicTone ?? tone],
          onClick ? "cursor-pointer" : "",
          active ? cinematic.activeClassName : "",
          className,
        ].filter(Boolean).join(" ")}
        dir="rtl"
      >
        {artwork ? (
          <svg
            data-admin-metric-artwork={artwork}
            className={cinematic.artworkClassName}
            viewBox="0 0 240 152"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {ARTWORK_PATHS[artwork].map((path) => <path key={path} d={path} />)}
          </svg>
        ) : null}
        <div data-admin-metric-content="" className={cinematic.contentClassName}>
          <p className={cinematic.labelClassName}>{label}</p>
          <p dir="ltr" className={cinematic.valueClassName}>
            {value}
            {suffix}
          </p>
          {description != null && description !== false ? <p data-admin-metric-description="" className={cinematic.descriptionClassName}>{description}</p> : null}
        </div>
        {icon ? (
          <span data-admin-metric-icon="" aria-hidden="true" className={cinematic.iconClassName}>
            {icon}
          </span>
        ) : null}
      </Component>
    );
  }
}
