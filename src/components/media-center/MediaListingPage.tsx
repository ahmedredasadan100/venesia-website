import MediaCenterShellLayout from "./MediaCenterShellLayout";
import MediaListingContent from "./MediaListingContent";
import MediaPageShell from "./MediaPageShell";
import { MediaSidebarSearch } from "./MediaSidebar";
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
import {
  resolveMediaListingConfig,
} from "../../lib/media-hub-modules/listing-presentation";

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
    loadPageCompositionBySlug(config.cmsPageSlug),
  ]);
  if (!composition.mediaSidebarModules) return null;

  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const searchQuery = normalizePublicContentSearchQuery(params?.q);
  const rawPage = Number(params?.page ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0
    ? Math.floor(rawPage)
    : 1;
  const resolvedModule = resolveMediaListingConfig(
    composition.mediaHubModules,
    config.mediaType,
  );
  const presentation = resolvedModule.presentation;
  const listing = await getMediaListingPage({
    type: resolvedModule.contentType,
    page: searchQuery ? 1 : requestedPage,
    sort,
    pageSize: presentation.itemLimit,
    search: searchQuery,
  });

  const searchSuggestions = searchQuery
    ? listing.items.slice(0, 8).map((item) => ({
        id: `${item.type}:${item.id}`,
        title: item.title,
        href: getMediaHref(item),
        meta: [item.category, item.series].filter(Boolean).join(" · ") || undefined,
      }))
    : [];

  return (
    <MediaCenterShellLayout
      cmsPageSlug={config.cmsPageSlug}
      composition={composition}
      sidebarPrefix={
        <MediaSidebarSearch
          searchBasePath={config.basePath}
          searchQuery={searchQuery}
          searchSuggestions={searchSuggestions}
          searchResultCount={listing.totalRegular}
        />
      }
    >
      <MediaPageShell>
        <div className="space-y-10">
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
            itemsLabel={config.itemsLabel}
            presentation={presentation.presentation}
            itemsPerRow={presentation.itemsPerRow}
            itemLimit={presentation.itemLimit}
            displayOverrides={presentation.display}
          />
        </div>
      </MediaPageShell>
    </MediaCenterShellLayout>
  );
}
