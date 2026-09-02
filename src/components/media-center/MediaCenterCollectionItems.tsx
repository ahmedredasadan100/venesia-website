import Image from "next/image";
import Link from "next/link";

import type { CollectionView } from "../../lib/collection-modules/collection-view";
import {
  getMediaHref,
  type MediaContentItem,
} from "../../lib/media-center/types";
import { resolveMediaCollectionItemDisplay } from "../../lib/media-center/collection-display-adapter";
import {
  pageBlockTextAlignClass,
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
  type ResolvedCollectionModuleDisplayFormatting,
} from "../../lib/page-blocks/configs";

const GRID_COLUMNS: Record<CollectionView["itemsPerRow"], string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @xl/slot-module:grid-cols-2",
  3: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-3",
  4: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-4",
};

function ItemMetadata({
  item,
  display,
}: {
  item: MediaContentItem;
  display: ResolvedCollectionModuleDisplayFormatting;
}) {
  const formatting = resolveCollectionDisplayTextFormatting(display);

  if (!display.category && !display.series && !display.date) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-1 text-xs text-white/45">
      {display.category ? (
        <span
          className={`block w-full text-[#D8B87A]/75 ${formatting.categoryBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.categoryAlignment)}`}
        >
          {item.category}
        </span>
      ) : null}
      {display.series ? (
        <span
          className={`block w-full text-[#D8B87A]/75 ${formatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.seriesAlignment)}`}
        >
          {item.series}
        </span>
      ) : null}
      {display.date ? (
        <span
          className={`block w-full ${formatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.dateAlignment)}`}
        >
          {item.date}
        </span>
      ) : null}
    </div>
  );
}

function ItemDetails({
  display,
}: {
  display: ResolvedCollectionModuleDisplayFormatting;
}) {
  if (!display.details.visible) return null;

  return (
    <span
      className={`mt-3 block w-full text-xs text-[#D8B87A] ${display.details.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(display.details.alignment)}`}
    >
      {display.details.text} ←
    </span>
  );
}

function MediaMarker({ item }: { item: MediaContentItem }) {
  if (item.type !== "video") return null;

  return (
    <>
      <span className="absolute inset-0 flex items-center justify-center text-xl text-white">▶</span>
      {item.duration ? (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
          {item.duration}
        </span>
      ) : null}
    </>
  );
}

function CollectionListItem({
  item,
  compact,
  showDateWhenAvailable,
  displayOverrides,
}: {
  item: MediaContentItem;
  compact: boolean;
  showDateWhenAvailable: boolean;
  displayOverrides: CollectionDisplayOverrides;
}) {
  const display = resolveMediaCollectionItemDisplay(displayOverrides, item, {
    showDateWhenAvailable,
  });
  const formatting = resolveCollectionDisplayTextFormatting(display);

  return (
    <Link
      href={getMediaHref(item)}
      className={`group grid gap-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3 transition duration-500 hover:border-[#D8B87A]/35 ${
        display.image
          ? compact
            ? "grid-cols-[84px_1fr]"
            : "grid-cols-[112px_1fr]"
          : "grid-cols-1"
      }`}
    >
      {display.image ? (
        <div className="relative aspect-square overflow-hidden rounded-[0.9rem] bg-white/5">
          <Image
            src={item.image}
            alt={item.imageAlt || item.title}
            fill
            sizes="112px"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <MediaMarker item={item} />
        </div>
      ) : null}
      <div className="min-w-0 self-center">
        <ItemMetadata item={item} display={display} />
        {display.title ? (
          <h3
            className={`mt-2 line-clamp-2 text-sm leading-6 text-white transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)}`}
          >
            {item.title}
          </h3>
        ) : null}
        {!compact && display.excerpt ? (
          <p
            className={`mt-2 line-clamp-2 text-xs leading-6 text-white/45 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`}
          >
            {item.excerpt}
          </p>
        ) : null}
        <ItemDetails display={display} />
      </div>
    </Link>
  );
}

function CollectionGridItem({
  item,
  compact,
  showDateWhenAvailable,
  displayOverrides,
}: {
  item: MediaContentItem;
  compact: boolean;
  showDateWhenAvailable: boolean;
  displayOverrides: CollectionDisplayOverrides;
}) {
  const display = resolveMediaCollectionItemDisplay(displayOverrides, item, {
    showDateWhenAvailable,
  });
  const formatting = resolveCollectionDisplayTextFormatting(display);

  return (
    <Link
      href={getMediaHref(item)}
      className="group overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.035] transition duration-500 hover:border-[#D8B87A]/35"
    >
      {display.image ? (
        <div className={`relative overflow-hidden bg-white/5 ${compact ? "aspect-[4/3]" : "aspect-[16/10]"}`}>
          <Image
            src={item.image}
            alt={item.imageAlt || item.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <MediaMarker item={item} />
        </div>
      ) : null}
      <div className={compact ? "p-3" : "p-5"}>
        <ItemMetadata item={item} display={display} />
        {display.title ? (
          <h3
            className={`mt-2 line-clamp-2 leading-7 text-white transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)}`}
          >
            {item.title}
          </h3>
        ) : null}
        {!compact && display.excerpt ? (
          <p
            className={`mt-3 line-clamp-3 text-sm leading-7 text-white/45 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`}
          >
            {item.excerpt}
          </p>
        ) : null}
        <ItemDetails display={display} />
      </div>
    </Link>
  );
}

export default function MediaCenterCollectionItems({
  items,
  view,
  showDateWhenAvailable = false,
  display,
}: {
  items: MediaContentItem[];
  view: CollectionView;
  showDateWhenAvailable?: boolean;
  display: CollectionDisplayOverrides;
}) {
  const compact = view.cardVariant === "compact";

  if (view.layout === "list") {
    return (
      <div className="grid gap-3">
        {items.map((item) => (
          <CollectionListItem
            key={item.id}
            item={item}
            compact={compact}
            showDateWhenAvailable={showDateWhenAvailable}
            displayOverrides={display}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${GRID_COLUMNS[view.itemsPerRow]}`}>
      {items.map((item) => (
        <CollectionGridItem
          key={item.id}
          item={item}
          compact={compact}
          showDateWhenAvailable={showDateWhenAvailable}
          displayOverrides={display}
        />
      ))}
    </div>
  );
}
