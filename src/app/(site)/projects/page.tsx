import ProjectsHubPage from "../../../components/projects/ProjectsHubPage";
import { loadAndBuildProjectsHubPlan } from "../../../lib/projects/load-and-build-projects-hub-plan";
import { loadPublishedProjects } from "../../../lib/projects/load-published-projects";
import { isProjectsHubCmsEnabled } from "../../../lib/projects/projects-hub-cms-flag";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/projects" });
}

export default async function ProjectsPage() {
  const projects = await loadPublishedProjects();

  // Phase 3A: CMS render foundation is inactive by default.
  if (!isProjectsHubCmsEnabled()) {
    return <ProjectsHubPage projects={projects} />;
  }

  const plan = await loadAndBuildProjectsHubPlan();
  if (!plan.ready) {
    return <ProjectsHubPage projects={projects} />;
  }

  return <ProjectsHubPage projects={projects} modulePlan={plan.modules} />;
}
