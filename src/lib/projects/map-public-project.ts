import type {
  ProjectCategory,
  PublicProject,
  PublicProjectImage,
  PublicProjectLocationLevel,
} from "./public-types";

export type PublicProjectRootRow = Record<string, unknown>;
export type PublicProjectChildRow = Record<string, unknown>;

export type PublicProjectAggregate = {
  project: PublicProjectRootRow;
  locations?: PublicProjectChildRow[];
  locationPoints?: PublicProjectChildRow[];
  features?: PublicProjectChildRow[];
  floorPlans?: PublicProjectChildRow[];
  floorPlanDetails?: PublicProjectChildRow[];
  deliveryItems?: PublicProjectChildRow[];
  media?: PublicProjectChildRow[];
  videos?: PublicProjectChildRow[];
};

export class PublicProjectMappingError extends Error {
  readonly code = "public_project_mapping_failed";

  constructor(message: string) {
    super(message);
    this.name = "PublicProjectMappingError";
  }
}

function requiredString(row: PublicProjectRootRow, field: string) {
  const value = typeof row[field] === "string" ? row[field].trim() : "";
  if (!value) throw new PublicProjectMappingError(`Missing required project field: ${field}`);
  return value;
}

function optionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredNumber(row: PublicProjectRootRow, field: string) {
  const value = Number(row[field]);
  if (!Number.isFinite(value)) {
    throw new PublicProjectMappingError(`Invalid numeric project field: ${field}`);
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
  sourceField: string,
  altField: string,
): PublicProjectImage {
  const image = mapImage(row[sourceField], row[altField]);
  if (!image?.alt) {
    throw new PublicProjectMappingError(`Missing required project image contract: ${sourceField}`);
  }
  return image;
}

function mapLocationLevel(
  locations: PublicProjectChildRow[],
  idValue: unknown,
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

function rows(value: PublicProjectChildRow[] | undefined) {
  return value ?? [];
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
    category: category as ProjectCategory,
    arabicName: requiredString(project, "arabic_name"),
    englishName: requiredString(project, "english_name"),
    code: requiredString(project, "english_name"),
    generalDescription: requiredString(project, "general_description"),
    shortDescription: requiredString(project, "short_description"),
    cardImage: requireImage(project, "image", "image_alt"),
    heroImage: requireImage(project, "hero_image", "hero_image_alt"),
    heroBoxImage: requireImage(project, "small_box_image", "small_box_image_alt"),
    location: {
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
      points: rows(aggregate.locationPoints).map((item) => ({
        id: String(item.id),
        kind: item.kind as PublicProject["location"]["points"][number]["kind"],
        label: requiredString(item, "label"),
        distanceText: optionalString(item.distance_text) ?? "",
      })),
    },
    overview: {
      title: requiredString(project, "overview_title"),
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
      title: requiredString(project, "delivery_title"),
      body: requiredString(project, "delivery_body"),
      items: rows(aggregate.deliveryItems).map((item) => ({
        id: String(item.id),
        body: requiredString(item, "body"),
      })),
      images: mapMedia("delivery"),
    },
    gallery: {
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
  locations: PublicProjectChildRow[] = [],
) {
  return mapProjectAggregateToPublicProject({ project, locations });
}
