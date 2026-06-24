"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MediaContentItem } from "../../lib/media-center";

type MediaCenterHubPressProps = {
  items: MediaContentItem[];
};

const ITEMS_PER_VIEW = 4;

export default function MediaCenterHubPress({
  items,
}: MediaCenterHubPressProps) {
  const [startIndex, setStartIndex] = useState(0);

  const visibleItems = useMemo(() => {
    if (items.length <= ITEMS_PER_VIEW) return items;

    return Array.from({ length: ITEMS_PER_VIEW }, (_, index) => {
      return items[(startIndex + index) % items.length];
    });
  }, [items, startIndex]);

  const canSlide = items.length > ITEMS_PER_VIEW;

  function goNext() {
    if (!canSlide) return;
    setStartIndex((current) => (current + 1) % items.length);
  }

  function goPrev() {
    if (!canSlide) return;
    setStartIndex((current) => (current - 1 + items.length) % items.length);
  }

  return (
    <section className="relative">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#D8B87A]/70">
            Press Releases
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            البيانات الصحفية
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {canSlide ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="البيان السابق"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
              >
                →
              </button>

              <button
                type="button"
                onClick={goNext}
                aria-label="البيان التالي"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
              >
                ←
              </button>
            </div>
          ) : null}

          <Link
            href="/media-center/press"
            className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
          >
            كل البيانات
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={`/media-center/press/${item.slug}`}
            className="group block"
          >
            <article className="flex h-full flex-col rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/35">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D8B87A]/25 bg-[#D8B87A]/10 text-[#D8B87A]">
                ▣
              </div>

              <p className="text-xs text-white/35">{item.date}</p>

              <h3 className="mt-3 min-h-[56px] line-clamp-2 text-base font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                {item.title}
              </h3>

              <p className="mt-3 min-h-[72px] line-clamp-3 text-xs leading-6 text-white/48">
                {item.excerpt}
              </p>

              <span className="mt-auto pt-5 inline-flex text-xs font-medium text-[#D8B87A]">
                قراءة البيان ←
              </span>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}