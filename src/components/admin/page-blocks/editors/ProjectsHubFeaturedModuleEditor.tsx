"use client";

import { fieldClassName } from "../../../../lib/page-blocks/admin-utils";
import {
  PROJECTS_HUB_FEATURED_SELECTION_MODES,
  type ProjectsHubFeaturedModuleConfig,
} from "../../../../lib/page-blocks/projects-hub-config";

type ProjectsHubFeaturedModuleEditorProps = {
  config: ProjectsHubFeaturedModuleConfig;
};

function VisibilityToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#05070B] px-4 py-3 text-sm text-white/70">
      <span>{label}</span>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
    </label>
  );
}

export default function ProjectsHubFeaturedModuleEditor({ config }: ProjectsHubFeaturedModuleEditorProps) {
  return (
    <div className="space-y-6">
      <input type="hidden" name="config_schema" value="projects-hub-featured" />

      <p className="text-sm leading-7 text-white/55">
        تحكّم في العناصر الظاهرة داخل قسم المشروعات المميزة. بيانات كل مشروع وحالة التمييز تُدار من قسم إدارة
        المشروعات.
      </p>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">عنوان قسم المشروعات المميزة</h2>
        <p className="text-xs leading-6 text-white/45">يتحكّم في عنوان القسم فقط، وليس في بيانات المشروعات.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle
            name="show_title"
            label="إظهار عنوان القسم"
            defaultChecked={config.showTitle !== false}
          />
          <VisibilityToggle
            name="show_subtitle"
            label="إظهار العنوان الفرعي"
            defaultChecked={config.showSubtitle !== false}
          />
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان</span>
          <input name="title" defaultValue={config.title} className={fieldClassName()} />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">العنوان الفرعي</span>
          <input name="subtitle" defaultValue={config.subtitle} className={fieldClassName()} />
        </label>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">البيانات الظاهرة داخل المشروع المميز</h2>
        <p className="text-xs leading-6 text-white/45">
          إظهار أو إخفاء الحقول المعروضة حالياً داخل البطاقة الرئيسية والبطاقات الجانبية. لا يغيّر قيم المشروع.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <VisibilityToggle
            name="show_project_image"
            label="إظهار صورة المشروع"
            defaultChecked={config.showProjectImage !== false}
          />
          <VisibilityToggle
            name="show_project_code"
            label="إظهار كود المشروع"
            defaultChecked={config.showProjectCode !== false}
          />
          <VisibilityToggle
            name="show_project_name"
            label="إظهار اسم المشروع"
            defaultChecked={config.showProjectName !== false}
          />
          <VisibilityToggle
            name="show_project_description"
            label="إظهار وصف المشروع"
            defaultChecked={config.showProjectDescription !== false}
          />
          <VisibilityToggle
            name="show_project_type"
            label="إظهار نوع المشروع"
            defaultChecked={config.showProjectType !== false}
          />
          <VisibilityToggle
            name="show_project_location"
            label="إظهار الموقع"
            defaultChecked={config.showProjectLocation !== false}
          />
          <VisibilityToggle
            name="show_explore_button"
            label="إظهار زر استكشف التفاصيل"
            defaultChecked={config.showExploreButton !== false}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-[30px] border border-white/10 bg-[#080B10]/72 p-5">
        <h2 className="text-sm font-semibold text-white">إعدادات عرض المشروعات المميزة</h2>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">قاعدة الاختيار</span>
          <select name="selection_mode" defaultValue={config.selectionMode} className={fieldClassName()} dir="ltr">
            {PROJECTS_HUB_FEATURED_SELECTION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode === "featured_flag" ? "المشروعات ذات featured = true" : mode}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs leading-6 text-white/45">
          الاختيار يعتمد على حقل featured في سجلات المشروعات — وليس اختياراً يدوياً من هذا المحرر.
        </p>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">الحد الأقصى (اختياري)</span>
          <input
            name="limit"
            type="number"
            min={1}
            max={48}
            defaultValue={config.limit ?? ""}
            placeholder="فارغ = بدون حد"
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-semibold text-white/55">التشغيل التلقائي (مللي ثانية)</span>
          <input
            name="autoplay_ms"
            type="number"
            min={1000}
            max={60000}
            step={500}
            defaultValue={config.autoplayMs}
            dir="ltr"
            className={fieldClassName()}
          />
        </label>

        <VisibilityToggle
          name="show_slider_dots"
          label="إظهار مؤشرات السلايدر"
          defaultChecked={config.showSliderDots !== false}
        />
      </section>
    </div>
  );
}
