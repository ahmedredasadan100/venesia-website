import Image from "next/image";
import Link from "next/link";

import type { PublicContentSummary } from "../../lib/content/public-content-read/contract";
import {
  resolveFeaturedItemDisplay,
  type FeaturedPresentation,
} from "../../lib/featured-modules/contract";
import {
  type ContentDisplayOptions,
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  resolvePageBlockTextFormat,
} from "../../lib/page-blocks/configs";
import PublicGoldPill from "../public/PublicGoldPill";

export default function FeaturedContentCard({
  item,
  display,
  presentation,
  size = "standard",
}: {
  item: PublicContentSummary;
  display: ContentDisplayOptions;
  presentation: FeaturedPresentation;
  size?: "standard" | "large";
}) {
  const resolvedDisplay = resolveFeaturedItemDisplay(display, item);
  const showMetadata =
    resolvedDisplay.category || resolvedDisplay.series || resolvedDisplay.date;
  const isArticle = item.contentType === "article";
  const ctaFormat = resolvePageBlockTextFormat(presentation, "cta");

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] ${size === "large" ? "min-h-[360px] @2xl/slot-module:min-h-[480px]" : "min-h-[290px]"}`}
    >
      {resolvedDisplay.image ? (
        <Image
          src={item.image}
          alt={item.imageAlt || item.title}
          fill
          sizes={
            size === "large"
              ? "(min-width: 1024px) 60vw, 100vw"
              : "(min-width: 768px) 33vw, 100vw"
          }
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/50 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-6 @xl/slot-module:p-8">
        {showMetadata ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/55">
            {resolvedDisplay.category ? (
              <PublicGoldPill
                href={
                  isArticle
                    ? `/topics?category=${encodeURIComponent(item.categorySlug)}`
                    : undefined
                }
              >
                {item.category}
              </PublicGoldPill>
            ) : null}
            {resolvedDisplay.series ? (
              <PublicGoldPill
                href={
                  isArticle
                    ? `/topics?series=${encodeURIComponent(item.seriesSlug)}`
                    : undefined
                }
              >
                {item.series}
              </PublicGoldPill>
            ) : null}
            {resolvedDisplay.date ? <span>{item.date}</span> : null}
          </div>
        ) : null}
        {resolvedDisplay.title ? (
          <h3
            className={`${size === "large" ? "text-2xl @xl/slot-module:text-4xl" : "text-xl"} mt-3 font-semibold leading-tight text-white`}
          >
            <Link
              href={item.href}
              className="transition group-hover:text-[#D8B87A]"
            >
              {item.title}
            </Link>
          </h3>
        ) : null}
        {resolvedDisplay.excerpt ? (
          <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-white/65">
            {item.excerpt}
          </p>
        ) : null}
        {ctaFormat.visible && presentation.ctaText ? (
          <Link
            href={item.href}
            className={`mt-5 flex w-fit text-sm text-[#D8B87A] ${ctaFormat.bold ? "font-bold" : "font-semibold"} ${pageBlockTextAlignClass(ctaFormat.alignment)} ${pageBlockTextPlacementClass(ctaFormat.alignment)}`}
          >
            {presentation.ctaText} ←
          </Link>
        ) : null}
      </div>
    </article>
  );
}
