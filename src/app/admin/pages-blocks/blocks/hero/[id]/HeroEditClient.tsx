"use client";

import AdminNotice from "../../../../../../components/admin/AdminNotice";
import AdminRichTextEditor from "../../../../../../components/admin/AdminRichTextEditor";
import AdminImagePathListField from "../../../../../../components/admin/page-blocks/AdminImagePathListField";
import AdminModuleTabs from "../../../../../../components/admin/page-blocks/AdminModuleTabs";
import ModuleCrossPageUsageBanner from "../../../../../../components/admin/page-blocks/ModuleCrossPageUsageBanner";
import ModulePageAssignmentsField from "../../../../../../components/admin/page-blocks/ModulePageAssignmentsField";
import { AdminActionButton, AdminLinkField, AdminPageContextHeader } from "../../../../../../components/admin/ui";
import { legacyHrefFromConfig } from "../../../../../../lib/admin/links/serialize";
import { resolveHeroContentControls } from "../../../../../../lib/hero/hero-content-controls";
import { fieldClassName, statusMeta } from "../../../../../../lib/page-blocks/admin-utils";
import type { ModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import { updateHeroTemplateDetails } from "../actions";
import HeroElementOrderEditor from "./HeroElementOrderEditor";
import HeroTextFieldRow from "./HeroTextFieldRow";
import HeroVisibilityAlignRow from "./HeroVisibilityAlignRow";

type PageOption = {
  id: number;
  title: string;
  path: string;
};

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
    is_visible: boolean;
  };
  config: Record<string, unknown>;
  imagesText: string;
  mobileImagesText: string;
  assignedPageIds: number[];
  pages: PageOption[];
  sourceOptions: [string, string][];
  variantOptions: [string, string][];
  saved?: boolean;
  assignmentContext: ModuleAssignmentContext;
};

