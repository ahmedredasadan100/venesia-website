"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAutoCarousel } from "../../hooks/use-auto-carousel";
import type { MediaSidebarPresentation } from "../../lib/media-sidebar-modules/parse-config";
import { usePublicNavigation } from "../PublicNavigationProvider";
import FeedCarouselDots from "../feed-modules/FeedCarouselDots";
import PublicContentSearchInput from "../public/PublicContentSearchInput";
import { SidebarFeedPanel } from "../sidebar-feeds/SidebarFeedPanel";
import type { PublicContentSearchSuggestion } from "../../lib/content/public-content-read";
import type {
  MediaSidebarContentItem,
  MediaSidebarWidgetState,
} from "../../lib/media-sidebar-modules/types";

type SidebarMediaItemLayout = "list" | "feature" | "compact";

function SidebarMediaItemImage({
  item,
  layout,
}: {
  item: MediaSidebarContentItem;
  layout: SidebarMediaItemLayout;
}) {
  if (!item.display.image) return null;

  const containerClassName =
    layout === "list"
      ? "relative h-16 w-20 shrink-0 overflow-hidden rounded-xl"
      : layout === "feature"
        ? "relative aspect-[16/10] w-full overflow-hidden"
        : "relative aspect-[4/3] w-full overflow-hidden rounded-xl";
  const sizes =
    layout === "list"
      ? "80px"
      : layout === "feature"
        ? "(max-width: 1024px) 100vw, 340px"
        : "(max-width: 1024px) 30vw, 100px";

  return (
    <div className={containerClassName}>
      <Image
        src={item.image}
        alt={item.imageAlt || item.title}
        fill
        sizes={sizes}
        className="object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/55 via-transparent to-transparent" />
    </div>
  );
}

function SidebarMediaItemText({
  item,
  layout,
}: {
  item: MediaSidebarContentItem;
  layout: SidebarMediaItemLayout;
}) {
  const metadataClassName =
    layout === "compact"
      ? "mb-1 text-[10px] leading-4 text-[#D8B87A]/75"
      : "mb-1 text-[11px] text-[#D8B87A]/75";

  return (
    <>
      {item.display.category ? (
        <p className={metadataClassName}>{item.category}</p>
      ) : null}

      {item.display.series ? (
        <p className={metadataClassName}>{item.series}</p>
      ) : null}

      {item.display.title ? (
        <h4
          className={[
            "line-clamp-2 text-white/75 transition group-hover:text-[#D8B87A]",
            layout === "feature"
              ? "text-base font-semibold leading-7"
              : "text-sm leading-6",
          ].join(" ")}
        >
          {item.title}
        </h4>
      ) : null}

      {item.display.excerpt ? (
        <p
          className={[
            "mt-1 line-clamp-2 text-white/45",
            layout === "feature"
              ? "text-sm leading-6"
              : "text-xs leading-5",
          ].join(" ")}
        >
          {item.excerpt}
        </p>
      ) : null}

      {item.display.date ? (
        <p className="mt-1 text-xs text-white/35">{item.date}</p>
      ) : null}
    </>
  );
}

function SidebarMediaItem({
  item,
  layout,
}: {
  item: MediaSidebarContentItem;
  layout: SidebarMediaItemLayout;
}) {
  const linkClassName =
    layout === "list"
      ? "group flex gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0"
      : layout === "feature"
        ? "group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition-[border-color,background-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/[0.05] motion-reduce:hover:translate-y-0"
        : "group flex min-w-0 flex-col";
  const textClassName =
    layout === "list"
      ? "min-w-0 flex-1"
      : layout === "feature"
        ? "min-w-0 p-4"
        : item.display.image
          ? "mt-3 min-w-0"
          : "min-w-0";

  return (
    <Link href={item.href} aria-label={item.title} className={linkClassName}>
      <SidebarMediaItemImage item={item} layout={layout} />
      <div className={textClassName}>
        <SidebarMediaItemText item={item} layout={layout} />
      </div>
    </Link>
  );
}

function SidebarMediaList({ items }: { items: MediaSidebarContentItem[] }) {
  return (
    <div className="space-y-4" data-media-sidebar-presentation="list">
      {items.map((item) => (
        <SidebarMediaItem key={item.id} item={item} layout="list" />
      ))}
    </div>
  );
}

