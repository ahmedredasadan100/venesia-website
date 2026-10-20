import AdminMetricCard, { type AdminMetricCardProps, type AdminMetricCardTone } from "./AdminMetricCard";

export type AdminMetricCardsGridItem = {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: AdminMetricCardTone;
  align?: "center" | "start";
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  ariaLabel?: string;
  icon?: AdminMetricCardProps["icon"];
};

export type AdminMetricCardsGridProps = {
  items: AdminMetricCardsGridItem[];
  className?: string;
};

const GRID_CLASSES = "grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr))]";
const VISUAL_BLEED_VIEWPORT_CLASSES = "-mt-8 min-w-0 pt-8";

export default function AdminMetricCardsGrid({ items, className = "" }: AdminMetricCardsGridProps) {
  return (
    <div
      className={VISUAL_BLEED_VIEWPORT_CLASSES}
      data-admin-metric-cards-viewport=""
    >
      <section className={className ? `${GRID_CLASSES} ${className}` : GRID_CLASSES}>
        {items.map((item) => (
          <AdminMetricCard key={item.label} {...item} />
        ))}
      </section>
    </div>
  );
}
