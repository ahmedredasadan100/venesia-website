import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error The repository uses pg without separate declarations.
import pg from "pg";
import { assertApplicationMigrationTool, IsolatedSupabaseCliError, pushApplicationMigrations, runOwnedEntitySeoBackfill, generateOwnedDatabaseTypes,
  type ApplicationMigrationCliContext, type ApplicationMigrationCliResult,
  type ApplicationMigrationStage, type ApplicationMigrationTool, type EntitySeoBackfillReport } from "./isolated-supabase-cli.mts";
export type { ApplicationMigrationCliResult, ApplicationMigrationStage, EntitySeoBackfillReport } from "./isolated-supabase-cli.mts";
import { proveHostBoundary, startHostAccessBridge } from "./isolated-supabase-transport.mjs";
import { prepareOwnedPublicVerification, registerOwnedAdminMeasurement, runOwnedPublicVerification,
  type PrivatePublicVerificationContext, type PublicFixtureReadiness, type PublicGateRequest } from "./isolated-public-verification.mts";
import { prepareOwnedAdminMeasurementAccount } from "../fixtures/admin-interaction-fixtures.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OWNER = "isolated-supabase";
const LABEL_RUN = "com.venisia.qa.run";
const LABEL_OWNER = "com.venisia.qa.owner";
const RELEASE_COMMIT = "8c7a4d9dbbaf8b552893822e89d7bf06f33f9220";
// Explicit owner-approved release allowlist. The lock owns file/image hashes;
// changing the approved release baseline requires reviewing this guard too.
const IMAGE_SERVICES = ["db", "storage", "rest", "imgproxy", "api-gw"] as const;
const SERVICES = [...IMAGE_SERVICES, "qa-transport"] as const;
type Service = typeof SERVICES[number];
type ImageService = typeof IMAGE_SERVICES[number];
type JsonObject = Record<string, unknown>;
type SafeValue = string | number | boolean | null;
type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type PgConnection = { connect(): Promise<void>; query(sql: string, params?: unknown[]): Promise<QueryResult>; end(): Promise<void>;
  on(event: "error", listener: (error: unknown) => void): unknown };
type HostBridge = { close(): Promise<void>; snapshot(): { accepted: number; rejected: number; failed: number; closed: number; active: number; localProcesses: number; stopping: boolean; listeners: Array<{ host: string; port: number }> } };

export class IsolatedSupabaseError extends Error {
  readonly code: string;
  readonly stage: string;
  constructor(code: string, stage: string) {
    super(`${stage}: ${code}`);
    this.name = "IsolatedSupabaseError";
    this.code = /^[A-Z0-9_]+$/.test(code) ? code : "UNCLASSIFIED_FAILURE";
    this.stage = /^[a-z0-9_.-]+$/.test(stage) ? stage : "unknown";
    this.message = `${this.stage}: ${this.code}`;
  }
}
const fail = (code: string, stage: string): never => { throw new IsolatedSupabaseError(code, stage); };
function requireThat(condition: unknown, code: string, stage: string): asserts condition {
  if (!condition) fail(code, stage);
}

// pg emits idle socket failures outside query promises. Keep an error listener
// through end(), and reject the handoff instead of letting EventEmitter crash
// the process before the lifecycle's finally block can release owned resources.
export function observeApplicationClient(client: Pick<PgConnection, "on">, recordFailure: () => void) {
  let failure: IsolatedSupabaseError | undefined;
  let rejectFailure: (error: IsolatedSupabaseError) => void = () => undefined;
  const failed = new Promise<never>((_resolve, reject) => { rejectFailure = reject; });
  void failed.catch(() => undefined);
  const watch = (watched: Pick<PgConnection,"on">) => watched.on("error", () => {
    if (failure) return;
    failure = new IsolatedSupabaseError("APPLICATION_CLIENT_DISCONNECTED", "application-handoff");
    // A failed receipt write must also remain inside the awaited failure path.
    try { recordFailure(); } catch {
      failure = new IsolatedSupabaseError("APPLICATION_CLIENT_RECEIPT_FAILED", "application-handoff");
    }
    rejectFailure(failure);
  });
  watch(client);
  return {
    watch,
    assertHealthy() { if (failure) throw failure; },
    async run<T>(handoff: () => Promise<T>): Promise<T> {
      if (failure) throw failure;
      return Promise.race([failed, handoff()]);
    },
  };
}

/** Planned renewal for Admin jobs and verified idle fixture boundaries. The pinned
 * transport's ten-minute hard lifetime and error handling remain unchanged. */
export function createAdminMeasurementControlLease(initial: PgConnection, options: {
  connect(): Promise<PgConnection>;
  assertHealthy(): void;
  assertOwned(): Promise<void>;
  watch(client: PgConnection): unknown;
  replaced(client: PgConnection): void;
  record(values: Record<string,string|number|boolean|null>): void;
  now?: () => number;
}) {
  const now=options.now??Date.now;
  let current=initial,bornAt=now(),renewing:Promise<void>|undefined;
  return {
    get client(){return current;},
    async renewIfDue(adminJobActive:boolean, explicitIdleBoundary = false) {
      options.assertHealthy();
      if(!adminJobActive || (!explicitIdleBoundary && now()-bornAt<240_000)) return;
      if(renewing) return renewing;
      requireThat(now()-bornAt<480_000,"ADMIN_CONTROL_LEASE_RENEWAL_OVERDUE","admin-measurement");
      renewing=(async()=>{
        await options.assertOwned();options.assertHealthy();
        let next: PgConnection;
        try { next=await options.connect(); }
        catch(error) {
          if (explicitIdleBoundary) throw error; // The next bounded phase requires an actually fresh healthy socket.
          // A fresh socket can be rejected while the pinned host bridge is at
          // capacity (for example, parallel Next build workers). Defer only
          // this connection reset; never reconnect a failed current session or
          // replay a query/write. The next normal heartbeat may renew again.
          if (!(error instanceof IsolatedSupabaseError && error.stage==="database-connect" && error.code==="ECONNRESET")) throw error;
          options.assertHealthy();await options.assertOwned();
          requireThat(now()-bornAt<480_000,"ADMIN_CONTROL_LEASE_RENEWAL_OVERDUE","admin-measurement");
          const row=(await current.query("select current_database() as database,current_user as role,pg_backend_pid() as backend_pid")).rows[0];
          options.assertHealthy();await options.assertOwned();
          requireThat(row?.database==="postgres"&&row.role==="postgres"&&Number.isInteger(Number(row.backend_pid))&&Number(row.backend_pid)>0,"ADMIN_CONTROL_IDENTITY_MISMATCH","admin-measurement");
          requireThat(now()-bornAt<480_000,"ADMIN_CONTROL_LEASE_RENEWAL_OVERDUE","admin-measurement");
          options.record({deferred:true,freshSocketCode:"ECONNRESET",backendPid:Number(row.backend_pid),previousAgeMs:now()-bornAt,currentSocketRetained:true,transportLifetimeUnchanged:true});
          return;
        }
        let published=false;
        try {
          options.watch(next);
          const row=(await next.query("select current_database() as database,current_user as role,pg_backend_pid() as backend_pid")).rows[0];
          options.assertHealthy();await options.assertOwned();
          requireThat(row?.database==="postgres"&&row.role==="postgres"&&Number.isInteger(Number(row.backend_pid))&&Number(row.backend_pid)>0,"ADMIN_CONTROL_IDENTITY_MISMATCH","admin-measurement");
          const previous=current,previousAgeMs=now()-bornAt;
          current=next;bornAt=now();options.replaced(next);published=true;
          await previous.end();options.assertHealthy();
          options.record({backendPid:Number(row.backend_pid),previousAgeMs,proactive:true,transportLifetimeUnchanged:true,previousSocketClosed:true});
        } catch(error) {if(!published)await next.end().catch(()=>undefined);throw error;}
      })();
      try{await renewing;}finally{renewing=undefined;}
    },
  };
}
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const sleep = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
const object = (value: unknown): JsonObject => {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "INVALID_OBJECT", "contract");
  return value as JsonObject;
};
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
};

const engineTimestamp = (value: unknown): bigint => {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value) : null;
  requireThat(match && Number.isFinite(Date.parse(`${match[1]}Z`)), "INVALID_ENGINE_TIMESTAMP", "post-create-baseline");
  return BigInt(Date.parse(`${match[1]}Z`)) * BigInt(1_000_000) + BigInt((match[2] ?? "").padEnd(9, "0"));
};

// Desktop inventory reads may briefly return the previous daemon's empty
// default bridge during wake. This exception is only a pre-start baseline
// transition; cleanup still compares the accepted operational identity exactly.
export function assertBuiltinBridgeEpochTransition(previous: JsonObject, current: JsonObject,
  window: { warmStartedAt: string; firstOwnedCreatedAt: string }): void {
  for (const network of [previous, current]) {
    requireThat(/^[a-f0-9]{64}$/.test(String(network.id)) && network.name === "bridge"
      && network.driver === "bridge" && network.scope === "local" && network.internal === false
      && network.attachable === false && network.ingress === false && network.configOnly === false
      && network.enableIPv4 === true && network.enableIPv6 === false
      && Object.keys(object(network.labels ?? {})).length === 0
      && Object.keys(object(network.containers ?? {})).length === 0
      && object(network.options)["com.docker.network.bridge.default_bridge"] === "true"
      && object(network.options)["com.docker.network.bridge.name"] === "docker0"
      && object(network.configFrom).Network === "" && object(network.ipam).Driver === "default",
    "NON_DEFAULT_OR_OCCUPIED_BRIDGE", "post-create-baseline");
  }
  const semantics = (network: JsonObject) => Object.fromEntries(Object.entries(network).filter(([key]) => key !== "id" && key !== "createdAt"));
  requireThat(previous.id !== current.id && canonical(semantics(previous)) === canonical(semantics(current)),
    "BUILTIN_BRIDGE_SEMANTICS_CHANGED", "post-create-baseline");
  const started = engineTimestamp(window.warmStartedAt), firstOwned = engineTimestamp(window.firstOwnedCreatedAt);
  const previousCreated = engineTimestamp(previous.createdAt), currentCreated = engineTimestamp(current.createdAt);
  requireThat(previousCreated < started && started < currentCreated && currentCreated < firstOwned,
    "BUILTIN_BRIDGE_EPOCH_OUTSIDE_CREATION_WINDOW", "post-create-baseline");
}

export type ReleaseLock = {
  schemaVersion: 1;
  release: { commit: string; sourceBaseUrl: string };
  compose: { path: string; sha256: string };
  files: Array<{ path: string; sha256: string }>;
  images: Record<ImageService, { reference: string; manifestDigest: string; configDigest: string }>;
  transport: { path: string; sha256: string };
  applicationMigrationTool: ApplicationMigrationTool;
};

export type OwnedDatabaseConnection = {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
};

export type OwnedLocalHandle = {
  readonly identity: {
    runId: string;
    projectName: string;
    database: "postgres";
    host: "127.0.0.1";
    port: number;
    databaseContainerId: string;
  };
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  renewDatabaseControlConnection(): Promise<void>;
  generateDatabaseTypes(): ReturnType<typeof generateOwnedDatabaseTypes>;
  callDataApiRpc(name: string, args: Record<string, unknown>): Promise<Response>;
  readDataApi(path: string, headers?: HeadersInit, method?: "GET" | "HEAD"): Promise<Response>;
  withDatabaseConnection<T>(run: (connection: OwnedDatabaseConnection) => Promise<T>): Promise<T>;
  pushApplicationMigrations(request: { mode: "dry-run" | "apply"; stage: ApplicationMigrationStage }): Promise<ApplicationMigrationCliResult>;
  runEntitySeoBackfill(request: { mode: "dry-run" | "apply" | "verify"; entities?: readonly ("topics" | "projects" | "pages")[] }): Promise<EntitySeoBackfillReport>;
  preparePublicVerification(): Promise<PublicFixtureReadiness>;
  prepareAdminInteractions(request?: { study: "heavy-editor-performance" }): Promise<Record<string, unknown>>;
  runPublicVerification(request: PublicGateRequest): ReturnType<typeof runOwnedPublicVerification>;
  record(stage: string, metadata: Record<string, SafeValue>): void;
};
const activeHandles = new WeakSet<object>();
export function assertOwnedLocalHandle(value: unknown): asserts value is OwnedLocalHandle {
  requireThat(value !== null && typeof value === "object" && activeHandles.has(value), "UNOWNED_OR_EXPIRED_HANDLE", "handoff");
}

