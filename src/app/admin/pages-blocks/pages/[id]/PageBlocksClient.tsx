"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AdminBulkActionBar, useAdminGridSelection } from "../../../../../components/admin/ui";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import {
  blockModuleListHref,
  fieldClassName,
  moduleKindLabel,
  normalizeBoolean,
} from "../../../../../lib/page-blocks/admin-utils";
import { type PageBlockAssignmentRow, type PageBlockType } from "../../../../../lib/page-blocks/types";
import { LAYOUT_SLOT_LABELS_AR } from "../../../../../lib/page-blocks/layout-slots";
import {
  bulkPageBlockAssignments,
  deletePageBlockAssignment,
  togglePageBlockAssignment,
} from "../actions";
import PageVisualSlotMap from "../../../../../components/admin/page-blocks/PageVisualSlotMap";
import AssignTemplateUsageWarning from "../../../../../components/admin/page-blocks/AssignTemplateUsageWarning";
import PageBlocksAssignmentsGrid from "./page-blocks/PageBlocksAssignmentsGrid";
import PageBlocksDeleteConfirm from "./page-blocks/PageBlocksDeleteConfirm";
import PageBlocksHeader from "./page-blocks/PageBlocksHeader";
import { buildReorderInfo } from "./page-blocks/build-reorder-info";
import {
  assignmentRowId,
  isManageableAssignment,
} from "./page-blocks/page-blocks-utils";
import { usePageBlocksReorder } from "./page-blocks/use-page-blocks-reorder";
import {
  type AssignableModuleKind,
  usePageBlocksAssignModal,
} from "./page-blocks/use-page-blocks-assign-modal";

type PageRow = {
  id: number;
  title: string;
  slug: string;
  path: string;
  page_type: string;
  status: string;
};

type TemplateOption = { id: number; name: string; slug: string; status: string };

type PageBlocksClientProps = {
  page: PageRow;
  assignments: PageBlockAssignmentRow[];
  templates: {
    content: TemplateOption[];
    cta: TemplateOption[];
    cards: TemplateOption[];
    breadcrumb: TemplateOption[];
    feed: TemplateOption[];
    hero: TemplateOption[];
    mediaSidebar: TemplateOption[];
    mediaHub: TemplateOption[];
  };
};

type SortKey = "module_kind" | "template_name" | "visibility";

const slotLabels = LAYOUT_SLOT_LABELS_AR;

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
      ×
    </button>
  );
}

