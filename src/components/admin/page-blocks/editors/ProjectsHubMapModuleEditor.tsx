"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_DEFAULT_MAP_IMAGE,
  type ProjectsHubMapModuleConfig,
  type ProjectsHubMapPinConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubMapModuleEditorProps = {
  config: ProjectsHubMapModuleConfig;
};

function normalizePins(pins: ProjectsHubMapPinConfig[] | undefined) {
  const rows = [...(pins ?? [])];
  return rows.length ? rows : [{ code: "", district: "", right: "50%", top: "50%" }];
}

export default function ProjectsHubMapModuleEditor({ config }: ProjectsHubMapModuleEditorProps) {
  const [pins, setPins] = useState<ProjectsHubMapPinConfig[]>(() => normalizePins(config.mapPins));

  const movePin = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pins.length) return;
    const next = [...pins];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setPins(next);
  };

  const updatePin = (index: number, patch: Partial<ProjectsHubMapPinConfig>) => {
    setPins((current) => current.map((pin, i) => (i === index ? { ...pin, ...patch } : pin)));
  };

  const removePin = (index: number) => {
    if (pins.length <= 1) return;
    setPins((current) => current.filter((_, i) => i !== index));
  };

  const addPin = () => {
    if (pins.length >= 30) return;
    setPins((current) => [...current, { code: "", district: "", right: "50%", top: "50%" }]);
  };

  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-map" />
      <input type="hidden" name="pin_count" value={String(pins.length)} />

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">خريطة المشروعات</ModuleEditorSectionHeading>

        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title} className={fieldClassName()} />
        </label></ModuleEditorField>

        <ModuleEditorField nature="short-text" span={6}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">نص زر الاستكشاف</span>
          <input name="explore_button_label" defaultValue={config.exploreButtonLabel} className={fieldClassName()} />
        </label></ModuleEditorField>

        <ModuleEditorField nature="media">
        <AdminMediaImageField
          name="map_image"
          label="صورة الخريطة"
          defaultValue={config.mapImage || PROJECTS_HUB_DEFAULT_MAP_IMAGE}
          browseFolder="images/projects"
          dimensionHint="content"
          helperText={`الافتراضي: ${PROJECTS_HUB_DEFAULT_MAP_IMAGE}`}
          allowRemove={false}
        />
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ModuleEditorSectionHeading intent="repeater">دبابيس الخريطة</ModuleEditorSectionHeading>
          <button
            type="button"
            onClick={addPin}
            disabled={pins.length >= 30}
            className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            إضافة دبوس
          </button>
        </div>

        <ModuleEditorRepeaterGrid>
          {pins.map((pin, index) => (
            <ModuleEditorRepeaterCard
              key={index}
              title={`دبوس ${index + 1}`}
              actions={(
                <>
                  <button
                    type="button"
                    onClick={() => movePin(index, -1)}
                    disabled={index === 0}
                    className="rounded-xl border border-white/10 px-3 py-1 text-xs text-white/60 disabled:opacity-30"
                  >
                    أعلى
                  </button>
                  <button
                    type="button"
                    onClick={() => movePin(index, 1)}
                    disabled={index === pins.length - 1}
                    className="rounded-xl border border-white/10 px-3 py-1 text-xs text-white/60 disabled:opacity-30"
                  >
                    أسفل
                  </button>
                  <button
                    type="button"
                    onClick={() => removePin(index)}
                    disabled={pins.length <= 1}
                    className="rounded-xl border border-red-400/30 px-3 py-1 text-xs text-red-300 disabled:opacity-30"
                  >
                    حذف
                  </button>
                </>
              )}
            >

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">كود المشروع</span>
                  <input
                    name={`pin_${index}_code`}
                    value={pin.code}
                    onChange={(event) => updatePin(index, { code: event.target.value })}
                    dir="ltr"
                    className={fieldClassName()}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">المنطقة / الحي</span>
                  <input
                    name={`pin_${index}_district`}
                    value={pin.district}
                    onChange={(event) => updatePin(index, { district: event.target.value })}
                    className={fieldClassName()}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Right %</span>
                  <input
                    name={`pin_${index}_right`}
                    value={pin.right}
                    onChange={(event) => updatePin(index, { right: event.target.value })}
                    placeholder="20%"
                    dir="ltr"
                    className={fieldClassName()}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Top %</span>
                  <input
                    name={`pin_${index}_top`}
                    value={pin.top}
                    onChange={(event) => updatePin(index, { top: event.target.value })}
                    placeholder="50%"
                    dir="ltr"
                    className={fieldClassName()}
                  />
                </label>
              </div>
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </ModuleEditorSection>
    </div>
  );
}