export function assertLoopbackDatabaseTarget(value: string, expected: { port: number; database: "postgres"; username: "postgres" | "supabase_admin" }): void {
  const url = (() => {
    try { return new URL(value); } catch { throw new IsolatedSupabaseError("INVALID_DATABASE_TARGET", "target"); }
  })();
  requireThat(["postgres:", "postgresql:"].includes(url.protocol)
    && url.hostname === "127.0.0.1" && url.port === String(expected.port)
    && url.pathname === "/postgres" && expected.database === "postgres"
    && ["postgres", "supabase_admin"].includes(expected.username)
    && url.username === expected.username && url.password.length >= 24
    && !url.search && !url.hash && Number.isInteger(expected.port) && expected.port > 1024 && expected.port <= 65535,
  "INVALID_DATABASE_TARGET", "target");
}

export type OwnedResourceIdentity = {
  kind: "container" | "volume" | "network";
  id: string;
  name: string;
  runId: string;
  projectName: string;
  imageId?: string;
  createdAt?: string;
  mounts?: unknown[];
  networkIdentity?: unknown;
};
export function assertOwnedResource(actual: OwnedResourceIdentity, expected: OwnedResourceIdentity): void {
  requireThat(/^[a-f0-9]{32}$/.test(expected.runId)
    && expected.projectName === `venisia-qa-${expected.runId}`
    && expected.name.includes(expected.projectName)
    && (expected.kind === "volume" || /^[a-f0-9]{64}$/.test(expected.id)), "INVALID_OWNERSHIP_EXPECTATION", "ownership");
  requireThat(canonical(actual) === canonical(expected), "OWNED_RESOURCE_IDENTITY_CHANGED", "ownership");
}

export function cleanChildEnvironment(source: Readonly<Record<string, string | undefined>> = process.env): NodeJS.ProcessEnv {
  const clean: Record<string, string | undefined> = {};
  for (const key of ["SystemRoot", "SYSTEMROOT", "WINDIR", "SystemDrive", "COMSPEC", "ComSpec", "PATH", "Path", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"]) {
    if (source[key]) clean[key] = source[key];
  }
  clean.CI = "1";
  // Node accepts a sparse OS environment. Next's ambient required NODE_ENV
  // declaration describes its app process, not these native child processes.
  return clean as NodeJS.ProcessEnv;
}

export function normalizeDockerBindSource(source: string): string {
  // Docker Desktop can return both spellings within one inspect response.
  // This is only a spelling normalization; callers still compare the entire
  // path to one locked file in this exact run and recheck that file's hash.
  const desktop = process.platform === "win32" ? /^\/run\/desktop\/mnt\/host\/([a-zA-Z])\/(.*)$/.exec(source) : null;
  const path = desktop ? `${desktop[1].toUpperCase()}:/${desktop[2]}` : source;
  return resolve(path.replace(/^([a-z]):/i, (_match, drive: string) => `${drive.toUpperCase()}:`));
}

export function assertPinnedImageIdentity(actual: { id: string; os: string; architecture: string; repoDigests: string[] }, expected: ReleaseLock["images"][ImageService]): void {
  // The containerd image store reports the platform manifest as image Id;
  // classic Docker stores report its config digest. Both must still resolve
  // through the independently pinned repo/platform manifest and architecture.
  requireThat(expected.reference.endsWith(`@${expected.manifestDigest}`)
    && /^sha256:[a-f0-9]{64}$/.test(expected.configDigest)
    && [expected.configDigest, expected.manifestDigest].includes(actual.id)
    && actual.os === "linux" && actual.architecture === "amd64"
    && actual.repoDigests.includes(expected.reference), "IMAGE_IDENTITY_MISMATCH", "image-provenance");
}

function sourcePath(path: string): string {
  requireThat(typeof path === "string" && !isAbsolute(path), "RELATIVE_SOURCE_PATH_REQUIRED", "provenance");
  const absolute = resolve(ROOT, path);
  const rel = relative(ROOT, absolute);
  requireThat(rel !== "" && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
    && existsSync(absolute) && !lstatSync(absolute).isSymbolicLink(), "UNSAFE_SOURCE_PATH", "provenance");
  requireThat(realpathSync(absolute) === absolute, "SOURCE_PATH_REPARSE_POINT", "provenance");
  return absolute;
}

export function readReleaseLock(lockPath: string): ReleaseLock {
  const value = object(JSON.parse(readFileSync(lockPath, "utf8")));
  requireThat(value.schemaVersion === 1 && object(value.release).commit === RELEASE_COMMIT, "UNAPPROVED_RELEASE", "provenance");
  const lock = value as unknown as ReleaseLock;
  assertApplicationMigrationTool(lock.applicationMigrationTool);
  requireThat(Array.isArray(lock.files) && lock.files.length > 0
    && lock.release.sourceBaseUrl === `https://raw.githubusercontent.com/supabase/supabase/${RELEASE_COMMIT}/`, "INCOMPLETE_RELEASE_LOCK", "provenance");
  requireThat(Object.keys(lock.images).sort().join(",") === [...IMAGE_SERVICES].sort().join(","), "INVALID_IMAGE_SET", "provenance");
  for (const service of IMAGE_SERVICES) {
    const image = lock.images[service];
    requireThat(/^[a-z0-9/_-]+@sha256:[a-f0-9]{64}$/.test(image.reference)
      && /^sha256:[a-f0-9]{64}$/.test(image.configDigest)
      && /^sha256:[a-f0-9]{64}$/.test(image.manifestDigest)
      && image.reference.endsWith(`@${image.manifestDigest}`), "UNPINNED_IMAGE", "provenance");
  }
  requireThat(new Set(lock.files.map(item => item.path)).size === lock.files.length, "DUPLICATE_LOCK_PATH", "provenance");
  for (const file of lock.files) {
    requireThat(/^docker\/[a-zA-Z0-9_./-]+$/.test(file.path) && !file.path.includes("..")
      && /^[a-f0-9]{64}$/.test(file.sha256), "UNSAFE_UPSTREAM_PATH", "provenance");
  }
  requireThat(sha256(readFileSync(sourcePath(lock.compose.path))) === lock.compose.sha256, "SOURCE_HASH_MISMATCH", "provenance");
  requireThat(lock.transport?.path === "scripts/lib/isolated-supabase-transport.mjs"
    && /^[a-f0-9]{64}$/.test(lock.transport.sha256)
    && sha256(readFileSync(sourcePath(lock.transport.path))) === lock.transport.sha256, "TRANSPORT_SOURCE_HASH_MISMATCH", "provenance");
  return lock;
}

const imageForService = (lock: ReleaseLock, service: Service) => lock.images[service === "qa-transport" ? "storage" : service];

type CommandResult = { code: number | null; stdout: string; stderrHash: string };
async function command(binary: string, args: string[], stage: string, options: { timeout?: number; env?: NodeJS.ProcessEnv; allowFailure?: boolean } = {}): Promise<CommandResult> {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { cwd: ROOT, env: options.env ?? cleanChildEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", errorOutput = "", timedOut = false, overflow = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeout ?? 60_000);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); if (output.length > 8_000_000) { overflow = true; child.kill(); } });
    child.stderr.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); if (errorOutput.length > 8_000_000) { overflow = true; child.kill(); } });
    child.once("error", () => { clearTimeout(timer); reject(new IsolatedSupabaseError("PROCESS_START_FAILED", stage)); });
    child.once("close", code => {
      clearTimeout(timer);
      if (timedOut || overflow) { reject(new IsolatedSupabaseError(timedOut ? "COMMAND_TIMEOUT" : "OUTPUT_LIMIT", stage)); return; }
      if (code !== 0 && !options.allowFailure) { reject(new IsolatedSupabaseError("COMMAND_FAILED", stage)); return; }
      done({ code, stdout: output, stderrHash: sha256(errorOutput) });
    });
  });
}

function jwt(role: "anon" | "service_role", secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ role, iss: "supabase-demo", iat: now, exp: now + 86400 })).toString("base64url");
  const value = `${header}.${payload}`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

export type IsolatedSupabaseOptions = {
  lockPath: string;
  artifactDir: string;
  dockerBinary?: string;
  dockerHost?: string;
  cliBinary?: string;
  pgPort?: number;
  restPort?: number;
  storagePort?: number;
  apiPort?: number;
  failureInjection?: "before-handoff";
  cleanupOnly?: boolean;
  abruptRecovery?: {
    runnerPath: string;
    runnerArgument: string;
    runnerSha256: string;
    intentSha256: string;
    ownedResourcesSha256: string;
    postCreateBaselineSha256: string;
  };
  handoff?: (handle: OwnedLocalHandle) => Promise<unknown>;
};

type ComposeService = { image: string; labels: Record<string, string>; ports?: Array<{ host_ip?: string; published?: string; target?: number; protocol?: string }>; volumes?: Array<{ type: string; source: string; target: string; read_only?: boolean }>; networks?: Record<string, unknown>; restart?: string; privileged?: boolean; network_mode?: string; env_file?: unknown; build?: unknown; cap_add?: string[]; cap_drop?: string[]; security_opt?: string[]; command?: string[]; user?: string; read_only?: boolean; logging?: { driver?: string } };
type ComposeConfig = { name: string; services: Record<Service, ComposeService>; volumes: Record<string, { name: string; labels: Record<string, string>; external?: boolean }>; networks: Record<string, { name: string; labels: Record<string, string>; internal?: boolean; driver?: string; external?: boolean }> };
type RunIdentity = { runId: string; projectName: string; pgPort: number; restPort: number; storagePort: number; apiPort: number; upstreamRoot: string };

export function validateComposeConfig(value: unknown, lock: ReleaseLock, run: RunIdentity): ComposeConfig {
  const config = object(value) as unknown as ComposeConfig;
  requireThat(config.name === run.projectName && run.projectName === `venisia-qa-${run.runId}`
    && Object.keys(config.services).sort().join(",") === [...SERVICES].sort().join(","), "COMPOSE_SCOPE_MISMATCH", "compose");
  const labels = (value: Record<string, string>) => requireThat(value?.[LABEL_RUN] === run.projectName && value?.[LABEL_OWNER] === OWNER, "COMPOSE_OWNERSHIP_LABELS", "compose");
  const networkKeys = Object.keys(config.networks);
  requireThat(networkKeys.length === 1 && Object.keys(config.volumes).length === 3, "COMPOSE_RESOURCE_SET", "compose");
  for (const resource of [...Object.values(config.networks), ...Object.values(config.volumes)]) {
    requireThat(resource.name.startsWith(`${run.projectName}_`) && !resource.external, "EXTERNAL_OR_REUSED_RESOURCE", "compose");
    labels(resource.labels);
  }
  const network = Object.values(config.networks)[0];
  requireThat((!network.driver || network.driver === "bridge") && network.internal === true, "NETWORK_ISOLATION_REQUIRED", "compose");
  for (const service of SERVICES) {
    const item = config.services[service];
    requireThat(item.image === imageForService(lock, service).reference && item.restart === "no"
      && !item.privileged && !item.network_mode && !item.env_file && !item.build && !(item.cap_add?.length), "COMPOSE_SERVICE_BOUNDARY", "compose");
    labels(item.labels);
    requireThat(canonical(Object.keys(item.networks ?? {}).sort()) === canonical(networkKeys.sort()), "COMPOSE_NETWORK_BOUNDARY", "compose");
    const ports = item.ports ?? [];
    requireThat(ports.length === 0, "DOCKER_PORT_PUBLISHING_FORBIDDEN", "compose");
    if (service === "qa-transport") requireThat(item.user === "1000:1000" && item.read_only === true
      && canonical(item.cap_drop) === canonical(["ALL"])
      && canonical(item.security_opt) === canonical(["no-new-privileges:true"])
      && canonical(item.command) === canonical(["node", "/qa/isolated-supabase-transport.mjs", "--hold"]), "TRANSPORT_SERVICE_BOUNDARY", "compose");
    if (service === "api-gw") requireThat(item.logging?.driver === "none", "GATEWAY_LOG_RETENTION_FORBIDDEN", "compose");
    for (const mount of item.volumes ?? []) {
      if (mount.type === "volume") {
        requireThat(Boolean(config.volumes[mount.source]), "UNOWNED_VOLUME", "compose");
      } else {
        requireThat(mount.type === "bind" && mount.read_only === true
          && (lock.files.some(file => resolve(run.upstreamRoot, file.path) === resolve(mount.source))
            || service === "qa-transport" && resolve(mount.source) === sourcePath(lock.transport.path)
              && mount.target === "/qa/isolated-supabase-transport.mjs"), "UNPINNED_BIND_MOUNT", "compose");
      }
    }
  }
  return config;
}

