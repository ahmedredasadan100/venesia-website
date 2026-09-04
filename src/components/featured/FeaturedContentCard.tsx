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
  type ResolvedCollectionDisplayTextFormatting,
} from "../../lib/page-blocks/configs";
import PublicGoldPill from "../public/PublicGoldPill";

export default function FeaturedContentCard({
  item,
  display,
  displayFormatting,
  presentation,
  size = "standard",
}: {
  item: PublicContentSummary;
  display: ContentDisplayOptions;
  displayFormatting: ResolvedCollectionDisplayTextFormatting;
  presentation: FeaturedPresentation;
  size?: "standard" | "large";
}) {
  const resolvedDisplay = resolveFeaturedItemDisplay(display, item);
  const showTaxonomy = resolvedDisplay.category || resolvedDisplay.series;
  const showMetadata =
    showTaxonomy || resolvedDisplay.date;
  const isArticle = item.contentType === "article";
  const ctaFormat = resolvePageBlockTextFormat(presentation, "cta");
  const cardMinHeightClass =
    size === "large"
      ? "min-h-[360px] @2xl/slot-module:min-h-[480px]"
      : "min-h-[290px]";
  const seriesMetadataClass =
    `block w-fit max-w-full text-sm leading-5 text-[#D8B87A] drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] transition hover:text-[#E7CC98] ${displayFormatting.seriesBold ? "font-bold" : "font-medium"} ${pageBlockTextAlignClass(displayFormatting.seriesAlignment)} ${pageBlockTextPlacementClass(displayFormatting.seriesAlignment)}`.trim();

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] ${cardMinHeightClass}`}
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
      <div
        className={`relative z-10 mt-auto flex w-full flex-col justify-end p-6 @xl/slot-module:p-8 ${cardMinHeightClass}`}
      >
        {showMetadata ? (
          <div
            data-featured-metadata-area=""
            className="grid gap-1.5 text-sm font-medium leading-5 text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
          >
            {showTaxonomy ? (
              <div
                data-featured-taxonomy-stack=""
                className="grid -translate-y-2 gap-1"
              >
                {resolvedDisplay.category ? (
                  <span
                    className={`block w-full ${pageBlockTextAlignClass(displayFormatting.categoryAlignment)}`}
                  >
                    <PublicGoldPill
                      href={
                        isArticle
                          ? `/topics?category=${encodeURIComponent(item.categorySlug)}`
                          : undefined
                      }
                    >
                      <span
                        className={`text-sm leading-5 ${displayFormatting.categoryBold ? "font-bold" : "font-medium"}`}
                      >
                        {item.category}
                      </span>
                    </PublicGoldPill>
                  </span>
                ) : null}
                {resolvedDisplay.series ? (
                  isArticle ? (
                    <Link
                      href={`/topics?series=${encodeURIComponent(item.seriesSlug)}`}
                      className={seriesMetadataClass}
                    >
                      {item.series}
                    </Link>
                  ) : (
                    <span className={seriesMetadataClass}>{item.series}</span>
                  )
                ) : null}
              </div>
            ) : null}
            {resolvedDisplay.date ? (
              <span
                data-featured-date=""
                className={`block w-full ${showTaxonomy ? "border-t border-white/10 pt-1.5" : ""} ${pageBlockTextAlignClass(displayFormatting.dateAlignment)} ${displayFormatting.dateBold ? "font-bold" : "font-normal"}`.trim()}
              >
                {item.date}
              </span>
            ) : null}
          </div>
        ) : null}
        {resolvedDisplay.title ? (
          <h3
            className={`${size === "large" ? "text-2xl @xl/slot-module:text-4xl" : "min-h-12 text-xl"} mt-2 line-clamp-2 leading-tight text-white ${displayFormatting.titleBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(displayFormatting.titleAlignment)} ${pageBlockTextPlacementClass(displayFormatting.titleAlignment)}`}
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
          <p
            className={`mt-4 max-w-2xl text-sm leading-7 text-white/65 ${size === "large" ? "min-h-14 line-clamp-2" : "min-h-7 line-clamp-1"} ${displayFormatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(displayFormatting.excerptAlignment)} ${pageBlockTextPlacementClass(displayFormatting.excerptAlignment)}`}
          >
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
