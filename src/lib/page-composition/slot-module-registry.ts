/**
 * Page composition slot identifiers for admin page builder and public layout.
 * Phase 3 visual slot map will build on this registry.
 */
export const PAGE_COMPOSITION_SLOTS = ["hero", "main", "sidebar", "bottom", "footer"] as const;

export type PageCompositionSlot = (typeof PAGE_COMPOSITION_SLOTS)[number];

/**
 * Known specialized content-module slugs grouped by typical slot assignment.
 * Generic blocks fall through to SectionRenderer when not listed here.
 */
export const SLOT_MODULE_SLUG_REGISTRY: Record<PageCompositionSlot, readonly string[]> = {
  hero: [],
  main: [
    "home-story",
    "home-trust",
    "home-contact",
    "home-projects",
    "about-intro",
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
    "topics-insight-cta",
  ],
  sidebar: [],
  bottom: [],
  footer: [],
};

export function isRegisteredSlotModuleSlug(slug: string) {
  return PAGE_COMPOSITION_SLOTS.some((slot) =>
    SLOT_MODULE_SLUG_REGISTRY[slot].includes(slug),
  );
}
