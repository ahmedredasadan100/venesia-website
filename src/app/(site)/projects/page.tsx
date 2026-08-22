import ProjectsHubPage from "../../../components/projects/ProjectsHubPage";
import { loadAndBuildProjectsHubPlan } from "../../../lib/projects/load-and-build-projects-hub-plan";
import { loadPublishedProjects } from "../../../lib/projects/load-published-projects";
import { logError } from "../../../lib/logging";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/projects" });
}

export default async function ProjectsPage() {
  const projects = await loadPublishedProjects();

  const plan = await loadAndBuildProjectsHubPlan();

  if (!plan.ready) {
    logError("Projects Hub composition load failed", new Error(plan.reason), {
      reason: plan.reason,
    });
    throw new Error("تعذر تحميل صفحة المشروعات. حاول مرة أخرى لاحقًا.");
  }

  return <ProjectsHubPage projects={projects} modulePlan={plan.modules} />;
}
