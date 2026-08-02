"use client";

import { useFormStatus } from "react-dom";
import AdminNotice from "../AdminNotice";
import { AdminActionButton, AdminPageContextHeader, AdminStickyFormBar } from "../ui";
import AdminModuleTabs from "../ui/AdminModuleTabs";
import BlockEditorContextHeader from "./BlockEditorContextHeader";
import ModuleCrossPageUsageBanner from "./ModuleCrossPageUsageBanner";
import ModuleDependencyHintsPanel from "./ModuleDependencyHintsPanel";
import ModulePageAssignmentsField from "./ModulePageAssignmentsField";
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
} from "../../../lib/page-blocks/projects-hub-config";
import { getContentModuleEditorKey } from "../../../lib/page-blocks/module-edit-registry";
import { getSlotCompatibilityLabel } from "../../../lib/page-composition/slot-module-registry";
import type { ModuleAssignmentContext } from "../../../lib/page-blocks/module-assignments-query";

function StickyModuleSaveDock({
  title,
  description,
  saveLabel = "حفظ الموديول",
}: {
  title: string;
  description: string;
  saveLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <AdminStickyFormBar className="mt-8" title={title} description={description}>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#D8B87A] px-6 text-sm font-bold text-[#06101C] transition hover:bg-[#e5c98d] ${
          pending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        {pending ? "جارٍ الحفظ..." : saveLabel}
      </button>
    </AdminStickyFormBar>
  );
}

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
  const assignedPageIds = assignmentContext.assignments.map((row) => row.page_id);
  const eyebrow =
    editorKey === "home-contact"
      ? "موديول التواصل — الرئيسية"
      : editorKey === "home-projects"
        ? "موديول المشروعات — الرئيسية"
        : editorKey === "home-trust"
          ? "موديول الثقة — الرئيسية"
          : editorKey === "home-story"
            ? "موديول القصة — الرئيسية"
            : editorKey === "about-intro"
              ? "موديول محتوى"
              : editorKey === "about-intro-single-image"
                ? "موديول محتوى"
                : editorKey === "vision-goals"
                  ? "موديول الرؤية والأهداف"
                  : editorKey === "about-cta"
                  ? "موديول دعوة للتواصل"
                  : editorKey === "about-principles"
                    ? "موديول المبادئ"
                    : editorKey === "about-approach"
                      ? "موديول المنهج"
                      : editorKey === "projects-hub-hero"
                        ? "هيرو صفحة المشروعات"
                        : editorKey === "projects-hub-featured"
                          ? "المشروعات المميزة"
                          : editorKey === "projects-hub-listing"
                            ? "قائمة المشروعات"
                            : editorKey === "projects-hub-map"
                              ? "خريطة المشروعات"
                              : "موديول محتوى";
  const description =
    editorKey === "home-contact"
      ? "تحكّم في نصوص وصورة وزر ووسائل التواصل داخل قسم التواصل في الصفحة الرئيسية. كل التغييرات تنعكس على العرض العام بعد الحفظ."
      : editorKey === "home-projects"
        ? "تحكّم في نصوص وعرض قسم مشروعات فينيسيا في الصفحة الرئيسية. بيانات المشروعات نفسها تُدار من إدارة المشروعات."
        : editorKey === "home-trust"
          ? "لماذا يثق السوق العقاري في فينيسيا؟ — للصفحة الرئيسية فقط."
          : editorKey === "home-story"
            ? "تحكّم في نصوص وصور وزر قسم القصة في الصفحة الرئيسية. كل التغييرات هنا تنعكس على العرض العام بعد الحفظ."
            : editorKey === "about-intro"
              ? "تحكّم في نصوص وصور وبطاقات قسم من نحن في صفحة من نحن. التغييرات تنعكس على العرض العام بعد الحفظ."
              : editorKey === "about-intro-single-image"
                ? "تحكّم في نص ومحتوى وصورة واحدة لقسم من نحن، مع اختيار موضع الصورة يمين أو شمال على سطح المكتب."
                : editorKey === "vision-goals"
                  ? "تحكّم في نصوص وصورة قسم الرؤية والأهداف. التغييرات تنعكس على العرض العام بعد الحفظ."
                  : editorKey === "about-cta"
                  ? "تحكّم في نصوص وصورة وزر ووسائل التواصل لقسم الدعوة للتواصل. التغييرات تنعكس على العرض العام بعد الحفظ."
                  : editorKey === "about-principles"
                    ? "تحكّم في عناوين وبطاقات قسم المبادئ. التغييرات تنعكس على العرض العام بعد الحفظ."
                    : editorKey === "about-approach"
                      ? "تحكّم في عنوان ومنهج العمل. افصل الجزء الثاني بشرطة عند الحاجة للتمييز البصري."
                      : editorKey === "projects-hub-listing"
                        ? "تحكّم في العناصر الظاهرة داخل قائمة المشروعات. بيانات كل مشروع نفسها تُدار من قسم إدارة المشروعات."
                        : editorKey.startsWith("projects-hub-")
                          ? "إعدادات عرض صفحة المشروعات فقط — بيانات المشروعات من إدارة المشروعات."
                          : "عدّل المحتوى ومواضع العرض من التبويبات أدناه.";

  const projectsHubHeader =
    editorKey === "projects-hub-hero"
      ? {
          eyebrow: "هيرو صفحة المشروعات",
          title: "هيرو صفحة المشروعات",
          description:
            "تحكّم في إعدادات عرض هيرو صفحة المشروعات. بيانات المشروعات نفسها تُدار من قسم إدارة المشروعات.",
          backHref: "/admin/pages-blocks/pages/36",
          backLabel: "الرجوع لصفحة المشروعات",
        }
      : editorKey === "projects-hub-featured"
        ? {
            eyebrow: "المشروعات المميزة",
            title: "المشروعات المميزة",
            description:
              "تحكّم في طريقة عرض قسم المشروعات المميزة. بيانات كل مشروع وحالة التمييز تُدار من قسم إدارة المشروعات.",
            backHref: "/admin/pages-blocks/pages/36",
            backLabel: "الرجوع لصفحة المشروعات",
          }
        : editorKey === "projects-hub-listing"
          ? {
              eyebrow: "قائمة المشروعات",
              title: "قائمة المشروعات",
              description:
                "تحكّم في العناصر الظاهرة داخل قائمة المشروعات. بيانات كل مشروع نفسها تُدار من قسم إدارة المشروعات.",
              backHref: "/admin/pages-blocks/blocks/content",
              backLabel: "الرجوع لبلوكات المحتوى",
            }
          : editorKey === "projects-hub-map"
            ? {
                eyebrow: "خريطة المشروعات",
                title: "خريطة المشروعات",
                description: "تحكّم في إعدادات عرض خريطة المشروعات وربطها بالمشروعات المسجّلة في النظام.",
                backHref: "/admin/pages-blocks/pages/36",
                backLabel: "الرجوع لصفحة المشروعات",
              }
            : null;

  const usesProjectsHubHeader = Boolean(projectsHubHeader);
  const isHomeStory = editorKey === "home-story";
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
  const usesLockedInternalSlug =
    usesHomeModuleChrome || usesAboutStructuredChrome;
  const hubStatus = statusMeta(block.status);
  const homeStoryConfig = isHomeStory ? (config as ReturnType<typeof asAboutIntroConfig>) : null;
  const homeContactConfig = isHomeContact ? (config as ReturnType<typeof asAboutCtaConfig>) : null;

  const settingsTab = {
    id: "settings",
    label: "الإعدادات",
    content: (
      <section className="max-w-xl space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">
            {usesAboutStructuredChrome ? "اسم الموديول" : "الاسم"}
          </span>
          <input name="name" defaultValue={block.name} required className={fieldClassName()} />
        </label>
        {usesLockedInternalSlug ? (
          <div className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">المعرّف التقني</span>
            <input type="hidden" name="slug" value={block.slug} />
            <div
              dir="ltr"
              className="w-full cursor-default select-text rounded-2xl border border-white/8 bg-[#05070B]/90 px-4 py-3 font-en text-sm text-white/80"
            >
              {block.slug}
            </div>
            <p className="text-xs leading-6 text-white/45">
              المعرّف التقني للموديول — للقراءة فقط.
            </p>
          </div>
        ) : (
          <label className="block space-y-2">
            <span className="text-xs font-semibold text-white/55">المعرّف التقني</span>
            <input name="slug" defaultValue={block.slug} required dir="ltr" className={fieldClassName()} />
          </label>
        )}
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
  };

  const pagesTab = {
    id: "pages",
    label: usesHomeModuleChrome ? "الظهور في الصفحات" : "يظهر في الصفحات",
    content: (
      <ModulePageAssignmentsField pages={assignmentContext.pages} assignedPageIds={assignedPageIds} />
    ),
  };

  const homeStoryTabs = homeStoryConfig
    ? [
        {
          id: "text",
          label: "النص",
          content: <AboutIntroModuleEditor config={homeStoryConfig} editorMode="home-story" section="text" />,
        },
        {
          id: "images",
          label: "الصور",
          content: <AboutIntroModuleEditor config={homeStoryConfig} editorMode="home-story" section="images" />,
        },
        {
          id: "cta",
          label: "الزر والرابط",
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
          label: "النص",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="text" />,
        },
        {
          id: "image",
          label: "الصورة",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="image" />,
        },
        {
          id: "cta",
          label: "الزر والرابط",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="cta" />,
        },
        {
          id: "contacts",
          label: "وسائل التواصل",
          content: <AboutCtaModuleEditor config={homeContactConfig} editorMode="home-contact" section="contacts" />,
        },
        pagesTab,
        settingsTab,
      ]
    : [];

  return (
    <div className={`space-y-6 ${usesUnifiedModuleChrome ? "pb-28" : "pb-10"}`} dir="rtl">
      {isAboutIntro ? (
        <AdminPageContextHeader
          eyebrow="موديول محتوى"
          title="من نحن — المقدمة"
          description="تحكّم في نصوص وصور وبطاقات قسم من نحن في صفحة من نحن. التغييرات تنعكس على العرض العام بعد الحفظ."
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
        <AdminPageContextHeader
          eyebrow="موديول محتوى"
          title="من نحن — محتوى وصورة واحدة"
          description="تحكّم في نص ومحتوى وصورة واحدة لقسم من نحن، مع اختيار موضع الصورة يمين أو شمال على سطح المكتب."
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
        <AdminPageContextHeader
          eyebrow="موديول الرؤية والأهداف"
          title="الرؤية والأهداف"
          description="تحكّم في نصوص وصورة قسم الرؤية والأهداف. التغييرات تنعكس على العرض العام بعد الحفظ."
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
        <AdminPageContextHeader
          eyebrow="موديول دعوة للتواصل"
          title={block.name}
          description={description}
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
        <AdminPageContextHeader
          eyebrow="موديول المبادئ"
          title={block.name}
          description={description}
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
        <AdminPageContextHeader
          eyebrow="موديول المنهج"
          title={block.name}
          description={description}
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
        <AdminPageContextHeader
          eyebrow="موديول القصة — الرئيسية"
          title={block.name}
          description="تحكّم في نصوص وصور وزر قسم القصة في الصفحة الرئيسية. كل التغييرات هنا تنعكس على العرض العام بعد الحفظ."
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
        <AdminPageContextHeader
          eyebrow="موديول التواصل — الرئيسية"
          title={block.name}
          description="تحكّم في نصوص وصورة وزر ووسائل التواصل داخل قسم التواصل في الصفحة الرئيسية. كل التغييرات تنعكس على العرض العام بعد الحفظ."
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
        <AdminPageContextHeader
          eyebrow="موديول المشروعات — الرئيسية"
          title={block.name}
          description="تحكّم في نصوص وعرض قسم مشروعات فينيسيا في الصفحة الرئيسية. بيانات المشروعات نفسها تُدار من إدارة المشروعات."
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
        <AdminPageContextHeader
          eyebrow="موديول الثقة — الرئيسية"
          title={block.name}
          description="تحكّم في نصوص وبطاقات قسم الثقة في الصفحة الرئيسية. كل التغييرات هنا تنعكس على العرض العام بعد الحفظ."
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
      ) : projectsHubHeader ? (
        <AdminPageContextHeader
          eyebrow={projectsHubHeader.eyebrow}
          title={projectsHubHeader.title}
          description={projectsHubHeader.description}
          meta={hubStatus.label}
          actions={
            <>
              <AdminActionButton href="/admin/projects" variant="dark">
                إدارة بيانات المشروعات
              </AdminActionButton>
              <AdminActionButton href="/projects" variant="dark">
                معاينة صفحة المشروعات
              </AdminActionButton>
              <AdminActionButton href={projectsHubHeader.backHref} variant="ghost">
                {projectsHubHeader.backLabel}
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

      {isAboutIntro && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول من نحن — المقدمة بنجاح." />
      ) : null}

      {isAboutIntroSingleImage && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول المحتوى والصورة الواحدة بنجاح." />
      ) : null}

      {isVisionGoals && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول الرؤية والأهداف بنجاح." />
      ) : null}

      {isAboutCta && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول الدعوة للتواصل بنجاح." />
      ) : null}

      {isAboutPrinciples && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول المبادئ بنجاح." />
      ) : null}

      {isAboutApproach && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول المنهج بنجاح." />
      ) : null}

      {isHomeStory && saved ? (
        <AdminNotice variant="success" message="تم حفظ الموديول وتحديث الصفحة الرئيسية بنجاح." />
      ) : null}

      {isHomeContact && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول التواصل وتحديث الصفحة الرئيسية بنجاح." />
      ) : null}

      {isHomeProjects && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول المشاريع وتحديث الصفحة الرئيسية بنجاح." />
      ) : null}

      {isHomeTrust && saved ? (
        <AdminNotice variant="success" message="تم حفظ موديول الثقة وتحديث الصفحة الرئيسية بنجاح." />
      ) : null}

      {usesProjectsHubHeader && saved ? (
        <AdminNotice variant="success" message="تم حفظ الموديول بنجاح." />
      ) : null}

      <ModuleCrossPageUsageBanner moduleName={block.name} assignments={assignmentContext.assignments} />
      {usesUnifiedModuleChrome || usesProjectsHubHeader ? null : (
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
        {editorKey === "projects-hub-featured" ? (
          <input type="hidden" name="config_schema" value="projects-hub-featured" />
        ) : null}
        {editorKey === "projects-hub-listing" ? (
          <input type="hidden" name="config_schema" value="projects-hub-listing" />
        ) : null}
        {editorKey === "projects-hub-map" ? <input type="hidden" name="config_schema" value="projects-hub-map" /> : null}

        {isHomeStory ? (
          <AdminModuleTabs nowrap tabs={homeStoryTabs} />
        ) : isHomeContact ? (
          <AdminModuleTabs nowrap tabs={homeContactTabs} />
        ) : (
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
                  ) : isAboutIntroSingleImage ? (
                    <AboutIntroSingleImageModuleEditor
                      config={config as ReturnType<typeof asAboutIntroSingleImageConfig>}
                    />
                  ) : editorKey === "vision-goals" ? (
                    <VisionGoalsModuleEditor config={config as ReturnType<typeof asVisionGoalsConfig>} />
                  ) : editorKey === "about-cta" ? (
                    <AboutCtaModuleEditor
                      config={config as ReturnType<typeof asAboutCtaConfig>}
                      editorMode="about-cta"
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
              { ...settingsTab, id: "meta", label: "الإعدادات" },
              { ...pagesTab, id: "pages", label: "يظهر في الصفحات" },
            ]}
          />
        )}

        {isAboutIntro || isAboutIntroSingleImage || isVisionGoals || isAboutCta || isAboutPrinciples || isAboutApproach ? (
          <StickyModuleSaveDock
            title="حفظ التعديلات"
            description="يُحدَّث العرض العام بعد اكتمال الحفظ."
            saveLabel="حفظ التعديلات"
          />
        ) : isHomeStory ? (
          <StickyModuleSaveDock
            title="حفظ موديول القصة"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeContact ? (
          <StickyModuleSaveDock
            title="حفظ موديول التواصل"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeProjects ? (
          <StickyModuleSaveDock
            title="حفظ موديول المشروعات"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : isHomeTrust ? (
          <StickyModuleSaveDock
            title="حفظ موديول الثقة"
            description="يُحدَّث العرض العام للصفحة الرئيسية بعد اكتمال الحفظ."
          />
        ) : (
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="cursor-pointer rounded-2xl bg-[#D8B87A] px-6 py-3 text-sm font-bold text-[#06101C] hover:bg-[#e5c98d]"
            >
              حفظ الموديول
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
