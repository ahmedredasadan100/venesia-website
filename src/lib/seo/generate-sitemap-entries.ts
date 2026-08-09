import "server-only";

import { SEO_ROUTES } from "../../config/seo/seo-routes";
import { getMediaHref, getMediaItems } from "../media-center";
import { logError } from "../logging";
import { isReservedPublicPath } from "../pages/reserved-public-paths";
import { loadPublishedProjectSitemapRows } from "../projects/load-published-projects";
import { getSupabaseAdmin } from "../supabase-admin";

import type { SitemapEntry, SitemapEntrySource, SitemapGenerationResult } from "./sitemap-monitor-types";
import { SEO_SITE } from "../../config/seo/seo-site";
import { getGlobalSeoDefaults } from "./global-seo-defaults";
import { loadGlobalSeoSettings } from "./load-global-seo-settings";

export function buildSitemapAbsoluteUrl(path: string, baseUrl: string = SEO_SITE.defaultUrl) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path === "/" ? "" : path;
  return `${normalizedBase}${normalizedPath}`;
}

/** Single canonical base shared by sitemap, robots and metadata helpers. */
export async function resolveCanonicalBaseUrl(): Promise<string> {
  try {
    const global = await loadGlobalSeoSettings();
    const base = global.canonicalBaseUrl?.trim() || global.siteUrl?.trim();
    if (base) return base.replace(/\/$/, "");
  } catch (error) {
    logError("sitemap: canonical base load failed — using code default", error);
  }
  const defaults = getGlobalSeoDefaults();
  return (defaults.canonicalBaseUrl || defaults.siteUrl || SEO_SITE.defaultUrl).replace(/\/$/, "");
}

