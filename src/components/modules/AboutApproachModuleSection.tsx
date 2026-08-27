import type { AboutApproachModuleContent } from "./about-approach-mappers";
import { pageBlockTextAlignClass } from "../../lib/page-blocks/configs";

export type AboutApproachModuleSectionProps = {
  cmsContent: AboutApproachModuleContent | null;
};

export default function AboutApproachModuleSection({ cmsContent }: AboutApproachModuleSectionProps) {
  if (!cmsContent) return null;

  const approach = cmsContent;
  const eyebrowFormat = approach.formatting.eyebrow!;
  const titleFormat = approach.formatting.title!;

  if (!(eyebrowFormat.visible && approach.eyebrow.trim()) && !(titleFormat.visible && (approach.text.trim() || approach.highlightedText.trim()))) {
    return null;
  }

  return (
    <section className="relative border-y border-white/[0.05] bg-[#060910] py-12 @xl/slot-module:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 venesia-main-canvas opacity-40"
      />

      <div data-reveal className="relative mx-auto max-w-3xl px-6 text-center">
        {eyebrowFormat.visible && approach.eyebrow.trim() ? (
          <p className={`font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/45 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}>{approach.eyebrow}</p>
        ) : null}

        {titleFormat.visible ? <p className={`mt-5 text-xl leading-9 text-white/80 @xl/slot-module:text-[1.35rem] @xl/slot-module:leading-9 ${pageBlockTextAlignClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>
          {approach.text}
          {approach.highlightedText ? <span className="text-white/55"> {approach.highlightedText}</span> : null}
        </p> : null}
      </div>
    </section>
  );
}
