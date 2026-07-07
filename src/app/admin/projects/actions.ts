"use server";

import { requireAdminSession } from "../../../lib/admin/auth/require-admin-session";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revalidateProjectsCache } from "../../../lib/cache/revalidate-public-cache-tags";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import type { ProjectCategory } from "../../../config/projects-data";
import type { ProjectPublicationStatus, ProjectRow, ProjectStatus } from "../../../lib/projects/types";
import { parseJsonArray } from "../../../lib/projects/types";
import { parseFloorPlanSpecsFromForm } from "../../../lib/projects/floor-plan-specs";
import { parseFormBoolean } from "../../../lib/page-blocks/admin-utils";
import { normalizeSlugInput, slugifyFromTitle, validateSlugFormat } from "../../../lib/admin/slug";

const VALID_PUBLICATION_STATUSES = ["draft", "published", "unpublished", "archived"] as const;

type PublicationStatus = (typeof VALID_PUBLICATION_STATUSES)[number];

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getAllStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function getNumber(formData: FormData, key: string, fallback = 0) {
  const parsed = Number.parseInt(getString(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPublicationStatus(value: string): PublicationStatus {
  return VALID_PUBLICATION_STATUSES.includes(value as PublicationStatus)
    ? (value as PublicationStatus)
    : "published";
}

function validateId(id: string) {
  return /^\d+$/.test(id);
}

function listPath(type: ProjectCategory) {
  return type === "residential" ? "/admin/projects/residential" : "/admin/projects/commercial";
}

function redirectWithNotice(type: ProjectCategory, notice: string): never {
  redirect(`${listPath(type)}?notice=${notice}`);
}

function redirectWithError(type: ProjectCategory, message: string): never {
  redirect(`${listPath(type)}?error=${encodeURIComponent(message)}`);
}

function redirectEditWithNotice(id: number, notice: string): never {
  redirect(`/admin/projects/${id}?notice=${notice}`);
}

function redirectEditWithError(id: number, message: string): never {
  redirect(`/admin/projects/${id}?error=${encodeURIComponent(message)}`);
}

function revalidateProjectPaths(type: ProjectCategory, id?: number, slug?: string | null, previousSlug?: string | null) {
  revalidateProjectsCache();
  revalidatePath("/admin/projects");
  revalidatePath(listPath(type));
  if (id) revalidatePath(`/admin/projects/${id}`);

  revalidatePath("/projects", "page");
  if (slug) revalidatePath(`/projects/${slug}`, "page");
  if (previousSlug && previousSlug !== slug) revalidatePath(`/projects/${previousSlug}`, "page");
}

async function revalidateProjectPathsById(type: ProjectCategory, id?: number, previousSlug?: string | null) {
  let slug: string | null = null;
  if (id) {
    const { data } = await getSupabaseAdmin().from("projects").select("slug").eq("id", id).maybeSingle();
    slug = data?.slug ?? null;
  }
  revalidateProjectPaths(type, id, slug, previousSlug);
}

function preserveImage(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

function isEmptyRichText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return trimmed === "<p></p>" || trimmed === '<p><br class="ProseMirror-trailingBreak"></p>' || trimmed === "<p><br></p>";
}

function preserveRichText(nextValue: string, currentValue: string) {
  if (isEmptyRichText(nextValue) && currentValue.trim()) return currentValue;
  return nextValue.trim() ? nextValue : currentValue;
}

function resolveSlug(formData: FormData, code: string, currentSlug: string) {
  const slug = getString(formData, "slug");
  if (slug) return slug;
  if (currentSlug) return currentSlug;
  return code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function createProjectSlug(value: string) {
  const normalized = normalizeSlugInput(value);
  if (normalized) return normalized;
  return slugifyFromTitle(value);
}

function parseQuickFacts(formData: FormData, current: unknown) {
  if (!formData.has("quick_fact_label")) {
    return parseJsonArray<{ label: string; value: string }>(current);
  }

  const labels = formData.getAll("quick_fact_label").map(String);
  const values = formData.getAll("quick_fact_value").map(String);

  return labels
    .map((label, index) => ({
      label: label.trim(),
      value: (values[index] ?? "").trim(),
    }))
    .filter((item) => item.label || item.value);
}

function preserveBrochureUrl(formData: FormData, current: unknown) {
  if (!formData.has("brochure_url")) {
    return current ? String(current) : null;
  }

  return getString(formData, "brochure_url") || null;
}

function preserveCategoryLabel(formData: FormData, current: unknown) {
  const nextValue = getString(formData, "category_label");
  if (nextValue) return nextValue;
  return String(current ?? "");
}

function parseFloorPlans(
  formData: FormData,
  existingPlans: { plan_image: string; featured: boolean }[] = [],
) {
  const areas = formData.getAll("floor_plan_area").map(String);
  const labels = formData.getAll("floor_plan_label").map(String);
  const images = formData.getAll("floor_plan_image").map(String);
  const featuredFlags = formData.getAll("floor_plan_featured").map(String);

  return areas
    .map((area, index) => ({
      area: area.trim(),
      label: (labels[index] ?? "").trim() || null,
      plan_image: preserveImage((images[index] ?? "").trim(), existingPlans[index]?.plan_image ?? ""),
      specs: parseFloorPlanSpecsFromForm(formData, index),
      featured: formData.has("floor_plan_featured")
        ? featuredFlags[index] === "true"
        : Boolean(existingPlans[index]?.featured),
      sort_order: index,
    }))
    .filter((item) => item.area || item.label || item.plan_image);
}

function parseMediaRows(
  formData: FormData,
  prefix: "overview_media" | "delivery_media" | "gallery_media",
  existingImages: string[] = [],
) {
  const images = formData.getAll(`${prefix}_image`).map(String);
  const labels = formData.getAll(`${prefix}_label`).map(String);

  return images
    .map((image, index) => ({
      image: preserveImage(image.trim(), existingImages[index] ?? ""),
      label: (labels[index] ?? "").trim(),
      sort_order: index,
    }))
    .filter((item) => item.image);
}

type SyncProjectChildrenPayload = {
  p_project_id: number;
  p_floor_plans?: ReturnType<typeof parseFloorPlans>;
  p_delivery_items?: { body: string; sort_order: number }[];
  p_overview_media?: ReturnType<typeof parseMediaRows>;
  p_delivery_media?: ReturnType<typeof parseMediaRows>;
  p_gallery_media?: ReturnType<typeof parseMediaRows>;
};

function buildSyncProjectChildrenPayload(
  projectId: number,
  formData: FormData,
  existingPlans: { plan_image: string; featured: boolean }[],
  existingOverviewImages: string[],
  existingDeliveryImages: string[],
  existingGalleryImages: string[],
): SyncProjectChildrenPayload {
  const payload: SyncProjectChildrenPayload = { p_project_id: projectId };

  if (formData.has("floor_plans_section")) {
    payload.p_floor_plans = parseFloorPlans(formData, existingPlans);
  }

  if (formData.has("delivery_spec_items_section")) {
    payload.p_delivery_items = getAllStrings(formData, "delivery_spec_item").map((body, index) => ({
      body,
      sort_order: index,
    }));
  }

  if (formData.has("overview_media_section")) {
    payload.p_overview_media = parseMediaRows(formData, "overview_media", existingOverviewImages);
  }

  if (formData.has("delivery_media_section")) {
    payload.p_delivery_media = parseMediaRows(formData, "delivery_media", existingDeliveryImages);
  }

  if (formData.has("gallery_media_section")) {
    payload.p_gallery_media = parseMediaRows(formData, "gallery_media", existingGalleryImages);
  }

  return payload;
}

async function replaceChildren(projectId: number, formData: FormData) {
  const supabase = getSupabaseAdmin();

  const [{ data: existingPlans }, { data: existingMedia }] = await Promise.all([
    supabase.from("project_floor_plans").select("plan_image, featured").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("project_media").select("collection, image").eq("project_id", projectId).order("collection", { ascending: true }).order("sort_order", { ascending: true }),
  ]);

  const existingOverviewImages = (existingMedia ?? [])
    .filter((row) => row.collection === "overview")
    .map((row) => String(row.image ?? ""));
  const existingDeliveryImages = (existingMedia ?? [])
    .filter((row) => row.collection === "delivery_specs")
    .map((row) => String(row.image ?? ""));
  const existingGalleryImages = (existingMedia ?? [])
    .filter((row) => row.collection === "gallery")
    .map((row) => String(row.image ?? ""));

  const payload = buildSyncProjectChildrenPayload(
    projectId,
    formData,
    (existingPlans ?? []) as { plan_image: string; featured: boolean }[],
    existingOverviewImages,
    existingDeliveryImages,
    existingGalleryImages,
  );

  const { error } = await supabase.rpc("sync_project_children", payload);
  if (error) throw new Error(error.message);
}

export async function checkProjectFieldsAvailable(code: string, slug: string) {
  await requireAdminSession();
  const normalizedCode = code.trim();
  const normalizedSlug = createProjectSlug(slug || code);

  if (!normalizedCode) {
    return { available: false as const, message: "كود المشروع مطلوب." };
  }

  const formatError = validateSlugFormat(normalizedSlug);
  if (formatError) {
    return { available: false as const, message: formatError };
  }

  const supabase = getSupabaseAdmin();
  const { data: codeConflict } = await supabase.from("projects").select("id").eq("code", normalizedCode).maybeSingle();
  if (codeConflict) {
    return { available: false as const, message: "كود المشروع مستخدم بالفعل." };
  }

  const { data: slugConflict } = await supabase.from("projects").select("id").eq("slug", normalizedSlug).maybeSingle();
  if (slugConflict) {
    return { available: false as const, message: "الـ slug مستخدم بالفعل." };
  }

  return { available: true as const };
}

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
  revalidateProjectPaths(type, data.id, slug);
  redirectEditWithNotice(data.id, "created");
}

export async function getProjectsTableRows(type: ProjectCategory) {
  await requireAdminSession();
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("id, code, slug, arabic_name, location_label, map_area, featured, publication_status, updated_at")
    .eq("type", type)
    .order("homepage_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function toggleProjectPublicationAjax(id: number, currentStatus: string | null) {
  await requireAdminSession();
  const nextStatus: PublicationStatus = currentStatus === "published" ? "unpublished" : "published";
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .update({ publication_status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("type")
    .maybeSingle<{ type: ProjectCategory }>();

  if (error || !data) return { ok: false as const, message: error?.message ?? "المشروع غير موجود." };

  revalidateProjectPathsById(data.type, id);
  return { ok: true as const, message: nextStatus === "published" ? "تم نشر المشروع." : "تم إخفاء المشروع." };
}

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
    payload = { publication_status: "published", updated_at: now };
    message = "تم نشر المشاريع المحددة.";
  } else if (action === "hide") {
    payload = { publication_status: "unpublished", updated_at: now };
    message = "تم إخفاء المشاريع المحددة.";
  } else if (action === "delete") {
    const { error } = await getSupabaseAdmin().from("projects").delete().in("id", ids);
    if (error) return { ok: false as const, message: error.message };
    revalidateProjectPaths(type);
    return { ok: true as const, message: "تم حذف المشاريع المحددة." };
  } else {
    return { ok: false as const, message: "إجراء غير معروف." };
  }

  const { error } = await getSupabaseAdmin().from("projects").update(payload).in("id", ids);
  if (error) return { ok: false as const, message: error.message };

  revalidateProjectPaths(type);
  return { ok: true as const, message };
}

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

  const payload = {
    code,
    slug,
    arabic_name: arabicName,
    english_name: getString(formData, "english_name"),
    category_label: preserveCategoryLabel(formData, current.category_label),
    status: ((current.status as ProjectStatus) ?? "under-construction") as ProjectStatus,
    status_label: String(current.status_label ?? ""),
    image: preserveImage(getString(formData, "image"), String(current.image ?? "")),
    hero_image: preserveImage(getString(formData, "hero_image"), String(current.hero_image ?? "")),
    location_label: getString(formData, "location_label"),
    map_area: getString(formData, "map_area"),
    short_description: getString(formData, "short_description"),
    description: parseJsonArray<string>(current.description),
    core_specs: (current.core_specs as ProjectRow["core_specs"]) ?? null,
    delivery_label: String(current.delivery_label ?? ""),
    area_label: String(current.area_label ?? ""),
    progress: Number(current.progress ?? 0),
    units_label: String(current.units_label ?? ""),
    featured: parseFormBoolean(formData, "featured", Boolean(current.featured)),
    show_on_homepage: parseFormBoolean(formData, "show_on_homepage", Boolean(current.show_on_homepage)),
    homepage_order: getNumber(formData, "homepage_order", Number(current.homepage_order ?? 0)),
    floors_label: current.floors_label ? String(current.floors_label) : null,
    brochure_url: preserveBrochureUrl(formData, current.brochure_url),
    publication_status: getPublicationStatus(getString(formData, "publication_status")),
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
    await replaceChildren(numericId, formData);
  } catch (childError) {
    const message = childError instanceof Error ? childError.message : "تعذر حفظ البيانات المرتبطة.";
    redirectEditWithError(numericId, message);
  }

  revalidateProjectPaths(type, numericId, slug, String(current.slug ?? ""));
  redirectEditWithNotice(numericId, "updated");
}

export async function deleteProjectAjax(id: number) {
  await requireAdminSession();
  const { data: existing, error: lookupError } = await getSupabaseAdmin()
    .from("projects")
    .select("type, slug")
    .eq("id", id)
    .maybeSingle<{ type: ProjectCategory; slug: string | null }>();

  if (lookupError || !existing) {
    return { ok: false as const, message: lookupError?.message ?? "المشروع غير موجود." };
  }

  const { error } = await getSupabaseAdmin().from("projects").delete().eq("id", id);
  if (error) return { ok: false as const, message: error.message };

  revalidateProjectPaths(existing.type, undefined, existing.slug);
  return { ok: true as const, message: "تم حذف المشروع." };
}

async function ensureUniqueProjectField(field: "code" | "slug", base: string) {
  const supabase = getSupabaseAdmin();
  let candidate = `${base}-copy`;
  let counter = 2;

  while (true) {
    const { data } = await supabase.from("projects").select("id").eq(field, candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-copy-${counter}`;
    counter += 1;
  }
}

export async function duplicateProjectAjax(id: number) {
  await requireAdminSession();
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false as const, message: "معرف المشروع غير صالح." };
  }

  const supabase = getSupabaseAdmin();
  const { data: source, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Record<string, unknown>>();

  if (error) return { ok: false as const, message: error.message };
  if (!source) return { ok: false as const, message: "المشروع غير موجود." };

  const type = source.type as ProjectCategory;
  if (type !== "residential") {
    return { ok: false as const, message: "النسخ متاح للمشاريع السكنية فقط." };
  }

  const sourceCode = String(source.code ?? "").trim();
  const sourceSlug = String(source.slug ?? "").trim();
  if (!sourceCode || !sourceSlug) {
    return { ok: false as const, message: "لا يمكن نسخ مشروع بدون code أو slug." };
  }

  const now = new Date().toISOString();
  const nextCode = await ensureUniqueProjectField("code", sourceCode);
  const nextSlug = await ensureUniqueProjectField("slug", sourceSlug);

  const {
    id: _sourceId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...projectFields
  } = source;

  const { data: inserted, error: insertError } = await supabase
    .from("projects")
    .insert({
      ...projectFields,
      code: nextCode,
      slug: nextSlug,
      arabic_name: `${String(source.arabic_name ?? sourceCode)} - نسخة`,
      publication_status: "draft",
      featured: false,
      show_on_homepage: false,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle<{ id: number }>();

  if (insertError || !inserted) {
    return { ok: false as const, message: insertError?.message ?? "تعذر نسخ المشروع." };
  }

  const newProjectId = inserted.id;

  const [{ data: floorPlans }, { data: deliveryItems }, { data: media }] = await Promise.all([
    supabase.from("project_floor_plans").select("area, label, plan_image, specs, featured, sort_order").eq("project_id", id),
    supabase.from("project_delivery_spec_items").select("body, sort_order").eq("project_id", id),
    supabase.from("project_media").select("collection, image, label, sort_order").eq("project_id", id),
  ]);

  if (floorPlans?.length) {
    const { error: floorPlansError } = await supabase.from("project_floor_plans").insert(
      floorPlans.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (floorPlansError) return { ok: false as const, message: floorPlansError.message };
  }

  if (deliveryItems?.length) {
    const { error: deliveryError } = await supabase.from("project_delivery_spec_items").insert(
      deliveryItems.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (deliveryError) return { ok: false as const, message: deliveryError.message };
  }

  if (media?.length) {
    const { error: mediaError } = await supabase.from("project_media").insert(
      media.map((row) => ({ ...row, project_id: newProjectId })),
    );
    if (mediaError) return { ok: false as const, message: mediaError.message };
  }

  revalidateProjectPaths(type, newProjectId, nextSlug);
  return { ok: true as const, message: "تم نسخ المشروع كمسودة." };
}
