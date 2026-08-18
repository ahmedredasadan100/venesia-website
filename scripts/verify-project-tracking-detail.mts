import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n?/g, "\n");
let passed = 0;
const check = (label: string, value: unknown) => {
  assert.ok(value, label);
  passed += 1;
  console.log(`PASS ${label}`);
};

const migrationPath = "sql/migrations/20260817170332_project_construction_tracking_detail.sql";
check("Tracking migration exists", existsSync(resolve(process.cwd(), migrationPath)));
const migration = read(migrationPath);
const publicRoute = read("src/app/(site)/track-your-project/[slug]/page.tsx");
const publicRead = read("src/lib/projects/tracking/public-read.ts");
const publicView = read("src/components/track/ProjectTrackingExperience.tsx");
const adminCollections = read("src/components/admin/projects/tracking/TrackingCollections.tsx");
const adminForms = read("src/components/admin/projects/tracking/TrackingForms.tsx");
const actions = read("src/app/admin/projects/tracking-actions.ts");
const registry = read("src/lib/admin/entity-list/data-engine/registry.ts");
const mediaProviders = read("src/lib/admin/media-catalog/reference-providers.ts");
const stageTableDefinition = migration.match(
  /create table public\.project_tracking_stages\s*\(([\s\S]*?)\n\);/i,
)?.[1] ?? "";

check("migration never alters or adds a Tracking column to projects",
  !/alter\s+table\s+(?:public\.)?projects\b/i.test(migration) &&
  !/create\s+table\s+(?:public\.)?projects\b/i.test(migration) &&
  !/update\s+(?:public\.)?projects\b/i.test(migration));
check("Tracking tables link to Project identity without duplicate Project data",
  migration.includes("project_id bigint primary key references public.projects(id) on delete restrict") &&
  migration.includes("project_id bigint not null references public.projects(id) on delete restrict") &&
  !migration.includes("project_arabic_name") && !migration.includes("project_slug text"));
check("stages, items, updates, and update media are independent Tracking tables",
  ["project_tracking_stages", "project_tracking_items", "project_tracking_updates", "project_tracking_update_media"].every((name) => migration.includes(`create table public.${name}`)));
check("progress has no percentage and Stage status is derived",
  !/progress_percent|completion_percent|percentage\s+(?:integer|numeric|real|double)/i.test(migration) &&
  migration.includes("bool_and(item.status = 'completed')") &&
  !/\bstatus\s+text/i.test(stageTableDefinition));
check("parent deletes are guarded and Update delete only cascades owned associations",
  migration.includes("A Tracking Stage with Items cannot be deleted") &&
  migration.includes("A Tracking Item with historical Updates cannot be deleted") &&
  migration.includes("references public.project_tracking_updates(id) on delete cascade"));
check("public surface uses one aggregate and 404s unpublished Projects",
  publicRead.includes("getSupabaseAdmin().rpc(") &&
  publicRead.includes('const TRACKING_PUBLIC_RPC = "project_tracking_public_detail_v1"') &&
  publicRoute.includes("notFound()") &&
  migration.includes("project.publication_status = 'published'") &&
  migration.includes("update_row.publication_status = 'published'") &&
  migration.includes("stage.is_visible") && migration.includes("item.is_visible"));
check("public read distinguishes pending schema, not-found, empty, and unexpected failures",
  publicRead.includes('code === "PGRST202"') &&
  publicRead.includes("isPendingTrackingSchemaDependency") &&
  publicRead.includes('classification: "known_pending_schema_dependency"') &&
  publicRead.includes("throw new PendingTrackingSchemaDependencyError(error)") &&
  publicRead.includes("error instanceof PendingTrackingSchemaDependencyError") &&
  publicRead.includes("loadProjectBySlugResult(slug)") &&
  publicRead.includes('status: "unavailable"') &&
  publicRead.includes('status: "not_found"') &&
  publicRead.includes('status: "ready"') &&
  publicRead.includes("throw error") &&
  publicRoute.includes('result.status === "not_found"') &&
  publicRoute.includes('result.status === "unavailable"') &&
  publicRoute.includes("ProjectTrackingUnavailableState") &&
  !publicRead.includes("catch(() => null)"));
check("public experience includes journey, item documentation, media, timeline, facts, empty state, and CTA",
  ["رحلة التنفيذ", "توثيق بنود المرحلة", "MediaViewer", "سجل التحديثات", "لمحة سريعة عن المشروع", "TrackingEmptyState", "تواصل مع فريقنا"].every((token) => publicView.includes(token)));
check("Admin adopts shared Header, Form Runtime, Collection, Feedback, and Confirmation",
  adminCollections.includes("AdminPageContextHeader") && adminCollections.includes("AdminEntityList") &&
  adminCollections.includes("routeOwnedParams") &&
  adminCollections.includes("mapAdminActionResultToFeedback") && adminCollections.includes('mode: "shared"') &&
  adminForms.includes("AdminFormRuntime") && adminForms.includes("AdminMediaGalleryField"));
check("all three Tracking collections are executable Data Registry consumers",
  ["trackingStagesEntityListAdapter", "trackingItemsEntityListAdapter", "trackingUpdatesEntityListAdapter"].every((token) => registry.includes(token)));
check("Update media uses existing Media Catalog coordination and provider ownership",
  mediaProviders.includes('domainKey: "project_tracking_update_media"') &&
  actions.includes("coordinateTrackingUpdateSave") && actions.includes("cleanupDeletedTrackingUpdateMedia") &&
  !actions.includes("deleteMediaAsset"));
check("reorder is atomic RPC-owned and requires the exact child set",
  migration.includes("reorder_project_tracking_stages") && migration.includes("reorder_project_tracking_items") &&
  migration.includes("must contain the exact Project Stage set") && migration.includes("must contain the exact Stage Item set"));
check("Tracking write/read RPCs and tables are service-role only",
  migration.includes("from public, anon, authenticated") &&
  migration.includes("to service_role") &&
  migration.includes("enable row level security"));

console.log(`verify-project-tracking-detail OK (${passed} assertions)`);
