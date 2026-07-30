"use client";

import { useCallback, useState, type ReactNode } from "react";

import AdminRichTextEditor from "../../../components/admin/AdminRichTextEditor";
import AdminMediaImageField from "../../../components/admin/media/AdminMediaImageField";
import AdminModuleTabs from "../../../components/admin/page-blocks/AdminModuleTabs";
import ProjectLocationEditor from "../../../components/admin/projects/entry/ProjectLocationEditor";
import {
  ProjectDeliveryItemsEditor,
  ProjectFeaturesEditor,
  ProjectFloorPlansEditor,
  ProjectLocationPointsEditor,
  RepeaterSection,
} from "../../../components/admin/projects/entry/ProjectRepeaters";
import {
  ProjectImageCollectionEditor,
  ProjectVideoCollectionEditor,
} from "../../../components/admin/projects/entry/ProjectMediaEditors";
import ProjectSeoPanel from "../../../components/admin/projects/entry/ProjectSeoPanel";
import {
  AdminFormActions,
  AdminFormError,
  AdminFormField,
  AdminFormListboxSelect,
  AdminFormRuntime,
  AdminFormSection,
  AdminSlugField,
  adminFormFieldClassName,
} from "../../../components/admin/ui";
import {
  PROJECT_ENTRY_FIELD_TABS,
  PROJECT_ENTRY_NAVIGATION_EVENT,
  PROJECT_ENTRY_TAB_IDS,
  type ProjectEntryBundle,
} from "../../../lib/admin/projects/project-entry-contract";
import { useAdminEntityListInvalidation } from "../../../lib/admin/entity-list/data-engine/client-controller";
import type {
  AdminFormActionState,
  AdminFormNavigationContract,
} from "../../../lib/admin/form-runtime";
import {
  saveProjectEntry,
  type ProjectEntrySaveResult,
} from "./project-actions/save-entry";

const fieldClass = adminFormFieldClassName(
  "rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-[#D8B87A]/15 disabled:cursor-not-allowed disabled:opacity-55",
);

const PROJECT_TYPE_OPTIONS = [
  { value: "residential", label: "سكني" },
  { value: "commercial", label: "تجاري" },
] as const;

const PROJECT_ENTRY_FOCUS_TARGETS: Record<string, string> = {
  image: "image-field",
  hero_image: "hero_image-field",
  small_box_image: "small_box_image-field",
  overview_main_image: "overview_main_image-field",
  overview_body: "overview_body-editor",
  delivery_body: "delivery_body-editor",
  seo_title: "project-seo-title",
  seo_description: "project-seo-description",
  focus_keyword: "project-focus-keyword",
  seo_keywords: "project-seo-keywords",
  canonical_url: "project-canonical-url",
  robots_index: "project-robots-index",
  robots_follow: "project-robots-follow",
  og_image: "project-og-image",
  og_image_alt: "project-og-image-alt",
};

const PROJECT_ENTRY_NAVIGATION: AdminFormNavigationContract = {
  eventName: PROJECT_ENTRY_NAVIGATION_EVENT,
  fields: Object.fromEntries(
    Object.entries(PROJECT_ENTRY_FIELD_TABS).map(([field, tabId]) => [
      field,
      { tabId, targetId: PROJECT_ENTRY_FOCUS_TARGETS[field] ?? field },
    ]),
  ),
};

function SectionCard({
  number,
  title,
  description,
  children,
}: {
  number?: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <AdminFormSection
      title={
        <>
          {number ? <span className="ms-2 text-[#D8B87A]">{number}.</span> : null}
          {title}
        </>
      }
      description={description}
    >
      {children}
    </AdminFormSection>
  );
}

function Field({
  name,
  label,
  required = false,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <AdminFormField
      label={label}
      required={required}
    >
      {children}
      <AdminFormError name={name} className="mt-2" />
    </AdminFormField>
  );
}

function CharacterTextarea({
  id,
  name,
  defaultValue,
  maxLength,
  rows,
  placeholder,
}: {
  id: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  rows: number;
  placeholder?: string;
}) {
  const [count, setCount] = useState(defaultValue.length);
  return (
    <>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        rows={rows}
        onInput={(event) => setCount(event.currentTarget.value.length)}
        placeholder={placeholder}
        className={`${fieldClass} resize-y leading-7`}
      />
      <span className="block text-left font-mono text-xs font-normal text-white/35" dir="ltr">
        {count} / {maxLength}
      </span>
    </>
  );
}

