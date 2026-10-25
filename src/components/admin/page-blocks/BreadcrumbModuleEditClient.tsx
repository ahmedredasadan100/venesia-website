"use client";

import { AdminFormPendingFields } from "../ui/AdminFormRuntime";

import { ADMIN_FORM_STACK_CLASS_NAME, AdminFormField, AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import { adminFormLabelClassName } from "../../../lib/admin/admin-ui-styles";
import {
  ModuleEditorFeedback,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorTabs,
} from "./ModuleEditorPresentation";
import BreadcrumbManualItemsField from "./editors/BreadcrumbManualItemsField";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { BreadcrumbBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type BreadcrumbModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    description: string | null;
    style_preset: string | null;
    status: string;
  };
  config: BreadcrumbBlockConfig;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function BreadcrumbModuleEditClient({
  block,
  config,
  assignmentContext,
  saved,
  updateAction,
}: BreadcrumbModuleEditClientProps) {
  return (
    <div className={`${ADMIN_FORM_STACK_CLASS_NAME} pb-10`} dir="rtl">
      <ModuleEditorHeader
        moduleKind="breadcrumb"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/breadcrumb"
        backLabel="الرجوع لكل موديولات مسار التنقل"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <AdminFormPendingFields>
          <input type="hidden" name="id" value={block.id} />
          <input type="hidden" name="description" value={block.description ?? ""} />
          <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

          <div className={`min-w-0 ${ADMIN_FORM_STACK_CLASS_NAME}`}>
            <ModuleEditorIdentitySection
              name={block.name}
              status={block.status}
              inputClassName={fieldClassName("h-11")}
            />

            <ModuleEditorTabs
              moduleKind="breadcrumb"
              activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/breadcrumb" saved={saved} />}
              tabs={[
                {
                  id: "content",
                  content: (
                    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
                      <ModuleEditorSection surface="neutral">
                      <AdminFormGrid columns={3} presentation="aligned-fields">
                          <AdminFormListboxSelect
                            name="source"
                            label="مصدر الرابط"
                            presentation="panel"
                            defaultValue={config.source ?? "navigation"}
                            options={[
                              { value: "navigation", label: "من قائمة التنقل (تلقائي)" },
                              { value: "manual", label: "يدوي" },
                            ]}
                            sizing="full"
                          />
                          <AdminFormField presentation="panel" label="تسمية الرابط (اختياري)">
                            <input
                              name="current_label_override"
                              defaultValue={config.currentLabelOverride ?? ""}
                              placeholder="يستبدل آخر عنصر في المسار"
                              className={fieldClassName()}
                            />
                          </AdminFormField>
                            <AdminFormSwitch
                              name="show_home"
                              label={<span className={adminFormLabelClassName({ textInset: true })}><span data-admin-form-label-text>إظهار الرئيسية</span></span>}
                              value="true"
                              defaultChecked={config.showHome !== false}
                              embedded
                            />
                      </AdminFormGrid>
                      </ModuleEditorSection>
                      <BreadcrumbManualItemsField items={config.manualItems ?? []} />
                    </div>
                  ),
                },
                {
                  id: "pages",
                  sectionHeaderPresentation: "control",
                  content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />,
                },
              ]}
            />

            <ModuleEditorSaveArea />
          </div>
        </AdminFormPendingFields>
      </form>
    </div>
  );
}
