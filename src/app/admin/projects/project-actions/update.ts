"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { getProjectPublishValidationError } from "../../../../lib/admin/projects/project-publish-validation";
import { syncProjectChildren } from "../../../../lib/admin/projects/project-children-sync";
import type { ProjectCategory } from "../../../../config/projects-data";
import { parseFormBoolean } from "../../../../lib/page-blocks/admin-utils";
import type { ProjectRow, ProjectStatus } from "../../../../lib/projects/types";
import { parseJsonArray } from "../../../../lib/projects/types";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import {
  getAllStrings,
  getNumber,
  getProjectProgress,
  getProjectStatus,
  getPublicationStatus,
  getString,
  parseQuickFacts,
  preserveBrochureUrl,
  preserveCategoryLabel,
  preserveImage,
  preserveRichText,
  redirectEditWithError,
  redirectEditWithNotice,
  resolveSlug,
  validateId,
} from "./helpers";
import { loadProjectPublishInput } from "./validation";
import { revalidateProjectPaths } from "./revalidate";

export async function updateProject(formData: FormData) {
  await requireAdminSession();
  const id = getString(formData, "id");
  if (!validateId(id)) redirectEditWithError(Number(id) || 0, "معرف المشروع غير صالح.");

  const numericId = Number(id);
  const { data: current, error: currentError } = await getSupabaseAdmin()
    .from("projects")
    .select("*")
    .eq("id", numericId)
    .maybeSingle<Record<string, unknown>>();

  if (currentError || !current) redirectEditWithError(numericId, "المشروع غير موجود.");

  const type = current.type as ProjectCategory;
  const code = getString(formData, "code");
  const arabicName = getString(formData, "arabic_name");
  const slug = resolveSlug(formData, code, String(current.slug ?? ""));

  if (!code) redirectEditWithError(numericId, "كود المشروع مطلوب.");
  if (!arabicName) redirectEditWithError(numericId, "اسم المشروع بالعربية مطلوب.");
  if (!slug) redirectEditWithError(numericId, "Slug المشروع مطلوب.");

  const duplicate = await getSupabaseAdmin()
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .neq("id", numericId)
    .maybeSingle();

  if (duplicate.data) redirectEditWithError(numericId, "هذا الـ Slug مستخدم في مشروع آخر.");

  const nextPublicationStatus = getPublicationStatus(getString(formData, "publication_status"));
  if (nextPublicationStatus === "published") {
    try {
      const existingInput = await loadProjectPublishInput(numericId);
      if (existingInput) {
        const publishError = getProjectPublishValidationError({
          ...existingInput,
          arabicName,
          slug,
          locationLabel: getString(formData, "location_label"),
          mapArea: getString(formData, "map_area"),
          status: getProjectStatus(formData, (current.status as ProjectStatus) ?? "under-construction"),
          statusLabel: getString(formData, "status_label") || existingInput.statusLabel,
          image: preserveImage(getString(formData, "image"), String(current.image ?? "")),
          heroImage: preserveImage(getString(formData, "hero_image"), String(current.hero_image ?? "")),
          shortDescription: getString(formData, "short_description"),
          seoTitle: getString(formData, "seo_title"),
          seoDescription: getString(formData, "seo_description"),
          progress: getProjectProgress(formData, Number(current.progress ?? 0)),
          overviewTitle: getString(formData, "overview_title") || existingInput.overviewTitle,
          deliverySpecsTitle: getString(formData, "delivery_specs_title") || existingInput.deliverySpecsTitle,
        });
        if (publishError) redirectEditWithError(numericId, publishError);
      }
    } catch (error) {
      redirectEditWithError(
        numericId,
        error instanceof Error ? error.message : "تعذر التحقق من جاهزية النشر.",
      );
    }
  }

  const payload = {
    code,
    slug,
    arabic_name: arabicName,
    english_name: getString(formData, "english_name"),
    category_label: preserveCategoryLabel(formData, current.category_label),
    status: getProjectStatus(formData, (current.status as ProjectStatus) ?? "under-construction"),
    status_label: getString(formData, "status_label") || String(current.status_label ?? ""),
    image: preserveImage(getString(formData, "image"), String(current.image ?? "")),
    hero_image: preserveImage(getString(formData, "hero_image"), String(current.hero_image ?? "")),
    location_label: getString(formData, "location_label"),
    map_area: getString(formData, "map_area"),
    short_description: getString(formData, "short_description"),
    description: parseJsonArray<string>(current.description),
    core_specs: (current.core_specs as ProjectRow["core_specs"]) ?? null,
    delivery_label: String(current.delivery_label ?? ""),
    area_label: String(current.area_label ?? ""),
    progress: getProjectProgress(formData, Number(current.progress ?? 0)),
    units_label: String(current.units_label ?? ""),
    featured: parseFormBoolean(formData, "featured", Boolean(current.featured)),
    show_on_homepage: parseFormBoolean(formData, "show_on_homepage", Boolean(current.show_on_homepage)),
    homepage_order: getNumber(formData, "homepage_order", Number(current.homepage_order ?? 0)),
    floors_label: current.floors_label ? String(current.floors_label) : null,
    brochure_url: preserveBrochureUrl(formData, current.brochure_url),
    publication_status: nextPublicationStatus,
    overview_title: getString(formData, "overview_title") || null,
    overview_body: preserveRichText(getString(formData, "overview_body"), String(current.overview_body ?? "")) || null,
    overview_bullets: getAllStrings(formData, "overview_bullets"),
    overview_video_image: preserveImage(
      getString(formData, "overview_video_image"),
      String(current.overview_video_image ?? ""),
    ),
    district_title: getString(formData, "district_title") || null,
    district_subtitle: getString(formData, "district_subtitle") || null,
    district_body: preserveRichText(getString(formData, "district_body"), String(current.district_body ?? "")) || null,
    district_bullets: getAllStrings(formData, "district_bullets"),
    district_image: preserveImage(getString(formData, "district_image"), String(current.district_image ?? "")),
    delivery_specs_title: getString(formData, "delivery_specs_title") || null,
    delivery_specs_subtitle:
      preserveRichText(getString(formData, "delivery_specs_subtitle"), String(current.delivery_specs_subtitle ?? "")) ||
      null,
    quick_facts: parseQuickFacts(formData, current.quick_facts),
    seo_title: getString(formData, "seo_title") || null,
    seo_description: getString(formData, "seo_description") || null,
    seo_keywords: getAllStrings(formData, "seo_keywords"),
    focus_keyword: getString(formData, "focus_keyword") || null,
    og_image: preserveImage(getString(formData, "og_image"), String(current.og_image ?? current.hero_image ?? "")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await getSupabaseAdmin().from("projects").update(payload).eq("id", numericId);
  if (error) redirectEditWithError(numericId, error.message);

  try {
    await syncProjectChildren(numericId, formData);
  } catch (childError) {
    const message = childError instanceof Error ? childError.message : "تعذر حفظ البيانات المرتبطة.";
    redirectEditWithError(numericId, message);
  }

  revalidateProjectPaths(type, numericId, slug, String(current.slug ?? ""));
  const childrenSynced =
    formData.has("floor_plans_section") ||
    formData.has("delivery_spec_items_section") ||
    formData.has("overview_media_section") ||
    formData.has("delivery_media_section") ||
    formData.has("gallery_media_section");
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "update"),
    entityType: "project",
    entityId: numericId,
    entityLabel: arabicName,
    metadata: { slug, publication_status: nextPublicationStatus, children_synced: childrenSynced },
  });
  if (childrenSynced) {
    await recordCmsAdminAudit({
      action: buildCmsAuditAction("project_children", "update"),
      entityType: "project_children",
      entityId: numericId,
      entityLabel: arabicName,
    });
  }
  redirectEditWithNotice(numericId, "updated");
}
