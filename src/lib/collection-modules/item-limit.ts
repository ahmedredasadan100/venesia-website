export const COLLECTION_ITEM_LIMIT_MAX = 60;
export const COLLECTION_LISTING_ITEM_LIMITS = [6, 9, 12, 24] as const;
export type CollectionListingItemLimit =
  (typeof COLLECTION_LISTING_ITEM_LIMITS)[number];

export function parseCollectionItemLimit(
  value: unknown,
  fallback: number,
  maximum = COLLECTION_ITEM_LIMIT_MAX,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}
