import { getConstructionUpdatesPlanningData } from "../../../../lib/admin/projects/construction-updates-query";
import ConstructionUpdatesClient from "./ConstructionUpdatesClient";

export const dynamic = "force-dynamic";

export default async function ConstructionUpdatesPage() {
  const data = await getConstructionUpdatesPlanningData();
  return <ConstructionUpdatesClient projects={data.projects} siteUpdates={data.siteUpdates} />;
}
