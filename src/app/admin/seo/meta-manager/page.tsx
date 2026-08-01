import { AdminPageExperience, AdminPageHeader } from "../../../../components/admin/ui";
import { loadGlobalSeoSettings } from "../../../../lib/seo/load-global-seo-settings";
import { getGlobalSeoDefaults } from "../../../../lib/seo/global-seo-defaults";
import MetaManagerClient from "./MetaManagerClient";

export const dynamic = "force-dynamic";

export default async function MetaManagerPage() {
  const settings = await loadGlobalSeoSettings().catch(() => getGlobalSeoDefaults());

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="GLOBAL SEO"
        title="Meta Manager"
        description={(
          <>
            الإعدادات العامة للموقع. القيم الفارغة تعود تلقائيًا إلى ملفات{" "}
            <code className="text-white/70">config/seo</code>.
          </>
        )}
      />
      <MetaManagerClient initialSettings={settings} />
    </AdminPageExperience>
  );
}
