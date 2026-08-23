import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import {
  resolveVisibleProjectLocationLabel,
  resolveVisibleProjectLocationTags,
} from "../src/lib/projects/project-location-presentation.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION =
  "sql/migrations/20260823114743_project_location_presentation_contract.sql";
const CONSUMER_ADOPTION_MIGRATION =
  "sql/migrations/20260823123750_project_location_presentation_consumer_adoption.sql";
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const migration = read(MIGRATION);
const contract = read("src/lib/projects/project-location-presentation.ts");
const adminContract = read("src/lib/admin/projects/project-entry-contract.ts");
const adminRead = read("src/lib/admin/projects/project-entry-data.ts");
const form = read("src/app/admin/projects/ProjectEditForm.tsx");
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const publicTypes = read("src/lib/projects/public-types.ts");
const consumerAdoptionMigration = read(CONSUMER_ADOPTION_MIGRATION);

check(
  "Project Domain owns one typed Location Presentation contract with legacy-safe visible defaults",
  contract.includes("export type ProjectLocationPresentationStorage") &&
    contract.includes("show_location_label: boolean") &&
    contract.includes("show_location_tags: boolean") &&
    contract.includes("showDetailedAddress: source?.show_location_label !== false") &&
    contract.includes("showLocationTags: source?.show_location_tags !== false"),
);
check(
  "Project Location tab delegates both controls to the existing AdminFormSwitch owner",
  (form.match(/<AdminFormSwitch\b/g) ?? []).length >= 3 &&
    (form.match(/name="show_location_label"/g) ?? []).length === 1 &&
    (form.match(/name="show_location_tags"/g) ?? []).length === 1 &&
    form.includes('label="إظهار العنوان التفصيلي"') &&
    form.includes('label="إظهار بيانات الموقع (Location Tags)"') &&
    form.includes("defaultChecked={bundle.project.show_location_label}") &&
    form.includes("defaultChecked={bundle.project.show_location_tags}"),
);
check(
  "Admin FormData and reconciled read model preserve both Project-owned decisions",
  ["show_location_label", "show_location_tags"].every(
    (field) =>
      adminContract.includes(`readLastString(formData, "${field}")`) &&
      adminRead.includes(field),
  ) &&
    adminRead.includes("root.show_location_label !== false") &&
    adminRead.includes("root.show_location_tags !== false"),
);
check(
  "Project public Read Model exposes presentation intent to every rendering adapter",
  [publicLoader, publicMapper].every(
    (source) =>
      source.includes("show_location_label") &&
      source.includes("show_location_tags"),
  ) &&
    publicMapper.includes("resolveProjectLocationPresentation(project)") &&
    publicTypes.includes("presentation: ProjectLocationPresentation"),
);

const detailedAddressConsumers = [
  "src/components/projects/details/ProjectDetailsHero.tsx",
  "src/components/projects/details/ProjectDistrictSection.tsx",
  "src/components/home/HomeProjectsSection.tsx",
  "src/components/projects/ProjectsListSection.tsx",
  "src/components/projects/ProjectsFeaturedSection.tsx",
  "src/components/projects/ProjectCardMobileOverlays.tsx",
  "src/components/projects/ProjectsMapSection.tsx",
  "src/lib/projects/project-hero-adapter.ts",
  "src/components/track/ProjectTrackingExperience.tsx",
  "src/app/(site)/projects/[slug]/page.tsx",
].map(read);
check(
  "all visual detailed-address Consumers adopt the one semantic Project selector",
  detailedAddressConsumers.every((source) =>
    source.includes("resolveVisibleProjectLocationLabel"),
  ),
);

const tagConsumers = [
  "src/components/projects/details/ProjectDistrictSection.tsx",
  "src/components/projects/ProjectsMapSection.tsx",
].map(read);
check(
  "all visual Location Tags Consumers adopt the one semantic Project selector",
  tagConsumers.every((source) =>
    source.includes("resolveVisibleProjectLocationTags"),
  ),
);

const homepageLoader = read("src/lib/projects/load-homepage-projects.ts");
const trackingContract = read("src/lib/projects/tracking/contract.ts");
const trackingRead = read("src/lib/projects/tracking/public-read.ts");
check(
  "specialized Homepage and Tracking read models carry the same Project-owned decisions",
  homepageLoader.includes("presentation: project.location.presentation") &&
    publicTypes.includes('Pick<PublicProject["location"], "label" | "presentation">') &&
    trackingContract.includes("projectLocationPresentationReadSchema") &&
    trackingRead.includes("projectLocationPresentationReadSchema") &&
    consumerAdoptionMigration.includes("project.show_location_label") &&
    consumerAdoptionMigration.includes("project.show_location_tags"),
);

