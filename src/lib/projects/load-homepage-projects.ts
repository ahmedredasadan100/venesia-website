import "server-only";

import { loadPublishedProjects } from "./load-published-projects";
import type { HomepageProjectCard } from "./public-types";

/**
 * Published homepage carousel projects — single source of truth: projects table.
 */
export async function loadHomepageProjects(): Promise<HomepageProjectCard[]> {
  const projects = await loadPublishedProjects();

  return projects.map((project) => ({
    id: Number(project.id),
    slug: project.slug,
    englishName: project.englishName,
    locationLabel: project.location.label,
    shortDescription: project.shortDescription,
    cardImage: project.cardImage,
  }));
}
