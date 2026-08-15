import MediaFeaturedHero from "./MediaFeaturedHero";
import MediaCenterShellLayout from "./MediaCenterShellLayout";
import MediaListingContent from "./MediaListingContent";
import MediaPageShell from "./MediaPageShell";
import {
  getMediaHref,
  getMediaListingPage,
} from "../../lib/media-center";
import { normalizePublicContentSearchQuery } from "../../lib/content/public-content-read";
import {
  MEDIA_LISTING_PAGE_CONFIG,
  type MediaListingPageKey,
} from "../../lib/media-center/listing-page-config";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { resolveMediaListingPresentation } from "../../lib/media-hub-modules/listing-presentation";

type MediaListingPageProps = {
  configKey: MediaListingPageKey;
  searchParams?: Promise<{
    page?: string;
    sort?: string;
    q?: string;
  }>;
};

export default async function MediaListingPage({ configKey, searchParams }: MediaListingPageProps) {
  const config = MEDIA_LISTING_PAGE_CONFIG[configKey];
  const [params, composition] = await Promise.all([
    searchParams ?? Promise.resolve(undefined),
    loadPageCompositionBySlug(config.cmsPageSlug, "stack"),
  ]);
  if (!composition.mediaSidebarModules) return null;

  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const searchQuery = normalizePublicContentSearchQuery(params?.q);
  const rawPage = Number(params?.page ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const presentation = resolveMediaListingPresentation(
    composition.mediaHubModules,
    config.mediaType,
  );
  const pickFeatured =
    !searchQuery &&
    (presentation.featuredMode === "automatic" ||
      (presentation.featuredMode === "manual" && Boolean(presentation.manualTopicId)));
  const featuredTopicId = presentation.featuredMode === "manual"
    ? presentation.manualTopicId ?? undefined
    : undefined;

  const listing = await getMediaListingPage({
    type: config.mediaType,
    page: presentation.paginationEnabled ? requestedPage : 1,
    sort,
    pageSize: presentation.pageSize,
    pickFeatured,
    featuredTopicId,
    search: searchQuery,
  });

  const featuredItem = pickFeatured ? listing.featured : null;
  const searchSuggestions = searchQuery
    ? listing.items.slice(0, 8).map((item) => ({
        id: `${item.type}:${item.id}`,
        title: item.title,
        href: getMediaHref(item),
        meta: [item.category, item.series].filter(Boolean).join(" · ") || undefined,
      }))
    : [];

  return (
    <MediaCenterShellLayout cmsPageSlug={config.cmsPageSlug} composition={composition}>
      <MediaPageShell
        sidebarModules={composition.mediaSidebarModules}
        searchBasePath={config.basePath}
        searchQuery={searchQuery}
        searchSuggestions={searchSuggestions}
        searchResultCount={listing.totalRegular}
      >
        <MediaListingContent
          items={listing.items}
          searchQuery={searchQuery}
          currentPage={listing.currentPage}
          totalPages={listing.totalPages}
          totalCount={listing.totalRegular}
          sort={sort}
          basePath={config.basePath}
          emptyTitle={config.emptyTitle}
          emptyDescription={config.emptyDescription}
          cardCtaText={presentation.cardCtaText}
          itemsLabel={config.itemsLabel}
          layout={presentation.layout}
          columns={presentation.columns}
          paginationEnabled={presentation.paginationEnabled}
          cardVariant={presentation.cardVariant}
        >
          {featuredItem ? (
            <MediaFeaturedHero
              item={featuredItem}
              ctaText={presentation.featuredCtaText}
            />
          ) : null}
        </MediaListingContent>
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
