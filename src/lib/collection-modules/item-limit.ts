export const COLLECTION_ITEM_LIMIT_MAX = 60;

export function parseCollectionItemLimit(
  value: unknown,
  fallback: number,
  maximum = COLLECTION_ITEM_LIMIT_MAX,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}
