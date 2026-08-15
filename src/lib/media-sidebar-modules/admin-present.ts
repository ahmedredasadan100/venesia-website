import type { MediaSidebarWidgetKey } from "./types";

export const MEDIA_SIDEBAR_WIDGET_LABELS: Record<MediaSidebarWidgetKey, string> = {
  sections: "أقسام المركز الإعلامي",
  latest: "أحدث الأخبار",
  popular: "الأكثر قراءة",
};

export function isMediaSidebarWidgetKey(value: string): value is MediaSidebarWidgetKey {
  return value in MEDIA_SIDEBAR_WIDGET_LABELS;
}
