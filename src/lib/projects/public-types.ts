export type ProjectCategory = "residential" | "commercial";

export type ProjectHubFilterId = "all" | ProjectCategory;

export type PublicProjectImage = {
  src: string;
  alt: string;
};

export type PublicProjectVideo = {
  id: string;
  url: string;
  poster: PublicProjectImage | null;
};

export type PublicProjectLocationPoint = {
  id: string;
  kind: "transport" | "road" | "landmark";
  label: string;
  distanceText: string;
};

export type PublicProjectLocationLevel = {
  id: string;
  nameAr: string;
  nameEn: string;
};

export type PublicProjectPlan = {
  id: string;
  name: string;
  areaText: string;
  featured: boolean;
  architecturalImage: PublicProjectImage | null;
  furnishingImage: PublicProjectImage | null;
  details: Array<{ id: string; label: string; value: string }>;
};

export type PublicProjectSeo = {
  title: string | null;
  description: string | null;
  focusKeyword: string | null;
  keywords: string[];
  canonicalUrl: string | null;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
  ogImage: PublicProjectImage | null;
};

/** UI-facing project model mapped from the clean Project Admin aggregate. */
export type PublicProject = {
  id: string;
  slug: string;
  category: ProjectCategory;
  arabicName: string;
  englishName: string;
  /** @deprecated Track Your Project is outside this tranche; clean public UI uses englishName. */
  code: string;
  generalDescription: string;
  shortDescription: string;
  cardImage: PublicProjectImage;
  heroImage: PublicProjectImage;
  heroBoxImage: PublicProjectImage;
  location: {
    label: string;
    description: string;
    googleMapsUrl: string;
    latitude: number;
    longitude: number;
    zoom: number;
    governorate: PublicProjectLocationLevel | null;
    city: PublicProjectLocationLevel | null;
    mainArea: PublicProjectLocationLevel | null;
    subArea: PublicProjectLocationLevel | null;
    points: PublicProjectLocationPoint[];
  };
  overview: {
    title: string;
    body: string;
    mediaType: "image" | "video";
    mainImage: PublicProjectImage | null;
    features: Array<{ id: string; body: string }>;
    images: Array<PublicProjectImage & { id: string }>;
    videos: PublicProjectVideo[];
  };
  plans: PublicProjectPlan[];
  delivery: {
    title: string;
    body: string;
    items: Array<{ id: string; body: string }>;
    images: Array<PublicProjectImage & { id: string }>;
  };
  gallery: {
    images: Array<PublicProjectImage & { id: string }>;
    videos: PublicProjectVideo[];
  };
  seo: PublicProjectSeo;
  createdAt: string;
  updatedAt: string;
};

export type HomepageProjectCard = Pick<
  PublicProject,
  "slug" | "englishName" | "shortDescription" | "cardImage"
> & {
  id: number;
  locationLabel: string;
};

/** Legacy static-seed contract. It is not used by the clean public loader/mapper. */
export type ResidentialAreaOption = {
  area: string;
  label?: string;
  planImage: string;
  specs: string[];
  featured?: boolean;
};
export type ResidentialGalleryImage = { image: string; label: string };
export type ResidentialExecutionUpdate = {
  id: string; title: string; date: string; progress: number; image: string;
  description: string; gallery: string[]; videoUrl?: string;
};
export type ResidentialExecutionJourneyStage = {
  id: string; title: string; progress: number; status: string; image: string;
  summary: string; lastUpdated: string; updates: ResidentialExecutionUpdate[];
};
export type ResidentialDetails = {
  tabs: Array<{ id: string; label: string }>;
  overview: { title: string; body: string; bullets: string[]; videoImage: string; images: ResidentialGalleryImage[] };
  districtProfile: { title: string; subtitle: string; body: string; bullets: string[]; image: string };
  deliverySpecs: { title: string; subtitle: string; items: string[]; images: ResidentialGalleryImage[] };
  contactCta: { eyebrow: string; title: string; body: string; buttonLabel: string; href: string };
  quickFacts: Array<{ label: string; value: string }>;
  availableAreas: ResidentialAreaOption[];
  executionJourney: ResidentialExecutionJourneyStage[];
  location: { title: string; address: string; distance: string; mapImage: string; mapButtonLabel: string };
  cta: { title: string; body: string; buttonLabel: string };
};
export type Project = {
  id: string; slug: string; code: string; englishName: string; arabicName: string;
  category: ProjectCategory; image: string; heroImage: string; locationLabel: string;
  shortDescription: string; featured: boolean; mapArea: string; showOnHomepage: boolean;
  homepageOrder: number; brochureUrl?: string; residentialDetails?: ResidentialDetails;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string[]; ogImage?: string;
};