function ImageWithAlt({
  imageName,
  altName,
  label,
  value,
  alt,
  dimensionHint = "content",
  previewLoading,
}: {
  imageName: string;
  altName: string;
  label: string;
  value: string;
  alt: string;
  dimensionHint?: "hero" | "content";
  previewLoading?: "lazy" | "eager";
}) {
  return (
    <div id={`${imageName}-field`} className="min-w-0 scroll-mt-28 rounded-2xl border border-white/10 bg-black/20 p-4">
      <AdminMediaImageField
        name={imageName}
        label={label}
        defaultValue={value}
        browseFolder="images/projects"
        dimensionHint={dimensionHint}
        previewLoading={previewLoading}
      />
      <label htmlFor={altName} className="mt-4 block text-xs font-semibold text-white/55">
        النص البديل للصورة <span className="text-red-300">*</span>
        <input id={altName} name={altName} defaultValue={alt} className={`${fieldClass} mt-1`} />
        <AdminFormError name={altName} />
      </label>
      <AdminFormError name={imageName} />
    </div>
  );
}

function BasicTab({ bundle, mode }: { bundle: ProjectEntryBundle; mode: "create" | "edit" }) {
  const project = bundle.project;
  const [slug, setSlug] = useState(project.slug);
  return (
    <div className="space-y-4">
      <SectionCard number={1} title="بيانات المشروع الأساسية">
        <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <Field name="arabic_name" label="اسم المشروع بالعربية" required>
              <input id="arabic_name" name="arabic_name" defaultValue={project.arabic_name} className={fieldClass} />
            </Field>
            <Field name="english_name" label="اسم المشروع بالإنجليزية" required>
              <input id="english_name" name="english_name" defaultValue={project.english_name} dir="ltr" className={fieldClass} />
            </Field>
            <div id="project-slug">
              <AdminSlugField
                id="slug"
                sourceInputName="english_name"
                value={slug}
                onChange={setSlug}
              />
              <AdminFormError name="slug" />
            </div>
            <div>
              {mode === "create" ? (
                <div>
                  <AdminFormListboxSelect
                    id="project-type"
                    focusTargetId="type"
                    name="type"
                    label="نوع المشروع"
                    options={PROJECT_TYPE_OPTIONS}
                    defaultValue={project.type}
                    placeholder="اختر نوع المشروع"
                    required
                  />
                  <AdminFormError name="type" className="mt-2" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-white/70">نوع المشروع</span>
                  <input type="hidden" name="type" value={project.type} />
                  <div id="type" className={`${fieldClass} flex items-center bg-white/[0.035] text-white/60`} aria-readonly="true">
                    {project.type === "residential" ? "سكني" : "تجاري"}
                  </div>
                  <p className="text-xs font-normal text-white/38">يُحدد النوع عند الإنشاء ويصبح للقراءة فقط بعد الحفظ.</p>
                </div>
              )}
            </div>
          </div>
          <Field name="general_description" label="الوصف العام للمشروع" required>
            <CharacterTextarea id="general_description" name="general_description" defaultValue={project.general_description} maxLength={1000} rows={12} placeholder="وصف المشروع في البطاقات والنوافذ المنبثقة." />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number={2} title="إعدادات الهيرو" description="كل موضع يملك صورة واحدة ومصدرًا واحدًا من مكتبة الوسائط مع نص بديل مستقل.">
        <div className="grid gap-4 xl:grid-cols-3">
          <ImageWithAlt imageName="hero_image" altName="hero_image_alt" label="صورة الهيرو الرئيسية" value={project.hero_image} alt={project.hero_image_alt} dimensionHint="hero" previewLoading="eager" />
          <ImageWithAlt imageName="small_box_image" altName="small_box_image_alt" label="صورة البوكس الصغير" value={project.small_box_image} alt={project.small_box_image_alt} />
          <ImageWithAlt imageName="image" altName="image_alt" label="صورة الكارت الخارجية" value={project.image} alt={project.image_alt} />
        </div>
        <div className="mt-5">
          <Field name="short_description" label="وصف الهيرو والبوكس الصغير" required>
            <CharacterTextarea id="short_description" name="short_description" defaultValue={project.short_description} maxLength={500} rows={3} placeholder="وصف مختصر وواضح لمنطقة الهيرو." />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

function OverviewTab({ bundle }: { bundle: ProjectEntryBundle }) {
  const project = bundle.project;
  const [mediaType, setMediaType] = useState(project.overview_media_type);
  return (
    <div className="space-y-4">
      <SectionCard number={1} title="نظرة عامة عن المشروع">
        <div className="space-y-4">
          <Field name="overview_title" label="عنوان القسم" required>
            <input id="overview_title" name="overview_title" defaultValue={project.overview_title} className={fieldClass} />
          </Field>
          <div id="overview_body" className="scroll-mt-28">
            <AdminRichTextEditor name="overview_body" label="النص التعريفي" defaultValue={project.overview_body} minHeight={240} />
          </div>
        </div>
      </SectionCard>

      <RepeaterSection title="مميزات المشروع" description="رتب المميزات بالسحب أو أزرار الحركة؛ يُحذف السجل فقط بعد التأكيد والحفظ.">
        <ProjectFeaturesEditor initialItems={bundle.features} />
      </RepeaterSection>

      <SectionCard number={3} title="وسائط النظرة العامة">
        <div className="mb-4 flex flex-wrap gap-3" role="radiogroup" aria-label="نوع الوسيط الرئيسي">
          {(["image", "video"] as const).map((value) => (
            <label key={value} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition ${mediaType === value ? "border-[#D8B87A]/45 bg-[#D8B87A]/12 text-[#F2D99B]" : "border-white/10 bg-black/20 text-white/55 hover:border-[#D8B87A]/25 hover:text-white/75"}`}>
              <input type="radio" name="overview_media_type" value={value} checked={mediaType === value} onChange={() => setMediaType(value)} className="ms-2 accent-[#b98724]" />
              {value === "image" ? "صورة رئيسية" : "فيديو رئيسي"}
            </label>
          ))}
        </div>
        <div className={mediaType === "image" ? "block" : "hidden"} aria-hidden={mediaType !== "image"}>
          <ImageWithAlt imageName="overview_main_image" altName="overview_main_image_alt" label="الصورة الرئيسية للنظرة العامة" value={project.overview_main_image} alt={project.overview_main_image_alt} dimensionHint="hero" />
        </div>
        <div className={mediaType === "video" ? "block" : "hidden"} aria-hidden={mediaType !== "video"}>
          <ProjectVideoCollectionEditor section="overview" initialItems={bundle.videos} maxItems={1} />
        </div>
        <div className="mt-5 border-t border-white/10 pt-5">
          <h3 className="mb-3 text-sm font-bold text-white/80">صور داعمة</h3>
          <ProjectImageCollectionEditor section="overview" initialItems={bundle.media} addLabel="إضافة صورة داعمة" />
        </div>
      </SectionCard>
    </div>
  );
}

function DeliveryTab({ bundle }: { bundle: ProjectEntryBundle }) {
  const project = bundle.project;
  return (
    <div className="space-y-4">
      <SectionCard number={1} title="مواصفات التنفيذ والتسليم">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.36fr)_minmax(0,1fr)]">
          <Field name="delivery_title" label="عنوان القسم" required>
            <input id="delivery_title" name="delivery_title" defaultValue={project.delivery_title} className={fieldClass} />
          </Field>
          <div id="delivery_body" className="scroll-mt-28">
            <AdminRichTextEditor name="delivery_body" label="النص التعريفي" defaultValue={project.delivery_body} minHeight={220} />
          </div>
        </div>
      </SectionCard>
      <RepeaterSection title="بنود المواصفات" description="بنود مرتبة تُحفظ داخل بيانات المشروع المجمعة نفسها.">
        <ProjectDeliveryItemsEditor initialItems={bundle.delivery_items} />
      </RepeaterSection>
      <RepeaterSection title="صور المواصفات والتسليم">
        <ProjectImageCollectionEditor section="delivery" initialItems={bundle.media} addLabel="إضافة صورة مواصفات" />
      </RepeaterSection>
    </div>
  );
}

export default function ProjectEditForm({ bundle: initialBundle }: { bundle: ProjectEntryBundle }) {
  const [{ bundle, generation }, setFormSnapshot] = useState(() => ({
    bundle: initialBundle,
    generation: 0,
  }));
  const invalidateProjectsList = useAdminEntityListInvalidation("projects");
  const mode = bundle.project.id === null ? "create" : "edit";
  const closeHref = bundle.project.type === "commercial"
    ? "/admin/projects/commercial"
    : "/admin/projects/residential";
  const handleSaveSuccess = useCallback(
    (state: AdminFormActionState<ProjectEntrySaveResult>) => {
      void invalidateProjectsList();
      if (state.mode !== "edit") return;

      const reconciledBundle = state.result?.reconciledBundle;
      if (
        !reconciledBundle ||
        reconciledBundle.project.id !== state.entityId
      ) {
        window.location.reload();
        return;
      }

      setFormSnapshot((current) => ({
        bundle: reconciledBundle,
        generation: current.generation + 1,
      }));
    },
    [invalidateProjectsList],
  );

  const tabs = [
    { id: PROJECT_ENTRY_TAB_IDS.basic, label: "البيانات الأساسية", content: <BasicTab bundle={bundle} mode={mode} /> },
    {
      id: PROJECT_ENTRY_TAB_IDS.location,
      label: "الموقع",
      content: (
        <div className="space-y-4">
          <SectionCard number={1} title="بيانات الموقع الأساسية"><ProjectLocationEditor project={bundle.project} locations={bundle.locations} schemaReady={bundle.schemaReady} schemaMessage={bundle.schemaMessage} /></SectionCard>
          <RepeaterSection title="ما حول المشروع" description="وسائل النقل والمحاور والمعالم القريبة، مع ترتيب مستقل لكل مجموعة."><ProjectLocationPointsEditor initialItems={bundle.location_points} /></RepeaterSection>
        </div>
      ),
    },
    { id: PROJECT_ENTRY_TAB_IDS.overview, label: "نظرة عامة", content: <OverviewTab bundle={bundle} /> },
    {
      id: PROJECT_ENTRY_TAB_IDS.plans,
      label: "المساحات والمخططات",
      content: <RepeaterSection title="المساحات والمخططات" description="أضف المخططات ورتبها، مع صور المعماري والفرش وتفاصيل ثابتة الهوية."><ProjectFloorPlansEditor initialPlans={bundle.floor_plans} /></RepeaterSection>,
    },
    { id: PROJECT_ENTRY_TAB_IDS.delivery, label: "مواصفات التنفيذ والتسليم", content: <DeliveryTab bundle={bundle} /> },
    {
      id: PROJECT_ENTRY_TAB_IDS.media,
      label: "الصور والفيديو",
      content: (
        <div className="space-y-4">
          <RepeaterSection title="معرض الصور"><ProjectImageCollectionEditor section="gallery" initialItems={bundle.media} addLabel="إضافة صورة للمعرض" /></RepeaterSection>
          <RepeaterSection title="معرض الفيديو"><ProjectVideoCollectionEditor section="gallery" initialItems={bundle.videos} /></RepeaterSection>
        </div>
      ),
    },
    { id: PROJECT_ENTRY_TAB_IDS.seo, label: "تحسين محركات البحث", content: <ProjectSeoPanel project={bundle.project} /> },
  ];

  return (
    <AdminFormRuntime
      key={`${bundle.project.id ?? `${bundle.project.type}-new`}:${generation}`}
      action={saveProjectEntry}
      mode={mode}
      entityKey="project-entry"
      closeHref={closeHref}
      onSuccess={handleSaveSuccess}
      navigation={PROJECT_ENTRY_NAVIGATION}
      formId={mode === "create" ? "project-create-form" : "project-edit-form"}
      className="space-y-5"
    >
      {bundle.project.id ? <input type="hidden" name="id" value={bundle.project.id} /> : null}
      {!bundle.schemaReady ? (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-100/85" role="alert">
          <strong className="block text-amber-100">مخطط إدخال بيانات المشاريع غير مطبق في قاعدة البيانات الحالية.</strong>
          <span>{bundle.schemaMessage ?? "يمكن مراجعة الواجهة، لكن الحفظ سيفشل مغلقًا حتى تطبيق الترحيل المعتمد لاحقًا."}</span>
        </div>
      ) : null}
      <div className="min-w-0 w-full">
        <AdminModuleTabs tabs={tabs} variant="segmented" navigationEventName={PROJECT_ENTRY_NAVIGATION_EVENT} ariaLabel="أقسام بيانات المشروع" />
      </div>
      <AdminFormError />
      <AdminFormActions submitLabel={mode === "create" ? "إنشاء المشروع" : "حفظ التغييرات"} closeLabel="إغلاق" title={mode === "create" ? "إنشاء المشروع" : "حفظ التغييرات"} description="يحفظ المشروع وجميع العناصر التابعة كعملية ذرية واحدة." />
    </AdminFormRuntime>
  );
}
