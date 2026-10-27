"use client";
import { contentModuleMediaSlot } from "../../../../lib/page-blocks/configs";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminCard, AdminFormControlHeader, AdminFormGrid } from "../../ui";
import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import { ADMIN_FORM, adminChoiceButtonClassName, adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type AboutIntroSingleImageModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutIntroSingleImageModuleEditorProps = {
  config: AboutIntroSingleImageModuleConfig;
  section?: "all" | "text" | "images" | "cards";
};

function padBeats(beats: AboutIntroSingleImageModuleConfig["beats"]) {
  const rows = [...(beats ?? [])].slice(0, 3);
  while (rows.length < 3) rows.push({});
  return rows;
}

export default function AboutIntroSingleImageModuleEditor({
  config,
  section = "all",
}: AboutIntroSingleImageModuleEditorProps) {
  const beats = padBeats(config.beats);
  const [imagePosition, setImagePosition] = useState<"left" | "right">(
    config.imagePosition === "right" ? "right" : "left",
  );
  const mainSrc = config.images?.main ?? "";
  const mainAlt = config.images?.mainAlt ?? "";
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const subtitleFormat = resolvePageBlockTextFormat(config, "subtitle");
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");
  const showText = section === "all" || section === "text";
  const showImages = section === "all" || section === "images";
  const showCards = section === "all" || section === "cards";

  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      {/* config_schema is owned by ContentModuleEditClient — avoid duplicate FormData names */}
      {showText ? (
      <div>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow icon={<AdminModuleTabIcon name="content" />} label="النص التمهيدي" showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
            <input name="eyebrow" aria-label="النص التمهيدي" defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow icon={<AdminModuleTabIcon name="content" />} label="العنوان" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
            <input name="title" aria-label="العنوان" defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={12}>
          <ModuleEditorVisibilityAlignRow icon={<AdminModuleTabIcon name="content" />} label="العنوان الفرعي" showName="show_subtitle" boldName="subtitle_bold" alignmentName="subtitle_alignment" showDefault={subtitleFormat.visible} boldDefault={subtitleFormat.bold} alignmentDefault={subtitleFormat.alignment}>
            <input name="subtitle" aria-label="العنوان الفرعي" defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow icon={<AdminModuleTabIcon name="content" />} label="الوصف" showName="show_description" showDefault={descriptionFormat.visible} controlMode="visibility-only">
          <AdminRichTextEditor
            name="body"
            label="الوصف"
            showLabel={false}
            defaultValue={config.body ?? ""}
            toolbarMode="full"
            enableArticleStructure
            enableTextAlign
            legacyHtmlFormatting={{ boldName: "description_bold", bold: descriptionFormat.bold, alignmentName: "description_alignment", alignment: descriptionFormat.alignment }}
            helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </div>
      ) : null}

      {showImages ? (
        <AdminFormGrid columns={2}>
          <input type="hidden" name="image_position" value={imagePosition} />
          <AdminCard presentation="premium" className="flex min-w-0 flex-col gap-3 p-3">
          <AdminFormControlHeader title="الصورة" presentation="leading-icon" icon={<AdminModuleTabIcon name="media" />} />
          <AdminMediaImageField
            mediaSlot={contentModuleMediaSlot("about-intro-single-image")}
            name="image_main"
            label="الصورة"
            variant="card"
            showLabel={false}
            defaultValue={mainSrc}
            altName="image_main_alt"
            defaultAlt={mainAlt}
            altLabel="النص البديل للصورة (Alt Text)"
            browseFolder="images/about"
          />
          </AdminCard>
          <AdminCard presentation="premium" className="h-full space-y-3 p-3">
            <AdminFormControlHeader title="موضع الصورة (سطح المكتب)" presentation="leading-icon" icon={<AdminModuleTabIcon name="settings" />} />
            <div className={ADMIN_FORM.choiceGroup} role="radiogroup" aria-label="موضع الصورة">
              {(
                [
                  { value: "right" as const, label: "الصورة يمين" },
                  { value: "left" as const, label: "الصورة شمال" },
                ] as const
              ).map((option) => {
                const active = imagePosition === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setImagePosition(option.value)}
                    className={adminChoiceButtonClassName(active, "", "compact")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </AdminCard>
        </AdminFormGrid>
      ) : null}

      {showCards ? (
        <ModuleEditorRepeaterGrid>
          {beats.map((beat, index) => (
            <ModuleEditorRepeaterCard key={index} title={`بطاقة ${index + 1}`} icon={<AdminModuleTabIcon name="section" />}>
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text>الرقم / الشارة</span>
                <input
                  name={`beat_${index}_num`}
                  defaultValue={beat.num ?? ""}
                  placeholder={String(index + 1).padStart(2, "0")}
                  className={fieldClassName("h-11")}
                />
              </label>
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text>العنوان</span>
                <input
                  name={`beat_${index}_title`}
                  defaultValue={beat.title ?? ""}
                  className={fieldClassName("h-11")}
                />
              </label>
              <label className={adminFormLabelClassName({ textInset: true })}>
                <span data-admin-form-label-text>الوصف</span>
                <textarea
                  name={`beat_${index}_text`}
                  defaultValue={beat.text ?? ""}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      ) : null}
    </div>
  );
}
