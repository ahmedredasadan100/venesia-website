import type { ReactNode } from "react";
import { ADMIN_CINEMATIC_GOLD_V1, resolveAdminCollectionPresentation } from "../../../lib/admin/admin-ui-styles";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "./admin-scrollbar-styles";
import { AdminModuleTabIcon, type AdminModuleTabIconName } from "./AdminModuleTabs";

export type AdminHeaderVisualPreset =
  | "dashboard" | "topics" | "categories" | "series" | "content"
  | "projects" | "construction" | "locations" | "media" | "pages"
  | "blocks" | "navigation" | "footer" | "seo" | "users"
  | "settings" | "security" | "integrations" | "reports" | "activity";

type AdminHeaderArtwork = "document" | "statistics" | "linked-content" | "hierarchy" | "construction" | "symbol";

// Explicit module functions select presentation at this existing owner. Utility
// headers may omit a preset; titles, URLs and navigation state never select one.
function resolveHeaderVisual(preset: AdminHeaderVisualPreset): { icon: AdminModuleTabIconName; artwork: AdminHeaderArtwork } {
  switch (preset) {
    case "dashboard": case "reports": return { icon: "statistics", artwork: "statistics" };
    case "topics": case "content": case "pages": return { icon: "content", artwork: "document" };
    case "categories": return { icon: "categories", artwork: "hierarchy" };
    case "series": return { icon: "link", artwork: "linked-content" };
    case "projects": return { icon: "plans", artwork: "construction" };
    case "construction": return { icon: "specifications", artwork: "construction" };
    case "locations": return { icon: "location", artwork: "symbol" };
    case "media": return { icon: "media", artwork: "symbol" };
    case "blocks": case "footer": return { icon: "section", artwork: "symbol" };
    case "navigation": return { icon: "navigation", artwork: "symbol" };
    case "seo": return { icon: "seo", artwork: "symbol" };
    case "users": return { icon: "users", artwork: "symbol" };
    case "settings": return { icon: "settings", artwork: "symbol" };
    case "security": return { icon: "security", artwork: "symbol" };
    case "integrations": return { icon: "link", artwork: "symbol" };
    case "activity": return { icon: "activity", artwork: "symbol" };
  }
}

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
  /** Utility states retain their semantic variant within the shared presentation. */
  variant?: "default" | "minimal";
  /** Both the default and the historical cinematic value use the official shared presentation. */
  presentation?: "default" | "cinematic";
  /** Action scale defaults to the header presentation; header and dock chrome stay independent. */
  actionsPresentation?: "default" | "cinematic";
  icon?: ReactNode;
  /** Explicit module identity supplies the complete shared icon/artwork pair. */
  visualPreset?: AdminHeaderVisualPreset;
  /** Optional cinematic illustration rendered by this owner, never a second header. */
  artwork?: AdminHeaderArtwork;
};

