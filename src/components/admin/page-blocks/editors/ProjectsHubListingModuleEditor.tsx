"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";
import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
} from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { resolvePageBlockTextFormat } from "../../../../lib/page-blocks/configs";
import {
  PROJECTS_HUB_FILTER_IDS,
  PROJECTS_HUB_VIEW_MODES,
  type ProjectsHubListingModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubListingModuleEditorProps = {
  config: ProjectsHubListingModuleConfig;
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
    <AdminCard presentation="premium" className="self-start p-3">
    <AdminFormSwitch
      name={name}
      label={<AdminFormControlHeader title={label} presentation="compact-inline" icon={<AdminModuleTabIcon name="publish" />} />}
      value="true"
      defaultChecked={defaultChecked}
      embedded
      embeddedLayout="inline"
    />
    </AdminCard>
  );
}

export default function ProjectsHubListingModuleEditor({
  config,
}: ProjectsHubListingModuleEditorProps) {
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", {
    bold: true,
  });
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-listing" />
      <input
        type="hidden"
        name="sort"
        value={config.sort || "homepage_order"}
      />

      <>
        <p className="text-xs leading-6 text-white/45">
          يتحكّم في عنوان قسم القائمة فقط، وليس في بيانات المشروعات.
        </p>

        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="النص التمهيدي"
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
              showName="show_eyebrow"
              boldName="eyebrow_bold"
              alignmentName="eyebrow_alignment"
              showDefault={
                config.showEyebrow !== false && eyebrowFormat.visible
              }
              boldDefault={eyebrowFormat.bold}
              alignmentDefault={eyebrowFormat.alignment}
            >
              <input
                name="eyebrow"
                aria-label="النص التمهيدي"
                defaultValue={config.eyebrow}
                className={fieldClassName()}
                dir="ltr"
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="عنوان القسم"
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
              showName="show_title"
              boldName="title_bold"
              alignmentName="title_alignment"
              showDefault={config.showTitle !== false && titleFormat.visible}
              boldDefault={titleFormat.bold}
              alignmentDefault={titleFormat.alignment}
            >
              <input
                name="title"
                aria-label="عنوان القسم"
                defaultValue={config.title}
                className={fieldClassName()}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading
          intent="domain"
          actions={
            <VisibilityToggle
              name="show_filter_bar"
              label="إظهار شريط الفلاتر"
              defaultChecked={config.showFilterBar !== false}
            />
          }
        >
          فلاتر المشروعات
        </ModuleEditorSectionHeading>

        <ModuleEditorFieldGrid className="mt-4">
          <ModuleEditorField nature="standard" span={4}>
            <AdminCard presentation="premium" className="self-start p-3">
            <AdminFormListboxSelect
              name="default_filter"
              label={<AdminFormControlHeader title="الفلتر الافتراضي" presentation="compact-inline" icon={<AdminModuleTabIcon name="section" />} />}
              defaultValue={config.defaultFilter}
              options={PROJECTS_HUB_FILTER_IDS.map((filter) => ({
                value: filter,
                label:
                  filter === "all"
                    ? "كل المشروعات"
                    : filter === "residential"
                      ? "سكني"
                      : "تجاري",
              }))}
            />
            </AdminCard>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={8}>
            <AdminFormGrid columns={3}>
              {PROJECTS_HUB_FILTER_IDS.map((filter) => (
                <AdminCard key={filter} presentation="premium" className="self-start p-3">
                <AdminFormSwitch
                  key={filter}
                  name="visible_filters"
                  label={<AdminFormControlHeader presentation="compact-inline" icon={<AdminModuleTabIcon name="section" />} title={
                    filter === "all"
                      ? "كل المشروعات"
                      : filter === "residential"
                        ? "سكني"
                        : "تجاري"
                  } />}
                  value={filter}
                  defaultChecked={config.visibleFilters.includes(filter)}
                  embedded
                  embeddedLayout="inline"
                />
                </AdminCard>
              ))}
            </AdminFormGrid>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">
          البيانات الظاهرة داخل بطاقة المشروع
        </ModuleEditorSectionHeading>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة فقط. لا يغيّر قيم
          المشروع في قاعدة البيانات.
        </p>

        <AdminFormGrid columns={3}>
          <VisibilityToggle
            name="show_project_image"
            label="إظهار صورة المشروع"
            defaultChecked={config.showProjectImage !== false}
          />
          <VisibilityToggle
            name="show_project_code"
            label="إظهار كود المشروع"
            defaultChecked={config.showProjectCode !== false}
          />
          <VisibilityToggle
            name="show_project_name"
            label="إظهار اسم المشروع"
            defaultChecked={config.showProjectName !== false}
          />
          <VisibilityToggle
            name="show_project_description"
            label="إظهار وصف المشروع"
            defaultChecked={config.showProjectDescription !== false}
          />
          <VisibilityToggle
            name="show_project_type"
            label="إظهار نوع المشروع"
            defaultChecked={config.showProjectType !== false}
          />
          <VisibilityToggle
            name="show_project_location"
            label="إظهار الموقع"
            defaultChecked={config.showProjectLocation !== false}
          />
          <VisibilityToggle
            name="show_explore_button"
            label="إظهار زر استكشف المشروع"
            defaultChecked={config.showExploreButton !== false}
          />
        </AdminFormGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="settings">
          إعدادات عرض القائمة
        </ModuleEditorSectionHeading>

        <AdminFormGrid columns={3} className="mt-4">
          <AdminCard presentation="premium" className="self-start p-3">
          <label className="block space-y-2">
            <AdminFormControlHeader title="عدد المشروعات في الصفحة" presentation="compact-inline" icon={<AdminModuleTabIcon name="overview" />} />
            <input
              name="page_size"
              type="number"
              min={1}
              max={48}
              defaultValue={config.pageSize}
              dir="ltr"
              className={fieldClassName()}
            />
          </label>
          </AdminCard>

          <AdminCard presentation="premium" className="self-start p-3">
          <AdminFormListboxSelect
            name="default_view"
            label={<AdminFormControlHeader title="وضع العرض الافتراضي" presentation="compact-inline" icon={<AdminModuleTabIcon name="settings" />} />}
            defaultValue={config.defaultView}
            options={PROJECTS_HUB_VIEW_MODES.map((mode) => ({
              value: mode,
              label: mode === "list" ? "قائمة" : "بطاقات",
            }))}
          />
          </AdminCard>
          <VisibilityToggle
            name="show_view_toggle"
            label="إظهار زر تغيير طريقة العرض"
            defaultChecked={config.showViewToggle !== false}
          />
          <VisibilityToggle
            name="show_pagination"
            label="إظهار ترقيم الصفحات"
            defaultChecked={config.showPagination !== false}
          />
          <VisibilityToggle
            name="show_project_count"
            label="إظهار عدد المشروعات"
            defaultChecked={config.showProjectCount !== false}
          />
        </AdminFormGrid>
      </ModuleEditorSection>
    </div>
  );
}
