import Image from "next/image";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";
import {
  type CollectionDisplayOverrides,
} from "../../lib/page-blocks/configs";
import { resolveMediaCollectionItemDisplay } from "../../lib/media-center/collection-display-adapter";
import { CollectionListingCard } from "../collection-modules/CollectionListingPresenter";

type MediaContentCardProps = {
  item: MediaContentItem;
  href?: string;
  displayOverrides: CollectionDisplayOverrides;
};

export default function MediaContentCard({
  item,
  href,
  displayOverrides,
}: MediaContentCardProps) {
  const finalHref = href ?? getMediaHref(item);
  const display = resolveMediaCollectionItemDisplay(displayOverrides, item);

  return (
    <CollectionListingCard
      href={finalHref}
      title={item.title}
      excerpt={item.excerpt}
      date={item.date}
      category={item.category ? { label: item.category } : undefined}
      series={item.series ? { label: item.series } : undefined}
      display={display}
      image={
        <Image
          src={item.image}
          alt={item.imageAlt || item.title}
          fill
          sizes="(max-width: 768px) 100vw, 250px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      }
      imageOverlay={
        item.duration ? (
          <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-[#05070B]/70 px-3 py-1 text-[11px] text-white/75 backdrop-blur">
            {item.duration}
          </span>
        ) : undefined
      }
    />
  );
}
