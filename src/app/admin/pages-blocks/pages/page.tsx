import { loadPagesTableRows } from "../../../../lib/admin/pages/load-pages-table-rows";
import PagesTableClient, { type AdminPageListRow } from "./PagesTableClient";

type PageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }> | { notice?: string; error?: string };
};

export default async function PagesManagerPage({ searchParams }: PageProps) {
  const resolvedSearch = searchParams ? await searchParams : {};
  const notice = resolvedSearch.notice ? decodeURIComponent(resolvedSearch.notice) : null;
  const error = resolvedSearch.error ? decodeURIComponent(resolvedSearch.error) : null;

  let rows: AdminPageListRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await loadPagesTableRows();
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

  return <PagesTableClient pages={rows} notice={notice} error={error} />;
}
