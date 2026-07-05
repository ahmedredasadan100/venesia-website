import { redirect } from "next/navigation";
import { UNIFIED_MEDIA_ADMIN_PATH } from "../../../../../../lib/admin/legacy-media-admin-routes";

export const dynamic = "force-dynamic";

export default function LegacyMediaCenterItemPreviewAdminPage() {
  redirect(UNIFIED_MEDIA_ADMIN_PATH);
}
