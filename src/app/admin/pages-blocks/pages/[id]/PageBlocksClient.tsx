"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  AdminActionButton,
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActionsCell,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminDataGridSortLabel,
  AdminPageHeader,
  AdminStatusPill,
  AdminInfoBar,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import { useAdminTable } from "../../../../../components/admin/table-engine";
import { PAGE_BLOCK_ACTION_INITIAL } from "../../../../../lib/page-blocks/action-result";
import {
  blockModuleListHref,
  fieldClassName,
  moduleEditHref,
  moduleKindLabel,
  moduleListHref,
  normalizeBoolean,
  statusMeta,
} from "../../../../../lib/page-blocks/admin-utils";
import { PAGE_MODULE_HINTS } from "../../../../../lib/page-blocks/page-module-hints";
import { PAGE_LAYOUT_SLOTS, type PageBlockAssignmentRow, type PageBlockType, type PageModuleKind } from "../../../../../lib/page-blocks/types";
import { LAYOUT_SLOT_LABELS_AR, type PageLayoutSlot } from "../../../../../lib/page-blocks/layout-slots";
import {
  assignHeroModule,
  assignMediaHubModule,
  assignMediaSidebarModule,
  assignPageBlock,
  bulkPageBlockAssignments,
  deletePageBlockAssignment,
  togglePageBlockAssignment,
  updateHeroPageAssignment,
  updatePageBlockAssignment,
} from "../actions";

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

type AssignableModuleKind = PageBlockType | "hero" | "media-sidebar" | "media-hub";

type SortKey = "module_kind" | "template_name" | "slot" | "sort_order" | "visibility";

