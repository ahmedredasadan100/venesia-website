"use client";

import { useState } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
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
      <input type="hidden" name={boldName} value={bold ? "true" : "false"} />
      <input type="hidden" name={alignmentName} value={alignment} />
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label={label}>
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
      <input type="hidden" name="config_schema" value="about-principles" />
      {isHomeTrust ? <input type="hidden" name="include_home_trust_intro" value="1" /> : null}
      <input type="hidden" name="principle_count" value={String(items.length)} />

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">{isHomeTrust ? "نصوص القسم" : "العنوان"}</h2>
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">
            {isHomeTrust ? "عنوان تمهيدي — Eyebrow" : "Eyebrow"}
          </span>
          <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </label>
        {isHomeTrust ? (
          <PlainTextFormatControls
            label="تنسيق العنوان التمهيدي"
            boldName="eyebrow_bold"
            alignmentName="eyebrow_alignment"
            boldDefault={eyebrowBold}
            alignmentDefault={eyebrowAlignment}
            helperText="يؤثر على العنوان التمهيدي الصغير فقط — النص يبقى Plain Text."
          />
        ) : null}
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">
            {isHomeTrust ? "العنوان الرئيسي — Title" : "Title"}
          </span>
          <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </label>
        {isHomeTrust ? (
          <PlainTextFormatControls
            label="تنسيق العنوان الرئيسي"
            boldName="title_bold"
            alignmentName="title_alignment"
            boldDefault={titleBold}
            alignmentDefault={titleAlignment}
            helperText="العنوان يبقى نصًا بسيطًا داخل عنصر العنوان الدلالي — بدون HTML داخلي."
          />
        ) : null}
        {isHomeTrust ? (
          <AdminRichTextEditor
            name="principles_intro"
            label="الفقرة التعريفية — Intro"
            defaultValue={config.description ?? ""}
            toolbarMode="minimal"
            enableTextAlign
            minHeight={160}
            helperText="Bold على العبارة المطلوبة، وEnter لفقرة جديدة، وShift + Enter لسطر داخل الفقرة. محاذاة الفقرة من شريط الأدوات."
          />
        ) : null}
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
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

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#D8B87A]/70">
                  {isHomeTrust ? `بطاقة ${index + 1}` : `عنصر ${index + 1}`}
                </p>
                {!isHomeTrust ? (
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : null}
              </div>

              <input type="hidden" name={`principle_${index}_icon`} value={item.icon ?? "land"} />
              <input type="hidden" name={`principle_${index}_title`} value={item.title ?? ""} />
              <input type="hidden" name={`principle_${index}_description`} value={item.description ?? ""} />

              {!isHomeTrust ? (
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-white/55">Icon</span>
                  <select
                    value={item.icon ?? "land"}
                    onChange={(event) => updateItem(index, { icon: event.target.value })}
                    className={fieldClassName()}
                  >
                    {ABOUT_PRINCIPLES_ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {ICON_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">
                  {isHomeTrust ? "عنوان البطاقة" : "Title"}
                </span>
                <input
                  value={item.title ?? ""}
                  onChange={(event) => updateItem(index, { title: event.target.value })}
                  className={fieldClassName()}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/55">
                  {isHomeTrust ? "وصف البطاقة" : "Description"}
                </span>
                <textarea
                  value={item.description ?? ""}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                  rows={3}
                  className={fieldClassName("resize-y leading-7")}
                />
              </label>
              {isHomeTrust ? (
                <>
                  <AdminMediaImageField
                    name={`principle_${index}_image`}
                    label="صورة الكارت — اختياري"
                    defaultValue={item.image ?? ""}
                    dimensionHint="content"
                    browseFolder="images/home"
                    onValueChange={(value) => updateItem(index, { image: value || undefined })}
                  />
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">
                      النص البديل للصورة — اختياري
                    </span>
                    <input
                      name={`principle_${index}_image_alt`}
                      value={item.imageAlt ?? ""}
                      onChange={(event) => updateItem(index, { imageAlt: event.target.value })}
                      className={fieldClassName()}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