export default function PageBlocksClient({ page, assignments, templates }: PageBlocksClientProps) {
  const router = useRouter();
  const [deletingAssignment, setDeletingAssignment] = useState<PageBlockAssignmentRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    assignModalOpen,
    openAssignModal,
    closeAssignModal,
    assignModuleKind,
    setAssignModuleKind,
    assignTemplateId,
    setAssignTemplateId,
    assignVisible,
    setAssignVisible,
    assignPending,
    templateOptions,
    assignableTemplates,
    slotOptions,
    assignState,
    assignHeroState,
    assignMediaSidebarState,
    assignMediaHubState,
    assignBlockAction,
    assignHeroAction,
    assignMediaSidebarAction,
    assignMediaHubAction,
  } = usePageBlocksAssignModal({
    pageId: page.id,
    assignments,
    templates,
    setActionMessage,
    router,
  });

  const sortAccessors = useMemo(
    () => ({
      module_kind: (row: PageBlockAssignmentRow) => moduleKindLabel(row.module_kind),
      template_name: (row: PageBlockAssignmentRow) => row.template_name,
      visibility: (row: PageBlockAssignmentRow) => (normalizeBoolean(row.is_visible, true) ? 0 : 1),
    }),
    [],
  );

  const table = useAdminTable<PageBlockAssignmentRow, SortKey>({
    initialRows: assignments,
    getRowId: (row) => assignmentRowId(row),
    sortAccessors,
  });

  const manageableRows = useMemo(() => assignments.filter(isManageableAssignment), [assignments]);
  const visibleRowIds = useMemo(() => manageableRows.map((row) => assignmentRowId(row)), [manageableRows]);
  const selection = useAdminGridSelection<string>(visibleRowIds);

  const usedModuleKinds = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const assignment of assignments) {
      if (seen.has(assignment.module_kind)) continue;
      seen.add(assignment.module_kind);
      list.push(assignment.module_kind);
    }
    return list;
  }, [assignments]);

  /** Up/down neighbour per row, scoped to same module kind + slot, ordered by sort_order. */
  const reorderInfo = useMemo(() => buildReorderInfo(table.rawRows), [table.rawRows]);

  const { handleReorder } = usePageBlocksReorder({
    pageId: page.id,
    table,
    reorderInfo,
    setActionMessage,
    startTransition,
  });

  const { setRows } = table;

  useEffect(() => {
    setRows(assignments);
  }, [assignments, setRows]);

  function handleToggleVisibility(row: PageBlockAssignmentRow) {
    if (!isManageableAssignment(row)) return;
    const isVisible = normalizeBoolean(row.is_visible, true);
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("block_type", row.module_kind);
    formData.set("next_visible", isVisible ? "false" : "true");

    startTransition(async () => {
      const result = await togglePageBlockAssignment(formData);
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setActionMessage(null);
      router.refresh();
    });
  }

  function handleDeleteAssignment() {
    if (!deletingAssignment) return;

    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(deletingAssignment.id));
    formData.set("block_type", deletingAssignment.module_kind);

    startTransition(async () => {
      const result = await deletePageBlockAssignment(formData);
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setDeletingAssignment(null);
      setActionMessage(null);
      router.refresh();
    });
  }

  function handleBulkExecute(action: string, ids: string[]) {
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("bulk_action", action);
    for (const id of ids) {
      formData.append("ids", id);
    }

    startTransition(async () => {
      await bulkPageBlockAssignments(formData);
      selection.clearSelection();
      setActionMessage(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <PageBlocksHeader
        page={page}
        assignmentCount={assignments.length}
        usedModuleKinds={usedModuleKinds}
        onOpenAssignModal={openAssignModal}
      />

      {actionMessage ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {actionMessage}
        </div>
      ) : null}

      <PageVisualSlotMap assignments={assignments} />

      <AdminBulkActionBar
        selectedIds={selection.selectedIds}
        entityLabel="ربط"
        options={[
          { value: "show", label: "إظهار على الموقع" },
          { value: "hide", label: "إخفاء من الموقع" },
          { value: "delete", label: "حذف الربط" },
        ]}
        onExecute={handleBulkExecute}
        onClearSelection={selection.clearSelection}
        isBusy={isPending}
      />

      <PageBlocksAssignmentsGrid
        rows={table.rows}
        sort={table.sort}
        onToggleSort={table.toggleSort}
        allSelected={selection.allSelected}
        selectedSet={selection.selectedSet}
        selectAllRef={selection.selectAllRef}
        onToggleAll={(checked) => selection.toggleAll(checked)}
        onToggleSelect={(rowId, checked) => selection.toggleOne(rowId, checked)}
        isPending={isPending}
        reorderInfo={reorderInfo}
        onReorder={handleReorder}
        onToggleVisibility={handleToggleVisibility}
        onDelete={setDeletingAssignment}
      />

      {assignModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={closeAssignModal}>
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">ربط بلوك بالصفحة</h3>
                <p className="mt-1 text-sm text-white/45">اختر قالبًا موجودًا — لن يُنشأ صف فارغ.</p>
              </div>
              <CloseButton onClick={closeAssignModal} />
            </div>

            <form
              action={
                assignModuleKind === "hero"
                  ? assignHeroAction
                  : assignModuleKind === "media-sidebar"
                    ? assignMediaSidebarAction
                    : assignModuleKind === "media-hub"
                      ? assignMediaHubAction
                      : assignBlockAction
              }
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <input type="hidden" name="page_id" value={page.id} />
              {assignModuleKind !== "hero" &&
              assignModuleKind !== "media-sidebar" &&
              assignModuleKind !== "media-hub" ? (
                <input type="hidden" name="block_type" value={assignModuleKind} />
              ) : null}
              <input type="hidden" name="is_visible" value={assignVisible ? "true" : "false"} />

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/55">نوع الموديول</span>
                <select
                  value={assignModuleKind}
                  onChange={(event) => {
                    setAssignModuleKind(event.target.value as AssignableModuleKind);
                    setAssignTemplateId(null);
                  }}
                  className={fieldClassName()}
                >
                  <option value="hero">Hero</option>
                  <option value="breadcrumb">Breadcrumb</option>
                  <option value="content">Content</option>
                  <option value="cta">CTA</option>
                  <option value="cards">Cards</option>
                  <option value="feed">Feed</option>
                  <option value="media-sidebar">Media Sidebar</option>
                  <option value="media-hub">Media Hub</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/55">القالب</span>
                <select
                  name="template_id"
                  required
                  className={fieldClassName()}
                  defaultValue=""
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    setAssignTemplateId(Number.isFinite(value) && value > 0 ? value : null);
                  }}
                >
                  <option value="" disabled>اختر قالبًا…</option>
                  {assignableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.status})
                    </option>
                  ))}
                </select>
                <AssignTemplateUsageWarning
                  moduleKind={assignModuleKind}
                  templateId={assignTemplateId}
                  currentPageId={page.id}
                />
                <p className="text-xs leading-6 text-white/42">
                  القوالب المرتبطة بهذه الصفحة لا تظهر في القائمة. لإعادة استخدام قالب، احذف الربط الحالي أو عدّله.
                </p>
                {!assignableTemplates.length ? (
                  <p className="text-xs text-amber-200/70">
                    {templateOptions.length
                      ? "كل القوالب مرتبطة بهذه الصفحة بالفعل."
                      : (
                        <>
                          لا توجد قوالب.{" "}
                          <Link
                            href={
                              assignModuleKind === "hero"
                                ? "/admin/pages-blocks/blocks/hero"
                                : blockModuleListHref(assignModuleKind as PageBlockType)
                            }
                            className="text-[#D8B87A] underline"
                          >
                            أنشئ موديولًا أولًا
                          </Link>
                        </>
                      )}
                  </p>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Slot</span>
                <select
                  name="slot"
                  defaultValue={
                    assignModuleKind === "breadcrumb" || assignModuleKind === "hero"
                      ? "hero"
                      : assignModuleKind === "feed" || assignModuleKind === "media-sidebar"
                        ? "sidebar"
                        : assignModuleKind === "media-hub"
                          ? "main"
                          : "main"
                  }
                  className={fieldClassName()}
                  disabled={assignModuleKind === "hero"}
                >
                  {slotOptions.map((slot) => (
                    <option key={slot} value={slot}>{slotLabels[slot] ?? slot}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Order</span>
                <input name="sort_order" type="number" min={0} step={10} placeholder="تلقائي" className={fieldClassName()} />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70 md:col-span-2">
                <span>ظاهر على الموقع</span>
                <input
                  type="checkbox"
                  checked={assignVisible}
                  onChange={(event) => setAssignVisible(event.target.checked)}
                  className="accent-[#D8B87A]"
                />
              </label>

              <p className="text-xs leading-6 text-amber-200/75 md:col-span-2">
                الربط الظاهر لا يكفي وحده — القالب يجب أن يكون <span className="font-semibold">منشورًا</span> ليظهر على الموقع العام.
              </p>

              {!assignState.ok && assignState.message ? (
                <p className="text-sm text-red-300 md:col-span-2">{assignState.message}</p>
              ) : null}
              {!assignHeroState.ok && assignHeroState.message ? (
                <p className="text-sm text-red-300 md:col-span-2">{assignHeroState.message}</p>
              ) : null}
              {!assignMediaSidebarState.ok && assignMediaSidebarState.message ? (
                <p className="text-sm text-red-300 md:col-span-2">{assignMediaSidebarState.message}</p>
              ) : null}
              {!assignMediaHubState.ok && assignMediaHubState.message ? (
                <p className="text-sm text-red-300 md:col-span-2">{assignMediaHubState.message}</p>
              ) : null}

              <div className="flex justify-end gap-3 md:col-span-2">
                <button type="button" onClick={closeAssignModal} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                  إلغاء
                </button>
                <button disabled={!assignableTemplates.length || assignPending} className="cursor-pointer rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-40">
                  ربط البلوك
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingAssignment ? (
        <PageBlocksDeleteConfirm
          assignment={deletingAssignment}
          pageTitle={page.title}
          isPending={isPending}
          onClose={() => setDeletingAssignment(null)}
          onConfirm={handleDeleteAssignment}
        />
      ) : null}
    </div>
  );
}
