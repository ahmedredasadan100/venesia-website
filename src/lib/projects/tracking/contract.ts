import { z } from "zod";

export const PROJECT_TRACKING_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export type ProjectTrackingStatus = (typeof PROJECT_TRACKING_STATUSES)[number];

/** Single Stage Status derivation contract used by Admin and Public reads. */
export function deriveProjectTrackingStageStatus(
  statuses: readonly ProjectTrackingStatus[],
): ProjectTrackingStatus {
  if (statuses.length === 0) return "not_started";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status !== "not_started")) {
    return "in_progress";
  }
  return "not_started";
}

export const projectTrackingMediaReferenceSchema = z.string().trim().min(1).refine(
  (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
  "Invalid media reference",
);

export const projectTrackingMediaSchema = z.object({
  id: z.coerce.number().int().positive(),
  kind: z.enum(["image", "video"]),
  url: projectTrackingMediaReferenceSchema,
  posterUrl: projectTrackingMediaReferenceSchema.nullable(),
  title: z.string().nullable(),
  sortOrder: z.coerce.number().int().nonnegative(),
});
export type ProjectTrackingMedia = z.infer<typeof projectTrackingMediaSchema>;

export const projectTrackingUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
  stageId: z.coerce.number().int().positive(),
  occurredAt: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  publishedAt: z.string().min(1).nullable().optional(),
  mediaCount: z.coerce.number().int().nonnegative().default(0),
  media: z.array(projectTrackingMediaSchema),
});
export type ProjectTrackingUpdate = z.infer<typeof projectTrackingUpdateSchema>;

export const projectTrackingItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  stageId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sortOrder: z.coerce.number().int().nonnegative(),
  status: z.enum(PROJECT_TRACKING_STATUSES),
  startDate: z.string().nullable(),
  completionDate: z.string().nullable(),
  updateCount: z.coerce.number().int().nonnegative().default(0),
  updates: z.array(projectTrackingUpdateSchema),
});
export type ProjectTrackingItem = z.infer<typeof projectTrackingItemSchema>;

export const projectTrackingStageSchema = z.object({
  id: z.coerce.number().int().positive(),
  projectId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sortOrder: z.coerce.number().int().nonnegative(),
  startDate: z.string().nullable(),
  plannedDuration: z.object({
    value: z.coerce.number().int().positive(),
    unit: z.enum(["day", "week", "month"]),
  }).nullable(),
  status: z.enum(PROJECT_TRACKING_STATUSES),
  itemCount: z.coerce.number().int().nonnegative().default(0),
  items: z.array(projectTrackingItemSchema),
});
export type ProjectTrackingStage = z.infer<typeof projectTrackingStageSchema>;

export const projectTrackingPageInfoSchema = z.object({
  page: z.coerce.number().int().positive(),
  pageSize: z.coerce.number().int().positive(),
  totalRows: z.coerce.number().int().nonnegative(),
  totalPages: z.coerce.number().int().positive(),
});
export type ProjectTrackingPageInfo = z.infer<
  typeof projectTrackingPageInfoSchema
>;

export const projectTrackingReadInputSchema = z.object({
  stagePage: z.coerce.number().int().positive().max(10_000).default(1),
  itemPage: z.coerce.number().int().positive().max(10_000).default(1),
  updatePage: z.coerce.number().int().positive().max(10_000).default(1),
  mediaPage: z.coerce.number().int().positive().max(10_000).default(1),
  historyPage: z.coerce.number().int().positive().max(10_000).default(1),
  stageId: z.coerce.number().int().positive().optional(),
  itemId: z.coerce.number().int().positive().optional(),
  updateId: z.coerce.number().int().positive().optional(),
});
export type ProjectTrackingReadInput = z.input<
  typeof projectTrackingReadInputSchema
>;

export const projectTrackingPublicDetailSchema = z.object({
  project: z.object({
    id: z.coerce.number().int().positive(),
    slug: z.string().min(1),
    code: z.string().nullable(),
    type: z.enum(["residential", "commercial"]),
    arabicName: z.string().min(1),
    englishName: z.string().nullable(),
    location: z.string().nullable(),
    heroImage: z.string().nullable(),
    heroImageAlt: z.string().nullable(),
  }),
  profile: z.object({
    projectReceiptDate: z.string().nullable(),
    licenseReceiptDate: z.string().nullable(),
    contractorName: z.string().nullable(),
  }).nullable(),
  stages: z.array(projectTrackingStageSchema),
  history: z.array(projectTrackingUpdateSchema),
  latestUpdate: projectTrackingUpdateSchema.nullable(),
  currentStage: projectTrackingStageSchema.nullable(),
  currentStageId: z.coerce.number().int().positive().nullable(),
  selectedStageId: z.coerce.number().int().positive().nullable(),
  selectedItemId: z.coerce.number().int().positive().nullable(),
  selectedUpdateId: z.coerce.number().int().positive().nullable(),
  latestVisual: z.string().nullable(),
  pagination: z.object({
    stages: projectTrackingPageInfoSchema,
    items: projectTrackingPageInfoSchema,
    updates: projectTrackingPageInfoSchema,
    media: projectTrackingPageInfoSchema,
    history: projectTrackingPageInfoSchema,
  }),
  counts: z.object({
    updates: z.coerce.number().int().nonnegative(),
    images: z.coerce.number().int().nonnegative(),
    videos: z.coerce.number().int().nonnegative(),
    stages: z.coerce.number().int().nonnegative(),
    completedStages: z.coerce.number().int().nonnegative(),
  }),
});
export type ProjectTrackingPublicDetail = z.infer<
  typeof projectTrackingPublicDetailSchema
>;

export function projectTrackingStatusLabel(status: ProjectTrackingStatus) {
  if (status === "completed") return "مكتمل";
  if (status === "in_progress") return "جاري التنفيذ";
  return "لم يبدأ";
}
