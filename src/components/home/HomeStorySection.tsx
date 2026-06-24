"use client";

import Link from "next/link";

import type { HomeStoryContent } from "./home-cms-mappers";

const STATIC_DEFAULTS = {
  eyebrow: "FROM VISION TO EXECUTION",
  title: "من المخطط إلى التنفيذ",
  subtitle: "",
  description: [
    "كل مشروع يبدأ بفكرة، لكن القيمة الحقيقية تظهر عندما تتحول الفكرة إلى تنفيذ يمكن متابعته خطوة بخطوة.",
    "لهذا نوثق مراحل التنفيذ، ونشارك التقدم الفعلي على الأرض، لأن الثقة تُبنى بما يمكن رؤيته لا بما يمكن قوله.",
  ],
  images: {
    main: "/images/home/story-main.jpg",
    secondary: "/images/home/story-secondary.jpg",
    mainAlt: "",
    secondaryAlt: "",
  },
  button: {
    label: "شاهد مراحل التنفيذ",
    href: "/track-your-project",
  },
} satisfies HomeStoryContent & {
  images: { main: string; secondary: string; mainAlt: string; secondaryAlt: string };
  button: { label: string; href: string };
};

function resolveHomeStoryContent(content?: HomeStoryContent | null) {
  if (!content) return STATIC_DEFAULTS;

  const description = content.description.some((paragraph) => paragraph.trim())
    ? content.description
    : STATIC_DEFAULTS.description;

  return {
    eyebrow: content.eyebrow?.trim() || STATIC_DEFAULTS.eyebrow,
    title: content.title?.trim() || STATIC_DEFAULTS.title,
    description,
    images: {
      main: content.images?.main || STATIC_DEFAULTS.images.main,
      secondary: content.images?.secondary || STATIC_DEFAULTS.images.secondary,
      mainAlt: content.images?.mainAlt ?? STATIC_DEFAULTS.images.mainAlt,
      secondaryAlt: content.images?.secondaryAlt ?? STATIC_DEFAULTS.images.secondaryAlt,
    },
    button: {
      label: content.button?.label?.trim() || STATIC_DEFAULTS.button.label,
      href: content.button?.href?.trim() || STATIC_DEFAULTS.button.href,
    },
  };
}

export type HomeStorySectionProps = {
  content?: HomeStoryContent | null;
};

export default function HomeStorySection({ content }: HomeStorySectionProps) {
  const resolved = resolveHomeStoryContent(content);

  return (
    <section className="relative overflow-hidden bg-[#05070B] py-24 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-14 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Images */}
          <div className="relative min-h-[500px]">
            {/* Main Image */}
            <div className="group absolute right-0 top-0 h-[380px] w-[78%] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/40">
              <img
                src={resolved.images.main}
                alt={resolved.images.mainAlt}
                className="h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/65 via-transparent to-transparent" />

              {/* Venesia Gold Sweep Effect */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] bg-[linear-gradient(115deg,transparent_0%,rgba(216,184,122,0.00)_36%,rgba(216,184,122,0.22)_48%,rgba(255,255,255,0.16)_52%,rgba(216,184,122,0.06)_58%,transparent_72%)] opacity-0 transition-all duration-[1200ms] ease-out group-hover:translate-x-[130%] group-hover:opacity-100"
              />

              <div className="absolute inset-x-8 bottom-0 z-30 h-px origin-center scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/80 to-transparent transition-transform duration-700 group-hover:scale-x-100" />
            </div>

            {/* Floating Image */}
            <div className="group absolute bottom-0 left-0 h-[320px] w-[65%] overflow-hidden rounded-[2rem] border border-[#D8B87A]/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] transition duration-700 hover:-translate-y-1 hover:border-[#D8B87A]/50">
              <img
                src={resolved.images.secondary}
                alt={resolved.images.secondaryAlt}
                className="h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/80 via-transparent to-transparent" />

              {/* Venesia Gold Sweep Effect */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20 -translate-x-[130%] bg-[linear-gradient(115deg,transparent_0%,rgba(216,184,122,0.00)_36%,rgba(216,184,122,0.22)_48%,rgba(255,255,255,0.16)_52%,rgba(216,184,122,0.06)_58%,transparent_72%)] opacity-0 transition-all duration-[1200ms] ease-out group-hover:translate-x-[130%] group-hover:opacity-100"
              />

              <div className="absolute inset-x-8 bottom-0 z-30 h-px origin-center scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/80 to-transparent transition-transform duration-700 group-hover:scale-x-100" />
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="font-en text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70">
              {resolved.eyebrow}
            </p>

            <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight lg:text-5xl">
              {resolved.title}
            </h2>

            {resolved.description.map((paragraph, index) => (
              <p
                key={index}
                className={`max-w-xl text-base leading-8 text-white/60 ${index === 0 ? "mt-6" : "mt-4"}`}
              >
                {paragraph}
              </p>
            ))}

            <Link
              href={resolved.button.href}
              className="mt-8 inline-flex items-center rounded-full border border-[#D8B87A]/35 px-7 py-3 text-sm font-medium text-[#D8B87A] transition duration-500 hover:-translate-y-0.5 hover:bg-[#D8B87A] hover:text-[#111]"
            >
              {resolved.button.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
