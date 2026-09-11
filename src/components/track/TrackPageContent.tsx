import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";

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
        publicPath="/track-your-project"
        searchParams={searchParams}
        listingContext={{
          publicPath: "/track-your-project",
          searchParams,
        }}
      />
    </main>
  );
}
