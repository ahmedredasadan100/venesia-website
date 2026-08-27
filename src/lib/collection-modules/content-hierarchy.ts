export const COLLECTION_CONTENT_HIERARCHY_MODES = [
  "uniform",
  "featured-first",
] as const;

export type CollectionContentHierarchyMode =
  (typeof COLLECTION_CONTENT_HIERARCHY_MODES)[number];

/**
 * Product semantics for the relative importance of resolved collection items.
 *
 * The contract does not choose the primary record. Each Module data resolver
 * remains responsible for that selection. It only describes how the resolved
 * primary and secondary groups should be composed.
 */
export type CollectionContentHierarchy = {
  mode: CollectionContentHierarchyMode;
  secondaryItemCount: number;
};

export type CollectionContentHierarchyCapabilities = {
  modes: readonly CollectionContentHierarchyMode[];
  defaults: CollectionContentHierarchy;
  maximumSecondaryItems?: number;
};

export type CollectionContentHierarchyInput = {
  mode?: unknown;
  secondaryItemCount?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function readPositiveInt(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

export function parseCollectionContentHierarchy(
  value: unknown,
  capabilities: CollectionContentHierarchyCapabilities,
): CollectionContentHierarchy {
  const raw = isRecord(value) ? value : {};
  const mode = capabilities.modes.includes(
    raw.mode as CollectionContentHierarchyMode,
  )
    ? (raw.mode as CollectionContentHierarchyMode)
    : capabilities.defaults.mode;

  return {
    mode,
    secondaryItemCount: readPositiveInt(
      raw.secondaryItemCount,
      capabilities.defaults.secondaryItemCount,
      capabilities.maximumSecondaryItems ?? 24,
    ),
  };
}

export function buildCollectionContentHierarchy(
  input: CollectionContentHierarchyInput,
  capabilities: CollectionContentHierarchyCapabilities,
) {
  return parseCollectionContentHierarchy(input, capabilities);
}
