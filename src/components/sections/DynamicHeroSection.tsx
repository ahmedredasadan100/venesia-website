"use client";

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
import type { HeroDomainSlide } from "../../lib/hero/domain-backed-slides";
import { getHeroConfig } from "../../lib/page-sections";
import {
  heroFlexJustifyClass,
  heroTextAlignClass,
  resolveHeroFamily,
  resolveDistinctHeroDescription,
  STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE,
  STANDARD_INTERNAL_HERO_ELEMENT_ORDER,
  type HeroElementKey,
  type HeroImageCompositionPreset,
  type HeroTextAlignment,
} from "../../lib/hero/hero-content-controls";
import { useSwipeSlider } from "../../hooks/use-swipe-slider";
import { usePressFeedback } from "../../hooks/use-press-feedback";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import RichTextContent from "../content/RichTextContent";
import {
  PublicArtDirectedMediaImage,
} from "../public/PublicMediaImage";

type DynamicHeroSectionProps = {
  hero?: HeroSectionData | null;
  fallbackTitle?: string;
  fallbackEyebrow?: string;
  fallbackSubtitle?: string;
  fallbackImage?: string;
  /** Page Composition-owned content placed in the Standard Hero footer slot. */
  compositionFooter?: ReactNode;
  domainSlides?: readonly HeroDomainSlide[];
  autoplayMs?: number;
  emptyState?: string | null;
  fallbackVisibility?: {
    title?: boolean;
    image?: boolean;
    subtitle?: boolean;
  };
};

function heroPillAlignmentClass(alignment: HeroTextAlignment) {
  return alignment === "center" ? "self-center" : alignment === "left" ? "self-end" : "self-start";
}

