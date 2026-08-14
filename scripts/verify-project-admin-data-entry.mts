import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const migrationPath = "sql/migrations/20260728090000_rebuild_project_admin_data_entry.sql";
const aclCorrectionPath = "sql/migrations/20260729090000_project_admin_entry_acl_correction.sql";
const schemaParityForwardFixPath =
  "sql/migrations/20260729150000_project_admin_schema_parity_forward_fix.sql";
const saveRpcConflictArbiterFixPath =
  "sql/migrations/20260730100000_project_admin_save_rpc_conflict_arbiter_fix.sql";
const projectRowActionsMigrationPath =
  "sql/migrations/20260731100000_project_row_actions_capability.sql";
const projectDomainHardeningMigrationPath =
  "sql/migrations/20260813233530_projects_domain_hardening.sql";
const fixturePath = "scripts/fixtures/project-admin-entry-postgres-tests.sql";
const projectRowActionsFixturePath =
  "scripts/fixtures/project-row-actions-postgres-tests.sql";
const aclAuditPath = "scripts/audit-project-admin-entry-acl.mjs";
const schemaParityAuditPath = "scripts/audit-project-admin-schema-parity.mjs";
const formPath = "src/app/admin/projects/ProjectEditForm.tsx";
const contractPath = "src/lib/admin/projects/project-entry-contract.ts";
const actionPath = "src/app/admin/projects/project-actions/save-entry.ts";
const repeatersPath = "src/components/admin/projects/entry/ProjectRepeaters.tsx";
const mediaEditorsPath = "src/components/admin/projects/entry/ProjectMediaEditors.tsx";
const locationEditorPath = "src/components/admin/projects/entry/ProjectLocationEditor.tsx";
const projectSeoPanelPath = "src/components/admin/projects/entry/ProjectSeoPanel.tsx";
const sharedSeoPanelPath = "src/components/admin/seo/AdminEntitySeoPanel.tsx";
const projectsHubPagePath = "src/app/admin/projects/page.tsx";
const projectHelpersPath = "src/app/admin/projects/project-actions/helpers.ts";
const previewPath = "src/components/admin/projects/entry/ProjectEntryPreview.tsx";
const moduleTabsPath = "src/components/admin/ui/AdminModuleTabs.tsx";
const legacyModuleTabsPath = "src/components/admin/page-blocks/AdminModuleTabs.tsx";
const formPresentationPath = "src/components/admin/ui/AdminForm.tsx";
const pageExperiencePath = "src/components/admin/ui/AdminPageExperience.tsx";
const formListboxPath = "src/components/admin/ui/AdminFormListboxSelect.tsx";
const listboxPath = "src/components/admin/ui/AdminListboxSelect.tsx";
const slugFieldPath = "src/components/admin/ui/AdminSlugField.tsx";
const formRuntimePath = "src/components/admin/ui/AdminFormRuntime.tsx";
const entryDataPath = "src/lib/admin/projects/project-entry-data.ts";
const dataRuntimePath = "src/lib/admin/entity-list/data-engine/client-controller.ts";

for (const path of [
  migrationPath,
  aclCorrectionPath,
  schemaParityForwardFixPath,
  saveRpcConflictArbiterFixPath,
  projectRowActionsMigrationPath,
  projectDomainHardeningMigrationPath,
  fixturePath,
  projectRowActionsFixturePath,
  aclAuditPath,
  schemaParityAuditPath,
  formPath,
  contractPath,
  actionPath,
  repeatersPath,
  mediaEditorsPath,
  locationEditorPath,
  projectSeoPanelPath,
  sharedSeoPanelPath,
  projectsHubPagePath,
  projectHelpersPath,
  moduleTabsPath,
  formPresentationPath,
  pageExperiencePath,
  formListboxPath,
  listboxPath,
  slugFieldPath,
  formRuntimePath,
  entryDataPath,
  dataRuntimePath,
]) {
  check(`${path} exists`, existsSync(join(ROOT, path)));
}

