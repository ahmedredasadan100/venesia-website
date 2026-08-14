import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION =
  "sql/migrations/20260814002948_location_management_foundation.sql";
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n?/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check("Location Management migration exists", existsSync(join(ROOT, MIGRATION)));
const migration = read(MIGRATION);
const contract = read("src/lib/admin/projects/location-management-contract.ts");
const adapter = read("src/lib/admin/projects/location-management-adapter.ts");
const registry = read("src/lib/admin/entity-list/data-engine/registry.ts");
const projectEditor = read(
  "src/components/admin/projects/entry/ProjectLocationEditor.tsx",
);
const projectData = read("src/lib/admin/projects/project-entry-data.ts");
const managementClient = read(
  "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
);

check(
  "one canonical hierarchy contract owns all four levels",
  contract.includes('"governorate"') &&
    contract.includes('"city"') &&
    contract.includes('"main_area"') &&
    contract.includes('"sub_area"') &&
    contract.includes("parentLevel: null") &&
    contract.includes('parentLevel: "governorate"') &&
    contract.includes('parentLevel: "city"') &&
    contract.includes('parentLevel: "main_area"'),
);
check(
  "Project create and edit load Location options from project_locations",
  projectData.includes('.from("project_locations")') &&
    projectData.includes("loadProjectLocationOptions") &&
    projectEditor.includes('option.level === "governorate"') &&
    projectEditor.includes('option.level === "city" && option.parentId === governorateId') &&
    projectEditor.includes('option.level === "main_area" && option.parentId === cityId') &&
    projectEditor.includes('option.level === "sub_area" && option.parentId === mainAreaId'),
);
check(
  "Project editor contains no hardcoded Location option values",
  !/options=\{\s*\[(?:.|\n)*?(?:Cairo|القاهرة)/.test(projectEditor),
);
check(
  "four management consumers adopt the existing Collection and Data runtimes",
  managementClient.includes("useAdminEntityListController") &&
    managementClient.includes("useAdminEntityInstantMutation") &&
    managementClient.includes("<AdminEntityList") &&
    managementClient.includes("<AdminTablePagination") &&
    [
      "project_locations_governorate",
      "project_locations_city",
      "project_locations_main_area",
      "project_locations_sub_area",
    ].every((entity) => registry.includes(`${entity}:`)) &&
    adapter.includes("createProjectLocationManagementAdapter"),
);
check(
  "Location status and row actions share one capability declaration and renderer",
  managementClient.includes("createLocationRowActionsCapability") &&
    managementClient.includes('display="visibility"') &&
    managementClient.includes("<AdminDataGridRowActions") &&
    managementClient.includes('delete: pending === "delete"') &&
    managementClient.includes('duplicate: { access: "hidden" }') &&
    managementClient.includes("enableSelection={false}"),
);
check(
  "Location header links every hierarchy level through the canonical route contract",
  managementClient.includes("PROJECT_LOCATION_LEVELS.map") &&
    managementClient.includes("projectLocationManagementPath(targetLevel)") &&
    managementClient.includes("PROJECT_LOCATION_NAV_LABELS[targetLevel]"),
);
check(
  "Location tables omit update timestamps and governorates omit parent and order presentation",
  !managementClient.includes('key: "updated"') &&
    managementClient.includes('input.level !== "governorate"') &&
    managementClient.includes('column.key !== "parent"') &&
    managementClient.includes('column.key !== "order"'),
);
check(
  "mutation owner is one service-only guarded RPC",
  migration.includes("create or replace function public.mutate_project_location") &&
    migration.includes("grant execute on function public.mutate_project_location") &&
    migration.includes("to service_role") &&
    migration.includes("A location linked to projects cannot be deleted") &&
    migration.includes("A location with child locations cannot be deleted"),
);

const db = await PGlite.create({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create extension if not exists pgcrypto;
    do $roles$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role noinherit;
      end if;
    end
    $roles$;

    create table public.project_locations (
      id bigint generated by default as identity primary key,
      client_key uuid not null default gen_random_uuid() unique,
      level text not null check (level in ('governorate', 'city', 'main_area', 'sub_area')),
      parent_id bigint references public.project_locations(id) on delete restrict,
      name_ar text not null check (btrim(name_ar) <> ''),
      name_en text,
      sort_order integer not null default 0 check (sort_order >= 0),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint project_locations_parent_name_unique
        unique nulls not distinct (parent_id, level, name_ar),
      constraint project_locations_root_shape_check check (
        (level = 'governorate' and parent_id is null)
        or (level <> 'governorate' and parent_id is not null)
      )
    );
    create table public.projects (
      id bigint generated by default as identity primary key,
      governorate_id bigint not null references public.project_locations(id) on delete restrict,
      city_id bigint not null references public.project_locations(id) on delete restrict,
      main_area_id bigint not null references public.project_locations(id) on delete restrict,
      sub_area_id bigint references public.project_locations(id) on delete restrict
    );

    create function public.validate_project_location_parent()
    returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $fn$
    declare
      parent_level text;
      parent_active boolean;
      expected_level text;
    begin
      if new.level = 'governorate' then return new; end if;
      select level, is_active into parent_level, parent_active
        from public.project_locations where id = new.parent_id for key share;
      if parent_level is null then
        raise exception using errcode = '23503', message = 'Missing parent.';
      end if;
      expected_level := case new.level
        when 'city' then 'governorate'
        when 'main_area' then 'city'
        when 'sub_area' then 'main_area'
      end;
      if parent_level <> expected_level or not parent_active then
        raise exception using errcode = '23514', message = 'Invalid location hierarchy.';
      end if;
      return new;
    end
    $fn$;
    create trigger project_locations_validate_parent
      before insert or update of level, parent_id, is_active
      on public.project_locations for each row
      execute function public.validate_project_location_parent();

    create function public.prevent_project_location_reparent()
    returns trigger language plpgsql set search_path = pg_catalog, pg_temp as $fn$
    begin
      if old.is_active and not new.is_active and exists (
        select 1 from public.project_locations child
        where child.parent_id = new.id and child.is_active
      ) then
        raise exception using errcode = '23514', message = 'Active children prevent deactivation.';
      end if;
      if old.is_active and not new.is_active and exists (
        select 1 from public.projects project
        where project.governorate_id = new.id or project.city_id = new.id
           or project.main_area_id = new.id or project.sub_area_id = new.id
      ) then
        raise exception using errcode = '23514', message = 'Project reference prevents deactivation.';
      end if;
      return new;
    end
    $fn$;
    create trigger project_locations_prevent_reparent
      before update of level, parent_id, is_active
      on public.project_locations for each row
      execute function public.prevent_project_location_reparent();
  `);

  await db.exec(migration);

  async function createLocation(
    level: string,
    parentId: number | null,
    name: string,
    order: number,
  ) {
    const result = await db.query<{ id: bigint }>(
      `select location.id from public.mutate_project_location(
        'create', null,
        jsonb_build_object(
          'level', $1::text, 'parent_id', $2::bigint, 'name_ar', $3::text,
          'name_en', null, 'sort_order', $4::integer, 'is_active', true
        )
      ) as location`,
      [level, parentId, name, order],
    );
    return Number(result.rows[0]?.id);
  }

  const governorateId = await createLocation("governorate", null, "محافظة اختبار", 2);
  const cityId = await createLocation("city", governorateId, "مدينة اختبار", 3);
  const districtId = await createLocation("main_area", cityId, "منطقة اختبار", 4);
  const subDistrictId = await createLocation("sub_area", districtId, "منطقة فرعية", 5);
  check(
    "RPC creates the complete canonical hierarchy",
    [governorateId, cityId, districtId, subDistrictId].every(Number.isSafeInteger),
  );

  await assert.rejects(
    createLocation("city", cityId, "مدينة بعلاقة خاطئة", 0),
    /Invalid location hierarchy/i,
  );
  passed += 1;
  console.log("PASS invalid parent hierarchy is rejected");

  await assert.rejects(
    db.query(
      "select public.mutate_project_location('update', $1, jsonb_build_object('level', 'main_area'))",
      [cityId],
    ),
    /cannot change hierarchy level/i,
  );
  passed += 1;
  console.log("PASS a Location cannot drift between hierarchy levels");

  await assert.rejects(
    db.query(
      "select public.mutate_project_location('update', $1, jsonb_build_object('is_active', false))",
      [cityId],
    ),
    /Active children prevent deactivation/i,
  );
  passed += 1;
  console.log("PASS active parent with active children cannot be deactivated");

  await db.query(
    "select public.mutate_project_location('update', $1, jsonb_build_object('sort_order', 9, 'name_en', 'Test Sub District'))",
    [subDistrictId],
  );
  const updated = await db.query<{ sort_order: number; name_en: string }>(
    "select sort_order, name_en from public.project_locations where id = $1",
    [subDistrictId],
  );
  check(
    "RPC updates ordering and labels through the same owner",
    Number(updated.rows[0]?.sort_order) === 9 &&
      updated.rows[0]?.name_en === "Test Sub District",
  );

  await db.query(
    `insert into public.projects (
      governorate_id, city_id, main_area_id, sub_area_id
    ) values ($1, $2, $3, $4)`,
    [governorateId, cityId, districtId, subDistrictId],
  );
  await assert.rejects(
    db.query(
      "select public.mutate_project_location('delete', $1, '{}'::jsonb)",
      [subDistrictId],
    ),
    /linked to projects/i,
  );
  passed += 1;
  console.log("PASS a Project-linked location cannot be deleted");

  await assert.rejects(
    db.query(
      "select public.mutate_project_location('delete', $1, '{}'::jsonb)",
      [cityId],
    ),
    /child locations/i,
  );
  passed += 1;
  console.log("PASS a location with children cannot be deleted");

  const disposableId = await createLocation(
    "sub_area",
    districtId,
    "منطقة قابلة للحذف",
    10,
  );
  await db.query(
    "select public.mutate_project_location('delete', $1, '{}'::jsonb)",
    [disposableId],
  );
  const deleted = await db.query<{ count: number }>(
    "select count(*)::integer as count from public.project_locations where id = $1",
    [disposableId],
  );
  check("an unreferenced leaf location can be deleted", deleted.rows[0]?.count === 0);

  const acl = await db.query<{
    anon_execute: boolean;
    authenticated_execute: boolean;
    service_execute: boolean;
  }>(`
    select
      has_function_privilege('anon', 'public.mutate_project_location(text,bigint,jsonb)', 'execute') as anon_execute,
      has_function_privilege('authenticated', 'public.mutate_project_location(text,bigint,jsonb)', 'execute') as authenticated_execute,
      has_function_privilege('service_role', 'public.mutate_project_location(text,bigint,jsonb)', 'execute') as service_execute
  `);
  check(
    "mutation ACL is service-only",
    acl.rows[0]?.anon_execute === false &&
      acl.rows[0]?.authenticated_execute === false &&
      acl.rows[0]?.service_execute === true,
  );
} finally {
  await db.close();
}

console.log(`Project Location Management verification passed (${passed} checks).`);
