export type ProjectCategory = "residential" | "commercial";

export type ProjectHubFilterId = "all" | ProjectCategory;

export type ResidentialAreaOption = {
  area: string;
  label?: string;
  planImage: string;
  specs: string[];
  featured?: boolean;
};

export type ResidentialGalleryImage = {
  image: string;
  label: string;
};

export type ResidentialExecutionUpdate = {
  id: string;
  title: string;
  date: string;
  progress: number;
  image: string;
  description: string;
  gallery: string[];
  videoUrl?: string;
};

export type ResidentialExecutionJourneyStage = {
  id: string;
  title: string;
  progress: number;
  status: string;
  image: string;
  summary: string;
  lastUpdated: string;
  updates: ResidentialExecutionUpdate[];
};

export type ResidentialDetails = {
  tabs: {
    id: string;
    label: string;
  }[];
  overview: {
    title: string;
    body: string;
    bullets: string[];
    videoImage: string;
    images: ResidentialGalleryImage[];
  };
  districtProfile: {
    title: string;
    subtitle: string;
    body: string;
    bullets: string[];
    image: string;
  };
  deliverySpecs: {
    title: string;
    subtitle: string;
    items: string[];
    images: ResidentialGalleryImage[];
  };
  contactCta: {
    eyebrow: string;
    title: string;
    body: string;
    buttonLabel: string;
    href: string;
  };
  quickFacts: {
    label: string;
    value: string;
  }[];
  availableAreas: ResidentialAreaOption[];
  executionJourney: ResidentialExecutionJourneyStage[];
  location: {
    title: string;
    address: string;
    distance: string;
    mapImage: string;
    mapButtonLabel: string;
  };
  cta: {
    title: string;
    body: string;
    buttonLabel: string;
  };
};

/** Public-facing project payload — runtime source is Supabase `projects` table. */
export type PublicProject = {
  id: string;
  slug: string;
  code: string;
  englishName: string;
  arabicName: string;
  category: ProjectCategory;
  image: string;
  heroImage: string;
  locationLabel: string;
  shortDescription: string;
  featured: boolean;
  mapArea: string;
  showOnHomepage: boolean;
  homepageOrder: number;
  brochureUrl?: string;
  residentialDetails?: ResidentialDetails;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  ogImage?: string;
};

/** @deprecated Use PublicProject — kept for incremental UI migration. */
export type Project = PublicProject;
