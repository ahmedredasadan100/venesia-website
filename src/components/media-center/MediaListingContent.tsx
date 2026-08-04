"use client";

import { ReactNode } from "react";
import Link from "next/link";
import Pagination from "../Pagination";
import MediaContentCard from "./MediaContentCard";
import { useMediaSearch } from "./MediaPageShell";
import type { MediaContentItem } from "../../lib/media-center/types";

type MediaListingContentProps = {
  /** Current server-paginated page items (browse mode). */
  items: MediaContentItem[];
  /** Lean full-type catalog for client search only (no body content). */
  searchCatalog: MediaContentItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  sort: "newest" | "oldest";
  basePath: string;
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  itemsLabel?: string;
  children?: ReactNode;
};

function normalizeSearchValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function itemMatchesSearch(item: MediaContentItem, query: string) {
  if (!query) return true;

  const searchableItem = item as MediaContentItem & Record<string, unknown>;

  const searchableText = [
    searchableItem.title,
    searchableItem.category,
    searchableItem.date,
    searchableItem.publishedAt,
    searchableItem.slug,
    searchableItem.excerpt,
    searchableItem.description,
    searchableItem.summary,
    searchableItem.label,
  ]
    .map(normalizeSearchValue)
    .join(" ");

  return searchableText.includes(query);
}

export default function MediaListingContent({
  items,
  searchCatalog,
  currentPage,
  totalPages,
  totalCount,
  sort,
  basePath,
  title,
  eyebrow,
  description,
  emptyTitle,
  emptyDescription,
  actionLabel,
  itemsLabel = "عناصر",
  children,
}: MediaListingContentProps) {
  const { searchQuery } = useMediaSearch();
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const isSearching = normalizedSearchQuery.length > 0;

  const searchResults = isSearching
    ? [...searchCatalog]
        .filter((item) => itemMatchesSearch(item, normalizedSearchQuery))
        .sort((a, b) => {
          const aTime = new Date(a.publishedAt).getTime();
          const bTime = new Date(b.publishedAt).getTime();
          return sort === "oldest" ? aTime - bTime : bTime - aTime;
        })
    : [];

  const visibleItems = isSearching ? searchResults : items;
  const hasItems = visibleItems.length > 0;
  const countLabel = isSearching ? "نتائج البحث" : itemsLabel;
  const displayTotal = isSearching ? searchResults.length : totalCount;
  const safePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
          {eyebrow}
        </p>

        <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
          {title}
        </h1>

        <p className="mt-4 max-w-3xl leading-8 text-white/60">
          {description}
        </p>
      </div>

      {!isSearching ? children : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4">
        <p className="text-sm text-white/55">
          عرض {visibleItems.length} من {displayTotal} {countLabel}
        </p>

        {isSearching ? (
          <p className="text-sm text-[#D8B87A]/75">
            البحث عن: {searchQuery.trim()}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={basePath}
              scroll={false}
              className={[
                "rounded-full border px-4 py-2 text-sm transition",
                sort === "newest"
                  ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                  : "border-white/10 text-white/60 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
              ].join(" ")}
            >
              الأحدث
            </Link>

            <Link
              href={`${basePath}?sort=oldest`}
              scroll={false}
              className={[
                "rounded-full border px-4 py-2 text-sm transition",
                sort === "oldest"
                  ? "border-[#D8B87A]/45 bg-[#D8B87A]/10 text-[#D8B87A]"
                  : "border-white/10 text-white/60 hover:border-[#D8B87A]/35 hover:text-[#D8B87A]",
              ].join(" ")}
            >
              الأقدم
            </Link>
          </div>
        )}
      </div>

      {hasItems ? (
        <>
          <div className="grid gap-8 md:grid-cols-2">
            {visibleItems.map((item) => (
              <MediaContentCard
                key={item.id}
                item={item}
                actionLabel={actionLabel}
              />
            ))}
          </div>

          {!isSearching ? (
            <Pagination
              currentPage={safePage}
              totalPages={Math.max(totalPages, 1)}
              basePath={basePath}
              query={{ sort: sort === "oldest" ? "oldest" : undefined }}
            />
          ) : null}
        </>
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
            {isSearching ? "Search Results" : "Empty State"}
          </p>

          <h2 className="mt-4 text-2xl font-semibold text-white">
            {isSearching ? "لا توجد نتائج مطابقة" : emptyTitle}
          </h2>

          <p className="mx-auto mt-4 max-w-xl leading-8 text-white/55">
            {isSearching
              ? "جرّب كلمة بحث مختلفة داخل هذا القسم."
              : emptyDescription}
          </p>
        </div>
      )}
    </div>
  );
}
