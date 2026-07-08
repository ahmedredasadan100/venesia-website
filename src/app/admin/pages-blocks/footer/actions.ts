"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_FOOTER_BRAND,
  DEFAULT_FOOTER_SLOTS,
  isSocialPlatform,
} from "../../../../lib/footer/defaults";
import type {
  FooterContactSlotConfig,
  FooterSlotsConfig,
  FooterTextSlotConfig,
} from "../../../../lib/footer/footer-slot-types";
import { revalidateFooterPublicPaths } from "../../../../lib/footer/revalidate-footer";
import {
  isFooterContactItemPublic,
  normalizeFooterContactItem,
} from "../../../../lib/footer/parse-footer-settings";
import { FOOTER_SLOTS_SETTING_KEY, type FooterBrand, type FooterContactItem, type FooterLegal, type FooterSocialLink } from "../../../../lib/footer/types";
import { assertValidFooterSlots } from "../../../../lib/footer/validate-footer-slots";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export type FooterMenuOption = {
  id: number;
  name: string;
  location: string;
};

export type FooterQuickLinkInput = {
  id?: number;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
};

export type FooterBuilderSaveInput = {
  slots: FooterSlotsConfig;
  contactItems: FooterContactItem[];
  socialLinks: FooterSocialLink[];
  legal: FooterLegal;
};

async function upsertSetting(key: string, value: unknown) {
  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) throw new Error(error.message);
}

function syncBrandFromSlots(slots: FooterSlotsConfig): FooterBrand {
  const textSlot = slots.slots.find((slot) => slot.type === "text");
  const contactSlot = slots.slots.find((slot) => slot.type === "contact");
  const mediaSlot = slots.slots.find((slot) => slot.type === "media");
  const textConfig =
    textSlot?.type === "text" ? (textSlot.config as FooterTextSlotConfig) : null;

  return {
    title: textConfig ? textConfig.title.trim() : DEFAULT_FOOTER_BRAND.title,
    tagline: textConfig?.body.trim() || DEFAULT_FOOTER_BRAND.tagline,
    contactHeading: contactSlot?.heading?.trim() || DEFAULT_FOOTER_BRAND.contactHeading,
    mediaHeading: mediaSlot?.heading?.trim() || DEFAULT_FOOTER_BRAND.mediaHeading,
  };
}

function usesGlobalContactPool(slots: FooterSlotsConfig) {
  return slots.slots.some((slot) => {
    if (!slot.enabled || slot.type !== "contact") return false;
    return (slot.config as FooterContactSlotConfig).source === "global";
  });
}

function sanitizeSocialLinks(links: FooterSocialLink[]): FooterSocialLink[] {
  const parsed: FooterSocialLink[] = [];

  for (const link of links) {
    const platform = isSocialPlatform(link.platform) ? link.platform : "facebook";
    const label = link.label.trim();
    const href = link.href.trim();
    if (!label || !href) continue;
    parsed.push({
      platform,
      label,
      href,
      visible: link.visible === false ? false : undefined,
    });
  }

  return parsed;
}

function sanitizeContactItems(items: FooterContactItem[]): FooterContactItem[] {
  const parsed: FooterContactItem[] = [];

  for (const item of items) {
    const normalized = normalizeFooterContactItem(item);
    if (normalized) parsed.push(normalized);
  }

  return parsed;
}

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

export async function restoreDefaultFooterAction() {
  await requireAdminSession();

  const defaultSlots = structuredClone(DEFAULT_FOOTER_SLOTS);
  const brand = syncBrandFromSlots(defaultSlots);

  await upsertSetting(FOOTER_SLOTS_SETTING_KEY, defaultSlots);
  await upsertSetting("footer.brand", brand);

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
