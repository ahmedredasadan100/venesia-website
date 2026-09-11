import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import {
  isProjectsHubFeaturedTemplate,
  isProjectsHubHeroTemplate,
  isProjectsHubListingTemplate,
  isProjectsHubMapTemplate,
  parseProjectsHubFeaturedPublicConfig,
  parseProjectsHubHeroPublicConfig,
  parseProjectsHubListingPublicConfig,
  parseProjectsHubMapPublicConfig,
  type ProjectsHubFeaturedModuleConfig,
  type ProjectsHubHeroModuleConfig,
  type ProjectsHubListingModuleConfig,
  type ProjectsHubMapModuleConfig,
  type ProjectsHubPublicConfigFailureReason,
} from "../page-blocks/projects-hub-config";
import type { ProjectsHubComposition, ProjectsHubCompositionAssignment } from "./load-projects-hub-composition";

export const PROJECTS_HUB_SUPPORTED_SLUGS = [
  "projects-hub-hero",
  "projects-hub-featured",
  "projects-hub-listing",
  "projects-hub-map",
] as const;

export type ProjectsHubSupportedSlug = (typeof PROJECTS_HUB_SUPPORTED_SLUGS)[number];

/** Infrastructure failures only; publication/config availability is separate. */
export const PROJECTS_HUB_LOAD_ERROR_REASONS = [
  "page_query_failed",
  "assignments_query_failed",
  "unexpected_error",
] as const;

export type ProjectsHubLoadErrorReason =
  (typeof PROJECTS_HUB_LOAD_ERROR_REASONS)[number];

export const PROJECTS_HUB_UNAVAILABLE_REASONS = [
  "page_unavailable",
  "no_assignments",
  "no_valid_visible_modules",
  "incomplete_hub_modules",
] as const;

export type ProjectsHubUnavailableReason =
  (typeof PROJECTS_HUB_UNAVAILABLE_REASONS)[number];

export function isProjectsHubLoadErrorReason(
  reason: string | null | undefined,
): reason is ProjectsHubLoadErrorReason {
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
      status: "ready";
      ready: true;
      modules: ProjectsHubRenderPlanModule[];
      skipped: Array<{ assignmentId: number; slug: string; reason: string }>;
    }
  | {
      status: "unavailable";
      ready: false;
      reason: ProjectsHubUnavailableReason;
      modules: [];
      skipped: Array<{ assignmentId: number; slug: string; reason: string }>;
    }
  | {
      status: "error";
      ready: false;
      reason: ProjectsHubLoadErrorReason;
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
  | { ok: false; reason: ProjectsHubPublicConfigFailureReason } {
  if (slug === "projects-hub-hero") {
    return parseProjectsHubHeroPublicConfig(config);
  }
  if (slug === "projects-hub-featured") {
    return parseProjectsHubFeaturedPublicConfig(config);
  }
  if (slug === "projects-hub-listing") {
    return parseProjectsHubListingPublicConfig(config);
  }
  return parseProjectsHubMapPublicConfig(config);
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
      status: "unavailable",
      ready: false,
      reason: skipped.length ? "no_valid_visible_modules" : "no_assignments",
      modules: [],
      skipped,
    };
  }

  const missing = PROJECTS_HUB_SUPPORTED_SLUGS.filter((slug) => !seen.has(slug));
  if (missing.length) {
    return {
      status: "unavailable",
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

  return { status: "ready", ready: true, modules, skipped };
}
