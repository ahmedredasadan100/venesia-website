/** Slugs/names used by E2E seeds — hide from production CMS pickers and public listings before launch. */
export function isTestTopicCategory(slug: string, name?: string | null) {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedName = (name ?? "").trim();

  if (normalizedSlug.startsWith("e2e-test")) return true;
  if (normalizedSlug.includes("feed-widget")) return true;
  if (normalizedName.includes("اختبار Feed")) return true;

  return false;
}

export function filterEditorTopicCategories<T extends { slug: string; name?: string | null }>(categories: T[]) {
  return categories.filter((category) => !isTestTopicCategory(category.slug, category.name));
}

export function isTestTopicSlug(slug: string) {
  return slug.trim().toLowerCase().startsWith("e2e-test");
}

export function filterPublicTopics<T extends { slug: string }>(topics: T[]) {
  return topics.filter((topic) => !isTestTopicSlug(topic.slug));
}
