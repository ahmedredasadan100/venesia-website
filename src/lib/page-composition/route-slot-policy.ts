import {
  normalizeLayoutSlot,
  PAGE_LAYOUT_SLOTS,
  type PageLayoutSlot,
} from "../page-blocks/layout-slots";

/**
 * Central Route × Module slot capabilities.
 * Single source of truth for Admin UI options, server assignment validation, and verifies.
 * Mirrors public renderer behaviour — does not expand public rendering.
 */

const FREEFORM_KINDS = new Set(["content", "cta", "cards"]);

function kindBaseSlots(moduleKind: string): PageLayoutSlot[] {
  const kind = moduleKind.trim().toLowerCase();
  if (kind === "hero" || kind === "breadcrumb") return ["hero"];
  if (kind === "feed" || kind === "media-sidebar") return ["sidebar"];
  if (kind === "media-hub") return ["main"];
  if (FREEFORM_KINDS.has(kind)) return [...PAGE_LAYOUT_SLOTS];
  return [...PAGE_LAYOUT_SLOTS];
}

/** Slots that freeform modules (content/cta/cards) may use on a given page slug. */
function freeformSlotsForRoute(pageSlug: string): PageLayoutSlot[] {
  const slug = pageSlug.trim().toLowerCase();

  if (slug === "home") return ["main"];
  if (slug === "projects") return ["main"];
  if (slug === "topics") return ["main", "sidebar", "bottom", "footer"];
  if (slug === "media-center") return ["main", "bottom", "footer"];
  if (slug.startsWith("media-center-")) return ["main", "bottom"];

  // About, Contact, and other/dynamic published pages use full PageSlotLayout
  // except content/cta/cards in hero (HeroSlotContent only renders hero + breadcrumb).
  return ["main", "sidebar", "bottom", "footer"];
}

function routeAllowsCompositionFeed(pageSlug: string): boolean {
  const slug = pageSlug.trim().toLowerCase();
  if (slug === "home") return false;
  if (slug.startsWith("media-center-")) return false;
  return true;
}

/**
 * Assignable layout slots for a module kind on a specific page slug.
 * Empty array = kind cannot be assigned to any slot on that route.
 */
export function getAssignableSlotsForRoute(
  pageSlug: string | null | undefined,
  moduleKind: string,
): PageLayoutSlot[] {
  const slug = (pageSlug ?? "").trim().toLowerCase();
  const kind = moduleKind.trim().toLowerCase();
  const base = kindBaseSlots(kind);

  if (!slug) {
    // Without a page context, keep kind constraints only (server must resolve slug).
    if (FREEFORM_KINDS.has(kind)) {
      return base.filter((slot) => slot !== "hero");
    }
    return base;
  }

  if (kind === "hero" || kind === "breadcrumb" || kind === "media-hub" || kind === "media-sidebar") {
    return base;
  }

  if (kind === "feed") {
    return routeAllowsCompositionFeed(slug) ? base : [];
  }

  if (FREEFORM_KINDS.has(kind)) {
    const allowed = new Set(freeformSlotsForRoute(slug));
    return base.filter((slot) => allowed.has(slot));
  }

  return base;
}

export function isSlotAllowedForRoute(
  pageSlug: string | null | undefined,
  moduleKind: string,
  slot: string | null | undefined,
): boolean {
  const normalized = normalizeLayoutSlot(slot);
  return getAssignableSlotsForRoute(pageSlug, moduleKind).includes(normalized);
}

/** Safe Arabic message for rejected create/update — no internal slot dumps required. */
export function getUnsupportedSlotAssignmentMessage(
  pageSlug: string | null | undefined,
  moduleKind: string,
  slot: string | null | undefined,
): string {
  const options = getAssignableSlotsForRoute(pageSlug, moduleKind);
  const normalized = normalizeLayoutSlot(slot);
  const kindLabel = moduleKind.trim() || "الموديول";

  if (!options.length) {
    return `لا يمكن ربط موديول من نوع «${kindLabel}» بهذه الصفحة — لا يوجد موضع عرض مدعوم في الواجهة العامة.`;
  }

  return `الموضع «${normalized}» غير مدعوم لموديول «${kindLabel}» على هذه الصفحة. المواضع المتاحة: ${options.join(", ")}.`;
}

/** Exported for verifies — documents intentional route freeform matrices. */
export const ROUTE_SLOT_POLICY_FIXTURES: Record<string, PageLayoutSlot[]> = {
  home: ["main"],
  projects: ["main"],
  topics: ["main", "sidebar", "bottom", "footer"],
  "media-center": ["main", "bottom", "footer"],
  "media-center-news": ["main", "bottom"],
  about: ["main", "sidebar", "bottom", "footer"],
  contact: ["main", "sidebar", "bottom", "footer"],
};
