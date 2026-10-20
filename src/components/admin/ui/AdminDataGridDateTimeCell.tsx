"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatAdminDateTime } from "../../../lib/content-dates";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

type Interval = { left: number; right: number };

/** Grid geometry only: use the visible cell area, excluding pinned controls. */
export function resolveAdminDataGridDateTimeLayout({
  content,
  viewport,
  obstacles,
  fullWidth,
}: {
  content: Interval;
  viewport: Interval;
  obstacles: Interval[];
  fullWidth: number;
}) {
  let gaps = [{ left: Math.max(content.left, viewport.left), right: Math.min(content.right, viewport.right) }]
    .filter((gap) => gap.right > gap.left);
  for (const obstacle of obstacles) {
    gaps = gaps.flatMap((gap) => {
      if (obstacle.right <= gap.left || obstacle.left >= gap.right) return [gap];
      return [
        { left: gap.left, right: Math.min(gap.right, obstacle.left) },
        { left: Math.max(gap.left, obstacle.right), right: gap.right },
      ].filter((part) => part.right > part.left);
    });
  }
  const gap = gaps.sort((a, b) => (b.right - b.left) - (a.right - a.left))[0];
  if (!gap) return null; // An offscreen column remains in the horizontal scroll flow.
  const width = gap.right - gap.left;
  return { compact: fullWidth > width, offset: gap.left - content.left, width };
}

type Props = {
  value?: string | null;
  className?: string;
  fallback?: ReactNode;
  fallbackTitle?: string;
};

/** Internal client presentation of the existing AdminDataGrid cell family. */
export default function AdminDataGridDateTimeCell({ value, className = "", fallback = "—", fallbackTitle }: Props) {
  const fullValue = formatAdminDateTime(value);
  const dateValue = formatAdminDateTime(value, "date");
  const isTimestamp = fullValue !== dateValue;
  const rootRef = useRef<HTMLSpanElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const revealRef = useRef<(() => void) | null>(null);
  const focusFrameRef = useRef(0);
  const [layout, setLayout] = useState<ReturnType<typeof resolveAdminDataGridDateTimeLayout>>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tooltipId = useId();
  const isOpen = isTimestamp && (focused || hovered) && !dismissed;
  const position = useAdminFloatingMenuPosition(isOpen, anchorRef, {
    minWidth: 210,
    collisionPadding: 8,
    estimatedHeight: 40,
    floatingRef: tooltipRef,
  });

  useLayoutEffect(() => {
    if (!isTimestamp) return;
    const root = rootRef.current;
    const full = fullRef.current;
    if (!root || !full) return;
    const scrollport = root.closest<HTMLElement>("[data-admin-data-grid-scroll]");
    const cell = root.closest<HTMLElement>("td") ?? root.parentElement;
    const row = cell?.closest<HTMLElement>("tr") ?? cell?.parentElement;
    let frame = 0;
    function measure() {
      if (!root || !full) return;
      const content = root.getBoundingClientRect();
      const viewportBox = scrollport?.getBoundingClientRect();
      const viewportStyle = scrollport ? window.getComputedStyle(scrollport) : null;
      const viewport = viewportBox ? {
        left: viewportBox.left + Number.parseFloat(viewportStyle?.borderLeftWidth ?? "0"),
        right: viewportBox.right - Number.parseFloat(viewportStyle?.borderRightWidth ?? "0"),
      } : { left: 0, right: document.documentElement.clientWidth };
      const obstacles = Array.from(row?.children ?? []).flatMap((element) => {
        if (element.contains(root) || window.getComputedStyle(element).position !== "sticky") return [];
        const box = element.getBoundingClientRect();
        return box.bottom > content.top && box.top < content.bottom ? [{ left: box.left, right: box.right }] : [];
      });
      return { content, viewport, obstacles, fullWidth: full.getBoundingClientRect().width };
    }
    function update() {
      frame = 0;
      const geometry = measure();
      if (!geometry) return;
      const next = resolveAdminDataGridDateTimeLayout(geometry) ?? {
        compact: geometry.fullWidth > geometry.content.width,
        offset: 0,
        width: geometry.content.width,
      };
      setLayout((current) => current?.compact === next?.compact && current?.offset === next?.offset && current?.width === next?.width ? current : next);
    }
    revealRef.current = () => {
      const geometry = measure();
      const anchor = anchorRef.current;
      if (!geometry || !anchor || !scrollport) return;
      const band = resolveAdminDataGridDateTimeLayout({ ...geometry, content: geometry.viewport, fullWidth: 0 });
      if (!band) return;
      const left = geometry.viewport.left + band.offset;
      const right = left + band.width;
      const target = anchor.getBoundingClientRect();
      if (target.left >= left && target.right <= right && target.width <= geometry.content.width) return;
      // Keyboard focus must clear pinned controls, just as it clears the scrollport edge.
      scrollport.scrollBy({ left: (geometry.content.left + geometry.content.right - left - right) / 2, behavior: "instant" });
      update();
    };
    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }
    update();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(root);
    observer.observe(full);
    if (scrollport) observer.observe(scrollport);
    scrollport?.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(focusFrameRef.current);
      revealRef.current = null;
      observer.disconnect();
      scrollport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [isTimestamp, fullValue]);

  if (!isTimestamp) {
    return <span className={className} title={fallbackTitle}>{fullValue === "—" ? fallback : fullValue}</span>;
  }

  return (
    <span ref={rootRef} dir="ltr" data-admin-date-time="" data-presentation={layout?.compact ? "date" : "date-time"} className={`relative block w-full min-w-0 text-center ${className}`}>
      <span ref={fullRef} aria-hidden="true" className="pointer-events-none invisible absolute start-0 top-0 w-max whitespace-nowrap">{fullValue}</span>
      <span className="relative block" style={layout ? { left: layout.offset, width: layout.width } : undefined}>
        <button
          ref={anchorRef}
          type="button"
          aria-label={fullValue}
          aria-describedby={isOpen ? tooltipId : undefined}
          className="max-w-full cursor-help whitespace-nowrap rounded-sm text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#D8B87A]/70"
          onFocus={() => {
            // Run after the browser's own focus-scroll, which does not account for sticky cells.
            window.cancelAnimationFrame(focusFrameRef.current);
            focusFrameRef.current = window.requestAnimationFrame(() => revealRef.current?.());
            setFocused(true);
            setDismissed(false);
          }}
          onBlur={() => setFocused(false)}
          onMouseEnter={() => { setHovered(true); setDismissed(false); }}
          onMouseLeave={() => setHovered(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && isOpen) {
              event.preventDefault();
              event.stopPropagation();
              setDismissed(true);
            }
          }}
        >
          <span data-admin-date-visible="">{layout?.compact ? dateValue : fullValue}</span>
        </button>
      </span>
      {isOpen && position ? createPortal(
        <span ref={tooltipRef} id={tooltipId} role="tooltip" dir="ltr" style={position.style} className="pointer-events-none rounded-lg border border-[#D8B87A]/30 bg-[#10151C] px-3 py-2 text-center font-en text-xs tabular-nums text-white shadow-xl">
          {fullValue}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}
