import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";

type AboutPageContentProps = {
  composition: PageComposition;
  searchParams?: SearchPlatformSearchParams;
};

export default function AboutPageContent({
  composition,
  searchParams,
}: AboutPageContentProps) {
  return (
    <main className="relative z-10">
      <PageSlotLayout
        composition={composition}
        publicPath="/about"
        searchParams={searchParams}
        listingContext={{ publicPath: "/about", searchParams }}
      />
    </main>
  );
}
