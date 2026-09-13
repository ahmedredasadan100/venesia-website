"use client";

import { useLayoutEffect, useRef } from "react";

const CONTROL_SELECTOR =
  "thead, button, a[href], input, select, textarea, summary, [role=button], [role=checkbox], [contenteditable=true]";
const EDGE_GAP = 6;
const CONTROL_GAP = 1;

/** Internal Grid presentation only; query state and data remain with its caller. */
export default function AdminDataGridQueryStatus() {
  const statusRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const status = statusRef.current;
    const indicator = indicatorRef.current;
    const grid = status?.closest<HTMLElement>("[data-admin-data-grid-surface]");
    if (!status || !indicator || !grid) return;
    let frame = 0;

    function updatePosition() {
      frame = 0;
      if (!status || !indicator || !grid) return;
      const rect = grid.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = Math.max(rect.left, viewport?.offsetLeft ?? 0) + EDGE_GAP;
      const right = Math.min(rect.right,
        (viewport?.offsetLeft ?? 0) + (viewport?.width ?? document.documentElement.clientWidth)) - EDGE_GAP;
      const top = Math.max(rect.top, viewport?.offsetTop ?? 0) + EDGE_GAP;
      const bottom = Math.min(rect.bottom,
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) - EDGE_GAP;
      indicator.style.maxWidth = `${Math.max(0, right - left)}px`;
      const { width, height } = indicator.getBoundingClientRect();
      const hide = () => {
        indicator.style.visibility = "hidden";
        status.dataset.placement = "outside";
      };
      if (!width || !height || right - left < width || bottom - top < height) {
        hide();
        return;
      }

      const controls = Array.from(grid.querySelectorAll<HTMLElement>(CONTROL_SELECTOR))
        .flatMap((control) => Array.from(control.getClientRects()))
        .filter((box) => box.width && box.height && box.bottom > top && box.top < bottom);
      // Row boundaries use the existing cell padding, avoiding the action rail.
      const rowEdges = Array.from(grid.querySelectorAll("tbody tr, [data-entity-row-id]"))
        .flatMap((row) => {
          const box = row.getBoundingClientRect();
          return [box.top, box.bottom];
        });
      const centerY = (top + bottom) / 2;
      const candidates = [...new Set(rowEdges)]
        .filter((y) => y - height / 2 >= top && y + height / 2 <= bottom)
        .sort((a, b) => Math.abs(a - centerY) - Math.abs(b - centerY));
      candidates.push(centerY, top + height / 2, bottom - height / 2);

      for (const center of candidates) {
        const y = center - height / 2;
        const occupied = controls
          .filter((box) => box.bottom + CONTROL_GAP > y && box.top - CONTROL_GAP < y + height)
          .map((box) => [Math.max(left, box.left - CONTROL_GAP), Math.min(right, box.right + CONTROL_GAP)])
          .filter(([start, end]) => end > start)
          .sort((a, b) => a[0] - b[0]);
        const gaps: Array<[number, number]> = [];
        let cursor = left;
        for (const [start, end] of occupied) {
          if (start > cursor) gaps.push([cursor, start]);
          cursor = Math.max(cursor, end);
        }
        if (cursor < right) gaps.push([cursor, right]);
        const positions = gaps
          .filter(([start, end]) => end - start >= width)
          .map(([start, end]) => Math.max(start, Math.min((left + right - width) / 2, end - width)))
          .sort((a, b) => Math.abs(a + width / 2 - (left + right) / 2) - Math.abs(b + width / 2 - (left + right) / 2));

        for (const x of positions) {
          // A sticky shell header or an open portal must not be covered either.
          const unobscured = [x + 1, x + width / 2, x + width - 1].every((sampleX) =>
            [y + 1, y + height / 2, y + height - 1].every((sampleY) => {
              const target = document.elementFromPoint(sampleX, sampleY);
              return target !== null && grid.contains(target);
            }),
          );
          if (!unobscured) continue;
          status.style.left = `${x - rect.left - grid.clientLeft}px`;
          status.style.top = `${y - rect.top - grid.clientTop}px`;
          indicator.style.visibility = "visible";
          status.dataset.placement = "visible";
          return;
        }
      }
      // Never cover a control just to display a visual fallback.
      hide();
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updatePosition);
    }

    updatePosition();
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(grid);
    observer.observe(indicator);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <div
      ref={statusRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      dir="rtl"
      data-admin-data-grid-query-status=""
      className="pointer-events-none absolute left-0 top-0 z-40 w-max max-w-full"
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        data-admin-data-grid-query-indicator=""
        className="flex w-max max-w-full items-center gap-2 rounded-full border border-[#D8B87A]/40 bg-[#11151B] px-3 py-1 text-xs font-semibold leading-5 text-[#F4E7C5] shadow-lg"
        style={{ visibility: "hidden" }}
      >
        <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-[#D8B87A]/30 border-t-[#D8B87A] motion-reduce:animate-none" />
        جارٍ التحديث… الصفوف والعدّادات سابقة
      </span>
      <span className="sr-only">جارٍ تحديث النتائج… الصفوف والعدّادات المعروضة تخص النتائج السابقة.</span>
    </div>
  );
}
