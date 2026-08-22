"use client";

import AdminNotice from "../AdminNotice";
import { AdminActionButton } from "../ui";
import HeroCtaFields from "../../../app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields";
import HeroElementOrderEditor from "../../../app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor";
import {
  ModuleEditorHeader,
  ModuleEditorFeedback,
  ModuleEditorField,
  ModuleEditorFieldGrid,
  ModuleEditorPagesTab,
  ModuleEditorSaveArea,
  ModuleEditorSection,
  ModuleEditorSettingsComposition,
  ModuleEditorStatusSwitch,
  ModuleEditorTabs,
  ModuleEditorTechnicalIdentity,
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
  getContentModuleEditorKey,
  isStructuralContentTemplateSlug,
  resolveModuleProductKind,
} from "../../../lib/page-blocks/module-edit-registry";
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
  const moduleProductKind = resolveModuleProductKind("content", block.slug, block.variant);
  const usesAboutIntroConfig = editorKey === "about-intro" || editorKey === "home-story";
  const isAboutIntroSingleImage = editorKey === "about-intro-single-image";
  const usesAboutPrinciplesConfig = editorKey === "about-principles" || editorKey === "home-trust";
  const usesAboutCtaConfig = editorKey === "about-cta" || editorKey === "home-contact";
  const config = usesAboutIntroConfig
    ? asAboutIntroConfig(block.config)
    : isAboutIntroSingleImage
      ? asAboutIntroSingleImageConfig(block.config)
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
  const usesHomeModuleChrome = isHomeStory || isHomeContact || isHomeProjects || isHomeTrust;
  const usesAboutStructuredChrome =
    isAboutIntro || isAboutIntroSingleImage || isVisionGoals || isAboutCta || isAboutPrinciples || isAboutApproach;
  const usesUnifiedModuleChrome = usesHomeModuleChrome || usesAboutStructuredChrome;
  const usesInternalDescriptionField =
    isHomeContact ||
    isHomeStory ||
    isHomeProjects ||
    isHomeTrust ||
    usesAboutStructuredChrome;
  const usesLockedInternalSlug = isStructuralContentTemplateSlug(block.slug, block.variant);
  const hubStatus = statusMeta(block.status);
  const homeStoryConfig = isHomeStory ? (config as ReturnType<typeof asAboutIntroConfig>) : null;
  const homeContactConfig = isHomeContact ? (config as ReturnType<typeof asAboutCtaConfig>) : null;
  const settingsFieldSpan = isProjectsHubHero ? 6 : 4;

  const settingsTab = {
    id: "settings",
    content: (
      <ModuleEditorSettingsComposition
        primary={
        <ModuleEditorSection>
        {usesLockedInternalSlug ? (
          <ModuleEditorTechnicalIdentity
            mode="hidden"
            value={block.slug}
            inputClassName={fieldClassName()}
          />
        ) : null}
        <ModuleEditorFieldGrid className={isProjectsHubHero ? "lg:grid-cols-2 xl:grid-cols-12" : ""}>
        <ModuleEditorField nature="standard" span={settingsFieldSpan}><label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">
            {usesAboutStructuredChrome ? "اسم الموديول" : "الاسم"}
          </span>
          <input name="name" defaultValue={block.name} required className={fieldClassName()} />
        </label></ModuleEditorField>
        {!usesLockedInternalSlug ? (
          <ModuleEditorField nature="technical" span={settingsFieldSpan}><ModuleEditorTechnicalIdentity
            mode="editable"
            value={block.slug}
            inputClassName={fieldClassName()}
          /></ModuleEditorField>
        ) : null}
        <ModuleEditorField nature="short-description" span={settingsFieldSpan}>
        {usesInternalDescriptionField ? (
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">الوصف الداخلي</span>
            <input
              name="internal_description"
              defaultValue={block.description ?? ""}
              className={fieldClassName()}
            />
            <span className="block text-xs leading-6 text-white/45">
              ملاحظة إدارية توضّح وظيفة الموديول، ولا تظهر لزوار الموقع.
            </span>
          </label>
        ) : (
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">الوصف الداخلي</span>
            <input name="description" defaultValue={block.description ?? ""} className={fieldClassName()} />
          </label>
        )}
        </ModuleEditorField>
        <ModuleEditorField nature="binary-state" span={settingsFieldSpan}>
          <ModuleEditorStatusSwitch status={block.status} />
        </ModuleEditorField>
        </ModuleEditorFieldGrid>
        </ModuleEditorSection>
        }
      />
    ),
  };

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
          id: "display",
          content: (
            <ModuleEditorPagesTab moduleName={block.name} assignmentContext={assignmentContext}>
              {settingsTab.content}
            </ModuleEditorPagesTab>
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
        settingsTab,
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
        settingsTab,
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
        settingsTab,
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

      <form action={updateAction}>
        <input type="hidden" name="id" value={block.id} />
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

        {heroPlatformTabs ? (
          <ModuleEditorTabs moduleKind="hero" nowrap tabs={heroPlatformTabs} activePanelContext={activePanelContext} />
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
                  ) : (
                    <GenericContentModuleEditor config={config as ReturnType<typeof asContentConfig>} />
                  ),
              },
              { ...settingsTab, id: "meta" },
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
