import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import {
  createEmptyProjectEntry,
  type ProjectDeliveryItemEntry,
  type ProjectEntryBundle,
  type ProjectFeatureEntry,
  type ProjectFloorPlanDetailEntry,
  type ProjectFloorPlanEntry,
  type ProjectLocationOption,
  type ProjectLocationPointEntry,
  type ProjectMediaEntry,
  type ProjectType,
  type ProjectVideoEntry,
} from "./project-entry-contract";

const PROJECT_ROOT_SELECT = [
  "id",
  "type",
  "code",
  "arabic_name",
  "english_name",
  "slug",
  "general_description",
  "short_description",
  "image",
  "image_alt",
  "hero_image",
  "hero_image_alt",
  "small_box_image",
  "small_box_image_alt",
  "governorate_id",
  "city_id",
  "main_area_id",
  "sub_area_id",
  "location_label",
  "location_description",
  "google_maps_url",
  "latitude",
  "longitude",
  "map_zoom",
  "overview_title",
  "overview_body",
  "overview_media_type",
  "overview_main_image",
  "overview_main_image_alt",
  "delivery_title",
  "delivery_body",
  "seo_title",
  "seo_description",
  "focus_keyword",
  "seo_keywords",
  "canonical_url",
  "robots_index",
  "robots_follow",
  "og_image",
  "og_image_alt",
  "publication_status",
  "published_at",
  "published_by",
  "featured",
  "show_on_homepage",
  "homepage_order",
  "brochure_url",
  "created_at",
  "updated_at",
].join(",");

export class ProjectEntrySchemaUnavailableError extends Error {
  readonly code: string;

  constructor(message: string, code = "project_entry_schema_unavailable") {
    super(message);
    this.name = "ProjectEntrySchemaUnavailableError";
    this.code = code;
  }
}

function schemaMessage(message?: string) {
  return message?.trim()
    ? `مخطط إدخال بيانات المشاريع الجديد غير متاح في قاعدة البيانات الحالية: ${message}`
    : "مخطط إدخال بيانات المشاريع الجديد غير متاح في قاعدة البيانات الحالية.";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function mapLocation(row: Record<string, unknown>): ProjectLocationOption {
  return {
    id: Number(row.id),
    level: row.level as ProjectLocationOption["level"],
    parentId: numberOrNull(row.parent_id),
    nameAr: stringValue(row.name_ar),
    nameEn: stringValue(row.name_en),
    isActive: row.is_active === true,
  };
}

export async function loadProjectLocationOptions(
  retainedLocationIds: readonly number[] = [],
): Promise<{
  locations: ProjectLocationOption[];
  schemaReady: boolean;
  schemaMessage: string | null;
}> {
  const retainedIds = [...new Set(retainedLocationIds)]
    .filter((value) => Number.isSafeInteger(value) && value > 0)
    .sort((left, right) => left - right);
  let query = getSupabaseAdmin()
    .from("project_locations")
    .select("id,level,parent_id,name_ar,name_en,is_active,sort_order");
  query = retainedIds.length
    ? query.or(`is_active.eq.true,id.in.(${retainedIds.join(",")})`)
    : query.eq("is_active", true);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return {
      locations: [],
      schemaReady: false,
      schemaMessage: schemaMessage(error.message),
    };
  }

  return {
    locations: ((data ?? []) as Record<string, unknown>[]).map(mapLocation),
    schemaReady: true,
    schemaMessage: null,
  };
}

export async function loadEmptyProjectEntry(
  type: ProjectType,
): Promise<ProjectEntryBundle> {
  const entry = createEmptyProjectEntry(type);
  const locationState = await loadProjectLocationOptions();
  return { ...entry, ...locationState };
}

