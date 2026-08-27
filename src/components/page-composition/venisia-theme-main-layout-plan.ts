/**
 * Venisia Theme-only layout variants for content rendered inside Main.
 *
 * Page Composition supplies one ordered list of renderable Assignments. It
 * does not know rows, columns, CSS, or responsive behavior. The Theme may
 * regroup already-rendered content without changing Position or persistence.
 */
export const VENISIA_THEME_MAIN_LAYOUT_VARIANTS = [
  "single-column",
  "two-content-columns",
] as const;

export type VenisiaThemeMainLayoutVariant =
  (typeof VENISIA_THEME_MAIN_LAYOUT_VARIANTS)[number];

export type VenisiaThemeMainLayoutItem<T> = {
  key: string;
  value: T;
};

export type VenisiaThemeMainLayoutRow<T> = {
  key: string;
  variant: VenisiaThemeMainLayoutVariant;
  items: readonly VenisiaThemeMainLayoutItem<T>[];
};

export type VenisiaThemeMainLayoutGroup<T> = {
  key: string;
  variant: VenisiaThemeMainLayoutVariant;
  items: readonly VenisiaThemeMainLayoutItem<T>[];
};

export function buildVenesiaThemeMainLayoutGroups<T>(
  items: readonly VenisiaThemeMainLayoutItem<T>[],
  pattern: readonly VenisiaThemeMainLayoutVariant[],
): VenisiaThemeMainLayoutGroup<T>[] {
  const groups: VenisiaThemeMainLayoutGroup<T>[] = [];
  let itemIndex = 0;
  let patternIndex = 0;

  while (itemIndex < items.length) {
    const variant = pattern[patternIndex] ?? "single-column";
    const itemCount = variant === "two-content-columns" ? 2 : 1;
    const groupItems = items.slice(itemIndex, itemIndex + itemCount);
    groups.push({
      key: `group-${groups.length}-${groupItems.map((item) => item.key).join("-")}`,
      variant,
      items: groupItems,
    });
    itemIndex += groupItems.length;
    patternIndex += 1;
  }

  return groups;
}

export function buildVenesiaThemeMainLayoutRows<T>(
  items: readonly VenisiaThemeMainLayoutItem<T>[],
  variant: VenisiaThemeMainLayoutVariant,
): VenisiaThemeMainLayoutRow<T>[] {
  if (variant === "single-column") {
    return items.map((item) => ({
      key: `single-${item.key}`,
      variant: "single-column",
      items: [item],
    }));
  }

  const rows: VenisiaThemeMainLayoutRow<T>[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const rowItems = items.slice(index, index + 2);
    rows.push({
      key: `columns-${rowItems.map((item) => item.key).join("-")}`,
      variant:
        rowItems.length === 2 ? "two-content-columns" : "single-column",
      items: rowItems,
    });
  }

  return rows;
}
