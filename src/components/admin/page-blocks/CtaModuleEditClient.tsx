"use client";

import { AdminFormListboxSelect, AdminLinkField } from "../ui";
import {
  ModuleEditorFeedback,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorTabs,
  ModuleEditorVisibilityAlignRow,
} from "./ModuleEditorPresentation";
import { linkDefaultFromContainer } from "../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type CtaBlockConfig,
  type PageBlockFormattableTextField,
} from "../../../lib/page-blocks/configs";
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
  const format = (field: PageBlockFormattableTextField, bold = false) =>
    resolvePageBlockTextFormat(config, field, { bold });

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
        <input type="hidden" name="slug" value={block.slug} />
        <input type="hidden" name="variant" value={block.variant ?? "band"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <ModuleEditorIdentitySection
          name={block.name}
          status={block.status}
          inputClassName={fieldClassName("h-11")}
        >
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
        </ModuleEditorIdentitySection>

        <ModuleEditorTabs
          moduleKind="cta"
          activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/cta" saved={saved} />}
          tabs={[
            {
              id: "content",
              content: (
                <ModuleEditorSection>
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={6}>
                    <ModuleEditorVisibilityAlignRow
                      label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                      showName="show_eyebrow"
                      boldName="eyebrow_bold"
                      alignmentName="eyebrow_alignment"
                      showDefault={format("eyebrow", true).visible}
                      boldDefault={format("eyebrow", true).bold}
                      alignmentDefault={format("eyebrow", true).alignment}
                    >
                      <input
                        name="eyebrow"
                        defaultValue={config.eyebrow ?? ""}
                        aria-label={MODULE_EDITOR_TERMINOLOGY.eyebrow.labelAr}
                        className={fieldClassName("h-11")}
                      />
                    </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={6}>
                    <ModuleEditorVisibilityAlignRow
                      label="العنوان"
                      showName="show_title"
                      boldName="title_bold"
                      alignmentName="title_alignment"
                      showDefault={format("title", true).visible}
                      boldDefault={format("title", true).bold}
                      alignmentDefault={format("title", true).alignment}
                    >
                      <input
                        name="title"
                        defaultValue={config.title ?? ""}
                        aria-label="العنوان"
                        className={fieldClassName("h-11")}
                      />
                    </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-description" span={6}>
                    <ModuleEditorVisibilityAlignRow
                      label={MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}
                      showName="show_description"
                      boldName="description_bold"
                      alignmentName="description_alignment"
                      showDefault={format("description").visible}
                      boldDefault={format("description").bold}
                      alignmentDefault={format("description").alignment}
                    >
                      <textarea
                        name="description"
                        defaultValue={config.description ?? ""}
                        aria-label={MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}
                        rows={2}
                        className={fieldClassName("h-[72px] resize-none overflow-hidden leading-6")}
                      />
                    </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={6}>
                    <ModuleEditorVisibilityAlignRow
                      label="النص المميز"
                      showName="show_highlight"
                      boldName="highlight_bold"
                      alignmentName="highlight_alignment"
                      showDefault={format("highlight", true).visible}
                      boldDefault={format("highlight", true).bold}
                      alignmentDefault={format("highlight", true).alignment}
                    >
                      <input
                        name="highlight"
                        defaultValue={config.highlight ?? ""}
                        aria-label="النص المميز"
                        className={fieldClassName("h-11")}
                      />
                    </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                  </ModuleEditorFieldGrid>
                  <div className="mt-4">
                  <ModuleEditorVisibilityAlignRow
                    label="تنسيق الأزرار"
                    showName="show_cta"
                    boldName="cta_bold"
                    alignmentName="cta_alignment"
                    showDefault={format("cta").visible}
                    boldDefault={format("cta").bold}
                    alignmentDefault={format("cta").alignment}
                    controlsPlacement="cards"
                    presentation="plain"
                  >
                    <div>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-0">
                        <label className="min-w-0">
                          <span className="sr-only">نص زر الإجراء الأساسي</span>
                          <input
                            name="primary_cta_label"
                            defaultValue={config.primaryCta?.label ?? ""}
                            aria-label="نص زر الإجراء الأساسي"
                            placeholder="نص الزر الأساسي"
                            className={fieldClassName("relative z-0 h-11 min-w-0 rounded-e-none focus:z-10")}
                          />
                        </label>
                        <AdminLinkField
                          prefix="primary_cta"
                          label="رابط زر الإجراء الأساسي"
                          defaultValue={linkDefaultFromContainer(config.primaryCta as Record<string, unknown>)}
                          showAnchor
                          presentation="inline"
                          clearLinkLabel="مسح"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-0">
                        <label className="min-w-0">
                          <span className="sr-only">نص زر الإجراء الثانوي</span>
                          <input
                            name="secondary_cta_label"
                            defaultValue={config.secondaryCta?.label ?? ""}
                            aria-label="نص زر الإجراء الثانوي"
                            placeholder="نص الزر الثانوي"
                            className={fieldClassName("relative z-0 h-11 min-w-0 rounded-e-none focus:z-10")}
                          />
                        </label>
                        <AdminLinkField
                          prefix="secondary_cta"
                          label="رابط زر الإجراء الثانوي"
                          defaultValue={linkDefaultFromContainer(config.secondaryCta as Record<string, unknown>)}
                          showAnchor
                          presentation="inline"
                          clearLinkLabel="مسح"
                        />
                      </div>
                    </div>
                  </ModuleEditorVisibilityAlignRow>
                  </div>
                </ModuleEditorSection>
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
