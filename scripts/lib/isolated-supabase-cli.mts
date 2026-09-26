import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { EntitySeoBackfillReport } from "../backfill-entity-seo-scores.mts";

export type { EntitySeoBackfillReport } from "../backfill-entity-seo-scores.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATIONS = join(ROOT, "sql", "migrations");
const FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/u;
const HASH = /^[a-f0-9]{64}$/u;
const MAX_OUTPUT_BYTES = 8_000_000;
const CLI_TIMEOUT_MS = 180_000;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export type ApplicationMigrationStage = {
  files: readonly { file: string; sourceSha256: string }[];
  corpusSha256: string;
};
export type ApplicationMigrationCliResult = {
  exitCode: number | null;
  dryRun: boolean;
  pendingFiles: readonly string[];
  sqlState: string | null;
  failedFile: string | null;
  securityAssertionCode: string | null;
  failureClass: "ssl_not_supported" | "tls_rejected" | "connection_refused" | "connection_timeout" | "authentication_failed" | "sql_error" | "unclassified" | null;
  stdoutSha256: string;
  stderrSha256: string;
  cliVersion: string;
  cliSha256: string;
};
export type ApplicationMigrationTool = {
  name: string;
  version: string;
  platform: string;
  package: string;
  metadataUrl: string;
  packageIntegrity: string;
  executablePathInPackage: string;
  executableSha256: string;
  sourceTag: string;
};
/** Private lifecycle context: never expose it, its password, or a URL on the handle. */
export type ApplicationMigrationCliContext = {
  readonly runDirectory: string;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly database: "postgres";
  readonly password: string;
  readonly tool: ApplicationMigrationTool;
  readonly sourceBinary: string;
  readonly generatorDocker: Readonly<{ binary: string; host: string; databaseContainerId: string }>;
  readonly assertOwned: () => Promise<void>;
};
type Request = { mode: "dry-run" | "apply"; stage: ApplicationMigrationStage };
type CanonicalFile = { file: string; sourceSha256: string; sql: string };
type Prepared = { directory: string; binary: string; busy: boolean; dryRunStage: string | null };
const prepared = new WeakMap<ApplicationMigrationCliContext, Prepared>();

export class IsolatedSupabaseCliError extends Error {
  readonly code: string;
  readonly stage = "application-cli";
  constructor(code: string) {
    super(`application-cli: ${code}`);
    this.name = "IsolatedSupabaseCliError";
    this.code = code;
  }
}
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new IsolatedSupabaseCliError(code);
}
function inside(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel !== "" && !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}
function realDirectory(directory: string): void {
  check(isAbsolute(directory) && existsSync(directory) && lstatSync(directory).isDirectory()
    && !lstatSync(directory).isSymbolicLink() && realpathSync(directory) === directory, "UNSAFE_CLI_DIRECTORY");
}
function sourceBytes(path: string): Buffer {
  check(isAbsolute(path) && existsSync(path) && lstatSync(path).isFile()
    && !lstatSync(path).isSymbolicLink() && realpathSync(path) === path, "UNSAFE_CLI_SOURCE");
  return readFileSync(path);
}
function corpus(): CanonicalFile[] {
  realDirectory(MIGRATIONS);
  const files = readdirSync(MIGRATIONS).filter(file => file.endsWith(".sql")).sort();
  check(files.length > 0 && files.every(file => FILE.test(file)), "INVALID_CANONICAL_CORPUS");
  check(new Set(files.map(file => file.slice(0, 14))).size === files.length, "DUPLICATE_MIGRATION_VERSION");
  return files.map(file => {
    const sql = sourceBytes(join(MIGRATIONS, file)).toString("utf8").replace(/\r\n?/gu, "\n");
    return { file, sql, sourceSha256: sha256(sql) };
  });
}

/** A stage is the full ordered canonical prefix, never just pending files. */
export function assertApplicationMigrationStage(stage: ApplicationMigrationStage, canonical: readonly { file: string; sourceSha256: string }[]): void {
  check(stage && Array.isArray(stage.files) && stage.files.length > 0
    && stage.files.length <= canonical.length && HASH.test(stage.corpusSha256), "INVALID_MIGRATION_STAGE");
  for (const [index, entry] of stage.files.entries()) {
    check(entry && FILE.test(entry.file) && HASH.test(entry.sourceSha256)
      && entry.file === canonical[index].file && entry.sourceSha256 === canonical[index].sourceSha256, "NONCANONICAL_MIGRATION_PREFIX");
  }
  const hash = sha256(stage.files.map(entry => `${entry.file.slice(0, 14)}:${entry.sourceSha256}`).join("\n"));
  check(stage.corpusSha256 === hash, "MIGRATION_STAGE_HASH_MISMATCH");
}

