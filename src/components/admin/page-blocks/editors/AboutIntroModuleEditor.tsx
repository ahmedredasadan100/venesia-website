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
import { AdminFormListboxSelect, AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import type { AboutIntroBeatConfig, AboutIntroModuleConfig } from "../../../../lib/page-blocks/configs";

type AboutIntroEditorSection = "all" | "text" | "images" | "cta";

type AboutIntroModuleEditorProps = {
  config: AboutIntroModuleConfig;
  /** home-story shows CTA + 2 images; about-intro shows beats + 3 images (default). */
  editorMode?: "about-intro" | "home-story";
  /**
   * When set (home-story flat tabs), render only one section.
   * Defaults to `"all"` for the classic about-intro layout.
   */
  section?: AboutIntroEditorSection;
};

type HomeStoryImagePair = {
  main: string;
  secondary: string;
  mainAlt: string;
  secondaryAlt: string;
};

type HomeStoryButtonAlignment = "right" | "center" | "left";
type HomeStoryButtonIcon = "none" | "arrow";
type HomeStoryButtonIconPosition = "right" | "left";

function SegmentedChoice<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.label}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
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

function HomeStoryButtonPresentationFields({
  alignment: initialAlignment,
  icon: initialIcon,
  iconPosition: initialIconPosition,
}: {
  alignment: HomeStoryButtonAlignment;
  icon: HomeStoryButtonIcon;
  iconPosition: HomeStoryButtonIconPosition;
}) {
  const [alignment, setAlignment] = useState<HomeStoryButtonAlignment>(initialAlignment);
  const [icon, setIcon] = useState<HomeStoryButtonIcon>(initialIcon);
  const [iconPosition, setIconPosition] = useState<HomeStoryButtonIconPosition>(initialIconPosition);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#05070B] p-4">
      <SegmentedChoice
        label="محاذاة الزر"
        name="button_alignment"
        value={alignment}
        onChange={setAlignment}
        options={[
          { value: "right", label: "يمين" },
          { value: "center", label: "وسط" },
          { value: "left", label: "يسار" },
        ]}
      />
      <SegmentedChoice
        label="أيقونة الزر"
        name="button_icon"
        value={icon}
        onChange={setIcon}
        options={[
          { value: "none", label: "بدون أيقونة" },
          { value: "arrow", label: "سهم" },
        ]}
      />
      {icon === "arrow" ? (
        <SegmentedChoice
          label="موضع الأيقونة"
          name="button_icon_position"
          value={iconPosition}
          onChange={setIconPosition}
          options={[
            { value: "right", label: "يمين النص" },
            { value: "left", label: "يسار النص" },
          ]}
        />
      ) : (
        <input type="hidden" name="button_icon_position" value={iconPosition} />
      )}
    </div>
  );
}

function padBeats(beats: AboutIntroBeatConfig[] | undefined) {
  const rows = [...(beats ?? [])].slice(0, 3);
  while (rows.length < 3) rows.push({});
  return rows;
}