export async function loadProjectEntry(
  id: number,
): Promise<ProjectEntryBundle | null> {
  const supabase = getSupabaseAdmin();
  const rootResult = await supabase
    .from("projects")
    .select(PROJECT_ROOT_SELECT)
    .eq("id", id)
    .maybeSingle<Record<string, unknown>>();

  if (rootResult.error) {
    throw new ProjectEntrySchemaUnavailableError(
      schemaMessage(rootResult.error.message),
      rootResult.error.code || "project_entry_schema_unavailable",
    );
  }
  if (!rootResult.data) return null;
  const retainedLocationIds = [
    "governorate_id",
    "city_id",
    "main_area_id",
    "sub_area_id",
  ]
    .map((field) => numberOrNull(rootResult.data?.[field]))
    .filter((value): value is number => value !== null);

  const [
    locationState,
    locationPointsResult,
    featuresResult,
    plansResult,
    deliveryResult,
    mediaResult,
    videosResult,
  ] = await Promise.all([
    loadProjectLocationOptions(retainedLocationIds),
    supabase
      .from("project_location_points")
      .select("id,client_key,kind,label,distance_text,sort_order")
      .eq("project_id", id)
      .order("kind")
      .order("sort_order"),
    supabase
      .from("project_features")
      .select("id,client_key,body,sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_floor_plans")
      .select("id,client_key,name,area_text,featured,architectural_image,architectural_image_alt,furnishing_image,furnishing_image_alt,sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_delivery_items")
      .select("id,client_key,body,sort_order")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_media")
      .select("id,client_key,section,image,alt_text,sort_order")
      .eq("project_id", id)
      .order("section")
      .order("sort_order"),
    supabase
      .from("project_videos")
      .select("id,client_key,section,video_url,poster_image,poster_alt,sort_order")
      .eq("project_id", id)
      .order("section")
      .order("sort_order"),
  ]);

  const childErrors = [
    locationPointsResult.error,
    featuresResult.error,
    plansResult.error,
    deliveryResult.error,
    mediaResult.error,
    videosResult.error,
  ].filter(Boolean);
  if (childErrors.length) {
    throw new ProjectEntrySchemaUnavailableError(
      schemaMessage(childErrors.map((error) => error?.message).filter(Boolean).join(" | ")),
    );
  }

  const planRows = (plansResult.data ?? []) as Record<string, unknown>[];
  const planIds = planRows.map((row) => Number(row.id)).filter(Number.isFinite);
  const detailsResult = planIds.length
    ? await supabase
        .from("project_floor_plan_details")
        .select("id,client_key,floor_plan_id,label,value,sort_order")
        .in("floor_plan_id", planIds)
        .order("floor_plan_id")
        .order("sort_order")
    : { data: [], error: null };
  if (detailsResult.error) {
    throw new ProjectEntrySchemaUnavailableError(schemaMessage(detailsResult.error.message));
  }
  const detailRows = (detailsResult.data ?? []) as Record<string, unknown>[];

  const root = rootResult.data;
  const projectType: ProjectType = root.type === "commercial" ? "commercial" : "residential";
  const entry = createEmptyProjectEntry(projectType);

  return {
    ...entry,
    ...locationState,
    project: {
      ...entry.project,
      id: Number(root.id),
      type: projectType,
      code: stringValue(root.code),
      arabic_name: stringValue(root.arabic_name),
      english_name: stringValue(root.english_name),
      slug: stringValue(root.slug),
      general_description: stringValue(root.general_description),
      short_description: stringValue(root.short_description),
      image: stringValue(root.image),
      image_alt: stringValue(root.image_alt),
      hero_image: stringValue(root.hero_image),
      hero_image_alt: stringValue(root.hero_image_alt),
      small_box_image: stringValue(root.small_box_image),
      small_box_image_alt: stringValue(root.small_box_image_alt),
      governorate_id: numberOrNull(root.governorate_id),
      city_id: numberOrNull(root.city_id),
      main_area_id: numberOrNull(root.main_area_id),
      sub_area_id: numberOrNull(root.sub_area_id),
      location_label: stringValue(root.location_label),
      location_description: stringValue(root.location_description),
      google_maps_url: stringValue(root.google_maps_url),
      latitude: stringValue(root.latitude),
      longitude: stringValue(root.longitude),
      map_zoom: stringValue(root.map_zoom),
      overview_title: stringValue(root.overview_title),
      overview_body: stringValue(root.overview_body),
      overview_media_type: root.overview_media_type === "video" ? "video" : "image",
      overview_main_image: stringValue(root.overview_main_image),
      overview_main_image_alt: stringValue(root.overview_main_image_alt),
      delivery_title: stringValue(root.delivery_title),
      delivery_body: stringValue(root.delivery_body),
      seo_title: stringValue(root.seo_title),
      seo_description: stringValue(root.seo_description),
      focus_keyword: stringValue(root.focus_keyword),
      seo_keywords: Array.isArray(root.seo_keywords)
        ? root.seo_keywords.map(String).filter(Boolean)
        : [],
      canonical_url: stringValue(root.canonical_url),
      robots_index: booleanOrNull(root.robots_index),
      robots_follow: booleanOrNull(root.robots_follow),
      og_image: stringValue(root.og_image),
      og_image_alt: stringValue(root.og_image_alt),
      publication_status:
        root.publication_status === "published" ||
        root.publication_status === "unpublished"
          ? root.publication_status
          : "unpublished",
      published_at: stringValue(root.published_at) || null,
      published_by: numberOrNull(root.published_by),
      featured: root.featured === true,
      show_on_homepage: root.show_on_homepage === true,
      homepage_order: Number(root.homepage_order ?? 0),
      brochure_url: stringValue(root.brochure_url),
      created_at: stringValue(root.created_at) || null,
      updated_at: stringValue(root.updated_at) || null,
    },
    location_points: ((locationPointsResult.data ?? []) as Record<string, unknown>[]).map(
      (row): ProjectLocationPointEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        kind: row.kind as ProjectLocationPointEntry["kind"],
        label: stringValue(row.label),
        distance_text: stringValue(row.distance_text),
      }),
    ),
    features: ((featuresResult.data ?? []) as Record<string, unknown>[]).map(
      (row): ProjectFeatureEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        body: stringValue(row.body),
      }),
    ),
    floor_plans: planRows.map(
      (row): ProjectFloorPlanEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        name: stringValue(row.name),
        area_text: stringValue(row.area_text),
        featured: Boolean(row.featured),
        architectural_image: stringValue(row.architectural_image),
        architectural_image_alt: stringValue(row.architectural_image_alt),
        furnishing_image: stringValue(row.furnishing_image),
        furnishing_image_alt: stringValue(row.furnishing_image_alt),
        details: detailRows
          .filter((detail) => Number(detail.floor_plan_id) === Number(row.id))
          .map(
            (detail): ProjectFloorPlanDetailEntry => ({
              id: Number(detail.id),
              client_key: stringValue(detail.client_key),
              label: stringValue(detail.label),
              value: stringValue(detail.value),
            }),
          ),
      }),
    ),
    delivery_items: ((deliveryResult.data ?? []) as Record<string, unknown>[]).map(
      (row): ProjectDeliveryItemEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        body: stringValue(row.body),
      }),
    ),
    media: ((mediaResult.data ?? []) as Record<string, unknown>[]).map(
      (row): ProjectMediaEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        section: row.section as ProjectMediaEntry["section"],
        image: stringValue(row.image),
        alt_text: stringValue(row.alt_text),
      }),
    ),
    videos: ((videosResult.data ?? []) as Record<string, unknown>[]).map(
      (row): ProjectVideoEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        section: row.section as ProjectVideoEntry["section"],
        video_url: stringValue(row.video_url),
        poster_image: stringValue(row.poster_image),
        poster_alt: stringValue(row.poster_alt),
      }),
    ),
  };
}
