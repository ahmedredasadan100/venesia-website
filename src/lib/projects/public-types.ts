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
  featured: boolean;
  code: string;
  showOnHomepage: boolean;
  homepageOrder: number;
  brochureUrl: string | null;
  generalDescription: string;
  shortDescription: string;
  cardImage: PublicProjectImage;
  heroImage: PublicProjectImage;
  heroBoxImage: PublicProjectImage;
  location: {
    title: string | null;
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
    title: string | null;
    body: string;
    mediaType: "image" | "video";
    mainImage: PublicProjectImage | null;
    features: Array<{ id: string; body: string }>;
    images: Array<PublicProjectImage & { id: string }>;
    videos: PublicProjectVideo[];
  };
  plansTitle: string | null;
  plans: PublicProjectPlan[];
  delivery: {
    title: string | null;
    body: string;
    items: Array<{ id: string; body: string }>;
    images: Array<PublicProjectImage & { id: string }>;
  };
  gallery: {
    title: string | null;
    images: Array<PublicProjectImage & { id: string }>;
    videos: PublicProjectVideo[];
  };
  seo: PublicProjectSeo;
  createdAt: string;
  updatedAt: string;
};

export type HomepageProjectCard = Pick<
  PublicProject,
  "slug" | "code" | "englishName" | "shortDescription" | "cardImage"
> & {
  id: number;
  location: Pick<PublicProject["location"], "label">;
};
