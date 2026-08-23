import TopicsSidebarSearchPanel from "../../../components/topics/TopicsSidebarSearchPanel";
import FeedModulesStack from "../../../components/feed-modules/FeedModulesStack";
import TopicsListingContent from "../../../components/topics/TopicsListingContent";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import DynamicHeroSection from "../../../components/sections/DynamicHeroSection";
import TopicsInsightCtaSection from "../../../components/topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../../../components/topics/TopicsIntroSection";

import { loadPublicTopicsListing } from "../../../lib/topics/load-public-topics";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { getHeroSectionByPageSlug } from "../../../lib/load-hero-section";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { loadFeedModulesForPageSlug } from "../../../lib/feed-modules/load-feed-modules";
import { normalizePublicContentSearchQuery } from "../../../lib/content/public-content-read";

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

const ITEMS_PER_PAGE = 6;

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;
  const sort = params?.sort === "oldest" ? "oldest" : "latest";
  const categorySlug = params?.category?.trim() ?? "";
  const seriesSlug = params?.series?.trim() ?? "";
  const searchQuery = normalizePublicContentSearchQuery(params?.q);
  const requestedPage = Number(params?.page ?? 1);

  const listingPromise = loadPublicTopicsListing({
    sort,
    categorySlug: categorySlug || undefined,
    seriesSlug: seriesSlug || undefined,
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    itemsPerPage: ITEMS_PER_PAGE,
    search: searchQuery,
  });

  const [dynamicHero, composition, listing] = await Promise.all([
    getHeroSectionByPageSlug("topics"),
    loadPageCompositionBySlug("topics"),
    listingPromise,
  ]);
  // Presence (any assignment rows) or load failure → CMS path; never resurrect static shell.
  const useCmsLayout =
    composition.hasAnyAssignmentRows || composition.hasCompositionError;
  // Feeds are already in composition when CMS-managed; only reload for virgin static shell.
  const sidebarFeeds = useCmsLayout ? [] : await loadFeedModulesForPageSlug("topics");

  const {
    featuredTopic,
    visibleTopics,
    totalRegularTopics,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
  } = listing;

  const searchSuggestions = searchQuery
    ? visibleTopics.slice(0, 8).map((topic) => ({
        id: `article:${topic.id}`,
        title: topic.title,
        href: `/topics/${topic.slug}`,
        meta: [topic.category, topic.series].filter(Boolean).join(" · ") || undefined,
      }))
    : [];

  const listingContent = (
    <TopicsListingContent
      featuredTopic={featuredTopic}
      topics={visibleTopics}
      totalCount={totalRegularTopics}
      currentPage={currentPage}
      totalPages={totalPages}
      startIndex={startIndex}
      endIndex={endIndex}
      sort={sort}
      categorySlug={categorySlug}
      seriesSlug={seriesSlug}
      searchQuery={searchQuery}
      showCompositionError={useCmsLayout && composition.hasCompositionError}
    />
  );

  const searchPanel = (
    <TopicsSidebarSearchPanel
      query={searchQuery}
      suggestions={searchSuggestions}
      resultCount={totalRegularTopics}
    />
  );

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
          fallbackHero={fallbackHero}
          mainAfter={
            useCmsLayout ? (
              listingContent
            ) : (
              <div className="space-y-10">
                <TopicsIntroSection />
                {listingContent}
              </div>
            )
          }
          sidebarPrefix={
            useCmsLayout ? (
              searchPanel
            ) : (
              <>
                {searchPanel}
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