export function assertApplicationMigrationTool(tool: ApplicationMigrationTool): void {
  check(tool && tool.name === "Supabase CLI" && /^\d+\.\d+\.\d+$/u.test(tool.version)
    && tool.platform === "win32-x64" && tool.package === "@supabase/cli-windows-x64"
    && tool.metadataUrl === `https://registry.npmjs.org/@supabase%2fcli-windows-x64/${tool.version}`
    && /^sha512-[A-Za-z0-9+/]{86}==$/u.test(tool.packageIntegrity)
    && tool.executablePathInPackage === "package/bin/supabase.exe" && HASH.test(tool.executableSha256)
    && tool.sourceTag === `https://github.com/supabase/cli/tree/v${tool.version}`, "INVALID_MIGRATION_TOOL_LOCK");
}

export function applicationMigrationChildEnvironment(home: string, workdir: string, password: string, source: Readonly<Record<string, string | undefined>> = process.env): NodeJS.ProcessEnv {
  // No inherited PATH, token, proxy, dotenv, libpq service, NODE_OPTIONS or Docker
  // variables. The pinned native executable needs no shell or external command.
  const env: Record<string, string | undefined> = {};
  for (const key of ["SystemRoot", "SYSTEMROOT", "WINDIR", "SystemDrive"]) if (source[key]) env[key] = source[key];
  // Native CLI environments are sparse; Next's ambient NODE_ENV requirement
  // must not introduce an extra inherited/generated environment entry here.
  const childEnvironment: Record<string, string | undefined> = {
    ...env, CI: "1", NO_COLOR: "1", HOME: home, USERPROFILE: home,
    APPDATA: join(home, "appdata"), LOCALAPPDATA: join(home, "localappdata"),
    TEMP: join(home, "temp"), TMP: join(home, "temp"), SUPABASE_HOME: join(home, "supabase"),
    // The owned official image has ssl=off. This runner accepts only its branded
    // 127.0.0.1 target; match the lifecycle's plaintext local connection explicitly
    // instead of the CLI's TLS-only default for nonstandard ports. No ambient override.
    SUPABASE_WORKDIR: workdir, PGPASSWORD: password, PGCONNECT_TIMEOUT: "10", PGSSLMODE: "disable",
    SUPABASE_NO_UPDATE_NOTIFIER: "1", SUPABASE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1",
  };
  return childEnvironment as NodeJS.ProcessEnv;
}

