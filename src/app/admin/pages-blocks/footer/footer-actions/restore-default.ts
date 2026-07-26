"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { DEFAULT_FOOTER_SLOTS } from "../../../../../lib/footer/defaults";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { FOOTER_SLOTS_SETTING_KEY } from "../../../../../lib/footer/types";
import { syncBrandFromSlots, upsertSettings } from "./helpers";

export async function restoreDefaultFooterAction() {
  await requireAdminSession();

  const defaultSlots = structuredClone(DEFAULT_FOOTER_SLOTS);
  const brand = syncBrandFromSlots(defaultSlots);

  await upsertSettings([
    { key: FOOTER_SLOTS_SETTING_KEY, value: defaultSlots },
    { key: "footer.brand", value: brand },
  ]);
  const mediaSynchronizations = await Promise.all(
    [FOOTER_SLOTS_SETTING_KEY, "footer.brand"].map((key) =>
      synchronizeMediaReferencesAfterDomainMutation("site_settings", key),
    ),
  );

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("footer_settings", "restore_default"),
    entityType: "footer_settings",
    entityLabel: FOOTER_SLOTS_SETTING_KEY,
  });

  revalidateFooterPublicPaths();
  revalidatePath("/admin/pages-blocks/footer");

  return {
    ok: true as const,
    slots: defaultSlots,
    brand,
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
