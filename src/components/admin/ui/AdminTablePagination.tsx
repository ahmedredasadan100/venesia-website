"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

export const ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE = "10";
export const ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS = ["10", "20", "30"] as const;

const PAGINATION_MENU_ATTR = "data-admin-table-pagination-menu";

const FOOTER_SURFACE_CLASSES =
  "border border-[#D8B87A]/14 bg-[linear-gradient(135deg,rgba(216,184,122,0.10),rgba(56,189,248,0.06),rgba(255,255,255,0.025))] text-[#F4E7C5] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

const MENU_SCROLLBAR_CLASSES =
  "max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.24)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30";

type MenuPosition = {
  bottom: number;
  left: number;
  width: number;
};

const MENU_GAP = 6;

export type PageSizeSelectorMode = "auto" | "always" | "never";

export type AdminTablePaginationProps = {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize: string;
  pageSizeOptions?: readonly string[];
  defaultPageSize?: string;
  pageSizeSelectorMode?: PageSizeSelectorMode;
  forceShowSummary?: boolean;
  emptySummaryText?: string;
  pageParamName?: string;
  limitParamName?: string;
  className?: string;
};

function getMinPageSize(pageSizeOptions: readonly string[]) {
  const values = pageSizeOptions.map((option) => Number(option)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? Math.min(...values) : Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function useFixedDropupPosition(isOpen: boolean, anchorRef: React.RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();

      setPosition({
        bottom: window.innerHeight - rect.top + MENU_GAP,
        left: rect.left,
        width: Math.max(rect.width, 132),
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, anchorRef]);

  return position;
}

export function buildAdminPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 2);
  const end = Math.min(totalPages - 1, currentPage + 2);

  if (start > 2) {
    pages.push("ellipsis");
  } else {
    for (let page = 2; page < start; page++) pages.push(page);
  }

  for (let page = start; page <= end; page++) pages.push(page);

  if (end < totalPages - 1) {
    pages.push("ellipsis");
  } else {
    for (let page = end + 1; page < totalPages; page++) pages.push(page);
  }

  pages.push(totalPages);
  return pages;
}

