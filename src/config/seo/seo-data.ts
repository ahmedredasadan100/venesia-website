import { SEO_ROUTES } from "./seo-routes";

export function getSeoRoute(path: string) {
  const normalizedPath = path === "" ? "/" : path.replace(/\/$/, "") || "/";

  return SEO_ROUTES.find((route) => route.path === normalizedPath);
}
