import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";
import ts from "typescript";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "sql", "migrations");
const CURRENT_PROJECT_STATE_PATH = join(ROOT, "docs", "CURRENT_PROJECT_STATE.md");
const MIGRATION_FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const PLATFORM_OWNED_FUNCTIONS = new Set(["rls_auto_enable"]);
const FRAMEWORK_ENTRYPOINTS = new Set(["instrumentation.ts"]);
const GOVERNANCE_MANIFEST_ENTRYPOINTS = new Set([
  "lib/admin/content/content-editor-adoption-manifest.ts",
  "lib/admin/form-system/adoption-manifest.ts",
  "lib/admin/seo/entity-seo-adoption-manifest.ts",
]);
const RETIRED_LEGACY_PATHS = [
  "scripts/_final-probe.mjs",
  "scripts/apply-admin-audit-logs-migration.mjs",
  "scripts/apply-admin-users-migration.mjs",
  "scripts/apply-media-center-pages-seed.mjs",
  "scripts/apply-media-hub-migration.mjs",
  "scripts/apply-projects-hub-cms-foundation.mjs",
  "scripts/apply-sync-project-children-rpc.mjs",
  "scripts/capture-page-cta-shot.mjs",
  "scripts/capture-page-hero-shot.mjs",
  "scripts/dead-code-scan.mjs",
  "scripts/final-verification-session.mjs",
  "scripts/fix-admin-session-guard.mjs",
  "scripts/production-readiness-verify.mjs",
  "scripts/test-sync-project-children-rpc.mjs",
  "scripts/screenshots",
  "src/components/admin/VenesiaActionModal.tsx",
  "src/components/admin/content-workflow/BulkPublishValidationModal.tsx",
  "src/components/admin/content/ContentTypePicker.tsx",
  "src/components/admin/content/editors/media/MediaContentTypeBadge.tsx",
  "src/components/admin/content/editors/media/media-content-type-style.ts",
  "src/components/admin/projects/AdminMediaListField.tsx",
  "src/components/admin/projects/AdminStringListField.tsx",
  "src/components/admin/media/AdminMediaListField.tsx",
  "src/components/projects/ProjectsHubCTA.tsx",
  "src/components/projects/details/ProjectContactCTA.tsx",
  "src/components/projects/details/ResidentialExecutionJourney.tsx",
  "src/config/home-images.ts",
  "src/lib/admin/content-workflow/brand-tone-guardrails.ts",
  "src/lib/admin/entity-list/data-engine/index.ts",
  "src/lib/admin/list-public-image-paths.ts",
  "src/lib/admin/load-topic-categories.ts",
  "src/lib/admin/media-intelligence/scan-media-usage.ts",
  "src/lib/projects/floor-plan-specs.ts",
] as const;

type Migration = {
  file: string;
  version: string;
  name: string;
  sql: string;
  sha256: string;
};

type RegistryRow = {
  version: string;
  name: string | null;
  statements: string[] | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function loadMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const match = MIGRATION_FILE.exec(file);
      assert.ok(match, `Migration filename is not canonical: ${file}`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/\r\n?/gu, "\n");
      return {
        file,
        version: match[1],
        name: match[2],
        sql,
        sha256: sha256(sql),
      };
    });
}

function loadDocumentedStateMetric(label: string) {
  const source = readFileSync(CURRENT_PROJECT_STATE_PATH, "utf8");
  const row = source
    .split(/\r?\n/u)
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .find((cells) => cells[1] === label);
  assert.ok(row, `CURRENT_PROJECT_STATE is missing the metric: ${label}`);
  const value = row[2];
  assert.match(value ?? "", /^\d+$/u, `CURRENT_PROJECT_STATE metric is not numeric: ${label}`);
  return Number(value);
}

