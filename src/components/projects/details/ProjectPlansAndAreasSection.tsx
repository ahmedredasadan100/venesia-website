"use client";

import { useMemo, useState } from "react";

type ResidentialAreaOption = {
  area: string;
  label?: string;
  planImage: string;
  specs: string[];
  featured?: boolean;
};

type ProjectPlansAndAreasSectionProps = {
  areas: ResidentialAreaOption[];
};

export default function ProjectPlansAndAreasSection({
  areas,
}: ProjectPlansAndAreasSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isSlider = areas.length > 3;

  const visibleAreas = useMemo(() => {
    if (!isSlider) return areas;

    return [
      areas[activeIndex],
      areas[(activeIndex + 1) % areas.length],
      areas[(activeIndex + 2) % areas.length],
    ];
  }, [areas, activeIndex, isSlider]);

  if (!areas.length) return null;

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % areas.length);
  };

  const goPrev = () => {
    setActiveIndex((current) =>
      current === 0 ? areas.length - 1 : current - 1,
    );
  };

  return (
    <section
      id="plans"
      className="scroll-mt-24 border-y border-white/10 bg-white/[0.025] px-6 py-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-5 text-center lg:flex-row lg:items-end lg:justify-between lg:text-right">
          <div>
            <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">
              المساحات والمخططات
            </p>

            <h2 className="text-3xl font-semibold text-[#D8B87A] md:text-4xl">
              اختيارات واضحة لمساحات مدروسة
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/55 lg:mx-0">
              كل مساحة هنا لها توزيع عملي يخدم الحياة اليومية، من أول المدخل حتى
              آخر تفصيلة داخل الوحدة.
            </p>
          </div>

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

        <div
          key={activeIndex}
          className="grid gap-5 transition-all duration-500 md:grid-cols-2 xl:grid-cols-3"
        >
          {visibleAreas.map((area, index) => (
            <AreaCard
              key={`${area.area}-${index}`}
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

          <img
            src={selectedImage}
            alt="مخطط الوحدة"
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
  area: ResidentialAreaOption;
  onOpenImage: (image: string) => void;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-[28px] border bg-[#05070B]/70 p-5 transition ${
        area.featured
          ? "border-[#D8B87A]/55 shadow-[0_18px_45px_rgba(216,184,122,0.08)]"
          : "border-white/10 hover:border-[#D8B87A]/35"
      }`}
    >
      {area.label ? (
        <span className="absolute left-5 top-5 z-20 rounded-full bg-[#D8B87A] px-3 py-1 text-xs font-semibold text-[#111]">
          {area.label}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenImage(area.planImage)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-[#D8B87A]/15 bg-black/25 text-right"
      >
        <img
          src={area.planImage}
          alt={area.area}
          className="h-56 w-full cursor-zoom-in object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
        />
      </button>

      <div className="relative -mt-3 mb-4 flex justify-center">
        <div className="rounded-full border border-[#D8B87A]/35 bg-[#05070B] px-4 py-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          <span className="font-en text-sm font-semibold text-[#D8B87A]">
            {area.area}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {area.specs.map((spec) => (
          <span
            key={spec}
            className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-white/65"
          >
            {spec}
          </span>
        ))}
      </div>
    </article>
  );
}