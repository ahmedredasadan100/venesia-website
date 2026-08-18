import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { loadProjectTrackingHub } from "../../../../lib/admin/projects/tracking-hub";
import ConstructionUpdatesClient from "./ConstructionUpdatesClient";

export const dynamic = "force-dynamic";

export default async function ConstructionUpdatesPage() {
  await requireAdminSession();
  const data = await loadProjectTrackingHub();
  return <ConstructionUpdatesClient projects={data.projects} schemaAvailable={data.schemaAvailable} />;
}