const CONTAINER_FORMAT = '{"id":{{json .Id}},"name":{{json .Name}},"imageId":{{json .Image}},"imageReference":{{json .Config.Image}},"createdAt":{{json .Created}},"state":{{json .State.Status}},"health":{{with index .State "Health"}}{{json .Status}}{{else}}null{{end}},"restart":{{json .HostConfig.RestartPolicy.Name}},"bindings":{{json .HostConfig.PortBindings}},"operationalPorts":{{json .NetworkSettings.Ports}},"privileged":{{json .HostConfig.Privileged}},"capAdd":{{json .HostConfig.CapAdd}},"capDrop":{{json .HostConfig.CapDrop}},"securityOpt":{{json .HostConfig.SecurityOpt}},"user":{{json .Config.User}},"readOnlyRootfs":{{json .HostConfig.ReadonlyRootfs}},"logDriver":{{json .HostConfig.LogConfig.Type}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"labels":{{json .Config.Labels}}}';
const VOLUME_FORMAT = '{"id":{{json .Name}},"name":{{json .Name}},"createdAt":{{json .CreatedAt}},"driver":{{json .Driver}},"labels":{{json .Labels}}}';
const NETWORK_FORMAT = '{"id":{{json .Id}},"name":{{json .Name}},"createdAt":{{json .Created}},"driver":{{json .Driver}},"scope":{{json .Scope}},"internal":{{json .Internal}},"attachable":{{json .Attachable}},"ingress":{{json .Ingress}},"configOnly":{{json .ConfigOnly}},"configFrom":{{json .ConfigFrom}},"enableIPv4":{{json .EnableIPv4}},"enableIPv6":{{json .EnableIPv6}},"options":{{json .Options}},"ipam":{{json .IPAM}},"labels":{{json .Labels}},"containers":{{json .Containers}}}';
type Inventory = { containers: JsonObject[]; volumes: JsonObject[]; networks: JsonObject[]; imageIds: string[] };
type CapturedResource = { identity: OwnedResourceIdentity; service?: Service };

export function assertAbruptRecoveryEvidence(input: {
  intent: JsonObject; owned: unknown; baseline: JsonObject; expectedRunId: string;
  matchedRunnerCount: number; unreadableNodeCount: number;
}): asserts input is typeof input & { owned: CapturedResource[] } {
  const { intent, baseline, expectedRunId } = input;
  requireThat(/^[a-f0-9]{32}$/.test(expectedRunId) && intent.runId === expectedRunId
    && intent.projectName === `venisia-qa-${expectedRunId}` && intent.cleanupOnly === false
    && intent.applicationHandoffRequested === true && intent.failureInjection === null,
  "INVALID_ABRUPT_RECOVERY_INTENT", "cleanup-preflight");
  requireThat(input.matchedRunnerCount === 0 && input.unreadableNodeCount === 0,
    "LIVE_OR_AMBIGUOUS_RECOVERY_RUNNER", "cleanup-preflight");
  requireThat(baseline.originalUserResourcesExact === true && baseline.servicesStarted === false
    && baseline.cleanupRequiresExactOperationalIdentity === true
    && /^[a-f0-9]{64}$/.test(String(object(baseline.operationalInventory).sha256)),
  "MISSING_OPERATIONAL_RECOVERY_BASELINE", "cleanup-preflight");
  requireThat(Array.isArray(input.owned) && input.owned.length === SERVICES.length + 4,
    "INCOMPLETE_RECOVERY_MANIFEST", "cleanup-preflight");
  requireThat(input.owned.every(row => row !== null && typeof row === "object" && !Array.isArray(row)
    && row.identity !== null && typeof row.identity === "object" && !Array.isArray(row.identity)),
  "INVALID_RECOVERY_MANIFEST", "cleanup-preflight");
  const owned = input.owned as CapturedResource[];
  requireThat(new Set(owned.map(row => `${row.identity?.kind}:${row.identity?.id}`)).size === owned.length
    && canonical(owned.filter(row => row.identity?.kind === "container").map(row => row.service).sort()) === canonical([...SERVICES].sort())
    && owned.filter(row => row.identity?.kind === "volume").length === 3
    && owned.filter(row => row.identity?.kind === "network").length === 1,
  "AMBIGUOUS_RECOVERY_MANIFEST", "cleanup-preflight");
  for (const row of owned) {
    requireThat(row.identity.runId === expectedRunId && row.identity.projectName === intent.projectName
      && Number.isFinite(Date.parse(row.identity.createdAt ?? "")), "FOREIGN_RECOVERY_RESOURCE", "cleanup-preflight");
    assertOwnedResource(row.identity, row.identity);
  }
}

