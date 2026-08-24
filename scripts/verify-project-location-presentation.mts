import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE_MIGRATION =
  "sql/migrations/20260824012105_project_location_section_presentation_scope.sql";
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const adminContract = read("src/lib/admin/projects/project-entry-contract.ts");
const adminRead = read("src/lib/admin/projects/project-entry-data.ts");
const projectForm = read("src/app/admin/projects/ProjectEditForm.tsx");
const presentationOwner = read(
  "src/lib/projects/project-location-presentation.ts",
);
const presentationLoader = read(
  "src/lib/projects/load-project-location-section-presentation.ts",
);
const cacheRevalidationOwner = read(
  "src/lib/cache/revalidate-public-cache-tags.ts",
);
const locationRenderer = read(
  "src/components/projects/details/ProjectDistrictSection.tsx",
);
const locationContainer = read(
  "src/components/projects/details/ResidentialProjectDetails.tsx",
);
const projectRoute = read("src/app/(site)/projects/[slug]/page.tsx");
const adminPreview = read("src/app/admin/projects/[id]/preview/page.tsx");
const publicTypes = read("src/lib/projects/public-types.ts");
const publicMapper = read("src/lib/projects/map-public-project.ts");
const publicLoader = read("src/lib/projects/load-published-projects.ts");
const homeRenderer = read("src/components/home/HomeProjectsSection.tsx");
const featuredRenderer = read(
  "src/components/projects/ProjectsFeaturedSection.tsx",
);
const listingRenderer = read("src/components/projects/ProjectsListSection.tsx");
const projectHero = read(
  "src/components/projects/details/ProjectDetailsHero.tsx",
);
const trackingRead = read("src/lib/projects/tracking/public-read.ts");
const trackingRenderer = read(
  "src/components/track/ProjectTrackingExperience.tsx",
);
const projectLinkSearch = read(
  "src/lib/admin/links/providers/resources.ts",
);
const adminProjectListRead = read(
  "src/lib/admin/projects/entity-list-adapter.ts",
);
const deprecatedModules = read(
  "src/lib/page-blocks/deprecated-block-modules.ts",
);
const contentEditor = read(
  "src/components/admin/page-blocks/ContentModuleEditClient.tsx",
);
const contentActions = read(
  "src/app/admin/pages-blocks/blocks/content/actions.ts",
);
const contentRoute = read(
  "src/app/admin/pages-blocks/blocks/content/[id]/page.tsx",
);
const migration = read(SCOPE_MIGRATION);

check(
  "Project Admin keeps Location Section presentation outside Project data",
  adminContract.includes(
    "location_section_presentation: ProjectLocationSectionPresentationStorage",
  ) &&
    adminContract.includes("project: ProjectEntryRoot") &&
    !/export type ProjectEntryRoot\s*=\s*ProjectLocationSectionPresentationStorage/.test(
      adminContract,
    ) &&
    adminRead.includes("location_section_presentation: {") &&
    adminRead.includes("show_location_label: root.show_location_label !== false"),
);

check(
  "Project Location tab owns both switches through the canonical Project form",
  projectForm.includes('title="إعدادات عرض قسم الموقع"') &&
    projectForm.includes('name="show_location_label"') &&
    projectForm.includes('name="show_location_tags"') &&
    projectForm.includes(
      "bundle.location_section_presentation.show_location_label",
    ) &&
    projectForm.includes(
      "bundle.location_section_presentation.show_location_tags",
    ) &&
    projectForm.includes("لا تؤثر على Hero أو Featured أو Listing"),
);

