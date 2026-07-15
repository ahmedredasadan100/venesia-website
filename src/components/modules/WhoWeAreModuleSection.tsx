"use client";

import Image from "next/image";

import type { AboutDocumentaryBeat, AboutIntroContent } from "../about/about-cms-mappers";
import RichTextContent from "../content/RichTextContent";

export type WhoWeAreModuleSectionProps = {
  cmsIntro: AboutIntroContent | null;
  cmsBeats: AboutDocumentaryBeat[] | null;
};

function hasIntroCopy(intro: AboutIntroContent | null | undefined) {
  if (!intro) return false;
  return Boolean(
    intro.eyebrow?.trim() ||
      intro.title?.trim() ||
      intro.subtitle?.trim() ||
      intro.description?.trim(),
  );
}

function hasFilledBeat(beat: AboutDocumentaryBeat) {
  return Boolean(beat.title?.trim() || beat.text?.trim());
}

function ImageFrame({
  src,
  alt,
  className,
  roundedClassName,
}: {
  src: string;
  alt: string;
  className: string;
  roundedClassName: string;
}) {
  return (
    <div className={`relative group overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 40vw"
        className="object-cover object-center transition-transform duration-[1.4s] ease-out will-change-transform group-hover:scale-[1.03]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,11,0.72)_0%,rgba(5,7,11,0.12)_42%,transparent_68%)]"
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#D8B87A]/[0.08] ${roundedClassName}`}
      />
    </div>
  );
}

export default function WhoWeAreModuleSection({ cmsIntro, cmsBeats }: WhoWeAreModuleSectionProps) {
  const intro = cmsIntro;
  const beats = (cmsBeats ?? []).filter(hasFilledBeat);

  const showIntroCopy = hasIntroCopy(intro);
  const showBeats = Boolean(beats.length);

  const mainSrc = intro?.images?.main;
  const secondarySrc = intro?.images?.secondary;
  const accentSrc = intro?.images?.accent;

  const showMain = Boolean(mainSrc);
  const showSecondary = Boolean(secondarySrc);
  const showAccent = Boolean(accentSrc);
  const hasAnyImage = showMain || showSecondary || showAccent;

  if (!hasAnyImage && !showIntroCopy && !showBeats) {
    return null;
  }

  const mainAlt = intro?.images?.mainAlt || "";
  const secondaryAlt = intro?.images?.secondaryAlt || "";
  const accentAlt = intro?.images?.accentAlt || "";

  return (
    <section className="relative overflow-hidden pb-10 pt-8 md:pb-12 md:pt-10">
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
          className={`grid items-stretch gap-8 ${hasAnyImage ? "lg:grid-cols-[0.8fr_1.0fr] lg:gap-5 xl:gap-6" : ""}`}
        >
          {hasAnyImage ? (
            <div className="relative flex min-h-[520px] w-full items-center lg:mt-15">
              <div className="relative h-full min-h-[520px] w-full">
                {showMain ? (
                  <div className="group absolute right-0 top-0 h-[58%] w-[78%] overflow-hidden rounded-[1.5rem] border border-[#D8B87A]/[0.11] bg-white/[0.03] shadow-[0_0_0_1px_rgba(216,184,122,0.06),0_16px_40px_rgba(0,0,0,0.22)]">
                    <ImageFrame
                      src={mainSrc!}
                      alt={mainAlt}
                      className="relative h-full w-full"
                      roundedClassName="rounded-[1.5rem]"
                    />
                  </div>
                ) : null}

                {showSecondary ? (
                  <div className="group absolute bottom-0 left-0 h-[56%] w-[72%] overflow-hidden rounded-[1.5rem] border border-[#D8B87A]/[0.13] bg-white/[0.035] shadow-[0_24px_70px_rgba(0,0,0,0.34)] relative">
                    <Image
                      src={secondarySrc!}
                      alt={secondaryAlt}
                      fill
                      sizes="(max-width: 1024px) 72vw, 30vw"
                      className="object-cover object-center transition-transform duration-[1.4s] ease-out will-change-transform group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,11,0.76)_0%,rgba(5,7,11,0.18)_46%,transparent_72%)]"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[1.5rem] ring-1 ring-inset ring-[#D8B87A]/[0.09]"
                    />
                  </div>
                ) : null}

                {showAccent ? (
                  <div className="group absolute bottom-[10%] right-0 h-[34%] w-[34%] overflow-hidden rounded-[1.25rem] border border-[#D8B87A]/[0.15] bg-[#05070B] shadow-[0_18px_45px_rgba(0,0,0,0.34)] relative">
                    <Image
                      src={accentSrc!}
                      alt={accentAlt}
                      fill
                      sizes="(max-width: 1024px) 34vw, 14vw"
                      className="object-cover object-center transition-transform duration-[1.4s] ease-out will-change-transform group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,11,0.58)_0%,transparent_62%)]"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-[#D8B87A]/[0.10]"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="min-w-0 pt-1 lg:flex lg:min-h-[520px] lg:flex-col lg:justify-center lg:py-4">
            {showIntroCopy ? (
              <>
                <p
                  data-reveal="fade-up"
                  data-delay="410"
                  className="mb-6 flex items-center gap-3 font-en text-[10px] font-medium uppercase tracking-[0.22em] text-[#D8B87A]/58"
                >
                  <span className="h-px w-9 shrink-0 bg-gradient-to-r from-[#D8B87A]/60 to-transparent" />
                  {intro!.eyebrow}
                </p>

                <div data-reveal="fade-up" data-delay="430">
                  <h2 className="max-w-[44rem] text-[2rem] font-bold leading-[1.18] tracking-[-0.025em] text-white md:text-[2.2rem]">
                    {intro!.title}
                  </h2>
                </div>

                {intro!.subtitle?.trim() ? (
                  <div data-reveal="fade-up" data-delay="440">
                    <p className="mt-2 text-[1.02rem] font-medium leading-[1.5] text-[#D8B87A]/88">
                      {intro!.subtitle}
                    </p>
                  </div>
                ) : null}

                {intro!.description?.trim() ? (
                  <div data-reveal="fade-up" data-delay="450">
                    <RichTextContent
                      value={intro!.description}
                      mode="rich"
                      className="mt-5 max-w-[56rem] text-[15.5px] leading-8 text-white/72 md:text-[16px] [&_p+_p]:mt-1 [&_strong]:text-inherit [&_b]:text-inherit"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            {showBeats ? (
              <ul
                className={`grid max-w-[62rem] gap-5 border-t border-white/[0.07] pt-7 md:grid-cols-3 ${showIntroCopy ? "mt-8" : "mt-0 border-t-0 pt-0"}`}
              >
                {beats.map(({ num, title, text }, index) => (
                  <li
                    key={`${num}-${title}-${index}`}
                    data-reveal="fade-up"
                    data-delay={String(200 + index * 80)}
                    className="group relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 text-white backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/20 hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[1.5rem]"
                    >
                      <span className="absolute inset-x-6 top-0 h-[2px] origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />
                      <span className="absolute inset-x-6 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-150 duration-700 ease-out group-hover:scale-x-100 group-hover:opacity-100" />
                      <span className="absolute inset-y-6 right-0 w-[2px] origin-top scale-y-0 bg-gradient-to-b from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-75 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />
                      <span className="absolute inset-y-6 left-0 w-[2px] origin-bottom scale-y-0 bg-gradient-to-t from-transparent via-[#D8B87A] to-transparent opacity-0 transition-all delay-200 duration-700 ease-out group-hover:scale-y-100 group-hover:opacity-100" />
                    </div>

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
        </div>
      </div>
    </section>
  );
}
