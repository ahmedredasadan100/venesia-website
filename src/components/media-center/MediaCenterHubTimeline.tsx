import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import { resolveMediaCollectionItemDisplay } from "../../lib/media-center/collection-display-adapter";
import {
  pageBlockTextAlignClass,
  resolveCollectionDisplayTextFormatting,
  type CollectionDisplayOverrides,
} from "../../lib/page-blocks/configs";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubTimelineProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
};

export default function MediaCenterHubTimeline({
  items,
  presentation,
  display,
}: MediaCenterHubTimelineProps) {
  const layout = presentation.collectionView.layout;
  const isTimelineDigest = layout === "timeline-digest";

  if (layout !== "timeline" && !isTimelineDigest) {
    return (
      <section>
        <MediaCenterHubSectionHeader
          presentation={presentation}
          href="/media-center/site-updates"
        />
        <MediaCenterCollectionItems
          items={items}
          view={presentation.collectionView}
          display={display}
        />
      </section>
    );
  }

  return (
    <section className={isTimelineDigest ? "flex h-full flex-col" : undefined}>
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/site-updates"
      />

      <div
        data-presentation-variant={layout}
        className={isTimelineDigest
          ? "relative flex flex-1 flex-col gap-4 before:absolute before:right-[9px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#D8B87A]/20"
          : "relative space-y-5 before:absolute before:right-[13px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#D8B87A]/20"}
      >
        {items.map((item) => {
          const itemDisplay = resolveMediaCollectionItemDisplay(display, item);
          const formatting = resolveCollectionDisplayTextFormatting(itemDisplay);

          return (
          <Link
            key={item.id}
            href={getMediaHref(item)}
            className={isTimelineDigest
              ? "group relative grid grow grid-cols-[22px_minmax(0,1fr)] gap-3"
              : "group relative grid grid-cols-[32px_1fr] gap-4"}
          >
            <span
              className={isTimelineDigest
                ? "relative z-10 mt-2 h-5 w-5 rounded-full border border-[#D8B87A]/35 bg-[#05070B] shadow-[0_0_0_4px_rgba(216,184,122,0.06)]"
                : "relative z-10 mt-2 h-7 w-7 rounded-full border border-[#D8B87A]/35 bg-[#05070B] shadow-[0_0_0_6px_rgba(216,184,122,0.06)]"}
            />

            <article
              className={isTimelineDigest
                ? `grid h-full items-stretch gap-4 rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-4 transition duration-500 hover:border-[#D8B87A]/35 ${itemDisplay.image ? "grid-cols-[92px_minmax(0,1fr)]" : "grid-cols-1"}`
                : `grid gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4 transition duration-500 hover:border-[#D8B87A]/35 ${itemDisplay.image ? "@xl/slot-module:grid-cols-[130px_1fr]" : "grid-cols-1"}`}
            >
              {itemDisplay.image ? (
                <div
                className={isTimelineDigest
                  ? "relative min-h-[92px] overflow-hidden rounded-[0.8rem]"
                  : "relative min-h-[105px] overflow-hidden rounded-[1rem]"}
              >
                <Image
                  src={item.image}
                  alt={item.imageAlt || item.title}
                  fill
                  sizes={isTimelineDigest ? "256px" : "160px"}
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                </div>
              ) : null}

              <div className={isTimelineDigest ? "min-w-0 self-center" : undefined}>
                <div className="flex w-full flex-col gap-1">
                  {item.project || itemDisplay.category ? (
                    <span className={`block w-full text-xs text-[#D8B87A]/75 ${formatting.categoryBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.categoryAlignment)}`}>
                      {item.project ?? item.category}
                    </span>
                  ) : null}

                  {itemDisplay.series ? (
                    <span className={`block w-full text-xs text-[#D8B87A]/75 ${formatting.seriesBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.seriesAlignment)}`}>
                      {item.series}
                    </span>
                  ) : null}

                  {itemDisplay.date ? (
                    <span className={`block w-full text-xs text-white/35 ${formatting.dateBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.dateAlignment)}`}>
                      {item.date}
                    </span>
                  ) : null}
                </div>

                {itemDisplay.title ? (
                  <h3 className={`mt-2 line-clamp-2 text-base leading-7 text-white transition group-hover:text-[#D8B87A] ${formatting.titleBold ? "font-semibold" : "font-normal"} ${pageBlockTextAlignClass(formatting.titleAlignment)}`}>
                    {item.title}
                  </h3>
                ) : null}

                {itemDisplay.excerpt ? (
                  <p className={`mt-2 line-clamp-2 text-xs leading-6 text-white/50 ${formatting.excerptBold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(formatting.excerptAlignment)}`}>
                    {item.excerpt}
                  </p>
                ) : null}
                {itemDisplay.details.visible ? (
                  <span className={`mt-2 block w-full text-xs text-[#D8B87A] ${itemDisplay.details.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(itemDisplay.details.alignment)}`}>
                    {itemDisplay.details.text} ←
                  </span>
                ) : null}
              </div>
            </article>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
