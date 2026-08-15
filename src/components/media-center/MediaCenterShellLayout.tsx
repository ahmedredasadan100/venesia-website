import InternalPageLayout from "../InternalPageLayout";
import SlotModulesRenderer from "../page-composition/SlotModulesRenderer";
import { findHeroInComposition, getSlotBlocks } from "../../lib/page-blocks/page-composition-utils";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import {
  getMediaCenterCmsPageConfig,
  type MediaCenterCmsPageSlug,
} from "../../lib/media-center-page-config";
import { MediaCenterCmsBlocksProvider } from "./MediaCenterCmsBlocksContext";
import { resolveMediaListingMainBlocks } from "./media-listing-shell-model";

type MediaCenterShellLayoutProps = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  composition: PageComposition;
  breadcrumbCurrentLabel?: string;
  children: React.ReactNode;
};

function MediaListingShellPlaceholder() {
  return (
    <section
      className="relative py-16 text-right md:py-20"
      data-media-listing-shell-placeholder="true"
    >
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-white md:text-4xl">
          Listing shell
        </h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-8 text-white/60 md:text-base">
          Publish or replace to show CMS content above the listing.
        </p>
      </div>
    </section>
  );
}

/**
 * CMS-aware shell for Media Center listing routes.
 * Hero from hero_assignments; optional main/bottom blocks inside the content card.
 */
export default async function MediaCenterShellLayout({
  cmsPageSlug,
  composition,
  breadcrumbCurrentLabel,
  children,
}: MediaCenterShellLayoutProps) {
  const config = getMediaCenterCmsPageConfig(cmsPageSlug);
  const heroEntry = findHeroInComposition(composition);
  const mainBlocks = getSlotBlocks(composition, "main");
  const bottomBlocks = getSlotBlocks(composition, "bottom");
  const listingMainBlocks = resolveMediaListingMainBlocks(cmsPageSlug, mainBlocks);
  const showListingPlaceholder =
    cmsPageSlug !== "media-center" &&
    mainBlocks.length === 0 &&
    !composition.hasCompositionError;

  const prefixBlocks =
    listingMainBlocks.length > 0 ? (
      <SlotModulesRenderer blocks={listingMainBlocks} />
    ) : showListingPlaceholder ? (
      <MediaListingShellPlaceholder />
    ) : undefined;
  const suffixBlocks =
    bottomBlocks.length > 0 ? <SlotModulesRenderer blocks={bottomBlocks} /> : undefined;

  return (
    <InternalPageLayout
      title=""
      heroImage={config.heroImage}
      heroImagePositionClassName={config.heroImagePositionClassName}
      dynamicHero={heroEntry?.hero}
      allowStaticHeroFallback={false}
      breadcrumbCurrentLabel={breadcrumbCurrentLabel}
    >
      <MediaCenterCmsBlocksProvider prefixBlocks={prefixBlocks} suffixBlocks={suffixBlocks}>
        {children}
      </MediaCenterCmsBlocksProvider>
    </InternalPageLayout>
  );
}