/** Parse the pinned CLI's JSON contract; never return its message or SQL text. */
export function parseApplicationMigrationCliResult(
  result: { exitCode: number | null; stdout: string; stderr: string },
  request: Request,
  tool: ApplicationMigrationTool,
  selectedSources: readonly CanonicalFile[] = [],
): ApplicationMigrationCliResult {
  const value: ApplicationMigrationCliResult = {
    exitCode: result.exitCode, dryRun: request.mode === "dry-run", pendingFiles: [],
    sqlState: null, failedFile: null, securityAssertionCode: null, failureClass: result.exitCode === 0 ? null : "unclassified",
    stdoutSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr),
    cliVersion: tool.version, cliSha256: tool.executableSha256,
  };
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch { /* A nonzero process can fail before the CLI's JSON formatter starts. */ }
  if (result.exitCode === 0) {
    check(body && typeof body.upToDate === "boolean" && body.dryRun === value.dryRun
      && Array.isArray(body.migrations) && body.migrations.every(file => typeof file === "string")
      && Array.isArray(body.seeds) && body.seeds.length === 0
      && Array.isArray(body.roles) && body.roles.length === 0, "INVALID_CLI_SUCCESS_RESULT");
    const pending = body.migrations as string[];
    check(new Set(pending).size === pending.length && pending.length <= request.stage.files.length
      && body.upToDate === (pending.length === 0), "INVALID_CLI_PENDING_LIST");
    const expected = pending.length === 0 ? [] : request.stage.files.slice(-pending.length).map(entry => entry.file);
    check(JSON.stringify(pending) === JSON.stringify(expected), "UNEXPECTED_CLI_MIGRATIONS");
    value.pendingFiles = pending;
  } else {
    const error = body?._tag === "Error" && body.error && typeof body.error === "object"
      ? body.error as Record<string, unknown> : null;
    const firstLine = typeof error?.message === "string" ? error.message.split(/\r?\n/u)[0] : "";
    value.sqlState = /\(SQLSTATE ([0-9A-Z]{5})\)/u.exec(firstLine)?.[1] ?? null;
    // Retain only fixed diagnostic categories. Never return arbitrary CLI
    // messages, connection URLs, credentials, SQL, or unfiltered stderr.
    const diagnostic = `${result.stdout}\n${result.stderr}`;
    if (/server does not support SSL connections/iu.test(diagnostic)) value.failureClass = "ssl_not_supported";
    else if (/SELF_SIGNED_CERT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|ERR_TLS_CERT_ALTNAME_INVALID/u.test(diagnostic)) value.failureClass = "tls_rejected";
    else if (/ECONNREFUSED/u.test(diagnostic)) value.failureClass = "connection_refused";
    else if (/ETIMEDOUT|connection timeout|timeout expired/iu.test(diagnostic)) value.failureClass = "connection_timeout";
    else if (/password authentication failed|SQLSTATE 28P01/iu.test(diagnostic)) value.failureClass = "authentication_failed";
    else if (value.sqlState) value.failureClass = "sql_error";
    if (value.sqlState !== null || error?.code === "LegacyDbPushApplyError") {
      const attempts = [...result.stderr.matchAll(/^Applying migration (\d{14}_[a-z0-9_]+\.sql)\.\.\.\r?$/gmu)];
      const last = attempts.at(-1)?.[1] ?? null;
      if (last && request.stage.files.some(entry => entry.file === last)) value.failedFile = last;
    }
    // Preserve only a bounded assertion identifier declared by the exact SQL
    // selected for this failed application. Never retain arbitrary error text,
    // a code from another migration, or a diagnostic from an unverified source.
    if (request.mode === "apply" && value.sqlState === "P0001" && value.failedFile !== null) {
      const selected = request.stage.files.find(entry => entry.file === value.failedFile);
      const matchingSources = selectedSources.filter(source => source.file === value.failedFile);
      const source = matchingSources.length === 1 ? matchingSources[0] : null;
      const candidate = /^(?:ERROR:\s*)?((?:venisia_security_contract_|migration86_)[a-z_]{1,100})\s*\(SQLSTATE P0001\)$/u.exec(firstLine)?.[1];
      if (candidate && selected && source && FILE.test(source.file)
        && HASH.test(source.sourceSha256) && source.sourceSha256 === selected.sourceSha256
        && sha256(source.sql) === selected.sourceSha256) {
        const declared = new Set([...source.sql.matchAll(/\bmessage\s*=\s*'((?:venisia_security_contract_|migration86_)[a-z_]{1,100})'/gu)].map(match => match[1]));
        if (declared.has(candidate)) value.securityAssertionCode = candidate;
      }
    }
  }
  return value;
}

function prepare(context: ApplicationMigrationCliContext): Prepared {
  let state = prepared.get(context);
  if (state) {
    realDirectory(state.directory);
    check(sha256(sourceBytes(state.binary)) === context.tool.executableSha256, "CLI_BINARY_IDENTITY_CHANGED");
    return state;
  }
  const bytes = sourceBytes(resolve(context.sourceBinary));
  check(sha256(bytes) === context.tool.executableSha256, "CLI_BINARY_DIGEST_MISMATCH");
  const directory = mkdtempSync(join(context.runDirectory, "application-cli-"));
  const toolsDirectory = join(directory, "tools");
  mkdirSync(toolsDirectory, { mode: 0o700 });
  const binary = join(toolsDirectory, "supabase.exe");
  writeFileSync(binary, bytes, { flag: "wx", mode: 0o700 });
  check(sha256(sourceBytes(binary)) === context.tool.executableSha256, "COPIED_CLI_DIGEST_MISMATCH");
  state = { directory, binary, busy: false, dryRunStage: null };
  prepared.set(context, state);
  return state;
}

