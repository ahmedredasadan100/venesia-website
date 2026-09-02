import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import type {
  CollectionListingItemsPerRow,
  CollectionListingLayout,
} from "../../lib/collection-modules/collection-view";
import type { CollectionListingItemLimit } from "../../lib/collection-modules/item-limit";
import {
  pageBlockTextAlignClass,
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
} from "../../lib/page-blocks/configs";
import PublicGoldPill from "../public/PublicGoldPill";

const GRID_COLUMN_CLASSES: Record<CollectionListingItemsPerRow, string> = {
  2: "@2xl/slot-module:grid-cols-2",
  3: "@2xl/slot-module:grid-cols-3",
  4: "@2xl/slot-module:grid-cols-4",
};

export type CollectionListingTaxonomy = {
  label: string;
  href?: string;
};

export type CollectionListingPresentationProps<Item> = {
  items: readonly Item[];
  itemLimit: CollectionListingItemLimit;
  presentation: CollectionListingLayout;
  itemsPerRow: CollectionListingItemsPerRow;
  keyForItem: (item: Item) => string | number;
  renderItem: (item: Item) => ReactNode;
};

export type CollectionListingCardProps = {
  href: string;
  title: string;
  excerpt?: string;
  image: ReactNode;
  imageOverlay?: ReactNode;
  date?: string;
  supplementalMeta?: string;
  category?: CollectionListingTaxonomy;
  series?: CollectionListingTaxonomy;
  display: CollectionDisplayOverrides;
};

/**
 * Shared Grid/List presenter for Collection Modules.
 *
 * Domain adapters supply resolved items and links. This presenter owns only
 * item limiting, column behavior, responsive layout, and visual consistency.
 */
export function CollectionListingPresentation<Item>({
  items,
  itemLimit,
  presentation,
  itemsPerRow,
  keyForItem,
  renderItem,
}: CollectionListingPresentationProps<Item>) {
  const visibleItems = items.slice(0, itemLimit);

  if (!visibleItems.length) return null;

  return (
    <div
      className={
        presentation === "grid"
          ? `grid grid-cols-1 items-stretch gap-6 ${GRID_COLUMN_CLASSES[itemsPerRow]}`
          : "space-y-6"
      }
      data-collection-listing-presentation={presentation}
      data-collection-listing-items-per-row={
        presentation === "grid" ? itemsPerRow : undefined
      }
      data-collection-listing-item-limit={itemLimit}
    >
      {visibleItems.map((item) => (
        <Fragment key={keyForItem(item)}>{renderItem(item)}</Fragment>
      ))}
    </div>
  );
}

/** Shared Collection card geometry. */
export function CollectionListingCard({
  href,
  title,
  excerpt,
  image,
  imageOverlay,
  date,
  supplementalMeta,
  category,
  series,
  display,
}: CollectionListingCardProps) {
  const showTitle = display.title && Boolean(title);
  const showImage = display.image && Boolean(image);
  const showExcerpt = display.excerpt && Boolean(excerpt);
  const showCategory = display.category && Boolean(category?.label);
  const showSeries = display.series && Boolean(series?.label);
  const showDate = display.date && Boolean(date);
  const showSupplementalMeta = Boolean(supplementalMeta);
  const showDetails = display.details.visible && Boolean(display.details.text);
  const textFormatting = resolveCollectionDisplayTextFormatting(display);
  const hasTaxonomy = showCategory || showSeries;
  const hasLinkedCopy =
    showTitle || showExcerpt || showDate || showSupplementalMeta || showDetails;
  const detailsAction = showDetails ? (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 text-sm text-[#E8CE94] transition group-hover:text-[#F2D99B]",
        display.details.bold ? "font-semibold" : "font-normal",
        display.details.alignment === "center"
          ? "mx-auto text-center"
          : display.details.alignment === "left"
            ? "mr-auto ml-0 text-left"
            : "ml-auto mr-0 text-right",
      ].join(" ")}
      data-collection-listing-details=""
    >
      {display.details.text}
      <span aria-hidden="true">←</span>
    </span>
  ) : null;
  const hasTextColumn = hasTaxonomy || hasLinkedCopy;

  return (
    <article className="group @container/collection-listing-card block h-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/30 hover:bg-white/[0.04]">
      <div
        dir="ltr"
        className={`grid h-full min-h-[390px] gap-4 px-3 py-2.5 @2xl/collection-listing-card:min-h-0 @2xl/collection-listing-card:items-center ${
          hasTextColumn && showImage
            ? "@2xl/collection-listing-card:grid-cols-[minmax(0,1fr)_250px]"
            : "grid-cols-1"
        }`}
      >
        {hasTextColumn ? (
          <div dir="rtl" className="flex min-w-0 flex-col text-right">
            {hasTaxonomy ? (
              <div className="mb-2 flex w-full flex-col gap-1 overflow-hidden [&>*]:min-w-0 [&>*]:truncate [&>*]:whitespace-nowrap">
                {showCategory ? (
                  <span
                    className={`block w-full ${pageBlockTextAlignClass(textFormatting.categoryAlignment)}`}
                  >
                    <PublicGoldPill href={category?.href}>
                      <span className={textFormatting.categoryBold ? "font-bold" : undefined}>
                        {category?.label}
                      </span>
                    </PublicGoldPill>
                  </span>
                ) : null}

                {showSeries ? (
                  <span
                    className={`block w-full ${pageBlockTextAlignClass(textFormatting.seriesAlignment)}`}
                  >
                    <PublicGoldPill href={series?.href}>
                      <span className={textFormatting.seriesBold ? "font-bold" : undefined}>
                        {series?.label}
                      </span>
                    </PublicGoldPill>
                  </span>
                ) : null}
              </div>
            ) : null}

            {hasLinkedCopy ? (
              <Link href={href} className="flex min-w-0 flex-1 flex-col gap-1.5">
                {showTitle ? (
                  <h2
                    className={`line-clamp-2 text-2xl leading-8 text-white transition-colors duration-300 group-hover:text-[#D8B87A] md:text-[1.25rem] ${textFormatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(textFormatting.titleAlignment)}`}
                  >
                    {title}
                  </h2>
                ) : null}

                {showExcerpt ? (
                  <p
                    className={`line-clamp-3 leading-7 text-white/60 ${textFormatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(textFormatting.excerptAlignment)}`}
                  >
                    {excerpt}
                  </p>
                ) : null}

                {showDate || showSupplementalMeta || showDetails ? (
                  <div className="flex min-h-5 w-full items-center gap-3 text-sm text-white/45">
                    {display.details.alignment !== "left" ? detailsAction : null}
                    {showDate || showSupplementalMeta ? (
                      <span
                        className={`block min-w-0 flex-1 ${showDate ? pageBlockTextAlignClass(textFormatting.dateAlignment) : "text-right"}`}
                      >
                        {showDate ? (
                          <span className={textFormatting.dateBold ? "font-bold" : "font-normal"}>
                            {date}
                          </span>
                        ) : null}
                        {showDate && showSupplementalMeta ? <span>•</span> : null}
                        {showSupplementalMeta ? <span>{supplementalMeta}</span> : null}
                      </span>
                    ) : null}
                    {display.details.alignment === "left" ? detailsAction : null}
                  </div>
                ) : null}
              </Link>
            ) : null}
          </div>
        ) : null}

        {showImage ? (
          <Link
            href={href}
            aria-label={`فتح ${title}`}
            className="relative mt-auto block h-[170px] overflow-hidden rounded-[1.5rem] @2xl/collection-listing-card:mt-0"
          >
            {image}
            {imageOverlay}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
