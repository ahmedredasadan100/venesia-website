import Image from "next/image";
import Link from "next/link";

import type { CollectionContentHierarchy } from "../../lib/collection-modules/content-hierarchy";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import { resolveMediaCollectionItemDisplay } from "../../lib/media-center/collection-display-adapter";
import {
  pageBlockTextAlignClass,
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
} from "../../lib/page-blocks/configs";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubMosaicProps = {
  items: MediaContentItem[];
  contentHierarchy?: CollectionContentHierarchy;
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
  href: string;
  showDateWhenAvailable?: boolean;
};

function MosaicItem({
  item,
  primary = false,
  showDateWhenAvailable,
  display: displayOverrides,
}: {
  item: MediaContentItem;
  primary?: boolean;
  showDateWhenAvailable: boolean;
  display: CollectionDisplayOverrides;
}) {
  const display = resolveMediaCollectionItemDisplay(displayOverrides, item, {
    showDateWhenAvailable,
  });
  const formatting = resolveCollectionDisplayTextFormatting(display);

  return (
    <Link
      href={getMediaHref(item)}
      className={`group relative block overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035] ${
        primary
          ? "h-full min-h-[280px] @xl/slot-module:min-h-[300px]"
          : "aspect-[4/3] min-h-[135px] @xl/slot-module:aspect-auto @xl/slot-module:h-full @xl/slot-module:min-h-0"
      }`}
    >
      {display.image ? (
        <Image
          src={item.image}
          alt={item.imageAlt || item.title}
          fill
          sizes={primary
            ? "(max-width: 768px) 100vw, 45vw"
            : "(max-width: 768px) 50vw, 24vw"}
          className="object-cover object-center transition duration-700 group-hover:scale-105"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#05070B]/95 via-[#05070B]/20 to-transparent"
      />

      {display.image && item.type === "video" ? (
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
        <span className="flex w-full flex-col gap-1 text-[10px] text-[#D8B87A]">
          {display.category ? <span className={`block w-full truncate whitespace-nowrap ${formatting.categoryBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.categoryAlignment)}`}>{item.category}</span> : null}
          {display.series ? <span className={`block w-full truncate whitespace-nowrap ${formatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.seriesAlignment)}`}>{item.series}</span> : null}
          {display.date ? <span className={`block w-full truncate whitespace-nowrap ${formatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.dateAlignment)}`}>{item.date}</span> : null}
          {item.type === "video" && item.duration ? <span className="truncate whitespace-nowrap">{item.duration}</span> : null}
        </span>
        {display.title ? (
          <span
          className={`mt-2 block leading-snug text-white transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)} ${
            primary ? "line-clamp-2 text-xl @xl/slot-module:text-2xl" : "line-clamp-2 text-xs"
          }`}
        >
          {item.title}
        </span>
        ) : null}
        {display.excerpt ? (
          <span className={`mt-1 block ${primary ? "line-clamp-2 text-xs leading-5" : "line-clamp-1 text-[10px]"} text-white/55 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`}>
            {item.excerpt}
          </span>
        ) : null}
        {display.details.visible ? (
          <span className={`mt-1 block w-full truncate whitespace-nowrap text-[10px] text-[#D8B87A] ${display.details.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(display.details.alignment)}`}>
            {display.details.text} ←
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export default function MediaCenterHubMosaic({
  items,
  contentHierarchy,
  presentation,
  display,
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
          display={display}
        />
        {secondaryItems.length ? (
          <div className="grid grid-cols-2 gap-3 @xl/slot-module:h-full @xl/slot-module:auto-rows-fr">
            {secondaryItems.map((item) => (
              <MosaicItem
                key={item.id}
                item={item}
                showDateWhenAvailable={showDateWhenAvailable}
                display={display}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
