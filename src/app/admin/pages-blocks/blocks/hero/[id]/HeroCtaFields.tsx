"use client";

import { AdminLinkField } from "../../../../../../components/admin/ui";
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
      alignmentName="cta_alignment"
      showName="show_cta"
      boldName="cta_bold"
      alignmentDefault={alignmentDefault}
      boldDefault={boldDefault}
      enableAlignment={enableAlignment}
      showDefault={showDefault}
      controlsPlacement="cards"
      presentation="plain"
    >
        <div data-hero-cta-row="primary">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-0">
            <label className="min-w-0">
              <span className="sr-only">نص الزر الأساسي</span>
              <input
                name="primary_cta_label"
                defaultValue={primaryLabel}
                maxLength={100}
                aria-label="نص الزر الأساسي"
                placeholder="نص الزر الأساسي"
                className={fieldClassName("relative z-0 h-11 min-w-0 rounded-e-none focus:z-10")}
              />
            </label>
            <AdminLinkField
              prefix="primary_cta"
              label="رابط الزر الأساسي"
              defaultValue={primaryLink}
              showAnchor
              presentation="inline"
              chooseLinkLabel="اختيار الرابط"
              clearLinkLabel="مسح"
            />
          </div>
        </div>
        <div data-hero-cta-row="secondary">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-0">
            <label className="min-w-0">
              <span className="sr-only">نص الزر الثانوي</span>
              <input
                name="secondary_cta_label"
                defaultValue={secondaryLabel}
                maxLength={100}
                aria-label="نص الزر الثانوي"
                placeholder="نص الزر الثانوي"
                className={fieldClassName("relative z-0 h-11 min-w-0 rounded-e-none focus:z-10")}
              />
            </label>
            <AdminLinkField
              prefix="secondary_cta"
              label="رابط الزر الثانوي"
              defaultValue={secondaryLink}
              showAnchor
              presentation="inline"
              chooseLinkLabel="اختيار الرابط"
              clearLinkLabel="مسح"
            />
          </div>
        </div>
    </HeroVisibilityAlignRow>
  );
}
