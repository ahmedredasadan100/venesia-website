import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  rmSync, writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error This workspace uses pg without separate declarations.
import pg from "pg";

import { runEntitySeoBackfill } from "../backfill-entity-seo-scores.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG = join(ROOT, "supabase", "config.toml");
const CANONICAL_MIGRATIONS = join(ROOT, "sql", "migrations");
const GENERATED_MIGRATIONS = join(ROOT, "supabase", "migrations");
const LOCAL_STATE_DIRECTORY = join(ROOT, ".supabase-local");
const STATE_FILE = join(LOCAL_STATE_DIRECTORY, "migration-state.json");
const ENV_FILE = join(ROOT, ".env.local");
const CLI_BINARY = join(ROOT, "node_modules", "@supabase", "cli-windows-x64", "bin", "supabase.exe");
const PROJECT_ID = "venisia-local-development";
const API_URL = "http://127.0.0.1:54321";
const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const HASH = /^[a-f0-9]{64}$/u;
const FIRST_SEO_EXPAND = "20260914004050";
const SECOND_SEO_EXPAND = "20260914004118";
const SEO_ENFORCE = "20260914151556";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export type LocalMigration = { file: string; version: string; name: string; sql: string; sha256: string };
type LocalHistory = { version: string; name: string };
type LocalState = { formatVersion: 1; projectId: typeof PROJECT_ID; applied: Array<Pick<LocalMigration, "version" | "name" | "sha256">>; seedVersion: 1 };
type CliStatus = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; DB_URL: string };

