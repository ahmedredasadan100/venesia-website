import AdminMetricCard, { type AdminMetricCardProps, type AdminMetricCardTone } from "./AdminMetricCard";
import { ADMIN_CINEMATIC_GOLD_V1, resolveAdminCollectionPresentation } from "../../../lib/admin/admin-ui-styles";

export type AdminMetricCardsGridItem = {
  label: string;
  value: number | string;
  suffix?: string;
  description?: AdminMetricCardProps["description"];
  tone?: AdminMetricCardTone;
  align?: "center" | "start";
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
  icon?: AdminMetricCardProps["icon"];
  cinematicTone?: AdminMetricCardProps["cinematicTone"];
  artwork?: AdminMetricCardProps["artwork"];
};

export type AdminMetricCardsGridProps = {
  items: AdminMetricCardsGridItem[];
  className?: string;
  /** Omitted and legacy default use the official shared Admin KPI presentation. */
  presentation?: AdminMetricCardProps["presentation"];
  ariaLabel?: string;
};

const VISUAL_BLEED_VIEWPORT_CLASSES = "-mt-8 min-w-0 pt-8";

export default function AdminMetricCardsGrid({ items, className = "", presentation = "default", ariaLabel }: AdminMetricCardsGridProps) {
  const resolvedPresentation = resolveAdminCollectionPresentation(presentation);
  const gridClassName = ADMIN_CINEMATIC_GOLD_V1.metric.gridClassName;
  const count = Math.max(1, items.length);
  const columns = {
    "--admin-metric-cols": Math.min(2, count),
    "--admin-metric-cols-md": Math.min(3, count),
    "--admin-metric-cols-xl": Math.min(6, count),
  } as CSSProperties;
  return (
    <div
      className={VISUAL_BLEED_VIEWPORT_CLASSES}
      data-admin-metric-cards-viewport=""
    >
      <section data-admin-metric-grid-presentation={resolvedPresentation} className={className ? `${gridClassName} ${className}` : gridClassName} style={columns} aria-label={ariaLabel}>
        {items.map((item) => (
          <AdminMetricCard key={item.label} {...item} presentation={resolvedPresentation} />
        ))}
      </section>
    </div>
  );
}
import type { CSSProperties } from "react";
