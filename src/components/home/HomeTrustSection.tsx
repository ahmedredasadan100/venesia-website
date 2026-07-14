"use client";

        /*
          SECTION: Why Trust
          PURPOSE: Four proof-point cards establishing engineering credibility.
                   Converts premium aesthetics into concrete trust signals.
          MOTION:  Left column (heading + body) fades up first.
                   Four cards stagger in at 80 ms intervals.
                   Cards with images flip directionally on desktop hover.
                   Touch devices toggle the same directional flip via click
                   (Android may cancel pointer before pointerup; click still fires).
          VISUAL RULES:
            · Preserve 2-column grid at lg breakpoint
            · Card lift on hover is −1 — only for cards without image
            · Do not reduce proof card internal padding
            · Gold reveal line on front face — keep it
            · Card height stays 230px; flip must not layout-shift
        */

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import RichTextContent from "../content/RichTextContent";
import { isHtmlContent, stripHtml } from "../../lib/rich-text/html-utils";
import type { HomeTrustContent, HomeTrustTextAlignment } from "./home-trust-mappers";

const STATIC_DEFAULTS: HomeTrustContent = {
  eyebrow: "لماذا يثق السوق العقارى في فينيسيا؟",
  title: "مش بنبيع كلام… التنفيذ بيتكلم.",
  description:
    "الموقع هنا لازم يشتغل كدليل ثقة بصري، مش بروشور. كل جزء فيه يقول إن الشركة موجودة، شغالة، وبتبني بجد.",
  eyebrowBold: false,
  eyebrowAlignment: "right",
  titleBold: true,
  titleAlignment: "right",
  items: [
    {
      title: "أراضي مملوكة",
      text: "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع.",
    },
    {
      title: "إدارة هندسية",
      text: "متابعة تنفيذ مش مجرد صور… ده نظام بيشتغل على الأرض.",
    },
    {
      title: "مراحل موثقة",
      text: "كل مرحلة ليها معنى، وكل خطوة بتثبت إن الوعد بيتحول لحقيقة.",
    },
    {
      title: "رسالة طمأنة",
      text: "العميل مش محتاج يسمع وعود كتير… محتاج يشوف تنفيذ حقيقي.",
    },
  ],
};

const TEXT_ALIGN_CLASS: Record<HomeTrustTextAlignment, string> = {
  right: "text-right",
  center: "text-center",
  left: "text-left",
};

/**
 * Visual flip directions for a 2-col RTL grid:
 * DOM [0,1,2,3] → visual top-right, top-left, bottom-right, bottom-left.
 */
const HOME_TRUST_FLIP_VARIANTS = ["right", "left", "top", "bottom"] as const;
type HomeTrustFlipVariant = (typeof HOME_TRUST_FLIP_VARIANTS)[number];

/** Ignore tiny finger jitter; larger deltas = scroll gesture, not a tap. */
const SCROLL_GESTURE_PX = 16;

const TOUCH_MEDIA_QUERIES = [
  "(hover: none)",
  "(pointer: coarse)",
  "(any-pointer: coarse)",
] as const;

function flipVariantForIndex(index: number): HomeTrustFlipVariant {
  return HOME_TRUST_FLIP_VARIANTS[index % HOME_TRUST_FLIP_VARIANTS.length]!;
}

/**
 * Touch devices that need click-to-toggle.
 * Fine-pointer + hover desktops stay hover-only (no sticky click open).
 */
function readTouchCapability(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
  if (!window.matchMedia) return false;
  return TOUCH_MEDIA_QUERIES.some((query) => window.matchMedia(query).matches);
}