export class LocalDevelopmentSupabaseError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Local development Supabase stopped: ${code}.`);
    this.name = "LocalDevelopmentSupabaseError";
    this.code = code;
  }
}

function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new LocalDevelopmentSupabaseError(code);
}

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== "" && !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
}

export function readLocalDevelopmentMigrationCorpus(): LocalMigration[] {
  check(existsSync(CANONICAL_MIGRATIONS) && lstatSync(CANONICAL_MIGRATIONS).isDirectory(), "MIGRATION_OWNER_MISSING");
  const files = readdirSync(CANONICAL_MIGRATIONS).filter(file => file.endsWith(".sql")).sort();
  check(files.length > 0 && files.every(file => FILE.test(file)), "NONCANONICAL_MIGRATION_FILE");
  const migrations = files.map(file => {
    const match = FILE.exec(file)!;
    const sql = readFileSync(join(CANONICAL_MIGRATIONS, file), "utf8").replace(/\r\n?/gu, "\n");
    return { file, version: match[1], name: match[2], sql, sha256: sha256(sql) };
  });
  check(new Set(migrations.map(item => item.version)).size === migrations.length, "DUPLICATE_MIGRATION_VERSION");
  return migrations;
}

export function assertLocalDevelopmentConfiguration(config = readFileSync(CONFIG, "utf8")): void {
  check(/project_id\s*=\s*"venisia-local-development"/u.test(config), "LOCAL_PROJECT_ID_MISMATCH");
  check(/\[api\][\s\S]*?port\s*=\s*54321/u.test(config), "LOCAL_API_PORT_MISMATCH");
  check(/\[db\][\s\S]*?port\s*=\s*54322/u.test(config), "LOCAL_DATABASE_PORT_MISMATCH");
  check(!existsSync(join(ROOT, "supabase", ".temp", "project-ref")), "REMOTE_PROJECT_LINK_PRESENT");
  check(existsSync(CLI_BINARY) && lstatSync(CLI_BINARY).isFile(), "LOCAL_SUPABASE_CLI_MISSING");
}

export function assertMigrationHistoryPrefix(history: LocalHistory[], corpus: LocalMigration[], state: LocalState | null): void {
  check(history.length <= corpus.length, "LOCAL_HISTORY_HAS_UNEXPECTED_MIGRATION");
  for (const [index, row] of history.entries()) {
    check(row.version === corpus[index].version && row.name === corpus[index].name, "LOCAL_HISTORY_DIVERGED");
  }
  if (history.length === 0) {
    check(state === null, "LOCAL_STATE_EXISTS_WITH_EMPTY_HISTORY");
    return;
  }
  check(state !== null && state.formatVersion === 1 && state.projectId === PROJECT_ID && state.seedVersion === 1,
    "LOCAL_PROVENANCE_STATE_MISSING");
  check(state.applied.length === history.length, "LOCAL_PROVENANCE_LENGTH_MISMATCH");
  for (const [index, row] of state.applied.entries()) {
    check(row.version === history[index].version && row.name === history[index].name
      && HASH.test(row.sha256) && row.sha256 === corpus[index].sha256, "LOCAL_APPLIED_SOURCE_DRIFT");
  }
}

function cliEnvironment(): NodeJS.ProcessEnv {
  const home = join(LOCAL_STATE_DIRECTORY, "cli-home");
  for (const path of [LOCAL_STATE_DIRECTORY, home]) mkdirSync(path, { recursive: true });
  return {
    ...process.env,
    SUPABASE_HOME: home,
    SUPABASE_NO_UPDATE_NOTIFIER: "1",
    SUPABASE_TELEMETRY_DISABLED: "1",
    DO_NOT_TRACK: "1",
  };
}

function runCli(args: string[], capture = false): string {
  assertLocalDevelopmentConfiguration();
  const result = spawnSync(CLI_BINARY, [...args, "--workdir", ROOT], {
    cwd: ROOT,
    env: cliEnvironment(),
    windowsHide: true,
    shell: false,
    encoding: "utf8",
    maxBuffer: 20_000_000,
    stdio: capture ? "pipe" : "inherit",
  });
  check(result.error === undefined && result.status === 0, "LOCAL_SUPABASE_CLI_FAILED");
  return capture ? result.stdout : "";
}

function clearGeneratedMigrations(): void {
  const parent = realpathSync(join(ROOT, "supabase"));
  const target = resolve(GENERATED_MIGRATIONS);
  check(inside(parent, target) && target === GENERATED_MIGRATIONS, "UNSAFE_GENERATED_MIGRATION_PATH");
  if (existsSync(target)) {
    check(!lstatSync(target).isSymbolicLink(), "GENERATED_MIGRATIONS_IS_LINK");
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(target, { recursive: true });
}

function materialize(migrations: LocalMigration[]): void {
  clearGeneratedMigrations();
  for (const migration of migrations) {
    const destination = join(GENERATED_MIGRATIONS, migration.file);
    writeFileSync(destination, migration.sql, { flag: "wx" });
    check(sha256(readFileSync(destination, "utf8")) === migration.sha256, "GENERATED_MIGRATION_DRIFT");
  }
}

function readState(): LocalState | null {
  if (!existsSync(STATE_FILE)) return null;
  const value = JSON.parse(readFileSync(STATE_FILE, "utf8")) as LocalState;
  check(value && value.formatVersion === 1 && value.projectId === PROJECT_ID && value.seedVersion === 1
    && Array.isArray(value.applied), "LOCAL_PROVENANCE_STATE_INVALID");
  return value;
}

function writeState(corpus: LocalMigration[]): void {
  mkdirSync(LOCAL_STATE_DIRECTORY, { recursive: true });
  const state: LocalState = { formatVersion: 1, projectId: PROJECT_ID,
    applied: corpus.map(({ version, name, sha256 }) => ({ version, name, sha256 })), seedVersion: 1 };
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const identity = await client.query("select current_database() as database,current_user as role,inet_server_port() as port");
  check(identity.rows.length === 1 && identity.rows[0].database === "postgres"
    && identity.rows[0].role === "postgres" && identity.rows[0].port === 5432, "LOCAL_DATABASE_IDENTITY_MISMATCH");
  return client;
}

async function readHistory(client: pg.Client): Promise<LocalHistory[]> {
  const present = await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as present");
  if (!present.rows[0]?.present) return [];
  const result = await client.query("select version,name from supabase_migrations.schema_migrations order by version");
  return result.rows.map((row: Record<string, unknown>) => ({ version: String(row.version), name: String(row.name) }));
}

async function applyPrefix(corpus: LocalMigration[], throughVersion: string): Promise<void> {
  const index = corpus.findIndex(item => item.version === throughVersion);
  check(index >= 0, "REQUIRED_MIGRATION_BOUNDARY_MISSING");
  materialize(corpus.slice(0, index + 1));
  runCli(["migration", "up", "--local"]);
}

async function runSeed(client: pg.Client, file: string): Promise<void> {
  const path = join(ROOT, "scripts", "fixtures", "local-development", file);
  check(existsSync(path) && lstatSync(path).isFile() && inside(ROOT, path), "LOCAL_SEED_MISSING");
  await client.query(readFileSync(path, "utf8").replace(/\r\n?/gu, "\n"));
}

async function advance(client: pg.Client, history: LocalHistory[], corpus: LocalMigration[]): Promise<void> {
  const firstExpand = corpus.findIndex(item => item.version === FIRST_SEO_EXPAND);
  const secondExpand = corpus.findIndex(item => item.version === SECOND_SEO_EXPAND);
  const enforce = corpus.findIndex(item => item.version === SEO_ENFORCE);
  check(firstExpand >= 0 && secondExpand === firstExpand + 1 && enforce === secondExpand + 1, "SEO_MIGRATION_SEQUENCE_MISSING");
  if (history.length <= firstExpand) {
    check(history.length === 0 || history.length === firstExpand, "LOCAL_HISTORY_STOPPED_INSIDE_STAGED_CUTOVER");
    await applyPrefix(corpus, SECOND_SEO_EXPAND);
    await runSeed(client, "seed-pre-enforce.sql");
    const applied = await runEntitySeoBackfill({ connectionString: DATABASE_URL, expectedDatabase: "postgres", apply: true });
    check(applied.complete && applied.counts.failed === 0 && applied.counts.conflicted === 0 && applied.counts.unresolved === 0,
      "LOCAL_SEO_BACKFILL_FAILED");
    const verified = await runEntitySeoBackfill({ connectionString: DATABASE_URL, expectedDatabase: "postgres", verify: true });
    check(verified.complete && verified.readyForEnforcement && verified.counts.failed === 0 && verified.counts.unresolved === 0,
      "LOCAL_SEO_BACKFILL_NOT_READY");
    await applyPrefix(corpus, SEO_ENFORCE);
  } else {
    check(history.length >= enforce + 1, "LOCAL_HISTORY_STOPPED_INSIDE_STAGED_CUTOVER");
  }
  materialize(corpus);
  runCli(["migration", "up", "--local"]);
  await runSeed(client, "seed-post-migrations.sql");
}

function parseStatus(value: string): CliStatus {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  check(start >= 0 && end > start, "LOCAL_STATUS_JSON_MISSING");
  const status = JSON.parse(value.slice(start, end + 1)) as Partial<CliStatus>;
  check(status.API_URL === API_URL && status.DB_URL === DATABASE_URL
    && typeof status.ANON_KEY === "string" && status.ANON_KEY.length > 20
    && typeof status.SERVICE_ROLE_KEY === "string" && status.SERVICE_ROLE_KEY.length > 20,
  "LOCAL_STATUS_IDENTITY_MISMATCH");
  return status as CliStatus;
}

function envValues(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of source.split(/\r?\n/u)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match) result.set(match[1], match[2]);
  }
  return result;
}

function updateLocalEnvironment(status: CliStatus): void {
  const replacements = new Map([
    ["NEXT_PUBLIC_SUPABASE_URL", status.API_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", status.ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", status.SERVICE_ROLE_KEY],
    ["VENISIA_SUPABASE_TARGET", PROJECT_ID],
  ]);
  const original = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const found = new Set<string>();
  const lines = original.split(/\r?\n/u).map(line => {
    const match = /^([A-Z][A-Z0-9_]*)=/u.exec(line);
    if (!match || !replacements.has(match[1])) return line;
    found.add(match[1]);
    return `${match[1]}=${replacements.get(match[1])}`;
  });
  for (const [key, value] of replacements) if (!found.has(key)) lines.push(`${key}=${value}`);
  writeFileSync(ENV_FILE, `${lines.filter((line, index) => line !== "" || index < lines.length - 1).join("\n")}\n`, { mode: 0o600 });
}

async function verifyCurrent(client: pg.Client, corpus: LocalMigration[], status: CliStatus, requireEnvironment: boolean): Promise<LocalHistory[]> {
  const history = await readHistory(client);
  assertMigrationHistoryPrefix(history, corpus, readState());
  check(history.length === corpus.length, "LOCAL_DATABASE_BEHIND_REPOSITORY");
  if (requireEnvironment) {
    check(existsSync(ENV_FILE), "LOCAL_ENVIRONMENT_MISSING");
    const env = envValues(readFileSync(ENV_FILE, "utf8"));
    check(env.get("VENISIA_SUPABASE_TARGET") === PROJECT_ID
      && env.get("NEXT_PUBLIC_SUPABASE_URL") === status.API_URL
      && env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") === status.ANON_KEY
      && env.get("SUPABASE_SERVICE_ROLE_KEY") === status.SERVICE_ROLE_KEY,
    "LOCAL_ENVIRONMENT_TARGET_MISMATCH");
  }
  return history;
}

export async function startLocalDevelopmentSupabase(): Promise<Record<string, unknown>> {
  assertLocalDevelopmentConfiguration();
  const corpus = readLocalDevelopmentMigrationCorpus();
  materialize([]);
  runCli(["start"]);
  const client = await connect();
  try {
    const before = await readHistory(client);
    assertMigrationHistoryPrefix(before, corpus, readState());
    if (before.length < corpus.length) {
      await advance(client, before, corpus);
      const after = await readHistory(client);
      check(after.length === corpus.length, "LOCAL_MIGRATION_APPLICATION_INCOMPLETE");
      writeState(corpus);
    }
    materialize(corpus);
    const status = parseStatus(runCli(["status", "-o", "json"], true));
    updateLocalEnvironment(status);
    const history = await verifyCurrent(client, corpus, status, true);
    return { status: "ready", projectId: PROJECT_ID, migrationCount: history.length,
      migrationHead: history.at(-1)?.version ?? null, apiUrl: status.API_URL, persistent: true, productionAccess: false };
  } finally { await client.end(); }
}

export async function preflightLocalDevelopmentSupabase(): Promise<Record<string, unknown>> {
  assertLocalDevelopmentConfiguration();
  const corpus = readLocalDevelopmentMigrationCorpus();
  const status = parseStatus(runCli(["status", "-o", "json"], true));
  const client = await connect();
  try {
    const history = await verifyCurrent(client, corpus, status, true);
    return { status: "compatible", projectId: PROJECT_ID, migrationCount: history.length,
      migrationHead: history.at(-1)?.version ?? null, apiUrl: status.API_URL, productionAccess: false };
  } finally { await client.end(); }
}

export function stopLocalDevelopmentSupabase(): Record<string, unknown> {
  assertLocalDevelopmentConfiguration();
  runCli(["stop"]);
  return { status: "stopped", projectId: PROJECT_ID, dataPreserved: true, productionAccess: false };
}

export async function resetLocalDevelopmentSupabase(): Promise<Record<string, unknown>> {
  assertLocalDevelopmentConfiguration();
  runCli(["stop", "--no-backup"]);
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE, { force: true });
  return startLocalDevelopmentSupabase();
}

export const LOCAL_DEVELOPMENT_SUPABASE = Object.freeze({
  projectId: PROJECT_ID, apiUrl: API_URL, databaseUrl: DATABASE_URL,
  canonicalMigrations: "sql/migrations", generatedMigrations: "supabase/migrations",
});
