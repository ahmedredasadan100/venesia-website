import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";

type MediaCenterHubGalleryProps = {
  items: MediaContentItem[];
};

export default function MediaCenterHubGallery({
  items,
}: MediaCenterHubGalleryProps) {
  const featuredImage = items[0];
  const sideImages = items.slice(1, 5);

  if (!featuredImage) return null;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            Gallery
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            معرض الصور
          </h2>
        </div>

        <Link
          href="/media-center/gallery"
          className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
        >
          استكشف القسم
        </Link>
      </div>

<div className="grid gap-3 lg:grid-cols-[1.35fr_0.85fr] lg:[direction:ltr]">        <div className="grid grid-cols-2 gap-3">
          {sideImages.map((item) => (
            <Link
              key={item.id}
              href={getMediaHref(item)}
              className="group relative min-h-[170px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035]"
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(min-width: 1024px) 220px, 45vw"
                className="object-cover transition duration-1000 group-hover:scale-105"
              />

              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-[#05070B]/20 to-transparent"
              />

              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                  {item.showCategoryOnPage && item.category ? (
                    <span className="inline-flex rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">{item.category}</span>
                  ) : null}
                  {item.showSeriesOnPage && item.series ? (
                    <span className="inline-flex rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">{item.series}</span>
                  ) : null}
                  {item.showDateOnPage && item.date ? <span>{item.date}</span> : null}
                </div>

                <h3 className="truncate text-sm font-semibold leading-6 text-white md:text-base">
                  {item.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>

        <Link
          href={getMediaHref(featuredImage)}
          className="group relative min-h-[360px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.035]"
        >
          <Image
            src={featuredImage.image}
            alt={featuredImage.title}
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover transition duration-1000 group-hover:scale-105"
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#05070B]/90 via-[#05070B]/20 to-transparent"
          />

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              {featuredImage.showCategoryOnPage && featuredImage.category ? (
                <span className="inline-flex rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">{featuredImage.category}</span>
              ) : null}
              {featuredImage.showSeriesOnPage && featuredImage.series ? (
                <span className="inline-flex rounded-full border border-white/15 bg-black/35 px-3 py-1 backdrop-blur">{featuredImage.series}</span>
              ) : null}
              {featuredImage.showDateOnPage && featuredImage.date ? <span>{featuredImage.date}</span> : null}
            </div>

            <h3 className="truncate text-lg font-semibold leading-8 text-white md:text-xl">
              {featuredImage.title}
            </h3>
          </div>
        </Link>
      </div>
    </section>
  );
}
