/**
 * Page layout positions (Joomla/WordPress-style).
 * Assignments reference a slot + sort_order within that slot.
 */
export const PAGE_LAYOUT_SLOTS = ["hero", "main", "sidebar", "bottom", "footer"] as const;

export type PageLayoutSlot = (typeof PAGE_LAYOUT_SLOTS)[number];

/** @deprecated Use PAGE_LAYOUT_SLOTS */
export const PAGE_BLOCK_SLOTS = PAGE_LAYOUT_SLOTS;

/** @deprecated Use PageLayoutSlot */
export type PageBlockSlot = PageLayoutSlot;

/** Render order for full-page stack layouts. */
export const PAGE_LAYOUT_SLOT_ORDER: PageLayoutSlot[] = [
  "hero",
  "main",
  "sidebar",
  "bottom",
  "footer",
];

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

export function normalizeLayoutSlot(slot: string | null | undefined): PageLayoutSlot {
  const value = (slot ?? "main").trim().toLowerCase();
  return LEGACY_SLOT_MAP[value] ?? (PAGE_LAYOUT_SLOTS.includes(value as PageLayoutSlot) ? (value as PageLayoutSlot) : "main");
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
