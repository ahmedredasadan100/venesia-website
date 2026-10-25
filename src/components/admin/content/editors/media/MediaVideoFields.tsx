import { mediaContentSlot } from "../../../../../lib/media-center/detail-page-config";
import type { MediaSlotContract } from "../../../../../lib/media/media-slot-contract";
import {
  VIDEO_PROVIDERS,
  isVideoProvider,
  normalizeVideoStartSeconds,
  resolveVideoPlayback,
  type VideoProvider,
  type MetaVideoEmbedResult,
  type VideoMediaPayload,
} from "../../../../../lib/admin/media-topic-payload";
import { MediaVideoPlayback } from "../../../../media-center/MediaDetailArticle";
import AdminNotice from "../../../AdminNotice";
import AdminMediaImageField from "../../../media/AdminMediaImageField";
import {
  ADMIN_FORM,
  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
  adminChoiceButtonClassName,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../../../../lib/admin/admin-ui-styles";
import { AdminFormField } from "../../../ui/AdminForm";
import { AdminModuleSectionHeader, AdminModuleTabIcon } from "../../../ui/AdminModuleTabs";
import AdminCard from "../../../ui/AdminCard";
import AdminFormListboxSelect from "../../../ui/AdminFormListboxSelect";
import {
  AdminFormError,
  AdminFormGrid,
  useOptionalAdminFormRuntime,
} from "../../../ui/AdminFormRuntime";

type MediaVideoFieldsProps = {
  presentation?: "default" | "panel";
  defaultVideoUrl?: string | null;
  /** Live value belongs to the existing Content Editor model, including draft recovery. */
  videoUrl?: string;
  onVideoUrlChange?: (value: string) => void;
  videoProvider?: VideoProvider;
  onVideoProviderChange?: (value: VideoProvider) => void;
  videoStartSeconds?: string;
  onVideoStartSecondsChange?: (value: string) => void;
  videoThumbnail?: string;
  mainImage?: string;
  onVideoThumbnailChange?: (value: string) => void;
  defaultDuration?: string | null;
  defaultThumbnail?: string | null;
  requestMetaEmbed?: (payload: Pick<VideoMediaPayload, "provider" | "video_url">) => Promise<MetaVideoEmbedResult>;
  /** URL-only domains retain their native payload; provider playback is inferred by the existing resolver. */
  nativeBinding?: {
    urlId: string;
    urlErrorName: string;
    thumbnailName: string;
    thumbnailAltName: string;
    thumbnailAltId: string;
    thumbnailAltErrorName: string;
    thumbnailAlt: string;
    onThumbnailAltChange: (value: string) => void;
    browseFolder: string;
    mediaSlot: MediaSlotContract;
  };
};

export default function MediaVideoFields({
  presentation = "default",
  defaultVideoUrl = "",
  videoUrl,
  onVideoUrlChange,
  videoProvider = "youtube",
  onVideoProviderChange,
  videoStartSeconds = "",
  onVideoStartSecondsChange,
  videoThumbnail,
  mainImage = "",
  onVideoThumbnailChange,
  defaultDuration = "",
  defaultThumbnail = "",
  requestMetaEmbed,
  nativeBinding,
}: MediaVideoFieldsProps) {
  const formRuntime = useOptionalAdminFormRuntime();
  const fieldErrors = formRuntime?.fieldErrors ?? {};
  const hasError = (name: string) => Boolean(fieldErrors[name]?.length);
  const labelClassName = adminFormLabelClassName({ textInset: true });

  if (presentation === "panel") {
    const currentVideoUrl = videoUrl ?? defaultVideoUrl ?? "";
    const resolvedProvider = nativeBinding
      ? VIDEO_PROVIDERS.find((item) => resolveVideoPlayback({ provider: item.value, video_url: currentVideoUrl }))
      : VIDEO_PROVIDERS.find((item) => item.value === videoProvider);
    const provider = resolvedProvider ?? VIDEO_PROVIDERS[0];
    const urlErrorName = nativeBinding?.urlErrorName ?? "video_url";
    const urlId = nativeBinding?.urlId ?? "video_url";
    const urlValidationId = nativeBinding ? `${urlId}-validation` : "video_url-validation";
    const thumbnailName = nativeBinding?.thumbnailName ?? "video_thumbnail";
    const startSeconds = normalizeVideoStartSeconds(videoStartSeconds);
    const playback = startSeconds === null || !resolvedProvider ? null : resolveVideoPlayback({
      provider: provider.value,
      video_url: currentVideoUrl,
      start_seconds: startSeconds,
    });
    const previewState = !currentVideoUrl.trim()
      ? "empty"
      : playback
        ? "ready"
        : "invalid";
    const invalidVideoUrl = previewState === "invalid" && !nativeBinding;
    const invalidStartSeconds = startSeconds === null ||
      (!provider.supportsStartTime && startSeconds > 0);
    const videoUrlDescription = hasError(urlErrorName)
      ? `${urlErrorName}-error`
      : invalidVideoUrl
        ? urlValidationId
        : undefined;

    return (
      <div data-admin-media-video-presentation="panel">
        <AdminModuleSectionHeader
          id={nativeBinding ? `${urlId}-fields` : "content-video-fields"}
          sectionHeading="الفيديو والصورة المصغّرة"
          icon="media"
          sectionHeaderPresentation="premium"
          sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
        />
        {!nativeBinding ? <input type="hidden" name="video_duration" defaultValue={defaultDuration ?? ""} /> : null}

        <AdminFormGrid columns={2} className="items-start">
          <AdminCard presentation="premium" className="min-w-0 p-3">
            <AdminModuleSectionHeader
              id={nativeBinding ? `${urlId}-settings` : "video-settings"}
              sectionHeading="إعدادات الفيديو"
              icon="settings"
              sectionHeaderPresentation="premium"
              sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
            />
            <AdminFormGrid columns={1} fieldContainers>
              {!nativeBinding ? <AdminFormListboxSelect
                id="video-provider"
                name="video_provider"
                label="مزود الفيديو"
                labelClassName="sr-only"
                value={videoProvider}
                onChange={(nextValue) => {
                  if (isVideoProvider(nextValue) && nextValue !== videoProvider) {
                    onVideoProviderChange?.(nextValue);
                    formRuntime?.clearFieldErrors([
                      "video_url",
                      ...(!VIDEO_PROVIDERS.find((item) => item.value === nextValue)?.supportsStartTime
                        ? ["video_start_seconds"] : []),
                    ]);
                  }
                }}
                options={VIDEO_PROVIDERS.map((item) => ({
                  value: item.value,
                  label: item.label,
                  icon: <AdminModuleTabIcon name={item.value === "direct" ? "link" : item.value} />,
                }))}
                inline
                sizing="full"
                inlineClassName="min-w-0"
                inlineOptionsClassName="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3"
                inlineOptionClassName={(selected) => adminChoiceButtonClassName(selected, "min-w-0 flex-col gap-2 px-2 py-3")}
                error={fieldErrors.video_provider?.[0]}
                hint={requestMetaEmbed && (videoProvider === "facebook" || videoProvider === "instagram")
                  ? "تتوفر المعاينة الرسمية للروابط العامة التي يسمح المزود بتضمينها؛ يبقى فتح المصدر متاحًا."
                  : provider.playbackMode === "external"
                  ? "هذا المزود يفتح الفيديو على المصدر الخارجي؛ لا تتوفر معاينة تشغيل مضمّنة هنا."
                  : undefined}
              /> : null}
              <AdminFormField
                label={nativeBinding ? "رابط الفيديو" : provider.urlLabel}
                labelClassName={labelClassName}
                hint={nativeBinding ? VIDEO_PROVIDERS.map((item) => item.label).join(" · ") : `${provider.urlHint} مطلوب عند النشر.`}
              >
                <input
                  id={urlId}
                  name="video_url"
                  type={nativeBinding ? "text" : "url"}
                  value={currentVideoUrl}
                  onChange={(event) => onVideoUrlChange?.(event.currentTarget.value)}
                  onInput={(event) => onVideoUrlChange?.(event.currentTarget.value)}
                  aria-invalid={hasError(urlErrorName) || invalidVideoUrl || undefined}
                  aria-describedby={videoUrlDescription}
                  placeholder={provider.urlPlaceholder}
                  dir="ltr"
                  className={adminFormFieldClassName()}
                />
                {!nativeBinding ? <AdminFormError name={urlErrorName} /> : null}
                {invalidVideoUrl && !hasError(urlErrorName) ? (
                  <p id={urlValidationId} role="status" className={adminFormHintClassName({ textInset: true })}>
                    تحقق من رابط الفيديو ووقت البدء للمزود المختار.
                  </p>
                ) : null}
              </AdminFormField>
              {!nativeBinding ? <AdminFormField
                label="وقت البدء (بالثواني)"
                labelClassName={labelClassName}
                hint={provider.supportsStartTime
                  ? "اختياري. اتركه فارغًا أو استخدم صفرًا للبدء من البداية."
                  : "هذا المزود يبدأ من البداية ولا يدعم وقت بدء مخصصًا."}
              >
                <input
                  id="video_start_seconds"
                  name="video_start_seconds"
                  type="number"
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  inputMode="numeric"
                  value={videoStartSeconds}
                  onChange={(event) => onVideoStartSecondsChange?.(event.currentTarget.value)}
                  onInput={(event) => onVideoStartSecondsChange?.(event.currentTarget.value)}
                  disabled={!provider.supportsStartTime}
                  aria-invalid={hasError("video_start_seconds") || invalidStartSeconds || undefined}
                  aria-describedby={hasError("video_start_seconds")
                    ? "video_start_seconds-error"
                    : invalidStartSeconds ? "video_start_seconds-validation" : undefined}
                  dir="ltr"
                  className={adminFormFieldClassName()}
                />
                <AdminFormError name="video_start_seconds" />
                {invalidStartSeconds && !hasError("video_start_seconds") ? (
                  <p id="video_start_seconds-validation" role="status" className={adminFormHintClassName({ textInset: true })}>
                    أدخل عددًا صحيحًا غير سالب بالثواني لمزود يدعم وقت البدء.
                  </p>
                ) : null}
              </AdminFormField> : null}
              {nativeBinding ? <AdminFormField label="النص البديل لصورة الغلاف">
                <input
                  id={nativeBinding.thumbnailAltId}
                  name={nativeBinding.thumbnailAltName}
                  value={nativeBinding.thumbnailAlt}
                  onChange={(event) => nativeBinding.onThumbnailAltChange(event.currentTarget.value)}
                  aria-invalid={hasError(nativeBinding.thumbnailAltErrorName) || undefined}
                  aria-describedby={hasError(nativeBinding.thumbnailAltErrorName) ? `${nativeBinding.thumbnailAltErrorName}-error` : undefined}
                  className={adminFormFieldClassName()}
                />
              </AdminFormField> : null}
            </AdminFormGrid>
            {!nativeBinding ? <AdminFormError name="video_duration" /> : null}
          </AdminCard>

          <div className="min-w-0 space-y-4">
            <AdminCard presentation="premium" className="min-w-0 p-3">
              <AdminModuleSectionHeader
                id={nativeBinding ? `${urlId}-preview` : "video-preview"}
                sectionHeading="معاينة الفيديو"
                icon="overview"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />
              <div data-admin-media-video-preview-state={previewState} className="space-y-3">
                {previewState === "ready" ? (
                  <MediaVideoPlayback requestMetaEmbed={requestMetaEmbed} item={{
                    videoProvider: provider.value,
                    videoUrl: currentVideoUrl,
                    videoStartSeconds: startSeconds ?? 0,
                    image: (videoThumbnail ?? defaultThumbnail ?? "").trim() || mainImage,
                    title: "معاينة الفيديو",
                  }} />
                ) : (
                  <AdminNotice
                    variant={invalidVideoUrl ? "warning" : "info"}
                    dismissible={false}
                    message={invalidVideoUrl
                      ? "تعذرت المعاينة. تحقق من رابط الفيديو ووقت البدء للمزود المختار."
                      : currentVideoUrl.trim() && nativeBinding ? "هذا الرابط محفوظ كعنوان مصدر؛ لا تتوفر له معاينة مضمّنة من المزود الحالي." : "ستظهر هنا معاينة الفيديو بعد إضافة الرابط."}
                  />
                )}
                {previewState === "ready" ? (
                  <p className={adminFormHintClassName({ textInset: true })}>
                    قد تمنع إعدادات الفيديو الخاص أو قيود المزود عرضه هنا. لا تبدأ المعاينة التشغيل تلقائيًا.
                  </p>
                ) : null}
                {nativeBinding && currentVideoUrl.trim() ? <a href={currentVideoUrl} target="_blank" rel="noreferrer" className={adminFormHintClassName({ textInset: true })}>فتح معاينة الفيديو ↗</a> : null}
              </div>
            </AdminCard>

            <AdminCard presentation="premium" className="min-w-0 p-3">
              <AdminModuleSectionHeader
                id={nativeBinding ? `${urlId}-thumbnail` : "video-thumbnail"}
                sectionHeading="الصورة المصغّرة (اختياري)"
                icon="media"
                sectionHeaderPresentation="premium"
                sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
              />
              <div id={nativeBinding ? `${urlId}-thumbnail-field` : "video_thumbnail"} className="scroll-mt-24">
                <AdminMediaImageField
                  mediaSlot={nativeBinding?.mediaSlot ?? mediaContentSlot("videoPoster")}
                  name={thumbnailName}
                  label="صورة مصغّرة (اختياري)"
                  labelClassName={labelClassName}
                  guidanceClassName={adminFormHintClassName({ textInset: true })}
                  originalDimensionsClassName={ADMIN_FORM.helperTextInset}
                  variant="card"
                  showLabel={false}
                  defaultValue={defaultThumbnail ?? ""}
                  onValueChange={onVideoThumbnailChange}
                  browseFolder={nativeBinding?.browseFolder ?? "images/topics"}
                  focusTargetId={nativeBinding ? `${urlId}-thumbnail-control` : "video_thumbnail_control"}
                  ariaInvalid={hasError(thumbnailName)}
                  ariaDescribedBy={hasError(thumbnailName) ? `${thumbnailName}-error` : undefined}
                />
                <p className={adminFormHintClassName({ textInset: true })}>
                  تُفضّل هذه الصورة كغلاف في بطاقات الفيديو وصفحة التفاصيل، وتظهر قبل تشغيل الرابط المباشر.
                  لا تستبدل غلاف مشغّل المنصة المضمّن. تُضبط صورة المشاركة من إعدادات SEO.
                </p>
                <AdminFormError name={thumbnailName} />
              </div>
            </AdminCard>
          </div>
        </AdminFormGrid>
      </div>
    );
  }

  return (
    <div>
      <AdminModuleSectionHeader
        id="content-video-fields"
        sectionHeading="الفيديو والصورة المصغّرة"
        icon="media"
        sectionHeaderPresentation="premium"
        sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}
      />
      <input type="hidden" name="video_provider" value="youtube" />

      <AdminFormGrid columns={1}>
        <AdminFormGrid columns={1} fieldContainers>
          <AdminFormField label="مزود الفيديو" labelClassName={labelClassName}>
            <input
              readOnly
              value="YouTube"
              className={adminFormFieldClassName()}
            />
          </AdminFormField>

          <AdminFormField
            label="رابط YouTube"
            labelClassName={labelClassName}
            hint="يُقبل رابط watch أو youtu.be أو embed. مطلوب عند النشر."
          >
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
              className={adminFormFieldClassName()}
            />
            <AdminFormError name="video_url" />
          </AdminFormField>
        </AdminFormGrid>

        <AdminFormGrid columns={2} fieldContainers>
          <AdminFormField label="المدة (اختياري)" labelClassName={labelClassName}>
            <input
              id="video_duration"
              name="video_duration"
              defaultValue={defaultDuration ?? ""}
              aria-invalid={hasError("video_duration") || undefined}
              aria-describedby={
                hasError("video_duration") ? "video_duration-error" : undefined
              }
              placeholder="مثل: 3:45"
              className={adminFormFieldClassName()}
            />
            <AdminFormError name="video_duration" />
          </AdminFormField>

          <div id="video_thumbnail" className="scroll-mt-24">
            <AdminMediaImageField
              mediaSlot={mediaContentSlot("videoPoster")}
              name="video_thumbnail"
              label="صورة مصغّرة (اختياري)"
              labelClassName={labelClassName}
              guidanceClassName={adminFormHintClassName({ textInset: true })}
              originalDimensionsClassName={ADMIN_FORM.helperTextInset}
              variant="card"
              defaultValue={defaultThumbnail ?? ""}
              browseFolder="images/topics"
              focusTargetId="video_thumbnail_control"
              ariaInvalid={hasError("video_thumbnail")}
              ariaDescribedBy={
                hasError("video_thumbnail")
                  ? "video_thumbnail-error"
                  : undefined
              }
            />
            <AdminFormError name="video_thumbnail" />
          </div>
        </AdminFormGrid>
      </AdminFormGrid>
    </div>
  );
}
