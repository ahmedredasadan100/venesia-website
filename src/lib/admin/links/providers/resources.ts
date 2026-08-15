import { getSupabaseAdmin } from "../../../supabase-admin";
import { isContentType } from "../../content/content-types";
import { resolvePublicContentPath } from "../../../content/public-content-path";
import { ADMIN_STATIC_ROUTES } from "../static-routes";
import type { AdminLinkProvider } from "../types";

function matchesQuery(parts: Array<string | null | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return parts.some((part) => part?.toLowerCase().includes(normalized));
}

function pagePublicPath(path: string | null | undefined, slug: string | null | undefined) {
  const cleanPath = path?.trim();
  if (cleanPath) return cleanPath;
  if (!slug || slug === "home") return "/";
  return `/${slug}`;
}

export const pagesLinkProvider: AdminLinkProvider = {
  type: "pages",
  label: "صفحة",
  labelPlural: "الصفحات",
  async search(query, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("pages")
      .select("id,title,slug,path")
      .order("id", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => matchesQuery([row.title, row.slug, row.path], query))
      .slice(0, limit)
      .map((row) => ({
        id: `pages:${row.id}`,
        resourceType: "pages" as const,
        resourceId: row.id,
        title: row.title,
        slug: row.slug,
        publicPath: pagePublicPath(row.path, row.slug),
      }));
  },
  async resolveMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await getSupabaseAdmin().from("pages").select("id,slug,path").in("id", ids);
    if (error) throw new Error(error.message);
    const map = new Map<number, string>();
    (data ?? []).forEach((row) => map.set(row.id, pagePublicPath(row.path, row.slug)));
    return map;
  },
};

export const projectsLinkProvider: AdminLinkProvider = {
  type: "projects",
  label: "مشروع",
  labelPlural: "المشاريع",
  async search(query, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("projects")
      .select("id,arabic_name,code,slug,type")
      .order("homepage_order", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => matchesQuery([row.arabic_name, row.code, row.slug, row.type], query))
      .slice(0, limit)
      .map((row) => ({
        id: `projects:${row.id}`,
        resourceType: "projects" as const,
        resourceId: row.id,
        title: row.arabic_name,
        slug: row.slug,
        publicPath: `/projects/${row.slug}`,
        subtitle: row.type === "residential" ? "سكني" : "تجاري",
      }));
  },
  async resolveMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await getSupabaseAdmin().from("projects").select("id,slug").in("id", ids);
    if (error) throw new Error(error.message);
    const map = new Map<number, string>();
    (data ?? []).forEach((row) => map.set(row.id, `/projects/${row.slug}`));
    return map;
  },
};

export const topicsLinkProvider: AdminLinkProvider = {
  type: "topics",
  label: "موضوع",
  labelPlural: "الموضوعات",
  async search(query, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("topics")
      .select("id,title,slug,category,content_type")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => matchesQuery([row.title, row.slug, row.category], query))
      .slice(0, limit)
      .flatMap((row) => {
        if (!isContentType(row.content_type)) return [];
        return [{
          id: `topics:${row.id}`,
          resourceType: "topics" as const,
          resourceId: row.id,
          title: row.title,
          slug: row.slug,
          publicPath: resolvePublicContentPath(row.content_type, row.slug),
          subtitle: row.category,
          meta: { content_type: row.content_type },
        }];
      });
  },
  async resolveMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await getSupabaseAdmin().from("topics").select("id,slug,content_type").in("id", ids);
    if (error) throw new Error(error.message);
    const map = new Map<number, string>();
    (data ?? []).forEach((row) => {
      if (isContentType(row.content_type)) {
        map.set(row.id, resolvePublicContentPath(row.content_type, row.slug));
      }
    });
    return map;
  },
};

function buildCategoryLevels(rows: Array<{ id: number; parent_id: number | null }>) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const cache = new Map<number, number>();

  function levelFor(id: number): number {
    if (cache.has(id)) return cache.get(id)!;
    const row = byId.get(id);
    if (!row?.parent_id || !byId.has(row.parent_id)) {
      cache.set(id, 0);
      return 0;
    }
    const level = levelFor(row.parent_id) + 1;
    cache.set(id, level);
    return level;
  }

  rows.forEach((row) => levelFor(row.id));
  return cache;
}

export const categoriesLinkProvider: AdminLinkProvider = {
  type: "topic_categories",
  label: "تصنيف",
  labelPlural: "التصنيفات",
  hierarchical: true,
  async search(query, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_categories")
      .select("id,name,slug,parent_id")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .limit(300);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const levels = buildCategoryLevels(rows);

    return rows
      .filter((row) => matchesQuery([row.name, row.slug], query))
      .slice(0, limit)
      .map((row) => ({
        id: `topic_categories:${row.id}`,
        resourceType: "topic_categories" as const,
        resourceId: row.id,
        title: row.name,
        slug: row.slug,
        publicPath: `/topics?category=${row.slug}`,
        level: levels.get(row.id) ?? 0,
      }));
  },
  async resolveMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await getSupabaseAdmin().from("topic_categories").select("id,slug").in("id", ids);
    if (error) throw new Error(error.message);
    const map = new Map<number, string>();
    (data ?? []).forEach((row) => map.set(row.id, `/topics?category=${row.slug}`));
    return map;
  },
};

export const seriesLinkProvider: AdminLinkProvider = {
  type: "topic_series",
  label: "سلسلة",
  labelPlural: "السلاسل",
  async search(query, limit) {
    const { data, error } = await getSupabaseAdmin()
      .from("topic_series")
      .select("id,name,slug")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => matchesQuery([row.name, row.slug], query))
      .slice(0, limit)
      .map((row) => ({
        id: `topic_series:${row.id}`,
        resourceType: "topic_series" as const,
        resourceId: row.id,
        title: row.name,
        slug: row.slug,
        publicPath: `/topics?series=${row.slug}`,
      }));
  },
  async resolveMany(ids) {
    if (!ids.length) return new Map();
    const { data, error } = await getSupabaseAdmin().from("topic_series").select("id,slug").in("id", ids);
    if (error) throw new Error(error.message);
    const map = new Map<number, string>();
    (data ?? []).forEach((row) => map.set(row.id, `/topics?series=${row.slug}`));
    return map;
  },
};

export const staticRoutesLinkProvider: AdminLinkProvider = {
  type: "static_routes",
  label: "مسار ثابت",
  labelPlural: "المسارات الثابتة",
  async search(query, limit) {
    return ADMIN_STATIC_ROUTES.filter((route) => matchesQuery([route.label, route.href, route.key], query))
      .slice(0, limit)
      .map((route) => ({
        id: `static_routes:${route.key}`,
        resourceType: "static_routes" as const,
        resourceId: null,
        title: route.label,
        slug: route.key,
        publicPath: route.href,
        meta: { route_key: route.key },
      }));
  },
  async resolveMany() {
    return new Map();
  },
};
