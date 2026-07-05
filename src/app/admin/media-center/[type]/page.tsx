import { redirect } from "next/navigation";
import { getUnifiedMediaAdminPathFromLegacyTypePath } from "../../../../lib/admin/legacy-media-admin-routes";

export const dynamic = "force-dynamic";

export default async function LegacyMediaCenterTypeAdminPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  redirect(getUnifiedMediaAdminPathFromLegacyTypePath(type));
}
