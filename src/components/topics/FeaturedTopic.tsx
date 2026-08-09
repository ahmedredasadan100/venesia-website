import Link from "next/link";

import type { Topic } from "../../lib/topics/types";
import TopicImage from "./TopicImage";

type FeaturedTopicProps = {
  topic?: Topic;
};

export default function FeaturedTopic({ topic }: FeaturedTopicProps) {
  if (!topic) {
    return (
      <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-right shadow-[0_25px_90px_rgba(0,0,0,0.32)]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
          Knowledge Hub
        </p>

        <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
          لا توجد موضوعات منشورة حتى الآن
        </h2>

        <p className="mt-4 max-w-2xl leading-8 text-white/60">
          يتم تجهيز محتوى مركز المعرفة حاليًا. قريبًا ستجد هنا موضوعات توعوية
          واستثمارية مكتوبة بمنهج فينيسيا: وضوح، هدوء، ودليل من أرض الواقع.
        </p>
      </article>
    );
  }

  const showCategory =
    topic.showCategoryOnPage !== false && Boolean(topic.category && topic.categorySlug);
  const showSeries =
    topic.showSeriesOnPage !== false && Boolean(topic.series && topic.seriesSlug);
  const showDate = topic.showDateOnPage !== false && Boolean(topic.date);
  const showMetadata = showCategory || showSeries || showDate;

  return (
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_25px_90px_rgba(0,0,0,0.32)]">
      <div className="relative h-[390px] overflow-hidden">
        <TopicImage
          src={topic.image}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 900px"
          className="object-cover object-center transition duration-1000 group-hover:scale-105"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/45 to-[#05070B]/10"
        />

        <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
          {showMetadata ? (
            <div dir="rtl" className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {showCategory ? (
                  <Link
                    href={`/topics?category=${encodeURIComponent(topic.categorySlug)}`}
                    className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur transition hover:border-[#D8B87A]/60"
                  >
                    {topic.category}
                  </Link>
                ) : null}

                {showDate ? <span className="text-xs text-white/60">{topic.date}</span> : null}
              </div>

              {showSeries ? (
                <Link
                  href={`/topics?series=${encodeURIComponent(topic.seriesSlug ?? "")}`}
                  className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur transition hover:border-[#D8B87A]/60"
                >
                  {topic.series}
                </Link>
              ) : null}
            </div>
          ) : null}

          <h2 className="max-w-3xl text-3xl font-semibold leading-tight text-white md:text-2xl">
            {topic.title}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-8 text-white/70 md:text-base">
            {topic.excerpt}
          </p>

          <Link
            href={`/topics/${topic.slug}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-6 py-3 text-sm font-medium text-[#D8B87A] transition duration-500 hover:border-[#D8B87A]/50 hover:bg-[#D8B87A]/15"
          >
            قراءة الموضوع
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
