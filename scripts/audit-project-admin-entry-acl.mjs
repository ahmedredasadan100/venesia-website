import pg from "pg";

const { Client } = pg;

const aggregateTables = [
  "project_locations",
  "projects",
  "project_location_points",
  "project_features",
  "project_floor_plans",
  "project_floor_plan_details",
  "project_delivery_items",
  "project_media",
  "project_videos",
];

const aggregateSequences = aggregateTables.map((table) => `${table}_id_seq`);
const runtimeRoles = ["anon", "authenticated", "service_role"];
const auditedRoles = [
  ...runtimeRoles,
  "authenticator",
  "pg_write_all_data",
  "postgres",
  "supabase_admin",
];
const fixtureClientKeys = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "11000000-0000-4000-8000-000000000001",
  "11000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "21000000-0000-4000-8000-000000000001",
  "21000000-0000-4000-8000-000000000002",
  "21000000-0000-4000-8000-000000000003",
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000001",
  "70000000-0000-4000-8000-000000000001",
];

const aggregateFunctionNames = [
  "save_project_admin_entry",
  "delete_project_admin_entry",
  "validate_project_location_parent",
  "prevent_project_type_change",
  "validate_project_location_selection",
  "prevent_project_location_reparent",
  "mutate_project_location",
];

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const report = {};

async function query(name, text, values = []) {
  const result = await client.query(text, values);
  report[name] = result.rows;
}

function groupPrivileges(rows, objectField, roleField) {
  const grouped = new Map();

  for (const row of rows) {
    const key = `${row[objectField]}\u0000${row[roleField]}`;
    const entry = grouped.get(key) ?? {
      object_name: row[objectField],
      role_name: row[roleField],
      grantor: row.grantor,
      privileges: [],
    };
    entry.privileges.push(row.privilege_type ?? row.privilege);
    grouped.set(key, entry);
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    privileges: [...new Set(entry.privileges)].sort(),
  }));
}

function privilegeMap(rows, roleField, privilegeField = "privilege_type") {
  const map = {};

  for (const row of rows) {
    const role = row[roleField];
    const privileges = Array.isArray(row[privilegeField])
      ? row[privilegeField]
      : [row[privilegeField]];
    map[role] = [...new Set([...(map[role] ?? []), ...privileges])].sort();
  }

  return map;
}

function compactEffectiveDml(rows) {
  const roles = new Map();

  for (const row of rows) {
    const entry = roles.get(row.role_name) ?? {
      role_name: row.role_name,
      tables: [],
      privileges: [],
    };
    entry.tables.push(row.object_name);
    entry.privileges.push(...row.privileges);
    roles.set(row.role_name, entry);
  }

  return [...roles.values()].map((entry) => ({
    ...entry,
    tables: [...new Set(entry.tables)].sort(),
    privileges: [...new Set(entry.privileges)].sort(),
  }));
}

