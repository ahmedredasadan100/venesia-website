"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { HeroSectionData } from "../../lib/page-sections";
import { getHeroConfig } from "../../lib/page-sections";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";

type DynamicHeroSectionProps = {
  hero: HeroSectionData;
  fallbackTitle?: string;
  fallbackEyebrow?: string;
  fallbackSubtitle?: string;
  fallbackImage?: string;
  belowTitle?: React.ReactNode;
};

export default function DynamicHeroSection({
  hero,
  fallbackTitle,
  fallbackEyebrow,
  fallbackSubtitle,
  fallbackImage,
  belowTitle,
}: DynamicHeroSectionProps) {
  const variant = hero.variant || "internal-page";

  if (variant === "home-cinematic") {
    return <HomeDynamicHero hero={hero} />;
  }

  return (
    <InternalDynamicHero
      hero={hero}
      fallbackTitle={fallbackTitle}
      fallbackEyebrow={fallbackEyebrow}
      fallbackSubtitle={fallbackSubtitle}
      fallbackImage={fallbackImage}
      belowTitle={belowTitle}
    />
  );
}

const HERO_MOBILE_QUERY = "(max-width: 767px)";

function subscribeHeroMobile(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(HERO_MOBILE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getHeroMobileSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(HERO_MOBILE_QUERY).matches;
}

function getHeroMobileServerSnapshot() {
  return false;
}

function useIsMobileViewport() {
  return useSyncExternalStore(subscribeHeroMobile, getHeroMobileSnapshot, getHeroMobileServerSnapshot);
}

function HomeDynamicHero({ hero }: { hero: HeroSectionData }) {
  const config = getHeroConfig(hero);
  const images = config.images ?? [];
  const mobileImages = config.mobileImages ?? [];
  const isMobile = useIsMobileViewport();
  // Mobile can have an independent slide count: use mobileImages only when it has items,
  // otherwise fall back to the full desktop images set.
  const slides = isMobile && mobileImages.length > 0 ? mobileImages : images;
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canSwipe = slides.length > 1;
  const safeIndex = Math.min(activeIndex, Math.max(slides.length - 1, 0));

  const startAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!canSwipe) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 7500);
  }, [canSwipe, slides.length]);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoplay]);

  const goToNext = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((current) => (current + 1) % slides.length);
    startAutoplay();
  }, [canSwipe, slides.length, startAutoplay]);

  const goToPrev = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
    startAutoplay();
  }, [canSwipe, slides.length, startAutoplay]);

  const handleGoTo = useCallback(
    (index: number) => {
      setActiveIndex(index);
      startAutoplay();
    },
    [startAutoplay],
  );

  const { containerRef, swipeHandlers } = useSwipeSlider<HTMLElement>({
    enabled: canSwipe,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrev,
  });

  const title = config.title ?? "";
  const highlight = config.highlight ?? "";
  const subtitle = config.subtitle ?? "";
  const description = config.description ?? "";

  const hasHeroContent = Boolean(images.length || title || highlight || subtitle || description || config.eyebrow);
  if (!hasHeroContent) return null;

  return (
    <section
      ref={containerRef}
      className="relative isolate min-h-screen touch-pan-y overflow-hidden bg-[#05070B]"
      dir="rtl"
      {...swipeHandlers}
    >
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {slides.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={`absolute inset-0 transition-opacity duration-[2400ms] ease-in-out ${
              index === safeIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={src}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className={`hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none object-cover ${
                config.imagePositionClassName ?? "object-center"
              }`}
              style={{ filter: "brightness(1.12) contrast(1.08) saturate(1.04)" }}
            />
          </div>
        ))}

        <div className="pointer-events-none absolute inset-0 bg-[#05070B]/16" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.62)_0%,rgba(5,7,11,0.28)_26%,rgba(5,7,11,0.08)_50%,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,11,0.34)_0%,transparent_42%,rgba(5,7,11,0.72)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(216,184,122,0.14),transparent_32%),radial-gradient(circle_at_84%_8%,rgba(30,58,95,0.22),transparent_36%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center max-md:items-start max-md:pt-40">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 pt-28 pb-20 max-md:pt-0 max-md:pb-24 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="min-w-0 text-right lg:min-w-auto">
            <div className="lg:translate-y-[5em]">
              {config.eyebrow ? (
                <div className="mb-5 inline-flex max-w-full whitespace-nowrap rounded-full border border-white/10 bg-[#0B1220]/32 px-3 py-3 text-xs tracking-normal text-[#D8B87A] backdrop-blur-md min-[361px]:whitespace-normal min-[361px]:px-4 min-[361px]:text-sm min-[361px]:tracking-wide">
                  {config.eyebrow}
                </div>
              ) : null}

              <h1 className="max-w-none md:max-w-[12ch] lg:max-w-none lg:w-max lg:pb-[1.06em] text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="max-md:block max-md:whitespace-nowrap lg:block lg:whitespace-nowrap">{title}</span>
                {highlight ? (
                  <span className="mt-2 block bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-transparent md:mt-3 lg:whitespace-nowrap">
                    {highlight}
                  </span>
                ) : null}
              </h1>
            </div>

            {subtitle ? (
              <div className="mt-5 inline-flex max-w-full whitespace-nowrap rounded-full border border-[#D8B87A]/22 bg-[rgba(216,184,122,0.10)] px-3 py-3 text-xs tracking-normal text-[#E8D5A8] shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-md min-[361px]:whitespace-normal min-[361px]:px-4 min-[361px]:text-sm min-[361px]:tracking-wide md:text-base">
                {subtitle}
              </div>
            ) : null}

            {description && description !== subtitle ? (
              <p
                className={`${subtitle ? "mt-4" : "mt-6"} max-w-2xl text-base leading-8 text-white/68 md:text-lg md:leading-9`}
              >
                {description}
              </p>
            ) : null}

            {(config.showCta !== false && (config.primaryCtaLabel || config.secondaryCtaLabel)) ? (
              <div className="mt-8 flex flex-wrap gap-3 md:gap-4">
                {config.primaryCtaLabel && config.primaryCtaHref ? (
                  <Link
                    href={config.primaryCtaHref}
                    className="inline-flex h-11 items-center rounded-full bg-white px-6 font-medium text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 md:h-12 md:px-7"
                  >
                    {config.primaryCtaLabel}
                  </Link>
                ) : null}

                {config.secondaryCtaLabel && config.secondaryCtaHref ? (
                  <Link
                    href={config.secondaryCtaHref}
                    className="inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-6 font-medium text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 md:h-12 md:px-7"
                  >
                    {config.secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="hidden min-w-0 lg:block">
            {hero.resolvedItems && hero.resolvedItems.length > 0 ? (
              <div className="rounded-[2.5rem] border border-white/[0.14] bg-white/[0.05] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-md">
                <div className="space-y-3 rounded-[2rem] bg-black/20 p-4">
                  {hero.resolvedItems.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={item.href ?? "#"}
                      className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-[#D8B87A]/35 hover:bg-white/[0.07]"
                    >
                      {item.image ? (
                        <span className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </span>
                      ) : null}
                      <span className="min-w-0 text-right">
                        <span className="block text-xs text-[#D8B87A]/70">{item.category}</span>
                        <span className="mt-1 line-clamp-2 block text-sm leading-6 text-white/82 group-hover:text-white">
                          {item.title}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[115px] bg-[linear-gradient(to_top,#05070B_0%,rgba(5,7,11,0.72)_55%,transparent_100%)] [clip-path:polygon(0_68%,100%_38%,100%_100%,0_100%)]" />

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`الشريحة ${index + 1}`}
              onClick={() => handleGoTo(index)}
              className="group inline-flex h-10 min-w-10 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-500 ${
                  index === safeIndex ? "w-8 bg-[#D8B87A]" : "w-3 bg-white/25 group-hover:bg-white/45"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function splitHeroDescription(description?: string) {
  return (description ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function HeroCtaButtons({ config }: { config: ReturnType<typeof getHeroConfig> }) {
  if (config.showCta === false) return null;

  const hasPrimary = Boolean(config.primaryCtaLabel && config.primaryCtaHref);
  const hasSecondary = Boolean(config.secondaryCtaLabel && config.secondaryCtaHref);
  if (!hasPrimary && !hasSecondary) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-3 md:mt-8 md:gap-4">
      {hasPrimary ? (
        <Link
          href={config.primaryCtaHref!}
          className="inline-flex h-11 items-center rounded-full bg-white px-6 font-medium text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 md:h-12 md:px-7"
        >
          {config.primaryCtaLabel}
        </Link>
      ) : null}

      {hasSecondary ? (
        <Link
          href={config.secondaryCtaHref!}
          className="inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-6 font-medium text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 md:h-12 md:px-7"
        >
          {config.secondaryCtaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function InternalDynamicHero({
  hero,
  fallbackTitle,
  fallbackEyebrow,
  fallbackSubtitle,
  fallbackImage,
  belowTitle,
}: DynamicHeroSectionProps) {
  const config = getHeroConfig(hero);
  const isAboutPage = hero.page?.slug === "about";
  const isCompactHero = isAboutPage || config.heroLayout === "compact";

  const images = config.images?.length ? config.images : fallbackImage ? [fallbackImage] : [];
  const image = images[0];
  // Mobile image support for internal heroes, excluding the Contact page hero.
  const supportsMobileImages = hero.page?.slug !== "contact";
  const mobileImage = supportsMobileImages ? config.mobileImages?.[0] : undefined;
  const title = config.title || fallbackTitle || hero.page?.title || "";
  const eyebrow = config.eyebrow || fallbackEyebrow || "Internal Page";
  const subtitle = config.subtitle || fallbackSubtitle || "";
  const description = config.description || "";
  const descriptionLines = splitHeroDescription(description);
  const goldAccent = config.highlight || (isAboutPage ? subtitle : "");
  const imagePosition = config.imagePositionClassName ?? (isCompactHero ? "object-[50%_42%]" : "object-center");

  return (
    <section
      className={`relative isolate z-0 overflow-hidden bg-[#05070B] ${
        isCompactHero ? "h-[min(46vh,500px)] min-h-[400px]" : "h-[min(62vh,580px)] min-h-[440px]"
      }`}
      dir="rtl"
    >
      {image ? (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          {mobileImage ? (
            <>
              <Image
                src={mobileImage}
                alt=""
                fill
                priority
                sizes="100vw"
                className={`hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none object-cover md:hidden ${imagePosition}`}
                style={{ filter: isCompactHero ? "brightness(1.05) contrast(1.04) saturate(1.02)" : "brightness(1.04) contrast(1.04) saturate(1.02)" }}
              />
              <Image
                src={image}
                alt=""
                fill
                priority
                sizes="100vw"
                className={`hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none object-cover max-md:hidden ${imagePosition}`}
                style={{ filter: isCompactHero ? "brightness(1.05) contrast(1.04) saturate(1.02)" : "brightness(1.04) contrast(1.04) saturate(1.02)" }}
              />
            </>
          ) : (
            <Image
              src={image}
              alt=""
              fill
              priority
              sizes="100vw"
              className={`hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none object-cover ${imagePosition}`}
              style={{ filter: isCompactHero ? "brightness(1.05) contrast(1.04) saturate(1.02)" : "brightness(1.04) contrast(1.04) saturate(1.02)" }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[#05070B]/20" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.52)_0%,rgba(5,7,11,0.20)_26%,rgba(5,7,11,0.06)_44%,transparent_64%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,11,0.24)_0%,transparent_34%,rgba(5,7,11,0.68)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-px bg-[linear-gradient(to_right,transparent,rgba(255,196,92,0.82)_50%,transparent)]" />
        </div>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_70%_at_18%_22%,rgba(192,143,62,0.11),transparent_64%),radial-gradient(ellipse_95%_74%_at_84%_18%,rgba(18,36,78,0.22),transparent_68%)]"
        />
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16">
          <div className="grid w-full items-end gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="min-w-0 text-right">
              <p className="mb-5 flex items-center gap-3 font-en text-[10px] uppercase tracking-[0.2em] text-[#D8B87A]/55">
                <span className="h-px w-8 shrink-0 bg-gradient-to-r from-[#D8B87A]/60 to-transparent" />
                {eyebrow}
              </p>

              <h1
                className={`font-bold tracking-[-0.02em] text-white ${
                  isCompactHero
                    ? "text-[2rem] leading-[1.15] sm:text-4xl md:text-[2.5rem]"
                    : "max-w-[14ch] text-[2rem] leading-[1.2] sm:text-4xl md:text-[2.5rem]"
                }`}
              >
                <span className="block">{title}</span>
                {isAboutPage && goldAccent ? (
                  <span className="mt-2 block text-[0.72em] font-medium tracking-[0.08em] text-[#D8B87A]">
                    {goldAccent}
                  </span>
                ) : null}
                {!isAboutPage && config.highlight ? (
                  <span className="mt-2 block bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-transparent">
                    {config.highlight}
                  </span>
                ) : null}
              </h1>

              {!isAboutPage && subtitle ? (
                <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/66 md:text-base md:leading-9">
                  {subtitle}
                </p>
              ) : null}

              {isAboutPage && descriptionLines.length ? (
                <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/60 md:text-base md:leading-9">
                  {descriptionLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              ) : null}

              {!isAboutPage && description && description !== subtitle ? (
                <p className="mt-3 max-w-2xl text-sm leading-8 text-white/52 md:text-[15px]">
                  {description}
                </p>
              ) : null}

              <HeroCtaButtons config={config} />

              {belowTitle}
            </div>

            <div aria-hidden className="hidden min-w-0 lg:block" />
          </div>
        </div>
      </div>
    </section>
  );
}
