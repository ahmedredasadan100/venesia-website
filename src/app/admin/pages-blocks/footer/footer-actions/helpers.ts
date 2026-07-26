import {
  DEFAULT_FOOTER_BRAND,
  isSocialPlatform,
} from "../../../../../lib/footer/defaults";
import type {
  FooterContactSlotConfig,
  FooterSlotsConfig,
  FooterTextSlotConfig,
} from "../../../../../lib/footer/footer-slot-types";
import {
  normalizeFooterContactItem,
} from "../../../../../lib/footer/parse-footer-settings";
import type { FooterBrand, FooterContactItem, FooterSocialLink } from "../../../../../lib/footer/types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export async function upsertSettings(
  settings: readonly { key: string; value: unknown }[],
) {
  const updatedAt = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert(
      settings.map((setting) => ({
        key: setting.key,
        value: setting.value,
        updated_at: updatedAt,
      })),
      { onConflict: "key" },
    );

  if (error) throw new Error(error.message);
}

export async function upsertSetting(key: string, value: unknown) {
  await upsertSettings([{ key, value }]);
}

export function syncBrandFromSlots(slots: FooterSlotsConfig): FooterBrand {
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

export function usesGlobalContactPool(slots: FooterSlotsConfig) {
  return slots.slots.some((slot) => {
    if (!slot.enabled || slot.type !== "contact") return false;
    return (slot.config as FooterContactSlotConfig).source === "global";
  });
}

export function sanitizeSocialLinks(links: FooterSocialLink[]): FooterSocialLink[] {
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

export function sanitizeContactItems(items: FooterContactItem[]): FooterContactItem[] {
  const parsed: FooterContactItem[] = [];

  for (const item of items) {
    const normalized = normalizeFooterContactItem(item);
    if (normalized) parsed.push(normalized);
  }

  return parsed;
}
