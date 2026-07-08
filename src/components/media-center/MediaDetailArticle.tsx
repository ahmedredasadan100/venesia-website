import Link from "next/link";

import type { MediaDetailPageConfig } from "../../lib/media-center/detail-page-config";
import type { MediaContentItem } from "../../lib/media-center/types";
import { getMediaHref } from "../../lib/media-center/types";
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
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">
            {item.category}
          </span>

          <span className="text-sm text-white/45">{item.date}</span>

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

        <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">
          {item.title}
        </h1>

        <p className="mt-5 max-w-3xl leading-8 text-white/60">{item.excerpt}</p>
      </div>

      <MediaDetailHeroImage src={item.image} alt={item.title} variant={config.heroVariant} />

      <div className="space-y-6 rounded-[2rem] border border-white/10 bg-black/15 p-7 md:p-9">
        {content.map((paragraph) => (
          <p key={paragraph} className="text-[15px] leading-9 text-white/68 md:text-base">
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
