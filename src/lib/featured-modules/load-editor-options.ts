import "server-only";

import { CONTENT_TYPES } from "../admin/content/content-types";
import { loadPublicContentCollection } from "../content/public-content-read/owner";
import { loadTopicFilterOptionsForAdmin } from "../feed-modules/load-topic-filter-options";
import type { FeaturedEditorOptions } from "./contract";

function descendantSlugs(
  categories: Awaited<ReturnType<typeof loadTopicFilterOptionsForAdmin>>["categories"],
  rootId: number,
) {
  const scopedIds = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId !== null && scopedIds.has(category.parentId) && !scopedIds.has(category.id)) {
        scopedIds.add(category.id);
        changed = true;
      }
    }
  }
  return categories.filter((category) => scopedIds.has(category.id)).map((category) => category.slug);
}

export async function loadFeaturedEditorOptions(): Promise<FeaturedEditorOptions> {
  const filterOptions = await loadTopicFilterOptionsForAdmin();
  const itemGroups = await Promise.all(CONTENT_TYPES.map(async (contentType) => {
    const first = await loadPublicContentCollection({
      contentTypes: [contentType],
      page: 1,
      pageSize: 60,
      sort: "newest",
    });
    const remaining = await Promise.all(
      Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
        loadPublicContentCollection({
          contentTypes: [contentType],
          page: index + 2,
          pageSize: 60,
          sort: "newest",
        }),
      ),
    );
    return [first, ...remaining].flatMap((page) => page.items);
  }));

  return {
    categories: filterOptions.categories.map((category) => ({
      ...category,
      scopeSlugs: descendantSlugs(filterOptions.categories, category.id),
    })),
    items: itemGroups.flat().map((item) => ({
      id: item.id,
      contentType: item.contentType,
      title: item.title,
      categorySlug: item.categorySlug,
      publishedAt: item.publishedAt,
    })),
  };
}
