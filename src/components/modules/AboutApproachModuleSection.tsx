"use client";

import type { AboutApproachModuleContent } from "./about-approach-mappers";

export type AboutApproachModuleSectionProps = {
  cmsContent: AboutApproachModuleContent | null;
};

export default function AboutApproachModuleSection({ cmsContent }: AboutApproachModuleSectionProps) {
  if (!cmsContent) return null;

  const approach = cmsContent;

  if (!approach.eyebrow.trim() && !approach.text.trim() && !approach.highlightedText.trim()) {
    return null;
  }

  return (
    <section className="relative border-y border-white/[0.05] bg-[#060910] py-14 md:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 venesia-main-canvas opacity-40"
      />

      <div data-reveal className="relative mx-auto max-w-3xl px-6 text-center">
        {approach.eyebrow.trim() ? (
          <p className="font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/45">{approach.eyebrow}</p>
        ) : null}

        <p className="mt-5 text-xl font-medium leading-9 text-white/80 md:text-[1.35rem] md:leading-9">
          {approach.text}
          {approach.highlightedText ? <span className="text-white/55"> {approach.highlightedText}</span> : null}
        </p>
      </div>
    </section>
  );
}
