import { absoluteUrl, absoluteUrlWithBase } from "./seo-utils";

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
      ? absoluteUrlWithBase(item.path, baseUrl)
      : absoluteUrl(item.path),
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