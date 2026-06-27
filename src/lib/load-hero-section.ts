import "server-only";

import { resolveHeroConfigLinks } from "./admin/links/hero-config";
import { getSupabaseAdmin } from "./supabase-admin";
import { logError } from "./logging";
import { MEDIA_TYPE_PATHS, type MediaContentType } from "./media-center";
import { supabase } from "./supabase";
import type {
  HeroSectionData,
  HeroSourceType,
  PageRecord,
  PageSectionRecord,
} from "./page-sections";

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
  is_visible: boolean;
  sort_order: number;
  config: Record<string, unknown> | null;
};

async function getPageBySlug(slug: string): Promise<PageRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("pages")
    .select("id,title,slug,path,page_type,status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logError("getPageBySlug failed", error, { slug });
    return null;
  }

  if (!data) return null;
  return data as PageRecord;
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
    is_visible: template.is_visible,
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
    "hero_templates(id,name,slug,variant,style_preset,source_type,source_id,source_slug,limit_count,is_visible,sort_order,config)";

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
    const template = byId.data.hero_templates as unknown as HeroTemplateRecord;
    return template.is_visible ? template : null;
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
    const template = byPath.data.hero_templates as unknown as HeroTemplateRecord;
    return template.is_visible ? template : null;
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
    let query = supabase
      .from("topics")
      .select("id,title,excerpt,image,slug,category")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (hero.source_type === "featured_topics") {
      query = query.eq("is_featured", true);
    }

    if (hero.source_type === "topic_category" && hero.source_slug) {
      query = query.eq("category_slug", hero.source_slug);
    }

    const { data } = await query;

    return (data ?? []).map((item: {
      id: number;
      title: string;
      excerpt: string | null;
      image: string | null;
      slug: string;
      category: string | null;
    }) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      href: `/topics/${item.slug}`,
      category: item.category,
    }));
  }

  if (
    hero.source_type === "latest_media" ||
    hero.source_type === "featured_media" ||
    hero.source_type === "media_category"
  ) {
    let query = supabase
      .from("media_items")
      .select("id,title,excerpt,image,slug,type,category")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (hero.source_type === "featured_media") {
      query = query.eq("is_featured", true);
    }

    if (hero.source_type === "media_category" && hero.source_slug) {
      query = query.eq("category_slug", hero.source_slug);
    }

    const { data } = await query;

    return (data ?? []).map((item: {
      id: number;
      title: string;
      excerpt: string | null;
      image: string | null;
      slug: string;
      type: string;
      category: string | null;
    }) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      image: item.image,
      href: `/media-center/${MEDIA_TYPE_PATHS[item.type as MediaContentType] ?? "news"}/${item.slug}`,
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
export async function getHeroSectionState(pageSlug: string): Promise<HeroSectionState> {
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
