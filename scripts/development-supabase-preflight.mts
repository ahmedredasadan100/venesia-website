import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error This workspace uses pg without separate declarations.
import pg from "pg";

import {
  preflightLocalDevelopmentSupabase,
  readLocalDevelopmentMigrationCorpus,
  type LocalMigration,
} from "./lib/local-development-supabase.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");
const APPROVED_ONLINE_PROJECT_REF = "pmqsfqvvekrlujqgurcu";

type OnlineHistory = { version: string; name: string };
export type DevelopmentWorkspaceIdentity = {
  rootMatches: boolean;
  branch: string | null;
  head: string;
  originMain: string;
  originMainIsAncestor: boolean;
};
type DevelopmentTarget =
  | { kind: "local"; apiUrl: string }
  | { kind: "online"; apiUrl: string; databaseUrl: string; projectRef: string };

export class DevelopmentSupabasePreflightError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Development Supabase preflight stopped: ${code}.`);
    this.name = "DevelopmentSupabasePreflightError";
    this.code = code;
  }
}

function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new DevelopmentSupabasePreflightError(code);
}

export function assertDevelopmentWorkspaceIdentity(identity: DevelopmentWorkspaceIdentity): DevelopmentWorkspaceIdentity {
  check(identity.rootMatches, "DEVELOPMENT_WORKSPACE_IDENTITY_AMBIGUOUS");
  check(identity.branch !== null && identity.branch.length > 0, "DEVELOPMENT_WORKSPACE_DETACHED");
  check(identity.originMainIsAncestor, "DEVELOPMENT_WORKSPACE_BEHIND_CANONICAL_MAIN");
  if (identity.branch === "main") check(identity.head === identity.originMain, "DEVELOPMENT_MAIN_DIVERGED");
  return Object.freeze({ ...identity });
}

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: ROOT, encoding: "utf8", windowsHide: true,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readDevelopmentWorkspaceIdentity(): DevelopmentWorkspaceIdentity {
  try {
    const head = git(["rev-parse", "--verify", "HEAD^{commit}"]);
    const originMain = git(["rev-parse", "--verify", "origin/main^{commit}"]);
    const branchResult = spawnSync("git", ["symbolic-ref", "--quiet", "--short", "HEAD"], {
      cwd: ROOT, encoding: "utf8", windowsHide: true,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "ignore"],
    });
    const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {
      cwd: ROOT, encoding: "utf8", windowsHide: true,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "ignore", "ignore"],
    });
    check(branchResult.status === 0 || branchResult.status === 1,
      "DEVELOPMENT_WORKSPACE_GIT_EVIDENCE_UNAVAILABLE");
    check(ancestry.status === 0 || ancestry.status === 1, "DEVELOPMENT_WORKSPACE_GIT_EVIDENCE_UNAVAILABLE");
    return {
      rootMatches: realpathSync(git(["rev-parse", "--show-toplevel"])) === realpathSync(ROOT),
      branch: branchResult.status === 0 ? branchResult.stdout.trim() : null,
      head,
      originMain,
      originMainIsAncestor: ancestry.status === 0,
    };
  } catch (error) {
    if (error instanceof DevelopmentSupabasePreflightError) throw error;
    throw new DevelopmentSupabasePreflightError("DEVELOPMENT_WORKSPACE_GIT_EVIDENCE_UNAVAILABLE");
  }
}

function envValues(source: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of source.split(/\r?\n/u)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

function parseUrl(value: string, code: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new DevelopmentSupabasePreflightError(code);
  }
}

export function classifyDevelopmentSupabaseTarget(source: string): DevelopmentTarget {
  const env = envValues(source);
  const apiValue = env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
  check(apiValue.length > 0, "SUPABASE_API_URL_MISSING");
  check((env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "").length > 20, "SUPABASE_ANON_KEY_MISSING");
  check((env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").length > 20, "SUPABASE_SERVICE_ROLE_KEY_MISSING");

  const apiUrl = parseUrl(apiValue, "SUPABASE_API_URL_INVALID");
  const loopback = apiUrl.hostname === "127.0.0.1" || apiUrl.hostname === "localhost";
  if (loopback) {
    check(apiUrl.protocol === "http:" && apiUrl.port === "54321", "LOCAL_API_IDENTITY_MISMATCH");
    return { kind: "local", apiUrl: apiUrl.origin };
  }

  check(apiUrl.protocol === "https:" && apiUrl.pathname === "/", "ONLINE_API_IDENTITY_MISMATCH");
  const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(apiUrl.hostname);
  check(match !== null && match[1] === APPROVED_ONLINE_PROJECT_REF, "ONLINE_PROJECT_NOT_APPROVED");
  check(!env.has("VENISIA_SUPABASE_TARGET"), "ONLINE_TARGET_HAS_LOCAL_MARKER");

  const databaseValue = env.get("SUPABASE_DB_URL") ?? "";
  check(databaseValue.length > 0, "ONLINE_DATABASE_URL_MISSING");
  const databaseUrl = parseUrl(databaseValue, "ONLINE_DATABASE_URL_INVALID");
  const username = decodeURIComponent(databaseUrl.username);
  const direct = databaseUrl.hostname === `db.${match[1]}.supabase.co`
    && username === "postgres" && databaseUrl.port === "5432";
  const pooler = databaseUrl.hostname.endsWith(".pooler.supabase.com")
    && username === `postgres.${match[1]}` && ["5432", "6543"].includes(databaseUrl.port);
  check((databaseUrl.protocol === "postgresql:" || databaseUrl.protocol === "postgres:")
    && databaseUrl.pathname === "/postgres" && (direct || pooler), "ONLINE_DATABASE_IDENTITY_MISMATCH");

  return { kind: "online", apiUrl: apiUrl.origin, databaseUrl: databaseValue, projectRef: match[1] };
}

export function assertOnlineMigrationHistory(history: OnlineHistory[], corpus: LocalMigration[]): void {
  check(history.length <= corpus.length, "ONLINE_HISTORY_HAS_UNEXPECTED_MIGRATION");
  for (const [index, row] of history.entries()) {
    check(row.version === corpus[index].version && row.name === corpus[index].name, "ONLINE_HISTORY_DIVERGED");
  }
  check(history.length === corpus.length, "ONLINE_DATABASE_BEHIND_REPOSITORY");
}

async function preflightOnlineDevelopmentSupabase(
  target: Extract<DevelopmentTarget, { kind: "online" }>,
): Promise<Record<string, unknown>> {
  const corpus = readLocalDevelopmentMigrationCorpus();
  const client = new pg.Client({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    application_name: "venisia-development-readonly-preflight",
  });
  let transactionOpen = false;
  await client.connect();
  try {
    await client.query("begin transaction read only");
    transactionOpen = true;
    const result = await client.query(
      "select version,name from supabase_migrations.schema_migrations order by version",
    );
    const history = result.rows.map((row: Record<string, unknown>) => ({
      version: String(row.version),
      name: String(row.name),
    }));
    assertOnlineMigrationHistory(history, corpus);
    await client.query("commit");
    transactionOpen = false;
    return {
      status: "compatible",
      target: "online",
      projectRef: target.projectRef,
      migrationCount: history.length,
      migrationHead: history.at(-1)?.version ?? null,
      pendingMigrations: [],
      readOnly: true,
    };
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function preflightDevelopmentSupabase(): Promise<Record<string, unknown>> {
  const workspace = assertDevelopmentWorkspaceIdentity(readDevelopmentWorkspaceIdentity());
  check(existsSync(ENV_FILE), "DEVELOPMENT_ENVIRONMENT_MISSING");
  const target = classifyDevelopmentSupabaseTarget(readFileSync(ENV_FILE, "utf8"));
  if (target.kind === "local") {
    const result = await preflightLocalDevelopmentSupabase();
    return { ...result, target: "local", readOnly: true, workspace };
  }
  return { ...await preflightOnlineDevelopmentSupabase(target), workspace };
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await preflightDevelopmentSupabase(), null, 2));
}
