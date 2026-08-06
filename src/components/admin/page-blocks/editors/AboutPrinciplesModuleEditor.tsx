"use client";

import {
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorRepeaterCard,
  ModuleEditorRepeaterGrid,
  ModuleEditorSection,
} from "../ModuleEditorPresentation";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminFormListboxSelect, AdminFormSwitch } from "../../ui";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  ABOUT_PRINCIPLES_ICON_KEYS,
  type AboutPrinciplesItemConfig,
  type AboutPrinciplesModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutPrinciplesModuleEditorProps = {
  config: AboutPrinciplesModuleConfig;
  editorMode?: "about-principles" | "home-trust";
};

type TextAlignment = "right" | "center" | "left";

const ICON_LABELS: Record<(typeof ABOUT_PRINCIPLES_ICON_KEYS)[number], string> = {
  land: "أرض / مبنى",
  engineering: "هندسة",
  timeline: "مراحل / توثيق",
};

function normalizeItems(items: AboutPrinciplesItemConfig[] | undefined) {
  const rows = [...(items ?? [])].filter((item) => item.title?.trim() || item.description?.trim());
  return rows.length ? rows : [{ icon: "land" }];
}

function padTrustItems(items: AboutPrinciplesItemConfig[] | undefined) {
  const rows = [...(items ?? [])].slice(0, 4);
  while (rows.length < 4) rows.push({});
  return rows;
}

function PlainTextFormatControls({
  label,
  boldName,
  alignmentName,
  boldDefault,
  alignmentDefault,
  helperText,
}: {
  label: string;
  boldName: string;
  alignmentName: string;
  boldDefault: boolean;
  alignmentDefault: TextAlignment;
  helperText?: string;
}) {
  const [bold, setBold] = useState(boldDefault);
  const [alignment, setAlignment] = useState<TextAlignment>(alignmentDefault);
  const alignOptions: Array<{ value: TextAlignment; label: string }> = [
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
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input type="hidden" name={alignmentName} value={alignment} />
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={label}>
        <AdminFormSwitch
          name={boldName}
          label="خط عريض"
          value="true"
          checked={bold}
          onChange={(event) => setBold(event.target.checked)}
        />
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
      {helperText ? <p className="text-xs leading-6 text-white/45">{helperText}</p> : null}
    </div>
  );
}

export default function AboutPrinciplesModuleEditor({
  config,
  editorMode = "about-principles",
}: AboutPrinciplesModuleEditorProps) {
  const isHomeTrust = editorMode === "home-trust";
  const [items, setItems] = useState<AboutPrinciplesItemConfig[]>(() =>
    isHomeTrust ? padTrustItems(config.items) : normalizeItems(config.items),
  );

  const eyebrowBold = config.eyebrowBold === true;
  const eyebrowAlignment: TextAlignment =
    config.eyebrowAlignment === "center" || config.eyebrowAlignment === "left"
      ? config.eyebrowAlignment
      : "right";
  const titleBold = config.titleBold !== false;
  const titleAlignment: TextAlignment =
    config.titleAlignment === "center" || config.titleAlignment === "left"
      ? config.titleAlignment
      : "right";

  const moveItem = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const next = [...items];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setItems(next);
  };

  const updateItem = (index: number, patch: Partial<AboutPrinciplesItemConfig>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const addItem = () => {
    if (items.length >= 6) return;
    setItems((current) => [...current, { icon: "land" }]);
  };

  return (
    <div className="space-y-6">
      {isHomeTrust ? <input type="hidden" name="include_home_trust_intro" value="1" /> : null}
      <input type="hidden" name="principle_count" value={String(items.length)} />

      <ModuleEditorSection>
        <h2 className="text-sm font-semibold text-white">{isHomeTrust ? "نصوص القسم" : "العنوان"}</h2>
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={3}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">النص التمهيدي</span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label></ModuleEditorField>
        <ModuleEditorField nature="short-text" span={9}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان الرئيسي</span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
        {isHomeTrust ? (
          <PlainTextFormatControls
            label="تنسيق النص التمهيدي"
            boldName="eyebrow_bold"
            alignmentName="eyebrow_alignment"
            boldDefault={eyebrowBold}
            alignmentDefault={eyebrowAlignment}
            helperText="يؤثر على النص التمهيدي فقط."
          />
        ) : null}
        {isHomeTrust ? (
          <PlainTextFormatControls
            label="تنسيق العنوان الرئيسي"
            boldName="title_bold"
            alignmentName="title_alignment"
            boldDefault={titleBold}
            alignmentDefault={titleAlignment}
            helperText="العنوان يبقى نصًا بسيطًا — بدون HTML داخلي."
          />
        ) : null}
        {isHomeTrust ? (
          <ModuleEditorFieldGrid><ModuleEditorField nature="long-content"><AdminRichTextEditor
            name="principles_intro"
            label="الفقرة التعريفية"
            defaultValue={config.description ?? ""}
            toolbarMode="minimal"
            enableTextAlign
            minHeight={160}
            helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          /></ModuleEditorField></ModuleEditorFieldGrid>
        ) : null}
      </ModuleEditorSection>

      <ModuleEditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            {isHomeTrust ? "بطاقات الثقة (4)" : "المبادئ (حتى 6)"}
          </h2>
          {!isHomeTrust ? (
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= 6}
              className="cursor-pointer rounded-2xl border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-2 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              إضافة عنصر
            </button>
          ) : null}
        </div>

        <ModuleEditorRepeaterGrid>
          {items.map((item, index) => (
            <ModuleEditorRepeaterCard
              key={index}
              title={isHomeTrust ? `بطاقة ${index + 1}` : `عنصر ${index + 1}`}
              actions={!isHomeTrust ? (
                <>
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="cursor-pointer rounded-xl border border-white/10 px-3 py-1 text-xs text-white/55 hover:bg-white/5 disabled:opacity-40"
                    >
                      حذف
                    </button>
                </>
              ) : undefined}
            >

              <input type="hidden" name={`principle_${index}_title`} value={item.title ?? ""} />
              <input type="hidden" name={`principle_${index}_description`} value={item.description ?? ""} />

              {!isHomeTrust ? (
                <AdminFormListboxSelect
                    name={`principle_${index}_icon`}
                    label="الأيقونة"
                    value={item.icon ?? "land"}
                    onChange={(value) => updateItem(index, { icon: value })}
                    options={ABOUT_PRINCIPLES_ICON_KEYS.map((key) => ({ value: key, label: ICON_LABELS[key] }))}
                />
              ) : (
                <input type="hidden" name={`principle_${index}_icon`} value={item.icon ?? "land"} />
              )}
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">
                  {isHomeTrust ? "عنوان البطاقة" : "عنوان العنصر"}
                </span>
                <input
                  value={item.title ?? ""}
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">
                  {isHomeTrust ? "وصف البطاقة" : "وصف العنصر"}
                </span>
                <textarea
                  value={item.description ?? ""}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
              {isHomeTrust ? (
                  <AdminMediaImageField
                    name={`principle_${index}_image`}
                    label="صورة الكارت — اختياري"
                    defaultValue={item.image ?? ""}
                    altName={`principle_${index}_image_alt`}
                    defaultAlt={item.imageAlt ?? ""}
                    altLabel="النص البديل للصورة — اختياري"
                    dimensionHint="content"
                    browseFolder="images/home"
                    onValueChange={(value) => updateItem(index, { image: value || undefined })}
                  />
              ) : null}
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </ModuleEditorSection>
    </div>
  );
}
