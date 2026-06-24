import ProjectDetailsHero from "./ProjectDetailsHero";
import { type PublicProject } from "../../../lib/projects/public-types";

type CommercialProjectDetailsProps = {
  project: PublicProject;
};

export default function CommercialProjectDetails({
  project,
}: CommercialProjectDetailsProps) {
  return (
    <main className="min-h-screen bg-[#05070B] text-white" dir="rtl">
      <ProjectDetailsHero project={project} />
    </main>
  );
}
