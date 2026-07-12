"use client";

import AdminNotice from "../AdminNotice";
import { AdminActionButton, AdminPageContextHeader } from "../ui";
import AdminModuleTabs from "./AdminModuleTabs";
import BlockEditorContextHeader from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
import AboutIntroModuleEditor from "./editors/AboutIntroModuleEditor";
import AboutApproachModuleEditor from "./editors/AboutApproachModuleEditor";
import AboutCtaModuleEditor from "./editors/AboutCtaModuleEditor";
import AboutPrinciplesModuleEditor from "./editors/AboutPrinciplesModuleEditor";
import GenericContentModuleEditor from "./editors/GenericContentModuleEditor";
import HomeProjectsPlacementEditor from "./editors/HomeProjectsPlacementEditor";
import ProjectsHubFeaturedModuleEditor from "./editors/ProjectsHubFeaturedModuleEditor";
import ProjectsHubHeroModuleEditor from "./editors/ProjectsHubHeroModuleEditor";
import ProjectsHubListingModuleEditor from "./editors/ProjectsHubListingModuleEditor";
import ProjectsHubMapModuleEditor from "./editors/ProjectsHubMapModuleEditor";
import VisionGoalsModuleEditor from "./editors/VisionGoalsModuleEditor";
import { fieldClassName, statusMeta } from "../../../lib/page-blocks/admin-utils";
import {
  asAboutApproachConfig,
  asAboutCtaConfig,
  asAboutIntroConfig,
  asAboutPrinciplesConfig,
  asContentConfig,
  asHomeProjectsConfig,
  asVisionGoalsConfig,
} from "../../../lib/page-blocks/configs";
import {
  asProjectsHubFeaturedConfig,
  asProjectsHubHeroConfig,
  asProjectsHubListingConfig,
  asProjectsHubMapConfig,
} from "../../../lib/page-blocks/projects-hub-config";
import { getContentModuleEditorKey } from "../../../lib/page-blocks/module-edit-registry";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";
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
              : editorKey === "projects-hub-hero"
                ? asProjectsHubHeroConfig(block.config)
                : editorKey === "projects-hub-featured"
                  ? asProjectsHubFeaturedConfig(block.config)
                  : editorKey === "projects-hub-listing"
                    ? asProjectsHubListingConfig(block.config)
                    : editorKey === "projects-hub-map"
                      ? asProjectsHubMapConfig(block.config)
                      : asContentConfig(block.config);
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);
  const eyebrow =
    editorKey === "home-contact"
      ? "HOME CONTACT MODULE"
      : editorKey === "home-projects"
        ? "HOME PROJECTS MODULE"
        : editorKey === "home-trust"
          ? "HOME TRUST MODULE"
          : editorKey === "home-story"
            ? "HOME STORY MODULE"
            : editorKey === "about-intro"
              ? "WHO WE ARE MODULE"
              : editorKey === "vision-goals"
                ? "VISION & GOALS MODULE"
                : editorKey === "about-cta"
                  ? "ABOUT CTA MODULE"
                  : editorKey === "about-principles"
                    ? "ABOUT PRINCIPLES MODULE"
                    : editorKey === "about-approach"
                      ? "ABOUT APPROACH MODULE"
                      : editorKey === "projects-hub-hero"
                        ? "PROJECTS HUB HERO"
                        : editorKey === "projects-hub-featured"
                          ? "PROJECTS HUB FEATURED"
                          : editorKey === "projects-hub-listing"
                            ? "PROJECTS HUB LISTING"
                            : editorKey === "projects-hub-map"
                              ? "PROJECTS HUB MAP"
                              : "CONTENT MODULE";
  const description =
    editorKey === "home-contact"
      ? "CTA الرئيسية: نص + زر + صورة + 4 وسائل تواصل — للصفحة الرئيسية فقط."
      : editorKey === "home-projects"
        ? "سكشن مشاريع فينيسيا — نصوص السكشن من هنا؛ بيانات الكروت من جدول projects."
        : editorKey === "home-trust"
          ? "لماذا يثق السوق العقاري في فينيسيا؟ — للصفحة الرئيسية فقط."
          : editorKey === "home-story"
            ? "FROM VISION TO EXECUTION — للصفحة الرئيسية فقط."
            : editorKey === "about-intro"
              ? "موديول Who We Are — قابل لإعادة الاستخدام على أي صفحة."
              : editorKey === "vision-goals"
                ? "موديول الرؤية والأهداف — قابل لإعادة الاستخدام."
                : editorKey === "about-cta"
                  ? "موديول CTA — قابل لإعادة الاستخدام."
                  : editorKey === "about-principles"
                    ? "موديول المبادئ — قابل لإعادة الاستخدام."
                    : editorKey === "about-approach"
                      ? "موديول Our Approach — قابل لإعادة الاستخدام."
                      : editorKey === "projects-hub-listing"
                        ? "تحكّم في العناصر الظاهرة داخل قائمة المشروعات. بيانات كل مشروع نفسها تُدار من قسم إدارة المشروعات."
                        : editorKey.startsWith("projects-hub-")
                          ? "إعدادات عرض صفحة المشروعات فقط — بيانات المشروعات من إدارة المشروعات."
                          : "عدّل المحتوى ومواضع العرض من التبويبات أدناه.";

  const isProjectsHubListing = editorKey === "projects-hub-listing";
  const listingStatus = statusMeta(block.status);

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {isProjectsHubListing ? (
        <AdminPageContextHeader
          eyebrow="PROJECTS HUB LISTING"
          title="قائمة المشروعات"
          description="تحكّم في العناصر الظاهرة داخل قائمة المشروعات. بيانات كل مشروع نفسها تُدار من قسم إدارة المشروعات."
          meta={listingStatus.label}
          actions={
            <>
              <AdminActionButton href="/admin/projects" variant="dark">
                إدارة بيانات المشروعات
              </AdminActionButton>
              <AdminActionButton href="/projects" variant="dark">
                معاينة صفحة المشروعات
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لبلوكات المحتوى
              </AdminActionButton>
            </>
          }
        />
      ) : (
        <BlockEditorContextHeader
          backHref="/admin/pages-blocks/blocks/content"
          backLabel="الرجوع لبلوكات المحتوى"
          eyebrow={eyebrow}
          title={block.name}
          description={description}
          status={block.status}
          saved={saved}
          slotContext={getSlotCompatibilityLabel("content")}
        />
      )}

      {isProjectsHubListing && saved ? (
        <AdminNotice variant="success" message="تم حفظ الموديول بنجاح." />
      ) : null}

      <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
      {isProjectsHubListing ? null : (
        <ModuleDependencyHintsPanel moduleKind="content" templateSlug={block.slug} />
      )}

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
                        : editorKey === "projects-hub-hero"
                          ? "projects-hub-hero"
                          : editorKey === "projects-hub-featured"
                            ? "projects-hub-featured"
                            : editorKey === "projects-hub-listing"
                              ? "projects-hub-listing"
                              : editorKey === "projects-hub-map"
                                ? "projects-hub-map"
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
        {editorKey === "projects-hub-hero" ? <input type="hidden" name="config_schema" value="projects-hub-hero" /> : null}
        {editorKey === "projects-hub-featured" ? (
          <input type="hidden" name="config_schema" value="projects-hub-featured" />
        ) : null}
        {editorKey === "projects-hub-listing" ? (
          <input type="hidden" name="config_schema" value="projects-hub-listing" />
        ) : null}
        {editorKey === "projects-hub-map" ? <input type="hidden" name="config_schema" value="projects-hub-map" /> : null}

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
                ) : editorKey === "projects-hub-hero" ? (
                  <ProjectsHubHeroModuleEditor config={config as ReturnType<typeof asProjectsHubHeroConfig>} />
                ) : editorKey === "projects-hub-featured" ? (
                  <ProjectsHubFeaturedModuleEditor
                    config={config as ReturnType<typeof asProjectsHubFeaturedConfig>}
                  />
                ) : editorKey === "projects-hub-listing" ? (
                  <ProjectsHubListingModuleEditor
                    config={config as ReturnType<typeof asProjectsHubListingConfig>}
                  />
                ) : editorKey === "projects-hub-map" ? (
                  <ProjectsHubMapModuleEditor config={config as ReturnType<typeof asProjectsHubMapConfig>} />
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
