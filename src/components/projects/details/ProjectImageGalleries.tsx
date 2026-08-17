"use client";

import { useCallback, useState } from "react";

import { useSwipeSlider } from "../../../hooks/use-swipe-slider";
import type { PublicProjectImage } from "../../../lib/projects/public-types";
import PublicMediaImage from "../../public/PublicMediaImage";

type GalleryImage = PublicProjectImage & { id: string };

function GalleryArrow({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "previous" ? "المجموعة السابقة" : "المجموعة التالية"}
      className="grid size-11 place-items-center rounded-full border border-[#D8B87A]/30 bg-[#05070B]/80 text-lg text-[#D8B87A] transition hover:border-[#D8B87A] hover:bg-[#D8B87A] hover:text-[#111]"
    >
      {direction === "previous" ? "→" : "←"}
    </button>
  );
}

export function ProjectDeliveryGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [groupIndex, setGroupIndex] = useState(0);
  const groupCount = Math.max(1, Math.ceil(images.length / 4));
  const safeGroupIndex = Math.min(groupIndex, groupCount - 1);
  const activeImage = images[activeIndex] ?? images[0];
  const visibleImages = images.slice(safeGroupIndex * 4, safeGroupIndex * 4 + 4);
  const hasRail = images.length > 4;

  const goNext = useCallback(() => {
    const nextGroup = (safeGroupIndex + 1) % groupCount;
    setGroupIndex(nextGroup);
    setActiveIndex(nextGroup * 4);
  }, [groupCount, safeGroupIndex]);
  const goPrevious = useCallback(() => {
    const previousGroup = (safeGroupIndex - 1 + groupCount) % groupCount;
    setGroupIndex(previousGroup);
    setActiveIndex(previousGroup * 4);
  }, [groupCount, safeGroupIndex]);
  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLDivElement>({
    enabled: hasRail,
    onSwipeLeft: goNext,
    onSwipeRight: goPrevious,
  });

  if (!activeImage) return null;

  return (
    <div className="overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-white/[0.025] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
      <div className="relative h-[360px] overflow-hidden rounded-[24px]">
        <PublicMediaImage
          src={activeImage.src}
          alt={activeImage.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          {hasRail ? <GalleryArrow direction="previous" onClick={goPrevious} /> : null}
          <div
            ref={containerRef}
            className="grid min-w-0 flex-1 touch-pan-y grid-cols-4 gap-2"
            {...swipeHandlers}
          >
            {visibleImages.map((image) => {
              const index = images.findIndex((candidate) => candidate.id === image.id);
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`عرض ${image.alt}`}
                  className={`relative h-20 overflow-hidden rounded-xl border transition-all ${
                    activeImage.id === image.id
                      ? "border-[#D8B87A] ring-1 ring-[#D8B87A]"
                      : "border-white/10 hover:border-[#D8B87A]/40"
                  }`}
                >
                  <PublicMediaImage
                    src={image.src}
                    alt=""
                    fill
                    sizes="140px"
                    className="object-cover opacity-85 transition duration-500 hover:scale-105 hover:opacity-100"
                  />
                </button>
              );
            })}
          </div>
          {hasRail ? <GalleryArrow direction="next" onClick={goNext} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectMainGallery({ images }: { images: GalleryImage[] }) {
  const [groupIndex, setGroupIndex] = useState(0);
  const groupCount = Math.max(1, Math.ceil(images.length / 3));
  const safeGroupIndex = Math.min(groupIndex, groupCount - 1);
  const visibleImages = images.slice(safeGroupIndex * 3, safeGroupIndex * 3 + 3);
  const hasCarousel = images.length > 3;
  const goNext = useCallback(() => {
    setGroupIndex((current) => (Math.min(current, groupCount - 1) + 1) % groupCount);
  }, [groupCount]);
  const goPrevious = useCallback(() => {
    setGroupIndex((current) => (Math.min(current, groupCount - 1) - 1 + groupCount) % groupCount);
  }, [groupCount]);
  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLDivElement>({
    enabled: hasCarousel,
    onSwipeLeft: goNext,
    onSwipeRight: goPrevious,
  });

  return (
    <div>
      <div
        ref={containerRef}
        className="grid touch-pan-y gap-5 sm:grid-cols-2 lg:grid-cols-3"
        {...swipeHandlers}
      >
        {visibleImages.map((image) => (
          <div key={image.id} className="relative min-h-64 overflow-hidden rounded-[26px] border border-white/10">
            <PublicMediaImage
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {hasCarousel ? (
        <div className="mt-6 flex justify-center gap-3">
          <GalleryArrow direction="previous" onClick={goPrevious} />
          <span className="flex min-h-11 items-center px-3 text-xs text-white/45" dir="ltr">
            {safeGroupIndex + 1} / {groupCount}
          </span>
          <GalleryArrow direction="next" onClick={goNext} />
        </div>
      ) : null}
    </div>
  );
}
