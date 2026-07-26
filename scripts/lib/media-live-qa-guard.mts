import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const MEDIA_QA_MUTATION_OPT_IN = "MEDIA_COORDINATION_DISPOSABLE_QA";
export const MEDIA_QA_BROWSER_OPT_IN = "MEDIA_RECOVERY_AUTHENTICATED_BROWSER_QA";
export const MEDIA_QA_CLEANUP_ACK = "SAFE_DELETE_OR_RECORDED_RECOVERY";

// This project reference is the currently connected, provenance-audited
// environment. It has not been accepted as disposable Development/QA and is
// therefore denied independently of any self-declared authority file.
const DENIED_MEDIA_QA_PROJECT_REFS = new Set(["pmqsfqvvekrlujqgurcu"]);

// Positive, repository-reviewed allowlist. It intentionally remains empty
// until a dedicated disposable Development/QA Supabase project is approved in
// Git. An external expiring authority record is necessary but cannot add a
// project to this list by itself.
const REVIEWED_MEDIA_QA_PROJECT_REFS = new Set<string>([]);

type AuthorityClassification = "development" | "qa";
type RuntimeEnvironment = "local" | "preview";

export type MediaQaAuthority = {
  schemaVersion: 1;
  approvalId: string;
  approvedBy: string;
  evidence: string;
  classification: AuthorityClassification;
  runtimeEnvironment: RuntimeEnvironment;
  writable: true;
  production: false;
  projectRef: string;
  supabaseUrl: string;
  appBaseUrl: string;
  environmentKey: string;
  provider: "supabase";
  imageBucket: string;
  providerRegistryVersion: string;
  fixturePrefix: string;
  expiresAt: string;
};

export type MediaQaGuard = {
  authority: MediaQaAuthority;
  fixtureNamespace: string;
  authorityFile: string;
};

export function guardRefusal(message: string): never {
  process.stderr.write(`GUARD_REFUSAL: ${message}\n`);
  process.exit(2);
}

export function parseNamedArguments(argv: string[]) {
  const values = new Map<string, string>();
  for (const argument of argv) {
    const match = argument.match(/^--([a-z0-9-]+)=(.*)$/i);
    if (!match) guardRefusal(`Every argument must use --name=value syntax; received ${argument}.`);
    if (values.has(match[1])) guardRefusal(`Duplicate argument --${match[1]}.`);
    values.set(match[1], match[2]);
  }
  return values;
}

export function assertOnlyArguments(values: Map<string, string>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  for (const key of values.keys()) {
    if (!allowedSet.has(key)) guardRefusal(`Unknown argument --${key}.`);
  }
}

export function requiredArgument(values: Map<string, string>, name: string) {
  const value = values.get(name)?.trim();
  if (!value) guardRefusal(`Missing required --${name}=... argument.`);
  return value;
}

function isInside(parent: string, candidate: string) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  return pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent));
}

