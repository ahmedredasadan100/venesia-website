import HomeMainSlotContent from "./HomeMainSlotContent";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";

type HomePageContentProps = {
  composition: PageComposition;
  homepageProjects: HomepageProjectCard[];
  searchParams?: SearchPlatformSearchParams;
  suppressFeaturedDuringSearch?: boolean;
};

/**
 * Home body shell: main slot sections via buildHomeMainRenderPlan() + sort_order.
 */
export default function HomePageContent({
  composition,
  homepageProjects,
  searchParams,
  suppressFeaturedDuringSearch,
}: HomePageContentProps) {
  return (
    <main className="relative z-10 bg-[#05070B]">
      <div className="venesia-main-canvas pointer-events-none absolute inset-0 -z-10 overflow-hidden" />

      <div
        aria-hidden
        className="venesia-hero-projects-bridge pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(26vh,210px)]"
      />

      <HomeMainSlotContent
        composition={composition}
        homepageProjects={homepageProjects}
        searchParams={searchParams}
        suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
      />
    </main>
  );
}
