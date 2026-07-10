import type { MetadataRoute } from "next";
import { SEO_ROUTES } from "../config/seo/seo-routes";
import { SEO_SITE } from "../config/seo/seo-site";
import { loadPublishedProjectSlugs } from "../lib/projects/load-published-projects";
import { getMediaItems } from "../lib/media-center";
import { getSupabaseAdmin } from "../lib/supabase-admin";
import { logError } from "../lib/logging";

function url(path: string) {
  const normalizedPath = path === "/" ? "" : path;
  return `${SEO_SITE.defaultUrl}${normalizedPath}`;
}

function safeDate(value?: string) {
  if (!value) return new Date();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = SEO_ROUTES.map((route) => ({
    url: url(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency ?? "monthly",
    priority: route.priority ?? 0.7,
  }));

  const projectSlugs = await loadPublishedProjectSlugs();
  const projectRoutes: MetadataRoute.Sitemap = projectSlugs.map((slug) => ({
    url: url(`/projects/${slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const mediaItems = await getMediaItems();

  const mediaRoutes: MetadataRoute.Sitemap = mediaItems.map((item) => {
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

    return {
      url: url(`/media-center/${sectionPath}/${item.slug}`),
      lastModified: safeDate(item.publishedAt),
      changeFrequency: item.type === "site-update" ? "weekly" : "monthly",
      priority: item.featured ? 0.8 : item.type === "site-update" ? 0.75 : 0.65,
    };
  });

  const topicRoutes: MetadataRoute.Sitemap = await getPublishedTopicRoutes();

  return [...staticRoutes, ...projectRoutes, ...mediaRoutes, ...topicRoutes];
}

async function getPublishedTopicRoutes(): Promise<MetadataRoute.Sitemap> {
  const { data, error } = await getSupabaseAdmin()
    .from("topics")
    .select("slug, published_at, updated_at, is_featured")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "is", null);

  if (error) {
    logError("sitemap: failed to load published topics", error);
  }

  const rows = (data ?? []).filter((topic) => topic.slug);

  return rows.map((topic) => ({
    url: url(`/topics/${topic.slug}`),
    lastModified: safeDate(topic.updated_at ?? topic.published_at ?? undefined),
    changeFrequency: "monthly" as const,
    priority: topic.is_featured ? 0.75 : 0.65,
  }));
}
