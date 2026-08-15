import { isSocialPlatform } from "../../../../../lib/footer/defaults";
import type {
  FooterContactSlotConfig,
  FooterSlotsConfig,
} from "../../../../../lib/footer/footer-slot-types";
import {
  normalizeFooterContactItem,
} from "../../../../../lib/footer/parse-footer-settings";
import type { FooterContactItem, FooterSocialLink } from "../../../../../lib/footer/types";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { AdminUserRecord } from "../../../../../lib/admin/auth/admin-users";
import type { Json } from "../../../../../lib/database.types";

export async function saveFooterSettingsWithAudit(input: {
  settings: { key: string; value: Json }[];
  actor: AdminUserRecord;
  action: string;
  metadata?: { [key: string]: Json | undefined };
}) {
  const { error } = await getSupabaseAdmin().rpc("save_footer_settings", {
    p_settings: input.settings,
    p_actor_admin_user_id: input.actor.id,
    p_actor_username: input.actor.username,
    p_action: input.action,
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
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
