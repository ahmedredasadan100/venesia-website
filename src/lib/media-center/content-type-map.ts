import type { MediaContentType } from "./types";

export type UnifiedTopicsContentType = "news" | "press" | "site_update" | "video" | "gallery";

const TOPICS_CONTENT_TYPE_BY_PUBLIC_TYPE: Record<MediaContentType, UnifiedTopicsContentType> = {
  news: "news",
  press: "press",
  "site-update": "site_update",
  video: "video",
  gallery: "gallery",
};

const PUBLIC_TYPE_BY_TOPICS_CONTENT_TYPE: Record<UnifiedTopicsContentType, MediaContentType> = {
  news: "news",
  press: "press",
  site_update: "site-update",
  video: "video",
  gallery: "gallery",
};

export function toTopicsContentType(type: MediaContentType): UnifiedTopicsContentType {
  return TOPICS_CONTENT_TYPE_BY_PUBLIC_TYPE[type];
}

export function toPublicMediaType(value: string | null | undefined): MediaContentType | null {
  if (!value) return null;
  if (value in PUBLIC_TYPE_BY_TOPICS_CONTENT_TYPE) {
    return PUBLIC_TYPE_BY_TOPICS_CONTENT_TYPE[value as UnifiedTopicsContentType];
  }
  return null;
}
