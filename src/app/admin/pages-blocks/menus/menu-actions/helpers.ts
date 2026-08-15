import { buildCmsAuditAction, type CmsAuditVerb } from "../../../../../lib/admin/audit/cms-audit-actions";
import type { Json } from "../../../../../lib/database.types";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { parseAdminLinkFromFormData } from "../../../../../lib/admin/links/form-fields";
import {
  adminLinkToMenuItemColumns,
  parentOnlyMenuItemColumns,
} from "../../../../../lib/admin/links/menu-bridge";
import { resolveAdminLink } from "../../../../../lib/admin/links";
import { validateAdminLink } from "../../../../../lib/admin/links/validate";
import { normalizeSlugInput, slugifyFromTitle, validateSlugFormat } from "../../../../../lib/admin/slug";
import { revalidateNavigationCache } from "../../../../../lib/cache/revalidate-public-cache-tags";
import { revalidateFooterPublicPaths } from "../../../../../lib/footer/revalidate-footer";
import { revalidateMediaCenterPublicPaths } from "../../../../../lib/media-center/revalidate-public-paths";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { revalidatePath } from "next/cache";
import type { MediaReferenceSynchronizationResult } from "../../../../../lib/admin/media-catalog/reference-sync-contract";
import { synchronizeMediaReferenceWriteScopesAfterDomainMutation } from "../../../../../lib/admin/media-catalog/synchronization";
import {
  getMediaReferenceWriteLeaseUserMessage,
  MediaReferenceWriteLeaseError,
} from "../../../../../lib/admin/media-catalog/write-lease";
import { redirect } from "next/navigation";
import type { ImportedMenuItem } from "./types";

export { collectMenuItemDescendantIds } from "../menu-builder-shared";

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getNumber(formData: FormData, key: string) {
  const raw = getString(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function mutateMenuTree(
  menuId: number,
  operation: string,
  payload: Json,
  actor: { id: number; username: string },
) {
  const { data, error } = await getSupabaseAdmin().rpc("mutate_menu_tree", {
    p_menu_id: menuId,
    p_operation: operation,
    p_payload: payload,
    p_actor_admin_user_id: actor.id,
    p_actor_username: actor.username,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Menu atomic mutation returned an invalid result.");
  }
  return data;
}

export async function auditMenuAction(
  entityType: "menu" | "menu_item",
  verb: CmsAuditVerb,
  options?: { entityId?: number | null; entityLabel?: string | null; metadata?: Record<string, unknown> },
) {
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(entityType, verb),
    entityType,
    entityId: options?.entityId ?? null,
    entityLabel: options?.entityLabel ?? null,
    metadata: options?.metadata,
  });
}

export function createSlug(value: string) {
  const normalized = normalizeSlugInput(value);
  if (normalized) return normalized;
  return slugifyFromTitle(value);
}

type NavigationMessage = string | { message: string; mediaWarning: true };

function navigationQuery(message?: NavigationMessage) {
  if (!message) return "";
  const text = typeof message === "string" ? message : message.message;
  const params = new URLSearchParams({ message: text });
  if (typeof message !== "string" && message.mediaWarning) {
    params.set("notice", "saved_with_media_sync_warning");
  }
  return `?${params.toString()}`;
}

export function menusPath(message?: NavigationMessage) {
  return `/admin/pages-blocks/menus${navigationQuery(message)}`;
}

export function menuPath(menuId: number | string, message?: NavigationMessage) {
  return `/admin/pages-blocks/menus/${menuId}${navigationQuery(message)}`;
}

export function backToMenus(message?: NavigationMessage): never {
  redirect(menusPath(message));
}

export function backToMenu(menuId: number | string | null | undefined, message?: NavigationMessage): never {
  if (!menuId) backToMenus(message);
  redirect(menuPath(menuId, message));
}

export function assertValidMenuSlug(slug: string) {
  const formatError = validateSlugFormat(slug);
  if (formatError) backToMenus(formatError);
}

export function sortParentsBeforeChildren<T extends { parent_id?: unknown }>(items: T[]) {
  return [...items].sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0));
}

export async function synchronizeDeletedMenuItemReferences(
  entityIds: readonly (number | string)[],
) {
  const uniqueIds = [...new Set(
    entityIds
      .map((entityId) => Number(entityId))
      .filter((entityId) => Number.isInteger(entityId) && entityId > 0),
  )];
  if (!uniqueIds.length) return undefined;
  return synchronizeMediaReferenceWriteScopesAfterDomainMutation(
    [],
    null,
    uniqueIds.map((entityId) => ({
      domainKey: "menu_items",
      entityIdentity: entityId,
    })),
  );
}

function isRecord(value: Json): value is ImportedMenuItem {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseImportedMenuItems(payload: Json): ImportedMenuItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items.filter(isRecord);
  }

  return [];
}

export async function getMenuIdFromItem(itemId: number) {
  const { data } = await getSupabaseAdmin().from("menu_items").select("menu_id").eq("id", itemId).maybeSingle();
  return data?.menu_id ? Number(data.menu_id) : null;
}

export async function resolveMenuItemLink(formData: FormData) {
  const menuId = getNumber(formData, "menu_id");

  if (getBoolean(formData, "menu_item_is_parent")) {
    return parentOnlyMenuItemColumns();
  }

  const link = parseAdminLinkFromFormData(formData, "menu_link");
  if (link.link_kind === "none") {
    backToMenu(menuId, "اختر رابطًا للعنصر أو فعّل Parent بدون رابط.");
  }

  const validation = validateAdminLink(link);
  if (!validation.ok) backToMenu(menuId, validation.message);

  const resolvedHref = await resolveAdminLink({ ...link, anchor: null });
  return adminLinkToMenuItemColumns(link, resolvedHref);
}

export async function revalidateNavigation(
  mediaSynchronization?: MediaReferenceSynchronizationResult,
) {
  revalidateNavigationCache();
  revalidateFooterPublicPaths();
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/projects");
  revalidatePath("/topics");
  revalidateMediaCenterPublicPaths();
  revalidatePath("/contact");
  revalidatePath("/admin/pages-blocks/menus");
  return mediaSynchronization;
}

export function navigationMutationMessage(
  mediaSynchronization: MediaReferenceSynchronizationResult | undefined,
  successMessage: string,
) {
  return mediaSynchronization?.status === "saved_with_media_sync_warning"
    ? {
        message: `${successMessage} لكن تعذرت مزامنة ارتباطات الميديا، لذلك يظل الحذف الآمن متوقفًا.`,
        mediaWarning: true as const,
      }
    : successMessage;
}

export function menuInteractionFailure(code: string, message: string) {
  return { ok: false as const, code, message };
}

export function menuInteractionSuccess<
  Payload extends Record<string, unknown> = Record<string, never>,
>(
  mediaSynchronization: MediaReferenceSynchronizationResult | undefined,
  successMessage: string,
  payload?: Payload,
) {
  const resolved = navigationMutationMessage(
    mediaSynchronization,
    successMessage,
  );
  const warning = typeof resolved !== "string";
  return {
    ...(payload ?? ({} as Payload)),
    ok: true as const,
    code: warning ? "saved_with_media_sync_warning" : "saved",
    message: warning ? resolved.message : resolved,
    feedbackStatus: warning ? ("warning" as const) : ("success" as const),
  };
}

export function mediaWriteMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof MediaReferenceWriteLeaseError) {
    return getMediaReferenceWriteLeaseUserMessage(error.code);
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
