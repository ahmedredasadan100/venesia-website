import type { MediaHubSectionKey } from "./types";

export const MEDIA_HUB_SECTION_LABELS: Record<MediaHubSectionKey, string> = {
  featured: "محتوى مميز",
  "site-updates": "تحديثات المواقع",
  videos: "الفيديوهات",
  gallery: "معرض الصور",
  press: "الصحافة",
};

export function isMediaHubSectionKey(value: string): value is MediaHubSectionKey {
  return value in MEDIA_HUB_SECTION_LABELS;
}
