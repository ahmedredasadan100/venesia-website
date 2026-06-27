"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminPageHeader,
  AdminStatusPill,
  useAdminGridSelection,
} from "../ui";
import { PlusIcon } from "../AdminRowActions";
import { statusMeta } from "../../../lib/page-blocks/admin-utils";

export type BlockModuleRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  status: string;
};

type BlockModuleManagerClientProps = {
  moduleKey: "content" | "cta" | "cards" | "breadcrumb" | "feed";
  moduleTitle: string;
  moduleDescription: string;
  rows: BlockModuleRow[];
  createAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  duplicateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  defaultVariant: string;
  variantOptions: Array<[string, string]>;
};

const gridColumns = "56px minmax(280px,1.8fr) minmax(180px,1fr) 120px 110px 220px";

export default function BlockModuleManagerClient({
  moduleKey,
  moduleTitle,
  moduleDescription,
  rows,
  createAction,
  deleteAction,
  duplicateAction,
  toggleAction,
  bulkAction,
  defaultVariant,
  variantOptions,
}: BlockModuleManagerClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selection = useAdminGridSelection<number>(visibleIds);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <AdminPageHeader
        eyebrow="Admin Panel"
        title={moduleTitle}
        description={moduleDescription}
        meta={`${rows.length} بلوك`}
        actions={(
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة بلوك
          </button>
        )}
      />

      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel="بلوك"
        action={bulkAction}
        options={[
          { value: "publish", label: "نشر" },
          { value: "hide", label: "إخفاء" },
          { value: "draft", label: "مسودة" },
          { value: "delete", label: "حذف" },
        ]}
        onClearSelection={selection.clearSelection}
      />

      <AdminDataGrid summary={rows.length ? `${rows.length} بلوك` : undefined}>
        <AdminDataGridHeader columns={gridColumns}>
          <div className="flex justify-center">
            <AdminDataGridCheckbox
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد الكل"
            />
          </div>
          <div>الاسم</div>
          <div>Slug</div>
          <div>Variant</div>
          <div>الحالة</div>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {rows.map((row) => {
          const status = statusMeta(row.status);
          const nextStatus = row.status === "published" ? "unpublished" : "published";

          return (
            <AdminDataGridRow key={row.id} columns={gridColumns} className="border-b border-white/8 last:border-b-0">
              <div className="flex justify-center xl:block">
                <AdminDataGridCheckbox
                  checked={selection.selectedSet.has(row.id)}
                  onChange={(event) => selection.toggleOne(row.id, event.target.checked)}
                  label={`تحديد ${row.name}`}
                />
              </div>

              <div className="min-w-0">
                <Link
                  href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                  className="font-semibold text-white transition hover:text-[#D8B87A]"
                >
                  {row.name}
                </Link>
                {row.description ? <p className="mt-1 line-clamp-1 text-xs text-white/36">{row.description}</p> : null}
              </div>

              <Link
                href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`}
                className="font-en text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]"
              >
                {row.slug}
              </Link>

              <div className="text-white/58">{row.variant}</div>

              <div>
                <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
                {row.status !== "published" ? (
                  <p className="mt-1 text-[10px] leading-5 text-amber-200/75">غير منشور — لن يظهر على الصفحات العامة.</p>
                ) : null}
              </div>

              <AdminDataGridActionsCell>
                <AdminDataGridActionButton action="edit" href={`/admin/pages-blocks/blocks/${moduleKey}/${row.id}`} />

                <form action={toggleAction} className="inline-flex shrink-0">
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="next_status" value={nextStatus} />
                  <AdminDataGridActionButton type="submit" action="visibility" title={row.status === "published" ? "إخفاء" : "نشر"} />
                </form>

                <form action={duplicateAction} className="inline-flex shrink-0">
                  <input type="hidden" name="id" value={row.id} />
                  <AdminDataGridActionButton type="submit" action="duplicate" title="نسخ" />
                </form>

                <form action={deleteAction} className="inline-flex shrink-0">
                  <input type="hidden" name="id" value={row.id} />
                  <AdminDataGridActionButton type="submit" action="delete" title="حذف" />
                </form>
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })}

        {!rows.length ? <AdminDataGridEmpty>لا توجد بلوكات بعد.</AdminDataGridEmpty> : null}
      </AdminDataGrid>

      {showCreateModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowCreateModal(false)}>
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">إضافة بلوك جديد</h3>
                <p className="mt-1 text-sm text-white/45">أنشئ القالب ثم عدّل المحتوى واربطه بالصفحات.</p>
                <p className="mt-2 text-xs leading-6 text-amber-200/75">
                  البلوكات الجديدة تُنشأ كمسودة ولن تظهر على الموقع العام حتى تنشرها من هذه القائمة.
                </p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
                ×
              </button>
            </div>

            <form action={createAction} className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">الاسم</span>
                <input name="name" required className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Slug</span>
                <input name="slug" dir="ltr" placeholder={`${moduleKey}-example`} className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">{moduleKey === "feed" ? "Feed Type" : "Variant"}</span>
                <select
                  name={moduleKey === "feed" ? "feed_type" : "variant"}
                  defaultValue={defaultVariant}
                  className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
                >
                  {variantOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {moduleKey === "feed" ? (
                <>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold text-white/55">Widget Title</span>
                    <input
                      name="widget_title"
                      required
                      placeholder="أحدث الموضوعات"
                      className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold text-white/55">Limit</span>
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      defaultValue={3}
                      className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45"
                    />
                  </label>
                </>
              ) : null}
              <input type="hidden" name="status" value="draft" />
              <input type="hidden" name="style_preset" value="premium-dark" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                  إلغاء
                </button>
                <button className="cursor-pointer rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d]">
                  إنشاء وفتح
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
