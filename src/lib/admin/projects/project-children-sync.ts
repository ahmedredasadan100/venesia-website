import "server-only";

import type { MediaReferenceWriteScope } from "../media-catalog/write-lease";
import { buildMediaReferenceWriteScope } from "../media-catalog/reference-providers";
import { logError } from "../../logging";
import { parseFloorPlanSpecsFromForm } from "../../projects/floor-plan-specs";
import { getSupabaseAdmin } from "../../supabase-admin";

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
      plan_image: (images[index] ?? "").trim(),
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
) {
  const images = formData.getAll(`${prefix}_image`).map(String);
  const labels = formData.getAll(`${prefix}_label`).map(String);

  return images
    .map((image, index) => ({
      image: image.trim(),
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

type ChildTargetPlan = {
  domainKey: "project_floor_plans" | "project_media";
  leaseEntityIdentity: string;
  collection: string | null;
  index: number;
};

export type ProjectChildReferenceTarget = {
  domainKey: "project_floor_plans" | "project_media";
  entityIdentity: string;
  leaseEntityIdentity: string;
};

export type ProjectChildReferenceCleanupTarget = {
  domainKey: "project_floor_plans" | "project_media";
  entityIdentity: string;
};

export type PreparedProjectChildrenSync = {
  projectId: number;
  payload: SyncProjectChildrenPayload;
  scopes: MediaReferenceWriteScope[];
  targetPlans: ChildTargetPlan[];
  cleanupTargets: ProjectChildReferenceCleanupTarget[];
  floorPlansTouched: boolean;
  mediaCollectionsTouched: string[];
};

function buildSyncProjectChildrenPayload(
  projectId: number,
  formData: FormData,
  existingPlans: { plan_image: string; featured: boolean }[],
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
    payload.p_overview_media = parseMediaRows(formData, "overview_media");
  }

  if (formData.has("delivery_media_section")) {
    payload.p_delivery_media = parseMediaRows(formData, "delivery_media");
  }

  if (formData.has("gallery_media_section")) {
    payload.p_gallery_media = parseMediaRows(formData, "gallery_media");
  }

  return payload;
}

export async function prepareProjectChildrenSync(
  projectId: number,
  formData: FormData,
  operationIdentity: string,
): Promise<PreparedProjectChildrenSync> {
  const supabase = getSupabaseAdmin();
  const [
    { data: existingPlans, error: plansError },
    { data: existingMedia, error: mediaError },
  ] = await Promise.all([
    supabase
      .from("project_floor_plans")
      .select("id, plan_image, featured")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("project_media")
      .select("id, collection, image")
      .eq("project_id", projectId)
      .order("collection", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (plansError || mediaError) {
    logError("prepareProjectChildrenSync: pre-read failed", plansError || mediaError, { projectId });
    throw new Error("تعذر قراءة بيانات المشروع الحالية قبل الحفظ. لم يتم تطبيق أي تغيير على المخططات أو الوسائط.");
  }

  const plans = (existingPlans ?? []) as {
    id: number;
    plan_image: string;
    featured: boolean;
  }[];
  const media = (existingMedia ?? []) as {
    id: number;
    collection: string;
    image: string;
  }[];
  const payload = buildSyncProjectChildrenPayload(
    projectId,
    formData,
    plans,
  );
  const scopes: MediaReferenceWriteScope[] = [];
  const targetPlans: ChildTargetPlan[] = [];
  const cleanupTargets: ProjectChildReferenceCleanupTarget[] = [];

  if (payload.p_floor_plans !== undefined) {
    plans.forEach((row) => {
      cleanupTargets.push({ domainKey: "project_floor_plans", entityIdentity: String(row.id) });
    });
    payload.p_floor_plans.forEach((row, index) => {
      const leaseEntityIdentity = `project:${projectId}:floor:${operationIdentity}:${index}`;
      scopes.push(buildMediaReferenceWriteScope("project_floor_plans", leaseEntityIdentity, row));
      targetPlans.push({
        domainKey: "project_floor_plans",
        leaseEntityIdentity,
        collection: null,
        index,
      });
    });
  }

  const mediaSections = [
    ["overview", payload.p_overview_media],
    ["delivery_specs", payload.p_delivery_media],
    ["gallery", payload.p_gallery_media],
  ] as const;
  for (const [collection, rows] of mediaSections) {
    if (rows === undefined) continue;
    media
      .filter((row) => row.collection === collection)
      .forEach((row) => {
        cleanupTargets.push({ domainKey: "project_media", entityIdentity: String(row.id) });
      });
    rows.forEach((row, index) => {
      const leaseEntityIdentity = `project:${projectId}:${collection}:${operationIdentity}:${index}`;
      scopes.push(buildMediaReferenceWriteScope("project_media", leaseEntityIdentity, row));
      targetPlans.push({
        domainKey: "project_media",
        leaseEntityIdentity,
        collection,
        index,
      });
    });
  }

  return {
    projectId,
    payload,
    scopes,
    targetPlans,
    cleanupTargets,
    floorPlansTouched: payload.p_floor_plans !== undefined,
    mediaCollectionsTouched: mediaSections
      .filter(([, rows]) => rows !== undefined)
      .map(([collection]) => collection),
  };
}

export async function executePreparedProjectChildrenSync(
  prepared: PreparedProjectChildrenSync,
): Promise<{
  referenceTargets: ProjectChildReferenceTarget[];
  cleanupTargets: ProjectChildReferenceCleanupTarget[];
}> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("sync_project_children", prepared.payload);
  if (error) throw new Error(error.message);

  const [floorResult, mediaResult] = await Promise.all([
    prepared.floorPlansTouched
      ? supabase
          .from("project_floor_plans")
          .select("id, sort_order")
          .eq("project_id", prepared.projectId)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    prepared.mediaCollectionsTouched.length
      ? supabase
          .from("project_media")
          .select("id, collection, sort_order")
          .eq("project_id", prepared.projectId)
          .in("collection", prepared.mediaCollectionsTouched)
          .order("collection", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (floorResult.error || mediaResult.error) {
    throw new Error(
      floorResult.error?.message ||
        mediaResult.error?.message ||
        "تعذر إثبات هوية وسائط المشروع بعد الحفظ.",
    );
  }

  const floorRows = (floorResult.data ?? []) as { id: number; sort_order: number }[];
  const mediaRows = (mediaResult.data ?? []) as {
    id: number;
    collection: string;
    sort_order: number;
  }[];
  const referenceTargets = prepared.targetPlans.map((target) => {
    const row = target.domainKey === "project_floor_plans"
      ? floorRows[target.index]
      : mediaRows.filter((item) => item.collection === target.collection)[target.index];
    if (!row) throw new Error("project_child_identity_mapping_incomplete");
    return {
      domainKey: target.domainKey,
      entityIdentity: String(row.id),
      leaseEntityIdentity: target.leaseEntityIdentity,
    };
  });

  if (
    floorRows.length !== prepared.targetPlans.filter((target) => target.domainKey === "project_floor_plans").length ||
    mediaRows.length !== prepared.targetPlans.filter((target) => target.domainKey === "project_media").length
  ) {
    throw new Error("project_child_identity_mapping_mismatch");
  }

  return { referenceTargets, cleanupTargets: prepared.cleanupTargets };
}
