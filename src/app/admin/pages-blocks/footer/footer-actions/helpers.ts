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
import type { MediaReferenceSynchronizationResult } from "../../../../../lib/admin/media-catalog/reference-sync-contract";
import { runBoundedPublicCacheRevalidation } from "../../../../../lib/cache/revalidate-public-cache-tags";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { revalidatePath } from "next/cache";

export async function completeFooterSettingsMutationResult(
  mediaSynchronization: MediaReferenceSynchronizationResult,
  successMessage: string,
) {
  const cacheRevalidation = await runBoundedPublicCacheRevalidation(() => {
    revalidateFooterPublicPaths();
    revalidatePath("/admin/pages-blocks/footer");
  });
  if (!cacheRevalidation.ok) {
    console.error("Footer cache revalidation failed after commit", cacheRevalidation.error);
  }
  const mediaWarning = mediaSynchronization.status === "saved_with_media_sync_warning";
  const warnings = [
    ...(mediaWarning ? ["تعذرت مزامنة ارتباطات الميديا، لذلك يظل الحذف الآمن متوقفًا"] : []),
    ...(!cacheRevalidation.ok ? ["تعذر تحديث العرض فورًا. حدّث الصفحة قبل إعادة المحاولة"] : []),
  ];
  return {
    ok: true as const,
    status: warnings.length ? ("warning" as const) : ("success" as const),
    code: !cacheRevalidation.ok ? "committed_cache_revalidation_pending" as const : mediaSynchronization.status,
    message: warnings.length ? `${successMessage} لكن ${warnings.join(" و")}.` : successMessage,
    mediaSynchronization,
  };
}

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
