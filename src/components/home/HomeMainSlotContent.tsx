import SlotModulesRenderer from "../page-composition/SlotModulesRenderer";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import { buildHomeMainRenderPlan } from "./build-home-main-render-plan";
import type { HomeMainRenderPlanEntry } from "./build-home-main-render-plan";

type HomeMainSlotContentProps = {
  composition: PageComposition;
  homepageProjects: HomepageProjectCard[];
};

export function renderHomeMainPlanEntry(
  entry: HomeMainRenderPlanEntry,
  homepageProjects: HomepageProjectCard[],
) {
  if (entry.block) {
    return <SlotModulesRenderer blocks={[entry.block]} homepageProjects={homepageProjects} />;
  }
  return null;
}

/**
 * Phase 2+ home main slot — sort_order-driven rendering via buildHomeMainRenderPlan().
 */
export default function HomeMainSlotContent({
  composition,
  homepageProjects,
}: HomeMainSlotContentProps) {
  const plan = buildHomeMainRenderPlan(composition);

  return (
    <div className="page-layout-slot" data-layout-slot="main" data-home-main-slot="plan">
      {plan.map((entry) => (
        <div
          key={entry.key}
          data-home-plan-slug={entry.slug}
          data-home-plan-source={entry.source}
          data-home-plan-sort={entry.sortOrder}
        >
          {renderHomeMainPlanEntry(entry, homepageProjects)}
        </div>
      ))}
    </div>
  );
}
