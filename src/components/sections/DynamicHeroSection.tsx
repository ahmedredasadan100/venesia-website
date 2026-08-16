"use client";

import Image, { getImageProps } from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import type { HeroSectionData } from "../../lib/page-sections";
import { getHeroConfig } from "../../lib/page-sections";
import {
  heroFlexJustifyClass,
  heroTextAlignClass,
  resolveDistinctHeroDescription,
  type HeroElementKey,
  type HeroTextAlignment,
} from "../../lib/hero/hero-content-controls";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";
import { usePressFeedback } from "../../hooks/use-press-feedback";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import RichTextContent from "../content/RichTextContent";

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

function HeroPressableLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const { pressProps } = usePressFeedback();
  const prefetchProps = useIntentPrefetch();
  return (
    <Link href={href} {...prefetchProps} {...pressProps} className={`home-pressable ${className}`}>
      {children}
    </Link>
  );
}

function useIntentPrefetch() {
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);

  return {
    prefetch: prefetchEnabled ? null : false,
    onMouseEnter: () => setPrefetchEnabled(true),
    onFocus: () => setPrefetchEnabled(true),
    onTouchStart: () => setPrefetchEnabled(true),
  };
}

function HeroIntentLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const prefetchProps = useIntentPrefetch();
  return (
    <Link href={href} {...prefetchProps} className={className}>
      {children}
    </Link>
  );
}

type HeroSlideImageProps = {
  desktopSrc: string;
  mobileSrc?: string;
  priority?: boolean;
  imagePositionClassName?: string;
  brightnessFilter?: string;
};

const TRANSPARENT_IMAGE_FALLBACK =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

/**
 * Browser picks mobile/desktop source via <picture> before hydration —
 * no client matchMedia swap, no desktop-first flash on phones.
 */
function HeroArtDirectedImage({
  desktopSrc,
  mobileSrc,
  priority = false,
  imagePositionClassName = "object-center",
  brightnessFilter = "brightness(1.12) contrast(1.08) saturate(1.04)",
}: HeroSlideImageProps) {
  const className = `hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none object-cover ${imagePositionClassName}`;
  const style = { filter: brightnessFilter };

  if (!mobileSrc || mobileSrc === desktopSrc) {
    return (
      <Image
        src={desktopSrc}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className={className}
        style={style}
      />
    );
  }

  const common = {
    alt: "",
    sizes: "100vw",
    fill: true as const,
    fetchPriority: priority ? ("high" as const) : ("auto" as const),
    loading: priority ? ("eager" as const) : ("lazy" as const),
  };

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: desktopSrc });
  const {
    props: { srcSet: mobileSrcSet, ...mobileRest },
  } = getImageProps({ ...common, src: mobileSrc });

  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobileSrcSet} sizes="100vw" />
      <source media="(min-width: 768px)" srcSet={desktopSrcSet} sizes="100vw" />
      <img
        {...mobileRest}
        src={TRANSPARENT_IMAGE_FALLBACK}
        alt=""
        className={className}
        style={{ ...mobileRest.style, ...style }}
      />
    </picture>
  );
}

function buildHomeHeroSlides(desktopImages: string[], mobileImages: string[]) {
  const hasMobileSet = mobileImages.length > 0;
  const count = hasMobileSet
    ? Math.max(desktopImages.length, mobileImages.length)
    : desktopImages.length;

  return Array.from({ length: count }, (_, index) => {
    const desktop = desktopImages[index] ?? mobileImages[index] ?? "";
    const mobile = mobileImages[index] ?? desktop;
    return { desktop, mobile: mobile !== desktop ? mobile : undefined };
  }).filter((slide) => Boolean(slide.desktop));
}

