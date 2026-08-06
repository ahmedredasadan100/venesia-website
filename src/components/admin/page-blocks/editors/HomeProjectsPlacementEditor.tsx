"use client";

import {
  ModuleEditorHeadingVisibilityRow,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminNotice from "../../AdminNotice";
import AdminRichTextEditor from "../../AdminRichTextEditor";
import { AdminFormGrid, AdminFormListboxSelect, AdminFormSwitch, AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { HomeProjectsModuleConfig } from "../../../../lib/page-blocks/configs";

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
  return <AdminFormSwitch name={name} label={label} value="true" defaultChecked={defaultChecked} surface />;
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
  const options: Array<{ value: ButtonAlignment; label: string }> = [
    { value: "right", label: "يمين" },
    { value: "center", label: "وسط" },
    { value: "left", label: "يسار" },
  ];

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input type="hidden" name={name} value={alignment} />
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === alignment;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.label}
              aria-label={option.label}
              onClick={() => setAlignment(option.value)}
              className={[
                "cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition",
                active
                  ? "border-[#D8B87A]/40 bg-[#D8B87A]/15 text-[#F2D99B]"
                  : "border-white/10 bg-white/[0.035] text-white/70 hover:border-[#D8B87A]/30 hover:text-[#F2D99B]",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EyebrowFormatControls({
  boldDefault,
  alignmentDefault,
}: {
  boldDefault: boolean;
  alignmentDefault: ButtonAlignment;
}) {
  const [bold, setBold] = useState(boldDefault);
  const [alignment, setAlignment] = useState<ButtonAlignment>(alignmentDefault);
  const alignOptions: Array<{ value: ButtonAlignment; label: string }> = [
    { value: "right", label: "يمين" },
    { value: "center", label: "وسط" },
    { value: "left", label: "يسار" },
  ];

  const toolClass = (active: boolean) =>
    [
      "min-w-9 cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition sm:min-w-10 sm:px-3",
      active
        ? "border-[#D8B87A]/40 bg-[#D8B87A]/15 text-[#F2D99B]"
        : "border-white/10 bg-white/[0.035] text-white/70 hover:border-[#D8B87A]/30 hover:text-[#F2D99B]",
    ].join(" ");

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-white/55">تنسيق العنوان التمهيدي</span>
      <input type="hidden" name="eyebrow_bold" value={bold ? "true" : "false"} />
      <input type="hidden" name="eyebrow_alignment" value={alignment} />
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="تنسيق العنوان التمهيدي الصغير">
        <button
          type="button"
          title="عريض"
          aria-label="عريض"
          aria-pressed={bold}
          onClick={() => setBold((current) => !current)}
          className={toolClass(bold)}
        >
          عريض
        </button>
        {alignOptions.map((option) => {
          const active = option.value === alignment;
          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => setAlignment(option.value)}
              className={toolClass(active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-6 text-white/45">
        يؤثر على العنوان التمهيدي الصغير فقط — لا يغيّر العنوان الكبير ولا النص التمهيدي في العمود الآخر.
      </p>
    </div>
  );
}

/** Home projects section copy — project cards load from Supabase projects table. */
export default function HomeProjectsPlacementEditor({ config }: HomeProjectsPlacementEditorProps) {
  const buttonAlignment =
    config.footerCta?.alignment === "right" || config.footerCta?.alignment === "left"
      ? config.footerCta.alignment
      : "center";
  const cardCtaAlignment =
    config.cardCtaAlignment === "center" || config.cardCtaAlignment === "left"
      ? config.cardCtaAlignment
      : "right";
  const eyebrowBold = config.eyebrowBold !== false;
  const eyebrowAlignment =
    config.eyebrowAlignment === "center" || config.eyebrowAlignment === "left"
      ? config.eyebrowAlignment
      : "right";

  return (
    <div className="space-y-6">
      <AdminNotice
        variant="info"
        title="بيانات الكروت"
        message="الصور والأكواد والأوصاف وترتيب الظهور تُدار من لوحة المشاريع عبر «الظهور في الصفحة الرئيسية» و«ترتيب الصفحة الرئيسية» — وليس من هذا الموديول."
      />

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">عرض المشاريع</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">عدد المشاريع المعروضة</span>
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
        <p className="text-xs leading-6 text-white/45">
          يُطبَّق على المشاريع حسب ترتيب الصفحة الرئيسية. اترك الحقل فارغًا لعرض كل المشاريع المؤهلة مع التقسيم الصفحي.
        </p>
        <AlignmentChoice
          name="card_cta_alignment"
          label="محاذاة زر الكارت"
          defaultValue={cardCtaAlignment}
        />
        <p className="text-xs leading-6 text-white/45">
          موضع زر «استكشف المشروع» داخل كل كارت في الصفحة الرئيسية فقط — لا يؤثر على صفحة المشاريع أو المميز.
        </p>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">نصوص السكشن</h2>
        <p className="text-xs leading-6 text-white/45">
          اترك أي حقل نصي فارغًا لاستخدام النص الافتراضي الحالي على الموقع.
        </p>

        <ModuleEditorHeadingVisibilityRow
          name="show_eyebrow"
          label="إظهار العنوان التمهيدي الصغير"
          defaultChecked={config.showEyebrow !== false}
        >
          <label className="block min-w-0 space-y-2">
            <span className="text-xs font-semibold text-white/55">العنوان التمهيدي الصغير</span>
            <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
          </label>
        </ModuleEditorHeadingVisibilityRow>
        <EyebrowFormatControls boldDefault={eyebrowBold} alignmentDefault={eyebrowAlignment} />

        <ModuleEditorHeadingVisibilityRow
          name="show_title"
          label="إظهار العنوان"
          defaultChecked={config.showTitle !== false}
        >
          <label className="block min-w-0 space-y-2">
            <span className="text-xs font-semibold text-white/55">العنوان</span>
            <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
          </label>
        </ModuleEditorHeadingVisibilityRow>

        <AdminFormGrid>
          <VisibilityToggle name="show_intro" label="إظهار النص التمهيدي" defaultChecked={config.showIntro !== false} />
          <VisibilityToggle name="show_footer_cta" label="إظهار زر أسفل السكشن" defaultChecked={config.showFooterCta !== false} />
        </AdminFormGrid>

        <AdminRichTextEditor
          name="intro"
          label="النص التمهيدي"
          defaultValue={config.intro ?? ""}
          toolbarMode="minimal"
          enableTextAlign
          minHeight={160}
          helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
        />
      </ModuleEditorSection>

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">زر أسفل السكشن</h2>

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
          defaultValue={linkDefaultFromContainer(config.footerCta as Record<string, unknown>)}
        />

        <AdminFormListboxSelect
          name="footer_cta_open_target"
          label="فتح الرابط"
          defaultValue={config.footerCta?.target === "_blank" ? "_blank" : "_self"}
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
