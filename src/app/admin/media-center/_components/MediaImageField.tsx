"use client";

import AdminMediaImageField from "../../../../components/admin/media/AdminMediaImageField";

type MediaImageFieldProps = {
  defaultImage?: string | null;
  defaultAlt?: string | null;
};

export default function MediaImageField({ defaultImage = "", defaultAlt = "" }: MediaImageFieldProps) {
  return (
    <div className="space-y-4 lg:col-span-2">
      <AdminMediaImageField
        name="image"
        label="الصورة الرئيسية"
        defaultValue={defaultImage ?? ""}
        browseFolder="images/media-center"
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
    </div>
  );
}
