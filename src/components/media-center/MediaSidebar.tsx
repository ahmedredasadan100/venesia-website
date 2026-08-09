"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { usePublicNavigation } from "../PublicNavigationProvider";
import type { MediaSidebarItem } from "../../lib/media-center/types";
import type { MediaSidebarModulesState, MediaSidebarWidgetState } from "../../lib/media-sidebar-modules/types";

function SidebarPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.25em] text-[#D8B87A]/70">
          {eyebrow}
        </p>
      ) : null}

      <h3
        className={
          eyebrow
            ? "mt-3 text-lg font-semibold text-white"
            : "text-lg font-semibold text-white"
        }
      >
        {title}
      </h3>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function SidebarMediaList({
  items,
  showLabel,
}: {
  items: MediaSidebarItem[];
  showLabel?: boolean;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.title}`}
          href={item.href}
          className="group flex gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0"
        >
          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={item.image}
              alt={item.title}
              fill
              sizes="80px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/45 to-transparent" />
          </div>

          <div className="min-w-0">
            {showLabel && item.label ? (
              <p className="mb-1 text-[11px] text-[#D8B87A]/75">
                {item.label}
              </p>
            ) : null}

            {showLabel && item.seriesLabel ? (
              <p className="mb-1 text-[11px] text-[#D8B87A]/75">
                {item.seriesLabel}
              </p>
            ) : null}

            <h4 className="line-clamp-2 text-sm leading-6 text-white/70 transition group-hover:text-[#D8B87A]">
              {item.title}
            </h4>

            {item.date ? <p className="mt-1 text-xs text-white/35">{item.date}</p> : null}
          </div>
        </Link>
      ))}
    </div>
  );
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

type MediaSidebarProps = {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  sidebarModules: MediaSidebarModulesState;
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
      return (
        <SidebarPanel key={`latest-${widget.assignmentId}`} title="أحدث الأخبار">
          <SidebarMediaList items={widget.items ?? []} />
        </SidebarPanel>
      );
    case "popular":
      return (
        <SidebarPanel key={`popular-${widget.assignmentId}`} title="الأكثر قراءة">
          <SidebarMediaList items={widget.items ?? []} showLabel />
        </SidebarPanel>
      );
    default:
      return null;
  }
}

export default function MediaSidebar({
  searchQuery = "",
  onSearchChange,
  sidebarModules,
}: MediaSidebarProps) {
  const pathname = usePathname();
  const navItems = usePublicNavigation();
  const hasSearchValue = searchQuery.trim().length > 0;

  const visibleWidgets = useMemo(
    () =>
      [...sidebarModules.widgets]
        .filter((widget) => widget.isVisible)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.widgetKey.localeCompare(right.widgetKey)),
    [sidebarModules.widgets],
  );

  return (
    <aside className="space-y-6 text-right" dir="rtl">
      <SidebarPanel eyebrow="Search" title="ابحث في المركز الإعلامي">
        <div className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="اكتب كلمة البحث..."
            aria-label="ابحث داخل القسم الحالي من المركز الإعلامي"
            className="w-full rounded-full border border-white/10 bg-black/20 py-3 pl-12 pr-5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#D8B87A]/45 focus:bg-black/30 focus:ring-2 focus:ring-[#D8B87A]/10"
          />

          {hasSearchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/45 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A]"
            >
              ×
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-6 text-white/35">
          البحث يعمل داخل القسم الحالي فقط.
        </p>
      </SidebarPanel>

      {visibleWidgets.map((widget) =>
        renderWidgetPanel(widget, {
          navItems,
          pathname,
        }),
      )}
    </aside>
  );
}
