import MediaCenterGrid from "../../../components/media-center/MediaCenterGrid";
import PageSlotLayout from "../../../components/page-composition/PageSlotLayout";
import { loadPageCompositionBySlug } from "../../../lib/page-blocks/load-page-composition";
import { findHeroInComposition } from "../../../lib/page-blocks/page-composition-utils";
import { getMediaCenterCmsPageConfig } from "../../../lib/media-center-page-config";
import InternalPageLayout from "../../../components/InternalPageLayout";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/media-center" });
}

const CMS_PAGE_SLUG = "media-center" as const;

export default async function MediaCenterPage() {
  const config = getMediaCenterCmsPageConfig(CMS_PAGE_SLUG);
  const composition = await loadPageCompositionBySlug(CMS_PAGE_SLUG, "stack");

  const heroEntry = findHeroInComposition(composition);

  return (
    <InternalPageLayout
      title=""
      heroImage={config.heroImage}
      dynamicHero={heroEntry?.hero}
      allowStaticHeroFallback={false}
    >
      <PageSlotLayout
        composition={composition}
        skipSlots={["hero"]}
        mainAfter={<MediaCenterGrid composition={composition} />}
      />
    </InternalPageLayout>
  );
}