function SidebarMediaSingleCarousel({
  items,
  title,
}: {
  items: MediaSidebarContentItem[];
  title: string;
}) {
  const { activeIndex, canAdvance, goTo, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({ itemCount: items.length, intervalMs: 7600 });
  const item = items[activeIndex] ?? items[0];

  if (!item) return null;

  return (
    <div
      ref={containerRef}
      className="touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
      data-media-sidebar-presentation="single-carousel"
      {...swipeHandlers}
    >
      <div
        key={item.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} من ${items.length}`}
        className="motion-safe:animate-[feedCarouselFade_500ms_ease-out]"
      >
        <SidebarMediaItem item={item} layout="feature" />
      </div>

      {canAdvance ? (
        <FeedCarouselDots
          count={items.length}
          activeIndex={activeIndex}
          onSelect={goTo}
          itemLabel={`أخبار ${title}`}
        />
      ) : null}
    </div>
  );
}

const MEDIA_SIDEBAR_GROUP_SIZE = 3;

function chunkSidebarMediaItems(items: MediaSidebarContentItem[]) {
  const slides: MediaSidebarContentItem[][] = [];
  for (let index = 0; index < items.length; index += MEDIA_SIDEBAR_GROUP_SIZE) {
    slides.push(items.slice(index, index + MEDIA_SIDEBAR_GROUP_SIZE));
  }
  return slides;
}

function SidebarMediaGroupCarousel({
  items,
  title,
}: {
  items: MediaSidebarContentItem[];
  title: string;
}) {
  const slides = chunkSidebarMediaItems(items);
  const { activeIndex, canAdvance, goTo, containerRef, swipeHandlers } =
    useAutoCarousel<HTMLDivElement>({ itemCount: slides.length, intervalMs: 7600 });
  const activeItems = slides[activeIndex] ?? slides[0] ?? [];

  if (!activeItems.length) return null;

  return (
    <div
      ref={containerRef}
      className="touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
      data-media-sidebar-presentation="group-carousel"
      {...swipeHandlers}
    >
      <div
        key={activeIndex}
        className="grid grid-cols-3 gap-3 motion-safe:animate-[feedCarouselFade_450ms_ease-out]"
        role="group"
        aria-roledescription="slide"
        aria-label={`مجموعة ${activeIndex + 1} من ${slides.length}`}
      >
        {activeItems.map((item) => (
          <SidebarMediaItem key={item.id} item={item} layout="compact" />
        ))}
      </div>

      {canAdvance ? (
        <FeedCarouselDots
          count={slides.length}
          activeIndex={activeIndex}
          onSelect={goTo}
          itemLabel={`مجموعات ${title}`}
        />
      ) : null}
    </div>
  );
}

function SidebarMediaPresentation({
  items,
  presentation,
  title,
}: {
  items: MediaSidebarContentItem[];
  presentation: MediaSidebarPresentation;
  title: string;
}) {
  if (presentation === "single-carousel") {
    return <SidebarMediaSingleCarousel items={items} title={title} />;
  }
  if (presentation === "group-carousel") {
    return <SidebarMediaGroupCarousel items={items} title={title} />;
  }
  return <SidebarMediaList items={items} />;
}

function SectionsPanel({
  mediaItems,
  pathname,
}: {
  mediaItems: Array<{ href: string; label: string }>;
  pathname: string;
}) {
  if (!mediaItems.length) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(216,184,122,0.13),transparent_38%)]"
      />

      <div className="relative z-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#D8B87A]/75">
          Media Center
        </p>

        <h2 className="mt-3 text-xl font-semibold text-white">
          أقسام المركز الإعلامي
        </h2>

        <nav className="mt-6 space-y-2" aria-label="Media Center Navigation">
          {mediaItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group relative flex items-center justify-between overflow-hidden rounded-2xl border px-4 py-3 text-sm transition duration-500",
                  isActive
                    ? "border-[#D8B87A]/40 bg-[#D8B87A]/10 text-[#D8B87A] shadow-[0_10px_34px_rgba(216,184,122,0.10)]"
                    : "border-white/8 bg-white/[0.025] text-white/62 hover:border-[#D8B87A]/25 hover:bg-white/[0.045] hover:text-white",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "absolute inset-y-0 right-0 w-[3px] rounded-full bg-[#D8B87A] transition duration-500",
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-60",
                  ].join(" ")}
                />

                <span className="relative z-10">{item.label}</span>

                <span
                  aria-hidden="true"
                  className={[
                    "relative z-10 h-1.5 w-1.5 rounded-full transition duration-500",
                    isActive
                      ? "bg-[#D8B87A]"
                      : "bg-white/20 group-hover:bg-[#D8B87A]/70",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

type MediaSidebarSearchProps = {
  searchBasePath?: string;
  searchQuery?: string;
  searchSuggestions?: readonly PublicContentSearchSuggestion[];
  searchResultCount?: number;
};

function renderWidgetPanel(
  widget: MediaSidebarWidgetState,
  props: {
    navItems: Array<{ href: string; submenu?: Array<{ href: string; label: string }> }>;
    pathname: string;
  },
) {
  switch (widget.widgetKey) {
    case "sections": {
      if (widget.config.source !== "navigation") return null;
      const menuParent = widget.config.menuParent ?? "/media-center";
      const mediaItems = props.navItems.find((item) => item.href === menuParent)?.submenu ?? [];

      return (
        <SectionsPanel
          key={`sections-${widget.assignmentId}`}
          mediaItems={mediaItems}
          pathname={props.pathname}
        />
      );
    }
    case "latest":
    case "popular": {
      if (widget.config.source === "navigation") return null;
      const title = widget.widgetKey === "latest" ? "الأحدث" : "الأكثر قراءة";
      return (
        <SidebarFeedPanel key={`${widget.widgetKey}-${widget.assignmentId}`} title={title}>
          <SidebarMediaPresentation
            items={widget.items ?? []}
            presentation={widget.config.presentation}
            title={title}
          />
        </SidebarFeedPanel>
      );
    }
    default:
      return null;
  }
}

export function MediaSidebarWidget({ widget }: { widget: MediaSidebarWidgetState }) {
  const pathname = usePathname();
  const navItems = usePublicNavigation();

  return renderWidgetPanel(widget, { navItems, pathname });
}

export function MediaSidebarSearch({
  searchBasePath,
  searchQuery = "",
  searchSuggestions = [],
  searchResultCount = 0,
}: MediaSidebarSearchProps) {
  if (!searchBasePath) return null;

  return (
    <SidebarFeedPanel eyebrow="Search" title="ابحث في المركز الإعلامي">
      <PublicContentSearchInput
        basePath={searchBasePath}
        query={searchQuery}
        suggestions={searchSuggestions}
        resultCount={searchResultCount}
        placeholder="اكتب كلمة البحث..."
        ariaLabel="ابحث داخل القسم الحالي من المركز الإعلامي"
        helpText="البحث يعمل داخل القسم الحالي فقط."
      />
    </SidebarFeedPanel>
  );
}
