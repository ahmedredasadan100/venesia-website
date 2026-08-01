"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import AdminEntityListFilters from "../../../../../components/admin/entity-list/AdminEntityListFilters";
import {
  AdminFeedbackRegion,
  useAdminFeedback,
} from "../../../../../components/admin/AdminFeedbackProvider";
import MediaSynchronizationWarningNotice from "../../../../../components/admin/media/MediaSynchronizationWarningNotice";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_COLUMNS,
  ADMIN_FORM,
  ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE,
  AdminBulkActionBar,
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
  AdminModalCancelButton,
  AdminModalPrimaryButton,
  AdminPageExperience,
  AdminPageHeader,
  AdminStatusPill,
  AdminTablePagination,
  VenesiaModal,
  adminFormFieldClassName,
  adminFormLabelClassName,
  type AdminRowActionsCapability,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
import {
  adminCollectionSearchIncludes,
  applyAdminEntityUrlPatch,
  useAdminBoundedClientPagination,
  type AdminEntityFilterDef,
} from "../../../../../lib/admin/entity-list";
import {
  bulkHeroTemplates,
  createHeroTemplate,
  deleteHeroTemplate,
  duplicateHeroTemplate,
  toggleHeroTemplate,
} from "./actions";

type HeroAssignment = {
  id: number;
  path: string | null;
  is_active: boolean;
};

type HeroRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_visible: boolean;
  hero_assignments: HeroAssignment[];
};

