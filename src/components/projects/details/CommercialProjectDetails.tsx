import ProjectDetailsHero from "./ProjectDetailsHero";
import { type PublicProject } from "../../../lib/projects/public-types";

type CommercialProjectDetailsProps = {
  project: PublicProject;
  heroPresentation?: Parameters<typeof ProjectDetailsHero>[0]["presentation"];
  showProjectHero?: boolean;
};

export default function CommercialProjectDetails({
  project,
  heroPresentation,
  showProjectHero = true,
}: CommercialProjectDetailsProps) {
  return (
    <main className="min-h-screen bg-[#05070B] text-white" dir="rtl">
      {showProjectHero ? (
        <ProjectDetailsHero project={project} presentation={heroPresentation} />
      ) : null}
    </main>
  );
}
