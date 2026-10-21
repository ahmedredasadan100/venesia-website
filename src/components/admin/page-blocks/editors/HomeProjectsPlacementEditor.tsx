"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import {
  AdminFormGrid,
  AdminCard,
  AdminFormControlHeader,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminLinkField,
  AdminTextFormatControls,
} from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { ADMIN_FORM } from "../../../../lib/admin/admin-ui-styles";
import {
  resolvePageBlockTextFormat,
  type HomeProjectsModuleConfig,
} from "../../../../lib/page-blocks/configs";

type HomeProjectsPlacementEditorProps = {
  config: HomeProjectsModuleConfig;
  section?: "all" | "text" | "projects" | "cta";
};

type ButtonAlignment = "right" | "center" | "left";

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
    <AdminCard presentation="premium" className="h-full p-3">
      <AdminFormSwitch
        name={name}
        label={<AdminFormControlHeader presentation="leading-icon" title={label} icon={<AdminModuleTabIcon name="settings" />} />}
        value="true"
        defaultChecked={defaultChecked}
        embedded
      />
    </AdminCard>
  );
}

function AlignmentChoice({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: ButtonAlignment;
}) {
  const [alignment, setAlignment] = useState<ButtonAlignment>(defaultValue);
  return (
    <AdminCard presentation="premium" className="h-full space-y-3 p-3">
      <AdminFormControlHeader presentation="leading-icon" title={label} icon={<AdminModuleTabIcon name="settings" />} />
      <input type="hidden" name={name} value={alignment} />
      <AdminTextFormatControls
        ariaLabel={label}
        alignmentAriaLabel={label}
        alignment={alignment}
        onAlignmentChange={(next) => setAlignment(next as ButtonAlignment)}
      />
    </AdminCard>
  );
}

