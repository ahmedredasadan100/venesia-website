import type { MediaHubSectionKey } from "./types";

export const MEDIA_HUB_SECTION_LABELS: Record<MediaHubSectionKey, string> = {
  featured: "Featured News — أخبار مميزة",
  "site-updates": "Site Updates — تحديثات المواقع",
  videos: "Videos — الفيديوهات",
  gallery: "Gallery — معرض الصور",
  press: "Press — الصحافة",
};

export const MEDIA_HUB_SECTION_SUMMARIES: Record<MediaHubSectionKey, string> = {
  featured:
    "يعرض الأخبار المميزة مع بطاقة رئيسية وقائمة جانبية في صفحة hub المركز الإعلامي.",
  "site-updates": "يعرض آخر تحديثات المواقع في جدول زمني داخل hub المركز الإعلامي.",
  videos: "يعرض أحدث الفيديوهات المنشورة في المركز الإعلامي.",
  gallery: "يعرض معرض الصور والمواد المرئية في hub المركز الإعلامي.",
  press: "يعرض البيانات الصحفية والتغطيات الإعلامية في hub المركز الإعلامي.",
};

export function isMediaHubSectionKey(value: string): value is MediaHubSectionKey {
  return value in MEDIA_HUB_SECTION_LABELS;
}

export function getMediaHubSectionLabel(sectionKey: string) {
  if (isMediaHubSectionKey(sectionKey)) return MEDIA_HUB_SECTION_LABELS[sectionKey];
  return sectionKey;
}

export function getMediaHubModuleSummary(sectionKey: string, description?: string | null) {
  if (description?.trim()) return description.trim();
  if (isMediaHubSectionKey(sectionKey)) return MEDIA_HUB_SECTION_SUMMARIES[sectionKey];
  return "—";
}

export function formatMediaHubDataSource(config: Record<string, unknown>) {
  return config.source === "media_items" ? "media_items — عناصر المركز الإعلامي" : String(config.source ?? "—");
}

export function formatMediaHubLimit(config: Record<string, unknown>) {
  if (config.featured === true) {
    const parts: string[] = [];
    if (typeof config.sideLimit === "number") parts.push(`جانبي: ${config.sideLimit}`);
    if (typeof config.listLimit === "number") parts.push(`قائمة: ${config.listLimit}`);
    return parts.length ? parts.join(" · ") : "—";
  }

  if (typeof config.limit === "number") return String(config.limit);
  return "—";
}
