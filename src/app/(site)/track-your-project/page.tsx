import TrackPageContent from "../../../components/track/TrackPageContent";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/track-your-project" });
}

type TrackYourProjectPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function TrackYourProjectPage({
  searchParams,
}: TrackYourProjectPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug("track-your-project"),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <TrackPageContent
        composition={composition}
        searchParams={resolvedSearchParams}
      />
    </div>
  );
}
