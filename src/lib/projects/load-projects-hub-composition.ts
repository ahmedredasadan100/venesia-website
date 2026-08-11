import "server-only";

import { unstable_cache } from "next/cache";

import { PUBLIC_CONTENT_VISIBILITY_CONTRACT } from "../content-public-visibility";
import { normalizeBoolean } from "../page-blocks/admin-utils";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";

export const PROJECTS_HUB_PAGE_SLUG = "projects" as const;

export type ProjectsHubCompositionAssignment = {
  assignmentId: number;
  templateId: number;
  slot: string;
  sortOrder: number;
  isVisible: boolean;
  templateSlug: string;
  templateVariant: string;
  templateStatus: string;
  /** Raw template config JSON — parse with Phase 2 projects-hub parsers only. */
  config: unknown;
};

export type ProjectsHubComposition = {
  pageId: number;
  pageSlug: string;
  pagePath: string | null;
  assignments: ProjectsHubCompositionAssignment[];
};

export type ProjectsHubCompositionLoadResult =
  | { ok: true; composition: ProjectsHubComposition }
  | { ok: false; reason: string };

async function queryProjectsHubComposition(): Promise<ProjectsHubCompositionLoadResult> {
  const supabase = getSupabaseAdmin();

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,path,status")
    .eq("slug", PROJECTS_HUB_PAGE_SLUG)
    .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
    .maybeSingle();

  if (pageError) {
    logError("loadProjectsHubComposition: page lookup failed", pageError);
    return { ok: false, reason: "page_query_failed" };
  }

  if (!page) {
    return { ok: false, reason: "page_missing" };
  }

  const { data: rows, error: assignmentError } = await supabase
    .from("page_content_block_assignments")
    .select(
      "id,page_id,template_id,slot,sort_order,is_visible,content_block_templates(id,slug,variant,status,config)",
    )
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true });

  if (assignmentError) {
    logError("loadProjectsHubComposition: assignments failed", assignmentError, { pageId: page.id });
    return { ok: false, reason: "assignments_query_failed" };
  }

  const assignments: ProjectsHubCompositionAssignment[] = [];

  for (const row of rows ?? []) {
    const templateRaw = row.content_block_templates;
    const template = Array.isArray(templateRaw) ? templateRaw[0] : templateRaw;
    if (!template || typeof template !== "object") continue;

    const templateRecord = template as {
      id: number;
      slug: string;
      variant: string;
      status: string;
      config: unknown;
    };

    assignments.push({
      assignmentId: row.id,
      templateId: templateRecord.id,
      slot: row.slot ?? "main",
      sortOrder: row.sort_order ?? 0,
      isVisible: normalizeBoolean(row.is_visible, true),
      templateSlug: templateRecord.slug,
      templateVariant: templateRecord.variant,
      templateStatus: templateRecord.status,
      config: templateRecord.config,
    });
  }

  return {
    ok: true,
    composition: {
      pageId: page.id,
      pageSlug: page.slug,
      pagePath: page.path,
      assignments,
    },
  };
}

/** Loads Projects Hub page + content assignments. Never throws for public consumers. */
export async function loadProjectsHubComposition(): Promise<ProjectsHubCompositionLoadResult> {
  try {
    return await unstable_cache(queryProjectsHubComposition, ["projects-hub-composition"], {
      revalidate: 300,
      tags: ["page-composition", "page-blocks", "projects-hub"],
    })();
  } catch (error) {
    logError("loadProjectsHubComposition: unexpected failure", error);
    return { ok: false, reason: "unexpected_error" };
  }
}
