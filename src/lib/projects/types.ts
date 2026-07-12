import type { Project, ProjectCategory } from "./public-types";
import { PROJECT_CATEGORY_LABELS } from "./public-helpers";
import type { FloorPlanSpec } from "./floor-plan-specs";

export type ProjectStatus =
  | "under-construction"
  | "excavation"
  | "near-delivery"
  | "delivered";

export type ProjectPublicationStatus = "draft" | "published" | "unpublished" | "archived";

export type ProjectMediaCollection = "overview" | "delivery_specs" | "gallery";

export type ProjectRow = {
  id: number;
  slug: string;
  code: string;
  type: ProjectCategory;
  arabic_name: string;
  english_name: string;
  category_label: string;
  status: ProjectStatus;
  status_label: string;
  image: string;
  hero_image: string;
  location_label: string;
  map_area: string;
  short_description: string;
  description: string[];
  core_specs: {
    deliveryYear: number;
    floorsCount: number;
    unitsCount: number;
    areas: number[];
  } | null;
  delivery_label: string;
  area_label: string;
  progress: number;
  units_label: string;
  featured: boolean;
  show_on_homepage: boolean;
  homepage_order: number;
  floors_label: string | null;
  brochure_url: string | null;
  publication_status: ProjectPublicationStatus;
  overview_title: string | null;
  overview_body: string | null;
  overview_bullets: string[];
  overview_video_image: string | null;
  district_title: string | null;
  district_subtitle: string | null;
  district_body: string | null;
  district_bullets: string[];
  district_image: string | null;
  delivery_specs_title: string | null;
  delivery_specs_subtitle: string | null;
  contact_cta: Record<string, string> | null;
  quick_facts: { label: string; value: string }[];
  location_data: Record<string, string> | null;
  cta: Record<string, string> | null;
  detail_tabs: { id: string; label: string }[];
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[];
  focus_keyword: string | null;
  og_image: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectFloorPlanRow = {
  id: number;
  project_id: number;
  area: string;
  label: string | null;
  plan_image: string;
  specs: FloorPlanSpec[];
  featured: boolean;
  sort_order: number;
};

export type ProjectDeliverySpecItemRow = {
  id: number;
  project_id: number;
  body: string;
  sort_order: number;
};

export type ProjectMediaRow = {
  id: number;
  project_id: number;
  collection: ProjectMediaCollection;
  image: string;
  label: string;
  sort_order: number;
};

export type ProjectListRow = {
  id: number;
  code: string;
  slug: string;
  arabic_name: string;
  location_label: string;
  map_area: string;
  featured: boolean;
  publication_status: ProjectPublicationStatus;
  updated_at: string;
};

/** Card payload for HomeProjectsSection — sourced from projects table only. */
export type HomepageProjectCard = {
  id: number;
  slug: string;
  code: string;
  englishName: string;
  locationLabel: string;
  shortDescription: string;
  image: string;
};

export type ProjectEditBundle = {
  project: ProjectRow;
  floorPlans: ProjectFloorPlanRow[];
  deliverySpecItems: ProjectDeliverySpecItemRow[];
  media: ProjectMediaRow[];
};

export type SeedResult = {
  upserted: number;
  floorPlans: number;
  deliveryItems: number;
  media: number;
  errors: string[];
};

export function mapStaticProjectToDbRow(project: Project) {
  const details = project.residentialDetails;
  const now = new Date().toISOString();

  return {
    slug: project.slug,
    code: project.code,
    type: project.category,
    arabic_name: project.arabicName,
    english_name: project.englishName,
    category_label: PROJECT_CATEGORY_LABELS[project.category],
    status: "under-construction",
    status_label: "تحت الإنشاء",
    image: project.image,
    hero_image: project.heroImage,
    location_label: project.locationLabel,
    map_area: project.mapArea,
    short_description: project.shortDescription,
    description: [],
    core_specs: null,
    delivery_label: "",
    area_label: "",
    progress: 0,
    units_label: "",
    featured: project.featured,
    show_on_homepage: project.showOnHomepage,
    homepage_order: project.homepageOrder,
    floors_label: null,
    brochure_url: project.brochureUrl ?? null,
    publication_status: "published" as ProjectPublicationStatus,
    overview_title: details?.overview.title ?? null,
    overview_body: details?.overview.body ?? null,
    overview_bullets: details?.overview.bullets ?? [],
    overview_video_image: details?.overview.videoImage ?? null,
    district_title: details?.districtProfile.title ?? null,
    district_subtitle: details?.districtProfile.subtitle ?? null,
    district_body: details?.districtProfile.body ?? null,
    district_bullets: details?.districtProfile.bullets ?? [],
    district_image: details?.districtProfile.image ?? null,
    delivery_specs_title: details?.deliverySpecs.title ?? null,
    delivery_specs_subtitle: details?.deliverySpecs.subtitle ?? null,
    contact_cta: details?.contactCta ?? null,
    quick_facts: details?.quickFacts ?? [],
    location_data: details?.location ?? null,
    cta: details?.cta ?? null,
    detail_tabs: details?.tabs ?? [],
    seo_title: project.arabicName,
    seo_description: project.shortDescription,
    seo_keywords: [project.code, project.arabicName, project.locationLabel].filter(Boolean),
    focus_keyword: project.code,
    og_image: project.heroImage || project.image,
    updated_at: now,
  };
}

export function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function parseProjectRow(raw: Record<string, unknown>): ProjectRow {
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ""),
    code: String(raw.code ?? ""),
    type: raw.type as ProjectCategory,
    arabic_name: String(raw.arabic_name ?? ""),
    english_name: String(raw.english_name ?? ""),
    category_label: String(raw.category_label ?? ""),
    status: raw.status as ProjectStatus,
    status_label: String(raw.status_label ?? ""),
    image: String(raw.image ?? ""),
    hero_image: String(raw.hero_image ?? ""),
    location_label: String(raw.location_label ?? ""),
    map_area: String(raw.map_area ?? ""),
    short_description: String(raw.short_description ?? ""),
    description: parseJsonArray<string>(raw.description),
    core_specs: (raw.core_specs as ProjectRow["core_specs"]) ?? null,
    delivery_label: String(raw.delivery_label ?? ""),
    area_label: String(raw.area_label ?? ""),
    progress: Number(raw.progress ?? 0),
    units_label: String(raw.units_label ?? ""),
    featured: Boolean(raw.featured),
    show_on_homepage: Boolean(raw.show_on_homepage),
    homepage_order: Number(raw.homepage_order ?? 0),
    floors_label: raw.floors_label ? String(raw.floors_label) : null,
    brochure_url: raw.brochure_url ? String(raw.brochure_url) : null,
    publication_status: (raw.publication_status as ProjectPublicationStatus) ?? "draft",
    overview_title: raw.overview_title ? String(raw.overview_title) : null,
    overview_body: raw.overview_body ? String(raw.overview_body) : null,
    overview_bullets: parseJsonArray<string>(raw.overview_bullets),
    overview_video_image: raw.overview_video_image ? String(raw.overview_video_image) : null,
    district_title: raw.district_title ? String(raw.district_title) : null,
    district_subtitle: raw.district_subtitle ? String(raw.district_subtitle) : null,
    district_body: raw.district_body ? String(raw.district_body) : null,
    district_bullets: parseJsonArray<string>(raw.district_bullets),
    district_image: raw.district_image ? String(raw.district_image) : null,
    delivery_specs_title: raw.delivery_specs_title ? String(raw.delivery_specs_title) : null,
    delivery_specs_subtitle: raw.delivery_specs_subtitle ? String(raw.delivery_specs_subtitle) : null,
    contact_cta: (raw.contact_cta as Record<string, string>) ?? null,
    quick_facts: parseJsonArray<{ label: string; value: string }>(raw.quick_facts),
    location_data: (raw.location_data as Record<string, string>) ?? null,
    cta: (raw.cta as Record<string, string>) ?? null,
    detail_tabs: parseJsonArray<{ id: string; label: string }>(raw.detail_tabs),
    seo_title: raw.seo_title ? String(raw.seo_title) : null,
    seo_description: raw.seo_description ? String(raw.seo_description) : null,
    seo_keywords: Array.isArray(raw.seo_keywords) ? raw.seo_keywords.map(String) : [],
    focus_keyword: raw.focus_keyword ? String(raw.focus_keyword) : null,
    og_image: raw.og_image ? String(raw.og_image) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}