const visiblePresentation = {
  showDetailedAddress: true,
  showLocationTags: true,
};
const hiddenPresentation = {
  showDetailedAddress: false,
  showLocationTags: false,
};
check(
  "semantic selectors preserve data and compose Project and Consumer decisions bidirectionally",
  resolveVisibleProjectLocationLabel(
    { label: "بيت الوطن — الحي الأول — قطعة I76", presentation: visiblePresentation },
    true,
  ) === "بيت الوطن — الحي الأول — قطعة I76" &&
    resolveVisibleProjectLocationLabel(
      { label: "بيت الوطن — الحي الأول — قطعة I76", presentation: hiddenPresentation },
      true,
    ) === null &&
    resolveVisibleProjectLocationLabel(
      { label: "بيت الوطن — الحي الأول — قطعة I76", presentation: visiblePresentation },
      false,
    ) === null &&
    resolveVisibleProjectLocationTags(visiblePresentation, ["القاهرة", "بيت الوطن"]).length === 2 &&
    resolveVisibleProjectLocationTags(hiddenPresentation, ["القاهرة", "بيت الوطن"]).length === 0,
);

check(
  "Tracking adoption extends the existing RPC only and fails closed without Phase 1",
  consumerAdoptionMigration.includes(
    "create or replace function public.project_tracking_public_detail_v1",
  ) &&
    consumerAdoptionMigration.includes(
      "Project Location Presentation consumer adoption requires the Phase 1 Project columns",
    ) &&
    !/\bcreate\s+(?:table|view)\b/i.test(consumerAdoptionMigration),
);
check(
  "migration is additive and extends only the canonical Project writer and duplicate owners",
  migration.includes(
    "add column if not exists show_location_label boolean not null default true",
  ) &&
    migration.includes(
      "add column if not exists show_location_tags boolean not null default true",
    ) &&
    migration.includes("create or replace function public.save_project_admin_entry") &&
    migration.includes("create or replace function public.duplicate_project_admin_entry") &&
    migration.includes("else project.show_location_label") &&
    migration.includes("else project.show_location_tags") &&
    !/\bcreate\s+table\b|\bdrop\s+(?:table|column)\b|\btruncate\b/i.test(migration),
);

