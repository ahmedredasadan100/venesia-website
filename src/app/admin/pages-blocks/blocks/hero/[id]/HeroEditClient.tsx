"use client";

import Link from "next/link";

import AdminImagePathListField from "../../../../../../components/admin/page-blocks/AdminImagePathListField";
import AdminModuleTabs from "../../../../../../components/admin/page-blocks/AdminModuleTabs";
import ModulePageAssignmentsField from "../../../../../../components/admin/page-blocks/ModulePageAssignmentsField";
import { AdminLinkField } from "../../../../../../components/admin/ui";
import { legacyHrefFromConfig } from "../../../../../../lib/admin/links/serialize";
import { fieldClassName } from "../../../../../../lib/page-blocks/admin-utils";
import { updateHeroTemplateDetails } from "../actions";

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
  assignedPageIds: number[];
  pages: PageOption[];
  sourceOptions: [string, string][];
  variantOptions: [string, string][];
  saved?: boolean;
};

export default function HeroEditClient({
  hero,
  config,
  imagesText,
  assignedPageIds,
  pages,
  sourceOptions,
  variantOptions,
  saved,
}: HeroEditClientProps) {
  const primaryCtaLink = legacyHrefFromConfig(config, "primaryCtaLink", "primaryCtaHref");
  const secondaryCtaLink = legacyHrefFromConfig(config, "secondaryCtaLink", "secondaryCtaHref");

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/admin/pages-blocks/blocks/hero"
              className="mb-4 inline-flex items-center gap-2 text-sm text-white/45 hover:text-[#D8B87A]"
            >
              <span aria-hidden="true">→</span>
              الرجوع لكل الهيروهات
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">Hero Module</p>
            <h1 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{hero.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
              عدّل المحتوى والوسائط والأزرار والعرض والربط بالصفحات — كل تبويب يغطي جزءًا واحدًا من الموديول.
            </p>
            {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الهيرو بنجاح.</p> : null}
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${hero.is_visible ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-white/45"}`}
          >
            {hero.is_visible ? "ظاهر" : "مخفي"}
          </span>
        </div>
      </section>

      <form action={updateHeroTemplateDetails}>
        <input type="hidden" name="id" value={hero.id} />
        <input type="hidden" name="style_preset" value={hero.style_preset ?? "cinematic-gold"} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
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
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">Eyebrow</span>
                      <input name="eyebrow" defaultValue={String(config.eyebrow ?? "")} className={fieldClassName()} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">العنوان</span>
                      <input name="title" defaultValue={String(config.title ?? "")} className={fieldClassName()} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">Highlight</span>
                      <input name="highlight" defaultValue={String(config.highlight ?? "")} className={fieldClassName()} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold text-white/55">Subtitle</span>
                      <input name="subtitle" defaultValue={String(config.subtitle ?? "")} className={fieldClassName()} />
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
              ),
            },
            {
              id: "media",
              label: "الوسائط",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <AdminImagePathListField
                    name="images"
                    label="صور الهيرو"
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
              id: "buttons",
              label: "الأزرار",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
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
