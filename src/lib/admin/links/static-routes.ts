export type PublicPageRouteRegistration = {
  key: string;
  label: string;
  href: string;
  linkableFromAdmin: boolean;
  verification: "http_exact" | "compiled_dynamic";
};

const ADMIN_LINKABLE_STATIC_ROUTES = [
  { key: "home", label: "الرئيسية", href: "/" },
  { key: "about", label: "من نحن", href: "/about" },
  { key: "projects", label: "مشروعاتنا", href: "/projects" },
  {
    key: "track-your-project",
    label: "تابع مشروعك",
    href: "/track-your-project",
  },
  { key: "topics", label: "موضوعات تهمك", href: "/topics" },
  { key: "media-center", label: "المركز الإعلامي", href: "/media-center" },
  { key: "media-news", label: "الأخبار", href: "/media-center/news" },
  {
    key: "media-site-updates",
    label: "من أرض التنفيذ",
    href: "/media-center/site-updates",
  },
  { key: "media-videos", label: "الفيديوهات", href: "/media-center/videos" },
  {
    key: "media-press",
    label: "البيانات الصحفية",
    href: "/media-center/press",
  },
  { key: "media-gallery", label: "معرض الصور", href: "/media-center/gallery" },
  { key: "contact", label: "تواصل معنا", href: "/contact" },
] as const;

export const PUBLIC_PAGE_ROUTE_REGISTRY = [
  ...ADMIN_LINKABLE_STATIC_ROUTES.map((route) => ({
    ...route,
    linkableFromAdmin: true as const,
    verification: "http_exact" as const,
  })),
  {
    key: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    linkableFromAdmin: false,
    verification: "http_exact",
  },
  ...[
    ["root-catch-all", "Catch-all page", "/[...slug]"],
    ["project-detail", "Project detail", "/projects/[slug]"],
    ["topic-detail", "Topic detail", "/topics/[slug]"],
    [
      "tracking-detail",
      "Project tracking detail",
      "/track-your-project/[slug]",
    ],
    ["media-news-detail", "News detail", "/media-center/news/[slug]"],
    ["media-press-detail", "Press detail", "/media-center/press/[slug]"],
    [
      "media-site-update-detail",
      "Site update detail",
      "/media-center/site-updates/[slug]",
    ],
    ["media-video-detail", "Video detail", "/media-center/videos/[slug]"],
    ["media-gallery-detail", "Gallery detail", "/media-center/gallery/[slug]"],
  ].map(([key, label, href]) => ({
    key,
    label,
    href,
    linkableFromAdmin: false as const,
    verification: "compiled_dynamic" as const,
  })),
] as const satisfies readonly PublicPageRouteRegistration[];

export const ADMIN_STATIC_ROUTES = ADMIN_LINKABLE_STATIC_ROUTES;

export function findStaticRouteByHref(href: string) {
  const normalized = href.trim();
  return ADMIN_STATIC_ROUTES.find((route) => route.href === normalized) ?? null;
}

export function findStaticRouteByKey(key: string) {
  return ADMIN_STATIC_ROUTES.find((route) => route.key === key) ?? null;
}
