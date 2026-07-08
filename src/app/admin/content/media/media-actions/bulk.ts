"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import {
  revalidateMediaCenterCache,
  revalidateTopicsCache,
} from "../../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { MEDIA_LIST_CONTENT_TYPES } from "../media-content-config";
import {
  appendMediaListNotice,
  getMediaRedirectTo,
  getString,
  validateId,
} from "./helpers";
import { validateBulkMediaPublish } from "./validation";

export async function bulkUpdateMediaContent(formData: FormData) {
  await requireAdminSession();

  const ids = formData
    .getAll("media_ids")
    .map(String)
    .filter(validateId)
    .map(Number);
  const bulkAction = getString(formData, "bulk_action");
  const redirectTo = getMediaRedirectTo(formData);

  if (ids.length === 0) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  const now = new Date().toISOString();
  let errorMessage: string | null = null;

  if (bulkAction === "publish") {
    const validation = await validateBulkMediaPublish(ids);
    if (!validation.validIds.length) {
      redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
    }

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "published", updated_at: now })
      .in("id", validation.validIds)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;

    if (!errorMessage && validation.failures.length > 0) {
      redirect(
        appendMediaListNotice(
          `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}bulk_partial=${validation.validIds.length}&bulk_skipped=${validation.failures.length}`,
          "saved",
          "media-table",
        ),
      );
    }
  } else if (bulkAction === "unpublish") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "unpublished", updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "archive") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", deleted_at: now, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "feature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: true, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unfeature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: false, updated_at: now })
      .in("id", ids)
      .in("content_type", [...MEDIA_LIST_CONTENT_TYPES])
      .is("deleted_at", null);
    errorMessage = error?.message ?? null;
  } else {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  if (errorMessage) {
    redirect(appendMediaListNotice(redirectTo, "error", "media-table"));
  }

  revalidateTopicsCache();
  revalidateMediaCenterCache();
  revalidatePath("/admin/content/media");
  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "media_content",
      bulkAction === "publish" ? "publish" : bulkAction === "unpublish" ? "unpublish" : "update",
    ),
    entityType: "media_content",
    metadata: { bulk_action: bulkAction, media_ids: ids, count: ids.length },
  });
  redirect(appendMediaListNotice(redirectTo, "saved", "media-table"));
}
