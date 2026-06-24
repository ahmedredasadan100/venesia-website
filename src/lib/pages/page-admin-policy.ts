/** System pages that must not be deleted from CMS. Duplicate/toggle remain allowed. */

const CORE_PROTECTED_SLUGS = new Set(["home", "about", "contact", "topics"]);

const SYSTEM_PROTECTED_SLUGS = new Set([
  "track-your-project",
  "media-center",
  "media-center-news",
  "media-center-videos",
  "media-center-gallery",
  "media-center-press",
  "media-center-site-updates",
  "projects",
]);

export function getPageDeleteBlockReason(slug: string) {
  const normalized = slug.trim().toLowerCase();

  if (CORE_PROTECTED_SLUGS.has(normalized)) {
    return "صفحة نظام أساسية (Home / About / Contact / Topics) — الحذف غير مسموح.";
  }

  if (SYSTEM_PROTECTED_SLUGS.has(normalized) || normalized.startsWith("media-center")) {
    return "صفحة CMS أساسية أو مسار المركز الإعلامي — الحذف غير مسموح.";
  }

  return null;
}

export function canDeletePage(slug: string) {
  return getPageDeleteBlockReason(slug) === null;
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
