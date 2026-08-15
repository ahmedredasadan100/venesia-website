export const ADMIN_STATIC_ROUTES = [
  { key: "home", label: "الرئيسية", href: "/" },
  { key: "about", label: "من نحن", href: "/about" },
  { key: "projects", label: "مشروعاتنا", href: "/projects" },
  { key: "track-your-project", label: "تابع مشروعك", href: "/track-your-project" },
  { key: "topics", label: "موضوعات تهمك", href: "/topics" },
  { key: "media-center", label: "المركز الإعلامي", href: "/media-center" },
  { key: "media-news", label: "الأخبار", href: "/media-center/news" },
  { key: "media-site-updates", label: "من أرض التنفيذ", href: "/media-center/site-updates" },
  { key: "media-videos", label: "الفيديوهات", href: "/media-center/videos" },
  { key: "media-press", label: "البيانات الصحفية", href: "/media-center/press" },
  { key: "media-gallery", label: "معرض الصور", href: "/media-center/gallery" },
  { key: "contact", label: "تواصل معنا", href: "/contact" },
] as const;

export function findStaticRouteByHref(href: string) {
  const normalized = href.trim();
  return ADMIN_STATIC_ROUTES.find((route) => route.href === normalized) ?? null;
}

export function findStaticRouteByKey(key: string) {
  return ADMIN_STATIC_ROUTES.find((route) => route.key === key) ?? null;
}
