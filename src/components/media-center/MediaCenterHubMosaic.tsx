import Image from "next/image";
import Link from "next/link";

import type { CollectionContentHierarchy } from "../../lib/collection-modules/content-hierarchy";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubMosaicProps = {
  items: MediaContentItem[];
  contentHierarchy?: CollectionContentHierarchy;
  presentation: MediaHubModulePresentation;
  href: string;
  showDateWhenAvailable?: boolean;
};

function MosaicItem({
  item,
  primary = false,
  showDateWhenAvailable,
}: {
  item: MediaContentItem;
  primary?: boolean;
  showDateWhenAvailable: boolean;
}) {
  const showDate = Boolean(item.date) && (
    item.showDateOnPage || showDateWhenAvailable
  );

  return (
    <Link
      href={getMediaHref(item)}
      className={`group relative block overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] ${
        primary
          ? "h-full min-h-[280px] @xl/slot-module:min-h-[300px]"
          : "aspect-[4/3] min-h-[135px] @xl/slot-module:aspect-auto @xl/slot-module:h-full @xl/slot-module:min-h-0"
      }`}
    >
      <Image
        src={item.image}
        alt={item.imageAlt || item.title}
        fill
        sizes={primary
          ? "(max-width: 768px) 100vw, 45vw"
          : "(max-width: 768px) 50vw, 24vw"}
        className="object-cover object-center transition duration-700 group-hover:scale-105"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#05070B]/95 via-[#05070B]/20 to-transparent"
      />

      {item.type === "video" ? (
        <span
          aria-hidden="true"
          className={`absolute inset-0 flex items-center justify-center text-white ${
            primary ? "text-3xl" : "text-lg"
          }`}
        >
          ▶
        </span>
      ) : null}

      <span className={`absolute inset-x-0 bottom-0 ${primary ? "p-6" : "p-3"}`}>
        <span className="flex flex-wrap items-center gap-2 text-[10px] text-[#D8B87A]">
          {item.showCategoryOnPage && item.category ? <span>{item.category}</span> : null}
          {item.showSeriesOnPage && item.series ? <span>{item.series}</span> : null}
          {showDate ? <span>{item.date}</span> : null}
          {item.type === "video" && item.duration ? <span>{item.duration}</span> : null}
        </span>
        <span
          className={`mt-2 block font-semibold leading-snug text-white transition group-hover:text-[#D8B87A] ${
            primary ? "line-clamp-2 text-xl @xl/slot-module:text-2xl" : "line-clamp-2 text-xs"
          }`}
        >
          {item.title}
        </span>
      </span>
    </Link>
  );
}

export default function MediaCenterHubMosaic({
  items,
  contentHierarchy,
  presentation,
  href,
  showDateWhenAvailable = false,
}: MediaCenterHubMosaicProps) {
  const [primaryItem, ...remainingItems] = items;
  if (!primaryItem) return null;

  const secondaryItems = remainingItems.slice(
    0,
    contentHierarchy?.secondaryItemCount ?? 4,
  );

  return (
    <section>
      <MediaCenterHubSectionHeader presentation={presentation} href={href} />
      <div className="grid items-stretch gap-3 @xl/slot-module:grid-cols-[1.05fr_0.95fr]">
        <MosaicItem
          item={primaryItem}
          primary
          showDateWhenAvailable={showDateWhenAvailable}
        />
        {secondaryItems.length ? (
          <div className="grid grid-cols-2 gap-3 @xl/slot-module:h-full @xl/slot-module:auto-rows-fr">
            {secondaryItems.map((item) => (
              <MosaicItem
                key={item.id}
                item={item}
                showDateWhenAvailable={showDateWhenAvailable}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
