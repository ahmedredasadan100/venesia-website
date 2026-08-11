import Link from "next/link";

import Pagination from "../Pagination";
import FeaturedTopic from "./FeaturedTopic";
import TopicCard from "./TopicCard";
import type { Topic } from "../../lib/topics/types";

type TopicsListingContentProps = {
  featuredTopic?: Topic;
  topics: Topic[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  sort: "latest" | "oldest";
  categorySlug: string;
  seriesSlug: string;
  searchQuery?: string;
  showCompositionError?: boolean;
};

function buildTopicsQuery(sort: string, categorySlug: string, seriesSlug: string) {
  const query: Record<string, string> = { sort };
  if (categorySlug) query.category = categorySlug;
  if (seriesSlug) query.series = seriesSlug;
  return query;
}

export default function TopicsListingContent({
  featuredTopic,
  topics,
  totalCount,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  sort,
  categorySlug,
  seriesSlug,
  searchQuery = "",
  showCompositionError = false,
}: TopicsListingContentProps) {
  const isSearching = searchQuery.length > 0;
  const hasResults = isSearching ? topics.length > 0 : totalCount > 0;
  const displayedTotalCount = isSearching
    ? Math.max(totalCount, topics.length)
    : totalCount;
  const pageQuery = buildTopicsQuery(sort, categorySlug, seriesSlug);

  return (
    <div className="space-y-7 text-right" dir="rtl">
      {showCompositionError ? (
        <p
          role="status"
          className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/55"
        >
          تعذر تحميل بعض أقسام الصفحة حاليًا. المحتوى الأساسي متاح أدناه.
        </p>
      ) : null}

      {!isSearching ? <FeaturedTopic topic={featuredTopic} /> : null}

      {hasResults ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-5 py-4">
            <p className="text-sm text-white/45">
              {isSearching
                ? `عرض ${topics.length} من ${displayedTotalCount} نتائج البحث`
                : `عرض ${startIndex + 1}-${endIndex} من ${totalCount} موضوع`}
            </p>

            {isSearching ? (
              <p className="text-sm text-[#D8B87A]/75">
                البحث عن: {searchQuery}
              </p>
            ) : (
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
            )}
          </div>

          <div className="space-y-6">
            {topics.map((topic) => (
              <TopicCard key={topic.id} {...topic} />
            ))}
          </div>

          {!isSearching ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/topics"
              query={pageQuery}
            />
          ) : null}
        </>
      ) : isSearching ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
            Search Results
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            لا توجد نتائج مطابقة
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-white/55">
            جرّب كلمة بحث مختلفة مع الإبقاء على التصنيف أو السلسلة الحالية.
          </p>
        </div>
      ) : null}
    </div>
  );
}
