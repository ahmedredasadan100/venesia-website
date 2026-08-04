"use client";

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

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
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
