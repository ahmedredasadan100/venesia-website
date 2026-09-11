import Link from "next/link";

import PublicPagination from "../Pagination";
import TopicsListingModule from "./TopicsListingModule";
import {
  asTopicsListingConfig,
} from "../../lib/page-blocks/configs";
import type {
  ListingRenderContext,
} from "../../lib/page-blocks/page-composition-types";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import { normalizePublicContentSearchQuery } from "../../lib/content/public-content-read";
import { loadPublicTopicsListing } from "../../lib/topics/load-public-topics";

type TopicsListingContentProps = {
  block: ResolvedPageBlock | null;
  context: ListingRenderContext;
};

function buildTopicsQuery(sort: string, categorySlug: string, seriesSlug: string) {
  const query: Record<string, string> = { sort };
  if (categorySlug) query.category = categorySlug;
  if (seriesSlug) query.series = seriesSlug;
  return query;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Assignment-scoped Topics Listing renderer used by canonical Page Composition. */
export default async function TopicsListingContent({
  block,
  context,
}: TopicsListingContentProps) {
  const searchParams = context.searchParams ?? {};
  const sort = firstParam(searchParams.sort) === "oldest" ? "oldest" : "latest";
  const requestedCategorySlug = firstParam(searchParams.category)?.trim();
  const seriesSlug = firstParam(searchParams.series)?.trim() ?? "";
  const searchQuery = normalizePublicContentSearchQuery(
    firstParam(searchParams.q),
  );
  const requestedPage = Number(firstParam(searchParams.page) ?? "1");
  const listingConfig = asTopicsListingConfig(block?.template.config);
  const configuredCategorySlug = listingConfig.collection.type === "category"
    ? listingConfig.collection.categorySlug
    : "";
  const categorySlug = requestedCategorySlug ?? configuredCategorySlug;
  const listing = await loadPublicTopicsListing({
    sort,
    categorySlug: categorySlug || undefined,
    seriesSlug: seriesSlug || undefined,
    page: Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1,
    itemsPerPage: listingConfig.itemLimit,
    search: searchQuery,
    excludeIds: searchQuery ? [] : [...(context.excludeContentIds ?? [])],
  });
  const topics = listing.visibleTopics;
  const totalCount = listing.totalRegularTopics;
  const currentPage = listing.currentPage;
  const totalPages = listing.totalPages;
  const startIndex = listing.startIndex;
  const endIndex = listing.endIndex;
  const isSearching = searchQuery.length > 0;
  const hasResults = isSearching ? topics.length > 0 : totalCount > 0;
  const displayedTotalCount = isSearching
    ? Math.max(totalCount, topics.length)
    : totalCount;
  const pageQuery = buildTopicsQuery(sort, categorySlug, seriesSlug);

  return (
    <div
      className="space-y-7 text-right"
      dir="rtl"
      data-topics-listing-assignment={block?.assignmentId ?? "fallback"}
      data-topics-listing-public-path={context.publicPath}
    >
      {context.showCompositionError ? (
        <p
          role="status"
          className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/55"
        >
          تعذر تحميل بعض أقسام الصفحة حاليًا. المحتوى الأساسي متاح أدناه.
        </p>
      ) : null}

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
                  href={`${context.publicPath}?${new URLSearchParams(buildTopicsQuery("latest", categorySlug, seriesSlug)).toString()}`}
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
                  href={`${context.publicPath}?${new URLSearchParams(buildTopicsQuery("oldest", categorySlug, seriesSlug)).toString()}`}
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

          <TopicsListingModule topics={topics} config={listingConfig} />

          {!isSearching ? (
            <PublicPagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={context.publicPath}
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
