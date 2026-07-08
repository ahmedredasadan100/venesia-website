"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { revalidateTopicsCache } from "../../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { appendNotice, getRedirectTo, getString, validateId } from "./helpers";
import { getCategory, validateBulkTopicPublish } from "./validation";

export async function bulkUpdateTopics(formData: FormData) {
  await requireAdminSession();
  const ids = formData
    .getAll("topic_ids")
    .map(String)
    .filter(validateId)
    .map(Number);
  const bulkAction = getString(formData, "bulk_action");
  const redirectTo = getRedirectTo(formData);

  if (ids.length === 0) redirect(appendNotice(redirectTo, "error"));

  const now = new Date().toISOString();
  let errorMessage: string | null = null;

  if (bulkAction === "publish") {
    const validation = await validateBulkTopicPublish(ids);
    if (!validation.validIds.length) {
      redirect(
        `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=error&bulk_error=${encodeURIComponent("لا يمكن نشر أي موضوع من التحديد — راجع قائمة الجاهزية لكل موضوع.")}#topics-table`,
      );
    }

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "published", updated_at: now })
      .in("id", validation.validIds);
    errorMessage = error?.message ?? null;

    if (!errorMessage && validation.failures.length > 0) {
      redirect(
        `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=published&bulk_partial=${validation.validIds.length}&bulk_skipped=${validation.failures.length}#topics-table`,
      );
    }
  } else if (bulkAction === "unpublish") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "unpublished", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "archive") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "delete") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ status: "archived", deleted_at: now, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "feature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: true, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "unfeature") {
    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({ is_featured: false, updated_at: now })
      .in("id", ids);
    errorMessage = error?.message ?? null;
  } else if (bulkAction === "move_category") {
    const categorySlug = getString(formData, "category_slug");
    const category = categorySlug ? await getCategory(categorySlug) : null;
    if (!category) {
      redirect(appendNotice(redirectTo, "error"));
    }

    const { error } = await getSupabaseAdmin()
      .from("topics")
      .update({
        category: category.name,
        category_slug: category.slug,
        category_id: category.id,
        updated_at: now,
      })
      .in("id", ids)
      .eq("content_type", "article");
    errorMessage = error?.message ?? null;
  } else {
    redirect(appendNotice(redirectTo, "error"));
  }

  if (errorMessage) redirect(appendNotice(redirectTo, "error"));

  revalidateTopicsCache();
  revalidatePath("/admin/topics");
  revalidatePath("/topics");
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", bulkAction === "publish" ? "publish" : bulkAction === "unpublish" ? "unpublish" : "update"),
    entityType: "topic",
    metadata: { bulk_action: bulkAction, topic_ids: ids, count: ids.length },
  });
  redirect(appendNotice(redirectTo, "saved"));
}
