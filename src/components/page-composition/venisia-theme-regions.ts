import type { PageCompositionPosition } from "../../lib/page-composition/positions";
import type { PageRegionDefinition } from "../../lib/page-composition/load-page-regions";

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

export type ThemeLayoutPlan = Readonly<{
  topology: "main-sidebar" | "region-stack";
  regionOrder: readonly string[];
}>;

/**
 * Theme-owned projection from semantic Layout/Regions to visual geometry.
 *
 * Page Composition remains the authority for region identity and assignment;
 * this contract is the only place where Venisia chooses columns versus a
 * generic ordered stack. New Layout keys are therefore renderable without
 * teaching the shared composition runtime about brand geometry.
 */
export function resolveVenesiaThemeLayout(input: Readonly<{
  layoutKey: string;
  regions: readonly PageRegionDefinition[];
  hasSidebarContent: boolean;
}>): ThemeLayoutPlan {
  if (input.layoutKey === "venisia-legacy") {
    return {
      topology: input.hasSidebarContent ? "main-sidebar" : "region-stack",
      regionOrder: VENISIA_THEME_REGION_RENDER_ORDER,
    };
  }

  return {
    topology: "region-stack",
    regionOrder: input.regions.map((region) => region.key),
  };
}
