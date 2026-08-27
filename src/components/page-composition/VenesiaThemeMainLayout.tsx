import type { ReactNode } from "react";

import {
  buildVenesiaThemeMainLayoutRows,
  type VenisiaThemeMainLayoutVariant,
} from "./venisia-theme-main-layout-plan";

export type VenisiaThemeMainLayoutItem = {
  key: string;
  node: ReactNode;
};

type VenisiaThemeMainLayoutProps = {
  items: readonly VenisiaThemeMainLayoutItem[];
  variant: VenisiaThemeMainLayoutVariant;
};

/**
 * Venisia Theme geometry for content inside the semantic Main Region.
 *
 * One item always resolves to a full-width row. Two items may resolve to two
 * content columns. Each resulting cell becomes the nearest slot-module
 * container so the Module adapts to its real available width.
 */
export default function VenisiaThemeMainLayout({
  items,
  variant,
}: VenisiaThemeMainLayoutProps) {
  const rows = buildVenesiaThemeMainLayoutRows(
    items.map((item) => ({ key: item.key, value: item.node })),
    variant,
  );

  if (!rows.length) return null;

  return (
    <div
      className="grid gap-10"
      data-theme-main-layout={variant}
      data-theme-main-layout-row-count={rows.length}
    >
      {rows.map((row) => (
        <div
          key={row.key}
          className={
            row.variant === "two-content-columns"
              ? "grid min-w-0 gap-8 @3xl/slot-module:grid-cols-[0.95fr_1.05fr]"
              : "grid min-w-0 grid-cols-1"
          }
          data-theme-main-layout-row={row.variant}
        >
          {row.items.map((item, index) => (
            <div
              key={item.key}
              className="@container/slot-module min-w-0"
              data-theme-main-layout-column={
                row.variant === "two-content-columns" ? index + 1 : "full"
              }
            >
              {item.value}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
