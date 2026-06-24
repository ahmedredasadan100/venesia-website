import Link from "next/link";

import InternalPageLayout from "../../components/InternalPageLayout";
import Pagination from "../../components/Pagination";
import TopicsSidebarSearchPanel from "../../components/topics/TopicsSidebarSearchPanel";
import FeedModulesStack from "../../components/feed-modules/FeedModulesStack";
import TopicCard from "../../components/topics/TopicCard";
import FeaturedTopic from "../../components/topics/FeaturedTopic";
import PageSlotLayout from "../../components/page-composition/PageSlotLayout";
import BreadcrumbModuleSection from "../../components/modules/BreadcrumbModuleSection";
import { asBreadcrumbConfig } from "../../lib/page-blocks/configs";
import TopicsInsightCtaSection from "../../components/topics/TopicsInsightCtaSection";
import TopicsIntroSection from "../../components/topics/TopicsIntroSection";

import { logError } from "../../lib/logging";
import { filterPublicTopics } from "../../lib/admin/cms-test-data";
import { supabase } from "../../lib/supabase";
import { formatArabicContentDate } from "../../lib/content-dates";
import { buildMetadata } from "../../lib/seo/build-metadata";
import type { Topic } from "../../lib/topics/types";
import { getHeroSectionByPageSlug } from "../../lib/load-hero-section";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { loadFeedModulesForPageSlug } from "../../lib/feed-modules/load-feed-modules";
import { findBreadcrumbInComposition, findHeroInComposition } from "../../lib/page-blocks/page-composition-utils";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/topics" });

type TopicsPageProps = {
  searchParams?: Promise<{
    sort?: string;
    page?: string;
    category?: string;
  }>;
};

const ITEMS_PER_PAGE = 6;

function buildTopicsQuery(sort: string, categorySlug: string) {
  const query: Record<string, string> = { sort };
  if (categorySlug) query.category = categorySlug;
  return query;
}

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;
  const [dynamicHero, composition] = await Promise.all([
    getHeroSectionByPageSlug("topics"),
    loadPageCompositionBySlug("topics", "main-sidebar"),
  ]);
  const useCmsLayout = composition.hasAssignments;
  const sidebarFeeds = useCmsLayout ? [] : await loadFeedModulesForPageSlug("topics");
  const heroEntry = findHeroInComposition(composition);
  const breadcrumbBlock = findBreadcrumbInComposition(composition);

  const { data: dbTopics, error } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "published")
    .is("deleted_at", null);

  if (error) {
    logError("Failed to load published topics", error);
  }

  const sort = params?.sort === "oldest" ? "oldest" : "latest";
  const categorySlug = params?.category?.trim() ?? "";

  const requestedPage = Number(params?.page ?? 1);
  const liveTopics: Topic[] =
    !error && dbTopics
      ? filterPublicTopics(dbTopics).map((topic) => ({
          id: topic.id,
          slug: topic.slug,
          title: topic.title ?? "",
          excerpt: topic.excerpt ?? "",
          image: topic.image ?? "",
          category: topic.category ?? "",
          categorySlug: topic.category_slug ?? "",
          date: topic.date_label || formatArabicContentDate(topic.published_at),
          publishedAt: topic.published_at ?? "",
          readingTime: topic.reading_time ?? "",
          isFeatured: topic.is_featured,
          isPopular: topic.is_popular,
          content: topic.content ?? undefined,
          series: topic.series ?? undefined,
          seriesSlug: topic.series_slug ?? undefined,
          seoTitle: topic.seo_title ?? undefined,
          seoDescription: topic.seo_description ?? undefined,
          seoKeywords: topic.seo_keywords ?? undefined,
          faq: topic.faq ?? undefined,
        }))
      : [];

  const filteredTopics = categorySlug
    ? liveTopics.filter((topic) => topic.categorySlug === categorySlug)
    : liveTopics;

  const featuredTopic =
    filteredTopics.find((topic) => topic.isFeatured) ?? filteredTopics[0];

  const regularTopics = featuredTopic
    ? filteredTopics.filter((topic) => topic.id !== featuredTopic.id)
    : [];

  const sortedTopics = [...regularTopics].sort((a, b) => {
    const aTime = new Date(a.publishedAt).getTime();
    const bTime = new Date(b.publishedAt).getTime();

    return sort === "oldest" ? aTime - bTime : bTime - aTime;
  });

  const totalPages = Math.max(1, Math.ceil(sortedTopics.length / ITEMS_PER_PAGE));

  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sortedTopics.length);

  const visibleTopics = sortedTopics.slice(startIndex, endIndex);
  const pageQuery = buildTopicsQuery(sort, categorySlug);

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
          mainAfter={(
            <div className="space-y-7 text-right">
              <FeaturedTopic topic={featuredTopic} />

              {sortedTopics.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-5 py-4">
                    <p className="text-sm text-white/45">
                      عرض {startIndex + 1}-{endIndex} من {sortedTopics.length} موضوع
                    </p>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/topics?${new URLSearchParams(buildTopicsQuery("latest", categorySlug)).toString()}`}
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
                        href={`/topics?${new URLSearchParams(buildTopicsQuery("oldest", categorySlug)).toString()}`}
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

            {sortedTopics.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-5 py-4">
                  <p className="text-sm text-white/45">
                    عرض {startIndex + 1}-{endIndex} من {sortedTopics.length} موضوع
                  </p>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/topics?${new URLSearchParams(buildTopicsQuery("latest", categorySlug)).toString()}`}
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
                      href={`/topics?${new URLSearchParams(buildTopicsQuery("oldest", categorySlug)).toString()}`}
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
