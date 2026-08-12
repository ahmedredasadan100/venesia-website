"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListSurface,
  AdminEntityListTableRegion,
} from "../../../../components/admin/entity-list";
import {
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS,
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminTablePagination,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import {
  ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH,
  ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
} from "../../../../components/admin/ui/AdminDataGrid";
import AdminSeoScorePill from "../../../../components/admin/seo/AdminSeoScorePill";
import {
  mapAdminActionResultToFeedback,
  type AdminActionFeedback,
} from "../../../../lib/admin/admin-action-feedback";
import {
  adminActionFailure,
  type AdminActionResult,
} from "../../../../lib/admin/admin-action-result";
import { getContentStatusMetadata } from "../../../../lib/admin/content/content-status-metadata";
import { formatAdminDateTime } from "../../../../lib/content-dates";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import { useAdminEntityListController } from "../../../../lib/admin/entity-list/data-engine/client-controller";
import type {
  AdminEntityListQuery,
  AdminEntityListResult,
} from "../../../../lib/admin/entity-list/data-engine/contracts";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminEntityInstantMutation } from "../../../../lib/admin/entity-list/data-engine/instant-mutation";
import { resolveAdminNoticeFeedback } from "../../../../lib/admin/entity-list/feedback-codes";
import {
  legacyPageSortFields,
  pagesQueryContract,
  type PageEntityListRow,
  type PageEntityListMetrics,
  type PageFilters,
  type PageSortField,
} from "../../../../lib/admin/pages/entity-list-contract";
import { formatPageTypeLabel } from "../../../../lib/admin/pages/format-page-type-label";
import {
  getPagesDefaultColumnKeys,
  type PageColumnKey,
} from "../../../../lib/admin/pages/pages-list-config";
import {
  getPageDeleteBlockReason,
  resolvePagePublicPath,
} from "../../../../lib/pages/page-admin-policy";
import { absoluteUrlWithBase } from "../../../../lib/seo/seo-utils";
import CreatePageModal from "./CreatePageModal";
import {
  deletePages,
  duplicatePageAjax,
  restorePagesTablePreferences,
  savePagesTablePreferences,
  togglePageStatus,
} from "./actions";

export type AdminPageListRow = PageEntityListRow;

const PAGE_DELETE_CONFIRM =
  "سيتم حذف الصفحة وروابط الموديولات الخاصة بها فقط. الموديولات والقوالب نفسها لن يتم حذفها.";
const MUTATION_PENDING_REASON = "انتظر انتهاء العملية الحالية ثم حاول مرة أخرى.";

function statusMeta(status: string) {
  return getContentStatusMetadata(status);
}

type PageRowActionHandlers = {
  rowPendingAction: (id: number) => string | null;
  mutationBusy: boolean;
  onCopyPublicLink: (row: AdminPageListRow) => Promise<AdminActionResult>;
  onDelete: (row: AdminPageListRow) => Promise<AdminActionResult>;
  onDuplicate: (row: AdminPageListRow) => Promise<AdminActionResult>;
  onToggle: (row: AdminPageListRow) => Promise<AdminActionResult>;
};

// Pages needs more room than the shared compact numeric preset for its Arabic
// aggregate header, while remaining an intentional fixed-width track.
const PAGE_MODULE_COUNT_COLUMN_WIDTH =
  ADMIN_DATA_GRID_COMPACT_COUNT_COLUMN_WIDTH + 24;
const PAGE_PATH_COLUMN_WIDTH = 200;
const PAGE_SEO_COLUMN_WIDTH = 96;
const PAGE_UPDATED_AT_COLUMN_WIDTH = 176;
const PAGES_READ_MODEL_TRANSITION_NOTICE: AdminActionFeedback = {
  variant: "warning",
  title: "تنبيه مؤقت",
  message:
    "بعض بيانات Pages المتقدمة غير متاحة حتى تطبيق تحديث قاعدة البيانات.",
  layout: "inline",
  dismissible: true,
  lifecycle: "persistent",
};

