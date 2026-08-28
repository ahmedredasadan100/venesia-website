import type { CollectionContentHierarchyMode } from "./content-hierarchy";

export const COLLECTION_LAYOUTS = [
  "featured",
  "editorial",
  "mosaic",
  "grid",
  "list",
  "timeline",
  "timeline-digest",
] as const;

export const COLLECTION_CARD_VARIANTS = ["default", "compact"] as const;
export const COLLECTION_ITEMS_PER_ROW = [1, 2, 3, 4] as const;
export const COLLECTION_LISTING_LAYOUTS = ["grid", "list"] as const;
export const COLLECTION_LISTING_ITEMS_PER_ROW = [2, 3, 4] as const;

export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number];
export type CollectionCardVariant = (typeof COLLECTION_CARD_VARIANTS)[number];
export type CollectionItemsPerRow = (typeof COLLECTION_ITEMS_PER_ROW)[number];
export type CollectionListingLayout =
  (typeof COLLECTION_LISTING_LAYOUTS)[number];
export type CollectionListingItemsPerRow =
  (typeof COLLECTION_LISTING_ITEMS_PER_ROW)[number];

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
  variants: Partial<
    Record<
      CollectionLayout,
      {
        itemsPerRow: boolean;
        cardVariant: boolean;
        contentHierarchyMode: CollectionContentHierarchyMode;
      }
    >
  >;
  legacyLayoutAliases?: Readonly<Record<string, CollectionLayout>>;
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

export function getCollectionViewVariantCapabilities(
  capabilities: CollectionViewCapabilities,
  layout: CollectionLayout,
) {
  return capabilities.variants[layout] ?? {
    itemsPerRow: true,
    cardVariant: true,
    contentHierarchyMode: "uniform" as const,
  };
}

export function parseCollectionView(
  value: unknown,
  capabilities: CollectionViewCapabilities,
): CollectionView {
  const raw = isRecord(value) ? value : {};
  const requestedLayout = typeof raw.layout === "string"
    ? capabilities.legacyLayoutAliases?.[raw.layout] ?? raw.layout
    : raw.layout;
  const layout = capabilities.layouts.includes(requestedLayout as CollectionLayout)
    ? (requestedLayout as CollectionLayout)
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
