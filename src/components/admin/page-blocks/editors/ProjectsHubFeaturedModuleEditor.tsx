"use client";

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
