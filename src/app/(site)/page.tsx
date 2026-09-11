import HomePageContent from "../../components/home/HomePageContent";
import RevealAnimations from "../../components/RevealAnimations";
import PageSlotLayout, {
  hasActiveSearchPlatformQuery,
  HeroSlotContent,
} from "../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../components/search-platform/SearchPlatformModule";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/" });
}

type HomePageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug("home"),
    searchParams ?? Promise.resolve({}),
  ]);
  const homepageProjects = composition.homepageProjects ?? [];
  const suppressFeaturedDuringSearch = hasActiveSearchPlatformQuery(
    composition,
    resolvedSearchParams,
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <RevealAnimations />

      <div
        aria-hidden
        className="venesia-grain pointer-events-none fixed inset-0 z-[4]"
      />

      <HeroSlotContent
        composition={composition}
        homepageProjects={homepageProjects}
        publicPath="/"
        searchParams={resolvedSearchParams}
        listingContext={{
          publicPath: "/",
          searchParams: resolvedSearchParams,
        }}
        suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
      />

      <HomePageContent
        composition={composition}
        homepageProjects={homepageProjects}
        searchParams={resolvedSearchParams}
        suppressFeaturedDuringSearch={suppressFeaturedDuringSearch}
      />

      <PageSlotLayout
        composition={composition}
        skipSlots={["hero", "main"]}
        homepageProjects={homepageProjects}
        publicPath="/"
        searchParams={resolvedSearchParams}
        listingContext={{
          publicPath: "/",
          searchParams: resolvedSearchParams,
        }}
      />
    </div>
  );
}
