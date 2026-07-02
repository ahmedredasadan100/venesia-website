"use client";

import AdminNotice from "../../AdminNotice";
import { AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { HomeProjectsModuleConfig } from "../../../../lib/page-blocks/configs";

type HomeProjectsPlacementEditorProps = {
  config: HomeProjectsModuleConfig;
};

function VisibilityToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
      <span>{label}</span>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
    </label>
  );
}

/** Home projects section copy — project cards load from Supabase projects table. */
export default function HomeProjectsPlacementEditor({ config }: HomeProjectsPlacementEditorProps) {
  return (
    <div className="space-y-6">
      <AdminNotice
        variant="info"
        title="بيانات الكروت"
        message="الصور، الأكواد، الأوصاف، والترتيب تُدار من لوحة المشاريع عبر show_on_homepage و homepage_order في جدول projects — وليس من هذا الموديول."
      />

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">عرض المشاريع</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عدد المشاريع المعروضة</span>
          <input
            name="projects_limit"
            type="number"
            min={1}
            defaultValue={config.projectsLimit ?? ""}
            placeholder="مثال: 1، 3، 4، 6، 10 — اتركه فارغًا لعرض كل المشاريع"
            dir="ltr"
            className={fieldClassName()}
          />
        </label>
        <p className="text-xs leading-6 text-white/45">
          يُطبَّق على المشاريع حسب homepage_order. اترك الحقل فارغًا للسلوك الحالي (كل المشاريع مع pagination).
        </p>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">نصوص السكشن</h2>
        <p className="text-xs leading-6 text-white/45">
          اترك أي حقل نصي فارغًا لاستخدام النص الافتراضي الحالي على الموقع.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle name="show_eyebrow" label="إظهار Eyebrow" defaultChecked={config.showEyebrow !== false} />
          <VisibilityToggle name="show_title" label="إظهار Title" defaultChecked={config.showTitle !== false} />
          <VisibilityToggle name="show_intro" label="إظهار Intro" defaultChecked={config.showIntro !== false} />
          <VisibilityToggle
            name="show_footer_cta"
            label="إظهار زر أسفل السكشن"
            defaultChecked={config.showFooterCta !== false}
          />
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Title</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Intro text</span>
          <textarea
            name="intro"
            defaultValue={config.intro ?? ""}
            rows={4}
            className={fieldClassName("resize-y leading-7")}
          />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">زر أسفل السكشن</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Label</span>
          <input
            name="footer_cta_label"
            defaultValue={config.footerCta?.label ?? ""}
            className={fieldClassName()}
          />
        </label>

        <AdminLinkField
          prefix="footer_cta"
          label="رابط الزر"
          defaultValue={linkDefaultFromContainer(config.footerCta as Record<string, unknown>)}
        />
      </section>
    </div>
  );
}
