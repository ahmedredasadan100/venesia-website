import InternalPageLayout from "../../../components/InternalPageLayout";
import TopicsSidebarSearchPanel from "../../../components/topics/TopicsSidebarSearchPanel";
import FeedModulesStack from "../../../components/feed-modules/FeedModulesStack";
import TopicsListingContent from "../../../components/topics/TopicsListingContent";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import BreadcrumbModuleSection from "../../../components/modules/BreadcrumbModuleSection";
import { asBreadcrumbConfig } from "../../../lib/page-blocks/configs";
import TopicsInsightCtaSection from "../../../components/topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../../../components/topics/TopicsIntroSection";

import { loadPublicTopicsListing } from "../../../lib/topics/load-public-topics";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { getHeroSectionByPageSlug } from "../../../lib/load-hero-section";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { loadFeedModulesForPageSlug } from "../../../lib/feed-modules/load-feed-modules";
import { findBreadcrumbInComposition, findHeroInComposition } from "../../../lib/page-blocks/page-composition-utils";
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
    loadPageCompositionBySlug("topics", "main-sidebar"),
    listingPromise,
  ]);
  // Presence (any assignment rows) or load failure → CMS path; never resurrect static shell.
  const useCmsLayout =
    composition.hasAnyAssignmentRows || composition.hasCompositionError;
  // Feeds are already in composition when CMS-managed; only reload for virgin static shell.
  const sidebarFeeds = useCmsLayout ? [] : await loadFeedModulesForPageSlug("topics");
  const heroEntry = findHeroInComposition(composition);
  const breadcrumbBlock = findBreadcrumbInComposition(composition);

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

  return (
    <InternalPageLayout
      title="مركز المعرفة"
      eyebrow="Knowledge Center"
      subtitle="محتوى توعوي واستثماري وهندسي يساعدك على اتخاذ قرارات عقارية أكثر وعيًا."
      heroImage="/images/venesia-5.png"
      dynamicHero={heroEntry?.hero ?? dynamicHero}
      heroBelowTitle={
        breadcrumbBlock ? (
          <BreadcrumbModuleSection config={asBreadcrumbConfig(breadcrumbBlock.template.config)} />
        ) : undefined
      }
    >
      {useCmsLayout ? (
        <PageSlotLayout
          composition={composition}
          skipSlots={["hero"]}
          mainAfter={listingContent}
          sidebarPrefix={searchPanel}
        />
      ) : (
      <div className="space-y-10">
        <TopicsIntroSection />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:[direction:ltr]">
          <main dir="rtl" className="space-y-7 text-right">
            {listingContent}
          </main>

          <div dir="rtl" className="space-y-6">
            {searchPanel}
            <FeedModulesStack modules={sidebarFeeds} slot="sidebar" />
            <TopicsInsightCtaSection />
          </div>
        </div>
      </div>
      )}
    </InternalPageLayout>
  );
}
