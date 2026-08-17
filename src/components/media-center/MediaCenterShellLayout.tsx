import InternalPageLayout from "../InternalPageLayout";
import SlotModulesRenderer from "../page-composition/SlotModulesRenderer";
import { findHeroInComposition, getSlotBlocks } from "../../lib/page-blocks/page-composition-utils";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import {
  getMediaCenterCmsPageConfig,
  type MediaCenterCmsPageSlug,
} from "../../lib/media-center-page-config";
import { MediaCenterCmsBlocksProvider } from "./MediaCenterCmsBlocksContext";

type MediaCenterShellLayoutProps = {
  cmsPageSlug: MediaCenterCmsPageSlug;
  composition: PageComposition;
  breadcrumbCurrentLabel?: string;
  children: React.ReactNode;
};

/**
 * CMS-aware layout for Media Center routes.
 * Hero and optional generic main/bottom blocks keep their existing owners.
 */
export default function MediaCenterShellLayout({
  cmsPageSlug,
  composition,
  breadcrumbCurrentLabel,
  children,
}: MediaCenterShellLayoutProps) {
  const config = getMediaCenterCmsPageConfig(cmsPageSlug);
  const heroEntry = findHeroInComposition(composition);
  const mainBlocks = getSlotBlocks(composition, "main");
  const bottomBlocks = getSlotBlocks(composition, "bottom");
  const prefixBlocks = mainBlocks.length > 0
    ? <SlotModulesRenderer blocks={mainBlocks} />
    : undefined;
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
