import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import type { SearchPlatformSearchParams } from "../../../components/search-platform/SearchPlatformModule";
import MediaCenterShellLayout from "../../../components/media-center/MediaCenterShellLayout";
import { getPublicPageRoute } from "../../../lib/admin/links/static-routes";

export const revalidate = 300;

const PAGE_IDENTITY = getPublicPageRoute("media-center");

export async function generateMetadata() {
  return generatePublicMetadata({ path: PAGE_IDENTITY.href });
}

type MediaCenterPageProps = {
  searchParams?: Promise<SearchPlatformSearchParams>;
};

export default async function MediaCenterPage({
  searchParams,
}: MediaCenterPageProps) {
  const [composition, resolvedSearchParams] = await Promise.all([
    loadPageCompositionBySlug(PAGE_IDENTITY.cmsPageSlug),
    searchParams ?? Promise.resolve({}),
  ]);

  return (
    <MediaCenterShellLayout
      pageIdentity={PAGE_IDENTITY}
      composition={composition}
      searchParams={resolvedSearchParams}
    />
  );
}
