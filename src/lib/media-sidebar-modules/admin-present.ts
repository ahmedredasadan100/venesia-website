import type { MediaSidebarWidgetKey } from "./types";

export const MEDIA_SIDEBAR_WIDGET_LABELS: Record<MediaSidebarWidgetKey, string> = {
  sections: "أقسام المركز الإعلامي",
  latest: "أحدث الأخبار",
  popular: "الأكثر قراءة",
};

export const MEDIA_SIDEBAR_WIDGET_SUMMARIES: Record<MediaSidebarWidgetKey, string> = {
  sections: "يعرض روابط أقسام المركز الإعلامي من قائمة التنقل في الشريط الجانبي.",
  latest: "يعرض أحدث الأخبار المنشورة في الشريط الجانبي لصفحات المركز الإعلامي.",
  popular: "يعرض العناصر الأكثر قراءة في الشريط الجانبي لصفحات المركز الإعلامي.",
};

export function isMediaSidebarWidgetKey(value: string): value is MediaSidebarWidgetKey {
  return value in MEDIA_SIDEBAR_WIDGET_LABELS;
}

export function getMediaSidebarWidgetLabel(widgetKey: string) {
  if (isMediaSidebarWidgetKey(widgetKey)) return MEDIA_SIDEBAR_WIDGET_LABELS[widgetKey];
  return widgetKey;
}

export function getMediaSidebarModuleSummary(widgetKey: string, description?: string | null) {
  if (description?.trim()) return description.trim();
  if (isMediaSidebarWidgetKey(widgetKey)) return MEDIA_SIDEBAR_WIDGET_SUMMARIES[widgetKey];
  return "—";
}

export function formatMediaSidebarDataSource(config: Record<string, unknown>) {
  if (config.source === "navigation") return "navigation / menu — قائمة التنقل";
  if (config.source === "media_items") return "media_items — عناصر المركز الإعلامي";
  return String(config.source ?? "—");
}

export function formatMediaSidebarLimit(config: Record<string, unknown>) {
  if (typeof config.limit === "number") return String(config.limit);
  return "—";
}
