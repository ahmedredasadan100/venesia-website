import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { ADMIN_COMPANY_DEFAULT } from "../../../../config/admin/company";
import { loadAdminCompanyConfig } from "../../../../lib/admin/shell/company-config";
import { logError } from "../../../../lib/logging";
import { getMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";
import CompanyIdentityPanel from "./CompanyIdentityPanel";
import MaintenanceModePanel from "./MaintenanceModePanel";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const [maintenanceSetting, company] = await Promise.all([
    getMaintenanceModeSetting()
      .then((enabled) => ({ status: "ready" as const, enabled }))
      .catch((error) => {
        logError("Maintenance mode setting read failed", error);
        return { status: "unavailable" as const };
      }),
    loadAdminCompanyConfig(ADMIN_COMPANY_DEFAULT),
  ]);

  return (
    <AdminPageExperience className="pb-10">
      <AdminPageContextHeader
        eyebrow="ADMIN SETTINGS"
        title="الإعدادات العامة"
        description="إدارة هوية لوحة الإدارة وإعدادات الموقع العامة من مصدر واضح وقابل للتحديث."
      />
      <CompanyIdentityPanel company={company} />
      <MaintenanceModePanel
        key={maintenanceSetting.status === "ready" ? `ready-${maintenanceSetting.enabled}` : "unavailable"}
        initialReadState={maintenanceSetting}
      />
    </AdminPageExperience>
  );
}
