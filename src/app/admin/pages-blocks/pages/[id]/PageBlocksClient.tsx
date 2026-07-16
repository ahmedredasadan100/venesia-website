"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import AdminModuleTabs from "../../../../../components/admin/page-blocks/AdminModuleTabs";
import PageVisualSlotMap from "../../../../../components/admin/page-blocks/PageVisualSlotMap";
import { AdminBulkActionBar, useAdminGridSelection } from "../../../../../components/admin/ui";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import {
  moduleKindLabel,
  normalizeBoolean,
} from "../../../../../lib/page-blocks/admin-utils";
import { type PageBlockAssignmentRow } from "../../../../../lib/page-blocks/types";
import {
  bulkPageBlockAssignments,
  deletePageBlockAssignment,
  duplicateAssignedPageModule,
  togglePageBlockAssignment,
} from "../actions";
import PageSeoPanel from "./PageSeoPanel";
import PageBlocksAssignModal from "./page-blocks/PageBlocksAssignModal";
import PageBlocksAssignmentsGrid from "./page-blocks/PageBlocksAssignmentsGrid";
import PageBlocksDeleteConfirm from "./page-blocks/PageBlocksDeleteConfirm";
import PageBlocksHeader, { PageModuleKindsBar } from "./page-blocks/PageBlocksHeader";
import { buildReorderInfo } from "./page-blocks/build-reorder-info";
import {
  assignmentRowId,
  isManageableAssignment,
} from "./page-blocks/page-blocks-utils";
import { usePageBlocksReorder } from "./page-blocks/use-page-blocks-reorder";
import { usePageBlocksAssignModal } from "./page-blocks/use-page-blocks-assign-modal";

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
  seo: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    notice?: string | null;
    error?: string | null;
  };
  initialTabId?: string;
};

type SortKey = "module_kind" | "template_name" | "visibility";

export default function PageBlocksClient({
  page,
  assignments,
  templates,
  seo,
  initialTabId,
}: PageBlocksClientProps) {
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

  function handleDuplicateAssignment(row: PageBlockAssignmentRow) {
    if (!isManageableAssignment(row) && row.module_kind !== "hero") return;

    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("template_id", String(row.template_id));
    formData.set("module_kind", row.module_kind);

    startTransition(async () => {
      const result = await duplicateAssignedPageModule(formData);
      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setActionMessage(result.message);
      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
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
        onOpenAssignModal={openAssignModal}
      />

      {actionMessage ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {actionMessage}
        </div>
      ) : null}

      <AdminModuleTabs
        initialTabId={initialTabId}
        tabs={[
          {
            id: "seo",
            label: "إعدادات السيو",
            content: (
              <PageSeoPanel
                pageId={page.id}
                path={page.path}
                seoTitle={seo.seoTitle}
                seoDescription={seo.seoDescription}
                seoKeywords={seo.seoKeywords}
                notice={seo.notice}
                error={seo.error}
              />
            ),
          },
          {
            id: "map",
            label: "خريطة الصفحة",
            content: (
              <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6" dir="rtl">
                <div className="mb-6 border-b border-white/10 pb-5">
                  <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PAGE MAP</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">خريطة الصفحة</h2>
                  <p className="mt-2 text-sm leading-7 text-white/50">
                    راجع ترتيب أقسام الصفحة وهيكل المحتوى الظاهر للزائر.
                  </p>
                </div>
                <PageVisualSlotMap assignments={assignments} />
              </section>
            ),
          },
          {
            id: "modules",
            label: "موديولات الصفحة",
            content: (
              <section className="space-y-4 rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6" dir="rtl">
                <div className="border-b border-white/10 pb-5">
                  <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">PAGE MODULES</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">موديولات الصفحة</h2>
                  <p className="mt-2 text-sm leading-7 text-white/50">
                    إدارة الموديولات المرتبطة بالصفحة والتحكم في ترتيبها وظهورها.
                  </p>
                </div>

                <PageModuleKindsBar page={page} usedModuleKinds={usedModuleKinds} />

                <AdminBulkActionBar
                  selectedIds={selection.selectedIds}
                  entityLabel="ربط"
                  options={[
                    { value: "show", label: "إظهار على الموقع" },
                    { value: "hide", label: "إخفاء من الموقع" },
                    { value: "delete", label: "إزالة من الصفحة" },
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
                  onDuplicate={handleDuplicateAssignment}
                  onDelete={setDeletingAssignment}
                />
              </section>
            ),
          },
        ]}
      />

      {assignModalOpen ? (
        <PageBlocksAssignModal
          pageId={page.id}
          onClose={closeAssignModal}
          assignModuleKind={assignModuleKind}
          onAssignModuleKindChange={setAssignModuleKind}
          assignTemplateId={assignTemplateId}
          onAssignTemplateIdChange={setAssignTemplateId}
          assignVisible={assignVisible}
          onAssignVisibleChange={setAssignVisible}
          assignPending={assignPending}
          templateOptions={templateOptions}
          assignableTemplates={assignableTemplates}
          slotOptions={slotOptions}
          assignState={assignState}
          assignHeroState={assignHeroState}
          assignMediaSidebarState={assignMediaSidebarState}
          assignMediaHubState={assignMediaHubState}
          assignBlockAction={assignBlockAction}
          assignHeroAction={assignHeroAction}
          assignMediaSidebarAction={assignMediaSidebarAction}
          assignMediaHubAction={assignMediaHubAction}
        />
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
