import {
  isPageCompositionPosition,
  PAGE_COMPOSITION_POSITIONS,
  type PageCompositionPosition,
} from "../page-composition/positions.ts";

export { PAGE_COMPOSITION_POSITIONS, type PageCompositionPosition };

/** @deprecated Compatibility alias; Position inventory is Page Composition-owned. */
export const PAGE_LAYOUT_SLOTS = PAGE_COMPOSITION_POSITIONS;

/** @deprecated Compatibility alias for persisted `slot` fields. */
export type PageLayoutSlot = PageCompositionPosition;

const LEGACY_SLOT_MAP: Record<string, PageLayoutSlot> = {
  top: "hero",
  "before-content": "main",
  main: "main",
  sidebar: "sidebar",
  "after-content": "bottom",
  "before-footer": "bottom",
  bottom: "bottom",
  footer: "footer",
  hero: "hero",
};

export function isRecognizedLayoutSlot(
  slot: string | null | undefined,
): boolean {
  const value = (slot ?? "").trim().toLowerCase();
  return Boolean(value) && (
    Object.hasOwn(LEGACY_SLOT_MAP, value) ||
    isPageCompositionPosition(value)
  );
}

export function normalizeLayoutSlot(slot: string | null | undefined): PageLayoutSlot {
  const value = (slot ?? "main").trim().toLowerCase();
  return LEGACY_SLOT_MAP[value] ?? (isPageCompositionPosition(value) ? value : "main");
}

export const LAYOUT_SLOT_LABELS: Record<PageLayoutSlot, string> = {
  hero: "Hero",
  main: "Main",
  sidebar: "Sidebar",
  bottom: "Bottom",
  footer: "Footer",
};

export const LAYOUT_SLOT_LABELS_AR: Record<PageLayoutSlot, string> = {
  hero: "الهيرو",
  main: "المحتوى الرئيسي",
  sidebar: "الشريط الجانبي",
  bottom: "أسفل الصفحة",
  footer: "قبل الفوتر",
};
