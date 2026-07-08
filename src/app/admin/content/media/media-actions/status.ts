"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  isMediaEditableContentType,
  MEDIA_LIST_CONTENT_TYPES,
} from "../media-content-config";
import {
  appendMediaListNotice,
  getMediaRedirectTo,
  getString,
  validateId,
  validateMediaTopicRow,
} from "./helpers";
import {
  getEditableMediaTopicById,
} from "./validation";
import { revalidateMediaContentPaths } from "./revalidate";

export async function publishMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  if (!isMediaEditableContentType(topic.content_type)) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const publishError = validateMediaTopicRow(topic);
  if (publishError) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "published",
      published_at: topic.published_at || now,
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", "publish"),
    entityType: "media_content",
    entityId: Number(id),
    entityLabel: topic.title,
    metadata: { content_type: topic.content_type },
  });
  redirect(appendMediaListNotice(redirectTo, "published", "media-table"));
}

export async function unpublishMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "unpublished",
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", "unpublish"),
    entityType: "media_content",
    entityId: Number(id),
    entityLabel: topic.title,
    metadata: { content_type: topic.content_type },
  });
  redirect(appendMediaListNotice(redirectTo, "unpublished", "media-table"));
}

export async function archiveMediaContent(formData: FormData) {
  await requireAdminSession();

  const id = getString(formData, "id");
  const redirectTo = getMediaRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendMediaListNotice("/admin/content/media", "error", "media-table"));

  const topic = await getEditableMediaTopicById(id);
  if (!topic) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: "archived",
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
    .is("deleted_at", null);

  if (error) redirect(appendMediaListNotice(redirectTo, "error", "media-table"));

  revalidateMediaContentPaths(id);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("media_content", "delete"),
    entityType: "media_content",
    entityId: Number(id),
    entityLabel: topic.title,
    metadata: { content_type: topic.content_type },
  });
  redirect(appendMediaListNotice(redirectTo, "deleted", "media-table"));
}