const migration = read(migrationPath);
const aclCorrection = read(aclCorrectionPath);
const schemaParityForwardFix = read(schemaParityForwardFixPath);
const saveRpcConflictArbiterFix = read(saveRpcConflictArbiterFixPath);
const projectRowActionsMigration = read(projectRowActionsMigrationPath);
const projectDomainHardeningMigration = read(projectDomainHardeningMigrationPath);
const fixture = read(fixturePath);
const projectRowActionsFixture = read(projectRowActionsFixturePath);
const aclAudit = read(aclAuditPath);
const schemaParityAudit = read(schemaParityAuditPath);
const schemaParityBeginReadOnlyIndex = schemaParityAudit.indexOf(
  'await client.query("begin read only")',
);
const schemaParityFirstCollectIndex = schemaParityAudit.indexOf(
  "await collect(",
  schemaParityBeginReadOnlyIndex,
);
const schemaParityFinallyIndex = schemaParityAudit.indexOf(
  "} finally {",
  schemaParityBeginReadOnlyIndex,
);
const schemaParityRollbackIndex = schemaParityAudit.indexOf(
  'await client.query("rollback")',
  schemaParityFinallyIndex,
);
const schemaParityAuditErrorGateIndex = schemaParityAudit.indexOf(
  "if (auditError)",
  schemaParityRollbackIndex,
);
const constraintDefinitionSemanticSelfTest = spawnSync(
  process.execPath,
  [join(ROOT, schemaParityAuditPath), "--self-test"],
  {
    cwd: ROOT,
    encoding: "utf8",
  },
);
const form = read(formPath);
const contract = read(contractPath);
const sharedReviewContract = read(
  "src/lib/admin/review/entity-review-presentation.ts",
);
const action = read(actionPath);
const repeaters = read(repeatersPath);
const mediaEditors = read(mediaEditorsPath);
const locationEditor = read(locationEditorPath);
const moduleTabs = read(moduleTabsPath);
const formPresentation = read(formPresentationPath);
const pageExperience = read(pageExperiencePath);
const formListbox = read(formListboxPath);
const listbox = read(listboxPath);
const slugField = read(slugFieldPath);
const formRuntime = read(formRuntimePath);
const entryData = read(entryDataPath);
const dataRuntime = read(dataRuntimePath);
const deleteProjectRpc = ["delete", "project", "admin", "entry"].join("_");
const createPage = read("src/app/admin/projects/new/page.tsx");
const editPage = read("src/app/admin/projects/[id]/page.tsx");
const coordinator = read("src/lib/admin/projects/project-entry-media-coordination.ts");
const projectSeoPanel = read(projectSeoPanelPath);
const seoPanel = read(sharedSeoPanelPath);
const entitySeoPrimaryStart = seoPanel.indexOf("const seoBasicsContent");
const entitySeoReturnStart = seoPanel.indexOf("  return (", entitySeoPrimaryStart);
const entitySeoPrimaryRender = seoPanel.slice(entitySeoPrimaryStart, entitySeoReturnStart);
const entitySeoHelperStart = seoPanel.indexOf("<AdminSingleOpenAccordion", entitySeoReturnStart);
const entitySeoHelperRender = seoPanel.slice(entitySeoHelperStart);
const entitySeoRobotsIndexPosition = seoPanel.indexOf("name={fieldNames.robotsIndex}");
const entitySeoRobotsFollowPosition = seoPanel.indexOf("name={fieldNames.robotsFollow}");
const entitySeoCanonicalPosition = seoPanel.indexOf("name={fieldNames.canonicalUrl}");
const projectsHubPage = read(projectsHubPagePath);
const projectHelpers = read(projectHelpersPath);
const projectHelperExports = Array.from(
  projectHelpers.matchAll(/export function\s+([A-Za-z0-9_]+)/g),
  (match) => match[1],
).sort();
const seoScore = read("src/lib/admin/seo-score.ts");
const adoption = read("src/lib/admin/form-system/adoption-manifest.ts");
const approvedProjectTabIds = [
  "basic",
  "location",
  "overview",
  "plans",
  "delivery",
  "media",
  "seo",
  "review",
] as const;
const declaredProjectTabIds = Array.from(
  form.matchAll(/\bid:\s*PROJECT_ENTRY_TAB_IDS\.([a-z_]+)\s*,/g),
  (match) => match[1],
);
const projectEntryVisualSources = [
  form,
  repeaters,
  mediaEditors,
  locationEditor,
  seoPanel,
  moduleTabs,
];
const standaloneLightClass =
  /(?:^|[\s"'`])(?:bg-white|bg-slate-(?:50|100)|border-slate-\d+|text-slate-\d+)(?=$|[\s"'`])/m;
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
] as const;
const aggregateSequences = aggregateTables.map((table) => `${table}_id_seq`);
const helperFunctions = [
  "validate_project_location_parent",
  "prevent_project_type_change",
  "validate_project_location_selection",
  "prevent_project_location_reparent",
] as const;
const provenMissingChecks = [
  "projects_general_description_check",
  "projects_short_description_check",
  "projects_image_check",
  "projects_image_alt_check",
  "projects_hero_image_check",
  "projects_hero_image_alt_check",
  "projects_small_box_image_check",
  "projects_small_box_image_alt_check",
  "projects_location_label_check",
  "projects_google_maps_url_check",
  "projects_overview_title_check",
  "projects_overview_body_check",
  "projects_delivery_title_check",
  "projects_delivery_body_check",
  "projects_seo_title_check",
  "projects_seo_description_check",
  "projects_canonical_url_check",
  "projects_overview_image_required_check",
  "projects_overview_image_alt_check",
  "projects_og_image_alt_check",
  "project_floor_plans_architectural_image_alt_check",
  "project_floor_plans_furnishing_image_alt_check",
  "project_media_alt_text_check",
  "project_videos_poster_alt_check",
] as const;

function withoutCreatedFunctionBodies(sql: string) {
  return sql.replace(/\$function\$[\s\S]*?\$function\$/g, "$function$BODY$function$");
}

function extractFunctionDefinition(sql: string, functionName: string) {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  assert.notEqual(start, -1, `${functionName} definition exists`);
  const bodyEnd = sql.indexOf("$function$;", start);
  assert.notEqual(bodyEnd, -1, `${functionName} definition is complete`);
  return sql.slice(start, bodyEnd + "$function$;".length).replace(/\r\n?/g, "\n");
}

function extractForwardFixColumnManifest(sql: string) {
  const marker = "-- Exact 114-column final manifest";
  const markerStart = sql.indexOf(marker);
  assert.notEqual(markerStart, -1, "forward-fix column manifest marker exists");
  const valuesStart = sql.indexOf("from (values", markerStart);
  const valuesEnd = sql.indexOf(") expected(", valuesStart);
  assert.notEqual(valuesStart, -1, "forward-fix column manifest VALUES starts");
  assert.notEqual(valuesEnd, -1, "forward-fix column manifest VALUES ends");
  return sql.slice(valuesStart, valuesEnd);
}

function sliceBetween(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} exists`);
  assert.notEqual(end, -1, `${endMarker} exists after ${startMarker}`);
  return source.slice(start, end);
}

check(
  "migration declares the approved Project-only destructive boundary and no remote application",
  migration.includes("clean rebuild (breaking, Project Domain only)") &&
    migration.includes("MUST NOT be applied") &&
    migration.includes("to Remote/Production"),
);
check(
  "aggregate save is one SECURITY DEFINER statement with a fixed safe search path",
  migration.includes("function public.save_project_admin_entry") &&
    migration.includes("security definer") &&
    migration.includes("set search_path = pg_catalog, pg_temp"),
);
check(
  "aggregate RPC execute privilege is service-role-only",
  ["public", "anon", "authenticated"].every((role) =>
    migration.includes(`revoke all on function public.save_project_admin_entry(bigint, jsonb) from ${role}`),
  ) &&
    migration.includes("grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role"),
);
check(
  "runtime table DML is RPC-only while service_role keeps aggregate reads",
  migration.includes("grant select on table") &&
    migration.includes("from public, anon, authenticated, service_role") &&
    !migration.includes("grant all on table"),
);
check(
  "clean rebuild neutralizes materialized default grants for every aggregate object",
  migration.includes("do $project_acl_cleanup$") &&
    migration.includes("cross join lateral pg_catalog.aclexplode(relation.relacl)") &&
    migration.includes("cross join lateral pg_catalog.aclexplode(attribute.attacl)") &&
    migration.includes("cross join lateral pg_catalog.aclexplode(sequence.relacl)") &&
    migration.includes("cross join lateral pg_catalog.aclexplode(procedure.proacl)") &&
    migration.includes("acl.grantee <> relation.relowner") &&
    aggregateTables.every((table) => migration.includes(`'${table}'`)) &&
    aggregateSequences.every((sequence) => migration.includes(`'${sequence}'`)),
);
check(
  "clean rebuild fails closed on direct, effective, column, sequence, and helper ACL drift",
  migration.includes("do $project_acl_assert$") &&
    migration.includes("A non-owner direct table grant remains") &&
    migration.includes("A non-owner direct column grant remains") &&
    migration.includes("A non-owner direct sequence grant remains") &&
    migration.includes("A non-owner direct Project RPC grant remains") &&
    migration.includes("A non-owner direct helper-function grant remains") &&
    migration.includes("INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN") &&
    helperFunctions.every((functionName) =>
      migration.includes(`public.${functionName}()`),
    ),
);
check(
  "clean rebuild has a final assertion-only schema parity gate",
  migration.includes("do $project_clean_schema_parity_assert$") &&
    migration.includes("expected 114 columns") &&
    migration.includes("expected 99 constraints") &&
    migration.includes("expected 44 indexes") &&
    migration.includes("Both Project location trigger definitions must include is_active") &&
    migration.includes("exact 4-row reference location chain"),
);
check(
  "ACL cleanup never passes a zero-dimensional empty array to aclexplode",
  !migration.includes("coalesce(relation.relacl, '{}'::aclitem[])") &&
    !migration.includes("coalesce(attribute.attacl, '{}'::aclitem[])") &&
    !migration.includes("coalesce(sequence.relacl, '{}'::aclitem[])") &&
    !migration.includes("coalesce(procedure.proacl, '{}'::aclitem[])") &&
    !aclCorrection.includes("coalesce(relation.relacl, '{}'::aclitem[])") &&
    !aclCorrection.includes("coalesce(attribute.attacl, '{}'::aclitem[])") &&
    !aclCorrection.includes("coalesce(sequence.relacl, '{}'::aclitem[])") &&
    !aclCorrection.includes("coalesce(procedure.proacl, '{}'::aclitem[])"),
);
check(
  "forward fix is additive and does not alter global Supabase default privileges",
  /^begin;/im.test(aclCorrection) &&
    aclCorrection.trimEnd().toLowerCase().endsWith("commit;") &&
    !/^\s*(?:drop\s+(?:table|schema|type|function)|truncate|insert\s+into|update\s+public\.|delete\s+from)/im.test(
      withoutCreatedFunctionBodies(aclCorrection),
    ) &&
    !/alter\s+default\s+privileges/i.test(aclCorrection) &&
    !/supabase_migrations\.schema_migrations/i.test(aclCorrection),
);
check(
  "forward fix preflights and hardens all aggregate tables and sequences",
  aclCorrection.includes("do $project_acl_preflight$") &&
    aclCorrection.includes("do $project_acl_cleanup$") &&
    aclCorrection.includes("do $project_acl_assert$") &&
    aggregateTables.every((table) => aclCorrection.includes(`'${table}'`)) &&
    aggregateSequences.every((sequence) => aclCorrection.includes(`'${sequence}'`)) &&
    aclCorrection.includes("grant select on table") &&
    aclCorrection.includes("to service_role") &&
    aclCorrection.includes("from public, anon, authenticated, service_role"),
);
check(
  "forward fix creates the missing delete RPC and limits both RPCs to service_role",
  aclCorrection.includes(`create or replace function public.${deleteProjectRpc}`) &&
    aclCorrection.includes("security definer") &&
    aclCorrection.includes("set search_path = pg_catalog, pg_temp") &&
    aclCorrection.includes(
      `grant execute on function public.${deleteProjectRpc}(bigint) to service_role`,
    ) &&
    aclCorrection.includes(
      "grant execute on function public.save_project_admin_entry(bigint, jsonb) to service_role",
    ) &&
    helperFunctions.every((functionName) =>
      aclCorrection.includes(
        `revoke all privileges on function public.${functionName}()`,
      ),
    ),
);
check(
  "read-only ACL audit covers direct grants, effective privileges, defaults, memberships, and fixture residue",
  aclAudit.includes('client.query("begin read only")') &&
    aclAudit.includes('client.query("rollback")') &&
    aclAudit.includes("aclexplode(c.relacl)") &&
    aclAudit.includes("aclexplode(a.attacl)") &&
    aclAudit.includes("pg_default_acl") &&
    aclAudit.includes("pg_auth_members") &&
    aclAudit.includes("allRolesEffectiveDml") &&
    aclAudit.includes("fixtureProjectResidue") &&
    aclAudit.includes("fixtureLocationResidue"),
);
check(
  "schema parity audit is read-only and covers the complete aggregate catalog",
  schemaParityAudit.includes('client.query("begin read only")') &&
    schemaParityAudit.includes('client.query("rollback")') &&
    schemaParityAudit.includes('transaction_read_only !== "on"') &&
    schemaParityAudit.includes('constraints') &&
    schemaParityAudit.includes('indexes') &&
    schemaParityAudit.includes('rls_policies') &&
    schemaParityAudit.includes('user_triggers') &&
    schemaParityAudit.includes('expected_function_source_sha256') &&
    schemaParityAudit.includes('sequence_state') &&
    schemaParityAudit.includes('project_identity_snapshot') &&
    schemaParityAudit.includes('reference_location_parity') &&
    schemaParityAudit.includes('forbidden_legacy_function_presence') &&
    schemaParityAudit.includes('migration_registry') &&
    schemaParityAudit.includes('catalog_fingerprints') &&
    schemaParityAudit.includes('expected_pre_fix_gate') &&
    schemaParityAudit.includes('final_parity_gate') &&
    schemaParityAudit.includes('data_integrity_pass') &&
    schemaParityAudit.includes('acl_pass') &&
    schemaParityAudit.includes('schema_drift_remaining') &&
    schemaParityAudit.includes('qa_marker_residue') &&
    schemaParityAudit.includes('trigger_definition_drift') &&
    schemaParityAudit.includes('exact_column_drift') &&
    schemaParityAudit.includes('identity_sequences_uncalled') &&
    schemaParityAudit.includes('parent_constraint_oid') &&
    schemaParityAudit.includes('parent_trigger_oid') &&
    schemaParityAudit.includes('column_storage_inheritance_acl_and_comment_defaults') &&
    schemaParityAudit.includes('function_signature_security_owner_and_search_path'),
);
check(
  "schema parity final contract includes Project Row Actions and Global Truth owners",
  schemaParityAudit.includes("20260731100000_project_row_actions_capability.sql") &&
    schemaParityAudit.includes("20260805180000_global_truth_atomic_operations_closure.sql") &&
    schemaParityAudit.includes("20260813233530_projects_domain_hardening.sql") &&
    schemaParityAudit.includes("20260814002948_location_management_foundation.sql") &&
    schemaParityAudit.includes('"set_project_featured_admin_entry"') &&
    schemaParityAudit.includes('"duplicate_project_admin_entry"') &&
    schemaParityAudit.includes("columns: 122") &&
    schemaParityAudit.includes("indexes: 53") &&
    schemaParityAudit.includes("project_domain_hardening_migration_sha256") &&
    schemaParityAudit.includes("dashboard_truth_migration_sha256") &&
    schemaParityAudit.includes("reports_analytics_migration_sha256") &&
    schemaParityAudit.includes("functions: 9") &&
    schemaParityAudit.includes('"mutate_project_location"') &&
    schemaParityAudit.includes("location_management_migration_sha256") &&
    schemaParityAudit.includes('["projects.featured", "false"]'),
);
check(
  "schema parity audit begins read-only before catalog reads and always rolls back before evaluating its gate",
  schemaParityBeginReadOnlyIndex >= 0 &&
    schemaParityFirstCollectIndex > schemaParityBeginReadOnlyIndex &&
    schemaParityFinallyIndex > schemaParityFirstCollectIndex &&
    schemaParityRollbackIndex > schemaParityFinallyIndex &&
    schemaParityAuditErrorGateIndex > schemaParityRollbackIndex,
);
check(
  "schema parity audit decomposes column catalog properties semantically",
  schemaParityAudit.includes("function buildColumnPropertyDiagnostics") &&
    schemaParityAudit.includes("a.attstorage as storage_strategy") &&
    schemaParityAudit.includes("t.typstorage as type_default_storage_strategy") &&
    schemaParityAudit.includes("a.attcompression::integer as compression_code") &&
    schemaParityAudit.includes("function isSemanticallyDefaultCompression") &&
    schemaParityAudit.includes("Number(code) === 0") &&
    schemaParityAudit.includes("function isSemanticallyDefaultStatisticsTarget") &&
    schemaParityAudit.includes("value === null || Number(value) === -1") &&
    schemaParityAudit.includes("stored_column_acl_cardinality") &&
    schemaParityAudit.includes("directGrantsByColumn") &&
    schemaParityAudit.includes("A_representation_equivalent") &&
    schemaParityAudit.includes("B_allowed_pre_fix_drift") &&
    schemaParityAudit.includes("B_unexpected_drift") &&
    !schemaParityAudit.includes("as uses_default_compression") &&
    !/column\.stored_column_acl\s*===\s*null\s*&&\s*column\.comment/u.test(
      schemaParityAudit,
    ),
);
const expectedDefaultBlock = sliceBetween(
  schemaParityAudit,
  "const expectedColumnDefaults = new Map([",
  "const expectedColumnComments",
);
check(
  "schema parity audit has the exact final-default and allowed pre-fix counts",
  (expectedDefaultBlock.match(/^\s*\["[a-z_]+\.[a-z_]+",/gm) ?? []).length === 46 &&
    provenMissingChecks.length === 24 &&
    schemaParityAudit.includes("knownLegacyDefaultColumnKeys") &&
    schemaParityAudit.includes("legacyDefaultAllowed"),
);
check(
  "schema parity audit compares the 99 rebuilt and five additive final constraints",
  schemaParityAudit.includes("function extractExpectedConstraintManifest") &&
    schemaParityAudit.includes("constraints.length !== 99") &&
    schemaParityAudit.includes("function buildConstraintDiagnostics") &&
    schemaParityAudit.includes("expectedConstraintManifest.map") &&
    schemaParityAudit.includes(
      "constraintDiagnostics.all.length === expectedConstraintManifest.length",
    ) &&
    schemaParityAudit.includes("constraint.actual_present") &&
    schemaParityAudit.includes("constraint.metadata_differences.length === 0") &&
    schemaParityAudit.includes("constraint.definition_comparison.semantic_match") &&
    schemaParityAudit.includes("unexpectedActual.length === 0") &&
    schemaParityAudit.includes("expected_final_count") &&
    schemaParityAudit.includes("actual_final_count") &&
    schemaParityAudit.includes("expectedExistingConstraintManifest.length !== 75") &&
    schemaParityAudit.includes("knownAdditiveConstraintKeys") &&
    schemaParityAudit.includes("if (/\\bunique\\b/iu.test(clause))") &&
    schemaParityAudit.includes("constraint_type") &&
    schemaParityAudit.includes("validated") &&
    schemaParityAudit.includes("deferrable") &&
    schemaParityAudit.includes("initially_deferred") &&
    schemaParityAudit.includes("inheritance_count") &&
    schemaParityAudit.includes("is_local") &&
    schemaParityAudit.includes("no_inherit") &&
    schemaParityAudit.includes("parent_constraint_oid") &&
    schemaParityAudit.includes("expected_definition") &&
    schemaParityAudit.includes("actual_definition") &&
    schemaParityAudit.includes("normalizeConstraintDefinition") &&
    schemaParityAudit.includes("definition_comparison"),
);
check(
  "schema parity audit compares the exact definitions of all four final triggers",
  schemaParityAudit.includes("function extractExpectedTriggerManifest") &&
    schemaParityAudit.includes("triggers.length !== 4") &&
    schemaParityAudit.includes("function normalizeTriggerDefinition") &&
    schemaParityAudit.includes("function buildTriggerDiagnostics") &&
    schemaParityAudit.includes("expectedTriggerManifest.map") &&
    schemaParityAudit.includes("triggerDiagnostics.definitions.length === expectedTriggerManifest.length") &&
    schemaParityAudit.includes("triggerDiagnostics.mismatches.length === 0") &&
    schemaParityAudit.includes("triggerDiagnostics.unexpectedActual.length === 0") &&
    schemaParityAudit.includes("trigger_definition_drift") &&
    schemaParityAudit.includes("expected_definition") &&
    schemaParityAudit.includes("actual_definition"),
);
check(
  "schema parity definition canonicalizers prove PostgreSQL deparse equivalences and reject semantic changes",
  constraintDefinitionSemanticSelfTest.status === 0 &&
    constraintDefinitionSemanticSelfTest.error === undefined &&
    constraintDefinitionSemanticSelfTest.stdout.includes(
      "passed 5 constraint equivalents, 3 constraint negative controls, 1 trigger equivalent, and 1 trigger negative control",
    ) &&
    schemaParityAudit.includes("project_locations_root_shape_check") &&
    schemaParityAudit.includes("projects_latitude_check") &&
    schemaParityAudit.includes("projects_longitude_check") &&
    schemaParityAudit.includes("projects_map_zoom_check") &&
    schemaParityAudit.includes("projects_overview_image_required_check") &&
    schemaParityAudit.includes("text cast is not a numeric representation") &&
    schemaParityAudit.includes("missing is_active update column"),
);
check(
  "schema parity gate names final parity, ACL, drift, and data-integrity requirements explicitly",
  /column_storage_inheritance_acl_and_comment_defaults:\r?\n/.test(
    schemaParityAudit,
  ) &&
    /existing_constraint_metadata:\r?\n/.test(schemaParityAudit) &&
    schemaParityAudit.includes("final_parity_gate") &&
    schemaParityAudit.includes("data_integrity_pass") &&
    schemaParityAudit.includes("acl_pass") &&
    schemaParityAudit.includes("schema_drift_remaining") &&
    schemaParityAudit.includes("exact_aggregate_row_counts") &&
    schemaParityAudit.includes("reference_location_tree_matches_final_rebuild") &&
    schemaParityAudit.includes("exact_sequence_state") &&
    schemaParityAudit.includes("no_qa_marker_residue"),
);
check(
  "schema parity summary defaults to the final post-fix gate and isolates the legacy pre-fix gate behind an explicit flag",
  schemaParityAudit.includes("function buildFinalParityGate") &&
    schemaParityAudit.includes(
      'const preFixGateRequested = process.argv.includes("--expect-pre-fix")',
    ) &&
    /paritySummary\.schema_drift_remaining =\r?\n      buildSchemaDriftRemaining\(paritySummary\)/.test(
      schemaParityAudit,
    ) &&
    schemaParityAudit.includes("paritySummary.acl_pass = aclResult.passed") &&
    schemaParityAudit.includes(
      "paritySummary.data_integrity_pass = dataIntegrityResult.passed",
    ) &&
    schemaParityAudit.includes(
      "paritySummary.all_non_drift_invariants_match =",
    ) &&
    schemaParityAudit.includes(
      "paritySummary.final_parity_gate = buildFinalParityGate(paritySummary)",
    ) &&
    /if \(preFixGateRequested\) \{\r?\n      paritySummary\.expected_pre_fix_gate =/.test(
      schemaParityAudit,
    ) &&
    schemaParityAudit.includes("const activeGate = preFixGateRequested") &&
    schemaParityAudit.includes(": paritySummary?.final_parity_gate") &&
    schemaParityAudit.includes("if (activeGate && !activeGate.passed)") &&
    !schemaParityAudit.includes("!paritySummary.expected_pre_fix_gate.passed"),
);
check(
  "schema parity data gate proves the transferred catalog, stable sequence state, and no QA residue",
  schemaParityAudit.includes("function buildDataIntegrityPass") &&
    schemaParityAudit.includes("expectedPostClosureRowCounts") &&
    schemaParityAudit.includes("summary.data_integrity_snapshot.project_ids.length === 13") &&
    schemaParityAudit.includes("Number(stats.null_count) === 0") &&
    schemaParityAudit.includes("Number(stats.distinct_count) === expectedRows") &&
    schemaParityAudit.includes("Number(stats.duplicate_value_count) === 0") &&
    schemaParityAudit.includes("summary.data_integrity_snapshot.reference_locations.length ===") &&
    schemaParityAudit.includes("location.present && location.matches_expected") &&
    schemaParityAudit.includes("sequence.replace(/_id_seq$/u, \"\")") &&
    schemaParityAudit.includes("Number(state.last_value) >= expectedRows") &&
    schemaParityAudit.includes("state.is_called === true") &&
    schemaParityAudit.includes("Number(state.last_value) === 1 && state.is_called === false") &&
    schemaParityAudit.includes("function buildQaMarkerQuery") &&
    schemaParityAudit.includes("fixtureClientKeys") &&
    schemaParityAudit.includes("fixtureTextMarkerPattern") &&
    schemaParityAudit.includes("to_jsonb(row_record)::text ~* $2") &&
    schemaParityAudit.includes("summary.data_integrity_snapshot.qa_marker_residue.length === 0"),
);
check(
  "schema parity forward fix has one fail-closed additive transaction and no destructive object operation",
  /^begin;/im.test(schemaParityForwardFix) &&
    schemaParityForwardFix.trimEnd().toLowerCase().endsWith("commit;") &&
    schemaParityForwardFix.includes("do $project_parity_preflight$") &&
    schemaParityForwardFix.includes("do $project_parity_data_guard$") &&
    schemaParityForwardFix.includes("do $project_parity_assert$") &&
    schemaParityForwardFix.includes("do $project_acl_assert$") &&
    !/^\s*drop\s+(?:table|function|constraint|sequence|index|trigger|policy)\b/im.test(
      schemaParityForwardFix,
    ) &&
    !/^\s*truncate\b/im.test(schemaParityForwardFix) &&
    !/^\s*create\s+table\b/im.test(schemaParityForwardFix) &&
    !/^\s*alter\s+sequence\b/im.test(schemaParityForwardFix) &&
    !/\bsetval\s*\(/i.test(schemaParityForwardFix) &&
    !/\brestart\s+(?:with\s+)?\d+/i.test(schemaParityForwardFix) &&
    !/alter\s+column\s+id\b/i.test(schemaParityForwardFix) &&
    !/(?:insert\s+into|update|delete\s+from)\s+public\.projects\b/i.test(
      withoutCreatedFunctionBodies(schemaParityForwardFix),
    ) &&
    !/alter\s+default\s+privileges/i.test(schemaParityForwardFix) &&
    !/supabase_migrations\.schema_migrations/i.test(schemaParityForwardFix) &&
    !/alter\s+(?:column\s+[a-z_]+\s+)?set\s+(?:storage|compression)\b/i.test(
      schemaParityForwardFix,
    ) &&
    !/comment\s+on\s+column\b/i.test(schemaParityForwardFix) &&
    !/alter\s+constraint\b/i.test(schemaParityForwardFix),
);
check(
  "schema parity forward fix is limited to the proven column and check drift",
  (schemaParityForwardFix.match(/alter column [a-z_]+ drop default/g) ?? []).length === 11 &&
    (schemaParityForwardFix.match(/alter column [a-z_]+ set not null/g) ?? []).length === 10 &&
    provenMissingChecks.every((constraintName) =>
      schemaParityForwardFix.includes(`'${constraintName}'`),
    ) &&
    schemaParityForwardFix.includes("('project_locations', 10)") &&
    schemaParityForwardFix.includes("('project_location_points', 9)") &&
    schemaParityForwardFix.includes("('project_media', 9)") &&
    schemaParityForwardFix.includes("('project_videos', 10)"),
);
check(
  "schema parity forward fix locks and validates the exact 114-column old/final allowlist",
  schemaParityForwardFix.includes("in share row exclusive mode;") &&
    aggregateTables.every((table) =>
      schemaParityForwardFix.slice(
        schemaParityForwardFix.indexOf("lock table"),
        schemaParityForwardFix.indexOf("in share row exclusive mode;") +
          "in share row exclusive mode;".length,
      ).includes(`public.${table}`),
    ) &&
    (extractForwardFixColumnManifest(schemaParityForwardFix).match(
      /^\s*\('[a-z_]+',\s*\d+,\s*'[a-z_]+'/gm,
    ) ?? []).length === 114 &&
    (extractForwardFixColumnManifest(schemaParityForwardFix).match(/null::text/g) ?? [])
      .length === 72 &&
    (extractForwardFixColumnManifest(schemaParityForwardFix).match(
      /,\s*true,\s*'d',\s*'',\s*null::text\)/g,
    ) ?? []).length === 9 &&
    (extractForwardFixColumnManifest(schemaParityForwardFix).match(
      /,\s*false,\s*'',\s*'',\s*null::text\)/g,
    ) ?? []).length === 11 &&
    schemaParityForwardFix.includes("attribute.attidentity::text") &&
    schemaParityForwardFix.includes("attribute.attgenerated::text") &&
    schemaParityForwardFix.includes("attribute.attcollation = type_record.typcollation") &&
    schemaParityForwardFix.includes("attribute.atthasmissing") &&
    schemaParityForwardFix.includes("outside the audited pre-fix/final manifest"),
);
const forwardColumnManifestAssertion = sliceBetween(
  schemaParityForwardFix,
  "-- Exact 114-column final manifest",
  "if (\n    select count(*)\n      from pg_catalog.pg_trigger",
);
check(
  "schema parity forward-fix preflight uses PostgreSQL-version semantic catalog defaults",
  forwardColumnManifestAssertion.includes("attribute.attcompression::integer = 0") &&
    /\(\s*attribute\.attstattarget\s+is\s+null\s+or\s+attribute\.attstattarget\s*=\s*\(-1\)::smallint\s*\)/iu.test(
      forwardColumnManifestAssertion,
    ) &&
    /\(\s*attribute\.attacl\s+is\s+null\s+or\s+pg_catalog\.cardinality\(attribute\.attacl\)\s*=\s*0\s*\)/iu.test(
      forwardColumnManifestAssertion,
    ) &&
    !forwardColumnManifestAssertion.includes("attribute.attcompression::text = ''") &&
    !forwardColumnManifestAssertion.includes("attribute.attstattarget = -1"),
);
check(
  "Project schema assertions avoid schema-qualified COALESCE and mixed catalog pseudo-types",
  !/\bpg_catalog\.coalesce\s*\(/iu.test(
    `${schemaParityForwardFix}\n${migration}`,
  ) &&
    !/coalesce\s*\(\s*attribute\.(?:attstattarget|attcompression|attstorage|attidentity|attgenerated|attacl)\b/iu.test(
      schemaParityForwardFix,
    ) &&
    !/coalesce\s*\(\s*(?:constraint_record\.(?:contype|coninhcount|connoinherit)|trigger_record\.(?:tgtype|tgnargs|tgenabled))\b/iu.test(
      schemaParityForwardFix,
    ),
);
check(
  "schema parity forward fix compares exact PostgreSQL-parsed checks without persistent probes",
  schemaParityForwardFix.includes("pg_catalog.pg_get_expr(") &&
    schemaParityForwardFix.includes("errcode = 'PZ001'") &&
    schemaParityForwardFix.includes("when sqlstate 'PZ001'") &&
    schemaParityForwardFix.includes("not constraint_record.connoinherit") &&
    !schemaParityForwardFix.includes("PROJECT_SPACE_LITERAL") &&
    !schemaParityForwardFix.includes("catalog_definition"),
);
check(
  "schema parity forward fix fails closed on owners, overloads, legacy routines, and exact triggers",
  schemaParityForwardFix.includes("relation.relowner = 'postgres'::regrole") &&
    schemaParityForwardFix.includes("sequence_relation.relowner = 'postgres'::regrole") &&
    schemaParityForwardFix.includes("procedure_record.proowner = 'postgres'::regrole") &&
    schemaParityForwardFix.includes("sync_project_children(bigint,jsonb,jsonb,jsonb,jsonb,jsonb)") &&
    schemaParityForwardFix.includes(
      "admin_list_projects(integer,integer,text,text,text,text,text,text,text,text)",
    ) &&
    schemaParityForwardFix.includes("trigger_record.tgqual is null") &&
    schemaParityForwardFix.includes("trigger_record.tgnargs = 0") &&
    schemaParityForwardFix.includes("summary.deferrable_count = 7") &&
    schemaParityForwardFix.includes("summary.initially_deferred_count = 7") &&
    schemaParityForwardFix.includes("constraint_record.contype = 'c'") &&
    schemaParityForwardFix.includes("constraint_record.contype in ('p', 'f', 'u')") &&
    schemaParityForwardFix.includes("all_local_expected_inheritance") &&
    !schemaParityForwardFix.includes("all_local_uninherited"),
);
check(
  "schema parity forward fix installs exactly the four audited final function bodies",
  [
    "save_project_admin_entry",
    "validate_project_location_parent",
    "validate_project_location_selection",
    "prevent_project_location_reparent",
  ].every(
    (functionName) =>
      extractFunctionDefinition(schemaParityForwardFix, functionName) ===
      extractFunctionDefinition(migration, functionName),
  ),
);
const saveRpcConflictConstraintNames = [
  "project_location_points_client_unique",
  "project_features_client_unique",
  "project_floor_plans_client_unique",
  "project_delivery_items_client_unique",
  "project_media_client_unique",
  "project_videos_client_unique",
];
check(
  "applied schema parity forward-fix fingerprint remains frozen",
  createHash("sha256")
    .update(schemaParityForwardFix)
    .digest("hex")
    .toUpperCase() ===
    "357D8892AB6165E9488D0612E0D20A27B269DC7D9A06A62F272642EB43FF3990",
);
check(
  "save RPC conflict-arbiter correction is one additive fail-closed transaction",
  /^begin;/im.test(saveRpcConflictArbiterFix) &&
    saveRpcConflictArbiterFix.trimEnd().toLowerCase().endsWith("commit;") &&
    saveRpcConflictArbiterFix.includes(
      "do $project_save_rpc_conflict_arbiter_fix$",
    ) &&
    saveRpcConflictArbiterFix.includes(
      "aa3258d57ab320cd0fa46eeb2595ae7c",
    ) &&
    saveRpcConflictArbiterFix.includes(
      "bc79445ae958779ed889651cd980c236",
    ) &&
    !/^\s*(?:insert|update|delete|truncate|drop)\b/im.test(
      saveRpcConflictArbiterFix,
    ) &&
    !/supabase_migrations\.schema_migrations/i.test(saveRpcConflictArbiterFix),
);
check(
  "save RPC correction rewrites only the six ambiguous project_id conflict arbiters",
  saveRpcConflictConstraintNames.every((constraintName) =>
    saveRpcConflictArbiterFix.includes(`'${constraintName}'`),
  ) &&
    saveRpcConflictArbiterFix.includes(
      "v_old_arbiter constant text := 'on conflict (project_id, client_key)'",
    ) &&
    saveRpcConflictArbiterFix.includes(
      "'on conflict on constraint ' || v_constraint_name",
    ) &&
    !saveRpcConflictArbiterFix.includes(
      "project_floor_plan_details_client_unique",
    ) &&
    !saveRpcConflictArbiterFix.includes(
      "on conflict on constraint project_floor_plan_details",
    ),
);
check(
  "save RPC correction preserves signature, owner, ACL, defaults and fixed execution contract",
  saveRpcConflictArbiterFix.includes("procedure_record.proacl is not distinct from v_acl_before") &&
    saveRpcConflictArbiterFix.includes("procedure_record.proowner = v_owner_before") &&
    saveRpcConflictArbiterFix.includes(
      "pg_catalog.pg_get_function_arguments(procedure_record.oid) =",
    ) &&
    saveRpcConflictArbiterFix.includes(
      "'search_path=pg_catalog, pg_temp' = any",
    ) &&
    saveRpcConflictArbiterFix.includes(
      "acl.grantee not in (v_owner_before, 'service_role'::regrole)",
    ),
);
check(
  "schema parity forward fix makes location triggers observe is_active",
  schemaParityForwardFix.includes(
    "before insert or update of level, parent_id, is_active\non public.project_locations",
  ) &&
    schemaParityForwardFix.includes(
      "before update of level, parent_id, is_active on public.project_locations",
    ),
);
check(
  "schema parity forward fix seeds only the four canonical client keys without overwrite or sequence reset",
  [1, 2, 3, 4].every((suffix) =>
    schemaParityForwardFix.includes(
      `ca100000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`,
    ),
  ) &&
    (schemaParityForwardFix.match(/insert into public\.project_locations/g) ?? []).length === 4 &&
    !/update\s+public\.project_locations/i.test(
      withoutCreatedFunctionBodies(schemaParityForwardFix),
    ) &&
    !/delete\s+from\s+public\.project_locations/i.test(
      withoutCreatedFunctionBodies(schemaParityForwardFix),
    ) &&
    !/on\s+conflict[\s\S]*?do\s+update/i.test(
      schemaParityForwardFix.slice(
        schemaParityForwardFix.indexOf("do $project_reference_seed$"),
        schemaParityForwardFix.indexOf("$project_reference_seed$;") +
          "$project_reference_seed$;".length,
      ),
    ),
);
check(
  "explicit aggregate deletion is a service-role-only SECURITY DEFINER RPC",
  migration.includes(`function public.${deleteProjectRpc}`) &&
    migration.includes("security definer") &&
    migration.includes(`grant execute on function public.${deleteProjectRpc}(bigint) to service_role`),
);
check(
  "database owns immutable project type and validated location hierarchy",
  migration.includes("projects_type_immutable") &&
    migration.includes("projects_validate_location_selection") &&
    migration.includes("project_locations_prevent_reparent"),
);

const deletedKeys = [
  "location_point_ids",
  "feature_ids",
  "floor_plan_ids",
  "floor_plan_detail_ids",
  "delivery_item_ids",
  "media_ids",
  "video_ids",
] as const;
for (const key of deletedKeys) {
  check(`explicit deletion contract includes deleted.${key}`, migration.includes(`v_deleted -> '${key}'`) && contract.includes(`${key}: number[]`));
}
check(
  "implicit child omission fails closed instead of deleting a snapshot difference",
  (migration.match(/omitted without an explicit deletion tombstone/g) ?? []).length >= 7,
);
check(
  "stable identity validation covers every ordered child family",
  ["location point", "feature identity", "floor plan identity", "floor plan detail identity", "delivery item identity", "media identity", "video identity"].every((token) => migration.toLowerCase().includes(token)),
);
check(
  "ordered children use stable UUID client keys and explicit sort order",
  (migration.match(/client_key uuid not null/g) ?? []).length >= 7 &&
    (migration.match(/sort_order integer not null/g) ?? []).length >= 7,
);

check(
  "one Project form owns create and edit through AdminFormRuntime and one save action",
  form.includes("<AdminFormRuntime") &&
    form.includes("action={saveProjectEntry}") &&
    form.includes('mode={mode}') &&
    createPage.includes('<ProjectEditForm key={`${type}-new`} bundle={bundle}') &&
    editPage.includes("<ProjectEditForm key={bundle.project.id"),
);
check(
  "Create and Edit remount ProjectEditForm when the route identity changes",
  createPage.includes('<ProjectEditForm key={`${type}-new`}') &&
    editPage.includes("<ProjectEditForm key={bundle.project.id"),
);
check(
  "successful Project edits re-read the aggregate and remount child state with hydrated IDs and cleared tombstones",
  action.includes("reconciledBundle = await loadProjectEntry(saved.id)") &&
    action.includes("reconciledBundle,") &&
    form.includes("setFormSnapshot") &&
    form.includes("generation: current.generation + 1") &&
    form.includes("onSuccess={handleSaveSuccess}") &&
    form.includes(":${generation}`}") &&
    form.includes("window.location.reload()"),
);
check(
  "Project create and edit saves invalidate the existing Projects Data Runtime cache",
  dataRuntime.includes("export function useAdminEntityListInvalidation") &&
    dataRuntime.includes("adminEntityListQueryKeys.entity(entity)") &&
    form.includes('useAdminEntityListInvalidation("projects")') &&
    form.includes("void invalidateProjectsList()") &&
    formRuntime.includes("onSuccess?.(state);") &&
    formRuntime.indexOf("onSuccess?.(state);") < formRuntime.indexOf("router.replace(editHref"),
);
check(
  "collapsed floor-plan accordions keep every field mounted for complete FormData",
  repeaters.includes('aria-hidden={!isExpanded}') &&
    repeaters.includes('${isExpanded ? "grid" : "hidden"}'),
);
check(
  "rich-text required validation rejects visually empty markup",
  contract.includes("stripHtml(project.overview_body)") &&
    contract.includes("stripHtml(project.delivery_body)"),
);
check(
  "map URL, coordinates, and zoom are required in both TypeScript and SQL",
  contract.includes('addError(errors, "google_maps_url", "رابط خرائط جوجل مطلوب.")') &&
    migration.includes("google_maps_url text not null") &&
    migration.includes("latitude numeric(9, 6) not null") &&
    migration.includes("longitude numeric(9, 6) not null") &&
    migration.includes("map_zoom smallint not null"),
);
check(
  "exactly eight approved Project tab IDs are declared without duplicates",
  declaredProjectTabIds.length === approvedProjectTabIds.length &&
    new Set(declaredProjectTabIds).size === approvedProjectTabIds.length &&
    declaredProjectTabIds.every((tabId) => approvedProjectTabIds.includes(tabId as (typeof approvedProjectTabIds)[number])),
);
check(
  "Project tabs use the shared full-width editor presentation without a parallel preview column",
  form.includes('<div className="min-w-0 w-full">') &&
    form.includes("<AdminModuleTabs") &&
    form.includes('variant="editor"') &&
    !form.includes('variant="segmented"') &&
    moduleTabs.includes("export default function AdminModuleTabs") &&
    moduleTabs.includes('data-admin-tabs-owner="AdminModuleTabs"') &&
    !moduleTabs.includes("data-topic-tab") &&
    !existsSync(join(ROOT, legacyModuleTabsPath)) &&
    !form.includes("ProjectEntryPreview") &&
    !form.includes("AdminFormLayout") &&
    !form.includes("aside=") &&
    !existsSync(join(ROOT, previewPath)) &&
    form.includes('className="grid gap-4 xl:grid-cols-3"') &&
    repeaters.includes('className="grid scroll-mt-28 gap-4 xl:grid-cols-3"') &&
    mediaEditors.includes('className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"') &&
    !mediaEditors.includes("2xl:grid-cols-4"),
);
check(
  "Project tab metadata adopts the shared navigation, heading, and semantic-icon contract",
  ["البيانات", "الموقع", "نظرة عامة", "المساحات", "المواصفات", "الميديا", "SEO"].every((label) =>
    form.includes(`navigationLabel: "${label}"`),
  ) &&
    form.includes("navigationLabel: ADMIN_ENTITY_REVIEW_TAB_LABEL") &&
    sharedReviewContract.includes('ADMIN_ENTITY_REVIEW_TAB_LABEL = "المراجعة والنشر"') &&
    ["البيانات الأساسية للمشروع", "بيانات الموقع الأساسية", "النظرة العامة ومميزات المشروع", "المساحات والمخططات", "مواصفات التنفيذ والتسليم", "الصور والفيديو", "تحسين محركات البحث والمشاركة", "مراجعة المشروع وحالة الظهور"].every((heading) =>
      form.includes(`sectionHeading: "${heading}"`),
    ) &&
    form.includes('sectionDescription: "حدّد الموقع الإداري والإحداثيات والطرق والمعالم المحيطة بالمشروع."') &&
    ["content", "location", "overview", "plans", "specifications", "media", "seo", "publish"].every((icon) =>
      form.includes(`icon: "${icon}" as const`),
    ) &&
    moduleTabs.includes("AdminModuleTabIconName") &&
    moduleTabs.includes('variant = "editor"') &&
    moduleTabs.includes("sectionHeading?: ReactNode") &&
    !form.includes("<svg"),
);
check(
  "Project tab content starts after the shared heading without semantic duplicates",
  !form.includes('title="بيانات المشروع الأساسية"') &&
    !form.includes('title="بيانات الموقع الأساسية"') &&
    !form.includes('title="نظرة عامة عن المشروع"') &&
    ["بيانات الموقع الأساسية", "المساحات والمخططات", "مواصفات التنفيذ والتسليم", "الصور والفيديو"].every(
      (heading) => form.match(new RegExp(heading, "g"))?.length === 1,
    ) &&
    form.match(/<SectionCard>/g)?.length === 4 &&
    /<RepeaterSection>\s*<ProjectFloorPlansEditor/.test(form) &&
    form.includes("title?: string;") &&
    repeaters.includes("title?: string;") &&
    ["إعدادات الهيرو", "ما حول المشروع", "مميزات المشروع", "بنود المواصفات", "صور المواصفات والتسليم", "معرض الصور", "معرض الفيديو"].every(
      (subsection) => form.includes(`title="${subsection}"`),
    ),
);
check(
  "Project Create and Edit adopt the shared page surface and full-form cadence",
  [createPage, editPage].every((source) =>
    source.includes("<AdminPageExperience"),
  ) &&
    pageExperience.includes('data-admin-page-surface-owner="AdminPageExperience"') &&
    formPresentation.includes(
      'export const ADMIN_FORM_STACK_CLASS_NAME = "space-y-7"',
    ) &&
    form.includes("className={ADMIN_FORM_STACK_CLASS_NAME}") &&
    !form.includes('className="space-y-5"'),
);
check(
  "Project select consumers use the shared form listbox owner without visible native selects",
  [form, locationEditor, seoPanel].every((source) => !/<select(?:\s|>)/.test(source)) &&
    [form, locationEditor, seoPanel].every((source) => source.includes("<AdminFormListboxSelect")) &&
    formListbox.includes('data-admin-form-listbox-source=""') &&
    formListbox.includes("<AdminListboxSelect"),
);
check(
  "shared slug changes notify dirty tracking after React commits",
  form.includes("onChange={setSlug}") &&
    slugField.includes("notifyChangeRef") &&
    slugField.includes('dispatchEvent(new Event("input", { bubbles: true }))'),
);
check(
  "validation navigation focuses rich-text contenteditable controls",
  moduleTabs.includes('[contenteditable="true"]') &&
    formRuntime.includes('[contenteditable="true"]'),
);
check(
  "Project edit retains an inactive saved location chain without offering it as a new choice",
  entryData.includes("retainedLocationIds") &&
    entryData.includes('query.or(`is_active.eq.true,id.in.(${retainedIds.join(",")})`)') &&
    locationEditor.includes("disabled: !option.isActive") &&
    listbox.includes("option.disabled"),
);
check(
  "Project entry surfaces do not opt back into light appearances or standalone light surface tokens",
  projectEntryVisualSources.every(
    (source) => !source.includes('appearance="light"') && !standaloneLightClass.test(source),
  ),
);
check(
  "legacy Project create and update form actions were removed",
  !existsSync(join(ROOT, "src/app/admin/projects/project-actions/create.ts")) &&
    !existsSync(join(ROOT, "src/app/admin/projects/project-actions/update.ts")),
);
check(
  "Projects hub has no dead query-param feedback owner",
  !projectsHubPage.includes("searchParams") &&
    !projectsHubPage.includes("getNoticeText") &&
    !projectsHubPage.includes("params?.notice") &&
    !projectsHubPage.includes("params?.error"),
);
check(
  "Project action helpers expose only the three current runtime utilities",
  JSON.stringify(projectHelperExports) ===
    JSON.stringify([
      "createProjectSlug",
      "listPath",
      "withProjectMediaSynchronization",
    ]),
);
check(
  "legacy Project publication-status helper types were removed with their zero-consumer helpers",
  !existsSync(join(ROOT, "src/app/admin/projects/project-actions/types.ts")),
);
check(
  "save action authenticates, validates, calls the atomic RPC and supports Create-to-Edit",
  action.includes("requireAdminSession") &&
    action.includes("assessProjectEntryPayload") &&
    action.includes('"save_project_admin_entry"') &&
    action.includes("editHref"),
);
check(
  "Project Domain uses project_id as its sole identity and keeps code as a non-unique label",
  projectDomainHardeningMigration.includes(
    "public.projects.id is not the sole primary key",
  ) &&
    projectDomainHardeningMigration.includes(
      "drop index if exists public.projects_code_unique_idx",
    ) &&
    projectDomainHardeningMigration.includes("Required user-visible Project label") &&
    !action.includes("projects_code_unique_idx"),
);
check(
  "Project save adopts shared Media write coordination for all Project media domains",
  action.includes("coordinateProjectEntrySave") &&
    ["projects", "project_floor_plans", "project_media", "project_videos"].every((domain) => coordinator.includes(`"${domain}"`)) &&
    coordinator.includes("synchronizeMediaReferenceWriteScopesAfterDomainMutation"),
);
check(
  "Media cleanup is driven only by explicit tombstones",
  coordinator.includes("explicitlyDeleted") &&
    coordinator.includes("payload.deleted.floor_plan_ids") &&
    coordinator.includes("payload.deleted.media_ids") &&
    coordinator.includes("payload.deleted.video_ids"),
);
check(
  "Project SEO configures an entity-neutral shared analyzer panel",
  seoPanel.includes("analyzeEntitySeo") &&
    seoScore.includes("export function analyzeEntitySeo") &&
    form.includes("<ProjectSeoPanel") &&
    projectSeoPanel.includes("<AdminEntitySeoPanel") &&
    projectSeoPanel.includes('slugPlaceholder="project-slug"') &&
    projectSeoPanel.includes('mediaBrowseFolder: "images/projects/seo"') &&
    projectSeoPanel.includes("fieldNames={PROJECT_SEO_FIELD_NAMES}") &&
    projectSeoPanel.includes("fieldIds={PROJECT_SEO_FIELD_IDS}") &&
    seoPanel.match(/<AdminFormLayout/g)?.length === 1 &&
    seoPanel.match(/<AdminSingleOpenAccordion/g)?.length === 1 &&
    seoPanel.includes('defaultOpenId="search-result-preview"') &&
    ["search-result-preview", "open-graph-preview", "live-seo-analysis"].every((id) => seoPanel.includes(`id: "${id}"`)) &&
    ["معاينة نتائج البحث", "معاينة المشاركة الاجتماعية (Open Graph)", "تحليل SEO المباشر"].every((label) => seoPanel.includes(label)) &&
    entitySeoPrimaryStart >= 0 &&
    entitySeoReturnStart > entitySeoPrimaryStart &&
    entitySeoHelperStart > entitySeoReturnStart &&
    ["seoTitle", "seoDescription", "focusKeyword", "seoKeywords", "robotsIndex", "robotsFollow", "canonicalUrl", "ogImage", "ogImageAlt"].every(
      (field) => entitySeoPrimaryRender.includes(`fieldNames.${field}`) && !entitySeoHelperRender.includes(`fieldNames.${field}`),
    ) &&
    entitySeoRobotsIndexPosition >= 0 &&
    entitySeoRobotsIndexPosition < entitySeoRobotsFollowPosition &&
    entitySeoRobotsFollowPosition < entitySeoCanonicalPosition &&
    seoPanel.includes('data-admin-seo-control-order="index-follow-canonical"') &&
    !seoPanel.includes("البيانات الأساسية لتحسين محركات البحث") &&
    !seoPanel.includes("خصص عنوان ووصف وكلمات") &&
    entitySeoHelperRender.includes("navigationEventName={navigationEventName}") &&
    !["seo-basics", "social-sharing", "analysis-preview"].some((id) => seoPanel.includes(`id: "${id}"`)) &&
    !seoPanel.includes("project-") &&
    !seoPanel.includes("images/projects"),
);
check(
  "Form Runtime adoption registry records the unified Project create/edit owner",
  adoption.includes('id: "projects-create-edit"') &&
    adoption.includes('classification: "shared_adopter"'),
);

