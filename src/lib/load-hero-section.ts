import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { resolveHeroConfigLinks } from "./admin/links/hero-config";
import type { Json, Tables } from "./database.types";
import { isPageModulePubliclyVisible } from "./page-blocks/admin-utils";
import { getPublishedPageStateBySlug } from "./pages/get-published-page-by-slug";
import { getSupabaseAdmin } from "./supabase-admin";
import { logError } from "./logging";
import { getDefaultAssignmentPosition } from "./page-composition/page-assignment-contract";
import type { HeroDomainBackedTemplateVariant } from "./hero/hero-content-controls";
import type {
  HeroSectionData,
  HeroSourceType,
  PageRecord,
} from "./page-sections";

type JsonObject = Record<string, Json | undefined>;

type HeroTemplateRecord = {
  id: number;
  name: string;
  slug: string;
  variant: string;
  style_preset: string;
  status: "published" | "unpublished";
  is_visible: boolean;
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
  | "status"
  | "is_visible"
  | "sort_order"
  | "config"
>;

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
  if (!isHeroTemplateStatus(template.status)) {
    return null;
  }

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    variant: template.variant,
    style_preset: template.style_preset,
    status: template.status,
    is_visible: template.is_visible,
    sort_order: template.sort_order,
    config: isJsonObject(template.config) ? template.config : null,
  };
}

function templateToDomainBackedHeroSection(
  template: HeroTemplateRecord,
): HeroSectionData {
  return {
    id: template.id,
    page_id: 0,
    section_key: "hero",
    section_type: "hero",
    slot: getDefaultAssignmentPosition("hero"),
    variant: template.variant,
    style_preset: template.style_preset,
    source_type: "domain-backed",
    source_id: null,
    source_slug: null,
    limit_count: 1,
    is_visible: isPageModulePubliclyVisible(template.is_visible, template.status),
    sort_order: template.sort_order,
    config: template.config,
    page: null,
    template: {
      id: template.id,
      name: template.name,
      slug: template.slug,
    },
  };
}

export type DomainBackedHeroTemplateState = {
  hero: HeroSectionData | null;
  visibility: "visible" | "hidden" | "none" | "error";
  sourceIssue?: string;
};

async function queryDomainBackedHeroTemplateState(
  variant: HeroDomainBackedTemplateVariant,
): Promise<DomainBackedHeroTemplateState> {
  const { data, error } = await getSupabaseAdmin()
    .from("hero_templates")
    .select("id,name,slug,variant,style_preset,status,is_visible,sort_order,config")
    .eq("variant", variant)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(2);

  if (error) {
    logError("queryDomainBackedHeroTemplateState failed", error, { variant });
    return { hero: null, visibility: "error", sourceIssue: error.message };
  }
  if (!data?.length) return { hero: null, visibility: "none" };
  if (data.length > 1) {
    const sourceIssue = `Multiple Hero templates are configured for ${variant}.`;
    logError("queryDomainBackedHeroTemplateState is ambiguous", new Error(sourceIssue), {
      variant,
      templateIds: data.map((row) => row.id),
    });
    return { hero: null, visibility: "error", sourceIssue };
  }

  const template = mapHeroTemplateSelection(data[0]);
  if (!template) {
    const sourceIssue = `Hero template ${data[0].id} has an invalid publication status.`;
    logError("queryDomainBackedHeroTemplateState rejected invalid template", new Error(sourceIssue), {
      variant,
      templateId: data[0].id,
    });
    return { hero: null, visibility: "error", sourceIssue };
  }

  if (!isPageModulePubliclyVisible(template.is_visible, template.status)) {
    return { hero: null, visibility: "hidden" };
  }

  const hero = templateToDomainBackedHeroSection(template);
  hero.config = await resolveHeroConfigLinks(template.config);
  return { hero, visibility: "visible" };
}

/**
 * Loads presentation for a domain-backed Hero variant from the existing
 * hero_templates owner. Missing/error states deliberately fall back at the
 * consumer; an explicitly unpublished template remains hidden.
 */
export const getDomainBackedHeroTemplateState = cache(
  async function getDomainBackedHeroTemplateState(
    variant: HeroDomainBackedTemplateVariant,
  ): Promise<DomainBackedHeroTemplateState> {
    return unstable_cache(
      async () => queryDomainBackedHeroTemplateState(variant),
      ["domain-backed-hero-template-state", variant],
      { revalidate: 300, tags: ["hero"] },
    )();
  },
);

