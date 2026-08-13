"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import AdminEntityListFilters from "../../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../../../../../components/admin/AdminFeedbackProvider";
import MediaSynchronizationWarningNotice from "../../../../../components/admin/media/MediaSynchronizationWarningNotice";
import { ModuleEditorStatusSwitch } from "../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_FORM,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminBulkActionBar,
  AdminColumnVisibilityMenu,
  AdminDataGrid,
  AdminDataGridCheckbox,
  AdminDataGridCheckboxCell,
  AdminDataGridCenterCell,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridPrimaryCell,
  AdminDataGridRow,
  AdminDataGridRowActions,
  AdminDataGridStatusCell,
  AdminFormError,
  AdminFormRuntime,
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageExperience,
  AdminPageContextHeader,
  AdminTablePagination,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import type { AdminFormRuntimeHandle } from "../../../../../components/admin/ui/AdminFormRuntime";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
import {
  adminCollectionSearchIncludes,
  useAdminBoundedClientPagination,
  type AdminBoundedClientQueryContract,
  type AdminEntityFilterDef,
} from "../../../../../lib/admin/entity-list";
import { ADMIN_BULK_ACTION_LABELS } from "../../../../../lib/admin/entity-list/bulk-action-labels";
import { useAdminBoundedClientInstantMutation } from "../../../../../lib/admin/entity-list/data-engine/instant-mutation";
import {
  getPageCompositionColumnPreferenceConfig,
  getPageCompositionDefaultColumnKeys,
  normalizePageCompositionVisibleColumnKeys,
} from "../../../../../lib/page-blocks/admin-collection-columns";
import {
  restorePageCompositionColumnPreferences,
  savePageCompositionColumnPreferences,
} from "../../column-preferences";
import {
  bulkHeroTemplates,
  createHeroTemplate,
  deleteHeroTemplate,
  duplicateHeroTemplate,
  toggleHeroTemplate,
  type HeroTemplateRow,
} from "./actions";

type HeroManagerClientProps = {
  heroes: HeroTemplateRow[];
  mediaSynchronizationWarning?: boolean;
  loadError?: string | null;
  initialVisibleColumns?: readonly string[] | null;
  preferenceError?: string | null;
};

const sourceLabels: Record<string, string> = {
  manual: "يدوي",
  latest_topics: "آخر مواضيع تهمك",
  featured_topics: "مواضيع مميزة",
  topic_category: "تصنيف مواضيع",
  latest_media: "آخر المركز الإعلامي",
  featured_media: "إعلامي مميز",
  media_category: "تصنيف إعلامي",
};

/**
 * RTL table: اسم الهيرو (1fr, يمين) → … → الإجراءات (ثابت، شمال).
 */
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
const HERO_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "hero-status",
    paramKey: "status",
    label: "حالة النشر",
    type: "status",
    allValue: "all",
    placeholder: "حالة النشر",
    options: [
      { value: "published", label: "منشور" },
      { value: "unpublished", label: "غير منشور" },
    ],
  },
];

function mutationFormData(fields: Record<string, string | number | boolean>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
  return formData;
}

function resolveHeroPreviewPath(hero: HeroTemplateRow) {
  const activeAssignment = hero.hero_assignments.find((assignment) => assignment.is_active && assignment.path);
  if (activeAssignment?.path) return activeAssignment.path;
  const anyAssignment = hero.hero_assignments.find((assignment) => assignment.path);
  return anyAssignment?.path ?? null;
}