export default function DynamicHeroSection({
  hero,
  fallbackTitle,
  fallbackEyebrow,
  fallbackSubtitle,
  fallbackImage,
  compositionFooter,
  domainSlides,
  autoplayMs,
  emptyState,
}: DynamicHeroSectionProps) {
  const variant = hero?.variant || "internal-page";

  if (hero && (variant === "home-cinematic" || variant === "projects-hub")) {
    return (
      <HomeDynamicHero
        hero={hero}
        domainSlides={domainSlides}
        autoplayMs={autoplayMs}
        emptyState={emptyState}
      />
    );
  }

  if (domainSlides && !domainSlides.length) {
    return emptyState ? (
      <section className="border-b border-[#D8B87A]/15 bg-[#05070B] px-6 py-16 text-center text-white/55">
        <p>{emptyState}</p>
      </section>
    ) : null;
  }

  const domainSlide = domainSlides?.[0];
  const resolvedHero = domainSlide && hero ? {
    ...hero,
    config: {
      ...(hero.config ?? {}),
      eyebrow: domainSlide.eyebrow,
      title: domainSlide.title,
      highlight: domainSlide.highlight,
      subtitle: domainSlide.subtitle,
      description: domainSlide.description,
      images: [domainSlide.desktopImage],
      mobileImages: domainSlide.mobileImage ? [domainSlide.mobileImage] : [],
      primaryCtaLabel: domainSlide.primaryCtaLabel,
      primaryCtaHref: domainSlide.primaryCtaHref,
      secondaryCtaLabel: domainSlide.secondaryCtaLabel,
      secondaryCtaHref: domainSlide.secondaryCtaHref,
    },
  } : hero;

  return (
    <InternalDynamicHero
      hero={resolvedHero}
      fallbackTitle={fallbackTitle}
      fallbackEyebrow={fallbackEyebrow}
      fallbackSubtitle={fallbackSubtitle}
      fallbackImage={fallbackImage}
      compositionFooter={compositionFooter}
      domainSlides={domainSlides}
      // Visibility is a public contract: hidden content is removed from the
      // composed Hero, not merely made transparent while reserving DOM space.
      collapseHiddenContent={true}
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

type HeroSlideImageProps = {
  desktopSrc: string;
  mobileSrc?: string;
  priority?: boolean;
  imageComposition?: HeroImageCompositionPreset;
  brightnessFilter?: string;
};

/**
 * Browser picks mobile/desktop source via <picture> before hydration —
 * no client matchMedia swap, no desktop-first flash on phones.
 */
function HeroArtDirectedImage({
  desktopSrc,
  mobileSrc,
  priority = false,
  imageComposition = "cover-center",
  brightnessFilter = "brightness(1.12) contrast(1.08) saturate(1.04)",
}: HeroSlideImageProps) {
  return (
    <PublicArtDirectedMediaImage
      desktopSrc={desktopSrc}
      mobileSrc={mobileSrc}
      alt=""
      priority={priority}
      sizes="100vw"
      composition={imageComposition}
      className="hero-slide-ken-burns hero-slide-ken-burns-image pointer-events-none"
      style={{ filter: brightnessFilter }}
    />
  );
}

function buildHomeHeroSlides(desktopImages: string[], mobileImages: string[]): HeroDomainSlide[] {
  const hasMobileSet = mobileImages.length > 0;
  const count = hasMobileSet
    ? Math.max(desktopImages.length, mobileImages.length)
    : desktopImages.length;

  return Array.from({ length: count }, (_, index) => {
    const desktop = desktopImages[index] ?? mobileImages[index] ?? "";
    const mobile = mobileImages[index] ?? desktop;
    return { id: `manual-${index}`, desktopImage: desktop, mobileImage: mobile !== desktop ? mobile : undefined };
  }).filter((slide) => Boolean(slide.desktopImage));
}

function HomeDynamicHero({
  hero,
  domainSlides,
  autoplayMs = 7500,
  emptyState,
}: {
  hero: HeroSectionData;
  domainSlides?: readonly HeroDomainSlide[];
  autoplayMs?: number;
  emptyState?: string | null;
}) {
  const config = getHeroConfig(hero);
  const images = config.images ?? [];
  const mobileImages = config.mobileImages ?? [];
  const isDomainBacked = domainSlides !== undefined;
  const slides = domainSlides ? [...domainSlides] : buildHomeHeroSlides(images, mobileImages);
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
    }, autoplayMs);
  }, [autoplayMs, canSwipe, reducedMotion, slideCount]);

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
      setPreparedSlideIndexes(new Set([safeIndex, nextIndex]));
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

  const activeSlide = slides[safeIndex];
  const title = activeSlide?.title ?? config.title ?? "";
  const highlight = activeSlide?.highlight ?? config.highlight ?? "";
  const subtitle = activeSlide?.subtitle ?? config.subtitle ?? "";
  const description = resolveDistinctHeroDescription(
    activeSlide?.description ?? config.description,
    subtitle,
  );
  const activeConfig = {
    ...config,
    eyebrow: activeSlide?.eyebrow ?? config.eyebrow,
    title,
    highlight,
    subtitle,
    description,
    primaryCtaLabel: activeSlide?.primaryCtaLabel ?? config.primaryCtaLabel,
    primaryCtaHref: activeSlide?.primaryCtaHref ?? config.primaryCtaHref,
    secondaryCtaLabel: activeSlide?.secondaryCtaLabel ?? config.secondaryCtaLabel,
    secondaryCtaHref: activeSlide?.secondaryCtaHref ?? config.secondaryCtaHref,
  };
  const usesHomeCinematicTypography = hero.variant === "home-cinematic";
  const usesProjectIdentityTypography = hero.variant === "projects-hub";

  const hasHeroContent = Boolean(
    slides.length ||
      title ||
      highlight ||
      subtitle ||
      description ||
      config.eyebrow,
  );
  if (!hasHeroContent) {
    return emptyState ? (
      <section className="border-b border-[#D8B87A]/15 bg-[#05070B] px-6 py-16 text-center text-white/55">
        <p>{emptyState}</p>
      </section>
    ) : null;
  }

  const contentElements: Partial<Record<HeroElementKey, ReactNode>> = {
    eyebrow: activeConfig.eyebrow && activeConfig.showEyebrow ? (
      <div
        className={`inline-flex w-fit max-w-full whitespace-normal rounded-full border border-white/10 bg-[#0B1220]/32 px-3 py-3 text-xs tracking-normal text-[#D8B87A] backdrop-blur-md min-[361px]:px-4 min-[361px]:text-sm min-[361px]:tracking-wide ${heroPillAlignmentClass(activeConfig.eyebrowAlignment)} ${heroTextAlignClass(activeConfig.eyebrowAlignment)} ${activeConfig.eyebrowBold ? "font-bold" : "font-normal"}`}
      >
        {activeConfig.eyebrow}
      </div>
    ) : null,
    title: title && activeConfig.showTitle ? (
      <h1
        className={`${
          usesProjectIdentityTypography
            ? "max-w-none font-en text-xl leading-tight tracking-[-0.02em] sm:text-2xl md:text-3xl"
            : "max-w-none text-4xl leading-[1.06] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl"
        } text-white ${heroTextAlignClass(activeConfig.titleAlignment)} ${activeConfig.titleBold ? "font-bold" : "font-normal"}`}
      >
        {title}
      </h1>
    ) : null,
    highlight: highlight && activeConfig.showHighlight ? (
      usesHomeCinematicTypography ? (
        <span
          className={`block w-fit max-w-full bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-4xl leading-[1.18] tracking-[-0.02em] text-transparent sm:text-5xl md:text-6xl lg:text-7xl ${heroPillAlignmentClass(activeConfig.highlightAlignment)} ${heroTextAlignClass(activeConfig.highlightAlignment)} ${activeConfig.highlightBold ? "font-semibold" : "font-normal"}`}
        >
          {highlight}
        </span>
      ) : (
        <p
          className={`bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-2xl text-transparent ${heroTextAlignClass(activeConfig.highlightAlignment)} ${activeConfig.highlightBold ? "font-bold" : "font-medium"}`}
        >
          {highlight}
        </p>
      )
    ) : null,
    subtitle: subtitle && activeConfig.showSubtitle ? (
      usesHomeCinematicTypography ? (
        <div
          className={`inline-flex w-fit max-w-full whitespace-normal rounded-full border border-[#D8B87A]/22 bg-[rgba(216,184,122,0.10)] px-3 py-3 text-xs tracking-normal text-[#E8D5A8] shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-md min-[361px]:px-4 min-[361px]:text-sm min-[361px]:tracking-wide md:text-base ${heroPillAlignmentClass(activeConfig.subtitleAlignment)} ${heroTextAlignClass(activeConfig.subtitleAlignment)} ${activeConfig.subtitleBold ? "font-bold" : "font-normal"}`}
        >
          {subtitle}
        </div>
      ) : (
        <p
          className={`text-3xl leading-tight text-[#E8D5A8] sm:text-4xl md:text-5xl ${heroTextAlignClass(activeConfig.subtitleAlignment)} ${activeConfig.subtitleBold ? "font-bold" : "font-normal"}`}
        >
          {subtitle}
        </p>
      )
    ) : null,
    description: description && activeConfig.showDescription ? (
      <RichTextContent
        value={description}
        mode="auto"
        className={`max-w-2xl text-base leading-8 text-white/68 md:text-lg md:leading-9 ${heroTextAlignClass(activeConfig.descriptionAlignment)} ${activeConfig.descriptionBold ? "font-bold" : "font-normal"}`}
      />
    ) : null,
    cta: (
      <HeroCtaButtons
        config={activeConfig}
        alignment={activeConfig.ctaAlignment}
        visible={activeConfig.showCta !== false}
      />
    ),
  };

  return (
    <section
      ref={containerRef}
      className="relative isolate min-h-screen touch-pan-y overflow-hidden bg-[#05070B]"
      dir="rtl"
      data-hero-variant={hero.variant}
      data-hero-family={resolveHeroFamily(hero.variant)}
      data-hero-reduced-motion={reducedMotion ? "true" : undefined}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {slides.map((slide, index) => (
          <div
            key={`${slide.id}-${index}`}
            className={`hero-slide-fade absolute inset-0 transition-opacity ease-in-out ${
              index === safeIndex ? "opacity-100" : "opacity-0"
            } ${reducedMotion ? "duration-150" : "duration-[2400ms]"}`}
          >
            {/* Mount the active slide immediately, then prepare the next slide ahead of autoplay. */}
            {index === safeIndex || preparedSlideIndexes.has(index) ? (
              <HeroArtDirectedImage
                desktopSrc={slide.desktopImage}
                mobileSrc={slide.mobileImage}
                priority={index === 0}
                imageComposition={config.imageComposition}
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
        <div className="mx-auto flex w-full max-w-7xl items-center px-6 pt-28 pb-20 max-md:pt-0 max-md:pb-24">
          <div className="min-w-0 max-w-4xl lg:min-w-auto">
            <div className={`flex flex-col gap-4 ${isDomainBacked ? "" : "text-right lg:translate-y-[2.75em]"}`}>
              {activeConfig.heroElementOrder.map((key) => {
                const node = contentElements[key];
                return node == null ? null : <Fragment key={key}>{node}</Fragment>;
              })}
            </div>
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
  reserveWhenHidden = true,
  children,
}: {
  hasContent: boolean;
  visible: boolean;
  className?: string;
  reserveWhenHidden?: boolean;
  children: ReactNode;
}) {
  if (!hasContent || (!visible && !reserveWhenHidden)) return null;

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
            className={`home-pressable--hero-primary inline-flex h-11 items-center rounded-full bg-white px-6 text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 md:h-12 md:px-7 ${config.ctaBold ? "font-bold" : "font-medium"}`}
          >
            {config.primaryCtaLabel}
          </HeroPressableLink>
        ) : null}

        {hasSecondary ? (
          <HeroPressableLink
            href={config.secondaryCtaHref!}
            className={`home-pressable--hero-secondary inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-6 text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 md:h-12 md:px-7 ${config.ctaBold ? "font-bold" : "font-medium"}`}
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
  compositionFooter,
  fallbackVisibility,
  collapseHiddenContent = true,
}: DynamicHeroSectionProps & { collapseHiddenContent?: boolean }) {
  const config = getHeroConfig(hero);
  const reducedMotion = usePrefersReducedMotion();

  const isCmsHero = Boolean(hero);
  const showFallbackImage = fallbackVisibility?.image !== false;
  const images = config.images?.length
    ? config.images
    : fallbackImage && showFallbackImage
      ? [fallbackImage]
      : [];
  const image = images[0];
  // Mobile image support is a shared variant contract, not a route exception.
  const mobileImage = config.mobileImages?.[0];
  const title = config.title || fallbackTitle || hero?.page?.title || "";
  const eyebrow = config.eyebrow || fallbackEyebrow || "Internal Page";
  const highlight = (config.highlight || "").trim();
  const subtitle = (config.subtitle || fallbackSubtitle || "").trim();
  const description = resolveDistinctHeroDescription(
    config.description,
    subtitle,
  );
  const showTitle = config.showTitle && (isCmsHero || fallbackVisibility?.title !== false);
  const showSubtitle = config.showSubtitle && (isCmsHero || fallbackVisibility?.subtitle !== false);
  const brightness = "brightness(1.04) contrast(1.04) saturate(1.02)";
  const titleSizeClass = "max-w-[14ch] text-[2rem] leading-[1.2] sm:text-4xl md:text-[2.5rem]";
  const elements: Partial<Record<HeroElementKey, ReactNode>> = {
    eyebrow: (
      <HeroReservedSlot
        hasContent={Boolean(eyebrow)}
        visible={config.showEyebrow}
        reserveWhenHidden={!collapseHiddenContent}
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
      } ${heroTextAlignClass(config.titleAlignment)} ${
        config.titleAlignment === "center"
          ? "mx-auto"
          : config.titleAlignment === "left"
            ? "mr-auto"
            : ""
      }`;

      if (showTitle) {
        return <h1 className={titleClass}>{title}</h1>;
      }

      if (collapseHiddenContent) return null;

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
        reserveWhenHidden={!collapseHiddenContent}
        className={heroTextAlignClass(config.highlightAlignment)}
      >
        <p
          className={`bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-[1.35rem] text-transparent sm:text-[1.65rem] ${
            config.highlightBold ? "font-bold" : "font-medium"
          }`}
        >
          {highlight}
        </p>
      </HeroReservedSlot>
    ),
    subtitle: (
      <HeroReservedSlot
        hasContent={Boolean(subtitle)}
        visible={showSubtitle}
        reserveWhenHidden={!collapseHiddenContent}
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
        reserveWhenHidden={!collapseHiddenContent}
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
          className={`block whitespace-pre-line text-[15px] leading-8 text-white/68 md:text-base md:leading-9 [&_a]:text-[#E8D5A8] [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-r-2 [&_blockquote]:border-[#D8B87A]/45 [&_blockquote]:pr-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pr-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-white/85 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pr-5 ${config.descriptionBold ? "font-bold" : "font-normal"}`}
        />
      </HeroReservedSlot>
    ),
    cta: (
      <HeroCtaButtons
        config={config}
        alignment={config.ctaAlignment}
        visible={config.showCta !== false}
        reserveWhenHidden={!collapseHiddenContent}
      />
    ),
  };

  return (
    <section
      className="relative isolate z-0 h-[min(62vh,580px)] min-h-[440px] overflow-hidden bg-[#05070B]"
      dir="rtl"
      data-hero-variant={hero?.variant ?? "internal-page"}
      data-hero-family="standard-internal"
      data-hero-height-preset="standard-internal"
      data-hero-composition-baseline={STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE}
      data-hero-reduced-motion={reducedMotion ? "true" : undefined}
    >
      {image ? (
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <HeroArtDirectedImage
            desktopSrc={image}
            mobileSrc={mobileImage}
            priority
            imageComposition={config.imageComposition}
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
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16">
          <div
            className="w-full max-w-3xl"
            data-hero-composition-root="standard-internal"
          >
            <div className="flex min-w-0 flex-col gap-3 text-right md:gap-3.5">
              {STANDARD_INTERNAL_HERO_ELEMENT_ORDER.map((key) => {
                const node = elements[key];
                if (node == null) return null;
                // Fragment avoids empty wrapper <div>s that still create flex gaps
                // when a reserved slot returns null (e.g. empty subtitle).
                return <Fragment key={key}>{node}</Fragment>;
              })}
              {compositionFooter ? (
                <div data-hero-composition-footer="page-composition">{compositionFooter}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
