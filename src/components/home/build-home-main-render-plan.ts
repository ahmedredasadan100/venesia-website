import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import { resolveHomeModuleSlug } from "./home-placement-registry";

export type HomeMainRenderPlanEntry = {
  key: string;
  sortOrder: number;
  slug: string;
  source: "cms";
  assignmentId?: number;
  block?: ResolvedPageBlock;
};

/**
 * Builds a sort_order-driven render plan for the home main slot.
 * CMS blocks from the canonical page-composition contract only.
 */
export function buildHomeMainRenderPlan(composition: PageComposition): HomeMainRenderPlanEntry[] {
  const entries = getSlotEntries(composition, "main");
  const plan: HomeMainRenderPlanEntry[] = [];

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

  return plan.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
  );
}
