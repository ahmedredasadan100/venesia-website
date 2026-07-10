/** Homepage is the only page that cannot be deleted from CMS. */

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

export function isHomepagePage(page: PageDeleteIdentity) {
  const slug = normalizeSlug(page.slug);
  const path = normalizeStoredPath(page.path);
  return slug === "home" || path === "/";
}

export function getPageDeleteBlockReason(page: PageDeleteIdentity) {
  if (isHomepagePage(page)) {
    return "الصفحة الرئيسية محمية — الحذف غير مسموح.";
  }

  return null;
}

export function canDeletePage(page: PageDeleteIdentity) {
  return getPageDeleteBlockReason(page) === null;
}

export function buildDuplicatePageIdentity(
  source: { title: string; slug: string; path: string },
  suffix: string,
) {
  const slug = `${source.slug}-copy-${suffix}`;

  let path: string;
  if (source.path === "/" || source.slug === "home") {
    path = `/page-copy-${suffix}`;
  } else {
    path = `${source.path.replace(/\/$/, "")}-copy-${suffix}`;
  }

  return {
    title: `${source.title} — نسخة`,
    slug,
    path,
  };
}
