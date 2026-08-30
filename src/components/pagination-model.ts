/**
 * Public Pagination is a small Platform UI owner. Consumers supply resolved
 * page truth; the owner only renders page navigation, builds its bounded page
 * window, and produces URL destinations.
 */
export type PublicPaginationQueryValue = string | number | undefined;

export type PublicPaginationQuery = Readonly<
  Record<string, PublicPaginationQueryValue>
>;

export type PublicPaginationContract = Readonly<{
  currentPage: number;
  totalPages: number;
  basePath: string;
  query?: PublicPaginationQuery;
  pageParam?: string;
  previousLabel?: string;
  nextLabel?: string;
  ariaLabel?: string;
}>;

export type PublicPaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; position: "start" | "end" };

const MAX_VISIBLE_PUBLIC_PAGINATION_ITEMS = 7;

function pageItem(page: number): PublicPaginationItem {
  return { type: "page", page };
}

export function buildPublicPaginationHref(
  basePath: string,
  page: number,
  query?: PublicPaginationQuery,
  pageParam = "page",
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
    params.set(pageParam, String(page));
  } else {
    params.delete(pageParam);
  }

  const queryString = params.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function buildPublicPaginationItems(
  currentPage: number,
  totalPages: number,
): PublicPaginationItem[] {
  const safeTotalPages = Math.max(1, Math.floor(totalPages));
  const safeCurrentPage = Math.min(
    Math.max(1, Math.floor(currentPage)),
    safeTotalPages,
  );

  if (safeTotalPages <= MAX_VISIBLE_PUBLIC_PAGINATION_ITEMS) {
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
