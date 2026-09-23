import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLocalDevelopmentConfiguration,
  assertMigrationHistoryPrefix,
  LOCAL_DEVELOPMENT_SUPABASE,
  readLocalDevelopmentMigrationCorpus,
} from "./lib/local-development-supabase.mts";
import {
  assertOnlineMigrationHistory,
  classifyDevelopmentSupabaseTarget,
} from "./development-supabase-preflight.mts";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const corpus = readLocalDevelopmentMigrationCorpus();
assertLocalDevelopmentConfiguration();

assert.equal(LOCAL_DEVELOPMENT_SUPABASE.projectId, "venisia-local-development");
assert.equal(LOCAL_DEVELOPMENT_SUPABASE.apiUrl, "http://127.0.0.1:54321");
assert.match(LOCAL_DEVELOPMENT_SUPABASE.databaseUrl, /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres$/u);
assert.equal(LOCAL_DEVELOPMENT_SUPABASE.canonicalMigrations, "sql/migrations");
assert.equal(LOCAL_DEVELOPMENT_SUPABASE.generatedMigrations, "supabase/migrations");
assert.ok(corpus.length >= 108);
assert.deepEqual(corpus, [...corpus].sort((left, right) => left.file.localeCompare(right.file)));

const prefix = corpus.slice(0, 3).map(({ version, name }) => ({ version, name }));
const state = { formatVersion: 1 as const, projectId: "venisia-local-development" as const,
  applied: corpus.slice(0, 3).map(({ version, name, sha256 }) => ({ version, name, sha256 })), seedVersion: 1 as const };
assert.doesNotThrow(() => assertMigrationHistoryPrefix(prefix, corpus, state));
assert.throws(() => assertMigrationHistoryPrefix(prefix, corpus, null), /LOCAL_PROVENANCE_STATE_MISSING/u);
assert.throws(() => assertMigrationHistoryPrefix([{ ...prefix[0], name: "drift" }], corpus, state), /LOCAL_HISTORY_DIVERGED/u);
assert.throws(() => assertMigrationHistoryPrefix([], corpus, state), /LOCAL_STATE_EXISTS_WITH_EMPTY_HISTORY/u);
assert.throws(() => assertLocalDevelopmentConfiguration(read("supabase/config.toml").replace("venisia-local-development", "remote-project")),
  /LOCAL_PROJECT_ID_MISMATCH/u);
assert.throws(() => assertLocalDevelopmentConfiguration(read("supabase/config.toml").replace("port = 54322", "port = 6543")),
  /LOCAL_DATABASE_PORT_MISMATCH/u);

const onlineEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL=https://pmqsfqvvekrlujqgurcu.supabase.co",
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${"a".repeat(32)}`,
  `SUPABASE_SERVICE_ROLE_KEY=${"s".repeat(32)}`,
  "SUPABASE_DB_URL=postgresql://postgres.pmqsfqvvekrlujqgurcu:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
].join("\n");
const onlineTarget = classifyDevelopmentSupabaseTarget(onlineEnvironment);
assert.equal(onlineTarget.kind, "online");
if (onlineTarget.kind === "online") assert.equal(onlineTarget.projectRef, "pmqsfqvvekrlujqgurcu");
assert.throws(() => classifyDevelopmentSupabaseTarget(onlineEnvironment.replaceAll("pmqsfqvvekrlujqgurcu", "abcdefghijklmnopqrst")),
  /ONLINE_PROJECT_NOT_APPROVED/u);
assert.throws(() => classifyDevelopmentSupabaseTarget(`${onlineEnvironment}\nVENISIA_SUPABASE_TARGET=venisia-local-development`),
  /ONLINE_TARGET_HAS_LOCAL_MARKER/u);
const onlineHistory = corpus.map(({ version, name }) => ({ version, name }));
assert.doesNotThrow(() => assertOnlineMigrationHistory(onlineHistory, corpus));
assert.throws(() => assertOnlineMigrationHistory(onlineHistory.slice(0, -1), corpus), /ONLINE_DATABASE_BEHIND_REPOSITORY/u);
assert.throws(() => assertOnlineMigrationHistory([{ ...onlineHistory[0], name: "drift" }, ...onlineHistory.slice(1)], corpus),
  /ONLINE_HISTORY_DIVERGED/u);

const owner = read("scripts/lib/local-development-supabase.mts");
assert.match(owner, /REMOTE_PROJECT_LINK_PRESENT/u);
assert.match(owner, /127\.0\.0\.1:54322/u);
assert.match(owner, /LOCAL_HISTORY_DIVERGED/u);
assert.match(owner, /LOCAL_APPLIED_SOURCE_DRIFT/u);
assert.match(owner, /runEntitySeoBackfill/u);
assert.doesNotMatch(owner, /^import .*backfill-entity-seo-scores/mu);
assert.match(owner, /await import\("\.\.\/backfill-entity-seo-scores\.mts"\)/u);
assert.match(owner, /node_modules", "supabase", "dist", "supabase\.js/u);
assert.match(owner, /spawnSync\(process\.execPath/u);
assert.match(owner, /stop", "--no-backup/u);
assert.doesNotMatch(owner, /SUPABASE_DB_URL|DATABASE_URL\s*=\s*process\.env/u);

const packageJson = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  type?: string;
};
assert.equal(packageJson.devDependencies.supabase, "2.116.0");
assert.match(packageJson.scripts.dev, /^npm run dev:db:preflight && next dev/u);
assert.equal(packageJson.scripts["dev:db:preflight"],
  "node --experimental-strip-types scripts/development-supabase-preflight.mts");
for (const command of ["start", "stop", "reset"]) {
  assert.equal(packageJson.scripts[`dev:db:${command}`],
    `node --experimental-strip-types scripts/local-development-supabase.mts ${command}`);
}
assert.equal(packageJson.scripts.build, "next build");
assert.equal(packageJson.type, undefined);

const developmentPreflight = read("scripts/development-supabase-preflight.mts");
assert.match(developmentPreflight, /begin transaction read only/u);
assert.match(developmentPreflight, /select version,name from supabase_migrations\.schema_migrations order by version/u);
assert.match(developmentPreflight, /APPROVED_ONLINE_PROJECT_REF = "pmqsfqvvekrlujqgurcu"/u);
assert.doesNotMatch(developmentPreflight, /client\.query\(\s*["'`](?:insert|update|delete|alter|create|drop|grant|revoke)\b/iu);
assert.doesNotMatch(packageJson.scripts["dev:db:preflight"], /disable-warning|no-warnings/u);

const generated = resolve(root, "supabase/migrations");
const trackedGenerated = execFileSync("git", ["ls-files", "--", generated], { cwd: root, encoding: "utf8" }).trim();
assert.equal(trackedGenerated, "", "Generated Supabase migrations must remain untracked.");
for (const path of [".env.local", ".supabase-local/state.json", "supabase/migrations/generated.sql"])
  execFileSync("git", ["check-ignore", "-q", path], { cwd: root });

for (const path of ["scripts/fixtures/local-development/seed-pre-enforce.sql", "scripts/fixtures/local-development/seed-post-migrations.sql"]) {
  const seed = read(path);
  assert.match(seed, /Synthetic local-development|Synthetic local development/u);
  assert.doesNotMatch(seed, /service_role_key|supabase\.co|@gmail\.com|@outlook\.com/u);
}

const isolatedSources = ["scripts/lib/isolated-supabase.mts", "scripts/lib/isolated-public-application.mts", "scripts/qa-isolated-supabase.mts"];
for (const path of isolatedSources) assert.doesNotMatch(read(path), /local-development-supabase/u);
const localRuntimeDirectories = new Set([".branches", ".temp", "migrations", "snippets"]);
assert.deepEqual(
  readdirSync(resolve(root, "supabase")).filter(name => !localRuntimeDirectories.has(name)).sort(),
  ["config.toml"],
);

console.log(JSON.stringify({
  checks: "PASS",
  migrationCount: corpus.length,
  migrationHead: corpus.at(-1)?.version,
  canonicalOwner: LOCAL_DEVELOPMENT_SUPABASE.canonicalMigrations,
  generatedCopyTracked: false,
  dailyOnlineTargetAccepted: true,
  localTargetStillSupported: true,
  onlinePreflightReadOnly: true,
  packageTypeChanged: false,
  isolatedQaCoupling: false,
}, null, 2));
