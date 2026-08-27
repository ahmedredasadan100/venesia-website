/**
 * Platform-level semantic Regions exposed by Page Composition.
 *
 * Array order is a stable semantic/Admin order only. It does not prescribe
 * visual placement, direction, dimensions, columns, or responsive behavior.
 */
export const PAGE_COMPOSITION_POSITIONS = [
  "main",
  "sidebar",
  "bottom",
  "footer",
  "hero",
] as const;

export type PageCompositionPosition = (typeof PAGE_COMPOSITION_POSITIONS)[number];

export function isPageCompositionPosition(
  value: string | null | undefined,
): value is PageCompositionPosition {
  return PAGE_COMPOSITION_POSITIONS.includes(value as PageCompositionPosition);
}
