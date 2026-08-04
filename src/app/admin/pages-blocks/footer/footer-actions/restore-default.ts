"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { DEFAULT_FOOTER_SLOTS } from "../../../../../lib/footer/defaults";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { FOOTER_SLOTS_SETTING_KEY } from "../../../../../lib/footer/types";
import { saveFooterSettingsWithAudit } from "./helpers";

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

  revalidateFooterPublicPaths();
  revalidatePath("/admin/pages-blocks/footer");

  return {
    ok: true as const,
    slots: defaultSlots,
    status: mediaSynchronizations.some(
      (item) => item.status === "saved_with_media_sync_warning",
    )
      ? ("warning" as const)
      : ("success" as const),
    mediaSynchronization:
      mediaSynchronizations.find(
        (item) => item.status === "saved_with_media_sync_warning",
      ) ?? mediaSynchronizations[0],
  };
}
