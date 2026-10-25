"use client";

import {
  AdminFormGrid,
  AdminFormField,
  AdminLinkField,
} from "../../../../../../components/admin/ui";
import { ModuleEditorSection } from "../../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import { AdminModuleTabIcon } from "../../../../../../components/admin/ui/AdminModuleTabs";
import type { AdminLinkValue } from "../../../../../../lib/admin/links/types";
import type { HeroTextAlignment } from "../../../../../../lib/hero/hero-content-controls";
import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";

type HeroCtaFieldsProps = {
  primaryLabel?: string;
  primaryLink?: AdminLinkValue;
  secondaryLabel?: string;
  secondaryLink?: AdminLinkValue;
  linkSource?: "admin" | "project-domain";
  showDefault?: boolean;
  boldDefault?: boolean;
  alignmentDefault?: HeroTextAlignment;
  enableAlignment?: boolean;
};

/** Shared Hero CTA text/link editor. Visibility and alignment live with Hero presentation controls. */
export default function HeroCtaFields({
  primaryLabel = "",
  primaryLink,
  secondaryLabel = "",
  secondaryLink,
  linkSource = "admin",
  showDefault = true,
  boldDefault = false,
  alignmentDefault = "right",
  enableAlignment = true,
}: HeroCtaFieldsProps) {
  const projectActionLabelField = (
    <input
      name="primary_cta_label"
      defaultValue={primaryLabel}
      maxLength={100}
      aria-label="نص زر فتح تفاصيل المشروع"
      placeholder="نص زر فتح التفاصيل"
      className={fieldClassName("h-11 min-w-0")}
    />
  );
  if (linkSource === "project-domain") {
    return (
      <HeroVisibilityAlignRow
        label="زر فتح تفاصيل المشروع"
        alignmentName="cta_alignment"
        showName="show_cta"
        boldName="cta_bold"
        alignmentDefault={alignmentDefault}
        boldDefault={boldDefault}
        enableAlignment={enableAlignment}
        showDefault={showDefault}
        icon={<AdminModuleTabIcon name="section" />}
      >
        <AdminFormField label="نص زر فتح التفاصيل" presentation="panel">
            {projectActionLabelField}
          </AdminFormField>
      </HeroVisibilityAlignRow>
    );
  }

  return (
    <HeroVisibilityAlignRow
      label="تنسيق الأزرار"
      icon={<AdminModuleTabIcon name="section" />}
      alignmentName="cta_alignment"
      showName="show_cta"
      boldName="cta_bold"
      alignmentDefault={alignmentDefault}
      boldDefault={boldDefault}
      enableAlignment={enableAlignment}
      showDefault={showDefault}
    >
      <AdminFormGrid columns={2}>
        <div data-hero-cta-row="primary">
          <ModuleEditorSection title="الزر الأساسي" className="h-full">
            <AdminFormGrid columns={1}>
              <AdminFormField label="نص الزر الأساسي">
                <input
                  name="primary_cta_label"
                  defaultValue={primaryLabel}
                  maxLength={100}
                  aria-label="نص الزر الأساسي"
                  placeholder="نص الزر الأساسي"
                  className={fieldClassName("h-11 min-w-0")}
                />
              </AdminFormField>
              <AdminLinkField
                prefix="primary_cta"
                label="رابط الزر الأساسي"
                defaultValue={primaryLink}
                showAnchor
                presentation="inline"
                actionPresentation="bare"
                chooseLinkLabel="اختيار الرابط"
                clearLinkLabel="مسح"
              />
            </AdminFormGrid>
          </ModuleEditorSection>
        </div>
        <div data-hero-cta-row="secondary">
          <ModuleEditorSection title="الزر الثانوي" className="h-full">
            <AdminFormGrid columns={1}>
              <AdminFormField label="نص الزر الثانوي">
                <input
                  name="secondary_cta_label"
                  defaultValue={secondaryLabel}
                  maxLength={100}
                  aria-label="نص الزر الثانوي"
                  placeholder="نص الزر الثانوي"
                  className={fieldClassName("h-11 min-w-0")}
                />
              </AdminFormField>
              <AdminLinkField
                prefix="secondary_cta"
                label="رابط الزر الثانوي"
                defaultValue={secondaryLink}
                showAnchor
                presentation="inline"
                actionPresentation="bare"
                chooseLinkLabel="اختيار الرابط"
                clearLinkLabel="مسح"
              />
            </AdminFormGrid>
          </ModuleEditorSection>
        </div>
      </AdminFormGrid>
    </HeroVisibilityAlignRow>
  );
}
