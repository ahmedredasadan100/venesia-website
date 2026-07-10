import ProjectsHubPage from "../../../components/projects/ProjectsHubPage";
import { loadPublishedProjects } from "../../../lib/projects/load-published-projects";
import { generatePublicMetadata } from "../../../lib/seo/generate-public-metadata";

export const revalidate = 300;

export async function generateMetadata() {
  return generatePublicMetadata({ path: "/projects" });
}

export default async function ProjectsPage() {
  const projects = await loadPublishedProjects();
  return <ProjectsHubPage projects={projects} />;
}
