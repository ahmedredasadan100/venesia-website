import "server-only";

import type { MetadataRoute } from "next";

import { SEO_ROUTES } from "../../config/seo/seo-routes";
import { getMediaItems } from "../media-center";
import { logError } from "../logging";
import { loadPublishedProjectSlugs } from "../projects/load-published-projects";
import { getSupabaseAdmin } from "../supabase-admin";

import type { SitemapEntry, SitemapEntrySource, SitemapGenerationResult } from "./sitemap-monitor-types";
import { SEO_SITE } from "../../config/seo/seo-site";

export function buildSitemapAbsoluteUrl(path: string) {
  const normalizedPath = path === "/" ? "" : path;
  return `${SEO_SITE.defaultUrl}${normalizedPath}`;
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

async function getPublishedTopicEntries(): Promise<SitemapEntry[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("id, slug, published_at, updated_at, is_featured")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "is", null);

  if (error) {
    logError("sitemap: failed to load published topics", error);
    return [];
  }

  return (data ?? [])
    .filter((topic) => topic.slug)
    .map((topic) => {
      const path = `/topics/${topic.slug}`;
      return {
        url: buildSitemapAbsoluteUrl(path),
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

export async function generateSitemapEntries(): Promise<SitemapGenerationResult> {
  const generatedAt = new Date().toISOString();

  try {
    const staticEntries: SitemapEntry[] = SEO_ROUTES.map((route) => ({
      url: buildSitemapAbsoluteUrl(route.path),
      path: route.path,
      source: mapSourceFromRouteKind(route.kind, route.path),
      lastModified: new Date(),
      changeFrequency: route.changeFrequency ?? "monthly",
      priority: route.priority ?? 0.7,
    }));

    const projectSlugs = await loadPublishedProjectSlugs();
    const projectEntries: SitemapEntry[] = projectSlugs.map((slug) => {
      const path = `/projects/${slug}`;
      return {
        url: buildSitemapAbsoluteUrl(path),
        path,
        source: "projects",
        slug,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.85,
      };
    });

    const mediaItems = await getMediaItems();
    const mediaEntries: SitemapEntry[] = mediaItems.map((item) => {
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
        url: buildSitemapAbsoluteUrl(path),
        path,
        source: "media",
        slug: item.slug,
        lastModified: safeDate(item.publishedAt),
        changeFrequency: item.type === "site-update" ? "weekly" : "monthly",
        priority: item.featured ? 0.8 : item.type === "site-update" ? 0.75 : 0.65,
      };
    });

    const topicEntries = await getPublishedTopicEntries();

    return {
      entries: [...staticEntries, ...projectEntries, ...mediaEntries, ...topicEntries],
      generationMode: "runtime",
      generatedAt,
    };
  } catch (error) {
    logError("sitemap: generation failed", error);
    return {
      entries: [],
      generationMode: "runtime",
      generatedAt,
      error: error instanceof Error ? error.message : "Sitemap generation failed.",
    };
  }
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
