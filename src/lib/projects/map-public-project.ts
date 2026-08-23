import type {
  PublicProject,
  PublicProjectImage,
  PublicProjectLocationPoint,
  PublicProjectLocationLevel,
} from "./public-types";
import type { Tables } from "../database.types";
import { stripHtml } from "../rich-text/html-utils";
import { resolveProjectLocationPresentation } from "./project-location-presentation";

const RETIRED_DELIVERY_PRESENTATION_COPY =
  "نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.";

export type PublicProjectRootRow = Pick<
  Tables<"projects">,
  | "id"
  | "type"
  | "arabic_name"
  | "english_name"
  | "slug"
  | "code"
  | "featured"
  | "show_on_homepage"
  | "homepage_order"
  | "brochure_url"
  | "publication_status"
  | "published_at"
  | "general_description"
  | "short_description"
  | "image"
  | "image_alt"
  | "hero_image"
  | "hero_image_alt"
  | "small_box_image"
  | "small_box_image_alt"
  | "governorate_id"
  | "city_id"
  | "main_area_id"
  | "sub_area_id"
  | "location_label"
  | "show_location_label"
  | "show_location_tags"
  | "location_description"
  | "google_maps_url"
  | "latitude"
  | "longitude"
  | "map_zoom"
  | "location_title"
  | "overview_title"
  | "overview_body"
  | "overview_media_type"
  | "overview_main_image"
  | "overview_main_image_alt"
  | "delivery_title"
  | "delivery_body"
  | "plans_title"
  | "gallery_title"
  | "seo_title"
  | "seo_description"
  | "focus_keyword"
  | "seo_keywords"
  | "canonical_url"
  | "robots_index"
  | "robots_follow"
  | "og_image"
  | "og_image_alt"
  | "created_at"
  | "updated_at"
>;

export type PublicProjectLocationRow = Pick<
  Tables<"project_locations">,
  "id" | "level" | "parent_id" | "name_ar" | "name_en"
>;

type PublicProjectLocationPointRow = Pick<
  Tables<"project_location_points">,
  "id" | "kind" | "label" | "distance_text"
>;

type PublicProjectFeatureRow = Pick<
  Tables<"project_features">,
  "id" | "body"
>;

type PublicProjectFloorPlanRow = Pick<
  Tables<"project_floor_plans">,
  | "id"
  | "name"
  | "area_text"
  | "featured"
  | "architectural_image"
  | "architectural_image_alt"
  | "furnishing_image"
  | "furnishing_image_alt"
>;

type PublicProjectFloorPlanDetailRow = Pick<
  Tables<"project_floor_plan_details">,
  "id" | "floor_plan_id" | "label" | "value"
>;

type PublicProjectDeliveryItemRow = Pick<
  Tables<"project_delivery_items">,
  "id" | "body"
>;

type PublicProjectMediaRow = Pick<
  Tables<"project_media">,
  "id" | "section" | "image" | "alt_text"
>;

type PublicProjectVideoRow = Pick<
  Tables<"project_videos">,
  "id" | "section" | "video_url" | "poster_image" | "poster_alt"
>;

export type PublicProjectAggregate = {
  project: PublicProjectRootRow;
  locations?: PublicProjectLocationRow[];
  locationPoints?: PublicProjectLocationPointRow[];
  features?: PublicProjectFeatureRow[];
  floorPlans?: PublicProjectFloorPlanRow[];
  floorPlanDetails?: PublicProjectFloorPlanDetailRow[];
  deliveryItems?: PublicProjectDeliveryItemRow[];
  media?: PublicProjectMediaRow[];
  videos?: PublicProjectVideoRow[];
};

export class PublicProjectMappingError extends Error {
  readonly code = "public_project_mapping_failed";

  constructor(message: string) {
    super(message);
    this.name = "PublicProjectMappingError";
  }
}

function requiredString<Row extends object, Key extends keyof Row>(row: Row, field: Key) {
  const candidate = row[field];
  const value = typeof candidate === "string" ? candidate.trim() : "";
  if (!value) throw new PublicProjectMappingError(`Missing required project field: ${String(field)}`);
  return value;
}

function optionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function mapPublicDeliveryBody<Row extends object, Key extends keyof Row>(row: Row, field: Key) {
  const body = requiredString(row, field);
  const plainText = stripHtml(body).replace(/\s+/gu, " ");
  return plainText === RETIRED_DELIVERY_PRESENTATION_COPY ? "" : body;
}

