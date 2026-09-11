import { PageSlotContent } from "../page-composition/PageSlotLayout";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import { getPublicPageRoute } from "../../lib/admin/links/static-routes";

const PAGE_IDENTITY = getPublicPageRoute("home");

type HomeMainSlotContentProps = {
  composition: PageComposition;
  homepageProjects: HomepageProjectCard[];
  searchParams?: SearchPlatformSearchParams;
  suppressFeaturedDuringSearch?: boolean;
};

/** Home keeps its visual shell while adopting the canonical slot render plan. */
export default function HomeMainSlotContent({
  composition,
  homepageProjects,
  searchParams,
  suppressFeaturedDuringSearch,
}: HomeMainSlotContentProps) {
  return (
    <div
      className="page-layout-slot"
      data-layout-slot="main"
      data-home-main-slot="shared"
    >
      <PageSlotContent
        entries={getSlotEntries(composition, "main")}
        homepageProjects={homepageProjects}
        publicPath={PAGE_IDENTITY.href}
        searchParams={searchParams}
        listingContext={{
          publicPath: PAGE_IDENTITY.href,
          searchParams,
          excludeContentIds: composition.featuredModules.flatMap((module) =>
            module.items.map((item) => item.id),
          ),
          showCompositionError: composition.hasCompositionError,
        }}
        suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
      />
    </div>
  );
}
