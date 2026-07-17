export const ADMIN_CONTENT_ROUTES = {
  topics: "/admin/content/topics",
  newTopic: "/admin/content/topics/new",
  categories: "/admin/content/categories",
  newCategory: "/admin/content/categories/new",
  series: "/admin/content/series",
  newSeries: "/admin/content/series/new",
} as const;

export function adminContentTopicPath(id: number | string) {
  return `${ADMIN_CONTENT_ROUTES.topics}/${id}`;
}

export function adminContentTopicPreviewPath(id: number | string) {
  return `${adminContentTopicPath(id)}/preview`;
}

export function isAdminContentReturnPath(value: string) {
  return value === ADMIN_CONTENT_ROUTES.topics || value.startsWith(`${ADMIN_CONTENT_ROUTES.topics}?`);
}
