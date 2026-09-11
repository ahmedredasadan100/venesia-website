import PageSlotLayout from "../page-composition/PageSlotLayout";
import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import type { MediaCenterCmsPageSlug } from "../../lib/media-center-page-config";

type MediaCenterShellLayoutProps = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  composition: PageComposition;
  publicPath: string;
  searchParams?: SearchPlatformSearchParams;
};

/** Media listing shell adopted by the canonical Page Composition renderer. */
export default function MediaCenterShellLayout({
  cmsPageSlug,
  composition,
  publicPath,
  searchParams,
}: MediaCenterShellLayoutProps) {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#05070B] text-white"
      data-media-center-page={cmsPageSlug}
      dir="rtl"
    >
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10 min-h-[50vh] pb-20">
        <PageSlotLayout
          composition={composition}
          publicPath={publicPath}
          searchParams={searchParams}
          listingContext={{ publicPath, searchParams }}
        />
      </main>
    </div>
  );
}
