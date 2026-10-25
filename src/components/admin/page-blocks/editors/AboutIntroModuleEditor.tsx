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

import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../ui/AdminModuleTabs";
import AdminRichTextEditor from "../../AdminRichTextEditor";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import { ADMIN_FORM_STACK_CLASS_NAME, AdminActionButton, AdminCard, AdminFormControlHeader, AdminFormGrid, AdminFormListboxSelect, AdminLinkField } from "../../ui";
import { linkDefaultFromContainer } from "../../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import { ADMIN_FORM, adminChoiceButtonClassName, adminFormLabelClassName, ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME } from "../../../../lib/admin/admin-ui-styles";
import {
  resolvePageBlockTextFormat,
  type AboutIntroBeatConfig,
  type AboutIntroModuleConfig,
} from "../../../../lib/page-blocks/configs";

type AboutIntroEditorSection = "all" | "text" | "images" | "cta" | "cards";

type AboutIntroModuleEditorProps = {
  config: AboutIntroModuleConfig;
  /** home-story shows CTA + 2 images; about-intro shows beats + 3 images (default). */
  editorMode?: "about-intro" | "home-story";
  /**
   * When set by the shared flat tabs, render only one section.
   * Defaults to `"all"` for the classic about-intro layout.
   */
  section?: AboutIntroEditorSection;
  /** Opt into the existing full HTML editor without changing legacy consumers. */
  descriptionToolbar?: "limited" | "full";
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
function StoryControlIcon({ icon }: { icon: "link" | "alignment" | "image" | "pointer" | "text" | "content" }) {
  const glyph: ReactNode = icon === "text" ? (
    <path d="M4 6V3h16v3M12 3v18M8 21h8" />
  ) : icon === "content" ? (
    <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h6" /></>
  ) : icon === "link" ? (
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
      <AdminFormControlHeader presentation="leading-icon" title={label} description={description} icon={<StoryControlIcon icon={illustration} />} />
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
              className={adminChoiceButtonClassName(active, "", "compact")}
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
  descriptionToolbar = "limited",
}: AboutIntroModuleEditorProps) {
  const images = config.images ?? {};
  const beats = padBeats(config.beats);
  const isHomeStory = editorMode === "home-story";
  const fullDescriptionEditor = isHomeStory || descriptionToolbar === "full";
  const showText = section === "all" || section === "text";
  const showImages = section === "all" || section === "images";
  const showCta = isHomeStory && (section === "all" || section === "cta");
  const showBeats = !isHomeStory && (section === "all" || section === "cards");
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
        imageMain: "الصورة الرئيسية",
        imageSecondary: "الصورة الثانوية",
        imageAlt: "النص البديل للصورة (Alt Text)",
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

  function renderCtaPanel(kind: "data" | "appearance", children: ReactNode) {
    const title = kind === "data" ? "بيانات الزر" : "مظهر وسلوك الزر";
    const description = kind === "data" ? "أدخل نص الزر ورابطه." : "خصص كيفية ظهور الزر وسلوكه في الصفحة.";

    return (
      <ModuleEditorSection
        presentation="panel"
        className="flex h-full flex-col gap-3"
        header={<AdminModuleSectionHeader id={`home-story-cta-${kind}`} sectionHeading={title} sectionDescription={description} icon="publish" sectionHeaderPresentation="premium" sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME} />}
      >
        {children}
      </ModuleEditorSection>
    );

  }
  const aboutImageFields = ([
    { key: "main", altKey: "mainAlt", label: fieldLabels.imageMain },
    { key: "secondary", altKey: "secondaryAlt", label: fieldLabels.imageSecondary },
    { key: "accent", altKey: "accentAlt", label: "الصورة 3 — اللمسة" },
  ] as const).map((slot, index) => {
    const field = (
      <AdminMediaImageField
        key={slot.key}
        mediaSlot={contentModuleMediaSlot("about-intro")}
        name={"image_" + slot.key}
        label={slot.label}
        variant="card"
        showLabel={false}
        dimensionsPresentation="disclosure"
        metadataPresentation="panel"
        showAltCounter
        altRows={1}
        showReferenceLabel={false}
        defaultValue={images[slot.key] ?? ""}
        altName={"image_" + slot.key + "_alt"}
        defaultAlt={images[slot.altKey] ?? ""}
        altLabel={"النص البديل للصورة " + (index + 1)}
        browseFolder="images/about"
      />
    );
    return (
      <AdminCard key={slot.key} presentation="premium" className="flex min-w-0 flex-col gap-3 p-3">
        <AdminFormControlHeader presentation="leading-icon" title={slot.label} icon={<AdminModuleTabIcon name="media" />} />
        {field}
      </AdminCard>
    );
  });

  return (
    <div className={ADMIN_FORM_STACK_CLASS_NAME}>
      {section === "all" ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
      {isHomeStory && section === "all" ? <input type="hidden" name="include_story_cta" value="1" /> : null}

      {showText ? (
      <ModuleEditorSection surface={section === "all" ? "panel" : "neutral"}>
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.eyebrow} description="نص قصير يقدّم فكرة القسم ويظهر فوق العنوان." icon={<StoryControlIcon icon="text" />} showName="show_eyebrow" boldName="eyebrow_bold" alignmentName="eyebrow_alignment" showDefault={eyebrowFormat.visible} boldDefault={eyebrowFormat.bold} alignmentDefault={eyebrowFormat.alignment}>
            <input name="eyebrow" aria-label={fieldLabels.eyebrow} defaultValue={config.eyebrow ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.title} description="العنوان الرئيسي للقسم ويظهر بحجم أكبر في الصفحة." icon={<StoryControlIcon icon="content" />} showName="show_title" boldName="title_bold" alignmentName="title_alignment" showDefault={titleFormat.visible} boldDefault={titleFormat.bold} alignmentDefault={titleFormat.alignment}>
            <input name="title" aria-label={fieldLabels.title} defaultValue={config.title ?? ""} className={fieldClassName("h-11")} />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
          {!isHomeStory ? (
            <ModuleEditorField nature="short-text" span={12}>
            <ModuleEditorVisibilityAlignRow label={fieldLabels.subtitle ?? "العنوان الفرعي"} description="نص مكمل يظهر أسفل العنوان الرئيسي." icon={<AdminModuleTabIcon name="content" />} showName="show_subtitle" boldName="subtitle_bold" alignmentName="subtitle_alignment" showDefault={subtitleFormat.visible} boldDefault={subtitleFormat.bold} alignmentDefault={subtitleFormat.alignment}>
              <input name="subtitle" aria-label={fieldLabels.subtitle ?? "العنوان الفرعي"} defaultValue={config.subtitle ?? ""} className={fieldClassName("h-11")} />
            </ModuleEditorVisibilityAlignRow>
            </ModuleEditorField>
          ) : null}
          <ModuleEditorField nature="long-content" span={12}>
          <ModuleEditorVisibilityAlignRow label={fieldLabels.body} description="محتوى تفصيلي يشرح فكرة القسم ويظهر في الصفحة." icon={<StoryControlIcon icon="content" />} showName="show_description" showDefault={descriptionFormat.visible}
            {...(fullDescriptionEditor
              ? { controlMode: "visibility-only" as const }
              : { boldName: "description_bold", alignmentName: "description_alignment", boldDefault: descriptionFormat.bold, alignmentDefault: descriptionFormat.alignment })}>
            <AdminRichTextEditor
              name="body"
              label={fieldLabels.body}
              defaultValue={config.body ?? ""}
              toolbarMode={fullDescriptionEditor ? "full" : "none"}
              minHeight={fullDescriptionEditor ? undefined : 72}
              showLabel={!fullDescriptionEditor}
              enableArticleStructure={fullDescriptionEditor}
              enableTextAlign={fullDescriptionEditor}
              legacyHtmlFormatting={fullDescriptionEditor ? { boldName: "description_bold", bold: descriptionFormat.bold, alignmentName: "description_alignment", alignment: descriptionFormat.alignment } : undefined}
              helperText={fullDescriptionEditor ? fieldLabels.bodyHelper : undefined}
            />
          </ModuleEditorVisibilityAlignRow>
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>
      ) : null}

      {showImages ? (
      <ModuleEditorSection surface={section === "all" ? "panel" : "neutral"}>
          {section === "all" ? (
            <ModuleEditorSectionHeading intent="media-collection">
              {isHomeStory ? "الصور (2 متداخلة)" : "الصور (3 كحد أقصى)"}
            </ModuleEditorSectionHeading>
          ) : null}
          {isHomeStory ? (
            <AdminFormGrid columns={2}>
              <AdminCard presentation="premium" className="flex min-w-0 flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><AdminFormControlHeader presentation="leading-icon" title={fieldLabels.imageMain} icon={<StoryControlIcon icon="image" />} /></div>
                  <AdminActionButton
                    size="icon"
                    onClick={swapHomeStoryImages}
                    title="نقل إلى الموضع الثاني"
                    aria-label="نقل إلى الموضع الثاني"
                  >
                    <span aria-hidden="true">↓</span>
                  </AdminActionButton>
                </div>
                <AdminMediaImageField
                  variant="card"
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
              </AdminCard>
              <AdminCard presentation="premium" className="flex min-w-0 flex-col gap-3 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><AdminFormControlHeader presentation="leading-icon" title={fieldLabels.imageSecondary} icon={<StoryControlIcon icon="image" />} /></div>
                  <AdminActionButton
                    size="icon"
                    onClick={swapHomeStoryImages}
                    title="نقل إلى الموضع الأول"
                    aria-label="نقل إلى الموضع الأول"
                  >
                    <span aria-hidden="true">↑</span>
                  </AdminActionButton>
                </div>
                <AdminMediaImageField
                  variant="card"
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
              </AdminCard>
            </AdminFormGrid>
          ) : (
            <AdminFormGrid columns={3}>{aboutImageFields}</AdminFormGrid>
          )}
      </ModuleEditorSection>
      ) : null}

      {showCta ? (
        <div className="space-y-4">
          {section === "all" ? <ModuleEditorSectionHeading intent="cta">زر CTA</ModuleEditorSectionHeading> : null}
          <ModuleEditorFieldGrid className="items-stretch">
            <ModuleEditorField nature="link" span={4}>
              <div data-home-story-button-panel="data" className="h-full">
                {renderCtaPanel("data", (
                  <AdminFormGrid columns={1}>
                    <AdminCard presentation="premium" className="p-3">
                      <label className={adminFormLabelClassName({ textInset: true })}>
                        <span data-admin-form-label-text>{fieldLabels.buttonLabel}</span>
                        <input name="button_label" defaultValue={config.button?.label ?? ""} className={fieldClassName("h-11")} />
                      </label>
                    </AdminCard>
                    <AdminCard presentation="premium" className="p-3">
                      <AdminLinkField
                        prefix="button"
                        presentation="inline"
                        actionPresentation={isHomeStory ? "bare" : "default"}
                        label={fieldLabels.buttonLink}
                        chooseLinkLabel={fieldLabels.chooseLink}
                        clearLinkLabel={fieldLabels.clearLink}
                        defaultValue={linkDefaultFromContainer(config.button as Record<string, unknown>)}
                        showAnchor
                      />
                    </AdminCard>
                  </AdminFormGrid>
                ))}
              </div>
            </ModuleEditorField>
            <ModuleEditorField nature="standard" span={8}>
              <div data-home-story-button-panel="appearance" className="h-full">
                {renderCtaPanel("appearance", (
                  <AdminFormGrid columns={2} className="flex-1 items-stretch md:auto-rows-fr">
                    <div data-home-story-button-card="target" className="min-w-0 h-full">
                      <AdminCard presentation="premium" className="flex h-full flex-col gap-2 p-3">
                        <AdminFormListboxSelect
                          name="button_open_target"
                          sizing="full"
                          label={<AdminFormControlHeader presentation="leading-icon" title="فتح الرابط" description="حدد كيف يتم فتح الرابط." icon={<StoryControlIcon icon="link" />} />}
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
                ))}
              </div>
            </ModuleEditorField>
          </ModuleEditorFieldGrid>
        </div>
      ) : null}

      {showBeats ? (
      <ModuleEditorSection surface={section === "all" ? "panel" : "neutral"}>
          {section === "all" ? <ModuleEditorSectionHeading intent="repeater">البطاقات (3 كحد أقصى)</ModuleEditorSectionHeading> : null}
          <ModuleEditorRepeaterGrid>
            {beats.map((beat, index) => (
              <ModuleEditorRepeaterCard key={index} title={`بطاقة ${index + 1}`} description="الرقم / الشارة، العنوان والوصف." icon={<AdminModuleTabIcon name="section" />}>
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
                  <input name={`beat_${index}_title`} defaultValue={beat.title ?? ""} className={fieldClassName("h-11")} />
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
      </ModuleEditorSection>
      ) : null}
    </div>
  );
}
