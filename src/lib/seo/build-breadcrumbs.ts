import { SEO_SITE } from "../../config/seo/seo-site";
import { absoluteUrl, absoluteUrlWithBase, normalizePath } from "./seo-utils";

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbItems(items: BreadcrumbItem[], baseUrl?: string) {
  const homeItem: BreadcrumbItem = {
    name: "الرئيسية",
    path: "/",
  };

  const mergedItems =
    items[0]?.path === "/" ? items : [homeItem, ...items];

  return mergedItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: baseUrl
      ? absoluteUrlWithBase(normalizePath(item.path), baseUrl)
      : absoluteUrl(normalizePath(item.path)),
  }));
}

import type { JsonLdObject } from "./jsonld-types";

export function buildBreadcrumbSchema(items: BreadcrumbItem[], baseUrl?: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: buildBreadcrumbItems(items, baseUrl),
  };
}

export function defaultBreadcrumbForPath(path: string) {
  const normalizedPath = normalizePath(path);

  const labels: Record<string, string> = {
    "/": "الرئيسية",
    "/about": "من نحن",
    "/contact": "تواصل معنا",
    "/projects": "المشروعات",
    "/media-center": "المركز الإعلامي",
    "/media-center/news": "الأخبار",
    "/media-center/videos": "الفيديوهات",
    "/media-center/gallery": "معرض الصور",
    "/media-center/press": "الصحافة",
    "/media-center/site-updates": "تحديثات الموقع",
    "/media-center/topics": "موضوعات المركز الإعلامي",
    "/topics": "الموضوعات العقارية",
    "/track-your-project": "تابع مشروعك",
  };

  const segments = normalizedPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [
      {
        name: SEO_SITE.arabicName,
        path: "/",
      },
    ];
  }

  let currentPath = "";

  return segments.map((segment) => {
    currentPath += `/${segment}`;

    return {
      name: labels[currentPath] ?? decodeURIComponent(segment),
      path: currentPath,
    };
  });
}