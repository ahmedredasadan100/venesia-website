"use client";

import Link from "next/link";

import AdminModuleTabs from "./AdminModuleTabs";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import { AdminLinkField } from "../ui";
import { linkDefaultFromContainer } from "../../../lib/admin/links/link-defaults";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { CtaBlockConfig } from "../../../lib/page-blocks/configs";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type CtaModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    variant: string;
    style_preset: string | null;
    status: string;
  };
  config: CtaBlockConfig;
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function CtaModuleEditClient({
  block,
  config,
  assignmentContext,
  saved,
  updateAction,
}: CtaModuleEditClientProps) {
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6">
        <Link href="/admin/pages-blocks/blocks/cta" className="mb-4 inline-flex text-sm text-white/45 hover:text-[#D8B87A]">
          → الرجوع لبلوكات CTA
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">CTA Module</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">{block.name}</h1>
        {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
      </section>

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="variant" value={block.variant ?? "band"} />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
              content: (
                <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Eyebrow</span>
                    <input name="eyebrow" defaultValue={config.eyebrow ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">العنوان</span>
                    <input name="title" defaultValue={config.title ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Highlight</span>
                    <input name="highlight" defaultValue={config.highlight ?? ""} className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الوصف</span>
                    <textarea
                      name="description"
                      defaultValue={config.description ?? ""}
                      rows={4}
                      className={fieldClassName("resize-y leading-7")}
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Primary CTA Label</span>
                      <input name="primary_cta_label" defaultValue={config.primaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="primary_cta"
                      label="Primary CTA — Link"
                      defaultValue={linkDefaultFromContainer(config.primaryCta as Record<string, unknown>)}
                      showAnchor
                    />
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-white/55">Secondary CTA Label</span>
                      <input name="secondary_cta_label" defaultValue={config.secondaryCta?.label ?? ""} className={fieldClassName()} />
                    </label>
                    <AdminLinkField
                      prefix="secondary_cta"
                      label="Secondary CTA — Link"
                      defaultValue={linkDefaultFromContainer(config.secondaryCta as Record<string, unknown>)}
                      showAnchor
                    />
                  </div>
                </section>
              ),
            },
            {
              id: "meta",
              label: "الإعدادات",
              content: (
                <section className="max-w-xl space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الاسم</span>
                    <input name="name" defaultValue={block.name} required className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Slug</span>
                    <input name="slug" defaultValue={block.slug} required dir="ltr" className={fieldClassName()} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">الحالة</span>
                    <select name="status" defaultValue={block.status} className={fieldClassName()}>
                      <option value="draft">مسودة</option>
                      <option value="published">منشور</option>
                      <option value="unpublished">مخفي</option>
                      <option value="archived">أرشيف</option>
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold text-white/55">Background Style</span>
                    <select name="background_style" defaultValue={config.backgroundStyle ?? "dark"} className={fieldClassName()}>
                      <option value="dark">Dark</option>
                      <option value="gold">Gold</option>
                      <option value="gradient">Gradient</option>
                    </select>
                  </label>
                </section>
              ),
            },
            {
              id: "pages",
              label: "يظهر في الصفحات",
              content: (
                <ModulePageAssignmentsField
                  pages={assignmentContext.pages}
                  assignedPageIds={assignedPageIds}
                />
              ),
            },
          ]}
        />

        <div className="mt-6 flex justify-end">
          <button type="submit" className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C]">
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}
