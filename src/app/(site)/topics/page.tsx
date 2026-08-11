import Link from "next/link";

import InternalPageLayout from "../../../components/InternalPageLayout";
import Pagination from "../../../components/Pagination";
import TopicsSidebarSearchPanel from "../../../components/topics/TopicsSidebarSearchPanel";
import FeedModulesStack from "../../../components/feed-modules/FeedModulesStack";
import TopicCard from "../../../components/topics/TopicCard";
import FeaturedTopic from "../../../components/topics/FeaturedTopic";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import BreadcrumbModuleSection from "../../../components/modules/BreadcrumbModuleSection";
import { asBreadcrumbConfig } from "../../../lib/page-blocks/configs";
import TopicsInsightCtaSection from "../../../components/topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../../../components/topics/TopicsIntroSection";

import { loadPublicTopicsListing } from "../../../lib/topics/load-public-topics";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { loadFeedModulesForPageSlug } from "../../../lib/feed-modules/load-feed-modules";
import { findBreadcrumbInComposition, findHeroInComposition } from "../../../lib/page-blocks/page-composition-utils";

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
  }>;
};

const ITEMS_PER_PAGE = 6;

function buildTopicsQuery(sort: string, categorySlug: string, seriesSlug: string) {
  const query: Record<string, string> = { sort };
  if (categorySlug) query.category = categorySlug;
  if (seriesSlug) query.series = seriesSlug;
  return query;
}

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;
  const sort = params?.sort === "oldest" ? "oldest" : "latest";
  const categorySlug = params?.category?.trim() ?? "";
  const seriesSlug = params?.series?.trim() ?? "";
  const requestedPage = Number(params?.page ?? 1);
  const [composition, listing] = await Promise.all([
    loadPageCompositionBySlug("topics", "main-sidebar"),
    loadPublicTopicsListing({
      sort,
      categorySlug: categorySlug || undefined,
      seriesSlug: seriesSlug || undefined,
      page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
      itemsPerPage: ITEMS_PER_PAGE,
    }),
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

  const pageQuery = buildTopicsQuery(sort, categorySlug, seriesSlug);

  return (
    <InternalPageLayout
      title="مركز المعرفة"
      eyebrow="Knowledge Center"
      subtitle="محتوى توعوي واستثماري وهندسي يساعدك على اتخاذ قرارات عقارية أكثر وعيًا."
      heroImage="/images/venesia-5.png"
      dynamicHero={heroEntry?.hero}
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
          mainAfter={(
            <div className="space-y-7 text-right">
              {composition.hasCompositionError ? (
                <p
                  role="status"
                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/55"
                >
                  تعذر تحميل بعض أقسام الصفحة حاليًا. المحتوى الأساسي متاح أدناه.
                </p>
              ) : null}
              <FeaturedTopic topic={featuredTopic} />

              {totalRegularTopics > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-5 py-4">
                    <p className="text-sm text-white/45">
                      عرض {startIndex + 1}-{endIndex} من {totalRegularTopics} موضوع
                    </p>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/topics?${new URLSearchParams(buildTopicsQuery("latest", categorySlug, seriesSlug)).toString()}`}
                        scroll={false}
                        className={`rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                          sort === "latest"
                            ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                            : "border-white/10 bg-white/[0.025] text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                        }`}
                      >
                        الأحدث
                      </Link>

                      <Link
                        href={`/topics?${new URLSearchParams(buildTopicsQuery("oldest", categorySlug, seriesSlug)).toString()}`}
                        scroll={false}
                        className={`rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                          sort === "oldest"
                            ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                            : "border-white/10 bg-white/[0.025] text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                        }`}
                      >
                        الأقدم
                      </Link>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {visibleTopics.map((topic) => (
                      <TopicCard key={topic.id} {...topic} />
                    ))}
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    basePath="/topics"
                    query={pageQuery}
                  />
                </>
              ) : null}
            </div>
          )}
          sidebarPrefix={<TopicsSidebarSearchPanel />}
        />
      ) : (
      <div className="space-y-10">
        <TopicsIntroSection />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:[direction:ltr]">
          <main dir="rtl" className="space-y-7 text-right">
            <FeaturedTopic topic={featuredTopic} />

            {totalRegularTopics > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-5 py-4">
                  <p className="text-sm text-white/45">
                    عرض {startIndex + 1}-{endIndex} من {totalRegularTopics} موضوع
                  </p>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/topics?${new URLSearchParams(buildTopicsQuery("latest", categorySlug, seriesSlug)).toString()}`}
                      scroll={false}
                      className={`rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                        sort === "latest"
                          ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                          : "border-white/10 bg-white/[0.025] text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                      }`}
                    >
                      الأحدث
                    </Link>

                    <Link
                      href={`/topics?${new URLSearchParams(buildTopicsQuery("oldest", categorySlug, seriesSlug)).toString()}`}
                      scroll={false}
                      className={`rounded-full border px-5 py-2.5 text-sm transition-all duration-300 ${
                        sort === "oldest"
                          ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                          : "border-white/10 bg-white/[0.025] text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
                      }`}
                    >
                      الأقدم
                    </Link>
                  </div>
                </div>

                <div className="space-y-6">
                  {visibleTopics.map((topic) => (
                    <TopicCard key={topic.id} {...topic} />
                  ))}
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  basePath="/topics"
                  query={pageQuery}
                />
              </>
            ) : null}
          </main>

          <div dir="rtl" className="space-y-6">
            <TopicsSidebarSearchPanel />
            <FeedModulesStack modules={sidebarFeeds} slot="sidebar" />
            <TopicsInsightCtaSection />
          </div>
        </div>
      </div>
      )}
    </InternalPageLayout>
  );
}
