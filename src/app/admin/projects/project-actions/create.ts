"use server";

import { requireAdminSession } from "../../../../lib/admin/auth/require-admin-session";
import { buildCmsAuditAction } from "../../../../lib/admin/audit/cms-audit-actions";
import { recordCmsAdminAudit } from "../../../../lib/admin/audit-log";
import { validateSlugFormat } from "../../../../lib/admin/slug";
import type { ProjectCategory } from "../../../../config/projects-data";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { synchronizeProjectMediaReferencesAfterMutation } from "../../../../lib/admin/media-catalog/synchronization";
import {
  createProjectSlug,
  getString,
  redirectEditWithNotice,
  redirectWithError,
} from "./helpers";
import { revalidateProjectPaths } from "./revalidate";

export async function createProject(formData: FormData) {
  await requireAdminSession();
  const typeRaw = getString(formData, "type");
  const type = typeRaw as ProjectCategory;
  if (type !== "residential" && type !== "commercial") {
    redirectWithError("residential", "نوع المشروع غير صالح.");
  }

  const arabicName = getString(formData, "arabic_name");
  const code = getString(formData, "code");
  const slug = createProjectSlug(getString(formData, "slug") || code || arabicName);
  const locationLabel = getString(formData, "location_label");

  if (!arabicName) redirectWithError(type, "اسم المشروع بالعربية مطلوب.");
  if (!code) redirectWithError(type, "كود المشروع مطلوب.");

  const formatError = validateSlugFormat(slug);
  if (formatError) redirectWithError(type, formatError);

  const supabase = getSupabaseAdmin();
  const { data: codeConflict } = await supabase.from("projects").select("id").eq("code", code).maybeSingle();
  if (codeConflict) redirectWithError(type, "كود المشروع مستخدم بالفعل.");

  const { data: slugConflict } = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (slugConflict) redirectWithError(type, "الـ slug مستخدم بالفعل.");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      type,
      code,
      slug,
      arabic_name: arabicName,
      english_name: getString(formData, "english_name"),
      category_label: type === "residential" ? "سكني" : "تجاري",
      status: "under-construction",
      status_label: "تحت الإنشاء",
      image: "",
      hero_image: "",
      location_label: locationLabel,
      map_area: "",
      short_description: "",
      description: [],
      core_specs: null,
      delivery_label: "",
      area_label: "",
      progress: 0,
      units_label: "",
      featured: false,
      show_on_homepage: false,
      homepage_order: 0,
      floors_label: null,
      brochure_url: null,
      publication_status: "draft",
      overview_title: null,
      overview_body: null,
      overview_bullets: [],
      overview_video_image: null,
      district_title: null,
      district_subtitle: null,
      district_body: null,
      district_bullets: [],
      district_image: null,
      delivery_specs_title: null,
      delivery_specs_subtitle: null,
      contact_cta: null,
      quick_facts: [],
      location_data: null,
      cta: null,
      detail_tabs: [],
      seo_title: arabicName,
      seo_description: null,
      seo_keywords: [code, arabicName].filter(Boolean),
      focus_keyword: code,
      og_image: null,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) redirectWithError(type, error.message);
  await recordCmsAdminAudit({
    action: buildCmsAuditAction("project", "create"),
    entityType: "project",
    entityId: data.id,
    entityLabel: arabicName,
    metadata: { slug, type, code },
  });
  await synchronizeProjectMediaReferencesAfterMutation(data.id);
  revalidateProjectPaths(type, data.id, slug);
  redirectEditWithNotice(data.id, "created");
}
