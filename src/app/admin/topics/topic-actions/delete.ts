"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getRedirectTo, getString, redirectEditError, validateId } from "./helpers";
import { getTopicById } from "./validation";
import { revalidateTopicPaths } from "./revalidate";

export async function softDeleteTopic(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const topic = await getTopicById(id);
  if (!topic) redirect("/admin/topics?notice=error");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({ status: "archived", deleted_at: now, updated_at: now })
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: topic.slug, newSlug: topic.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", "delete"),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: topic.title,
  });
  const redirectTo = getRedirectTo(formData);
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=deleted#topics-table`);
}
