import { notFound } from "next/navigation";

import InternalPageLayout from "../InternalPageLayout";
import PageSlotLayout, {
  PageSlotContent,
} from "../page-composition/PageSlotLayout";
import JsonLd from "../seo/JsonLd";
import TopicViewTracker from "../content/TopicViewTracker";
import { getMediaItemBySlug, getRelatedMediaItems } from "../../lib/media-center";
import { MEDIA_DETAIL_PAGE_CONFIG, type MediaDetailPageKey } from "../../lib/media-center/detail-page-config";
import { loadPageCompositionBySlug } from "../../lib/page-blocks/load-page-composition";
import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";
import { buildPageJsonLd } from "../../lib/seo/build-jsonld";
import { loadResolvedGlobalSeo } from "../../lib/seo/generate-public-metadata";
import MediaDetailArticle from "./MediaDetailArticle";
import MediaPageShell from "./MediaPageShell";
import { MediaSidebarSearch } from "./MediaSidebar";

type MediaDetailPageProps = {
  configKey: MediaDetailPageKey;
  slug: string;
};

export default async function MediaDetailPage({ configKey, slug }: MediaDetailPageProps) {
  const config = MEDIA_DETAIL_PAGE_CONFIG[configKey];
  const itemPromise = getMediaItemBySlug(config.mediaType, slug);
  const compositionPromise = loadPageCompositionBySlug(config.cmsPageSlug);
  const globalSeoPromise = loadResolvedGlobalSeo();

  const [item, composition] = await Promise.all([
    itemPromise,
    compositionPromise,
  ]);

  if (!item) {
    notFound();
  }
  if (!composition.mediaSidebarModules) return null;

  const [relatedItems, globalSeo] = await Promise.all([
    getRelatedMediaItems(config.mediaType, item.topicId ?? Number(item.id), 3),
    globalSeoPromise,
  ]);

  const pagePath = `${config.basePath}/${item.slug}`;
  const content = item.content?.length ? item.content : config.fallbackContent;

  const pageJsonLd = buildPageJsonLd(
    {
      path: pagePath,
      title: item.seoTitle || item.title,
      description: item.seoDescription || item.excerpt,
      type: "article",
      image: item.ogImage || item.image,
      publishedAt: item.publishedAt,
      updatedAt: item.publishedAt,
      breadcrumbs: [
        { name: "الرئيسية", path: "/" },
        { name: "المركز الإعلامي", path: "/media-center" },
        { name: config.breadcrumbSectionLabel, path: config.basePath },
        { name: item.title, path: pagePath },
      ],
    },
    globalSeo,
  );

  return (
    <InternalPageLayout
      title={item.title}
      eyebrow={config.layoutEyebrow}
      subtitle={item.excerpt}
      heroImage={item.image}
      breadcrumbCurrentLabel={item.title}
      showTitle={item.showTitleOnPage !== false}
      showHeroImage={item.showImageOnPage !== false}
      showSubtitle={item.showExcerptOnPage !== false}
      heroSlotContent={
        getSlotEntries(composition, "hero").length ? (
          <PageSlotContent
            entries={getSlotEntries(composition, "hero")}
            breadcrumbCurrentLabel={item.title}
          />
        ) : composition.hasAnyAssignmentRows || composition.hasCompositionError ? null : undefined
      }
      compositionChildren
    >
      <PageSlotLayout
        composition={composition}
        skipSlots={["hero"]}
        breadcrumbCurrentLabel={item.title}
        sidebarPrefix={<MediaSidebarSearch searchBasePath={config.basePath} />}
        mainAfter={
          <>
            {item.topicId ? <TopicViewTracker topicId={item.topicId} /> : null}
            <JsonLd data={pageJsonLd} />

            <MediaPageShell>
              <MediaDetailArticle
                item={item}
                content={content}
                config={config}
                relatedItems={relatedItems}
              />
            </MediaPageShell>
          </>
        }
      />
    </InternalPageLayout>
  );
}
