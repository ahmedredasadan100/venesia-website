import { SEO_ROUTES } from "./seo-routes";
import { SEO_SITE } from "./seo-site";

export const SEO_DATA = {
  site: SEO_SITE,
  routes: SEO_ROUTES,
} as const;

export function getSeoRoute(path: string) {
  const normalizedPath = path === "" ? "/" : path.replace(/\/$/, "") || "/";

  return SEO_ROUTES.find((route) => route.path === normalizedPath);
}