export default function HeroManagerClient({
  heroes,
  mediaSynchronizationWarning = false,
  loadError = null,
  initialVisibleColumns = null,
  preferenceError = null,
}: HeroManagerClientProps) {
  const feedbackChannel = "block-manager:hero";
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createRuntimeRef = useRef<AdminFormRuntimeHandle>(null);
  const columnConfig = getPageCompositionColumnPreferenceConfig("heroTemplates");
  const defaultColumns = getPageCompositionDefaultColumnKeys("heroTemplates");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    normalizePageCompositionVisibleColumnKeys(
      "heroTemplates",
      initialVisibleColumns,
    ),
  );
  const visibleColumnSet = useMemo(
    () => new Set(visibleColumns),
    [visibleColumns],
  );
  const gridColumns = useMemo(
    () =>
      [
        ADMIN_DATA_GRID_COLUMNS.checkbox,
        ADMIN_DATA_GRID_COLUMNS.primaryCompact,
        visibleColumnSet.has("slug") ? ADMIN_DATA_GRID_COLUMNS.slugCompact : null,
        visibleColumnSet.has("status") ? ADMIN_DATA_GRID_COLUMNS.statusStandard : null,
        ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact,
      ]
        .filter((column) => column !== null)
        .join(" "),
    [visibleColumnSet],
  );
  const instant = useAdminBoundedClientInstantMutation<HeroTemplateRow>({
    entity: "hero-templates",
    initialRows: heroes,
  });
  const queryContract = useMemo<AdminBoundedClientQueryContract<HeroTemplateRow>>(
    () => ({
      mode: "bounded-client",
      search: { minLength: 1 },
      filters: HERO_FILTERS,
      matchesRow: (hero, query) => {
      if (
        query.search &&
        !adminCollectionSearchIncludes(
          `${hero.name} ${hero.slug} ${hero.description ?? ""}`,
          query.search,
        )
      ) return false;
      return query.filters.status === "all" || hero.status === query.filters.status;
      },
      getRowId: (hero) => hero.id,
    }),
    [],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: instant.rows,
    datasetKey: "hero-templates",
    queryContract,
    defaultPageSize: PAGE_SIZE,
  });
  const search = pagination.search;
  const status = pagination.filterValues.status;
  const paginatedHeroes = pagination.rows;
  const visibleIds = useMemo(() => paginatedHeroes.map((hero) => hero.id), [paginatedHeroes]);
  const selection = useAdminGridSelection<number>(visibleIds);
  const loadFeedback = useMemo(
    () =>
      loadError
        ? {
            variant: "danger" as const,
            title: "تعذر تحميل مكتبة الهيرو",
            message: loadError,
            layout: "inline" as const,
            dismissible: true,
            lifecycle: "persistent" as const,
          }
        : null,
    [loadError],
  );
  const mediaWarningNotice = useMemo(
    () => <MediaSynchronizationWarningNotice visible={mediaSynchronizationWarning} />,
    [mediaSynchronizationWarning],
  );

  async function runMutation(
    rowId: number | null,
    mutationAction: "duplicate" | "delete" | "bulk",
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    clearFeedback(feedbackChannel);
    try {
      await instant.mutateAsync({
        rowId: rowId ?? undefined,
        action: mutationAction,
        bulk: rowId === null,
        optimistic: (cache) => {
          if (mutationAction === "delete" && rowId !== null) {
            cache.removeRows(new Set([rowId]));
          }
        },
        execute: async () => {
          await action();
          return { ok: true as const, message: successMessage };
        },
      });
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message: successMessage,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
      return true;
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message: error instanceof Error ? error.message : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
      return false;
    }
  }

  async function runVisibilityMutation(
    hero: HeroTemplateRow,
    nextStatus: "published" | "unpublished",
  ) {
    const successMessage =
      nextStatus === "published" ? "تم نشر الهيرو." : "أصبح الهيرو غير منشور.";
    clearFeedback(feedbackChannel);
    try {
      await instant.mutateAsync({
        rowId: hero.id,
        action: "visibility",
        optimistic: (cache) =>
          cache.patchRows((candidate) =>
            candidate.id === hero.id
              ? { ...candidate, status: nextStatus }
              : candidate,
          ),
        execute: async () => {
          await toggleHeroTemplate(
            mutationFormData({ id: hero.id, next_status: nextStatus }),
          );
          return { ok: true, message: successMessage };
        },
      });
      publishFeedback(
        {
          variant: "success",
          title: "تم تنفيذ الإجراء",
          message: successMessage,
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline" },
      );
    } catch (error) {
      publishFeedback(
        {
          variant: "danger",
          title: "تعذر تنفيذ الإجراء",
          message:
            error instanceof Error
              ? error.message
              : "تعذر تنفيذ العملية. حاول مرة أخرى.",
          layout: "inline",
          dismissible: true,
          lifecycle: "manual",
        },
        { channel: feedbackChannel, placement: "inline", reveal: true },
      );
    }
  }

  function requestCreateClose() {
    createRuntimeRef.current?.requestClose();
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="إدارة الموديولات"
        title="إدارة الهيرو"
        description="جدول موحّد لكل قوالب الهيرو، ويمكن ربط كل قالب بصفحة أو أكثر."
        actions={(
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={Boolean(loadError)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة هيرو
          </button>
        )}
      />

      {mediaWarningNotice}

      <AdminFeedbackRegion
        channel={feedbackChannel}
        label="نتائج إجراءات مكتبة الهيرو"
        placement="global"
        feedback={loadFeedback}
      />

      <AdminFeedbackRegion
        channel={`${feedbackChannel}:columns`}
        label="حالة تفضيلات أعمدة مكتبة الهيرو"
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

      <div className="space-y-4">
        <AdminEntityListFilters
          basePath="/admin/pages-blocks/blocks/hero"
          search={{ value: search, placeholder: "ابحث باسم الهيرو أو المعرّف الداخلي…", minLength: 1 }}
          filters={HERO_FILTERS}
          values={{ status }}
          columnsControl={
            <AdminColumnVisibilityMenu
              columns={columnConfig.columns}
              visibleColumns={visibleColumns}
              defaultColumns={defaultColumns}
              onChange={setVisibleColumns}
              onPersist={(next) =>
                savePageCompositionColumnPreferences("heroTemplates", next)
              }
              onRestore={() =>
                restorePageCompositionColumnPreferences("heroTemplates")
              }
            />
          }
          contextOverrideActive={selection.selectedIds.length > 0}
          contextOverride={
            <AdminBulkActionBar
              selectedIds={selection.selectedIds}
              entityLabel="هيرو"
              options={[
                {
                  value: "show",
                  label: ADMIN_BULK_ACTION_LABELS.showSelected,
                },
                {
                  value: "hide",
                  label: ADMIN_BULK_ACTION_LABELS.hideSelected,
                },
                {
                  value: "delete",
                  label: ADMIN_BULK_ACTION_LABELS.deleteSelected,
                },
              ]}
              onClearSelection={selection.clearSelection}
              isBusy={instant.bulkInteraction.isBlocked}
              onExecute={async (action, ids) => {
                const formData = new FormData();
                formData.set("bulk_action", action);
                ids.forEach((id) => formData.append("ids", String(id)));
                const succeeded = await runMutation(null, "bulk", () => bulkHeroTemplates(formData), "تم تنفيذ الإجراء الجماعي على الهيروهات المحددة.");
                if (!succeeded) {
                  if (action === "delete") throw new Error("bulk hero delete failed");
                  return;
                }
                selection.clearSelection();
              }}
            />
          }
          onQueryPatch={pagination.applyQueryPatch}
        />

        <AdminDataGrid className="!rounded-t-none !border-t-0">
          <AdminDataGridHeader columns={gridColumns}>
            <AdminDataGridCheckboxCell>
              <AdminDataGridCheckbox
                inputRef={selection.selectAllRef}
                checked={selection.allSelected}
                onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
                label="تحديد كل الهيروهات"
              />
            </AdminDataGridCheckboxCell>
            <AdminDataGridPrimaryCell>اسم الهيرو</AdminDataGridPrimaryCell>
            {visibleColumnSet.has("slug") ? (
              <AdminDataGridCenterCell>المعرّف</AdminDataGridCenterCell>
            ) : null}
            {visibleColumnSet.has("status") ? (
              <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
            ) : null}
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {paginatedHeroes.map((hero) => {
            const previewPath = resolveHeroPreviewPath(hero);
            const hidden = { access: "hidden" as const };
            const interaction = instant.getRowInteraction(hero.id);
            const pendingAction = interaction.pendingAction;
            const visibilityPending = pendingAction === "visibility";
            const capability: AdminRowActionsCapability = {
              entityType: "hero_template",
              entityId: hero.id,
              entityLabel: hero.name,
              actions: {
                edit: {
                  access: "allowed",
                  href: `/admin/pages-blocks/blocks/hero/${hero.id}`,
                },
                preview: previewPath
                  ? { access: "allowed", href: previewPath, target: "_blank", rel: "noreferrer" }
                  : { access: "disabled", disabledReason: "لا توجد صفحة مربوطة للمعاينة." },
                information: {
                  access: "allowed",
                  title: `معلومات ${hero.name}`,
                  items: [
                    { label: "المعرّف", value: hero.slug },
                    { label: "الحالة", value: hero.status === "published" ? "منشور" : "غير منشور" },
                    { label: "الصفحات المربوطة", value: String(hero.hero_assignments.length) },
                  ],
                },
                copyPublicLink: hidden,
                visibility: visibilityPending
                  ? {
                      access: "disabled",
                      disabledReason: "انتظر انتهاء الإجراء الحالي.",
                      pending: true,
                      isVisible: hero.status === "published",
                    }
                  : {
                      access: "allowed",
                      isVisible: hero.status === "published",
                      onSelect: () =>
                        runVisibilityMutation(
                          hero,
                          hero.status === "published"
                            ? "unpublished"
                            : "published",
                        ),
                    },
                featured: hidden,
                duplicate: {
                  access: "allowed",
                  pending: pendingAction === "duplicate",
                  onSelect: async () => {
                    await runMutation(
                      hero.id,
                      "duplicate",
                      () =>
                        duplicateHeroTemplate(
                          mutationFormData({ id: hero.id }),
                        ),
                      "تم إنشاء نسخة من الهيرو.",
                    );
                  },
                },
                archive: hidden,
                delete: {
                  access: "allowed",
                  pending: pendingAction === "delete",
                  onSelect: async () => {
                    const succeeded = await runMutation(
                      hero.id,
                      "delete",
                      () =>
                        deleteHeroTemplate(
                          mutationFormData({ id: hero.id }),
                        ),
                      "تم حذف الهيرو.",
                    );
                    if (!succeeded) throw new Error("hero delete failed");
                  },
                  confirmation: {
                    mode: "shared",
                    title: "تأكيد حذف الهيرو",
                    description: `حذف الهيرو «${hero.name}» نهائيًا؟`,
                    confirmLabel: "حذف الهيرو",
                  },
                },
              },
            };

            return (
              <AdminDataGridRow key={hero.id} columns={gridColumns} className="border-b border-white/8 last:border-b-0">
                <AdminDataGridCheckboxCell>
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(hero.id)}
                    onChange={(event) => selection.toggleOne(hero.id, event.currentTarget.checked)}
                    label={`تحديد ${hero.name}`}
                  />
                </AdminDataGridCheckboxCell>

                <AdminDataGridPrimaryCell>
                  <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="block truncate font-semibold text-white transition hover:text-[#D8B87A]">
                    {hero.name}
                  </Link>
                  {hero.description ? <p className="mt-1 line-clamp-1 text-xs text-white/36">{hero.description}</p> : null}
                </AdminDataGridPrimaryCell>

                {visibleColumnSet.has("slug") ? (
                  <AdminDataGridCenterCell>
                    <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="font-en block truncate text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]">
                      {hero.slug}
                    </Link>
                  </AdminDataGridCenterCell>
                ) : null}

                {visibleColumnSet.has("status") ? (
                  <AdminDataGridStatusCell>
                    <AdminDataGridRowActions
                      capability={capability}
                      display="visibility"
                      size="compact"
                    />
                  </AdminDataGridStatusCell>
                ) : null}

                <AdminDataGridRowActions capability={capability} size="compact" />
              </AdminDataGridRow>
            );
          })}

          {!pagination.totalCount ? <AdminDataGridEmpty>لا توجد هيروهات مطابقة.</AdminDataGridEmpty> : null}
        </AdminDataGrid>

        <AdminTablePagination
          basePath="/admin/pages-blocks/blocks/hero"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={String(pagination.pageSize)}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      <VenesiaModal
        open={showCreateModal}
        title="إضافة هيرو جديد"
        description="يمكنك إنشاء هيرو فارغ ثم الدخول لتفاصيله وربطه بالصفحات."
        size="lg"
        onClose={requestCreateClose}
      >
        <AdminFormRuntime
          action={createHeroTemplate}
          mode="create"
          entityKey="hero-template-quick-create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
          runtimeRef={createRuntimeRef}
          formId="create-hero-template-form"
          className={ADMIN_FORM.gridTwoCol}
        >
          {({ fieldErrors, pending, requestClose }) => (
            <>
              <AdminFormError className="md:col-span-2" />
              <label className={adminFormLabelClassName()}>
                اسم الهيرو
                <input
                  name="name"
                  required
                  placeholder="Hero - من نحن"
                  className={adminFormFieldClassName(
                    fieldErrors.name?.length ? "border-red-400/40" : "",
                  )}
                  aria-invalid={Boolean(fieldErrors.name?.length)}
                  aria-describedby={fieldErrors.name?.length ? "name-error" : undefined}
                />
                <AdminFormError name="name" />
              </label>
              <label className={adminFormLabelClassName()}>
                المعرّف التقني
                <input
                  name="slug"
                  placeholder="hero-about"
                  dir="ltr"
                  className={adminFormFieldClassName(
                    `text-left font-en ${fieldErrors.slug?.length ? "border-red-400/40" : ""}`,
                  )}
                  aria-invalid={Boolean(fieldErrors.slug?.length)}
                  aria-describedby={fieldErrors.slug?.length ? "slug-error" : undefined}
                />
                <AdminFormError name="slug" />
              </label>
              <label className={`${adminFormLabelClassName()} md:col-span-2`}>
                وصف داخلي
                <input name="template_description" placeholder="وصف مختصر يظهر في جدول الإدارة" className={adminFormFieldClassName()} />
              </label>
              <label className={adminFormLabelClassName()}>
                النمط
                <select name="variant" defaultValue="internal-page" className={adminFormFieldClassName()}>
                  <option value="internal-page">صفحة داخلية</option>
                  <option value="home-cinematic">سينمائي للصفحة الرئيسية</option>
                </select>
              </label>
              <label className={adminFormLabelClassName()}>
                Source
                <select name="source_type" defaultValue="manual" className={adminFormFieldClassName()}>
                  {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <ModuleEditorStatusSwitch status="unpublished" className="md:col-span-2" />
              <input type="hidden" name="style_preset" value="cinematic-gold" />
              <input type="hidden" name="limit_count" value="1" />
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end md:col-span-2">
                <AdminModalCancelButton onClick={requestClose} disabled={pending}>
                  إلغاء
                </AdminModalCancelButton>
                <AdminModalPrimaryButton type="submit" disabled={pending}>
                  {pending ? "جار الإنشاء..." : "إنشاء وفتح"}
                </AdminModalPrimaryButton>
              </div>
            </>
          )}
        </AdminFormRuntime>
      </VenesiaModal>

    </AdminPageExperience>
  );
}
