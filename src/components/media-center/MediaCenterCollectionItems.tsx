import Image from "next/image";
import Link from "next/link";

import type { CollectionView } from "../../lib/collection-modules/collection-view";
import {
  getMediaHref,
  type MediaContentItem,
} from "../../lib/media-center/types";

const GRID_COLUMNS: Record<CollectionView["itemsPerRow"], string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 @xl/slot-module:grid-cols-2",
  3: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-3",
  4: "grid-cols-1 @xl/slot-module:grid-cols-2 @5xl/slot-module:grid-cols-4",
};

function ItemMetadata({ item }: { item: MediaContentItem }) {
  if (!item.showCategoryOnPage && !item.showSeriesOnPage && !item.showDateOnPage) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
      {item.showCategoryOnPage && item.category ? <span>{item.category}</span> : null}
      {item.showSeriesOnPage && item.series ? (
        <span className="text-[#D8B87A]/75">{item.series}</span>
      ) : null}
      {item.showDateOnPage && item.date ? <span>{item.date}</span> : null}
    </div>
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
}: {
  item: MediaContentItem;
  compact: boolean;
}) {
  return (
    <Link
      href={getMediaHref(item)}
      className={`group grid gap-4 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-3 transition duration-500 hover:border-[#D8B87A]/35 ${
        compact ? "grid-cols-[84px_1fr]" : "grid-cols-[112px_1fr]"
      }`}
    >
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
      <div className="min-w-0 self-center">
        <ItemMetadata item={item} />
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
          {item.title}
        </h3>
        {!compact && item.showExcerptOnPage && item.excerpt ? (
          <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/45">{item.excerpt}</p>
        ) : null}
      </div>
    </Link>
  );
}

function CollectionGridItem({
  item,
  compact,
}: {
  item: MediaContentItem;
  compact: boolean;
}) {
  return (
    <Link
      href={getMediaHref(item)}
      className="group overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.035] transition duration-500 hover:border-[#D8B87A]/35"
    >
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
      <div className={compact ? "p-3" : "p-5"}>
        <ItemMetadata item={item} />
        <h3 className="mt-2 line-clamp-2 font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
          {item.title}
        </h3>
        {!compact && item.showExcerptOnPage && item.excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/45">{item.excerpt}</p>
        ) : null}
      </div>
    </Link>
  );
}

export default function MediaCenterCollectionItems({
  items,
  view,
}: {
  items: MediaContentItem[];
  view: CollectionView;
}) {
  const compact = view.cardVariant === "compact";

  if (view.layout === "list") {
    return (
      <div className="grid gap-3">
        {items.map((item) => (
          <CollectionListItem key={item.id} item={item} compact={compact} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${GRID_COLUMNS[view.itemsPerRow]}`}>
      {items.map((item) => (
        <CollectionGridItem key={item.id} item={item} compact={compact} />
      ))}
    </div>
  );
}
