export type PublicPageRouteRegistration = {
  key: string;
  label: string;
  href: string;
  cmsPageSlug?: string;
  linkableFromAdmin: boolean;
  verification: "http_exact" | "compiled_dynamic";
};

/**
 * Canonical executable public-route inventory. Runtime and governance
 * projections must derive from this registry rather than restating paths.
 */
export const PUBLIC_PAGE_ROUTE_REGISTRY = [
  {
    key: "home",
    label: "الرئيسية",
    href: "/",
    cmsPageSlug: "home",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "about",
    label: "من نحن",
    href: "/about",
    cmsPageSlug: "about",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "projects",
    label: "مشروعاتنا",
    href: "/projects",
    cmsPageSlug: "projects",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "track-your-project",
    label: "تابع مشروعك",
    href: "/track-your-project",
    cmsPageSlug: "track-your-project",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "topics",
    label: "موضوعات تهمك",
    href: "/topics",
    cmsPageSlug: "topics",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-center",
    label: "المركز الإعلامي",
    href: "/media-center",
    cmsPageSlug: "media-center",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-news",
    label: "الأخبار",
    href: "/media-center/news",
    cmsPageSlug: "media-center-news",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-site-updates",
    label: "من أرض التنفيذ",
    href: "/media-center/site-updates",
    cmsPageSlug: "media-center-site-updates",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-videos",
    label: "الفيديوهات",
    href: "/media-center/videos",
    cmsPageSlug: "media-center-videos",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-press",
    label: "البيانات الصحفية",
    href: "/media-center/press",
    cmsPageSlug: "media-center-press",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "media-gallery",
    label: "معرض الصور",
    href: "/media-center/gallery",
    cmsPageSlug: "media-center-gallery",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "contact",
    label: "تواصل معنا",
    href: "/contact",
    cmsPageSlug: "contact",
    linkableFromAdmin: true,
    verification: "http_exact",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    linkableFromAdmin: false,
    verification: "http_exact",
  },
  {
    key: "root-catch-all",
    label: "Catch-all page",
    href: "/[...slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "project-detail",
    label: "Project detail",
    href: "/projects/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "topic-detail",
    label: "Topic detail",
    href: "/topics/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "tracking-detail",
    label: "Project tracking detail",
    href: "/track-your-project/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "media-news-detail",
    label: "News detail",
    href: "/media-center/news/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "media-press-detail",
    label: "Press detail",
    href: "/media-center/press/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "media-site-update-detail",
    label: "Site update detail",
    href: "/media-center/site-updates/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "media-video-detail",
    label: "Video detail",
    href: "/media-center/videos/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
  {
    key: "media-gallery-detail",
    label: "Gallery detail",
    href: "/media-center/gallery/[slug]",
    linkableFromAdmin: false,
    verification: "compiled_dynamic",
  },
] as const satisfies readonly PublicPageRouteRegistration[];

export type PublicPageRoute = (typeof PUBLIC_PAGE_ROUTE_REGISTRY)[number];
export type PublicPageRouteKey = PublicPageRoute["key"];
export type PublicStaticPageRoute = Extract<
  PublicPageRoute,
  { linkableFromAdmin: true }
>;
export type PublicStaticPageRouteKey = PublicStaticPageRoute["key"];
export type PublicDynamicPageRoute = Extract<
  PublicPageRoute,
  { verification: "compiled_dynamic" }
>;
export type PublicDynamicPageRouteKey = PublicDynamicPageRoute["key"];

function isPublicStaticPageRoute(
  route: PublicPageRoute,
): route is PublicStaticPageRoute {
  return route.linkableFromAdmin;
}

function isPublicDynamicPageRoute(
  route: PublicPageRoute,
): route is PublicDynamicPageRoute {
  return route.verification === "compiled_dynamic";
}

/** Fixed CMS-backed routes projected from the canonical public registry. */
export const PUBLIC_STATIC_PAGE_ROUTES = PUBLIC_PAGE_ROUTE_REGISTRY.filter(
  isPublicStaticPageRoute,
);

/** Dynamic route templates projected from the canonical public registry. */
export const PUBLIC_DYNAMIC_PAGE_ROUTES = PUBLIC_PAGE_ROUTE_REGISTRY.filter(
  isPublicDynamicPageRoute,
);

/** Admin link choices are a projection; the public registry owns route identity. */
export const ADMIN_STATIC_ROUTES = PUBLIC_STATIC_PAGE_ROUTES;

export function getPublicPageRoute<Key extends PublicStaticPageRouteKey>(
  key: Key,
): Extract<PublicStaticPageRoute, { key: Key }> {
  const route = PUBLIC_STATIC_PAGE_ROUTES.find(
    (candidate) => candidate.key === key,
  );
  if (!route) throw new Error(`Unknown public page route: ${key}`);
  return route as Extract<PublicStaticPageRoute, { key: Key }>;
}

export function getPublicDynamicPageRoute<Key extends PublicDynamicPageRouteKey>(
  key: Key,
): Extract<PublicDynamicPageRoute, { key: Key }> {
  const route = PUBLIC_DYNAMIC_PAGE_ROUTES.find(
    (candidate) => candidate.key === key,
  );
  if (!route) throw new Error(`Unknown public dynamic route: ${key}`);
  return route as Extract<PublicDynamicPageRoute, { key: Key }>;
}

export function interpolatePublicRoute(
  template: string,
  params: Readonly<Record<string, string>>,
) {
  return template.replace(
    /\[\.\.\.(\w+)\]|\[(\w+)\]/g,
    (_match, catchAll, single) => {
      const key = String(catchAll || single);
      const value = params[key]?.trim().replace(/^\/+|\/+$/g, "");
      if (!value) throw new Error(`Missing public route parameter: ${key}`);
      return value;
    },
  );
}

export function findPublicPageRouteByHref(href: string) {
  const normalized = href.trim().replace(/\/+$/, "") || "/";
  return (
    PUBLIC_STATIC_PAGE_ROUTES.find((route) => route.href === normalized) ?? null
  );
}

export function findPublicPageRouteByCmsSlug(cmsPageSlug: string) {
  const normalized = cmsPageSlug.trim();
  return (
    PUBLIC_STATIC_PAGE_ROUTES.find((route) => route.cmsPageSlug === normalized) ??
    null
  );
}

export function findStaticRouteByHref(href: string) {
  return findPublicPageRouteByHref(href);
}

export function findStaticRouteByKey(key: string) {
  return ADMIN_STATIC_ROUTES.find((route) => route.key === key) ?? null;
}