export default function AboutIntroModuleEditor({
  config,
  editorMode = "about-intro",
  section = "all",
}: AboutIntroModuleEditorProps) {
  const images = config.images ?? {};
  const beats = padBeats(config.beats);
  const isHomeStory = editorMode === "home-story";
  const showText = section === "all" || section === "text";
  const showImages = section === "all" || section === "images";
  const showCta = isHomeStory && (section === "all" || section === "cta");
  const showBeats = !isHomeStory && section === "all";

  const fieldLabels = isHomeStory
    ? {
        eyebrow: "النص التمهيدي",
        title: "العنوان",
        body: "الوصف",
        bodyHelper: "Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة.",
        imageMain: "الصورة الأولى",
        imageSecondary: "الصورة الثانية",
        imageAlt: "وصف الصورة",
        buttonLabel: "نص الزر",
        buttonLink: "رابط الزر",
        chooseLink: "اختيار الرابط",
        clearLink: "مسح الرابط",
      }
    : {
        eyebrow: "النص التمهيدي",
        title: "العنوان",
        subtitle: "العنوان الفرعي",
        body: "الوصف",
        bodyHelper: "Enter لإنشاء فقرة جديدة، وShift + Enter للنزول إلى سطر جديد داخل الفقرة.",
        imageMain: "الصورة 1 — الرئيسية",
        imageSecondary: "الصورة 2 — الثانوية",
        imageAlt: "وصف الصورة",
        buttonLabel: "نص الزر",
        buttonLink: "رابط الزر",
        chooseLink: "اختيار الرابط",
        clearLink: "مسح الرابط",
      };

  const [homeStoryImages, setHomeStoryImages] = useState<HomeStoryImagePair>(() => ({
    main: images.main ?? "",
    secondary: images.secondary ?? "",
    mainAlt: images.mainAlt ?? "",
    secondaryAlt: images.secondaryAlt ?? "",
  }));

  function swapHomeStoryImages() {
    setHomeStoryImages((current) => ({
      main: current.secondary,
      secondary: current.main,
      mainAlt: current.secondaryAlt,
      secondaryAlt: current.mainAlt,
    }));
  }

  return (
    <div className={isHomeStory ? "space-y-6" : "mx-auto max-w-5xl space-y-4"}>
      {section === "all" ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
      {isHomeStory && section === "all" ? <input type="hidden" name="include_story_cta" value="1" /> : null}

      {showText ? (
      <ModuleEditorSection>
          {section === "all" ? (
            <h2 className="text-sm font-semibold text-white">{isHomeStory ? "النص" : "محتوى الموديول"}</h2>
          ) : null}
          <ModuleEditorFieldGrid className="max-w-[920px]">
          <ModuleEditorField nature="short-text" span={3}><label className="block space-y-1.5">
            <span className="text-xs font-semibold text-white/55">{fieldLabels.eyebrow}</span>
            <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
          </label></ModuleEditorField>
          <ModuleEditorField nature="short-text" span={4}><label className="block space-y-1.5">
            <span className="text-xs font-semibold text-white/55">{fieldLabels.title}</span>
            <input name="title" defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
          </label></ModuleEditorField>
          {!isHomeStory ? (
            <ModuleEditorField nature="short-description" span={5}><label className="block space-y-1.5">
              <span className="text-xs font-semibold text-white/55">{fieldLabels.subtitle}</span>
              <input name="subtitle" defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
            </label></ModuleEditorField>
          ) : null}
          <ModuleEditorField nature="long-content" span={12}><div>
            <AdminRichTextEditor
              name="body"
              label={fieldLabels.body}
              defaultValue={config.body ?? ""}
              toolbarMode="minimal"
              enableTextAlign
              toolbarPlacement="top"
              minHeight={160}
              helperText={fieldLabels.bodyHelper}
            />
          </div></ModuleEditorField>
          </ModuleEditorFieldGrid>
      </ModuleEditorSection>
      ) : null}

      {showImages ? (
      <ModuleEditorSection>
          {section === "all" ? (
            <h2 className="text-sm font-semibold text-white">
              {isHomeStory ? "الصور (2 متداخلة)" : "الصور (3 كحد أقصى)"}
            </h2>
          ) : null}
          <p className="text-xs leading-6 text-white/45">
            {isHomeStory
              ? "صورتان متداخلتان في يسار السكشن. استخدم الأسهم لتبديل ترتيبهما. اترك الموضع فارغًا لإخفائه من العرض."
              : "كل صورة موضع مستقل في التخطيط الحالي. اترك الموضع فارغًا لإخفائه من العرض."}
          </p>
          {isHomeStory ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#D8B87A]/70">{fieldLabels.imageMain}</p>
                  <button
                    type="button"
                    onClick={swapHomeStoryImages}
                    title="نقل إلى الموضع الثاني"
                    aria-label="نقل إلى الموضع الثاني"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#080B10] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
                  >
                    ↓
                  </button>
                </div>
                <AdminMediaImageField
                  name="image_main"
                  label={fieldLabels.imageMain}
                  showLabel={false}
                  defaultValue={homeStoryImages.main}
                  altName="image_main_alt"
                  defaultAlt={homeStoryImages.mainAlt}
                  altLabel={fieldLabels.imageAlt}
                  onValueChange={(value) => setHomeStoryImages((current) => ({ ...current, main: value }))}
                  onAltValueChange={(value) => setHomeStoryImages((current) => ({ ...current, mainAlt: value }))}
                  dimensionHint="content"
                  browseFolder="images/home"
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#D8B87A]/70">{fieldLabels.imageSecondary}</p>
                  <button
                    type="button"
                    onClick={swapHomeStoryImages}
                    title="نقل إلى الموضع الأول"
                    aria-label="نقل إلى الموضع الأول"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#080B10] text-white/70 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
                  >
                    ↑
                  </button>
                </div>
                <AdminMediaImageField
                  name="image_secondary"
                  label={fieldLabels.imageSecondary}
                  showLabel={false}
                  defaultValue={homeStoryImages.secondary}
                  altName="image_secondary_alt"
                  defaultAlt={homeStoryImages.secondaryAlt}
                  altLabel={fieldLabels.imageAlt}
                  onValueChange={(value) =>
                    setHomeStoryImages((current) => ({ ...current, secondary: value }))
                  }
                  onAltValueChange={(value) =>
                    setHomeStoryImages((current) => ({ ...current, secondaryAlt: value }))
                  }
                  dimensionHint="content"
                  browseFolder="images/home"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-3">
                <AdminMediaImageField
                  name="image_main"
                  label={fieldLabels.imageMain}
                  defaultValue={images.main ?? ""}
                  altName="image_main_alt"
                  defaultAlt={images.mainAlt ?? ""}
                  altLabel="النص البديل للصورة 1"
                  dimensionHint="content"
                  browseFolder="images/about"
                />
                <AdminMediaImageField
                  name="image_secondary"
                  label={fieldLabels.imageSecondary}
                  defaultValue={images.secondary ?? ""}
                  altName="image_secondary_alt"
                  defaultAlt={images.secondaryAlt ?? ""}
                  altLabel="النص البديل للصورة 2"
                  dimensionHint="content"
                  browseFolder="images/about"
                />
                <AdminMediaImageField
                  name="image_accent"
                  label="الصورة 3 — اللمسة"
                  defaultValue={images.accent ?? ""}
                  altName="image_accent_alt"
                  defaultAlt={images.accentAlt ?? ""}
                  altLabel="النص البديل للصورة 3"
                  dimensionHint="content"
                  browseFolder="images/about"
                />
              </div>
            </>
          )}
      </ModuleEditorSection>
      ) : null}

      {showCta ? (
      <ModuleEditorSection>
          {section === "all" ? <h2 className="text-sm font-semibold text-white">زر CTA</h2> : null}
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold text-white/55">{fieldLabels.buttonLabel}</span>
              <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName()} />
            </label>
            <AdminLinkField
              prefix="button"
              label={fieldLabels.buttonLink}
              chooseLinkLabel={fieldLabels.chooseLink}
              clearLinkLabel={fieldLabels.clearLink}
              defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
              showAnchor
            />
            <AdminFormListboxSelect
              name="button_open_target"
              label="فتح الرابط"
              defaultValue={config.button?.target === "_blank" ? "_blank" : "_self"}
              options={[
                { value: "_self", label: "نفس النافذة" },
                { value: "_blank", label: "نافذة جديدة" },
              ]}
            />
            <HomeStoryButtonPresentationFields
              alignment={config.button?.alignment === "center" || config.button?.alignment === "left" ? config.button.alignment : "right"}
              icon={config.button?.icon === "arrow" ? "arrow" : "none"}
              iconPosition={config.button?.iconPosition === "left" ? "left" : "right"}
            />
          </div>
      </ModuleEditorSection>
      ) : null}

      {showBeats ? (
      <ModuleEditorSection>
          <h2 className="text-sm font-semibold text-white">البطاقات (3 كحد أقصى)</h2>
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
                  <input name={`beat_${index}_title`} defaultValue={beat.title ?? ""} className={fieldClassName("h-11")} />
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
      ) : null}
    </div>
  );
}
