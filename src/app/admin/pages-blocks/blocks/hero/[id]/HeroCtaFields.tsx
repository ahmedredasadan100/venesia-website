"use client";

import {
  AdminCard,
  AdminFormControlHeader,
  AdminFormGrid,
  AdminLinkField,
} from "../../../../../../components/admin/ui";
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
        controlsPlacement="header"
      >
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">
            نص زر فتح التفاصيل
          </span>
          <input
            name="primary_cta_label"
            defaultValue={primaryLabel}
            maxLength={100}
            aria-label="نص زر فتح تفاصيل المشروع"
            placeholder="نص زر فتح التفاصيل"
            className={fieldClassName("h-11 min-w-0")}
          />
        </label>
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
      presentation="premium"
    >
      <AdminFormGrid columns={2}>
        <div data-hero-cta-row="primary">
          <AdminCard presentation="premium" className="h-full space-y-3 p-3">
            <AdminFormControlHeader title="الزر الأساسي" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
            <AdminFormGrid columns={1}>
              <label className="block min-w-0 space-y-2">
                <input
                  name="primary_cta_label"
                  defaultValue={primaryLabel}
                  maxLength={100}
                  aria-label="نص الزر الأساسي"
                  placeholder="نص الزر الأساسي"
                  className={fieldClassName("h-11 min-w-0")}
                />
              </label>
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
          </AdminCard>
        </div>
        <div data-hero-cta-row="secondary">
          <AdminCard presentation="premium" className="h-full space-y-3 p-3">
            <AdminFormControlHeader title="الزر الثانوي" icon={<AdminModuleTabIcon name="section" />} presentation="leading-icon" />
            <AdminFormGrid columns={1}>
              <label className="block min-w-0 space-y-2">
                <input
                  name="secondary_cta_label"
                  defaultValue={secondaryLabel}
                  maxLength={100}
                  aria-label="نص الزر الثانوي"
                  placeholder="نص الزر الثانوي"
                  className={fieldClassName("h-11 min-w-0")}
                />
              </label>
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
          </AdminCard>
        </div>
      </AdminFormGrid>
    </HeroVisibilityAlignRow>
  );
}
