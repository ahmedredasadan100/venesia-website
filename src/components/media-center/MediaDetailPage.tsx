import { notFound } from "next/navigation";

import InternalPageLayout from "../InternalPageLayout";
import JsonLd from "../seo/JsonLd";
import TopicViewTracker from "../content/TopicViewTracker";
import {
  resolvePublicContentBasePath,
  resolvePublicContentPageRoute,
} from "../../lib/content/public-content-path";
import { getPublicPageRoute } from "../../lib/admin/links/static-routes";
import { getMediaItemBySlug, getRelatedMediaItems } from "../../lib/media-center";
import { MEDIA_DETAIL_PAGE_CONFIG, type MediaDetailPageKey } from "../../lib/media-center/detail-page-config";
import { getMediaHref } from "../../lib/media-center/types";
import { buildPageJsonLd } from "../../lib/seo/build-jsonld";
import { loadResolvedGlobalSeo } from "../../lib/seo/generate-public-metadata";
import { getPublishedPageStateBySlug } from "../../lib/pages/get-published-page-by-slug";
import MediaDetailArticle from "./MediaDetailArticle";
import MediaPageShell from "./MediaPageShell";

type MediaDetailPageProps = {
  configKey: MediaDetailPageKey;
  slug: string;
};

export default async function MediaDetailPage({
  configKey,
  slug,
}: MediaDetailPageProps) {
  const config = MEDIA_DETAIL_PAGE_CONFIG[configKey];
  const sectionIdentity = resolvePublicContentPageRoute(config.mediaType);
  const itemPromise = getMediaItemBySlug(config.mediaType, slug);
  const sectionPageStatePromise = getPublishedPageStateBySlug(
    sectionIdentity.cmsPageSlug,
  );
  const globalSeoPromise = loadResolvedGlobalSeo();
  const [item, sectionPageState] = await Promise.all([
    itemPromise,
    sectionPageStatePromise,
  ]);

  if (!item) {
    notFound();
  }

  const [relatedItems, globalSeo] = await Promise.all([
    getRelatedMediaItems(config.mediaType, item.topicId ?? Number(item.id), 3),
    globalSeoPromise,
  ]);

  const homeIdentity = getPublicPageRoute("home");
  const mediaCenterIdentity = getPublicPageRoute("media-center");
  const sectionPath = resolvePublicContentBasePath(item.type);
  const sectionTitle = sectionPageState.page?.title ?? sectionIdentity.label;
  const pagePath = getMediaHref(item);
  const content = item.content?.trim()
    ? item.content
    : config.fallbackContent.join("\n\n");

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
        { name: homeIdentity.label, path: homeIdentity.href },
        { name: mediaCenterIdentity.label, path: mediaCenterIdentity.href },
        { name: sectionTitle, path: sectionPath },
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
    >
      {item.showTitleOnPage === false ? (
        <h1 className="sr-only">{item.title}</h1>
      ) : null}
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
    </InternalPageLayout>
  );
}