function PageRowActions({
  row,
  handlers,
  onMutationResult,
  display = "menu",
}: {
  row: AdminPageListRow;
  handlers: PageRowActionHandlers;
  onMutationResult?: (result: AdminActionResult) => void;
  display?: "menu" | "visibility";
}) {
  const pendingAction = handlers.rowPendingAction(row.id);
  const status = statusMeta(row.status);
  const blocked = getPageDeleteBlockReason({ slug: row.slug, path: row.path });
  const publicPath = resolvePagePublicPath(row);
  const pendingState = {
    access: "disabled" as const,
    disabledReason: MUTATION_PENDING_REASON,
    pending: true,
  };
  const busyState = {
    access: "disabled" as const,
    disabledReason: MUTATION_PENDING_REASON,
  };

  async function run(handler: (page: AdminPageListRow) => Promise<AdminActionResult>) {
    const result = await handler(row);
    onMutationResult?.(result);
    if (!result.ok) throw new Error(result.message);
  }

  const capability: AdminRowActionsCapability = {
    entityType: "page",
    entityId: row.id,
    entityLabel: row.title,
    actions: {
      edit: {
        access: "allowed",
        href: `/admin/pages-blocks/pages/${row.id}`,
      },
      preview: publicPath
        ? {
            access: "allowed",
            href: publicPath,
            target: "_blank",
            rel: "noopener noreferrer",
          }
        : {
            access: "disabled",
            disabledReason: "لم يُحدد مسار عام موثوق لهذه الصفحة.",
          },
      information: {
        access: "allowed",
        title: "معلومات الصفحة",
        items: [
          { label: "المعرف", value: String(row.id) },
          { label: "المسار", value: publicPath ?? "غير متاح" },
          { label: "النوع", value: formatPageTypeLabel(row.page_type) },
          { label: "الحالة", value: status.label },
        ],
      },
      copyPublicLink: {
        access: "allowed",
        onSelect: () => run(handlers.onCopyPublicLink),
      },
      visibility:
        pendingAction === "visibility"
          ? { ...pendingState, isVisible: row.status === "published" }
          : handlers.mutationBusy
            ? { ...busyState, isVisible: row.status === "published" }
            : {
                access: "allowed",
                isVisible: row.status === "published",
                onSelect: () => run(handlers.onToggle),
              },
      featured: { access: "hidden" },
      duplicate:
        pendingAction === "duplicate"
          ? pendingState
          : handlers.mutationBusy
            ? busyState
            : {
                access: "allowed",
                onSelect: () => run(handlers.onDuplicate),
              },
      archive: { access: "hidden" },
      delete: blocked
        ? { access: "disabled", disabledReason: blocked }
        : pendingAction === "delete"
          ? pendingState
          : handlers.mutationBusy
            ? busyState
            : {
                access: "allowed",
                onSelect: () => run(handlers.onDelete),
                confirmation: {
                  mode: "shared",
                  title: `حذف الصفحة «${row.title}»؟`,
                  description: PAGE_DELETE_CONFIRM,
                  confirmLabel: "تأكيد الحذف",
                },
              },
    },
  };

  return (
    <AdminDataGridRowActions
      capability={capability}
      display={display}
      size="compact"
    />
  );
}

