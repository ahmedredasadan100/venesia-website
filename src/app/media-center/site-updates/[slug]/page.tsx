import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import InternalPageLayout from "../../../../components/InternalPageLayout";
import MediaPageShell from "../../../../components/media-center/MediaPageShell";
import RelatedMediaRail from "../../../../components/media-center/RelatedMediaRail";
import JsonLd from "../../../../components/seo/JsonLd";
import { getMediaItemBySlug, getMediaItems } from "../../../../lib/media-center";
import { loadMediaCenterSidebarProps } from "../../../../lib/media-sidebar-modules/load-media-sidebar-modules";
import { buildMetadata } from "../../../../lib/seo/build-metadata";
import { buildPageJsonLd } from "../../../../lib/seo/build-jsonld";

export const dynamic = "force-dynamic";

type DetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: DetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMediaItemBySlug("site-update", slug);

  if (!item) {
    return buildMetadata({
      path: "/media-center/site-updates",
      title: "تحديث غير موجود | فينيسيا للتطوير العقاري",
      description:
        "التحديث المطلوب غير متاح حاليًا داخل المركز الإعلامي لفينيسيا للتطوير العقاري.",
    });
  }

  return buildMetadata({
    path: `/media-center/site-updates/${item.slug}`,
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
    getMediaItemBySlug("site-update", slug),
    getMediaItems("site-update"),
    loadMediaCenterSidebarProps("media-center-site-updates"),
  ]);

  if (!item) {
    notFound();
  }

  const relatedItems = allItems
    .filter((relatedItem) => relatedItem.slug !== item.slug)
    .slice(0, 3);

  const pagePath = `/media-center/site-updates/${item.slug}`;

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
      { name: "تحديثات المواقع", path: "/media-center/site-updates" },
      { name: item.title, path: pagePath },
    ],
  });

  const content = item.content?.length ? item.content : [
    'هذا التحديث يوثق مرحلة تنفيذية من داخل الموقع، ضمن التزام فينيسيا بعرض حركة العمل كما هي، خطوة بخطوة.',
    'كل مرحلة يتم تنفيذها تحت إشراف ومراجعة، لأن الجودة لا تبدأ عند التسليم، بل تبدأ من التفاصيل التي لا يراها العميل الآن.',
    'الثقة مش وعد… الثقة فعل.'
  ];

  return (
    <InternalPageLayout
      title={item.title}
      eyebrow="Site Update"
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
              تابع تحديثات التنفيذ كما تحدث على أرض الواقع.
            </p>

            <Link
              href="/media-center/site-updates"
              className="rounded-full border border-[#D8B87A]/35 px-5 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
            >
              العودة للتحديثات
            </Link>
          </div>

          <RelatedMediaRail
            eyebrow="Related Updates"
            title="تحديثات ذات صلة"
            items={relatedItems}
            getHref={(relatedItem) => `/media-center/site-updates/${relatedItem.slug}`}
            actionLabel="عرض التحديث"
          />
        </article>
      </MediaPageShell>
    </InternalPageLayout>
  );
}
