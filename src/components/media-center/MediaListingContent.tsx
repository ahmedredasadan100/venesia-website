import Link from "next/link";
import Pagination from "../Pagination";
import { CollectionListingPresentation } from "../collection-modules/CollectionListingPresenter";
import MediaContentCard from "./MediaContentCard";
import type { MediaContentItem } from "../../lib/media-center/types";
import type {
  MediaListingColumns,
  MediaListingLayout,
} from "../../lib/media-hub-modules/parse-config";
import type { CollectionListingItemLimit } from "../../lib/collection-modules/item-limit";
import type { CollectionDisplayOverrides } from "../../lib/page-blocks/configs";

type MediaListingContentProps = {
  items: MediaContentItem[];
  searchQuery?: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  sort: "newest" | "oldest";
  basePath: string;
  emptyTitle: string;
  emptyDescription: string;
  itemsLabel?: string;
  presentation: MediaListingLayout;
  itemsPerRow: MediaListingColumns;
  itemLimit: CollectionListingItemLimit;
  displayOverrides: CollectionDisplayOverrides;
};

export default function MediaListingContent({
  items,
  searchQuery = "",
  currentPage,
  totalPages,
  totalCount,
  sort,
  basePath,
  emptyTitle,
  emptyDescription,
  itemsLabel = "عناصر",
  presentation,
  itemsPerRow,
  itemLimit,
  displayOverrides,
}: MediaListingContentProps) {
  const isSearching = searchQuery.length > 0;
  const hasItems = items.length > 0;
  const countLabel = isSearching ? "نتائج البحث" : itemsLabel;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4">
        <p className="text-sm text-white/55">
          عرض {items.length} من {totalCount} {countLabel}
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
          <CollectionListingPresentation
            items={items}
            itemLimit={itemLimit}
            presentation={presentation}
            itemsPerRow={itemsPerRow}
            keyForItem={(item) => item.id}
            renderItem={(item) => (
              <MediaContentCard
                item={item}
                displayOverrides={displayOverrides}
              />
            )}
          />

          {!isSearching ? (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
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
