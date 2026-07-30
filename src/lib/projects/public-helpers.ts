import type { ProjectCategory, ProjectHubFilterId, PublicProject } from "./public-types";

export function getProjectHref(project: Pick<PublicProject, "slug">) {
  return `/projects/${project.slug}`;
}

export function getProjectTrackHref(project: Pick<PublicProject, "slug">) {
  return `/track-your-project/${project.slug}`;
}

/** Canonical Arabic labels for known project categories. Extend when ProjectCategory expands. */
export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  residential: "سكني",
  commercial: "تجاري",
};

/** Stable chip order for known categories. */
export const PROJECT_CATEGORY_FILTER_ORDER: ProjectCategory[] = ["residential", "commercial"];

export type HubFilterOption = {
  id: ProjectHubFilterId;
  label: string;
};

/**
 * Filter chips from categories present in the already-loaded projects array.
 * Always includes `all`. Does not invent Arabic labels for unknown types —
 * those cannot appear until ProjectCategory / DB check constraints are extended.
 */
export function getHubFilterOptionsFromProjects(projects: PublicProject[]): HubFilterOption[] {
  const present = new Set(projects.map((project) => project.category));
  const options: HubFilterOption[] = [{ id: "all", label: "كل المشروعات" }];

  for (const category of PROJECT_CATEGORY_FILTER_ORDER) {
    if (!present.has(category)) continue;
    options.push({
      id: category,
      label: PROJECT_CATEGORY_LABELS[category],
    });
  }

  return options;
}

export function preservePublicProjectOrder(projects: PublicProject[]) {
  return [...projects];
}

export function getProjectsByFilter(projects: PublicProject[], filterId: ProjectHubFilterId) {
  const sorted = preservePublicProjectOrder(projects);
  if (filterId === "all") return sorted;
  return sorted.filter((project) => project.category === filterId);
}

export function getFeaturedProjects(projects: PublicProject[]) {
  void projects;
  return [];
}

export function getProjectStats(projects: PublicProject[]) {
  return {
    total: projects.length,
    residential: projects.filter((project) => project.category === "residential").length,
    commercial: projects.filter((project) => project.category === "commercial").length,
  };
}
