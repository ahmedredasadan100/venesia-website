import AdminMetricCard, { type AdminMetricCardTone } from "./AdminMetricCard";

export type AdminMetricCardsGridItem = {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: AdminMetricCardTone;
  align?: "center" | "start";
  compact?: boolean;
  className?: string;
};

export type AdminMetricCardsGridProps = {
  items: AdminMetricCardsGridItem[];
  className?: string;
};

const GRID_CLASSES = "grid gap-4 md:grid-cols-6";

export default function AdminMetricCardsGrid({ items, className = "" }: AdminMetricCardsGridProps) {
  return (
    <section className={className ? `${GRID_CLASSES} ${className}` : GRID_CLASSES}>
      {items.map((item) => (
        <AdminMetricCard key={item.label} {...item} />
      ))}
    </section>
  );
}
