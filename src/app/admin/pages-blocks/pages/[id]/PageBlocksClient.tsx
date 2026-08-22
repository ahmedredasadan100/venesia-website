"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  useAdminBoundedClientPagination,
  type AdminBoundedClientQueryContract,
  type AdminEntityFilterDef,
} from "../../../../../lib/admin/entity-list";
import { useAdminBoundedClientInstantMutation } from "../../../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../../lib/page-blocks/admin-collection-columns";
import {
  isPageModulePubliclyVisible,
  moduleKindLabel,
  normalizeBoolean,
} from "../../../../../lib/page-blocks/admin-utils";
import { resolveModuleProductKind } from "../../../../../lib/page-blocks/module-edit-registry";
import {
  LAYOUT_SLOT_LABELS_AR,
  PAGE_LAYOUT_SLOT_ORDER,
  normalizeLayoutSlot,
} from "../../../../../lib/page-blocks/layout-slots";
import { type PageBlockAssignmentRow } from "../../../../../lib/page-blocks/types";
import { resolvePagePublicPath } from "../../../../../lib/pages/page-admin-policy";
import {
  bulkPageBlockAssignments,
  detachPageBlockAssignment,
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

type SortKey = "module_kind" | "template_name" | "slot" | "visibility";

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
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    ok: boolean;
  } | null>(null);
  const instant = useAdminBoundedClientInstantMutation<PageBlockAssignmentRow>({
    entity: "page-block-assignments",
    initialRows: assignments,
    datasetKey: String(page.id),
  });
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
      module_kind: (row: PageBlockAssignmentRow) =>
        moduleKindLabel(row.module_kind, row.template_slug, row.template_variant),
      template_name: (row: PageBlockAssignmentRow) => row.template_name,
      slot: (row: PageBlockAssignmentRow) => PAGE_LAYOUT_SLOT_ORDER.indexOf(normalizeLayoutSlot(row.slot)),
      visibility: (row: PageBlockAssignmentRow) =>
        (normalizeBoolean(row.is_publicly_visible, false) ? 0 : 1),
    }),
    [],
  );

  const table = useAdminTable<PageBlockAssignmentRow, SortKey>({
    initialRows: instant.rows,
    getRowId: (row) => assignmentRowId(row),
    sortAccessors,
  });
  const assignmentFilters = useMemo<readonly AdminEntityFilterDef[]>(() => {
    const kinds = [
      ...new Set(
        assignments.map((row) =>
          resolveModuleProductKind(row.module_kind, row.template_slug, row.template_variant),
        ),
      ),
    ];
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
        id: "assignment-slot",
        paramKey: "slot",
        label: "الموضع",
        type: "single_select",
        allValue: "all",
        placeholder: "الموضع",
        options: PAGE_LAYOUT_SLOT_ORDER.map((value) => ({
          value,
          label: LAYOUT_SLOT_LABELS_AR[value],
        })),
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
  const queryContract = useMemo<
    AdminBoundedClientQueryContract<PageBlockAssignmentRow>
  >(
    () => ({
      mode: "bounded-client",
      search: { minLength: 1 },
      filters: assignmentFilters,
      matchesRow: (row, query) => {
        if (
          query.search &&
          !adminCollectionSearchIncludes(
            `${row.template_name} ${moduleKindLabel(row.module_kind, row.template_slug, row.template_variant)} ${LAYOUT_SLOT_LABELS_AR[normalizeLayoutSlot(row.slot)]} ${row.template_id}`,
            query.search,
          )
        ) return false;
        const moduleType = query.filters.module_type;
        const slot = query.filters.slot;
        const visibility = query.filters.visibility;
        if (
          moduleType !== "all" &&
          resolveModuleProductKind(row.module_kind, row.template_slug, row.template_variant) !== moduleType
        ) return false;
        if (slot !== "all" && normalizeLayoutSlot(row.slot) !== slot) return false;
        const rowVisibility = normalizeBoolean(row.is_publicly_visible, false)
          ? "visible"
          : "hidden";
        return visibility === "all" || rowVisibility === visibility;
      },
      getRowId: assignmentRowId,
    }),
    [assignmentFilters],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: table.rows,
    datasetKey: String(page.id),
    queryContract,
  });
  const search = pagination.search;
  const moduleType = pagination.filterValues.module_type;
  const slot = pagination.filterValues.slot;
  const visibility = pagination.filterValues.visibility;
  const paginatedRows = pagination.rows;
  const manageableRows = useMemo(
    () => paginatedRows.filter(isManageableAssignment),
    [paginatedRows],
  );
  const visibleRowIds = useMemo(() => manageableRows.map((row) => assignmentRowId(row)), [manageableRows]);
  const selection = useAdminGridSelection<string>(visibleRowIds);

  const usedModuleKinds = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ productKind: string; listKind: string }> = [];
    for (const assignment of assignments) {
      const productKind = resolveModuleProductKind(
        assignment.module_kind,
        assignment.template_slug,
        assignment.template_variant,
      );
      if (seen.has(productKind)) continue;
      seen.add(productKind);
      list.push({ productKind, listKind: assignment.module_kind });
    }
    return list;
  }, [assignments]);

  const { setRows } = table;

  useEffect(() => {
    setRows(instant.rows);
  }, [instant.rows, setRows]);

  async function handleToggleVisibility(row: PageBlockAssignmentRow) {
    if (!isManageableAssignment(row)) return;
    const isVisible = normalizeBoolean(row.is_visible, true);
    const nextAssignmentVisible = !isVisible;
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("block_type", row.module_kind);
    formData.set("next_visible", isVisible ? "false" : "true");

    try {
      const result = await instant.mutateAsync({
        rowId: assignmentRowId(row),
        action: "visibility",
        optimistic: (cache) =>
          cache.patchRows((candidate) =>
            assignmentRowId(candidate) === assignmentRowId(row)
              ? {
                  ...candidate,
                  is_visible: nextAssignmentVisible,
                  is_publicly_visible: isPageModulePubliclyVisible(
                    nextAssignmentVisible,
                    candidate.template_status,
                  ),
                }
              : candidate,
          ),
        execute: async () => {
          const response = await togglePageBlockAssignment(formData);
          return response.ok
            ? {
                ok: true as const,
                message: response.message ?? "تم تحديث حالة الموديول.",
              }
            : {
                ok: false as const,
                code: "assignment_visibility_failed",
                message: response.message ?? "تعذر تحديث حالة الموديول.",
              };
        },
      });
      setActionFeedback({ message: result.message, ok: true });
    } catch (error) {
      setActionFeedback({
        message:
          error instanceof Error
            ? error.message
            : "تعذر تحديث حالة الموديول.",
        ok: false,
      });
    }
  }

  async function handleDuplicateAssignment(row: PageBlockAssignmentRow) {
    if (!isManageableAssignment(row) && row.module_kind !== "hero") return;

    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("template_id", String(row.template_id));
    formData.set("module_kind", row.module_kind);

    try {
      let redirectTo: string | null = null;
      const result = await instant.mutateAsync({
        rowId: assignmentRowId(row),
        action: "duplicate",
        optimistic: () => undefined,
        execute: async () => {
          const response = await duplicateAssignedPageModule(formData);
          if (!response.ok) {
            return {
              ok: false as const,
              code: "assignment_duplicate_failed",
              message: response.message ?? "تعذر تكرار الموديول.",
            };
          }
          redirectTo = response.redirectTo ?? null;
          return {
            ok: true as const,
            message: response.message ?? "تم تكرار الموديول.",
          };
        },
      });
      setActionFeedback({ message: result.message, ok: true });
      if (redirectTo) {
        router.push(redirectTo);
        return;
      }
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : "تعذر تكرار الموديول.",
        ok: false,
      });
    }
  }

  async function handleDetachAssignment(row: PageBlockAssignmentRow) {
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("assignment_id", String(row.id));
    formData.set("block_type", row.module_kind);

    try {
      const result = await instant.mutateAsync({
        rowId: assignmentRowId(row),
        action: "delete",
        optimistic: (cache) => cache.removeRows(new Set([assignmentRowId(row)])),
        execute: async () => {
          const response = await detachPageBlockAssignment(formData);
          return response.ok
            ? { ok: true as const, message: response.message ?? "تمت إزالة الموديول من الصفحة." }
            : { ok: false as const, code: "assignment_detach_failed", message: response.message ?? "تعذرت إزالة الموديول من الصفحة." };
        },
      });
      setActionFeedback({ message: result.message, ok: true });
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : "تعذرت إزالة الموديول من الصفحة.",
        ok: false,
      });
    }
  }

  function canMoveAssignment(row: PageBlockAssignmentRow, direction: -1 | 1) {
    if (table.sort.key !== null) return false;
    const siblings = instant.rows
      .filter((candidate) => candidate.slot === row.slot)
      .sort((left, right) => left.sort_order - right.sort_order || left.module_kind.localeCompare(right.module_kind) || left.id - right.id);
    const index = siblings.findIndex((candidate) => assignmentRowId(candidate) === assignmentRowId(row));
    return index >= 0 && index + direction >= 0 && index + direction < siblings.length;
  }

  async function handleMoveAssignment(row: PageBlockAssignmentRow, direction: -1 | 1) {
    if (table.sort.key !== null) return;
    const siblings = instant.rows
      .filter((candidate) => candidate.slot === row.slot)
      .sort((left, right) => left.sort_order - right.sort_order || left.module_kind.localeCompare(right.module_kind) || left.id - right.id);
    const index = siblings.findIndex((candidate) => assignmentRowId(candidate) === assignmentRowId(row));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    const ordered = [...siblings];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const sortOrderByRowId = new Map(
      ordered.map((item, orderedIndex) => [
        assignmentRowId(item),
        siblings[orderedIndex].sort_order,
      ]),
    );
    try {
      let warning: string | null = null;
      const result = await instant.mutateAsync({
        rowId: assignmentRowId(row),
        action: direction === -1 ? "reorder-up" : "reorder-down",
        optimistic: (cache) =>
          cache.patchRows((candidate) => {
            const sortOrder = sortOrderByRowId.get(assignmentRowId(candidate));
            return sortOrder == null ? candidate : { ...candidate, sort_order: sortOrder };
          }),
        execute: async () => {
          const response = await reorderPageComposition(
            page.id,
            row.slot,
            ordered.map((item) => ({ kind: item.module_kind, id: item.id, updated_at: item.updated_at })),
          );
          if (!response.ok) {
            return { ok: false as const, code: response.code, message: response.message };
          }
          warning = response.warning ?? null;
          return { ok: true as const, message: response.warning ?? "تم حفظ ترتيب الموديولات ذريًا." };
        },
      });
      setActionFeedback({ message: warning ?? result.message, ok: true });
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : "تعذر حفظ ترتيب الموديولات.",
        ok: false,
      });
    }
  }

  async function handleBulkExecute(action: string, ids: string[]) {
    const formData = new FormData();
    formData.set("page_id", String(page.id));
    formData.set("bulk_action", action);
    for (const id of ids) {
      formData.append("ids", id);
    }

    try {
      const idSet = new Set(ids);
      await instant.mutateAsync({
        action: `bulk-${action}`,
        bulk: true,
        optimistic: (cache) => {
          if (action === "detach") {
            cache.removeRows(idSet);
            return;
          }
          cache.patchRows((candidate) =>
            idSet.has(assignmentRowId(candidate))
              ? {
                  ...candidate,
                  is_visible: action === "show",
                  is_publicly_visible: isPageModulePubliclyVisible(
                    action === "show",
                    candidate.template_status,
                  ),
                }
              : candidate,
          );
        },
        execute: async () => {
          await bulkPageBlockAssignments(formData);
          return {
            ok: true as const,
            message: action === "detach" ? "تمت إزالة الروابط المحددة من الصفحة." : "تم تحديث الروابط المحددة.",
          };
        },
      });
      selection.clearSelection();
      setActionFeedback({
        message: action === "detach" ? "تمت إزالة الروابط المحددة من الصفحة." : "تم تحديث الروابط المحددة.",
        ok: true,
      });
    } catch (error) {
      setActionFeedback({
        message: error instanceof Error ? error.message : "تعذر تنفيذ الإجراء الجماعي. لم يكتمل التغيير ويمكنك المحاولة مرة أخرى.",
        ok: false,
      });
      if (action === "detach") throw error;
    }
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
            placement="global"
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
                    }}
                    filters={assignmentFilters}
                    values={{ module_type: moduleType, slot, visibility }}
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
                          {
                            value: "detach",
                            label: "إزالة المحدد من الصفحة",
                            confirmation: {
                              title: "إزالة الروابط المحددة من الصفحة؟",
                              description:
                                "ستتم إزالة روابط الموديولات المحددة من هذه الصفحة فقط. ستبقى الموديولات وقوالبها في المكتبة.",
                              confirmLabel: "إزالة من الصفحة",
                            },
                          },
                        ]}
                        onExecute={handleBulkExecute}
                        onClearSelection={selection.clearSelection}
                        isBusy={instant.bulkInteraction.isBlocked}
                      />
                    }
                    onQueryPatch={pagination.applyQueryPatch}
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
                    rowInteraction={instant.getRowInteraction}
                    onToggleVisibility={handleToggleVisibility}
                    onDuplicate={handleDuplicateAssignment}
                    onDetach={handleDetachAssignment}
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
                  totalCount={pagination.totalCount}
                  pageSize={String(pagination.pageSize)}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
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
