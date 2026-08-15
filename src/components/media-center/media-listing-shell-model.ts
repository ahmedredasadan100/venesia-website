import type { MediaCenterCmsPageSlug } from "../../lib/media-center-page-config";
import type { ResolvedPageBlock } from "../../lib/page-blocks/types";

export function isMediaListingShellPlaceholder(block: ResolvedPageBlock) {
  if (block.blockType !== "content" || !block.template.slug.endsWith("-listing-shell")) {
    return false;
  }

  const config = block.template.config;
  return (
    (config.eyebrow ?? "").trim() === "" &&
    (config.body ?? "").trim() === "" &&
    (config.title ?? "").trim() === "Listing shell" &&
    (config.subtitle ?? "").trim().startsWith("Publish or replace to show CMS content above")
  );
}

export function resolveMediaListingMainBlocks(
  cmsPageSlug: MediaCenterCmsPageSlug,
  mainBlocks: ResolvedPageBlock[],
) {
  if (cmsPageSlug === "media-center") return mainBlocks;

  const configuredBlocks = mainBlocks.filter(
    (block) => !isMediaListingShellPlaceholder(block),
  );
  if (configuredBlocks.length > 0) return configuredBlocks;

  const placeholderBlock = mainBlocks.find(isMediaListingShellPlaceholder);
  return placeholderBlock ? [placeholderBlock] : [];
}
