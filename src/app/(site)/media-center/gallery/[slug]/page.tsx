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
  const item = await getMediaItemBySlug("gallery", slug);

  if (!item) {
    return buildMetadata({
      path: "/media-center/gallery",
      title: "معرض غير موجود | فينيسيا للتطوير العقاري",
      description:
        "المعرض المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
      robots: NO_INDEX_ROBOTS,
    });
  }

  return buildMetadata({
    path: `/media-center/gallery/${item.slug}`,
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
    getMediaItemBySlug("gallery", slug),
    getMediaItems("gallery"),
    loadMediaCenterSidebarProps("media-center-gallery"),
  ]);

  if (!item) {
    notFound();
  }

  const relatedItems = allItems
    .filter((relatedItem) => relatedItem.slug !== item.slug)
    .slice(0, 3);

  const pagePath = `/media-center/gallery/${item.slug}`;

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
      { name: "معرض الصور", path: "/media-center/gallery" },
      { name: item.title, path: pagePath },
    ],
  });

  const content = item.content?.length ? item.content : [
    'هذه الصور جزء من التوثيق المستمر لمراحل التنفيذ داخل مشروعات فينيسيا للتطوير العقاري.',
    'الهدف ليس عرض صور جميلة فقط، بل توثيق ما يحدث على أرض الواقع وإظهار التفاصيل التنفيذية كما هي.',
    'لأن الثقة تبدأ عندما يرى العميل ما يتم تنفيذه بالفعل.'
  ];

  return (
    <InternalPageLayout
      title={item.title}
      eyebrow="Gallery"
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
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">
              {item.title}
            </h1>

            <p className="mt-5 max-w-3xl leading-8 text-white/60">
              {item.excerpt}
            </p>
          </div>

          <div className="relative h-[500px] overflow-hidden rounded-[2rem] border border-white/10">
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
              استكشف المزيد من الصور والجولات الميدانية داخل مشروعات فينيسيا.
            </p>

            <Link
              href="/media-center/gallery"
              className="rounded-full border border-[#D8B87A]/35 px-5 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              العودة للمعرض
            </Link>
          </div>

          <RelatedMediaRail
            eyebrow="Related Gallery"
            title="معارض ذات صلة"
            items={relatedItems}
            getHref={(relatedItem) => `/media-center/gallery/${relatedItem.slug}`}
            actionLabel="عرض المعرض"
          />
        </article>
      </MediaPageShell>
    </InternalPageLayout>
  );
}
