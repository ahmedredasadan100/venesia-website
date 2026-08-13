import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = "sql/migrations/20260813150000_legacy_project_media_canonicalization.sql";
const migration = readFileSync(join(ROOT, MIGRATION), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const seedRows = [...migration.matchAll(
  /^  \('([^']+)', '\/([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', ([0-9]+), '([a-f0-9]{64})'\)[,;]?$/gm,
)].map((match) => ({
  objectKey: match[1],
  publicUrl: `/${match[2]}`,
  folderPath: match[3],
  filename: match[4],
  extension: match[5],
  mimeType: match[6],
  byteSize: Number(match[7]),
  checksum: match[8],
}));

check("migration owns exactly 278 canonical legacy Project identities", seedRows.length === 278);
check(
  "canonical identity seed has no case-insensitive path collisions",
  new Set(seedRows.map((row) => row.publicUrl.toLowerCase())).size === seedRows.length,
);
check(
  "every canonical Project identity uses lowercase directory segments",
  seedRows
    .filter((row) => row.objectKey.startsWith("images/projects/"))
    .every((row) => dirname(row.objectKey) === dirname(row.objectKey).toLowerCase()),
);
check(
  "every canonical Project identity maps to the exact physical public asset",
  seedRows.every((row) => {
    const absolutePath = join(ROOT, "public", ...row.objectKey.split("/"));
    if (!existsSync(absolutePath)) return false;
    const bytes = readFileSync(absolutePath);
    return (
      bytes.byteLength === row.byteSize
      && createHash("sha256").update(bytes).digest("hex") === row.checksum
      && extname(absolutePath).slice(1).toLowerCase() === row.extension
    );
  }),
);

const projectAssetsRoot = join(ROOT, "public", "images", "projects");
const projectDirectories: string[] = [];
function collectProjectDirectories(absolutePath: string, relativePath = "") {
  for (const entry of readdirSync(absolutePath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nextRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    projectDirectories.push(nextRelativePath);
    collectProjectDirectories(join(absolutePath, entry.name), nextRelativePath);
  }
}
collectProjectDirectories(projectAssetsRoot);
check(
  "all physical Project media directories use the lowercase convention",
  projectDirectories.every((directory) => directory === directory.toLowerCase()),
);

const trackedProjectAssets = seedRows.filter((row) => row.objectKey.startsWith("images/projects/"));
check("all 276 canonical Project-folder images are cataloged", trackedProjectAssets.length === 276);

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(`
  create table public.media_folders (
    id uuid primary key default gen_random_uuid(),
    normalized_path text not null unique,
    parent_path text,
    display_name text not null,
    reconciliation_state text not null default 'synced',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.media_assets (
    id uuid primary key default gen_random_uuid(),
    provider text not null constraint media_assets_provider_check check (provider in ('supabase')),
    bucket text not null,
    object_key text not null,
    public_url text not null unique,
    original_filename text not null,
    display_name text not null,
    media_kind text not null,
    mime_type text,
    extension text not null,
    byte_size bigint,
    width integer,
    height integer,
    checksum text,
    folder_path text not null references public.media_folders(normalized_path),
    status text not null default 'active',
    uploaded_by bigint,
    default_alt_text text,
    default_title text,
    default_caption text,
    reconciliation_state text not null default 'synced',
    missing_object boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_assets_canonical_identity_unique unique (provider, bucket, object_key)
  );

  create table public.media_references (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.media_assets(id) on delete cascade,
    domain_key text not null,
    entity_type text not null,
    entity_identity text not null,
    entity_label text,
    field_key text not null,
    edit_href text,
    public_href text,
    reference_state text not null default 'active',
    restorable boolean not null default false,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_references_identity_unique unique (
      asset_id, domain_key, entity_type, entity_identity, field_key
    )
  );

  create table public.projects (
    id bigint primary key,
    arabic_name text,
    image text,
    hero_image text,
    small_box_image text,
    overview_main_image text,
    og_image text
  );

  create table public.project_media (
    id bigint primary key,
    project_id bigint not null,
    image text
  );

  create table public.project_floor_plans (
    id bigint primary key,
    project_id bigint not null,
    architectural_image text,
    furnishing_image text
  );

  create table public.project_videos (
    id bigint primary key,
    project_id bigint not null,
    poster_image text
  );

  insert into public.projects values (
    101,
    'C35',
    '/images/projects/c35/cover.jpg',
    '/images/projects/c35/hero.jpg',
    '/images/projects/c35/cover.jpg',
    '/images/projects/c35/hero.jpg',
    '/images/projects/c35/hero.jpg'
  );
  insert into public.project_media values (201, 101, '/images/projects/b137/progress-01.jpg');
  insert into public.project_floor_plans values (
    301,
    101,
    '/images/projects/f222/floorplan-01.jpg',
    '/images/projects/f222/floorplan-02.jpg'
  );
  insert into public.project_videos values (401, 101, '/images/projects/f92/hero.jpg');

  insert into public.media_folders (normalized_path, parent_path, display_name)
  values ('images', null, 'images');
  insert into public.media_assets (
    provider,
    bucket,
    object_key,
    public_url,
    original_filename,
    display_name,
    media_kind,
    extension,
    folder_path
  ) values (
    'supabase',
    'cms-images',
    'images/projects/managed.jpg',
    'https://demo.supabase.co/storage/v1/object/public/cms-images/images/projects/managed.jpg',
    'managed.jpg',
    'managed.jpg',
    'image',
    'jpg',
    'images'
  );
  insert into public.media_references (
    asset_id,
    domain_key,
    entity_type,
    entity_identity,
    field_key
  ) select id, 'projects', 'project', '999', 'image'
    from public.media_assets where provider = 'supabase';
`);

await db.exec(migration);

const assetCount = await db.query<{ count: number }>(
  "select count(*)::integer as count from public.media_assets where provider = 'filesystem' and bucket = 'public'",
);
check("migration registers all legacy Project assets in the existing Media Catalog", assetCount.rows[0]?.count === 278);

const project = await db.query<{
  image: string;
  hero_image: string;
  small_box_image: string;
  overview_main_image: string;
  og_image: string;
}>("select image, hero_image, small_box_image, overview_main_image, og_image from public.projects where id = 101");
check(
  "Project root URLs adopt the lowercase Project-folder contract",
  project.rows[0]?.image === "/images/projects/c35/cover.jpg"
    && project.rows[0]?.hero_image === "/images/projects/c35/hero.jpg"
    && project.rows[0]?.small_box_image === "/images/projects/c35/cover.jpg"
    && project.rows[0]?.overview_main_image === "/images/projects/c35/hero.jpg"
    && project.rows[0]?.og_image === "/images/projects/c35/hero.jpg",
);

const children = await db.query<{
  media_image: string;
  architectural_image: string;
  furnishing_image: string;
  poster_image: string;
}>(`
  select
    media.image as media_image,
    plan.architectural_image,
    plan.furnishing_image,
    video.poster_image
  from public.project_media media
  cross join public.project_floor_plans plan
  cross join public.project_videos video
  where media.id = 201 and plan.id = 301 and video.id = 401
`);
check(
  "Project child URLs adopt the same lowercase Project-folder contract",
  children.rows[0]?.media_image === "/images/projects/b137/progress-01.jpg"
    && children.rows[0]?.architectural_image === "/images/projects/f222/floorplan-01.jpg"
    && children.rows[0]?.furnishing_image === "/images/projects/f222/floorplan-02.jpg"
    && children.rows[0]?.poster_image === "/images/projects/f92/hero.jpg",
);

await assert.rejects(
  db.exec("insert into public.projects (id, image) values (102, '/images/projects/C35/new.jpg')"),
  /projects_media_path_lowercase_check/,
);
await assert.rejects(
  db.exec("insert into public.project_media values (202, 101, '/images/projects/C35/new.jpg')"),
  /project_media_path_lowercase_check/,
);
await assert.rejects(
  db.exec("insert into public.project_media values (204, 101, 'https://demo.supabase.co/storage/v1/object/public/cms-images/images/projects/C35/new.jpg')"),
  /project_media_path_lowercase_check/,
);
await assert.rejects(
  db.exec("insert into public.project_floor_plans values (302, 101, '/images/projects/C35/new.jpg', null)"),
  /project_floor_plans_media_path_lowercase_check/,
);
await assert.rejects(
  db.exec("insert into public.project_videos values (402, 101, '/images/projects/C35/new.jpg')"),
  /project_videos_media_path_lowercase_check/,
);
await assert.rejects(
  db.exec("insert into public.media_folders (normalized_path, parent_path, display_name) values ('images/projects/C35', 'images/projects', 'C35')"),
  /media_folders_project_path_lowercase_check/,
);
await assert.rejects(
  db.exec(`
    insert into public.media_assets (
      provider,
      bucket,
      object_key,
      public_url,
      original_filename,
      display_name,
      media_kind,
      extension,
      folder_path
    ) values (
      'filesystem',
      'public',
      'images/about/not-a-project-asset.jpg',
      '/images/projects/C35/not-a-project-asset.jpg',
      'not-a-project-asset.jpg',
      'not-a-project-asset.jpg',
      'image',
      'jpg',
      'images'
    )
  `),
  /media_assets_project_path_lowercase_check/,
);
await db.exec("insert into public.project_media values (203, 101, '/images/projects/c35/Hero Copy.jpg')");
await db.exec("delete from public.project_media where id = 203");
check("database guards reject uppercase Project folders without rewriting valid filename casing", true);

const referenceCount = await db.query<{ count: number }>(
  "select count(*)::integer as count from public.media_references reference join public.media_assets asset on asset.id = reference.asset_id where reference.domain_key in ('projects', 'project_media', 'project_floor_plans', 'project_videos') and asset.provider = 'filesystem'",
);
check("migration backfills the four existing Project reference providers", referenceCount.rows[0]?.count === 9);

const managedReferenceCount = await db.query<{ count: number }>(
  "select count(*)::integer as count from public.media_references reference join public.media_assets asset on asset.id = reference.asset_id where asset.provider = 'supabase'",
);
check("migration preserves pre-existing managed Project references", managedReferenceCount.rows[0]?.count === 1);

const unresolved = await db.query<{ count: number }>(`
  with project_values(value) as (
    select image from public.projects
    union all select hero_image from public.projects
    union all select small_box_image from public.projects
    union all select overview_main_image from public.projects
    union all select og_image from public.projects
    union all select image from public.project_media
    union all select architectural_image from public.project_floor_plans
    union all select furnishing_image from public.project_floor_plans
    union all select poster_image from public.project_videos
  )
  select count(*)::integer as count
  from project_values project_value
  left join public.media_assets asset
    on asset.public_url = project_value.value
   and asset.object_key = ltrim(project_value.value, '/')
   and asset.provider = 'filesystem'
   and asset.bucket = 'public'
  where project_value.value ~* '^/images/'
    and asset.id is null
`);
check("no legacy Project reference remains outside canonical Media identity", unresolved.rows[0]?.count === 0);

await db.close();
console.log(`OK: ${passed} legacy Project media canonicalization checks passed.`);
