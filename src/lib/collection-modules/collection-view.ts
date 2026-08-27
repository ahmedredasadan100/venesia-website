export const COLLECTION_LAYOUTS = [
  "grid",
  "list",
  "timeline",
  "carousel",
] as const;

export const COLLECTION_CARD_VARIANTS = ["default", "compact"] as const;
export const COLLECTION_ITEMS_PER_ROW = [1, 2, 3, 4] as const;

export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number];
export type CollectionCardVariant = (typeof COLLECTION_CARD_VARIANTS)[number];
export type CollectionItemsPerRow = (typeof COLLECTION_ITEMS_PER_ROW)[number];

/**
 * Semantic presentation of items inside one Collection Module.
 *
 * It never describes Page Regions, Theme columns, CSS breakpoints, or visual
 * geometry. A Module chooses a supported semantic view and the active Theme
 * supplies its visual rendering.
 */
export type CollectionView = {
  layout: CollectionLayout;
  itemsPerRow: CollectionItemsPerRow;
  cardVariant: CollectionCardVariant;
};

export type CollectionViewCapabilities = {
  layouts: readonly CollectionLayout[];
  itemsPerRow: readonly CollectionItemsPerRow[];
  cardVariants: readonly CollectionCardVariant[];
  defaults: CollectionView;
};

export type CollectionViewInput = {
  layout?: unknown;
  itemsPerRow?: unknown;
  cardVariant?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
export function parseCollectionView(
  value: unknown,
  capabilities: CollectionViewCapabilities,
): CollectionView {
  const raw = isRecord(value) ? value : {};
  const layout = capabilities.layouts.includes(raw.layout as CollectionLayout)
    ? (raw.layout as CollectionLayout)
    : capabilities.defaults.layout;
  const itemsPerRow = capabilities.itemsPerRow.includes(
    raw.itemsPerRow as CollectionItemsPerRow,
  )
    ? (raw.itemsPerRow as CollectionItemsPerRow)
    : capabilities.defaults.itemsPerRow;
  const cardVariant = capabilities.cardVariants.includes(
    raw.cardVariant as CollectionCardVariant,
  )
    ? (raw.cardVariant as CollectionCardVariant)
    : capabilities.defaults.cardVariant;

  return { layout, itemsPerRow, cardVariant };
}

export function buildCollectionView(
  input: CollectionViewInput,
  capabilities: CollectionViewCapabilities,
) {
  return parseCollectionView(input, capabilities);
}
