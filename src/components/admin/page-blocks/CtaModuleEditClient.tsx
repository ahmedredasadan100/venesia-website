"use client";

import { AdminFormPendingFields } from "../ui/AdminFormRuntime";

import AdminMediaImageField from "../media/AdminMediaImageField";
import { AdminCard, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../ui";
import { AdminModuleTabIcon } from "../ui/AdminModuleTabs";
import {
  ModuleEditorFeedback,
  ModuleEditorHeader,
  ModuleEditorIdentitySection,
  ModuleEditorPagesTab,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSaveArea,
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
        <AdminFormPendingFields>
          <input type="hidden" name="id" value={block.id} />
          <input type="hidden" name="slug" value={block.slug} />
          <input type="hidden" name="variant" value={block.variant ?? "band"} />
          <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

          <ModuleEditorIdentitySection
            name={block.name}
            status={block.status}
            inputClassName={fieldClassName("h-11")}
          />

          <ModuleEditorTabs
            moduleKind="cta"
            activePanelContext={<ModuleEditorFeedback backHref="/admin/pages-blocks/blocks/cta" saved={saved} />}
            tabs={[
              {
                id: "content",
                content: (
                  <ModuleEditorFieldGrid>
                    <ModuleEditorField nature="short-text" span={6}>
                      <ModuleEditorVisibilityAlignRow
                        presentation="premium"
                        icon={<AdminModuleTabIcon name="content" />}
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
                        presentation="premium"
                        icon={<AdminModuleTabIcon name="content" />}
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
                    <ModuleEditorField nature="short-text" span={6}>
                      <ModuleEditorVisibilityAlignRow
                        presentation="premium"
                        icon={<AdminModuleTabIcon name="content" />}
                        label={MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}
                        showName="show_description"
                        boldName="description_bold"
                        alignmentName="description_alignment"
                        showDefault={format("description").visible}
                        boldDefault={format("description").bold}
                        alignmentDefault={format("description").alignment}
                      >
                        <input
                          name="description"
                          defaultValue={config.description ?? ""}
                          aria-label={MODULE_EDITOR_TERMINOLOGY.shortDescription.labelAr}
                          className={fieldClassName("h-11")}
                        />
                      </ModuleEditorVisibilityAlignRow>
                    </ModuleEditorField>
                    <ModuleEditorField nature="short-text" span={6}>
                      <ModuleEditorVisibilityAlignRow
                        presentation="premium"
                        icon={<AdminModuleTabIcon name="content" />}
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
                ),
              },
              {
                id: "images",
                sectionHeaderPresentation: "control",
                content: (
                  <AdminFormGrid columns={1}>
                    <AdminCard presentation="premium" className="p-3">
                      <AdminMediaImageField
                        name="background_image"
                        label="صورة الخلفية"
                        defaultValue={config.backgroundImage ?? ""}
                        variant="card"
                        showLabel={false}
                        showGuidance={false}
                      />
                    </AdminCard>
                  </AdminFormGrid>
                ),
              },
              {
                id: "cta",
                content: (
                  <ModuleEditorVisibilityAlignRow
                    label="تنسيق الأزرار"
                    icon={<AdminModuleTabIcon name="section" />}
                    presentation="premium"
                    showName="show_cta"
                    boldName="cta_bold"
                    alignmentName="cta_alignment"
                    showDefault={format("cta").visible}
                    preserveUnsetBold
                    boldDefault={config.ctaBold}
                    alignmentDefault={format("cta").alignment}
                  >
                    <AdminFormGrid columns={2}>
                      <AdminCard presentation="premium" className="h-full space-y-3 p-3">
                        <AdminFormControlHeader title="الزر الأساسي" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
                        <AdminFormGrid columns={1}>
                          <label className="min-w-0">
                            <span className="sr-only">نص زر الإجراء الأساسي</span>
                            <input
                              name="primary_cta_label"
                              defaultValue={config.primaryCta?.label ?? ""}
                              aria-label="نص زر الإجراء الأساسي"
                              placeholder="نص الزر الأساسي"
                              className={fieldClassName("h-11 min-w-0")}
                            />
                          </label>
                          <AdminLinkField
                            prefix="primary_cta"
                            label="رابط زر الإجراء الأساسي"
                            defaultValue={linkDefaultFromContainer(config.primaryCta as Record<string, unknown>)}
                            showAnchor
                            presentation="inline"
                            actionPresentation="bare"
                            clearLinkLabel="مسح"
                          />
                        </AdminFormGrid>
                        </AdminCard>
                        <AdminCard presentation="premium" className="h-full space-y-3 p-3">
                          <AdminFormControlHeader title="الزر الثانوي" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
                          <AdminFormGrid columns={1}>
                            <label className="min-w-0">
                              <span className="sr-only">نص زر الإجراء الثانوي</span>
                              <input
                                name="secondary_cta_label"
                                defaultValue={config.secondaryCta?.label ?? ""}
                                aria-label="نص زر الإجراء الثانوي"
                                placeholder="نص الزر الثانوي"
                                className={fieldClassName("h-11 min-w-0")}
                              />
                            </label>
                            <AdminLinkField
                              prefix="secondary_cta"
                              label="رابط زر الإجراء الثانوي"
                              defaultValue={linkDefaultFromContainer(config.secondaryCta as Record<string, unknown>)}
                              showAnchor
                              presentation="inline"
                              actionPresentation="bare"
                              clearLinkLabel="مسح"
                            />
                          </AdminFormGrid>
                        </AdminCard>
                    </AdminFormGrid>
                  </ModuleEditorVisibilityAlignRow>
                ),
              },
              {
                id: "presentation",
                sectionHeaderPresentation: "control",
                content: (
                  <AdminFormGrid columns={2}>
                    <AdminCard presentation="premium" className="p-3">
                      <AdminFormListboxSelect
                        name="background_style"
                        label="نمط الخلفية"
                        defaultValue={config.backgroundStyle ?? "dark"}
                        options={[
                          { value: "dark", label: "داكن" },
                          { value: "gold", label: "ذهبي" },
                          { value: "gradient", label: "متدرّج" },
                        ]}
                        sizing="full"
                      />
                    </AdminCard>
                  </AdminFormGrid>
                ),
              },
              {
                id: "pages",
                sectionHeaderPresentation: "control",
                content: (
                  <ModuleEditorPagesTab
                    moduleName={block.name}
                    assignmentContext={assignmentContext}
                    presentation="premium"
                    showUsageBanner={false}
                  />
                ),
              },
            ]}
          />

          <ModuleEditorSaveArea />
        </AdminFormPendingFields>
      </form>
    </div>
  );
}
