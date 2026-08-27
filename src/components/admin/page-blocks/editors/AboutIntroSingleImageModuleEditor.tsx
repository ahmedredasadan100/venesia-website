"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorVisibilityAlignRow,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  resolvePageBlockTextFormat,
  type AboutIntroSingleImageModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutIntroSingleImageModuleEditorProps = {
  config: AboutIntroSingleImageModuleConfig;
};

function padBeats(beats: AboutIntroSingleImageModuleConfig["beats"]) {
  const rows = [...(beats ?? [])].slice(0, 3);
  while (rows.length < 3) rows.push({});
  return rows;
}

export default function AboutIntroSingleImageModuleEditor({
  config,
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

  return (
    <div className="space-y-4">
      {/* config_schema is owned by ContentModuleEditClient — avoid duplicate FormData names */}
      <input type="hidden" name="image_position" value={imagePosition} />

      <ModuleEditorSection>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label="النص التمهيدي" showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
            <input name="eyebrow" aria-label="النص التمهيدي" defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label="العنوان" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
            <input name="title" aria-label="العنوان" defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={12}>
          <ModuleEditorVisibilityAlignRow label="العنوان الفرعي" showName="show_subtitle" boldName="subtitle_bold" alignmentName="subtitle_alignment" showDefault={subtitleFormat.visible} boldDefault={subtitleFormat.bold} alignmentDefault={subtitleFormat.alignment}>
            <input name="subtitle" aria-label="العنوان الفرعي" defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow label="الوصف" showName="show_description" boldName="description_bold" alignmentName="description_alignment" showDefault={descriptionFormat.visible} boldDefault={descriptionFormat.bold} alignmentDefault={descriptionFormat.alignment}>
          <AdminRichTextEditor
            name="body"
            label="الوصف"
            defaultValue={config.body ?? ""}
            toolbarMode="none"
            minHeight={72}
          />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <AdminMediaImageField
          name="image_main"
          label="الصورة"
          defaultValue={mainSrc}
          altName="image_main_alt"
          defaultAlt={mainAlt}
          dimensionHint="content"
          browseFolder="images/about"
        />
        <div className="space-y-2">
          <span className="text-xs font-semibold text-white/55">موضع الصورة (سطح المكتب)</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="موضع الصورة">
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
          <p className="text-xs leading-6 text-white/45">
            على الموبايل تظهر الصورة دائمًا أعلى النص بغض النظر عن هذا الاختيار.
          </p>
        </div>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="repeater">البطاقات (3 كحد أقصى)</ModuleEditorSectionHeading>
        <ModuleEditorRepeaterGrid>
          {beats.map((beat, index) => (
            <ModuleEditorRepeaterCard key={index} title={`بطاقة ${index + 1}`}>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-white/55">الرقم / الشارة</span>
                <input
                  name={`beat_${index}_num`}
                  defaultValue={beat.num ?? ""}
                  placeholder={String(index + 1).padStart(2, "0")}
                  className={fieldClassName("h-11")}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-white/55">العنوان</span>
                <input
                  name={`beat_${index}_title`}
                  defaultValue={beat.title ?? ""}
                  className={fieldClassName("h-11")}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-white/55">الوصف</span>
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
      </ModuleEditorSection>
    </div>
  );
}
