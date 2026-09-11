import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import { getPublicPageRoute } from "../../lib/admin/links/static-routes";

const PAGE_IDENTITY = getPublicPageRoute("about");

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
        publicPath={PAGE_IDENTITY.href}
        searchParams={searchParams}
        listingContext={{ publicPath: PAGE_IDENTITY.href, searchParams }}
      />
    </main>
  );
}
