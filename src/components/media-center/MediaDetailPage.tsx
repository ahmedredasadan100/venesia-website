import { notFound } from "next/navigation";

import InternalPageLayout from "../InternalPageLayout";
import JsonLd from "../seo/JsonLd";
import { getMediaItemBySlug, getMediaItems } from "../../lib/media-center";
import { MEDIA_DETAIL_PAGE_CONFIG, type MediaDetailPageKey } from "../../lib/media-center/detail-page-config";
import { loadMediaCenterSidebarProps } from "../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildPageJsonLd } from "../../lib/seo/build-jsonld";
import { loadResolvedGlobalSeo } from "../../lib/seo/generate-public-metadata";
import MediaDetailArticle from "./MediaDetailArticle";
import MediaPageShell from "./MediaPageShell";

type MediaDetailPageProps = {
  configKey: MediaDetailPageKey;
  slug: string;
};

export default async function MediaDetailPage({ configKey, slug }: MediaDetailPageProps) {
  const config = MEDIA_DETAIL_PAGE_CONFIG[configKey];

  const [item, allItems, sidebarProps] = await Promise.all([
    getMediaItemBySlug(config.mediaType, slug),
    getMediaItems(config.mediaType),
    loadMediaCenterSidebarProps(config.cmsPageSlug),
  ]);

  if (!item) {
    notFound();
  }

  const relatedItems = allItems
    .filter((relatedItem) => relatedItem.slug !== item.slug)
    .slice(0, 3);

  const pagePath = `${config.basePath}/${item.slug}`;
  const content = item.content?.length ? item.content : config.fallbackContent;
  const globalSeo = await loadResolvedGlobalSeo();

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
    >
      <JsonLd data={pageJsonLd} />

      <MediaPageShell
        latestNewsSidebar={sidebarProps.latestNewsSidebar}
        popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
        sidebarModules={sidebarProps.sidebarModules}
      >
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