function verifyRuntimeReachability() {
  const sourceRoot = join(ROOT, "src");
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => resolve(entry.parentPath, entry.name));
  const filesByLowerPath = new Map(files.map((file) => [file.toLowerCase(), file]));
  const incoming = new Map(files.map((file) => [file, 0]));

  const resolveSourceImport = (from: string, specifier: string) => {
    const base = specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : specifier.startsWith("@/")
        ? resolve(sourceRoot, specifier.slice(2))
        : null;
    if (!base) return null;
    const candidates = [
      base,
      ...extensions.map((extension) => `${base}${extension}`),
      ...extensions.map((extension) => join(base, `index${extension}`)),
    ];
    return candidates
      .map((candidate) => filesByLowerPath.get(candidate.toLowerCase()) ?? null)
      .find(Boolean) ?? null;
  };

  for (const file of files) {
    const sourceFile = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      let specifier: string | null = null;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)
      ) {
        specifier = node.moduleSpecifier.text;
      } else if (
        ts.isCallExpression(node)
        && node.arguments.length > 0
        && ts.isStringLiteral(node.arguments[0])
        && (
          node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === "require")
        )
      ) {
        specifier = node.arguments[0].text;
      }
      if (specifier) {
        const target = resolveSourceImport(file, specifier);
        if (target) incoming.set(target, (incoming.get(target) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const zeroInbound = files
    .filter((file) => incoming.get(file) === 0)
    .map((file) => file.slice(sourceRoot.length + 1).replaceAll("\\", "/"))
    .filter((file) => !file.startsWith("app/") && file !== "proxy.ts" && !file.endsWith(".d.ts"));
  assert.deepEqual(
    zeroInbound.sort(),
    [...FRAMEWORK_ENTRYPOINTS, ...GOVERNANCE_MANIFEST_ENTRYPOINTS].sort(),
    `Unowned zero-inbound Runtime source remains: ${zeroInbound.filter((file) => !FRAMEWORK_ENTRYPOINTS.has(file) && !GOVERNANCE_MANIFEST_ENTRYPOINTS.has(file)).join(", ")}`,
  );
  return {
    sourceFiles: files.length,
    frameworkEntrypoints: zeroInbound.filter((file) => FRAMEWORK_ENTRYPOINTS.has(file)).length,
    governanceManifestEntrypoints: zeroInbound.filter((file) => GOVERNANCE_MANIFEST_ENTRYPOINTS.has(file)).length,
  };
}

function verifyStructuralContract(migrations: Migration[]) {
  const runtimeReachability = verifyRuntimeReachability();
  assert.ok(migrations.length > 0, "The canonical migration corpus is empty.");
  assert.equal(
    loadDocumentedStateMetric("Repository migration files"),
    migrations.length,
    "CURRENT_PROJECT_STATE migration count drifted from the canonical migration corpus.",
  );
  assert.equal(
    new Set(migrations.map((migration) => migration.version)).size,
    migrations.length,
    "Migration versions must be unique.",
  );
  assert.deepEqual(
    migrations.map((migration) => migration.file),
    [...migrations.map((migration) => migration.file)].sort(),
    "Migration files must be lexically ordered by their timestamp prefix.",
  );

  for (const legacyPath of RETIRED_LEGACY_PATHS) {
    assert.equal(existsSync(join(ROOT, legacyPath)), false, `Retired legacy path remains: ${legacyPath}`);
  }

  const sourceCorpus = readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
    .join("\n");
  assert.doesNotMatch(sourceCorpus, /\bsync_project_children\b/u, "Removed Project child-write owner is referenced by active source.");

  const projectAudit = readFileSync(join(ROOT, "scripts", "audit-project-admin-schema-parity.mjs"), "utf8");
  assert.match(projectAudit, /indexes:\s*53/u, "Project parity guard must include Dashboard and Reports indexes after removing Project Code uniqueness.");
  assert.match(projectAudit, /dashboard_truth_closure\.sql/u, "Project parity guard must include the Dashboard migration owner.");
  assert.match(projectAudit, /reports_analytics_capability_closure\.sql/u, "Project parity guard must include the Reports migration owner.");

  const packageSource = readFileSync(join(ROOT, "package.json"), "utf8");
  assert.match(packageSource, /verify:database-reconciliation/u, "Database reconciliation guard is not registered.");
  assert.match(packageSource, /verify:database-reconciliation-live/u, "Live database reconciliation guard is not registered.");

  return {
    migrationCount: migrations.length,
    corpusSha256: sha256(migrations.map(({ version, sha256: hash }) => `${version}:${hash}`).join("\n")),
    retiredLegacyPaths: RETIRED_LEGACY_PATHS.length,
    runtimeReachability,
  };
}

async function verifyLiveContract(migrations: Migration[]) {
  const connectionString = process.env.SUPABASE_DB_URL;
  assert.ok(connectionString, "SUPABASE_DB_URL is required for --live verification.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: "final-database-reconciliation-read-only",
  });
  await client.connect();

  try {
    await client.query("begin read only");

    const registry = (await client.query(
      `select version, name, statements
         from supabase_migrations.schema_migrations
        order by version`,
    )) as { rows: RegistryRow[] };
    assert.deepEqual(
      registry.rows.map((row) => row.version),
      migrations.map((migration) => migration.version),
      "Production migration registry versions drift from the repository corpus.",
    );

    for (const [index, migration] of migrations.entries()) {
      const row = registry.rows[index];
      assert.equal(row.name, migration.name, `Migration name drift: ${migration.version}`);
      assert.equal(row.statements?.length, 1, `Migration statement provenance is not canonical: ${migration.version}`);
      assert.equal(sha256(row.statements?.[0] ?? ""), migration.sha256, `Migration SQL drift: ${migration.version}`);
    }

    const corpus = migrations.map((migration) => migration.sql.toLowerCase()).join("\n");
    const catalog = (await client.query(`
      select 'relation'::text as object_type, c.relname as object_name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      union all
      select 'function', p.proname
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname <> 'rls_auto_enable'
      union all
      select 'index', i.relname
        from pg_catalog.pg_class i
        join pg_catalog.pg_namespace n on n.oid = i.relnamespace
       where n.nspname = 'public' and i.relkind = 'i'
         and not exists (
           select 1 from pg_catalog.pg_constraint constraint_owner
            where constraint_owner.conindid = i.oid
         )
      union all
      select 'trigger', t.tgname
        from pg_catalog.pg_trigger t
        join pg_catalog.pg_class c on c.oid = t.tgrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and not t.tgisinternal
      union all
      select 'policy', p.policyname
        from pg_catalog.pg_policies p
       where p.schemaname = 'public'
      order by object_type, object_name
    `)) as { rows: {
      object_type: "relation" | "function" | "index" | "trigger" | "policy";
      object_name: string;
    }[] };
    const orphanedObjects = catalog.rows.filter(({ object_name }) => !corpus.includes(object_name.toLowerCase()));
    assert.deepEqual(orphanedObjects, [], `Public catalog objects lack repository provenance: ${JSON.stringify(orphanedObjects)}`);

    const integrity = (await client.query(`
      with public_tables as (
        select c.oid, c.relrowsecurity
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p')
      ), function_names as (
        select p.proname, count(*) as signatures
          from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname <> all($1::text[])
         group by p.proname
      )
      select
        (select count(*)::int from public_tables) as public_tables,
        (select count(*)::int from public_tables where relrowsecurity) as rls_enabled_tables,
        (select count(*)::int
           from pg_catalog.pg_index i
           join pg_catalog.pg_class c on c.oid = i.indrelid
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and (not i.indisvalid or not i.indisready or not i.indislive)) as invalid_indexes,
        (select count(*)::int
           from pg_catalog.pg_constraint c
           join pg_catalog.pg_namespace n on n.oid = c.connamespace
          where n.nspname = 'public' and not c.convalidated) as unvalidated_constraints,
        (select count(*)::int from function_names where signatures > 1) as overloaded_function_names,
        (select count(*)::int from pg_catalog.pg_policies where schemaname = 'public') as public_policy_count,
        (select count(*)::int
           from pg_catalog.pg_proc p
           join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and has_function_privilege('anon', p.oid, 'EXECUTE')
            and p.prorettype not in ('pg_catalog.trigger'::regtype, 'pg_catalog.event_trigger'::regtype)) as anon_callable_data_functions,
        to_regprocedure('public.rls_auto_enable()') is not null as platform_function_present,
        (select count(*)::int from public.admin_audit_logs where action = 'database.migration_registry_reconciled') as reconciliation_audit_count
    `, [[...PLATFORM_OWNED_FUNCTIONS]])) as { rows: {
      public_tables: number;
      rls_enabled_tables: number;
      invalid_indexes: number;
      unvalidated_constraints: number;
      overloaded_function_names: number;
      public_policy_count: number;
      anon_callable_data_functions: number;
      platform_function_present: boolean;
      reconciliation_audit_count: number;
    }[] };
    const state = integrity.rows[0];
    assert.equal(
      loadDocumentedStateMetric("Production registry versions"),
      registry.rows.length,
      "CURRENT_PROJECT_STATE registry count drifted from the live registry.",
    );
    assert.equal(
      loadDocumentedStateMetric("Public catalog objects with repository provenance"),
      catalog.rows.length,
      "CURRENT_PROJECT_STATE provenance-object count drifted from the live catalog.",
    );
    assert.equal(
      loadDocumentedStateMetric("Public tables"),
      state.public_tables,
      "CURRENT_PROJECT_STATE public-table count drifted from the live catalog.",
    );
    assert.equal(
      loadDocumentedStateMetric("Public tables with RLS enabled"),
      state.rls_enabled_tables,
      "CURRENT_PROJECT_STATE RLS-table count drifted from the live catalog.",
    );
    assert.equal(state.rls_enabled_tables, state.public_tables, "One or more public tables do not have RLS enabled.");
    assert.equal(state.invalid_indexes, 0, "Invalid, unready, or non-live public indexes remain.");
    assert.equal(state.unvalidated_constraints, 0, "Unvalidated public constraints remain.");
    assert.equal(state.overloaded_function_names, 0, "Parallel public function overload owners remain.");
    assert.equal(state.public_policy_count, 3, "Public RLS policy inventory drifted from the three repository-owned read policies.");
    assert.equal(state.anon_callable_data_functions, 0, "Anonymous role can execute an application data function.");
    assert.equal(state.platform_function_present, true, "Supabase platform RLS event-trigger owner is missing.");
    assert.ok(state.reconciliation_audit_count >= 1, "Migration registry reconciliation audit proof is missing.");

    for (const view of catalog.rows.filter((entry) => entry.object_type === "relation" && [
      "admin_content_topics",
      "admin_media_assets_catalog",
      "admin_media_folders_catalog",
      "page_composition_assignments",
    ].includes(entry.object_name))) {
      assert.match(view.object_name, /^[a-z_][a-z0-9_]*$/u);
      await client.query(`select * from public.${view.object_name} limit 0`);
    }

    return {
      registryVersions: registry.rows.length,
      catalogObjectsWithRepositoryProvenance: catalog.rows.length,
      publicTables: state.public_tables,
      rlsEnabledTables: state.rls_enabled_tables,
      invalidIndexes: state.invalid_indexes,
      unvalidatedConstraints: state.unvalidated_constraints,
      overloadedFunctionNames: state.overloaded_function_names,
      publicPolicyCount: state.public_policy_count,
      anonymousCallableDataFunctions: state.anon_callable_data_functions,
      reconciliationAuditCount: state.reconciliation_audit_count,
    };
  } finally {
    await client.query("rollback").catch(() => undefined);
    await client.end();
  }
}

const migrations = loadMigrations();
const structural = verifyStructuralContract(migrations);
const live = process.argv.includes("--live") ? await verifyLiveContract(migrations) : null;
console.log(JSON.stringify({ status: "ready", structural, live }, null, 2));
