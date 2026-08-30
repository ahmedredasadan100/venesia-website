import type { MediaSidebarPresentation } from "./parse-config";
import type { MediaSidebarWidgetKey } from "./types";

export const MEDIA_SIDEBAR_WIDGET_LABELS: Record<MediaSidebarWidgetKey, string> = {
  sections: "أقسام المركز الإعلامي",
  latest: "الأحدث",
  popular: "الأكثر قراءة",
};

export const MEDIA_SIDEBAR_PRESENTATION_LABELS: Record<
  MediaSidebarPresentation,
  string
> = {
  list: "قائمة",
  "single-carousel": "خبر واحد متحرك",
  "group-carousel": "مجموعة متحركة",
};

export function isMediaSidebarWidgetKey(value: string): value is MediaSidebarWidgetKey {
  return value in MEDIA_SIDEBAR_WIDGET_LABELS;
}