function safeDate(value?: string) {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapSourceFromRouteKind(kind: string | undefined, path: string): SitemapEntrySource {
  if (path === "/track-your-project" || path.startsWith("/track-your-project/")) {
    return "track_your_project";
  }
  if (kind === "project-listing") return "static_pages";
  return "static_pages";
}

async function getPublishedTopicEntries(baseUrl: string): Promise<SitemapEntry[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id, slug, published_at, updated_at, is_featured, canonical_url, robots_index")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((topic) => topic.slug && topic.robots_index !== false)
    .map((topic) => {
      const path = `/topics/${topic.slug}`;
      return {
        url: buildSitemapAbsoluteUrl(path, baseUrl),
        path,
        source: "articles" as const,
        entityId: topic.id,
        slug: topic.slug,
        canonicalOverride: typeof topic.canonical_url === "string" ? topic.canonical_url : undefined,
        lastModified: safeDate(topic.updated_at ?? topic.published_at ?? undefined),
        changeFrequency: "monthly" as const,
        priority: topic.is_featured ? 0.75 : 0.65,
      };
    });
}

/** Published catch-all CMS pages; reserved/static/project paths are excluded. */
async function getPublishedCmsPageEntries(baseUrl: string): Promise<SitemapEntry[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id, slug, path, status, updated_at, canonical_url, robots_index")
    .eq("status", "published")
    .not("path", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const entries: SitemapEntry[] = [];
  for (const page of data ?? []) {
    const path = typeof page.path === "string" ? page.path.trim() : "";
    if (!path.startsWith("/") || path === "/") continue;
    if (isReservedPublicPath(path)) continue;
    if (page.robots_index === false) continue;

    entries.push({
      url: buildSitemapAbsoluteUrl(path, baseUrl),
      path,
      source: "cms_pages",
      entityId: page.id,
      slug: page.slug ?? undefined,
      canonicalOverride: typeof page.canonical_url === "string" ? page.canonical_url : undefined,
      lastModified: safeDate(page.updated_at ?? undefined),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}

async function loadSourceEntries(
  source: SitemapEntrySource,
  loader: () => Promise<SitemapEntry[]>,
): Promise<{ entries: SitemapEntry[]; error?: string }> {
  try {
    return { entries: await loader() };
  } catch (error) {
    // Single warning per failed source; static core routes still ship.
    logError(`sitemap: ${source} source failed — continuing without it`, error);
    return {
      entries: [],
      error: error instanceof Error ? error.message : "Unknown sitemap source failure",
    };
  }
}

function dedupeByUrl(entries: SitemapEntry[]): SitemapEntry[] {
  const seen = new Set<string>();
  const unique: SitemapEntry[] = [];
  for (const entry of entries) {
    const key = entry.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

export async function generateSitemapEntries(): Promise<SitemapGenerationResult> {
  const generatedAt = new Date().toISOString();
  const baseUrl = await resolveCanonicalBaseUrl();

  // Static core routes never depend on Supabase and must always be present.
  const staticEntries: SitemapEntry[] = SEO_ROUTES.map((route) => ({
    url: buildSitemapAbsoluteUrl(route.path, baseUrl),
    path: route.path,
    source: mapSourceFromRouteKind(route.kind, route.path),
    changeFrequency: route.changeFrequency ?? "monthly",
    priority: route.priority ?? 0.7,
  }));

  const [projectsResult, mediaResult, topicsResult, cmsResult] = await Promise.all([
    loadSourceEntries("projects", async () => {
      const projects = await loadPublishedProjectSitemapRows();
      return projects.filter((project) => project.robotsIndex !== false).map((project) => {
        const path = `/projects/${project.slug}`;
        return {
          url: buildSitemapAbsoluteUrl(path, baseUrl),
          path,
          source: "projects" as const,
          slug: project.slug,
          canonicalOverride: project.canonicalUrl ?? undefined,
          lastModified: safeDate(project.updatedAt),
          changeFrequency: "weekly" as const,
          priority: 0.85,
        };
      });
    }),
    loadSourceEntries("media", async () => {
      const mediaItems = await getMediaItems();
      return mediaItems.filter((item) => item.robotsIndex !== false).map((item) => {
        const path = getMediaHref(item);
        return {
          url: buildSitemapAbsoluteUrl(path, baseUrl),
          path,
          source: "media" as const,
          slug: item.slug,
          canonicalOverride: item.canonicalUrl,
          lastModified: safeDate(item.publishedAt),
          changeFrequency: item.type === "site_update" ? ("weekly" as const) : ("monthly" as const),
          priority: item.featured ? 0.8 : item.type === "site_update" ? 0.75 : 0.65,
        };
      });
    }),
    loadSourceEntries("articles", () => getPublishedTopicEntries(baseUrl)),
    loadSourceEntries("cms_pages", () => getPublishedCmsPageEntries(baseUrl)),
  ]);

  const projectEntries = projectsResult.entries;
  const mediaEntries = mediaResult.entries;
  const topicEntries = topicsResult.entries;
  const cmsEntries = cmsResult.entries;
  const sourceErrors = [
    { source: "projects" as const, message: projectsResult.error },
    { source: "media" as const, message: mediaResult.error },
    { source: "articles" as const, message: topicsResult.error },
    { source: "cms_pages" as const, message: cmsResult.error },
  ].flatMap((item): Array<{ source: SitemapEntrySource; message: string }> =>
    item.message ? [{ source: item.source, message: item.message }] : [],
  );

  const allEntries = [
    ...staticEntries,
    ...projectEntries,
    ...mediaEntries,
    ...topicEntries,
    ...cmsEntries,
  ];
  const rawCounts = new Map<string, number>();
  for (const entry of allEntries) {
    const key = entry.url.replace(/\/$/, "");
    rawCounts.set(key, (rawCounts.get(key) ?? 0) + 1);
  }
  const duplicateUrls = [...rawCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url);

  return {
    entries: dedupeByUrl(allEntries),
    generationMode: "runtime",
    generatedAt,
    error: sourceErrors.length
      ? sourceErrors.map((item) => `${item.source}: ${item.message}`).join("; ")
      : undefined,
    sourceErrors,
    duplicateUrls,
  };
}

export function countEntriesBySource(entries: SitemapEntry[]) {
  return entries.reduce<Record<SitemapEntrySource, number>>(
    (counts, entry) => {
      counts[entry.source] += 1;
      return counts;
    },
    {
      static_pages: 0,
      cms_pages: 0,
      projects: 0,
      articles: 0,
      media: 0,
      track_your_project: 0,
    },
  );
}
