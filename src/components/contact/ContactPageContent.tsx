import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";

type ContactPageContentProps = {
  composition: PageComposition;
  searchParams?: SearchPlatformSearchParams;
};

export default function ContactPageContent({
  composition,
  searchParams,
}: ContactPageContentProps) {
  return (
    <main dir="rtl" className="overflow-hidden bg-[#03070b] text-white">
      <PageSlotLayout
        composition={composition}
        publicPath="/contact"
        searchParams={searchParams}
        listingContext={{ publicPath: "/contact", searchParams }}
      />
    </main>
  );
}
