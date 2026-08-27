"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import {
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminLinkField,
  AdminTextFormatControls,
} from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type HomeProjectsModuleConfig,
} from "../../../../lib/page-blocks/configs";

type HomeProjectsPlacementEditorProps = {
  config: HomeProjectsModuleConfig;
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
    <AdminFormSwitch
      name={name}
      label={label}
      value="true"
      defaultChecked={defaultChecked}
      surface
    />
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
    <div className="space-y-2">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input type="hidden" name={name} value={alignment} />
      <AdminTextFormatControls
        ariaLabel={label}
        alignmentAriaLabel={label}
        alignment={alignment}
        onAlignmentChange={(next) => setAlignment(next as ButtonAlignment)}
      />
    </div>
  );
}

/** Home projects section copy — project cards load from Supabase projects table. */
export default function HomeProjectsPlacementEditor({
  config,
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
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain">
          عرض المشاريع
        </ModuleEditorSectionHeading>
        <ModuleEditorFieldGrid className="mt-4">
          <ModuleEditorField nature="technical" span={4}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">
                عدد المشاريع المعروضة
              </span>
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
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={4}>
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">
                نص زر الكارت
              </span>
              <input
                name="card_cta_label"
                defaultValue={config.cardCtaLabel ?? "استكشف المشروع"}
                required
                className={fieldClassName()}
              />
            </label>
          </ModuleEditorField>
          <ModuleEditorField nature="standard" span={4}>
            <AlignmentChoice
              name="card_cta_alignment"
              label="محاذاة زر الكارت"
              defaultValue={cardCtaAlignment}
            />
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <p className="text-xs leading-6 text-white/45">
          اترك أي حقل نصي فارغًا لاستخدام النص الافتراضي الحالي على الموقع.
        </p>

        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
            <ModuleEditorVisibilityAlignRow
              label="النص التمهيدي"
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

        <AdminFormGrid>
          <VisibilityToggle
            name="show_project_location"
            label="إظهار موقع المشروع داخل البطاقات"
            defaultChecked={config.showProjectLocation !== false}
          />
          <VisibilityToggle
            name="show_footer_cta"
            label="إظهار زر أسفل السكشن"
            defaultChecked={config.showFooterCta !== false}
          />
        </AdminFormGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="cta">
          زر أسفل السكشن
        </ModuleEditorSectionHeading>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">نص الزر</span>
          <input
            name="footer_cta_label"
            defaultValue={config.footerCta?.label ?? ""}
            className={fieldClassName()}
          />
        </label>

        <AdminLinkField
          prefix="footer_cta"
          label="رابط الزر"
          chooseLinkLabel="اختيار الرابط"
          clearLinkLabel="مسح الرابط"
          defaultValue={linkDefaultFromContainer(
            config.footerCta as Record<string, unknown>,
          )}
        />

        <AdminFormListboxSelect
          name="footer_cta_open_target"
          label="فتح الرابط"
          defaultValue={
            config.footerCta?.target === "_blank" ? "_blank" : "_self"
          }
          options={[
            { value: "_self", label: "نفس النافذة" },
            { value: "_blank", label: "نافذة جديدة" },
          ]}
        />

        <AlignmentChoice
          name="footer_cta_alignment"
          label="محاذاة الزر"
          defaultValue={buttonAlignment}
        />
      </ModuleEditorSection>
    </div>
  );
}
