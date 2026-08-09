import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import InternalPageLayout from "../../../../components/InternalPageLayout";
import FeedModulesStack from "../../../../components/feed-modules/FeedModulesStack";
import TopicsSidebarSearchPanel from "../../../../components/topics/TopicsSidebarSearchPanel";
import TopicCard from "../../../../components/topics/TopicCard";
import TopicViewTracker from "../../../../components/content/TopicViewTracker";
import JsonLd from "../../../../components/seo/JsonLd";
import RichTextContent from "../../../../components/content/RichTextContent";

import { loadFeedModulesForPageSlug } from "../../../../lib/feed-modules/load-feed-modules";
import {
  loadPublicTopicBySlug,
  loadRelatedPublicTopics,
} from "../../../../lib/topics/load-public-topics";
import { NO_INDEX_ROBOTS } from "../../../../config/seo/seo-rules";
import { generatePublicMetadata, loadResolvedGlobalSeo } from "../../../../lib/seo/generate-public-metadata";
import { buildPageJsonLd } from "../../../../lib/seo/build-jsonld";

export const revalidate = 300;

type TopicDetailsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: TopicDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await loadPublicTopicBySlug(slug);

  if (!topic) {
    return generatePublicMetadata({
      path: `/topics/${slug}`,
      title: "الموضوع غير موجود | فينيسيا للتطوير العقاري",
      description: "الموضوع المطلوب غير متاح حاليًا.",
      robots: NO_INDEX_ROBOTS,
      includePageSeo: false,
    });
  }

  const pagePath = `/topics/${topic.slug}`;

  return generatePublicMetadata({
    path: pagePath,
    entitySeo: {
      title: topic.seoTitle,
      description: topic.seoDescription,
      keywords: topic.seoKeywords,
      image: topic.metadataImage || undefined,
      imageAlt: topic.metadataImage ? topic.imageAlt : undefined,
      ogImage: topic.ogImage || undefined,
      ogImageAlt: topic.ogImage ? topic.ogImageAlt : undefined,
      canonical: topic.canonicalUrl || undefined,
      robotsIndex: topic.robotsIndex,
      robotsFollow: topic.robotsFollow,
    },
    title: `${topic.seoTitle || topic.title} | فينيسيا للتطوير العقاري`,
    description: topic.seoDescription || topic.excerpt,
    type: "article",
    publishedTime: topic.publishedAt,
    modifiedTime: topic.publishedAt,
    includePageSeo: false,
  });
}

export default async function TopicDetailsPage({ params }: TopicDetailsPageProps) {
  const { slug } = await params;
  const topic = await loadPublicTopicBySlug(slug);

  if (!topic) notFound();

  const relatedTopics = await loadRelatedPublicTopics(topic);
  const sidebarFeeds = await loadFeedModulesForPageSlug("topics");
  const globalSeo = await loadResolvedGlobalSeo();
  const pagePath = `/topics/${topic.slug}`;
  const showCategoryMetadata =
    topic.showCategoryOnPage && Boolean(topic.category && topic.categorySlug);
  const showSeriesMetadata =
    topic.showSeriesOnPage && Boolean(topic.series && topic.seriesSlug);
  const showDateMetadata = topic.showDateOnPage && Boolean(topic.date);
  const headerEyebrow = showSeriesMetadata
    ? topic.series
    : showCategoryMetadata
      ? topic.category
      : undefined;

  const pageJsonLd = buildPageJsonLd(
    {
      path: pagePath,
      title: topic.seoTitle || topic.title,
      description: topic.seoDescription || topic.excerpt,
      type: "article",
      image: topic.ogImage || topic.image,
      publishedAt: topic.publishedAt,
      updatedAt: topic.publishedAt,
      faqs: topic.showFaqOnPage && topic.faq.length > 0 ? topic.faq : undefined,
    },
    globalSeo,
  );

  return (
    <InternalPageLayout
      title={topic.title}
      eyebrow={headerEyebrow}
      subtitle={topic.excerpt}
      heroImage={topic.image}
      showTitle={topic.showTitleOnPage}
      showHeroImage={topic.showImageOnPage}
      showSubtitle={topic.showExcerptOnPage}
    >
      <TopicViewTracker topicId={topic.id} />
      <JsonLd data={pageJsonLd} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:[direction:ltr]">
        <main dir="rtl" className="space-y-10 text-right">
          {topic.showIntroCardOnPage ? (
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.025]">
              {topic.showImageOnPage ? (
                <div className="relative h-[340px] w-full">
                  <Image
                    src={topic.image}
                    alt={topic.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 900px"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/25 to-transparent" />
                </div>
              ) : null}

              <div className="space-y-5 p-6 md:p-8">
                {showCategoryMetadata || showSeriesMetadata || showDateMetadata || topic.readingTime ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
                    <div className="flex flex-wrap items-center gap-3">
                      {showCategoryMetadata ? (
                        <Link
                          href={`/topics?category=${encodeURIComponent(topic.categorySlug)}`}
                          className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-[#D8B87A] transition hover:border-[#D8B87A]/50"
                        >
                          {topic.category}
                        </Link>
                      ) : null}
                      {showDateMetadata ? <span>{topic.date}</span> : null}
                      {topic.readingTime ? <span>{topic.readingTime}</span> : null}
                    </div>

                    {showSeriesMetadata ? (
                      <Link
                        href={`/topics?series=${encodeURIComponent(topic.seriesSlug)}`}
                        className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-[#D8B87A] transition hover:border-[#D8B87A]/50"
                      >
                        {topic.series}
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {topic.showTitleOnPage ? (
                  <h2 className="text-3xl font-semibold leading-[1.4] text-white md:text-2xl">
                    {topic.title}
                  </h2>
                ) : null}

                {topic.showExcerptOnPage ? (
                  <p className="max-w-3xl leading-8 text-white/60">{topic.excerpt}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <article className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-8">
            <RichTextContent
              value={topic.content}
              mode="markdown"
              className="article-rich-text"
              demoteHeadings
            />
          </article>

          {topic.showFaqOnPage && topic.faq.length > 0 && (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-6 md:p-8">
              {topic.showFaqTitleOnPage ? <h2 className="text-2xl font-semibold text-white">أسئلة شائعة</h2> : null}

              <div className={topic.showFaqTitleOnPage ? "mt-6 space-y-4" : "space-y-4"}>
                {topic.faq.map((item) => (
                  <div
                    key={item.question}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <h3 className="font-semibold text-[#D8B87A]">{item.question}</h3>
                    <p className="mt-3 leading-8 text-white/65">{item.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {relatedTopics.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-white">موضوعات ذات صلة</h2>

                <Link href="/topics" className="text-sm text-[#D8B87A]">
                  كل الموضوعات
                </Link>
              </div>

              <div className="space-y-6">
                {relatedTopics.map((relatedTopic) => (
                  <TopicCard key={relatedTopic.id} {...relatedTopic} />
                ))}
              </div>
            </section>
          )}
        </main>

        <aside dir="rtl" className="space-y-6 text-right">
          <TopicsSidebarSearchPanel />
          <FeedModulesStack modules={sidebarFeeds} slot="sidebar" />
        </aside>
      </div>
    </InternalPageLayout>
  );
}
