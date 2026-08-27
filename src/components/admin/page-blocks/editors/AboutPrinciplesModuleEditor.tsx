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
import { AdminFormListboxSelect } from "../../ui";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  ABOUT_PRINCIPLES_ICON_KEYS,
  resolvePageBlockTextFormat,
  type AboutPrinciplesItemConfig,
  type AboutPrinciplesModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutPrinciplesModuleEditorProps = {
  config: AboutPrinciplesModuleConfig;
  editorMode?: "about-principles" | "home-trust";
};

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

export default function AboutPrinciplesModuleEditor({
  config,
  editorMode = "about-principles",
}: AboutPrinciplesModuleEditorProps) {
  const isHomeTrust = editorMode === "home-trust";
  const [items, setItems] = useState<AboutPrinciplesItemConfig[]>(() =>
    isHomeTrust ? padTrustItems(config.items) : normalizeItems(config.items),
  );

  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");

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
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label="النص التمهيدي" showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
          <input name="eyebrow" aria-label="النص التمهيدي" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label="العنوان الرئيسي" showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان الرئيسي" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        {isHomeTrust ? (
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow label="الفقرة التعريفية" showName="show_description" boldName="description_bold" alignmentName="description_alignment" showDefault={descriptionFormat.visible} boldDefault={descriptionFormat.bold} alignmentDefault={descriptionFormat.alignment}><AdminRichTextEditor
            name="principles_intro"
            label="الفقرة التعريفية"
            defaultValue={config.description ?? ""}
            toolbarMode="none"
            minHeight={72}
          /></ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        ) : null}
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      <ModuleEditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ModuleEditorSectionHeading intent="repeater">
            {isHomeTrust ? "بطاقات الثقة (4)" : "المبادئ (حتى 6)"}
          </ModuleEditorSectionHeading>
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
