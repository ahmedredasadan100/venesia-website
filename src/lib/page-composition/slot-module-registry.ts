/**
 * Page composition slot identifiers for admin page builder and public layout.
 */
import type { PageModuleKind } from "../page-blocks/types";

export const PAGE_COMPOSITION_SLOTS = ["hero", "main", "sidebar", "bottom", "footer"] as const;

export type PageCompositionSlot = (typeof PAGE_COMPOSITION_SLOTS)[number];

/**
 * Known specialized content-module slugs grouped by typical slot assignment.
 * Generic blocks fall through to SectionRenderer when not listed here.
 */
export const SLOT_MODULE_SLUG_REGISTRY: Record<PageCompositionSlot, readonly string[]> = {
  hero: ["hero-inline"],
  main: [
    "home-story",
    "home-trust",
    "home-contact",
    "home-projects",
    "projects-hub-hero",
    "projects-hub-featured",
    "projects-hub-listing",
    "projects-hub-map",
    "about-intro",
    "about-intro-single-image",
    "about-documentary-beats",
    "about-vision",
    "about-approach",
    "about-principles",
    "about-projects-cta",
    "about-cta",
    "contact-trust-cards",
    "contact-form-office",
    "contact-form",
    "contact-map",
    "contact-reasons",
    "contact-departments",
    "contact-faq",
    "topics-intro",
    "media-hub-sections",
  ],
  sidebar: ["topics-insight-cta", "topics-feed-sidebar", "media-sidebar-widgets"],
  bottom: ["contact-faq", "about-cta", "topics-insight-cta"],
  footer: [],
};

export function isRegisteredSlotModuleSlug(slug: string) {
  return PAGE_COMPOSITION_SLOTS.some((slot) => SLOT_MODULE_SLUG_REGISTRY[slot].includes(slug));
}

export function getTypicalSlotForModuleKind(kind: PageModuleKind | string): PageCompositionSlot {
  if (kind === "hero" || kind === "breadcrumb") return "hero";
  if (kind === "feed" || kind === "media-sidebar") return "sidebar";
  if (kind === "media-hub") return "main";
  return "main";
}

export function listRegistrySlugsForSlot(slot: PageCompositionSlot) {
  return SLOT_MODULE_SLUG_REGISTRY[slot];
}

export {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionMetadata,
  getModuleKindMetadata,
  getSlotCompatibilityLabel,
  getSlotModuleSlugMetadata,
  MODULE_KIND_METADATA,
  SLOT_MODULE_SLUG_METADATA,
} from "./module-registry-metadata";

export type {
  ModuleEditorIconToken,
  ModuleEditorSectionMetadata,
  ResolvedModuleEditorHeaderMetadata,
} from "./module-registry-metadata";
