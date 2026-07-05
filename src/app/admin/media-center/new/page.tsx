import { redirect } from "next/navigation";
import { UNIFIED_MEDIA_ADMIN_NEW_PATH } from "../../../../lib/admin/legacy-media-admin-routes";

export const dynamic = "force-dynamic";

export default function LegacyMediaCenterNewAdminPage() {
  redirect(UNIFIED_MEDIA_ADMIN_NEW_PATH);
}
