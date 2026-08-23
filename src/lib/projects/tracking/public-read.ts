import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { logError, logWarnWithError } from "../../logging";
import { getSupabaseAdmin } from "../../supabase-admin";
import { loadProjectBySlugResult } from "../load-published-projects";
import {
  deriveProjectTrackingStageStatus,
  projectLocationPresentationReadSchema,
  projectTrackingPublicDetailSchema,
  projectTrackingReadInputSchema,
  type ProjectTrackingPageInfo,
  type ProjectTrackingPublicDetail,
  type ProjectTrackingReadInput,
  type ProjectTrackingStatus,
} from "./contract";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRACKING_PUBLIC_READ_VERSION = "project-tracking-detail-v4-location-presentation";
const TRACKING_PUBLIC_RPC = "project_tracking_public_detail_v1";
const TRACKING_PUBLIC_RPC_SIGNATURE =
  "public.project_tracking_public_detail_v1(text)";

const PAGE_SIZES = {
  stages: 6,
  items: 6,
  updates: 4,
  media: 8,
  history: 3,
} as const;

const countRelationSchema = z.array(
  z.object({ count: z.coerce.number().int().nonnegative() }),
);
const coreSchema = z.object({
  project: z.object({
    id: z.coerce.number().int().positive(),
    slug: z.string().min(1),
    code: z.string().nullable(),
    type: z.enum(["residential", "commercial"]),
    arabicName: z.string().min(1),
    englishName: z.string().nullable(),
    location: z.string().nullable(),
    locationPresentation: projectLocationPresentationReadSchema,
    heroImage: z.string().nullable(),
    heroImageAlt: z.string().nullable(),
  }),
  profile: z
    .object({
      projectReceiptDate: z.string().nullable(),
      licenseReceiptDate: z.string().nullable(),
      contractorName: z.string().nullable(),
    })
    .nullable(),
  latestUpdate: z
    .object({
      id: z.coerce.number().int().positive(),
      itemId: z.coerce.number().int().positive(),
      stageId: z.coerce.number().int().positive(),
      occurredAt: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      publishedAt: z.string().min(1).nullable().optional(),
    })
    .nullable(),
  latestVisual: z.string().nullable(),
  counts: z.object({
    updates: z.coerce.number().int().nonnegative(),
    images: z.coerce.number().int().nonnegative(),
    videos: z.coerce.number().int().nonnegative(),
    stages: z.coerce.number().int().nonnegative(),
  }),
});
const stageStatusRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  sort_order: z.coerce.number().int().nonnegative(),
  project_tracking_items: z.array(
    z.object({ status: z.enum(["not_started", "in_progress", "completed"]) }),
  ),
});
const stageRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  project_id: z.coerce.number().int().positive(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  start_date: z.string().nullable(),
  planned_duration_value: z.coerce.number().int().positive().nullable(),
  planned_duration_unit: z.enum(["day", "week", "month"]).nullable(),
});
const itemRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  stage_id: z.coerce.number().int().positive(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
  status: z.enum(["not_started", "in_progress", "completed"]),
  start_date: z.string().nullable(),
  completion_date: z.string().nullable(),
  project_tracking_updates: countRelationSchema,
});
const updateRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  item_id: z.coerce.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  occurred_at: z.string().min(1),
  published_at: z.string().nullable(),
});
const historyRowSchema = updateRowSchema.extend({
  project_tracking_items: z.object({
    stage_id: z.coerce.number().int().positive(),
  }),
});
const mediaRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  media_kind: z.enum(["image", "video"]),
  public_url: z.string().min(1),
  poster_url: z.string().nullable(),
  title: z.string().nullable(),
  sort_order: z.coerce.number().int().nonnegative(),
});

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
    (code === "PGRST202" && diagnostic.includes(TRACKING_PUBLIC_RPC)) ||
    code === "PGRST205" ||
    code === "42P01"
  );
}

