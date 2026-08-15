export type PaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; position: "start" | "end" };

const MAX_VISIBLE_PAGE_ITEMS = 7;

function pageItem(page: number): PaginationItem {
  return { type: "page", page };
}

export function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const safeCurrentPage = Math.min(
    Math.max(1, Math.floor(currentPage)),
    safeTotalPages,
  );

  if (safeTotalPages <= MAX_VISIBLE_PAGE_ITEMS) {
    return Array.from({ length: safeTotalPages }, (_, index) => pageItem(index + 1));
  }

  if (safeCurrentPage <= 4) {
    return [
      ...Array.from({ length: 5 }, (_, index) => pageItem(index + 1)),
      { type: "ellipsis", position: "end" },
      pageItem(safeTotalPages),
    ];
  }

  if (safeCurrentPage >= safeTotalPages - 3) {
    return [
      pageItem(1),
      { type: "ellipsis", position: "start" },
      ...Array.from({ length: 5 }, (_, index) =>
        pageItem(safeTotalPages - 4 + index),
      ),
    ];
  }

  return [
    pageItem(1),
    { type: "ellipsis", position: "start" },
    pageItem(safeCurrentPage - 1),
    pageItem(safeCurrentPage),
    pageItem(safeCurrentPage + 1),
    { type: "ellipsis", position: "end" },
    pageItem(safeTotalPages),
  ];
}