// Action owners retain their own 44px hit area, semantic role and behavior.
const CINEMATIC_ACTIONS_CONTROL_CLASSES =
  "@min-[64rem]/admin-module:[&>a]:px-3 @min-[64rem]/admin-module:[&>a]:text-xs";

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
  presentation = "default",
  actionsPresentation = presentation,
  icon,
  visualPreset,
  artwork,
}: AdminPageContextHeaderProps) {
  const hasActionsDock = Boolean(actions || meta);
  const minimal = variant === "minimal";
  const resolvedPresentation = resolveAdminCollectionPresentation(presentation);
  const resolvedActionsPresentation = resolveAdminCollectionPresentation(actionsPresentation);
  const cinematicStyles = ADMIN_CINEMATIC_GOLD_V1.module;
  const visual = visualPreset ? resolveHeaderVisual(visualPreset) : undefined;
  const resolvedIcon = icon ?? (visual ? <AdminModuleTabIcon name={visual.icon} /> : null);
  const resolvedArtwork = artwork ?? visual?.artwork;

  return (
    <section
      className={`${cinematicStyles.root} ${className}`.trim()}
      dir="rtl"
      data-admin-page-header
      data-admin-page-header-status={status}
      data-admin-page-header-variant={variant}
      data-admin-page-header-presentation={resolvedPresentation}
      data-admin-page-header-actions-presentation={resolvedActionsPresentation}
      data-admin-page-header-visual-preset={visualPreset}
    >
      <div className={cinematicStyles.light} aria-hidden="true" />
      <svg className={cinematicStyles.ribbon} data-admin-header-background-lines viewBox="0 0 1200 180" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
          <path d="M-40 175C220 225 270 80 540 112S840 218 1240 145" stroke="currentColor" strokeWidth="1.1" />
          <path d="M80 190C350 175 380 50 610 115S900 195 1180 172" stroke="currentColor" strokeWidth="0.65" opacity=".55" />
          <path d="M275 185C450 90 550 105 720 160S950 215 1240 140" stroke="currentColor" strokeWidth="5" opacity=".035" />
      </svg>
      {resolvedArtwork === "document" ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="document" aria-hidden="true">
          <svg viewBox="0 0 320 180" fill="none" focusable="false">
            <g transform="rotate(-18 160 94)">
              <rect x="95" y="31" width="113" height="142" rx="12" fill="currentColor" fillOpacity=".035" stroke="currentColor" strokeOpacity=".12" />
              <path d="M120 17h65l29 29v103a12 12 0 0 1-12 12h-82a12 12 0 0 1-12-12V29a12 12 0 0 1 12-12Z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeOpacity=".42" />
              <path d="M185 17v20a9 9 0 0 0 9 9h20" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeOpacity=".38" />
              <path d="M128 55h35M128 73h64M128 91h52M128 109h34M128 127h29" stroke="currentColor" strokeOpacity=".24" strokeWidth="6" strokeLinecap="round" />
              <path d="m154 143 6-24 47-48 13 13-47 48-19 11Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
              <path d="m160 119 13 13m27-54 13 13M154 143l11-5-6-5-5 10Z" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
            </g>
          </svg>
        </span>
      ) : resolvedArtwork === "statistics" ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="statistics" aria-hidden="true">
          <svg viewBox="0 0 320 180" fill="none" focusable="false">
            <g transform="rotate(-8 164 96)" stroke="currentColor" strokeWidth="1.5">
              <rect x="79" y="27" width="178" height="133" rx="14" fill="currentColor" fillOpacity=".035" strokeOpacity=".12" />
              <path d="M106 51v85h126" strokeOpacity=".30" strokeLinecap="round" />
              <rect x="122" y="96" width="21" height="40" rx="3" fill="currentColor" fillOpacity=".09" strokeOpacity=".30" />
              <rect x="158" y="74" width="21" height="62" rx="3" fill="currentColor" fillOpacity=".11" strokeOpacity=".36" />
              <rect x="194" y="52" width="21" height="84" rx="3" fill="currentColor" fillOpacity=".13" strokeOpacity=".42" />
              <path d="M123 147h19m17 0h19m17 0h19" strokeOpacity=".18" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
        </span>
      ) : resolvedArtwork === "linked-content" ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="linked-content" aria-hidden="true">
          <svg viewBox="0 0 320 180" fill="none" focusable="false">
            <g transform="rotate(-9 160 94)" stroke="currentColor" strokeWidth="1.5">
              <path d="M132 58h24a23 23 0 0 1 23 23v8M179 114v11a21 21 0 0 1-21 21h-22" strokeOpacity=".38" strokeWidth="3" />
              <rect x="61" y="23" width="84" height="58" rx="8" fill="currentColor" fillOpacity=".08" strokeOpacity=".36" />
              <rect x="174" y="77" width="84" height="58" rx="8" fill="currentColor" fillOpacity=".12" strokeOpacity=".46" />
              <rect x="58" y="117" width="84" height="58" rx="8" fill="currentColor" fillOpacity=".06" strokeOpacity=".28" />
              <path d="M76 41h52M76 53h36M76 65h44M189 95h52M189 107h36M189 119h44M73 135h52M73 147h36M73 159h44" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
              <circle cx="155" cy="58" r="5" fill="currentColor" fillOpacity=".12" strokeOpacity=".40" />
              <circle cx="155" cy="146" r="5" fill="currentColor" fillOpacity=".08" strokeOpacity=".30" />
            </g>
          </svg>
        </span>
      ) : resolvedArtwork === "hierarchy" ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="hierarchy" aria-hidden="true">
          <svg viewBox="0 0 320 180" fill="none" focusable="false">
            <g transform="rotate(-7 160 92)" stroke="currentColor" strokeWidth="1.5">
              <path d="M160 62v24M83 86h154M83 86v25M160 86v25M237 86v25" strokeOpacity=".32" strokeWidth="3" />
              <rect x="123" y="22" width="74" height="40" rx="7" fill="currentColor" fillOpacity=".12" strokeOpacity=".46" />
              <rect x="49" y="111" width="68" height="43" rx="7" fill="currentColor" fillOpacity=".06" strokeOpacity=".28" />
              <rect x="126" y="111" width="68" height="43" rx="7" fill="currentColor" fillOpacity=".10" strokeOpacity=".38" />
              <rect x="203" y="111" width="68" height="43" rx="7" fill="currentColor" fillOpacity=".06" strokeOpacity=".28" />
              <path d="M138 38h44M138 49h30M63 126h40M63 138h28M140 126h40M140 138h28M217 126h40M217 138h28" strokeOpacity=".23" strokeWidth="4" strokeLinecap="round" />
            </g>
          </svg>
        </span>
      ) : resolvedArtwork === "construction" ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="construction" aria-hidden="true">
          <svg viewBox="0 0 320 180" fill="none" focusable="false">
            <g transform="rotate(-7 160 94)" stroke="currentColor" strokeWidth="1.5">
              <path d="M68 146V82l44-16v80M112 146V34l58-18v130M170 146V68l43-12v90M213 146v-40l35-10v50M58 146h201" fill="currentColor" fillOpacity=".045" strokeOpacity=".35" />
              <path d="M128 49v13M152 42v13M128 77v13M152 70v13M128 105v13M152 98v13M82 98v15M99 91v15M184 84v14M201 78v14M184 113v14M201 107v14" strokeOpacity=".23" strokeWidth="4" />
              <path d="M81 164h156" strokeOpacity=".25" strokeWidth="3" />
              <circle cx="81" cy="164" r="5" fill="currentColor" fillOpacity=".18" strokeOpacity=".40" />
              <circle cx="159" cy="164" r="5" fill="currentColor" fillOpacity=".14" strokeOpacity=".35" />
              <circle cx="237" cy="164" r="5" fill="currentColor" fillOpacity=".08" strokeOpacity=".25" />
            </g>
          </svg>
        </span>
      ) : resolvedArtwork === "symbol" && resolvedIcon ? (
        <span className={cinematicStyles.watermark} data-admin-header-artwork="symbol" data-admin-header-artwork-symbol={visual?.icon ?? "custom"} aria-hidden="true">
          <span className="block size-full opacity-15 [&>svg]:size-full">{resolvedIcon}</span>
        </span>
      ) : resolvedIcon ? <span className={cinematicStyles.watermark} aria-hidden="true">{resolvedIcon}</span> : null}

      <div className={cinematicStyles.layout}>
        <div className={cinematicStyles.identity}>
          {resolvedIcon ? <span className={cinematicStyles.icon} data-admin-header-icon={visual?.icon ?? "custom"} aria-hidden="true">{resolvedIcon}</span> : null}
          <div className="min-w-0">
          {badge ? (
            <span className="inline-flex rounded-full border border-[var(--admin-accent)]/25 bg-[var(--admin-accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--admin-accent)]">
              {badge}
            </span>
          ) : null}

          {eyebrow ? (
            <p className={cinematicStyles.eyebrow}>
              {eyebrow}
            </p>
          ) : null}

          <h1 className={cinematicStyles.title} data-admin-page-header-title>
            {title}
          </h1>

          {description ? (
            <p className={cinematicStyles.description}>{description}</p>
          ) : null}

          {breadcrumb ? (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm text-white/45">
              {breadcrumb}
            </div>
          ) : null}
          </div>
        </div>

        {hasActionsDock ? (
          <div className="ms-auto min-w-0 max-w-full @min-[64rem]/admin-module:contents">
            <div
              className={`${cinematicStyles.dock} ${CINEMATIC_ACTIONS_CONTROL_CLASSES} ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`.trim()}
              data-admin-page-header-actions-dock
              role={minimal ? undefined : "region"}
              aria-label={minimal ? undefined : "إجراءات الصفحة وبياناتها"}
              tabIndex={minimal ? undefined : 0}
            >
              <div className={cinematicStyles.light} aria-hidden="true" />
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
