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

import { useState, type ReactNode } from "react";

import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { AdminCard, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { ADMIN_FORM, adminChoiceButtonClassName, adminFormLabelClassName } from "../../../../lib/admin/admin-ui-styles";
import {
  resolvePageBlockTextFormat,
  type AboutIntroBeatConfig,
  type AboutIntroModuleConfig,
} from "../../../../lib/page-blocks/configs";

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

// The composition selects glyphs; their scale and frame belong to AdminFormControlHeader.
function StoryControlIcon({ icon }: { icon: "link" | "alignment" | "image" | "pointer" }) {
  const glyph: ReactNode = icon === "link" ? (
    <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
  ) : icon === "alignment" ? (
    <path d="M3 5h18M7 10h14M3 15h18M7 20h14" />
  ) : icon === "image" ? (
    <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4.5 17 4.25-4.25 3.25 3.25 2.5-2.5 5 5" /></>
  ) : (
    <path d="m5 3 14 12-7 1-3 6Z" />
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">{glyph}</svg>
  );
}

function SegmentedChoice<T extends string>({
  label,
  description,
  illustration,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  illustration: "alignment" | "image" | "pointer";
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div data-home-story-button-card={name} className="min-w-0 h-full">
      <AdminCard presentation="premium" className="flex h-full flex-col gap-2 p-3">
      <AdminFormControlHeader title={label} description={description} icon={<StoryControlIcon icon={illustration} />} />
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={label} className={ADMIN_FORM.choiceGroup}>
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
              className={adminChoiceButtonClassName(active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      </AdminCard>
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
    <>
      <SegmentedChoice
        label="محاذاة الزر"
        description="اختر محاذاة الزر في الصفحة."
        illustration="alignment"
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
        description="اختر الأيقونة التي تظهر داخل الزر."
        illustration="image"
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
          description="اختر موضع الأيقونة بالنسبة للنص."
          illustration="pointer"
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
    </>
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
  const eyebrowFormat = resolvePageBlockTextFormat(config, "eyebrow");
  const titleFormat = resolvePageBlockTextFormat(config, "title", { bold: true });
  const subtitleFormat = resolvePageBlockTextFormat(config, "subtitle");
  const descriptionFormat = resolvePageBlockTextFormat(config, "description");

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
    <div className={isHomeStory ? "space-y-6" : "space-y-4"}>
      {section === "all" ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
      {isHomeStory && section === "all" ? <input type="hidden" name="include_story_cta" value="1" /> : null}

      {showText ? (
      <ModuleEditorSection>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.eyebrow} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
            <input name="eyebrow" aria-label={fieldLabels.eyebrow} defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.title} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
            <input name="title" aria-label={fieldLabels.title} defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          {!isHomeStory ? (
            <ModuleEditorField nature="short-text" span={12}>
            <ModuleEditorVisibilityAlignRow label={fieldLabels.subtitle ?? "العنوان الفرعي"} showName="show_subtitle" boldName="subtitle_bold" alignmentName="subtitle_alignment" showDefault={subtitleFormat.visible} boldDefault={subtitleFormat.bold} alignmentDefault={subtitleFormat.alignment}>
              <input name="subtitle" aria-label={fieldLabels.subtitle ?? "العنوان الفرعي"} defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
            </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
          ) : null}
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.body} showName="show_description" boldName="description_bold" alignmentName="description_alignment" showDefault={descriptionFormat.visible} boldDefault={descriptionFormat.bold} alignmentDefault={descriptionFormat.alignment}>
            <AdminRichTextEditor
              name="body"
              label={fieldLabels.body}
              defaultValue={config.body ?? ""}
              toolbarMode="none"
              minHeight={72}
            />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>
      ) : null}

      {showImages ? (
      <ModuleEditorSection>
          {section === "all" ? (
            <ModuleEditorSectionHeading intent="media-collection">
              {isHomeStory ? "الصور (2 متداخلة)" : "الصور (3 كحد أقصى)"}
            </ModuleEditorSectionHeading>
          ) : null}
          {isHomeStory ? (
            <AdminFormGrid columns={2}>
              <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-3">
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
                  mediaSlot={contentModuleMediaSlot(isHomeStory ? "home-story" : "about-intro")}
                  showGuidance={false}
                  showReferenceLabel={false}
name="image_main"
                  label={fieldLabels.imageMain}
                  showLabel={false}
                  defaultValue={homeStoryImages.main}
                  altName="image_main_alt"
                  defaultAlt={homeStoryImages.mainAlt}
                  altLabel={fieldLabels.imageAlt}
                  onValueChange={(value) => setHomeStoryImages((current) => ({ ...current, main: value }))}
                  onAltValueChange={(value) => setHomeStoryImages((current) => ({ ...current, mainAlt: value }))}
                  browseFolder="images/home"
                />
              </div>
              <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-[#05070B] p-3">
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
                  mediaSlot={contentModuleMediaSlot(isHomeStory ? "home-story" : "about-intro")}
                  showGuidance={false}
                  showReferenceLabel={false}
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
                  browseFolder="images/home"
                />
              </div>
            </AdminFormGrid>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-3">
                <AdminMediaImageField
                  mediaSlot={contentModuleMediaSlot(isHomeStory ? "home-story" : "about-intro")}
name="image_main"
                  label={fieldLabels.imageMain}
                  defaultValue={images.main ?? ""}
                  altName="image_main_alt"
                  defaultAlt={images.mainAlt ?? ""}
                  altLabel="النص البديل للصورة 1"
                  browseFolder="images/about"
                />
                <AdminMediaImageField
                  mediaSlot={contentModuleMediaSlot(isHomeStory ? "home-story" : "about-intro")}
name="image_secondary"
                  label={fieldLabels.imageSecondary}
                  defaultValue={images.secondary ?? ""}
                  altName="image_secondary_alt"
                  defaultAlt={images.secondaryAlt ?? ""}
                  altLabel="النص البديل للصورة 2"
                  browseFolder="images/about"
                />
                <AdminMediaImageField
                  mediaSlot={contentModuleMediaSlot(isHomeStory ? "home-story" : "about-intro")}
name="image_accent"
                  label="الصورة 3 — اللمسة"
                  defaultValue={images.accent ?? ""}
                  altName="image_accent_alt"
                  defaultAlt={images.accentAlt ?? ""}
                  altLabel="النص البديل للصورة 3"
                  browseFolder="images/about"
                />
              </div>
            </>
          )}
      </ModuleEditorSection>
      ) : null}

      {showCta ? (
        <div className="space-y-4">
          {section === "all" ? <ModuleEditorSectionHeading intent="cta">زر CTA</ModuleEditorSectionHeading> : null}
          <ModuleEditorFieldGrid className="items-stretch">
            <ModuleEditorField nature="link" span={4}>
              <div data-home-story-button-panel="data" className="h-full">
                <AdminCard presentation="premium" className="flex h-full flex-col gap-3 p-4">
                  <header className="min-w-0 space-y-1">
                    <ModuleEditorSectionHeading intent="cta">بيانات الزر</ModuleEditorSectionHeading>
                    <p className="text-xs leading-5 text-white/45">أدخل نص الزر ورابطه.</p>
                  </header>
                  <AdminFormGrid columns={1}>
                    <AdminCard presentation="premium" className="p-3">
                      <label className={adminFormLabelClassName()}>
                        <span>{fieldLabels.buttonLabel}</span>
                        <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName("h-11")} />
                      </label>
                    </AdminCard>
                    <AdminCard presentation="premium" className="p-3">
                      <AdminLinkField
                        prefix="button"
                        presentation="inline"
                        label={fieldLabels.buttonLink}
                        chooseLinkLabel={fieldLabels.chooseLink}
                        clearLinkLabel={fieldLabels.clearLink}
                        defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
                        showAnchor
                      />
                    </AdminCard>
                  </AdminFormGrid>
                </AdminCard>
              </div>
            </ModuleEditorField>
            <ModuleEditorField nature="standard" span={8}>
              <div data-home-story-button-panel="appearance" className="h-full">
                <AdminCard presentation="premium" className="flex h-full flex-col gap-3 p-4">
                  <header className="min-w-0 space-y-1">
                    <ModuleEditorSectionHeading intent="cta">مظهر وسلوك الزر</ModuleEditorSectionHeading>
                    <p className="text-xs leading-5 text-white/45">خصص كيفية ظهور الزر وسلوكه في الصفحة.</p>
                  </header>
                  <AdminFormGrid columns={2} className="flex-1 items-stretch md:auto-rows-fr">
                    <div data-home-story-button-card="target" className="min-w-0 h-full">
                      <AdminCard presentation="premium" className="flex h-full flex-col gap-2 p-3">
                        <AdminFormListboxSelect
                          name="button_open_target"
                          sizing="full"
                          label={<AdminFormControlHeader title="فتح الرابط" description="حدد كيف يتم فتح الرابط." icon={<StoryControlIcon icon="link" />} />}
                          defaultValue={config.button?.target === "_blank" ? "_blank" : "_self"}
                          options={[
                            { value: "_self", label: "نفس النافذة" },
                            { value: "_blank", label: "نافذة جديدة" },
                          ]}
                        />
                      </AdminCard>
                    </div>
                    <HomeStoryButtonPresentationFields
                      alignment={config.button?.alignment === "center" || config.button?.alignment === "left" ? config.button.alignment : "right"}
                      icon={config.button?.icon === "arrow" ? "arrow" : "none"}
                      iconPosition={config.button?.iconPosition === "left" ? "left" : "right"}
                    />
                  </AdminFormGrid>
                </AdminCard>
              </div>
            </ModuleEditorField>
          </ModuleEditorFieldGrid>
        </div>
      ) : null}

      {showBeats ? (
      <ModuleEditorSection>
          <ModuleEditorSectionHeading intent="repeater">البطاقات (3 كحد أقصى)</ModuleEditorSectionHeading>
          <ModuleEditorRepeaterGrid>
            {beats.map((beat, index) => (
              <ModuleEditorRepeaterCard key={index} title={`بطاقة ${index + 1}`}>
                <label className={ADMIN_FORM.labelStack}>
                  <span className="text-xs font-semibold text-white/55">الرقم / الشارة</span>
                  <input
                    name={`beat_${index}_num`}
                    defaultValue={beat.num ?? ""}
                    placeholder={String(index + 1).padStart(2, "0")}
                    className={fieldClassName("h-11")}
                  />
                </label>
                <label className={ADMIN_FORM.labelStack}>
                  <span className="text-xs font-semibold text-white/55">العنوان</span>
                  <input name={`beat_${index}_title`} defaultValue={beat.title ?? ""} className={fieldClassName("h-11")} />
                </label>
                <label className={ADMIN_FORM.labelStack}>
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
