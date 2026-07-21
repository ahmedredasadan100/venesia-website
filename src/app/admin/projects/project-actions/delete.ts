"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { revalidateProjectPaths } from "./revalidate";

export async function deleteProjectAjax(id: number, confirmPermanent = false) {
  await requireAdminSession();
  if (!confirmPermanent) {
    return {
      ok: false as const,
      code: "confirm_required",
      message: "الحذف النهائي يتطلب تأكيدًا صريحًا — استخدم الأرشفة للإخفاء الآمن.",
    };
  }

  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("projects")
    .select("type, slug")
    .eq("id", id)
    .maybeSingle<{ type: ProjectCategory; slug: string | null }>();

  if (lookupError || !existing) {
    return {
      ok: false as const,
      code: lookupError ? "lookup_failed" : "project_not_found",
      message: lookupError?.message ?? "المشروع غير موجود.",
    };
  }

  const { error } = await getSupabaseAdmin().from("projects").delete().eq("id", id);
  if (error) {
    return { ok: false as const, code: "delete_failed", message: error.message };
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "delete"),
    entityType: "project",
    entityId: id,
    metadata: { permanent: true, slug: existing.slug },
  });
  revalidateProjectPaths(existing.type, undefined, existing.slug);
  return { ok: true as const, message: "تم الحذف النهائي وإزالة المشروع من القائمة." };
}
