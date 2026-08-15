import type { MediaCenterCmsPageSlug } from "../../lib/media-center-page-config";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

const LEGACY_LISTING_SHELL_TITLE = "Listing shell";
const LEGACY_LISTING_SHELL_SUBTITLE_PREFIX =
  "Publish or replace to show CMS content above";

type MediaListingShellBlock = Extract<
  ResolvedPageBlock,
  { blockType: "content" }
>;

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
  return (
    (config.eyebrow ?? "").trim() === "" &&
    (config.body ?? "").trim() === "" &&
    isLegacyListingShellTitle(config.title) &&
    isLegacyListingShellSubtitle(config.subtitle)
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
