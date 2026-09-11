import AboutPageContent from "../../../components/about/AboutPageContent";
import RevealAnimations from "../../../components/RevealAnimations";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/about" });
}

type AboutPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function AboutPage({ searchParams }: AboutPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug("about"),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <AboutPageContent
        composition={composition}
        searchParams={resolvedSearchParams}
      />
      <RevealAnimations />
    </div>
  );
}
