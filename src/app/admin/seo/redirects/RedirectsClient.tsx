"use client";

import { useMemo, useState } from "react";

import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminEntityList,
  AdminEntityListPageLayout,
  AdminEntityListPrimarySection,
  AdminEntityListSurface,
} from "../../../../components/admin/entity-list";
import {
  ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
  AdminActionButton,
  AdminDataGridRowActions,
  AdminPageContextHeader,
  AdminStatusPill,
  type AdminRowActionsCapability,
} from "../../../../components/admin/ui";
import { mapAdminActionResultToFeedback } from "../../../../lib/admin/admin-action-feedback";
import type { AdminEntityColumnDef } from "../../../../lib/admin/entity-list";
import type { UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";

import RedirectFormModal from "./RedirectFormModal";
import RedirectsListFilters from "./RedirectsListFilters";
import {
  deleteRedirectAction,
  toggleRedirectStatusAction,
} from "./actions";

type RedirectColumnKey =
  | "source"
  | "destination"
  | "type"
  | "status"
  | "note"
  | "created"
  | "updated"
  | "actions";

type RedirectSortKey = "fixed";

type RedirectsClientProps = {
  redirects: UrlRedirectRecord[];
  notice?: string | null;
  error?: string | null;
  initialFilters: {
    q: string;
    status: string;
    redirectType: string;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function getNoticeText(notice?: string | null) {
  if (notice === "created") return "تم إنشاء التحويل بنجاح.";
  if (notice === "updated") return "تم تحديث التحويل بنجاح.";
  if (notice === "deleted") return "تم حذف التحويل بنجاح.";
  if (notice === "activated") return "تم تفعيل التحويل بنجاح.";
  if (notice === "deactivated") return "تم إيقاف التحويل بنجاح.";
  return null;
}

function redirectFormData(id: number) {
  const formData = new FormData();
  formData.set("id", String(id));
  return formData;
}

function createRedirectColumns(input: {
  pendingRowId: number | null;
  onEdit: (row: UrlRedirectRecord) => void;
  onToggle: (row: UrlRedirectRecord) => Promise<void>;
  onDelete: (row: UrlRedirectRecord) => Promise<void>;
}): AdminEntityColumnDef<
  UrlRedirectRecord,
  RedirectColumnKey,
  RedirectSortKey
>[] {
  return [
    {
      key: "source",
      label: "المصدر",
      defaultVisible: true,
      hideable: false,
      minWidth: 210,
      width: 210,
      sticky: "start",
      primary: true,
      renderCell: ({ row }) => (
        <span className="block break-all text-right font-en text-sm text-white">
          {row.source_path}
        </span>
      ),
    },
    {
      key: "destination",
      label: "الوجهة",
      defaultVisible: true,
      hideable: false,
      minWidth: 220,
      width: 220,
      renderCell: ({ row }) => (
        <span className="block break-all text-right font-en text-sm text-white/88">
          {row.destination_path}
        </span>
      ),
    },
    {
      key: "type",
      label: "النوع",
      defaultVisible: true,
      hideable: false,
      minWidth: 96,
      width: 96,
      renderCell: ({ row }) => (
        <span className="font-en text-sm">{row.redirect_type}</span>
      ),
    },
    {
      key: "status",
      label: "الحالة",
      defaultVisible: true,
      hideable: false,
      minWidth: 112,
      width: 112,
      renderCell: ({ row }) => (
        <AdminStatusPill tone={row.status === "active" ? "green" : "gold"}>
          {row.status === "active" ? "نشط" : "غير نشط"}
        </AdminStatusPill>
      ),
    },
    {
      key: "note",
      label: "ملاحظة",
      defaultVisible: true,
      hideable: false,
      minWidth: 150,
      width: 150,
      renderCell: ({ row }) => (
        <span className="block truncate text-right text-sm text-white/70">
          {row.note || "—"}
        </span>
      ),
    },
    {
      key: "created",
      label: "أُنشئ",
      defaultVisible: true,
      hideable: false,
      minWidth: 164,
      width: 164,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/62">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "updated",
      label: "آخر تحديث",
      defaultVisible: true,
      hideable: false,
      minWidth: 164,
      width: 164,
      renderCell: ({ row }) => (
        <span className="block text-right text-sm text-white/62">
          {formatDate(row.updated_at)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "الإجراءات",
      defaultVisible: true,
      hideable: false,
      minWidth: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      width: ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH,
      sticky: "end",
      renderCell: ({ row }) => {
        const pending = input.pendingRowId === row.id;
        const capability: AdminRowActionsCapability = {
          entityType: "redirect",
          entityId: row.id,
          entityLabel: row.source_path,
          actions: {
            edit: pending
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                }
              : { access: "allowed", onSelect: () => input.onEdit(row) },
            preview: { access: "hidden" },
            information: {
              access: "allowed",
              title: "معلومات التحويل",
              items: [
                { label: "المعرف", value: String(row.id) },
                { label: "المصدر", value: row.source_path },
                { label: "الوجهة", value: row.destination_path },
                { label: "النوع", value: row.redirect_type },
                {
                  label: "الحالة",
                  value: row.status === "active" ? "نشط" : "غير نشط",
                },
              ],
            },
            copyPublicLink: { access: "hidden" },
            visibility: pending
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                  pending: true,
                  isVisible: row.status === "active",
                }
              : {
                  access: "allowed",
                  isVisible: row.status === "active",
                  onSelect: () => input.onToggle(row),
                },
            featured: { access: "hidden" },
            duplicate: { access: "hidden" },
            archive: { access: "hidden" },
            delete: pending
              ? {
                  access: "disabled",
                  disabledReason: "انتظر انتهاء الإجراء الحالي.",
                  pending: true,
                }
              : {
                  access: "allowed",
                  onSelect: () => input.onDelete(row),
                  confirmation: {
                    mode: "shared",
                    title: "تأكيد حذف التحويل",
                    description: `هل أنت متأكد من حذف التحويل من ${row.source_path}؟ لا يمكن التراجع عن هذا الإجراء.`,
                    confirmLabel: "حذف التحويل",
                  },
                },
          },
        };
        return <AdminDataGridRowActions capability={capability} size="compact" />;
      },
    },
  ];
}

export default function RedirectsClient({
  redirects,
  notice,
  error,
  initialFilters,
}: RedirectsClientProps) {
  const [rows, setRows] = useState(redirects);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<UrlRedirectRecord | null>(null);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const noticeText = getNoticeText(notice);

  const filteredRedirects = useMemo(() => {
    const q = initialFilters.q.trim().toLowerCase();
    return rows.filter((row) => {
      if (initialFilters.status !== "all" && row.status !== initialFilters.status) return false;
      if (initialFilters.redirectType !== "all" && row.redirect_type !== initialFilters.redirectType) {
        return false;
      }
      if (!q) return true;
      return (
        row.source_path.toLowerCase().includes(q) ||
        row.destination_path.toLowerCase().includes(q) ||
        (row.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, initialFilters]);

  function handleRedirectSaved(savedRedirect: UrlRedirectRecord) {
    setRows((current) => {
      const nextRows = current.some((row) => row.id === savedRedirect.id)
        ? current.map((row) =>
            row.id === savedRedirect.id ? savedRedirect : row,
          )
        : [savedRedirect, ...current];
      return nextRows.sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at),
      );
    });
  }

  async function runRowAction(
    row: UrlRedirectRecord,
    action: (formData: FormData) => Promise<unknown>,
  ) {
    if (pendingRowId !== null) return;
    setPendingRowId(row.id);
    try {
      await action(redirectFormData(row.id));
    } finally {
      setPendingRowId(null);
    }
  }

  const columns = useMemo(
    () =>
      createRedirectColumns({
        pendingRowId,
        onEdit: setEditingRedirect,
        onToggle: (row) => runRowAction(row, toggleRedirectStatusAction),
        onDelete: (row) => runRowAction(row, deleteRedirectAction),
      }),
    // Server actions navigate after success; only the pending row changes locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingRowId],
  );
  const hasFilters =
    Boolean(initialFilters.q.trim()) ||
    initialFilters.status !== "all" ||
    initialFilters.redirectType !== "all";

  return (
    <>
      <AdminEntityListPageLayout className="pb-10" dir="rtl">
        <AdminPageContextHeader
          eyebrow="SEO REDIRECTS"
          title="إدارة التحويلات"
          description="أنشئ تحويلات URL عامة لتغييرات المسارات بعد الإطلاق. التحويلات النشطة تُطبَّق فورًا على الطلبات العامة."
          actions={
            <AdminActionButton variant="primary" onClick={() => setCreateOpen(true)}>
              إضافة تحويل
            </AdminActionButton>
          }
        />

        {noticeText ? <AdminNotice variant="success" message={noticeText} /> : null}
        {error ? (
          <AdminNotice
            variant="danger"
            title="تعذر تنفيذ العملية"
            message={decodeURIComponent(error)}
          />
        ) : null}

        <AdminEntityListSurface consumer="redirects">
          <AdminEntityListPrimarySection>
            <RedirectsListFilters
              q={initialFilters.q}
              status={initialFilters.status}
              redirectType={initialFilters.redirectType}
            />
          </AdminEntityListPrimarySection>

          <AdminEntityListPrimarySection>
            <AdminEntityList<
              UrlRedirectRecord,
              RedirectColumnKey,
              RedirectSortKey,
              number
            >
              listId="redirects-table"
              rows={filteredRedirects}
              columns={columns}
              getRowId={(row) => row.id}
              getRowLabel={(row) => row.source_path}
              enableColumnManagement={false}
              enableSelection={false}
              mapResultToFeedback={mapAdminActionResultToFeedback}
              sort={null}
              actionsColumnWidth={ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH}
              emptyState={{
                mode: rows.length === 0 && !hasFilters ? "system" : "filtered",
                systemEmpty: (
                  <div>
                    <p className="text-base font-semibold text-white">
                      لا توجد تحويلات بعد
                    </p>
                    <p className="mt-2 text-sm leading-7 text-white/45">
                      أنشئ أول تحويل URL لإدارة تغييرات المسارات العامة بعد الإطلاق.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
                    >
                      إضافة تحويل
                    </button>
                  </div>
                ),
                filteredEmpty: (
                  <p className="text-base font-semibold text-white">
                    لا توجد نتائج مطابقة للبحث أو الفلتر
                  </p>
                ),
              }}
            />
          </AdminEntityListPrimarySection>
        </AdminEntityListSurface>
      </AdminEntityListPageLayout>

      <RedirectFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={handleRedirectSaved}
      />
      <RedirectFormModal
        open={Boolean(editingRedirect)}
        mode="edit"
        redirect={editingRedirect ?? undefined}
        onClose={() => setEditingRedirect(null)}
        onSaved={handleRedirectSaved}
      />
    </>
  );
}
