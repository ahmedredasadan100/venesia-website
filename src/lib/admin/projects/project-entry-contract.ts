import { validateSlugFormat } from "../slug";
import { stripHtml } from "../../rich-text/html-utils";
import {
  readEntitySeoFormData,
  validateEntitySeoValues,
} from "../../seo/entity-seo-types";
import {
  isProjectPublicationStatus,
  type ProjectPublicationStatus,
} from "./project-publishing-capability";
import type { ProjectLocationLevel } from "./location-management-contract";
import {
  DEFAULT_PROJECT_LOCATION_PRESENTATION,
  type ProjectLocationPresentationStorage,
} from "../../projects/project-location-presentation";

export type ProjectType = "residential" | "commercial";
export type { ProjectLocationLevel } from "./location-management-contract";
export type ProjectLocationPointKind = "transport" | "road" | "landmark";
export type ProjectMediaSection = "overview" | "delivery" | "gallery";
export type ProjectVideoSection = "overview" | "gallery";

export type ProjectLocationOption = {
  id: number;
  level: ProjectLocationLevel;
  parentId: number | null;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
};

export type ProjectEntryRoot = ProjectLocationPresentationStorage & {
  id: number | null;
  type: ProjectType;
  code: string;
  arabic_name: string;
  english_name: string;
  slug: string;
  general_description: string;
  short_description: string;
  image: string;
  image_alt: string;
  hero_image: string;
  hero_image_alt: string;
  small_box_image: string;
  small_box_image_alt: string;
  governorate_id: number | null;
  city_id: number | null;
  main_area_id: number | null;
  sub_area_id: number | null;
  location_label: string;
  location_description: string;
  google_maps_url: string;
  latitude: string;
  longitude: string;
  map_zoom: string;
  location_title: string;
  overview_title: string;
  overview_body: string;
  overview_media_type: "image" | "video";
  overview_main_image: string;
  overview_main_image_alt: string;
  delivery_title: string;
  delivery_body: string;
  plans_title: string;
  gallery_title: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  seo_keywords: string[];
  canonical_url: string;
  robots_index: boolean | null;
  robots_follow: boolean | null;
  og_image: string;
  og_image_alt: string;
  publication_status: ProjectPublicationStatus;
  published_at: string | null;
  published_by: number | null;
  featured: boolean;
  show_on_homepage: boolean;
  homepage_order: number;
  brochure_url: string;
  created_at: string | null;
  updated_at: string | null;
};

export type ProjectLocationPointEntry = {
  id: number | null;
  client_key: string;
  kind: ProjectLocationPointKind;
  label: string;
  distance_text: string;
};

export type ProjectFeatureEntry = {
  id: number | null;
  client_key: string;
  body: string;
};

export type ProjectFloorPlanDetailEntry = {
  id: number | null;
  client_key: string;
  label: string;
  value: string;
};

export type ProjectFloorPlanEntry = {
  id: number | null;
  client_key: string;
  name: string;
  area_text: string;
  featured: boolean;
  architectural_image: string;
  architectural_image_alt: string;
  furnishing_image: string;
  furnishing_image_alt: string;
  details: ProjectFloorPlanDetailEntry[];
};

export type ProjectDeliveryItemEntry = {
  id: number | null;
  client_key: string;
  body: string;
};

export type ProjectMediaEntry = {
  id: number | null;
  client_key: string;
  section: ProjectMediaSection;
  image: string;
  alt_text: string;
};

export type ProjectVideoEntry = {
  id: number | null;
  client_key: string;
  section: ProjectVideoSection;
  video_url: string;
  poster_image: string;
  poster_alt: string;
};

export type ProjectEntryDeletedIds = {
  location_point_ids: number[];
  feature_ids: number[];
  floor_plan_ids: number[];
  floor_plan_detail_ids: number[];
  delivery_item_ids: number[];
  media_ids: number[];
  video_ids: number[];
};

export type ProjectEntryPayload = {
  project: ProjectEntryRoot;
  location_points: ProjectLocationPointEntry[];
  features: ProjectFeatureEntry[];
  floor_plans: ProjectFloorPlanEntry[];
  delivery_items: ProjectDeliveryItemEntry[];
  media: ProjectMediaEntry[];
  videos: ProjectVideoEntry[];
  deleted: ProjectEntryDeletedIds;
};

export type ProjectEntryBundle = ProjectEntryPayload & {
  locations: ProjectLocationOption[];
  schemaReady: boolean;
  schemaMessage: string | null;
};

export type ProjectEntryFieldErrors = Record<string, string[]>;

