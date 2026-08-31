"use client";

import AdminNotice from "../AdminNotice";
import { AdminActionButton, AdminFormGrid } from "../ui";
import HeroCtaFields from "../../../app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields";
import HeroElementOrderEditor from "../../../app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor";
import {
  ModuleEditorHeader,
  ModuleEditorFeedback,
  ModuleEditorPagesTab,
  ModuleEditorIdentitySection,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSectionHeading,
  ModuleEditorTabs,
  MODULE_EDITOR_CONTROL_CARD_CLASS_NAME,
} from "./ModuleEditorPresentation";
import AboutIntroModuleEditor from "./editors/AboutIntroModuleEditor";
import AboutIntroSingleImageModuleEditor from "./editors/AboutIntroSingleImageModuleEditor";
import AboutApproachModuleEditor from "./editors/AboutApproachModuleEditor";
import AboutCtaModuleEditor from "./editors/AboutCtaModuleEditor";
import AboutPrinciplesModuleEditor from "./editors/AboutPrinciplesModuleEditor";
import GenericContentModuleEditor from "./editors/GenericContentModuleEditor";
import HomeProjectsPlacementEditor from "./editors/HomeProjectsPlacementEditor";
import ProjectsHubFeaturedModuleEditor from "./editors/ProjectsHubFeaturedModuleEditor";
import ProjectsHubHeroModuleEditor from "./editors/ProjectsHubHeroModuleEditor";
import ProjectsHubListingModuleEditor from "./editors/ProjectsHubListingModuleEditor";
import ProjectsHubMapModuleEditor from "./editors/ProjectsHubMapModuleEditor";
import TopicsListingModuleEditor from "./editors/TopicsListingModuleEditor";
import SearchPlatformModuleEditor from "./editors/SearchPlatformModuleEditor";
import VisionGoalsModuleEditor from "./editors/VisionGoalsModuleEditor";
import { fieldClassName, statusMeta } from "../../../lib/page-blocks/admin-utils";
import {
  asAboutApproachConfig,
  asAboutCtaConfig,
  asAboutIntroConfig,
  asAboutIntroSingleImageConfig,
  asAboutPrinciplesConfig,
  asContentConfig,
  asHomeProjectsConfig,
  asTopicsListingConfig,
  asVisionGoalsConfig,
} from "../../../lib/page-blocks/configs";
import {
  asProjectsHubFeaturedConfig,
  asProjectsHubHeroConfig,
  asProjectsHubListingConfig,
  asProjectsHubMapConfig,
  PROJECTS_HUB_HERO_ELEMENT_KEYS,
} from "../../../lib/page-blocks/projects-hub-config";
import {
  PROJECT_HERO_ACTION_KEYS,
  PROJECT_HERO_ACTION_LABELS_AR,
} from "../../../lib/hero/hero-content-controls";
import {
  getContentModuleEditorKey,
  resolveModuleProductKind,
} from "../../../lib/page-blocks/module-edit-registry";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";
import { asSearchPlatformConfig } from "../../../lib/page-blocks/search-platform-config";

type ContentModuleEditClientProps = {
  block: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    variant: string | null;
    style_preset: string | null;
    status: string;
    updated_at: string;
  };
  config: unknown;
  assignmentContext: ModuleAssignmentContext;
  projectDetailHeroEditorLinks: {
    root: string;
    buttons: string;
  } | null;
  topicCategoryOptions: readonly {
    id: number;
    slug: string;
    name: string;
    parentId: number | null;
    depth: number;
  }[];
  saved?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
};

