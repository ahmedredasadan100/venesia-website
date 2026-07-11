"use client";

import Link from "next/link";

import AdminNotice from "../../AdminNotice";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_HERO_SELECTION_MODES,
  type ProjectsHubHeroModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubHeroModuleEditorProps = {
  config: ProjectsHubHeroModuleConfig;
};

export default function ProjectsHubHeroModuleEditor({ config }: ProjectsHubHeroModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-hero" />

      <AdminNotice
        variant="info"
        title="بيانات المشروعات"
        message="بيانات المشروعات نفسها تُدار من قسم إدارة المشروعات. هذا الموديول يضبط عرض الهيرو فقط."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/projects" className="text-[#D8B87A] underline-offset-2 hover:underline">
          إدارة بيانات المشروعات
        </Link>
        <Link href="/projects" target="_blank" rel="noreferrer" className="text-white/55 underline-offset-2 hover:underline">
          معاينة صفحة المشروعات
        </Link>
      </div>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">هيرو صفحة المشروعات</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">طريقة اختيار الشرائح</span>
          <select name="selection_mode" defaultValue={config.selectionMode} className={fieldClassName()} dir="ltr">
            {PROJECTS_HUB_HERO_SELECTION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "auto_residential_with_media"
                  ? "تلقائي — سكني مع وسائط"
                  : mode}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">التشغيل التلقائي (مللي ثانية)</span>
          <input
            name="autoplay_ms"
            type="number"
            min={1000}
            max={60000}
            step={500}
            defaultValue={config.autoplayMs}
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">نص الحالة الفارغة (اختياري)</span>
          <textarea
            name="empty_state"
            defaultValue={config.emptyState ?? ""}
            rows={3}
            placeholder="اتركه فارغًا لعدم عرض رسالة"
            className={fieldClassName("resize-y leading-7")}
          />
        </label>
      </section>
    </div>
  );
}
