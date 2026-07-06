import ProjectsHubPage from "../../../components/projects/ProjectsHubPage";
import { loadPublishedProjects } from "../../../lib/projects/load-published-projects";
import { buildMetadata } from "../../../lib/seo/build-metadata";

export const metadata = buildMetadata({ path: "/projects" });
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await loadPublishedProjects();
  return <ProjectsHubPage projects={projects} />;
}
