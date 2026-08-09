"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AdminFeedbackRegion,
} from "../../../../../components/admin/AdminFeedbackProvider";
import AdminEntityListFilters from "../../../../../components/admin/entity-list/AdminEntityListFilters";
import AdminModuleTabs from "../../../../../components/admin/ui/AdminModuleTabs";
import PageVisualSlotMap from "../../../../../components/admin/page-blocks/PageVisualSlotMap";
import {
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
  AdminPageExperience,
  AdminTablePagination,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
  type AdminEntityFilterDef,
} from "../../../../../lib/admin/entity-list";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../../lib/page-blocks/admin-collection-columns";
import {
  moduleKindLabel,
  normalizeBoolean,
} from "../../../../../lib/page-blocks/admin-utils";
import { type PageBlockAssignmentRow } from "../../../../../lib/page-blocks/types";
import { resolvePagePublicPath } from "../../../../../lib/pages/page-admin-policy";
import {
  bulkPageBlockAssignments,
  deletePageBlockAssignment,
  duplicateAssignedPageModule,
  reorderPageComposition,
  togglePageBlockAssignment,
} from "../actions";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../../column-preferences";
import PageSeoPanel from "./PageSeoPanel";
import PageBlocksAssignModal from "./page-blocks/PageBlocksAssignModal";
import PageBlocksAssignmentsGrid from "./page-blocks/PageBlocksAssignmentsGrid";
import PageBlocksHeader, { PageModuleKindsSummary } from "./page-blocks/PageBlocksHeader";
import PageCompositionTableSurface from "./page-blocks/PageCompositionTableSurface";
import {
  assignmentRowId,
  isManageableAssignment,
} from "./page-blocks/page-blocks-utils";
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
    focusKeyword: string;
    seoKeywords: string[];
    canonicalUrl: string;
    robotsIndex: boolean | null;
    robotsFollow: boolean | null;
    ogImage: string;
    ogImageAlt: string;
    notice?: string | null;
    error?: string | null;
  };
  initialTabId?: string;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

type SortKey = "module_kind" | "template_name" | "visibility";