check(
  "Location Section is the only public presentation reader",
  presentationOwner.includes(
    "Location Section is the only presentation owner",
  ) &&
    presentationLoader.includes('.from("projects")') &&
    presentationLoader.includes(
      '.select("show_location_label,show_location_tags")',
    ) &&
    !presentationLoader.includes("content_block_templates") &&
    locationRenderer.includes("presentation.showLocationLabel") &&
    locationRenderer.includes("presentation.showLocationTags") &&
    locationContainer.includes("presentation={locationSectionPresentation}") &&
    projectRoute.includes(
      "loadProjectLocationSectionPresentation(Number(project.id))",
    ) &&
    adminPreview.includes("loadProjectLocationSectionPresentation(projectId)"),
);

check(
  "Project Admin writes expire shared Project caches immediately",
  /export function revalidateProjectsCache\(\) \{\s*updatePublicCacheTags\(PUBLIC_CACHE_TAG_GROUPS\.projects\)/.test(
    cacheRevalidationOwner,
  ) &&
    !/export function revalidateProjectsCache\(\) \{\s*revalidatePublicCacheTags\(PUBLIC_CACHE_TAG_GROUPS\.projects\)/.test(
      cacheRevalidationOwner,
    ),
);

const otherConsumerSources = [
  publicTypes,
  publicMapper,
  publicLoader,
  homeRenderer,
  featuredRenderer,
  listingRenderer,
  projectHero,
  trackingRead,
  trackingRenderer,
  projectLinkSearch,
  adminProjectListRead,
];
check(
  "Hero, Featured, Listing, Home, Tracking, Search and shared Project models ignore the switches",
  otherConsumerSources.every(
    (source) =>
      !source.includes("show_location_label") &&
      !source.includes("show_location_tags") &&
      !source.includes("locationSectionPresentation"),
  ) &&
    projectRoute.includes("locationLabel: project.location.label"),
);

check(
  "The superseded Content Module singleton has no active editor or mutation path",
  deprecatedModules.includes('"project-details-presentation"') &&
    contentRoute.includes("isRetiredContentBlockTemplateSlug(block.slug)") &&
    contentActions.includes("isRetiredContentBlockTemplateSlug(existing.slug)") &&
    !contentEditor.includes("project-details-presentation") &&
    !contentEditor.includes("ProjectLocationSectionPresentation") &&
    !contentActions.includes("buildProjectLocationSectionPresentationConfig"),
);

check(
  "Scope migration reuses the canonical writer without schema, data, Tracking, or seed changes",
  migration.includes(
    "create or replace function public.save_project_admin_entry",
  ) &&
    migration.includes(
      "create or replace function public.duplicate_project_admin_entry",
    ) &&
    migration.includes("p_payload->'location_section_presentation'") &&
    migration.includes("Other Consumers must ignore it") &&
    !migration.includes("project_tracking_public_detail_v1") &&
    !/\balter\s+table\b|\bdrop\s+(?:table|column)\b|\btruncate\b/i.test(
      migration,
    ) &&
    !/\binsert\s+into\b|\bdelete\s+from\b/i.test(migration),
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
      location_title text,
      overview_title text,
      plans_title text,
      delivery_title text,
      gallery_title text,
      show_location_label boolean not null default true,
      show_location_tags boolean not null default true,
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
      v_updated_at timestamptz := clock_timestamp();
    begin
      update public.projects
         set updated_at = v_updated_at
       where id = p_project_id;
      return query
      select project.id, project.slug, project.updated_at
        from public.projects project
       where project.id = p_project_id;
    end
    $function$;

    create function public.save_project_admin_entry(
      p_project_id bigint default null,
      p_payload jsonb default '{}'::jsonb
    ) returns table (project_id bigint, slug text, updated_at timestamptz)
    language sql as $function$
      select * from public.save_project_admin_entry_before_section_titles(
        p_project_id,
        p_payload
      )
    $function$;

    create function public.duplicate_project_admin_entry_before_section_titles(
      p_project_id bigint
    ) returns table (
      project_id bigint, project_type text, project_slug text,
      featured boolean, created_at timestamptz, updated_at timestamptz
    ) language plpgsql as $function$
    declare
      v_source public.projects%rowtype;
      v_copy public.projects%rowtype;
    begin
      select * into strict v_source
      from public.projects
      where id = p_project_id;

      insert into public.projects (type, slug, featured)
      values (v_source.type, v_source.slug || '-copy', false)
      returning * into v_copy;

      return query select
        v_copy.id,
        v_copy.type,
        v_copy.slug,
        v_copy.featured,
        v_copy.created_at,
        v_copy.updated_at;
    end
    $function$;

    create function public.duplicate_project_admin_entry(p_project_id bigint)
    returns table (
      project_id bigint, project_type text, project_slug text,
      featured boolean, created_at timestamptz, updated_at timestamptz
    ) language sql as $function$
      select *
      from public.duplicate_project_admin_entry_before_section_titles(
        p_project_id
      )
    $function$;

    insert into public.projects (
      slug,
      location_title,
      plans_title,
      gallery_title,
      show_location_label,
      show_location_tags
    ) values (
      'source-project',
      'عن الموقع',
      'المساحات',
      'المعرض',
      true,
      true
    );
  `);
}

const db = await PGlite.create();
try {
  await createBaseline(db);
  await db.exec(migration);

  await db.exec(`
    select * from public.save_project_admin_entry(
      1,
      jsonb_build_object(
        'project', jsonb_build_object('location_title', 'الموقع الجديد'),
        'location_section_presentation', jsonb_build_object(
          'show_location_label', false,
          'show_location_tags', true
        )
      )
    );
  `);
  const saved = await db.query<{
    location_title: string | null;
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select location_title, show_location_label, show_location_tags
    from public.projects
    where id = 1
  `);
  check(
    "Canonical save persists Project data and Location Section presentation atomically",
    saved.rows[0]?.location_title === "الموقع الجديد" &&
      saved.rows[0]?.show_location_label === false &&
      saved.rows[0]?.show_location_tags === true,
  );

  await db.exec(`
    select * from public.save_project_admin_entry(
      1,
      '{"project":{"show_location_label":true,"show_location_tags":false}}'::jsonb
    );
  `);
  const afterLegacyPayload = await db.query<{
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select show_location_label, show_location_tags
    from public.projects
    where id = 1
  `);
  check(
    "Legacy Project-level presentation keys cannot regain global ownership",
    afterLegacyPayload.rows[0]?.show_location_label === false &&
      afterLegacyPayload.rows[0]?.show_location_tags === true,
  );

  const duplicate = await db.query<{ project_id: number }>(
    "select project_id from public.duplicate_project_admin_entry(1)",
  );
  const duplicateState = await db.query<{
    show_location_label: boolean;
    show_location_tags: boolean;
  }>(`
    select show_location_label, show_location_tags
    from public.projects
    where id = ${Number(duplicate.rows[0]?.project_id)}
  `);
  check(
    "Project duplication preserves only that Project page Location Section presentation",
    duplicateState.rows[0]?.show_location_label === false &&
      duplicateState.rows[0]?.show_location_tags === true,
  );

  const acl = await db.query<{
    anon_execute: boolean;
    authenticated_execute: boolean;
    service_execute: boolean;
  }>(`
    select
      has_function_privilege(
        'anon',
        'public.save_project_admin_entry(bigint,jsonb)',
        'execute'
      ) as anon_execute,
      has_function_privilege(
        'authenticated',
        'public.save_project_admin_entry(bigint,jsonb)',
        'execute'
      ) as authenticated_execute,
      has_function_privilege(
        'service_role',
        'public.save_project_admin_entry(bigint,jsonb)',
        'execute'
      ) as service_execute
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
    /requires the existing compatibility columns/i,
  );
  passed += 1;
  console.log(
    "PASS migration fails closed without the existing presentation storage",
  );
} finally {
  await invalidDb.close();
}

console.log(
  `Project Location Section Presentation verification passed (${passed} checks).`,
);