function failPublicRead(error: unknown, operation: string): never {
  if (isPendingTrackingSchemaDependency(error)) {
    throw new PendingTrackingSchemaDependencyError(error);
  }
  logError("Project Tracking public read failed", error, {
    source: "projects.tracking.public-read",
    operation,
  });
  throw new Error(
    "تعذر تحميل بيانات متابعة المشروع حاليًا.",
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

function pageInfo(
  requestedPage: number,
  pageSize: number,
  totalRows: number,
): ProjectTrackingPageInfo {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  return {
    page: Math.min(requestedPage, totalPages),
    pageSize,
    totalRows,
    totalPages,
  };
}

function rangeFor(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function toPublicUpdate(
  row: z.infer<typeof updateRowSchema>,
  stageId: number,
) {
  return {
    id: row.id,
    itemId: row.item_id,
    stageId,
    occurredAt: row.occurred_at,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
    mediaCount: 0,
    media: [],
  };
}

async function queryProjectTrackingDetail(
  slug: string,
  rawInput: ProjectTrackingReadInput,
): Promise<ProjectTrackingDetailReadResult> {
  if (!SLUG_PATTERN.test(slug)) return { status: "not_found" };
  const hasExplicitStagePage = rawInput.stagePage !== undefined;
  const input = projectTrackingReadInputSchema.parse(rawInput);
  const supabase = getSupabaseAdmin();
  const coreResult = await supabase.rpc(TRACKING_PUBLIC_RPC, { p_slug: slug });
  if (coreResult.error) failPublicRead(coreResult.error, TRACKING_PUBLIC_RPC);
  if (coreResult.data === null) return { status: "not_found" };
  const core = coreSchema.parse(coreResult.data);

  const historyPage = pageInfo(
    input.historyPage,
    PAGE_SIZES.history,
    core.counts.updates,
  );
  const historyRange = rangeFor(historyPage.page, historyPage.pageSize);
  const historyPromise = supabase
    .from("project_tracking_updates")
    .select(
      "id,item_id,title,body,occurred_at,published_at,project_tracking_items!inner(stage_id,project_tracking_stages!inner(project_id))",
    )
    .eq("publication_status", "published")
    .eq("project_tracking_items.is_visible", true)
    .eq("project_tracking_items.project_tracking_stages.is_visible", true)
    .eq(
      "project_tracking_items.project_tracking_stages.project_id",
      core.project.id,
    )
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(historyRange.from, historyRange.to);

  const statusResult = await supabase
    .from("project_tracking_stages")
    .select("id,sort_order,project_tracking_items(status)")
    .eq("project_id", core.project.id)
    .eq("is_visible", true)
    .eq("project_tracking_items.is_visible", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (statusResult.error) {
    failPublicRead(statusResult.error, "stage_status_summary");
  }
  const stageStatusRows = z.array(stageStatusRowSchema).parse(
    statusResult.data ?? [],
  );
  const stageStatuses = new Map<number, ProjectTrackingStatus>(
    stageStatusRows.map((stage) => [
      stage.id,
      deriveProjectTrackingStageStatus(
        stage.project_tracking_items.map((item) => item.status),
      ),
    ]),
  );
  const currentStageId =
    core.latestUpdate?.stageId ??
    [...stageStatusRows]
      .sort((left, right) => {
        const leftStatus = stageStatuses.get(left.id)!;
        const rightStatus = stageStatuses.get(right.id)!;
        const priority = { in_progress: 0, not_started: 1, completed: 2 };
        const statusDelta = priority[leftStatus] - priority[rightStatus];
        if (statusDelta !== 0) return statusDelta;
        if (leftStatus === "completed" && rightStatus === "completed") {
          return right.sort_order - left.sort_order;
        }
        return left.sort_order - right.sort_order || left.id - right.id;
      })[0]?.id ??
    null;

  const requestedStageId =
    input.stageId && stageStatuses.has(input.stageId) ? input.stageId : null;
  const requestedStageIndex = requestedStageId
    ? stageStatusRows.findIndex((stage) => stage.id === requestedStageId)
    : -1;
  const requestedStagePage = requestedStageIndex >= 0
      ? Math.floor(requestedStageIndex / PAGE_SIZES.stages) + 1
      : !hasExplicitStagePage && currentStageId
        ? Math.floor(
            stageStatusRows.findIndex((stage) => stage.id === currentStageId) /
              PAGE_SIZES.stages,
          ) + 1
        : input.stagePage;
  const stagesPage = pageInfo(
    requestedStagePage,
    PAGE_SIZES.stages,
    stageStatusRows.length,
  );
  const stageRange = rangeFor(stagesPage.page, stagesPage.pageSize);
  const stagesResult = await supabase
    .from("project_tracking_stages")
    .select(
      "id,project_id,name,description,sort_order,start_date,planned_duration_value,planned_duration_unit",
    )
    .eq("project_id", core.project.id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .range(stageRange.from, stageRange.to);
  if (stagesResult.error) failPublicRead(stagesResult.error, "stages_page");
  const stageRows = z.array(stageRowSchema).parse(stagesResult.data ?? []);
  const selectedStageRow =
    stageRows.find((stage) => stage.id === requestedStageId) ??
    stageRows[0] ??
    null;
  const currentStageResult =
    currentStageId && !stageRows.some((stage) => stage.id === currentStageId)
      ? await supabase
          .from("project_tracking_stages")
          .select(
            "id,project_id,name,description,sort_order,start_date,planned_duration_value,planned_duration_unit",
          )
          .eq("id", currentStageId)
          .eq("project_id", core.project.id)
          .eq("is_visible", true)
          .maybeSingle()
      : { data: null, error: null };
  if (currentStageResult.error) {
    failPublicRead(currentStageResult.error, "current_stage_summary");
  }
  const currentStageRow =
    stageRows.find((stage) => stage.id === currentStageId) ??
    (currentStageResult.data
      ? stageRowSchema.parse(currentStageResult.data)
      : null);

  const itemsPage = pageInfo(
    input.itemPage,
    PAGE_SIZES.items,
    stageStatusRows.find((stage) => stage.id === selectedStageRow?.id)
      ?.project_tracking_items.length ?? 0,
  );
  const itemRange = rangeFor(itemsPage.page, itemsPage.pageSize);
  const itemsResult = selectedStageRow
    ? await supabase
        .from("project_tracking_items")
        .select(
          "id,stage_id,name,description,sort_order,status,start_date,completion_date,project_tracking_updates(count)",
        )
        .eq("stage_id", selectedStageRow.id)
        .eq("is_visible", true)
        .eq("project_tracking_updates.publication_status", "published")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(itemRange.from, itemRange.to)
    : { data: [], error: null };
  if (itemsResult.error) failPublicRead(itemsResult.error, "items_page");
  const itemRows = z.array(itemRowSchema).parse(itemsResult.data ?? []);
  const selectedItemRow =
    itemRows.find((item) => item.id === input.itemId) ?? itemRows[0] ?? null;

  const updatesPage = pageInfo(
    input.updatePage,
    PAGE_SIZES.updates,
    selectedItemRow?.project_tracking_updates[0]?.count ?? 0,
  );
  const updateRange = rangeFor(updatesPage.page, updatesPage.pageSize);
  const updatesResult = selectedItemRow
    ? await supabase
        .from("project_tracking_updates")
        .select("id,item_id,title,body,occurred_at,published_at")
        .eq("item_id", selectedItemRow.id)
        .eq("publication_status", "published")
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(updateRange.from, updateRange.to)
    : { data: [], error: null };
  if (updatesResult.error) failPublicRead(updatesResult.error, "updates_page");
  const updateRows = z.array(updateRowSchema).parse(updatesResult.data ?? []);
  const selectedUpdateRow =
    updateRows.find((update) => update.id === input.updateId) ??
    updateRows[0] ??
    null;

  const mediaCountResult = selectedUpdateRow
    ? await supabase
        .from("project_tracking_update_media")
        .select("id", { count: "exact", head: true })
        .eq("update_id", selectedUpdateRow.id)
    : { count: 0, error: null };
  if (mediaCountResult.error) {
    failPublicRead(mediaCountResult.error, "media_page_count");
  }
  const mediaPage = pageInfo(
    input.mediaPage,
    PAGE_SIZES.media,
    mediaCountResult.count ?? 0,
  );
  const mediaRange = rangeFor(mediaPage.page, mediaPage.pageSize);
  const mediaResult = selectedUpdateRow
    ? await supabase
        .from("project_tracking_update_media")
        .select("id,media_kind,public_url,poster_url,title,sort_order")
        .eq("update_id", selectedUpdateRow.id)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(mediaRange.from, mediaRange.to)
    : { data: [], error: null };
  if (mediaResult.error) failPublicRead(mediaResult.error, "media_page");
  const mediaRows = z.array(mediaRowSchema).parse(mediaResult.data ?? []);

  const historyResult = await historyPromise;
  if (historyResult.error) failPublicRead(historyResult.error, "history_page");
  const historyRows = z.array(historyRowSchema).parse(
    historyResult.data ?? [],
  );

  const media = mediaRows.map((row) => ({
    id: row.id,
    kind: row.media_kind,
    url: row.public_url,
    posterUrl: row.poster_url,
    title: row.title,
    sortOrder: row.sort_order,
  }));
  const updates = updateRows.map((row) => {
    const update = toPublicUpdate(row, selectedStageRow?.id ?? 0);
    return row.id === selectedUpdateRow?.id
      ? { ...update, mediaCount: mediaCountResult.count ?? 0, media }
      : update;
  });
  const items = itemRows.map((row) => ({
    id: row.id,
    stageId: row.stage_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    startDate: row.start_date,
    completionDate: row.completion_date,
    updateCount: row.project_tracking_updates[0]?.count ?? 0,
    updates: row.id === selectedItemRow?.id ? updates : [],
  }));
  const stages = stageRows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    startDate: row.start_date,
    plannedDuration:
      row.planned_duration_value && row.planned_duration_unit
        ? {
            value: row.planned_duration_value,
            unit: row.planned_duration_unit,
          }
        : null,
    status: stageStatuses.get(row.id) ?? "not_started",
    itemCount:
      stageStatusRows.find((stage) => stage.id === row.id)
        ?.project_tracking_items.length ?? 0,
    items: row.id === selectedStageRow?.id ? items : [],
  }));
  const currentStage = currentStageRow
    ? {
        id: currentStageRow.id,
        projectId: currentStageRow.project_id,
        name: currentStageRow.name,
        description: currentStageRow.description,
        sortOrder: currentStageRow.sort_order,
        startDate: currentStageRow.start_date,
        plannedDuration:
          currentStageRow.planned_duration_value &&
          currentStageRow.planned_duration_unit
            ? {
                value: currentStageRow.planned_duration_value,
                unit: currentStageRow.planned_duration_unit,
              }
            : null,
        status: stageStatuses.get(currentStageRow.id) ?? "not_started",
        itemCount:
          stageStatusRows.find((stage) => stage.id === currentStageRow.id)
            ?.project_tracking_items.length ?? 0,
        items: [],
      }
    : null;
  const latestUpdate = core.latestUpdate
    ? {
        ...core.latestUpdate,
        mediaCount: 0,
        media: [],
      }
    : null;
  const detail = projectTrackingPublicDetailSchema.parse({
    project: core.project,
    profile: core.profile,
    stages,
    history: historyRows.map((row) =>
      toPublicUpdate(row, row.project_tracking_items.stage_id),
    ),
    latestUpdate,
    currentStage,
    currentStageId,
    selectedStageId: selectedStageRow?.id ?? null,
    selectedItemId: selectedItemRow?.id ?? null,
    selectedUpdateId: selectedUpdateRow?.id ?? null,
    latestVisual: core.latestVisual,
    pagination: {
      stages: stagesPage,
      items: itemsPage,
      updates: updatesPage,
      media: mediaPage,
      history: historyPage,
    },
    counts: {
      ...core.counts,
      completedStages: [...stageStatuses.values()].filter(
        (status) => status === "completed",
      ).length,
    },
  });
  return { status: "ready", detail };
}

export const loadProjectTrackingDetail = cache(
  async function loadProjectTrackingDetail(
    slug: string,
    input: ProjectTrackingReadInput = {},
  ) {
    const normalizedInput = projectTrackingReadInputSchema.parse(input);
    const cacheInput = JSON.stringify(normalizedInput);
    try {
      return await unstable_cache(
        () => queryProjectTrackingDetail(slug, normalizedInput),
        [
          "project-tracking-public-detail",
          TRACKING_PUBLIC_READ_VERSION,
          slug,
          cacheInput,
        ],
        {
          revalidate: 300,
          tags: [
            "projects",
            "project-tracking",
            `project-tracking:${slug}`,
          ],
        },
      )();
    } catch (error) {
      if (error instanceof PendingTrackingSchemaDependencyError) {
        return resolvePendingSchemaResult(slug, error.dependencyError);
      }
      throw error;
    }
  },
);
