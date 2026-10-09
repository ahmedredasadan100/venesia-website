import {
  getPublicPageRoute,
  type PublicStaticPageRouteKey,
} from "../../lib/admin/links/static-routes";
import type { SeoRouteConfig } from "./seo-types";

const pathFor = (key: PublicStaticPageRouteKey) => getPublicPageRoute(key).href;

/** Route classification/crawl scheduling only; pages owns editable SEO values. */
export const SEO_ROUTES: SeoRouteConfig[] = [
  {
    path: pathFor("home"),
    kind: "home",
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    path: pathFor("about"),
    kind: "static",
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: pathFor("contact"),
    kind: "static",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: pathFor("projects"),
    kind: "project-listing",
    priority: 0.95,
    changeFrequency: "weekly",
  },
  {
    path: pathFor("media-center"),
    kind: "media-listing",
    priority: 0.85,
    changeFrequency: "daily",
  },
  {
    path: pathFor("media-news"),
    kind: "media-listing",
    priority: 0.8,
    changeFrequency: "daily",
  },
  {
    path: pathFor("media-site-updates"),
    kind: "media-listing",
    priority: 0.8,
    changeFrequency: "daily",
  },
  {
    path: pathFor("media-videos"),
    kind: "media-listing",
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    path: pathFor("media-gallery"),
    kind: "media-listing",
    priority: 0.75,
    changeFrequency: "weekly",
  },
  {
    path: pathFor("media-press"),
    kind: "media-listing",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: pathFor("topics"),
    kind: "topic-listing",
    priority: 0.85,
    changeFrequency: "weekly",
  },

  {
    path: pathFor("track-your-project"),
    kind: "static",
    priority: 0.8,
    changeFrequency: "weekly",
  },
];
