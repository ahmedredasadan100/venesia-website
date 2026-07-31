"use server";

import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { buildDuplicatePageIdentity } from "../../../../../lib/pages/page-admin-policy";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { copyPageHeroAssignments, copyPageModuleAssignments } from "./helpers";

export type PageDuplicateResult =
  | { ok: true; message: string; pageId: number }
  | { ok: false; code: string; message: string };

export async function duplicatePageAjax(
  pageId: number,
): Promise<PageDuplicateResult> {
  await requireAdminSession();
  if (!Number.isInteger(pageId) || pageId <= 0) {
    return {
      ok: false,
      code: "invalid_page",
      message: "الصفحة غير موجودة.",
    };
  }

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("title, slug, path, page_type, status")
    .eq("id", pageId)
    .maybeSingle<{ title: string; slug: string; path: string; page_type: string; status: string }>();

  if (loadError || !page) {
    return {
      ok: false,
      code: "page_not_found",
      message: loadError?.message ?? "الصفحة غير موجودة.",
    };
  }

  const suffix = Date.now().toString().slice(-5);
  const identity = buildDuplicatePageIdentity(page, suffix);

  const { data: copiedPage, error: insertError } = await getSupabaseAdmin()
    .from("pages")
    .insert({
      title: identity.title,
      slug: identity.slug,
      path: identity.path,
      page_type: page.page_type,
      status: "draft",
    })
    .select("id")
    .single<{ id: number }>();

  if (insertError || !copiedPage) {
    return {
      ok: false,
      code: "page_duplicate_failed",
      message: insertError?.message ?? "تعذر نسخ الصفحة.",
    };
  }

  try {
    await copyPageModuleAssignments(pageId, copiedPage.id);
    await copyPageHeroAssignments(pageId, copiedPage.id, identity.slug, identity.path);
  } catch (error) {
    await getSupabaseAdmin().from("pages").delete().eq("id", copiedPage.id);
    return {
      ok: false,
      code: "page_duplicate_assignments_failed",
      message:
        error instanceof Error
          ? error.message
          : "تعذر نسخ موديولات الصفحة.",
    };
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "duplicate"),
    entityType: "page",
    entityId: copiedPage.id,
    entityLabel: identity.title,
    metadata: { source_page_id: pageId, slug: identity.slug },
  });

  await revalidatePageBlocksPath(copiedPage.id);
  return {
    ok: true,
    message: "تم نسخ الصفحة وموديولاتها بنجاح.",
    pageId: copiedPage.id,
  };
}