export function buildAdminPaginationHref(
  basePath: string,
  params: URLSearchParams,
  patch: Record<string, string | null>,
) {
  const next = new URLSearchParams(params.toString());

  Object.entries(patch).forEach(([key, value]) => {
    if (!value) next.delete(key);
    else next.set(key, value);
  });

  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export default function AdminTablePagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  pageSize,
  pageSizeOptions = ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize = ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  pageSizeSelectorMode = "auto",
  forceShowSummary = false,
  emptySummaryText = "لا توجد نتائج مطابقة",
  pageParamName = "page",
  limitParamName = "limit",
  className = "",
}: AdminTablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const limitTriggerId = useId();
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuPosition = useFixedDropupPosition(isLimitOpen, triggerRef);
  const paginationItems = buildAdminPaginationItems(currentPage, totalPages);
  const minPageSize = getMinPageSize(pageSizeOptions);
  const shouldShowPageSizeSelector =
    pageSizeSelectorMode === "always"
      ? true
      : pageSizeSelectorMode === "never"
        ? false
        : totalCount > minPageSize;
  const shouldShowFooter = forceShowSummary || totalCount > minPageSize || totalPages > 1;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const element = target instanceof Element ? target : target.parentElement;
      if (!element) return;
      if (element.closest(`[${PAGINATION_MENU_ATTR}]`) || triggerRef.current?.contains(target)) return;
      setIsLimitOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function applyLimit(nextLimit: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextLimit === defaultPageSize) params.delete(limitParamName);
    else params.set(limitParamName, nextLimit);

    params.delete(pageParamName);

    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    setIsLimitOpen(false);
  }

  const summaryText =
    totalCount === 0
      ? emptySummaryText
      : `عرض ${rangeStart} إلى ${rangeEnd} من إجمالي ${totalCount}`;

  const limitMenu =
    shouldShowPageSizeSelector &&
    isMounted &&
    isLimitOpen &&
    menuPosition &&
    createPortal(
      <div
        {...{ [PAGINATION_MENU_ATTR]: "" }}
        role="listbox"
        aria-labelledby={limitTriggerId}
        dir="rtl"
        style={{
          position: "fixed",
          bottom: menuPosition.bottom,
          left: menuPosition.left,
          width: menuPosition.width,
          zIndex: 9999,
        }}
        className={`${MENU_SCROLLBAR_CLASSES} rounded-[12px] border border-[#D8B87A]/22 bg-[#080B10]/96 p-1 shadow-[0_-14px_45px_rgba(0,0,0,0.38),0_18px_55px_rgba(0,0,0,0.42)] backdrop-blur-xl`}
      >
        {pageSizeOptions.map((option) => {
          const selected = pageSize === option;

          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => applyLimit(option)}
              className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-right text-sm transition ${
                selected
                  ? "bg-[#D8B87A]/14 font-semibold text-[#F4E7C5]"
                  : "text-white/72 hover:bg-white/[0.05] hover:text-[#F4E7C5]"
              }`}
            >
              <span>{option}</span>
              {selected ? <span className="text-[11px] text-[#D8B87A]/80">✓</span> : null}
            </button>
          );
        })}
      </div>,
      document.body,
    );

  const prevHref =
    currentPage > 1
      ? buildAdminPaginationHref(basePath, new URLSearchParams(searchParams.toString()), {
          [pageParamName]: currentPage - 1 <= 1 ? null : String(currentPage - 1),
        })
      : null;
  const nextHref =
    currentPage < totalPages
      ? buildAdminPaginationHref(basePath, new URLSearchParams(searchParams.toString()), {
          [pageParamName]: String(currentPage + 1),
        })
      : null;

  if (!shouldShowFooter) return null;

  return (
    <div className={`mt-4 rounded-[14px] px-4 py-3.5 ${FOOTER_SURFACE_CLASSES} ${className}`.trim()}>
      <div
        dir="ltr"
        className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-3"
      >
        {shouldShowPageSizeSelector ? (
          <div dir="rtl" className="flex items-center justify-center gap-2 md:justify-self-start">
            <span className="text-xs font-medium text-[#F4E7C5]/55">عدد العناصر:</span>
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                id={limitTriggerId}
                aria-haspopup="listbox"
                aria-expanded={isLimitOpen}
                onClick={() => setIsLimitOpen((open) => !open)}
                className={`flex h-9 min-w-[72px] items-center justify-between gap-2 rounded-[10px] border px-3 text-sm font-semibold transition ${
                  isLimitOpen
                    ? "border-[#D8B87A]/35 bg-black/30 text-[#F4E7C5]"
                    : "border-[#D8B87A]/16 bg-black/22 text-[#F4E7C5]/90 hover:border-[#D8B87A]/28 hover:bg-black/28"
                }`}
              >
                <span>{pageSize}</span>
                <span className={`text-[#F4E7C5]/45 transition ${isLimitOpen ? "" : "rotate-180"}`}>
                  <ChevronDownIcon />
                </span>
              </button>
              {limitMenu}
            </div>
          </div>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        {totalPages > 1 ? (
          <nav
            className="flex flex-wrap items-center justify-center gap-1.5 md:justify-self-center"
            aria-label="ترقيم الصفحات"
          >
            {prevHref ? (
              <Link
                href={prevHref}
                scroll={false}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#D8B87A]/14 bg-black/20 px-3 text-sm text-[#F4E7C5]/72 transition hover:border-[#D8B87A]/28 hover:bg-black/28 hover:text-[#F4E7C5]"
              >
                السابق
              </Link>
            ) : (
              <span className="inline-flex h-9 cursor-not-allowed items-center rounded-[10px] border border-white/[0.06] bg-black/10 px-3 text-sm text-white/28">
                السابق
              </span>
            )}

            {paginationItems.map((item, index) => {
              if (item === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    aria-hidden="true"
                    className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm text-[#F4E7C5]/38"
                  >
                    …
                  </span>
                );
              }

              const isActive = item === currentPage;
              const href = buildAdminPaginationHref(basePath, new URLSearchParams(searchParams.toString()), {
                [pageParamName]: item <= 1 ? null : String(item),
              });

              return (
                <Link
                  key={item}
                  href={href}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] border px-2.5 text-sm font-semibold transition ${
                    isActive
                      ? "border-[#D8B87A]/35 bg-[#D8B87A]/18 text-[#F4E7C5] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "border-[#D8B87A]/12 bg-black/18 text-[#F4E7C5]/65 hover:border-[#D8B87A]/24 hover:bg-black/24 hover:text-[#F4E7C5]"
                  }`}
                >
                  {item}
                </Link>
              );
            })}

            {nextHref ? (
              <Link
                href={nextHref}
                scroll={false}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#D8B87A]/14 bg-black/20 px-3 text-sm text-[#F4E7C5]/72 transition hover:border-[#D8B87A]/28 hover:bg-black/28 hover:text-[#F4E7C5]"
              >
                التالي
              </Link>
            ) : (
              <span className="inline-flex h-9 cursor-not-allowed items-center rounded-[10px] border border-white/[0.06] bg-black/10 px-3 text-sm text-white/28">
                التالي
              </span>
            )}
          </nav>
        ) : (
          <div className="hidden md:block" aria-hidden="true" />
        )}

        <p dir="rtl" className="text-center text-sm font-medium text-[#F4E7C5]/88 md:justify-self-end md:text-right">
          {summaryText}
        </p>
      </div>
    </div>
  );
}