function ProjectDetailHeroEditorLinks({
  links,
}: {
  links: ContentModuleEditClientProps["projectDetailHeroEditorLinks"];
}) {
  return (
    <ModuleEditorSection>
      {links ? (
        <>
          <ModuleEditorSectionHeading
            intent="cta"
            actions={
              <AdminActionButton href={links.root} variant="dark">
                فتح محرر Hero التفاصيل
              </AdminActionButton>
            }
          >
            الإجراءات الثلاثة
          </ModuleEditorSectionHeading>
          <AdminFormGrid columns={3} className="mt-4">
            {PROJECT_HERO_ACTION_KEYS.map((key, index) => {
              const label = PROJECT_HERO_ACTION_LABELS_AR[key];
              return (
                <article
                  key={key}
                  data-related-project-hero-action-card={key}
                  className={`${MODULE_EDITOR_CONTROL_CARD_CLASS_NAME} flex min-w-0 flex-col gap-4`}
                >
                  <header className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] font-en text-[10px] font-semibold text-[#D8B87A]/70">
                      {index + 1}
                    </span>
                    <h3 className="min-w-0 text-sm font-semibold text-white">
                      {label}
                    </h3>
                  </header>
                  <AdminActionButton
                    href={`${links.buttons}#project-hero-action-${key}`}
                    variant="dark"
                    className="mt-auto w-full"
                  >
                    تعديل {label}
                  </AdminActionButton>
                </article>
              );
            })}
          </AdminFormGrid>
        </>
      ) : (
        <AdminNotice
          variant="warning"
          message="تعذر العثور على Hero تفاصيل المشروع المعتمد."
        />
      )}
    </ModuleEditorSection>
  );
}

