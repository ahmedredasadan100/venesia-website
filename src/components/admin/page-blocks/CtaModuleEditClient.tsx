"use client";

import { AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "./ModuleEditorPresentation";
import { linkDefaultFromContainer } from "../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { CtaBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { MODULE_EDITOR_TERMINOLOGY } from "../../../lib/page-blocks/module-editor-presentation-contract";

type CtaModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    variant: string;
    style_preset: string | null;
    status: string;
  };
  config: CtaBlockConfig;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function CtaModuleEditClient({
  block,
  config,
  assignmentContext,
  saved,
  updateAction,
}: CtaModuleEditClientProps) {
  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="cta"
        entityName={block.name}
        backHref="/admin/pages-blocks/blocks/cta"
        backLabel="الرجوع لبلوكات الدعوة للإجراء"
        status={block.status}
        saved={saved}
      />

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="variant" value={block.variant ?? "band"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <ModuleEditorTabs
          moduleKind="cta"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/cta" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={3}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}</span>
                        <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={4}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">العنوان</span>
                        <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-description" span={5}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">{MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}</span>
                        <textarea name="description" defaultValue={config.description ?? ""} rows={2} className={fieldClassName("resize-y leading-7")} />
                      </label>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={4}>
                      <label className="block space-y-2">
                        <span className="text-xs font-semibold text-white/55">النص المميز</span>
                        <input name="highlight" defaultValue={config.highlight ?? ""} className={fieldClassName()} />
                      </label>
                    </ModuleEditorField>
                  </ModuleEditorFieldGrid>
                  <AdminFormGrid>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">نص زر الإجراء الأساسي</span>
                      <input name="primary_cta_label" defaultValue={config.primaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="primary_cta"
                      label="رابط زر الإجراء الأساسي"
                      defaultValue={linkDefaultFromContainer(config.primaryCta as Record<string, unknown>)}
                      showAnchor
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">نص زر الإجراء الثانوي</span>
                      <input name="secondary_cta_label" defaultValue={config.secondaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="secondary_cta"
                      label="رابط زر الإجراء الثانوي"
                      defaultValue={linkDefaultFromContainer(config.secondaryCta as Record<string, unknown>)}
                      showAnchor
                    />
                  </AdminFormGrid>
                </ModuleEditorSection>
              ),
            },
            {
              id: "meta",
              content: (
                <ModuleEditorSettingsComposition
                  primary={
                  <ModuleEditorSection>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الاسم</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>
                  <ModuleEditorTechnicalIdentity
                    mode="editable"
                    value={block.slug}
                    inputClassName={fieldClassName()}
                  />
                  <ModuleEditorStatusSwitch status={block.status} />
                  <AdminFormListboxSelect
                    name="background_style"
                    label="نمط الخلفية"
                    defaultValue={config.backgroundStyle ?? "dark"}
                    options={[
                      { value: "dark", label: "داكن" },
                      { value: "gold", label: "ذهبي" },
                      { value: "gradient", label: "متدرّج" },
                    ]}
                  />
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
