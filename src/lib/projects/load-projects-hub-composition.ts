import "server-only";

import { unstable_cache } from "next/cache";

import { getPublicPageRoute } from "../admin/links/static-routes";
import type { Json } from "../database.types";
import { normalizeBoolean } from "../page-blocks/admin-utils";
import { normalizeLayoutSlot, type PageLayoutSlot } from "../page-blocks/layout-slots";
import { logError } from "../logging";
import {
  getPublishedPageStateBySlug,
  toPublicPageIdentity,
  type PublicPageIdentity,
} from "../pages/get-published-page-by-slug";
import { getSupabaseAdmin } from "../supabase-admin";

const PROJECTS_HUB_PAGE_IDENTITY = getPublicPageRoute("projects");

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
  pageIdentity: PublicPageIdentity;
  assignments: ProjectsHubCompositionAssignment[];
};

export type ProjectsHubCompositionLoadResult =
  | { status: "ready"; ok: true; composition: ProjectsHubComposition }
  | { status: "unavailable"; ok: false; reason: "page_unavailable" }
  | {
      status: "error";
      ok: false;
      reason: ProjectsHubCompositionReadFailureReason | "unexpected_error";
    };

export type ProjectsHubCompositionReadFailureReason =
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
  const pageState = await getPublishedPageStateBySlug(
    PROJECTS_HUB_PAGE_IDENTITY.cmsPageSlug,
  );
  if (pageState.sourceStatus === "error") {
    failProjectsHubCompositionRead(
      "page_query_failed",
      "loadProjectsHubComposition: published page lookup failed",
      new Error(pageState.sourceIssue ?? "Published page query failed."),
    );
  }

  if (!pageState.page) {
    return { status: "unavailable", ok: false, reason: "page_unavailable" };
  }
  const pageIdentity = toPublicPageIdentity(pageState.page);
  const supabase = getSupabaseAdmin();

  const { data: rows, error: assignmentError } = await supabase
    .from("page_content_block_assignments")
    .select(
      "id,page_id,template_id,slot,sort_order,is_visible,content_block_templates(id,slug,variant,status,config)",
    )
    .eq("page_id", pageIdentity.id)
    .order("sort_order", { ascending: true });

  if (assignmentError) {
    failProjectsHubCompositionRead(
      "assignments_query_failed",
      "loadProjectsHubComposition: assignments failed",
      assignmentError,
      { pageId: pageIdentity.id },
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
    status: "ready",
    ok: true,
    composition: {
      pageIdentity,
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
      return { status: "error", ok: false, reason: error.reason };
    }
    logError("loadProjectsHubComposition: unexpected failure", error);
    return { status: "error", ok: false, reason: "unexpected_error" };
  }
}
