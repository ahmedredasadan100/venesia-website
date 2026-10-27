"use client";
import { adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
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
import { TrashIcon } from "../../AdminRowActions";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminActionButton, AdminCard, AdminFormControlHeader, AdminFormGrid } from "../../ui";
import { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
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
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      <input type="hidden" name="config_schema" value="projects-hub-map" />
      <input type="hidden" name="pin_count" value={String(pins.length)} />

      <ModuleEditorSection presentation="panel" header={<AdminModuleSectionHeader id="projects-map" sectionHeading="خريطة المشروعات" icon="location" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}>

        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}><ModuleEditorVisibilityAlignRow label="العنوان" icon={<AdminModuleTabIcon name="content" />} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان" defaultValue={config.title} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow></ModuleEditorField>

        <ModuleEditorField nature="short-text" span={6}><AdminCard presentation="premium" className="self-start space-y-3 p-3"><label className={adminFormLabelClassName({ textInset: true })}>
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

      <ModuleEditorSection presentation="panel" header={<AdminModuleSectionHeader id="projects-map-pins" sectionHeading="دبابيس الخريطة" icon="location" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} sectionSummary={
          <AdminActionButton
            type="button"
            onClick={addPin}
            disabled={pins.length >= 30}
            variant="gold"
          >
            إضافة دبوس
          </AdminActionButton>
        } />}>

        <ModuleEditorRepeaterGrid>
          {pins.map((pin, index) => (
            <ModuleEditorRepeaterCard
              key={index}
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
                    size="icon"
                    title={`حذف الدبوس ${index + 1}`}
                    aria-label={`حذف الدبوس ${index + 1}`}
                  >
                    <TrashIcon className="size-5" />
                  </AdminActionButton>
                </>
              )}
            >

              <AdminFormGrid columns={2}>
                <label className={adminFormLabelClassName({ textInset: true })}>
                  <span data-admin-form-label-text>كود المشروع</span>
                  <input
                    name={`pin_${index}_code`}
                    value={pin.code}
                    onChange={(event) => updatePin(index, { code: event.target.value })}
                    dir="ltr"
                    className={fieldClassName()}
                  />
                </label>
                <label className={adminFormLabelClassName({ textInset: true })}>
                  <span data-admin-form-label-text>المنطقة / الحي</span>
                  <input
                    name={`pin_${index}_district`}
                    value={pin.district}
                    onChange={(event) => updatePin(index, { district: event.target.value })}
                    className={fieldClassName()}
                  />
                </label>
                <label className={adminFormLabelClassName({ textInset: true })}>
                  <span data-admin-form-label-text>Right %</span>
                  <input
                    name={`pin_${index}_right`}
                    value={pin.right}
                    onChange={(event) => updatePin(index, { right: event.target.value })}
                    placeholder="20%"
                    dir="ltr"
                    className={fieldClassName()}
                  />
                </label>
                <label className={adminFormLabelClassName({ textInset: true })}>
                  <span data-admin-form-label-text>Top %</span>
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
