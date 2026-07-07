"use client";

import AdminMediaImageField from "../../../components/admin/media/AdminMediaImageField";
import AdminMediaAltWarning from "../../../components/admin/media-intelligence/AdminMediaAltWarning";

type TopicImageFieldProps = {
  defaultImage?: string | null;
  defaultAlt?: string | null;
  formId?: string;
};

export default function TopicImageField({ defaultImage = "", defaultAlt = "", formId }: TopicImageFieldProps) {
  return (
    <div className="space-y-4 lg:col-span-2">
      <AdminMediaImageField
        name="image"
        label="الصورة الرئيسية"
        defaultValue={defaultImage ?? ""}
        browseFolder="images/topics"
        dimensionHint="content"
        helperText="اختر صورة من المكتبة أو ارفع صورة جديدة — يتم حفظ المسار تلقائيًا."
      />

      <label className="block">
        <span className="text-sm font-medium text-white/70">وصف الصورة Alt Text</span>
        <input
          name="image_alt"
          defaultValue={defaultAlt ?? ""}
          placeholder="وصف مختصر للصورة يساعد SEO وإتاحة الوصول"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
      </label>

      {formId ? <AdminMediaAltWarning formId={formId} requiredForPublish /> : null}
    </div>
  );
}
