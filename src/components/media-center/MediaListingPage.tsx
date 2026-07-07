import FeaturedNews from "./FeaturedNews";
import MediaCenterShellLayout from "./MediaCenterShellLayout";
import MediaListingContent from "./MediaListingContent";
import MediaPageShell from "./MediaPageShell";
import { getMediaItems } from "../../lib/media-center";
import {
  MEDIA_LISTING_PAGE_CONFIG,
  type MediaListingPageKey,
} from "../../lib/media-center/listing-page-config";
import { loadMediaCenterSidebarProps } from "../../lib/media-sidebar-modules/load-media-sidebar-modules";

type MediaListingPageProps = {
  configKey: MediaListingPageKey;
  searchParams?: Promise<{
    page?: string;
    sort?: string;
  }>;
};

export default async function MediaListingPage({ configKey, searchParams }: MediaListingPageProps) {
  const config = MEDIA_LISTING_PAGE_CONFIG[configKey];
  const params = await searchParams;

  const sort = params?.sort === "oldest" ? "oldest" : "newest";
  const rawPage = Number(params?.page ?? "1");
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const [items, sidebarProps] = await Promise.all([
    getMediaItems(config.mediaType),
    loadMediaCenterSidebarProps(config.cmsPageSlug),
  ]);

  const featuredNews =
    config.showFeaturedNews ? items.find((item) => item.featured) ?? items[0] ?? null : null;
  const regularItems = featuredNews
    ? items.filter((item) => item.slug !== featuredNews.slug)
    : items;

  return (
    <MediaCenterShellLayout cmsPageSlug={config.cmsPageSlug}>
      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
        <MediaListingContent
          items={regularItems}
          currentPage={currentPage}
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
