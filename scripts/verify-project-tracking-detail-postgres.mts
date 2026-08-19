import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { deriveProjectTrackingStageStatus } from "../src/lib/projects/tracking/contract.ts";

const migration = readFileSync(
  resolve(process.cwd(), "sql/migrations/20260817170332_project_construction_tracking_detail.sql"),
  "utf8",
);
const paginationMigration = readFileSync(
  resolve(
    process.cwd(),
    "sql/migrations/20260818010000_project_tracking_public_pagination.sql",
  ),
  "utf8",
);
const db = new PGlite({ extensions: { pgcrypto } });
let passed = 0;
const check = (label: string, value: unknown) => {
  assert.ok(value, label);
  passed += 1;
  console.log(`PASS ${label}`);
};
const rejectsWith = async (label: string, operation: () => Promise<unknown>, pattern: RegExp) => {
  await assert.rejects(operation, pattern, label);
  passed += 1;
  console.log(`PASS ${label}`);
};

await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create table public.admin_users (
    id bigserial primary key,
    is_active boolean not null default true
  );
  create table public.projects (
    id bigserial primary key,
    slug text not null unique,
    code text,
    type text not null default 'residential',
    arabic_name text not null,
    english_name text,
    location_label text,
    hero_image text,
    hero_image_alt text,
    publication_status text not null default 'draft'
  );
  insert into public.admin_users default values;
  insert into public.projects (
    slug, code, arabic_name, english_name, location_label, hero_image, publication_status
  ) values
    ('published-project', 'D174', 'حي الشروق هاوس', 'Shorouk House', 'القاهرة الجديدة', 'https://example.com/hero.webp', 'published'),
    ('draft-project', 'D175', 'مشروع مسودة', 'Draft Project', 'القاهرة', null, 'draft');
`);

await db.exec(migration);
await db.exec(paginationMigration);

const tableCount = await db.query<{ count: number }>(`
  select count(*)::integer as count
  from information_schema.tables
  where table_schema = 'public' and table_name like 'project_tracking_%'
`);
check("five additive Tracking tables exist", tableCount.rows[0]?.count === 5);

const stageOne = await db.query<{ mutate_project_tracking_stage: { id: number } }>(
  `select public.mutate_project_tracking_stage(1, 1, 'create', null, $1::jsonb)`,
  [{ name: "الحفر", description: "أعمال الحفر", start_date: "2026-05-01", planned_duration_value: 2, planned_duration_unit: "week", is_visible: true }],
);
const stageTwo = await db.query<{ mutate_project_tracking_stage: { id: number } }>(
  `select public.mutate_project_tracking_stage(1, 1, 'create', null, $1::jsonb)`,
  [{ name: "المباني", description: "أعمال المباني", start_date: "2026-06-01", planned_duration_value: 3, planned_duration_unit: "month", is_visible: true }],
);
const hiddenStage = await db.query<{ mutate_project_tracking_stage: { id: number } }>(
  `select public.mutate_project_tracking_stage(1, 1, 'create', null, $1::jsonb)`,
  [{ name: "مرحلة مخفية", description: "لا تظهر", start_date: "", planned_duration_value: "", planned_duration_unit: "", is_visible: false }],
);
const stageOneId = stageOne.rows[0]!.mutate_project_tracking_stage.id;
const stageTwoId = stageTwo.rows[0]!.mutate_project_tracking_stage.id;
const hiddenStageId = hiddenStage.rows[0]!.mutate_project_tracking_stage.id;

await db.query(`select public.reorder_project_tracking_stages(1, 1, $1::bigint[])`, [[stageTwoId, stageOneId, hiddenStageId]]);
const stageOrder = await db.query<{ id: number }>(`select id from public.project_tracking_stages where project_id = 1 order by sort_order`);
check("Stage reorder is atomic and exact", stageOrder.rows.map((row) => row.id).join(",") === `${stageTwoId},${stageOneId},${hiddenStageId}`);
await rejectsWith(
  "Stage reorder rejects an incomplete set",
  () => db.query(`select public.reorder_project_tracking_stages(1, 1, $1::bigint[])`, [[stageOneId]]),
  /exact Project Stage set/,
);

const completedItem = await db.query<{ mutate_project_tracking_item: { id: number } }>(
  `select public.mutate_project_tracking_item(1, $1, 1, 'create', null, $2::jsonb)`,
  [stageOneId, { name: "أعمدة الدور الأول", description: "تم التنفيذ", status: "completed", start_date: "2026-05-01", completion_date: "2026-05-28", is_visible: true }],
);
const activeItem = await db.query<{ mutate_project_tracking_item: { id: number } }>(
  `select public.mutate_project_tracking_item(1, $1, 1, 'create', null, $2::jsonb)`,
  [stageTwoId, { name: "مباني الدور الثالث", description: "قيد التنفيذ", status: "in_progress", start_date: "2026-06-01", completion_date: "", is_visible: true }],
);
const activeItemId = activeItem.rows[0]!.mutate_project_tracking_item.id;
check("Item status is the persisted progress truth", completedItem.rows[0]!.mutate_project_tracking_item.id > 0 && activeItemId > 0);

await db.query(`select public.save_project_tracking_profile(1, 1, $1::jsonb)`, [{
  project_receipt_date: "2026-04-01",
  license_receipt_date: "2026-04-15",
  contractor_name: "شركة فينيسيا للمقاولات",
}]);

const draftUpdate = await db.query<{ mutate_project_tracking_update: { id: number } }>(
  `select public.mutate_project_tracking_update(1, $1, 1, 'create', null, $2::jsonb)`,
  [activeItemId, {
    occurred_at: "2026-06-08T10:00:00Z",
    title: "تحديث مسودة",
    body: "لا يجب أن يظهر للعامة",
    publication_status: "draft",
    media: [],
  }],
);
const publishedUpdate = await db.query<{ mutate_project_tracking_update: { id: number; media: unknown[] } }>(
  `select public.mutate_project_tracking_update(1, $1, 1, 'create', null, $2::jsonb)`,
  [activeItemId, {
    occurred_at: "2026-06-22T10:00:00Z",
    title: "تنفيذ مباني الدور الثالث",
    body: "جار تنفيذ الحوائط الخارجية والداخلية.",
    publication_status: "published",
    media: [
      { client_key: "00000000-0000-4000-8000-000000000101", media_kind: "image", public_url: "https://example.com/update.webp", poster_url: "", title: "صورة التنفيذ", sort_order: 0 },
      { client_key: "00000000-0000-4000-8000-000000000102", media_kind: "video", public_url: "https://example.com/update.mp4", poster_url: "https://example.com/poster.webp", title: "فيديو التنفيذ", sort_order: 1 },
    ],
  }],
);
check("Update aggregate accepts reusable Media associations", publishedUpdate.rows[0]!.mutate_project_tracking_update.media.length === 2);

const aggregate = await db.query<{ project_tracking_public_detail_v1: {
  latestVisual: string;
  counts: { updates: number; images: number; videos: number; stages: number };
  profile: { contractorName: string };
} }>(`select public.project_tracking_public_detail_v1('published-project')`);
const detail = aggregate.rows[0]!.project_tracking_public_detail_v1;
check("public core hides draft Updates and counts only visible Stages", detail.counts.stages === 2 && detail.counts.updates === 1);
check("public core excludes unbounded child arrays", !("stages" in detail) && !("history" in detail));
check(
  "Stage status is derived by the single shared application owner",
  deriveProjectTrackingStageStatus(["completed"]) === "completed" &&
    deriveProjectTrackingStageStatus(["not_started", "in_progress"]) ===
      "in_progress" &&
    deriveProjectTrackingStageStatus([]) === "not_started",
);
check("counts and latest visual are derived in the aggregate", detail.counts.images === 1 && detail.counts.videos === 1 && detail.latestVisual === "https://example.com/update.webp");
check("Tracking profile remains one-to-one Project detail", detail.profile.contractorName === "شركة فينيسيا للمقاولات");

const publicFunction = await db.query<{ definition: string }>(`
  select pg_get_functiondef('public.project_tracking_public_detail_v1(text)'::regprocedure) as definition
