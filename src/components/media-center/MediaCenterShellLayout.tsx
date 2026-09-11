import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import type { PublicStaticPageRoute } from "../../lib/admin/links/static-routes";

type MediaCenterShellLayoutProps = {
  pageIdentity: Pick<PublicStaticPageRoute, "cmsPageSlug" | "href">;
  composition: PageComposition;
  searchParams?: SearchPlatformSearchParams;
};

/** Media listing shell adopted by the canonical Page Composition renderer. */
export default function MediaCenterShellLayout({
  pageIdentity,
  composition,
  searchParams,
}: MediaCenterShellLayoutProps) {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#05070B] text-white"
      data-media-center-page={pageIdentity.cmsPageSlug}
      dir="rtl"
    >
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10 min-h-[50vh] pb-20">
        <PageSlotLayout
          composition={composition}
          publicPath={pageIdentity.href}
          searchParams={searchParams}
          listingContext={{ publicPath: pageIdentity.href, searchParams }}
        />
      </main>
    </div>
  );
}
