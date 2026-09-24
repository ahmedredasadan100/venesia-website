export const FEED_MAX_VISIBLE_DOTS = 5;

export function chunkFeedListItems<T>(items: readonly T[], itemsPerGroup: number) {
  const resolvedItemsPerGroup = Math.max(1, Math.floor(itemsPerGroup));
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += resolvedItemsPerGroup) {
    groups.push(items.slice(index, index + resolvedItemsPerGroup));
  }

  return groups;
}

export function resolveCompactFeedDotIndices(
  count: number,
  activeIndex: number,
  maxVisible = FEED_MAX_VISIBLE_DOTS,
) {
  const resolvedCount = Math.max(0, Math.floor(count));
  const resolvedMaxVisible = Math.max(1, Math.floor(maxVisible));

  if (!resolvedCount) return [];
  if (resolvedCount <= resolvedMaxVisible) {
    return Array.from({ length: resolvedCount }, (_, index) => index);
  }

  const boundedActiveIndex =
    ((Math.floor(activeIndex) % resolvedCount) + resolvedCount) % resolvedCount;
  const halfWindow = Math.floor(resolvedMaxVisible / 2);
  const startIndex = Math.min(
    Math.max(boundedActiveIndex - halfWindow, 0),
    resolvedCount - resolvedMaxVisible,
  );

  return Array.from(
    { length: resolvedMaxVisible },
    (_, index) => startIndex + index,
  );
}
