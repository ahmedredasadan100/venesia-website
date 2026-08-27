import type { PageCompositionPosition } from "../../lib/page-composition/positions";

/**
 * Venisia Theme rendering choice only.
 *
 * Another Theme may render the same semantic Regions in a different visual
 * order or topology without changing Page Composition or its Assignments.
 */
export const VENISIA_THEME_REGION_RENDER_ORDER = [
  "hero",
  "main",
  "sidebar",
  "bottom",
  "footer",
] as const satisfies readonly PageCompositionPosition[];
