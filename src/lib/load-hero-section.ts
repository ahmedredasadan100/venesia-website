import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { resolveHeroConfigLinks } from "./admin/links/hero-config";
import { loadPublicContentCollection } from "./content/public-content-read/owner";
import type { Json, Tables } from "./database.types";
import { MEDIA_CONTENT_TYPES } from "./media-center/types";
import { getPublishedPageBySlug } from "./pages/get-published-page-by-slug";
import { getSupabaseAdmin } from "./supabase-admin";
import { logError } from "./logging";
import type {
  HeroSectionData,
  HeroSourceType,
  PageRecord,
  PageSectionRecord,
} from "./page-sections";

type JsonObject = Record<string, Json | undefined>;

type HeroTemplateRecord = {
  id: number;
  name: string;
  slug: string;
  variant: string;
  style_preset: string;
  source_type: HeroSourceType;
  source_id: number | null;
  source_slug: string | null;
  limit_count: number;
  status: "published" | "unpublished";
  sort_order: number;
  config: JsonObject | null;
};

type HeroTemplateSelection = Pick<
  Tables<"hero_templates">,
  | "id"
  | "name"
  | "slug"
  | "variant"
  | "style_preset"
  | "source_type"
  | "source_id"
  | "source_slug"
  | "limit_count"
  | "status"
  | "sort_order"
  | "config"
>;

function isHeroSourceType(value: string): value is HeroSourceType {
  return (
    value === "manual" ||
    value === "latest_topics" ||
    value === "featured_topics" ||
    value === "topic_category" ||
    value === "latest_media" ||
    value === "featured_media" ||
    value === "media_category"
  );
}

function isHeroTemplateStatus(
  value: string,
): value is HeroTemplateRecord["status"] {
  return value === "published" || value === "unpublished";
}

function isJsonObject(value: Json): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapHeroTemplateSelection(
  template: HeroTemplateSelection,
): HeroTemplateRecord | null {
  if (
    !isHeroSourceType(template.source_type) ||
    !isHeroTemplateStatus(template.status)
  ) {
    return null;
  }

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    variant: template.variant,
    style_preset: template.style_preset,
    source_type: template.source_type,
    source_id: template.source_id,
    source_slug: template.source_slug,
    limit_count: template.limit_count,
    status: template.status,
    sort_order: template.sort_order,
    config: isJsonObject(template.config) ? template.config : null,
  };
}

async function getPageBySlug(slug: string): Promise<PageRecord | null> {
  const page = await getPublishedPageBySlug(slug);
  return page;
}

function templateToHeroSection(template: HeroTemplateRecord, page: PageRecord): HeroSectionData {
  return {
    id: template.id,
    page_id: page.id,
    section_key: "hero",
    section_type: "hero",
    slot: "top",
    variant: template.variant,
    style_preset: template.style_preset,
    source_type: template.source_type,
    source_id: template.source_id,
    source_slug: template.source_slug,
    limit_count: template.limit_count,
    is_visible: template.status === "published",
    sort_order: template.sort_order,
    config: template.config,
    page,
    template: {
      id: template.id,
      name: template.name,
      slug: template.slug,
    },
  };
}

async function templateToHeroSectionResolved(template: HeroTemplateRecord, page: PageRecord): Promise<HeroSectionData> {
  const hero = templateToHeroSection(template, page);
  hero.config = await resolveHeroConfigLinks(template.config);
  return hero;
}

