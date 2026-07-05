import {
  CONTENT_TYPE_LABELS,
  type MediaListContentType,
} from "./media-content-config";
import {
  getMediaContentTypeBadgeStyle,
  isKnownMediaContentType,
  MEDIA_CONTENT_TYPE_UNKNOWN_BADGE_CLASS,
} from "./media-content-type-style";

export default function MediaContentTypeBadge({
  contentType,
  compact = false,
}: {
  contentType?: string | null;
  compact?: boolean;
}) {
  if (!isKnownMediaContentType(contentType)) {
    return (
      <span
        className={`inline-flex min-w-[72px] justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${MEDIA_CONTENT_TYPE_UNKNOWN_BADGE_CLASS}`}
      >
        غير محدد
      </span>
    );
  }

  const style = getMediaContentTypeBadgeStyle(contentType)!;
  const label = CONTENT_TYPE_LABELS[contentType as MediaListContentType];

  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold",
        compact ? "min-w-[88px] px-2.5 py-1 text-[11px]" : "min-w-[104px] px-3 py-1.5 text-xs",
        style.className,
      ].join(" ")}
    >
      <span className="font-en text-[10px] opacity-80">{style.icon}</span>
      {label}
    </span>
  );
}

export function getSectionTypeHint(sectionSlug: string) {
  if (sectionSlug === "media-videos") {
    return {
      title: "محتوى فيديو",
      description: "أدخل رابط YouTube والمدة والصورة المصغّرة. يُحفظ في media_payload.",
      tone: "video" as const,
    };
  }

  if (sectionSlug === "media-gallery") {
    return {
      title: "معرض صور",
      description: "أضف صور المعرض مع alt وcaption. يُحفظ في media_payload.",
      tone: "gallery" as const,
    };
  }

  if (sectionSlug === "media-news") {
    return {
      title: "خبر",
      description: "محتوى نصي بصيغة Markdown — مناسب للأخبار والتحديثات القصيرة.",
      tone: "text" as const,
    };
  }

  if (sectionSlug === "media-press") {
    return {
      title: "بيان صحفي",
      description: "محتوى نصي بصيغة Markdown — للبيانات الصحفية الرسمية.",
      tone: "text" as const,
    };
  }

  if (sectionSlug === "media-site-updates") {
    return {
      title: "من أرض التنفيذ",
      description: "محتوى نصي بصيغة Markdown — لتحديثات المشروعات والتنفيذ.",
      tone: "text" as const,
    };
  }

  return null;
}