const gridColumns = `56px 110px minmax(220px,1.4fr) minmax(120px,0.7fr) 80px 100px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

function assignmentRowId(row: PageBlockAssignmentRow) {
  return `${row.module_kind}:${row.id}`;
}

function isManageableAssignment(row: PageBlockAssignmentRow) {
  return row.manages_assignment_on_page;
}

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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [placementAssignment, setPlacementAssignment] = useState<PageBlockAssignmentRow | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<PageBlockAssignmentRow | null>(null);
  const [assignModuleKind, setAssignModuleKind] = useState<AssignableModuleKind>("content");
  const [assignVisible, setAssignVisible] = useState(true);
  const [editVisible, setEditVisible] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [assignState, assignBlockAction, assignBlockPending] = useActionState(assignPageBlock, PAGE_BLOCK_ACTION_INITIAL);
  const [assignHeroState, assignHeroAction, assignHeroPending] = useActionState(assignHeroModule, PAGE_BLOCK_ACTION_INITIAL);
  const [assignMediaSidebarState, assignMediaSidebarAction, assignMediaSidebarPending] = useActionState(
    assignMediaSidebarModule,
    PAGE_BLOCK_ACTION_INITIAL,
  );
  const [assignMediaHubState, assignMediaHubAction, assignMediaHubPending] = useActionState(
    assignMediaHubModule,
    PAGE_BLOCK_ACTION_INITIAL,
  );
  const assignPending = assignBlockPending || assignHeroPending || assignMediaSidebarPending || assignMediaHubPending;
  const [assignModalSession, setAssignModalSession] = useState(0);
  const [assignDismissSession, setAssignDismissSession] = useState<number | null>(null);
  const [assignSubmitSession, setAssignSubmitSession] = useState<number | null>(null);
  const [prevAssignPending, setPrevAssignPending] = useState(assignPending);
  const [assignRefreshNonce, setAssignRefreshNonce] = useState(0);
  const assignModalOpen = showAssignModal && assignDismissSession !== assignModalSession;

  if (assignPending !== prevAssignPending) {
    setPrevAssignPending(assignPending);

      if (assignPending) {
      setAssignSubmitSession(assignModalSession);
    } else if (showAssignModal) {
      if (assignState.ok || assignHeroState.ok || assignMediaSidebarState.ok || assignMediaHubState.ok) {
        setAssignDismissSession(assignModalSession);
        setAssignVisible(true);
        setActionMessage(null);
        setAssignRefreshNonce((value) => value + 1);
      } else if (assignSubmitSession === assignModalSession) {
        setActionMessage(assignState.message ?? assignHeroState.message ?? assignMediaSidebarState.message ?? assignMediaHubState.message);
      }
    }
  }

  useEffect(() => {
    if (assignRefreshNonce === 0) return;
    router.refresh();
  }, [assignRefreshNonce, router]);

  const sortAccessors = useMemo(
    () => ({
      module_kind: (row: PageBlockAssignmentRow) => moduleKindLabel(row.module_kind),
      template_name: (row: PageBlockAssignmentRow) => row.template_name,
      slot: (row: PageBlockAssignmentRow) => row.slot,
      sort_order: (row: PageBlockAssignmentRow) => row.sort_order,
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

  const templateOptions =
    assignModuleKind === "hero"
      ? templates.hero
      : assignModuleKind === "media-sidebar"
        ? templates.mediaSidebar
        : assignModuleKind === "media-hub"
          ? templates.mediaHub
          : templates[assignModuleKind as PageBlockType] ?? [];

  const assignedTemplateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const assignment of assignments) {
      if (assignModuleKind === "hero" && assignment.module_kind === "hero") {
        ids.add(assignment.template_id);
      } else if (assignModuleKind === "media-sidebar" && assignment.module_kind === "media-sidebar") {
        ids.add(assignment.template_id);
      } else if (assignModuleKind === "media-hub" && assignment.module_kind === "media-hub") {
        ids.add(assignment.template_id);
      } else if (assignment.block_type === assignModuleKind) {
        ids.add(assignment.template_id);
      }
    }
    return ids;
  }, [assignments, assignModuleKind]);

  const pageHints = PAGE_MODULE_HINTS[page.slug] ?? null;

  const slotOptions = useMemo((): PageLayoutSlot[] => {
    if (assignModuleKind === "hero" || assignModuleKind === "breadcrumb") {
      return ["hero"];
    }
    if (assignModuleKind === "feed" || assignModuleKind === "media-sidebar") {
      return ["sidebar"];
    }
    if (assignModuleKind === "media-hub") {
      return ["main"];
    }
    return [...PAGE_LAYOUT_SLOTS];
  }, [assignModuleKind]);

  const placementSlotOptions = useMemo((): PageLayoutSlot[] => {
    if (!placementAssignment) return [...PAGE_LAYOUT_SLOTS];
    if (placementAssignment.module_kind === "hero" || placementAssignment.module_kind === "breadcrumb") {
      return ["hero"];
    }
    if (placementAssignment.module_kind === "feed" || placementAssignment.module_kind === "media-sidebar") {
      return ["sidebar"];
    }
    if (placementAssignment.module_kind === "media-hub") {
      return ["main"];
    }
    return [...PAGE_LAYOUT_SLOTS];
  }, [placementAssignment]);

  const assignableTemplates = useMemo(
    () => templateOptions.filter((template) => !assignedTemplateIds.has(template.id)),
    [templateOptions, assignedTemplateIds],
  );

  useEffect(() => {
    table.setRows(assignments);
  }, [assignments, table.setRows]);

  function sortProps(key: SortKey) {
    return {
      active: table.sort.key === key,
      direction: table.sort.direction,
      onClick: () => table.toggleSort(key),
    } as const;
  }

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

  function handleUpdatePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placementAssignment) return;

    const formData = new FormData(event.currentTarget);
    formData.set("is_visible", editVisible ? "true" : "false");

    startTransition(async () => {
      const result =
        placementAssignment.module_kind === "hero"
          ? await updateHeroPageAssignment(PAGE_BLOCK_ACTION_INITIAL, formData)
          : await updatePageBlockAssignment(PAGE_BLOCK_ACTION_INITIAL, formData);

      if (!result.ok) {
        setActionMessage(result.message);
        return;
      }
      setPlacementAssignment(null);
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
      <AdminPageHeader
        eyebrow="Page Modules Manager"
        title={page.title}
        description="عرض الموديولات المعيّنة حسب Layout Slots (hero · main · sidebar · bottom · footer). عدّل المحتوى من مدير الموديول — هنا تتحكم بالربط والترتيب داخل كل slot."
        meta={`${page.path} · ${page.slug} · ${assignments.length} موديول`}
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            <AdminActionButton href="/admin/pages-blocks/pages" variant="ghost">
              رجوع للصفحات
            </AdminActionButton>
            <AdminActionButton href="/admin/pages-blocks/blocks" variant="ghost">
              Blocks Hub
            </AdminActionButton>
            <AdminActionButton href={page.path || "#"} variant="ghost">
              معاينة
            </AdminActionButton>
            <button
              type="button"
              onClick={() => {
                setAssignModalSession((session) => session + 1);
                setShowAssignModal(true);
              }}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
            >
              ربط موديول
            </button>
          </div>
        )}
      />

      {pageHints ? (
        <AdminInfoBar
          label={`مرجع موديولات ${page.slug}`}
          description={pageHints
            .map((hint) => {
              const slugText = hint.slugs.length ? hint.slugs.join(", ") : hint.note ?? "—";
              return `${hint.module}: ${slugText}`;
            })
            .join(" · ")}
        />
      ) : null}

      {actionMessage ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {actionMessage}
        </div>
      ) : null}

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

      <AdminDataGrid summary={`${table.rows.length} موديول`}>
        <AdminDataGridHeader columns={gridColumns}>
          <div className="flex justify-center">
            <AdminDataGridCheckbox
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد الكل"
            />
          </div>
          <AdminDataGridSortLabel {...sortProps("module_kind")}>النوع</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("template_name")}>القالب</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("slot")}>Slot</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("sort_order")} className="mx-auto">Order</AdminDataGridSortLabel>
          <AdminDataGridSortLabel {...sortProps("visibility")} className="mx-auto">الحالة</AdminDataGridSortLabel>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {table.rows.map((row) => {
          const templateStatus = statusMeta(row.template_status);
          const isVisible = normalizeBoolean(row.is_visible, true);
          const manageable = isManageableAssignment(row);
          return (
            <AdminDataGridRow key={assignmentRowId(row)} columns={gridColumns}>
              <div className="flex justify-center xl:block">
                {manageable ? (
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(assignmentRowId(row))}
                    onChange={(event) => selection.toggleOne(assignmentRowId(row), event.target.checked)}
                    label={`تحديد ${row.template_name}`}
                  />
                ) : (
                  <span className="text-xs text-white/25">—</span>
                )}
              </div>
              <div>
                <Link href={moduleListHref(row.module_kind)} className="font-semibold text-[#D8B87A] hover:text-[#e5c98d]">
                  {moduleKindLabel(row.module_kind)}
                </Link>
                <p className="mt-1 font-mono text-xs text-white/35">{row.template_variant}</p>
              </div>

              <div className="min-w-0">
                <Link href={moduleEditHref(row.module_kind, row.template_id)} className="font-semibold text-white hover:text-[#D8B87A]">
                  {row.template_name}
                </Link>
                <p className="mt-1 font-mono text-xs text-white/35" dir="ltr">{row.template_slug}</p>
                <AdminStatusPill tone={templateStatus.tone}>
                  {row.module_kind === "hero" ? `هيرو: ${templateStatus.label}` : `قالب: ${templateStatus.label}`}
                </AdminStatusPill>
                {row.module_kind !== "hero" && row.template_status !== "published" ? (
                  <p className="mt-1 text-[10px] leading-5 text-amber-200/75">
                    لن يظهر على الموقع حتى يُنشر القالب من Block Module.
                  </p>
                ) : null}
                {row.assignment_note ? (
                  <p className="mt-1 text-[10px] leading-5 text-white/40">{row.assignment_note}</p>
                ) : null}
              </div>

              <div className="text-white/58">{slotLabels[row.slot as keyof typeof slotLabels] ?? row.slot}</div>
              <div className="text-center font-mono text-xs text-white/42">{row.sort_order}</div>

              <div className="flex justify-center">
                <AdminStatusPill tone={isVisible ? "green" : "muted"}>
                  {isVisible ? "ظاهر" : "مخفي"}
                </AdminStatusPill>
              </div>

              <AdminDataGridActionsCell compact>
                <AdminDataGridActionButton
                  action="edit"
                  title="تعديل الموديول"
                  href={moduleEditHref(row.module_kind, row.template_id)}
                  size="compact"
                />
                {manageable ? (
                  <>
                    <AdminDataGridActionButton
                      title="ترتيب وموضع"
                      size="compact"
                      onClick={() => {
                        setEditVisible(normalizeBoolean(row.is_visible, true));
                        setPlacementAssignment(row);
                      }}
                    >
                      ↕
                    </AdminDataGridActionButton>
                    <AdminDataGridActionButton
                      action="visibility"
                      title={isVisible ? "إخفاء" : "إظهار"}
                      size="compact"
                      disabled={isPending}
                      onClick={() => handleToggleVisibility(row)}
                    />
                    <AdminDataGridActionButton action="delete" title="حذف الربط" size="compact" onClick={() => setDeletingAssignment(row)} />
                  </>
                ) : null}
              </AdminDataGridActionsCell>
            </AdminDataGridRow>
          );
        })}

        {!table.rows.length ? (
          <AdminDataGridEmpty>
            لا توجد موديولات معيّنة. أنشئ موديولًا من Blocks Hub ثم اضغط «ربط موديول»، أو عيّن Hero من Hero Manager.
          </AdminDataGridEmpty>
        ) : null}
      </AdminDataGrid>

      {assignModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowAssignModal(false)}>
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">ربط بلوك بالصفحة</h3>
                <p className="mt-1 text-sm text-white/45">اختر قالبًا موجودًا — لن يُنشأ صف فارغ.</p>
              </div>
              <CloseButton onClick={() => setShowAssignModal(false)} />
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
                  onChange={(event) => setAssignModuleKind(event.target.value as AssignableModuleKind)}
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
                <select name="template_id" required className={fieldClassName()} defaultValue="">
                  <option value="" disabled>اختر قالبًا…</option>
                  {assignableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.status})
                    </option>
                  ))}
                </select>
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
                <button type="button" onClick={() => setShowAssignModal(false)} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
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

      {placementAssignment ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setPlacementAssignment(null)}>
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">ترتيب وموضع الربط</h3>
                <p className="mt-1 text-sm text-white/45">
                  {moduleKindLabel(placementAssignment.module_kind)} · {placementAssignment.template_name}
                </p>
              </div>
              <CloseButton onClick={() => setPlacementAssignment(null)} />
            </div>

            <form key={placementAssignment.id} onSubmit={handleUpdatePlacement} className="mt-5 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="page_id" value={page.id} />
              <input type="hidden" name="assignment_id" value={placementAssignment.id} />
              <input type="hidden" name="block_type" value={placementAssignment.block_type ?? placementAssignment.module_kind} />

              <div className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/55">الموديول</span>
                <div className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3">
                  <p className="font-semibold text-white">{placementAssignment.template_name}</p>
                  <p className="mt-1 font-mono text-xs text-white/45" dir="ltr">{placementAssignment.template_slug}</p>
                </div>
                <p className="text-xs leading-6 text-white/42">
                  لتعديل المحتوى، افتح الموديول من{" "}
                  <Link href={moduleEditHref(placementAssignment.module_kind, placementAssignment.template_id)} className="text-[#D8B87A] underline">
                    {moduleKindLabel(placementAssignment.module_kind)} Manager
                  </Link>
                  . لتغيير القالب، احذف هذا الربط وأنشئ ربطًا جديدًا.
                </p>
              </div>

              {placementAssignment.module_kind !== "hero" ? (
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-white/55">Slot</span>
                  <select name="slot" defaultValue={placementAssignment.slot} className={fieldClassName()}>
                    {placementSlotOptions.map((slot) => (
                      <option key={slot} value={slot}>{slotLabels[slot] ?? slot}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="slot" value="hero" />
              )}

              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Order</span>
                <input name="sort_order" type="number" defaultValue={placementAssignment.sort_order} className={fieldClassName()} />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70 md:col-span-2">
                <span>ظاهر على الموقع</span>
                <input
                  type="checkbox"
                  checked={editVisible}
                  onChange={(event) => setEditVisible(event.target.checked)}
                  className="accent-[#D8B87A]"
                />
              </label>

              <div className="flex justify-end gap-3 md:col-span-2">
                <button type="button" onClick={() => setPlacementAssignment(null)} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                  إلغاء
                </button>
                <button disabled={isPending} className="cursor-pointer rounded-2xl bg-[#D8B87A] px-5 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d] disabled:cursor-not-allowed disabled:opacity-40">
                  حفظ الربط
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingAssignment ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setDeletingAssignment(null)}>
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">تأكيد حذف الربط</h3>
                <p className="mt-1 text-sm text-white/45">يُحذف الربط من هذه الصفحة فقط — القالب يبقى في المكتبة.</p>
              </div>
              <CloseButton onClick={() => setDeletingAssignment(null)} />
            </div>
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-7 text-red-100">
              حذف {moduleKindLabel(deletingAssignment.module_kind)} «{deletingAssignment.template_name}» من {page.title}؟
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingAssignment(null)} className="cursor-pointer rounded-2xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                إلغاء
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteAssignment}
                className="cursor-pointer rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                حذف الربط
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
