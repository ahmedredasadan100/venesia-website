"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { buildPaginationItems } from "./pagination-model";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | number | undefined>;
};

function buildHref(
  basePath: string,
  page: number,
  query?: Record<string, string | number | undefined>
) {
  const params = new URLSearchParams();

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    });
  }

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const queryString = params.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

export default function Pagination({
  currentPage,
  totalPages,
  basePath,
  query,
}: PaginationProps) {
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const navigationRef = useRef<HTMLElement>(null);
  const previousPageRef = useRef(safeCurrentPage);
  const retainedViewportTopRef = useRef<number | null>(null);

  function retainViewportPosition() {
    retainedViewportTopRef.current =
      navigationRef.current?.getBoundingClientRect().top ?? null;
  }

  useLayoutEffect(() => {
    if (previousPageRef.current === safeCurrentPage) return;
    previousPageRef.current = safeCurrentPage;

    const retainedViewportTop = retainedViewportTopRef.current;
    retainedViewportTopRef.current = null;
    const currentViewportTop = navigationRef.current?.getBoundingClientRect().top;
    if (retainedViewportTop === null || currentViewportTop === undefined) return;

    const delta = currentViewportTop - retainedViewportTop;
    if (Math.abs(delta) < 1) return;

    window.scrollBy(0, delta);
  }, [safeCurrentPage]);

  if (totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(safeCurrentPage - 1, 1);
  const nextPage = Math.min(safeCurrentPage + 1, totalPages);

  const paginationItems = buildPaginationItems(safeCurrentPage, totalPages);

  return (
    <nav
      ref={navigationRef}
      aria-label="Pagination"
      dir="rtl"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {safeCurrentPage === 1 ? (
        <span className="rounded-full border border-white/5 px-4 py-2 text-sm text-white/25">
          السابق
        </span>
      ) : (
        <Link
          href={buildHref(basePath, previousPage, query)}
          scroll={false}
          onNavigate={retainViewportPosition}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
        >
          السابق
        </Link>
      )}

      {paginationItems.map((item) => {
        if (item.type === "ellipsis") {
          return (
            <span
              key={`ellipsis-${item.position}`}
              aria-hidden="true"
              className="flex h-10 min-w-8 items-center justify-center text-sm text-white/40"
            >
              &hellip;
            </span>
          );
        }

        const page = item.page;
        const isActive = page === safeCurrentPage;

        return (
          <Link
            key={page}
            href={buildHref(basePath, page, query)}
            scroll={false}
            onNavigate={retainViewportPosition}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm transition ${
              isActive
                ? "border-[#D8B87A]/50 bg-[#D8B87A]/10 text-[#D8B87A]"
                : "border-white/10 text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
            }`}
          >
            {page}
          </Link>
        );
      })}

      {safeCurrentPage === totalPages ? (
        <span className="rounded-full border border-white/5 px-4 py-2 text-sm text-white/25">
          التالي
        </span>
      ) : (
        <Link
          href={buildHref(basePath, nextPage, query)}
          scroll={false}
          onNavigate={retainViewportPosition}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
        >
          التالي
        </Link>
      )}
    </nav>
  );
}