export const PROJECT_ENTRY_VALIDATION_FIELDS = [
  "type",
  "code",
  "publication_status",
  "arabic_name",
  "english_name",
  "slug",
  "homepage_order",
  "brochure_url",
  "general_description",
  "short_description",
  "image",
  "image_alt",
  "hero_image",
  "hero_image_alt",
  "small_box_image",
  "small_box_image_alt",
  "overview_main_image",
  "overview_main_image_alt",
  "governorate_id",
  "location_label",
  "google_maps_url",
  "latitude",
  "longitude",
  "map_zoom",
  "location_point_label",
  "feature_body",
  "location_title",
  "overview_title",
  "overview_body",
  "overview_video_url",
  "floor_plan_name",
  "plans_title",
  "floor_plan_architectural_image_alt",
  "floor_plan_furnishing_image_alt",
  "floor_plan_detail_label",
  "delivery_item_body",
  "delivery_title",
  "delivery_body",
  "gallery_title",
  "overview_media_image",
  "overview_media_alt_text",
  "delivery_media_image",
  "delivery_media_alt_text",
  "gallery_media_image",
  "gallery_media_alt_text",
  "overview_video_poster_alt",
  "gallery_video_url",
  "gallery_video_poster_alt",
  "seo_title",
  "seo_description",
  "canonical_url",
  "og_image_alt",
  "id",
] as const;

export type ProjectEntryValidationField =
  (typeof PROJECT_ENTRY_VALIDATION_FIELDS)[number];

export type ProjectEntryValidationCheck = {
  id: `project-entry:${ProjectEntryValidationField}`;
  field: ProjectEntryValidationField;
  valid: boolean;
  messages: string[];
};

export type ProjectEntryValidationAssessment = {
  fieldErrors: ProjectEntryFieldErrors;
  checks: ProjectEntryValidationCheck[];
};

function isProjectEntryValidationField(
  field: string,
): field is ProjectEntryValidationField {
  return (PROJECT_ENTRY_VALIDATION_FIELDS as readonly string[]).includes(field);
}

export const PROJECT_ENTRY_TAB_IDS = {
  basic: "basic",
  location: "location",
  overview: "overview",
  plans: "plans",
  delivery: "delivery",
  media: "media",
  seo: "seo",
  review: "review",
} as const;

export const PROJECT_ENTRY_NAVIGATION_EVENT = "admin-project-entry:navigate";

export const PROJECT_ENTRY_FOCUS_TARGETS: Record<string, string> = {
  code: "project-code",
  image: "image-field",
  hero_image: "hero_image-field",
  small_box_image: "small_box_image-field",
  overview_main_image: "overview_main_image-field",
  overview_body: "overview_body-editor",
  delivery_body: "delivery_body-editor",
  seo_title: "project-seo-title",
  seo_description: "project-seo-description",
  focus_keyword: "project-focus-keyword",
  seo_keywords: "project-seo-keywords",
  canonical_url: "project-canonical-url",
  robots_index: "project-robots-index",
  robots_follow: "project-robots-follow",
  og_image: "project-og-image",
  og_image_alt: "project-og-image-alt",
  publication_status: "project-publication-status",
  featured: "project-featured",
};

