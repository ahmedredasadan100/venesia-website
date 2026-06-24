import "server-only";

import { loadPublishedProjects } from "./load-published-projects";
import type { HomepageProjectCard } from "./types";

/**
 * Published homepage carousel projects — single source of truth: projects table.
 */
export async function loadHomepageProjects(): Promise<HomepageProjectCard[]> {
  const projects = await loadPublishedProjects({ showOnHomepageOnly: true });

  return projects.map((project) => ({
    id: Number(project.id),
    slug: project.slug,
    code: project.code,
    englishName: project.englishName,
    locationLabel: project.locationLabel,
    shortDescription: project.shortDescription,
    image: project.image,
  }));
}