type HeroManagerClientProps = {
  heroes: HeroRow[];
  mediaSynchronizationWarning?: boolean;
  loadError?: string | null;
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
const gridColumns = `${ADMIN_DATA_GRID_COLUMNS.checkbox} ${ADMIN_DATA_GRID_COLUMNS.primaryCompact} ${ADMIN_DATA_GRID_COLUMNS.slugCompact} ${ADMIN_DATA_GRID_COLUMNS.statusStandard} ${ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact}`;
const PAGE_SIZE = Number(ADMIN_TABLE_PAGINATION_DEFAULT_PAGE_SIZE);
const HERO_FILTERS: readonly AdminEntityFilterDef[] = [
  {
    id: "hero-visibility",
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

function mutationFormData(fields: Record<string, string | number | boolean>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, String(value));
  return formData;
}

function resolveHeroPreviewPath(hero: HeroRow) {
  const activeAssignment = hero.hero_assignments.find((assignment) => assignment.is_active && assignment.path);
  if (activeAssignment?.path) return activeAssignment.path;
  const anyAssignment = hero.hero_assignments.find((assignment) => assignment.path);
  return anyAssignment?.path ?? null;
}

export default function HeroManagerClient({
  heroes,
  mediaSynchronizationWarning = false,
  loadError = null,
}: HeroManagerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedbackChannel = "block-manager:hero";
  const { publishFeedback, clearFeedback } = useAdminFeedback();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingRowId, setPendingRowId] = useState<number | null>(null);
  const [isRefreshPending, startRefreshTransition] = useTransition();
  const search = searchParams.get("q") ?? "";
  const visibility = searchParams.get("visibility") ?? "all";
  const filteredHeroes = useMemo(
    () => heroes.filter((hero) => {
      if (
        search &&
        !adminCollectionSearchIncludes(
          `${hero.name} ${hero.slug} ${hero.description ?? ""}`,
          search,
        )
      ) return false;
      return visibility === "all" || (hero.is_visible ? "visible" : "hidden") === visibility;
    }),
    [heroes, search, visibility],
  );
  const pagination = useAdminBoundedClientPagination({
    rows: filteredHeroes,
    datasetKey: `${search}|${visibility}|${filteredHeroes.map((hero) => hero.id).sort().join("|")}`,
    defaultPageSize: PAGE_SIZE,
  });
  const paginatedHeroes = pagination.rows;
  const visibleIds = useMemo(() => paginatedHeroes.map((hero) => hero.id), [paginatedHeroes]);
  const selection = useAdminGridSelection<number>(visibleIds);
  const isBusy = pendingRowId !== null || isRefreshPending;
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
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    clearFeedback(feedbackChannel);
    setPendingRowId(rowId ?? -1);
    try {
      await action();
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
      startRefreshTransition(() => router.refresh());
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
    } finally {
      setPendingRowId(null);
    }
  }

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="HERO MODULE"
        title="إدارة الهيرو"
        description="جدول موحّد لكل الهيروهات. كل Hero يدار كـ Module مستقل ويمكن ربطه بصفحة أو أكثر."
        meta={`${heroes.length} هيرو إجمال`}
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
        feedback={loadFeedback}
      />

      <div className="space-y-4">
        <AdminEntityListFilters
          basePath="/admin/pages-blocks/blocks/hero"
          search={{ value: search, placeholder: "ابحث باسم الهيرو أو المعرّف الداخلي…", minLength: 1, pending: isBusy }}
          filters={HERO_FILTERS}
          values={{ visibility }}
          contextOverrideActive={selection.selectedIds.length > 0}
          contextOverride={
            <AdminBulkActionBar
              selectedIds={selection.selectedIds}
              entityLabel="هيرو"
              options={[
                { value: "show", label: "إظهار" },
                { value: "hide", label: "إخفاء" },
                { value: "delete", label: "حذف" },
              ]}
              onClearSelection={selection.clearSelection}
              isBusy={isBusy}
              onExecute={async (action, ids) => {
                const formData = new FormData();
                formData.set("bulk_action", action);
                ids.forEach((id) => formData.append("ids", String(id)));
                const succeeded = await runMutation(null, () => bulkHeroTemplates(formData), "تم تنفيذ الإجراء الجماعي على الهيروهات المحددة.");
                if (!succeeded) {
                  if (action === "delete") throw new Error("bulk hero delete failed");
                  return;
                }
                selection.clearSelection();
              }}
            />
          }
          onQueryPatch={(patch, behavior = "push") => {
            const next = applyAdminEntityUrlPatch(new URLSearchParams(window.location.search), patch);
            const query = next.toString();
            window.history[behavior === "replace" ? "replaceState" : "pushState"](
              window.history.state,
              "",
              `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
            );
          }}
        />

        <AdminDataGrid className="!rounded-t-none !border-t-0" summary={filteredHeroes.length ? `${filteredHeroes.length} هيرو إجمال` : undefined}>
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
            <AdminDataGridCenterCell>Slug</AdminDataGridCenterCell>
            <AdminDataGridCenterCell>الحالة</AdminDataGridCenterCell>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {paginatedHeroes.map((hero) => {
            const previewPath = resolveHeroPreviewPath(hero);
            const hidden = { access: "hidden" as const };
            const rowPending = pendingRowId === hero.id;
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
                    { label: "Slug", value: hero.slug },
                    { label: "الحالة", value: hero.is_visible ? "ظاهر" : "مخفي" },
                    { label: "الصفحات المربوطة", value: String(hero.hero_assignments.length) },
                  ],
                },
                copyPublicLink: hidden,
                visibility: {
                  access: "allowed",
                  isVisible: hero.is_visible,
                  pending: rowPending,
                  onSelect: async () => {
                    await runMutation(
                      hero.id,
                      () => toggleHeroTemplate(mutationFormData({ id: hero.id, next_visible: !hero.is_visible })),
                      hero.is_visible ? "تم إخفاء الهيرو." : "تم إظهار الهيرو.",
                    );
                  },
                },
                featured: hidden,
                duplicate: {
                  access: "allowed",
                  pending: rowPending,
                  onSelect: async () => {
                    await runMutation(
                      hero.id,
                      () => duplicateHeroTemplate(mutationFormData({ id: hero.id })),
                      "تم إنشاء نسخة من الهيرو.",
                    );
                  },
                },
                archive: hidden,
                delete: {
                  access: "allowed",
                  pending: rowPending,
                  onSelect: async () => {
                    const succeeded = await runMutation(
                      hero.id,
                      () => deleteHeroTemplate(mutationFormData({ id: hero.id })),
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

                <AdminDataGridCenterCell>
                  <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="font-en block truncate text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]">
                    {hero.slug}
                  </Link>
                </AdminDataGridCenterCell>

                <AdminDataGridStatusCell>
                  <AdminStatusPill tone={hero.is_visible ? "green" : "muted"}>{hero.is_visible ? "ظاهر" : "مخفي"}</AdminStatusPill>
                </AdminDataGridStatusCell>

                <AdminDataGridRowActions capability={capability} size="compact" />
              </AdminDataGridRow>
            );
          })}

          {!filteredHeroes.length ? <AdminDataGridEmpty>لا توجد هيروهات مطابقة.</AdminDataGridEmpty> : null}
        </AdminDataGrid>

        <AdminTablePagination
          basePath="/admin/pages-blocks/blocks/hero"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={String(pagination.pageSize)}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pending={isBusy}
        />
      </div>

      <VenesiaModal
        open={showCreateModal}
        title="إضافة هيرو جديد"
        description="يمكنك إنشاء هيرو فارغ ثم الدخول لتفاصيله وربطه بالصفحات."
        size="lg"
        onClose={() => setShowCreateModal(false)}
        footer={(
          <>
            <AdminModalCancelButton onClick={() => setShowCreateModal(false)}>إلغاء</AdminModalCancelButton>
            <AdminModalPrimaryButton type="submit" form="create-hero-template-form">
              إنشاء وفتح
            </AdminModalPrimaryButton>
          </>
        )}
      >
        <form id="create-hero-template-form" action={createHeroTemplate} className={ADMIN_FORM.gridTwoCol}>
          <label className={adminFormLabelClassName()}>
            اسم الهيرو
            <input name="name" required placeholder="Hero - من نحن" className={adminFormFieldClassName()} />
          </label>
          <label className={adminFormLabelClassName()}>
            Slug
            <input name="slug" placeholder="hero-about" dir="ltr" className={adminFormFieldClassName("text-left font-en")} />
          </label>
          <label className={`${adminFormLabelClassName()} md:col-span-2`}>
            وصف داخلي
            <input name="template_description" placeholder="وصف مختصر يظهر في جدول الإدارة" className={adminFormFieldClassName()} />
          </label>
          <label className={adminFormLabelClassName()}>
            Variant
            <select name="variant" defaultValue="internal-page" className={adminFormFieldClassName()}>
              <option value="internal-page">Internal Page</option>
              <option value="home-cinematic">Home Cinematic</option>
            </select>
          </label>
          <label className={adminFormLabelClassName()}>
            Source
            <select name="source_type" defaultValue="manual" className={adminFormFieldClassName()}>
              {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={`${ADMIN_FORM.checkboxRow} md:col-span-2`}>
            <span>نشط</span>
            <input type="checkbox" name="is_visible" defaultChecked className="h-4 w-4 accent-[#D8B87A]" />
          </label>
          <input type="hidden" name="style_preset" value="cinematic-gold" />
          <input type="hidden" name="limit_count" value="1" />
        </form>
      </VenesiaModal>

    </AdminPageExperience>
  );
}