`);
check(
  "corrective migration keeps the existing RPC and removes nested aggregation and SQL status derivation",
  !publicFunction.rows[0]!.definition.includes("jsonb_agg") &&
    !publicFunction.rows[0]!.definition.includes("bool_and") &&
    !publicFunction.rows[0]!.definition.includes("bool_or"),
);

const unpublished = await db.query<{ project_tracking_public_detail_v1: unknown }>(`select public.project_tracking_public_detail_v1('draft-project')`);
check("unpublished Project returns no public aggregate", unpublished.rows[0]?.project_tracking_public_detail_v1 === null);

await rejectsWith(
  "Item with historical Updates cannot be deleted",
  () => db.query(`select public.mutate_project_tracking_item(1, $1, 1, 'delete', $2, '{}'::jsonb)`, [stageTwoId, activeItemId]),
  /historical Updates cannot be deleted/,
);
await rejectsWith(
  "Stage with child Items cannot be deleted",
  () => db.query(`select public.mutate_project_tracking_stage(1, 1, 'delete', $1, '{}'::jsonb)`, [stageOneId]),
  /with Items cannot be deleted/,
);
await db.query(`select public.mutate_project_tracking_update(1, $1, 1, 'delete', $2, '{}'::jsonb)`, [activeItemId, draftUpdate.rows[0]!.mutate_project_tracking_update.id]);
const associationCount = await db.query<{ count: number }>(`select count(*)::integer as count from public.project_tracking_update_media`);
check("deleting an Update only removes its owned associations", associationCount.rows[0]?.count === 2);

const rls = await db.query<{ relname: string; relrowsecurity: boolean }>(`
  select relname, relrowsecurity from pg_class
  where relnamespace = 'public'::regnamespace and relname like 'project_tracking_%' and relkind = 'r'
`);
check("RLS is enabled on every Tracking table", rls.rows.length === 5 && rls.rows.every((row) => row.relrowsecurity));
const acl = await db.query<{ anonymous_execute: boolean; service_execute: boolean }>(`
  select
    has_function_privilege('anon', 'public.mutate_project_tracking_update(bigint,bigint,bigint,text,bigint,jsonb)', 'execute') as anonymous_execute,
    has_function_privilege('service_role', 'public.mutate_project_tracking_update(bigint,bigint,bigint,text,bigint,jsonb)', 'execute') as service_execute
`);
check("write RPC ACL is service_role only", acl.rows[0]?.anonymous_execute === false && acl.rows[0]?.service_execute === true);

await db.close();
console.log(`verify-project-tracking-detail-postgres OK (${passed} assertions)`);
