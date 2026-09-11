import FeedModulesStack from "../../../components/feed-modules/FeedModulesStack";
import TopicsListingContent from "../../../components/topics/TopicsListingContent";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import DynamicHeroSection from "../../../components/sections/DynamicHeroSection";
import TopicsInsightCtaSection from "../../../components/topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../../../components/topics/TopicsIntroSection";

import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { getHeroSectionByPageSlug } from "../../../lib/load-hero-section";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { loadFeedModulesForPageSlug } from "../../../lib/feed-modules/load-feed-modules";
import { isTopicsListingTemplate } from "../../../lib/page-blocks/configs";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/topics" });
}

type TopicsPageProps = {
  searchParams?: Promise<{
    sort?: string;
    page?: string;
    category?: string;
    series?: string;
    q?: string;
  }>;
};

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;

  const [dynamicHero, composition] = await Promise.all([
    getHeroSectionByPageSlug("topics"),
    loadPageCompositionBySlug("topics"),
  ]);
  const hasTopicsListingAssignmentRows = composition.blockStates.some(
    (state) =>
      state.blockType === "content" &&
      isTopicsListingTemplate(state.templateSlug, state.templateVariant),
  );
  // Presence (any assignment rows) or load failure → CMS path; never resurrect static shell.
  const useCmsLayout =
    composition.hasAnyAssignmentRows || composition.hasCompositionError;
  // Feeds are already in composition when CMS-managed; only reload for virgin static shell.
  const sidebarFeeds = useCmsLayout ? [] : await loadFeedModulesForPageSlug("topics");
  const listingContext = {
    publicPath: "/topics",
    searchParams: params,
    excludeContentIds: composition.featuredModules.flatMap((module) =>
      module.items.map((item) => item.id),
    ),
    showCompositionError: useCmsLayout && composition.hasCompositionError,
  };
  const fallbackListingContent = hasTopicsListingAssignmentRows ||
    composition.hasCompositionError
    ? null
    : <TopicsListingContent block={null} context={listingContext} />;

  const fallbackHero = (
    <DynamicHeroSection
      hero={dynamicHero}
      fallbackTitle="مركز المعرفة"
      fallbackEyebrow="Knowledge Center"
      fallbackSubtitle="محتوى توعوي واستثماري وهندسي يساعدك على اتخاذ قرارات عقارية أكثر وعيًا."
      fallbackImage="/images/venesia-5.png"
    />
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />
      <main className="relative z-10 min-h-[50vh] pb-20">
        <PageSlotLayout
          composition={composition}
          publicPath="/topics"
          searchParams={params}
          listingContext={{ publicPath: "/topics", searchParams: params }}
          fallbackHero={fallbackHero}
          mainAfter={
            hasTopicsListingAssignmentRows || composition.hasCompositionError
              ? null
              : useCmsLayout ? (
              fallbackListingContent
            ) : (
              <div className="space-y-10">
                <TopicsIntroSection />
                {fallbackListingContent}
              </div>
            )
          }
          sidebarPrefix={
            useCmsLayout ? null : (
              <>
                <FeedModulesStack modules={sidebarFeeds} slot="sidebar" />
                <TopicsInsightCtaSection />
              </>
            )
          }
        />
      </main>
    </div>
  );
}
