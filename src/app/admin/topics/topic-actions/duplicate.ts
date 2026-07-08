"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  appendNotice,
  createSlug,
  getNormalizedStatus,
  getRedirectTo,
  getString,
  validateId,
  validateSlug,
} from "./helpers";
import { ensureUniqueSlug, getCategory, getTopicForDuplicate } from "./validation";
import { revalidateTopicPaths } from "./revalidate";

export async function duplicateTopic(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  const redirectTo = getRedirectTo(formData);
  if (!id || !validateId(id)) redirect(appendNotice(redirectTo, "error"));

  const original = await getTopicForDuplicate(id);
  if (!original) redirect(appendNotice(redirectTo, "error"));

  const title = getString(formData, "title");
  const rawSlug = getString(formData, "slug");
  const slug = rawSlug ? createSlug(rawSlug) : createSlug(title);
  const status = getNormalizedStatus(getString(formData, "status"), "unpublished");
  const categoryChoice = getString(formData, "category_slug");

  if (!title) redirect(appendNotice(redirectTo, "error"));
  if (!slug || !validateSlug(slug)) redirect(appendNotice(redirectTo, "error"));

  const isUniqueSlug = await ensureUniqueSlug(slug);
  if (!isUniqueSlug) redirect(appendNotice(redirectTo, "error"));

  let categoryName = original.category as string | null;
  let categorySlug = original.category_slug as string | null;
  let categoryId = original.category_id as number | null;

  if (categoryChoice === "__none") {
    categoryName = null;
    categorySlug = null;
    categoryId = null;
  } else if (categoryChoice && categoryChoice !== "__same") {
    const category = await getCategory(categoryChoice);
    if (!category) {
      redirect(appendNotice(redirectTo, "error"));
    }
    categoryName = category.name;
    categorySlug = category.slug;
    categoryId = category.id;
  }

  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("topics").insert({
    title,
    slug,
    excerpt: original.excerpt ?? "",
    content: original.content ?? "",
    image: original.image ?? "",
    image_alt: original.image_alt ?? "",
    category: categoryName,
    category_slug: categorySlug,
    category_id: categoryId,
    series_id: original.series_id ?? null,
    series: original.series ?? null,
    series_slug: original.series_slug ?? null,
    date_label: original.date_label ?? null,
    status,
    seo_title: original.seo_title ?? null,
    seo_description: original.seo_description ?? null,
    seo_keywords: original.seo_keywords ?? [],
    focus_keyword: original.focus_keyword ?? null,
    faq: original.faq ?? [],
    is_featured: original.is_featured ?? false,
    is_popular: original.is_popular ?? false,
    published_at: status === "published" ? now : null,
    deleted_at: null,
    content_type: "article",
    created_at: now,
    updated_at: now,
  });

  if (error) redirect(appendNotice(redirectTo, "error"));

  revalidateTopicPaths({ newSlug: slug });
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("topic", "duplicate"),
    entityType: "topic",
    entityLabel: title,
    metadata: { slug, source_topic_id: Number(id) },
  });
  redirect(appendNotice(redirectTo, "created"));
}
