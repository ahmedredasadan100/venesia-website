"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { coordinateMediaReferenceDomainMutation } from "../../../../../lib/admin/media-catalog/domain-write-coordination";
import { buildMediaReferenceWriteScope } from "../../../../../lib/admin/media-catalog/reference-providers";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../../lib/admin/media-catalog/write-lease";
import { isFooterContactItemPublic } from "../../../../../lib/footer/parse-footer-settings";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { FOOTER_SLOTS_SETTING_KEY, type FooterLegal } from "../../../../../lib/footer/types";
import { assertValidFooterSlots } from "../../../../../lib/footer/validate-footer-slots";
import type { FooterBuilderSaveInput } from "./types";
import {
  sanitizeContactItems,
  sanitizeSocialLinks,
  saveFooterSettingsWithAudit,
  usesGlobalContactPool,
} from "./helpers";

export async function saveFooterBuilderAction(input: FooterBuilderSaveInput) {
  const adminUser = await requireAdminSession();

  const validatedSlots = assertValidFooterSlots(input.slots);
  const contactItems = sanitizeContactItems(input.contactItems);
  const socialLinks = sanitizeSocialLinks(input.socialLinks);

  if (usesGlobalContactPool(validatedSlots) && !contactItems.some(isFooterContactItemPublic)) {
    throw new Error("أضف عنصر تواصل ظاهرًا واحدًا على الأقل للمجموعة العامة.");
  }

  if (!socialLinks.length) {
    throw new Error("أضف رابط سوشيال واحدًا على الأقل.");
  }

  const legal: FooterLegal = {
    copyright: input.legal.copyright.trim() || "Venesia Developments. All rights reserved.",
    tagline: input.legal.tagline.trim() || "Trust Built On Ground",
  };
  const settings = [
    { key: FOOTER_SLOTS_SETTING_KEY, value: validatedSlots },
    { key: "footer.contact_items", value: contactItems },
    { key: "footer.social_links", value: socialLinks },
    { key: "footer.legal", value: legal },
  ] as const;
  const targets = settings.map((setting) => ({
    domainKey: "site_settings",
    entityIdentity: setting.key,
    leaseEntityIdentity: setting.key,
  }));

  const coordinated = await (async () => {
    try {
      return await coordinateMediaReferenceDomainMutation({
        scopes: settings.map((setting) =>
          buildMediaReferenceWriteScope("site_settings", setting.key, setting),
        ),
        actorId: adminUser.id,
        requestIdentity: `footer:update:${crypto.randomUUID()}`,
        mutate: async () => {
          await saveFooterSettingsWithAudit({
            settings,
            actor: adminUser,
            action: "footer_settings.update",
            metadata: {
              slots_count: validatedSlots.slots.length,
              contact_items_count: contactItems.length,
              social_links_count: socialLinks.length,
            },
          });
          return settings;
        },
        resolveEntityIdentity: () => FOOTER_SLOTS_SETTING_KEY,
        synchronize: ({ leaseToken }) =>
          synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets, leaseToken),
      });
    } catch (error) {
      if (error instanceof MediaReferenceWriteLeaseError) {
        throw new Error(getMediaReferenceWriteLeaseUserMessage(error.code));
      }
      throw error;
    }
  })();

  revalidateFooterPublicPaths();
  revalidatePath("/admin/pages-blocks/footer");

  return {
    ok: true as const,
    status:
      coordinated.mediaSynchronization.status === "saved_with_media_sync_warning"
        ? ("warning" as const)
        : ("success" as const),
    code: coordinated.mediaSynchronization.status,
    mediaSynchronization: coordinated.mediaSynchronization,
  };
}
