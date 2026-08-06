"use client";

import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import { AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../ui";
import {
  MODULE_EDITOR_STATUS_OPTIONS,
  ModuleEditorFeedback,
  ModuleEditorHeader,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSettingsComposition,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "./ModuleEditorPresentation";
import { linkDefaultFromContainer } from "../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { CtaBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";

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
        backLabel="الرجوع لبلوكات CTA"
        status={block.status}
        saved={saved}
        slotContext={getSlotCompatibilityLabel("cta")}
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
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Eyebrow</span>
                    <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">العنوان</span>
                    <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Highlight</span>
                    <input name="highlight" defaultValue={config.highlight ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الوصف</span>
                    <textarea
                      name="description"
                      defaultValue={config.description ?? ""}
                      rows={4}
                      className={fieldClassName("resize-y leading-7")}
                    />
                  </label>
                  <AdminFormGrid>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Primary CTA Label</span>
                      <input name="primary_cta_label" defaultValue={config.primaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="primary_cta"
                      label="Primary CTA — Link"
                      defaultValue={linkDefaultFromContainer(config.primaryCta as Record<string, unknown>)}
                      showAnchor
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Secondary CTA Label</span>
                      <input name="secondary_cta_label" defaultValue={config.secondaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="secondary_cta"
                      label="Secondary CTA — Link"
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
                  context={<ModuleDependencyHintsPanel moduleKind="cta" templateSlug={block.slug} />}
                  primary={
                  <ModuleEditorSection className="max-w-xl">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الاسم</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>
                  <ModuleEditorTechnicalIdentity
                    mode="editable"
                    value={block.slug}
                    inputClassName={fieldClassName()}
                  />
                  <AdminFormListboxSelect
                    name="status"
                    label="الحالة"
                    defaultValue={block.status}
                    options={MODULE_EDITOR_STATUS_OPTIONS}
                  />
                  <AdminFormListboxSelect
                    name="background_style"
                    label="Background Style"
                    defaultValue={config.backgroundStyle ?? "dark"}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "gold", label: "Gold" },
                      { value: "gradient", label: "Gradient" },
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