check(
  "PostgreSQL fixture covers stable IDs, reorder, explicit deletion, and forced rollback",
  fixture.includes("stable feature IDs or reorder failed") &&
    fixture.includes("explicit feature deletion tombstone failed") &&
    fixture.includes("explicit aggregate delete RPC did not cascade atomically") &&
    fixture.includes("forced aggregate failure did not fail") &&
    fixture.trimEnd().toLowerCase().endsWith("rollback;"),
);
check(
  "PostgreSQL fixture reports the complete ACL matrix before its first write",
  fixture.includes("v_acl_violations") &&
    fixture.includes("source=direct_relation_acl") &&
    fixture.includes("source=direct_column_acl") &&
    fixture.includes("source=effective_table_privilege") &&
    fixture.includes("source=direct_sequence_acl") &&
    fixture.includes("source=effective_sequence_privilege") &&
    fixture.includes("source=direct_function_acl") &&
    fixture.includes("source=effective_function_privilege") &&
    fixture.includes("MAINTAIN") &&
    fixture.includes("aggregate ACL diagnostics found %s violation(s) before fixture writes") &&
    fixture.indexOf("aggregate ACL diagnostics found %s violation(s) before fixture writes") <
      fixture.indexOf("insert into public.project_locations") &&
    aggregateTables.every((table) => fixture.includes(`public.${table}`)) &&
    aggregateSequences.every((sequence) => fixture.includes(`public.${sequence}`)),
);
check(
  "PostgreSQL fixture is rollback-only and never targets a remote environment",
  /^begin;/im.test(fixture) &&
    fixture.includes("always rolls it back") &&
    fixture.includes("must never target Remote/Production"),
);

