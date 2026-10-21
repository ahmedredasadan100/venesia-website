"use client";

import { AdminFormPendingFields } from "../ui/AdminFormRuntime";

import { AdminCard, AdminFormControlHeader, AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
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
    <div className="space-y-6 pb-10" dir="rtl">
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
                  <div className="space-y-6">
                    <ModuleEditorFieldGrid>
                      <ModuleEditorField nature="standard" span={4}>
                        <AdminCard presentation="premium" className="h-full p-3">
                        <AdminFormListboxSelect
                          name="source"
                          label={<AdminFormControlHeader title="مصدر الرابط" />}
                          defaultValue={config.source ?? "navigation"}
                          options={[
                            { value: "navigation", label: "من قائمة التنقل (تلقائي)" },
                            { value: "manual", label: "يدوي" },
                          ]}
                          sizing="full"
                        />
                        </AdminCard>
                      </ModuleEditorField>
                      <ModuleEditorField nature="short-text" span={4}>
                        <AdminCard presentation="premium" className="h-full p-3">
                        <label className="block space-y-3">
                          <AdminFormControlHeader title="تسمية الرابط (اختياري)" />
                          <input
                            name="current_label_override"
                            defaultValue={config.currentLabelOverride ?? ""}
                            placeholder="يستبدل آخر عنصر في المسار"
                            className={fieldClassName()}
                          />
                        </label>
                        </AdminCard>
                      </ModuleEditorField>
                      <ModuleEditorField nature="binary-state" span={4}>
                        <AdminCard presentation="premium" className="h-full p-3">
                          <AdminFormSwitch
                            name="show_home"
                            label={<AdminFormControlHeader title="إظهار الرئيسية" />}
                            value="true"
                            defaultChecked={config.showHome !== false}
                            embedded
                          />
                        </AdminCard>
                      </ModuleEditorField>
                    </ModuleEditorFieldGrid>
                    <BreadcrumbManualItemsField items={config.manualItems ?? []} />
                  </div>
                ),
              },
              {
                id: "pages",
                sectionHeaderPresentation: "control",
                content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} presentation="premium" />,
              },
            ]}
          />

          <ModuleEditorSaveArea />
        </AdminFormPendingFields>
      </form>
    </div>
  );
}
