import "server-only";

import type { Tables } from "../../database.types";
import { getSupabaseAdmin } from "../../supabase-admin";
import {
  createEmptyProjectEntry,
  type ProjectDeliveryItemEntry,
  type ProjectEntryBundle,
  type ProjectEntryRoot,
  type ProjectFeatureEntry,
  type ProjectFloorPlanDetailEntry,
  type ProjectFloorPlanEntry,
  type ProjectLocationOption,
  type ProjectLocationPointEntry,
  type ProjectMediaEntry,
  type ProjectType,
  type ProjectVideoEntry,
} from "./project-entry-contract";
import { PROJECT_LOCATION_LEVELS } from "./location-management-contract";
import { isProjectPublicationStatus } from "./project-publishing-capability";

const PROJECT_ROOT_SELECT = "id,type,code,arabic_name,english_name,slug,general_description,short_description,image,image_alt,hero_image,hero_image_alt,small_box_image,small_box_image_alt,governorate_id,city_id,main_area_id,sub_area_id,location_label,show_location_label,show_location_tags,location_description,google_maps_url,latitude,longitude,map_zoom,location_title,overview_title,overview_body,overview_media_type,overview_main_image,overview_main_image_alt,plans_title,delivery_title,delivery_body,gallery_title,seo_title,seo_description,focus_keyword,seo_keywords,canonical_url,robots_index,robots_follow,og_image,og_image_alt,publication_status,published_at,published_by,featured,show_on_homepage,homepage_order,brochure_url,created_at,updated_at";

type ProjectLocationSelection = Pick<
  Tables<"project_locations">,
  "id" | "level" | "parent_id" | "name_ar" | "name_en" | "is_active"
>;

export class ProjectEntrySchemaUnavailableError extends Error {
  readonly code: string;

  constructor(message: string, code = "project_entry_schema_unavailable") {
    super(message);
    this.name = "ProjectEntrySchemaUnavailableError";
    this.code = code;
  }
}

function invalidStoredProjectEntryValue(field: string): never {
  throw new ProjectEntrySchemaUnavailableError(
    `Stored Project data violates the ${field} contract.`,
    "project_entry_database_contract_invalid",
  );
}

function requireProjectLocationLevel(value: string): ProjectLocationOption["level"] {
  const level = PROJECT_LOCATION_LEVELS.find((candidate) => candidate === value);
  return level ?? invalidStoredProjectEntryValue("project_locations.level");
}

function requireProjectLocationPointKind(value: string): ProjectLocationPointEntry["kind"] {
  if (value === "transport" || value === "road" || value === "landmark") return value;
  return invalidStoredProjectEntryValue("project_location_points.kind");
}

function requireProjectMediaSection(value: string): ProjectMediaEntry["section"] {
  if (value === "overview" || value === "delivery" || value === "gallery") return value;
  return invalidStoredProjectEntryValue("project_media.section");
}

function requireProjectVideoSection(value: string): ProjectVideoEntry["section"] {
  if (value === "overview" || value === "gallery") return value;
  return invalidStoredProjectEntryValue("project_videos.section");
}

function requireProjectType(value: string): ProjectType {
  if (value === "residential" || value === "commercial") return value;
  return invalidStoredProjectEntryValue("projects.type");
}

function requireProjectOverviewMediaType(
  value: string,
): ProjectEntryRoot["overview_media_type"] {
  if (value === "image" || value === "video") return value;
  return invalidStoredProjectEntryValue("projects.overview_media_type");
}

function requireProjectPublicationStatus(
  value: string,
): ProjectEntryRoot["publication_status"] {
  if (isProjectPublicationStatus(value)) return value;
  return invalidStoredProjectEntryValue("projects.publication_status");
}

function schemaMessage(message?: string) {
  return message?.trim()
    ? `مخطط إدخال بيانات المشاريع الجديد غير متاح في قاعدة البيانات الحالية: ${message}`
    : "مخطط إدخال بيانات المشاريع الجديد غير متاح في قاعدة البيانات الحالية.";
}

function numberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function booleanOrNull(value: boolean | null | undefined) {
  return typeof value === "boolean" ? value : null;
}

function mapLocation(row: ProjectLocationSelection): ProjectLocationOption {
  return {
    id: Number(row.id),
    level: requireProjectLocationLevel(row.level),
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
    locations: (data ?? []).map(mapLocation),
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
    .maybeSingle();

  if (rootResult.error) {
    throw new ProjectEntrySchemaUnavailableError(
      schemaMessage(rootResult.error.message),
      rootResult.error.code || "project_entry_schema_unavailable",
    );
  }
  if (!rootResult.data) return null;
  const retainedLocationIds = [
    rootResult.data.governorate_id,
    rootResult.data.city_id,
    rootResult.data.main_area_id,
    rootResult.data.sub_area_id,
  ]
    .map(numberOrNull)
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

  const planRows = plansResult.data ?? [];
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
  const detailRows = detailsResult.data ?? [];

  const root = rootResult.data;
  const projectType = requireProjectType(root.type);
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
      show_location_label: root.show_location_label !== false,
      show_location_tags: root.show_location_tags !== false,
      location_description: stringValue(root.location_description),
      google_maps_url: stringValue(root.google_maps_url),
      latitude: stringValue(root.latitude),
      longitude: stringValue(root.longitude),
      map_zoom: stringValue(root.map_zoom),
      location_title: stringValue(root.location_title),
      overview_title: stringValue(root.overview_title),
      overview_body: stringValue(root.overview_body),
      overview_media_type: requireProjectOverviewMediaType(root.overview_media_type),
      overview_main_image: stringValue(root.overview_main_image),
      overview_main_image_alt: stringValue(root.overview_main_image_alt),
      delivery_title: stringValue(root.delivery_title),
      delivery_body: stringValue(root.delivery_body),
      plans_title: stringValue(root.plans_title),
      gallery_title: stringValue(root.gallery_title),
      seo_title: stringValue(root.seo_title),
      seo_description: stringValue(root.seo_description),
      focus_keyword: stringValue(root.focus_keyword),
      seo_keywords: root.seo_keywords,
      canonical_url: stringValue(root.canonical_url),
      robots_index: booleanOrNull(root.robots_index),
      robots_follow: booleanOrNull(root.robots_follow),
      og_image: stringValue(root.og_image),
      og_image_alt: stringValue(root.og_image_alt),
      publication_status: requireProjectPublicationStatus(root.publication_status),
      published_at: stringValue(root.published_at) || null,
      published_by: numberOrNull(root.published_by),
      featured: root.featured === true,
      show_on_homepage: root.show_on_homepage === true,
      homepage_order: Number(root.homepage_order ?? 0),
      brochure_url: stringValue(root.brochure_url),
      created_at: stringValue(root.created_at) || null,
      updated_at: stringValue(root.updated_at) || null,
    },
    location_points: (locationPointsResult.data ?? []).map(
      (row): ProjectLocationPointEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        kind: requireProjectLocationPointKind(row.kind),
        label: stringValue(row.label),
        distance_text: stringValue(row.distance_text),
      }),
    ),
    features: (featuresResult.data ?? []).map(
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
    delivery_items: (deliveryResult.data ?? []).map(
      (row): ProjectDeliveryItemEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        body: stringValue(row.body),
      }),
    ),
    media: (mediaResult.data ?? []).map(
      (row): ProjectMediaEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        section: requireProjectMediaSection(row.section),
        image: stringValue(row.image),
        alt_text: stringValue(row.alt_text),
      }),
    ),
    videos: (videosResult.data ?? []).map(
      (row): ProjectVideoEntry => ({
        id: Number(row.id),
        client_key: stringValue(row.client_key),
        section: requireProjectVideoSection(row.section),
        video_url: stringValue(row.video_url),
        poster_image: stringValue(row.poster_image),
        poster_alt: stringValue(row.poster_alt),
      }),
    ),
  };
}
