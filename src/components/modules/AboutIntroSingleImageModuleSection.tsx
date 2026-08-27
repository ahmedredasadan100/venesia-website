"use client";

import Image from "next/image";

import RichTextContent from "../content/RichTextContent";
import {
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
  type PageBlockTextFormattingMap,
} from "../../lib/page-blocks/configs";

export type AboutIntroSingleImageBeat = {
  num: string;
  title: string;
  text: string;
};

export type AboutIntroSingleImageContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  formatting: PageBlockTextFormattingMap;
  image?: string;
  imageAlt?: string;
  imagePosition: "left" | "right";
  beats: AboutIntroSingleImageBeat[];
};

export type AboutIntroSingleImageModuleSectionProps = {
  content: AboutIntroSingleImageContent | null;
};

function hasFilledBeat(beat: AboutIntroSingleImageBeat) {
  return Boolean(beat.title?.trim() || beat.text?.trim());
}

export default function AboutIntroSingleImageModuleSection({
  content,
}: AboutIntroSingleImageModuleSectionProps) {
  if (!content) return null;

  const beats = (content.beats ?? []).filter(hasFilledBeat);
  const eyebrowFormat = content.formatting.eyebrow!;
  const titleFormat = content.formatting.title!;
  const subtitleFormat = content.formatting.subtitle!;
  const descriptionFormat = content.formatting.description!;
  const showCopy = Boolean(
    (eyebrowFormat.visible && content.eyebrow?.trim()) ||
      (titleFormat.visible && content.title?.trim()) ||
      (subtitleFormat.visible && content.subtitle?.trim()) ||
      (descriptionFormat.visible && content.description?.trim()),
  );
  const imageSrc = content.image?.trim();
  const showImage = Boolean(imageSrc);
  const showBeats = Boolean(beats.length);

  if (!showCopy && !showImage && !showBeats) return null;

  const imageOnRight = content.imagePosition === "right";

  return (
    <section className="relative overflow-hidden pb-10 pt-8 @xl/slot-module:pb-12 @xl/slot-module:pt-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 venesia-projects-cap opacity-85"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(to_bottom,#05070B_0%,rgba(5,7,11,0.42)_45%,transparent_100%)]"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div
          className={[
            showImage ? "slot-editorial-flow" : "",
            showImage && !imageOnRight ? "slot-editorial-flow--media-end" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-module-presentation={showImage ? "editorial-flow" : undefined}
          dir="rtl"
        >
          {showImage && imageSrc ? (
            <div
              data-reveal="fade-up"
              data-delay="120"
              className="slot-editorial-media group relative w-full overflow-hidden rounded-[1.75rem] border border-[#D8B87A]/10"
              data-editorial-media-side={imageOnRight ? "start" : "end"}
            >
              <div className="relative aspect-[16/12] overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={content.imageAlt || content.title || ""}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[center_36%] transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,11,0.65)_0%,rgba(5,7,11,0.12)_40%,transparent_70%)]"
                />
              </div>
            </div>
          ) : null}

          {showCopy || showBeats ? (
            <div
              dir="rtl"
              className="slot-editorial-copy min-w-0"
            >
              {showCopy ? (
                <>
                  {eyebrowFormat.visible && content.eyebrow?.trim() ? (
                    <p
                      data-reveal="fade-up"
                      data-delay="410"
                      className={`mb-5 flex items-center gap-3 font-en text-[10px] uppercase tracking-[0.22em] text-[#D8B87A]/58 ${pageBlockTextAlignClass(eyebrowFormat.alignment)} ${eyebrowFormat.bold ? "font-bold" : "font-normal"}`}
                    >
                      <span className="h-px w-9 shrink-0 bg-gradient-to-r from-[#D8B87A]/60 to-transparent" />
                      {content.eyebrow}
                    </p>
                  ) : null}

                  {titleFormat.visible && content.title?.trim() ? (
                    <div data-reveal="fade-up" data-delay="430">
                      <h2 className={`max-w-[34rem] text-[1.9rem] leading-[1.2] tracking-[-0.025em] text-white @xl/slot-module:text-[2.15rem] ${pageBlockTextAlignClass(titleFormat.alignment)} ${pageBlockTextPlacementClass(titleFormat.alignment)} ${titleFormat.bold ? "font-bold" : "font-normal"}`}>
                        {content.title}
                      </h2>
                    </div>
                  ) : null}

                  {subtitleFormat.visible && content.subtitle?.trim() ? (
                    <div data-reveal="fade-up" data-delay="440">
                      <p className={`mt-3 max-w-[32rem] text-[1.02rem] leading-[1.55] text-[#D8B87A]/88 ${pageBlockTextAlignClass(subtitleFormat.alignment)} ${pageBlockTextPlacementClass(subtitleFormat.alignment)} ${subtitleFormat.bold ? "font-bold" : "font-normal"}`}>
                        {content.subtitle}
                      </p>
                    </div>
                  ) : null}

                  {descriptionFormat.visible && content.description?.trim() ? (
                    <div data-reveal="fade-up" data-delay="450">
                      <RichTextContent
                        value={content.description}
                        mode="rich"
                        className={`mt-6 max-w-[34rem] text-[15.5px] leading-[1.9] text-white/72 @xl/slot-module:text-[16px] ${pageBlockTextAlignClass(descriptionFormat.alignment)} ${pageBlockTextPlacementClass(descriptionFormat.alignment)} ${descriptionFormat.bold ? "font-bold" : "font-normal"} [&_p+_p]:mt-4 [&_strong]:text-inherit [&_b]:text-inherit`}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              {showBeats ? (
                <ul
                  className={`slot-editorial-clear grid max-w-[62rem] gap-5 border-t border-white/[0.07] pt-7 @3xl/slot-module:grid-cols-3 ${
                    showCopy ? "mt-8" : "mt-0 border-t-0 pt-0"
                  }`}
                >
                  {beats.map(({ num, title, text }, index) => (
                    <li
                      key={`${num}-${title}-${index}`}
                      data-reveal="fade-up"
                      data-delay={String(200 + index * 80)}
                      className="group relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 text-white backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/20 hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]"
                    >
                      <div className="relative z-10">
                        {num?.trim() ? (
                          <span className="font-en inline-flex items-center rounded-full border border-[#D8B87A]/15 bg-[#D8B87A]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#D8B87A]/80">
                            {num}
                          </span>
                        ) : null}
                        {title?.trim() ? (
                          <h3 className="mt-5 text-[18px] font-semibold leading-tight tracking-[-0.03em] text-white/92">
                            {title}
                          </h3>
                        ) : null}
                        {text?.trim() ? (
                          <p className="mt-4 text-[14px] leading-8 text-white/60">{text}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
