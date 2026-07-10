import {
  loadPagesTableRowsPaginated,
  type PagesListSort,
} from "../../../../lib/admin/pages/load-pages-table-rows";
import PagesTableClient, { type AdminPageListRow } from "./PagesTableClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  notice?: string;
  error?: string;
  page?: string;
  limit?: string;
  sort?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function PagesManagerPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const notice = resolvedSearch.notice ? decodeURIComponent(resolvedSearch.notice) : null;
  const error = resolvedSearch.error ? decodeURIComponent(resolvedSearch.error) : null;

  let rows: AdminPageListRow[] = [];
  let loadError: string | null = null;
  let pagination = {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    rangeStart: 0,
    rangeEnd: 0,
    pageSize: "10",
  };
  let sort: PagesListSort = "id_asc";

  try {
    const result = await loadPagesTableRowsPaginated({
      page: resolvedSearch.page,
      limit: resolvedSearch.limit,
      sort: resolvedSearch.sort,
    });
    rows = result.rows;
    sort = result.sort;
    pagination = {
      currentPage: result.page,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
      rangeStart: result.rangeStart,
      rangeEnd: result.rangeEnd,
      pageSize: String(result.limit),
    };
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "تعذر تحميل الصفحات.";
  }

  if (loadError) {
    return (
      <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-6 text-red-100" dir="rtl">
        حدث خطأ أثناء قراءة الصفحات: {loadError}
      </div>
    );
  }

  return (
    <PagesTableClient
      pages={rows}
      pagination={pagination}
      sort={sort}
      notice={notice}
      error={error}
    />
  );
}
