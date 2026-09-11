import Link from "next/link";

import { resolvePublicContentBasePath } from "../../lib/content/public-content-path";
import type { MediaDetailPageConfig } from "../../lib/media-center/detail-page-config";
import type { MediaContentItem } from "../../lib/media-center/types";
import { getMediaHref } from "../../lib/media-center/types";
import { resolveYouTubeEmbedUrl } from "../../lib/admin/media-topic-payload";
import RichTextContent from "../content/RichTextContent";
import PublicMediaImage from "../public/PublicMediaImage";
import RelatedMediaRail from "./RelatedMediaRail";

type MediaDetailArticleProps = {
  item: MediaContentItem;
  content: string;
  config: MediaDetailPageConfig;
  relatedItems: MediaContentItem[];
};

export default function MediaDetailArticle({
  item,
  content,
  config,
  relatedItems,
}: MediaDetailArticleProps) {
  const hasIntroMetadata = Boolean(
    (item.showCategoryOnPage && item.category) ||
      (item.showSeriesOnPage && item.series) ||
      (item.showDateOnPage && item.date) ||
      (config.showProjectBadge && item.project) ||
      (config.showDurationBadge && item.duration),
  );

  return (
    <article className="space-y-10">
      {item.showIntroCardOnPage && hasIntroMetadata ? (
        <div className="space-y-10" data-media-intro-card>
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
        </div>
      ) : null}

      {item.type === "video" ? <MediaVideoPlayback item={item} /> : null}

      {item.type === "gallery" && item.galleryImages?.length ? (
        <div
          className="grid gap-4 @xl/slot-module:grid-cols-2"
          data-public-media-gallery
          data-public-media-gallery-count={item.galleryImages.length}
        >
          {item.galleryImages.map((image, index) => (
            <figure
              key={`${item.id}:${index}:${image.url}`}
              className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/15"
              data-public-media-gallery-item
              data-public-media-gallery-index={index}
              data-public-media-gallery-url={image.url}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.03]">
                <PublicMediaImage
                  src={image.url}
                  alt={image.alt ?? ""}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                  data-public-media-gallery-image
                />
              </div>
              {image.caption ? (
                <figcaption
                  className="px-4 py-3 text-sm leading-7 text-white/55"
                  data-public-media-gallery-caption
                >
                  {image.caption}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}

      <div
        className="rounded-[2rem] border border-white/10 bg-black/15 p-6 @xl/slot-module:p-7 @3xl/slot-module:p-9"
        data-public-media-markdown
      >
        <RichTextContent
          value={content}
          mode="markdown"
          demoteHeadings
          className="article-rich-text"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-[#D8B87A]/20 bg-[#D8B87A]/[0.07] p-5">
        <p className="text-sm leading-7 text-white/65">{config.cta.message}</p>

        <Link
          href={resolvePublicContentBasePath(item.type)}
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