export const PROJECT_ENTRY_FIELD_TABS: Record<string, string> = {
  code: PROJECT_ENTRY_TAB_IDS.basic,
  arabic_name: PROJECT_ENTRY_TAB_IDS.basic,
  english_name: PROJECT_ENTRY_TAB_IDS.basic,
  slug: PROJECT_ENTRY_TAB_IDS.basic,
  show_on_homepage: PROJECT_ENTRY_TAB_IDS.basic,
  homepage_order: PROJECT_ENTRY_TAB_IDS.basic,
  brochure_url: PROJECT_ENTRY_TAB_IDS.basic,
  type: PROJECT_ENTRY_TAB_IDS.basic,
  general_description: PROJECT_ENTRY_TAB_IDS.basic,
  short_description: PROJECT_ENTRY_TAB_IDS.basic,
  image: PROJECT_ENTRY_TAB_IDS.basic,
  image_alt: PROJECT_ENTRY_TAB_IDS.basic,
  hero_image: PROJECT_ENTRY_TAB_IDS.basic,
  hero_image_alt: PROJECT_ENTRY_TAB_IDS.basic,
  small_box_image: PROJECT_ENTRY_TAB_IDS.basic,
  small_box_image_alt: PROJECT_ENTRY_TAB_IDS.basic,
  governorate_id: PROJECT_ENTRY_TAB_IDS.location,
  city_id: PROJECT_ENTRY_TAB_IDS.location,
  main_area_id: PROJECT_ENTRY_TAB_IDS.location,
  sub_area_id: PROJECT_ENTRY_TAB_IDS.location,
  location_label: PROJECT_ENTRY_TAB_IDS.location,
  location_description: PROJECT_ENTRY_TAB_IDS.location,
  google_maps_url: PROJECT_ENTRY_TAB_IDS.location,
  latitude: PROJECT_ENTRY_TAB_IDS.location,
  longitude: PROJECT_ENTRY_TAB_IDS.location,
  map_zoom: PROJECT_ENTRY_TAB_IDS.location,
  location_point_label: PROJECT_ENTRY_TAB_IDS.location,
  location_title: PROJECT_ENTRY_TAB_IDS.location,
  overview_title: PROJECT_ENTRY_TAB_IDS.overview,
  overview_body: PROJECT_ENTRY_TAB_IDS.overview,
  overview_media_type: PROJECT_ENTRY_TAB_IDS.overview,
  feature_body: PROJECT_ENTRY_TAB_IDS.overview,
  overview_main_image: PROJECT_ENTRY_TAB_IDS.overview,
  overview_main_image_alt: PROJECT_ENTRY_TAB_IDS.overview,
  overview_media_image: PROJECT_ENTRY_TAB_IDS.overview,
  overview_media_alt_text: PROJECT_ENTRY_TAB_IDS.overview,
  overview_video_url: PROJECT_ENTRY_TAB_IDS.overview,
  overview_video_poster_alt: PROJECT_ENTRY_TAB_IDS.overview,
  floor_plan_name: PROJECT_ENTRY_TAB_IDS.plans,
  plans_title: PROJECT_ENTRY_TAB_IDS.plans,
  floor_plan_detail_label: PROJECT_ENTRY_TAB_IDS.plans,
  floor_plan_detail_value: PROJECT_ENTRY_TAB_IDS.plans,
  floor_plan_architectural_image_alt: PROJECT_ENTRY_TAB_IDS.plans,
  floor_plan_furnishing_image_alt: PROJECT_ENTRY_TAB_IDS.plans,
  delivery_title: PROJECT_ENTRY_TAB_IDS.delivery,
  delivery_body: PROJECT_ENTRY_TAB_IDS.delivery,
  delivery_item_body: PROJECT_ENTRY_TAB_IDS.delivery,
  delivery_media_image: PROJECT_ENTRY_TAB_IDS.delivery,
  delivery_media_alt_text: PROJECT_ENTRY_TAB_IDS.delivery,
  gallery_media_image: PROJECT_ENTRY_TAB_IDS.media,
  gallery_media_alt_text: PROJECT_ENTRY_TAB_IDS.media,
  gallery_video_url: PROJECT_ENTRY_TAB_IDS.media,
  gallery_video_poster_alt: PROJECT_ENTRY_TAB_IDS.media,
  gallery_title: PROJECT_ENTRY_TAB_IDS.media,
  seo_title: PROJECT_ENTRY_TAB_IDS.seo,
  seo_description: PROJECT_ENTRY_TAB_IDS.seo,
  focus_keyword: PROJECT_ENTRY_TAB_IDS.seo,
  seo_keywords: PROJECT_ENTRY_TAB_IDS.seo,
  canonical_url: PROJECT_ENTRY_TAB_IDS.seo,
  robots_index: PROJECT_ENTRY_TAB_IDS.seo,
  robots_follow: PROJECT_ENTRY_TAB_IDS.seo,
  og_image: PROJECT_ENTRY_TAB_IDS.seo,
  og_image_alt: PROJECT_ENTRY_TAB_IDS.seo,
  publication_status: PROJECT_ENTRY_TAB_IDS.review,
  featured: PROJECT_ENTRY_TAB_IDS.review,
};

