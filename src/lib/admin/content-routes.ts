export const ADMIN_CONTENT_ROUTES = {
  topics: "/admin/content/topics",
  newTopic: "/admin/content/topics/new",
  categories: "/admin/content/categories",
  newCategory: "/admin/content/categories/new",
  series: "/admin/content/series",
  newSeries: "/admin/content/series/new",
} as const;

export function adminContentTopicPath(
  id: number | string,
  options: {
    returnTo?: string;
    focusTarget?: string;
  } = {},
) {
  const path = `${ADMIN_CONTENT_ROUTES.topics}/${id}`;
  const params = new URLSearchParams();
  if (options.returnTo && isAdminContentReturnPath(options.returnTo)) {
    params.set("return_to", options.returnTo);
  }
  const query = params.toString();
  const focusTarget =
    options.focusTarget && /^[a-z0-9-]+$/i.test(options.focusTarget)
      ? `#${options.focusTarget}`
      : "";
  return `${path}${query ? `?${query}` : ""}${focusTarget}`;
}

export function adminContentTopicPreviewPath(id: number | string) {
  return `${adminContentTopicPath(id)}/preview`;
}

export function isAdminContentReturnPath(value: string) {
  return value === ADMIN_CONTENT_ROUTES.topics || value.startsWith(`${ADMIN_CONTENT_ROUTES.topics}?`);
}
