import type { ProjectHubFilterId, PublicProject } from "./public-types";

export function getProjectHref(project: Pick<PublicProject, "slug">) {
  return `/projects/${project.slug}`;
}

export function sortProjectsByHomepageOrder(projects: PublicProject[]) {
  return [...projects].sort(
    (a, b) => a.homepageOrder - b.homepageOrder || a.code.localeCompare(b.code),
  );
}

export function getProjectsByFilter(projects: PublicProject[], filterId: ProjectHubFilterId) {
  const sorted = sortProjectsByHomepageOrder(projects);
  if (filterId === "all") return sorted;
  return sorted.filter((project) => project.category === filterId);
}

export function getFeaturedProjects(projects: PublicProject[]) {
  return sortProjectsByHomepageOrder(projects).filter((project) => project.featured);
}

export function getProjectStats(projects: PublicProject[]) {
  return {
    total: projects.length,
    residential: projects.filter((project) => project.category === "residential").length,
    commercial: projects.filter((project) => project.category === "commercial").length,
  };
}