export async function runIsolatedSupabase(options: IsolatedSupabaseOptions): Promise<{ status: "complete"; artifactDir: string }> {
  const lockPath = resolve(options.lockPath);
  requireThat(relative(ROOT, lockPath).startsWith(`scripts${sep}fixtures${sep}`), "LOCK_OUTSIDE_FIXTURES", "preflight");
  const lock = readReleaseLock(lockPath);
  if (options.handoff) {
    requireThat(options.cliBinary && isAbsolute(options.cliBinary), "CLI_BINARY_REQUIRED_FOR_HANDOFF", "preflight");
    const binary = resolve(options.cliBinary);
    requireThat(existsSync(binary) && lstatSync(binary).isFile() && !lstatSync(binary).isSymbolicLink()
      && realpathSync(binary) === binary && sha256(readFileSync(binary)) === lock.applicationMigrationTool.executableSha256,
    "CLI_BINARY_DIGEST_MISMATCH", "preflight");
  }
  const artifactDir = resolve(options.artifactDir);
  const qaRoot = resolve(ROOT, ".tmp-qa");
  requireThat(isAbsolute(options.artifactDir) && relative(qaRoot, artifactDir) !== ""
    && !relative(qaRoot, artifactDir).startsWith("..") && !isAbsolute(relative(qaRoot, artifactDir))
    && (options.cleanupOnly ? existsSync(artifactDir) : !existsSync(artifactDir)), "FRESH_IGNORED_ARTIFACT_DIRECTORY_REQUIRED", "preflight");
  // Check existing ancestors before mkdir, so even directory creation cannot
  // follow a junction/symlink outside the intended ignored workspace boundary.
  let ancestor = dirname(artifactDir);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  requireThat(realpathSync(ancestor) === ancestor && !lstatSync(ancestor).isSymbolicLink(), "ARTIFACT_ANCESTOR_REPARSE_POINT", "preflight");
  const ignored = await command("git", ["check-ignore", "--quiet", "--", artifactDir], "ignored-artifacts", { allowFailure: true });
  requireThat(ignored.code === 0, "ARTIFACT_DIRECTORY_NOT_IGNORED", "preflight");
  if (!options.cleanupOnly) mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
  requireThat(realpathSync(artifactDir) === artifactDir, "ARTIFACT_REPARSE_POINT", "preflight");
  requireThat(!options.abruptRecovery || options.cleanupOnly, "RECOVERY_REQUIRES_CLEANUP_ONLY", "cleanup-preflight");
  const recoveryFiles = new Map<string, string>();
  const readRecoveryFile = (name: string, expectedHash: string) => {
    const path = resolve(artifactDir, name);
    requireThat(/^[a-f0-9]{64}$/.test(expectedHash) && existsSync(path) && lstatSync(path).isFile()
      && !lstatSync(path).isSymbolicLink() && realpathSync(path) === path, "INVALID_RECOVERY_EVIDENCE_FILE", "cleanup-preflight");
    const bytes = readFileSync(path);
    requireThat(sha256(bytes) === expectedHash, "RECOVERY_EVIDENCE_HASH_MISMATCH", "cleanup-preflight");
    recoveryFiles.set(path, expectedHash);
    return JSON.parse(bytes.toString("utf8")) as unknown;
  };
  const abruptRecovery = options.abruptRecovery;
  const priorIntent = options.cleanupOnly ? object(abruptRecovery
    ? readRecoveryFile("intent.json", abruptRecovery.intentSha256)
    : JSON.parse(readFileSync(resolve(artifactDir, "intent.json"), "utf8"))) : null;
  let recoveryManifest: CapturedResource[] | undefined;
  let recoveryBaseline: JsonObject | undefined;
  if (priorIntent) {
    requireThat(priorIntent.releaseCommit === RELEASE_COMMIT && priorIntent.composeSha256 === lock.compose.sha256
      && canonical(priorIntent.images) === canonical(lock.images), "UNAPPROVED_FAILED_CREATION_RECOVERY", "cleanup-preflight");
    if (abruptRecovery) {
      requireThat(process.platform === "win32" && !options.handoff && !options.failureInjection
        && ["failure.json", "cleanup.json", "result.json"].every(name => !existsSync(resolve(artifactDir, name)))
        && priorIntent.lockSha256 === sha256(readFileSync(lockPath)) && priorIntent.artifacts === artifactDir,
      "AMBIGUOUS_ABRUPT_RECOVERY", "cleanup-preflight");
      const runnerPath = resolve(abruptRecovery.runnerPath), runnerRelative = relative(ROOT, runnerPath).replace(/\\/g, "/");
      requireThat(/^\.tmp-qa\/[a-zA-Z0-9_./-]+\.(?:mjs|mts)$/.test(runnerRelative)
        && /^[a-zA-Z0-9_-]+$/.test(abruptRecovery.runnerArgument)
        && artifactDir === resolve(dirname(runnerPath), abruptRecovery.runnerArgument, "runtime")
        && existsSync(runnerPath) && lstatSync(runnerPath).isFile() && !lstatSync(runnerPath).isSymbolicLink()
        && realpathSync(runnerPath) === runnerPath && /^[a-f0-9]{64}$/.test(abruptRecovery.runnerSha256)
        && sha256(readFileSync(runnerPath)) === abruptRecovery.runnerSha256,
      "UNBOUND_RECOVERY_RUNNER", "cleanup-preflight");
      recoveryFiles.set(runnerPath, abruptRecovery.runnerSha256);
      const psLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;
      // Do not return command lines, process environments or unrelated PIDs.
      // Match the runner conservatively, including runs with an omitted default argument.
      const scan = `$ErrorActionPreference='Stop'; $needles=@(${psLiteral(runnerPath.replace(/\\/g, "/").toLowerCase())},${psLiteral(runnerRelative.toLowerCase())}); $matched=0; $unreadable=0; foreach($item in @(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\")){ if($item.ProcessId -eq ${process.pid}){continue}; if([string]::IsNullOrWhiteSpace($item.CommandLine)){$unreadable++;continue}; $line=$item.CommandLine.Replace('\\','/').ToLowerInvariant(); if(@($needles | Where-Object {$line.Contains($_)}).Count -gt 0){$matched++} }; [Console]::Write((@{matchedRunnerCount=$matched;unreadableNodeCount=$unreadable}|ConvertTo-Json -Compress))`;
      const processState = object(JSON.parse((await command("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(scan, "utf16le").toString("base64")], "recovery-runner-inspection")).stdout));
      const evidence = { intent: priorIntent, owned: readRecoveryFile("owned-resources.json", abruptRecovery.ownedResourcesSha256),
        baseline: object(readRecoveryFile("post-create-baseline.json", abruptRecovery.postCreateBaselineSha256)), expectedRunId: String(priorIntent.runId),
        matchedRunnerCount: Number(processState.matchedRunnerCount), unreadableNodeCount: Number(processState.unreadableNodeCount) };
      assertAbruptRecoveryEvidence(evidence);
      recoveryManifest = evidence.owned;
      recoveryBaseline = object(evidence.baseline.operationalInventory);
    } else {
      const failure = object(JSON.parse(readFileSync(resolve(artifactDir, "failure.json"), "utf8")));
      const cleanup = object(JSON.parse(readFileSync(resolve(artifactDir, "cleanup.json"), "utf8")));
      requireThat(failure.stage === "ownership" && failure.code === "UNEXPECTED_CONTAINER_MOUNT" && cleanup.status === "blocked",
        "UNAPPROVED_FAILED_CREATION_RECOVERY", "cleanup-preflight");
    }
  }
  const runId = priorIntent ? String(priorIntent.runId) : randomUUID().replace(/-/g, "");
  requireThat(/^[a-f0-9]{32}$/.test(runId) && (!priorIntent || priorIntent.projectName === `venisia-qa-${runId}`), "INVALID_RECOVERY_RUN", "cleanup-preflight");
  const priorPorts = priorIntent ? priorIntent.ports as number[] : undefined;
  const run: RunIdentity = { runId, projectName: `venisia-qa-${runId}`, pgPort: options.pgPort ?? 56065,
    restPort: options.restPort ?? 56066, storagePort: options.storagePort ?? 56067, apiPort: options.apiPort ?? 56068, upstreamRoot: resolve(artifactDir, "upstream") };
  if (priorPorts) [run.pgPort, run.restPort, run.storagePort, run.apiPort] = priorPorts;
  const ports = [run.pgPort, run.restPort, run.storagePort, run.apiPort];
  requireThat(ports.every(port => Number.isInteger(port) && port > 1024 && port <= 65535) && new Set(ports).size === 4, "INVALID_PORTS", "preflight");
  const dockerBinary = options.dockerBinary ?? "docker";
  const dockerHost = options.dockerHost ?? (process.platform === "win32" ? "npipe:////./pipe/dockerDesktopLinuxEngine" : "unix:///var/run/docker.sock");
  requireThat(["npipe:////./pipe/dockerDesktopLinuxEngine", "npipe:////./pipe/docker_engine", "unix:///var/run/docker.sock"].includes(dockerHost), "REMOTE_DOCKER_FORBIDDEN", "preflight");
  let interrupted = false, cleaning = false;
  const interrupt = () => { interrupted = true; };
  const dc = (args: string[], stage: string, extra: { timeout?: number; allowFailure?: boolean } = {}) => {
    requireThat(cleaning || !interrupted, "INTERRUPTED", stage);
    return command(dockerBinary, ["--host", dockerHost, ...args], stage, extra);
  };
  const parse = (value: string) => object(JSON.parse(value));
  const lines = (text: string) => text.trim().split(/\r?\n/).filter(Boolean);
  const recoveryPrefix = priorIntent ? `cleanup-recovery-${Date.now()}-` : "";
  const recordFile = (name: string, value: unknown) => writeFileSync(resolve(artifactDir, recoveryPrefix + name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  let password = randomBytes(32).toString("hex"), secret = randomBytes(48).toString("hex");
  const anonKey = jwt("anon", secret), serviceKey = jwt("service_role", secret);
  const privateValues = [password, secret, anonKey, serviceKey];
  const safeRecord = (stage: string, metadata: Record<string, SafeValue>) => {
    requireThat(/^[a-z0-9_.-]{1,80}$/.test(stage), "UNSAFE_RECEIPT_STAGE", "receipt");
    for (const [key, value] of Object.entries(metadata)) {
      requireThat(/^[a-zA-Z][a-zA-Z0-9_]{0,70}$/.test(key) && !/password|secret|token|connection|raw|body|payload|authorization/i.test(key), "UNSAFE_RECEIPT_KEY", "receipt");
      requireThat(value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)
        || typeof value === "string" && value.length <= 256 && !/[\r\n]/.test(value)
        && !value.includes("://") && !privateValues.some(item => value.includes(item)), "UNSAFE_RECEIPT_VALUE", "receipt");
    }
    events.push({ at: new Date().toISOString(), stage, ...metadata });
    recordFile("stages.json", events);
    process.stdout.write(`${stage}\n`);
  };
  const events: Array<Record<string, SafeValue>> = [];
  const privateEnvPath = resolve(artifactDir, recoveryPrefix + "compose.private.env");
  const originalPrivateEnvPath = resolve(artifactDir, "compose.private.env");
  let recoveryAuthorized = false;
  const removePrivateEnv = () => {
    requireThat(realpathSync(artifactDir) === artifactDir, "ARTIFACT_REPARSE_POINT", "cleanup");
    for (const path of new Set([privateEnvPath, ...(recoveryAuthorized ? [originalPrivateEnvPath] : [])])) {
      if (!existsSync(path)) continue;
      requireThat(lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink() && realpathSync(path) === path,
        "PRIVATE_ENV_REPARSE_POINT", "cleanup");
      rmSync(path);
    }
  };
  let config: ComposeConfig | undefined, before: Inventory | undefined, created = false;
  const reservedRecoveryPorts: net.Server[] = [];
  const releaseRecoveryPorts = async () => {
    for (const server of reservedRecoveryPorts.splice(0)) await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  };
  const captured: CapturedResource[] = [];
  let handle: OwnedLocalHandle | undefined;
  let appConnection: PgConnection | undefined;
  const scopedConnections = new Set<PgConnection>();
  let controlMaintenance = false;
  let publicJobAbort: AbortController | undefined;
  let publicJob: ReturnType<typeof runOwnedPublicVerification> | undefined;
  let hostBridge: HostBridge | undefined;
  let primaryFailure: IsolatedSupabaseError | undefined;
  let cleanupFailure: IsolatedSupabaseError | undefined;
  let currentStage = "preflight";
  const transportCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EACCES", "EPIPE", "ENOTFOUND", "DB_CONNECTION_TIMEOUT"]);
  const ownerTransportCodes = new Set(["INVALID_QA_TRANSPORT", "INVALID_QA_TRANSPORT_PORTS", "QA_TRANSPORT_CLEANUP_INCOMPLETE", "QA_TRANSPORT_LISTEN_FAILED", "INVALID_QA_BOUNDARY_PORTS", "NON_LOOPBACK_EXPOSURE"]);
  const asSafeError = (error: unknown, stage: string) => error instanceof IsolatedSupabaseError
    ? error : error instanceof IsolatedSupabaseCliError ? new IsolatedSupabaseError(error.code, error.stage)
      : new IsolatedSupabaseError(typeof error === "object" && error !== null && "code" in error
      && typeof error.code === "string" && (/^[0-9A-Z]{5}$/.test(error.code) || transportCodes.has(error.code)) ? error.code
      : error instanceof Error && ownerTransportCodes.has(error.message) ? error.message
        : error instanceof Error && error.message === "Connection terminated due to connection timeout" ? "DB_CONNECTION_TIMEOUT" : "PREREQUISITE_OR_OPERATION_FAILED", stage);

  const inspect = async (kind: "container" | "volume" | "network", id: string): Promise<JsonObject> => {
    requireThat(kind === "volume" ? /^[a-zA-Z0-9_.-]+$/.test(id) : /^[a-f0-9]{64}$/.test(id), "INVALID_RESOURCE_ID", "inventory");
    const format = kind === "container" ? CONTAINER_FORMAT : kind === "volume" ? VOLUME_FORMAT : NETWORK_FORMAT;
    return parse((await dc([kind, "inspect", "--format", format, id], `${kind}-inspect`)).stdout);
  };
  const list = async (kind: "container" | "volume" | "network", owned = false): Promise<string[]> => {
    const result = await dc([kind, "ls", ...(kind === "container" ? ["--all", "--no-trunc"] : kind === "network" ? ["--no-trunc"] : []),
      ...(owned ? ["--filter", `label=${LABEL_RUN}=${run.projectName}`] : []), "--format", kind === "volume" ? "{{.Name}}" : "{{.ID}}"], `${kind}-list`);
    return lines(result.stdout).sort();
  };
  const inventory = async (): Promise<Inventory> => {
    const result: Inventory = { containers: [], volumes: [], networks: [], imageIds: [] };
    for (const kind of ["container", "volume", "network"] as const) {
      const target = kind === "container" ? result.containers : kind === "volume" ? result.volumes : result.networks;
      for (const id of await list(kind)) target.push(await inspect(kind, id));
    }
    result.imageIds = [...new Set(lines((await dc(["image", "ls", "--all", "--no-trunc", "--quiet"], "image-inventory")).stdout))].sort();
    return result;
  };
  // Only hashes/counts of existing metadata leave memory. In particular, never
  // read Docker Config.Env, raw logs, project env files, or existing DB contents.
  const inventoryReceipt = (value: Inventory) => ({ containers: value.containers.length, volumes: value.volumes.length,
    networks: value.networks.length, images: value.imageIds.length, sha256: sha256(canonical(value)) });
  const assertOriginalsUnchanged = (after: Inventory, baseline: Inventory | undefined = before, stage = "cleanup") => {
    requireThat(baseline, "MISSING_BASELINE", stage);
    for (const key of ["containers", "volumes", "networks"] as const) {
      for (const original of baseline[key]) {
        const actual = after[key].find(item => item.id === original.id);
        if (!actual || canonical(actual) !== canonical(original)) {
          recordFile("existing-resource-difference.json", { kind: key, id: original.id, name: original.name,
            presentAfter: Boolean(actual), beforeSha256: sha256(canonical(original)), afterSha256: actual ? sha256(canonical(actual)) : null,
            changedFields: actual ? [...new Set([...Object.keys(original), ...Object.keys(actual)])].filter(field => canonical(original[field]) !== canonical(actual[field])) : [] });
        }
        requireThat(actual && canonical(actual) === canonical(original), "EXISTING_RESOURCE_CHANGED", stage);
      }
    }
    requireThat(baseline.imageIds.every(id => after.imageIds.includes(id)), "EXISTING_IMAGE_MISSING", stage);
  };
  const normalizeOwned = (kind: "container" | "volume" | "network", row: JsonObject): CapturedResource => {
    requireThat(config, "MISSING_COMPOSE_CONTRACT", "ownership");
    const labels = object(row.labels);
    requireThat(labels[LABEL_OWNER] === OWNER && labels[LABEL_RUN] === run.projectName
      && labels["com.docker.compose.project"] === run.projectName, "FOREIGN_RESOURCE", "ownership");
    const name = String(row.name).replace(/^\//, "");
    requireThat(name.startsWith(run.projectName), "FOREIGN_RESOURCE_NAME", "ownership");
    const identity: OwnedResourceIdentity = { kind, id: String(row.id), name, runId, projectName: run.projectName, createdAt: String(row.createdAt) };
    if (kind === "container") {
      const service = labels["com.docker.compose.service"] as Service;
      requireThat(SERVICES.includes(service), "FOREIGN_CONTAINER_SERVICE", "ownership");
      const image = imageForService(lock, service);
      requireThat([image.configDigest, image.manifestDigest].includes(String(row.imageId))
        && row.imageReference === image.reference && row.restart === "no" && row.privileged === false
        && (!row.capAdd || Array.isArray(row.capAdd) && row.capAdd.length === 0), "FOREIGN_CONTAINER_IMAGE", "ownership");
      const expected = config.services[service];
      if (service === "qa-transport") requireThat(row.user === "1000:1000" && row.readOnlyRootfs === true
        && canonical(row.capDrop) === canonical(["ALL"])
        && canonical(row.securityOpt) === canonical(["no-new-privileges:true"]), "TRANSPORT_RUNTIME_BOUNDARY", "ownership");
      if (service === "api-gw") requireThat(row.logDriver === "none", "GATEWAY_RUNTIME_LOG_RETENTION", "ownership");
      const expectedMounts = (expected.volumes ?? []).map(mount => ({ type: mount.type,
        source: mount.type === "volume" ? config!.volumes[mount.source].name : normalizeDockerBindSource(mount.source),
        target: mount.target, readOnly: mount.read_only === true })).sort((a, b) => a.target.localeCompare(b.target));
      const actualMounts = (row.mounts as JsonObject[]).map(mount => ({ type: String(mount.Type),
        source: mount.Type === "volume" ? mount.Name : normalizeDockerBindSource(String(mount.Source)), target: String(mount.Destination), readOnly: mount.RW === false })).sort((a, b) => a.target.localeCompare(b.target));
      for (const mount of expected.volumes ?? []) if (mount.type === "bind") {
        const file = lock.files.find(file => resolve(run.upstreamRoot, file.path) === resolve(mount.source))
          ?? (service === "qa-transport" && resolve(mount.source) === sourcePath(lock.transport.path) ? lock.transport : undefined);
        requireThat(file && sha256(readFileSync(resolve(mount.source))) === file.sha256, "BOUND_SOURCE_HASH_CHANGED", "ownership");
      }
      requireThat(canonical(actualMounts) === canonical(expectedMounts), "UNEXPECTED_CONTAINER_MOUNT", "ownership");
      const networkNames = Object.keys(object(row.networks)).sort();
      requireThat(canonical(networkNames) === canonical(Object.values(config.networks).map(item => item.name).sort()), "UNEXPECTED_CONTAINER_NETWORK", "ownership");
      const expectedBindings = Object.fromEntries((expected.ports ?? []).map(port => [`${port.target}/tcp`, [{ HostIp: "127.0.0.1", HostPort: String(port.published) }]]));
      requireThat(canonical(row.bindings ?? {}) === canonical(expectedBindings), "UNEXPECTED_PORT_BINDING", "ownership");
      requireThat(Object.values(object(row.operationalPorts ?? {})).every(value => value === null || Array.isArray(value) && value.length === 0), "UNEXPECTED_OPERATIONAL_PORT", "ownership");
      identity.imageId = String(row.imageId); identity.mounts = actualMounts; identity.networkIdentity = networkNames;
      return { identity, service };
    }
    if (kind === "volume") requireThat(Object.values(config.volumes).some(item => item.name === name) && row.driver === "local", "UNEXPECTED_VOLUME", "ownership");
    if (kind === "network") {
      requireThat(Object.values(config.networks).some(item => item.name === name) && row.driver === "bridge" && row.internal === true, "UNEXPECTED_NETWORK", "ownership");
      identity.networkIdentity = { driver: row.driver, internal: row.internal };
    }
    return { identity };
  };
  const discoverOwned = async () => {
    for (const kind of ["network", "volume", "container"] as const) {
      for (const id of await list(kind, true)) {
        const item = normalizeOwned(kind, await inspect(kind, id));
        if (priorIntent) {
          const earliest = statSync(resolve(artifactDir, "intent.json")).birthtimeMs - 1000;
          const latest = statSync(resolve(artifactDir, recoveryManifest ? "owned-resources.json" : "result.json")).mtimeMs + 1000;
          const createdAt = Date.parse(item.identity.createdAt ?? "");
          requireThat(createdAt >= earliest && createdAt <= latest, "RESOURCE_OUTSIDE_FAILED_CREATION_WINDOW", "ownership");
          if (recoveryManifest) {
            const expected = recoveryManifest.find(row => row.identity.kind === kind && row.identity.id === id);
            requireThat(expected && expected.service === item.service, "RECOVERY_RESOURCE_SET_CHANGED", "ownership");
            assertOwnedResource(item.identity, expected.identity);
          }
        }
        requireThat(!before?.[kind === "container" ? "containers" : kind === "volume" ? "volumes" : "networks"].some(row => row.id === id), "EXISTING_RESOURCE_SELECTED", "ownership");
        const previous = captured.find(row => row.identity.kind === kind && row.identity.id === id);
        if (previous) assertOwnedResource(item.identity, previous.identity); else captured.push(item);
      }
    }
  };
  const inspectCaptured = async (item: CapturedResource) => {
    const actual = normalizeOwned(item.identity.kind, await inspect(item.identity.kind, item.identity.id));
    assertOwnedResource(actual.identity, item.identity);
    return actual;
  };
  const serviceResource = (service: Service) => {
    const item = captured.find(row => row.service === service);
    requireThat(item, "SERVICE_NOT_CAPTURED", "ownership"); return item;
  };
  const databaseUrl = (username: "postgres" | "supabase_admin") => {
    const url = new URL(`postgresql://127.0.0.1:${run.pgPort}/postgres`);
    url.username = username; url.password = password;
    assertLoopbackDatabaseTarget(url.toString(), { username, port: run.pgPort, database: "postgres" });
    return url.toString();
  };
  const connect = async (username: "postgres" | "supabase_admin"): Promise<PgConnection> => {
    await inspectCaptured(serviceResource("db"));
    const client = new pg.Client({ connectionString: databaseUrl(username), connectionTimeoutMillis: 5000, ssl: false, options: "",
      statement_timeout: 30000, application_name: OWNER }) as PgConnection;
    try { await client.connect(); } catch (error) { await client.end().catch(() => undefined); throw asSafeError(error, "database-connect"); }
    return client;
  };
  const readonly = async (sql: string): Promise<QueryResult> => {
    const client = await connect("supabase_admin");
    try { await client.query("begin read only"); const result = await client.query(sql); await client.query("rollback"); return result; }
    catch (error) { throw asSafeError(error, "platform-readiness"); }
    finally { await client.end(); }
  };
  const readOwnedDatabaseListenState = async () => {
    const item = serviceResource("db"); await inspectCaptured(item);
    const sql = "select json_build_object('listenAddresses', current_setting('listen_addresses'), 'port', current_setting('port'), 'serverVersion', current_setting('server_version_num'), 'database', current_database(), 'postmasterStartedAt', pg_postmaster_start_time()::text, 'postmasterUptimeSeconds', extract(epoch from clock_timestamp()-pg_postmaster_start_time()), 'ownerConnectionCount', (select count(*) from pg_stat_activity where application_name='isolated-supabase'), 'recovery', pg_is_in_recovery())";
    const result = await dc(["container", "exec", item.identity.id, "psql", "--no-psqlrc", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres", "-Atqc", sql], "owned-db-listen-diagnostic", { allowFailure: true, timeout: 10000 });
    const catalog = result.code === 0 ? parse(result.stdout) : null;
    recordFile("owned-database-listen-state.json", { containerId: item.identity.id, diagnosticExitCode: result.code,
      sqlReadOnly: true, catalog, rawLogsRead: false, environmentRead: false });
  };
  const waitPublishedDatabase = async () => {
    const started = Date.now(), probes: Array<{ elapsedMs: number; code: string | null }> = [];
    let ready = false;
    try {
      while (Date.now() - started < 30_000) {
        try {
          const client = await connect("supabase_admin"); await client.end();
          probes.push({ elapsedMs: Date.now() - started, code: null }); ready = true; return;
        } catch (error) {
          const safe = asSafeError(error, "published-database-readiness");
          probes.push({ elapsedMs: Date.now() - started, code: safe.code });
          if (!transportCodes.has(safe.code) || safe.code === "EACCES") {
            await readOwnedDatabaseListenState(); throw safe;
          }
          await sleep(1000);
        }
      }
      await readOwnedDatabaseListenState();
      fail(probes.at(-1)?.code ?? "PUBLISHED_DATABASE_UNAVAILABLE", "published-database-readiness");
    } finally {
      recordFile("published-database-readiness.json", { ready, host: "127.0.0.1", port: run.pgPort,
        internalNetwork: true, dockerPortPublishing: false, ingress: "owner-exec-stdio", dockerHealthy: true,
        hostProbeSqlExecuted: false, durationMs: Date.now() - started, probes });
    }
  };
  const waitHealthy = async (service: Service) => {
    const item = serviceResource(service), deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await inspectCaptured(item);
      const row = await inspect("container", item.identity.id);
      requireThat(!["exited", "dead"].includes(String(row.state)), "OFFICIAL_SERVICE_EXITED", `${service}-readiness`);
      if (row.health === "healthy") return;
      await sleep(1000);
    }
    fail("OFFICIAL_SERVICE_READINESS_TIMEOUT", `${service}-readiness`);
  };
  const startService = async (service: Service) => {
    const item = serviceResource(service); await inspectCaptured(item);
    await dc(["container", "start", item.identity.id], `${service}-start`);
    await waitHealthy(service);
    safeRecord(`${service}-healthy`, { containerId: item.identity.id });
  };
  const prepareCompose = async () => {
    const environment = { QA_RUN_ID: run.projectName, PG_PORT: String(run.pgPort), REST_PORT: String(run.restPort), STORAGE_PORT: String(run.storagePort), API_PORT: String(run.apiPort),
      UPSTREAM_ROOT: run.upstreamRoot.replace(/\\/g, "/"), POSTGRES_PASSWORD: password, JWT_SECRET: secret, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey,
      TRANSPORT_MODULE: sourcePath(lock.transport.path).replace(/\\/g, "/"), DASHBOARD_USERNAME: `qa-${runId}`, DASHBOARD_PASSWORD: randomBytes(32).toString("hex"),
      S3_PROTOCOL_ACCESS_KEY_ID: randomBytes(16).toString("hex"), S3_PROTOCOL_ACCESS_KEY_SECRET: randomBytes(32).toString("hex") };
    privateValues.push(environment.S3_PROTOCOL_ACCESS_KEY_ID, environment.S3_PROTOCOL_ACCESS_KEY_SECRET, environment.DASHBOARD_PASSWORD);
    writeFileSync(privateEnvPath, Object.entries(environment).map(([key, value]) => `${key}='${value}'`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
    const args = ["compose", "--env-file", privateEnvPath, "--project-name", run.projectName, "--file", sourcePath(lock.compose.path)];
    config = validateComposeConfig(JSON.parse((await dc([...args, "config", "--format", "json"], "compose-config")).stdout), lock, run);
    return args;
  };

  recordFile("intent.json", { runId, projectName: run.projectName, releaseCommit: RELEASE_COMMIT,
    lockSha256: sha256(readFileSync(lockPath)), composeSha256: lock.compose.sha256, images: lock.images,
    sourceHashes: Object.fromEntries(["scripts/lib/isolated-supabase.mts", "scripts/qa-isolated-supabase.mts", "scripts/lib/isolated-public-application.mts", "scripts/lib/isolated-supabase-cli.mts"].map(path => [path, sha256(readFileSync(resolve(ROOT, path)))])),
    ports, artifacts: artifactDir, cleanupOnly: Boolean(priorIntent), priorIntentSha256: priorIntent ? sha256(readFileSync(resolve(artifactDir, "intent.json"))) : null,
    failureInjection: options.failureInjection ?? null, applicationHandoffRequested: !priorIntent && Boolean(options.handoff) });
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  try {
    if (priorIntent) {
      // Reserving every original listener rejects a live host runner and stops
      // another owner from acquiring those ports during cleanup verification.
      for (const port of ports) {
        await new Promise<void>((done, reject) => {
          const server = net.createServer(socket => socket.destroy());
          server.once("error", () => reject(new IsolatedSupabaseError("RECOVERY_HOST_PORT_IN_USE", "cleanup-preflight")));
          server.listen({ host: "127.0.0.1", port, exclusive: true }, () => { reservedRecoveryPorts.push(server); done(); });
        });
      }
      safeRecord("recovery-host-ports-reserved", { ports: ports.length, originalListenersAbsent: true });
    }
    currentStage = "existing-inventory";
    const prewarmStartedAt = new Date().toISOString();
    // Desktop may wake the daemon lazily. Do not take an old cached bridge
    // identity during wake as the baseline for a newly initialized daemon.
    await dc(["info", "--format", "{{.ServerVersion}}"], "engine-wake");
    let stable = false;
    for (let attempt = 0; attempt < 10 && !stable; attempt++) {
      const first = await dc(["network", "inspect", "bridge", "--format", "{{.Id}}"], "engine-ready-before");
      await sleep(1000);
      await dc(["info", "--format", "{{.ServerVersion}}"], "engine-ready");
      const second = await dc(["network", "inspect", "bridge", "--format", "{{.Id}}"], "engine-ready-after");
      stable = /^[a-f0-9]{64}$/.test(first.stdout.trim()) && first.stdout.trim() === second.stdout.trim();
    }
    requireThat(stable, "ENGINE_IDENTITY_NOT_STABLE", currentStage);
    before = await inventory();
    if (priorIntent) {
      for (const key of ["containers", "volumes", "networks"] as const) before[key] = before[key].filter(row => object(row.labels ?? {})[LABEL_RUN] !== run.projectName);
      const priorBaseline = recoveryBaseline ?? object(JSON.parse(readFileSync(resolve(artifactDir, "inventory-before.json"), "utf8")));
      recordFile("prior-baseline-comparison.json", { exact: priorBaseline.sha256 === inventoryReceipt(before).sha256,
        priorSha256: priorBaseline.sha256, currentSha256: inventoryReceipt(before).sha256 });
      requireThat(priorBaseline.sha256 === inventoryReceipt(before).sha256, "PRIOR_BASELINE_CHANGED", "cleanup-preflight");
    }
    recordFile("inventory-before.json", inventoryReceipt(before));
    safeRecord("inventory-before", inventoryReceipt(before));
    if (priorIntent) {
      await prepareCompose(); await discoverOwned();
      requireThat(captured.length === SERVICES.length + Object.keys(config!.volumes).length + Object.keys(config!.networks).length,
        "FAILED_CREATION_RESOURCE_SET_CHANGED", "cleanup-preflight");
      if (recoveryManifest) {
        requireThat(captured.length === recoveryManifest.length, "RECOVERY_RESOURCE_SET_CHANGED", "cleanup-preflight");
        const ownedContainerIds = new Set(captured.filter(row => row.identity.kind === "container").map(row => row.identity.id));
        for (const item of captured.filter(row => row.identity.kind === "network")) {
          const network = await inspect("network", item.identity.id);
          requireThat(Object.keys(object(network.containers ?? {})).every(id => ownedContainerIds.has(id)),
            "FOREIGN_NETWORK_MEMBER", "cleanup-preflight");
        }
      }
      for (const [path, expectedHash] of recoveryFiles) requireThat(sha256(readFileSync(path)) === expectedHash,
        "RECOVERY_EVIDENCE_CHANGED", "cleanup-preflight");
      created = true;
      recoveryAuthorized = true;
      recordFile("owned-resources.json", captured);
      safeRecord(recoveryManifest ? "abrupt-run-cleanup-verified" : "failed-creation-cleanup-verified", {
        resources: captured.length, sqlExecuted: false, originalEvidencePreserved: true,
        exactOperationalBaseline: Boolean(recoveryBaseline), originalHostListenersAbsent: true });
    } else {
    for (const port of ports) {
      await new Promise<void>((done, reject) => {
        const server = net.createServer();
        server.once("error", () => reject(new IsolatedSupabaseError("PORT_UNAVAILABLE", "preflight")));
        server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => done()));
      });
    }
    currentStage = "upstream-provenance";
    for (const file of lock.files) {
      let bytes: Buffer | undefined;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(new URL(file.path, lock.release.sourceBaseUrl), { redirect: "error", signal: AbortSignal.timeout(30000) });
          requireThat(response.ok, "UPSTREAM_SOURCE_UNAVAILABLE", currentStage);
          bytes = Buffer.from(await response.arrayBuffer());
          break;
        } catch (error) {
          const cause = error instanceof Error && "cause" in error && error.cause && typeof error.cause === "object" ? error.cause as JsonObject : {};
          const redirect = cause.message === "unexpected redirect";
          const code = typeof cause.code === "string" && /^[A-Z0-9_]{1,50}$/.test(cause.code) ? cause.code
            : error instanceof Error && error.name === "TimeoutError" ? "SOURCE_TIMEOUT" : "SOURCE_TRANSPORT_ERROR";
          if (error instanceof IsolatedSupabaseError || redirect) throw error instanceof IsolatedSupabaseError ? error : new IsolatedSupabaseError("SOURCE_REDIRECT_REJECTED", currentStage);
          safeRecord("upstream-transport-failure", { file: file.path, attempt, code });
          if (attempt === 2) throw new IsolatedSupabaseError(code, currentStage);
          await sleep(500);
        }
      }
      requireThat(bytes, "UPSTREAM_SOURCE_UNAVAILABLE", currentStage);
      requireThat(bytes.length < 2_000_000 && sha256(bytes) === file.sha256, "UPSTREAM_SOURCE_HASH_MISMATCH", currentStage);
      const target = resolve(run.upstreamRoot, file.path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: "wx" });
    }
    safeRecord("upstream-source-verified", { files: lock.files.length, releaseCommit: RELEASE_COMMIT });
    currentStage = "image-provenance";
    for (const service of IMAGE_SERVICES) {
      const image = lock.images[service];
      const inspected = await dc(["image", "inspect", "--format", '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"repoDigests":{{json .RepoDigests}}}', image.reference], "image-inspect", { allowFailure: true });
      requireThat(inspected.code === 0, "PINNED_IMAGE_NOT_INSTALLED", currentStage);
      const identity = parse(inspected.stdout);
      assertPinnedImageIdentity(identity as Parameters<typeof assertPinnedImageIdentity>[0], image);
      safeRecord("image-verified", { service, configDigest: image.configDigest, manifestDigest: image.manifestDigest, dockerImageId: String(identity.id) });
    }
    currentStage = "compose-contract";
    const composeArgs = await prepareCompose();
    requireThat(config, "MISSING_COMPOSE_CONTRACT", currentStage);
    safeRecord("compose-validated", { services: SERVICES.length, volumes: Object.keys(config.volumes).length, internalNetwork: true });
    currentStage = "owned-create";
    created = true;
    await dc([...composeArgs, "create", "--no-build", "--pull", "never"], "compose-create", { timeout: 120_000 });
    await discoverOwned();
    requireThat(captured.filter(row => row.identity.kind === "container").length === SERVICES.length
      && captured.filter(row => row.identity.kind === "volume").length === 3
      && captured.filter(row => row.identity.kind === "network").length === 1, "INCOMPLETE_OWNED_RESOURCE_SET", currentStage);
    recordFile("owned-resources.json", captured);
    currentStage = "post-create-baseline";
    const afterCreate = await inventory();
    const previousBridge = before.networks.find(row => row.name === "bridge");
    const currentBridge = afterCreate.networks.find(row => row.name === "bridge");
    requireThat(previousBridge && currentBridge
      && before.networks.filter(row => row.name === "bridge").length === 1
      && afterCreate.networks.filter(row => row.name === "bridge").length === 1, "MISSING_UNIQUE_BUILTIN_BRIDGE", currentStage);
    const firstOwnedCreatedAt = captured.map(row => String(row.identity.createdAt)).reduce((first, value) =>
      engineTimestamp(value) < engineTimestamp(first) ? value : first);
    const transition = previousBridge.id !== currentBridge.id;
    if (transition) assertBuiltinBridgeEpochTransition(previousBridge, currentBridge,
      { warmStartedAt: prewarmStartedAt, firstOwnedCreatedAt });
    const operationalBaseline: Inventory = { ...before,
      networks: before.networks.map(row => transition && row.id === previousBridge.id ? currentBridge : row) };
    // Validate every other original resource before accepting any bridge epoch
    // change. No service has started, and the initial receipt remains immutable.
    assertOriginalsUnchanged(afterCreate, operationalBaseline, currentStage);
    recordFile("post-create-baseline.json", { prewarmStartedAt, firstOwnedCreatedAt, bridgeEpochTransition: transition,
      previousBridge, currentBridge, prewarmInventory: inventoryReceipt(before), operationalInventory: inventoryReceipt(operationalBaseline),
      originalUserResourcesExact: true, servicesStarted: false, cleanupRequiresExactOperationalIdentity: true });
    before = operationalBaseline;
    safeRecord("post-create-baseline", { bridgeEpochTransition: transition, originalUserResourcesExact: true, servicesStarted: false });
    currentStage = "network-denial-preflight";
    await startService("qa-transport");
    const transportPreflight = serviceResource("qa-transport"); await inspectCaptured(transportPreflight);
    const routeProof = parse((await dc(["container", "exec", "--user", "1000:1000", transportPreflight.identity.id,
      "node", "/qa/isolated-supabase-transport.mjs", "--route-proof"], "network-route-proof", { timeout: 15000 })).stdout);
    requireThat(routeProof.ipv4Default === false && routeProof.ipv6Default === false
      && routeProof.externalDenial === "ENETUNREACH" && routeProof.productionConnectionAttempted === false,
    "EXTERNAL_DENIAL_NOT_PROVEN", currentStage);
    for (const item of captured.filter(row => row.identity.kind === "container")) await inspectCaptured(item);
    recordFile("network-denial-before-bootstrap.json", { routeProof, containers: SERVICES.length,
      everyContainerAttachedOnlyToOwnedInternalNetwork: true, extraCapabilities: false, dockerPortPublishing: false,
      officialDatabaseStarted: false, storageStarted: false });
    safeRecord("network-denial-before-bootstrap", { externalRouteAbsent: true, reservedDestinationDenied: true, containers: SERVICES.length });
    currentStage = "postgres-platform";
    await startService("db");
    hostBridge = await startHostAccessBridge({ dockerBinary, dockerHost, env: cleanChildEnvironment(),
      ports: { db: run.pgPort, rest: run.restPort, storage: run.storagePort, "api-gw": run.apiPort },
      assertOwnedTransport: async () => {
        requireThat(!interrupted && !cleaning, "INACTIVE_TRANSPORT", "host-access");
        const item = serviceResource("qa-transport"); await inspectCaptured(item); return item.identity.id;
      } }) as HostBridge;
    const hostAccessOpen = hostBridge.snapshot();
    requireThat(hostAccessOpen.listeners.length === ports.length
      && hostAccessOpen.listeners.every(listener => listener.host === "127.0.0.1")
      && canonical(hostAccessOpen.listeners.map(listener => listener.port).sort()) === canonical([...ports].sort()),
    "NON_LOOPBACK_HOST_ACCESS", "host-access");
    recordFile("host-access-open.json", hostAccessOpen);
    const hostBoundary = await proveHostBoundary(ports);
    recordFile("host-boundary.json", hostBoundary);
    await waitPublishedDatabase();
    const database = await readonly("select current_database() as database, current_user as role, current_setting('server_version_num') as version, current_setting('ssl') as server_ssl, pg_get_userbyid(datdba) as owner, has_database_privilege('postgres', current_database(), 'CREATE') as postgres_create from pg_database where datname=current_database()");
    requireThat(database.rows.length === 1 && database.rows[0].database === "postgres" && database.rows[0].role === "supabase_admin"
      && database.rows[0].postgres_create === true, "OFFICIAL_DATABASE_PREREQUISITE_MISSING", currentStage);
    recordFile("postgres-readiness.json", database.rows[0]);
    currentStage = "official-storage";
    await startService("rest");
    await startService("imgproxy");
    await startService("storage");
    const storage = serviceResource("storage");
    // This invokes only the image's official file-metadata loader. It neither
    // connects to a DB nor executes SQL or a parallel Storage migrator.
    const loaderCode = "require('postgres-migrations').loadMigrationFiles('/app/migrations/tenant').then(rows=>{if(!Array.isArray(rows))throw Error('Unexpected migration metadata');process.stdout.write(JSON.stringify(rows.map(({id,name,hash})=>({id,name,hash}))));}).catch(()=>{process.exitCode=1;});";
    const expected = JSON.parse((await dc(["container", "exec", "--workdir", "/app", storage.identity.id, "node", "-e", loaderCode], "storage-bundled-metadata")).stdout) as Array<{ id: number; name: string; hash: string }>;
    requireThat(Array.isArray(expected) && expected.length > 0 && expected.every(row => Number.isInteger(row.id) && typeof row.name === "string" && typeof row.hash === "string"), "STORAGE_CHAIN_UNPROVEN", currentStage);
    const history = await readonly("select id, name, hash from storage.migrations order by id");
    requireThat(canonical(history.rows) === canonical(expected), "STORAGE_MIGRATION_CHAIN_MISMATCH", currentStage);
    const catalog = await readonly("select c.relname as name, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls, has_table_privilege('postgres',c.oid,'SELECT') as postgres_select, has_table_privilege('postgres',c.oid,'INSERT') as postgres_insert, has_table_privilege('postgres',c.oid,'UPDATE') as postgres_update, has_table_privilege('anon',c.oid,'SELECT') as anon_select, has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname in ('buckets','objects','migrations') order by c.relname");
    requireThat(catalog.rows.length === 3 && catalog.rows.every(row => row.owner === "supabase_storage_admin"), "STORAGE_OWNERSHIP_MISMATCH", currentStage);
    const buckets = catalog.rows.find(row => row.name === "buckets"), objects = catalog.rows.find(row => row.name === "objects"), migrations = catalog.rows.find(row => row.name === "migrations");
    requireThat(buckets?.postgres_select === true && buckets.postgres_insert === true && buckets.postgres_update === true
      && buckets.rls === true && objects?.rls === true
      && migrations?.anon_select === false && migrations.authenticated_select === false, "STORAGE_ACL_PREREQUISITE_MISSING", currentStage);
    recordFile("storage-readiness.json", { migrationCount: expected.length, migrationHead: expected.at(-1), historySha256: sha256(canonical(history.rows)),
      fullBundledChainExact: true, loader: "postgres-migrations.loadMigrationFiles", catalog: catalog.rows });
    safeRecord("storage-verified", { migrationCount: expected.length, fullBundledChainExact: true, ownershipAndAclVerified: true });
    currentStage = "rest-readiness";
    const response = await fetch(`http://127.0.0.1:${run.restPort}/`, { headers: { Authorization: `Bearer ${anonKey}` }, redirect: "error", signal: AbortSignal.timeout(10000) });
    requireThat(response.ok, "REST_READINESS_FAILED", currentStage);
    await response.body?.cancel();
    safeRecord("storage-rest-ready", { restStatus: response.status, postgresRoleVerified: true, storageVerified: true });
    currentStage = "official-api-gateway";
    await startService("api-gw");
    const apiResponse = await fetch(`http://127.0.0.1:${run.apiPort}/rest/v1/`, {
      // The official gateway restricts this exact OpenAPI discovery route to
      // service_role. Use only this run's generated local key; preserve routing.
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    recordFile("api-gateway-readiness.json", { status: apiResponse.status, path: "/rest/v1/", localServiceRoleProbe: true,
      officialConfigurationUnmodified: true, responseBodyRetained: false });
    requireThat(apiResponse.ok, "OFFICIAL_API_GATEWAY_NOT_READY", currentStage);
    await apiResponse.body?.cancel();
    currentStage = "network-contract";
    const transport = serviceResource("qa-transport"); await inspectCaptured(transport);
    const networkProof = parse((await dc(["container", "exec", "--user", "1000:1000", transport.identity.id,
      "node", "/qa/isolated-supabase-transport.mjs", "--network-proof"], "network-proof", { timeout: 20000 })).stdout);
    requireThat(networkProof.ipv4Default === false && networkProof.ipv6Default === false
      && networkProof.externalDenial === "ENETUNREACH" && networkProof.productionConnectionAttempted === false,
    "EXTERNAL_DENIAL_NOT_PROVEN", currentStage);
    const aliases = object(networkProof.aliases);
    requireThat(canonical(Object.keys(aliases).sort()) === canonical(["api-gw", "db", "rest", "storage"]), "INCOMPLETE_INTERNAL_ALIAS_PROOF", currentStage);
    const containers = [];
    for (const service of SERVICES) {
      const item = serviceResource(service); await inspectCaptured(item);
      const row = await inspect("container", item.identity.id);
      const attachments = object(row.networks);
      const networkName = Object.keys(attachments)[0], attachment = object(attachments[networkName]);
      const network = captured.find(item => item.identity.kind === "network");
      requireThat(network && attachment.NetworkID === network.identity.id, "NETWORK_IDENTITY_MISMATCH", currentStage);
      if (Object.hasOwn(aliases, service)) requireThat(aliases[service] === attachment.IPAddress, "INTERNAL_ALIAS_MISMATCH", currentStage);
      containers.push({ service, containerId: item.identity.id, networkId: attachment.NetworkID,
        privileged: row.privileged, addedCapabilities: row.capAdd, user: row.user,
        readOnlyRootfs: row.readOnlyRootfs, droppedCapabilities: row.capDrop,
        securityOptions: row.securityOpt, loggingDriver: row.logDriver,
        hostConfigPortBindingsEmpty: Object.keys(object(row.bindings ?? {})).length === 0,
        operationalPortMappingsEmpty: Object.values(object(row.operationalPorts ?? {})).every(value => value === null || Array.isArray(value) && value.length === 0) });
    }
    recordFile("network-contract.json", { networkProof, containers, hostAccess: hostBridge.snapshot(), hostBoundary, apiStatus: apiResponse.status,
      productionEndpointContacted: false, nonLoopbackHostListener: false,
      nonLoopbackEvidence: "Actual Node listeners are 127.0.0.1 and own-host non-loopback IPv4 probes were denied; no other LAN machine was probed",
      proofScope: "Shared internal Docker network, transport routes and fixed destination denial; no real Production probe" });
    safeRecord("network-contract-verified", { apiStatus: apiResponse.status, containers: containers.length, externalRouteAbsent: true, reservedDestinationDenied: true });
    safeRecord("platform-ready", { restStatus: response.status, apiStatus: apiResponse.status, postgresRoleVerified: true, storageVerified: true, networkContractVerified: true });
    if (options.failureInjection === "before-handoff") fail("INJECTED_BEFORE_HANDOFF", "failure-injection");
    if (options.handoff) {
      currentStage = "application-handoff";
      appConnection = await connect("postgres");
      const boundConnection = appConnection;
      const applicationClient = observeApplicationClient(boundConnection, () => {
        if (handle) activeHandles.delete(handle);
        safeRecord("application-client-disconnected", { code: "APPLICATION_CLIENT_DISCONNECTED", errorDetailsRetained: false });
      });
      const applicationLease=createAdminMeasurementControlLease(boundConnection,{
        connect:()=>connect("postgres"),assertHealthy:()=>applicationClient.assertHealthy(),watch:client=>applicationClient.watch(client),
        assertOwned:async()=>{assertOwnedLocalHandle(handle);requireThat(!interrupted&&!cleaning,"INACTIVE_ADMIN_CONTROL_LEASE","admin-measurement");await inspectCaptured(serviceResource("db"));},
        replaced:client=>{appConnection=client;},record:values=>safeRecord(values.deferred===true?"admin-control-connection-deferred":"admin-control-connection-renewed",values),
      });
      requireThat(options.cliBinary, "CLI_BINARY_REQUIRED_FOR_HANDOFF", currentStage);
      // One private context per handoff preserves the helper's verified binary
      // and dry-run/apply sequencing. Neither it nor its credential is exposed.
      const cliContext: ApplicationMigrationCliContext = Object.freeze({ runDirectory: artifactDir,
        host: "127.0.0.1", port: run.pgPort, database: "postgres", password,
        tool: Object.freeze({ ...lock.applicationMigrationTool }), sourceBinary: resolve(options.cliBinary),
        generatorDocker: Object.freeze({ binary: dockerBinary, host: dockerHost, databaseContainerId: serviceResource("db").identity.id }),
        assertOwned: async () => {
          assertOwnedLocalHandle(handle);
          applicationClient.assertHealthy();
          requireThat(!interrupted && !cleaning, "INACTIVE_HANDOFF", "application-cli");
          await inspectCaptured(serviceResource("db"));
        } });
      const publicContext: PrivatePublicVerificationContext = Object.freeze({
        runDirectory: artifactDir, apiPort: run.apiPort, anonKey, serviceKey,
        cleanEnvironment: () => cleanChildEnvironment(),
        assertOwned: async () => {
          assertOwnedLocalHandle(handle); applicationClient.assertHealthy();
          requireThat(!interrupted && !cleaning, "INACTIVE_PUBLIC_HANDOFF", "public-verification");
          await inspectCaptured(serviceResource("db")); await inspectCaptured(serviceResource("api-gw"));
        },
        sanitize: (value: string) => privateValues.reduce((text, item) => text.replaceAll(item, "[REDACTED_LOCAL_CREDENTIAL]"), value),
        record: safeRecord,
      });
      let acceptedAdminFixtureHash: string | undefined;
      handle = Object.freeze({ identity: Object.freeze({ runId, projectName: run.projectName, database: "postgres" as const, host: "127.0.0.1" as const, port: run.pgPort, databaseContainerId: serviceResource("db").identity.id }),
        query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
          requireThat(!controlMaintenance, "CONTROL_CONNECTION_MAINTENANCE", "application-query");
          assertOwnedLocalHandle(handle);
          applicationClient.assertHealthy();
          await inspectCaptured(serviceResource("db"));
          try {
            const result = await applicationLease.client.query(sql, params);
            return Array.isArray(result) ? result[result.length - 1] as QueryResult : result;
          } catch (error) { throw asSafeError(error, "application-query"); }
        },
        renewDatabaseControlConnection: async (): Promise<void> => {
          await cliContext.assertOwned();
          requireThat(!controlMaintenance && scopedConnections.size === 0 && !publicJob,
            "CONTROL_CONNECTION_NOT_IDLE", "application-query");
          controlMaintenance = true;
          try {
            const pid = Number((await applicationLease.client.query("select pg_backend_pid() pid")).rows[0].pid);
            const probe = await connect("postgres");
            try {
              const state = (await probe.query("select state from pg_stat_activity where pid=$1", [pid])).rows[0]?.state;
              requireThat(state === "idle", "CONTROL_TRANSACTION_OPEN", "application-query");
            } finally { await probe.end(); }
            await applicationLease.renewIfDue(true, true);
            await cliContext.assertOwned();
            safeRecord("verification-control-lease-boundary", { idleVerified: true, scopedSessions: 0,
              transportLifetimeUnchanged: true, failedTransportRecovered: false });
          } finally { controlMaintenance = false; }
        },
        generateDatabaseTypes: () => generateOwnedDatabaseTypes(cliContext),
        callDataApiRpc: async (name: string, args: Record<string, unknown>): Promise<Response> => {
          await publicContext.assertOwned();
          requireThat(typeof name === "string" && /^[a-z][a-z0-9_]*$/u.test(name)
            && args !== null && typeof args === "object" && !Array.isArray(args),
            "INVALID_DATA_API_RPC", "data-api-rpc");
          const body = JSON.stringify(args);
          requireThat(Buffer.byteLength(body, "utf8") <= 1_000_000, "DATA_API_RPC_BODY_LIMIT", "data-api-rpc");
          const response = await fetch("http://127.0.0.1:" + run.apiPort + "/rest/v1/rpc/" + name, {
            method: "POST", body, headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey,
              "Content-Type": "application/json" }, redirect: "error", signal: AbortSignal.timeout(30_000),
          });
          await publicContext.assertOwned();
          return response;
        },
        readDataApi: async (path: string, headers?: HeadersInit, method: "GET" | "HEAD" = "GET"): Promise<Response> => {
          await publicContext.assertOwned();
          requireThat(method === "GET" || method === "HEAD", "INVALID_DATA_API_METHOD", "data-api-read");
          const origin = "http://127.0.0.1:" + run.apiPort;
          requireThat(typeof path === "string" && path.startsWith("/rest/v1/") && !path.includes("\\"),
            "INVALID_DATA_API_PATH", "data-api-read");
          const target = new URL(path, origin);
          requireThat(target.origin === origin && /^\/rest\/v1\/[a-z][a-z0-9_]*$/u.test(target.pathname)
            && !target.hash, "INVALID_DATA_API_PATH", "data-api-read");
          const safeHeaders = new Headers({ apikey: serviceKey, Authorization: "Bearer " + serviceKey });
          for (const [key, value] of new Headers(headers)) {
            requireThat(["accept", "prefer", "range", "range-unit"].includes(key),
              "INVALID_DATA_API_HEADER", "data-api-read");
            safeHeaders.set(key, value);
          }
          const response = await fetch(target, { method, headers: safeHeaders,
            redirect: "error", signal: AbortSignal.timeout(15_000) });
          await publicContext.assertOwned();
          return response;
        },
        withDatabaseConnection: async <T,>(run: (connection: OwnedDatabaseConnection) => Promise<T>): Promise<T> => {
          await cliContext.assertOwned();
          const client = await connect("postgres");
          scopedConnections.add(client);
          let open = true;
          const observer = observeApplicationClient(client, () => { open = false; });
          const connection: OwnedDatabaseConnection = Object.freeze({
            query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
              requireThat(open, "EXPIRED_DATABASE_CONNECTION", "application-query");
              await cliContext.assertOwned(); observer.assertHealthy();
              try {
                const result = await client.query(sql, params);
                await cliContext.assertOwned(); observer.assertHealthy();
                return Array.isArray(result) ? result[result.length - 1] as QueryResult : result;
              } catch (error) { throw asSafeError(error, "application-query"); }
            },
          });
          try {
            return await observer.run(async () => {
              const result = await run(connection);
              await cliContext.assertOwned(); observer.assertHealthy();
              return result;
            });
          } finally {
            open = false;
            try { await client.end(); } finally { scopedConnections.delete(client); }
          }
        },
        pushApplicationMigrations: async (request: { mode: "dry-run" | "apply"; stage: ApplicationMigrationStage }) => {
          assertOwnedLocalHandle(handle);
          return pushApplicationMigrations(cliContext, request);
        },
        runEntitySeoBackfill: async (request: { mode: "dry-run" | "apply" | "verify"; entities?: readonly ("topics" | "projects" | "pages")[] }) => {
          assertOwnedLocalHandle(handle);
          return runOwnedEntitySeoBackfill(cliContext, request);
        },
        preparePublicVerification: async () => {
          assertOwnedLocalHandle(handle);
          return prepareOwnedPublicVerification(publicContext, handle);
        },
        prepareAdminInteractions: async (request?: { study: "heavy-editor-performance" }) => {
          assertOwnedLocalHandle(handle);
          requireThat(!request || request.study === "heavy-editor-performance", "ADMIN_FIXTURE_STUDY_INVALID", "admin-measurement");
          requireThat(!publicJob, "ADMIN_FIXTURE_DURING_JOB", "admin-measurement");
          const credentials=await prepareOwnedAdminMeasurementAccount(handle);
          if (!privateValues.includes(credentials.secret)) {
            privateValues.push(credentials.secret, credentials.password);
            registerOwnedAdminMeasurement(publicContext, credentials);
          }
          // The repair seam loads only these reviewed local fixture modules.
          // It never accepts executable paths, SQL, callbacks or credentials.
          const fixturePaths=[resolve(ROOT,"scripts/fixtures/admin-interaction-fixtures.mts"),resolve(ROOT,"scripts/fixtures/admin-page-interaction-fixtures.mts")];
          for(const fixturePath of fixturePaths) requireThat(realpathSync(fixturePath)===fixturePath && lstatSync(fixturePath).isFile(),"ADMIN_FIXTURE_SOURCE_INVALID","admin-measurement");
          const fixtureHash=sha256(fixturePaths.map(file=>sha256(readFileSync(file))).join(":"));
          requireThat(!acceptedAdminFixtureHash || acceptedAdminFixtureHash===fixtureHash,"ADMIN_ACCEPTED_FIXTURE_MODEL_CHANGED","admin-measurement");
          safeRecord("admin-fixture-attempt",{fixtureHash,acceptedBefore:Boolean(acceptedAdminFixtureHash)});
          const fixtureOwner=await import(new URL(`../fixtures/admin-interaction-fixtures.mts?fixture=${fixtureHash}`, import.meta.url).href);
          const result=await fixtureOwner.seedOwnedAdminInteractionFixtures(handle,credentials,request ? {
            study: request.study, apiPort: publicContext.apiPort, serviceKey: publicContext.serviceKey,
          } : undefined);
          acceptedAdminFixtureHash=fixtureHash;
          safeRecord("admin-fixture-ready",{fixtureHash});
          return result.fixtures;
        },
        runPublicVerification: async (request: PublicGateRequest) => {
          assertOwnedLocalHandle(handle);
          requireThat(!publicJob, "PUBLIC_JOB_ALREADY_STARTED", "public-verification");
          publicJobAbort = new AbortController();
          let heartbeatActive = true, heartbeatBusy = false;
          let pulse = Promise.resolve();
          let heartbeatFailure: IsolatedSupabaseError | undefined;
          // Only a bounded active gate job retains this existing control lease.
          // A failed pulse aborts owned children. Admin measurement alone renews
          // its healthy control socket proactively; errors never reconnect.
          const timer = setInterval(() => {
            if (!heartbeatActive || heartbeatBusy || heartbeatFailure) return;
            heartbeatBusy = true;
            pulse = (async () => {
              try {
                // This timer has no application transaction or concurrent SQL
                // operation: only this serialized ownership/heartbeat pulse.
                await applicationLease.renewIfDue(request.selection==="admin-interactions" || request.selection==="admin-adoption");
                await publicContext.assertOwned();
                await handle!.query("select 1 as owned_public_job_heartbeat");
                safeRecord("public-job-heartbeat", { active: true });
              } catch (error) {
                heartbeatFailure = asSafeError(error, "public-job-heartbeat");
                publicJobAbort?.abort();
              } finally { heartbeatBusy = false; }
            })();
          }, 20_000);
          publicJob = runOwnedPublicVerification(publicContext, request, publicJobAbort.signal);
          try { const result = await publicJob; if (heartbeatFailure) throw heartbeatFailure; return result; }
          catch(error) {throw heartbeatFailure ?? error;}
          finally { heartbeatActive = false; clearInterval(timer); await pulse;
            if (request.selection === "admin-interactions" || request.selection === "admin-adoption") publicJob = undefined; }
        }, record: safeRecord });
      activeHandles.add(handle);
      const boundHandle = handle;
      await applicationClient.run(() => options.handoff!(boundHandle));
      safeRecord("application-handoff-complete", { completed: true });
    }
    }
  } catch (error) {
    primaryFailure = asSafeError(error, currentStage);
    recordFile("failure.json", { stage: primaryFailure.stage, code: primaryFailure.code, rawErrorRetained: false });
  } finally {
    publicJobAbort?.abort();
    if (publicJob) await publicJob.catch(() => undefined);
    cleaning = true;
    if (handle) activeHandles.delete(handle);
    await Promise.all([...scopedConnections].map(client => client.end().catch(() => undefined)));
    scopedConnections.clear();
    if (appConnection) await appConnection.end().catch(() => undefined);
    if (hostBridge) {
      try {
        await hostBridge.close();
        const snapshot = hostBridge.snapshot(); recordFile("host-access-closed.json", snapshot);
        requireThat(snapshot.listeners.length === 0 && snapshot.active === 0 && snapshot.localProcesses === 0, "HOST_ACCESS_NOT_CLOSED", "cleanup");
      } catch (error) {
        cleanupFailure = asSafeError(error, "host-access-cleanup");
        recordFile("host-access-cleanup-failure.json", { stage: cleanupFailure.stage, code: cleanupFailure.code, snapshot: hostBridge.snapshot() });
      }
    }
    try {
      if (created) {
        // Discovery also handles a create operation that completed after its
        // client timed out. Every discovered resource must pass the same full
        // run/compose/image/mount checks before it can become cleanup-owned.
        for (const [path, expectedHash] of recoveryFiles) requireThat(sha256(readFileSync(path)) === expectedHash,
          "RECOVERY_EVIDENCE_CHANGED", "cleanup");
        if (recoveryAuthorized) assertOriginalsUnchanged(await inventory());
        await discoverOwned();
        for (const item of captured) await inspectCaptured(item);
        for (const item of captured.filter(row => row.identity.kind === "container").reverse()) {
          await inspectCaptured(item);
          await dc(["container", "rm", "--force", item.identity.id], "owned-container-remove");
        }
        for (const item of captured.filter(row => row.identity.kind === "network")) {
          await inspectCaptured(item);
          const network = await inspect("network", item.identity.id);
          requireThat(Object.keys(object(network.containers ?? {})).length === 0, "FOREIGN_NETWORK_MEMBER", "cleanup");
          await dc(["network", "rm", item.identity.id], "owned-network-remove");
        }
        for (const item of captured.filter(row => row.identity.kind === "volume")) {
          await inspectCaptured(item);
          const users = await dc(["container", "ls", "--all", "--filter", `volume=${item.identity.name}`, "--quiet"], "volume-consumers");
          requireThat(!users.stdout.trim(), "FOREIGN_VOLUME_CONSUMER", "cleanup");
          await dc(["volume", "rm", item.identity.id], "owned-volume-remove");
        }
        for (const kind of ["container", "volume", "network"] as const) requireThat((await list(kind, true)).length === 0, "OWNED_RESOURCE_REMAINS", "cleanup");
      }
      removePrivateEnv();
      if (before) {
        const after = await inventory(); assertOriginalsUnchanged(after);
        recordFile("inventory-after.json", inventoryReceipt(after));
      }
      const releasedPorts: number[] = [];
      await releaseRecoveryPorts();
      for (const port of ports) {
        let free = false;
        for (let attempt = 0; attempt < 5 && !free; attempt++) {
          free = await new Promise<boolean>(done => {
            const server = net.createServer(); server.once("error", () => done(false));
            server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => done(true)));
          });
          if (!free) await sleep(500);
        }
        if (!free) recordFile("port-release-failure.json", { port, released: false, foreignProcessTerminationAttempted: false });
        requireThat(free, "OWNED_PORT_NOT_RELEASED", "cleanup"); releasedPorts.push(port);
      }
      recordFile("cleanup.json", { status: cleanupFailure ? "blocked" : "complete", code: cleanupFailure?.code ?? null,
        ownedResourcesRemoved: captured.length, remainingOwnedResources: 0,
        originalResourcesUnchanged: Boolean(before), privateEnvRemoved: !existsSync(privateEnvPath)
          && (!recoveryAuthorized || !existsSync(originalPrivateEnvPath)), hostPortsReleased: releasedPorts, oldImagesRemoved: 0, engineStopped: false });
    } catch (error) {
      cleanupFailure = asSafeError(error, "cleanup");
      recordFile("cleanup.json", { status: "blocked", code: cleanupFailure.code, stage: cleanupFailure.stage, complete: false });
    } finally {
      // A resource-inspection or Docker failure must not retain generated
      // connection secrets in the artifact directory.
      try {
        try { removePrivateEnv(); } finally { await releaseRecoveryPorts(); }
      } catch {
        cleanupFailure ??= new IsolatedSupabaseError("PRIVATE_ENV_REMOVAL_FAILED", "cleanup");
        recordFile("cleanup.json", { status: "blocked", code: cleanupFailure.code, stage: cleanupFailure.stage, complete: false });
      }
    }
    password = ""; secret = "";
    recordFile("result.json", { status: primaryFailure || cleanupFailure ? "needs_attention" : "complete",
      platformReady: events.some(event => event.stage === "platform-ready"), applicationHandoffRequested: Boolean(options.handoff),
      applicationHandoffComplete: events.some(event => event.stage === "application-handoff-complete"), failureInjection: options.failureInjection ?? null,
      failure: primaryFailure ? { code: primaryFailure.code, stage: primaryFailure.stage } : null,
      cleanup: cleanupFailure ? { status: "blocked", code: cleanupFailure.code } : { status: "complete" },
      releaseCommit: RELEASE_COMMIT, runId, retainedProofsReexecuted: false });
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  if (cleanupFailure) throw cleanupFailure;
  if (primaryFailure) throw primaryFailure;
  return { status: "complete", artifactDir };
}
