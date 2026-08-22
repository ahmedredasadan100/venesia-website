/** Maps module slugs / variants to structured admin editor keys. */
export type ContentModuleEditorKey =
  | "about-intro"
  | "about-intro-single-image"
  | "home-story"
  | "home-trust"
  | "home-contact"
  | "home-projects"
  | "vision-goals"
  | "about-cta"
  | "about-principles"
  | "about-approach"
  | "projects-hub-hero"
  | "projects-hub-featured"
  | "projects-hub-listing"
  | "projects-hub-map"
  | "generic";

/**
 * Internal template identifiers used by editorKey / renderer mapping.
 * Not public URL slugs — changing them breaks composition routing.
 */
export const STRUCTURAL_CONTENT_TEMPLATE_SLUGS = [
  "about-intro",
  "about-intro-single-image",
  "vision-goals",
  "about-cta",
  "about-principles",
  "about-approach",
  "home-story",
  "home-contact",
  "home-trust",
  "home-projects",
  "projects-hub-hero",
  "projects-hub-featured",
  "projects-hub-listing",
  "projects-hub-map",
] as const;

export function isStructuralContentTemplateSlug(slug: string | null | undefined, variant?: string | null) {
  const candidates = [slug, variant].filter(Boolean) as string[];
  return candidates.some((value) =>
    (STRUCTURAL_CONTENT_TEMPLATE_SLUGS as readonly string[]).includes(value),
  );
}

export function getContentModuleEditorKey(slug: string, variant: string): ContentModuleEditorKey {
  if (slug === "projects-hub-hero" || variant === "projects-hub-hero") return "projects-hub-hero";
  if (slug === "projects-hub-featured" || variant === "projects-hub-featured") return "projects-hub-featured";
  if (slug === "projects-hub-listing" || variant === "projects-hub-listing") return "projects-hub-listing";
  if (slug === "projects-hub-map" || variant === "projects-hub-map") return "projects-hub-map";
  if (slug === "home-story" || variant === "home-story") return "home-story";
  if (slug === "home-trust" || variant === "home-trust") return "home-trust";
  if (slug === "home-contact" || variant === "home-contact") return "home-contact";
  if (slug === "home-projects" || variant === "home-projects") return "home-projects";
  if (slug === "about-intro-single-image" || variant === "about-intro-single-image") {
    return "about-intro-single-image";
  }
  if (slug === "about-intro" || variant === "about-intro") return "about-intro";
  if (slug === "vision-goals" || variant === "vision-goals") return "vision-goals";
  if (slug === "about-cta" || variant === "about-cta") return "about-cta";
  if (slug === "about-principles" || variant === "about-principles") return "about-principles";
  if (slug === "about-approach" || variant === "about-approach") return "about-approach";
  return "generic";
}

/**
 * Resolves the product-facing module kind without changing its persistence family.
 * Projects Hub Hero is stored and routed through Content composition, but its
 * editor and public purpose are Hero. All other modules keep their physical kind.
 */
export function resolveModuleProductKind(
  moduleKind: string,
  slug?: string | null,
  variant?: string | null,
) {
  if (
    moduleKind === "content" &&
    getContentModuleEditorKey(slug ?? "", variant ?? "") === "projects-hub-hero"
  ) {
    return "hero";
  }

  return moduleKind;
}
