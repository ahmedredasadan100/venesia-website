import pg from "pg";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const { Client } = pg;

const finalRebuildMigrationUrl = new URL(
  "../sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql",
  import.meta.url,
);
const finalRebuildMigration = readFileSync(finalRebuildMigrationUrl, "utf8").replace(
  /\r\n?/gu,
  "\n",
);
const aclCorrectionMigration = readFileSync(
  new URL("../sql/migrations/20260729090000_project_admin_entry_acl_correction.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");
const schemaParityForwardMigration = readFileSync(
  new URL("../sql/migrations/20260729150000_project_admin_schema_parity_forward_fix.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");
const rowActionsMigrationUrl = new URL(
  "../sql/migrations/20260731100000_project_row_actions_capability.sql",
  import.meta.url,
);
const rowActionsMigration = readFileSync(rowActionsMigrationUrl, "utf8").replace(
  /\r\n?/gu,
  "\n",
);
const projectPublishingMigration = readFileSync(
  new URL("../sql/migrations/20260803120000_project_publishing_visibility_capability.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");
const globalTruthAtomicMigration = readFileSync(
  new URL("../sql/migrations/20260805180000_global_truth_atomic_operations_closure.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");
const dashboardTruthMigration = readFileSync(
  new URL("../sql/migrations/20260805210000_dashboard_truth_closure.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");
const reportsAnalyticsMigration = readFileSync(
  new URL("../sql/migrations/20260805230000_reports_analytics_capability_closure.sql", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function md5(value) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function extractExpectedFunctionSource(functionName) {
  const startMarker = `create or replace function public.${functionName}(`;
  const ownerMigration = globalTruthAtomicMigration.includes(startMarker)
    ? globalTruthAtomicMigration
    : projectPublishingMigration.includes(startMarker)
      ? projectPublishingMigration
      : rowActionsMigration.includes(startMarker)
        ? rowActionsMigration
        : finalRebuildMigration;
  const functionStart = ownerMigration.indexOf(startMarker);

  if (functionStart < 0) {
    throw new Error(`Missing ${functionName}() in the final rebuild migration.`);
  }

  const bodyMarker = "as $function$";
  const bodyMarkerStart = ownerMigration.indexOf(bodyMarker, functionStart);
  const bodyStart = bodyMarkerStart + bodyMarker.length;
  const bodyEnd = ownerMigration.indexOf("$function$;", bodyStart);

  if (bodyMarkerStart < 0 || bodyEnd < 0) {
    throw new Error(`Could not extract ${functionName}() from the final rebuild migration.`);
  }

  return ownerMigration.slice(bodyStart, bodyEnd);
}

const schemaName = "public";
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
const clientKeyTables = aggregateTables.filter((table) => table !== "projects");
const aggregateSequences = aggregateTables.map((table) => `${table}_id_seq`);
const aggregateFunctionNames = [
  "save_project_admin_entry",
  "delete_project_admin_entry",
  "set_project_featured_admin_entry",
  "duplicate_project_admin_entry",
  "validate_project_location_parent",
  "prevent_project_type_change",
  "validate_project_location_selection",
  "prevent_project_location_reparent",
];
const expectedFunctionSourceHashes = Object.fromEntries(
  aggregateFunctionNames.map((functionName) => [
    functionName,
    sha256(extractExpectedFunctionSource(functionName)),
  ]),
);
const expectedFunctionSourceMd5s = Object.fromEntries(
  aggregateFunctionNames.map((functionName) => [
    functionName,
    md5(extractExpectedFunctionSource(functionName)),
  ]),
);
const expectedFunctionSignatures = [
  "public.save_project_admin_entry(bigint,jsonb)",
  "public.delete_project_admin_entry(bigint)",
  "public.set_project_featured_admin_entry(bigint,boolean)",
  "public.duplicate_project_admin_entry(bigint)",
  "public.validate_project_location_parent()",
  "public.prevent_project_type_change()",
  "public.validate_project_location_selection()",
  "public.prevent_project_location_reparent()",
];
const aggregateRpcSignatures = [
  "public.save_project_admin_entry(bigint,jsonb)",
  "public.delete_project_admin_entry(bigint)",
  "public.set_project_featured_admin_entry(bigint,boolean)",
  "public.duplicate_project_admin_entry(bigint)",
];
const forbiddenLegacyFunctionSignatures = [
  "public.sync_project_children(bigint,jsonb,jsonb,jsonb,jsonb,jsonb)",
  "public.admin_list_projects(integer,integer,text,text,text,text,text,text,text,text)",
];
const manuallyAppliedMigrationVersions = [
  "20260728090000",
  "20260729090000",
  "20260729150000",
];
const reconciledMigrationSourceHashes = new Map([
  ["20260728090000", sha256(finalRebuildMigration)],
  ["20260729090000", sha256(aclCorrectionMigration)],
  ["20260729150000", sha256(schemaParityForwardMigration)],
]);
const runtimeRoles = ["anon", "authenticated", "service_role"];
const tablePrivileges = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
  "MAINTAIN",
];
const finalNoDefaultColumns = [
  ["projects", "general_description"],
  ["projects", "short_description"],
  ["projects", "image_alt"],
  ["projects", "hero_image_alt"],
  ["projects", "small_box_image_alt"],
  ["projects", "location_label"],
  ["projects", "overview_title"],
  ["projects", "overview_body"],
  ["projects", "delivery_title"],
  ["projects", "delivery_body"],
  ["project_media", "alt_text"],
];
const finalRequiredNotNullColumns = [
  ["projects", "image"],
  ["projects", "hero_image"],
  ["projects", "small_box_image"],
  ["projects", "governorate_id"],
  ["projects", "city_id"],
  ["projects", "main_area_id"],
  ["projects", "google_maps_url"],
  ["projects", "latitude"],
  ["projects", "longitude"],
  ["projects", "map_zoom"],
];
const finalRequiredCheckConstraints = [
  ["projects", "projects_general_description_check"],
  ["projects", "projects_short_description_check"],
  ["projects", "projects_image_check"],
  ["projects", "projects_image_alt_check"],
  ["projects", "projects_hero_image_check"],
  ["projects", "projects_hero_image_alt_check"],
  ["projects", "projects_small_box_image_check"],
  ["projects", "projects_small_box_image_alt_check"],
  ["projects", "projects_location_label_check"],
  ["projects", "projects_google_maps_url_check"],
  ["projects", "projects_overview_title_check"],
  ["projects", "projects_overview_body_check"],
  ["projects", "projects_delivery_title_check"],
  ["projects", "projects_delivery_body_check"],
  ["projects", "projects_seo_title_check"],
  ["projects", "projects_seo_description_check"],
  ["projects", "projects_canonical_url_check"],
  ["projects", "projects_overview_image_required_check"],
  ["projects", "projects_overview_image_alt_check"],
  ["projects", "projects_og_image_alt_check"],
  ["project_floor_plans", "project_floor_plans_architectural_image_alt_check"],
  ["project_floor_plans", "project_floor_plans_furnishing_image_alt_check"],
  ["project_media", "project_media_alt_text_check"],
  ["project_videos", "project_videos_poster_alt_check"],
];
const expectedReferenceLocations = [
  {
    client_key: "ca100000-0000-4000-8000-000000000001",
    level: "governorate",
    parent_client_key: null,
    name_ar: "القاهرة",
    name_en: "Cairo",
    sort_order: 0,
    is_active: true,
  },
  {
    client_key: "ca100000-0000-4000-8000-000000000002",
    level: "city",
    parent_client_key: "ca100000-0000-4000-8000-000000000001",
    name_ar: "القاهرة الجديدة",
    name_en: "New Cairo",
    sort_order: 0,
    is_active: true,
  },
  {
    client_key: "ca100000-0000-4000-8000-000000000003",
    level: "main_area",
    parent_client_key: "ca100000-0000-4000-8000-000000000002",
    name_ar: "التجمع الخامس",
    name_en: "Fifth Settlement",
    sort_order: 0,
    is_active: true,
  },
  {
    client_key: "ca100000-0000-4000-8000-000000000004",
    level: "sub_area",
    parent_client_key: "ca100000-0000-4000-8000-000000000003",
    name_ar: "الحي الثاني",
    name_en: "Second District",
    sort_order: 0,
    is_active: true,
  },
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
const fixtureTextMarkerPattern = [
  "__qa",
  "qa[_-]",
  "fixture",
  "atomic-project-entry-test",
  "other-ownership-project-test",
  "project entry test governorate",
  "other test governorate",
  "test city",
  "test main area",
  "test sub area",
].join("|");

const expectedColumnDefaults = new Map([
  ["project_locations.client_key", "gen_random_uuid()"],
  ["project_locations.sort_order", "0"],
  ["project_locations.is_active", "true"],
  ["project_locations.created_at", "now()"],
  ["project_locations.updated_at", "now()"],
  ["projects.location_description", "''::text"],
  ["projects.overview_media_type", "'image'::text"],
  ["projects.overview_main_image_alt", "''::text"],
  ["projects.seo_title", "''::text"],
  ["projects.seo_description", "''::text"],
  ["projects.focus_keyword", "''::text"],
  ["projects.seo_keywords", "'{}'::text[]"],
  ["projects.og_image_alt", "''::text"],
  ["projects.featured", "false"],
  ["projects.publication_status", "'draft'::text"],
  ["projects.show_on_homepage", "false"],
  ["projects.homepage_order", "0"],
  ["projects.created_at", "now()"],
  ["projects.updated_at", "now()"],
  ["project_location_points.client_key", "gen_random_uuid()"],
  ["project_location_points.distance_text", "''::text"],
  ["project_location_points.created_at", "now()"],
  ["project_location_points.updated_at", "now()"],
  ["project_features.client_key", "gen_random_uuid()"],
  ["project_features.created_at", "now()"],
  ["project_features.updated_at", "now()"],
  ["project_floor_plans.client_key", "gen_random_uuid()"],
  ["project_floor_plans.area_text", "''::text"],
  ["project_floor_plans.featured", "false"],
  ["project_floor_plans.architectural_image_alt", "''::text"],
  ["project_floor_plans.furnishing_image_alt", "''::text"],
  ["project_floor_plans.created_at", "now()"],
  ["project_floor_plans.updated_at", "now()"],
  ["project_floor_plan_details.client_key", "gen_random_uuid()"],
  ["project_floor_plan_details.created_at", "now()"],
  ["project_floor_plan_details.updated_at", "now()"],
  ["project_delivery_items.client_key", "gen_random_uuid()"],
  ["project_delivery_items.created_at", "now()"],
  ["project_delivery_items.updated_at", "now()"],
  ["project_media.client_key", "gen_random_uuid()"],
  ["project_media.created_at", "now()"],
  ["project_media.updated_at", "now()"],
  ["project_videos.client_key", "gen_random_uuid()"],
  ["project_videos.poster_alt", "''::text"],
  ["project_videos.created_at", "now()"],
  ["project_videos.updated_at", "now()"],
]);
const expectedColumnComments = new Map([
  ["projects.code", "Stable Project code. Database-owned and distinct from the presentation name."],
  ["projects.show_on_homepage", "Database-owned Home Projects membership."],
  ["projects.homepage_order", "Database-owned Home Projects order; unique for included Projects."],
]);
const expectedMissingValueColumnKeys = new Set([
  "projects.show_on_homepage",
  "projects.homepage_order",
]);
const knownAdditiveConstraintKeys = new Set([
  "projects.projects_publication_status_check",
  "projects.projects_published_by_fkey",
  "projects.projects_code_format_check",
  "projects.projects_homepage_order_check",
  "projects.projects_brochure_url_check",
]);
const knownLegacyDefaultColumnKeys = new Set(
  finalNoDefaultColumns.map(
    ([tableName, columnName]) => `${tableName}.${columnName}`,
  ),
);

function findMatchingParenthesis(source, openingIndex) {
  let depth = 0;
  let inSingleQuote = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inSingleQuote) {
      if (character === "'" && source[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (character === "'") {
      inSingleQuote = true;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("Unbalanced CREATE TABLE body in the final rebuild migration.");
}

function splitTopLevelSqlList(source) {
  const entries = [];
  let entryStart = 0;
  let depth = 0;
  let inSingleQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inSingleQuote) {
      if (character === "'" && source[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (character === "'") {
      inSingleQuote = true;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      entries.push(source.slice(entryStart, index).trim());
      entryStart = index + 1;
    }
  }

  entries.push(source.slice(entryStart).trim());
  return entries.filter(Boolean);
}

function compactSql(source) {
  return source.replace(/\s+/gu, " ").trim();
}

function normalizeConstraintDefinition(source) {
  return compactSql(source)
    .toLowerCase()
    .replace(/\bpublic\./gu, "")
    .replace(
      /'(-?\d+(?:\.\d+)?)'(?:::(?:pg_catalog\.)?(?:smallint|integer|bigint|int2|int4|int8|numeric|decimal))+/gu,
      "$1",
    )
    .replace(/::(?:pg_catalog\.)?[a-z_][a-z0-9_]*(?:\[\])?/gu, "")
    .replace(
      /=\s*any\s*\(\s*array\s*\[([^\]]*)\]\s*\)/gu,
      " in ($1)",
    )
    .replace(
      /\b([a-z_][a-z0-9_]*)\s+between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)\b/gu,
      "$1 >= $2 and $1 <= $3",
    )
    .replace(
      /check\s*\(\s*\(\s*([a-z_][a-z0-9_]*\s*(?:=|<>)\s*'(?:''|[^'])*'\s+and\s+[a-z_][a-z0-9_]*\s+is\s+(?:not\s+)?null)\s*\)\s+or\s+\(\s*([a-z_][a-z0-9_]*\s*(?:=|<>)\s*'(?:''|[^'])*'\s+and\s+[a-z_][a-z0-9_]*\s+is\s+(?:not\s+)?null)\s*\)\s*\)/gu,
      "check ($1 or $2)",
    )
    .replace(
      /(overview_media_type\s*<>\s*'image'\s+or)\s*\(\s*(coalesce\(btrim\(overview_main_image\),\s*''\)\s*<>\s*''\s+and\s+btrim\(overview_main_image_alt\)\s*<>\s*'')\s*\)/gu,
      "$1 $2",
    )
    .replace(/\s+/gu, "");
}

function normalizeTriggerDefinition(source) {
  return compactSql(source)
    .toLowerCase()
    .replace(/;$/u, "")
    .replace(/\bpublic\./gu, "")
    .replace(/\bexecute\s+procedure\b/gu, "execute function")
    .replace(/\s*,\s*/gu, ",")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractExpectedTriggerManifest() {
  const triggers = [
    ...finalRebuildMigration.matchAll(
      /^create\s+trigger\s+([a-z_][a-z0-9_]*)\s+([\s\S]*?);\s*$/gimu,
    ),
  ].map((match) => {
    const definition = `create trigger ${match[1]} ${match[2]}`;
    const tableMatch = definition.match(
      /\bon\s+(?:public\.)?([a-z_][a-z0-9_]*)\b/iu,
    );
    if (!tableMatch || !aggregateTables.includes(tableMatch[1])) {
      throw new Error(`Could not resolve the table for trigger ${match[1]}.`);
    }

    return {
      table_name: tableMatch[1],
      trigger_name: match[1],
      expected_definition: compactSql(definition),
    };
  });

  if (triggers.length !== 4) {
    throw new Error(
      `Expected 4 user triggers in final rebuild; extracted ${triggers.length}.`,
    );
  }

  return triggers;
}

const constraintDefinitionSemanticCases = [
  {
    name: "project_locations_root_shape_check",
    expected:
      "check ( (level = 'governorate' and parent_id is null) or (level <> 'governorate' and parent_id is not null) )",
    actual:
      "CHECK (level = 'governorate'::text AND parent_id IS NULL OR level <> 'governorate'::text AND parent_id IS NOT NULL)",
  },
  {
    name: "projects_latitude_check",
    expected: "check (latitude between -90 and 90)",
    actual:
      "CHECK (latitude >= '-90'::integer::numeric AND latitude <= 90::numeric)",
  },
  {
    name: "projects_longitude_check",
    expected: "check (longitude between -180 and 180)",
    actual:
      "CHECK (longitude >= '-180'::integer::numeric AND longitude <= 180::numeric)",
  },
  {
    name: "projects_map_zoom_check",
    expected: "check (map_zoom between 1 and 22)",
    actual: "CHECK (map_zoom >= 1 AND map_zoom <= 22)",
  },
  {
    name: "projects_overview_image_required_check",
    expected:
      "check (overview_media_type <> 'image' or (coalesce(btrim(overview_main_image), '') <> '' and btrim(overview_main_image_alt) <> ''))",
    actual:
      "CHECK (overview_media_type <> 'image'::text OR COALESCE(btrim(overview_main_image), ''::text) <> ''::text AND btrim(overview_main_image_alt) <> ''::text)",
  },
];
const constraintDefinitionNegativeCases = [
  {
    name: "different latitude upper bound",
    expected: "check (latitude between -90 and 90)",
    actual:
      "CHECK (latitude >= '-90'::integer::numeric AND latitude <= 91::numeric)",
  },
  {
    name: "different map zoom boolean operator",
    expected: "check (map_zoom between 1 and 22)",
    actual: "CHECK (map_zoom >= 1 OR map_zoom <= 22)",
  },
  {
    name: "text cast is not a numeric representation",
    expected: "check (latitude between -90 and 90)",
    actual: "CHECK (latitude >= '-90'::text AND latitude <= 90::numeric)",
  },
];
const triggerDefinitionSemanticCases = [
  {
    name: "project_locations_validate_parent",
    expected:
      "create trigger project_locations_validate_parent before insert or update of level, parent_id, is_active on public.project_locations for each row execute function public.validate_project_location_parent()",
    actual:
      "CREATE TRIGGER project_locations_validate_parent BEFORE INSERT OR UPDATE OF level, parent_id, is_active ON project_locations FOR EACH ROW EXECUTE PROCEDURE validate_project_location_parent()",
  },
];
const triggerDefinitionNegativeCases = [
  {
    name: "missing is_active update column",
    expected:
      "create trigger project_locations_validate_parent before insert or update of level, parent_id, is_active on public.project_locations for each row execute function public.validate_project_location_parent()",
    actual:
      "CREATE TRIGGER project_locations_validate_parent BEFORE INSERT OR UPDATE OF level, parent_id ON project_locations FOR EACH ROW EXECUTE FUNCTION validate_project_location_parent()",
  },
];

function assertConstraintDefinitionSemanticNormalizer() {
  for (const testCase of constraintDefinitionSemanticCases) {
    if (
      normalizeConstraintDefinition(testCase.expected) !==
      normalizeConstraintDefinition(testCase.actual)
    ) {
      throw new Error(
        `Constraint definition semantic self-test failed for ${testCase.name}.`,
      );
    }
  }

  for (const testCase of constraintDefinitionNegativeCases) {
    if (
      normalizeConstraintDefinition(testCase.expected) ===
      normalizeConstraintDefinition(testCase.actual)
    ) {
      throw new Error(
        `Constraint definition negative self-test failed for ${testCase.name}.`,
      );
    }
  }
}

function assertTriggerDefinitionSemanticNormalizer() {
  for (const testCase of triggerDefinitionSemanticCases) {
    if (
      normalizeTriggerDefinition(testCase.expected) !==
      normalizeTriggerDefinition(testCase.actual)
    ) {
      throw new Error(
        `Trigger definition semantic self-test failed for ${testCase.name}.`,
      );
    }
  }

  for (const testCase of triggerDefinitionNegativeCases) {
    if (
      normalizeTriggerDefinition(testCase.expected) ===
      normalizeTriggerDefinition(testCase.actual)
    ) {
      throw new Error(
        `Trigger definition negative self-test failed for ${testCase.name}.`,
      );
    }
  }
}

function extractExpectedConstraintManifest() {
  const constraints = [];

  for (const tableName of aggregateTables) {
    const marker = `create table public.${tableName} (`;
    const statementStart = finalRebuildMigration.indexOf(marker);
    if (statementStart < 0) {
      throw new Error(`Missing CREATE TABLE public.${tableName} in final rebuild.`);
    }

    const bodyStart = finalRebuildMigration.indexOf("(", statementStart);
    const bodyEnd = findMatchingParenthesis(finalRebuildMigration, bodyStart);
    const clauses = splitTopLevelSqlList(
      finalRebuildMigration.slice(bodyStart + 1, bodyEnd),
    );

    for (const rawClause of clauses) {
      const clause = compactSql(rawClause);
      const explicit = clause.match(
        /^constraint\s+([a-z_][a-z0-9_]*)\s+([\s\S]+)$/iu,
      );
      if (explicit) {
        const definition = explicit[2];
        const type = definition.match(/^primary\s+key\b/iu)
          ? "p"
          : definition.match(/^foreign\s+key\b/iu)
            ? "f"
            : definition.match(/^unique\b/iu)
              ? "u"
              : definition.match(/^check\b/iu)
                ? "c"
                : null;
        if (!type) {
          throw new Error(`Unknown constraint type for ${tableName}.${explicit[1]}.`);
        }
        constraints.push({
          table_name: tableName,
          constraint_name: explicit[1],
          constraint_type: type,
          expected_definition: definition,
          expected_metadata: {
            validated: true,
            deferrable: /\bdeferrable\b/iu.test(definition),
            initially_deferred: /\binitially\s+deferred\b/iu.test(definition),
            inheritance_count: 0,
            is_local: true,
            no_inherit:
              type !== "c" || /\bno\s+inherit\b/iu.test(definition),
            parent_constraint_oid: "0",
          },
        });
        continue;
      }

      const columnMatch = clause.match(/^([a-z_][a-z0-9_]*)\s+/iu);
      if (!columnMatch) {
        throw new Error(`Could not parse a ${tableName} column clause: ${clause}`);
      }
      const columnName = columnMatch[1];
      const definitions = [];
      if (/\bprimary\s+key\b/iu.test(clause)) {
        definitions.push({
          name: `${tableName}_pkey`,
          type: "p",
          definition: `primary key (${columnName})`,
        });
      }
      const reference = clause.match(/\breferences\s+([\s\S]+)$/iu);
      if (reference) {
        definitions.push({
          name: `${tableName}_${columnName}_fkey`,
          type: "f",
          definition: `foreign key (${columnName}) references ${reference[1]}`,
        });
      }
      const check = clause.match(/\bcheck\s*(\([\s\S]*\))\s*$/iu);
      if (check) {
        definitions.push({
          name: `${tableName}_${columnName}_check`,
          type: "c",
          definition: `check ${check[1]}`,
        });
      }
      if (/\bunique\b/iu.test(clause)) {
        definitions.push({
          name: `${tableName}_${columnName}_key`,
          type: "u",
          definition: `unique (${columnName})`,
        });
      }

      for (const definition of definitions) {
        constraints.push({
          table_name: tableName,
          constraint_name: definition.name,
          constraint_type: definition.type,
          expected_definition: definition.definition,
          expected_metadata: {
            validated: true,
            deferrable: false,
            initially_deferred: false,
            inheritance_count: 0,
            is_local: true,
            no_inherit: definition.type !== "c",
            parent_constraint_oid: "0",
          },
        });
      }
    }
  }

  if (constraints.length !== 99) {
    throw new Error(
      `Expected 99 constraints in final rebuild; extracted ${constraints.length}.`,
    );
  }
  return constraints;
}

const expectedConstraintManifest = extractExpectedConstraintManifest();
const expectedConstraintByKey = new Map(
  expectedConstraintManifest.map((constraint) => [
    `${constraint.table_name}.${constraint.constraint_name}`,
    constraint,
  ]),
);
const expectedTriggerManifest = extractExpectedTriggerManifest();
const missingCheckConstraintKeys = new Set(
  finalRequiredCheckConstraints.map(
    ([tableName, constraintName]) => `${tableName}.${constraintName}`,
  ),
);
const expectedExistingConstraintManifest = expectedConstraintManifest.filter(
  (constraint) =>
    !missingCheckConstraintKeys.has(
      `${constraint.table_name}.${constraint.constraint_name}`,
    ),
);
const expectedExistingConstraintByKey = new Map(
  expectedExistingConstraintManifest.map((constraint) => [
    `${constraint.table_name}.${constraint.constraint_name}`,
    constraint,
  ]),
);

if (expectedExistingConstraintManifest.length !== 75) {
  throw new Error(
    `Expected 75 shared constraints; extracted ${expectedExistingConstraintManifest.length}.`,
  );
}

assertConstraintDefinitionSemanticNormalizer();
assertTriggerDefinitionSemanticNormalizer();
if (process.argv.includes("--self-test")) {
  console.log(
    `OK: schema definition semantic self-test passed ${constraintDefinitionSemanticCases.length} constraint equivalents, ${constraintDefinitionNegativeCases.length} constraint negative controls, ${triggerDefinitionSemanticCases.length} trigger equivalent, and ${triggerDefinitionNegativeCases.length} trigger negative control.`,
  );
  process.exit(0);
}

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  application_name: "project-admin-schema-parity-read-only",
});

const report = {
  audit_contract: {
    mode: "BEGIN READ ONLY with unconditional ROLLBACK",
    schema: schemaName,
    expected_tables: aggregateTables,
    expected_sequences: aggregateSequences,
    expected_functions: expectedFunctionSignatures,
    expected_rpcs: aggregateRpcSignatures,
    forbidden_legacy_functions: forbiddenLegacyFunctionSignatures,
    manually_applied_migration_versions: manuallyAppliedMigrationVersions,
    runtime_roles: runtimeRoles,
    expected_reference_locations: expectedReferenceLocations,
    fixture_client_keys: fixtureClientKeys,
    fixture_text_marker_pattern: fixtureTextMarkerPattern,
    expected_catalog_counts: {
      tables: 9,
      columns: 122,
      constraints: 104,
      indexes: 54,
      rls_policies: 0,
      user_triggers: 4,
      functions: 8,
      sequences: 9,
    },
    final_rebuild_sha256: sha256(finalRebuildMigration),
    row_actions_migration_sha256: sha256(rowActionsMigration),
    project_publishing_migration_sha256: sha256(projectPublishingMigration),
    global_truth_atomic_migration_sha256: sha256(globalTruthAtomicMigration),
    dashboard_truth_migration_sha256: sha256(dashboardTruthMigration),
    reports_analytics_migration_sha256: sha256(reportsAnalyticsMigration),
    expected_function_source_sha256: expectedFunctionSourceHashes,
    expected_function_source_md5: expectedFunctionSourceMd5s,
  },
};

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) {
    throw new Error(`Unsafe catalog identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

async function collect(name, text, values = []) {
  const result = await client.query(text, values);
  report[name] = result.rows;
}

function buildRowCountQuery() {
  return aggregateTables
    .map((table) => {
      const relation = `${quoteIdentifier(schemaName)}.${quoteIdentifier(table)}`;
      return `select '${table}'::text as table_name, count(*)::bigint as row_count from ${relation}`;
    })
    .join("\nunion all\n") + "\norder by table_name";
}

function buildClientKeyStatsQuery() {
  return clientKeyTables
    .map((table) => {
      const relation = `${quoteIdentifier(schemaName)}.${quoteIdentifier(table)}`;
      return `
        select '${table}'::text as table_name,
               count(*)::bigint as row_count,
               count(*) filter (where client_key is null)::bigint as null_count,
               count(distinct client_key)::bigint as distinct_count,
               (
                 select count(*)::bigint
                   from (
                     select duplicate.client_key
                       from ${relation} duplicate
                      group by duplicate.client_key
                     having count(*) > 1
                   ) duplicate_keys
               ) as duplicate_value_count,
               md5(
                 coalesce(
                   string_agg(id::text || ':' || client_key::text, ',' order by id),
                   ''
                 )
               ) as id_client_key_hash
          from ${relation}`;
    })
    .join("\nunion all\n") + "\norder by table_name";
}

function buildSequenceStateQuery() {
  return aggregateSequences
    .map((sequence) => {
      const relation = `${quoteIdentifier(schemaName)}.${quoteIdentifier(sequence)}`;
      return `select '${sequence}'::text as sequence_name, last_value::bigint, is_called from ${relation}`;
    })
    .join("\nunion all\n") + "\norder by sequence_name";
}

function buildQaMarkerQuery() {
  return aggregateTables
    .map((table) => {
      const relation = `${quoteIdentifier(schemaName)}.${quoteIdentifier(table)}`;
      const fixtureClientKeyPredicate = table === "projects"
        ? "false"
        : "row_record.client_key = any($1::uuid[])";
      return `
        select '${table}'::text as table_name,
               row_record.id::text as row_id,
               case
                 when ${fixtureClientKeyPredicate} then 'fixture_client_key'
                 else 'qa_text_marker'
               end as marker_type,
               to_jsonb(row_record)::text as row_snapshot
          from ${relation} row_record
         where ${fixtureClientKeyPredicate}
            or to_jsonb(row_record)::text ~* $2`;
    })
    .join("\nunion all\n") + "\norder by table_name, row_id";
}

function groupDefaultAcl(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = [
      row.creator_role,
      row.schema_name,
      row.object_type,
      row.grantee,
      row.grantor,
    ].join("\u0000");
    const entry = grouped.get(key) ?? {
      creator_role: row.creator_role,
      schema_name: row.schema_name,
      object_type: row.object_type,
      grantee: row.grantee,
      grantor: row.grantor,
      privileges: [],
    };
    entry.privileges.push(row.privilege_type);
    grouped.set(key, entry);
  }

  return [...grouped.values()].map((entry) => ({
    ...entry,
    privileges: [...new Set(entry.privileges)].sort(),
  }));
}

function isSemanticallyDefaultCompression(code) {
  return Number(code) === 0;
}

function displayCatalogChar(value) {
  if (value === "\u0000") {
    return "\\u0000";
  }
  return value;
}

function isSemanticallyDefaultStatisticsTarget(value) {
  return value === null || Number(value) === -1;
}

function buildColumnPropertyDiagnostics(fullReport) {
  const directGrantsByColumn = new Map();
  for (const grant of fullReport.direct_column_acl) {
    const key = `${grant.table_name}.${grant.column_name}`;
    const grants = directGrantsByColumn.get(key) ?? [];
    grants.push({
      grantee: grant.grantee,
      privilege_type: grant.privilege_type,
      is_grantable: grant.is_grantable,
      grantor: grant.grantor,
    });
    directGrantsByColumn.set(key, grants);
  }

  const differences = [];
  const semanticRows = fullReport.columns.map((column) => {
    const key = `${column.table_name}.${column.column_name}`;
    const directGrants = directGrantsByColumn.get(key) ?? [];
    const aclIsSemanticallyEmpty =
      directGrants.length === 0 &&
      (column.stored_column_acl === null ||
        Number(column.stored_column_acl_cardinality) === 0);
    const compressionIsSemanticallyDefault = isSemanticallyDefaultCompression(
      column.compression_code,
    );
    const expectedDefault = expectedColumnDefaults.get(key) ?? null;
    const expectedComment = expectedColumnComments.get(key) ?? null;
    const expectedMissingValue = expectedMissingValueColumnKeys.has(key);
    const legacyDefaultAllowed =
      knownLegacyDefaultColumnKeys.has(key) &&
      column.default_expression === "''::text";
    const defaultMatchesExpected =
      column.default_expression === expectedDefault || legacyDefaultAllowed;

    const addDifference = ({
      property,
      expected,
      actual,
      classification,
      semanticMatch,
      reason,
    }) => {
      const allowedPreFixDrift =
        property === "column_default" && legacyDefaultAllowed;
      differences.push({
        table_name: column.table_name,
        column_name: column.column_name,
        property,
        expected,
        actual,
        semantic_match: semanticMatch,
        classification,
        reason,
        allowed_pre_fix_drift: allowedPreFixDrift,
        status: allowedPreFixDrift
          ? "B_allowed_pre_fix_drift"
          : semanticMatch
            ? "A_representation_equivalent"
            : "B_unexpected_drift",
      });
    };

    if (!column.uses_type_default_collation) {
      addDifference({
        property: "attcollation",
        expected: "underlying type default collation",
        actual: column.collation,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column collation differs from its underlying type default.",
      });
    }
    if (!column.uses_type_default_storage) {
      addDifference({
        property: "attstorage",
        expected: column.type_default_storage_strategy,
        actual: column.storage_strategy,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column storage strategy differs from its type default.",
      });
    }
    if (!compressionIsSemanticallyDefault) {
      addDifference({
        property: "attcompression",
        expected: "not configured (internal NUL/empty representation)",
        actual: {
          text: displayCatalogChar(column.compression_method),
          code: column.compression_code,
          octets: column.compression_method_octets,
        },
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "An explicit per-column compression method is configured.",
      });
    } else if (column.compression_method !== "") {
      addDifference({
        property: "attcompression",
        expected: "not configured",
        actual: {
          text: displayCatalogChar(column.compression_method),
          code: column.compression_code,
          octets: column.compression_method_octets,
        },
        semanticMatch: true,
        classification: "A. Audit Predicate Bug / PostgreSQL internal representation",
        reason: "PostgreSQL returned the internal NUL marker instead of empty text.",
      });
    }
    if (column.inheritance_count !== 0) {
      addDifference({
        property: "attinhcount",
        expected: 0,
        actual: column.inheritance_count,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column has inherited ancestors.",
      });
    }
    if (!column.is_local) {
      addDifference({
        property: "attislocal",
        expected: true,
        actual: column.is_local,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column is not locally defined.",
      });
    }
    if (!isSemanticallyDefaultStatisticsTarget(column.statistics_target)) {
      addDifference({
        property: "attstattarget",
        expected: "system default (NULL in PostgreSQL 17; -1 in older releases)",
        actual: column.statistics_target,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column has an explicit non-default statistics target.",
      });
    } else if (column.statistics_target === null) {
      addDifference({
        property: "attstattarget",
        expected: "system default",
        actual: null,
        semanticMatch: true,
        classification: "A. Audit Predicate Bug / PostgreSQL 17 representation",
        reason:
          "PostgreSQL 17 represents the default statistics target as NULL instead of -1.",
      });
    }
    if (column.has_missing_value !== expectedMissingValue) {
      addDifference({
        property: "atthasmissing",
        expected: expectedMissingValue,
        actual: column.has_missing_value,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column missing-value state differs from the additive migration contract.",
      });
    }
    if (!aclIsSemanticallyEmpty) {
      addDifference({
        property: "attacl",
        expected: "no effective stored column grants",
        actual: {
          stored_acl: column.stored_column_acl,
          cardinality: column.stored_column_acl_cardinality,
          direct_grants: directGrants,
        },
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "At least one direct column grant exists or the ACL representation is not empty.",
      });
    } else if (column.stored_column_acl !== null) {
      addDifference({
        property: "attacl",
        expected: "no effective stored column grants",
        actual: {
          stored_acl: column.stored_column_acl,
          cardinality: column.stored_column_acl_cardinality,
          direct_grants: directGrants,
        },
        semanticMatch: true,
        classification: "A. Audit Predicate Bug / PostgreSQL internal representation",
        reason: "An empty ACL array is equivalent to NULL because the grant audit is empty.",
      });
    }
    if (column.comment !== expectedComment) {
      addDifference({
        property: "column_comment",
        expected: expectedComment,
        actual: column.comment,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: "Column comment differs from the reconciled migration contract.",
      });
    }
    if (column.default_expression !== expectedDefault) {
      addDifference({
        property: "column_default",
        expected: expectedDefault,
        actual: column.default_expression,
        semanticMatch: false,
        classification: "B. Real Schema Drift",
        reason: legacyDefaultAllowed
          ? "Known pre-fix empty-text default; explicitly repaired by the forward fix."
          : "Column default differs from the final rebuild contract.",
      });
    }

    return {
      table_name: column.table_name,
      column_name: column.column_name,
      storage_matches: column.uses_type_default_storage,
      compression_matches_semantically: compressionIsSemanticallyDefault,
      inheritance_matches:
        column.inheritance_count === 0 && column.is_local,
      acl_matches_semantically: aclIsSemanticallyEmpty,
      comment_matches: column.comment === expectedComment,
      default_matches_pre_fix_or_final: defaultMatchesExpected,
      statistics_and_missing_value_match:
        isSemanticallyDefaultStatisticsTarget(column.statistics_target) &&
        column.has_missing_value === expectedMissingValue,
      collation_matches: column.uses_type_default_collation,
    };
  });

  return { differences, semanticRows };
}

function buildConstraintDiagnostics(fullReport) {
  const actualByKey = new Map(
    fullReport.constraints.map((constraint) => [
      `${constraint.table_name}.${constraint.constraint_name}`,
      constraint,
    ]),
  );
  const propertyNames = [
    "validated",
    "deferrable",
    "initially_deferred",
    "inheritance_count",
    "is_local",
    "no_inherit",
    "parent_constraint_oid",
  ];
  const compareConstraint = (expected) => {
    const key = `${expected.table_name}.${expected.constraint_name}`;
    const actual = actualByKey.get(key) ?? null;
    const metadataDifferences = actual
      ? [
          ...(actual.constraint_type === expected.constraint_type
            ? []
            : [{
                property: "constraint_type",
                expected: expected.constraint_type,
                actual: actual.constraint_type,
                semantic_match: false,
                classification: "B. Real Schema Drift",
              }]),
          ...propertyNames.flatMap((property) => {
          const expectedValue = expected.expected_metadata[property];
          const actualValue = property === "parent_constraint_oid"
            ? String(actual[property])
            : actual[property];
          return actualValue === expectedValue
            ? []
            : [{
                property,
                expected: expectedValue,
                actual: actualValue,
                semantic_match: false,
                classification: "B. Real Schema Drift",
              }];
          }),
        ]
      : [{
          property: "presence",
          expected: true,
          actual: false,
          semantic_match: false,
          classification: "B. Real Schema Drift",
        }];
    const expectedDefinitionCanonical = normalizeConstraintDefinition(
      expected.expected_definition,
    );
    const actualDefinitionCanonical = actual
      ? normalizeConstraintDefinition(actual.definition)
      : null;
    const definitionMatches =
      actualDefinitionCanonical === expectedDefinitionCanonical;

    return {
      table_name: expected.table_name,
      constraint_name: expected.constraint_name,
      constraint_type: expected.constraint_type,
      actual_constraint_type: actual?.constraint_type ?? null,
      expected_metadata: expected.expected_metadata,
      actual_metadata: actual
        ? Object.fromEntries(
            propertyNames.map((property) => [
              property,
              property === "parent_constraint_oid"
                ? String(actual[property])
                : actual[property],
            ]),
          )
        : null,
      metadata_differences: metadataDifferences,
      expected_definition: expected.expected_definition,
      actual_definition: actual?.definition ?? null,
      definition_comparison: {
        expected_canonical: expectedDefinitionCanonical,
        actual_canonical: actualDefinitionCanonical,
        semantic_match: definitionMatches,
        classification: definitionMatches
          ? "match"
          : "B. Real Schema Drift",
      },
      actual_present: Boolean(actual),
    };
  };
  const all = expectedConstraintManifest.map(compareConstraint);
  const shared = all.filter((constraint) =>
    expectedExistingConstraintByKey.has(
      `${constraint.table_name}.${constraint.constraint_name}`,
    ));
  const expectedKeys = new Set(expectedConstraintByKey.keys());
  const unexpectedActual = fullReport.constraints.filter(
    (constraint) =>
      !expectedKeys.has(`${constraint.table_name}.${constraint.constraint_name}`)
      && !knownAdditiveConstraintKeys.has(`${constraint.table_name}.${constraint.constraint_name}`),
  );
  const legacyPredicateFailures = shared
    .filter(
      (constraint) =>
        constraint.actual_present &&
        constraint.actual_metadata.no_inherit &&
        constraint.expected_metadata.no_inherit,
    )
    .map((constraint) => ({
      ...constraint,
      predicate_difference: {
        property: "connoinherit",
        old_audit_expected: false,
        semantic_expected: constraint.expected_metadata.no_inherit,
        actual: constraint.actual_metadata.no_inherit,
        semantic_match:
          constraint.actual_metadata.no_inherit ===
          constraint.expected_metadata.no_inherit,
        classification: "A. Audit Predicate Bug / PostgreSQL constraint semantics",
        reason:
          "Primary, unique, and foreign-key constraints are non-inheritable; CHECK constraints remain inheritable unless declared NO INHERIT.",
      },
    }));

  return {
    all,
    shared,
    mismatches: all.filter(
      (constraint) =>
        constraint.metadata_differences.length > 0 ||
        !constraint.definition_comparison.semantic_match,
    ),
    sharedMismatches: shared.filter(
      (constraint) =>
        constraint.metadata_differences.length > 0 ||
        !constraint.definition_comparison.semantic_match,
    ),
    unexpectedActual,
    legacyPredicateFailures,
  };
}

function buildTriggerDiagnostics(fullReport) {
  const actualUserTriggers = fullReport.triggers.filter(
    (trigger) => !trigger.is_internal,
  );
  const actualByKey = new Map(
    actualUserTriggers.map((trigger) => [
      `${trigger.table_name}.${trigger.trigger_name}`,
      trigger,
    ]),
  );
  const expectedKeys = new Set(
    expectedTriggerManifest.map(
      (trigger) => `${trigger.table_name}.${trigger.trigger_name}`,
    ),
  );
  const definitions = expectedTriggerManifest.map((expected) => {
    const key = `${expected.table_name}.${expected.trigger_name}`;
    const actual = actualByKey.get(key) ?? null;
    const expectedCanonical = normalizeTriggerDefinition(
      expected.expected_definition,
    );
    const actualCanonical = actual
      ? normalizeTriggerDefinition(actual.definition)
      : null;

    return {
      table_name: expected.table_name,
      trigger_name: expected.trigger_name,
      present: Boolean(actual),
      expected_definition: expected.expected_definition,
      actual_definition: actual?.definition ?? null,
      expected_canonical: expectedCanonical,
      actual_canonical: actualCanonical,
      semantic_match: expectedCanonical === actualCanonical,
    };
  });
  const unexpectedActual = actualUserTriggers.filter(
    (trigger) =>
      !expectedKeys.has(`${trigger.table_name}.${trigger.trigger_name}`),
  );

  return {
    definitions,
    mismatches: definitions.filter((trigger) => !trigger.semantic_match),
    unexpectedActual,
  };
}

function buildCompactReport(fullReport) {
  return {
    audit_contract: fullReport.audit_contract,
    session: fullReport.session,
    object_presence: fullReport.object_presence,
    tables: fullReport.tables,
    columns: fullReport.columns.map((column) => ({
      table_name: column.table_name,
      ordinal_position: column.ordinal_position,
      column_name: column.column_name,
      data_type: column.data_type,
      not_null: column.not_null,
      identity_kind: column.identity_kind,
      generated_kind: column.generated_kind,
      default_expression: column.default_expression,
      collation: column.collation,
      stored_column_acl: column.stored_column_acl,
    })),
    constraints: fullReport.constraints,
    indexes: fullReport.indexes.map((index) => ({
      table_name: index.table_name,
      index_name: index.index_name,
      access_method: index.access_method,
      is_unique: index.is_unique,
      is_primary: index.is_primary,
      is_immediate: index.is_immediate,
      is_valid: index.is_valid,
      is_ready: index.is_ready,
      predicate: index.predicate,
      expressions: index.expressions,
      definition: index.definition,
    })),
    rls_policies: fullReport.rls_policies,
    user_triggers: fullReport.triggers.filter((trigger) => !trigger.is_internal),
    functions: fullReport.functions,
    forbidden_legacy_function_presence:
      fullReport.forbidden_legacy_function_presence,
    direct_relation_acl: fullReport.direct_relation_acl,
    direct_column_acl: fullReport.direct_column_acl,
    runtime_effective_table_acl: fullReport.runtime_effective_table_acl.filter(
      (entry) => entry.allowed,
    ),
    all_roles_effective_table_dml: fullReport.all_roles_effective_table_dml,
    runtime_effective_sequence_acl:
      fullReport.runtime_effective_sequence_acl.filter((entry) => entry.allowed),
    runtime_effective_function_acl:
      fullReport.runtime_effective_function_acl.filter(
        (entry) => entry.execute_allowed,
      ),
    direct_function_acl: fullReport.direct_function_acl,
    schema_acl: fullReport.schema_acl,
    runtime_effective_schema_acl: fullReport.runtime_effective_schema_acl,
    default_acl: groupDefaultAcl(fullReport.default_acl),
    role_attributes: fullReport.role_attributes,
    role_memberships: fullReport.role_memberships,
    sequences: fullReport.sequences,
    sequence_state: fullReport.sequence_state,
    sequence_ownership: fullReport.sequence_ownership,
    row_counts: fullReport.row_counts,
    project_identity_snapshot: fullReport.project_identity_snapshot,
    client_key_stats: fullReport.client_key_stats,
    qa_marker_residue: fullReport.qa_marker_residue,
    reference_locations: fullReport.reference_locations,
    location_counts: fullReport.location_counts,
    reference_location_parity: fullReport.reference_location_parity,
    migration_registry: fullReport.migration_registry,
  };
}

function buildParitySummary(fullReport) {
  const diagnosticsRequested = process.argv.includes("--diagnostics");
  const noDefaultColumnKeys = new Set(
    finalNoDefaultColumns.map(([tableName, columnName]) => `${tableName}.${columnName}`),
  );
  const requiredNotNullColumnKeys = new Set(
    finalRequiredNotNullColumns.map(
      ([tableName, columnName]) => `${tableName}.${columnName}`,
    ),
  );
  const expectedFunctionProperties = new Map([
    ["save_project_admin_entry(bigint,jsonb)", { securityDefiner: true, returnType: "record", returnsSet: true, defaultArguments: 2 }],
    ["delete_project_admin_entry(bigint)", { securityDefiner: true, returnType: "record", returnsSet: true, defaultArguments: 0 }],
    ["set_project_featured_admin_entry(bigint,boolean)", { securityDefiner: true, returnType: "record", returnsSet: true, defaultArguments: 0 }],
    ["duplicate_project_admin_entry(bigint)", { securityDefiner: true, returnType: "record", returnsSet: true, defaultArguments: 0 }],
    ["validate_project_location_parent()", { securityDefiner: false, returnType: "trigger", returnsSet: false, defaultArguments: 0 }],
    ["prevent_project_type_change()", { securityDefiner: false, returnType: "trigger", returnsSet: false, defaultArguments: 0 }],
    ["validate_project_location_selection()", { securityDefiner: false, returnType: "trigger", returnsSet: false, defaultArguments: 0 }],
    ["prevent_project_location_reparent()", { securityDefiner: false, returnType: "trigger", returnsSet: false, defaultArguments: 0 }],
  ]);
  const columnByName = new Map(
    fullReport.columns.map((column) => [
      `${column.table_name}.${column.column_name}`,
      column,
    ]),
  );
  const actualConstraintKeys = new Set(
    fullReport.constraints.map(
      (constraint) => `${constraint.table_name}.${constraint.constraint_name}`,
    ),
  );
  const functionBodyDrift = fullReport.functions
    .filter((functionRecord) => !functionRecord.source_matches_final_rebuild)
    .map((functionRecord) => ({
      function_name: functionRecord.function_name,
      actual_source_sha256: functionRecord.source_sha256,
      expected_source_sha256: functionRecord.expected_source_sha256,
    }));
  const locationTriggerDrift = fullReport.triggers
    .filter(
      (trigger) =>
        !trigger.is_internal &&
        trigger.table_name === "project_locations" &&
        [
          "project_locations_validate_parent",
          "project_locations_prevent_reparent",
        ].includes(trigger.trigger_name) &&
        !trigger.definition.includes("is_active"),
    )
    .map((trigger) => ({
      trigger_name: trigger.trigger_name,
      actual_definition: trigger.definition,
      expected_update_column: "is_active",
    }));
  const effectiveRuntimeTableGrants = fullReport.runtime_effective_table_acl
    .filter((entry) => entry.allowed)
    .map((entry) => `${entry.role_name}:${entry.table_name}:${entry.privilege}`)
    .sort();
  const expectedRuntimeTableGrants = aggregateTables
    .map((table) => `service_role:${table}:SELECT`)
    .sort();
  const effectiveRuntimeFunctionGrants = fullReport.runtime_effective_function_acl
    .filter((entry) => entry.execute_allowed)
    .map((entry) => `${entry.role_name}:${entry.function_name}`)
    .sort();
  const constraintCounts = Object.fromEntries(
    ["p", "f", "u", "c"].map((constraintType) => [
      constraintType,
      fullReport.constraints.filter(
        (constraint) => constraint.constraint_type === constraintType,
      ).length,
    ]),
  );
  const projectedFinalColumns = fullReport.columns.map((column) => {
    const key = `${column.table_name}.${column.column_name}`;
    return {
      ...column,
      not_null: requiredNotNullColumnKeys.has(key) ? true : column.not_null,
      has_default: noDefaultColumnKeys.has(key) ? false : column.has_default,
      default_expression: noDefaultColumnKeys.has(key)
        ? null
        : column.default_expression,
    };
  });
  const columnPropertyDiagnostics = buildColumnPropertyDiagnostics(fullReport);
  const constraintDiagnostics = buildConstraintDiagnostics(fullReport);
  const triggerDiagnostics = buildTriggerDiagnostics(fullReport);
  const missingObjects = fullReport.object_presence.filter(
    (object) => !object.present,
  );
  const columnDrift = [
    ...finalNoDefaultColumns.flatMap(([tableName, columnName]) => {
      const actual = columnByName.get(`${tableName}.${columnName}`);
      return actual?.default_expression == null
        ? []
        : [
            {
              object_name: `${tableName}.${columnName}`,
              property: "default",
              expected: null,
              actual: actual.default_expression,
              forward_fix: "ALTER COLUMN DROP DEFAULT (metadata only)",
            },
          ];
    }),
    ...finalRequiredNotNullColumns.flatMap(([tableName, columnName]) => {
      const actual = columnByName.get(`${tableName}.${columnName}`);
      return actual?.not_null
        ? []
        : [
            {
              object_name: `${tableName}.${columnName}`,
              property: "not_null",
              expected: true,
              actual: actual?.not_null ?? null,
              forward_fix:
                "Validate existing data, then ALTER COLUMN SET NOT NULL",
            },
          ];
    }),
  ];
  const missingCheckConstraints = finalRequiredCheckConstraints
    .filter(
      ([tableName, constraintName]) =>
        !actualConstraintKeys.has(`${tableName}.${constraintName}`),
    )
    .map(([tableName, constraintName]) => ({
      table_name: tableName,
      constraint_name: constraintName,
      forward_fix: "Add the exact final validated CHECK constraint",
    }));
  const referenceLocationDrift = fullReport.reference_location_parity.filter(
    (location) => !location.matches_expected,
  );
  const actualCatalogCounts = {
    tables: fullReport.tables.length,
    columns: fullReport.columns.length,
    constraints: fullReport.constraints.length,
    indexes: fullReport.indexes.length,
    rls_policies: fullReport.rls_policies.length,
    user_triggers: fullReport.triggers.filter((trigger) => !trigger.is_internal)
      .length,
    functions: fullReport.functions.length,
    sequences: fullReport.sequences.length,
  };

  return {
    audit_contract: fullReport.audit_contract,
    session: fullReport.session,
    actual_catalog_counts: actualCatalogCounts,
    catalog_fingerprints: {
      actual_columns_sha256: sha256(JSON.stringify(fullReport.columns)),
      projected_final_columns_sha256: sha256(JSON.stringify(projectedFinalColumns)),
      actual_constraints_sha256: sha256(JSON.stringify(fullReport.constraints)),
      actual_indexes_sha256: sha256(JSON.stringify(fullReport.indexes)),
      actual_triggers_sha256: sha256(JSON.stringify(fullReport.triggers)),
      actual_functions_sha256: sha256(JSON.stringify(fullReport.functions)),
    },
    missing_objects: missingObjects,
    column_drift: columnDrift,
    column_property_diagnostics: {
      differences: columnPropertyDiagnostics.differences,
      semantic_column_count: columnPropertyDiagnostics.semanticRows.length,
    },
    missing_check_constraints: missingCheckConstraints,
    existing_constraint_diagnostics: {
      expected_final_count: expectedConstraintManifest.length + knownAdditiveConstraintKeys.size,
      actual_final_count: fullReport.constraints.length,
      expected_shared_count: expectedExistingConstraintManifest.length,
      actual_shared_count: constraintDiagnostics.shared.filter(
        (constraint) => constraint.actual_present,
      ).length,
      missing_final_check_count: missingCheckConstraints.length,
      metadata_mismatches: constraintDiagnostics.mismatches,
      shared_metadata_mismatches: constraintDiagnostics.sharedMismatches,
      legacy_predicate_failures: constraintDiagnostics.legacyPredicateFailures,
      unexpected_actual_constraints: constraintDiagnostics.unexpectedActual,
      definition_pairs: diagnosticsRequested ? constraintDiagnostics.all : [],
    },
    function_body_drift: functionBodyDrift,
    location_trigger_drift: locationTriggerDrift,
    trigger_definition_drift: triggerDiagnostics.mismatches,
    trigger_definition_diagnostics: {
      expected_count: expectedTriggerManifest.length,
      actual_count: fullReport.triggers.filter((trigger) => !trigger.is_internal)
        .length,
      unexpected_actual_triggers: triggerDiagnostics.unexpectedActual,
      definition_pairs: diagnosticsRequested ? triggerDiagnostics.definitions : [],
    },
    reference_location_drift: referenceLocationDrift,
    function_signature_and_security: fullReport.functions.map((functionRecord) => ({
      function_name: functionRecord.function_name,
      owner: functionRecord.owner,
      language: functionRecord.language,
      security_definer: functionRecord.security_definer,
      returns_set: functionRecord.returns_set,
      result_type: functionRecord.result_type,
      default_argument_count: functionRecord.default_argument_count,
      volatility: functionRecord.volatility,
      parallel_safety: functionRecord.parallel_safety,
      search_path_setting: functionRecord.search_path_setting,
    })),
    effective_runtime_function_grants: effectiveRuntimeFunctionGrants,
    matched_invariants: {
      exact_catalog_counts:
        JSON.stringify(actualCatalogCounts) ===
        JSON.stringify(fullReport.audit_contract.expected_catalog_counts),
      all_tables_and_sequences_present: fullReport.object_presence.every(
        (object) => object.present,
      ),
      table_shape_rls_and_owner:
        fullReport.tables.length === aggregateTables.length &&
        fullReport.tables.every(
          (table) =>
            table.relkind === "r" &&
            table.relpersistence === "p" &&
            table.owner === "postgres" &&
            table.access_method === "heap" &&
            table.rls_enabled &&
            !table.rls_forced &&
            !table.is_partition,
        ),
      column_storage_inheritance_acl_and_comment_defaults:
        columnPropertyDiagnostics.semanticRows.length === fullReport.columns.length &&
        fullReport.columns.length > 0 &&
        columnPropertyDiagnostics.semanticRows.every(
          (column) =>
            column.collation_matches &&
            column.storage_matches &&
            column.compression_matches_semantically &&
            column.statistics_and_missing_value_match &&
            column.inheritance_matches &&
            column.acl_matches_semantically &&
            column.comment_matches &&
            column.default_matches_pre_fix_or_final,
        ),
      column_defaults_and_not_null_match_final_rebuild: columnDrift.length === 0,
      index_inventory_valid_ready:
        fullReport.indexes.length === 54 &&
        fullReport.indexes.every(
          (index) => index.is_valid && index.is_ready && index.is_live,
        ),
      no_rls_policies: fullReport.rls_policies.length === 0,
      primary_foreign_unique_inventory:
        constraintCounts.p === 9 &&
        constraintCounts.f === 13 &&
        constraintCounts.u === 24,
      existing_constraint_metadata:
        constraintDiagnostics.all.length === expectedConstraintManifest.length &&
        constraintDiagnostics.all.every(
          (constraint) =>
            constraint.actual_present &&
            constraint.metadata_differences.length === 0 &&
            constraint.definition_comparison.semantic_match,
        ) &&
        constraintDiagnostics.unexpectedActual.length === 0 &&
        [...knownAdditiveConstraintKeys].every((key) => actualConstraintKeys.has(key)),
      shared_existing_constraint_metadata:
        constraintDiagnostics.shared.length ===
          expectedExistingConstraintManifest.length &&
        constraintDiagnostics.shared.every(
          (constraint) =>
            constraint.actual_present &&
            constraint.metadata_differences.length === 0 &&
            constraint.definition_comparison.semantic_match,
        ),
      trigger_definitions_match_final_rebuild:
        triggerDiagnostics.definitions.length === expectedTriggerManifest.length &&
        triggerDiagnostics.mismatches.length === 0 &&
        triggerDiagnostics.unexpectedActual.length === 0,
      function_signature_security_owner_and_search_path:
        fullReport.function_presence.every((functionRecord) => functionRecord.present) &&
        fullReport.functions.length === expectedFunctionProperties.size &&
        fullReport.functions.every((functionRecord) => {
          const expected = expectedFunctionProperties.get(
            functionRecord.function_name.replace(/^public\./u, ""),
          );
          if (!expected) {
            return false;
          }

          const resultMatches = expected.returnType === "record"
            ? functionRecord.result_type.startsWith("TABLE(")
            : functionRecord.result_type === expected.returnType;

          return resultMatches &&
            functionRecord.function_kind === "f" &&
            functionRecord.language === "plpgsql" &&
            functionRecord.owner === "postgres" &&
            functionRecord.security_definer === expected.securityDefiner &&
            !functionRecord.leakproof &&
            !functionRecord.strict &&
            functionRecord.returns_set === expected.returnsSet;
        }) &&
        fullReport.functions.every((functionRecord) => {
          const expected = expectedFunctionProperties.get(
            functionRecord.function_name.replace(/^public\./u, ""),
          );
          return functionRecord.volatility === "v" &&
            functionRecord.parallel_safety === "u" &&
            Number(functionRecord.default_argument_count) === expected.defaultArguments &&
            functionRecord.search_path_setting === "search_path=pg_catalog, pg_temp";
        }),
      no_direct_column_grants: fullReport.direct_column_acl.length === 0,
      runtime_table_acl_is_service_select_only:
        JSON.stringify(effectiveRuntimeTableGrants) ===
        JSON.stringify(expectedRuntimeTableGrants),
      runtime_sequence_acl_empty:
        fullReport.runtime_effective_sequence_acl.every((entry) => !entry.allowed),
      runtime_function_acl_is_service_rpc_only:
        JSON.stringify(effectiveRuntimeFunctionGrants) ===
        JSON.stringify([
          "service_role:delete_project_admin_entry(bigint)",
          "service_role:duplicate_project_admin_entry(bigint)",
          "service_role:save_project_admin_entry(bigint,jsonb)",
          "service_role:set_project_featured_admin_entry(bigint,boolean)",
        ]),
      forbidden_legacy_functions_absent:
        fullReport.forbidden_legacy_function_presence.every(
          (functionRecord) => !functionRecord.present,
        ),
      function_bodies_match_final_rebuild: functionBodyDrift.length === 0,
      reference_locations_match_final_rebuild:
        fullReport.reference_location_parity.length ===
          expectedReferenceLocations.length &&
        referenceLocationDrift.length === 0,
      identity_sequence_contract:
        fullReport.sequences.length === 9 &&
        fullReport.sequence_ownership.length === 9 &&
        fullReport.sequences.every(
          (sequence) =>
            sequence.owner === "postgres" &&
            sequence.data_type === "bigint" &&
            sequence.start_value === "1" &&
            sequence.increment_by === "1" &&
            sequence.min_value === "1" &&
            sequence.max_value === "9223372036854775807" &&
            sequence.cache_size === "1" &&
            !sequence.cycle,
        ),
    },
    data_integrity_snapshot: {
      row_counts: fullReport.row_counts,
      project_ids: fullReport.project_identity_snapshot,
      client_key_stats: fullReport.client_key_stats,
      sequence_state: fullReport.sequence_state,
      reference_locations: fullReport.reference_location_parity,
      location_counts: fullReport.location_counts,
      qa_marker_residue: fullReport.qa_marker_residue,
    },
    migration_registry: fullReport.migration_registry,
    default_acl_observed_not_modified: groupDefaultAcl(fullReport.default_acl),
  };
}

function buildExpectedPreFixGate(summary) {
  const sort = (values) => [...values].sort();
  const same = (actual, expected) =>
    JSON.stringify(sort(actual)) === JSON.stringify(sort(expected));
  const expectedColumnDrift = [
    ...finalNoDefaultColumns.map(
      ([tableName, columnName]) => `${tableName}.${columnName}:default`,
    ),
    ...finalRequiredNotNullColumns.map(
      ([tableName, columnName]) => `${tableName}.${columnName}:not_null`,
    ),
  ];
  const expectedFunctionBodyDrift = [
    "save_project_admin_entry(bigint,jsonb)",
    "validate_project_location_parent()",
    "validate_project_location_selection()",
    "prevent_project_location_reparent()",
  ];
  const expectedTriggerDrift = [
    "project_locations_validate_parent",
    "project_locations_prevent_reparent",
  ];
  const expectedCounts = {
    tables: 9,
    columns: 114,
    constraints: 75,
    indexes: 44,
    rls_policies: 0,
    user_triggers: 4,
    functions: 6,
    sequences: 9,
  };
  const checks = {
    read_only_transaction: summary.session[0]?.transaction_read_only === "on",
    exact_pre_fix_catalog_counts:
      JSON.stringify(summary.actual_catalog_counts) === JSON.stringify(expectedCounts),
    no_missing_objects: summary.missing_objects.length === 0,
    exact_column_drift: same(
      summary.column_drift.map(
        (entry) => `${entry.object_name}:${entry.property}`,
      ),
      expectedColumnDrift,
    ),
    exact_missing_checks: same(
      summary.missing_check_constraints.map((entry) => entry.constraint_name),
      finalRequiredCheckConstraints.map(([, constraintName]) => constraintName),
    ),
    exact_function_body_drift: same(
      summary.function_body_drift.map((entry) =>
        entry.function_name.replace(/^public\./u, "")
      ),
      expectedFunctionBodyDrift,
    ),
    exact_location_trigger_drift: same(
      summary.location_trigger_drift.map((entry) => entry.trigger_name),
      expectedTriggerDrift,
    ),
    exact_missing_reference_locations:
      summary.reference_location_drift.length === expectedReferenceLocations.length &&
      summary.reference_location_drift.every(
        (entry) => !entry.present && entry.mismatches.includes("missing"),
      ),
    column_storage_inheritance_acl_and_comment_defaults:
      summary.matched_invariants
        .column_storage_inheritance_acl_and_comment_defaults === true,
    existing_constraint_metadata:
      summary.matched_invariants.shared_existing_constraint_metadata === true,
    acl_pass:
      summary.matched_invariants.no_direct_column_grants === true &&
      summary.matched_invariants.runtime_table_acl_is_service_select_only === true &&
      summary.matched_invariants.runtime_sequence_acl_empty === true &&
      JSON.stringify(summary.effective_runtime_function_grants) ===
        JSON.stringify([
          "service_role:delete_project_admin_entry(bigint)",
          "service_role:save_project_admin_entry(bigint,jsonb)",
        ]),
    all_non_drift_invariants_match:
      summary.all_non_drift_invariants_match === true,
    aggregate_is_empty:
      summary.data_integrity_snapshot.row_counts.length === aggregateTables.length &&
      summary.data_integrity_snapshot.row_counts.every(
        (entry) => Number(entry.row_count) === 0,
      ) &&
      summary.data_integrity_snapshot.project_ids.length === 0 &&
      summary.data_integrity_snapshot.client_key_stats.every(
        (entry) =>
          Number(entry.row_count) === 0 &&
          Number(entry.null_count) === 0 &&
          Number(entry.distinct_count) === 0 &&
          Number(entry.duplicate_value_count) === 0,
      ),
    identity_sequences_uncalled:
      summary.data_integrity_snapshot.sequence_state.length ===
        aggregateSequences.length &&
      summary.data_integrity_snapshot.sequence_state.every(
        (entry) => entry.is_called === false,
      ),
    manual_migrations_absent_from_registry: summary.migration_registry.length === 0,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function buildAclPass(summary) {
  const checks = {
    no_direct_column_grants:
      summary.matched_invariants.no_direct_column_grants === true,
    runtime_table_acl_is_service_select_only:
      summary.matched_invariants.runtime_table_acl_is_service_select_only === true,
    runtime_sequence_acl_empty:
      summary.matched_invariants.runtime_sequence_acl_empty === true,
    runtime_function_acl_is_service_rpc_only:
      summary.matched_invariants.runtime_function_acl_is_service_rpc_only === true,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function buildDataIntegrityPass(summary) {
  const expectedPostClosureRowCounts = new Map([
    ["project_locations", 9],
    ["projects", 13],
    ["project_location_points", 15],
    ["project_features", 99],
    ["project_floor_plans", 32],
    ["project_floor_plan_details", 152],
    ["project_delivery_items", 102],
    ["project_media", 137],
    ["project_videos", 0],
  ]);
  const rowCounts = new Map(
    summary.data_integrity_snapshot.row_counts.map((entry) => [
      entry.table_name,
      Number(entry.row_count),
    ]),
  );
  const clientKeyStats = new Map(
    summary.data_integrity_snapshot.client_key_stats.map((entry) => [
      entry.table_name,
      entry,
    ]),
  );
  const sequenceState = new Map(
    summary.data_integrity_snapshot.sequence_state.map((entry) => [
      entry.sequence_name.replace(/^public\./u, ""),
      entry,
    ]),
  );
  const expectedLocationCounts = new Map([
    ["governorate:true", 1],
    ["city:true", 1],
    ["main_area:true", 2],
    ["sub_area:true", 5],
  ]);
  const actualLocationCounts = new Map(
    summary.data_integrity_snapshot.location_counts.map((entry) => [
      `${entry.level}:${entry.is_active}`,
      Number(entry.row_count),
    ]),
  );
  const checks = {
    exact_aggregate_row_counts:
      rowCounts.size === aggregateTables.length &&
      [...expectedPostClosureRowCounts].every(([table, count]) => rowCounts.get(table) === count),
    project_catalog_ids_complete:
      summary.data_integrity_snapshot.project_ids.length === 13,
    client_keys_are_complete_unique_and_expected:
      clientKeyStats.size === clientKeyTables.length &&
      clientKeyTables.every((table) => {
        const stats = clientKeyStats.get(table);
        if (!stats) {
          return false;
        }
        const expectedRows = expectedPostClosureRowCounts.get(table) ?? 0;
        return Number(stats.row_count) === expectedRows &&
          Number(stats.null_count) === 0 &&
          Number(stats.distinct_count) === expectedRows &&
          Number(stats.duplicate_value_count) === 0;
      }),
    reference_location_tree_matches_final_rebuild:
      summary.data_integrity_snapshot.reference_locations.length ===
        expectedReferenceLocations.length &&
      summary.data_integrity_snapshot.reference_locations.every(
        (location) => location.present && location.matches_expected,
      ) &&
      actualLocationCounts.size === expectedLocationCounts.size &&
      [...expectedLocationCounts].every(
        ([key, expectedCount]) =>
          actualLocationCounts.get(key) === expectedCount,
      ),
    exact_sequence_state:
      sequenceState.size === aggregateSequences.length &&
      aggregateSequences.every((sequence) => {
        const state = sequenceState.get(sequence);
        if (!state) {
          return false;
        }
        const table = sequence.replace(/_id_seq$/u, "");
        const expectedRows = expectedPostClosureRowCounts.get(table) ?? 0;
        return expectedRows === 0
          ? Number(state.last_value) === 1 && state.is_called === false
          : Number(state.last_value) >= expectedRows && state.is_called === true;
      }),
    no_qa_marker_residue:
      summary.data_integrity_snapshot.qa_marker_residue.length === 0,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function buildSchemaDriftRemaining(summary) {
  const expectedCounts = summary.audit_contract.expected_catalog_counts;
  const actualCounts = summary.actual_catalog_counts;
  return [
    ...Object.entries(expectedCounts).flatMap(([property, expected]) =>
      actualCounts[property] === expected
        ? []
        : [{
            object_type: "catalog_count",
            property,
            expected,
            actual: actualCounts[property],
          }]),
    ...summary.missing_objects.map((entry) => ({
      object_type: "object_presence",
      ...entry,
    })),
    ...summary.column_drift.map((entry) => ({
      object_type: "column",
      ...entry,
    })),
    ...summary.column_property_diagnostics.differences
      .filter((entry) => !entry.semantic_match)
      .map((entry) => ({
        object_type: "column_metadata",
        ...entry,
      })),
    ...summary.missing_check_constraints.map((entry) => ({
      object_type: "constraint_presence",
      ...entry,
    })),
    ...summary.existing_constraint_diagnostics.metadata_mismatches.map(
      (entry) => ({
        object_type: "constraint_metadata_or_definition",
        ...entry,
      }),
    ),
    ...summary.existing_constraint_diagnostics.unexpected_actual_constraints.map(
      (entry) => ({
        object_type: "unexpected_constraint",
        ...entry,
      }),
    ),
    ...summary.function_body_drift.map((entry) => ({
      object_type: "function_body",
      ...entry,
    })),
    ...summary.trigger_definition_drift.map((entry) => ({
      object_type: "trigger_definition",
      ...entry,
    })),
    ...summary.trigger_definition_diagnostics.unexpected_actual_triggers.map(
      (entry) => ({
        object_type: "unexpected_trigger",
        ...entry,
      }),
    ),
    ...summary.reference_location_drift.map((entry) => ({
      object_type: "reference_location",
      ...entry,
    })),
  ];
}

function buildFinalParityGate(summary) {
  const reconciledMigrationRegistryMatches =
    summary.migration_registry.length === manuallyAppliedMigrationVersions.length &&
    summary.migration_registry.every(
      (entry) =>
        entry.statements?.length === 1 &&
        sha256(entry.statements[0]) === reconciledMigrationSourceHashes.get(entry.version),
    );
  const checks = {
    read_only_transaction: summary.session[0]?.transaction_read_only === "on",
    exact_catalog_counts:
      summary.matched_invariants.exact_catalog_counts === true,
    all_matched_invariants:
      Object.values(summary.matched_invariants).every(Boolean),
    all_non_drift_invariants_match:
      summary.all_non_drift_invariants_match === true,
    schema_drift_remaining_empty:
      summary.schema_drift_remaining.length === 0,
    acl_pass: summary.acl_pass === true,
    data_integrity_pass: summary.data_integrity_pass === true,
    reconciled_migrations_registered_canonically: reconciledMigrationRegistryMatches,
  };

  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}

function allNonDriftInvariantsMatch(summary) {
  const finalDriftInvariantNames = new Set([
    "exact_catalog_counts",
    "column_defaults_and_not_null_match_final_rebuild",
    "existing_constraint_metadata",
    "trigger_definitions_match_final_rebuild",
    "function_signature_security_owner_and_search_path",
    "function_bodies_match_final_rebuild",
    "reference_locations_match_final_rebuild",
  ]);

  return Object.entries(summary.matched_invariants)
    .filter(([name]) => !finalDriftInvariantNames.has(name))
    .every(([, matches]) => Boolean(matches));
}

let connected = false;
let transactionAttempted = false;
let auditError = null;

try {
  await client.connect();
  connected = true;

  // This is deliberately the first SQL statement sent by the audit process.
  transactionAttempted = true;
  await client.query("begin read only");

  await collect(
    "session",
    `
      select current_user,
             session_user,
             current_database() as database_name,
             current_setting('server_version') as server_version,
             current_setting('transaction_read_only') as transaction_read_only,
             pg_is_in_recovery() as in_recovery
    `,
  );

  if (report.session[0]?.transaction_read_only !== "on") {
    throw new Error("The Project Admin schema audit is not in a read-only transaction.");
  }

  await collect(
    "object_presence",
    `
      with expected(object_name, expected_kind) as (
        select unnest($1::text[]), 'table'::text
        union all
        select unnest($2::text[]), 'sequence'::text
      )
      select expected.object_name,
             expected.expected_kind,
             c.oid is not null as present,
             c.oid::regclass::text as resolved_name,
             c.relkind
        from expected
        left join pg_namespace n on n.nspname = $3
        left join pg_class c
          on c.relnamespace = n.oid
         and c.relname = expected.object_name
       order by expected.expected_kind, expected.object_name
    `,
    [aggregateTables, aggregateSequences, schemaName],
  );

  await collect(
    "tables",
    `
      select n.nspname as schema_name,
             c.relname as table_name,
             c.oid::regclass::text as qualified_name,
             c.relkind,
             c.relpersistence,
             pg_get_userbyid(c.relowner) as owner,
             am.amname as access_method,
             c.relrowsecurity as rls_enabled,
             c.relforcerowsecurity as rls_forced,
             c.relreplident as replica_identity,
             c.relispartition as is_partition,
             c.reloptions,
             c.relacl::text as stored_acl,
             obj_description(c.oid, 'pg_class') as comment
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_am am on am.oid = c.relam
       where n.nspname = $1
         and c.relname = any($2::text[])
         and c.relkind in ('r', 'p')
       order by c.relname
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "columns",
    `
      select c.oid::regclass::text as table_name,
             a.attnum as ordinal_position,
             a.attname as column_name,
             format_type(a.atttypid, a.atttypmod) as data_type,
             tn.nspname as type_schema,
             t.typname as underlying_type,
             a.attnotnull as not_null,
             a.attidentity as identity_kind,
             a.attgenerated as generated_kind,
             a.atthasdef as has_default,
             pg_get_expr(ad.adbin, ad.adrelid) as default_expression,
             case when a.attcollation = 0 then null
                  else a.attcollation::regcollation::text end as collation,
             a.attcollation = t.typcollation as uses_type_default_collation,
             a.attstorage as storage_strategy,
             t.typstorage as type_default_storage_strategy,
             a.attstorage = t.typstorage as uses_type_default_storage,
             a.attcompression::text as compression_method,
             a.attcompression::integer as compression_code,
             octet_length(a.attcompression::text) as compression_method_octets,
             a.attstattarget as statistics_target,
             a.attislocal as is_local,
             a.attinhcount as inheritance_count,
             a.atthasmissing as has_missing_value,
             a.attacl::text as stored_column_acl,
             cardinality(a.attacl) as stored_column_acl_cardinality,
             col_description(c.oid, a.attnum) as comment
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a
          on a.attrelid = c.oid
         and a.attnum > 0
         and not a.attisdropped
        join pg_type t on t.oid = a.atttypid
        join pg_namespace tn on tn.oid = t.typnamespace
        left join pg_attrdef ad
          on ad.adrelid = a.attrelid
         and ad.adnum = a.attnum
       where n.nspname = $1
         and c.relname = any($2::text[])
         and c.relkind in ('r', 'p')
       order by c.relname, a.attnum
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "constraints",
    `
      select relation.oid::regclass::text as table_name,
             constraint_record.conname as constraint_name,
             constraint_record.contype as constraint_type,
             constraint_record.condeferrable as deferrable,
             constraint_record.condeferred as initially_deferred,
             constraint_record.convalidated as validated,
             constraint_record.conislocal as is_local,
             constraint_record.coninhcount as inheritance_count,
             constraint_record.connoinherit as no_inherit,
             constraint_record.conparentid as parent_constraint_oid,
             case when constraint_record.confrelid = 0 then null
                  else constraint_record.confrelid::regclass::text end as referenced_table,
             case when constraint_record.conindid = 0 then null
                  else constraint_record.conindid::regclass::text end as backing_index,
             pg_get_constraintdef(constraint_record.oid, true) as definition,
             obj_description(constraint_record.oid, 'pg_constraint') as comment
        from pg_constraint constraint_record
        join pg_class relation on relation.oid = constraint_record.conrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, constraint_record.conname
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "indexes",
    `
      select relation.oid::regclass::text as table_name,
             index_relation.oid::regclass::text as index_name,
             access_method.amname as access_method,
             index_metadata.indisunique as is_unique,
             index_metadata.indisprimary as is_primary,
             index_metadata.indisexclusion as is_exclusion,
             index_metadata.indimmediate as is_immediate,
             index_metadata.indisclustered as is_clustered,
             index_metadata.indisvalid as is_valid,
             index_metadata.indisready as is_ready,
             index_metadata.indislive as is_live,
             index_metadata.indisreplident as is_replica_identity,
             index_metadata.indnatts as attribute_count,
             index_metadata.indnkeyatts as key_attribute_count,
             pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true) as predicate,
             pg_get_expr(index_metadata.indexprs, index_metadata.indrelid, true) as expressions,
             pg_get_indexdef(index_relation.oid) as definition,
             obj_description(index_relation.oid, 'pg_class') as comment
        from pg_index index_metadata
        join pg_class relation on relation.oid = index_metadata.indrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_class index_relation on index_relation.oid = index_metadata.indexrelid
        join pg_am access_method on access_method.oid = index_relation.relam
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, index_relation.relname
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "rls_policies",
    `
      select relation.oid::regclass::text as table_name,
             policy.polname as policy_name,
             case policy.polcmd
               when 'r' then 'SELECT'
               when 'a' then 'INSERT'
               when 'w' then 'UPDATE'
               when 'd' then 'DELETE'
               when '*' then 'ALL'
               else policy.polcmd::text
             end as command,
             policy.polpermissive as permissive,
             array(
               select case when role_oid = 0 then 'PUBLIC'
                           else pg_get_userbyid(role_oid) end
                 from unnest(policy.polroles) role_oid
             ) as roles,
             pg_get_expr(policy.polqual, policy.polrelid, true) as using_expression,
             pg_get_expr(policy.polwithcheck, policy.polrelid, true) as check_expression
        from pg_policy policy
        join pg_class relation on relation.oid = policy.polrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, policy.polname
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "triggers",
    `
      select relation.oid::regclass::text as table_name,
             trigger_record.tgname as trigger_name,
             trigger_record.tgenabled as enabled_state,
             trigger_record.tgisinternal as is_internal,
             trigger_record.tgtype as trigger_type_bits,
             trigger_record.tgdeferrable as deferrable,
             trigger_record.tginitdeferred as initially_deferred,
             trigger_record.tgnargs as argument_count,
             pg_get_expr(
               trigger_record.tgqual,
               trigger_record.tgrelid,
               true
             ) as when_expression,
             trigger_record.tgoldtable as old_transition_table,
             trigger_record.tgnewtable as new_transition_table,
             trigger_record.tgparentid as parent_trigger_oid,
             trigger_record.tgconstraint as constraint_oid,
             trigger_record.tgconstrrelid as constraint_relation_oid,
             trigger_record.tgfoid::regprocedure::text as function_name,
             pg_get_userbyid(function_record.proowner) as function_owner,
             function_record.prosecdef as function_security_definer,
             function_record.proconfig as function_config,
             constraint_record.conname as constraint_name,
             pg_get_triggerdef(trigger_record.oid, true) as definition
        from pg_trigger trigger_record
        join pg_class relation on relation.oid = trigger_record.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_proc function_record on function_record.oid = trigger_record.tgfoid
        left join pg_constraint constraint_record
          on constraint_record.oid = trigger_record.tgconstraint
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, trigger_record.tgisinternal, trigger_record.tgname
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "function_presence",
    `
      select signature,
             to_regprocedure(signature) is not null as present,
             to_regprocedure(signature)::oid::regprocedure::text as resolved_signature
        from unnest($1::text[]) signature
       order by signature
    `,
    [expectedFunctionSignatures],
  );

  await collect(
    "forbidden_legacy_function_presence",
    `
      select signature,
             to_regprocedure(signature) is not null as present,
             to_regprocedure(signature)::oid::regprocedure::text as resolved_signature
        from unnest($1::text[]) signature
       order by signature
    `,
    [forbiddenLegacyFunctionSignatures],
  );

  await collect(
    "functions",
    `
      select function_record.oid::regprocedure::text as function_name,
             function_record.prokind as function_kind,
             language.lanname as language,
             pg_get_userbyid(function_record.proowner) as owner,
             function_record.prosecdef as security_definer,
             function_record.proleakproof as leakproof,
             function_record.proisstrict as strict,
             function_record.proretset as returns_set,
             function_record.provolatile as volatility,
             function_record.proparallel as parallel_safety,
             function_record.pronargdefaults as default_argument_count,
             pg_get_function_identity_arguments(function_record.oid) as identity_arguments,
             pg_get_function_arguments(function_record.oid) as arguments,
             pg_get_function_result(function_record.oid) as result_type,
             function_record.proconfig as configuration,
             coalesce(
               (
                 select setting
                   from unnest(function_record.proconfig) setting
                  where setting like 'search_path=%'
                  limit 1
               ),
               '<session default>'
             ) as search_path_setting,
             function_record.proacl::text as stored_acl,
             function_record.prosrc as source,
             md5(pg_get_functiondef(function_record.oid)) as definition_md5,
             pg_get_functiondef(function_record.oid) as definition
        from pg_proc function_record
        join pg_namespace namespace on namespace.oid = function_record.pronamespace
        join pg_language language on language.oid = function_record.prolang
       where namespace.nspname = $1
         and function_record.proname = any($2::text[])
       order by function_record.oid::regprocedure::text
    `,
    [schemaName, aggregateFunctionNames],
  );

  report.functions = report.functions.map((functionRecord) => {
    const baseName = functionRecord.function_name.replace(/\(.*$/u, "");
    const unqualifiedName = baseName.replace(/^public\./u, "");
    const actualSource = functionRecord.source.replace(/\r\n?/gu, "\n");
    const actualSourceHash = sha256(actualSource);
    const expectedSourceHash = expectedFunctionSourceHashes[unqualifiedName] ?? null;
    const actualSourceMd5 = md5(actualSource);
    const expectedSourceMd5 = expectedFunctionSourceMd5s[unqualifiedName] ?? null;
    const compactRecord = {
      ...functionRecord,
      source_sha256: actualSourceHash,
      expected_source_sha256: expectedSourceHash,
      source_matches_final_rebuild: actualSourceHash === expectedSourceHash,
      source_md5: actualSourceMd5,
      expected_source_md5: expectedSourceMd5,
    };

    if (!process.argv.includes("--full")) {
      delete compactRecord.source;
      delete compactRecord.definition;
    }

    return compactRecord;
  });

  await collect(
    "direct_relation_acl",
    `
      select relation.oid::regclass::text as object_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor,
             case when relation.relacl is null then 'acl_default'
                  else 'stored_acl' end as acl_source
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        cross join lateral aclexplode(
          case
            when relation.relacl is null then
              acldefault(
                case when relation.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
                relation.relowner
              )
            when cardinality(relation.relacl) > 0 then relation.relacl
            else null::aclitem[]
          end
        ) acl
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, grantee, acl.privilege_type
    `,
    [schemaName, aggregateTables.concat(aggregateSequences)],
  );

  await collect(
    "direct_column_acl",
    `
      select relation.oid::regclass::text as table_name,
             attribute.attname as column_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_attribute attribute
          on attribute.attrelid = relation.oid
         and attribute.attnum > 0
         and not attribute.attisdropped
        cross join lateral aclexplode(
          case
            when cardinality(attribute.attacl) > 0 then attribute.attacl
            else null::aclitem[]
          end
        ) acl
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
       order by relation.relname, attribute.attnum, grantee, acl.privilege_type
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "direct_function_acl",
    `
      select function_record.oid::regprocedure::text as function_name,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor,
             case when function_record.proacl is null then 'acl_default'
                  else 'stored_acl' end as acl_source
        from pg_proc function_record
        join pg_namespace namespace on namespace.oid = function_record.pronamespace
        cross join lateral aclexplode(
          case
            when function_record.proacl is null then
              acldefault('f'::"char", function_record.proowner)
            when cardinality(function_record.proacl) > 0 then function_record.proacl
            else null::aclitem[]
          end
        ) acl
       where namespace.nspname = $1
         and function_record.proname = any($2::text[])
       order by function_record.oid::regprocedure::text, grantee, acl.privilege_type
    `,
    [schemaName, aggregateFunctionNames],
  );

  await collect(
    "runtime_effective_table_acl",
    `
      with privileges(privilege) as (
        select unnest($3::text[])
      )
      select role_record.rolname as role_name,
             relation.oid::regclass::text as table_name,
             privileges.privilege,
             has_table_privilege(
               role_record.oid,
               relation.oid,
               privileges.privilege
             ) as allowed
        from pg_roles role_record
        cross join pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        cross join privileges
       where role_record.rolname = any($2::text[])
         and namespace.nspname = $1
         and relation.relname = any($4::text[])
       order by relation.relname, role_record.rolname, privileges.privilege
    `,
    [schemaName, runtimeRoles, tablePrivileges, aggregateTables],
  );

  await collect(
    "all_roles_effective_table_dml",
    `
      with privileges(privilege) as (
        values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
               ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
      )
      select role_record.rolname as role_name,
             relation.oid::regclass::text as table_name,
             array_agg(privileges.privilege order by privileges.privilege) as privileges
        from pg_roles role_record
        cross join pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        cross join privileges
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
         and has_table_privilege(
           role_record.oid,
           relation.oid,
           privileges.privilege
         )
       group by role_record.rolname, relation.oid
       order by role_record.rolname, relation.oid::regclass::text
    `,
    [schemaName, aggregateTables],
  );

  await collect(
    "runtime_effective_sequence_acl",
    `
      with privileges(privilege) as (
        values ('USAGE'), ('SELECT'), ('UPDATE')
      )
      select role_record.rolname as role_name,
             relation.oid::regclass::text as sequence_name,
             privileges.privilege,
             has_sequence_privilege(
               role_record.oid,
               relation.oid,
               privileges.privilege
             ) as allowed
        from pg_roles role_record
        cross join pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        cross join privileges
       where role_record.rolname = any($2::text[])
         and namespace.nspname = $1
         and relation.relname = any($3::text[])
       order by relation.relname, role_record.rolname, privileges.privilege
    `,
    [schemaName, runtimeRoles, aggregateSequences],
  );

  await collect(
    "runtime_effective_function_acl",
    `
      select role_record.rolname as role_name,
             function_record.oid::regprocedure::text as function_name,
             has_function_privilege(
               role_record.oid,
               function_record.oid,
               'EXECUTE'
             ) as execute_allowed
        from pg_roles role_record
        cross join pg_proc function_record
        join pg_namespace namespace on namespace.oid = function_record.pronamespace
       where role_record.rolname = any($2::text[])
         and namespace.nspname = $1
         and function_record.proname = any($3::text[])
       order by function_record.oid::regprocedure::text, role_record.rolname
    `,
    [schemaName, runtimeRoles, aggregateFunctionNames],
  );

  await collect(
    "schema_acl",
    `
      select namespace.nspname as schema_name,
             pg_get_userbyid(namespace.nspowner) as owner,
             namespace.nspacl::text as stored_acl,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_namespace namespace
        cross join lateral aclexplode(
          case
            when namespace.nspacl is null then
              acldefault('n'::"char", namespace.nspowner)
            when cardinality(namespace.nspacl) > 0 then namespace.nspacl
            else null::aclitem[]
          end
        ) acl
       where namespace.nspname = $1
       order by grantee, acl.privilege_type
    `,
    [schemaName],
  );

  await collect(
    "runtime_effective_schema_acl",
    `
      with privileges(privilege) as (values ('USAGE'), ('CREATE'))
      select role_record.rolname as role_name,
             privileges.privilege,
             has_schema_privilege(
               role_record.oid,
               namespace.oid,
               privileges.privilege
             ) as allowed
        from pg_roles role_record
        cross join pg_namespace namespace
        cross join privileges
       where role_record.rolname = any($2::text[])
         and namespace.nspname = $1
       order by role_record.rolname, privileges.privilege
    `,
    [schemaName, runtimeRoles],
  );

  await collect(
    "default_acl",
    `
      select pg_get_userbyid(default_acl.defaclrole) as creator_role,
             coalesce(namespace.nspname, '<global>') as schema_name,
             default_acl.defaclobjtype as object_type_code,
             case default_acl.defaclobjtype
               when 'r' then 'tables'
               when 'S' then 'sequences'
               when 'f' then 'functions'
               when 'T' then 'types'
               when 'n' then 'schemas'
               else default_acl.defaclobjtype::text
             end as object_type,
             case when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee) end as grantee,
             acl.privilege_type,
             acl.is_grantable,
             pg_get_userbyid(acl.grantor) as grantor
        from pg_default_acl default_acl
        left join pg_namespace namespace
          on namespace.oid = default_acl.defaclnamespace
        cross join lateral aclexplode(
          case
            when cardinality(default_acl.defaclacl) > 0 then default_acl.defaclacl
            else null::aclitem[]
          end
        ) acl
       where namespace.nspname = $1
          or default_acl.defaclnamespace = 0
       order by creator_role, schema_name, object_type, grantee, acl.privilege_type
    `,
    [schemaName],
  );

  await collect(
    "role_attributes",
    `
      select role_record.rolname,
             role_record.rolsuper,
             role_record.rolinherit,
             role_record.rolcreaterole,
             role_record.rolcreatedb,
             role_record.rolcanlogin,
             role_record.rolreplication,
             role_record.rolbypassrls
        from pg_roles role_record
       where role_record.rolname = any($1::text[])
          or role_record.oid in (
            select relation.relowner
              from pg_class relation
              join pg_namespace namespace on namespace.oid = relation.relnamespace
             where namespace.nspname = $2
               and relation.relname = any($3::text[])
            union
            select function_record.proowner
              from pg_proc function_record
              join pg_namespace namespace on namespace.oid = function_record.pronamespace
             where namespace.nspname = $2
               and function_record.proname = any($4::text[])
          )
       order by role_record.rolname
    `,
    [
      runtimeRoles,
      schemaName,
      aggregateTables.concat(aggregateSequences),
      aggregateFunctionNames,
    ],
  );

  await collect(
    "role_memberships",
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
    [runtimeRoles],
  );

  await collect(
    "sequences",
    `
      select namespace.nspname as schema_name,
             relation.relname as sequence_name,
             relation.oid::regclass::text as qualified_name,
             pg_get_userbyid(relation.relowner) as owner,
             format_type(sequence_record.seqtypid, null) as data_type,
             sequence_record.seqstart as start_value,
             sequence_record.seqincrement as increment_by,
             sequence_record.seqmax as max_value,
             sequence_record.seqmin as min_value,
             sequence_record.seqcache as cache_size,
             sequence_record.seqcycle as cycle,
             sequence_view.last_value,
             relation.relacl::text as stored_acl
        from pg_class relation
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_sequence sequence_record on sequence_record.seqrelid = relation.oid
        left join pg_sequences sequence_view
          on sequence_view.schemaname = namespace.nspname
         and sequence_view.sequencename = relation.relname
       where namespace.nspname = $1
         and relation.relname = any($2::text[])
         and relation.relkind = 'S'
       order by relation.relname
    `,
    [schemaName, aggregateSequences],
  );

  await collect(
    "sequence_ownership",
    `
      select sequence_relation.oid::regclass::text as sequence_name,
             table_relation.oid::regclass::text as table_name,
             attribute.attname as column_name,
             dependency.deptype as dependency_type
        from pg_depend dependency
        join pg_class sequence_relation
          on sequence_relation.oid = dependency.objid
         and sequence_relation.relkind = 'S'
        join pg_namespace sequence_namespace
          on sequence_namespace.oid = sequence_relation.relnamespace
        join pg_class table_relation on table_relation.oid = dependency.refobjid
        join pg_attribute attribute
          on attribute.attrelid = table_relation.oid
         and attribute.attnum = dependency.refobjsubid
       where dependency.classid = 'pg_class'::regclass
         and dependency.refclassid = 'pg_class'::regclass
         and dependency.deptype in ('a', 'i')
         and sequence_namespace.nspname = $1
         and sequence_relation.relname = any($2::text[])
       order by sequence_relation.relname
    `,
    [schemaName, aggregateSequences],
  );

  await collect("row_counts", buildRowCountQuery());
  await collect("sequence_state", buildSequenceStateQuery());
  await collect("client_key_stats", buildClientKeyStatsQuery());
  await collect(
    "qa_marker_residue",
    buildQaMarkerQuery(),
    [fixtureClientKeys, fixtureTextMarkerPattern],
  );

  await collect(
    "project_identity_snapshot",
    `
      select id, type, slug, created_at, updated_at
        from public.projects
       order by id
    `,
  );

  await collect(
    "reference_locations",
    `
      select location.id,
             location.client_key::text,
             location.level,
             location.parent_id,
             parent.client_key::text as parent_client_key,
             location.name_ar,
             location.name_en,
             location.sort_order,
             location.is_active,
             location.created_at,
             location.updated_at
        from public.project_locations location
        left join public.project_locations parent on parent.id = location.parent_id
       where location.client_key = any($1::uuid[])
       order by array_position($1::uuid[], location.client_key)
    `,
    [expectedReferenceLocations.map((location) => location.client_key)],
  );

  await collect(
    "location_counts",
    `
      select level,
             is_active,
             count(*)::bigint as row_count
        from public.project_locations
       group by level, is_active
       order by level, is_active desc
    `,
  );

  await collect(
    "migration_registry",
    `
      select version, name, statements
        from supabase_migrations.schema_migrations
       where version = any($1::text[])
       order by version
    `,
    [manuallyAppliedMigrationVersions],
  );

  const actualReferenceLocations = new Map(
    report.reference_locations.map((location) => [location.client_key, location]),
  );
  report.reference_location_parity = expectedReferenceLocations.map((expected) => {
    const actual = actualReferenceLocations.get(expected.client_key);
    const comparableFields = [
      "level",
      "parent_client_key",
      "name_ar",
      "name_en",
      "sort_order",
      "is_active",
    ];
    const mismatches = actual
      ? comparableFields.filter(
          (field) => actual[field] !== expected[field],
        )
      : ["missing"];

    return {
      client_key: expected.client_key,
      present: Boolean(actual),
      matches_expected: mismatches.length === 0,
      mismatches,
      expected,
      actual: actual ?? null,
    };
  });
} catch (error) {
  auditError = error;
} finally {
  if (connected && transactionAttempted) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      auditError ??= rollbackError;
    }
  }

  if (connected) {
    try {
      await client.end();
    } catch (closeError) {
      auditError ??= closeError;
    }
  }
}

if (auditError) {
  console.error(
    JSON.stringify(
      {
        name: auditError.name,
        message: auditError.message,
        code: auditError.code,
        detail: auditError.detail,
        where: auditError.where,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  const preFixGateRequested = process.argv.includes("--expect-pre-fix");
  const summaryRequested =
    process.argv.includes("--summary") || preFixGateRequested;
  const predicateDiagnosticsRequested = process.argv.includes(
    "--predicate-diagnostics",
  );
  const paritySummary = summaryRequested || predicateDiagnosticsRequested
    ? buildParitySummary(report)
    : null;
  if (paritySummary) {
    const aclResult = buildAclPass(paritySummary);
    const dataIntegrityResult = buildDataIntegrityPass(paritySummary);
    paritySummary.schema_drift_remaining =
      buildSchemaDriftRemaining(paritySummary);
    paritySummary.acl_pass = aclResult.passed;
    paritySummary.acl_checks = aclResult.checks;
    paritySummary.data_integrity_pass = dataIntegrityResult.passed;
    paritySummary.data_integrity_checks = dataIntegrityResult.checks;
    paritySummary.all_non_drift_invariants_match =
      allNonDriftInvariantsMatch(paritySummary);
    paritySummary.final_parity_gate = buildFinalParityGate(paritySummary);
    if (preFixGateRequested) {
      paritySummary.expected_pre_fix_gate =
        buildExpectedPreFixGate(paritySummary);
    }
  }
  const output = predicateDiagnosticsRequested
    ? {
        audit_contract: paritySummary.audit_contract,
        session: paritySummary.session,
        actual_catalog_counts: paritySummary.actual_catalog_counts,
        column_drift: paritySummary.column_drift,
        column_property_diagnostics:
          paritySummary.column_property_diagnostics,
        missing_check_constraints: paritySummary.missing_check_constraints,
        existing_constraint_diagnostics:
          paritySummary.existing_constraint_diagnostics,
        matched_invariants: paritySummary.matched_invariants,
        acl_evidence: {
          no_direct_column_grants:
            paritySummary.matched_invariants.no_direct_column_grants,
          runtime_table_acl_is_service_select_only:
            paritySummary.matched_invariants.runtime_table_acl_is_service_select_only,
          runtime_sequence_acl_empty:
            paritySummary.matched_invariants.runtime_sequence_acl_empty,
          runtime_function_acl_is_service_rpc_only:
            paritySummary.matched_invariants.runtime_function_acl_is_service_rpc_only,
        },
        data_integrity_snapshot: paritySummary.data_integrity_snapshot,
        schema_drift_remaining: paritySummary.schema_drift_remaining,
        acl_pass: paritySummary.acl_pass,
        acl_checks: paritySummary.acl_checks,
        data_integrity_pass: paritySummary.data_integrity_pass,
        data_integrity_checks: paritySummary.data_integrity_checks,
        all_non_drift_invariants_match:
          paritySummary.all_non_drift_invariants_match,
        final_parity_gate: paritySummary.final_parity_gate,
        ...(preFixGateRequested
          ? { expected_pre_fix_gate: paritySummary.expected_pre_fix_gate }
          : {}),
      }
    : summaryRequested
      ? paritySummary
      : process.argv.includes("--full")
        ? report
        : buildCompactReport(report);

  console.log(
    JSON.stringify(output, null, 2),
  );

  const activeGate = preFixGateRequested
    ? paritySummary?.expected_pre_fix_gate
    : paritySummary?.final_parity_gate;
  if (activeGate && !activeGate.passed) {
    process.exitCode = 1;
  }
}
