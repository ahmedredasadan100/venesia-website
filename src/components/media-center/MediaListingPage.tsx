import FeaturedNews from "./FeaturedNews";
import MediaCenterShellLayout from "./MediaCenterShellLayout";
import MediaListingContent from "./MediaListingContent";
import MediaPageShell from "./MediaPageShell";
import {
  getMediaHref,
  getMediaListingPage,
  MEDIA_LISTING_PAGE_SIZE,
} from "../../lib/media-center";
import { normalizePublicContentSearchQuery } from "../../lib/content/public-content-read";
import {
  MEDIA_LISTING_PAGE_CONFIG,
  type MediaListingPageKey,
} from "../../lib/media-center/listing-page-config";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";

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
  const params = await searchParams;

  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const searchQuery = normalizePublicContentSearchQuery(params?.q);
  const rawPage = Number(params?.page ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pickFeatured =
    !searchQuery && "showFeaturedNews" in config && Boolean(config.showFeaturedNews);

  const [listing, composition] = await Promise.all([
    getMediaListingPage({
      type: config.mediaType,
      page: requestedPage,
      sort,
      pageSize: MEDIA_LISTING_PAGE_SIZE,
      pickFeatured,
      search: searchQuery,
    }),
    loadPageCompositionBySlug(config.cmsPageSlug, "stack"),
  ]);
  if (!composition.mediaSidebarModules) return null;

  const featuredNews = pickFeatured ? listing.featured : null;
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
          title={config.title}
          eyebrow={config.eyebrow}
          description={config.description}
          emptyTitle={config.emptyTitle}
          emptyDescription={config.emptyDescription}
          actionLabel={config.actionLabel}
          itemsLabel={config.itemsLabel}
        >
          {featuredNews ? <FeaturedNews item={featuredNews} /> : null}
        </MediaListingContent>
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
