"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { DEFAULT_FOOTER_SLOTS } from "../../../../../lib/footer/defaults";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { FOOTER_SLOTS_SETTING_KEY } from "../../../../../lib/footer/types";
import { syncBrandFromSlots, upsertSetting } from "./helpers";

export async function restoreDefaultFooterAction() {
  await requireAdminSession();

  const defaultSlots = structuredClone(DEFAULT_FOOTER_SLOTS);
  const brand = syncBrandFromSlots(defaultSlots);

  await upsertSetting(FOOTER_SLOTS_SETTING_KEY, defaultSlots);
  await upsertSetting("footer.brand", brand);
  await Promise.all(
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
  };
}