function HomeDynamicHero({ hero }: { hero: HeroSectionData }) {
  const config = getHeroConfig(hero);
  const images = config.images ?? [];
  const mobileImages = config.mobileImages ?? [];
  const slides = buildHomeHeroSlides(images, mobileImages);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preparedSlideIndexes, setPreparedSlideIndexes] = useState<ReadonlySet<number>>(
    () => new Set([0]),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const slideCount = slides.length;
  const canSwipe = slideCount > 1;
  const safeIndex = Math.min(activeIndex, Math.max(slideCount - 1, 0));

  const startAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!canSwipe || reducedMotion) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, 7500);
  }, [canSwipe, reducedMotion, slideCount]);

  useEffect(() => {
    startAutoplay();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startAutoplay]);

  useEffect(() => {
    if (!canSwipe || reducedMotion) return;

    const nextIndex = (safeIndex + 1) % slideCount;
    const preparationTimer = setTimeout(() => {
      setPreparedSlideIndexes((current) => {
        if (current.has(nextIndex)) return current;
        return new Set([...current, nextIndex]);
      });
    }, 2500);

    return () => clearTimeout(preparationTimer);
  }, [canSwipe, reducedMotion, safeIndex, slideCount]);

  const goToNext = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((current) => (current + 1) % slideCount);
    startAutoplay();
  }, [canSwipe, slideCount, startAutoplay]);

  const goToPrev = useCallback(() => {
    if (!canSwipe) return;
    setActiveIndex((current) => (current - 1 + slideCount) % slideCount);
    startAutoplay();
  }, [canSwipe, slideCount, startAutoplay]);

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
  const description = resolveDistinctHeroDescription(
    config.description,
    subtitle,
  );

  const hasHeroContent = Boolean(
    images.length ||
      mobileImages.length ||
      title ||
      highlight ||
      subtitle ||
      description ||
      config.eyebrow,
  );
  if (!hasHeroContent) return null;

  return (
    <section
      ref={containerRef}
      className="relative isolate min-h-screen touch-pan-y overflow-hidden bg-[#05070B]"
      dir="rtl"
      data-hero-reduced-motion={reducedMotion ? "true" : undefined}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {slides.map((slide, index) => (
          <div
            key={`${slide.desktop}-${slide.mobile ?? "d"}-${index}`}
            className={`hero-slide-fade absolute inset-0 transition-opacity ease-in-out ${
              index === safeIndex ? "opacity-100" : "opacity-0"
            } ${reducedMotion ? "duration-150" : "duration-[2400ms]"}`}
          >
            {/* Mount the active slide immediately, then prepare the next slide ahead of autoplay. */}
            {index === safeIndex || preparedSlideIndexes.has(index) ? (
              <HeroArtDirectedImage
                desktopSrc={slide.desktop}
                mobileSrc={slide.mobile}
                priority={index === 0}
                imagePositionClassName={config.imagePositionClassName ?? "object-center"}
              />
            ) : null}
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

            {description ? (
              <p
                className={`${subtitle ? "mt-4" : "mt-6"} max-w-2xl text-base leading-8 text-white/68 md:text-lg md:leading-9`}
              >
                {description}
              </p>
            ) : null}

            {config.showCta !== false && (config.primaryCtaLabel || config.secondaryCtaLabel) ? (
              <div className="mt-8 flex flex-wrap gap-3 md:gap-4">
                {config.primaryCtaLabel && config.primaryCtaHref ? (
                  <HeroPressableLink
                    href={config.primaryCtaHref}
                    className="home-pressable--hero-primary inline-flex h-11 items-center rounded-full bg-white px-6 font-medium text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 md:h-12 md:px-7"
                  >
                    {config.primaryCtaLabel}
                  </HeroPressableLink>
                ) : null}

                {config.secondaryCtaLabel && config.secondaryCtaHref ? (
                  <HeroPressableLink
                    href={config.secondaryCtaHref}
                    className="home-pressable--hero-secondary inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-6 font-medium text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 md:h-12 md:px-7"
                  >
                    {config.secondaryCtaLabel}
                  </HeroPressableLink>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="hidden min-w-0 lg:block">
            {hero.resolvedItems && hero.resolvedItems.length > 0 ? (
              <div className="rounded-[2.5rem] border border-white/[0.14] bg-white/[0.05] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-md">
                <div className="space-y-3 rounded-[2rem] bg-black/20 p-4">
                  {hero.resolvedItems.slice(0, 3).map((item) => (
                    <HeroIntentLink
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
                    </HeroIntentLink>
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

function HeroReservedSlot({
  hasContent,
  visible,
  className,
  children,
}: {
  hasContent: boolean;
  visible: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!hasContent) return null;

  return (
    <div
      className={[className, visible ? "" : "pointer-events-none select-none"].filter(Boolean).join(" ")}
      aria-hidden={visible ? undefined : true}
      data-hero-slot-visible={visible ? "true" : "false"}
      style={visible ? undefined : { visibility: "hidden" }}
      {...(!visible ? { inert: true } : {})}
    >
      {children}
    </div>
  );
}

function HeroCtaButtons({
  config,
  alignment = "right",
  visible = true,
  reserveWhenHidden = false,
}: {
  config: ReturnType<typeof getHeroConfig>;
  alignment?: HeroTextAlignment;
  visible?: boolean;
  reserveWhenHidden?: boolean;
}) {
  const hasPrimary = Boolean(config.primaryCtaLabel && config.primaryCtaHref);
  const hasSecondary = Boolean(config.secondaryCtaLabel && config.secondaryCtaHref);
  const hasContent = hasPrimary || hasSecondary;
  if (!hasContent) return null;
  if (!visible && !reserveWhenHidden) return null;

  return (
    <HeroReservedSlot hasContent visible={visible}>
      <div className={`flex flex-wrap gap-3 md:gap-4 ${heroFlexJustifyClass(alignment)}`}>
        {hasPrimary ? (
          <HeroPressableLink
            href={config.primaryCtaHref!}
            className="home-pressable--hero-primary inline-flex h-11 items-center rounded-full bg-white px-6 font-medium text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 md:h-12 md:px-7"
          >
            {config.primaryCtaLabel}
          </HeroPressableLink>
        ) : null}

        {hasSecondary ? (
          <HeroPressableLink
            href={config.secondaryCtaHref!}
            className="home-pressable--hero-secondary inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-6 font-medium text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 md:h-12 md:px-7"
          >
            {config.secondaryCtaLabel}
          </HeroPressableLink>
        ) : null}
      </div>
    </HeroReservedSlot>
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
  const reducedMotion = usePrefersReducedMotion();

  const images = config.images?.length ? config.images : fallbackImage ? [fallbackImage] : [];
  const image = images[0];
  // Mobile image support for internal heroes, excluding the Contact page hero.
  const supportsMobileImages = hero.page?.slug !== "contact";
  const mobileImage = supportsMobileImages ? config.mobileImages?.[0] : undefined;
  const title = config.title || fallbackTitle || hero.page?.title || "";
  const eyebrow = config.eyebrow || fallbackEyebrow || "Internal Page";
  const highlight = (config.highlight || "").trim();
  const subtitle = (config.subtitle || fallbackSubtitle || "").trim();
  const description = resolveDistinctHeroDescription(
    config.description,
    subtitle,
  );
  const imagePosition =
    config.imagePositionClassName ?? (isCompactHero ? "object-[50%_42%]" : "object-center");
  const brightness = isCompactHero
    ? "brightness(1.05) contrast(1.04) saturate(1.02)"
    : "brightness(1.04) contrast(1.04) saturate(1.02)";

  const titleSizeClass = isCompactHero
    ? "text-[2rem] leading-[1.15] sm:text-4xl md:text-[2.5rem]"
    : "max-w-[14ch] text-[2rem] leading-[1.2] sm:text-4xl md:text-[2.5rem]";

  const hasBreadcrumb = Boolean(belowTitle);
  const featuredItem = hero.resolvedItems?.[0] ?? null;

  const elements: Partial<Record<HeroElementKey, ReactNode>> = {
    eyebrow: (
      <HeroReservedSlot
        hasContent={Boolean(eyebrow)}
        visible={config.showEyebrow}
        className={`${heroTextAlignClass(config.eyebrowAlignment)} ${
          config.eyebrowAlignment === "center"
            ? "flex justify-center"
            : config.eyebrowAlignment === "left"
              ? "flex justify-end"
              : "flex justify-start"
        }`}
      >
        <p
          className={`flex items-center gap-3 font-en text-[10px] uppercase tracking-[0.2em] text-[#D8B87A]/55 ${
            config.eyebrowBold ? "font-bold" : "font-normal"
          }`}
        >
          <span className="h-px w-8 shrink-0 bg-gradient-to-r from-[#D8B87A]/60 to-transparent" />
          {eyebrow}
        </p>
      </HeroReservedSlot>
    ),
    title: (() => {
      if (!title) return null;
      const titleClass = `tracking-[-0.02em] text-white ${titleSizeClass} ${
        config.titleBold ? "font-bold" : "font-normal"
      } ${heroTextAlignClass(config.titleAlignment)}`;

      if (config.showTitle) {
        return <h1 className={titleClass}>{title}</h1>;
      }

      // Hidden title: non-semantic spacer preserving typography (avoid hidden h1).
      return (
        <div
          className={`${titleClass} pointer-events-none select-none`}
          aria-hidden="true"
          data-hero-slot-visible="false"
          style={{ visibility: "hidden" }}
          {...{ inert: true }}
        >
          {title}
        </div>
      );
    })(),
    highlight: (
      <HeroReservedSlot
        hasContent={Boolean(highlight)}
        visible={config.showHighlight}
        className={heroTextAlignClass(config.highlightAlignment)}
      >
        {isAboutPage ? (
          <p
            className={`text-[1.44rem] tracking-[0.08em] text-[#D8B87A] sm:text-[1.8rem] ${
              config.highlightBold ? "font-bold" : "font-medium"
            }`}
          >
            {highlight}
          </p>
        ) : (
          <p
            className={`bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-[1.35rem] text-transparent sm:text-[1.65rem] ${
              config.highlightBold ? "font-bold" : "font-medium"
            }`}
          >
            {highlight}
          </p>
        )}
      </HeroReservedSlot>
    ),
    subtitle: (
      <HeroReservedSlot
        hasContent={Boolean(subtitle)}
        visible={config.showSubtitle}
        className={`max-w-2xl ${heroTextAlignClass(config.subtitleAlignment)} ${
          config.subtitleAlignment === "center"
            ? "mx-auto"
            : config.subtitleAlignment === "left"
              ? "mr-auto"
              : ""
        }`}
      >
        <p
          className={`text-[15px] leading-8 text-white/66 md:text-base md:leading-9 ${
            config.subtitleBold ? "font-bold" : "font-normal"
          }`}
        >
          {subtitle}
        </p>
      </HeroReservedSlot>
    ),
    description: (
      <HeroReservedSlot
        hasContent={Boolean(description)}
        visible={config.showDescription}
        className={`max-w-2xl ${heroTextAlignClass(config.descriptionAlignment)} ${
          config.descriptionAlignment === "center"
            ? "mx-auto"
            : config.descriptionAlignment === "left"
              ? "mr-auto"
              : ""
        }`}
      >
        <RichTextContent
          value={description}
          mode="auto"
          className="block whitespace-pre-line text-[15px] leading-8 text-white/68 md:text-base md:leading-9 [&_a]:text-[#E8D5A8] [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-r-2 [&_blockquote]:border-[#D8B87A]/45 [&_blockquote]:pr-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pr-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-white/85 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pr-5"
        />
      </HeroReservedSlot>
    ),
    breadcrumb: hasBreadcrumb ? (
      <HeroReservedSlot hasContent visible={config.showBreadcrumb}>
        {belowTitle}
      </HeroReservedSlot>
    ) : null,
    cta: (
      <HeroCtaButtons
        config={config}
        alignment={config.ctaAlignment}
        visible={config.showCta !== false}
        reserveWhenHidden
      />
    ),
  };

  return (
    <section
      className={`relative isolate z-0 overflow-hidden bg-[#05070B] ${
        isCompactHero
          ? "h-[min(46vh,500px)] min-h-[400px]"
          : featuredItem
            ? "h-[min(74vh,680px)] min-h-[560px]"
            : "h-[min(62vh,580px)] min-h-[440px]"
      }`}
      dir="rtl"
      data-hero-reduced-motion={reducedMotion ? "true" : undefined}
    >
      {image ? (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <HeroArtDirectedImage
            desktopSrc={image}
            mobileSrc={mobileImage}
            priority
            imagePositionClassName={imagePosition}
            brightnessFilter={brightness}
          />
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
            <div className="flex min-w-0 flex-col gap-3 text-right md:gap-3.5">
              {config.heroElementOrder.map((key) => {
                const node = elements[key];
                if (node == null) return null;
                // Fragment avoids empty wrapper <div>s that still create flex gaps
                // when a reserved slot returns null (e.g. empty subtitle).
                return <Fragment key={key}>{node}</Fragment>;
              })}
            </div>

            {featuredItem ? (
              <HeroIntentLink
                href={featuredItem.href ?? "#"}
                className="group min-w-0 rounded-[2rem] border border-white/[0.14] bg-black/30 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:border-[#D8B87A]/35 hover:bg-black/40"
              >
                <span
                  className="flex min-w-0 items-center gap-4 lg:block"
                  data-hero-featured-topic="true"
                >
                  {featuredItem.image ? (
                    <span className="relative block h-24 w-28 shrink-0 overflow-hidden rounded-2xl lg:h-44 lg:w-full">
                      <Image
                        src={featuredItem.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 420px, 112px"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                    </span>
                  ) : null}

                  <span className="min-w-0 flex-1 px-1 py-1 text-right lg:px-3 lg:py-4">
                    {featuredItem.category ? (
                      <span className="block text-[11px] text-[#D8B87A]/75">
                        {featuredItem.category}
                      </span>
                    ) : null}
                    {featuredItem.title ? (
                      <span className="mt-1 line-clamp-2 block text-base font-semibold leading-7 text-white/90 group-hover:text-white lg:text-xl lg:leading-8">
                        {featuredItem.title}
                      </span>
                    ) : null}
                    {featuredItem.excerpt ? (
                      <span className="mt-2 hidden line-clamp-2 text-sm leading-7 text-white/58 lg:block">
                        {featuredItem.excerpt}
                      </span>
                    ) : null}
                  </span>
                </span>
              </HeroIntentLink>
            ) : (
              <div aria-hidden className="hidden min-w-0 lg:block" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
