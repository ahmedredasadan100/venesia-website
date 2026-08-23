import {
  isRecognizedLayoutSlot,
  normalizeLayoutSlot,
  PAGE_LAYOUT_SLOTS,
  type PageLayoutSlot,
} from "../page-blocks/layout-slots.ts";
import type { PageLayoutMode } from "../page-blocks/page-composition-types.ts";

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
const ALL_LAYOUT_SLOTS: readonly PageLayoutSlot[] = PAGE_LAYOUT_SLOTS;

/**
 * Canonical Module × Slot contract.
 * The same declaration drives selector order, server validation, and presentation.
 */
export const MODULE_SLOT_CONTRACT: Record<string, ModuleSlotContract> = {
  hero: { allowed: ["hero"], preferred: ["hero"] },
  breadcrumb: { allowed: ALL_LAYOUT_SLOTS, preferred: ["hero", "main"] },
  content: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "bottom"] },
  cta: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "bottom"] },
  cards: { allowed: ALL_NON_HERO_SLOTS, preferred: ["main", "sidebar", "bottom"] },
  feed: { allowed: ["sidebar"], preferred: ["sidebar"] },
  "media-sidebar": { allowed: ["sidebar"], preferred: ["sidebar"] },
  "media-hub": { allowed: ["main"], preferred: ["main"] },
};

const FREEFORM_KINDS = new Set(["content", "cta", "cards"]);

function getModuleSlotContract(moduleKind: string): ModuleSlotContract | null {
  const kind = moduleKind.trim().toLowerCase();
  return MODULE_SLOT_CONTRACT[kind] ?? null;
}

function kindBaseSlots(moduleKind: string): PageLayoutSlot[] {
  return [...(getModuleSlotContract(moduleKind)?.allowed ?? [])];
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
function freeformSlotsForRoute(pageSlug: string, moduleKind: string): PageLayoutSlot[] {
  const slug = pageSlug.trim().toLowerCase();

  if (slug === "home") return ["main"];
  if (slug === "projects") return moduleKind === "content" ? ["main"] : [];
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
  if (slug === "projects") return false;
  if (slug.startsWith("media-center-")) return false;
  return true;
}

function routeAllowsHero(pageSlug: string): boolean {
  return pageSlug.trim().toLowerCase() !== "projects";
}

function routeAllowsMediaHub(pageSlug: string): boolean {
  const slug = pageSlug.trim().toLowerCase();
  return slug === "media-center" || slug.startsWith("media-center-");
}

function routeAllowsMediaSidebar(pageSlug: string): boolean {
  const slug = pageSlug.trim().toLowerCase();
  return slug !== "home" && slug !== "projects";
}

/**
 * One Page Composition layout decision for loaders and renderers. `main-sidebar`
 * only becomes two-column when the sidebar contains an entry (or a prefix).
 */
export function getPageLayoutModeForRoute(
  pageSlug: string | null | undefined,
): PageLayoutMode {
  const slug = (pageSlug ?? "").trim().toLowerCase();
  if (slug === "home" || slug === "projects") {
    return "stack";
  }
  return "main-sidebar";
}

/** Breadcrumb adopts the display positions already rendered by each route runtime. */
function breadcrumbSlotsForRoute(pageSlug: string): PageLayoutSlot[] {
  const slug = pageSlug.trim().toLowerCase();

  if (slug === "home") return ["hero", "main"];
  if (slug === "projects") return [];
  if (slug === "media-center") return ["hero", "main", "bottom", "footer"];
  if (slug.startsWith("media-center-")) return ["hero", "main", "bottom"];

  return [...PAGE_LAYOUT_SLOTS];
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
  const contract = getModuleSlotContract(kind);
  if (!contract) return [];
  const base = kindBaseSlots(kind);
  const preferred = contract.preferred;

  if (!slug) {
    // Without a page context, keep kind constraints only (server must resolve slug).
    if (FREEFORM_KINDS.has(kind)) {
      return orderByPreference(base.filter((slot) => slot !== "hero"), preferred);
    }
    return orderByPreference(base, preferred);
  }

  if (kind === "breadcrumb") {
    const allowed = new Set(breadcrumbSlotsForRoute(slug));
    return orderByPreference(base.filter((slot) => allowed.has(slot)), preferred);
  }

  if (kind === "hero") {
    return routeAllowsHero(slug) ? orderByPreference(base, preferred) : [];
  }

  if (kind === "media-hub") {
    return routeAllowsMediaHub(slug)
      ? orderByPreference(base, preferred)
      : [];
  }

  if (kind === "media-sidebar") {
    return routeAllowsMediaSidebar(slug)
      ? orderByPreference(base, preferred)
      : [];
  }

  if (kind === "feed") {
    return routeAllowsCompositionFeed(slug) ? orderByPreference(base, preferred) : [];
  }

  if (FREEFORM_KINDS.has(kind)) {
    const allowed = new Set(freeformSlotsForRoute(slug, kind));
    return orderByPreference(base.filter((slot) => allowed.has(slot)), preferred);
  }

  return orderByPreference(base, preferred);
}

export function getPreferredSlotsForModuleKind(
  moduleKind: string,
  pageSlug?: string | null,
): PageLayoutSlot[] {
  const allowed = new Set(getAssignableSlotsForRoute(pageSlug, moduleKind));
  return (getModuleSlotContract(moduleKind)?.preferred ?? []).filter((slot) =>
    allowed.has(slot),
  );
}

export function isSlotAllowedForRoute(
  pageSlug: string | null | undefined,
  moduleKind: string,
  slot: string | null | undefined,
): boolean {
  if (!isRecognizedLayoutSlot(slot)) return false;
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
  const requested = isRecognizedLayoutSlot(slot)
    ? normalized
    : String(slot ?? "").trim() || "غير محدد";
  const kindLabel = moduleKind.trim() || "الموديول";

  if (!options.length) {
    return `لا يمكن ربط موديول من نوع «${kindLabel}» بهذه الصفحة — لا يوجد موضع عرض مدعوم في الواجهة العامة.`;
  }

  return `الموضع «${requested}» غير مدعوم لموديول «${kindLabel}» على هذه الصفحة. المواضع المتاحة: ${options.join(", ")}.`;
}
