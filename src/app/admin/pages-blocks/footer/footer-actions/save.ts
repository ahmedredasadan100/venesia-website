"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { synchronizeMediaReferencesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import { assertValidFooterSlots } from "../../../../../lib/footer/validate-footer-slots";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { FOOTER_SLOTS_SETTING_KEY, type FooterLegal } from "../../../../../lib/footer/types";
import type { FooterBuilderSaveInput } from "./types";
import {
  sanitizeContactItems,
  sanitizeSocialLinks,
  syncBrandFromSlots,
  upsertSetting,
  usesGlobalContactPool,
} from "./helpers";
import { isFooterContactItemPublic } from "../../../../../lib/footer/parse-footer-settings";

export async function saveFooterBuilderAction(input: FooterBuilderSaveInput) {
  await requireAdminSession();

  const validatedSlots = assertValidFooterSlots(input.slots);
  const contactItems = sanitizeContactItems(input.contactItems);
  const socialLinks = sanitizeSocialLinks(input.socialLinks);

  if (usesGlobalContactPool(validatedSlots) && !contactItems.some(isFooterContactItemPublic)) {
    throw new Error("أضف عنصر تواصل ظاهرًا واحدًا على الأقل للمجموعة العامة.");
  }

  if (!socialLinks.length) {
    throw new Error("أضف رابط سوشيال واحدًا على الأقل.");
  }

  const brand = syncBrandFromSlots(validatedSlots);
  const legal: FooterLegal = {
    copyright: input.legal.copyright.trim() || "Venesia Developments. All rights reserved.",
    tagline: input.legal.tagline.trim() || "Trust Built On Ground",
  };

  await upsertSetting(FOOTER_SLOTS_SETTING_KEY, validatedSlots);
  await upsertSetting("footer.brand", brand);
  await upsertSetting("footer.contact_items", contactItems);
  await upsertSetting("footer.social_links", socialLinks);
  await upsertSetting("footer.legal", legal);

  await Promise.all(
    [FOOTER_SLOTS_SETTING_KEY, "footer.brand", "footer.contact_items", "footer.social_links", "footer.legal"].map(
      (key) => synchronizeMediaReferencesAfterDomainMutation("site_settings", key),
    ),
  );

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("footer_settings", "update"),
    entityType: "footer_settings",
    entityLabel: FOOTER_SLOTS_SETTING_KEY,
    metadata: {
      slots_count: validatedSlots.slots.length,
      contact_items_count: contactItems.length,
      social_links_count: socialLinks.length,
    },
  });

  revalidateFooterPublicPaths();
  revalidatePath("/admin/pages-blocks/footer");

  return { ok: true as const };
}
