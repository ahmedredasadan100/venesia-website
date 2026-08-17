"use client";

import { useCallback, useMemo, useState } from "react";
import { useSwipeSlider } from "../../../hooks/use-swipe-slider";
import type { PublicProjectImage, PublicProjectPlan } from "../../../lib/projects/public-types";
import PublicMediaImage from "../../public/PublicMediaImage";

type ProjectPlansAndAreasSectionProps = {
  areas: PublicProjectPlan[];
  title: string | null;
};

export default function ProjectPlansAndAreasSection({
  areas,
  title,
}: ProjectPlansAndAreasSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<PublicProjectImage | null>(null);

  const isSlider = areas.length > 3;

  const visibleAreas = useMemo(() => {
    if (!isSlider) return areas;

    return [
      areas[activeIndex],
      areas[(activeIndex + 1) % areas.length],
      areas[(activeIndex + 2) % areas.length],
    ];
  }, [areas, activeIndex, isSlider]);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % areas.length);
  }, [areas.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((current) => (current === 0 ? areas.length - 1 : current - 1));
  }, [areas.length]);

  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLDivElement>({
    enabled: isSlider,
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  if (!areas.length) return null;

  return (
    <section
      id="plans"
      className="scroll-mt-24 border-y border-white/10 bg-white/[0.025] px-6 py-16"
    >
      <div className="mx-auto max-w-7xl">
        {(title || isSlider) ? (
          <div className="mb-9 flex flex-col gap-5 text-center lg:flex-row lg:items-end lg:justify-between lg:text-right">
            {title ? (
              <h2 className="text-3xl font-semibold text-[#D8B87A] md:text-4xl">
                {title}
              </h2>
            ) : null}

          {isSlider ? (
            <div className="flex justify-center gap-3 lg:justify-end">
              <button
                type="button"
                onClick={goPrev}
                aria-label="السابق"
                className="grid h-11 w-11 place-items-center rounded-full border border-[#D8B87A]/25 bg-[#05070B]/70 text-lg text-[#D8B87A] transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A] hover:text-[#111]"
              >
                →
              </button>

              <button
                type="button"
                onClick={goNext}
                aria-label="التالي"
                className="grid h-11 w-11 place-items-center rounded-full border border-[#D8B87A]/25 bg-[#05070B]/70 text-lg text-[#D8B87A] transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A] hover:text-[#111]"
              >
                ←
              </button>
            </div>
          ) : null}
          </div>
        ) : null}

        <div
          ref={containerRef}
          key={activeIndex}
          className="grid touch-pan-y gap-5 transition-all duration-500 ease-out md:grid-cols-2 xl:grid-cols-3"
          {...swipeHandlers}
        >
          {visibleAreas.map((area, index) => (
            <AreaCard
              key={`${area.id}-${index}`}
              area={area}
              onOpenImage={setSelectedImage}
            />
          ))}
        </div>
      </div>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            aria-label="إغلاق الصورة"
            onClick={() => setSelectedImage(null)}
            className="absolute right-6 top-6 grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/45 text-2xl text-white transition hover:border-[#D8B87A] hover:text-[#D8B87A]"
          >
            ×
          </button>

          <PublicMediaImage
            src={selectedImage.src}
            alt={selectedImage.alt}
            width={1200}
            height={900}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-3xl object-contain shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
          />
        </div>
      ) : null}
    </section>
  );
}

function AreaCard({
  area,
  onOpenImage,
}: {
  area: PublicProjectPlan;
  onOpenImage: (image: PublicProjectImage) => void;
}) {
  const primaryImage = area.architecturalImage ?? area.furnishingImage;
  return (
    <article
      className={`relative overflow-hidden rounded-[28px] border bg-[#05070B]/70 p-5 transition ${
        area.featured
          ? "border-[#D8B87A]/55 shadow-[0_18px_45px_rgba(216,184,122,0.08)]"
          : "border-white/10 hover:border-[#D8B87A]/35"
      }`}
    >
      {primaryImage ? (
        <button
          type="button"
          onClick={() => onOpenImage(primaryImage)}
          className="group relative block h-56 w-full overflow-hidden rounded-2xl border border-[#D8B87A]/15 bg-black/25 text-right"
        >
          <PublicMediaImage
            src={primaryImage.src}
            alt={primaryImage.alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="cursor-zoom-in object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
          />
        </button>
      ) : null}

      <div className="relative -mt-3 mb-4 flex justify-center">
        <div className="rounded-full border border-[#D8B87A]/35 bg-[#05070B] px-4 py-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          <span className="font-en text-sm font-semibold text-[#D8B87A]">
            {area.areaText || area.name}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {area.details.map((spec) => (
          <span
            key={spec.id}
            className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-white/65"
          >
            {spec.label}: {spec.value}
          </span>
        ))}
      </div>
    </article>
  );
}
