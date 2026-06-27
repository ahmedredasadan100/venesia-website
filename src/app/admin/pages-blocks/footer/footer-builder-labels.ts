import type { FooterBlockType, FooterSlotIndex } from "../../../../lib/footer/footer-slot-types";

export const FOOTER_BLOCK_TYPE_LABELS: Record<FooterBlockType, string> = {
  text: "نص / براند",
  menu: "قائمة",
  contact: "تواصل",
  media: "مركز إعلامي",
  custom_links: "روابط",
};

export const FOOTER_COLUMN_LABELS: Record<FooterSlotIndex, string> = {
  1: "العمود الأول",
  2: "العمود الثاني",
  3: "العمود الثالث",
  4: "العمود الرابع",
};

export const FOOTER_MENU_LOCATION_LABELS = {
  footer: "قائمة الفوتر",
  main: "القائمة الرئيسية",
  mobile: "قائمة الموبايل",
  custom: "مخصص",
} as const;

export const FOOTER_MEDIA_SOURCE_LABELS = {
  main_submenu: "Submenu من القائمة الرئيسية",
  menu_id: "قائمة محددة",
  manual: "روابط يدوية",
} as const;
