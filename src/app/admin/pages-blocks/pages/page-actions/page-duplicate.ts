"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePageBlocksPath } from "../../../../../lib/page-blocks/admin-revalidate";
import { parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { buildDuplicatePageIdentity } from "../../../../../lib/pages/page-admin-policy";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { copyPageHeroAssignments, copyPageModuleAssignments, pagesListPath } from "./helpers";

export async function duplicatePage(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("title, slug, path, page_type, status")
    .eq("id", pageId)
    .maybeSingle<{ title: string; slug: string; path: string; page_type: string; status: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
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
    redirect(pagesListPath({ error: insertError?.message ?? "تعذر نسخ الصفحة." }));
  }

  try {
    await copyPageModuleAssignments(pageId, copiedPage.id);
    await copyPageHeroAssignments(pageId, copiedPage.id, identity.slug, identity.path);
  } catch (error) {
    await getSupabaseAdmin().from("pages").delete().eq("id", copiedPage.id);
    redirect(pagesListPath({ error: error instanceof Error ? error.message : "تعذر نسخ موديولات الصفحة." }));
  }

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "duplicate"),
    entityType: "page",
    entityId: copiedPage.id,
    entityLabel: identity.title,
    metadata: { source_page_id: pageId, slug: identity.slug },
  });

  await revalidatePageBlocksPath(copiedPage.id);
  redirect(`/admin/pages-blocks/pages/${copiedPage.id}?notice=duplicated`);
}
