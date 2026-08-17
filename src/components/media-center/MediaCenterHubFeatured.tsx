import Image from "next/image";
import Link from "next/link";
import {
  getMediaHref,
  MEDIA_TYPE_PATHS,
  type MediaContentItem,
} from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubFeaturedProps = {
  featuredItem: MediaContentItem;
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubFeatured({
  featuredItem,
  presentation,
}: MediaCenterHubFeaturedProps) {
  return (
    <section className="relative">
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href={`/media-center/${MEDIA_TYPE_PATHS[featuredItem.type]}`}
      />

      <Link href={getMediaHref(featuredItem)} className="group block">
        <article className="relative min-h-[445px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035]">
          <Image
            src={featuredItem.image}
            alt={featuredItem.title}
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover transition duration-1000 group-hover:scale-105"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/55 to-transparent"
          />

          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {featuredItem.showCategoryOnPage && featuredItem.category ? (
                <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                  {featuredItem.category}
                </span>
              ) : null}

              {featuredItem.showSeriesOnPage && featuredItem.series ? (
                <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                  {featuredItem.series}
                </span>
              ) : null}

              {featuredItem.showDateOnPage && featuredItem.date ? (
                <span className="text-xs text-white/55">
                  {featuredItem.date}
                </span>
              ) : null}
            </div>

            <h3 className="max-w-2xl text-2xl font-semibold leading-tight text-white md:text-3xl">
              {featuredItem.title}
            </h3>

            <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-white/68">
              {featuredItem.excerpt}
            </p>

            <div className="mt-6 flex">
              <span className="ms-auto inline-flex rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-5 py-2 text-xs font-medium text-[#D8B87A]">
                قراءة التفاصيل
              </span>
            </div>
          </div>
        </article>
      </Link>
    </section>
  );
}
