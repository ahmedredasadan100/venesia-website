"use client";

import { useMemo, useState, useTransition } from "react";

import AdminNotice from "../../../../components/admin/AdminNotice";
import {
  AdminActionButton,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridStatusCell,
  AdminListEmptyState,
  AdminPageContextHeader,
  AdminStatusPill,
} from "../../../../components/admin/ui";
import type { UrlRedirectRecord } from "../../../../lib/redirects/redirect-types";

import RedirectDeleteButton from "./RedirectDeleteButton";
import RedirectFormModal from "./RedirectFormModal";
import RedirectsListFilters from "./RedirectsListFilters";
import { toggleRedirectStatusAction } from "./actions";

const columns =
  "minmax(180px,1.1fr) minmax(180px,1.1fr) 96px 96px minmax(140px,0.9fr) minmax(150px,0.9fr) minmax(150px,0.9fr) 132px";

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

export default function RedirectsClient({
  redirects,
  notice,
  error,
  initialFilters,
}: RedirectsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(redirects);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<UrlRedirectRecord | null>(null);

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

  function handleToggleStatus(redirect: UrlRedirectRecord) {
    const formData = new FormData();
    formData.set("id", String(redirect.id));
    startTransition(async () => {
      await toggleRedirectStatusAction(formData);
    });
  }

  return (
    <main className="space-y-7" dir="rtl">
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
        <AdminNotice variant="danger" title="تعذر تنفيذ العملية" message={decodeURIComponent(error)} />
      ) : null}

      <section className="rounded-[18px] border border-[#D8B87A]/12 bg-[linear-gradient(180deg,rgba(10,15,21,0.92),rgba(6,9,13,0.96))] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.34)]">
        <div className="mb-4">
          <RedirectsListFilters
            q={initialFilters.q}
            status={initialFilters.status}
            redirectType={initialFilters.redirectType}
          />
        </div>

        {rows.length === 0 ? (
          <AdminListEmptyState
            title="لا توجد تحويلات بعد"
            description="أنشئ أول تحويل URL لإدارة تغييرات المسارات العامة بعد الإطلاق."
          >
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-6 inline-flex rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]"
            >
              إضافة تحويل
            </button>
          </AdminListEmptyState>
        ) : (
          <AdminDataGrid summary={`${filteredRedirects.length} تحويل`}>
            <AdminDataGridHeader columns={columns}>
              <span>المصدر</span>
              <span>الوجهة</span>
              <span className="text-center">النوع</span>
              <span className="text-center">الحالة</span>
              <span>ملاحظة</span>
              <span>أُنشئ</span>
              <span>آخر تحديث</span>
              <span className="text-center">الإجراءات</span>
            </AdminDataGridHeader>

            {filteredRedirects.length === 0 ? (
              <AdminDataGridEmpty>لا توجد نتائج مطابقة للبحث أو الفلتر.</AdminDataGridEmpty>
            ) : (
              filteredRedirects.map((row) => (
                <AdminDataGridRow key={row.id} columns={columns} divided>
                  <AdminDataGridPrimaryCell>
                    <span className="font-en text-sm text-white">{row.source_path}</span>
                  </AdminDataGridPrimaryCell>
                  <AdminDataGridPrimaryCell>
                    <span className="font-en text-sm text-white/88 break-all">{row.destination_path}</span>
                  </AdminDataGridPrimaryCell>
                  <AdminDataGridCenterCell>
                    <span className="font-en text-sm">{row.redirect_type}</span>
                  </AdminDataGridCenterCell>
                  <AdminDataGridStatusCell>
                    <AdminStatusPill tone={row.status === "active" ? "green" : "gold"}>
                      {row.status === "active" ? "نشط" : "غير نشط"}
                    </AdminStatusPill>
                  </AdminDataGridStatusCell>
                  <AdminDataGridPrimaryCell>
                    <span className="text-sm text-white/70">{row.note || "—"}</span>
                  </AdminDataGridPrimaryCell>
                  <AdminDataGridPrimaryCell>
                    <span className="text-sm text-white/62">{formatDate(row.created_at)}</span>
                  </AdminDataGridPrimaryCell>
                  <AdminDataGridPrimaryCell>
                    <span className="text-sm text-white/62">{formatDate(row.updated_at)}</span>
                  </AdminDataGridPrimaryCell>
                  <div className="flex items-center justify-center gap-1.5">
                    <AdminDataGridActionButton
                      action="edit"
                      size="compact"
                      title="تعديل التحويل"
                      onClick={() => setEditingRedirect(row)}
                    />
                    <AdminDataGridActionButton
                      action="visibility"
                      size="compact"
                      title={row.status === "active" ? "إيقاف التحويل" : "تفعيل التحويل"}
                      disabled={isPending}
                      onClick={() => handleToggleStatus(row)}
                    />
                    <RedirectDeleteButton redirect={row} />
                  </div>
                </AdminDataGridRow>
              ))
            )}
          </AdminDataGrid>
        )}
      </section>

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
    </main>
  );
}
