import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubTimelineProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubTimeline({
  items,
  presentation,
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
        {items.map((item) => (
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
                ? "grid h-full grid-cols-[92px_minmax(0,1fr)] items-stretch gap-4 rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-4 transition duration-500 hover:border-[#D8B87A]/35"
                : "grid gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-4 transition duration-500 hover:border-[#D8B87A]/35 @xl/slot-module:grid-cols-[130px_1fr]"}
            >
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

              <div className={isTimelineDigest ? "min-w-0 self-center" : undefined}>
                <div
                  className={isTimelineDigest
                    ? "flex flex-wrap items-center gap-2"
                    : "flex flex-wrap items-center gap-3"}
                >
                  {item.project || (item.showCategoryOnPage && item.category) ? (
                    <span className="text-xs text-[#D8B87A]/75">
                      {item.project ?? item.category}
                    </span>
                  ) : null}

                  {item.showSeriesOnPage && item.series ? (
                    <span className="text-xs text-[#D8B87A]/75">
                      {item.series}
                    </span>
                  ) : null}

                  {item.showDateOnPage && item.date ? (
                    <span className="text-xs text-white/35">
                      {item.date}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                  {item.title}
                </h3>

                <p className="mt-2 line-clamp-2 text-xs leading-6 text-white/50">
                  {item.excerpt}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
