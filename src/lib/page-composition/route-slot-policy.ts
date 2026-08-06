import {
  normalizeLayoutSlot,
  PAGE_LAYOUT_SLOTS,
  type PageLayoutSlot,
} from "../page-blocks/layout-slots.ts";

/**
 * Central Route × Module slot capabilities.
 * Single source of truth for Admin UI options, server assignment validation, and verifies.
 * Mirrors public renderer behaviour — does not expand public rendering.
 */

type ModuleSlotContract = {
  allowed: readonly PageLayoutSlot[];
  preferred: readonly PageLayoutSlot[];
};

const ALL_NON_HERO_SLOTS: readonly PageLayoutSlot[] = ["main", "sidebar", "bottom", "footer"];

/**
 * Canonical Module × Slot contract.
 * The same declaration drives selector order, server validation, and presentation.
 */
export const MODULE_SLOT_CONTRACT: Record<string, ModuleSlotContract> = {
  hero: { allowed: ["hero"], preferred: ["hero"] },
  breadcrumb: { allowed: ["hero"], preferred: ["hero"] },
  content: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "bottom"] },
  cta: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "bottom"] },
  cards: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "sidebar", "bottom"] },
  feed: { allowed: ["sidebar"], preferred: ["sidebar"] },
  "media-sidebar": { allowed: ["sidebar"], preferred: ["sidebar"] },
  "media-hub": { allowed: ["main"], preferred: ["main"] },
};

const FREEFORM_KINDS = new Set(["content", "cta", "cards"]);

function getModuleSlotContract(moduleKind: string): ModuleSlotContract {
  const kind = moduleKind.trim().toLowerCase();
  return MODULE_SLOT_CONTRACT[kind] ?? {
    allowed: PAGE_LAYOUT_SLOTS,
    preferred: ["main"],
  };
}

function kindBaseSlots(moduleKind: string): PageLayoutSlot[] {
  return [...getModuleSlotContract(moduleKind).allowed];
}

function orderByPreference(
  slots: readonly PageLayoutSlot[],
  preferred: readonly PageLayoutSlot[],
): PageLayoutSlot[] {
  const rank = new Map(preferred.map((slot, index) => [slot, index]));
  return [...slots].sort((left, right) =>
    (rank.get(left) ?? preferred.length + PAGE_LAYOUT_SLOTS.indexOf(left)) -
    (rank.get(right) ?? preferred.length + PAGE_LAYOUT_SLOTS.indexOf(right)),
  );
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
  const preferred = getModuleSlotContract(kind).preferred;

  if (!slug) {
    // Without a page context, keep kind constraints only (server must resolve slug).
    if (FREEFORM_KINDS.has(kind)) {
      return orderByPreference(base.filter((slot) => slot !== "hero"), preferred);
    }
    return orderByPreference(base, preferred);
  }

  if (kind === "hero" || kind === "breadcrumb" || kind === "media-hub" || kind === "media-sidebar") {
    return orderByPreference(base, preferred);
  }

  if (kind === "feed") {
    return routeAllowsCompositionFeed(slug) ? orderByPreference(base, preferred) : [];
  }

  if (FREEFORM_KINDS.has(kind)) {
    const allowed = new Set(freeformSlotsForRoute(slug));
    return orderByPreference(base.filter((slot) => allowed.has(slot)), preferred);
  }

  return orderByPreference(base, preferred);
}

export function getPreferredSlotsForModuleKind(
  moduleKind: string,
  pageSlug?: string | null,
): PageLayoutSlot[] {
  const allowed = new Set(getAssignableSlotsForRoute(pageSlug, moduleKind));
  return getModuleSlotContract(moduleKind).preferred.filter((slot) => allowed.has(slot));
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
