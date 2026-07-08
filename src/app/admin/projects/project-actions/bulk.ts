"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { validateProjectsCanPublish } from "./validation";
import { revalidateProjectPaths } from "./revalidate";

export async function bulkProjectsActionAjax(
  action: string,
  ids: number[],
  type: ProjectCategory,
) {
  await requireAdminSession();
  if (!ids.length) return { ok: false as const, message: "لم يتم تحديد أي مشروع." };

  const now = new Date().toISOString();
  let payload: Record<string, unknown> | null = null;
  let message = "تم تنفيذ الإجراء.";

  if (action === "publish") {
    const validation = await validateProjectsCanPublish(ids);
    if (!validation.validIds.length) {
      const first = validation.failures[0];
      return {
        ok: false as const,
        message: first ? `تعذر النشر: ${first.message}` : "لا يمكن نشر المشاريع المحددة.",
      };
    }

    const { error } = await getSupabaseAdmin()
      .from("projects")
      .update({ publication_status: "published", updated_at: now })
      .in("id", validation.validIds);
    if (error) return { ok: false as const, message: error.message };

    await recordCmsAdminAudit({
      action: buildCmsAuditAction("project", "publish"),
      entityType: "project",
      metadata: { bulk_action: action, project_ids: validation.validIds, count: validation.validIds.length },
    });
    revalidateProjectPaths(type);
    if (validation.failures.length) {
      return {
        ok: true as const,
        message: `تم نشر ${validation.validIds.length} مشروعًا. تم تخطي ${validation.failures.length} لعدم اكتمال البيانات.`,
      };
    }
    return { ok: true as const, message: "تم نشر المشاريع المحددة." };
  } else if (action === "hide") {
    payload = { publication_status: "unpublished", updated_at: now };
    message = "تم إخفاء المشاريع المحددة.";
  } else if (action === "archive") {
    payload = { publication_status: "archived", updated_at: now };
    message = "تم أرشفة المشاريع المحددة.";
  } else if (action === "delete") {
    return {
      ok: false as const,
      message: "الحذف النهائي غير متاح من الإجراءات الجماعية — استخدم أرشفة المشروع أو الحذف النهائي لكل مشروع على حدة.",
    };
  } else {
    return { ok: false as const, message: "إجراء غير معروف." };
  }

  const { error } = await getSupabaseAdmin().from("projects").update(payload).in("id", ids);
  if (error) return { ok: false as const, message: error.message };

  await recordCmsAdminAudit({
    action: buildCmsAuditAction(
      "project",
      action === "hide" ? "unpublish" : action === "archive" ? "delete" : "update",
    ),
    entityType: "project",
    metadata: {
      bulk_action: action,
      project_ids: ids,
      count: ids.length,
      ...(action === "archive" ? { publication_status: "archived" } : {}),
    },
  });
  revalidateProjectPaths(type);
  return { ok: true as const, message };
}
