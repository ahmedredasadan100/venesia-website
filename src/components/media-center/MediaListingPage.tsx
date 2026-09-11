import MediaCenterShellLayout from "./MediaCenterShellLayout";
import {
  MEDIA_LISTING_PAGE_CONFIG,
  type MediaListingPageKey,
} from "../../lib/media-center/listing-page-config";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { resolvePublicContentPageRoute } from "../../lib/content/public-content-path";

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
  const pageIdentity = resolvePublicContentPageRoute(config.mediaType);
  const [params, composition] = await Promise.all([
    searchParams ?? Promise.resolve(undefined),
    loadPageCompositionBySlug(pageIdentity.cmsPageSlug),
  ]);

  return (
    <MediaCenterShellLayout
      pageIdentity={pageIdentity}
      composition={composition}
      searchParams={params}
    />
  );
}
