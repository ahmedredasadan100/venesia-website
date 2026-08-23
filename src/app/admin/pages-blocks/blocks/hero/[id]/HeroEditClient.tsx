"use client";

import AdminNotice from "../../../../../../components/admin/AdminNotice";
import AdminRichTextEditor from "../../../../../../components/admin/AdminRichTextEditor";
import AdminImagePathListField from "../../../../../../components/admin/page-blocks/AdminImagePathListField";
import {
  ModuleEditorHeader,
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
} from "../../../../../../components/admin/page-blocks/ModuleEditorPresentation";
import { AdminFormListboxSelect } from "../../../../../../components/admin/ui";
import { legacyHrefFromConfig } from "../../../../../../lib/admin/links/serialize";
import {
  HERO_IMAGE_COMPOSITION_OPTIONS_AR,
  PROJECT_DETAIL_HERO_ELEMENT_KEYS,
  resolveHeroContentControlsForVariant,
  resolveHeroImageCompositionPreset,
} from "../../../../../../lib/hero/hero-content-controls";
import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { updateHeroTemplateDetails } from "../actions";
import HeroCtaFields from "./HeroCtaFields";
import HeroElementOrderEditor from "./HeroElementOrderEditor";
import HeroTextFieldRow from "./HeroTextFieldRow";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";

type HeroEditClientProps = {
  hero: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    variant: string;
    style_preset: string | null;
    status: "published" | "unpublished";
  };
  config: Record<string, unknown>;
  imagesText: string;
  mobileImagesText: string;
  variantOptions: ReadonlyArray<{ value: string; label: string }>;
  saved?: boolean;
  mediaSynchronizationWarning?: boolean;
  assignmentContext: ModuleAssignmentContext;
};

