"use client";

import type { VisionGoalsContent, VisionGoalsItem } from "./vision-goals-mappers";

export type VisionGoalsModuleSectionProps = {
  cmsContent: VisionGoalsContent | null;
};

function hasItemCopy(item: VisionGoalsItem) {
  return Boolean(item.title.trim() || item.text.trim());
}

function renderItemLabel(item: VisionGoalsItem) {
  if (item.title && item.text) {
    return (
      <>
        <span className="font-semibold text-white/82">{item.title}</span>
        <span className="text-white/65"> : {item.text}</span>
      </>
    );
  }

  return <span>{item.title || item.text}</span>;
}

function VisionGoalsColumnBlock({ column }: { column: VisionGoalsContent["vision"] }) {
  const items = column.items.filter(hasItemCopy);
  if (!column.title.trim() && !items.length) return null;

  return (
    <div>
      {column.title.trim() ? (
        <div className="mb-5 flex items-center gap-3 text-[#D8B87A]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D8B87A]/30">
            ◎
          </span>
          <h3 className="text-lg font-semibold">{column.title}</h3>
        </div>
      ) : null}

      {items.length ? (
        <ul className="space-y-3 text-sm text-white/65">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="flex items-center gap-3">
              <span className="h-px w-4 shrink-0 bg-[#D8B87A]/70" />
              <span>{renderItemLabel(item)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function VisionGoalsModuleSection({ cmsContent }: VisionGoalsModuleSectionProps) {
  if (!cmsContent) return null;

  const content = cmsContent;
  const imageSrc = content.image?.trim();
  const imageAlt = content.imageAlt || content.eyebrow || content.title || "";
  const showImage = Boolean(imageSrc);
  const showCopy = Boolean(
    content.eyebrow.trim() ||
      content.title.trim() ||
      content.intro.some((paragraph) => paragraph.trim()) ||
      content.vision.title.trim() ||
      content.goals.title.trim() ||
      content.vision.items.some(hasItemCopy) ||
      content.goals.items.some(hasItemCopy),
  );

  if (!showImage && !showCopy) return null;

  return (
    <section className="relative border-y border-white/[0.05] py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div data-reveal className="max-w-2xl">
            {content.eyebrow.trim() ? (
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D8B87A]">
                {content.eyebrow}
              </p>
            ) : null}

            {content.title.trim() ? (
              <h2 className="text-3xl font-bold leading-tight text-white md:text-5xl">{content.title}</h2>
            ) : null}

            {content.intro.map((paragraph) =>
              paragraph.trim() ? (
                <p key={paragraph} className="mt-6 text-[15px] leading-8 text-white/70 md:text-[16px]">
                  {paragraph}
                </p>
              ) : null,
            )}

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <VisionGoalsColumnBlock column={content.vision} />
              <VisionGoalsColumnBlock column={content.goals} />
            </div>
          </div>

          {showImage ? (
            <div
              data-reveal
              className="group relative w-full overflow-hidden rounded-[1.75rem] border border-[#D8B87A]/10"
            >
              <div className="relative aspect-[16/12] overflow-hidden">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-[center_36%] transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
                />

                <div
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,11,0.65)_0%,rgba(5,7,11,0.12)_40%,transparent_70%)]"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
