import Link from "next/link";

import type { MediaDetailPageConfig } from "../../lib/media-center/detail-page-config";
import type { MediaContentItem } from "../../lib/media-center/types";
import { getMediaHref } from "../../lib/media-center/types";
import { resolveYouTubeEmbedUrl } from "../../lib/admin/media-topic-payload";
import MediaDetailHeroImage from "./MediaDetailHeroImage";
import RelatedMediaRail from "./RelatedMediaRail";

type MediaDetailArticleProps = {
  item: MediaContentItem;
  content: string[];
  config: MediaDetailPageConfig;
  relatedItems: MediaContentItem[];
};

export default function MediaDetailArticle({
  item,
  content,
  config,
  relatedItems,
}: MediaDetailArticleProps) {
  return (
    <article className="space-y-10">
      {item.showIntroCardOnPage ? (
        <div className="space-y-10" data-media-intro-card>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {item.showCategoryOnPage && item.category ? (
                <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">
                  {item.category}
                </span>
              ) : null}

              {item.showSeriesOnPage && item.series ? (
                <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">
                  {item.series}
                </span>
              ) : null}

              {item.showDateOnPage && item.date ? (
                <span className="text-sm text-white/45">{item.date}</span>
              ) : null}

              {config.showProjectBadge && item.project ? (
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-1.5 text-xs text-white/55">
                  {item.project}
                </span>
              ) : null}

              {config.showDurationBadge && item.duration ? (
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-1.5 text-xs text-white/55">
                  {item.duration}
                </span>
              ) : null}
            </div>

            {item.showTitleOnPage ? (
              <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white @xl/slot-module:text-4xl">
                {item.title}
              </h1>
            ) : null}

            {item.showExcerptOnPage ? (
              <p className="mt-5 max-w-3xl leading-8 text-white/60">{item.excerpt}</p>
            ) : null}
          </div>

          {item.showImageOnPage ? (
            <MediaDetailHeroImage src={item.image} alt={item.imageAlt || item.title} variant={config.heroVariant} />
          ) : null}
        </div>
      ) : null}

      {item.type === "video" ? <MediaVideoPlayback item={item} /> : null}

      <div className="space-y-6 rounded-[2rem] border border-white/10 bg-black/15 p-6 @xl/slot-module:p-7 @3xl/slot-module:p-9">
        {content.map((paragraph) => (
          <p key={paragraph} className="text-[15px] leading-9 text-white/68 @xl/slot-module:text-base">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-[#D8B87A]/20 bg-[#D8B87A]/[0.07] p-5">
        <p className="text-sm leading-7 text-white/65">{config.cta.message}</p>

        <Link
          href={config.basePath}
          className="rounded-full border border-[#D8B87A]/35 px-5 py-2.5 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10"
        >
          {config.cta.backLabel}
        </Link>
      </div>

      <RelatedMediaRail
        eyebrow={config.related.eyebrow}
        title={config.related.title}
        items={relatedItems}
        getHref={getMediaHref}
        actionLabel={config.related.actionLabel}
      />
    </article>
  );
}

function MediaVideoPlayback({ item }: { item: MediaContentItem }) {
  const embedUrl = resolveYouTubeEmbedUrl(item.videoUrl ?? "");

  if (!embedUrl) {
    return (
      <div
        role="status"
        data-public-media-video-unavailable
        className="rounded-[1.5rem] border border-amber-300/20 bg-amber-300/[0.06] px-6 py-5 text-sm leading-7 text-amber-100/80"
      >
        الفيديو غير متاح للتشغيل حاليًا. تظل تفاصيل الخبر والصورة المنشورة متاحة دون تحويلك إلى رابط بديل غير موثوق.
      </div>
    );
  }

  return (
    <div className="aspect-video overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/30">
      <iframe
        src={embedUrl}
        title={`تشغيل ${item.title}`}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
