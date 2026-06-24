import InternalPageLayout from "../InternalPageLayout";
import SlotModulesRenderer from "../page-composition/SlotModulesRenderer";
import { getHeroSectionState } from "../../lib/load-hero-section";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { getSlotBlocks } from "../../lib/page-blocks/page-composition-utils";
import {
  getMediaCenterCmsPageConfig,
  type MediaCenterCmsPageSlug,
} from "../../lib/media-center-page-config";
import { MediaCenterCmsBlocksProvider } from "./MediaCenterCmsBlocksContext";

type MediaCenterShellLayoutProps = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  breadcrumbCurrentLabel?: string;
  children: React.ReactNode;
};

/**
 * CMS-aware shell for Media Center listing routes.
 * Hero from hero_assignments; optional main/bottom blocks inside the content card.
 */
export default async function MediaCenterShellLayout({
  cmsPageSlug,
  breadcrumbCurrentLabel,
  children,
}: MediaCenterShellLayoutProps) {
  const config = getMediaCenterCmsPageConfig(cmsPageSlug);
  const [heroState, composition] = await Promise.all([
    getHeroSectionState(cmsPageSlug),
    loadPageCompositionBySlug(cmsPageSlug, "stack"),
  ]);

  const mainBlocks = getSlotBlocks(composition, "main");
  const bottomBlocks = getSlotBlocks(composition, "bottom");

  const prefixBlocks =
    mainBlocks.length > 0 ? <SlotModulesRenderer blocks={mainBlocks} /> : undefined;
  const suffixBlocks =
    bottomBlocks.length > 0 ? <SlotModulesRenderer blocks={bottomBlocks} /> : undefined;

  return (
    <InternalPageLayout
      title={config.title}
      eyebrow={config.eyebrow}
      subtitle={config.subtitle}
      heroImage={config.heroImage}
      heroImagePositionClassName={config.heroImagePositionClassName}
      dynamicHero={heroState.hero}
      allowStaticHeroFallback={heroState.visibility === "none"}
      breadcrumbCurrentLabel={breadcrumbCurrentLabel}
    >
      <MediaCenterCmsBlocksProvider prefixBlocks={prefixBlocks} suffixBlocks={suffixBlocks}>
        {children}
      </MediaCenterCmsBlocksProvider>
    </InternalPageLayout>
  );
}
