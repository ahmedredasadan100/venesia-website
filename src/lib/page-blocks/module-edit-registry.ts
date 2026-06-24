/** Maps module slugs / variants to structured admin editor keys. */
export type ContentModuleEditorKey =
  | "about-intro"
  | "home-story"
  | "home-trust"
  | "home-contact"
  | "home-projects"
  | "vision-goals"
  | "about-cta"
  | "about-principles"
  | "about-approach"
  | "generic";

export function getContentModuleEditorKey(slug: string, variant: string): ContentModuleEditorKey {
  if (slug === "home-story" || variant === "home-story") return "home-story";
  if (slug === "home-trust" || variant === "home-trust") return "home-trust";
  if (slug === "home-contact" || variant === "home-contact") return "home-contact";
  if (slug === "home-projects" || variant === "home-projects") return "home-projects";
  if (slug === "about-intro" || variant === "about-intro") return "about-intro";
  if (slug === "vision-goals" || variant === "vision-goals") return "vision-goals";
  if (slug === "about-cta" || variant === "about-cta") return "about-cta";
  if (slug === "about-principles" || variant === "about-principles") return "about-principles";
  if (slug === "about-approach" || variant === "about-approach") return "about-approach";
  return "generic";
}
