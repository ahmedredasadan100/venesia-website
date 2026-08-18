import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { logError, logWarnWithError } from "../../logging";
import { getSupabaseAdmin } from "../../supabase-admin";
import { loadProjectBySlugResult } from "../load-published-projects";
import {
  projectTrackingPublicDetailSchema,
  type ProjectTrackingPublicDetail,
} from "./contract";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRACKING_PUBLIC_READ_VERSION = "project-tracking-detail-v2";
const TRACKING_PUBLIC_RPC = "project_tracking_public_detail_v1";
const TRACKING_PUBLIC_RPC_SIGNATURE =
  "public.project_tracking_public_detail_v1(text)";

export type ProjectTrackingDetailReadResult =
  | { status: "ready"; detail: ProjectTrackingPublicDetail }
  | { status: "not_found" }
  | {
      status: "unavailable";
      project: { slug: string; arabicName: string };
    };

class PendingTrackingSchemaDependencyError extends Error {
  readonly dependencyError: unknown;

  constructor(dependencyError: unknown) {
    super("Project Tracking schema dependency is unavailable.");
    this.name = "PendingTrackingSchemaDependencyError";
    this.dependencyError = dependencyError;
  }
}

function errorText(error: unknown, field: "code" | "message" | "details") {
  if (!error || typeof error !== "object") return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function isPendingTrackingSchemaDependency(error: unknown) {
  const code = errorText(error, "code");
  const diagnostic = `${errorText(error, "message")} ${errorText(error, "details")}`;
  return (
    code === "PGRST202" &&
    diagnostic.includes(TRACKING_PUBLIC_RPC)
  );
}

async function resolvePendingSchemaResult(
  slug: string,
  error: unknown,
): Promise<ProjectTrackingDetailReadResult> {
  const projectResult = await loadProjectBySlugResult(slug);
  if (projectResult.status !== "ok") return { status: "not_found" };

  logWarnWithError("Project Tracking schema dependency unavailable", error, {
    source: "projects.tracking.public-read",
    operation: TRACKING_PUBLIC_RPC,
    dependency: TRACKING_PUBLIC_RPC_SIGNATURE,
    classification: "known_pending_schema_dependency",
    slug,
  });
  return {
    status: "unavailable",
    project: {
      slug: projectResult.project.slug,
      arabicName: projectResult.project.arabicName,
    },
  };
}

async function queryProjectTrackingDetail(
  slug: string,
): Promise<ProjectTrackingDetailReadResult> {
  if (!SLUG_PATTERN.test(slug)) return { status: "not_found" };
  const { data, error } = await getSupabaseAdmin().rpc(
    TRACKING_PUBLIC_RPC,
    { p_slug: slug },
  );
  if (error) {
    if (isPendingTrackingSchemaDependency(error)) {
      throw new PendingTrackingSchemaDependencyError(error);
    }
    logError("Project Tracking public aggregate query failed", error, {
      source: "projects.tracking.public-read",
      operation: TRACKING_PUBLIC_RPC,
      dependency: TRACKING_PUBLIC_RPC_SIGNATURE,
      slug,
    });
    throw new Error("تعذر تحميل بيانات متابعة المشروع حاليًا.");
  }
  if (data === null) return { status: "not_found" };
  try {
    return {
      status: "ready",
      detail: projectTrackingPublicDetailSchema.parse(data),
    };
  } catch (error) {
    logError("Project Tracking public aggregate contract validation failed", error, {
      source: "projects.tracking.public-read",
      operation: TRACKING_PUBLIC_RPC,
      dependency: TRACKING_PUBLIC_RPC_SIGNATURE,
      slug,
    });
    throw error;
  }
}

export const loadProjectTrackingDetail = cache(async function loadProjectTrackingDetail(
  slug: string,
) {
  try {
    return await unstable_cache(
      () => queryProjectTrackingDetail(slug),
      ["project-tracking-public-detail", TRACKING_PUBLIC_READ_VERSION, slug],
      { revalidate: 300, tags: ["projects", "project-tracking", `project-tracking:${slug}`] },
    )();
  } catch (error) {
    if (error instanceof PendingTrackingSchemaDependencyError) {
      return resolvePendingSchemaResult(slug, error.dependencyError);
    }
    throw error;
  }
});
