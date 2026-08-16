import type { MediaCenterCmsPageSlug } from "../../lib/media-center-page-config";
import type {
  PageBlockPublicState,
  ResolvedPageBlock,
} from "../../lib/page-blocks/types";

const LEGACY_LISTING_SHELL_TITLE = "Listing shell";
const LEGACY_LISTING_SHELL_SUBTITLE_PREFIX =
  "Publish or replace to show CMS content above";

type MediaListingShellBlock = Extract<
  ResolvedPageBlock,
  { blockType: "content" }
>;

/**
 * The assigned Listing Shell is the publication switch for listing routes.
 * Assignment visibility still controls the optional authored prefix itself;
 * template publication controls whether the listing runtime may render.
 */
export function isMediaListingShellPublished(
  cmsPageSlug: MediaCenterCmsPageSlug,
  blockStates: readonly PageBlockPublicState[],
) {
  if (cmsPageSlug === "media-center") return true;

  const expectedSlug = `${cmsPageSlug}-listing-shell`;
  const shell = blockStates.find(
    (state) =>
      state.blockType === "content" && state.templateSlug === expectedSlug,
  );
  return shell?.templatePublished ?? false;
}

function isMediaListingShellBlock(
  block: ResolvedPageBlock,
): block is MediaListingShellBlock {
  return (
    block.blockType === "content" &&
    block.template.slug.endsWith("-listing-shell")
  );
}

function isLegacyListingShellTitle(value: string | undefined) {
  return (value ?? "").trim() === LEGACY_LISTING_SHELL_TITLE;
}

function isLegacyListingShellSubtitle(value: string | undefined) {
  return (value ?? "")
    .trim()
    .startsWith(LEGACY_LISTING_SHELL_SUBTITLE_PREFIX);
}

export function isMediaListingShellPlaceholder(block: ResolvedPageBlock) {
  if (!isMediaListingShellBlock(block)) {
    return false;
  }

  const config = block.template.config;
  const managedTitle = isLegacyListingShellTitle(config.title)
    ? ""
    : (config.title ?? "").trim();
  const managedSubtitle = isLegacyListingShellSubtitle(config.subtitle)
    ? ""
    : (config.subtitle ?? "").trim();

  return [config.eyebrow, managedTitle, managedSubtitle, config.body].every(
    (value) => (value ?? "").trim() === "",
  );
}

function removeLegacyListingShellFallbacks(
  block: ResolvedPageBlock,
): ResolvedPageBlock {
  if (!isMediaListingShellBlock(block)) return block;

  const config = block.template.config;
  return {
    ...block,
    template: {
      ...block.template,
      config: {
        ...config,
        title: isLegacyListingShellTitle(config.title) ? "" : config.title,
        subtitle: isLegacyListingShellSubtitle(config.subtitle)
          ? ""
          : config.subtitle,
      },
    },
  };
}

export function resolveMediaListingMainBlocks(
  cmsPageSlug: MediaCenterCmsPageSlug,
  mainBlocks: ResolvedPageBlock[],
) {
  if (cmsPageSlug === "media-center") return mainBlocks;

  return mainBlocks.flatMap((block) =>
    isMediaListingShellPlaceholder(block)
      ? []
      : [removeLegacyListingShellFallbacks(block)],
  );
}
