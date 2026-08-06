"use client";

import { ModuleEditorSection } from "../ModuleEditorPresentation";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { VisionGoalsItemConfig, VisionGoalsModuleConfig } from "../../../../lib/page-blocks/configs";

type VisionGoalsModuleEditorProps = {
  config: VisionGoalsModuleConfig;
};

function padItems(items: VisionGoalsItemConfig[] | undefined, size = 3) {
  const rows = [...(items ?? [])].slice(0, size);
  while (rows.length < size) rows.push({});
  return rows;
}

export default function VisionGoalsModuleEditor({ config }: VisionGoalsModuleEditorProps) {
  const visionItems = padItems(config.vision?.items);
  const goalsItems = padItems(config.goals?.items);

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="vision-goals" />

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">النص</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Title</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Intro — فقرتان مفصولتان بسطر فارغ</span>
          <textarea
            name="intro"
            defaultValue={(config.intro ?? []).join("\n\n")}
            rows={6}
            className={fieldClassName("resize-y leading-7")}
          />
        </label>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">الصورة</h2>
        <AdminMediaImageField
          name="image"
          label="صورة القسم"
          defaultValue={config.image ?? ""}
          dimensionHint="content"
          browseFolder="images/about"
        />
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">Alt</span>
          <input name="image_alt" defaultValue={config.imageAlt ?? ""} className={fieldClassName()} />
        </label>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">رؤيتنا</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عنوان العمود</span>
          <input name="vision_title" defaultValue={config.vision?.title ?? ""} className={fieldClassName()} />
        </label>
        <div className="grid gap-4 lg:grid-cols-3">
          {visionItems.map((item, index) => (
            <div key={`vision-${index}`} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
              <p className="text-xs font-semibold text-[#D8B87A]/70">بند {index + 1}</p>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Title</span>
                <input
                  name={`vision_item_${index}_title`}
                  defaultValue={item.title ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Description</span>
                <textarea
                  name={`vision_item_${index}_text`}
                  defaultValue={item.text ?? ""}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </div>
          ))}
        </div>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">أهدافنا</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عنوان العمود</span>
          <input name="goals_title" defaultValue={config.goals?.title ?? ""} className={fieldClassName()} />
        </label>
        <div className="grid gap-4 lg:grid-cols-3">
          {goalsItems.map((item, index) => (
            <div key={`goals-${index}`} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
              <p className="text-xs font-semibold text-[#D8B87A]/70">بند {index + 1}</p>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Title</span>
                <input
                  name={`goals_item_${index}_title`}
                  defaultValue={item.title ?? ""}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">Description</span>
                <textarea
                  name={`goals_item_${index}_text`}
                  defaultValue={item.text ?? ""}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </div>
          ))}
        </div>
      </ModuleEditorSection>
    </div>
  );
}
