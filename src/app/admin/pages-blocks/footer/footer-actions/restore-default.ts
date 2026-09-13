"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { DEFAULT_FOOTER_SLOTS } from "../../../../../lib/footer/defaults";
import { FOOTER_SLOTS_SETTING_KEY } from "../../../../../lib/footer/types";
import { completeFooterSettingsMutationResult, saveFooterSettingsWithAudit } from "./helpers";

export async function restoreDefaultFooterAction() {
  const adminUser = await requireAdminSession();

  const defaultSlots = structuredClone(DEFAULT_FOOTER_SLOTS);

  await saveFooterSettingsWithAudit({
    settings: [{ key: FOOTER_SLOTS_SETTING_KEY, value: defaultSlots }],
    actor: adminUser,
    action: "footer_settings.restore_default",
    metadata: { slots_count: defaultSlots.slots.length },
  });
  const mediaSynchronizations = [
    await synchronizeMediaReferencesAfterDomainMutation("site_settings", FOOTER_SLOTS_SETTING_KEY),
  ];

  return {
    ...await completeFooterSettingsMutationResult(
      mediaSynchronizations.find((item) => item.status === "saved_with_media_sync_warning") ?? mediaSynchronizations[0],
      "تمت استعادة تخطيط الفوتر الافتراضي بنجاح.",
    ),
    slots: defaultSlots,
  };
}