function readAuthority(path: string): MediaQaAuthority {
  if (!isAbsolute(path)) guardRefusal("The Environment Authority file path must be absolute.");
  if (!existsSync(path)) guardRefusal(`Environment Authority file does not exist: ${path}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    guardRefusal("The Environment Authority file must contain valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    guardRefusal("The Environment Authority record must be a JSON object.");
  }
  return parsed as MediaQaAuthority;
}

function validateAuthority(authority: MediaQaAuthority) {
  if (authority.schemaVersion !== 1) guardRefusal("Unsupported Environment Authority schemaVersion.");
  if (authority.classification !== "development" && authority.classification !== "qa") {
    guardRefusal("Environment classification must be development or qa.");
  }
  if (authority.runtimeEnvironment !== "local" && authority.runtimeEnvironment !== "preview") {
    guardRefusal("Runtime environment must be local or preview; Production is never accepted.");
  }
  if (authority.production !== false || authority.writable !== true) {
    guardRefusal("Authority must explicitly prove production=false and writable=true.");
  }
  if (authority.provider !== "supabase") guardRefusal("Only the approved Supabase provider is supported.");
  if (DENIED_MEDIA_QA_PROJECT_REFS.has(authority.projectRef)) {
    guardRefusal("The connected project reference is explicitly denied for destructive QA because its Development/QA authority is unproven.");
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(authority.imageBucket)) {
    guardRefusal("Authority imageBucket is invalid.");
  }
  for (const [key, value] of Object.entries({
    approvalId: authority.approvalId,
    approvedBy: authority.approvedBy,
    evidence: authority.evidence,
    providerRegistryVersion: authority.providerRegistryVersion,
  })) {
    if (typeof value !== "string" || !value.trim() || /replace-with/i.test(value)) {
      guardRefusal(`Authority field ${key} must contain reviewed, non-placeholder evidence.`);
    }
  }
  if (!/^https:\/\//i.test(authority.evidence)) {
    guardRefusal("Authority evidence must be an HTTPS review or environment-authority record.");
  }
  if (!/^[a-z0-9]{20}$/.test(authority.projectRef)) {
    guardRefusal("Authority projectRef is not a valid Supabase project reference.");
  }
  const expectedEnvironmentKey = `${authority.runtimeEnvironment}:supabase:${authority.projectRef}`;
  if (authority.environmentKey !== expectedEnvironmentKey) {
    guardRefusal(`Authority environmentKey must equal ${expectedEnvironmentKey}.`);
  }
  if (!/^[a-z0-9][a-z0-9-]{5,48}$/.test(authority.fixturePrefix)) {
    guardRefusal("Authority fixturePrefix is invalid.");
  }

  let supabaseUrl: URL;
  let appUrl: URL;
  try {
    supabaseUrl = new URL(authority.supabaseUrl);
    appUrl = new URL(authority.appBaseUrl);
  } catch {
    guardRefusal("Authority URLs must be absolute URLs.");
  }
  if (
    supabaseUrl.protocol !== "https:"
    || supabaseUrl.hostname !== `${authority.projectRef}.supabase.co`
    || supabaseUrl.pathname !== "/"
  ) {
    guardRefusal("Authority supabaseUrl must exactly identify the approved project reference.");
  }
  const loopback = appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1";
  if (appUrl.protocol !== "https:" && !(loopback && appUrl.protocol === "http:")) {
    guardRefusal("Authority appBaseUrl must be HTTPS, except explicit loopback Development QA.");
  }
  if (authority.runtimeEnvironment === "local" && !loopback) {
    guardRefusal("A local runtime authority must target a loopback app URL.");
  }
  if (/(^|[.-])(prod|production|www)([.-]|$)/i.test(appUrl.hostname)) {
    guardRefusal("The app host resembles Production and is denied even if the authority says otherwise.");
  }
  if (!REVIEWED_MEDIA_QA_PROJECT_REFS.has(authority.projectRef)) {
    guardRefusal("The project reference is not present in the repository-reviewed disposable QA allowlist.");
  }

  const expiresAt = Date.parse(authority.expiresAt);
  const remaining = expiresAt - Date.now();
  if (!Number.isFinite(expiresAt) || remaining <= 0) guardRefusal("Environment Authority has expired.");
  if (remaining > 24 * 60 * 60 * 1000) {
    guardRefusal("Environment Authority expiry must be no more than 24 hours in the future.");
  }
}

export function establishMediaQaGuard(input: {
  values: Map<string, string>;
  optInArgument: "allow-live-qa" | "allow-browser-qa";
  expectedOptIn: string;
  repositoryRoot: string;
}): MediaQaGuard {
  const optIn = requiredArgument(input.values, input.optInArgument);
  if (optIn !== input.expectedOptIn) {
    guardRefusal(`--${input.optInArgument} must exactly equal ${input.expectedOptIn}.`);
  }
  if (requiredArgument(input.values, "confirm-cleanup-plan") !== MEDIA_QA_CLEANUP_ACK) {
    guardRefusal(`--confirm-cleanup-plan must exactly equal ${MEDIA_QA_CLEANUP_ACK}.`);
  }

  const authorityFile = requiredArgument(input.values, "authority-file");
  const authority = readAuthority(authorityFile);
  validateAuthority(authority);

  const expectedClassification = requiredArgument(input.values, "expected-environment");
  const expectedRuntime = requiredArgument(input.values, "expected-runtime-environment");
  const expectedProjectRef = requiredArgument(input.values, "expected-project-ref");
  const expectedEnvironmentKey = requiredArgument(input.values, "expected-environment-key");
  const expectedRegistry = requiredArgument(input.values, "expected-provider-registry-version");
  const expectedImageBucket = requiredArgument(input.values, "expected-image-bucket");
  if (
    expectedClassification !== authority.classification
    || expectedRuntime !== authority.runtimeEnvironment
    || expectedProjectRef !== authority.projectRef
    || expectedEnvironmentKey !== authority.environmentKey
    || expectedRegistry !== authority.providerRegistryVersion
    || expectedImageBucket !== authority.imageBucket
  ) {
    guardRefusal("CLI expectations do not exactly match the Environment Authority record.");
  }

  const fixtureNamespace = requiredArgument(input.values, "fixture-namespace");
  const namespacePattern = new RegExp(`^${authority.fixturePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[a-z0-9][a-z0-9-]{7,63}$`);
  if (!namespacePattern.test(fixtureNamespace)) {
    guardRefusal(`Fixture namespace must be unique and begin with ${authority.fixturePrefix}-.`);
  }
  if (isInside(input.repositoryRoot, authorityFile)) {
    guardRefusal("The expiring Environment Authority file must remain outside the repository.");
  }

  return { authority, fixtureNamespace, authorityFile };
}

export function assertExternalAuthenticationState(repositoryRoot: string, path: string) {
  if (!isAbsolute(path) || !existsSync(path)) {
    guardRefusal("--auth-state must point to an existing absolute Playwright storage-state file.");
  }
  if (isInside(repositoryRoot, path)) {
    guardRefusal("Authenticated browser state is secret material and must remain outside the repository.");
  }
  return path;
}
