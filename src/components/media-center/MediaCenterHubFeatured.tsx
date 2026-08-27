import Image from "next/image";
import Link from "next/link";

import type { CollectionContentHierarchy } from "../../lib/collection-modules/content-hierarchy";
import {
  getMediaHref,
  MEDIA_TYPE_PATHS,
  type MediaContentItem,
} from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubFeaturedProps = {
  items: MediaContentItem[];
  contentHierarchy?: CollectionContentHierarchy;
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubFeatured({
  items,
  contentHierarchy,
  presentation,
}: MediaCenterHubFeaturedProps) {
  const [primaryItem, ...remainingItems] = items;
  if (!primaryItem) return null;

  const hierarchyMode = contentHierarchy?.mode ?? "uniform";
  const secondaryItems = remainingItems.slice(
    0,
    contentHierarchy?.secondaryItemCount ?? remainingItems.length,
  );

  return (
    <section className="relative">
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href={`/media-center/${MEDIA_TYPE_PATHS[primaryItem.type]}`}
      />

      {hierarchyMode === "uniform" ? (
        <MediaCenterCollectionItems
          items={items}
          view={presentation.collectionView}
        />
      ) : (
        <div className="grid items-stretch gap-5 @4xl/slot-module:grid-cols-[1.1fr_0.9fr]">
          <Link href={getMediaHref(primaryItem)} className="group block">
            <article
              className={`relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] ${
                presentation.collectionView.cardVariant === "compact"
                  ? "min-h-[340px]"
                  : "min-h-[445px]"
              }`}
            >
              <Image
                src={primaryItem.image}
                alt={primaryItem.imageAlt || primaryItem.title}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover transition duration-1000 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/55 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-6 @xl/slot-module:p-8">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {primaryItem.showCategoryOnPage && primaryItem.category ? (
                    <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                      {primaryItem.category}
                    </span>
                  ) : null}
                  {primaryItem.showSeriesOnPage && primaryItem.series ? (
                    <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                      {primaryItem.series}
                    </span>
                  ) : null}
                  {primaryItem.showDateOnPage && primaryItem.date ? (
                    <span className="text-xs text-white/55">{primaryItem.date}</span>
                  ) : null}
                </div>
                <h3 className="max-w-2xl text-2xl font-semibold leading-tight text-white @xl/slot-module:text-3xl">
                  {primaryItem.title}
                </h3>
                {presentation.collectionView.cardVariant !== "compact" &&
                primaryItem.showExcerptOnPage &&
                primaryItem.excerpt ? (
                  <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-white/68">
                    {primaryItem.excerpt}
                  </p>
                ) : null}
              </div>
            </article>
          </Link>

          {secondaryItems.length ? (
            <MediaCenterCollectionItems
              items={secondaryItems}
              view={{ ...presentation.collectionView, itemsPerRow: 1 }}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
