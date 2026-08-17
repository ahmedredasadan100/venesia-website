import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
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

  create table public.projects (
    id bigserial primary key,
    arabic_name text, english_name text, slug text,
    general_description text, short_description text,
    image text, image_alt text, hero_image text, hero_image_alt text,
    small_box_image text, small_box_image_alt text,
    governorate_id bigint, city_id bigint, main_area_id bigint,
    location_label text, google_maps_url text,
    latitude numeric, longitude numeric, map_zoom smallint,
    overview_title text not null,
    overview_body text, overview_media_type text,
    overview_main_image text, overview_main_image_alt text,
    delivery_title text not null, delivery_body text,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    constraint projects_overview_title_check check (btrim(overview_title) <> ''),
    constraint projects_delivery_title_check check (btrim(delivery_title) <> '')
  );
  create table public.project_videos (
    id bigserial primary key, project_id bigint, section text, video_url text,
    poster_image text, poster_alt text
  );
  create table public.project_location_points (project_id bigint, label text);
  create table public.project_features (project_id bigint, body text);
  create table public.project_floor_plans (
    id bigserial primary key, project_id bigint, name text,
    architectural_image text, architectural_image_alt text,
    furnishing_image text, furnishing_image_alt text
  );
  create table public.project_floor_plan_details (floor_plan_id bigint, label text, value text);
  create table public.project_delivery_items (project_id bigint, body text);
  create table public.project_media (project_id bigint, image text, alt_text text);

  create function public.save_project_admin_entry(
    p_project_id bigint default null,
    p_payload jsonb default '{}'::jsonb
  ) returns table (project_id bigint, slug text, updated_at timestamptz)
  language plpgsql security definer as $$
  declare v_id bigint; v_now timestamptz := clock_timestamp(); v_root jsonb := p_payload->'project';
  begin
    if p_project_id is null then
      insert into public.projects (overview_title, delivery_title, slug, updated_at)
      values (v_root->>'overview_title', v_root->>'delivery_title', coalesce(v_root->>'slug', 'new-project'), v_now)
      returning id into v_id;
    else
      v_id := p_project_id;
      update public.projects set
        overview_title = v_root->>'overview_title',
        delivery_title = v_root->>'delivery_title',
        updated_at = v_now
      where id = v_id;
    end if;
    return query select p.id, p.slug, p.updated_at from public.projects p where p.id = v_id;
  end $$;

  create function public.duplicate_project_admin_entry(p_project_id bigint)
  returns table (
    project_id bigint, project_type text, project_slug text, featured boolean,
    created_at timestamptz, updated_at timestamptz
  ) language plpgsql security definer as $$
  declare v_id bigint;
  begin
    insert into public.projects (overview_title, delivery_title, slug)
    select overview_title, delivery_title, slug || '-copy' from public.projects where id = p_project_id
    returning id into v_id;
    return query select p.id, 'residential'::text, p.slug, false, p.created_at, p.updated_at
      from public.projects p where p.id = v_id;
  end $$;

  insert into public.projects (overview_title, delivery_title, slug)
  values ('نظرة عامة', 'مواصفات التسليم', 'existing-project');
`);

await db.exec(read("sql/migrations/20260817100000_project_section_title_contract.sql"));

const columns = await db.query<{
  column_name: string;
  is_nullable: string;
  column_default: string | null;
}>(`
  select column_name, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'projects'
    and column_name in ('location_title','overview_title','plans_title','delivery_title','gallery_title')
  order by column_name
`);
check("all five section headings are nullable with no defaults",
  columns.rows.length === 5 && columns.rows.every((column) => column.is_nullable === "YES" && column.column_default === null));

const backfill = await db.query<{ location_title: string; plans_title: string; gallery_title: string }>(
  "select location_title, plans_title, gallery_title from public.projects where id = 1",
);
check("existing rows preserve visible headings through one-time backfill",
  backfill.rows[0]?.location_title === "عن الموقع" &&
  backfill.rows[0]?.plans_title === "المساحات والمخططات" &&
  backfill.rows[0]?.gallery_title === "معرض المشروع");

await db.query(`select * from public.save_project_admin_entry(1, $1::jsonb)`, [{
  project: {
    slug: "existing-project",
    location_title: "",
    overview_title: "",
    plans_title: "عنوان المخططات",
    delivery_title: "",
    gallery_title: "عنوان المعرض",
  },
}]);
const savedTitles = await db.query<{
  location_title: string | null;
  overview_title: string | null;
  plans_title: string | null;
  delivery_title: string | null;
  gallery_title: string | null;
}>("select location_title, overview_title, plans_title, delivery_title, gallery_title from public.projects where id = 1");
check("atomic save normalizes empty titles to NULL and persists explicit values",
  savedTitles.rows[0]?.location_title === null &&
  savedTitles.rows[0]?.overview_title === null &&
  savedTitles.rows[0]?.plans_title === "عنوان المخططات" &&
  savedTitles.rows[0]?.delivery_title === null &&
  savedTitles.rows[0]?.gallery_title === "عنوان المعرض");

await db.exec(`
  create table public.media_assets (
    id uuid primary key,
    provider text not null,
    bucket text not null,
    object_key text not null,
    status text not null,
    missing_object boolean not null default false,
    reconciliation_state text not null default 'unknown'
  );
  create table public.media_delete_reservations (asset_id uuid, status text);
  create table public.media_reference_write_leases (
    lease_token uuid not null,
    asset_id uuid not null,
    domain_key text, entity_type text, entity_identity text,
    write_targets jsonb, synchronized_targets jsonb,
    actor_id bigint, request_identity text,
    provider text, environment text, environment_key text, provider_registry_version text,
    status text not null default 'active', resolved_at timestamptz,
    started_at timestamptz, expires_at timestamptz
  );
  create function public.assert_media_catalog_coordination_ready(text, text, text, text)
  returns void language plpgsql as $$ begin raise exception 'media_catalog_runtime_uncertain'; end $$;
`);
await db.exec(read("sql/migrations/20260817101000_media_ordinary_attachment_scope.sql"));
await db.exec(`
  insert into public.media_assets (id, provider, bucket, object_key, status, missing_object, reconciliation_state)
  values ('00000000-0000-4000-8000-000000000001', 'supabase', 'media', 'projects/one.webp', 'active', false, 'unknown');
`);
const targets = [{
  provider: "supabase",
  bucket: "media",
  objectKey: "projects/one.webp",
  domainKey: "projects",
  entityType: "project",
  entityIdentity: "1",
}];
const lease = await db.query<{ leased_asset_count: number }>(
  "select leased_asset_count from public.acquire_media_reference_write_lease($1::jsonb, null, 'test', 180, 'supabase', 'test', 'test-key', 'v1')",
  [targets],
);
check("ordinary attachment succeeds for a safe target despite global reconciliation uncertainty",
  lease.rows[0]?.leased_asset_count === 1);

await db.exec("delete from public.media_reference_write_leases; insert into public.media_delete_reservations values ('00000000-0000-4000-8000-000000000001', 'reserved');");
await rejectsWith(
  "ordinary attachment still fails closed on a target delete reservation",
  () => db.query(
    "select * from public.acquire_media_reference_write_lease($1::jsonb, null, 'test', 180, 'supabase', 'test', 'test-key', 'v1')",
    [targets],
  ),
  /media_write_lease_delete_reserved/,
);

await db.close();
console.log(`verify-projects-vertical-slice-postgres OK (${passed} assertions)`);
