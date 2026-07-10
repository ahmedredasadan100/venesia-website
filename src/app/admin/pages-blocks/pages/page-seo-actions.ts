"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { revalidatePublicCacheTags } from "../../../../lib/cache/revalidate-public-cache-tags";
import { normalizePath } from "../../../../lib/seo/seo-utils";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readKeywords(formData: FormData) {
  const raw = readString(formData, "seo_keywords");
  if (!raw) return [];

  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendSeoQuery(redirectTo: string, key: "seo_notice" | "seo_error", value: string) {
  const url = new URL(redirectTo, "http://localhost");
  url.searchParams.set("tab", "seo");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

export async function savePageSeoAction(formData: FormData) {
  await requireAdminSession();

  const pageId = Number(readString(formData, "page_id"));
  const redirectTo = readString(formData, "redirect_to") || `/admin/pages-blocks/pages/${pageId}?tab=seo`;

  if (!pageId || Number.isNaN(pageId)) {
    redirect(appendSeoQuery(redirectTo, "seo_error", "معرّف الصفحة غير صالح"));
  }

  const seoTitle = readString(formData, "seo_title") || null;
  const seoDescription = readString(formData, "seo_description") || null;
  const seoKeywords = readKeywords(formData);

  const { error } = await getSupabaseAdmin()
    .from("pages")
    .update({
      seo_title: seoTitle,
      seo_description: seoDescription,
      seo_keywords: seoKeywords,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pageId);

  if (error) {
    redirect(appendSeoQuery(redirectTo, "seo_error", error.message));
  }

  const { data: page } = await getSupabaseAdmin()
    .from("pages")
    .select("path")
    .eq("id", pageId)
    .maybeSingle<{ path: string | null }>();

  revalidatePublicCacheTags(["page-seo", "pages"]);
  if (page?.path) {
    const normalizedPath = normalizePath(page.path);
    revalidatePath(normalizedPath, "page");
    revalidateTag(`page-seo:${normalizedPath}`, "max");
  }
  revalidatePath(`/admin/pages-blocks/pages/${pageId}`);

  await recordCmsAdminAudit({
    action: buildCmsAuditAction("page", "update"),
    entityType: "page",
    entityId: pageId,
    metadata: { scope: "page_seo" },
  });

  redirect(appendSeoQuery(redirectTo, "seo_notice", "saved"));
}