function subscribeTouchCapability(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const queries = ["(hover: hover) and (pointer: fine)", ...TOUCH_MEDIA_QUERIES];
  const mqs = queries.map((query) => window.matchMedia(query));
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

/** SSR: assume no touch so desktop markup stays non-interactive (no role/tabIndex). */
function getTouchCapabilityServerSnapshot() {
  return false;
}

function useTouchInteraction() {
  return useSyncExternalStore(
    subscribeTouchCapability,
    readTouchCapability,
    getTouchCapabilityServerSnapshot,
  );
}

function hasRichTextValue(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  if (!isHtmlContent(trimmed)) return true;
  return Boolean(stripHtml(trimmed));
}

function resolveHomeTrustContent(content?: HomeTrustContent | null) {
  if (!content) return STATIC_DEFAULTS;

  const items = content.items.filter((item) => item.title.trim() || item.text.trim());
  const resolvedItems = items.length ? items : STATIC_DEFAULTS.items;

  return {
    eyebrow: content.eyebrow?.trim() || STATIC_DEFAULTS.eyebrow,
    title: content.title?.trim() || STATIC_DEFAULTS.title,
    description: hasRichTextValue(content.description)
      ? content.description.trim()
      : STATIC_DEFAULTS.description,
    eyebrowBold: content.eyebrowBold ?? STATIC_DEFAULTS.eyebrowBold,
    eyebrowAlignment: content.eyebrowAlignment ?? STATIC_DEFAULTS.eyebrowAlignment,
    titleBold: content.titleBold ?? STATIC_DEFAULTS.titleBold,
    titleAlignment: content.titleAlignment ?? STATIC_DEFAULTS.titleAlignment,
    items: resolvedItems.map((item, index) => ({
      title: item.title?.trim() || STATIC_DEFAULTS.items[index]?.title || "",
      text: item.text?.trim() || STATIC_DEFAULTS.items[index]?.text || "",
      image: item.image?.trim() || undefined,
      imageAlt: item.imageAlt?.trim() || undefined,
    })),
  };
}

function TrustCardFaceContent({
  title,
  text,
  showIcon,
  face,
}: {
  title: string;
  text: string;
  showIcon: boolean;
  face: "front" | "back";
}) {
  const titleClass =
    face === "front"
      ? "home-trust-card__title home-trust-card__front-title"
      : "home-trust-card__title home-trust-card__back-title";
  const textClass =
    face === "front"
      ? "home-trust-card__text home-trust-card__front-description"
      : "home-trust-card__text home-trust-card__back-description";

  return (
    <div className="home-trust-card__body" dir="rtl">
      {showIcon ? (
        <div className="home-trust-card__icon" aria-hidden>
          ◆
        </div>
      ) : (
        <div className="home-trust-card__icon home-trust-card__icon--spacer" aria-hidden />
      )}
      <h3 className={titleClass}>{title}</h3>
      <p className={textClass}>{text}</p>
    </div>
  );
}

export type HomeTrustSectionProps = {
  content?: HomeTrustContent | null;
};

export default function HomeTrustSection({ content }: HomeTrustSectionProps) {
  const resolved = resolveHomeTrustContent(content);
  const touchInteraction = useTouchInteraction();
  const [openMobileCardIndex, setOpenMobileCardIndex] = useState<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const movedRef = useRef(false);
  const pressedCardIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!touchInteraction || openMobileCardIndex === null) return;

    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-home-trust-flip-card]")) return;
      setOpenMobileCardIndex(null);
    };

    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => document.removeEventListener("pointerdown", onPointerDownOutside);
  }, [touchInteraction, openMobileCardIndex]);

  const toggleMobileCard = useCallback(
    (index: number) => {
      if (!touchInteraction) return;
      setOpenMobileCardIndex((prev) => (prev === index ? null : index));
    },
    [touchInteraction],
  );

  const onCardPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
      if (!touchInteraction) return;
      if (event.pointerType === "mouse") return;
      pointerStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      movedRef.current = false;
      pressedCardIndexRef.current = index;
    },
    [touchInteraction],
  );

  const onCardPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!touchInteraction || !pointerStartRef.current) return;
      if (event.pointerType === "mouse") return;
      if (event.pointerId !== pointerStartRef.current.pointerId) return;
      const dx = Math.abs(event.clientX - pointerStartRef.current.x);
      const dy = Math.abs(event.clientY - pointerStartRef.current.y);
      if (dx > SCROLL_GESTURE_PX || dy > SCROLL_GESTURE_PX) {
        movedRef.current = true;
      }
    },
    [touchInteraction],
  );

  /**
   * Chrome Android often fires pointercancel before pointerup on a still tap.
   * Clear tracking only — do NOT mark as moved, so the subsequent click can open.
   */
  const onCardPointerCancel = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const onCardClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, index: number) => {
      if (!touchInteraction) return;
      if (movedRef.current) {
        event.preventDefault();
        movedRef.current = false;
        pointerStartRef.current = null;
        pressedCardIndexRef.current = null;
        return;
      }
      pointerStartRef.current = null;
      pressedCardIndexRef.current = index;
      toggleMobileCard(index);
    },
    [touchInteraction, toggleMobileCard],
  );

  const onCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, index: number) => {
      if (!touchInteraction) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleMobileCard(index);
    },
    [touchInteraction, toggleMobileCard],
  );

  return (
    <section className="mx-auto max-w-7xl px-6 py-7">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div data-reveal>
          <p
            className={`text-sm text-[#D8B87A] ${TEXT_ALIGN_CLASS[resolved.eyebrowAlignment]}`}
            style={{ fontWeight: resolved.eyebrowBold ? 700 : 400 }}
          >
            {resolved.eyebrow}
          </p>

          <h2
            className={`mt-3 text-4xl leading-tight ${TEXT_ALIGN_CLASS[resolved.titleAlignment]}`}
            style={{ fontWeight: resolved.titleBold ? 700 : 400 }}
          >
            {resolved.title}
          </h2>

          {/*
            Scoped Home Trust intro only via .home-trust-intro in globals.css:
            muted body matching prior plain paragraph. Does not change other rich text.
          */}
          <RichTextContent value={resolved.description} mode="rich" className="home-trust-intro" />
        </div>

        <div
          className="grid items-stretch gap-4 sm:grid-cols-2"
          data-home-trust-touch={touchInteraction ? "true" : undefined}
        >
          {resolved.items.map((item, idx) => {
            const hasImage = Boolean(item.image);
            const flipVariant = hasImage ? flipVariantForIndex(idx) : null;
            const isMobileOpen = touchInteraction && hasImage && openMobileCardIndex === idx;

            return (
              <div
                key={`${item.title}-${idx}`}
                data-reveal
                data-delay={String(idx * 80)}
                data-flip={flipVariant ?? undefined}
                data-home-trust-flip-card={hasImage ? "true" : undefined}
                data-mobile-open={isMobileOpen ? "true" : undefined}
                role={touchInteraction && hasImage ? "button" : undefined}
                tabIndex={touchInteraction && hasImage ? 0 : undefined}
                aria-expanded={touchInteraction && hasImage ? isMobileOpen : undefined}
                aria-label={
                  touchInteraction && hasImage
                    ? isMobileOpen
                      ? `إخفاء تفاصيل: ${item.title}`
                      : `عرض تفاصيل: ${item.title}`
                    : undefined
                }
                onPointerDown={hasImage ? (event) => onCardPointerDown(event, idx) : undefined}
                onPointerMove={hasImage ? onCardPointerMove : undefined}
                onPointerCancel={hasImage ? onCardPointerCancel : undefined}
                onClick={hasImage ? (event) => onCardClick(event, idx) : undefined}
                onKeyDown={hasImage ? (event) => onCardKeyDown(event, idx) : undefined}
                className={[
                  "home-trust-card group relative text-white",
                  hasImage
                    ? `home-trust-card--has-image home-trust-card--flip-${flipVariant}`
                    : "overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] backdrop-blur transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-white/[0.17] hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]",
                  touchInteraction && hasImage ? "cursor-pointer" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="home-trust-card__inner">
                  <div className="home-trust-card__front">
                    <div
                      aria-hidden
                      className="home-trust-card__reveal-line absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-[#D8B87A]/60 via-[#D8B87A]/25 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
                    />
                    <TrustCardFaceContent title={item.title} text={item.text} showIcon face="front" />
                  </div>

                  {hasImage ? (
                    <div className="home-trust-card__back" aria-hidden="true">
                      <div className="home-trust-card__media">
                        <Image
                          src={item.image!}
                          alt=""
                          fill
                          className="home-trust-card__image home-trust-card__back-image"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                        />
                      </div>
                      <div className="home-trust-card__overlay" />
                      <TrustCardFaceContent
                        title={item.title}
                        text={item.text}
                        showIcon={false}
                        face="back"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
