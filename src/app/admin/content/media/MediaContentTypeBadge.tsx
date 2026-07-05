import {
  CONTENT_TYPE_LABELS,
  MEDIA_LIST_CONTENT_TYPES,
  type MediaListContentType,
} from "./media-content-config";

const TYPE_STYLES: Record<
  MediaListContentType,
  { className: string; icon: string }
> = {
  news: {
    icon: "◈",
    className: "border-sky-400/22 bg-sky-500/12 text-sky-100",
  },
  press: {
    icon: "◉",
    className: "border-violet-400/22 bg-violet-500/12 text-violet-100",
  },
  site_update: {
    icon: "▣",
    className: "border-emerald-400/22 bg-emerald-500/12 text-emerald-100",
  },
  video: {
    icon: "▶",
    className: "border-rose-400/22 bg-rose-500/12 text-rose-100",
  },
  gallery: {
    icon: "▤",
    className: "border-amber-400/22 bg-amber-500/12 text-amber-100",
  },
};

function isKnownType(value?: string | null): value is MediaListContentType {
  return MEDIA_LIST_CONTENT_TYPES.includes(value as MediaListContentType);
}

export default function MediaContentTypeBadge({
  contentType,
  compact = false,
}: {
  contentType?: string | null;
  compact?: boolean;
}) {
  if (!isKnownType(contentType)) {
    return (
      <span className="inline-flex min-w-[72px] justify-center rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-white/45">
        غير محدد
      </span>
    );
  }

  const style = TYPE_STYLES[contentType];
  const label = CONTENT_TYPE_LABELS[contentType];

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
