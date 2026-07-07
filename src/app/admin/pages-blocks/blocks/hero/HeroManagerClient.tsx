"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ADMIN_DATA_GRID_ACTION_COLUMNS,
  ADMIN_DATA_GRID_RULES,
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
} from "../../../../../components/admin/ui";
import { PlusIcon } from "../../../../../components/admin/AdminRowActions";
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
};

function Icon({ label }: { label: string }) {
  return <span aria-hidden="true" className="text-[15px] leading-none">{label}</span>;
}

function CloseIcon() { return <Icon label="×" />; }

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
const gridColumns = `44px minmax(260px, 1fr) 120px 96px ${ADMIN_DATA_GRID_ACTION_COLUMNS.fiveCompact}`;

function PublicPreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={ADMIN_DATA_GRID_RULES.actionIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

function resolveHeroPreviewPath(hero: HeroRow) {
  const activeAssignment = hero.hero_assignments.find((assignment) => assignment.is_active && assignment.path);
  if (activeAssignment?.path) return activeAssignment.path;
  const anyAssignment = hero.hero_assignments.find((assignment) => assignment.path);
  return anyAssignment?.path ?? null;
}

export default function HeroManagerClient({ heroes }: HeroManagerClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const visibleIds = useMemo(() => heroes.map((hero) => hero.id), [heroes]);
  const selection = useAdminGridSelection<number>(visibleIds);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <AdminPageHeader
        eyebrow="HERO MODULE"
        title="إدارة الهيرو"
        description="جدول موحّد لكل الهيروهات. كل Hero يدار كـ Module مستقل ويمكن ربطه بصفحة أو أكثر."
        meta={`${heroes.length} هيرو إجمال`}
        actions={(
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-[#D8B87A] px-5 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            <PlusIcon />
            إضافة هيرو
          </button>
        )}
      />

      <div className="space-y-4">
        <AdminBulkActionBar
          selectedIds={selection.selectedIds}
          entityLabel="هيرو"
          action={bulkHeroTemplates}
          options={[
            { value: "show", label: "إظهار" },
            { value: "hide", label: "إخفاء" },
            { value: "delete", label: "حذف" },
          ]}
          onClearSelection={selection.clearSelection}
        />

        <AdminDataGrid summary={heroes.length ? `${heroes.length} هيرو إجمال` : undefined}>
          <AdminDataGridHeader columns={gridColumns}>
            <div className="flex justify-center">
              <AdminDataGridCheckbox
                inputRef={selection.selectAllRef}
                checked={selection.allSelected}
                onChange={(event) => selection.toggleAll(event.currentTarget.checked)}
                label="تحديد كل الهيروهات"
              />
            </div>
            <div className="min-w-0 text-right">اسم الهيرو</div>
            <div className="text-center">Slug</div>
            <div className="text-center">الحالة</div>
            <div className="text-center">الإجراءات</div>
          </AdminDataGridHeader>

          {heroes.map((hero) => {
            const previewPath = resolveHeroPreviewPath(hero);

            return (
              <AdminDataGridRow key={hero.id} columns={gridColumns} className="border-b border-white/8 last:border-b-0">
                <div className="flex justify-center">
                  <AdminDataGridCheckbox
                    checked={selection.selectedSet.has(hero.id)}
                    onChange={(event) => selection.toggleOne(hero.id, event.currentTarget.checked)}
                    label={`تحديد ${hero.name}`}
                  />
                </div>

                <div className="min-w-0 text-right">
                  <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="block truncate font-semibold text-white transition hover:text-[#D8B87A]">
                    {hero.name}
                  </Link>
                  {hero.description ? <p className="mt-1 line-clamp-1 text-xs text-white/36">{hero.description}</p> : null}
                </div>

                <div className="min-w-0 text-center">
                  <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="font-en block truncate text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]">
                    {hero.slug}
                  </Link>
                </div>

                <div className="flex justify-center">
                  <AdminStatusPill tone={hero.is_visible ? "green" : "muted"}>{hero.is_visible ? "ظاهر" : "مخفي"}</AdminStatusPill>
                </div>

                <AdminDataGridActionsCell compact>
                  <AdminDataGridActionButton
                    action="edit"
                    href={`/admin/pages-blocks/blocks/hero/${hero.id}`}
                    size="compact"
                  />

                  {previewPath ? (
                    <AdminDataGridActionButton
                      href={previewPath}
                      target="_blank"
                      tone="dark"
                      title="معاينة الصفحة العامة"
                      size="compact"
                    >
                      <PublicPreviewIcon />
                    </AdminDataGridActionButton>
                  ) : (
                    <AdminDataGridActionButton
                      tone="dark"
                      disabled
                      title="لا توجد صفحة مربوطة للمعاينة"
                      size="compact"
                    >
                      <PublicPreviewIcon />
                    </AdminDataGridActionButton>
                  )}

                  <form action={toggleHeroTemplate} className="contents">
                    <input type="hidden" name="id" value={hero.id} />
                    <input type="hidden" name="next_visible" value={String(!hero.is_visible)} />
                    <AdminDataGridActionButton
                      type="submit"
                      action="visibility"
                      size="compact"
                      hidden={!hero.is_visible}
                      title={hero.is_visible ? "إخفاء" : "إظهار"}
                    />
                  </form>

                  <form action={duplicateHeroTemplate} className="contents">
                    <input type="hidden" name="id" value={hero.id} />
                    <AdminDataGridActionButton type="submit" action="duplicate" title="نسخ" size="compact" />
                  </form>

                  <form action={deleteHeroTemplate} className="contents">
                    <input type="hidden" name="id" value={hero.id} />
                    <AdminDataGridActionButton type="submit" action="delete" title="حذف" size="compact" />
                  </form>
                </AdminDataGridActionsCell>
              </AdminDataGridRow>
            );
          })}

          {!heroes.length ? <AdminDataGridEmpty>لا توجد هيروهات بعد.</AdminDataGridEmpty> : null}
        </AdminDataGrid>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setShowCreateModal(false)}>
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">إضافة هيرو جديد</h3>
                <p className="mt-1 text-sm text-white/45">يمكنك إنشاء هيرو فارغ ثم الدخول لتفاصيله وربطه بالصفحات.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
                <CloseIcon />
              </button>
            </div>

            <form action={createHeroTemplate} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">اسم الهيرو</span>
                <input name="name" required placeholder="Hero - من نحن" className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Slug</span>
                <input name="slug" placeholder="hero-about" dir="ltr" className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                <input name="template_description" placeholder="وصف مختصر يظهر في جدول الإدارة" className="w-full rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Variant</span>
                <select name="variant" defaultValue="internal-page" className="w-full cursor-pointer rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                  <option value="internal-page">Internal Page</option>
                  <option value="home-cinematic">Home Cinematic</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold text-white/55">Source</span>
                <select name="source_type" defaultValue="manual" className="w-full cursor-pointer rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white outline-none focus:border-[#D8B87A]/45">
                  {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70 md:col-span-2">
                <span>نشط</span>
                <input type="checkbox" name="is_visible" defaultChecked className="cursor-pointer accent-[#D8B87A]" />
              </label>
              <input type="hidden" name="style_preset" value="cinematic-gold" />
              <input type="hidden" name="limit_count" value="1" />
              <div className="flex justify-end gap-3 md:col-span-2">
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
