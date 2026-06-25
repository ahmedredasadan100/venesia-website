import MaintenanceModePanel from "./MaintenanceModePanel";
import { getMaintenanceModeSetting } from "../../../../lib/maintenance/site-settings";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  const maintenanceEnabled = await getMaintenanceModeSetting().catch(() => false);

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-[28px] border border-white/10 bg-[#080B10]/78 p-6">
        <h1 className="text-2xl font-semibold text-white">الإعدادات العامة</h1>
        <p className="mt-2 text-sm leading-7 text-white/55">إدارة إعدادات الموقع العامة من لوحة التحكم.</p>
      </section>

      <MaintenanceModePanel initialEnabled={maintenanceEnabled} />
    </div>
  );
}
