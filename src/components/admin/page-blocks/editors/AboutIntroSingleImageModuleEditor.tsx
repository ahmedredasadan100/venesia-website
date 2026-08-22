"use client";

import {
  ModuleEditorContentGroup,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutIntroSingleImageModuleConfig } from "../../../../lib/page-blocks/configs";

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

  return (
    <div className="space-y-4">
      {/* config_schema is owned by ContentModuleEditClient — avoid duplicate FormData names */}
      <input type="hidden" name="image_position" value={imagePosition} />

      <ModuleEditorSection>
        <ModuleEditorContentGroup kind="short">
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={3}><label className="block space-y-1.5">
          <span className="text-xs font-semibold text-white/55">النص التمهيدي</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="short-text" span={4}><label className="block space-y-1.5">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="short-description" span={5}><label className="block space-y-1.5">
          <span className="text-xs font-semibold text-white/55">العنوان الفرعي</span>
          <input name="subtitle" defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
        </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
        </ModuleEditorContentGroup>
        <ModuleEditorContentGroup kind="long">
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="long-content" span={12}><div>
          <AdminRichTextEditor
            name="body"
            label="الوصف"
            defaultValue={config.body ?? ""}
            toolbarMode="minimal"
            enableTextAlign
            minHeight={160}
            helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          />
        </div></ModuleEditorField>
        </ModuleEditorFieldGrid>
        </ModuleEditorContentGroup>
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