function createPageColumns(
  handlers: PageRowActionHandlers,
  supportedSortFields: ReadonlySet<PageSortField>,
): AdminEntityColumnDef<AdminPageListRow, PageColumnKey, PageSortField>[] {
  return [
    {
      key: "page",
      label: "الصفحة",
      defaultVisible: true,
      hideable: false,
      sortable: supportedSortFields.has("title"),
      sortKey: "title",
      minWidth: ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly + 40,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <Link
          href={`/admin/pages-blocks/pages/${row.id}`}
          prefetch={false}
          className="block truncate text-right font-semibold text-white transition hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "path",
      label: "المسار",
      defaultVisible: true,
      hideable: true,
      sortable: supportedSortFields.has("path"),
      sortKey: "path",
      minWidth: PAGE_PATH_COLUMN_WIDTH,
      width: PAGE_PATH_COLUMN_WIDTH,
      align: "center",
      renderCell: ({ row }) => (
        <span className="block truncate font-mono text-xs text-white/62" dir="ltr">
          {row.path}
        </span>
      ),
    },
    {
      key: "slug",
      label: "Slug",
      defaultVisible: false,
      hideable: true,
      sortable: supportedSortFields.has("slug"),
      sortKey: "slug",
      minWidth: ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_REFERENCE_COLUMN_WIDTH,
      align: "center",
      renderCell: ({ row }) => (
        <span className="block truncate font-mono text-xs text-white/55" dir="ltr">
          {row.slug}
        </span>
      ),
    },
    {
      key: "moduleCount",
      label: "عدد الموديولات",
      defaultVisible: true,
      hideable: true,
      sortable: supportedSortFields.has("moduleCount"),
      sortKey: "moduleCount",
      minWidth: PAGE_MODULE_COUNT_COLUMN_WIDTH,
      width: PAGE_MODULE_COUNT_COLUMN_WIDTH,
      align: "center",
      renderCell: ({ row }) => (
        <span className="tabular-nums text-sm font-semibold text-white/70">
          {row.moduleCount}
        </span>
      ),
    },
    {
      key: "seo",
      label: "SEO",
      defaultVisible: true,
      hideable: true,
      // The server adapter sorts the complete filtered RPC dataset by the
      // official analyzeEntitySeo output before applying collection paging.
      sortable: supportedSortFields.has("seo"),
      sortKey: "seo",
      minWidth: PAGE_SEO_COLUMN_WIDTH,
      width: PAGE_SEO_COLUMN_WIDTH,
      align: "center",
      renderCell: ({ row }) => (
        <AdminSeoScorePill
          score={row.seoScore}
          label={row.seoLabel}
          blockingErrors={row.seoBlockingErrors}
          unavailableReason={PAGES_READ_MODEL_TRANSITION_NOTICE.message}
        />
      ),
    },
    {
      key: "updatedAt",
      label: "آخر تحديث",
      defaultVisible: true,
      hideable: true,
      sortable: supportedSortFields.has("updatedAt"),
      sortKey: "updatedAt",
      minWidth: PAGE_UPDATED_AT_COLUMN_WIDTH,
      width: PAGE_UPDATED_AT_COLUMN_WIDTH,
      align: "center",
      renderCell: ({ row }) => (
        <span
          className="font-en whitespace-nowrap text-xs tabular-nums text-white/58"
          title={
            row.updatedAt
              ? undefined
              : PAGES_READ_MODEL_TRANSITION_NOTICE.message
          }
        >
          {row.updatedAt ? formatAdminDateTime(row.updatedAt) : "غير متاح"}
        </span>
      ),
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: true,
      sortable: supportedSortFields.has("status"),
      sortKey: "status",
      minWidth: Number.parseInt(ADMIN_DATA_GRID_COLUMNS.statusCompact, 10),
      width: Number.parseInt(ADMIN_DATA_GRID_COLUMNS.statusCompact, 10),
      align: "center",
      renderCell: ({ row, onMutationResult }) => (
        <PageRowActions
          row={row}
          handlers={handlers}
          onMutationResult={onMutationResult}
          display="visibility"
        />
      ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      sortable: false,
      align: "center",
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row, onMutationResult }) => (
        <PageRowActions
          row={row}
          handlers={handlers}
          onMutationResult={onMutationResult}
        />
      ),
    },
  ];
}