function run(binary: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd, env, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let size = 0, failure: string | null = null;
    const timer = setTimeout(() => { failure = "CLI_TIMEOUT"; child.kill(); }, CLI_TIMEOUT_MS);
    const capture = (target: Buffer[]) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_OUTPUT_BYTES) { failure = "CLI_OUTPUT_LIMIT"; child.kill(); return; }
      target.push(chunk);
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.once("error", () => { failure = "CLI_PROCESS_START_FAILED"; });
    child.once("close", code => {
      clearTimeout(timer);
      try {
        if (failure) reject(new IsolatedSupabaseCliError(failure));
        else done({ exitCode: code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
      } finally {
        for (const buffer of [...stdout, ...stderr]) buffer.fill(0);
        env.PGPASSWORD = "";
      }
    });
  });
}

/** Called only by the active lifecycle's handle binding, with private context. */
export async function pushApplicationMigrations(context: ApplicationMigrationCliContext, input: Request): Promise<ApplicationMigrationCliResult> {
  await context.assertOwned();
  check(input && (input.mode === "dry-run" || input.mode === "apply")
    && input.stage && Array.isArray(input.stage.files), "INVALID_CLI_REQUEST");
  const request: Request = { mode: input.mode, stage: {
    corpusSha256: input.stage.corpusSha256,
    files: input.stage.files.map(entry => ({ file: entry.file, sourceSha256: entry.sourceSha256 })),
  } };
  check(process.platform === "win32" && process.arch === "x64", "UNSUPPORTED_CLI_PLATFORM");
  check(context.host === "127.0.0.1" && context.database === "postgres"
    && Number.isInteger(context.port) && context.port > 1024 && context.port <= 65535
    && /^[a-f0-9]{64}$/u.test(context.password), "INVALID_OWNED_CLI_TARGET");
  check(isAbsolute(context.runDirectory) && inside(join(ROOT, ".tmp-qa"), context.runDirectory), "CLI_RUN_OUTSIDE_IGNORED_ROOT");
  realDirectory(context.runDirectory);
  check(isAbsolute(context.sourceBinary), "ABSOLUTE_CLI_BINARY_REQUIRED");
  assertApplicationMigrationTool(context.tool);
  check(request.mode === "dry-run" || request.mode === "apply", "INVALID_CLI_MODE");
  const canonical = corpus();
  assertApplicationMigrationStage(request.stage, canonical);
  const state = prepare(context);
  check(!state.busy, "CONCURRENT_CLI_HANDOFF");
  check(request.mode !== "apply" || state.dryRunStage === request.stage.corpusSha256, "CLI_DRY_RUN_REQUIRED");
  state.busy = true;
  state.dryRunStage = null;
  try {
    const workdir = mkdtempSync(join(state.directory, "stage-"));
    const migrationDirectory = join(workdir, "supabase", "migrations");
    mkdirSync(migrationDirectory, { recursive: true, mode: 0o700 });
    for (const file of canonical.slice(0, request.stage.files.length)) {
      writeFileSync(join(migrationDirectory, file.file), file.sql, { flag: "wx", mode: 0o600 });
    }
    const home = join(workdir, "home");
    for (const path of [home, ...["appdata", "localappdata", "temp", "supabase"].map(name => join(home, name))]) mkdirSync(path, { mode: 0o700 });
    const env = applicationMigrationChildEnvironment(home, workdir, context.password);
    const args = ["db", "push", "--db-url", `postgresql://postgres@127.0.0.1:${context.port}/postgres`,
      "--skip-vault", "--workdir", workdir, "--output-format", "json", request.mode === "dry-run" ? "--dry-run" : "--yes"];
    await context.assertOwned();
    assertApplicationMigrationStage(request.stage, corpus());
    realDirectory(workdir);
    realDirectory(migrationDirectory);
    check(readdirSync(migrationDirectory).sort().join("\n") === request.stage.files.map(file => file.file).join("\n"), "CLI_STAGED_FILES_CHANGED");
    for (const entry of request.stage.files) check(sha256(sourceBytes(join(migrationDirectory, entry.file))) === entry.sourceSha256, "CLI_STAGED_SQL_CHANGED");
    check(sha256(sourceBytes(state.binary)) === context.tool.executableSha256, "CLI_BINARY_IDENTITY_CHANGED");
    const result = parseApplicationMigrationCliResult(await run(state.binary, args, workdir, env), request, context.tool,
      canonical.slice(0, request.stage.files.length));
    await context.assertOwned();
    assertApplicationMigrationStage(request.stage, corpus());
    if (request.mode === "dry-run" && result.exitCode === 0) state.dryRunStage = request.stage.corpusSha256;
    return result;
  } catch (error) {
    if (error instanceof IsolatedSupabaseCliError) throw error;
    throw new IsolatedSupabaseCliError("CLI_HANDOFF_FAILED");
  } finally {
    state.busy = false;
  }
}

