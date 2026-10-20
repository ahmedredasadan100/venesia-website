"use client";
import { contentModuleMediaSlot } from "../../../../lib/page-blocks/configs";

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

import { AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminActionButton, AdminFormControlHeader, AdminFormListboxSelect } from "../../ui";
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
  /** The shared flat tabs retain mounted fields and the existing save contract. */
  section?: "all" | "text" | "cards";
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
  section = "all",
}: AboutPrinciplesModuleEditorProps) {
  const isHomeTrust = editorMode === "home-trust";
  const showText = section === "all" || section === "text";
  const showCards = section === "all" || section === "cards";
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
      {isHomeTrust && showText ? <input type="hidden" name="include_home_trust_intro" value="1" /> : null}
      {showCards ? <input type="hidden" name="principle_count" value={String(items.length)} /> : null}

      {showText ? (
        <ModuleEditorFieldGrid>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label="النص التمهيدي" presentation="premium" description={isHomeTrust ? "نص قصير يقدم فكرة القسم ويظهر فوق العنوان." : undefined} icon={<AdminModuleTabIcon name="content" />} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
          <input name="eyebrow" aria-label="النص التمهيدي" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        <ModuleEditorField nature="short-text" span={6}>
        <ModuleEditorVisibilityAlignRow label="العنوان الرئيسي" presentation="premium" description={isHomeTrust ? "العنوان الرئيسي للقسم ويظهر بحجم أكبر في الصفحة." : undefined} icon={<AdminModuleTabIcon name="content" />} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
          <input name="title" aria-label="العنوان الرئيسي" defaultValue={config.title ?? ""} className={fieldClassName()} />
        </ModuleEditorVisibilityAlignRow>
        </ModuleEditorField>
        {isHomeTrust ? (
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow label="الفقرة التعريفية" presentation="premium" description="محتوى تفصيلي يشرح فكرة القسم ويظهر في الصفحة." icon={<AdminModuleTabIcon name="content" />} showName="show_description" showDefault={descriptionFormat.visible} controlMode="visibility-only">
          <AdminRichTextEditor
            name="principles_intro"
            label="الفقرة التعريفية"
            defaultValue={config.description ?? ""}
            toolbarMode="full"
            showLabel={false}
            enableArticleStructure
            enableTextAlign
            legacyHtmlFormatting={{ boldName: "description_bold", bold: descriptionFormat.bold, alignmentName: "description_alignment", alignment: descriptionFormat.alignment }}
            helperText="Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة."
          /></ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        ) : null}
        </ModuleEditorFieldGrid>
      ) : null}

      {showCards ? (
      <ModuleEditorSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isHomeTrust ? <ModuleEditorSectionHeading intent="repeater">بطاقات الثقة (4)</ModuleEditorSectionHeading> : <AdminFormControlHeader title="المبادئ (حتى 6)" />}
          {!isHomeTrust ? (
            <AdminActionButton
              type="button"
              onClick={addItem}
              disabled={items.length >= 6}
              variant="gold"
            >
              إضافة عنصر
            </AdminActionButton>
          ) : null}
        </div>

        <ModuleEditorRepeaterGrid columns={isHomeTrust ? 2 : 3} presentation="premium">
          {items.map((item, index) => (
            <ModuleEditorRepeaterCard
              key={index}
              presentation="premium"
              icon={isHomeTrust ? <AdminModuleTabIcon name="section" /> : undefined}
              description={isHomeTrust ? "عنوان البطاقة ووصفها وصورتها الاختيارية." : undefined}
              title={isHomeTrust ? `بطاقة ${index + 1}` : `عنصر ${index + 1}`}
              actions={!isHomeTrust ? (
                <>
                    <AdminActionButton
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      size="icon"
                      aria-label={`تحريك المبدأ ${index + 1} لأعلى`}
                    >
                      ↑
                    </AdminActionButton>
                    <AdminActionButton
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      size="icon"
                      aria-label={`تحريك المبدأ ${index + 1} لأسفل`}
                    >
                      ↓
                    </AdminActionButton>
                    <AdminActionButton
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      variant="danger"
                    >
                      حذف
                    </AdminActionButton>
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
                    variant="card"
                    mediaSlot={contentModuleMediaSlot("home-trust")}
                    name={`principle_${index}_image`}
                    label="صورة الكارت — اختياري"
                    defaultValue={item.image ?? ""}
                    altName={`principle_${index}_image_alt`}
                    defaultAlt={item.imageAlt ?? ""}
                    altLabel="النص البديل للصورة — اختياري"
                    browseFolder="images/home"
                    onValueChange={(value) => updateItem(index, { image: value || undefined })}
                  />
              ) : null}
            </ModuleEditorRepeaterCard>
          ))}
        </ModuleEditorRepeaterGrid>
      </ModuleEditorSection>
      ) : null}
    </div>
  );
}
