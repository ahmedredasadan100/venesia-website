import Image from "next/image";
import Link from "next/link";

import {
  CONTENT_TYPES,
  getContentTypeLabel,
  isContentType,
  type ContentType,
} from "../../lib/admin/content/content-types";
import {
  normalizePublicContentSearchQuery,
  type PublicContentCollectionResult,
  type PublicContentSearchSuggestion,
  type PublicContentSummary,
} from "../../lib/content/public-content-read";
import {
  loadPublicContentCollection,
  loadPublicContentFilterOptions,
} from "../../lib/content/public-content-read/owner";
import {
  asSearchPlatformConfig,
  type SearchPlatformConfig,
} from "../../lib/page-blocks/search-platform-config";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";
import PublicPagination from "../Pagination";
import PublicContentSearchInput from "../public/PublicContentSearchInput";

export type SearchPlatformSearchParams = Readonly<
  Record<string, string | string[] | undefined>
>;

type SearchPlatformModuleProps = {
  block: Extract<ResolvedPageBlock, { blockType: "content" }>;
  publicPath?: string;
  searchParams?: SearchPlatformSearchParams;
};

const EMPTY_RESULT: PublicContentCollectionResult = {
  featured: null,
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 12,
  totalPages: 1,
  startIndex: 0,
  endIndex: 0,
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0]?.trim() ?? "" : value?.trim() ?? "";
}

function listParam(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean))];
}

function resolveScopedContentTypes(
  config: SearchPlatformConfig,
  params: SearchPlatformSearchParams,
) {
  const configured = config.scope === "all"
    ? [...CONTENT_TYPES]
    : config.contentTypes;
  const requestedScope = listParam(params.types).filter(isContentType);
  const scoped = requestedScope.length
    ? configured.filter((contentType) => requestedScope.includes(contentType))
    : configured;
  const requestedType = firstParam(params.type);

  if (isContentType(requestedType) && scoped.includes(requestedType)) {
    return {
      available: scoped,
      selected: [requestedType] as ContentType[],
    };
  }

  return {
    available: scoped.length ? scoped : configured,
    selected: scoped.length ? scoped : configured,
  };
}

