"use client";

import { type ReactNode, useState } from "react";
import AdminMediaFileField from "../../../components/admin/media/AdminMediaFileField";
import AdminMediaImageField from "../../../components/admin/media/AdminMediaImageField";
import AdminRichTextEditor from "../../../components/admin/AdminRichTextEditor";
import AdminFloorPlansEditor from "../../../components/admin/projects/AdminFloorPlansEditor";
import AdminMediaListField from "../../../components/admin/projects/AdminMediaListField";
import AdminStringListField from "../../../components/admin/projects/AdminStringListField";
import AdminModuleTabs from "../../../components/admin/page-blocks/AdminModuleTabs";
import { AdminActionButton, AdminCard } from "../../../components/admin/ui";
import { fieldClassName } from "../../../lib/page-blocks/admin-utils";
import type { ProjectEditBundle, ProjectRow } from "../../../lib/projects/types";
import { updateProject } from "./actions";

const inputClass = fieldClassName;

type ProjectEditFormProps = {
  bundle: ProjectEditBundle;
};

function HiddenBoolean({ name, checked }: { name: string; checked: boolean }) {
  return <input type="hidden" name={name} value={checked ? "true" : "false"} />;
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.02] px-5 py-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-white/45">{description}</p>
    </div>
  );
}

function BasicTabSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-[20px] border border-white/10 bg-[#080B10]/72 p-4">
      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        {description ? <p className="text-[11px] leading-5 text-white/38">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BasicFieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-semibold text-white/50">{children}</span>;
}

function PreservedLegacyFields({ project }: { project: ProjectRow }) {
  return <input type="hidden" name="map_area" value={project.map_area} />;
}

function VisibilityToggle({
  name,
  checked,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#05070B] px-3 py-2.5">
      <div className="min-w-0">
        <span className="block text-[13px] font-medium text-white/85">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-5 text-white/38">{description}</span>
      </div>
      <div className="flex shrink-0 items-center">
        <HiddenBoolean name={name} checked={checked} />
        <input
          type="checkbox"
          defaultChecked={checked}
          onChange={(event) => {
            const hidden = event.currentTarget.previousElementSibling as HTMLInputElement | null;
            if (hidden) hidden.value = event.currentTarget.checked ? "true" : "false";
          }}
          className="h-4 w-4 accent-[#D8B87A]"
        />
      </div>
    </label>
  );
}

function CompactSlugField({ project }: { project: ProjectRow }) {
  const [slug, setSlug] = useState(project.slug);
  const [showSlugEditor, setShowSlugEditor] = useState(false);

  return (
    <div className="space-y-1.5">
      <BasicFieldLabel>Slug</BasicFieldLabel>
      <input type="hidden" name="slug" value={slug} />
      <div className="flex min-h-[46px] items-center gap-2 rounded-xl border border-white/10 bg-[#05070B] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-en text-xs text-white/60" dir="ltr">
          /projects/{slug}
        </span>
        {!showSlugEditor ? (
          <button
            type="button"
            onClick={() => setShowSlugEditor(true)}
            className="shrink-0 cursor-pointer text-[11px] font-semibold text-[#D8B87A] hover:underline"
          >
            تعديل
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowSlugEditor(false);
              setSlug(project.slug);
            }}
            className="shrink-0 cursor-pointer text-[11px] text-white/45 hover:text-white"
          >
            إلغاء
          </button>
        )}
      </div>
      {showSlugEditor ? (
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value.trim().toLowerCase())}
          placeholder={project.code.toLowerCase()}
          dir="ltr"
          aria-label="Slug"
          className={inputClass("py-2 font-en text-sm")}
        />
      ) : null}
    </div>
  );
}

function ProjectBasicTopSection({ project }: { project: ProjectRow }) {
  return (
    <BasicTabSection title="هوية المشروع وبيانات البطاقة" description="الحقول الأساسية للمشروع في صفين مدمجين.">
      <div className="grid gap-3 lg:grid-cols-12">
        <label className="block space-y-1.5 lg:col-span-4">
          <BasicFieldLabel>Arabic Name</BasicFieldLabel>
          <input name="arabic_name" required defaultValue={project.arabic_name} className={inputClass()} />
        </label>
        <label className="block space-y-1.5 lg:col-span-4">
          <BasicFieldLabel>English Name</BasicFieldLabel>
          <input name="english_name" defaultValue={project.english_name} dir="ltr" className={inputClass("font-en")} />
        </label>
        <label className="block space-y-1.5 lg:col-span-2">
          <BasicFieldLabel>Project Code</BasicFieldLabel>
          <input name="code" required defaultValue={project.code} dir="ltr" className={inputClass("font-en")} />
        </label>
        <div className="lg:col-span-2">
          <CompactSlugField project={project} />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
        <label className="block space-y-1.5 lg:col-span-1">
          <BasicFieldLabel>Project Location</BasicFieldLabel>
          <input name="location_label" defaultValue={project.location_label} className={inputClass()} />
        </label>
        <label className="block space-y-1.5 lg:col-span-2">
          <BasicFieldLabel>Short Description</BasicFieldLabel>
          <textarea
            name="short_description"
            rows={3}
            defaultValue={project.short_description}
            className={inputClass("min-h-[92px] resize-y leading-6")}
          />
        </label>
      </div>
    </BasicTabSection>
  );
}