/** Home projects section copy — project cards load from Supabase projects table. */
export default function HomeProjectsPlacementEditor({
  config,
  section = "all",
}: HomeProjectsPlacementEditorProps) {
  const buttonAlignment =
    config.footerCta?.alignment === "right" ||
    config.footerCta?.alignment === "left"
      ? config.footerCta.alignment
      : "center";
  const cardCtaAlignment =
    config.cardCtaAlignment === "center" || config.cardCtaAlignment === "left"
      ? config.cardCtaAlignment
      : "right";
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow", {
    bold: true,
  });
  const titleFormat = resolvePageBlockTextFormat(config, "title", {
    bold: true,
  });
  const introFormat = resolvePageBlockTextFormat(config, "intro");

  return (
    <div className="space-y-6">
      {section === "all" || section === "projects" ? (
        <AdminFormGrid columns={2}>
          <AdminCard presentation="premium" className="h-full p-3">
            <label className={ADMIN_FORM.labelStack}>
              <AdminFormControlHeader presentation="leading-icon" title="عدد المشاريع المعروضة" icon={<AdminModuleTabIcon name="section" />} />
              <input
                name="projects_limit"
                type="number"
                min={1}
                defaultValue={config.projectsLimit ?? ""}
                placeholder="مثال: 1، 3، 4، 6، 10 — اتركه فارغًا لعرض كل المشاريع"
                dir="ltr"
                className={fieldClassName()}
              />
            </label>
          </AdminCard>
          <VisibilityToggle
            name="show_project_location"
            label="إظهار موقع المشروع داخل البطاقات"
            defaultChecked={config.showProjectLocation !== false}
          />
          <AdminCard presentation="premium" className="h-full p-3">
            <label className={ADMIN_FORM.labelStack}>
              <AdminFormControlHeader presentation="leading-icon" title="نص زر الكارت" icon={<AdminModuleTabIcon name="publish" />} />
              <input
                name="card_cta_label"
                defaultValue={config.cardCtaLabel ?? "استكشف المشروع"}
                required
                className={fieldClassName()}
              />
            </label>
          </AdminCard>
          <AlignmentChoice
            name="card_cta_alignment"
            label="محاذاة زر الكارت"
            defaultValue={cardCtaAlignment}
          />
        </AdminFormGrid>
      ) : null}

      {section === "all" || section === "text" ? (
      <div className="space-y-4">
        <p className="text-xs leading-6 text-white/45">
          اترك أي حقل نصي فارغًا لاستخدام النص الافتراضي الحالي على الموقع.
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
              showDefault={eyebrowFormat.visible}
              boldDefault={eyebrowFormat.bold}
              alignmentDefault={eyebrowFormat.alignment}
            >
              <input
                name="eyebrow"
                aria-label="النص التمهيدي"
                defaultValue={config.eyebrow ?? ""}
                className={fieldClassName()}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="العنوان"
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
              showName="show_title"
              boldName="title_bold"
              alignmentName="title_alignment"
              showDefault={titleFormat.visible}
              boldDefault={titleFormat.bold}
              alignmentDefault={titleFormat.alignment}
            >
              <input
                name="title"
                aria-label="العنوان"
                defaultValue={config.title ?? ""}
                className={fieldClassName()}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="long-content" span={12}>
            <ModuleEditorVisibilityAlignRow
              label="النص التعريفي"
              presentation="premium"
              icon={<AdminModuleTabIcon name="content" />}
              showName="show_intro"
              boldName="intro_bold"
              alignmentName="intro_alignment"
              showDefault={introFormat.visible}
              boldDefault={introFormat.bold}
              alignmentDefault={introFormat.alignment}
            >
              <AdminRichTextEditor
                name="intro"
                label="النص التعريفي"
                defaultValue={config.intro ?? ""}
                toolbarMode="none"
                minHeight={72}
              />
            </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>

      </div>
      ) : null}

      {section === "all" || section === "cta" ? (
        <ModuleEditorFieldGrid className="items-stretch">
          <ModuleEditorField nature="link" span={4}>
            <div data-premium-cta-panel="data" className="h-full">
              <AdminCard presentation="premium" className="flex h-full flex-col gap-3 p-4">
                <header className="min-w-0 space-y-1">
                  <ModuleEditorSectionHeading intent="cta">بيانات الزر</ModuleEditorSectionHeading>
                  <p className="text-xs leading-5 text-white/45">أدخل نص الزر ورابطه.</p>
                </header>
                <AdminFormGrid columns={1}>
                  <AdminCard presentation="premium" className="p-3">
                    <label className={ADMIN_FORM.labelStack}>
                      <span>نص الزر</span>
                      <input
                        name="footer_cta_label"
                        defaultValue={config.footerCta?.label ?? ""}
                        className={fieldClassName()}
                      />
                    </label>
                  </AdminCard>
                  <AdminCard presentation="premium" className="p-3">
                    <AdminLinkField
                      prefix="footer_cta"
                      label="رابط الزر"
                      chooseLinkLabel="اختيار الرابط"
                      clearLinkLabel="مسح الرابط"
                      presentation="inline"
                      actionPresentation="bare"
                      defaultValue={linkDefaultFromContainer(
                        config.footerCta as Record<string, unknown>,
                      )}
                    />
                  </AdminCard>
                </AdminFormGrid>
              </AdminCard>
            </div>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={8}>
            <div data-premium-cta-panel="appearance" className="h-full">
              <AdminCard presentation="premium" className="flex h-full flex-col gap-3 p-4">
                <header className="min-w-0 space-y-1">
                  <ModuleEditorSectionHeading intent="cta">مظهر وسلوك الزر</ModuleEditorSectionHeading>
                  <p className="text-xs leading-5 text-white/45">خصص ظهور الزر وطريقة فتح رابطه ومحاذاته في الصفحة.</p>
                </header>
                <AdminFormGrid columns={2}>
                  <div data-premium-cta-control="visibility" className="min-w-0 h-full">
                    <VisibilityToggle
                      name="show_footer_cta"
                      label="إظهار زر أسفل السكشن"
                      defaultChecked={config.showFooterCta !== false}
                    />
                  </div>
                  <div data-premium-cta-control="target" className="min-w-0 h-full">
                    <AdminCard presentation="premium" className="h-full space-y-3 p-3">
                      <AdminFormListboxSelect
                        name="footer_cta_open_target"
                        label={<AdminFormControlHeader presentation="leading-icon" title="فتح الرابط" description="حدد كيف يتم فتح الرابط." icon={<AdminModuleTabIcon name="publish" />} />}
                        defaultValue={
                          config.footerCta?.target === "_blank" ? "_blank" : "_self"
                        }
                        options={[
                          { value: "_self", label: "نفس النافذة" },
                          { value: "_blank", label: "نافذة جديدة" },
                        ]}
                        sizing="full"
                      />
                    </AdminCard>
                  </div>
                  <div data-premium-cta-control="alignment" className="min-w-0 h-full">
                    <AlignmentChoice
                      name="footer_cta_alignment"
                      label="محاذاة الزر"
                      defaultValue={buttonAlignment}
                    />
                  </div>
                </AdminFormGrid>
              </AdminCard>
            </div>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      ) : null}
    </div>
  );
}
