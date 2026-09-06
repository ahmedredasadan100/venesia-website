import AdminMediaImageField from "../../../media/AdminMediaImageField";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "../../../ui/AdminFormRuntime";

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
  const fieldErrors = useOptionalAdminFormRuntime()?.fieldErrors ?? {};
  const hasError = (name: string) => Boolean(fieldErrors[name]?.length);

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
          id="video_url"
          name="video_url"
          type="url"
          defaultValue={defaultVideoUrl ?? ""}
          aria-invalid={hasError("video_url") || undefined}
          aria-describedby={
            hasError("video_url") ? "video_url-error" : undefined
          }
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
        <p className="mt-2 text-xs text-white/40">يُقبل رابط watch أو youtu.be أو embed. مطلوب عند النشر.</p>
        <AdminFormError name="video_url" className="mt-2" />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white/70">المدة (اختياري)</span>
        <input
          id="video_duration"
          name="video_duration"
          defaultValue={defaultDuration ?? ""}
          aria-invalid={hasError("video_duration") || undefined}
          aria-describedby={
            hasError("video_duration") ? "video_duration-error" : undefined
          }
          placeholder="مثل: 3:45"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
        />
        <AdminFormError name="video_duration" className="mt-2" />
      </label>

      <div id="video_thumbnail" className="scroll-mt-24">
        <AdminMediaImageField
          name="video_thumbnail"
          label="صورة مصغّرة (اختياري)"
          defaultValue={defaultThumbnail ?? ""}
          browseFolder="images/topics"
          dimensionHint="content"
          helperText="إن تُركت فارغة تُستخدم الصورة الرئيسية للغلاف."
          focusTargetId="video_thumbnail_control"
          ariaInvalid={hasError("video_thumbnail")}
          ariaDescribedBy={
            hasError("video_thumbnail")
              ? "video_thumbnail-error"
              : undefined
          }
        />
        <AdminFormError name="video_thumbnail" className="mt-2" />
      </div>
    </div>
  );
}
