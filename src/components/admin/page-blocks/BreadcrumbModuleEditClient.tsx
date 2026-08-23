"use client";

import { AdminFormListboxSelect, AdminFormSwitch } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
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
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <ModuleEditorTabs
          moduleKind="breadcrumb"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/breadcrumb" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid className="items-end">
                    <ModuleEditorField nature="standard" span={4}>
                      <AdminFormListboxSelect
                        name="source"
                        label="مصدر الرابط"
                        defaultValue={config.source ?? "navigation"}
                        options={[
                          { value: "navigation", label: "من قائمة التنقل (تلقائي)" },
                          { value: "manual", label: "يدوي" },
                        ]}
                      />
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={4}>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-white/70">تسمية الرابط (اختياري)</span>
                        <input
                          name="current_label_override"
                          defaultValue={config.currentLabelOverride ?? ""}
                          placeholder="يستبدل آخر عنصر في المسار"
                          className={fieldClassName()}
                        />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="binary-state" span={4}>
                      <AdminFormSwitch name="show_home" label="إظهار الرئيسية" value="true" defaultChecked={config.showHome !== false} surface className="h-full" />
                    </ModuleEditorField>
                  </ModuleEditorFieldGrid>
                  <BreadcrumbManualItemsField items={config.manualItems ?? []} />
                </ModuleEditorSection>
              ),
            },
            {
              id: "settings",
              content: (
                <ModuleEditorSettingsComposition
                  primary={
                  <ModuleEditorSection>
                    <ModuleEditorFieldGrid>
                      <ModuleEditorField nature="standard" span={6}>
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold text-white/55">اسم الموديول</span>
                          <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                        </label>
                      </ModuleEditorField>
                      <ModuleEditorField nature="short-description" span={6}>
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold text-white/55">الوصف الداخلي</span>
                          <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
                        </label>
                      </ModuleEditorField>
                    </ModuleEditorFieldGrid>
                  </ModuleEditorSection>
                  }

                  secondary={
                  <ModuleEditorSection>
                    <ModuleEditorSectionHeading intent="settings" className="text-lg">النشر</ModuleEditorSectionHeading>
                    <ModuleEditorStatusSwitch status={block.status} />
                    <p className="text-xs leading-6 text-white/42">
                      الموديول المخفي أو غير المنشور لا يظهر على الموقع حتى لو كان مربوطًا بصفحة.
                    </p>
                  </ModuleEditorSection>
                  }
                />
              ),
            },
            {
              id: "pages",
              content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />,
            },
          ]}
        />

        <ModuleEditorSaveArea />
      </form>
    </div>
  );
}
