"use client";

import Link from "next/link";

import AdminModuleTabs from "./AdminModuleTabs";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import AboutIntroModuleEditor from "./editors/AboutIntroModuleEditor";
import AboutApproachModuleEditor from "./editors/AboutApproachModuleEditor";
import AboutCtaModuleEditor from "./editors/AboutCtaModuleEditor";
import AboutPrinciplesModuleEditor from "./editors/AboutPrinciplesModuleEditor";
import GenericContentModuleEditor from "./editors/GenericContentModuleEditor";
import HomeProjectsPlacementEditor from "./editors/HomeProjectsPlacementEditor";
import VisionGoalsModuleEditor from "./editors/VisionGoalsModuleEditor";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import {
  asAboutApproachConfig,
  asAboutCtaConfig,
  asAboutIntroConfig,
  asAboutPrinciplesConfig,
  asContentConfig,
  asHomeProjectsConfig,
  asVisionGoalsConfig,
} from "../../../lib/page-blocks/configs";
import { getContentModuleEditorKey } from "../../../lib/page-blocks/module-edit-registry";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

type ContentModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    variant: string;
    style_preset: string | null;
    status: string;
    config: unknown;
  };
  assignmentContext: ModuleAssignmentContext;
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

export default function ContentModuleEditClient({
  block,
  assignmentContext,
  saved,
  updateAction,
}: ContentModuleEditClientProps) {
  const editorKey = getContentModuleEditorKey(block.slug, block.variant);
  const usesAboutIntroConfig = editorKey === "about-intro" || editorKey === "home-story";
  const usesAboutPrinciplesConfig = editorKey === "about-principles" || editorKey === "home-trust";
  const usesAboutCtaConfig = editorKey === "about-cta" || editorKey === "home-contact";
  const config = usesAboutIntroConfig
    ? asAboutIntroConfig(block.config)
    : editorKey === "vision-goals"
      ? asVisionGoalsConfig(block.config)
      : usesAboutCtaConfig
        ? asAboutCtaConfig(block.config)
        : usesAboutPrinciplesConfig
          ? asAboutPrinciplesConfig(block.config)
          : editorKey === "about-approach"
            ? asAboutApproachConfig(block.config)
            : editorKey === "home-projects"
              ? asHomeProjectsConfig(block.config)
            : asContentConfig(block.config);
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      <section className="rounded-[34px] border border-white/10 bg-[#080B10]/78 p-6">
        <Link href="/admin/pages-blocks/blocks/content" className="mb-4 inline-flex text-sm text-white/45 hover:text-[#D8B87A]">
          → الرجوع لبلوكات المحتوى
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D8B87A]/70">
          {editorKey === "home-contact"
            ? "Home Contact Module"
            : editorKey === "home-projects"
            ? "Home Projects Module"
            : editorKey === "home-trust"
            ? "Home Trust Module"
            : editorKey === "home-story"
            ? "Home Story Module"
            : editorKey === "about-intro"
              ? "Who We Are Module"
              : editorKey === "vision-goals"
              ? "Vision & Goals Module"
              : editorKey === "about-cta"
                ? "About CTA Module"
                : editorKey === "about-principles"
                  ? "About Principles Module"
                  : editorKey === "about-approach"
                    ? "About Approach Module"
                    : "Content Module"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white">{block.name}</h1>
        <p className="mt-2 text-sm text-white/45">
          {editorKey === "home-contact"
            ? "CTA الرئيسية: نص + زر + صورة + 4 وسائل تواصل — للصفحة الرئيسية فقط."
            : editorKey === "home-projects"
            ? "سكشن مشاريع فينيسيا — نصوص السكشن من هنا؛ بيانات الكروت من جدول projects (show_on_homepage + homepage_order)."
            : editorKey === "home-trust"
            ? "لماذا يثق السوق العقاري في فينيسيا؟ — نص يسار + 4 بطاقات ثقة — للصفحة الرئيسية فقط."
            : editorKey === "home-story"
            ? "FROM VISION TO EXECUTION: نص + صورتان متداخلتان + زر CTA — للصفحة الرئيسية فقط."
            : editorKey === "about-intro"
              ? "موديول Who We Are: نص + 3 صور + 3 بطاقات — قابل لإعادة الاستخدام على أي صفحة."
              : editorKey === "vision-goals"
              ? "موديول الرؤية والأهداف: نص + صورة + عمودان — قابل لإعادة الاستخدام على أي صفحة."
              : editorKey === "about-cta"
                ? "موديول CTA: تواصل + نص + زر + صورة — قابل لإعادة الاستخدام على أي صفحة."
                : editorKey === "about-principles"
                  ? "موديول المبادئ: عنوان + عناصر بأيقونات — قابل لإعادة الاستخدام على أي صفحة."
                  : editorKey === "about-approach"
                    ? "موديول Our Approach: eyebrow + نص مركزي — قابل لإعادة الاستخدام على أي صفحة."
                    : "عدّل المحتوى ومواضع العرض من التبويبات أدناه."}
        </p>
        {saved ? <p className="mt-3 text-sm text-emerald-300">تم حفظ الموديول بنجاح.</p> : null}
      </section>

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input
          type="hidden"
          name="variant"
          value={
            usesAboutIntroConfig
              ? "about-intro"
              : usesAboutPrinciplesConfig
                ? "about-principles"
                : usesAboutCtaConfig
                  ? "about-cta"
                  : editorKey === "home-projects"
                    ? "home-projects"
                    : editorKey === "vision-goals"
                ? "vision-goals"
                : editorKey === "about-approach"
                    ? "about-approach"
                    : block.variant ?? "default"
          }
        />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />
        {usesAboutIntroConfig ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
        {editorKey === "vision-goals" ? <input type="hidden" name="config_schema" value="vision-goals" /> : null}
        {usesAboutCtaConfig ? <input type="hidden" name="config_schema" value="about-cta" /> : null}
        {usesAboutPrinciplesConfig ? (
          <input type="hidden" name="config_schema" value="about-principles" />
        ) : null}
        {editorKey === "about-approach" ? <input type="hidden" name="config_schema" value="about-approach" /> : null}
        {editorKey === "home-projects" ? <input type="hidden" name="config_schema" value="home-projects" /> : null}

        <AdminModuleTabs
          tabs={[
            {
              id: "content",
              label: "المحتوى",
              content:
                editorKey === "about-intro" ? (
                  <AboutIntroModuleEditor
                    config={config as ReturnType<typeof asAboutIntroConfig>}
                    editorMode="about-intro"
                  />
                ) : editorKey === "home-story" ? (
                  <AboutIntroModuleEditor
                    config={config as ReturnType<typeof asAboutIntroConfig>}
                    editorMode="home-story"
                  />
                ) : editorKey === "vision-goals" ? (
                  <VisionGoalsModuleEditor config={config as ReturnType<typeof asVisionGoalsConfig>} />
                ) : editorKey === "about-cta" ? (
                  <AboutCtaModuleEditor
                    config={config as ReturnType<typeof asAboutCtaConfig>}
                    editorMode="about-cta"
                  />
                ) : editorKey === "home-contact" ? (
                  <AboutCtaModuleEditor
                    config={config as ReturnType<typeof asAboutCtaConfig>}
                    editorMode="home-contact"
                  />
                ) : editorKey === "home-trust" ? (
                  <AboutPrinciplesModuleEditor
                    config={config as ReturnType<typeof asAboutPrinciplesConfig>}
                    editorMode="home-trust"
                  />
                ) : editorKey === "home-projects" ? (
                  <HomeProjectsPlacementEditor config={config as ReturnType<typeof asHomeProjectsConfig>} />
                ) : editorKey === "about-principles" ? (
                  <AboutPrinciplesModuleEditor
                    config={config as ReturnType<typeof asAboutPrinciplesConfig>}
                    editorMode="about-principles"
                  />
                ) : editorKey === "about-approach" ? (
                  <AboutApproachModuleEditor config={config as ReturnType<typeof asAboutApproachConfig>} />
                ) : (
                  <GenericContentModuleEditor config={config as ReturnType<typeof asContentConfig>} />
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
                    <span className="text-xs font-semibold text-white/55">وصف داخلي</span>
                    <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
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
          <button type="submit" className="rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d]">
            حفظ الموديول
          </button>
        </div>
      </form>
    </div>
  );
}
