import "server-only";

import { unstable_cache } from "next/cache";

import type { Json } from "../database.types";
import { normalizeBoolean } from "../page-blocks/admin-utils";
import { normalizeLayoutSlot, type PageLayoutSlot } from "../page-blocks/layout-slots";
import { logError } from "../logging";
import { getSupabaseAdmin } from "../supabase-admin";

export const PROJECTS_HUB_PAGE_SLUG = "projects" as const;

export type ProjectsHubCompositionAssignment = {
  assignmentId: number;
  templateId: number;
  slot: PageLayoutSlot;
  sortOrder: number;
  isVisible: boolean;
  templateSlug: string;
  templateVariant: string;
  templateStatus: string;
  /** Raw template config JSON — parse with Phase 2 projects-hub parsers only. */
  config: Json;
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

type ProjectsHubCompositionReadFailureReason =
  | "page_query_failed"
  | "assignments_query_failed";

class ProjectsHubCompositionReadError extends Error {
  readonly reason: ProjectsHubCompositionReadFailureReason;

  constructor(reason: ProjectsHubCompositionReadFailureReason, cause: unknown) {
    super(`Projects Hub composition read failed: ${reason}`, { cause });
    this.name = "ProjectsHubCompositionReadError";
    this.reason = reason;
  }
}

function failProjectsHubCompositionRead(
  reason: ProjectsHubCompositionReadFailureReason,
  context: string,
  error: unknown,
  details: Record<string, unknown> = {},
): never {
  logError(context, error, details);
  throw new ProjectsHubCompositionReadError(reason, error);
}

async function queryProjectsHubComposition(): Promise<ProjectsHubCompositionLoadResult> {
  const supabase = getSupabaseAdmin();

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,path,status")
    .eq("slug", PROJECTS_HUB_PAGE_SLUG)
    .eq("status", "published")
    .maybeSingle();

  if (pageError) {
    failProjectsHubCompositionRead(
      "page_query_failed",
      "loadProjectsHubComposition: page lookup failed",
      pageError,
    );
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
    failProjectsHubCompositionRead(
      "assignments_query_failed",
      "loadProjectsHubComposition: assignments failed",
      assignmentError,
      { pageId: page.id },
    );
  }

  const assignments: ProjectsHubCompositionAssignment[] = [];

  for (const row of rows ?? []) {
    const template = row.content_block_templates;
    if (!template) continue;

    assignments.push({
      assignmentId: row.id,
      templateId: template.id,
      slot: normalizeLayoutSlot(row.slot),
      sortOrder: row.sort_order ?? 0,
      isVisible: normalizeBoolean(row.is_visible, true),
      templateSlug: template.slug,
      templateVariant: template.variant,
      templateStatus: template.status,
      config: template.config,
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
    if (error instanceof ProjectsHubCompositionReadError) {
      return { ok: false, reason: error.reason };
    }
    logError("loadProjectsHubComposition: unexpected failure", error);
    return { ok: false, reason: "unexpected_error" };
  }
}
