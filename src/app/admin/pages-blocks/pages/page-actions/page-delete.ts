"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../../lib/admin/audit-log";
import { revalidatePublicPagesWithBlockAssignments } from "../../../../../lib/page-blocks/admin-revalidate";
import { parseNumber } from "../../../../../lib/page-blocks/admin-utils";
import { getPageDeleteBlockReason } from "../../../../../lib/pages/page-admin-policy";
import { normalizePath } from "../../../../../lib/seo/seo-utils";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import type { PagesTableRow } from "../../../../../lib/admin/pages/load-pages-table-rows";
import { loadPagesTableRowsForAdmin, pagesListPath } from "./helpers";
import type { PagesTableResult } from "./types";

async function deletePageHeroAssignments(pageId: number) {
  const { error } = await getSupabaseAdmin()
    .from("hero_assignments")
    .delete()
    .eq("target_type", "page")
    .eq("target_id", pageId);

  if (error) {
    throw new Error(error.message);
  }
}

function revalidateDeletedPublicPath(path: string | null | undefined) {
  if (!path) return;
  const normalizedPath = normalizePath(path);
  revalidatePath(normalizedPath, "page");
  revalidateTag(`page-seo:${normalizedPath}`, "max");
}

export async function getPagesTableRows(): Promise<PagesTableRow[]> {
  return loadPagesTableRowsForAdmin();
}

export async function bulkDeletePagesAjax(ids: number[]): Promise<PagesTableResult> {
  await requireAdminSession();
  const validIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!validIds.length) return { ok: false, message: "حدد صفحة واحدة على الأقل." };

  const { data: pages, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("id, slug, path, title")
    .in("id", validIds);

  if (loadError) return { ok: false, message: loadError.message };

  const deletable: Array<{ id: number; path: string | null; title: string }> = [];
  let blockedCount = 0;

  for (const page of pages ?? []) {
    const blockReason = getPageDeleteBlockReason({ slug: page.slug, path: page.path });
    if (blockReason) {
      blockedCount += 1;
    } else {
      deletable.push({ id: page.id, path: page.path, title: page.title });
    }
  }

  if (!deletable.length) {
    return { ok: false, message: "لا يمكن حذف الصفحات المحددة — الصفحة الرئيسية محمية." };
  }

  for (const page of deletable) {
    try {
      await deletePageHeroAssignments(page.id);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "تعذر حذف ربط الهيرو للصفحة.",
      };
    }
  }

  const deletableIds = deletable.map((page) => page.id);
  const { error: deleteError } = await getSupabaseAdmin().from("pages").delete().in("id", deletableIds);
  if (deleteError) return { ok: false, message: deleteError.message };

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "delete"),
    entityType: "page",
    metadata: { page_ids: deletableIds, count: deletableIds.length },
  });

  for (const page of deletable) {
    revalidateDeletedPublicPath(page.path);
  }

  revalidatePath("/admin/pages-blocks/pages", "layout");
  await revalidatePublicPagesWithBlockAssignments();

  const rows = await loadPagesTableRowsForAdmin();
  let message = `تم حذف ${deletableIds.length} صفحة بنجاح.`;
  if (blockedCount > 0) {
    message += ` لم يُحذف ${blockedCount} صفحة محمية.`;
  }

  return { ok: true, message, rows };
}

export async function deletePage(formData: FormData) {
  await requireAdminSession();
  const pageId = parseNumber(formData.get("id"));
  if (!pageId) redirect(pagesListPath({ error: "الصفحة غير موجودة." }));

  const { data: page, error: loadError } = await getSupabaseAdmin()
    .from("pages")
    .select("slug,path,title")
    .eq("id", pageId)
    .maybeSingle<{ slug: string; path: string; title: string }>();

  if (loadError || !page) {
    redirect(pagesListPath({ error: loadError?.message ?? "الصفحة غير موجودة." }));
  }

  const blockReason = getPageDeleteBlockReason({ slug: page.slug, path: page.path });
  if (blockReason) redirect(pagesListPath({ error: blockReason }));

  try {
    await deletePageHeroAssignments(pageId);
  } catch (error) {
    redirect(
      pagesListPath({
        error: error instanceof Error ? error.message : "تعذر حذف ربط الهيرو للصفحة.",
      }),
    );
  }

  const { error } = await getSupabaseAdmin().from("pages").delete().eq("id", pageId);
  if (error) redirect(pagesListPath({ error: error.message }));

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "delete"),
    entityType: "page",
    entityId: pageId,
    entityLabel: page.title,
    metadata: { slug: page.slug, path: page.path },
  });

  revalidateDeletedPublicPath(page.path);
  revalidatePath("/admin/pages-blocks/pages", "layout");
  await revalidatePublicPagesWithBlockAssignments();
  redirect(pagesListPath({ notice: `تم حذف الصفحة «${page.title}».` }));
}
