"use client";

import Link from "next/link";
import Image from "next/image";

import RichTextContent from "../content/RichTextContent";
import { usePressFeedback, useTouchInViewReveal } from "../../hooks/use-press-feedback";
import type {
  HomeStoryButtonAlignment,
  HomeStoryButtonIcon,
  HomeStoryButtonIconPosition,
  HomeStoryContent,
} from "./home-cms-mappers";

const STATIC_DEFAULTS = {
  eyebrow: "FROM VISION TO EXECUTION",
  title: "من المخطط إلى التنفيذ",
  subtitle: "",
  body: [
    "كل مشروع يبدأ بفكرة، لكن القيمة الحقيقية تظهر عندما تتحول الفكرة إلى تنفيذ يمكن متابعته خطوة بخطوة.",
    "لهذا نوثق مراحل التنفيذ، ونشارك التقدم الفعلي على الأرض، لأن الثقة تُبنى بما يمكن رؤيته لا بما يمكن قوله.",
  ].join("\n\n"),
  images: {
    main: "/images/home/story-main.jpg",
    secondary: "/images/home/story-secondary.jpg",
    mainAlt: "",
    secondaryAlt: "",
  },
  button: {
    label: "شاهد مراحل التنفيذ",
    href: "/track-your-project",
    target: "_self" as const,
    alignment: "right" as const,
    icon: "none" as const,
    iconPosition: "right" as const,
  },
} satisfies HomeStoryContent & {
  images: { main: string; secondary: string; mainAlt: string; secondaryAlt: string };
  button: {
    label: string;
    href: string;
    target: "_self" | "_blank";
    alignment: HomeStoryButtonAlignment;
    icon: HomeStoryButtonIcon;
    iconPosition: HomeStoryButtonIconPosition;
  };
};

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

function resolveHomeStoryContent(content?: HomeStoryContent | null) {
  if (!content) return STATIC_DEFAULTS;

  const body = content.body?.trim() ? content.body : STATIC_DEFAULTS.body;

  return {
    eyebrow: content.eyebrow?.trim() || STATIC_DEFAULTS.eyebrow,
    title: content.title?.trim() || STATIC_DEFAULTS.title,
    body,
    images: {
      main: content.images?.main || STATIC_DEFAULTS.images.main,
      secondary: content.images?.secondary || STATIC_DEFAULTS.images.secondary,
      mainAlt: content.images?.mainAlt ?? STATIC_DEFAULTS.images.mainAlt,
      secondaryAlt: content.images?.secondaryAlt ?? STATIC_DEFAULTS.images.secondaryAlt,
    },
    button: {
      label: content.button?.label?.trim() || STATIC_DEFAULTS.button.label,
      href: content.button?.href?.trim() || STATIC_DEFAULTS.button.href,
      target: content.button?.target === "_blank" ? ("_blank" as const) : ("_self" as const),
      alignment: content.button?.alignment ?? STATIC_DEFAULTS.button.alignment,
      icon: content.button?.icon ?? STATIC_DEFAULTS.button.icon,
      iconPosition: content.button?.iconPosition ?? STATIC_DEFAULTS.button.iconPosition,
    },
  };
}

export type HomeStorySectionProps = {
  content?: HomeStoryContent | null;
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

  return (
    <section className="relative overflow-hidden bg-[#05070B] py-24 text-white max-md:py-10 md:max-lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-14 max-md:gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div
            ref={mediaRef}
            {...inViewProps}
            data-reveal="soft-scale"
            className="home-story-media relative min-h-[500px] max-md:min-h-[280px] md:max-lg:mx-auto md:max-lg:min-h-[360px] md:max-lg:w-full md:max-lg:max-w-md"
          >
            <HomeStoryMediaFrame
              className="home-story-frame--main absolute right-0 top-0 z-[1] h-[380px] w-[78%] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/40 max-md:h-[220px] max-md:w-[70%] md:max-lg:h-[265px] md:max-lg:w-[74%]"
              imageSrc={resolved.images.main}
              imageAlt={resolved.images.mainAlt}
              sizes="(max-width: 768px) 70vw, 40vw"
              overlayClassName="bg-gradient-to-t from-[#05070B]/65 via-transparent to-transparent"
            />

            <HomeStoryMediaFrame
              className="home-story-frame--secondary absolute bottom-0 left-0 z-[2] h-[320px] w-[65%] overflow-hidden rounded-[2rem] border border-[#D8B87A]/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/50 max-md:h-[185px] max-md:w-[58%] md:max-lg:h-[220px] md:max-lg:w-[60%]"
              imageSrc={resolved.images.secondary}
              imageAlt={resolved.images.secondaryAlt}
              sizes="(max-width: 768px) 58vw, 35vw"
              overlayClassName="bg-gradient-to-t from-[#05070B]/80 via-transparent to-transparent"
            />
          </div>

          <div data-reveal="fade-up">
            <p className="font-en text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70">
              {resolved.eyebrow}
            </p>

            <h2 className="home-story-title mt-4 max-w-xl text-4xl font-semibold leading-tight lg:text-5xl">
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
