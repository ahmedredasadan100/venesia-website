"use client";

import { AdminFormGrid, AdminLinkField } from "../../../../../../components/admin/ui";
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
  alignmentDefault = "right",
  enableAlignment = true,
}: HeroCtaFieldsProps) {
  const presentationControls = (
    <HeroVisibilityAlignRow
      label="عرض زر الإجراء"
      alignmentName="cta_alignment"
      showName="show_cta"
      alignmentDefault={alignmentDefault}
      enableAlignment={enableAlignment}
      showDefault={showDefault}
      helperText="يُطبّق الظهور والمحاذاة على أزرار الهيرو المعروضة في الصفحة."
    />
  );

  if (linkSource === "project-domain") {
    return (
      <div className="space-y-5">
        {presentationControls}
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">نص زر المشروع</span>
          <input
            name="primary_cta_label"
            defaultValue={primaryLabel}
            maxLength={100}
            className={fieldClassName("h-11")}
          />
          <span className="block text-xs leading-6 text-white/45">
            يفتح الزر صفحة المشروع الحالية تلقائيًا؛ الرابط مملوك لـProjects Domain ولا يحتاج إدخالًا يدويًا.
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {presentationControls}
      <AdminFormGrid>
        <label className="space-y-2">
          <span className="text-xs font-semibold text-white/55">الزر الأساسي — النص</span>
          <input
            name="primary_cta_label"
            defaultValue={primaryLabel}
            maxLength={100}
            className={fieldClassName("h-11")}
          />
        </label>
        <AdminLinkField
          prefix="primary_cta"
          label="الزر الأساسي — الرابط"
          defaultValue={primaryLink}
          helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
          showAnchor
        />
        <label className="space-y-2">
          <span className="text-xs font-semibold text-white/55">الزر الثانوي — النص</span>
          <input
            name="secondary_cta_label"
            defaultValue={secondaryLabel}
            maxLength={100}
            className={fieldClassName("h-11")}
          />
        </label>
        <AdminLinkField
          prefix="secondary_cta"
          label="الزر الثانوي — الرابط"
          defaultValue={secondaryLink}
          helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
          showAnchor
        />
      </AdminFormGrid>
    </div>
  );
}