check(
  "Project Row Actions migration is additive, local-only, and owns authoritative featured state",
  projectRowActionsMigration.includes("add column if not exists featured boolean") &&
    projectRowActionsMigration.includes("set featured = false") &&
    projectRowActionsMigration.includes("alter column featured set default false") &&
    projectRowActionsMigration.includes("alter column featured set not null") &&
    projectRowActionsMigration.includes("does not retain an atthasmissing representation") &&
    projectRowActionsMigration.includes("MUST NOT be applied to Remote/Production") &&
    !/\bdrop\s+table\b/i.test(projectRowActionsMigration),
);
check(
  "Project Row Actions RPCs are fixed-search-path service-role-only domain commands",
  [
    "set_project_featured_admin_entry",
    "duplicate_project_admin_entry",
  ].every((functionName) =>
    projectRowActionsMigration.includes(`function public.${functionName}`),
  ) &&
    (projectRowActionsMigration.match(/security definer/g) ?? []).length === 2 &&
    (projectRowActionsMigration.match(/set search_path = pg_catalog, pg_temp/g) ?? []).length === 2 &&
    projectRowActionsMigration.includes(
      "grant execute on function public.set_project_featured_admin_entry(bigint, boolean) to service_role",
    ) &&
    projectRowActionsMigration.includes(
      "grant execute on function public.duplicate_project_admin_entry(bigint) to service_role",
    ) &&
    ["public", "anon", "authenticated"].every((role) =>
      projectRowActionsMigration.includes(
        `revoke all on function public.duplicate_project_admin_entry(bigint) from ${role}`,
      ),
    ),
);
check(
  "duplicate RPC copies every clean Project aggregate child with fresh identities in one transaction",
  [
    "public.project_location_points",
    "public.project_features",
    "public.project_floor_plans",
    "public.project_floor_plan_details",
    "public.project_delivery_items",
    "public.project_media",
    "public.project_videos",
  ].every((table) => projectRowActionsMigration.includes(`insert into ${table}`)) &&
    (projectRowActionsMigration.match(/pg_catalog\.gen_random_uuid\(\)/g) ?? []).length >= 7 &&
    projectRowActionsMigration.includes("for update") &&
    projectRowActionsMigration.includes("exception") &&
    projectRowActionsMigration.trimEnd().toLowerCase().endsWith("commit;"),
);
check(
  "Project Row Actions PostgreSQL fixture proves success, forced child rollback, non-mutating failures, authoritative featured writes, and ACL",
  projectRowActionsFixture.includes("forced duplicate child failure left a partial Project root") &&
    projectRowActionsFixture.includes("duplicate Project child counts are incomplete") &&
    projectRowActionsFixture.includes("duplicate floor-plan detail count is incomplete") &&
    projectRowActionsFixture.includes("missing-source duplicate failure mutated Project data") &&
    projectRowActionsFixture.includes("authoritative featured RPC did not persist true") &&
    projectRowActionsFixture.includes("Project Row Actions RPC ACL is broader than service_role") &&
    /^begin;/im.test(projectRowActionsFixture) &&
    projectRowActionsFixture.trimEnd().toLowerCase().endsWith("rollback;"),
);

console.log(`OK: Project Admin Data Entry verifier passed ${passed} checks.`);