export function createEmptyProjectEntry(
  type: ProjectType = "residential",
): ProjectEntryBundle {
  return {
    project: {
      id: null,
      type,
      code: "",
      arabic_name: "",
      english_name: "",
      slug: "",
      general_description: "",
      short_description: "",
      image: "",
      image_alt: "",
      hero_image: "",
      hero_image_alt: "",
      small_box_image: "",
      small_box_image_alt: "",
      governorate_id: null,
      city_id: null,
      main_area_id: null,
      sub_area_id: null,
      location_label: "",
      show_location_label:
        DEFAULT_PROJECT_LOCATION_PRESENTATION.showDetailedAddress,
      show_location_tags:
        DEFAULT_PROJECT_LOCATION_PRESENTATION.showLocationTags,
      location_description: "",
      google_maps_url: "",
      latitude: "",
      longitude: "",
      map_zoom: "16",
      location_title: "",
      overview_title: "",
      overview_body: "",
      overview_media_type: "image",
      overview_main_image: "",
      overview_main_image_alt: "",
      delivery_title: "",
      delivery_body: "",
      plans_title: "",
      gallery_title: "",
      seo_title: "",
      seo_description: "",
      focus_keyword: "",
      seo_keywords: [],
      canonical_url: "",
      robots_index: null,
      robots_follow: null,
      og_image: "",
      og_image_alt: "",
      publication_status: "unpublished",
      published_at: null,
      published_by: null,
      featured: false,
      show_on_homepage: false,
      homepage_order: 0,
      brochure_url: "",
      created_at: null,
      updated_at: null,
    },
    location_points: [],
    features: [],
    floor_plans: [],
    delivery_items: [],
    media: [],
    videos: [],
    deleted: {
      location_point_ids: [],
      feature_ids: [],
      floor_plan_ids: [],
      floor_plan_detail_ids: [],
      delivery_item_ids: [],
      media_ids: [],
      video_ids: [],
    },
    locations: [],
    schemaReady: true,
    schemaMessage: null,
  };
}

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readAll(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value).trim());
}

function readLastString(formData: FormData, name: string) {
  return readAll(formData, name).at(-1) ?? "";
}

function readOptionalId(value: string): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function readBoolean(value: string) {
  return value === "true" || value === "on" || value === "1";
}

function entryCount(...lists: string[][]) {
  return lists.reduce((count, list) => Math.max(count, list.length), 0);
}

function readDeletedIds(formData: FormData, name: string) {
  return readAll(formData, name).map((value) => Number(value));
}

