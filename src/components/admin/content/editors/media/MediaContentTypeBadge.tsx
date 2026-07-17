import AdminToneBadge from "../../../ui/AdminToneBadge";
import { getContentTypeLabel } from "./media-content-config";
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
      <AdminToneBadge
        toneClassName={MEDIA_CONTENT_TYPE_UNKNOWN_BADGE_CLASS}
        className="min-w-[72px] px-2.5 py-1 text-xs"
      >
        غير محدد
      </AdminToneBadge>
    );
  }

  const style = getMediaContentTypeBadgeStyle(contentType)!;
  const label = getContentTypeLabel(contentType);

  return (
    <AdminToneBadge
      toneClassName={style.className}
      className={[
        "gap-1.5",
        compact ? "min-w-[88px] px-2.5 py-1 text-[11px]" : "min-w-[104px] px-3 py-1.5 text-xs",
      ].join(" ")}
    >
      <span className="font-en text-[10px] opacity-80">{style.icon}</span>
      {label}
    </AdminToneBadge>
  );
}

export function getSectionTypeHint(contentType: string) {
  if (contentType === "video") {
    return {
      title: "محتوى فيديو",
      description: "أدخل رابط YouTube والمدة والصورة المصغّرة. الرابط مطلوب عند النشر.",
      tone: "video" as const,
    };
  }

  if (contentType === "gallery") {
    return {
      title: "معرض صور",
      description: "أضف صور المعرض مع alt وcaption. صورة واحدة على الأقل مطلوبة عند النشر.",
      tone: "gallery" as const,
    };
  }

  if (contentType === "news") {
    return {
      title: "خبر",
      description: "محتوى نصي بصيغة Markdown — مناسب للأخبار والتحديثات القصيرة.",
      tone: "text" as const,
    };
  }

  if (contentType === "press") {
    return {
      title: "بيان صحفي",
      description: "محتوى نصي بصيغة Markdown — للبيانات الصحفية الرسمية.",
      tone: "text" as const,
    };
  }

  if (contentType === "site_update") {
    return {
      title: "من أرض التنفيذ",
      description: "محتوى نصي بصيغة Markdown — لتحديثات المشروعات والتنفيذ.",
      tone: "text" as const,
    };
  }

  return null;
}