function templateToHeroSection(template: HeroTemplateRecord, page: PageRecord): HeroSectionData {
  return {
    id: template.id,
    page_id: page.id,
    section_key: "hero",
    section_type: "hero",
    slot: getDefaultAssignmentPosition("hero"),
    variant: template.variant,
    style_preset: template.style_preset,
    source_type: "manual" satisfies HeroSourceType,
    source_id: null,
    source_slug: null,
    limit_count: 1,
    is_visible: isPageModulePubliclyVisible(template.is_visible, template.status),
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

type AssignedHeroTemplateResult =
  | { status: "visible"; assignmentId: number; template: HeroTemplateRecord }
  | { status: "hidden"; assignmentId: number }
  | { status: "none" }
  | { status: "error"; issue: string };

function resolveAssignedHeroRow(
  row: {
    id: number;
    hero_templates: HeroTemplateSelection | HeroTemplateSelection[] | null;
  },
): AssignedHeroTemplateResult {
  const selectedTemplate = Array.isArray(row.hero_templates)
    ? (row.hero_templates[0] ?? null)
    : row.hero_templates;
  const template = selectedTemplate ? mapHeroTemplateSelection(selectedTemplate) : null;
  return isPageModulePubliclyVisible(template?.is_visible, template?.status) && template
    ? { status: "visible", assignmentId: row.id, template }
    : { status: "hidden", assignmentId: row.id };
}

async function getAssignedHeroTemplate(page: PageRecord): Promise<AssignedHeroTemplateResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const baseSelect =
    "id,hero_templates(id,name,slug,variant,style_preset,status,is_visible,sort_order,config)";

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
    return { status: "error", issue: byId.error.message };
  }
  if (byId.data) {
    return resolveAssignedHeroRow(byId.data);
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
    return { status: "error", issue: byPath.error.message };
  }
  if (byPath.data) {
    return resolveAssignedHeroRow(byPath.data);
  }

  return { status: "none" };
}

async function findHiddenHeroAssignment(
  page: PageRecord,
): Promise<{ status: "hidden"; assignmentId: number } | { status: "none" } | { status: "error"; issue: string }> {
  const supabaseAdmin = getSupabaseAdmin();

  const byId = await supabaseAdmin
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", page.id)
    .limit(1)
    .maybeSingle();

  if (byId.error) {
    logError("findHiddenHeroAssignment by id failed", byId.error, { pageId: page.id });
    return { status: "error", issue: byId.error.message };
  }
  if (byId.data) return { status: "hidden", assignmentId: byId.data.id };

  const byPath = await supabaseAdmin
    .from("hero_assignments")
    .select("id")
    .eq("target_type", "page")
    .eq("path", page.path)
    .limit(1)
    .maybeSingle();

  if (byPath.error) {
    logError("findHiddenHeroAssignment by path failed", byPath.error, { path: page.path });
    return { status: "error", issue: byPath.error.message };
  }
  return byPath.data
    ? { status: "hidden", assignmentId: byPath.data.id }
    : { status: "none" };
}

export type HeroSectionVisibility = "visible" | "hidden" | "none" | "error";

export type HeroSectionState = {
  hero: HeroSectionData | null;
  visibility: HeroSectionVisibility;
  assignmentId: number | null;
  hasAnyAssignmentRows: boolean;
  sourceIssue?: string;
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
  const pageState = await getPublishedPageStateBySlug(pageSlug);
  if (!pageState.page) {
    return pageState.sourceStatus === "error"
      ? {
          hero: null,
          visibility: "error",
          assignmentId: null,
          hasAnyAssignmentRows: false,
          sourceIssue: pageState.sourceIssue,
        }
      : {
          hero: null,
          visibility: "none",
          assignmentId: null,
          hasAnyAssignmentRows: false,
        };
  }

  const assignedTemplate = await getAssignedHeroTemplate(pageState.page);
  if (assignedTemplate.status === "error") {
    return {
      hero: null,
      visibility: "error",
      assignmentId: null,
      hasAnyAssignmentRows: false,
      sourceIssue: assignedTemplate.issue,
    };
  }
  if (assignedTemplate.status === "visible") {
    const hero = await templateToHeroSectionResolved(assignedTemplate.template, pageState.page);
    return {
      hero,
      visibility: "visible",
      assignmentId: assignedTemplate.assignmentId,
      hasAnyAssignmentRows: true,
    };
  }
  if (assignedTemplate.status === "hidden") {
    return {
      hero: null,
      visibility: "hidden",
      assignmentId: assignedTemplate.assignmentId,
      hasAnyAssignmentRows: true,
    };
  }

  const hiddenAssignment = await findHiddenHeroAssignment(pageState.page);
  if (hiddenAssignment.status === "error") {
    return {
      hero: null,
      visibility: "error",
      assignmentId: null,
      hasAnyAssignmentRows: false,
      sourceIssue: hiddenAssignment.issue,
    };
  }
  if (hiddenAssignment.status === "hidden") {
    return {
      hero: null,
      visibility: "hidden",
      assignmentId: hiddenAssignment.assignmentId,
      hasAnyAssignmentRows: true,
    };
  }

  return {
    hero: null,
    visibility: "none",
    assignmentId: null,
    hasAnyAssignmentRows: false,
  };
}

/**
 * Resolves hero from hero_assignments + hero_templates only.
 * Returns null when no active visible assignment exists — no static or page_sections fallback.
 */
export async function getHeroSectionByPageSlug(pageSlug: string): Promise<HeroSectionData | null> {
  const state = await getHeroSectionState(pageSlug);
  return state.hero;
}
