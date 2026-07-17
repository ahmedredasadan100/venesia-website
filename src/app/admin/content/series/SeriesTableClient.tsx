"use client";

import { useMemo, useState } from "react";
import { AdminEntityList } from "../../../../components/admin/entity-list";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminActionResult } from "../../../../lib/admin/admin-action-result";
import { SERIES_DEFAULT_COLUMN_KEYS } from "../../../../lib/admin/content/series-list-config";
import {
  bulkSeriesActionAjax,
  saveSeriesTablePreferences,
} from "./actions";
import {
  createSeriesColumns,
  SERIES_ACTIONS_COLUMN_WIDTH,
  type SeriesColumnKey,
  type SeriesListRow,
  type SeriesSortKey,
} from "./series-columns";

const BULK_OPTIONS = [
  { value: "publish", label: "إظهار المحدد" },
  { value: "hide", label: "إخفاء المحدد" },
  { value: "delete", label: "حذف المحدد" },
] as const;

export type { SeriesListRow };

export default function SeriesTableClient({
  series,
  initialVisibleColumns,
}: {
  series: SeriesListRow[];
  initialVisibleColumns?: string[];
}) {
  const [rows, setRows] = useState(series);
  const [sort, setSort] = useState<{
    key: SeriesSortKey;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });

  const columns = useMemo(
    () => createSeriesColumns({ onRowsUpdated: setRows }),
    [],
  );

  const sortedRows = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      let result = 0;
      if (sort.key === "topics_count") {
        result = a.topics_count - b.topics_count;
      } else if (sort.key === "status") {
        result = String(a.status ?? "").localeCompare(String(b.status ?? ""), "ar");
      } else {
        result = a.name.localeCompare(b.name, "ar");
      }
      return sort.direction === "asc" ? result : -result;
    });
    return next;
  }, [rows, sort]);

  function mapSeriesResult(result: {
    ok: boolean;
    message?: string;
    rows?: SeriesListRow[];
  }): AdminActionResult {
    if (result.rows) setRows(result.rows);
    return {
      ok: result.ok,
      title: result.ok ? "تم بنجاح" : "تعذر تنفيذ العملية",
      message: result.message ?? (result.ok ? "تم التحديث." : "فشلت العملية."),
      code: result.ok ? "saved" : undefined,
    };
  }

  return (
    <AdminEntityList<SeriesListRow, SeriesColumnKey, SeriesSortKey, number>
      listId="content-series-table"
      rows={sortedRows}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      initialVisibleColumns={
        initialVisibleColumns?.length
          ? initialVisibleColumns
          : [...SERIES_DEFAULT_COLUMN_KEYS]
      }
      onPersistColumns={(visibleColumns) =>
        saveSeriesTablePreferences(visibleColumns)
      }
      enableColumnManagement
      enableSelection
      selectionLabel="تحديد كل السلاسل"
      bulkOptions={BULK_OPTIONS}
      bulkEntityLabel="سلسلة"
      mapResultToFeedback={(result) => mapAdminActionResultToFeedback(result)}
      sort={sort}
      sortMode={{
        mode: "callback",
        onToggle: (sortKey) => {
          const key = sortKey as SeriesSortKey;
          setSort((current) =>
            current.key === key
              ? {
                  key,
                  direction: current.direction === "asc" ? "desc" : "asc",
                }
              : { key, direction: "asc" },
          );
        },
      }}
      actionsColumnWidth={SERIES_ACTIONS_COLUMN_WIDTH}
      empty={
        <>
          <p className="text-base font-semibold text-white">
            لا توجد سلاسل حتى الآن
          </p>
          <p className="mt-2 text-sm text-white/45">
            ابدأ بإضافة أول سلسلة من زر إضافة سلسلة.
          </p>
        </>
      }
      onBulkExecute={async (action, ids) =>
        mapSeriesResult(await bulkSeriesActionAjax(action, ids))
      }
    />
  );
}