export function projectEntryPayloadFromFormData(
  formData: FormData,
): ProjectEntryPayload {
  const typeValue = readString(formData, "type");
  const type = typeValue as ProjectType;

  const locationPointIds = readAll(formData, "location_point_id");
  const locationPointKeys = readAll(formData, "location_point_client_key");
  const locationPointKinds = readAll(formData, "location_point_kind");
  const locationPointLabels = readAll(formData, "location_point_label");
  const locationPointDistances = readAll(formData, "location_point_distance_text");
  const locationPoints = Array.from(
    { length: entryCount(locationPointKeys, locationPointLabels) },
    (_, index): ProjectLocationPointEntry => ({
      id: readOptionalId(locationPointIds[index] ?? ""),
      client_key: locationPointKeys[index] ?? "",
      kind: ["road", "landmark"].includes(locationPointKinds[index] ?? "")
        ? (locationPointKinds[index] as ProjectLocationPointKind)
        : "transport",
      label: locationPointLabels[index] ?? "",
      distance_text: locationPointDistances[index] ?? "",
    }),
  );

  const featureIds = readAll(formData, "feature_id");
  const featureKeys = readAll(formData, "feature_client_key");
  const featureBodies = readAll(formData, "feature_body");
  const features = Array.from(
    { length: entryCount(featureKeys, featureBodies) },
    (_, index): ProjectFeatureEntry => ({
      id: readOptionalId(featureIds[index] ?? ""),
      client_key: featureKeys[index] ?? "",
      body: featureBodies[index] ?? "",
    }),
  );

  const detailIds = readAll(formData, "floor_plan_detail_id");
  const detailKeys = readAll(formData, "floor_plan_detail_client_key");
  const detailPlanKeys = readAll(formData, "floor_plan_detail_plan_key");
  const detailLabels = readAll(formData, "floor_plan_detail_label");
  const detailValues = readAll(formData, "floor_plan_detail_value");
  const details = Array.from(
    { length: entryCount(detailKeys, detailLabels, detailValues) },
    (_, index) => ({
      planKey: detailPlanKeys[index] ?? "",
      detail: {
        id: readOptionalId(detailIds[index] ?? ""),
        client_key: detailKeys[index] ?? "",
        label: detailLabels[index] ?? "",
        value: detailValues[index] ?? "",
      } satisfies ProjectFloorPlanDetailEntry,
    }),
  );

  const planIds = readAll(formData, "floor_plan_id");
  const planKeys = readAll(formData, "floor_plan_client_key");
  const planNames = readAll(formData, "floor_plan_name");
  const planAreas = readAll(formData, "floor_plan_area_text");
  const planFeatured = readAll(formData, "floor_plan_featured");
  const planArchitecturalImages = readAll(formData, "floor_plan_architectural_image");
  const planArchitecturalAlts = readAll(formData, "floor_plan_architectural_image_alt");
  const planFurnishingImages = readAll(formData, "floor_plan_furnishing_image");
  const planFurnishingAlts = readAll(formData, "floor_plan_furnishing_image_alt");
  const floorPlans = Array.from(
    { length: entryCount(planKeys, planNames) },
    (_, index): ProjectFloorPlanEntry => {
      const clientKey = planKeys[index] ?? "";
      return {
        id: readOptionalId(planIds[index] ?? ""),
        client_key: clientKey,
        name: planNames[index] ?? "",
        area_text: planAreas[index] ?? "",
        featured: readBoolean(planFeatured[index] ?? ""),
        architectural_image: planArchitecturalImages[index] ?? "",
        architectural_image_alt: planArchitecturalAlts[index] ?? "",
        furnishing_image: planFurnishingImages[index] ?? "",
        furnishing_image_alt: planFurnishingAlts[index] ?? "",
        details: details
          .filter((item) => item.planKey === clientKey)
          .map((item) => item.detail),
      };
    },
  );

  const deliveryIds = readAll(formData, "delivery_item_id");
  const deliveryKeys = readAll(formData, "delivery_item_client_key");
  const deliveryBodies = readAll(formData, "delivery_item_body");
  const deliveryItems = Array.from(
    { length: entryCount(deliveryKeys, deliveryBodies) },
    (_, index): ProjectDeliveryItemEntry => ({
      id: readOptionalId(deliveryIds[index] ?? ""),
      client_key: deliveryKeys[index] ?? "",
      body: deliveryBodies[index] ?? "",
    }),
  );

  const mediaIds = readAll(formData, "media_id");
  const mediaKeys = readAll(formData, "media_client_key");
  const mediaSections = readAll(formData, "media_section");
  const mediaImages = readAll(formData, "media_image");
  const mediaAlts = readAll(formData, "media_alt_text");
  const media = Array.from(
    { length: entryCount(mediaKeys, mediaImages) },
    (_, index): ProjectMediaEntry => ({
      id: readOptionalId(mediaIds[index] ?? ""),
      client_key: mediaKeys[index] ?? "",
      section: ["delivery", "gallery"].includes(mediaSections[index] ?? "")
        ? (mediaSections[index] as ProjectMediaSection)
        : "overview",
      image: mediaImages[index] ?? "",
      alt_text: mediaAlts[index] ?? "",
    }),
  );

  const videoIds = readAll(formData, "video_id");
  const videoKeys = readAll(formData, "video_client_key");
  const videoSections = readAll(formData, "video_section");
  const videoUrls = readAll(formData, "video_url");
  const videoPosters = readAll(formData, "video_poster_image");
  const videoPosterAlts = readAll(formData, "video_poster_alt");
  const videos = Array.from(
    { length: entryCount(videoKeys, videoUrls) },
    (_, index): ProjectVideoEntry => ({
      id: readOptionalId(videoIds[index] ?? ""),
      client_key: videoKeys[index] ?? "",
      section: videoSections[index] === "gallery" ? "gallery" : "overview",
      video_url: videoUrls[index] ?? "",
      poster_image: videoPosters[index] ?? "",
      poster_alt: videoPosterAlts[index] ?? "",
    }),
  );
  const publicationStatus = (readLastString(
    formData,
    "publication_status",
  ) || "unpublished") as ProjectPublicationStatus;
  const seo = readEntitySeoFormData(formData);

  return {
    project: {
      id: readOptionalId(readString(formData, "id")),
      type,
      code: readString(formData, "code").toUpperCase(),
      arabic_name: readString(formData, "arabic_name"),
      english_name: readString(formData, "english_name"),
      slug: readString(formData, "slug"),
      general_description: readString(formData, "general_description"),
      short_description: readString(formData, "short_description"),
      image: readString(formData, "image"),
      image_alt: readString(formData, "image_alt"),
      hero_image: readString(formData, "hero_image"),
      hero_image_alt: readString(formData, "hero_image_alt"),
      small_box_image: readString(formData, "small_box_image"),
      small_box_image_alt: readString(formData, "small_box_image_alt"),
      governorate_id: readOptionalId(readString(formData, "governorate_id")),
      city_id: readOptionalId(readString(formData, "city_id")),
      main_area_id: readOptionalId(readString(formData, "main_area_id")),
      sub_area_id: readOptionalId(readString(formData, "sub_area_id")),
      location_label: readString(formData, "location_label"),
      show_location_label: readBoolean(
        readLastString(formData, "show_location_label"),
      ),
      show_location_tags: readBoolean(
        readLastString(formData, "show_location_tags"),
      ),
      location_description: readString(formData, "location_description"),
      google_maps_url: readString(formData, "google_maps_url"),
      latitude: readString(formData, "latitude"),
      longitude: readString(formData, "longitude"),
      map_zoom: readString(formData, "map_zoom"),
      location_title: readString(formData, "location_title"),
      overview_title: readString(formData, "overview_title"),
      overview_body: readString(formData, "overview_body"),
      overview_media_type:
        readString(formData, "overview_media_type") === "video" ? "video" : "image",
      overview_main_image: readString(formData, "overview_main_image"),
      overview_main_image_alt: readString(formData, "overview_main_image_alt"),
      delivery_title: readString(formData, "delivery_title"),
      delivery_body: readString(formData, "delivery_body"),
      plans_title: readString(formData, "plans_title"),
      gallery_title: readString(formData, "gallery_title"),
      seo_title: seo.seoTitle,
      seo_description: seo.seoDescription,
      focus_keyword: seo.focusKeyword,
      seo_keywords: seo.seoKeywords,
      canonical_url: seo.canonicalUrl,
      robots_index: seo.robotsIndex,
      robots_follow: seo.robotsFollow,
      og_image: seo.ogImage,
      og_image_alt: seo.ogImageAlt,
      publication_status: publicationStatus,
      published_at: null,
      published_by: null,
      featured: readBoolean(readLastString(formData, "featured")),
      show_on_homepage: readBoolean(readLastString(formData, "show_on_homepage")),
      homepage_order: Math.max(0, Number(readString(formData, "homepage_order")) || 0),
      brochure_url: readString(formData, "brochure_url"),
      created_at: null,
      updated_at: null,
    },
    location_points: locationPoints,
    features,
    floor_plans: floorPlans,
    delivery_items: deliveryItems,
    media,
    videos,
    deleted: {
      location_point_ids: readDeletedIds(formData, "deleted_location_point_id"),
      feature_ids: readDeletedIds(formData, "deleted_feature_id"),
      floor_plan_ids: readDeletedIds(formData, "deleted_floor_plan_id"),
      floor_plan_detail_ids: readDeletedIds(formData, "deleted_floor_plan_detail_id"),
      delivery_item_ids: readDeletedIds(formData, "deleted_delivery_item_id"),
      media_ids: readDeletedIds(formData, "deleted_media_id"),
      video_ids: readDeletedIds(formData, "deleted_video_id"),
    },
  };
}

