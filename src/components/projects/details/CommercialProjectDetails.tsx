import ProjectDetailsHero, {
  projectDetailsMainClassName,
} from "./ProjectDetailsHero";
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
    <main className={projectDetailsMainClassName(showProjectHero)} dir="rtl">
      {showProjectHero ? (
        <ProjectDetailsHero project={project} presentation={heroPresentation} />
      ) : null}
    </main>
  );
}
