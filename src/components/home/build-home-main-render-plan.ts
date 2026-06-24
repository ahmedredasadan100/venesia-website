import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import {
  HOME_MAIN_PLACEMENTS,
  resolveHomeModuleSlug,
  type HomeModuleSlug,
} from "./home-placement-registry";

export type HomeMainRenderPlanEntry = {
  key: string;
  sortOrder: number;
  slug: string;
  source: "cms" | "fallback";
  assignmentId?: number;
  block?: ResolvedPageBlock;
};

/**
 * Builds a sort_order-driven render plan for the home main slot.
 * CMS blocks from composition + static fallbacks only when no assignment exists.
 * Assignments with is_visible=false suppress both CMS and fallback rendering.
 */
export function buildHomeMainRenderPlan(composition: PageComposition): HomeMainRenderPlanEntry[] {
  const entries = getSlotEntries(composition, "main");
  const plan: HomeMainRenderPlanEntry[] = [];
  const cmsHomeSlugs = new Set<HomeModuleSlug>();
  const hiddenHomeSlugs = new Set(composition.hiddenHomeModuleSlugs ?? []);

  for (const entry of entries) {
    if (entry.kind === "feed") {
      plan.push({
        key: `feed-${entry.assignmentId}`,
        sortOrder: entry.sortOrder,
        slug: `feed-${entry.assignmentId}`,
        source: "cms",
        assignmentId: entry.assignmentId,
      });
      continue;
    }

    if (entry.kind !== "block") continue;

    const homeSlug = resolveHomeModuleSlug(entry.block);
    if (homeSlug) {
      cmsHomeSlugs.add(homeSlug);
      plan.push({
        key: `${homeSlug}-${entry.assignmentId}`,
        sortOrder: entry.sortOrder,
        slug: homeSlug,
        source: "cms",
        assignmentId: entry.assignmentId,
        block: entry.block,
      });
      continue;
    }

    plan.push({
      key: `block-${entry.assignmentId}`,
      sortOrder: entry.sortOrder,
      slug: entry.block.template.slug,
      source: "cms",
      assignmentId: entry.assignmentId,
      block: entry.block,
    });
  }

  for (const placement of HOME_MAIN_PLACEMENTS) {
    if (cmsHomeSlugs.has(placement.slug)) continue;
    if (hiddenHomeSlugs.has(placement.slug)) continue;

    plan.push({
        key: `${placement.slug}-fallback`,
        sortOrder: placement.sortOrder,
        slug: placement.slug,
        source: "fallback",
    });
  }

  return plan.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  );
}
