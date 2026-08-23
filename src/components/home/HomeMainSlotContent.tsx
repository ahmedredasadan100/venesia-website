import { PageSlotContent } from "../page-composition/PageSlotLayout";
import type { HomepageProjectCard } from "../../lib/projects/public-types";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import { getSlotEntries } from "../../lib/page-blocks/page-composition-utils";

type HomeMainSlotContentProps = {
  composition: PageComposition;
  homepageProjects: HomepageProjectCard[];
};

/** Home keeps its visual shell while adopting the canonical slot render plan. */
export default function HomeMainSlotContent({
  composition,
  homepageProjects,
}: HomeMainSlotContentProps) {
  return (
    <div
      className="page-layout-slot"
      data-layout-slot="main"
      data-home-main-slot="shared"
    >
      <PageSlotContent
        entries={getSlotEntries(composition, "main")}
        homepageProjects={homepageProjects}
      />
    </div>
  );
}
