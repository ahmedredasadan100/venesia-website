import { AdminPageContextHeader, AdminPageExperience } from "../../../../components/admin/ui";
import { getMediaCatalogRuntimeState } from "../../../../lib/admin/media-catalog/catalog";
import { DEFAULT_MEDIA_SETTINGS, loadMediaSettings } from "../../../../lib/admin/media-catalog/settings";
import { resolveMediaStorageProvider } from "../../../../lib/admin/media-storage-adapter";
import { CMS_DOCUMENTS_BUCKET, CMS_IMAGES_BUCKET } from "../../../../lib/storage/upload-cms-asset";
import MediaSettingsPanel from "./MediaSettingsPanel";

export const dynamic = "force-dynamic";

export default async function MediaSettingsPage() {
  const [settings, catalogState] = await Promise.all([
    loadMediaSettings().catch(() => DEFAULT_MEDIA_SETTINGS),
    getMediaCatalogRuntimeState().catch(() => null),
  ]);

  return (
    <AdminPageExperience className="pb-10">
      <AdminPageContextHeader
        eyebrow="MEDIA SETTINGS"
        title="إعدادات الميديا"
        description="سياسة الرفع الآمن، حالة التخزين، وشفافية Media Catalog من مالكي الإعدادات والتخزين الحاليين."
      />
      <MediaSettingsPanel
        settings={settings}
        catalogState={catalogState}
        storage={{
          provider: resolveMediaStorageProvider(),
          imageBucket: CMS_IMAGES_BUCKET,
          documentBucket: CMS_DOCUMENTS_BUCKET,
        }}
      />
    </AdminPageExperience>
  );
}
