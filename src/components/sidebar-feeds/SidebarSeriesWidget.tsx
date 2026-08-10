"use client";

import Image from "next/image";
import Link from "next/link";

import type { SidebarSeriesItem } from "../../lib/content-feeds/types";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import { SidebarFeedPanel } from "./SidebarFeedPanel";

type SidebarSeriesWidgetProps = {
  items: SidebarSeriesItem[];
  eyebrow: string;
  title: string;
  linkText: string;
};

export default function SidebarSeriesWidget({
  items,
  eyebrow,
  title,
  linkText,
}: SidebarSeriesWidgetProps) {
  const { activeIndex, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({
      itemCount: items.length,
      intervalMs: 8200,
    });
  const activeItem = items[activeIndex] ?? items[0];

  if (!activeItem) return null;

  const cardContent = (
    <>
      <div className="relative h-44 overflow-hidden">
        <Image
          src={activeItem.image}
          alt={activeItem.title}
          fill
          sizes="(max-width: 1024px) 100vw, 340px"
          className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      </div>

      <div className="p-4">
        <h4 className="text-base font-semibold text-white">{activeItem.title}</h4>

        {activeItem.subtitle ? (
          <p className="mt-2 text-sm leading-6 text-white/50">{activeItem.subtitle}</p>
        ) : null}

        <p className="mt-3 flex justify-end text-xs text-[#D8B87A]/80">{linkText}</p>
      </div>
    </>
  );
  const cardClassName =
    "group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition-all duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05] motion-safe:animate-[featuredFade_500ms_ease-out]";

  return (
    <SidebarFeedPanel eyebrow={eyebrow} title={title}>
      <div
        ref={containerRef}
        className="touch-pan-y"
        role="region"
        aria-roledescription="carousel"
        aria-label={title}
        {...swipeHandlers}
      >
        <div
          key={activeItem.slug}
          role="group"
          aria-roledescription="slide"
          aria-label={`${activeIndex + 1} من ${items.length}`}
        >
          {activeItem.href.trim() ? (
            <Link href={activeItem.href} scroll={false} className={cardClassName}>
              {cardContent}
            </Link>
          ) : (
            <article className={cardClassName}>{cardContent}</article>
          )}
        </div>

      </div>
    </SidebarFeedPanel>
  );
}
