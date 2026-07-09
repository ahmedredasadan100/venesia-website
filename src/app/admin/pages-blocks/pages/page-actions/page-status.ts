"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { pagesListPath } from "./helpers";

export async function togglePageStatus(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("status")
    .eq("id", pageId)
    .maybeSingle<{ status: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
  }

  const nextStatus = page.status === "published" ? "hidden" : "published";

  const { error } = await getSupabaseAdmin()
    .from("pages")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", pageId);

  if (error) redirect(pagesListPath({ error: error.message }));

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", nextStatus === "published" ? "publish" : "unpublish"),
    entityType: "page",
    entityId: pageId,
    metadata: { status: nextStatus },
  });

  await revalidatePageBlocksPath(pageId);
  redirect(
    pagesListPath({
      notice: nextStatus === "published" ? "تم نشر الصفحة." : "تم إخفاء الصفحة.",
    }),
  );
}