function requiredNumber<Row extends object, Key extends keyof Row>(row: Row, field: Key) {
  const value = Number(row[field]);
  if (!Number.isFinite(value)) {
    throw new PublicProjectMappingError(`Invalid numeric project field: ${String(field)}`);
  }
  return value;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function mapImage(source: unknown, alt: unknown): PublicProjectImage | null {
  const src = optionalString(source);
  if (!src) return null;
  return { src, alt: optionalString(alt) ?? "" };
}

function requireImage(
  row: PublicProjectRootRow,
  sourceField: keyof PublicProjectRootRow,
  altField: keyof PublicProjectRootRow,
): PublicProjectImage {
  const image = mapImage(row[sourceField], row[altField]);
  if (!image?.alt) {
    throw new PublicProjectMappingError(`Missing required project image contract: ${sourceField}`);
  }
  return image;
}

function mapLocationLevel(
  locations: PublicProjectLocationRow[],
  idValue: number | null,
): PublicProjectLocationLevel | null {
  if (idValue === null || idValue === undefined) return null;
  const id = Number(idValue);
  const row = locations.find((candidate) => Number(candidate.id) === id);
  if (!row) return null;
  return {
    id: String(id),
    nameAr: requiredString(row, "name_ar"),
    nameEn: requiredString(row, "name_en"),
  };
}

function rows<Row>(value: Row[] | undefined): Row[] {
  return value ?? [];
}

function requireLocationPointKind(value: string): PublicProjectLocationPoint["kind"] {
  if (value === "transport" || value === "road" || value === "landmark") {
    return value;
  }
  throw new PublicProjectMappingError("Invalid project location point kind");
}

export function mapProjectAggregateToPublicProject(
  aggregate: PublicProjectAggregate,
): PublicProject {
  const project = aggregate.project;
  const category = project.type;
  if (category !== "residential" && category !== "commercial") {
    throw new PublicProjectMappingError("Invalid project type");
  }

  const locations = rows(aggregate.locations);
  const floorPlanDetails = rows(aggregate.floorPlanDetails);
  const media = rows(aggregate.media);
  const videos = rows(aggregate.videos);

  const mapMedia = (section: string) =>
    media
      .filter((item) => item.section === section)
      .map((item) => {
        const image = mapImage(item.image, item.alt_text);
        if (!image?.alt) {
          throw new PublicProjectMappingError(`Invalid ${section} media row`);
        }
        return { id: String(item.id), ...image };
      });

  const mapVideos = (section: string) =>
    videos
      .filter((item) => item.section === section)
      .map((item) => ({
        id: String(item.id),
        url: requiredString(item, "video_url"),
        poster: mapImage(item.poster_image, item.poster_alt),
      }));

  const seoKeywords = Array.isArray(project.seo_keywords)
    ? project.seo_keywords.map(String).map((value) => value.trim()).filter(Boolean)
    : [];

  return {
    id: String(requiredNumber(project, "id")),
    slug: requiredString(project, "slug"),
    category,
    arabicName: requiredString(project, "arabic_name"),
    englishName: requiredString(project, "english_name"),
    featured: project.featured === true,
    code: requiredString(project, "code"),
    showOnHomepage: project.show_on_homepage === true,
    homepageOrder: requiredNumber(project, "homepage_order"),
    brochureUrl: optionalString(project.brochure_url),
    generalDescription: requiredString(project, "general_description"),
    shortDescription: requiredString(project, "short_description"),
    cardImage: requireImage(project, "image", "image_alt"),
    heroImage: requireImage(project, "hero_image", "hero_image_alt"),
    heroBoxImage: requireImage(project, "small_box_image", "small_box_image_alt"),
    location: {
      title: optionalString(project.location_title),
      label: requiredString(project, "location_label"),
      description: optionalString(project.location_description) ?? "",
      googleMapsUrl: requiredString(project, "google_maps_url"),
      latitude: requiredNumber(project, "latitude"),
      longitude: requiredNumber(project, "longitude"),
      zoom: requiredNumber(project, "map_zoom"),
      governorate: mapLocationLevel(locations, project.governorate_id),
      city: mapLocationLevel(locations, project.city_id),
      mainArea: mapLocationLevel(locations, project.main_area_id),
      subArea: mapLocationLevel(locations, project.sub_area_id),
      presentation: resolveProjectLocationPresentation(project),
      points: rows(aggregate.locationPoints).map((item) => ({
        id: String(item.id),
        kind: requireLocationPointKind(item.kind),
        label: requiredString(item, "label"),
        distanceText: optionalString(item.distance_text) ?? "",
      })),
    },
    overview: {
      title: optionalString(project.overview_title),
      body: requiredString(project, "overview_body"),
      mediaType: project.overview_media_type === "video" ? "video" : "image",
      mainImage: mapImage(project.overview_main_image, project.overview_main_image_alt),
      features: rows(aggregate.features).map((item) => ({
        id: String(item.id),
        body: requiredString(item, "body"),
      })),
      images: mapMedia("overview"),
      videos: mapVideos("overview"),
    },
    plansTitle: optionalString(project.plans_title),
    plans: rows(aggregate.floorPlans).map((plan) => ({
      id: String(plan.id),
      name: requiredString(plan, "name"),
      areaText: optionalString(plan.area_text) ?? "",
      featured: plan.featured === true,
      architecturalImage: mapImage(plan.architectural_image, plan.architectural_image_alt),
      furnishingImage: mapImage(plan.furnishing_image, plan.furnishing_image_alt),
      details: floorPlanDetails
        .filter((detail) => Number(detail.floor_plan_id) === Number(plan.id))
        .map((detail) => ({
          id: String(detail.id),
          label: requiredString(detail, "label"),
          value: requiredString(detail, "value"),
        })),
    })),
    delivery: {
      title: optionalString(project.delivery_title),
      body: mapPublicDeliveryBody(project, "delivery_body"),
      items: rows(aggregate.deliveryItems).map((item) => ({
        id: String(item.id),
        body: requiredString(item, "body"),
      })),
      images: mapMedia("delivery"),
    },
    gallery: {
      title: optionalString(project.gallery_title),
      images: mapMedia("gallery"),
      videos: mapVideos("gallery"),
    },
    seo: {
      title: optionalString(project.seo_title),
      description: optionalString(project.seo_description),
      focusKeyword: optionalString(project.focus_keyword),
      keywords: seoKeywords,
      canonicalUrl: optionalString(project.canonical_url),
      robotsIndex: optionalBoolean(project.robots_index),
      robotsFollow: optionalBoolean(project.robots_follow),
      ogImage: mapImage(project.og_image, project.og_image_alt),
    },
    createdAt: requiredString(project, "created_at"),
    updatedAt: requiredString(project, "updated_at"),
  };
}

export function mapProjectRowToPublicProject(
  project: PublicProjectRootRow,
  locations: PublicProjectLocationRow[] = [],
) {
  return mapProjectAggregateToPublicProject({ project, locations });
}
