import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import {
  asProjectsHubFeaturedConfig,
  asProjectsHubHeroConfig,
  asProjectsHubListingConfig,
  asProjectsHubMapConfig,
  isProjectsHubFeaturedTemplate,
  isProjectsHubHeroTemplate,
  isProjectsHubListingTemplate,
  isProjectsHubMapTemplate,
  type ProjectsHubFeaturedModuleConfig,
  type ProjectsHubHeroModuleConfig,
  type ProjectsHubListingModuleConfig,
  type ProjectsHubMapModuleConfig,
} from "../page-blocks/projects-hub-config";
import type { ProjectsHubComposition, ProjectsHubCompositionAssignment } from "./load-projects-hub-composition";

export const PROJECTS_HUB_SUPPORTED_SLUGS = [
  "projects-hub-hero",
  "projects-hub-featured",
  "projects-hub-listing",
  "projects-hub-map",
] as const;

export type ProjectsHubSupportedSlug = (typeof PROJECTS_HUB_SUPPORTED_SLUGS)[number];

/** Reasons that indicate a real composition/load failure (not incomplete CMS staging). */
export const PROJECTS_HUB_LOAD_ERROR_REASONS = [
  "page_query_failed",
  "page_missing",
  "assignments_query_failed",
  "unexpected_error",
] as const;

export function isProjectsHubLoadErrorReason(reason: string | null | undefined): boolean {
  return (PROJECTS_HUB_LOAD_ERROR_REASONS as readonly string[]).includes(reason ?? "");
}

export type ProjectsHubRenderPlanModule =
  | {
      slug: "projects-hub-hero";
      sortOrder: number;
      assignmentId: number;
      position: PageLayoutSlot;
      isVisible: true;
      config: ProjectsHubHeroModuleConfig;
    }
  | {
      slug: "projects-hub-featured";
      sortOrder: number;
      assignmentId: number;
      position: PageLayoutSlot;
      isVisible: true;
      config: ProjectsHubFeaturedModuleConfig;
    }
  | {
      slug: "projects-hub-listing";
      sortOrder: number;
      assignmentId: number;
      position: PageLayoutSlot;
      isVisible: true;
      config: ProjectsHubListingModuleConfig;
    }
  | {
      slug: "projects-hub-map";
      sortOrder: number;
      assignmentId: number;
      position: PageLayoutSlot;
      isVisible: true;
      config: ProjectsHubMapModuleConfig;
    };

export type ProjectsHubPlanResult =
  | {
      ready: true;
      modules: ProjectsHubRenderPlanModule[];
      skipped: Array<{ assignmentId: number; slug: string; reason: string }>;
    }
  | {
      ready: false;
      reason: string;
      modules: [];
      skipped: Array<{ assignmentId: number; slug: string; reason: string }>;
    };

function resolveSupportedSlug(assignment: ProjectsHubCompositionAssignment): ProjectsHubSupportedSlug | null {
  const { templateSlug, templateVariant } = assignment;
  if (isProjectsHubHeroTemplate(templateSlug, templateVariant)) return "projects-hub-hero";
  if (isProjectsHubFeaturedTemplate(templateSlug, templateVariant)) return "projects-hub-featured";
  if (isProjectsHubListingTemplate(templateSlug, templateVariant)) return "projects-hub-listing";
  if (isProjectsHubMapTemplate(templateSlug, templateVariant)) return "projects-hub-map";
  return null;
}

function parseModuleConfig(
  slug: ProjectsHubSupportedSlug,
  config: unknown,
):
  | { ok: true; value: ProjectsHubRenderPlanModule["config"] }
  | { ok: false; reason: string } {
  if (config != null && (typeof config !== "object" || Array.isArray(config))) {
    return { ok: false, reason: "config_not_object" };
  }

  try {
    if (slug === "projects-hub-hero") return { ok: true, value: asProjectsHubHeroConfig(config) };
    if (slug === "projects-hub-featured") return { ok: true, value: asProjectsHubFeaturedConfig(config) };
    if (slug === "projects-hub-listing") return { ok: true, value: asProjectsHubListingConfig(config) };
    return { ok: true, value: asProjectsHubMapConfig(config) };
  } catch {
    return { ok: false, reason: "config_parse_failed" };
  }
}

/**
 * Readiness policy (all-or-nothing):
 * - Collect visible published supported modules with valid config in their assigned Region.
 * - Skip unknown, draft, hidden, duplicate, and invalid-config modules.
 * - Plan is ready only when all four canonical hub modules are present.
 * - Composition load failures are handled by the caller before invoking this builder.
 */
export function buildProjectsHubRenderPlan(composition: ProjectsHubComposition): ProjectsHubPlanResult {
  const skipped: Array<{ assignmentId: number; slug: string; reason: string }> = [];
  const seen = new Set<ProjectsHubSupportedSlug>();
  const modules: ProjectsHubRenderPlanModule[] = [];

  const ordered = [...composition.assignments].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.assignmentId - b.assignmentId,
  );

  for (const assignment of ordered) {
    const supportedSlug = resolveSupportedSlug(assignment);

    if (!supportedSlug) {
      skipped.push({
        assignmentId: assignment.assignmentId,
        slug: assignment.templateSlug,
        reason: "unsupported_slug",
      });
      continue;
    }

    if (!assignment.isVisible) {
      skipped.push({
        assignmentId: assignment.assignmentId,
        slug: supportedSlug,
        reason: "hidden",
      });
      continue;
    }

    if (assignment.templateStatus !== "published") {
      skipped.push({
        assignmentId: assignment.assignmentId,
        slug: supportedSlug,
        reason: "template_unpublished",
      });
      continue;
    }

    if (seen.has(supportedSlug)) {
      skipped.push({
        assignmentId: assignment.assignmentId,
        slug: supportedSlug,
        reason: "duplicate_supported_slug",
      });
      continue;
    }

    const parsed = parseModuleConfig(supportedSlug, assignment.config);
    if (!parsed.ok) {
      skipped.push({
        assignmentId: assignment.assignmentId,
        slug: supportedSlug,
        reason: parsed.reason,
      });
      continue;
    }

    seen.add(supportedSlug);
    modules.push({
      slug: supportedSlug,
      sortOrder: assignment.sortOrder,
      assignmentId: assignment.assignmentId,
      position: assignment.slot,
      isVisible: true,
      config: parsed.value,
    } as ProjectsHubRenderPlanModule);
  }

  if (!modules.length) {
    return {
      ready: false,
      reason: skipped.length ? "no_valid_visible_modules" : "no_assignments",
      modules: [],
      skipped,
    };
  }

  const missing = PROJECTS_HUB_SUPPORTED_SLUGS.filter((slug) => !seen.has(slug));
  if (missing.length) {
    return {
      ready: false,
      reason: "incomplete_hub_modules",
      modules: [],
      skipped: [
        ...skipped,
        ...missing.map((slug) => ({
          assignmentId: 0,
          slug,
          reason: "required_module_missing",
        })),
      ],
    };
  }

  return { ready: true, modules, skipped };
}
