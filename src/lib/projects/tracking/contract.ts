import { z } from "zod";

export const PROJECT_TRACKING_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export type ProjectTrackingStatus = (typeof PROJECT_TRACKING_STATUSES)[number];

export const projectTrackingMediaSchema = z.object({
  id: z.coerce.number().int().positive(),
  kind: z.enum(["image", "video"]),
  url: z.string().url(),
  posterUrl: z.string().url().nullable(),
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
  items: z.array(projectTrackingItemSchema),
});
export type ProjectTrackingStage = z.infer<typeof projectTrackingStageSchema>;

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
  latestUpdate: projectTrackingUpdateSchema.nullable(),
  currentStageId: z.coerce.number().int().positive().nullable(),
  latestVisual: z.string().nullable(),
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