export default function HeroEditClient({
  hero,
  config,
  imagesText,
  mobileImagesText,
  assignedPageIds,
  pages,
  sourceOptions,
  variantOptions,
  saved,
  assignmentContext,
}: HeroEditClientProps) {
  const primaryCtaLink = legacyHrefFromConfig(config, "primaryCtaLink", "primaryCtaHref");
  const secondaryCtaLink = legacyHrefFromConfig(config, "secondaryCtaLink", "secondaryCtaHref");
  const statusInfo = statusMeta(hero.is_visible ? "published" : "unpublished");
  const controls = resolveHeroContentControls(config);
  const isHomeHero = hero.variant === "home-cinematic";

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <AdminPageContextHeader
        eyebrow="MODULE EDITOR"
        contextLine={hero.name}
        title="إدارة موديول الهيرو"
        description="تحكّم في محتوى الموديول وإعداداته وطريقة ظهوره داخل الصفحات المرتبطة به."
        meta={statusInfo.label}
        actions={
          <AdminActionButton href="/admin/pages-blocks/blocks/hero" variant="dark">
            الرجوع لكل الهيروهات
          </AdminActionButton>
        }
      />

      {saved ? <AdminNotice variant="success" message="تم حفظ الموديول بنجاح." /> : null}

      <ModuleCrossPageUsageBanner moduleName={hero.name} assignments={assignmentContext.assignments} />

      <form action={updateHeroTemplateDetails}>
        <input type="hidden" name="id" value={hero.id} />
        <input type="hidden" name="style_preset" value={hero.style_preset ?? "cinematic-gold"} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
              content: (
                <div className="space-y-5">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-base font-semibold text-white">بيانات الموديول</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold text-white/55">اسم الهيرو</span>
                        <input name="name" defaultValue={hero.name} required className={fieldClassName()} />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold text-white/55">Slug</span>
                        <input name="slug" defaultValue={hero.slug} required dir="ltr" className={fieldClassName()} />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                        <input
                          name="template_description"
                          defaultValue={hero.description ?? ""}
                          className={fieldClassName()}
                        />
                      </label>
                    </div>
                  </section>

                  {!isHomeHero ? (
                    <>
                      <section className="space-y-5 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                        <div>
                          <h2 className="text-base font-semibold text-white">عناصر الهيرو</h2>
                          <p className="mt-1 text-xs leading-6 text-white/45">
                            كل عنصر مستقل: محتوى، Bold، محاذاة، وإظهار/إخفاء مع حجز المساحة عند الإخفاء.
                          </p>
                        </div>

                        <HeroTextFieldRow
                          label="Eyebrow"
                          name="eyebrow"
                          defaultValue={String(config.eyebrow ?? "")}
                          boldName="eyebrow_bold"
                          alignmentName="eyebrow_alignment"
                          showName="show_eyebrow"
                          boldDefault={controls.eyebrowBold}
                          alignmentDefault={controls.eyebrowAlignment}
                          showDefault={controls.showEyebrow}
                        />
                        <HeroTextFieldRow
                          label="العنوان"
                          name="title"
                          defaultValue={String(config.title ?? "")}
                          boldName="title_bold"
                          alignmentName="title_alignment"
                          showName="show_title"
                          boldDefault={controls.titleBold}
                          alignmentDefault={controls.titleAlignment}
                          showDefault={controls.showTitle}
                        />
                        <HeroTextFieldRow
                          label="Highlight"
                          name="highlight"
                          defaultValue={String(config.highlight ?? "")}
                          boldName="highlight_bold"
                          alignmentName="highlight_alignment"
                          showName="show_highlight"
                          boldDefault={controls.highlightBold}
                          alignmentDefault={controls.highlightAlignment}
                          showDefault={controls.showHighlight}
                          helperText="عنصر مستقل عن Subtitle — يظهران معًا عند تعبئة كليهما."
                        />
                        <HeroTextFieldRow
                          label="Subtitle"
                          name="subtitle"
                          defaultValue={String(config.subtitle ?? "")}
                          boldName="subtitle_bold"
                          alignmentName="subtitle_alignment"
                          showName="show_subtitle"
                          boldDefault={controls.subtitleBold}
                          alignmentDefault={controls.subtitleAlignment}
                          showDefault={controls.showSubtitle}
                        />

                        <HeroVisibilityAlignRow
                          label="الوصف (Rich Text)"
                          alignmentName="description_alignment"
                          showName="show_description"
                          alignmentDefault={
                            controls.descriptionAlignment === "justify"
                              ? "right"
                              : controls.descriptionAlignment
                          }
                          showDefault={controls.showDescription}
                          helperText="محاذاة الصف تضبط موضع كتلة الوصف. محاذاة الفقرات داخل المحرر مستقلة (يمين/وسط/يسار/ضبط)."
                        >
                          <AdminRichTextEditor
                            name="description"
                            label=""
                            defaultValue={String(config.description ?? "")}
                            toolbarMode="minimal"
                            enableTextAlign
                            toolbarPlacement="side"
                            minHeight={160}
                            placeholder="اكتب وصف الهيرو..."
                          />
                        </HeroVisibilityAlignRow>

                        <HeroTextFieldRow
                          label="عنوان الصفحة داخل الـBreadcrumb"
                          name="breadcrumb_current_label"
                          defaultValue={controls.breadcrumbCurrentLabel}
                          boldName="breadcrumb_bold"
                          alignmentName="breadcrumb_alignment"
                          showName="show_breadcrumb"
                          boldDefault={controls.breadcrumbBold}
                          alignmentDefault={controls.breadcrumbAlignment}
                          showDefault={controls.showBreadcrumb}
                          placeholder="مثال: من نحن"
                          helperText="Override لآخر عنصر في الـBreadcrumb لهذا الهيرو فقط. لا يغيّر عنوان الصفحة في جدول pages. عند تعدد الصفحات المرتبطة يظهر التحذير أعلاه."
                        />

                        <HeroVisibilityAlignRow
                          label="CTA"
                          alignmentName="cta_alignment"
                          showName="show_cta_element"
                          alignmentDefault={controls.ctaAlignment}
                          showDefault={controls.showCta}
                          helperText="عرض/إخفاء مجموعة الأزرار داخل ترتيب عناصر الهيرو. روابط الأزرار من تبويب الأزرار."
                        >
                          <p className="text-xs text-white/40">إدارة النصوص والروابط من تبويب «الأزرار».</p>
                        </HeroVisibilityAlignRow>
                      </section>

                      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                        <HeroElementOrderEditor defaultOrder={controls.heroElementOrder} />
                      </section>
                    </>
                  ) : (
                    <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                      <AdminNotice
                        variant="info"
                        message="هيرو الصفحة الرئيسية محمي بقواعده الخاصة. استخدم الحقول الأساسية أدناه دون عناصر التحكم الداخلية."
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">Eyebrow</span>
                          <input
                            name="eyebrow"
                            defaultValue={String(config.eyebrow ?? "")}
                            className={fieldClassName()}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">العنوان</span>
                          <input name="title" defaultValue={String(config.title ?? "")} className={fieldClassName()} />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">Highlight</span>
                          <input
                            name="highlight"
                            defaultValue={String(config.highlight ?? "")}
                            className={fieldClassName()}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-semibold text-white/55">Subtitle</span>
                          <input
                            name="subtitle"
                            defaultValue={String(config.subtitle ?? "")}
                            className={fieldClassName()}
                          />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-xs font-semibold text-white/55">الوصف</span>
                          <textarea
                            name="description"
                            defaultValue={String(config.description ?? "")}
                            rows={4}
                            className={fieldClassName("resize-y leading-7")}
                          />
                        </label>
                      </div>
                    </section>
                  )}
                </div>
              ),
            },
            {
              id: "media-desktop",
              label: "صور الديسكتوب",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <AdminImagePathListField
                    name="images"
                    label="صور الهيرو (ديسكتوب)"
                    defaultValue={imagesText}
                    helperText="اختر أو ارفع الصور من المكتبة. استخدم الأسهم لترتيب الشرائح في العرض."
                  />
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Image Position Class</span>
                    <input
                      name="image_position_class"
                      defaultValue={String(config.imagePositionClassName ?? "")}
                      placeholder="object-center"
                      className={fieldClassName()}
                    />
                  </label>
                </section>
              ),
            },
            {
              id: "media-mobile",
              label: "صور الموبايل",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <AdminImagePathListField
                    name="mobile_images"
                    label="صور الهيرو (موبايل)"
                    defaultValue={mobileImagesText}
                    helperText="اختياري. لو تُركت فارغة تُستخدم صور الديسكتوب تلقائيًا على الموبايل. رتّب صور الموبايل بنفس ترتيب الديسكتوب."
                  />
                </section>
              ),
            },
            {
              id: "buttons",
              label: "الأزرار",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  {isHomeHero ? (
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                      <span>إظهار أزرار CTA في الهيرو</span>
                      <input
                        type="checkbox"
                        name="show_cta"
                        defaultChecked={
                          config.showCta === true ||
                          (config.showCta === undefined &&
                            Boolean(config.primaryCtaLabel || config.secondaryCtaLabel))
                        }
                      />
                    </label>
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-xs leading-6 text-white/50">
                      إظهار/إخفاء CTA ومحاذاته تُداران من تبويب المحتوى. عدّل هنا النصوص والروابط فقط.
                    </p>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">Primary CTA — Label</span>
                      <input
                        name="primary_cta_label"
                        defaultValue={String(config.primaryCtaLabel ?? "")}
                        className={fieldClassName()}
                      />
                    </label>
                    <AdminLinkField
                      prefix="primary_cta"
                      label="Primary CTA — Link"
                      defaultValue={primaryCtaLink}
                      helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
                      showAnchor
                    />
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">Secondary CTA — Label</span>
                      <input
                        name="secondary_cta_label"
                        defaultValue={String(config.secondaryCtaLabel ?? "")}
                        className={fieldClassName()}
                      />
                    </label>
                    <AdminLinkField
                      prefix="secondary_cta"
                      label="Secondary CTA — Link"
                      defaultValue={secondaryCtaLink}
                      helperText="اختر رابطًا داخليًا من النظام أو أدخل رابطًا خارجيًا."
                      showAnchor
                    />
                  </div>
                </section>
              ),
            },
            {
              id: "display",
              label: "العرض والربط",
              content: (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                    <h2 className="text-lg font-semibold text-white">إعدادات العرض</h2>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
                      <span>إظهار الهيرو</span>
                      <input type="checkbox" name="is_visible" defaultChecked={hero.is_visible} />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Variant</span>
                      <select name="variant" defaultValue={hero.variant} className={fieldClassName()}>
                        {variantOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Source</span>
                      <select name="source_type" defaultValue={hero.source_type} className={fieldClassName()}>
                        {sourceOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Source Slug</span>
                      <input
                        name="source_slug"
                        defaultValue={hero.source_slug ?? ""}
                        placeholder="category-slug"
                        className={fieldClassName()}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Limit</span>
                      <input
                        name="limit_count"
                        type="number"
                        min={1}
                        max={12}
                        defaultValue={hero.limit_count ?? 1}
                        className={fieldClassName()}
                      />
                    </label>
                  </section>

                  <ModulePageAssignmentsField pages={pages} assignedPageIds={assignedPageIds} />
                </div>
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d]"
          >
            حفظ الهيرو
          </button>
        </div>
      </form>
    </div>
  );
}
