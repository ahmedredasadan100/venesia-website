import type { SearchPlatformSearchParams } from "../search-platform/SearchPlatformModule";
import { normalizePublicContentSearchQuery } from "../../lib/content/public-content-read";
import { getMediaListingPage } from "../../lib/media-center";
import { getMediaListingPageConfigForContentType } from "../../lib/media-center/listing-page-config";
import { resolveMediaListingConfig } from "../../lib/media-hub-modules/listing-presentation";
import type { MediaHubModuleState } from "../../lib/media-hub-modules/types";
import MediaListingContent from "./MediaListingContent";

type MediaListingModuleProps = {
  module: MediaHubModuleState;
  publicPath: string;
  searchParams?: SearchPlatformSearchParams;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Assignment-scoped Media Listing renderer used by canonical Page Composition. */
export default async function MediaListingModule({
  module,
  publicPath,
  searchParams = {},
}: MediaListingModuleProps) {
  const resolved = resolveMediaListingConfig(module);
  if (!resolved) return null;

  const presentation = resolved.presentation;
  const copy = getMediaListingPageConfigForContentType(resolved.contentType);
  const sort = firstParam(searchParams.sort) === "oldest" ? "oldest" : "newest";
  const searchQuery = normalizePublicContentSearchQuery(firstParam(searchParams.q));
  const rawPage = Number(firstParam(searchParams.page) ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0
    ? Math.floor(rawPage)
    : 1;
  const listing = await getMediaListingPage({
    type: resolved.contentType,
    page: searchQuery ? 1 : requestedPage,
    sort,
    pageSize: presentation.itemLimit,
    search: searchQuery,
  });

  return (
    <div
      data-media-listing-assignment={resolved.assignmentId}
      data-media-listing-content-type={resolved.contentType}
      data-media-listing-public-path={publicPath}
    >
      <MediaListingContent
        items={listing.items}
        searchQuery={searchQuery}
        currentPage={listing.currentPage}
        totalPages={listing.totalPages}
        totalCount={listing.totalRegular}
        sort={sort}
        basePath={publicPath}
        emptyTitle={copy.emptyTitle}
        emptyDescription={copy.emptyDescription}
        itemsLabel={copy.itemsLabel}
        presentation={presentation.presentation}
        itemsPerRow={presentation.itemsPerRow}
        itemLimit={presentation.itemLimit}
        displayOverrides={presentation.display}
      />
    </div>
  );
}
