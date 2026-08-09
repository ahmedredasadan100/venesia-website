"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getMediaHref, type MediaContentItem } from "../../lib/media-center/types";

type MediaCenterHubFeaturedProps = {
  featuredItem: MediaContentItem;
  news: MediaContentItem[];
  sideLimit?: number;
};

export default function MediaCenterHubFeatured({
  featuredItem,
  news,
  sideLimit = 3,
}: MediaCenterHubFeaturedProps) {
  const sideNews = news
    .filter((item) => item.id !== featuredItem.id)
    .slice(0, sideLimit);

  const [activeIndex, setActiveIndex] = useState(0);

  const activeItem = sideNews[activeIndex] ?? featuredItem;

  return (
    <section className="relative">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            Latest News
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
            آخر الأخبار
          </h2>
        </div>

        <Link
          href="/media-center/news"
          className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
        >
          استكشف الأخبار
        </Link>
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="order-2 flex flex-col lg:order-1">
          <div className="grid flex-1 gap-4">
            {sideNews.map((item, index) => (
              <Link
                key={item.id}
                href={getMediaHref(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className="group block"
              >
                <article
                  className={[
                    "grid h-full grid-cols-[118px_1fr] gap-4 overflow-hidden rounded-[1.35rem] border bg-white/[0.035] p-3 transition duration-500",
                    activeIndex === index
                      ? "border-[#D8B87A]/40"
                      : "border-white/10 hover:border-[#D8B87A]/30",
                  ].join(" ")}
                >
                  <div className="relative min-h-[98px] overflow-hidden rounded-[1rem]">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="118px"
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>

                  <div className="min-w-0">
                    {item.showDateOnPage && item.date ? (
                      <p className="text-xs text-white/38">{item.date}</p>
                    ) : null}

                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white transition group-hover:text-[#D8B87A]">
                      {item.title}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/48">
                      {item.excerpt}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>

          {sideNews.length > 1 ? (
            <div className="mt-4 flex justify-center gap-2">
              {sideNews.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`عرض الخبر ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                  className={[
                    "h-2 rounded-full transition-all duration-300",
                    activeIndex === index
                      ? "w-7 bg-[#D8B87A]"
                      : "w-2 bg-white/25 hover:bg-white/45",
                  ].join(" ")}
                />
              ))}
            </div>
          ) : null}
        </div>

        <Link
          href={getMediaHref(activeItem)}
          className="group order-1 block lg:order-2"
        >
          <article className="relative min-h-[445px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035]">
            <Image
              src={activeItem.image}
              alt={activeItem.title}
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
                {activeItem.showCategoryOnPage && activeItem.category ? (
                  <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                    {activeItem.category}
                  </span>
                ) : null}

                {activeItem.showSeriesOnPage && activeItem.series ? (
                  <span className="rounded-full border border-[#D8B87A]/35 bg-[#05070B]/70 px-4 py-1.5 text-[11px] font-medium text-[#D8B87A] backdrop-blur">
                    {activeItem.series}
                  </span>
                ) : null}

                {activeItem.showDateOnPage && activeItem.date ? (
                  <span className="text-xs text-white/55">
                    {activeItem.date}
                  </span>
                ) : null}
              </div>

              <h3 className="max-w-2xl text-2xl font-semibold leading-tight text-white md:text-3xl">
                {activeItem.title}
              </h3>

              <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-7 text-white/68">
                {activeItem.excerpt}
              </p>

<div className="mt-6 flex">
  <span className="ms-auto inline-flex rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-5 py-2 text-xs font-medium text-[#D8B87A]">
    قراءة التفاصيل
  </span>
</div>            
           
            </div>
          </article>
        </Link>
      </div>
    </section>
  );
}
