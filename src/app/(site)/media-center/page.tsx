import MediaCenterGrid from "../../../components/media-center/MediaCenterGrid";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { findHeroInComposition } from "../../../lib/page-blocks/page-composition-utils";
import { getHeroSectionState } from "../../../lib/load-hero-section";
import { getMediaCenterCmsPageConfig } from "../../../lib/media-center-page-config";
import InternalPageLayout from "../../../components/InternalPageLayout";
import { buildMetadata } from "../../../lib/seo/build-metadata";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/media-center" });

const CMS_PAGE_SLUG = "media-center" as const;

export default async function MediaCenterPage() {
  const config = getMediaCenterCmsPageConfig(CMS_PAGE_SLUG);
  const [heroState, composition] = await Promise.all([
    getHeroSectionState(CMS_PAGE_SLUG),
    loadPageCompositionBySlug(CMS_PAGE_SLUG, "stack"),
  ]);

  const heroEntry = findHeroInComposition(composition);
  const dynamicHero = heroEntry?.hero ?? heroState.hero;
  const allowStaticHeroFallback =
    heroState.visibility === "none" && !dynamicHero;

  return (
    <InternalPageLayout
      title={config.title}
      eyebrow={config.eyebrow}
      subtitle={config.subtitle}
      heroImage={config.heroImage}
      heroImagePositionClassName={config.heroImagePositionClassName}
      dynamicHero={dynamicHero}
      allowStaticHeroFallback={allowStaticHeroFallback}
    >
      <PageSlotLayout
        composition={composition}
        skipSlots={["hero"]}
        mainAfter={<MediaCenterGrid />}
      />
    </InternalPageLayout>
  );
}
