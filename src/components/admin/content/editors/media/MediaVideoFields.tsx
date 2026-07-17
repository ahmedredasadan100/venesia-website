import AdminMediaImageField from "../../../media/AdminMediaImageField";

type MediaVideoFieldsProps = {
  defaultVideoUrl?: string | null;
  defaultDuration?: string | null;
  defaultThumbnail?: string | null;
};

export default function MediaVideoFields({
  defaultVideoUrl = "",
  defaultDuration = "",
  defaultThumbnail = "",
}: MediaVideoFieldsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <input type="hidden" name="video_provider" value="youtube" />

      <label className="block lg:col-span-2">
        <span className="text-sm font-medium text-white/70">مزود الفيديو</span>
        <input
          readOnly
          value="YouTube"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60 outline-none"
        />
      </label>

      <label className="block lg:col-span-2">
        <span className="text-sm font-medium text-white/70">رابط YouTube</span>
        <input
          name="video_url"
          type="url"
          defaultValue={defaultVideoUrl ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
        <p className="mt-2 text-xs text-white/40">يُقبل رابط watch أو youtu.be أو embed. مطلوب عند النشر.</p>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white/70">المدة (اختياري)</span>
        <input
          name="video_duration"
          defaultValue={defaultDuration ?? ""}
          placeholder="مثل: 3:45"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
      </label>

      <div>
        <AdminMediaImageField
          name="video_thumbnail"
          label="صورة مصغّرة (اختياري)"
          defaultValue={defaultThumbnail ?? ""}
          browseFolder="images/topics"
          dimensionHint="content"
          helperText="إن تُركت فارغة تُستخدم الصورة الرئيسية للغلاف."
        />
      </div>
    </div>
  );
}