async function createBaseline(db: PGlite) {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create table public.projects (
      id bigint generated by default as identity primary key,
      type text not null default 'residential',
      slug text not null unique,
      location_label text not null,
      location_title text,
      overview_title text,
      plans_title text,
      delivery_title text,
      gallery_title text,
      featured boolean not null default false,
      created_at timestamptz not null default clock_timestamp(),
      updated_at timestamptz not null default clock_timestamp()
    );

    create function public.save_project_admin_entry_before_section_titles(
      p_project_id bigint default null,
      p_payload jsonb default '{}'::jsonb
    ) returns table (project_id bigint, slug text, updated_at timestamptz)
    language plpgsql as $function$
    declare
      v_id bigint;
      v_slug text;
      v_updated_at timestamptz := clock_timestamp();
      v_root jsonb := coalesce(p_payload->'project', '{}'::jsonb);
    begin
      if p_project_id is null then
        insert into public.projects (slug, location_label, updated_at)
        values (
          coalesce(nullif(v_root->>'slug', ''), 'created-project'),
          coalesce(nullif(v_root->>'location_label', ''), 'created address'),
          v_updated_at
        ) returning id, projects.slug into v_id, v_slug;
      else
        update public.projects
           set updated_at = v_updated_at
         where id = p_project_id
        returning id, projects.slug into v_id, v_slug;
      end if;
      return query select v_id, v_slug, v_updated_at;
    end
    $function$;

    create function public.save_project_admin_entry(
      p_project_id bigint default null,
      p_payload jsonb default '{}'::jsonb
    ) returns table (project_id bigint, slug text, updated_at timestamptz)
    language sql as $function$
      select * from public.save_project_admin_entry_before_section_titles(p_project_id, p_payload)
    $function$;

    create function public.duplicate_project_admin_entry_before_section_titles(
      p_project_id bigint
    ) returns table (
      project_id bigint, project_type text, project_slug text, featured boolean,
      created_at timestamptz, updated_at timestamptz
    ) language plpgsql as $function$
    declare
      v_source public.projects%rowtype;
      v_copy public.projects%rowtype;
    begin
      select * into strict v_source from public.projects where id = p_project_id;
      insert into public.projects (
        type, slug, location_label, location_title, overview_title,
        plans_title, delivery_title, gallery_title, featured
      ) values (
        v_source.type, v_source.slug || '-copy', v_source.location_label,
        v_source.location_title, v_source.overview_title, v_source.plans_title,
        v_source.delivery_title, v_source.gallery_title, false
      ) returning * into v_copy;
      return query select
        v_copy.id, v_copy.type, v_copy.slug, v_copy.featured,
        v_copy.created_at, v_copy.updated_at;
    end
    $function$;

    create function public.duplicate_project_admin_entry(p_project_id bigint)
    returns table (
      project_id bigint, project_type text, project_slug text, featured boolean,
      created_at timestamptz, updated_at timestamptz
    ) language sql as $function$
      select * from public.duplicate_project_admin_entry_before_section_titles(p_project_id)
    $function$;

    insert into public.projects (slug, location_label)
    values ('source-project', 'بيت الوطن — الحي الأول — قطعة I76');
  `);
}

const db = await PGlite.create();
try {
  await createBaseline(db);
  await db.exec(migration);

  const columns = await db.query<{
    column_name: string;
    is_nullable: string;
    column_default: string;
  }>(`
    select column_name, is_nullable, column_default
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'projects'
       and column_name in ('show_location_label', 'show_location_tags')
     order by column_name
  `);
  check(
    "migration installs two non-null visible-by-default Project columns",
    columns.rows.length === 2 &&
      columns.rows.every(
        (row) => row.is_nullable === "NO" && row.column_default === "true",
      ),
  );

  const baseline = await db.query<{
    location_label: string;
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select location_label, show_location_label, show_location_tags
      from public.projects where id = 1
  `);
  check(
    "existing Project location data remains unchanged and defaults stay visible",
    baseline.rows[0]?.location_label ===
      "بيت الوطن — الحي الأول — قطعة I76" &&
      baseline.rows[0]?.show_location_label === true &&
      baseline.rows[0]?.show_location_tags === true,
  );

  await db.exec(`
    select * from public.save_project_admin_entry(
      1,
      '{"project":{"show_location_label":false,"show_location_tags":false}}'::jsonb
    );
  `);
  const hidden = await db.query<{
    location_label: string;
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select location_label, show_location_label, show_location_tags
      from public.projects where id = 1
  `);
  check(
    "atomic Project save changes only presentation intent and retains location data",
    hidden.rows[0]?.location_label === baseline.rows[0]?.location_label &&
      hidden.rows[0]?.show_location_label === false &&
      hidden.rows[0]?.show_location_tags === false,
  );

  await db.exec(`select * from public.save_project_admin_entry(1, '{"project":{}}'::jsonb);`);
  const preserved = await db.query<{
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select show_location_label, show_location_tags
      from public.projects where id = 1
  `);
  check(
    "missing rolling-deployment keys preserve the stored presentation decision",
    preserved.rows[0]?.show_location_label === false &&
      preserved.rows[0]?.show_location_tags === false,
  );

  const duplicate = await db.query<{ project_id: number }>(
    "select project_id from public.duplicate_project_admin_entry(1)",
  );
  const duplicateState = await db.query<{
    location_label: string;
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select location_label, show_location_label, show_location_tags
      from public.projects where id = ${Number(duplicate.rows[0]?.project_id)}
  `);
  check(
    "canonical Project duplicate owner copies data and both presentation decisions",
    duplicateState.rows[0]?.location_label === baseline.rows[0]?.location_label &&
      duplicateState.rows[0]?.show_location_label === false &&
      duplicateState.rows[0]?.show_location_tags === false,
  );

  const acl = await db.query<{
    anon_execute: boolean;
    authenticated_execute: boolean;
    service_execute: boolean;
  }>(`
    select
      has_function_privilege('anon', 'public.save_project_admin_entry(bigint,jsonb)', 'execute') as anon_execute,
      has_function_privilege('authenticated', 'public.save_project_admin_entry(bigint,jsonb)', 'execute') as authenticated_execute,
      has_function_privilege('service_role', 'public.save_project_admin_entry(bigint,jsonb)', 'execute') as service_execute
  `);
  check(
    "Project writer remains service-role-only",
    acl.rows[0]?.anon_execute === false &&
      acl.rows[0]?.authenticated_execute === false &&
      acl.rows[0]?.service_execute === true,
  );
} finally {
  await db.close();
}

const invalidDb = await PGlite.create();
try {
  await invalidDb.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create table public.projects (id bigint primary key);
  `);
  await assert.rejects(
    invalidDb.exec(migration),
    /requires the canonical atomic Project writer chain/i,
  );
  passed += 1;
  console.log("PASS migration fails closed when the canonical Project writer is missing");
} finally {
  await invalidDb.close();
}

console.log(`Project Location Presentation verification passed (${passed} checks).`);
