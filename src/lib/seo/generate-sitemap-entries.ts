import "server-only";

import type { MetadataRoute } from "next";

import { SEO_ROUTES } from "../../config/seo/seo-routes";
import { getMediaItems } from "../media-center";
import { logError } from "../logging";
import { isReservedPublicPath } from "../pages/reserved-public-paths";
import { loadPublishedProjectSlugs } from "../projects/load-published-projects";
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
  if (!value) return new Date();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
    .select("id, slug, published_at, updated_at, is_featured")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((topic) => topic.slug)
    .map((topic) => {
      const path = `/topics/${topic.slug}`;
      return {
        url: buildSitemapAbsoluteUrl(path, baseUrl),
        path,
        source: "articles" as const,
        entityId: topic.id,
        slug: topic.slug,
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
    .select("id, slug, path, status, updated_at")
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

    entries.push({
      url: buildSitemapAbsoluteUrl(path, baseUrl),
      path,
      source: "cms_pages",
      entityId: page.id,
      slug: page.slug ?? undefined,
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
): Promise<SitemapEntry[]> {
  try {
    return await loader();
  } catch (error) {
    // Single warning per failed source; static core routes still ship.
    logError(`sitemap: ${source} source failed — continuing without it`, error);
    return [];
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
    lastModified: new Date(),
    changeFrequency: route.changeFrequency ?? "monthly",
    priority: route.priority ?? 0.7,
  }));

  const [projectEntries, mediaEntries, topicEntries, cmsEntries] = await Promise.all([
    loadSourceEntries("projects", async () => {
      const projectSlugs = await loadPublishedProjectSlugs();
      return projectSlugs.map((slug) => {
        const path = `/projects/${slug}`;
        return {
          url: buildSitemapAbsoluteUrl(path, baseUrl),
          path,
          source: "projects" as const,
          slug,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.85,
        };
      });
    }),
    loadSourceEntries("media", async () => {
      const mediaItems = await getMediaItems();
      return mediaItems.map((item) => {
        const sectionPath =
          item.type === "news"
            ? "news"
            : item.type === "video"
              ? "videos"
              : item.type === "gallery"
                ? "gallery"
                : item.type === "press"
                  ? "press"
                  : "site-updates";

        const path = `/media-center/${sectionPath}/${item.slug}`;
        return {
          url: buildSitemapAbsoluteUrl(path, baseUrl),
          path,
          source: "media" as const,
          slug: item.slug,
          lastModified: safeDate(item.publishedAt),
          changeFrequency: item.type === "site-update" ? ("weekly" as const) : ("monthly" as const),
          priority: item.featured ? 0.8 : item.type === "site-update" ? 0.75 : 0.65,
        };
      });
    }),
    loadSourceEntries("articles", () => getPublishedTopicEntries(baseUrl)),
    loadSourceEntries("cms_pages", () => getPublishedCmsPageEntries(baseUrl)),
  ]);

  return {
    entries: dedupeByUrl([
      ...staticEntries,
      ...projectEntries,
      ...mediaEntries,
      ...topicEntries,
      ...cmsEntries,
    ]),
    generationMode: "runtime",
    generatedAt,
  };
}

export function toMetadataSitemap(entries: SitemapEntry[]): MetadataRoute.Sitemap {
  return entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified ?? new Date(),
    changeFrequency: entry.changeFrequency ?? "monthly",
    priority: entry.priority ?? 0.7,
  }));
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
