import {
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import { ADMIN_COMPANY_DEFAULT } from "../../../../config/admin/company";
import { loadAdminCompanyConfig } from "../../../../lib/admin/shell/company-config";
import { getMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";
import CompanyIdentityPanel from "./CompanyIdentityPanel";
import MaintenanceModePanel from "./MaintenanceModePanel";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const [maintenanceEnabled, company] = await Promise.all([
    getMaintenanceModeSetting().catch(() => false),
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
      <MaintenanceModePanel initialEnabled={maintenanceEnabled} />
    </AdminPageExperience>
  );
}
