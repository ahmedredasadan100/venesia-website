"use client";

import Link from "next/link";

import AdminNotice from "../../AdminNotice";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  type ProjectsHubFeaturedModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubFeaturedModuleEditorProps = {
  config: ProjectsHubFeaturedModuleConfig;
};

export default function ProjectsHubFeaturedModuleEditor({ config }: ProjectsHubFeaturedModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-featured" />

      <AdminNotice
        variant="info"
        title="بيانات المشروعات"
        message="بيانات المشروعات نفسها تُدار من قسم إدارة المشروعات. اختيار «مميز» يتم عبر حقل featured في جدول المشروعات — وليس من هنا."
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
        <h2 className="text-sm font-semibold text-white">المشروعات المميزة</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">قاعدة الاختيار</span>
          <select name="selection_mode" defaultValue={config.selectionMode} className={fieldClassName()} dir="ltr">
            {PROJECTS_HUB_FEATURED_SELECTION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "featured_flag" ? "المشروعات ذات featured = true" : mode}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title} className={fieldClassName()} />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان الفرعي</span>
          <input name="subtitle" defaultValue={config.subtitle} className={fieldClassName()} />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الحد الأقصى (اختياري)</span>
          <input
            name="limit"
            type="number"
            min={1}
            max={48}
            defaultValue={config.limit ?? ""}
            placeholder="فارغ = بدون حد"
            dir="ltr"
            className={fieldClassName()}
          />
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
      </section>
    </div>
  );
}