function ProjectBasicTab({ project }: { project: ProjectRow }) {
  return (
    <div className="space-y-4">
      <PreservedLegacyFields project={project} />

      <ProjectBasicTopSection project={project} />

      <BasicTabSection title="صور الهيرو والبطاقة" description="صورتان بأدوار مختلفة.">
        <div className="grid gap-4 md:grid-cols-2">
          <AdminMediaImageField
            name="image"
            label="Project Image"
            defaultValue={project.image}
            browseFolder="images/projects"
            dimensionHint="content"
            helperText="بطاقات المشروع، slider الرئيسية، والهيرو الداخلي."
          />
          <AdminMediaImageField
            name="hero_image"
            label="Hero Background"
            defaultValue={project.hero_image}
            dimensionHint="hero"
            browseFolder="images/projects"
            helperText="خلفية هيرو التفاصيل وصفحة المشاريع."
          />
        </div>
      </BasicTabSection>

      <BasicTabSection title="Brochure PDF" description="Optional project brochure for the download button on the public page.">
        <AdminMediaFileField
          name="brochure_url"
          label="Brochure PDF"
          defaultValue={project.brochure_url}
          browseFolder="files/projects"
          helperText="PDF only. Leave empty to hide the download button on the public site."
        />
      </BasicTabSection>

      <BasicTabSection title="إعدادات الظهور" description="أماكن ظهور المشروع في الموقع.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <VisibilityToggle
            name="show_on_homepage"
            checked={project.show_on_homepage}
            title="Show on Homepage"
            description="يظهر في slider الصفحة الرئيسية."
          />
          <VisibilityToggle
            name="featured"
            checked={project.featured}
            title="Featured Project"
            description="يظهر في قسم المشروع المميز."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block max-w-xs space-y-1.5">
            <BasicFieldLabel>Homepage Order</BasicFieldLabel>
            <input
              name="homepage_order"
              type="number"
              defaultValue={project.homepage_order}
              dir="ltr"
              className={inputClass("font-en")}
            />
            <p className="text-[10px] text-white/35">رقم أقل = ظهور أبكر.</p>
          </label>
          <label className="block max-w-sm space-y-1.5">
            <BasicFieldLabel>Publication Status</BasicFieldLabel>
            <select name="publication_status" defaultValue={project.publication_status} className={inputClass()}>
              <option value="published">منشور</option>
              <option value="unpublished">مخفي</option>
              <option value="draft">مسودة</option>
              <option value="archived">أرشيف</option>
            </select>
          </label>
        </div>
      </BasicTabSection>
    </div>
  );
}

