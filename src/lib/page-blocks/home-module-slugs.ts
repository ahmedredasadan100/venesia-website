import {
  isHomeContactTemplate,
  isHomeProjectsTemplate,
  isHomeStoryTemplate,
  isHomeTrustTemplate,
} from "./configs";

/** Product-approved home main slot slugs. */
export const HOME_MODULE_SLUGS = [
  "home-story",
  "home-projects",
  "home-trust",
  "home-contact",
] as const;

export type HomeModuleSlug = (typeof HOME_MODULE_SLUGS)[number];

export function resolveHomeModuleSlugFromTemplate(
  templateSlug: string,
  variant?: string | null,
): HomeModuleSlug | null {
  if (isHomeStoryTemplate(templateSlug, variant)) return "home-story";
  if (isHomeProjectsTemplate(templateSlug, variant)) return "home-projects";
  if (isHomeTrustTemplate(templateSlug, variant)) return "home-trust";
  if (isHomeContactTemplate(templateSlug, variant)) return "home-contact";
  return null;
}