export default function PageBlocksClient({
  page,
  assignments,
  templates,
  seo,
  initialTabId,
  initialVisibleColumns = null,
  preferenceError = null,
}: PageBlocksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    ok: boolean;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const columnConfig = getPageCompositionColumnPreferenceConfig("pageAssignments");
  const defaultColumns = getPageCompositionDefaultColumnKeys("pageAssignments");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      "pageAssignments",
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const previewHref = resolvePagePublicPath(page);
  const setActionMessage = (message: string | null) =>
    setActionFeedback(message ? { message, ok: false } : null);

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
    pageSlug: page.slug,
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
  const search = searchParams.get("q") ?? "";
  const moduleType = searchParams.get("module_type") ?? "all";
  const visibility = searchParams.get("visibility") ?? "all";
  const assignmentFilters = useMemo<readonly AdminEntityFilterDef[]>(() => {
    const kinds = [...new Set(assignments.map((row) => row.module_kind))];
    return [
      {
        id: "assignment-module-type",
        paramKey: "module_type",
        label: "نوع الموديول",
        type: "single_select",
        allValue: "all",
        placeholder: "نوع الموديول",
        options: kinds.map((kind) => ({ value: kind, label: moduleKindLabel(kind) })),
      },
      {
        id: "assignment-visibility",
        paramKey: "visibility",
        label: "الظهور",
        type: "status",
        allValue: "all",
        placeholder: "الظهور",
        options: [
          { value: "visible", label: "ظاهر" },
          { value: "hidden", label: "مخفي" },
        ],
      },
    ];
  }, [assignments]);
  const filteredRows = useMemo(
    () =>
      table.rows.filter((row) => {
        if (
          search &&
          !adminCollectionSearchIncludes(
            `${row.template_name} ${moduleKindLabel(row.module_kind)} ${row.template_id}`,
            search,
          )
        ) return false;
        if (moduleType !== "all" && row.module_kind !== moduleType) return false;
        const rowVisibility = normalizeBoolean(row.is_visible, true) ? "visible" : "hidden";
        return visibility === "all" || rowVisibility === visibility;
      }),
    [moduleType, search, table.rows, visibility],
  );
  const assignmentDatasetKey = useMemo(
    () => `${search}|${moduleType}|${visibility}|${filteredRows.map(assignmentRowId).sort().join("|")}`,
    [filteredRows, moduleType, search, visibility],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredRows,
    datasetKey: assignmentDatasetKey,
  });
  const paginatedRows = pagination.rows;
  const manageableRows = useMemo(
    () => paginatedRows.filter(isManageableAssignment),
    [paginatedRows],
  );
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
        setActionFeedback({ message: result.message ?? "تعذر تحديث حالة الموديول.", ok: false });
        return;
      }
      setActionFeedback({ message: result.message ?? "تم تحديث حالة الموديول.", ok: true });
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
        setActionFeedback({ message: result.message ?? "تعذر تكرار الموديول.", ok: false });
        return;
      }
      setActionFeedback({ message: result.message ?? "تم تكرار الموديول.", ok: true });
      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      router.refresh();
    });
  }

  async function handleDeleteAssignment(row: PageBlockAssignmentRow) {
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("block_type", row.module_kind);

    const result = await deletePageBlockAssignment(formData);
    if (!result.ok) {
      setActionFeedback({ message: result.message ?? "تعذرت إزالة الموديول من الصفحة.", ok: false });
      return;
    }
    setActionFeedback({ message: result.message ?? "تمت إزالة الموديول من الصفحة.", ok: true });
    router.refresh();
  }

  function canMoveAssignment(row: PageBlockAssignmentRow, direction: -1 | 1) {
    if (table.sort.key !== null) return false;
    const siblings = assignments
      .filter((candidate) => candidate.slot === row.slot)
      .sort((left, right) => left.sort_order - right.sort_order || left.module_kind.localeCompare(right.module_kind) || left.id - right.id);
    const index = siblings.findIndex((candidate) => assignmentRowId(candidate) === assignmentRowId(row));
    return index >= 0 && index + direction >= 0 && index + direction < siblings.length;
  }

  function handleMoveAssignment(row: PageBlockAssignmentRow, direction: -1 | 1) {
    if (table.sort.key !== null) return;
    const siblings = assignments
      .filter((candidate) => candidate.slot === row.slot)
      .sort((left, right) => left.sort_order - right.sort_order || left.module_kind.localeCompare(right.module_kind) || left.id - right.id);
    const index = siblings.findIndex((candidate) => assignmentRowId(candidate) === assignmentRowId(row));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const ordered = [...siblings];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    startTransition(async () => {
      const result = await reorderPageComposition(
        page.id,
        row.slot,
        ordered.map((item) => ({ kind: item.module_kind, id: item.id, updated_at: item.updated_at })),
      );
      if (!result.ok) {
        setActionFeedback({ message: result.message, ok: false });
        return;
      }
      setActionFeedback({ message: result.warning ?? "تم حفظ ترتيب الموديولات ذريًا.", ok: true });
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

    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          await bulkPageBlockAssignments(formData);
          selection.clearSelection();
          setActionFeedback({
            message:
              action === "delete"
                ? "تمت إزالة الروابط المحددة من الصفحة."
                : "تم تحديث الروابط المحددة.",
            ok: true,
          });
          router.refresh();
          resolve();
        } catch (error) {
          setActionFeedback({
            message: "تعذر تنفيذ الإجراء الجماعي. لم يكتمل التغيير ويمكنك المحاولة مرة أخرى.",
            ok: false,
          });
          if (action === "delete") {
            reject(error);
            return;
          }
          resolve();
        }
      });
    });
  }

  return (
    <AdminPageExperience dir="rtl">
      <PageBlocksHeader
        page={page}
        previewHref={previewHref}
        onOpenAssignModal={openAssignModal}
      />

      <AdminModuleTabs
        initialTabId={initialTabId}
        navigationEventName="admin-page-blocks-navigation"
        activePanelContext={
          <AdminFeedbackRegion
            channel={`page-composition:${page.id}`}
            label="نتائج إجراءات تكوين الصفحة"
            feedback={
              actionFeedback
                ? {
                    variant: actionFeedback.ok ? "success" : "danger",
                    title: actionFeedback.ok ? "تم تنفيذ الإجراء" : "تعذر تنفيذ الإجراء",
                    message: actionFeedback.message,
                    layout: "inline",
                    dismissible: true,
                    lifecycle: "manual",
                  }
                : null
            }
          />
        }
        tabs={[
          {
            id: "seo",
            navigationLabel: "SEO",
            sectionHeading: "تحسين محركات البحث والمشاركة",
            sectionDescription: "أدر بيانات البحث والمشاركة والتحليل من عقد Entity SEO المشترك.",
            icon: "seo",
            content: (
              <PageSeoPanel
                pageId={page.id}
                pageTitle={page.title}
                path={page.path}
                seoTitle={seo.seoTitle}
                seoDescription={seo.seoDescription}
                focusKeyword={seo.focusKeyword}
                seoKeywords={seo.seoKeywords}
                canonicalUrl={seo.canonicalUrl}
                robotsIndex={seo.robotsIndex}
                robotsFollow={seo.robotsFollow}
                ogImage={seo.ogImage}
                ogImageAlt={seo.ogImageAlt}
                notice={seo.notice}
                error={seo.error}
              />
            ),
          },
          {
            id: "map",
            navigationLabel: "الخريطة",
            sectionHeading: "خريطة الصفحة",
            sectionDescription: "راجع ترتيب أقسام الصفحة وهيكل المحتوى الظاهر للزائر.",
            icon: "plans",
            content: (
              <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6" dir="rtl">
                <PageVisualSlotMap assignments={assignments} pageSlug={page.slug} />
              </section>
            ),
          },
          {
            id: "modules",
            navigationLabel: "الموديولات",
            sectionHeading: `مرجع موديولات الصفحة ${page.title || page.slug}`,
            sectionDescription: "أدر الموديولات المرتبطة بالصفحة وترتيبها وحالة ظهورها.",
            sectionSummary: <PageModuleKindsSummary usedModuleKinds={usedModuleKinds} />,
            icon: "section",
            content: (
              <PageCompositionTableSurface
                feedback={
                  <AdminFeedbackRegion
                    channel={`page-composition:${page.id}:columns`}
                    label="حالة تفضيلات أعمدة موديولات الصفحة"
                    feedback={
                      preferenceError
                        ? {
                            variant: "warning",
                            title: "تعذر تحميل تفضيلات الأعمدة",
                            message: preferenceError,
                            layout: "inline",
                            dismissible: true,
                            lifecycle: "persistent",
                          }
                        : null
                    }
                  />
                }
                toolbar={
                  <AdminEntityListFilters
                    surface="embedded"
                    basePath={`/admin/pages-blocks/pages/${page.id}`}
                    search={{
                      value: search,
                      placeholder: "ابحث باسم الموديول أو نوعه أو المعرّف…",
                      minLength: 1,
                      pending: isPending,
                    }}
                    filters={assignmentFilters}
                    values={{ module_type: moduleType, visibility }}
                    preserveParams={["tab"]}
                    columnsControl={
                      <AdminColumnVisibilityMenu
                        columns={columnConfig.columns}
                        visibleColumns={visibleColumns}
                        defaultColumns={defaultColumns}
                        onChange={setVisibleColumns}
                        onPersist={(next) =>
                          savePageCompositionColumnPreferences(
                            "pageAssignments",
                            next,
                          )
                        }
                        onRestore={() =>
                          restorePageCompositionColumnPreferences(
                            "pageAssignments",
                          )
                        }
                      />
                    }
                    contextOverrideActive={selection.selectedIds.length > 0}
                    contextOverride={
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
                    }
                    onQueryPatch={(patch, behavior = "push") => {
                      const next = applyAdminEntityUrlPatch(
                        new URLSearchParams(window.location.search),
                        patch,
                      );
                      const query = next.toString();
                      window.history[
                        behavior === "replace" ? "replaceState" : "pushState"
                      ](
                        window.history.state,
                        "",
                        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
                      );
                    }}
                  />
                }
                table={
                  <PageBlocksAssignmentsGrid
                    rows={paginatedRows}
                    previewHref={previewHref}
                    sort={table.sort}
                    onToggleSort={(key) => {
                      pagination.resetPage();
                      table.toggleSort(key);
                    }}
                    allSelected={selection.allSelected}
                    selectedSet={selection.selectedSet}
                    selectAllRef={selection.selectAllRef}
                    onToggleAll={(checked) => selection.toggleAll(checked)}
                    onToggleSelect={(rowId, checked) => selection.toggleOne(rowId, checked)}
                    isPending={isPending}
                    onToggleVisibility={handleToggleVisibility}
                    onDuplicate={handleDuplicateAssignment}
                    onDelete={handleDeleteAssignment}
                    canMove={canMoveAssignment}
                    onMove={handleMoveAssignment}
                    manualReorderEnabled={table.sort.key === null}
                    visibleColumns={visibleColumnSet}
                  />
                }
                pagination={
                  <AdminTablePagination
                  basePath={`/admin/pages-blocks/pages/${page.id}`}
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalCount={filteredRows.length}
                  pageSize={String(pagination.pageSize)}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                  pending={isPending}
                  />
                }
              />
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

    </AdminPageExperience>
  );
}