function addError(
  errors: ProjectEntryFieldErrors,
  field: ProjectEntryValidationField,
  message: string,
) {
  errors[field] = [...(errors[field] ?? []), message];
}

function isValidHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateClientKeys(
  errors: ProjectEntryFieldErrors,
  field: ProjectEntryValidationField,
  keys: string[],
) {
  if (keys.some((key) => !UUID_PATTERN.test(key))) {
    addError(errors, field, "تعذر التحقق من هوية أحد العناصر. أعد فتح النموذج وحاول مرة أخرى.");
  }
  if (new Set(keys).size !== keys.length) {
    addError(errors, field, "توجد هوية مكررة داخل العناصر المرتبة.");
  }
}

function collectProjectEntryFieldErrors(
  payload: ProjectEntryPayload,
): ProjectEntryFieldErrors {
  const errors: ProjectEntryFieldErrors = {};
  const project = payload.project;

  if (project.type !== "residential" && project.type !== "commercial") {
    addError(errors, "type", "اختر نوع المشروع: سكني أو تجاري.");
  }
  if (!isProjectPublicationStatus(project.publication_status)) {
    addError(errors, "publication_status", "حالة ظهور المشروع غير صالحة.");
  }

  if (!project.arabic_name) addError(errors, "arabic_name", "اسم المشروع بالعربية مطلوب.");
  if (!project.english_name) addError(errors, "english_name", "اسم المشروع بالإنجليزية مطلوب.");
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(project.code)) {
    addError(errors, "code", "كود المشروع مطلوب ويقبل الحروف الإنجليزية الكبيرة والأرقام والشرطة فقط.");
  }
  const slugError = validateSlugFormat(project.slug);
  if (slugError) addError(errors, "slug", slugError);
  if (project.show_on_homepage && project.homepage_order <= 0) {
    addError(errors, "homepage_order", "ترتيب الصفحة الرئيسية يجب أن يكون أكبر من صفر عند إظهار المشروع.");
  }
  if (!isValidHttpUrl(project.brochure_url)) {
    addError(errors, "brochure_url", "رابط كتيّب المشروع يجب أن يبدأ بـ http أو https.");
  }
  if (project.general_description.length > 1000) {
    addError(errors, "general_description", "الوصف العام لا يتجاوز 1000 حرف.");
  }
  if (project.short_description.length > 500) {
    addError(errors, "short_description", "وصف الهيرو لا يتجاوز 500 حرف.");
  }
  if (!project.general_description) {
    addError(errors, "general_description", "الوصف العام للمشروع مطلوب.");
  }
  if (!project.short_description) {
    addError(errors, "short_description", "وصف الهيرو والبوكس الصغير مطلوب.");
  }

  for (const [imageField, altField, label] of [
    ["image", "image_alt", "صورة الكارت الخارجي"],
    ["hero_image", "hero_image_alt", "صورة الهيرو"],
    ["small_box_image", "small_box_image_alt", "صورة البوكس الصغير"],
    ["overview_main_image", "overview_main_image_alt", "صورة النظرة العامة"],
  ] as const) {
    if (
      (imageField === "image" ||
        imageField === "hero_image" ||
        imageField === "small_box_image") &&
      !project[imageField]
    ) {
      addError(errors, imageField, `${label} مطلوبة.`);
    }
    if (project[imageField] && !project[altField]) {
      addError(errors, altField, `النص البديل لـ${label} مطلوب عند اختيار الصورة.`);
    }
  }

  const locationSelection = [
    project.governorate_id,
    project.city_id,
    project.main_area_id,
  ];
  if (
    locationSelection.some((value) => !value) ||
    (project.sub_area_id !== null && project.main_area_id === null)
  ) {
    addError(errors, "governorate_id", "اختر المحافظة والمدينة والمنطقة الرئيسية كسلسلة مترابطة.");
  }
  if (!project.location_label) {
    addError(errors, "location_label", "العنوان التفصيلي للمشروع مطلوب.");
  }
  if (!project.google_maps_url) {
    addError(errors, "google_maps_url", "رابط خرائط جوجل مطلوب.");
  } else if (!isValidHttpUrl(project.google_maps_url)) {
    addError(errors, "google_maps_url", "أدخل رابط خرائط جوجل يبدأ بـ http أو https.");
  }
  const latitude = project.latitude ? Number(project.latitude) : null;
  const longitude = project.longitude ? Number(project.longitude) : null;
  const zoom = project.map_zoom ? Number(project.map_zoom) : null;
  if (latitude === null) {
    addError(errors, "latitude", "خط العرض مطلوب.");
  } else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    addError(errors, "latitude", "خط العرض يجب أن يكون بين -90 و90.");
  }
  if (longitude === null) {
    addError(errors, "longitude", "خط الطول مطلوب.");
  } else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    addError(errors, "longitude", "خط الطول يجب أن يكون بين -180 و180.");
  }
  if (zoom === null) {
    addError(errors, "map_zoom", "مستوى التقريب مطلوب.");
  } else if (!Number.isInteger(zoom) || zoom < 1 || zoom > 22) {
    addError(errors, "map_zoom", "مستوى التقريب يجب أن يكون رقمًا صحيحًا بين 1 و22.");
  }

  validateClientKeys(errors, "location_point_label", payload.location_points.map((item) => item.client_key));
  if (payload.location_points.some((item) => !item.label)) {
    addError(errors, "location_point_label", "اسم كل وسيلة أو محور أو معلم مطلوب.");
  }
  validateClientKeys(errors, "feature_body", payload.features.map((item) => item.client_key));
  if (payload.features.some((item) => !item.body)) {
    addError(errors, "feature_body", "لا تترك ميزة فارغة.");
  }

  if (!stripHtml(project.overview_body)) {
    addError(errors, "overview_body", "النص التعريفي للنظرة العامة مطلوب.");
  }
  if (
    project.overview_media_type === "image" &&
    !project.overview_main_image
  ) {
    addError(errors, "overview_main_image", "اختر الصورة الرئيسية للنظرة العامة.");
  }
  if (
    project.overview_media_type === "video" &&
    payload.videos.filter((item) => item.section === "overview").length !== 1
  ) {
    addError(errors, "overview_video_url", "أضف فيديو رئيسيًا واحدًا للنظرة العامة.");
  }

  validateClientKeys(errors, "floor_plan_name", payload.floor_plans.map((item) => item.client_key));
  for (const plan of payload.floor_plans) {
    if (!plan.name) addError(errors, "floor_plan_name", "اسم كل مخطط مطلوب.");
    if (plan.architectural_image && !plan.architectural_image_alt) {
      addError(errors, "floor_plan_architectural_image_alt", "النص البديل للمخطط المعماري مطلوب.");
    }
    if (plan.furnishing_image && !plan.furnishing_image_alt) {
      addError(errors, "floor_plan_furnishing_image_alt", "النص البديل لمخطط الفرش مطلوب.");
    }
    validateClientKeys(errors, "floor_plan_detail_label", plan.details.map((item) => item.client_key));
    if (plan.details.some((item) => !item.label || !item.value)) {
      addError(errors, "floor_plan_detail_label", "أكمل اسم وقيمة كل تفصيلة في المخطط.");
    }
  }

  validateClientKeys(errors, "delivery_item_body", payload.delivery_items.map((item) => item.client_key));
  if (payload.delivery_items.some((item) => !item.body)) {
    addError(errors, "delivery_item_body", "لا تترك بند تسليم فارغًا.");
  }
  if (!stripHtml(project.delivery_body)) {
    addError(errors, "delivery_body", "النص التعريفي للمواصفات والتسليم مطلوب.");
  }

  for (const section of ["overview", "delivery", "gallery"] as const) {
    const items = payload.media.filter((item) => item.section === section);
    const imageField = `${section}_media_image` as const;
    const altField = `${section}_media_alt_text` as const;
    validateClientKeys(errors, imageField, items.map((item) => item.client_key));
    if (items.some((item) => !item.image)) {
      addError(errors, imageField, "اختر صورة لكل عنصر وسائط أو احذف العنصر الفارغ.");
    }
    if (items.some((item) => item.image && !item.alt_text)) {
      addError(errors, altField, "النص البديل مطلوب لكل صورة.");
    }
  }
  for (const section of ["overview", "gallery"] as const) {
    const items = payload.videos.filter((item) => item.section === section);
    const urlField = `${section}_video_url` as const;
    const posterAltField = `${section}_video_poster_alt` as const;
    validateClientKeys(errors, urlField, items.map((item) => item.client_key));
    if (items.some((item) => !isValidHttpUrl(item.video_url) || !item.video_url)) {
      addError(errors, urlField, "أدخل رابط فيديو صالحًا يبدأ بـ http أو https.");
    }
    if (items.some((item) => item.poster_image && !item.poster_alt)) {
      addError(errors, posterAltField, "النص البديل لصورة غلاف الفيديو مطلوب.");
    }
  }
  for (const issue of validateEntitySeoValues({
    seoTitle: project.seo_title,
    seoDescription: project.seo_description,
    focusKeyword: project.focus_keyword,
    seoKeywords: project.seo_keywords,
    canonicalUrl: project.canonical_url,
    robotsIndex: project.robots_index,
    robotsFollow: project.robots_follow,
    ogImage: project.og_image,
    ogImageAlt: project.og_image_alt,
  })) {
    if (!isProjectEntryValidationField(issue.field)) {
      throw new Error(
        `Project validation assessment is missing the Entity SEO field: ${issue.field}`,
      );
    }
    addError(errors, issue.field, issue.message);
  }

  const deletionContracts = [
    [payload.deleted.location_point_ids, payload.location_points.map((item) => item.id)],
    [payload.deleted.feature_ids, payload.features.map((item) => item.id)],
    [payload.deleted.floor_plan_ids, payload.floor_plans.map((item) => item.id)],
    [
      payload.deleted.floor_plan_detail_ids,
      payload.floor_plans.flatMap((plan) => plan.details.map((item) => item.id)),
    ],
    [payload.deleted.delivery_item_ids, payload.delivery_items.map((item) => item.id)],
    [payload.deleted.media_ids, payload.media.map((item) => item.id)],
    [payload.deleted.video_ids, payload.videos.map((item) => item.id)],
  ] as const;
  for (const [ids, active] of deletionContracts) {
    const activeIds = new Set(active.filter((id): id is number => id !== null));
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      addError(errors, "id", "قائمة الحذف تحتوي معرّفًا غير صالح.");
    }
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => activeIds.has(id))
    ) {
      addError(errors, "id", "تعارض بين العناصر المحفوظة وقائمة الحذف الصريح.");
    }
  }

  return errors;
}

export function assessProjectEntryPayload(
  payload: ProjectEntryPayload,
): ProjectEntryValidationAssessment {
  const fieldErrors = collectProjectEntryFieldErrors(payload);
  return {
    fieldErrors,
    checks: PROJECT_ENTRY_VALIDATION_FIELDS.map((field) => {
      const messages = fieldErrors[field] ?? [];
      return {
        id: `project-entry:${field}`,
        field,
        valid: messages.length === 0,
        messages,
      };
    }),
  };
}

export function projectEntryFirstErrorTarget(errors: ProjectEntryFieldErrors) {
  const field = Object.keys(errors)[0];
  if (!field) return null;
  return {
    focusTarget: PROJECT_ENTRY_FOCUS_TARGETS[field] ?? field,
    tabTarget: PROJECT_ENTRY_FIELD_TABS[field] ?? PROJECT_ENTRY_TAB_IDS.basic,
  };
}
