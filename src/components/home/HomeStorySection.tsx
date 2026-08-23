"use client";

import Link from "next/link";
import Image from "next/image";

import RichTextContent from "../content/RichTextContent";
import { usePressFeedback, useTouchInViewReveal } from "../../hooks/use-press-feedback";
import type {
  HomeStoryButtonAlignment,
  HomeStoryContent,
} from "./home-cms-mappers";

const BUTTON_ALIGN_CLASS: Record<HomeStoryButtonAlignment, string> = {
  // Section is RTL: flex-start = physical right, flex-end = physical left.
  right: "justify-start",
  center: "justify-center",
  left: "justify-end",
};

function StoryCtaArrow({ pointLeft }: { pointLeft: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${pointLeft ? "" : "scale-x-[-1]"}`}
    >
      <path
        d="M11 7H3M6 4L3 7l3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function resolveHomeStoryContent(content: HomeStoryContent) {
  return {
    eyebrow: content.eyebrow.trim(),
    title: content.title.trim(),
    body: content.body.trim(),
    images: {
      main: content.images?.main ?? "",
      secondary: content.images?.secondary ?? "",
      mainAlt: content.images?.mainAlt ?? "",
      secondaryAlt: content.images?.secondaryAlt ?? "",
    },
    button: {
      label: content.button?.label?.trim() ?? "",
      href: content.button?.href?.trim() ?? "",
      target: content.button?.target === "_blank" ? ("_blank" as const) : ("_self" as const),
      alignment: content.button?.alignment ?? "right",
      icon: content.button?.icon ?? "none",
      iconPosition: content.button?.iconPosition ?? "right",
    },
  };
}

export type HomeStorySectionProps = {
  content: HomeStoryContent;
};

function HomeStoryMediaFrame({
  className,
  imageSrc,
  imageAlt,
  sizes,
  overlayClassName,
}: {
  className: string;
  imageSrc: string;
  imageAlt: string;
  sizes: string;
  overlayClassName: string;
}) {
  return (
    <div className={`home-story-frame group ${className}`}>
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        sizes={sizes}
        className="home-story-frame__image object-cover transition duration-[1200ms] ease-out group-hover:scale-105"
      />

      <div className={`absolute inset-0 ${overlayClassName}`} />

      <div
        aria-hidden
        className="home-story-frame__shine pointer-events-none absolute inset-0 z-20 -translate-x-[130%] bg-[linear-gradient(115deg,transparent_0%,rgba(216,184,122,0.00)_36%,rgba(216,184,122,0.22)_48%,rgba(255,255,255,0.16)_52%,rgba(216,184,122,0.06)_58%,transparent_72%)] opacity-0 transition-[translate,opacity] duration-[1200ms] ease-out group-hover:translate-x-[130%] group-hover:opacity-100"
      />

      <div className="home-story-frame__line absolute inset-x-8 bottom-0 z-30 h-px origin-center scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/80 to-transparent transition-[scale] duration-700 group-hover:scale-x-100" />
    </div>
  );
}

function HomeStoryCta({
  href,
  label,
  target,
  showArrow,
  iconOnRight,
}: {
  href: string;
  label: string;
  target: "_self" | "_blank";
  showArrow: boolean;
  iconOnRight: boolean;
}) {
  const { pressProps } = usePressFeedback();

  return (
    <Link
      href={href}
      target={target === "_blank" ? "_blank" : undefined}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      {...pressProps}
      className="home-pressable home-pressable--story-cta inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#D8B87A]/35 px-7 py-3 text-sm font-medium text-[#D8B87A] transition duration-500 hover:-translate-y-0.5 hover:bg-[#D8B87A] hover:text-[#111]"
    >
      {showArrow && iconOnRight ? <StoryCtaArrow pointLeft /> : null}
      <span>{label}</span>
      {showArrow && !iconOnRight ? <StoryCtaArrow pointLeft={false} /> : null}
    </Link>
  );
}

export default function HomeStorySection({ content }: HomeStorySectionProps) {
  const resolved = resolveHomeStoryContent(content);
  const showArrow = resolved.button.icon === "arrow";
  const iconOnRight = resolved.button.iconPosition === "right";
  const { ref: mediaRef, inViewProps } = useTouchInViewReveal(0.4);
  if (!resolved.images.main || !resolved.images.secondary) return null;

  return (
    <section className="relative overflow-hidden bg-[#05070B] py-10 text-white @xl/slot-module:py-16 @4xl/slot-module:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-10 @4xl/slot-module:grid-cols-[0.95fr_1.05fr] @4xl/slot-module:gap-14">
          <div data-reveal="fade-up" data-delay="0" className="home-story-reveal">
            <div
              ref={mediaRef}
              {...inViewProps}
              className="home-story-media relative min-h-[280px] @xl/slot-module:mx-auto @xl/slot-module:min-h-[360px] @xl/slot-module:w-full @xl/slot-module:max-w-md @4xl/slot-module:min-h-[500px] @4xl/slot-module:max-w-none"
            >
              <HomeStoryMediaFrame
                className="home-story-frame--main absolute right-0 top-0 z-[1] h-[220px] w-[70%] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/40 @xl/slot-module:h-[265px] @xl/slot-module:w-[74%] @4xl/slot-module:h-[380px] @4xl/slot-module:w-[78%]"
                imageSrc={resolved.images.main}
                imageAlt={resolved.images.mainAlt}
                sizes="(max-width: 768px) 70vw, 40vw"
                overlayClassName="bg-gradient-to-t from-[#05070B]/65 via-transparent to-transparent"
              />

              <HomeStoryMediaFrame
                className="home-story-frame--secondary absolute bottom-0 left-0 z-[2] h-[185px] w-[58%] overflow-hidden rounded-[2rem] border border-[#D8B87A]/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/50 @xl/slot-module:h-[220px] @xl/slot-module:w-[60%] @4xl/slot-module:h-[320px] @4xl/slot-module:w-[65%]"
                imageSrc={resolved.images.secondary}
                imageAlt={resolved.images.secondaryAlt}
                sizes="(max-width: 768px) 58vw, 35vw"
                overlayClassName="bg-gradient-to-t from-[#05070B]/80 via-transparent to-transparent"
              />
            </div>
          </div>

          <div data-reveal="fade-up" data-delay="120" className="home-story-reveal">
            <p className="font-en text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70">
              {resolved.eyebrow}
            </p>

            <h2 className="home-story-title mt-4 max-w-xl text-4xl font-semibold leading-tight @4xl/slot-module:text-5xl">
              {resolved.title}
            </h2>

            <RichTextContent
              value={resolved.body}
              mode="rich"
              className="mt-6 max-w-xl text-base leading-8 text-white/60 [&_strong]:text-inherit [&_b]:text-inherit"
            />

            <div className={`mt-8 flex max-w-xl ${BUTTON_ALIGN_CLASS[resolved.button.alignment]}`} dir="rtl">
              <HomeStoryCta
                href={resolved.button.href}
                label={resolved.button.label}
                target={resolved.button.target}
                showArrow={showArrow}
                iconOnRight={iconOnRight}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