export default function HeroEditClient({
  hero,
  config,
  imagesText,
  mobileImagesText,
  variantOptions,
  saved,
  mediaSynchronizationWarning = false,
  assignmentContext,
}: HeroEditClientProps) {
  const primaryCtaLink = legacyHrefFromConfig(config, "primaryCtaLink", "primaryCtaHref");
  const secondaryCtaLink = legacyHrefFromConfig(config, "secondaryCtaLink", "secondaryCtaHref");
  const controls = resolveHeroContentControlsForVariant(config, hero.variant);
  const imageComposition = resolveHeroImageCompositionPreset(
    config.imageComposition ??
      config.image_composition ??
      config.imagePositionClassName ??
      config.image_position_class,
  );
  const isStandardInternal = hero.variant === "internal-page";
  const isProjectDetail = hero.variant === "project-detail";

  const contentTab = isProjectDetail ? (
    <div className="space-y-5">
      <ModuleEditorSection>
        <ModuleEditorSectionHeading intent="domain" className="text-base">
          Presentation بيانات المشروع
        </ModuleEditorSectionHeading>
        <p className="mb-5 text-xs leading-6 text-white/45">
          الأسماء والوصف والموقع والصور تُقرأ من Project Domain. هذه الشاشة تتحكم في طريقة عرضها داخل Hero فقط، ولا تنسخ بيانات المشروع.
        </p>
        <ModuleEditorFieldGrid className="lg:grid-cols-2 xl:grid-cols-12">
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="موقع المشروع"
              alignmentName="eyebrow_alignment"
              showName="show_eyebrow"
              boldName="eyebrow_bold"
              alignmentDefault={controls.eyebrowAlignment}
              showDefault={controls.showEyebrow}
              boldDefault={controls.eyebrowBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="اسم المشروع الإنجليزي"
              alignmentName="title_alignment"
              showName="show_title"
              boldName="title_bold"
              alignmentDefault={controls.titleAlignment}
              showDefault={controls.showTitle}
              boldDefault={controls.titleBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="اسم المشروع العربي"
              alignmentName="subtitle_alignment"
              showName="show_subtitle"
              boldName="subtitle_bold"
              alignmentDefault={controls.subtitleAlignment}
              showDefault={controls.showSubtitle}
              boldDefault={controls.subtitleBold}
            />
          </ModuleEditorField>
          <ModuleEditorField nature="binary-state" span={6}>
            <HeroVisibilityAlignRow
              label="وصف المشروع"
              alignmentName="description_alignment"
              showName="show_description"
              alignmentDefault={
                controls.descriptionAlignment === "justify" ? "right" : controls.descriptionAlignment
              }
              showDefault={controls.showDescription}
            />
          </ModuleEditorField>
        </ModuleEditorFieldGrid>
        <input type="hidden" name="show_highlight" value="false" />
        <input type="hidden" name="highlight_bold" value="false" />
        <input type="hidden" name="highlight_alignment" value="right" />
      </ModuleEditorSection>
    </div>
  ) : (
    <div className="space-y-5">
      <ModuleEditorSection>
          <ModuleEditorSectionHeading intent="domain" className="text-base">عناصر الهيرو</ModuleEditorSectionHeading>

          <ModuleEditorFieldGrid className="lg:grid-cols-2 xl:grid-cols-12">
          <ModuleEditorField nature="short-text" span={6}>
          <HeroTextFieldRow
            label="النص التمهيدي"
            name="eyebrow"
            defaultValue={String(config.eyebrow ?? "")}
            boldName="eyebrow_bold"
            alignmentName="eyebrow_alignment"
            showName="show_eyebrow"
            boldDefault={controls.eyebrowBold}
            alignmentDefault={controls.eyebrowAlignment}
            showDefault={controls.showEyebrow}
            enableAlignment={!isStandardInternal}
          />
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <HeroTextFieldRow
            label="العنوان الرئيسي"
            name="title"
            defaultValue={String(config.title ?? "")}
            boldName="title_bold"
            alignmentName="title_alignment"
            showName="show_title"
            boldDefault={controls.titleBold}
            alignmentDefault={controls.titleAlignment}
            showDefault={controls.showTitle}
            enableAlignment={!isStandardInternal}
          />
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <HeroTextFieldRow
            label="النص المميز"
            name="highlight"
            defaultValue={String(config.highlight ?? "")}
            boldName="highlight_bold"
            alignmentName="highlight_alignment"
            showName="show_highlight"
            boldDefault={controls.highlightBold}
            alignmentDefault={controls.highlightAlignment}
            showDefault={controls.showHighlight}
            enableAlignment={!isStandardInternal}
            helperText="عنصر مستقل عن العنوان الفرعي، ويمكن عرضهما معًا."
          />
          </ModuleEditorField>
          <ModuleEditorField nature="short-text" span={6}>
          <HeroTextFieldRow
            label="العنوان الفرعي"
            name="subtitle"
            defaultValue={String(config.subtitle ?? "")}
            boldName="subtitle_bold"
            alignmentName="subtitle_alignment"
            showName="show_subtitle"
            boldDefault={controls.subtitleBold}
            alignmentDefault={controls.subtitleAlignment}
            showDefault={controls.showSubtitle}
            enableAlignment={!isStandardInternal}
          />
          </ModuleEditorField>

          <ModuleEditorField nature="long-content" className="lg:col-span-2 xl:col-span-12"><div className="space-y-3">
            <HeroVisibilityAlignRow
              label="الوصف"
              alignmentName="description_alignment"
              showName="show_description"
              alignmentDefault={
                controls.descriptionAlignment === "justify" ? "right" : controls.descriptionAlignment
              }
              showDefault={controls.showDescription}
              enableAlignment={!isStandardInternal}
            />
            <AdminRichTextEditor
              name="description"
              label="الوصف"
              defaultValue={String(config.description ?? "")}
              toolbarMode="none"
              minHeight={160}
              placeholder="اكتب وصف الهيرو..."
            />
          </div></ModuleEditorField>

          </ModuleEditorFieldGrid>
      </ModuleEditorSection>
    </div>
  );

  const orderTab = (
    <div>
      <ModuleEditorSection>
        <HeroElementOrderEditor
          defaultOrder={controls.heroElementOrder}
          allowedKeys={isProjectDetail ? PROJECT_DETAIL_HERO_ELEMENT_KEYS : undefined}
        />
      </ModuleEditorSection>
    </div>
  );

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="hero"
        entityName={hero.name}
        backHref="/admin/pages-blocks/blocks/hero"
        backLabel="الرجوع لكل الهيروهات"
      />

      <form action={updateHeroTemplateDetails}>
        <input type="hidden" name="id" value={hero.id} />
        <ModuleEditorTechnicalIdentity
          mode="hidden"
          value={hero.slug}
          inputClassName={fieldClassName("h-11")}
        />
        <input type="hidden" name="style_preset" value={hero.style_preset ?? "cinematic-gold"} />
        {isProjectDetail ? <input type="hidden" name="variant" value="project-detail" /> : null}

        <ModuleEditorTabs
          moduleKind="hero"
          nowrap
          activePanelContext={<ModuleEditorFeedback>{
            mediaSynchronizationWarning ? (
              <AdminNotice
                variant="warning"
                message="تم حفظ بيانات الموديول، لكن تعذرت مزامنة ارتباطات الميديا. يظل الحذف الآمن متوقفًا حتى اكتمال الإصلاح أو الفحص."
              />
            ) : saved ? (
              <AdminNotice variant="success" message="تم حفظ الموديول بنجاح." />
            ) : null
          }</ModuleEditorFeedback>}
          tabs={[
            {
              id: "content",
              content: contentTab,
            },
            {
              id: "media-desktop",
              content: (
                <div>
                  <ModuleEditorSection>
                    {isProjectDetail ? (
                      <p className="rounded-2xl border border-white/10 bg-[#05070B]/72 px-4 py-3 text-xs leading-6 text-white/45">
                        صورة Hero تأتي من Project Domain. إعداد التكوين التالي Presentation مشتركة تطبق على الصورة من دون نسخ مسارها داخل Hero Configuration.
                      </p>
                    ) : (
                      <AdminImagePathListField
                        name="images"
                        label="صور الهيرو (ديسكتوب)"
                        defaultValue={imagesText}
                        dimensionHint="hero"
                        density="compact"
                        helperText="اختر أو ارفع الصور من المكتبة. استخدم الأسهم لترتيب الشرائح في العرض."
                      />
                    )}
                    <AdminFormListboxSelect
                      name="image_composition"
                      label="تكوين الصورة"
                      defaultValue={imageComposition}
                      options={HERO_IMAGE_COMPOSITION_OPTIONS_AR}
                      hint="اختر موضع العنصر الأساسي داخل الصورة. يُطبق الاختيار نفسه على صور الديسكتوب والموبايل."
                    />
                  </ModuleEditorSection>
                </div>
              ),
            },
            ...(!isProjectDetail ? [{
              id: "media-mobile",
              content: (
                <div>
                  <ModuleEditorSection>
                    <AdminImagePathListField
                      name="mobile_images"
                      label="صور الهيرو (موبايل)"
                      defaultValue={mobileImagesText}
                      dimensionHint="hero-mobile"
                      density="compact"
                      helperText="اختياري. لو تُركت فارغة تُستخدم صور الديسكتوب تلقائيًا على الموبايل. رتّب صور الموبايل بنفس ترتيب الديسكتوب."
                    />
                  </ModuleEditorSection>
                </div>
              ),
            }] : []),
            {
              id: "buttons",
              content: (
                <div>
                  <ModuleEditorSection>
                    {isProjectDetail ? (
                      <HeroVisibilityAlignRow
                        label="مجموعة إجراءات المشروع"
                        alignmentName="cta_alignment"
                        showName="show_cta"
                        alignmentDefault={controls.ctaAlignment}
                        showDefault={controls.showCta}
                        helperText="وجهات الإجراءات تُشتق من Route وProject Domain؛ Hero Configuration تملك الظهور والمحاذاة فقط."
                      />
                    ) : (
                      <HeroCtaFields
                        primaryLabel={String(config.primaryCtaLabel ?? "")}
                        primaryLink={primaryCtaLink}
                        secondaryLabel={String(config.secondaryCtaLabel ?? "")}
                        secondaryLink={secondaryCtaLink}
                        showDefault={controls.showCta}
                        alignmentDefault={controls.ctaAlignment}
                        enableAlignment={!isStandardInternal}
                      />
                    )}
                  </ModuleEditorSection>
                </div>
              ),
            },
            ...(!isStandardInternal
              ? [{
                  id: "order",
                  content: orderTab,
                }]
              : []),
            {
              id: "display",
              content: (
                <div>
                  {isProjectDetail ? (
                    <ModuleEditorSection>
                      <p className="mb-5 text-xs leading-6 text-white/45">
                        هذا الـvariant معتمد تلقائيًا لكل Routes تفاصيل المشاريع؛ لا يحتاج Page Assignment ولا يخزن أي قيمة داخل المشروع.
                      </p>
                      <ModuleEditorFieldGrid className="lg:grid-cols-2 xl:grid-cols-12">
                        <ModuleEditorField nature="standard" span={6}><label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">اسم الهيرو</span>
                          <input name="name" defaultValue={hero.name} required className={fieldClassName("h-11")} />
                        </label></ModuleEditorField>
                        <ModuleEditorField nature="short-description" span={6}><label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">الوصف الداخلي</span>
                          <input
                            name="template_description"
                            defaultValue={hero.description ?? ""}
                            className={fieldClassName("h-11")}
                          />
                        </label></ModuleEditorField>
                        <ModuleEditorField nature="binary-state" span={6}>
                          <ModuleEditorStatusSwitch status={hero.status} className="min-h-11" />
                        </ModuleEditorField>
                        {!isProjectDetail ? <ModuleEditorField nature="standard" span={6}>
                          <AdminFormListboxSelect
                            name="variant"
                            label="نمط العرض"
                            defaultValue={hero.variant}
                            options={variantOptions}
                          />
                        </ModuleEditorField> : null}
                      </ModuleEditorFieldGrid>
                    </ModuleEditorSection>
                  ) : (
                    <ModuleEditorPagesTab moduleName={hero.name} assignmentContext={assignmentContext}>
                      <ModuleEditorSection>
                        <ModuleEditorFieldGrid className="lg:grid-cols-2 xl:grid-cols-12">
                          <ModuleEditorField nature="standard" span={6}><label className="space-y-2">
                            <span className="text-xs font-semibold text-white/55">اسم الهيرو</span>
                            <input name="name" defaultValue={hero.name} required className={fieldClassName("h-11")} />
                          </label></ModuleEditorField>
                          <ModuleEditorField nature="short-description" span={6}><label className="space-y-2">
                            <span className="text-xs font-semibold text-white/55">الوصف الداخلي</span>
                            <input
                              name="template_description"
                              defaultValue={hero.description ?? ""}
                              className={fieldClassName("h-11")}
                            />
                          </label></ModuleEditorField>
                          <ModuleEditorField nature="binary-state" span={6}>
                            <ModuleEditorStatusSwitch status={hero.status} className="min-h-11" />
                          </ModuleEditorField>
                          <ModuleEditorField nature="standard" span={6}>
                            <AdminFormListboxSelect
                              name="variant"
                              label="نمط العرض"
                              defaultValue={hero.variant}
                              options={variantOptions}
                            />
                          </ModuleEditorField>
                        </ModuleEditorFieldGrid>
                      </ModuleEditorSection>
                    </ModuleEditorPagesTab>
                  )}
                </div>
              ),
            },
          ]}
        />

        <ModuleEditorSaveArea title="حفظ الهيرو" saveLabel="حفظ الهيرو" />
      </form>
    </div>
  );
}
