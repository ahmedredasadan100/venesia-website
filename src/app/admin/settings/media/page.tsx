import { AdminPageContextHeader, AdminPageExperience } from "../../../../components/admin/ui";
import {
  getMediaCatalogRuntimeState,
  listMediaCatalogSnapshot,
} from "../../../../lib/admin/media-catalog/catalog";
import { buildMediaCatalogReadiness } from "../../../../lib/admin/media-catalog/readiness";
import { MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION } from "../../../../lib/admin/media-catalog/reference-providers";
import { DEFAULT_MEDIA_SETTINGS, loadMediaSettings } from "../../../../lib/admin/media-catalog/settings";
import {
  listPublicMediaInventory,
  resolveMediaStorageRuntimeContext,
} from "../../../../lib/admin/media-library";
import MediaSettingsPanel from "./MediaSettingsPanel";

export const dynamic = "force-dynamic";

export default async function MediaSettingsPage() {
  const [settings, catalog, inventory, runtimeState] = await Promise.all([
    loadMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    listMediaCatalogSnapshot(),
    listPublicMediaInventory(),
    getMediaCatalogRuntimeState().catch(() => null),
  ]);
  const readiness = buildMediaCatalogReadiness(
    catalog,
    inventory,
    runtimeState,
    resolveMediaStorageRuntimeContext(),
    MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION,
  );

  return (
    <AdminPageExperience className="pb-10">
      <AdminPageContextHeader
        eyebrow="إعدادات رفع الملفات"
        title="إعدادات الميديا"
        description="تحكم في أنواع الملفات وأحجامها المسموح بها عند الرفع من لوحة الإدارة."
      />
      <MediaSettingsPanel settings={settings} readiness={readiness} />
    </AdminPageExperience>
  );
}