async function getAssignedHeroTemplate(page: PageRecord): Promise<HeroTemplateRecord | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const baseSelect =
    "hero_templates(id,name,slug,variant,style_preset,source_type,source_id,source_slug,limit_count,status,sort_order,config)";

  const byId = await supabaseAdmin
    .from("hero_assignments")
    .select(baseSelect)
    .eq("target_type", "page")
    .eq("target_id", page.id)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byId.error) {
    logError("getAssignedHeroTemplate by id failed", byId.error, { pageId: page.id });
  } else if (byId.data?.hero_templates) {
    const template = mapHeroTemplateSelection(byId.data.hero_templates);
    return template?.status === "published" ? template : null;
  }

  const byPath = await supabaseAdmin
    .from("hero_assignments")
    .select(baseSelect)
    .eq("target_type", "page")
    .eq("path", page.path)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPath.error) {
    logError("getAssignedHeroTemplate by path failed", byPath.error, { path: page.path });
  } else if (byPath.data?.hero_templates) {
    const template = mapHeroTemplateSelection(byPath.data.hero_templates);
    return template?.status === "published" ? template : null;
  }

  return null;
}

async function resolveHeroItems(hero: PageSectionRecord): Promise<HeroSectionData["resolvedItems"]> {
  const limit = Math.max(1, Math.min(hero.limit_count ?? 1, 12));

  if (hero.source_type === "manual") return [];

  if (
    hero.source_type === "latest_topics" ||
    hero.source_type === "featured_topics" ||
    hero.source_type === "topic_category"
  ) {
    const result = await loadPublicContentCollection({
      contentTypes: ["article"],
      page: 1,
      pageSize: limit,
      sort: "newest",
      featured: hero.source_type === "featured_topics" ? "only" : "none",
      categorySlugs: hero.source_type === "topic_category" && hero.source_slug
        ? [hero.source_slug]
        : [],
    });

    return result.items.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      href: item.href,
      category: item.category,
    }));
  }

  if (
    hero.source_type === "latest_media" ||
    hero.source_type === "featured_media" ||
    hero.source_type === "media_category"
  ) {
    const result = await loadPublicContentCollection({
      contentTypes: MEDIA_CONTENT_TYPES,
      page: 1,
      pageSize: limit,
      sort: "newest",
      featured: hero.source_type === "featured_media" ? "only" : "none",
      categorySlugs: hero.source_type === "media_category" && hero.source_slug
        ? [hero.source_slug]
        : [],
    });

    return result.items.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      href: item.href,
      category: item.category,
    }));
  }

  return [];
}

async function pageHasHeroAssignment(page: PageRecord): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();

  const byId = await supabaseAdmin
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", page.id)
    .limit(1)
    .maybeSingle();

  if (byId.data) return true;

  const byPath = await supabaseAdmin
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("path", page.path)
    .limit(1)
    .maybeSingle();

  return Boolean(byPath.data);
}

export type HeroSectionVisibility = "visible" | "hidden" | "none";

export type HeroSectionState = {
  hero: HeroSectionData | null;
  visibility: HeroSectionVisibility;
};

/**
 * Resolves hero visibility for CMS pages — distinguishes missing assignment from admin-hidden.
 */
export const getHeroSectionState = cache(async function getHeroSectionState(
  pageSlug: string,
): Promise<HeroSectionState> {
  return unstable_cache(
    async () => queryHeroSectionState(pageSlug),
    ["hero-section-state", pageSlug],
    { revalidate: 300, tags: ["page-composition", "hero"] },
  )();
});

async function queryHeroSectionState(pageSlug: string): Promise<HeroSectionState> {
  const page = await getPageBySlug(pageSlug);
  if (!page) return { hero: null, visibility: "none" };

  const assignedTemplate = await getAssignedHeroTemplate(page);
  if (assignedTemplate) {
    const hero = await templateToHeroSectionResolved(assignedTemplate, page);
    hero.resolvedItems = await resolveHeroItems(hero);
    return { hero, visibility: "visible" };
  }

  if (await pageHasHeroAssignment(page)) {
    return { hero: null, visibility: "hidden" };
  }

  return { hero: null, visibility: "none" };
}

/**
 * Resolves hero from hero_assignments + hero_templates only.
 * Returns null when no active visible assignment exists — no static or page_sections fallback.
 */
export async function getHeroSectionByPageSlug(pageSlug: string): Promise<HeroSectionData | null> {
  const state = await getHeroSectionState(pageSlug);
  return state.hero;
}
