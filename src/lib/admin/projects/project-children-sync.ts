import "server-only";

import { parseFloorPlanSpecsFromForm } from "../../projects/floor-plan-specs";
import { getSupabaseAdmin } from "../../supabase-admin";

function preserveImage(nextValue: string, currentValue: string) {
  return nextValue.trim() || currentValue;
}

function getAllStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
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

export async function syncProjectChildren(projectId: number, formData: FormData) {
  const supabase = getSupabaseAdmin();

  const [{ data: existingPlans }, { data: existingMedia }] = await Promise.all([
    supabase
      .from("project_floor_plans")
      .select("plan_image, featured")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_media")
      .select("collection, image")
      .eq("project_id", projectId)
      .order("collection", { ascending: true })
      .order("sort_order", { ascending: true }),
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
