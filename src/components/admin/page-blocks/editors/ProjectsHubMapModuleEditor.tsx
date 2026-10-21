"use client";
import { contentModuleMediaSlot } from "../../../../lib/page-blocks/configs";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminActionButton, AdminCard, AdminFormControlHeader, AdminFormGrid } from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { resolvePageBlockTextFormat } from "../../../../lib/page-blocks/configs";
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
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });

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
        <AdminFormControlHeader title="خريطة المشروعات" icon={<AdminModuleTabIcon name="location" />} />

        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}><ModuleEditorVisibilityAlignRow label="العنوان" presentation="premium" icon={<AdminModuleTabIcon name="content" />} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان" defaultValue={config.title} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow></ModuleEditorField>

        <ModuleEditorField nature="short-text" span={6}><AdminCard presentation="premium" className="self-start space-y-3 p-3"><label className="block space-y-3">
          <AdminFormControlHeader presentation="compact-inline" title="نص زر الاستكشاف" icon={<AdminModuleTabIcon name="section" />} />
          <input name="explore_button_label" defaultValue={config.exploreButtonLabel} className={fieldClassName()} />
        </label></AdminCard></ModuleEditorField>

        <ModuleEditorField nature="media">
        <AdminCard presentation="premium" className="space-y-3 p-3">
        <AdminFormControlHeader title="صورة الخريطة" icon={<AdminModuleTabIcon name="media" />} />
        <AdminMediaImageField
          variant="card"
          showLabel={false}
                  mediaSlot={contentModuleMediaSlot("projects-hub-map")}
name="map_image"
          label="صورة الخريطة"
          defaultValue={config.mapImage || PROJECTS_HUB_DEFAULT_MAP_IMAGE}
          browseFolder="images/projects"
          allowRemove={false}
        />
        </AdminCard>
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminFormControlHeader title="دبابيس الخريطة" icon={<AdminModuleTabIcon name="location" />} />
          <AdminActionButton
            type="button"
            onClick={addPin}
            disabled={pins.length >= 30}
            variant="gold"
          >
            إضافة دبوس
          </AdminActionButton>
        </div>

        <ModuleEditorRepeaterGrid presentation="premium">
          {pins.map((pin, index) => (
            <ModuleEditorRepeaterCard
              key={index}
              presentation="premium"
              title={`دبوس ${index + 1}`}
              actions={(
                <>
                  <AdminActionButton
                    type="button"
                    onClick={() => movePin(index, -1)}
                    disabled={index === 0}
                    aria-label={`تحريك الدبوس ${index + 1} لأعلى`}
                  >
                    أعلى
                  </AdminActionButton>
                  <AdminActionButton
                    type="button"
                    onClick={() => movePin(index, 1)}
                    disabled={index === pins.length - 1}
                    aria-label={`تحريك الدبوس ${index + 1} لأسفل`}
                  >
                    أسفل
                  </AdminActionButton>
                  <AdminActionButton
                    type="button"
                    onClick={() => removePin(index)}
                    disabled={pins.length <= 1}
                    variant="danger"
                  >
                    حذف
                  </AdminActionButton>
                </>
              )}
            >

              <AdminFormGrid columns={2}>
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
              </AdminFormGrid>
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </ModuleEditorSection>
    </div>
  );
}
