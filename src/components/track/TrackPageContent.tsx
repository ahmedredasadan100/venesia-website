import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import { getPublicPageRoute } from "../../lib/admin/links/static-routes";

const PAGE_IDENTITY = getPublicPageRoute("track-your-project");

type TrackPageContentProps = {
  composition: PageComposition;
  searchParams?: SearchPlatformSearchParams;
};

export default function TrackPageContent({
  composition,
  searchParams,
}: TrackPageContentProps) {
  return (
    <main dir="rtl" className="relative z-10 overflow-hidden bg-[#03070b] text-white">
      <PageSlotLayout
        composition={composition}
        publicPath={PAGE_IDENTITY.href}
        searchParams={searchParams}
        listingContext={{
          publicPath: PAGE_IDENTITY.href,
          searchParams,
        }}
      />
    </main>
  );
}
