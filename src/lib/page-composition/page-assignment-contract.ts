import {
  isPageCompositionPosition,
  PAGE_COMPOSITION_POSITIONS,
  type PageCompositionPosition,
} from "./positions.ts";
import type { PageModuleKind } from "../page-blocks/types.ts";

/**
 * Page Composition Position contract.
 *
 * Position is a Page Assignment decision:
 * - Page Composition declares semantic Regions independently of any Theme;
 * - every page exposes that same platform contract;
 * - flexible modules inherit those Regions;
 * - only explicit Product-fixed modules constrain Position.
 *
 * Slugs, route names, templates, layout modes, and CSS are deliberately absent.
 * A Theme maps these semantic Regions onto any visual layout it chooses.
 *
 * Module Presentation remains module-derived and is outside this contract.
 */

type FlexiblePositionCapability = {
  mode: "page";
};

type ProductFixedPositionCapability = {
  mode: "fixed";
  positions: readonly PageCompositionPosition[];
  reasonAr: string;
};

export type ModulePositionCapability =
  | FlexiblePositionCapability
  | ProductFixedPositionCapability;

const FLEXIBLE_MODULE_POSITION = {
  mode: "page",
} as const satisfies ModulePositionCapability;

/**
 * Position declarations are Product constraints, not styling rules.
 */
export const MODULE_POSITION_CAPABILITIES: Record<
  PageModuleKind,
  ModulePositionCapability
> = {
  hero: {
    mode: "fixed",
    positions: ["hero"],
    reasonAr: "موضع الهيرو ثابت بقرار Product.",
  },
  content: FLEXIBLE_MODULE_POSITION,
  cta: FLEXIBLE_MODULE_POSITION,
  cards: FLEXIBLE_MODULE_POSITION,
  breadcrumb: FLEXIBLE_MODULE_POSITION,
  feed: FLEXIBLE_MODULE_POSITION,
  featured: FLEXIBLE_MODULE_POSITION,
  "media-sidebar": FLEXIBLE_MODULE_POSITION,
  "media-hub": FLEXIBLE_MODULE_POSITION,
};

function normalizeModuleKind(moduleKind: string): PageModuleKind | null {
  const normalized = moduleKind.trim().toLowerCase();
  return Object.hasOwn(MODULE_POSITION_CAPABILITIES, normalized)
    ? (normalized as PageModuleKind)
    : null;
}

/** Semantic Regions exposed by every Page Composition, independently of Theme. */
export function getPageCompositionPositions(): PageCompositionPosition[] {
  return [...PAGE_COMPOSITION_POSITIONS];
}

/**
 * Assignment Position options = page positions intersected only with an
 * explicit Product-fixed module constraint.
 */
export function getAssignablePositions(
  moduleKind: string,
): PageCompositionPosition[] {
  const kind = normalizeModuleKind(moduleKind);
  if (!kind) return [];

  const pagePositions = getPageCompositionPositions();
  const capability = MODULE_POSITION_CAPABILITIES[kind];
  if (capability.mode === "page") return pagePositions;

  const fixed = new Set(capability.positions);
  return pagePositions.filter((position) => fixed.has(position));
}

/**
 * Canonical initial Position for a newly-created Assignment.
 *
 * This is derived from the semantic Page Composition Region order, never from
 * a route, Template, Theme, or module editor. Consumers may persist a different
 * allowed Position when the editor explicitly chooses one.
 */
export function getDefaultAssignmentPosition(
  moduleKind: PageModuleKind,
): PageCompositionPosition;
export function getDefaultAssignmentPosition(
  moduleKind: string,
): PageCompositionPosition | null;
export function getDefaultAssignmentPosition(
  moduleKind: string,
): PageCompositionPosition | null {
  return getAssignablePositions(moduleKind)[0] ?? null;
}

export function getProductFixedPositionReason(moduleKind: string): string | null {
  const kind = normalizeModuleKind(moduleKind);
  if (!kind) return null;
  const position = MODULE_POSITION_CAPABILITIES[kind];
  return position.mode === "fixed" ? position.reasonAr : null;
}

export function isAssignmentPositionAllowed(
  moduleKind: string,
  slot: string | null | undefined,
): boolean {
  if (!isPageCompositionPosition(slot)) return false;
  return getAssignablePositions(moduleKind).includes(slot);
}

/** Safe Arabic message for rejected create/update. */
export function getUnsupportedAssignmentPositionMessage(
  moduleKind: string,
  slot: string | null | undefined,
): string {
  const options = getAssignablePositions(moduleKind);
  const requested = String(slot ?? "").trim() || "غير محدد";
  const kindLabel = moduleKind.trim() || "الموديول";
  const fixedReason = getProductFixedPositionReason(moduleKind);

  if (!options.length) {
    return `لا يمكن ربط موديول من نوع «${kindLabel}» — لا يوجد Position متوافق مع Page Composition Contract.`;
  }

  return fixedReason
    ? `الموضع «${requested}» غير متاح لموديول «${kindLabel}». ${fixedReason}`
    : `الموضع «${requested}» ليس ضمن Page Composition Contract. المواضع المتاحة: ${options.join(", ")}.`;
}
