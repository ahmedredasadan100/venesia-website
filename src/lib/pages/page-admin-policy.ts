/** System hub pages that cannot be deleted from CMS. */

export type PageDeleteIdentity = {
  slug: string;
  path?: string | null;
};

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function normalizeStoredPath(path: string | null | undefined) {
  if (path == null) return "";
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return trimmed === "/" ? "/" : "";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function resolvePagePublicPath(page: PageDeleteIdentity): string | null {
  const storedPath = normalizeStoredPath(page.path);
  if (storedPath) return storedPath;

  const slug = normalizeSlug(page.slug);
  if (!slug) return null;
  return slug === "home" ? "/" : normalizeStoredPath(slug) || null;
}

export function isHomepagePage(page: PageDeleteIdentity) {
  const slug = normalizeSlug(page.slug);
  const path = normalizeStoredPath(page.path);
  return slug === "home" || path === "/";
}

export function isProjectsHubPage(page: PageDeleteIdentity) {
  const slug = normalizeSlug(page.slug);
  const path = normalizeStoredPath(page.path);
  return slug === "projects" || path === "/projects";
}

export function getPageDeleteBlockReason(page: PageDeleteIdentity) {
  if (isHomepagePage(page)) {
    return "الصفحة الرئيسية محمية — الحذف غير مسموح.";
  }

  if (isProjectsHubPage(page)) {
    return "صفحة المشروعات محمية — الحذف غير مسموح.";
  }

  return null;
}
