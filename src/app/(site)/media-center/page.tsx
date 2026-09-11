import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/media-center" });
}

const CMS_PAGE_SLUG = "media-center" as const;

type MediaCenterPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function MediaCenterPage({
  searchParams,
}: MediaCenterPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug(CMS_PAGE_SLUG),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10 min-h-[50vh] pb-20">
        <PageSlotLayout
          composition={composition}
          publicPath="/media-center"
          searchParams={resolvedSearchParams}
          listingContext={{
            publicPath: "/media-center",
            searchParams: resolvedSearchParams,
          }}
        />
      </main>
    </div>
  );
}