function buildSummary(fullReport) {
  const objectByName = new Map(
    fullReport.aggregateObjects.map((object) => [object.object_name, object]),
  );
  const effectiveTableAcl = fullReport.targetEffectiveTableAcl.filter(
    (entry) => entry.allowed,
  );
  const effectiveSequenceAcl = fullReport.targetEffectiveSequenceAcl.filter(
    (entry) => entry.allowed,
  );
  const effectiveFunctionAcl = fullReport.targetEffectiveFunctionAcl.filter(
    (entry) => entry.allowed,
  );
  const directTableAcl = fullReport.directRelationAcl.filter((entry) =>
    aggregateTables.includes(entry.object_name),
  );
  const directSequenceAcl = fullReport.directRelationAcl.filter((entry) =>
    aggregateSequences.includes(entry.object_name),
  );
  const foundFunctions = new Set(
    fullReport.aggregateFunctions.map((entry) =>
      entry.function_name.replace(/\(.*$/, ""),
    ),
  );

  return {
    session: fullReport.session,
    tables: aggregateTables.map((table) => ({
      object_name: table,
      owner: objectByName.get(table)?.owner,
      rls_enabled: objectByName.get(table)?.relrowsecurity,
      direct_acl: privilegeMap(
        directTableAcl.filter((entry) => entry.object_name === table),
        "grantee",
      ),
      runtime_effective_acl: privilegeMap(
        effectiveTableAcl.filter((entry) => entry.object_name === table),
        "role_name",
        "privilege",
      ),
    })),
    sequences: aggregateSequences.map((sequence) => ({
      object_name: sequence,
      owner: objectByName.get(sequence)?.owner,
      direct_acl: privilegeMap(
        directSequenceAcl.filter((entry) => entry.object_name === sequence),
        "grantee",
      ),
      runtime_effective_acl: privilegeMap(
        effectiveSequenceAcl.filter((entry) => entry.object_name === sequence),
        "role_name",
        "privilege",
      ),
    })),
    direct_column_acl: fullReport.directColumnAcl,
    all_roles_effective_dml: compactEffectiveDml(fullReport.allRolesEffectiveDml),
    role_attributes: fullReport.roleAttributes,
    role_memberships: fullReport.roleMemberships,
    default_acl: groupPrivileges(
      fullReport.defaultAcl.map((entry) => ({
        ...entry,
        default_scope: `${entry.creator_role}:${entry.schema_name}:${entry.object_type}`,
      })),
      "default_scope",
      "grantee",
    ),
    functions: fullReport.aggregateFunctions.map((entry) => ({
      ...entry,
      direct_acl: privilegeMap(
        fullReport.directFunctionAcl.filter(
          (acl) => acl.function_name === entry.function_name,
        ),
        "grantee",
      ),
      runtime_execute_roles: effectiveFunctionAcl
        .filter(
          (acl) => acl.function_name === entry.function_name,
        )
        .map((acl) => acl.role_name)
        .sort(),
    })),
    missing_functions: aggregateFunctionNames.filter(
      (functionName) => !foundFunctions.has(functionName),
    ),
    migration_registry: fullReport.migrationRegistry,
    aggregate_data_snapshot: {
      row_counts: fullReport.aggregateRowCounts,
      projects: fullReport.projectIdentitySnapshot,
      locations: fullReport.locationIdentitySnapshot,
      child_identity_hashes: fullReport.childIdentityHashes,
    },
    fixture_residue: {
      projects: fullReport.fixtureProjectResidue,
      locations: fullReport.fixtureLocationResidue,
      client_keys: Object.fromEntries(
        Object.entries(fullReport)
          .filter(([key]) => key.startsWith("fixtureClientKeyResidue:"))
          .map(([key, value]) => [key.replace("fixtureClientKeyResidue:", ""), value]),
      ),
    },
  };
}

try {
  await client.connect();
  await client.query("begin read only");

  await query(
    "session",
    `
      select current_user,
             session_user,
             current_database(),
             current_setting('transaction_read_only') as transaction_read_only
    `,
  );

  await query(
    "aggregateObjects",
    `
      select c.oid::regclass::text as object_name,
             c.relkind,
             pg_get_userbyid(c.relowner) as owner,
             c.relrowsecurity,
             c.relforcerowsecurity,
             c.relacl::text as stored_acl
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = any($1::text[])
       order by c.relkind, c.relname
    `,
    [aggregateTables.concat(aggregateSequences)],
  );

  await query(
    "directRelationAcl",
    `
      select c.oid::regclass::text as object_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(c.relacl) acl
       where n.nspname = 'public'
         and c.relname = any($1::text[])
         and c.relacl is not null
       order by c.relname, grantee, acl.privilege_type
    `,
    [aggregateTables.concat(aggregateSequences)],
  );

  await query(
    "directColumnAcl",
    `
      select c.oid::regclass::text as object_name,
             a.attname as column_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid
        cross join lateral aclexplode(a.attacl) acl
       where n.nspname = 'public'
         and c.relname = any($1::text[])
         and a.attnum > 0
         and not a.attisdropped
         and a.attacl is not null
       order by c.relname, a.attnum, grantee, acl.privilege_type
    `,
    [aggregateTables],
  );

  await query(
    "targetEffectiveTableAcl",
    `
      with privileges(privilege) as (
        values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
               ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
      )
      select r.rolname as role_name,
             c.oid::regclass::text as object_name,
             p.privilege,
             has_table_privilege(r.oid, c.oid, p.privilege) as allowed
        from pg_roles r
        cross join pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join privileges p
       where r.rolname = any($2::text[])
         and n.nspname = 'public'
         and c.relname = any($1::text[])
       order by c.relname, r.rolname, p.privilege
    `,
    [aggregateTables, runtimeRoles],
  );

  await query(
    "allRolesEffectiveDml",
    `
      with privileges(privilege) as (
        values ('INSERT'), ('UPDATE'), ('DELETE'),
               ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
      )
      select r.rolname as role_name,
             c.oid::regclass::text as object_name,
             array_agg(p.privilege order by p.privilege) as privileges
        from pg_roles r
        cross join pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join privileges p
       where n.nspname = 'public'
         and c.relname = any($1::text[])
         and has_table_privilege(r.oid, c.oid, p.privilege)
       group by r.rolname, c.oid
       order by r.rolname, c.oid::regclass::text
    `,
    [aggregateTables],
  );

  await query(
    "roleAttributes",
    `
      select rolname,
             rolsuper,
             rolinherit,
             rolcreaterole,
             rolcreatedb,
             rolcanlogin,
             rolreplication,
             rolbypassrls
        from pg_roles
       where rolname = any($1::text[])
          or rolname in (
            select distinct pg_get_userbyid(c.relowner)
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public'
               and c.relname = any($2::text[])
          )
       order by rolname
    `,
    [auditedRoles, aggregateTables],
  );

  await query(
    "roleMemberships",
    `
      select member.rolname as member,
             granted.rolname as granted_role,
             grantor.rolname as grantor,
             member.rolinherit as member_inherits,
             membership.admin_option
        from pg_auth_members membership
        join pg_roles member on member.oid = membership.member
        join pg_roles granted on granted.oid = membership.roleid
        join pg_roles grantor on grantor.oid = membership.grantor
       where member.rolname = any($1::text[])
          or granted.rolname = any($1::text[])
       order by member.rolname, granted.rolname
    `,
    [auditedRoles],
  );

  await query(
    "defaultAcl",
    `
      select pg_get_userbyid(d.defaclrole) as creator_role,
             coalesce(n.nspname, '<global>') as schema_name,
             case d.defaclobjtype
               when 'r' then 'tables'
               when 'S' then 'sequences'
               when 'f' then 'functions'
               when 'T' then 'types'
               when 'n' then 'schemas'
               else d.defaclobjtype::text
             end as object_type,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_default_acl d
        left join pg_namespace n on n.oid = d.defaclnamespace
        cross join lateral aclexplode(d.defaclacl) acl
       where n.nspname = 'public'
          or d.defaclnamespace = 0
       order by creator_role, schema_name, object_type, grantee, acl.privilege_type
    `,
  );

  await query(
    "targetEffectiveSequenceAcl",
    `
      with privileges(privilege) as (
        values ('USAGE'), ('SELECT'), ('UPDATE')
      )
      select r.rolname as role_name,
             c.oid::regclass::text as object_name,
             p.privilege,
             has_sequence_privilege(r.oid, c.oid, p.privilege) as allowed
        from pg_roles r
        cross join pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join privileges p
       where r.rolname = any($2::text[])
         and n.nspname = 'public'
         and c.relname = any($1::text[])
       order by c.relname, r.rolname, p.privilege
    `,
    [aggregateSequences, runtimeRoles],
  );

  await query(
    "aggregateFunctions",
    `
      select p.oid::regprocedure::text as function_name,
             pg_get_userbyid(p.proowner) as owner,
             p.prosecdef as security_definer,
             p.proconfig,
             p.proacl::text as stored_acl
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = any($1::text[])
       order by p.oid::regprocedure::text
    `,
    [aggregateFunctionNames],
  );

  await query(
    "directFunctionAcl",
    `
      select p.oid::regprocedure::text as function_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(p.proacl) acl
       where n.nspname = 'public'
         and p.proname = any($1::text[])
         and p.proacl is not null
       order by function_name, grantee
    `,
    [aggregateFunctionNames],
  );

  await query(
    "targetEffectiveFunctionAcl",
    `
      select r.rolname as role_name,
             p.oid::regprocedure::text as function_name,
             has_function_privilege(r.oid, p.oid, 'EXECUTE') as allowed
        from pg_roles r
        cross join pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where r.rolname = any($2::text[])
         and n.nspname = 'public'
         and p.proname = any($1::text[])
       order by function_name, role_name
    `,
    [aggregateFunctionNames, runtimeRoles],
  );

  await query(
    "migrationRegistry",
    `
      select to_jsonb(m)->>'version' as version,
             to_jsonb(m)->>'name' as name,
             length(coalesce(to_jsonb(m)->>'statements', '')) as statements_json_length,
             md5(coalesce(to_jsonb(m)->>'statements', '')) as statements_json_md5,
             to_jsonb(m) - 'statements' as metadata
      from supabase_migrations.schema_migrations m
       where to_jsonb(m)->>'version' in ('20260728090000', '20260729090000')
       order by to_jsonb(m)->>'version'
    `,
  );

  await query(
    "aggregateRowCounts",
    `
      select 'project_locations' as object_name, count(*)::bigint as row_count
        from public.project_locations
      union all
      select 'projects', count(*)::bigint from public.projects
      union all
      select 'project_location_points', count(*)::bigint from public.project_location_points
      union all
      select 'project_features', count(*)::bigint from public.project_features
      union all
      select 'project_floor_plans', count(*)::bigint from public.project_floor_plans
      union all
      select 'project_floor_plan_details', count(*)::bigint from public.project_floor_plan_details
      union all
      select 'project_delivery_items', count(*)::bigint from public.project_delivery_items
      union all
      select 'project_media', count(*)::bigint from public.project_media
      union all
      select 'project_videos', count(*)::bigint from public.project_videos
      order by object_name
    `,
  );

  await query(
    "projectIdentitySnapshot",
    `
      select id, slug
        from public.projects
       order by id
    `,
  );

  await query(
    "locationIdentitySnapshot",
    `
      select id,
             client_key::text,
             level,
             parent_id,
             name_en,
             sort_order,
             is_active
        from public.project_locations
       order by id
    `,
  );

  await query(
    "childIdentityHashes",
    `
      select 'project_location_points' as object_name,
             count(*)::bigint as row_count,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), '')) as identity_hash
        from public.project_location_points
      union all
      select 'project_features', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_features
      union all
      select 'project_floor_plans', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_floor_plans
      union all
      select 'project_floor_plan_details', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_floor_plan_details
      union all
      select 'project_delivery_items', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_delivery_items
      union all
      select 'project_media', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_media
      union all
      select 'project_videos', count(*)::bigint,
             md5(coalesce(string_agg(id::text || ':' || client_key::text, ',' order by id), ''))
        from public.project_videos
      order by object_name
    `,
  );

  await query(
    "fixtureProjectResidue",
    `
      select slug, count(*)::int as row_count
        from public.projects
       where slug in ('atomic-project-entry-test', 'other-ownership-project-test')
       group by slug
       order by slug
    `,
  );

  await query(
    "fixtureLocationResidue",
    `
      select name_en, count(*)::int as row_count
        from public.project_locations
       where name_en = any($1::text[])
       group by name_en
       order by name_en
    `,
    [[
      "Project Entry Test Governorate",
      "Other Test Governorate",
      "Test City",
      "Test Main Area",
      "Test Sub Area",
    ]],
  );

  for (const table of [
    "project_locations",
    "project_location_points",
    "project_features",
    "project_floor_plans",
    "project_floor_plan_details",
    "project_delivery_items",
    "project_media",
    "project_videos",
  ]) {
    await query(
      `fixtureClientKeyResidue:${table}`,
      `
        select count(*)::int as row_count
          from public.${table}
         where client_key = any($1::uuid[])
      `,
      [fixtureClientKeys],
    );
  }

  await client.query("rollback");
  const output = process.argv.includes("--full") ? report : buildSummary(report);
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // The original read-only failure is the useful diagnostic.
  }

  console.error(
    JSON.stringify(
      {
        name: error.name,
        message: error.message,
        code: error.code,
        detail: error.detail,
        where: error.where,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
