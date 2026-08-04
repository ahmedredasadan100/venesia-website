import { AdminPageExperience, AdminPageHeader } from "../../../../components/admin/ui";
import { loadGlobalSeoEffectiveContractForAdmin } from "../../../../lib/seo/load-global-seo-settings";
import { resolveGlobalSeoEffectiveContract } from "../../../../lib/seo/resolve-global-seo-effective";
import MetaManagerClient from "./MetaManagerClient";

export const dynamic = "force-dynamic";

export default async function MetaManagerPage() {
  const contract = await loadGlobalSeoEffectiveContractForAdmin().catch((error) =>
    resolveGlobalSeoEffectiveContract({
      databaseStatus: "error",
      databaseError: error instanceof Error ? error.message : "Unknown database failure",
    }),
  );

  return (
    <AdminPageExperience dir="rtl">
      <AdminPageHeader
        eyebrow="GLOBAL SEO"
        title="Meta Manager"
        description="عقد Global SEO الفعلي بترتيب Database ثم Environment ثم Code Fallback. الحقول الموروثة لا تظهر كأنها قيم محفوظة."
        meta={contract.databaseStatus === "loaded" ? "Database connected" : `Database ${contract.databaseStatus}`}
      />
      <MetaManagerClient contract={contract} />
    </AdminPageExperience>
  );
}
