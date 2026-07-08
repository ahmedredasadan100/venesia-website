"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getRedirectTo, getString, redirectEditError, validateId } from "./helpers";
import { getTopicById } from "./validation";
import { revalidateTopicPaths } from "./revalidate";
import type { TopicStatus } from "./types";
import { updateTopicWithStatus } from "./update";

async function setTopicStatusFromList(formData: FormData, nextStatus: TopicStatus, notice: string) {
  const id = getString(formData, "id");
  if (!id || !validateId(id)) redirect("/admin/topics?notice=error");

  const topic = await getTopicById(id);
  if (!topic) redirect("/admin/topics?notice=error");

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("topics")
    .update({
      status: nextStatus,
      published_at: nextStatus === "published" ? topic.published_at || now : topic.published_at,
      updated_at: now,
    })
    .eq("id", id);

  if (error) redirectEditError(id, error.message);

  revalidateTopicPaths({ id, oldSlug: topic.slug, newSlug: topic.slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "topic",
    entityId: Number(id),
    entityLabel: topic.title,
    metadata: { status: nextStatus },
  });
  const redirectTo = getRedirectTo(formData);
  redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}notice=${notice}#topics-table`);
}

export async function publishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "published", "published", { validationMode: "publish" });
  }

  await setTopicStatusFromList(formData, "published", "published");
}

export async function unpublishTopic(formData: FormData) {
  await requireAdminSession();
  if (getString(formData, "title")) {
    await updateTopicWithStatus(formData, "unpublished", "unpublished", { validationMode: "save" });
  }

  await setTopicStatusFromList(formData, "unpublished", "unpublished");
}
