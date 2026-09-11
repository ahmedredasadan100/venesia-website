import ProjectsHubPage, {
  ProjectsHubUnavailableState,
} from "../../../components/projects/ProjectsHubPage";
import {
  loadAndBuildProjectsHubPlan,
  ProjectsHubPublicReadError,
} from "../../../lib/projects/load-and-build-projects-hub-plan";
import { loadPublishedProjects } from "../../../lib/projects/load-published-projects";
import { logWarn } from "../../../lib/logging";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";
import { getPublicPageRoute } from "../../../lib/admin/links/static-routes";

export const revalidate = 300;
const PAGE_IDENTITY = getPublicPageRoute("projects");

export async function generateMetadata() {
  return generatePublicMetadata({ path: PAGE_IDENTITY.href });
}

export default async function ProjectsPage() {
  const plan = await loadAndBuildProjectsHubPlan();

  if (plan.status === "unavailable") {
    logWarn("Projects Hub public configuration unavailable", {
      reason: plan.reason,
    });
    return <ProjectsHubUnavailableState />;
  }

  if (plan.status === "error") {
    throw new ProjectsHubPublicReadError(plan.reason);
  }

  const projects = await loadPublishedProjects();
  return <ProjectsHubPage projects={projects} modulePlan={plan.modules} />;
}
