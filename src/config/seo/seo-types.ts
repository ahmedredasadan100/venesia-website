import type { Metadata } from "next";

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
    maxImagePreview?: "none" | "standard" | "large";
    maxSnippet?: number;
    maxVideoPreview?: number;
  };
};

export type SeoOpenGraphType = "website" | "article";

export type SeoRouteConfig = {
  path: string;
  title: string;
  description: string;
  kind: SeoRouteKind;
  alternates?: {
    canonical?: string;
  };
  openGraph?: {
    type?: SeoOpenGraphType;
    image?: string;
  };
  robots?: SeoRobotsDirective;
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

export type BuildMetadataInput = {
  path: string;
  title?: string;
  description?: string;
  image?: string;
  type?: SeoOpenGraphType;
  robots?: SeoRobotsDirective;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

export type BuiltMetadata = Metadata;