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
import {
  AdminActionButton,
  AdminFormGrid,
  AdminFormListboxSelect,
  AdminFormSwitch,
  AdminLinkField,
} from "../../../../../../components/admin/ui";
import { legacyHrefFromConfig } from "../../../../../../lib/admin/links/serialize";
import { resolveHeroContentControls } from "../../../../../../lib/hero/hero-content-controls";
import { fieldClassName, statusMeta } from "../../../../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { updateHeroTemplateDetails } from "../actions";
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
    source_type: string;
    source_slug: string | null;
    limit_count: number | null;
    status: "published" | "unpublished";
  };
  config: Record<string, unknown>;
  imagesText: string;
  mobileImagesText: string;
  sourceOptions: [string, string][];
  variantOptions: [string, string][];
  saved?: boolean;
  mediaSynchronizationWarning?: boolean;
  assignmentContext: ModuleAssignmentContext;
};

export default function HeroEditClient({
  hero,
  config,
  imagesText,
  mobileImagesText,
  sourceOptions,
  variantOptions,
  saved,
  mediaSynchronizationWarning = false,
  assignmentContext,
}: HeroEditClientProps) {
  const primaryCtaLink = legacyHrefFromConfig(config, "primaryCtaLink", "primaryCtaHref");
  const secondaryCtaLink = legacyHrefFromConfig(config, "secondaryCtaLink", "secondaryCtaHref");
  const statusInfo = statusMeta(hero.status);
  const controls = resolveHeroContentControls(config);
  const isHomeHero = hero.variant === "home-cinematic";

  const contentTab = (
    <div className="space-y-5">
      <ModuleEditorSection>
        <ModuleEditorTechnicalIdentity
          mode="hidden"
          value={hero.slug}
          inputClassName={fieldClassName("h-11")}
        />
        <ModuleEditorFieldGrid>
          <ModuleEditorField nature="standard" span={6}><label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">اسم الهيرو</span>
            <input name="name" defaultValue={hero.name} required className={fieldClassName("h-11")} />
          </label></ModuleEditorField>
          <ModuleEditorField nature="short-description" span={6}><label className="space-y-2">
            <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
            <input
              name="template_description"
              defaultValue={hero.description ?? ""}
              className={fieldClassName("h-11")}
            />
          </label></ModuleEditorField>
        </ModuleEditorFieldGrid>
      </ModuleEditorSection>

      {!isHomeHero ? (
        <ModuleEditorSection>
          <ModuleEditorSectionHeading intent="domain" className="text-base">عناصر الهيرو</ModuleEditorSectionHeading>

          <ModuleEditorFieldGrid>
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
          />
          </ModuleEditorField>

          <ModuleEditorField nature="long-content"><div className="space-y-1.5">
            <span className="block text-xs font-semibold text-white/55">الوصف</span>
            <input
              type="hidden"
              name="description_alignment"
              value={
                controls.descriptionAlignment === "justify" ? "right" : controls.descriptionAlignment
              }
            />
            <AdminRichTextEditor
              name="description"
              label=""
              defaultValue={String(config.description ?? "")}
              toolbarMode="minimal"
              enableTextAlign
              toolbarPlacement="top"
              visibilityName="show_description"
              visibilityDefault={controls.showDescription}
              minHeight={160}
              placeholder="اكتب وصف الهيرو..."
            />
          </div></ModuleEditorField>

          <ModuleEditorField nature="short-text" span={8}>
          <HeroTextFieldRow
            label="مسار التنقل — عنوان الصفحة الحالي"
            name="breadcrumb_current_label"
            defaultValue={controls.breadcrumbCurrentLabel}
            boldName="breadcrumb_bold"
            alignmentName="breadcrumb_alignment"
            showName="show_breadcrumb"
            boldDefault={controls.breadcrumbBold}
            alignmentDefault={controls.breadcrumbAlignment}
            showDefault={controls.showBreadcrumb}
            placeholder="مثال: من نحن"
            helperText="يستبدل آخر عنصر في مسار التنقل لهذا الهيرو فقط، دون تغيير عنوان الصفحة في النظام."
          />
          </ModuleEditorField>

          <ModuleEditorField nature="binary-state" span={4}>
          <HeroVisibilityAlignRow
            label="زر الإجراء"
            alignmentName="cta_alignment"
            showName="show_cta_element"
            alignmentDefault={controls.ctaAlignment}
            showDefault={controls.showCta}
            helperText="النصوص والروابط من تبويب «الأزرار». الإظهار والمحاذاة من هنا."
          >
            <p className="text-xs text-white/40">لا يظهر الزر علنًا إلا بعد تعبئة نص ورابط في تبويب الأزرار.</p>
          </HeroVisibilityAlignRow>
          </ModuleEditorField>
          </ModuleEditorFieldGrid>
        </ModuleEditorSection>
      ) : (
        <ModuleEditorSection>
          <ModuleEditorFieldGrid>
            <ModuleEditorField nature="short-text" span={3}><label className="space-y-2">
              <span className="text-xs font-semibold text-white/55">النص التمهيدي</span>
              <input name="eyebrow" defaultValue={String(config.eyebrow ?? "")} className={fieldClassName("h-11")} />
            </label></ModuleEditorField>
            <ModuleEditorField nature="short-text" span={4}><label className="space-y-2">
              <span className="text-xs font-semibold text-white/55">العنوان الرئيسي</span>
              <input name="title" defaultValue={String(config.title ?? "")} className={fieldClassName("h-11")} />
            </label></ModuleEditorField>
            <ModuleEditorField nature="short-text" span={5}><label className="space-y-2">
              <span className="text-xs font-semibold text-white/55">النص المميز</span>
              <input name="highlight" defaultValue={String(config.highlight ?? "")} className={fieldClassName("h-11")} />
            </label></ModuleEditorField>
            <ModuleEditorField nature="short-description" span={5}><label className="space-y-2">
              <span className="text-xs font-semibold text-white/55">العنوان الفرعي</span>
              <input name="subtitle" defaultValue={String(config.subtitle ?? "")} className={fieldClassName("h-11")} />
            </label></ModuleEditorField>
            <ModuleEditorField nature="long-content"><label className="space-y-2">
              <span className="text-xs font-semibold text-white/55">الوصف</span>
              <textarea
                name="description"
                defaultValue={String(config.description ?? "")}
                rows={4}
                className={fieldClassName("resize-y leading-7")}
              />
            </label></ModuleEditorField>
          </ModuleEditorFieldGrid>
        </ModuleEditorSection>
      )}
    </div>
  );

  const orderTab = (
    <div>
      <ModuleEditorSection>
        <HeroElementOrderEditor defaultOrder={controls.heroElementOrder} />
      </ModuleEditorSection>
    </div>
  );

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <ModuleEditorHeader
        moduleKind="hero"
        entityName={hero.name}
        meta={statusInfo.label}
        actions={
          <AdminActionButton href="/admin/pages-blocks/blocks/hero" variant="dark">
            الرجوع لكل الهيروهات
          </AdminActionButton>
        }
      />

      <form action={updateHeroTemplateDetails}>
        <input type="hidden" name="id" value={hero.id} />
        <input type="hidden" name="style_preset" value={hero.style_preset ?? "cinematic-gold"} />

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
            ...(!isHomeHero
              ? [
                  {
                    id: "order",
                    content: orderTab,
                  },
                ]
              : []),
            {
              id: "media-desktop",
              content: (
                <div>
                  <ModuleEditorSection>
                    <AdminImagePathListField
                      name="images"
                      label="صور الهيرو (ديسكتوب)"
                      defaultValue={imagesText}
                      helperText="اختر أو ارفع الصور من المكتبة. استخدم الأسهم لترتيب الشرائح في العرض."
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">موضع الصورة</span>
                      <input
                        name="image_position_class"
                        defaultValue={String(config.imagePositionClassName ?? "")}
                        placeholder="object-center"
                        className={fieldClassName("h-11")}
                      />
                    </label>
                  </ModuleEditorSection>
                </div>
              ),
            },
            {
              id: "media-mobile",
              content: (
                <div>
                  <ModuleEditorSection>
                    <AdminImagePathListField
                      name="mobile_images"
                      label="صور الهيرو (موبايل)"
                      defaultValue={mobileImagesText}
                      helperText="اختياري. لو تُركت فارغة تُستخدم صور الديسكتوب تلقائيًا على الموبايل. رتّب صور الموبايل بنفس ترتيب الديسكتوب."
                    />
                  </ModuleEditorSection>
                </div>
              ),
            },
            {
              id: "buttons",
              content: (
                <div>
                  <ModuleEditorSection>
                    {isHomeHero ? (
                      <AdminFormSwitch
                        name="show_cta"
                        label="إظهار أزرار الإجراء في الهيرو"
                        defaultChecked={
                          config.showCta === true ||
                          (config.showCta === undefined &&
                            Boolean(config.primaryCtaLabel || config.secondaryCtaLabel))
                        }
                        surface
                      />
                    ) : (
                      <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-xs leading-6 text-white/50">
                        إظهار/إخفاء زر الإجراء ومحاذاته تُداران من تبويب المحتوى. عدّل هنا النصوص والروابط فقط.
                      </p>
                    )}

                    <AdminFormGrid>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold text-white/55">الزر الأساسي — النص</span>
                        <input
                          name="primary_cta_label"
                          defaultValue={String(config.primaryCtaLabel ?? "")}
                          className={fieldClassName("h-11")}
                        />
                      </label>
                      <AdminLinkField
                        prefix="primary_cta"
                        label="الزر الأساسي — الرابط"
                        defaultValue={primaryCtaLink}
                        helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
                        showAnchor
                      />
                      <label className="space-y-2">
                        <span className="text-xs font-semibold text-white/55">الزر الثانوي — النص</span>
                        <input
                          name="secondary_cta_label"
                          defaultValue={String(config.secondaryCtaLabel ?? "")}
                          className={fieldClassName("h-11")}
                        />
                      </label>
                      <AdminLinkField
                        prefix="secondary_cta"
                        label="الزر الثانوي — الرابط"
                        defaultValue={secondaryCtaLink}
                        helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
                        showAnchor
                      />
                    </AdminFormGrid>
                  </ModuleEditorSection>
                </div>
              ),
            },
            {
              id: "display",
              content: (
                <div>
                  <ModuleEditorPagesTab moduleName={hero.name} assignmentContext={assignmentContext}>
                    <ModuleEditorSection>
                    <ModuleEditorStatusSwitch status={hero.status} />

                    <AdminFormListboxSelect
                      name="variant"
                      label="نمط العرض"
                      defaultValue={hero.variant}
                      options={variantOptions.map(([value, label]) => ({ value, label }))}
                    />

                    <AdminFormListboxSelect
                      name="source_type"
                      label="المصدر"
                      defaultValue={hero.source_type}
                      options={sourceOptions.map(([value, label]) => ({ value, label }))}
                    />

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">المعرّف التقني للمصدر</span>
                      <input
                        name="source_slug"
                        defaultValue={hero.source_slug ?? ""}
                        placeholder="category-slug"
                        className={fieldClassName("h-11")}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">عدد العناصر</span>
                      <input
                        name="limit_count"
                        type="number"
                        min={1}
                        max={12}
                        defaultValue={hero.limit_count ?? 1}
                        className={fieldClassName("h-11")}
                      />
                    </label>
                    </ModuleEditorSection>
                  </ModuleEditorPagesTab>
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
