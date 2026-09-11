import HomePageContent from "../../components/home/HomePageContent";
import RevealAnimations from "../../components/RevealAnimations";
import PageSlotLayout, {
  hasActiveSearchPlatformQuery,
  HeroSlotContent,
} from "../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../components/search-platform/SearchPlatformModule";
import { getPublicPageRoute } from "../../lib/admin/links/static-routes";

export const revalidate = 300;
const PAGE_IDENTITY = getPublicPageRoute("home");

export async function generateMetadata() {
  return generatePublicMetadata({ path: PAGE_IDENTITY.href });
}

type HomePageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug(PAGE_IDENTITY.cmsPageSlug),
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
        publicPath={PAGE_IDENTITY.href}
        searchParams={resolvedSearchParams}
        listingContext={{
          publicPath: PAGE_IDENTITY.href,
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
        publicPath={PAGE_IDENTITY.href}
        searchParams={resolvedSearchParams}
        listingContext={{
          publicPath: PAGE_IDENTITY.href,
          searchParams: resolvedSearchParams,
        }}
      />
    </div>
  );
}
