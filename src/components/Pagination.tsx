"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import {
  buildPublicPaginationHref,
  buildPublicPaginationItems,
  type PublicPaginationContract,
} from "./pagination-model";

/**
 * The single Public Pagination presentation contract.
 *
 * URL-driven consumers render through this file. Public consumers that retain
 * domain-local page state may reuse these presentation helpers without moving
 * their state or navigation behavior into the Platform owner.
 */
export const PUBLIC_PAGINATION_PRESENTATION = Object.freeze({
  root: "mt-8 flex w-full flex-wrap items-center justify-center gap-2",
  navigationControl:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070B] motion-reduce:transition-none",
  navigationInteractive:
    "border-white/10 bg-transparent text-white/60 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
  navigationDisabled:
    "cursor-not-allowed border-white/10 bg-transparent text-white/60 opacity-35",
  pageControl:
    "inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border px-3 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070B] motion-reduce:transition-none",
  pageActive:
    "border-[#D8B87A] bg-[#D8B87A] text-[#111]",
  pageInteractive:
    "border-white/10 bg-transparent text-white/55 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
  ellipsis:
    "inline-flex h-10 min-w-6 shrink-0 select-none items-center justify-center text-sm font-medium leading-none text-white/40 sm:min-w-8",
});

export function getPublicPaginationNavigationClassName(disabled: boolean) {
  return `${PUBLIC_PAGINATION_PRESENTATION.navigationControl} ${
    disabled
      ? PUBLIC_PAGINATION_PRESENTATION.navigationDisabled
      : PUBLIC_PAGINATION_PRESENTATION.navigationInteractive
  }`;
}

export function getPublicPaginationPageClassName(isActive: boolean) {
  return `${PUBLIC_PAGINATION_PRESENTATION.pageControl} ${
    isActive
      ? PUBLIC_PAGINATION_PRESENTATION.pageActive
      : PUBLIC_PAGINATION_PRESENTATION.pageInteractive
  }`;
}

/**
 * Canonical Public Pagination UI and URL-navigation owner.
 *
 * Page data, totals, filtering, search, and Listing presentation remain owned
 * by the supplying consumer and its read/presentation contracts.
 */
export default function PublicPagination({
  currentPage,
  totalPages,
  basePath,
  query,
  pageParam = "page",
  previousLabel = "السابق",
  nextLabel = "التالي",
  ariaLabel = "Pagination",
}: PublicPaginationContract) {
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

  const paginationItems = buildPublicPaginationItems(
    safeCurrentPage,
    totalPages,
  );

  return (
    <nav
      ref={navigationRef}
      aria-label={ariaLabel}
      dir="rtl"
      className={PUBLIC_PAGINATION_PRESENTATION.root}
    >
      {safeCurrentPage === 1 ? (
        <span
          aria-disabled="true"
          className={getPublicPaginationNavigationClassName(true)}
        >
          {previousLabel}
        </span>
      ) : (
        <Link
          href={buildPublicPaginationHref(
            basePath,
            previousPage,
            query,
            pageParam,
          )}
          scroll={false}
          onNavigate={retainViewportPosition}
          className={getPublicPaginationNavigationClassName(false)}
        >
          {previousLabel}
        </Link>
      )}

      {paginationItems.map((item) => {
        if (item.type === "ellipsis") {
          return (
            <span
              key={`ellipsis-${item.position}`}
              aria-hidden="true"
              className={PUBLIC_PAGINATION_PRESENTATION.ellipsis}
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
            href={buildPublicPaginationHref(
              basePath,
              page,
              query,
              pageParam,
            )}
            scroll={false}
            onNavigate={retainViewportPosition}
            aria-current={isActive ? "page" : undefined}
            className={getPublicPaginationPageClassName(isActive)}
          >
            {page}
          </Link>
        );
      })}

      {safeCurrentPage === totalPages ? (
        <span
          aria-disabled="true"
          className={getPublicPaginationNavigationClassName(true)}
        >
          {nextLabel}
        </span>
      ) : (
        <Link
          href={buildPublicPaginationHref(
            basePath,
            nextPage,
            query,
            pageParam,
          )}
          scroll={false}
          onNavigate={retainViewportPosition}
          className={getPublicPaginationNavigationClassName(false)}
        >
          {nextLabel}
        </Link>
      )}
    </nav>
  );
}
