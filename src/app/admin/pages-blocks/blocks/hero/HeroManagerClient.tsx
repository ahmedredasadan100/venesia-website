"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AdminBulkActionBar,
  AdminDataGrid,
  AdminDataGridActionButton,
  AdminDataGridActions,
  AdminDataGridCheckbox,
  AdminDataGridEmpty,
  AdminDataGridHeader,
  AdminDataGridRow,
  AdminPageHeader,
  AdminStatusPill,
  useAdminGridSelection,
} from "../../../../../components/admin/ui";
import { MoreVerticalIcon, PlusIcon } from "../../../../../components/admin/AdminRowActions";
import {
  bulkHeroTemplates,
  createHeroTemplate,
  deleteHeroTemplate,
  duplicateHeroTemplate,
  toggleHeroTemplate,
} from "./actions";

type HeroAssignment = {
  id: number;
  target_type: string;
  target_slug: string | null;
  path: string | null;
  is_active: boolean;
};

type HeroRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  style_preset: string;
  source_type: string;
  is_visible: boolean;
  updated_at: string;
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

function AdvancedHeroMenu({ hero, onOpen }: { hero: HeroRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.075] text-white transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A]"
      title="إجراءات إضافية"
      aria-label={`إجراءات إضافية لـ ${hero.name}`}
    >
      <MoreVerticalIcon />
    </button>
  );
}

const gridColumns = "56px minmax(280px,1.8fr) minmax(180px,1fr) 120px 110px 220px";

export default function HeroManagerClient({ heroes }: HeroManagerClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [advancedHero, setAdvancedHero] = useState<HeroRow | null>(null);
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
              checked={selection.allSelected}
              onChange={(event) => selection.toggleAll(event.target.checked)}
              inputRef={selection.selectAllRef}
              label="تحديد كل الهيروهات"
            />
          </div>
          <div>اسم الهيرو</div>
          <div>Slug</div>
          <div>Variant</div>
          <div>الحالة</div>
          <div className="text-center">الإجراءات</div>
        </AdminDataGridHeader>

        {heroes.map((hero) => (
          <AdminDataGridRow key={hero.id} columns={gridColumns} className="border-b border-white/8 last:border-b-0">
            <div className="flex justify-center xl:block">
              <AdminDataGridCheckbox
                checked={selection.selectedSet.has(hero.id)}
                onChange={(event) => selection.toggleOne(hero.id, event.target.checked)}
                label={`تحديد ${hero.name}`}
              />
            </div>

            <div className="min-w-0">
              <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="font-semibold text-white transition hover:text-[#D8B87A]">
                {hero.name}
              </Link>
              {hero.description ? <p className="mt-1 line-clamp-1 text-xs text-white/36">{hero.description}</p> : null}
            </div>

            <Link href={`/admin/pages-blocks/blocks/hero/${hero.id}`} className="font-en text-xs text-[#D8B87A]/78 transition hover:text-[#D8B87A]">
              {hero.slug}
            </Link>
            <div className="text-white/58">{hero.variant}</div>
            <div><AdminStatusPill tone={hero.is_visible ? "green" : "muted"}>{hero.is_visible ? "ظاهر" : "مخفي"}</AdminStatusPill></div>

            <AdminDataGridActions>
              <AdminDataGridActionButton action="edit" href={`/admin/pages-blocks/blocks/hero/${hero.id}`} />

              <form action={toggleHeroTemplate} className="inline-flex shrink-0">
                <input type="hidden" name="id" value={hero.id} />
                <input type="hidden" name="next_visible" value={String(!hero.is_visible)} />
                <AdminDataGridActionButton type="submit" action="visibility" hidden={!hero.is_visible} title={hero.is_visible ? "إخفاء" : "إظهار"} />
              </form>

              <form action={duplicateHeroTemplate} className="inline-flex shrink-0">
                <input type="hidden" name="id" value={hero.id} />
                <AdminDataGridActionButton type="submit" action="duplicate" title="نسخ" />
              </form>

              <form action={deleteHeroTemplate} className="inline-flex shrink-0">
                <input type="hidden" name="id" value={hero.id} />
                <AdminDataGridActionButton type="submit" action="delete" title="حذف" />
              </form>

              <AdvancedHeroMenu hero={hero} onOpen={() => setAdvancedHero(hero)} />
            </AdminDataGridActions>
          </AdminDataGridRow>
        ))}

        {!heroes.length ? <AdminDataGridEmpty>لا توجد هيروهات بعد.</AdminDataGridEmpty> : null}
      </AdminDataGrid>

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

      {advancedHero ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => setAdvancedHero(null)}>
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#080B10] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D8B87A]/70">Venesia Action Modal</p>
                <h3 className="mt-2 text-xl font-semibold text-white">عمليات متقدمة للهيرو</h3>
                <p className="mt-1 text-sm text-white/45">{advancedHero.name}</p>
              </div>
              <button type="button" onClick={() => setAdvancedHero(null)} className="cursor-pointer rounded-xl border border-white/10 p-2 text-white/50 hover:text-white">
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <Link href={`/admin/pages-blocks/blocks/hero/${advancedHero.id}`} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 hover:bg-white/[0.08]">
                فتح تفاصيل الهيرو
              </Link>
              <button
                type="button"
                onClick={() => {
                  const payload = JSON.stringify(advancedHero, null, 2);
                  navigator.clipboard?.writeText(payload);
                }}
                className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right text-sm text-white/75 hover:bg-white/[0.08]"
              >
                نسخ JSON إلى الحافظة
              </button>
              <form action={duplicateHeroTemplate}>
                <input type="hidden" name="id" value={advancedHero.id} />
                <button className="w-full cursor-pointer rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-right text-sm text-blue-100 hover:bg-blue-500/15">
                  تكرار الهيرو بالكامل
                </button>
              </form>
              <form action={deleteHeroTemplate}>
                <input type="hidden" name="id" value={advancedHero.id} />
                <button className="w-full cursor-pointer rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-right text-sm text-red-200 hover:bg-red-500/15">
                  حذف نهائي
                </button>
              </form>
              <button type="button" onClick={() => setAdvancedHero(null)} className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/55 hover:bg-white/5 hover:text-white">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