function SearchResultCard({
  item,
  presentation,
}: {
  item: PublicContentSummary;
  presentation: "full-list" | "full-grid";
}) {
  const isList = presentation === "full-list";

  return (
    <article
      className={[
        "group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] transition hover:border-[#D8B87A]/30 hover:bg-white/[0.05]",
        isList ? "grid gap-0 md:grid-cols-[15rem_minmax(0,1fr)]" : "flex h-full flex-col",
      ].join(" ")}
      data-search-result-type={item.contentType}
    >
      <Link
        href={item.href}
        className={[
          "relative block overflow-hidden bg-white/[0.03]",
          isList ? "min-h-48 md:min-h-full" : "aspect-[16/10]",
        ].join(" ")}
      >
        <Image
          src={item.image}
          alt={item.imageAlt || item.title}
          fill
          sizes={isList ? "(max-width: 768px) 100vw, 240px" : "(max-width: 768px) 100vw, 33vw"}
          className="object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/55 via-transparent to-transparent" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-6 text-right">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#D8B87A]/75">
          <span>{getContentTypeLabel(item.contentType)}</span>
          {item.category ? <span>· {item.category}</span> : null}
          {item.series ? <span>· {item.series}</span> : null}
        </div>
        <h3 className="mt-3 text-xl font-semibold leading-8 text-white">
          <Link href={item.href} className="transition hover:text-[#D8B87A]">
            {item.title}
          </Link>
        </h3>
        {item.excerpt ? (
          <p className="mt-3 line-clamp-3 leading-7 text-white/55">
            {item.excerpt}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5 text-sm">
          <span className="text-white/38">{item.date}</span>
          <Link href={item.href} className="text-[#D8B87A] transition hover:text-white">
            عرض المحتوى
          </Link>
        </div>
      </div>
    </article>
  );
}

function SearchLauncher({
  config,
  publicPath,
  scopeParam,
  query,
  suggestions,
  resultCount,
}: {
  config: SearchPlatformConfig;
  publicPath: string;
  scopeParam?: string;
  query: string;
  suggestions: readonly PublicContentSearchSuggestion[];
  resultCount: number;
}) {
  const compact = config.presentation === "compact";

  return (
    <section
      className={[
        "border border-white/10 bg-white/[0.035] text-right shadow-[0_20px_70px_rgba(0,0,0,0.18)]",
        compact ? "rounded-[1.5rem] p-5" : "rounded-[2rem] p-7 md:p-10",
      ].join(" ")}
      dir="rtl"
      data-search-platform-module="launcher"
      data-search-platform-scope={scopeParam ?? ""}
    >
      <p className="text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70">Search</p>
      <h2 className={`${compact ? "mt-2 text-xl" : "mt-3 text-3xl"} font-semibold text-white`}>
        {config.title}
      </h2>
      {config.description ? (
        <p className="mt-3 leading-7 text-white/50">{config.description}</p>
      ) : null}
      <div className="mt-5">
        <PublicContentSearchInput
          basePath={publicPath}
          submitPath="/search"
          submitPersistentParams={{ types: scopeParam }}
          query={query}
          suggestions={suggestions}
          resultCount={resultCount}
          placeholder={config.placeholder}
          ariaLabel={config.title}
          helpText={config.helpText}
        />
      </div>
    </section>
  );
}

function SearchFilters({
  config,
  query,
  scopeParam,
  availableTypes,
  selectedType,
  selectedCategory,
  selectedSeries,
  selectedSort,
  categories,
  series,
}: {
  config: SearchPlatformConfig;
  query: string;
  scopeParam?: string;
  availableTypes: readonly ContentType[];
  selectedType: string;
  selectedCategory: string;
  selectedSeries: string;
  selectedSort: "newest" | "oldest";
  categories: readonly { slug: string; name: string }[];
  series: readonly { slug: string; name: string }[];
}) {
  const filterClassName =
    "h-11 w-full rounded-xl border border-white/10 bg-[#070A0F] px-3 text-sm text-white outline-none transition focus:border-[#D8B87A]/45 focus:ring-2 focus:ring-[#D8B87A]/10";

  return (
    <form action="/search" method="get" className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-5 md:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="q" value={query} />
      {scopeParam ? <input type="hidden" name="types" value={scopeParam} /> : null}

      {config.filters.includes("content-type") && availableTypes.length > 1 ? (
        <label className="space-y-2 text-sm text-white/60">
          <span className="block">نوع المحتوى</span>
          <select name="type" defaultValue={selectedType} className={filterClassName}>
            <option value="">كل الأنواع</option>
            {availableTypes.map((contentType) => (
              <option key={contentType} value={contentType}>
                {getContentTypeLabel(contentType)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {config.filters.includes("category") ? (
        <label className="space-y-2 text-sm text-white/60">
          <span className="block">التصنيف</span>
          <select name="category" defaultValue={selectedCategory} className={filterClassName}>
            <option value="">كل التصنيفات</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      {config.filters.includes("series") ? (
        <label className="space-y-2 text-sm text-white/60">
          <span className="block">السلسلة</span>
          <select name="series" defaultValue={selectedSeries} className={filterClassName}>
            <option value="">كل السلاسل</option>
            {series.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="space-y-2 text-sm text-white/60">
        <span className="block">الترتيب</span>
        <select name="sort" defaultValue={selectedSort} className={filterClassName}>
          <option value="newest">الأحدث</option>
          <option value="oldest">الأقدم</option>
        </select>
      </label>

      <div className="flex items-end gap-3 md:col-span-2 xl:col-span-4">
        <button type="submit" className="rounded-xl bg-[#D8B87A] px-5 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#E4C98F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70">
          تطبيق الفلاتر
        </button>
        <Link
          href={`/search?${new URLSearchParams({ q: query, ...(scopeParam ? { types: scopeParam } : {}) }).toString()}`}
          scroll={false}
          className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white/55 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
        >
          مسح الفلاتر
        </Link>
      </div>
    </form>
  );
}

export default async function SearchPlatformModule({
  block,
  publicPath,
  searchParams = {},
}: SearchPlatformModuleProps) {
  const config = asSearchPlatformConfig(block.template.config);
  const configuredScope = config.scope === "all" ? [...CONTENT_TYPES] : config.contentTypes;
  const requestedScope = listParam(searchParams.types).filter(isContentType);
  const activeScope = requestedScope.length
    ? configuredScope.filter((contentType) => requestedScope.includes(contentType))
    : configuredScope;
  const scopeParam = activeScope.length === CONTENT_TYPES.length
    ? undefined
    : activeScope.join(",");
  const query = normalizePublicContentSearchQuery(firstParam(searchParams.q));

  if (publicPath !== "/search" || config.presentation === "compact") {
    const listing = query
      ? await loadPublicContentCollection({
          contentTypes: activeScope.length ? activeScope : configuredScope,
          search: query,
          page: 1,
          pageSize: 8,
          sort: config.defaultSort,
        })
      : EMPTY_RESULT;
    const suggestions: PublicContentSearchSuggestion[] = listing.items.map((item) => ({
      id: `${item.contentType}:${item.id}`,
      title: item.title,
      href: item.href,
      meta: [getContentTypeLabel(item.contentType), item.category, item.series]
        .filter(Boolean)
        .join(" · "),
    }));

    return (
      <SearchLauncher
        config={config}
        publicPath={publicPath || "/search"}
        scopeParam={scopeParam}
        query={query}
        suggestions={suggestions}
        resultCount={listing.totalCount}
      />
    );
  }

  const scope = resolveScopedContentTypes(config, searchParams);
  const selectedType = firstParam(searchParams.type);
  const selectedCategory = config.filters.includes("category")
    ? firstParam(searchParams.category)
    : "";
  const selectedSeries = config.filters.includes("series")
    ? firstParam(searchParams.series)
    : "";
  const selectedSort = firstParam(searchParams.sort) === "oldest"
    ? "oldest"
    : config.defaultSort;
  const requestedPage = Math.max(1, Math.floor(Number(firstParam(searchParams.page))) || 1);

  const [listing, filterOptions] = await Promise.all([
    query
      ? loadPublicContentCollection({
          contentTypes: scope.selected,
          search: query,
          page: requestedPage,
          pageSize: config.resultLimit,
          sort: selectedSort,
          categorySlugs: selectedCategory ? [selectedCategory] : [],
          seriesSlug: selectedSeries,
        })
      : Promise.resolve({ ...EMPTY_RESULT, pageSize: config.resultLimit }),
    config.filters.includes("category") || config.filters.includes("series")
      ? loadPublicContentFilterOptions()
      : Promise.resolve({ categories: [], series: [] }),
  ]);
  const suggestions: PublicContentSearchSuggestion[] = query
    ? listing.items.slice(0, 8).map((item) => ({
        id: `${item.contentType}:${item.id}`,
        title: item.title,
        href: item.href,
        meta: [getContentTypeLabel(item.contentType), item.category, item.series]
          .filter(Boolean)
          .join(" · "),
      }))
    : [];
  const paginationQuery = {
    q: query,
    types: scopeParam,
    type: isContentType(selectedType) ? selectedType : undefined,
    category: selectedCategory || undefined,
    series: selectedSeries || undefined,
    sort: selectedSort,
  };
  const presentation = config.presentation === "full-list" ? "full-list" : "full-grid";

  return (
    <section className="space-y-7 py-4 text-right" dir="rtl" data-search-platform-module="results">
      <header className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-10">
        <p className="text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70">Search Platform</p>
        <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{config.title}</h2>
        {config.description ? <p className="mt-4 max-w-3xl leading-8 text-white/55">{config.description}</p> : null}
        <div className="mt-6 max-w-3xl">
          <PublicContentSearchInput
            basePath="/search"
            persistentParams={{ types: scopeParam }}
            query={query}
            suggestions={suggestions}
            resultCount={listing.totalCount}
            placeholder={config.placeholder}
            ariaLabel={config.title}
            helpText={config.helpText}
          />
        </div>
      </header>

      {query ? (
        <SearchFilters
          config={config}
          query={query}
          scopeParam={scopeParam}
          availableTypes={scope.available}
          selectedType={selectedType}
          selectedCategory={selectedCategory}
          selectedSeries={selectedSeries}
          selectedSort={selectedSort}
          categories={filterOptions.categories}
          series={filterOptions.series}
        />
      ) : null}

      {query ? (
        listing.items.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.025] px-5 py-4 text-sm text-white/50">
              <span>عرض {listing.startIndex + 1}-{listing.endIndex} من {listing.totalCount} نتيجة</span>
              <span className="text-[#D8B87A]/75">البحث عن: {query}</span>
            </div>
            <div className={presentation === "full-list" ? "space-y-5" : "grid gap-6 md:grid-cols-2 xl:grid-cols-3"}>
              {listing.items.map((item) => (
                <SearchResultCard key={`${item.contentType}:${item.id}`} item={item} presentation={presentation} />
              ))}
            </div>
            <PublicPagination
              currentPage={listing.page}
              totalPages={listing.totalPages}
              basePath="/search"
              query={paginationQuery}
              ariaLabel="صفحات نتائج البحث"
            />
          </>
        ) : (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">Search Results</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">لا توجد نتائج مطابقة</h2>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-white/55">جرّب كلمة مختلفة أو خفّف الفلاتر الحالية.</p>
          </div>
        )
      ) : (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-white/45">
          اكتب كلمة البحث لعرض النتائج.
        </div>
      )}
    </section>
  );
}
