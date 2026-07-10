import "server-only";

import { formatFloorPlanSpecDisplay } from "./floor-plan-specs";
import type { PublicProject, ResidentialDetails } from "./public-types";
import type {
  ProjectDeliverySpecItemRow,
  ProjectEditBundle,
  ProjectFloorPlanRow,
  ProjectMediaRow,
  ProjectRow,
} from "./types";

const DEFAULT_RESIDENTIAL_TABS: ResidentialDetails["tabs"] = [
  { id: "district", label: "عن الموقع" },
  { id: "overview", label: "نظرة عامة" },
  { id: "plans", label: "المساحات والمخططات" },
  { id: "delivery-specs", label: "مواصفات التنفيذ" },
  { id: "execution", label: "مراحل التنفيذ" },
  { id: "contact", label: "تواصل معنا" },
];

function readRecordField(record: Record<string, string> | null, key: string, fallback = "") {
  return record?.[key]?.trim() || fallback;
}

function mapMediaCollection(media: ProjectMediaRow[], collection: ProjectMediaRow["collection"]) {
  return media
    .filter((item) => item.collection === collection)
    .map((item) => ({
      image: item.image,
      label: item.label,
    }));
}

function mapResidentialDetails(
  project: ProjectRow,
  floorPlans: ProjectFloorPlanRow[],
  deliverySpecItems: ProjectDeliverySpecItemRow[],
  media: ProjectMediaRow[],
): ResidentialDetails | undefined {
  if (project.type !== "residential") return undefined;

  const overviewImages = mapMediaCollection(media, "overview");
  const deliveryImages = mapMediaCollection(media, "delivery_specs");

  return {
    tabs: project.detail_tabs.length ? project.detail_tabs : DEFAULT_RESIDENTIAL_TABS,
    overview: {
      title: project.overview_title ?? "",
      body: project.overview_body ?? "",
      bullets: project.overview_bullets,
      videoImage: project.overview_video_image ?? project.hero_image ?? project.image,
      images: overviewImages,
    },
    districtProfile: {
      title: project.district_title ?? "",
      subtitle: project.district_subtitle ?? "",
      body: project.district_body ?? "",
      bullets: project.district_bullets,
      image: project.district_image ?? project.image,
    },
    deliverySpecs: {
      title: project.delivery_specs_title ?? "",
      subtitle: project.delivery_specs_subtitle ?? "",
      items: deliverySpecItems.map((item) => item.body),
      images: deliveryImages,
    },
    contactCta: {
      eyebrow: readRecordField(project.contact_cta, "eyebrow"),
      title: readRecordField(project.contact_cta, "title"),
      body: readRecordField(project.contact_cta, "body"),
      buttonLabel: readRecordField(project.contact_cta, "buttonLabel"),
      href: readRecordField(project.contact_cta, "href", "/contact"),
    },
    quickFacts: project.quick_facts,
    availableAreas: floorPlans.map((plan) => ({
      area: plan.area,
      label: plan.label ?? undefined,
      planImage: plan.plan_image,
      specs: plan.specs.map(formatFloorPlanSpecDisplay),
      featured: plan.featured,
    })),
    executionJourney: [],
    location: {
      title: readRecordField(project.location_data, "title"),
      address: readRecordField(project.location_data, "address"),
      distance: readRecordField(project.location_data, "distance"),
      mapImage: readRecordField(project.location_data, "mapImage", project.image),
      mapButtonLabel: readRecordField(project.location_data, "mapButtonLabel", "عرض على الخريطة"),
    },
    cta: {
      title: readRecordField(project.cta, "title"),
      body: readRecordField(project.cta, "body"),
      buttonLabel: readRecordField(project.cta, "buttonLabel"),
    },
  };
}

export function mapProjectRowToPublicProject(
  project: ProjectRow,
  options?: {
    floorPlans?: ProjectFloorPlanRow[];
    deliverySpecItems?: ProjectDeliverySpecItemRow[];
    media?: ProjectMediaRow[];
    includeResidentialDetails?: boolean;
  },
): PublicProject {
  const floorPlans = options?.floorPlans ?? [];
  const deliverySpecItems = options?.deliverySpecItems ?? [];
  const media = options?.media ?? [];
  const includeResidentialDetails = options?.includeResidentialDetails ?? false;

  return {
    id: String(project.id),
    slug: project.slug,
    code: project.code,
    englishName: project.english_name,
    arabicName: project.arabic_name,
    category: project.type,
    image: project.image,
    heroImage: project.hero_image || project.image,
    locationLabel: project.location_label,
    shortDescription: project.short_description,
    featured: project.featured,
    mapArea: project.map_area,
    showOnHomepage: project.show_on_homepage,
    homepageOrder: project.homepage_order,
    brochureUrl: project.brochure_url ?? undefined,
    seoTitle: project.seo_title ?? undefined,
    seoDescription: project.seo_description ?? undefined,
    seoKeywords: project.seo_keywords?.length ? project.seo_keywords : undefined,
    ogImage: project.og_image ?? undefined,
    residentialDetails: includeResidentialDetails
      ? mapResidentialDetails(project, floorPlans, deliverySpecItems, media)
      : undefined,
  };
}

export function mapProjectBundleToPublicProject(bundle: ProjectEditBundle): PublicProject {
  return mapProjectRowToPublicProject(bundle.project, {
    floorPlans: bundle.floorPlans,
    deliverySpecItems: bundle.deliverySpecItems,
    media: bundle.media,
    includeResidentialDetails: true,
  });
}
