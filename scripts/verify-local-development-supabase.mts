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

const owner = read("scripts/lib/local-development-supabase.mts");
assert.match(owner, /REMOTE_PROJECT_LINK_PRESENT/u);
assert.match(owner, /127\.0\.0\.1:54322/u);
assert.match(owner, /LOCAL_HISTORY_DIVERGED/u);
assert.match(owner, /LOCAL_APPLIED_SOURCE_DRIFT/u);
assert.match(owner, /runEntitySeoBackfill/u);
assert.match(owner, /stop", "--no-backup/u);
assert.doesNotMatch(owner, /SUPABASE_DB_URL|DATABASE_URL\s*=\s*process\.env/u);

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
assert.match(packageJson.scripts.dev, /^npm run dev:db:preflight && next dev/u);
for (const command of ["start", "stop", "reset", "preflight"]) {
  assert.equal(packageJson.scripts[`dev:db:${command}`],
    `node --experimental-strip-types scripts/local-development-supabase.mts ${command}`);
}
assert.equal(packageJson.scripts.build, "next build");

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
assert.deepEqual(readdirSync(resolve(root, "supabase")).filter(name => name !== "migrations").sort(), ["config.toml"]);

console.log(JSON.stringify({
  checks: "PASS",
  migrationCount: corpus.length,
  migrationHead: corpus.at(-1)?.version,
  canonicalOwner: LOCAL_DEVELOPMENT_SUPABASE.canonicalMigrations,
  generatedCopyTracked: false,
  remoteTargetInputAccepted: false,
  isolatedQaCoupling: false,
}, null, 2));