/** Use the existing backfill owner; the handle never receives connection secrets. */
export async function runOwnedEntitySeoBackfill(
  context: ApplicationMigrationCliContext,
  request: { mode: "dry-run" | "apply" | "verify"; entities?: readonly ("topics" | "projects" | "pages")[] },
): Promise<EntitySeoBackfillReport> {
  await context.assertOwned();
  check(request && ["dry-run", "apply", "verify"].includes(request.mode), "INVALID_SEO_BACKFILL_MODE");
  const mode = request.mode;
  check(context.host === "127.0.0.1" && context.database === "postgres"
    && Number.isInteger(context.port) && context.port > 1024 && context.port <= 65535
    && /^[a-f0-9]{64}$/u.test(context.password), "INVALID_OWNED_SEO_TARGET");
  const state = prepared.get(context);
  check(state && !state.busy, "SEO_REQUIRES_IDLE_APPLICATION_HANDOFF");
  state.busy = true;
  try {
    const { runEntitySeoBackfill } = await import("../backfill-entity-seo-scores.mts");
    await context.assertOwned();
    const report = await runEntitySeoBackfill({
      connectionString: `postgresql://postgres:${context.password}@127.0.0.1:${context.port}/postgres`,
      expectedDatabase: "postgres", apply: mode === "apply", verify: mode === "verify",
      entities: request.entities,
    });
    await context.assertOwned();
    return report;
  } finally {
    state.busy = false;
  }
}
// Dependency pinned by Supabase CLI v2.116.0's official
// apps/cli-go/pkg/config/templates/Dockerfile, resolved to linux/amd64 content.
const TYPE_GENERATOR_IMAGE = "public.ecr.aws/supabase/postgres-meta@sha256:cef71ba901751dcc242cc685cf13786935ea8926820fb342f23bb0fbef77de5a";
const TYPE_GENERATOR_IMAGE_ID = "sha256:cef71ba901751dcc242cc685cf13786935ea8926820fb342f23bb0fbef77de5a";

