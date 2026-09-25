"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { revalidatePublicCacheTags } from "../../../../lib/cache/revalidate-public-cache-tags";
import { normalizePath } from "../../../../lib/seo/seo-utils";
import {
  readEntitySeoFormData,
  persistedEntitySeoScoreMatches,
  toEntitySeoPersistence,
  validateEntitySeoValues,
} from "../../../../lib/seo/entity-seo-types";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { getPageModuleAssignmentsForAdmin } from "../../../../lib/page-blocks/admin-queries";
import {
  deriveEntitySeoScore,
  toPageSeoScoreInput,
} from "../../../../lib/admin/seo/entity-seo-persistence";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

  const seo = readEntitySeoFormData(formData);
  const seoIssue = validateEntitySeoValues(seo)[0];
  if (seoIssue) {
    redirect(appendSeoQuery(redirectTo, "seo_error", seoIssue.message));
  }

  const [{ data: pageSource, error: pageSourceError }, composition] = await Promise.all([
    getSupabaseAdmin().from("pages").select(
      "title,path,seo_title,seo_description,seo_keywords,focus_keyword,og_image,og_image_alt,seo_score,seo_score_version,seo_score_input_hash",
    ).eq("id", pageId).maybeSingle(),
    getPageModuleAssignmentsForAdmin(pageId),
  ]);
  if (pageSourceError || !pageSource) {
    redirect(appendSeoQuery(
      redirectTo,
      "seo_error",
      pageSourceError?.message ?? "تعذر قراءة مصدر SEO الدلالي للصفحة",
    ));
  }

  const persistence = toEntitySeoPersistence(seo);
  const score = deriveEntitySeoScore(toPageSeoScoreInput({
    ...pageSource,
    ...persistence,
    semanticContent: composition.seoContent,
  }), pageSource);

  const { error } = await getSupabaseAdmin()
    .from("pages")
    .update({
      ...persistence,
      ...score,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pageId);

  if (error) {
    redirect(appendSeoQuery(redirectTo, "seo_error", error.message));
  }

  const { data: page, error: pageReadError } = await getSupabaseAdmin()
    .from("pages")
    .select("path,seo_score,seo_score_version,seo_score_input_hash")
    .eq("id", pageId)
    .maybeSingle();

  if (pageReadError) {
    redirect(appendSeoQuery(redirectTo, "seo_error", pageReadError.message));
  }
  if (!persistedEntitySeoScoreMatches(score, page)) {
    redirect(appendSeoQuery(
      redirectTo,
      "seo_error",
      "تم رفض نجاح الحفظ لأن قراءة درجة SEO المحفوظة لم تطابق المدخلات الحالية",
    ));
  }

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
    metadata: { scope: "page_seo", score: score.seo_score, scoreVersion: score.seo_score_version },
  });

  redirect(appendSeoQuery(redirectTo, "seo_notice", "saved"));
}
