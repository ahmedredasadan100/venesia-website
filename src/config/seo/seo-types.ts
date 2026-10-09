export type SeoRouteKind =
  | "home"
  | "static"
  | "listing"
  | "project-listing"
  | "media-listing"
  | "topic-listing";

export type SeoRobotsDirective = {
  index: boolean;
  follow: boolean;
  googleBot?: {
    index: boolean;
    follow: boolean;
    "max-image-preview"?: "none" | "standard" | "large";
    "max-snippet"?: number;
    "max-video-preview"?: number;
  };
};

export type SeoOpenGraphType = "website" | "article";

export type SeoRouteConfig = {
  path: string;
  kind: SeoRouteKind;
  priority?: number;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
};