/** Official Supabase generator, confined to the opaque owned local database. */
export async function generateOwnedDatabaseTypes(context: ApplicationMigrationCliContext): Promise<{
  source: string; sourceSha256: string; cliVersion: string; cliSha256: string;
  cliExecuted: boolean; generator: string;
}> {
  await context.assertOwned();
  const state = prepare(context);
  check(!state.busy, "TYPES_REQUIRE_IDLE_APPLICATION_HANDOFF");
  state.busy = true;
  try {
    const workdir = mkdtempSync(join(state.directory, "types-"));
    const home = join(workdir, "home");
    for (const directory of [home, ...["appdata", "localappdata", "temp", "supabase"].map(name => join(home, name))]) mkdirSync(directory, { mode: 0o700 });
    const environment = () => applicationMigrationChildEnvironment(home, workdir, context.password);
    check(sha256(sourceBytes(state.binary)) === context.tool.executableSha256, "CLI_BINARY_IDENTITY_CHANGED");
    let result: Awaited<ReturnType<typeof run>>;
    if (process.platform === "win32") {
      // CLI --db-url probes Windows loopback, then launches its generator with
      // Linux host networking. That is a different loopback namespace. Execute
      // the very same official generator in the captured DB namespace instead;
      // do not widen host bindings, use another DB, or claim host CLI execution.
      const docker = context.generatorDocker;
      check(HASH.test(docker.databaseContainerId) && ["npipe:////./pipe/dockerDesktopLinuxEngine", "npipe:////./pipe/docker_engine"].includes(docker.host), "INVALID_TYPES_DOCKER_TARGET");
      const invoke = (args: string[], env = environment()) => run(docker.binary, ["--host", docker.host, ...args], workdir, env);
      const image = await invoke(["image", "inspect", TYPE_GENERATOR_IMAGE]);
      check(image.exitCode === 0, "TYPE_GENERATOR_IMAGE_MISSING");
      const identity = JSON.parse(image.stdout)[0];
      check(identity.Id === TYPE_GENERATOR_IMAGE_ID && identity.RepoDigests.includes(TYPE_GENERATOR_IMAGE)
        && identity.Os === "linux" && identity.Architecture === "amd64", "TYPE_GENERATOR_IMAGE_MISMATCH");
      const cidPath = join(workdir, "generator.cid");
      const owner = sha256(workdir);
      const label = "com.venisia.isolated-types-owner";
      const network = `container:${docker.databaseContainerId}`;
      const env = { ...environment(),
        PG_META_DB_URL: `postgresql://postgres:${context.password}@127.0.0.1:5432/postgres?sslmode=disable`,
        PG_META_GENERATE_TYPES: "typescript", PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS: "public",
        PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS: "true", PG_CONN_TIMEOUT_SECS: "15", PG_QUERY_TIMEOUT_SECS: "15" };
      try {
        result = await invoke(["run", "--rm", "--pull", "never", "--cidfile", cidPath, "--label", `${label}=${owner}`,
          "--network", network, "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=16m", "--cap-drop", "ALL",
          "--security-opt", "no-new-privileges", "--log-driver", "none",
          ...Object.keys(env).filter(key => key.startsWith("PG_META_") || key === "PG_CONN_TIMEOUT_SECS" || key === "PG_QUERY_TIMEOUT_SECS").flatMap(key => ["--env", key]),
          TYPE_GENERATOR_IMAGE, "node", "dist/server/server.js"], env);
      } finally {
        env.PG_META_DB_URL = "";
        if (existsSync(cidPath)) {
          const id = readFileSync(cidPath, "utf8").trim(); check(HASH.test(id), "INVALID_TYPE_GENERATOR_ID");
          const remaining = await invoke(["container", "inspect", id]);
          if (remaining.exitCode === 0) {
            const container = JSON.parse(remaining.stdout)[0];
            check(container.Id === id && container.Config.Labels?.[label] === owner
              && container.Config.Image === TYPE_GENERATOR_IMAGE && container.HostConfig.NetworkMode === network,
            "TYPE_GENERATOR_CLEANUP_IDENTITY_CHANGED");
            check((await invoke(["rm", "--force", id])).exitCode === 0, "TYPE_GENERATOR_CLEANUP_FAILED");
          }
          check((await invoke(["container", "inspect", id])).exitCode !== 0, "TYPE_GENERATOR_REMAINED");
          writeFileSync(join(context.runDirectory, "database-types-generator-cleanup.json"), JSON.stringify({
            generator: "Supabase postgres-meta v0.98.0", image: TYPE_GENERATOR_IMAGE, containerId: id,
            removed: true, databaseNamespaceOnly: true, hostBindingChanged: false, cliExecuted: false,
          }, null, 2), { mode: 0o600 });
        }
      }
    } else {
      result = await run(state.binary, ["gen", "types", "typescript", "--db-url",
        `postgresql://postgres@127.0.0.1:${context.port}/postgres`, "--schema", "public", "--workdir", workdir], workdir, environment());
    }
    await context.assertOwned();
    if (result.exitCode !== 0) {
      const diagnostics = `${result.stdout}\n${result.stderr}`.replaceAll(context.password, "[REDACTED_LOCAL_CREDENTIAL]").slice(0, 4_000);
      writeFileSync(join(context.runDirectory, "database-types-diagnostic.json"), JSON.stringify({ exitCode: result.exitCode,
        stdoutSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr), diagnostics }, null, 2), { mode: 0o600 });
    }
    check(result.exitCode === 0, "DATABASE_TYPES_CLI_FAILED");
    check(result.stdout.includes("export type Database =") && result.stdout.includes("export type Json ="), "INVALID_DATABASE_TYPES_OUTPUT");
    return { source: result.stdout, sourceSha256: sha256(result.stdout), cliVersion: context.tool.version,
      cliSha256: context.tool.executableSha256, cliExecuted: process.platform !== "win32",
      generator: process.platform === "win32" ? TYPE_GENERATOR_IMAGE : "Supabase CLI" };
  } finally { state.busy = false; }
}