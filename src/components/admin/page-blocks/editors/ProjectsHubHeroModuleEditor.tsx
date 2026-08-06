"use client";

import { ModuleEditorSection } from "../ModuleEditorPresentation";
import { AdminFormListboxSelect } from "../../ui";

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

      <ModuleEditorSection>
        <AdminFormListboxSelect
          name="selection_mode"
          label="طريقة اختيار الشرائح"
          defaultValue={config.selectionMode}
          options={PROJECTS_HUB_HERO_SELECTION_MODES.map((mode) => ({
            value: mode,
            label: mode === "auto_residential_with_media" ? "تلقائي — سكني مع وسائط" : mode,
          }))}
          dir="ltr"
        />

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
      </ModuleEditorSection>
    </div>
  );
}
