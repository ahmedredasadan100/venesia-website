import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import InternalPageLayout from "../../../../../components/InternalPageLayout";
import MediaPageShell from "../../../../../components/media-center/MediaPageShell";
import RelatedMediaRail from "../../../../../components/media-center/RelatedMediaRail";
import JsonLd from "../../../../../components/seo/JsonLd";
import { getMediaItemBySlug, getMediaItems } from "../../../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../../../lib/seo/build-metadata";
import { buildPageJsonLd } from "../../../../../lib/seo/build-jsonld";
import { NO_INDEX_ROBOTS } from "../../../../../config/seo/seo-rules";

export const revalidate = 300;

type DetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: DetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMediaItemBySlug("news", slug);

  if (!item) {
    return buildMetadata({
      path: "/media-center/news",
      title: "خبر غير موجود | فينيسيا للتطوير العقاري",
      description:
        "الخبر المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return buildMetadata({
    path: `/media-center/news/${item.slug}`,
    title: `${item.title} | فينيسيا للتطوير العقاري`,
    description: item.excerpt,
    image: item.image,
    type: "article",
    publishedTime: item.publishedAt,
    modifiedTime: item.publishedAt,
    authors: ["Venesia Developments"],
  });
}

export default async function DetailsPage({
  params,
}: DetailsPageProps) {
  const { slug } = await params;

  const [item, allItems, sidebarProps] = await Promise.all([
    getMediaItemBySlug("news", slug),
    getMediaItems("news"),
    loadMediaCenterSidebarProps("media-center-news"),
  ]);

  if (!item) {
    notFound();
  }

  const relatedItems = allItems
    .filter((relatedItem) => relatedItem.slug !== item.slug)
    .slice(0, 3);

  const pagePath = `/media-center/news/${item.slug}`;

  const pageJsonLd = buildPageJsonLd({
    path: pagePath,
    title: item.title,
    description: item.excerpt,
    type: "article",
    image: item.image,
    publishedAt: item.publishedAt,
    updatedAt: item.publishedAt,
    breadcrumbs: [
      { name: "الرئيسية", path: "/" },
      { name: "المركز الإعلامي", path: "/media-center" },
      { name: "الأخبار", path: "/media-center/news" },
      { name: item.title, path: pagePath },
    ],
  });

  const content = item.content?.length ? item.content : [
    'تابع أخبار فينيسيا وتحديثات التنفيذ من داخل المركز الإعلامي.'
  ];

  return (
    <InternalPageLayout
      title={item.title}
      eyebrow="News"
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
        <article className="space-y-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">
                {item.category}
              </span>

              <span className="text-sm text-white/45">{item.date}</span>
              {item.project ? (
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-1.5 text-xs text-white/55">
                  {item.project}
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">
              {item.title}
            </h1>

            <p className="mt-5 max-w-3xl leading-8 text-white/60">
              {item.excerpt}
            </p>
          </div>

          <div className="relative h-[420px] overflow-hidden rounded-[2rem] border border-white/10">
            <Image
              src={item.image}
              alt={item.title}
              fill
              priority
              sizes="(min-width: 1024px) 900px, 100vw"
              className="object-cover"
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#05070B]/55 via-transparent to-transparent"
            />
          </div>

          <div className="space-y-6 rounded-[2rem] border border-white/10 bg-black/15 p-7 md:p-9">
            {content.map((paragraph) => (
              <p
                key={paragraph}
                className="text-[15px] leading-9 text-white/68 md:text-base"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-[#D8B87A]/20 bg-[#D8B87A]/[0.07] p-5">
            <p className="text-sm leading-7 text-white/65">
              تابع أخبار فينيسيا وتحديثات التنفيذ من داخل المركز الإعلامي.
            </p>

            <Link
              href="/media-center/news"
              className="rounded-full border border-[#D8B87A]/35 px-5 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              العودة للأخبار
            </Link>
          </div>

          <RelatedMediaRail
            eyebrow="Related News"
            title="أخبار ذات صلة"
            items={relatedItems}
            getHref={(relatedItem) => `/media-center/news/${relatedItem.slug}`}
            actionLabel="قراءة الخبر"
          />
        </article>
      </MediaPageShell>
    </InternalPageLayout>
  );
}
