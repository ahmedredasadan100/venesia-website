import { buildHomeMainRenderPlan } from "../../components/home/build-home-main-render-plan";
import {
  HOME_MODULE_SLUGS,
  isHomeModuleSlug,
  type HomeModuleSlug,
} from "../page-blocks/home-module-slugs";
import type { PageComposition } from "../page-blocks/page-composition-types";

export const HOME_MODULE_ADMIN_LABELS: Record<HomeModuleSlug, string> = {
  "home-story": "قسم القصة",
  "home-projects": "قسم المشاريع (النصوص)",
  "home-trust": "قسم الثقة",
  "home-contact": "قسم التواصل",
};

export type HomepageFallbackStatusLevel =
  | "cms_managed"
  | "partial_fallback"
  | "full_fallback";

export type HomepageFallbackStatusReport = {
  status: HomepageFallbackStatusLevel;
  fallbackSections: Array<{ slug: HomeModuleSlug; label: string }>;
  cmsSections: Array<{ slug: HomeModuleSlug; label: string }>;
};

/**
 * Derives homepage main-slot fallback status from the same composition plan
 * used by the public render path (buildHomeMainRenderPlan).
 */
export function deriveHomepageFallbackStatus(
  composition: PageComposition,
): HomepageFallbackStatusReport {
  const plan = buildHomeMainRenderPlan(composition);
  const homeEntries = plan.filter((entry) => isHomeModuleSlug(entry.slug));

  const fallbackSections = homeEntries
    .filter((entry) => entry.source === "fallback")
    .map((entry) => {
      const slug = entry.slug as HomeModuleSlug;
      return { slug, label: HOME_MODULE_ADMIN_LABELS[slug] };
    });

  const cmsSections = homeEntries
    .filter((entry) => entry.source === "cms")
    .map((entry) => {
      const slug = entry.slug as HomeModuleSlug;
      return { slug, label: HOME_MODULE_ADMIN_LABELS[slug] };
    });

  const expectedHomeModules = HOME_MODULE_SLUGS.filter(
    (slug) => !(composition.hiddenHomeModuleSlugs ?? []).includes(slug),
  );

  let status: HomepageFallbackStatusLevel;
  if (fallbackSections.length === 0) {
    status = "cms_managed";
  } else if (cmsSections.length === 0 && fallbackSections.length === expectedHomeModules.length) {
    status = "full_fallback";
  } else {
    status = "partial_fallback";
  }

  return { status, fallbackSections, cmsSections };
}