export default function PagesTableClient({
  initialQuery,
  initialResult,
  initialVisibleColumns,
  preferenceError = null,
}: {
  initialQuery: AdminEntityListQuery<PageFilters, PageSortField>;
  initialResult: AdminEntityListResult<
    AdminPageListRow,
    PageEntityListMetrics
  >;
  initialVisibleColumns?: readonly string[];
  preferenceError?: string | null;
}) {
  const supportedSortFields = useMemo(
    () =>
      new Set<PageSortField>(
        initialResult.metrics?.supportedSortFields ?? legacyPageSortFields,
      ),
    [initialResult.metrics?.supportedSortFields],
  );
  const constrainQueryToReadModel = useCallback(
    (candidate: AdminEntityListQuery<PageFilters, PageSortField>) =>
      supportedSortFields.has(candidate.sort.field)
        ? candidate
        : {
            ...candidate,
            sort: { field: "id" as const, direction: "asc" as const },
          },
    [supportedSortFields],
  );
  const controller = useAdminEntityListController({
    entity: "pages",
    contract: pagesQueryContract,
    initialQuery,
    initialResult,
    staleTimeMs: 30_000,
    constrainQuery: constrainQueryToReadModel,
  });
  const instant = useAdminEntityInstantMutation<AdminPageListRow>(
    "pages",
    controller.query,
  );
  const pages = controller.result.rows;
  async function deletePage(page: AdminPageListRow): Promise<AdminActionResult> {
    try {
      const result = await instant.mutateAsync({
        rowId: page.id,
        action: "delete",
        optimistic: (cache) => cache.removeRows(new Set([page.id])),
        execute: () => deletePages([page.id]),
      });
      return {
        ok: true,
        feedbackStatus: result.feedbackStatus,
        title: "تم حذف الصفحة",
        message: result.message,
        code: "deleted",
        entityId: page.id,
      };
    } catch (error) {
      return adminActionFailure(
        "تعذر حذف الصفحة",
        error instanceof Error ? error.message : "تعذر تنفيذ العملية.",
        { entityId: page.id },
      );
    }
  }

  async function toggle(page: AdminPageListRow): Promise<AdminActionResult> {
    const nextStatus = page.status === "published" ? "unpublished" : "published";
    try {
      const result = await instant.mutateAsync({
        rowId: page.id,
        action: "visibility",
        optimistic: (cache) =>
          cache.patchRows((row) =>
            row.id === page.id ? { ...row, status: nextStatus } : row,
          ),
        execute: () => togglePageStatus(page.id),
      });
      return {
        ok: true,
        feedbackStatus: result.feedbackStatus,
        title:
          nextStatus === "published" ? "تم إظهار الصفحة" : "تم إخفاء الصفحة",
        message: result.message,
        code: nextStatus === "published" ? "published" : "unpublished",
        entityId: page.id,
      };
    } catch (error) {
      return adminActionFailure(
        "تعذر تحديث حالة الصفحة",
        error instanceof Error ? error.message : "تعذر تحديث الحالة.",
        { entityId: page.id },
      );
    }
  }

  async function duplicate(page: AdminPageListRow): Promise<AdminActionResult> {
    try {
      const result = await instant.mutateAsync({
        rowId: page.id,
        action: "duplicate",
        optimistic: () => undefined,
        execute: () => duplicatePageAjax(page.id),
      });
      return {
        ok: true,
        feedbackStatus: result.feedbackStatus,
        title: "تم نسخ الصفحة",
        message: result.message,
        code: "created",
        entityId:
          typeof result.pageId === "number" ? result.pageId : undefined,
      };
    } catch (error) {
      return adminActionFailure(
        "تعذر نسخ الصفحة",
        error instanceof Error ? error.message : "تعذر نسخ الصفحة.",
        { entityId: page.id },
      );
    }
  }

  async function copyPublicLink(page: AdminPageListRow): Promise<AdminActionResult> {
    const publicPath = resolvePagePublicPath(page);
    if (!publicPath) {
      return adminActionFailure(
        "تعذر نسخ الرابط العام",
        "لم يُحدد مسار عام موثوق لهذه الصفحة.",
        { entityId: page.id },
      );
    }
    const url = absoluteUrlWithBase(publicPath);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable");
      }
      await navigator.clipboard.writeText(url);
      return {
        ok: true,
        feedbackStatus: "success",
        title: "تم نسخ الرابط العام",
        message: "تم نسخ رابط الصفحة العامة إلى الحافظة.",
        entityId: page.id,
      };
    } catch {
      return adminActionFailure(
        "تعذر نسخ الرابط تلقائيًا",
        `انسخ الرابط يدويًا: ${url}`,
        { entityId: page.id },
      );
    }
  }

  async function bulkDelete(ids: number[]): Promise<AdminActionResult> {
    const validIds = ids.filter((id) => {
      const page = pages.find((row) => row.id === id);
      return (
        page && !getPageDeleteBlockReason({ slug: page.slug, path: page.path })
      );
    });
    try {
      const result = await instant.mutateAsync({
        action: "delete",
        bulk: true,
        optimistic: (cache) => cache.removeRows(new Set(validIds)),
        execute: () => deletePages(ids),
      });
      const hasBlockedPages =
        typeof result.blockedCount === "number" && result.blockedCount > 0;
      return {
        ok: true,
        feedbackStatus: hasBlockedPages ? "warning" : result.feedbackStatus,
        title: hasBlockedPages
          ? "اكتمل الحذف مع صفحات محمية"
          : "تم حذف الصفحات",
        message: result.message,
        code: "deleted",
      };
    } catch (error) {
      return adminActionFailure(
        "تعذر حذف الصفحات",
        error instanceof Error ? error.message : "تعذر تنفيذ العملية.",
      );
    }
  }

  const columns = useMemo(
    () =>
      createPageColumns(
        {
          rowPendingAction: (id) =>
            instant.rowPending?.rowId === id ? instant.rowPending.action : null,
          mutationBusy:
            instant.rowPending !== null || instant.bulkPending !== null,
          onCopyPublicLink: copyPublicLink,
          onDelete: deletePage,
          onDuplicate: duplicate,
          onToggle: toggle,
        },
        supportedSortFields,
      ),
    // The handlers intentionally close over the current normalized-list mutation owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instant.bulkPending, instant.rowPending, supportedSortFields],
  );
  const initialFeedback = useMemo(
    () => {
      const preferenceFeedback = resolveAdminNoticeFeedback(
        {},
        preferenceError ? "error" : null,
        preferenceError,
      );
      if (preferenceFeedback) return preferenceFeedback;
      if ((initialResult.metrics?.readModelContractVersion ?? 1) >= 2) {
        return null;
      }
      return PAGES_READ_MODEL_TRANSITION_NOTICE;
    },
    [initialResult.metrics?.readModelContractVersion, preferenceError],
  );

  return (
    <AdminEntityListPageLayout className="pb-10" dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة الصفحات والموديولات"
        title="إدارة الصفحات"
        description="إدارة صفحات الموقع ومكوناتها، مع التحكم في الترتيب، الربط، وحالة النشر."
        actions={<CreatePageModal />}
      />

      <AdminEntityListSurface consumer="pages">
        <AdminEntityListTableRegion
          data-admin-entity-list-pending={
            controller.isFetching ? "true" : "false"
          }
        >
          <AdminEntityList<
            AdminPageListRow,
            PageColumnKey,
            PageSortField,
            number
          >
            listId="pages-table"
            toolbar={{
              basePath: "/admin/pages-blocks/pages",
              search: {
                placeholder: "ابحث في الصفحات",
                value: controller.query.search,
                minLength: pagesQueryContract.searchMinLength,
                pending: controller.isFetching,
              },
              filters: [],
              values: {},
              onQueryPatch: (patch, behavior = "push") => {
                const search =
                  "q" in patch
                    ? (patch.q ?? "").trim()
                    : controller.query.search;
                controller.setSearchAndFilters(search, {}, behavior);
              },
            }}
            rows={pages}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.title}
            initialVisibleColumns={initialVisibleColumns}
            defaultVisibleColumns={[...getPagesDefaultColumnKeys()]}
            onPersistColumns={savePagesTablePreferences}
            onRestoreColumns={restorePagesTablePreferences}
            enableColumnManagement
            enableSelection
            selectionLabel="تحديد كل الصفحات في الصفحة الحالية"
            bulkOptions={[
              {
                value: "delete",
                label: ADMIN_BULK_ACTION_LABELS.deleteSelected,
              },
            ]}
            bulkEntityLabel="صفحة"
            onBulkExecute={(action, ids) =>
              action === "delete"
                ? bulkDelete(ids)
                : Promise.resolve(
                    adminActionFailure("إجراء غير مدعوم", "إجراء الصفحات غير معروف."),
                  )
            }
            getBulkConfirmation={(action) =>
              action === "delete"
                ? {
                    title: "حذف الصفحات المحددة؟",
                    description: PAGE_DELETE_CONFIRM,
                    confirmLabel: "تأكيد الحذف",
                  }
                : null
            }
            mapResultToFeedback={mapAdminActionResultToFeedback}
            onSuccessfulMutation={(result) => {
              if (!result || result.code === "created") {
                return controller.invalidate();
              }
            }}
            sort={{
              key: controller.query.sort.field,
              direction: controller.query.sort.direction,
            }}
            sortMode={{
              mode: "callback",
              onToggle: (field) => {
                const current = controller.query.sort;
                controller.setSort({
                  field: field as PageSortField,
                  direction:
                    current.field === field && current.direction === "asc"
                      ? "desc"
                      : "asc",
                });
              },
            }}
            onSortColumnHidden={() =>
              controller.setSort({ field: "id", direction: "asc" })
            }
            actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
            emptyState={{
              mode:
                controller.result.pagination.totalRows === 0 &&
                !controller.query.search
                  ? "system"
                  : "filtered",
              systemEmpty: (
                <p className="text-base font-semibold text-white">
                  لا توجد صفحات بعد
                </p>
              ),
              filteredEmpty: (
                <p className="text-base font-semibold text-white">
                  لا توجد صفحات مطابقة
                </p>
              ),
            }}
            initialFeedback={initialFeedback}
          />
          <AdminTablePagination
            basePath="/admin/pages-blocks/pages"
            totalCount={controller.result.pagination.totalRows}
            pageSize={String(controller.result.pagination.pageSize)}
            pageSizeOptions={["10", "20", "30"]}
            currentPage={controller.result.pagination.page}
            totalPages={controller.result.pagination.totalPages}
            emptySummaryText="لا توجد صفحات"
            onPageChange={controller.setPage}
            onPageSizeChange={controller.setPageSize}
            pending={controller.isFetching}
          />
        </AdminEntityListTableRegion>
      </AdminEntityListSurface>
    </AdminEntityListPageLayout>
  );
}