export default function ContentModuleEditClient({
  block,
  config,
  assignmentContext,
  projectDetailHeroEditorLinks,
  topicCategoryOptions,
  saved,
  updateAction,
}: ContentModuleEditClientProps) {
  const editorKey = getContentModuleEditorKey(block.slug, block.variant ?? "");
  const moduleProductKind = resolveModuleProductKind("content", block.slug, block.variant);
  const usesAboutIntroConfig = editorKey === "about-intro" || editorKey === "home-story";
  const isAboutIntroSingleImage = editorKey === "about-intro-single-image";
  const usesAboutPrinciplesConfig = editorKey === "about-principles" || editorKey === "home-trust";
  const usesAboutCtaConfig = editorKey === "about-cta" || editorKey === "home-contact";
  const presentationSlug = editorKey === "generic" ? block.slug : editorKey;
  const projectsHubNavigation =
    editorKey === "projects-hub-hero"
      ? {
          backHref: "/admin/pages-blocks/pages/36",
          backLabel: "الرجوع لصفحة المشروعات",
        }
      : editorKey === "projects-hub-featured"
        ? {
            backHref: "/admin/pages-blocks/pages/36",
            backLabel: "الرجوع لصفحة المشروعات",
          }
        : editorKey === "projects-hub-listing"
          ? {
              backHref: "/admin/pages-blocks/blocks/content",
              backLabel: "الرجوع لبلوكات المحتوى",
            }
          : editorKey === "projects-hub-map"
            ? {
                backHref: "/admin/pages-blocks/pages/36",
                backLabel: "الرجوع لصفحة المشروعات",
              }
            : null;

  const isHomeStory = editorKey === "home-story";
  const isProjectsHubHero = editorKey === "projects-hub-hero";
  const isHomeContact = editorKey === "home-contact";
  const isHomeProjects = editorKey === "home-projects";
  const isHomeTrust = editorKey === "home-trust";
  const isAboutIntro = editorKey === "about-intro";
  const isVisionGoals = editorKey === "vision-goals";
  const isAboutCta = editorKey === "about-cta";
  const isAboutPrinciples = editorKey === "about-principles";
  const isAboutApproach = editorKey === "about-approach";
  const isGenericIntro =
    editorKey === "generic" &&
    (block.slug === "topics-intro" || block.variant === "intro");
  const usesHomeModuleChrome = isHomeStory || isHomeContact || isHomeProjects || isHomeTrust;
  const usesAboutStructuredChrome =
    isAboutIntro || isAboutIntroSingleImage || isVisionGoals || isAboutCta || isAboutPrinciples || isAboutApproach;
  const usesUnifiedModuleChrome = usesHomeModuleChrome || usesAboutStructuredChrome;
  const hubStatus = statusMeta(block.status);
  const homeStoryConfig = isHomeStory ? (config as ReturnType<typeof asAboutIntroConfig>) : null;
  const homeContactConfig = isHomeContact ? (config as ReturnType<typeof asAboutCtaConfig>) : null;

  const pagesTab = {
    id: "pages",
    content: <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />,
  };

  const heroPlatformTabs = isProjectsHubHero
    ? [
        {
          id: "content",
          content: <ProjectsHubHeroModuleEditor config={config as ReturnType<typeof asProjectsHubHeroConfig>} />,
        },
        {
          id: "buttons",
          content: (
            <ModuleEditorSection>
              <HeroCtaFields
                primaryLabel={(config as ReturnType<typeof asProjectsHubHeroConfig>).primaryCtaLabel}
                linkSource="project-domain"
                showDefault={(config as ReturnType<typeof asProjectsHubHeroConfig>).showCta}
                boldDefault={(config as ReturnType<typeof asProjectsHubHeroConfig>).ctaBold}
                alignmentDefault={(config as ReturnType<typeof asProjectsHubHeroConfig>).ctaAlignment}
              />
            </ModuleEditorSection>
          ),
        },
        {
          id: "order",
          content: (
            <ModuleEditorSection>
              <HeroElementOrderEditor
                defaultOrder={(config as ReturnType<typeof asProjectsHubHeroConfig>).heroElementOrder}
                allowedKeys={PROJECTS_HUB_HERO_ELEMENT_KEYS}
              />
            </ModuleEditorSection>
          ),
        },
        {
          id: "details",
          content: (
            <ProjectDetailHeroEditorLinks
              links={projectDetailHeroEditorLinks}
            />
          ),
        },
        {
          id: "display",
          content: (
            <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext} />
          ),
        },
      ]
    : null;

  const homeStoryTabs = homeStoryConfig
    ? [
        {
          id: "text",
          content: <AboutIntroModuleEditor config={homeStoryConfig} editorMode="home-story" section="text" />,
        },
        {
          id: "images",
          content: <AboutIntroModuleEditor config={homeStoryConfig} editorMode="home-story" section="images" />,
        },
        {
          id: "cta",
          content: <AboutIntroModuleEditor config={homeStoryConfig} editorMode="home-story" section="cta" />,
        },
        pagesTab,
      ]
    : [];

  const homeContactTabs = homeContactConfig
    ? [
        {
          id: "text",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="text" />,
        },
        {
          id: "image",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="image" />,
        },
        {
          id: "cta",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="cta" />,
        },
        {
          id: "contacts",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="contacts" />,
        },
        pagesTab,
      ]
    : [];

  const aboutCtaTabs = isAboutCta
    ? [
        {
          id: "text",
          content: <AboutCtaModuleEditor config={config as ReturnType<typeof asAboutCtaConfig>} editorMode="about-cta" section="text" />,
        },
        {
          id: "image",
          content: <AboutCtaModuleEditor config={config as ReturnType<typeof asAboutCtaConfig>} editorMode="about-cta" section="image" />,
        },
        {
          id: "cta",
          content: <AboutCtaModuleEditor config={config as ReturnType<typeof asAboutCtaConfig>} editorMode="about-cta" section="cta" />,
        },
        {
          id: "contacts",
          content: <AboutCtaModuleEditor config={config as ReturnType<typeof asAboutCtaConfig>} editorMode="about-cta" section="contacts" />,
        },
        pagesTab,
      ]
    : [];

  const savedMessage = isAboutIntro
    ? "تم حفظ موديول من نحن — المقدمة بنجاح."
    : isAboutIntroSingleImage
      ? "تم حفظ موديول المحتوى والصورة الواحدة بنجاح."
      : isVisionGoals
        ? "تم حفظ موديول الرؤية والأهداف بنجاح."
        : isAboutCta
          ? "تم حفظ موديول الدعوة للتواصل بنجاح."
          : isAboutPrinciples
            ? "تم حفظ موديول المبادئ بنجاح."
            : isAboutApproach
              ? "تم حفظ موديول المنهج بنجاح."
              : isHomeStory
                ? "تم حفظ الموديول وتحديث الصفحة الرئيسية بنجاح."
                : isHomeContact
                  ? "تم حفظ موديول التواصل وتحديث الصفحة الرئيسية بنجاح."
                  : isHomeProjects
                    ? "تم حفظ موديول المشاريع وتحديث الصفحة الرئيسية بنجاح."
                    : isHomeTrust
                      ? "تم حفظ موديول الثقة وتحديث الصفحة الرئيسية بنجاح."
                      : "تم حفظ الموديول بنجاح.";
  const activePanelContext = (
    <ModuleEditorFeedback>
      {saved ? <AdminNotice variant="success" message={savedMessage} /> : null}
    </ModuleEditorFeedback>
  );

  return (
    <div className={`space-y-6 ${usesUnifiedModuleChrome ? "pb-28" : "pb-10"}`} dir="rtl">
      {isAboutIntro ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isAboutIntroSingleImage ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isVisionGoals ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isAboutCta ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isAboutPrinciples ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isAboutApproach ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/about" variant="dark">
                معاينة صفحة من نحن
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لإدارة الموديولات
              </AdminActionButton>
            </>
          }
        />
      ) : isHomeStory ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/" variant="dark">
                معاينة الصفحة الرئيسية
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لبلوكات المحتوى
              </AdminActionButton>
            </>
          }
        />
      ) : isHomeContact ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/" variant="dark">
                معاينة الصفحة الرئيسية
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لبلوكات المحتوى
              </AdminActionButton>
            </>
          }
        />
      ) : isHomeProjects ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/" variant="dark">
                معاينة الصفحة الرئيسية
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لبلوكات المحتوى
              </AdminActionButton>
            </>
          }
        />
      ) : isHomeTrust ? (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/" variant="dark">
                معاينة الصفحة الرئيسية
              </AdminActionButton>
              <AdminActionButton href="/admin/pages-blocks/blocks/content" variant="ghost">
                الرجوع لبلوكات المحتوى
              </AdminActionButton>
            </>
          }
        />
      ) : projectsHubNavigation ? (
        <ModuleEditorHeader
          moduleKind={moduleProductKind}
          moduleSlug={presentationSlug}
          entityName={block.name}
          backHref={projectsHubNavigation.backHref}
          backLabel={projectsHubNavigation.backLabel}
          actions={
            <AdminActionButton href="/projects" variant="dark">
              معاينة صفحة المشروعات
            </AdminActionButton>
          }
        />
      ) : (
        <ModuleEditorHeader
          moduleKind="content"
          moduleSlug={presentationSlug}
          entityName={block.name}
          backHref="/admin/pages-blocks/blocks/content"
          backLabel="الرجوع لبلوكات المحتوى"
          status={block.status}
          saved={saved}
        />
      )}

      <form key={`${block.id}:${block.updated_at}`} action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="slug" value={block.slug} />
        <input type="hidden" name="internal_description" value={block.description ?? ""} />
        <input
          type="hidden"
          name="variant"
          value={
            usesAboutIntroConfig
              ? "about-intro"
              : isAboutIntroSingleImage
                ? "about-intro-single-image"
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
                                  : editorKey === "topics-listing"
                                    ? "topics-listing"
                                    : editorKey === "search-platform"
                                      ? "search-platform"
                                  : block.variant ?? "default"
          }
        />
        <input type="hidden" name="style_preset" value={block.style_preset ?? "premium-dark"} />
        {usesAboutIntroConfig ? <input type="hidden" name="config_schema" value="about-intro" /> : null}
        {isAboutIntroSingleImage ? (
          <input type="hidden" name="config_schema" value="about-intro-single-image" />
        ) : null}
        {isHomeStory ? <input type="hidden" name="include_story_cta" value="1" /> : null}
        {editorKey === "vision-goals" ? <input type="hidden" name="config_schema" value="vision-goals" /> : null}
        {usesAboutCtaConfig ? <input type="hidden" name="config_schema" value="about-cta" /> : null}
        {usesAboutPrinciplesConfig ? (
          <input type="hidden" name="config_schema" value="about-principles" />
        ) : null}
        {editorKey === "about-approach" ? <input type="hidden" name="config_schema" value="about-approach" /> : null}
        {editorKey === "home-projects" ? <input type="hidden" name="config_schema" value="home-projects" /> : null}
        {editorKey === "projects-hub-hero" ? <input type="hidden" name="config_schema" value="projects-hub-hero" /> : null}
        {editorKey === "projects-hub-hero" ? (
          <input
            type="hidden"
            name="hero_variant"
            value={(config as ReturnType<typeof asProjectsHubHeroConfig>).variant}
          />
        ) : null}
        {editorKey === "projects-hub-featured" ? (
          <input type="hidden" name="config_schema" value="projects-hub-featured" />
        ) : null}
        {editorKey === "projects-hub-listing" ? (
          <input type="hidden" name="config_schema" value="projects-hub-listing" />
        ) : null}
        {editorKey === "projects-hub-map" ? <input type="hidden" name="config_schema" value="projects-hub-map" /> : null}
        {editorKey === "topics-listing" ? (
          <input type="hidden" name="config_schema" value="topics-listing" />
        ) : null}
        {editorKey === "search-platform" ? (
          <input type="hidden" name="config_schema" value="search-platform" />
        ) : null}
        <ModuleEditorIdentitySection
          name={block.name}
          status={block.status}
          inputClassName={fieldClassName("h-11")}
        />
        {heroPlatformTabs ? (
          <ModuleEditorTabs
            moduleKind="hero"
            moduleSlug={presentationSlug}
            nowrap
            tabs={heroPlatformTabs}
            activePanelContext={activePanelContext}
          />
        ) : isHomeStory ? (
          <ModuleEditorTabs moduleKind="content" moduleSlug={presentationSlug} nowrap tabs={homeStoryTabs} activePanelContext={activePanelContext} />
        ) : isHomeContact ? (
          <ModuleEditorTabs moduleKind="content" moduleSlug={presentationSlug} nowrap tabs={homeContactTabs} activePanelContext={activePanelContext} />
        ) : isAboutCta ? (
          <ModuleEditorTabs moduleKind="content" moduleSlug={presentationSlug} nowrap tabs={aboutCtaTabs} activePanelContext={activePanelContext} />
        ) : (
          <ModuleEditorTabs
            moduleKind="content"
            moduleSlug={presentationSlug}
            activePanelContext={activePanelContext}
            tabs={[
              {
                id: "content",
                content:
                  editorKey === "about-intro" ? (
                    <AboutIntroModuleEditor
                      config={config as ReturnType<typeof asAboutIntroConfig>}
                      editorMode="about-intro"
                    />
                  ) : isAboutIntroSingleImage ? (
                    <AboutIntroSingleImageModuleEditor
                      config={config as ReturnType<typeof asAboutIntroSingleImageConfig>}
                    />
                  ) : editorKey === "vision-goals" ? (
                    <VisionGoalsModuleEditor config={config as ReturnType<typeof asVisionGoalsConfig>} />
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
                  ) : editorKey === "topics-listing" ? (
                    <TopicsListingModuleEditor
                      config={config as ReturnType<typeof asTopicsListingConfig>}
                      categoryOptions={topicCategoryOptions}
                    />
                  ) : editorKey === "search-platform" ? (
                    <SearchPlatformModuleEditor
                      config={config as ReturnType<typeof asSearchPlatformConfig>}
                    />
                  ) : (
                    <GenericContentModuleEditor
                      config={config as ReturnType<typeof asContentConfig>}
                      introPresentation={isGenericIntro}
                    />
                  ),
              },
              pagesTab,
            ]}
          />
        )}

        {isAboutIntro || isAboutIntroSingleImage || isVisionGoals || isAboutCta || isAboutPrinciples || isAboutApproach ? (
          <ModuleEditorSaveArea
            title="حفظ التعديلات"
            description="يُحدَّث العرض العام بعد اكتمال الحفظ."
            saveLabel="حفظ التعديلات"
          />
        ) : isHomeStory ? (
          <ModuleEditorSaveArea
            title="حفظ موديول القصة"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeContact ? (
          <ModuleEditorSaveArea
            title="حفظ موديول التواصل"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeProjects ? (
          <ModuleEditorSaveArea
            title="حفظ موديول المشروعات"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeTrust ? (
          <ModuleEditorSaveArea
            title="حفظ موديول الثقة"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : (
          <ModuleEditorSaveArea />
        )}
      </form>
    </div>
  );
}
