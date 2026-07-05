import { redirect } from "next/navigation";
import { UNIFIED_TOPIC_CATEGORIES_PATH } from "../../../../../lib/admin/legacy-media-admin-routes";

export const dynamic = "force-dynamic";

export default function LegacyMediaCenterCategoryAdminPage() {
  redirect(UNIFIED_TOPIC_CATEGORIES_PATH);
}
