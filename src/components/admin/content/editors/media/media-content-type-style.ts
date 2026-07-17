import {
  MEDIA_EDITABLE_CONTENT_TYPES,
  type MediaEditableContentType,
} from "./media-content-config";

export type MediaContentTypeBadgeStyle = {
  className: string;
  icon: string;
};

export const MEDIA_CONTENT_TYPE_BADGE_STYLES: Record<MediaEditableContentType, MediaContentTypeBadgeStyle> = {
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

export const MEDIA_CONTENT_TYPE_UNKNOWN_BADGE_CLASS =
  "border-white/12 bg-white/[0.06] text-white/45";

export function isKnownMediaContentType(value?: string | null): value is MediaEditableContentType {
  return MEDIA_EDITABLE_CONTENT_TYPES.includes(value as MediaEditableContentType);
}

export function getMediaContentTypeBadgeStyle(contentType?: string | null): MediaContentTypeBadgeStyle | null {
  if (!isKnownMediaContentType(contentType)) return null;
  return MEDIA_CONTENT_TYPE_BADGE_STYLES[contentType];
}

export function getMediaContentTypeBadgeClassName(contentType?: string | null) {
  return getMediaContentTypeBadgeStyle(contentType)?.className ?? MEDIA_CONTENT_TYPE_UNKNOWN_BADGE_CLASS;
}