export default function ProjectEditForm({ bundle }: ProjectEditFormProps) {
  const { project, floorPlans, deliverySpecItems, media } = bundle;
  const overviewMedia = media
    .filter((item) => item.collection === "overview")
    .map((item) => ({ image: item.image, label: item.label }));
  const deliveryMedia = media
    .filter((item) => item.collection === "delivery_specs")
    .map((item) => ({ image: item.image, label: item.label }));
  const galleryMedia = media
    .filter((item) => item.collection === "gallery")
    .map((item) => ({ image: item.image, label: item.label }));

  const listPath = project.type === "residential" ? "/admin/projects/residential" : "/admin/projects/commercial";

  const tabs = [
    {
      id: "basic",
      label: "البيانات الأساسية",
      content: <ProjectBasicTab project={project} />,
    },
    {
      id: "district",
      label: "عن الموقع",
      content: (
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-white/70">عنوان القسم</span>
            <input name="district_title" defaultValue={project.district_title ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white/70">النص التعريفي</span>
            <input name="district_subtitle" defaultValue={project.district_subtitle ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <AdminRichTextEditor
            name="district_body"
            label="وصف القسم"
            defaultValue={project.district_body ?? ""}
            placeholder="اكتب وصفًا تفصيليًا عن الموقع والحي..."
            minHeight={260}
          />
          <AdminStringListField
            name="district_bullets"
            label="المميزات"
            defaultItems={project.district_bullets}
            placeholder="ميزة عن الموقع"
            addLabel="إضافة ميزة"
            emptyHint="لا توجد مميزات — سيتم حفظ قائمة فارغة."
          />
          <AdminMediaImageField name="district_image" label="صورة الخريطة" defaultValue={project.district_image ?? ""} browseFolder="images/projects" />
        </div>
      ),
    },
    {
      id: "overview",
      label: "نظرة عامة",
      content: (
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-white/70">عنوان القسم</span>
            <input name="overview_title" defaultValue={project.overview_title ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <AdminRichTextEditor
            name="overview_body"
            label="وصف المشروع"
            defaultValue={project.overview_body ?? ""}
            placeholder="اكتب لمحة عن المشروع والمبنى..."
            minHeight={260}
          />
          <AdminStringListField
            name="overview_bullets"
            label="مميزات المشروع"
            defaultItems={project.overview_bullets}
            placeholder="ميزة عن المشروع"
            addLabel="إضافة ميزة"
          />
          <AdminMediaImageField
            name="overview_video_image"
            label="صورة المشروع / صورة الفيديو"
            defaultValue={project.overview_video_image ?? ""}
            browseFolder="images/projects"
          />
          <input type="hidden" name="overview_media_section" value="1" />
          <AdminMediaListField
            imageName="overview_media_image"
            labelName="overview_media_label"
            title="صور إضافية للنظرة العامة"
            defaultItems={overviewMedia}
            addLabel="إضافة صورة"
          />
        </div>
      ),
    },
    {
      id: "plans",
      label: "المساحات والمخططات",
      content: (
        <>
          <input type="hidden" name="floor_plans_section" value="1" />
          <AdminFloorPlansEditor defaultPlans={floorPlans} />
        </>
      ),
    },
    {
      id: "delivery",
      label: "مواصفات التنفيذ والتسليم",
      content: (
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-white/70">عنوان القسم</span>
            <input name="delivery_specs_title" defaultValue={project.delivery_specs_title ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <AdminRichTextEditor
            name="delivery_specs_subtitle"
            label="النص التعريفي"
            defaultValue={project.delivery_specs_subtitle ?? ""}
            placeholder="اكتب المقدمة الرئيسية لمواصفات التنفيذ والتسليم..."
            minHeight={220}
          />
          <input type="hidden" name="delivery_spec_items_section" value="1" />
          <AdminStringListField
            name="delivery_spec_item"
            label="بنود المواصفات"
            defaultItems={deliverySpecItems.map((item) => item.body)}
            placeholder="بند مواصفة"
            addLabel="إضافة بند"
            emptyHint="لا توجد بنود — سيتم حفظ قائمة فارغة."
          />
          <input type="hidden" name="delivery_media_section" value="1" />
          <AdminMediaListField
            imageName="delivery_media_image"
            labelName="delivery_media_label"
            title="صور المواصفات والتسليم"
            defaultItems={deliveryMedia}
            addLabel="إضافة صورة"
          />
        </div>
      ),
    },
    {
      id: "execution",
      label: "رحلة التنفيذ",
      content: (
        <SectionIntro
          title="رحلة التنفيذ — Phase 2"
          description="رحلة التنفيذ لم تُنقل إلى CMS بعد. باقي بيانات المشروع تُعرض للزوار من Supabase."
        />
      ),
    },
    {
      id: "media",
      label: "الصور والوسائط",
      content: (
        <>
          <input type="hidden" name="gallery_media_section" value="1" />
          <AdminMediaListField
            imageName="gallery_media_image"
            labelName="gallery_media_label"
            title="معرض صور المشروع"
            defaultItems={galleryMedia}
            addLabel="إضافة صورة"
          />
        </>
      ),
    },
    {
      id: "seo",
      label: "SEO",
      content: (
        <div className="space-y-5">
          <SectionIntro
            title="SEO أساسي"
            description="إعدادات SEO الأساسية فقط — التحسين المتقدم سيأتي في مرحلة لاحقة."
          />
          <label className="block">
            <span className="text-sm font-medium text-white/70">SEO Title</span>
            <input name="seo_title" defaultValue={project.seo_title ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-white/70">SEO Description</span>
            <textarea name="seo_description" rows={4} defaultValue={project.seo_description ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <AdminStringListField
            name="seo_keywords"
            label="SEO Keywords"
            defaultItems={project.seo_keywords}
            placeholder="كلمة مفتاحية"
            addLabel="إضافة كلمة"
          />
          <label className="block">
            <span className="text-sm font-medium text-white/70">Focus Keyword</span>
            <input name="focus_keyword" defaultValue={project.focus_keyword ?? ""} className={`${inputClass} mt-3`} />
          </label>
          <AdminMediaImageField name="og_image" label="OG Image" defaultValue={project.og_image ?? project.hero_image} browseFolder="images/projects" />
        </div>
      ),
    },
  ];

  return (
    <AdminCard className="p-6">
      <form action={updateProject} className="space-y-6">
        <input type="hidden" name="id" value={project.id} />
        <AdminModuleTabs tabs={tabs} />
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          <button type="submit" className="rounded-full bg-[#D8B87A] px-6 py-3 text-sm font-semibold text-[#06101C] transition hover:bg-[#e5c98d]">
            حفظ التعديلات
          </button>
          <AdminActionButton href={listPath} variant="dark">
            رجوع للقائمة
          </AdminActionButton>
          <AdminActionButton href={`/projects/${project.slug}`} variant="dark">
            النسخة العامة
          </AdminActionButton>
        </div>
      </form>
    </AdminCard>
  );
}
