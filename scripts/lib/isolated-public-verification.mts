import { createCoreDownloadPdfFixture, CORE_DOWNLOAD_MEDIA_KEY } from "../fixtures/admin-core-download-media-adoption.mjs";
import { CORE_PREVIEW_PUBLIC_IMPACT_SELECTION, validateCorePreviewPublicImpactSelection } from "../fixtures/admin-core-preview-journeys.mjs";
import { validateCoreJourneySelection } from "../fixtures/admin-core-domain-form-journeys.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync, type Stats } from "node:fs";
import * as asyncFs from "node:fs/promises";
import * as nodeModule from "node:module";
import net from "node:net";
import { Worker } from "node:worker_threads";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEntitySeoPersistenceOwner } from "../backfill-entity-seo-scores.mts";
import { selectSourceInventory, sourceIncluded } from "./verification-source-inventory.mts";
import { collectExecutableSourceGraph } from "./typescript-executable-graph.mts";
import { spawnWindowsOwnedProcess, windowsOwnedProcessCapability, type WindowsJobIdentity, type WindowsJobReceipt, type WindowsStopReason } from "./windows-owned-process.mts";
import type { TopicSeoSource } from "../../src/lib/admin/seo/entity-seo-persistence.ts";
import type { OwnedLocalHandle } from "./isolated-supabase.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const FIXTURE_SLUG = "isolated-public-property-ownership";
const FIXTURE_CATEGORY = "isolated-public-articles";
const FIXTURE_DATE = "2026-01-01T00:00:00.000Z";
const GATES = [
  { name: "normal-build", module: "next/dist/bin/next", args: ["build"], limitMs: 900_000 },
  { name: "product-surface-build", script: "scripts/verify-product-surface-identity.mts", args: ["--build"], limitMs: 180_000 },
  { name: "platform-contracts", script: "scripts/verify-platform.mts", args: ["--contracts-only"], limitMs: 180_000 },
  { name: "public-e2e", module: "playwright/cli.js", args: ["test", "tests/e2e/public-foundation.spec.ts", "tests/e2e/topic-view-integrity.spec.ts", "--workers=1", "--retries=0"], limitMs: 600_000 },
] as const;

/** The existing owned Admin tail; selection validation and execution share it. */
export function adminAdoptionGate(request: PublicGateRequest) {
  const adoption = request.selection === "admin-adoption";
  assert.ok(request.adoptionScope === undefined || (adoption && request.adoptionScope === "core-closure"), "Unknown fixed adoption scope.");
  assert.ok(request.adoptionCohort === undefined || (request.adoptionScope === "core-closure" && ["preview-recovery-templates", "domain-forms", "domain-commands", "page-composition", "template-libraries", "readonly-hubs", "recovery-templates", "specialized-settings", "media-library", "template-bulk", "navigation-settings", "auth-entry", "media-recovery", "query-presentation", "template-controls", "domain-bulk", "topic-controls", "project-controls", "presentation-controls"].includes(request.adoptionCohort)), "Unknown Core cohort.");
  if (request.adoptionJourneySelection === CORE_PREVIEW_PUBLIC_IMPACT_SELECTION) validateCorePreviewPublicImpactSelection({ scope: request.adoptionScope, cohort: request.adoptionCohort, selection: request.adoptionJourneySelection });
  else validateCoreJourneySelection({ scope: request.adoptionScope, cohort: request.adoptionCohort, selection: request.adoptionJourneySelection });
  if (request.adoptionJourneySelection !== undefined) assert.equal(request.selection, "admin-adoption");
  if (!adoption) return undefined;
  assert.equal(request.retainedAdminBehaviorAdmissionSha256, undefined, "Retained admission cannot execute the Admin adoption tail.");
  assert.equal(request.adminMeasurement, undefined, "Measurement cannot execute the Admin adoption tail.");
  return { name: "admin-adoption" as const, script: "scripts/qa-admin-adoption-journeys.mjs" as const,
    args: request.adoptionScope === "core-closure" ? ["--core-closure", ...(request.adoptionCohort ? ["--core-cohort=" + request.adoptionCohort] : []), ...(request.adoptionJourneySelection ? ["--core-journey-selection=" + request.adoptionJourneySelection] : [])] : [],
    limitMs: request.adoptionCohort === "media-recovery" ? 1_200_000 : (request.adoptionCohort === "domain-commands" || request.adoptionCohort === "query-presentation") ? 1_800_000 : 900_000 };
}

/** Only the complete fresh, unscoped tail proves this batch's driver inputs. */
function localVerificationNativeGate(request?: PublicGateRequest) {
  const gate = request ? adminAdoptionGate(request) : undefined;
  return request?.finalQualityGate === true && request.adoptionScope === undefined && request.adoptionCohort === undefined &&
    request.adoptionJourneySelection === undefined ? gate : undefined;
}

/** Derive coverage from the one package owner; reject shell or tail drift. */
export function finalQualityScriptNames(scripts: Readonly<Record<string, string>>) {
  assert.equal(typeof scripts["ci:check"], "string");
  const names = scripts["ci:check"].split(/\s*&&\s*/u).map(step => {
    const match = /^npm run ([a-zA-Z0-9:_-]+)$/u.exec(step);
    assert.ok(match && Object.hasOwn(scripts, match[1]), "Unrecognized ci:check step; update the canonical gate contract explicitly.");
    return match[1];
  });
  const tail: string[] = GATES.map(gate => {
    const script = gate.name === "normal-build" ? "build" : gate.name === "product-surface-build" ? "verify:product-surface-identity-build" : gate.name === "platform-contracts" ? "verify:platform-contracts" : "test:e2e:public";
    const command = "script" in gate ? ["node", "--experimental-strip-types", gate.script, ...gate.args].join(" ")
      : [gate.name === "normal-build" ? "next" : "playwright", ...gate.args.filter(arg => !/^--(?:workers|retries)=/u.test(arg))].join(" ");
    assert.equal(scripts[script], command, "ci:check tail differs from the existing canonical Public gates.");
    return script;
  });
  assert.deepEqual(names.slice(-tail.length), tail, "ci:check must end with the existing build and Public gates.");
  const prefix = names.slice(0, -tail.length);
  assert.ok(prefix.length > 0 && !prefix.some(name => tail.includes(name) || name === "ci:check"), "Build/Public gates must execute exactly once.");
  return prefix;
}

export type LocalVerificationChange = {
  file: string; beforeSha256: string | null; afterSha256: string | null;
  risk: "A" | "B" | "C" | "D" | "E";
  owner: string; reviewedBy: string; rationale: string;
  bounded: boolean; nonImportImpactReviewed: boolean;
  contracts: readonly string[]; consumers: readonly string[]; checks: readonly string[];
  /** Existing named checks freshly executed in this plan, never retained PASS artifact paths. */
  adoption?: { applicabilityEvidence: string; sourceProofEvidence: string; consumerEvidence: string };
};
export type LocalVerificationInputs = {
  baselineHead: string; finalHead: string; sourceSha256: string;
  changes: readonly Pick<LocalVerificationChange, "file" | "beforeSha256" | "afterSha256">[];
  verificationCoverage?: readonly { file: string; checks: readonly string[] }[];
  verificationNativeGate?: NonNullable<ReturnType<typeof adminAdoptionGate>>;
  /** Derived from the actual before/current sources. Discovery never confers behavioral PASS. */
  changeImpact?: LocalVerificationSourceImpact;
  admissionQualification?: LocalVerificationAdmissionQualification;
};

/** An invocation receipt, not a reusable approval file or a second check registry. */
export type LocalVerificationAdmissionQualification = {
  schema: 1; kind: "owned-admission-qualification"; nonce: string; status: "PASS" | "BLOCKED";
  baselineHead: string; finalHead: string; sourceSha256: string;
  runtime: unknown; executions: readonly { entry: string; args: readonly string[]; result: unknown }[];
  assertions: ReturnType<typeof validateLocalVerificationAssertionRelocations> | null;
  inputs: ReturnType<typeof validateLocalVerificationInputObservations> | null;
  artifacts: readonly { path: string; sha256: string }[]; failures: readonly string[];
  runDirectory: string; durationMs: number; behavioralPass: false; releaseEvidence: false;
  /** Explicit temporary PR #229 operating budget, sealed with this live invocation. */
  operationalBudget?: LocalVerificationOperationalBudget;
};
// Only this owner's completed, live invocation can grant admission. JSON, even with
// a correct hash or nonce copied from a former run, cannot recreate this authority.
const localVerificationAdmissionInvocations = new WeakMap<LocalVerificationAdmissionQualification,
  { sha256: string; snapshot: () => { finalHead: string; sourceSha256: string; runtime: unknown };
    sourceFloor: Awaited<ReturnType<typeof runLocalVerificationSourceFloor>>; sourceFloorSha256: string;
    sourceDiscoverySha256: string;
    sourceDiscovery: { baselineHead: string; finalHead: string; sourceSha256: string; additionalSourceFiles: readonly string[];
      changes: LocalVerificationInputs["changes"]; changeImpact: LocalVerificationSourceImpact } }>();

/** Raw facts from the existing verifier; only this owner can qualify them. */
export type LocalVerificationInputObservations = {
  schema: 1; kind: "verification-input-observations"; nonce: string; entry: string; executionScope: "affected_input_controls";
  sources: readonly { file: string; sha256: string }[];
  sourceWitnesses: readonly Record<string, unknown>[];
  observations: Record<string, unknown>;
  artifacts: readonly { path: string; sha256: string }[];
};

/** One existing prefix budget, also used by its measured Adoption caller. */
export function localVerificationQualityPrefixDeadlineMs(): number { return 1_800_000; }

export type LocalVerificationOperationalBudget = "pr229-20261103-double-operational";
/** Explicit outer execution allowance, calculated once from the approved original.
 * The legacy selector remains sealed into this PR's invocation. Never apply at the
 * generic process/timer owner or to behavioral readiness, heartbeat, cancellation,
 * preparation or cleanup contracts; whole qualification execution is an outer budget. */
export function localVerificationOperationalDeadlineMs(limitMs: number, budget?: LocalVerificationOperationalBudget): number {
  assert.ok(budget === undefined || budget === "pr229-20261103-double-operational", "Unknown temporary operational budget.");
  assert.ok(Number.isSafeInteger(limitMs) && limitMs > 0 && limitMs <= 2_147_483_647, "Operational deadline must be a finite timer-safe positive integer.");
  const result = limitMs * (budget === undefined ? 1 : 2);
  assert.ok(Number.isSafeInteger(result) && result <= 2_147_483_647, "Expanded operational deadline must be timer-safe.");
  return result;
}

/** One source floor inside the existing execution owner, before any dependent behavioral leaf.
 * A prior floor is private live invocation state, never a serialized receipt or a path-based waiver. */
async function runLocalVerificationSourceFloor(options: {
  operationalBudget?: LocalVerificationOperationalBudget;
  sourceDirectory: string;
  context: Pick<PrivatePublicVerificationContext, "runDirectory" | "sanitize" | "cleanEnvironment">;
  signal: AbortSignal; sources: ReadonlyMap<string, string | Buffer>; changedFiles: readonly string[];
  verifySource: () => void; governance: readonly { step: string; limitMs: number; successMarker?: string }[]; governanceQualified: boolean;
  drainControlPulse?: () => Promise<void>;
  canonical?: { npmCli: string; environment: NodeJS.ProcessEnv; childNames: readonly [string, string]; onStart?: (name: string) => void };
  prior?: { contextSha256: string; sourceSha256: string; syntaxFiles: string[];
    checks: Array<{ stage: string; step: string; limitMs: number; result: Awaited<ReturnType<typeof runOwnedVerificationChild>> }> };
}) {
  // Public preparation owns a live PG socket. Yield between the existing
  // synchronous source units so its existing heartbeat/renewal can settle;
  // draining alone cannot run a timer while this event loop is monopolized.
  const checkpoint = async () => {
    options.signal.throwIfAborted();
    await new Promise<void>(done => setImmediate(done));
    options.signal.throwIfAborted();
    await options.drainControlPulse!();
    options.signal.throwIfAborted();
  };
  if (options.drainControlPulse) await checkpoint();
  options.signal.throwIfAborted(); options.verifySource();
  let environment: NodeJS.ProcessEnv = { NODE_ENV: "test", CI: "1" };
  const clean = options.context.cleanEnvironment();
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"])
    if (clean[key] !== undefined) environment[key] = clean[key];
  if (options.canonical) environment = { ...options.canonical.environment };
  const sourceSha256 = digest(JSON.stringify([...options.sources].map(([file, bytes]) => ({ file, sha256: digest(bytes) }))
    .sort((left, right) => left.file.localeCompare(right.file))));
  const contextSha256 = digest(JSON.stringify({ sourceDirectory: options.sourceDirectory, sourceSha256, environment,
    executable: process.execPath, node: process.version, v8: process.versions.v8, execArgv: process.execArgv }));
  const scripts = JSON.parse(options.sources.get("package.json")!.toString()).scripts as Record<string, string>;
  assert.equal(scripts.lint, "eslint --max-warnings=0", "Ordered source floor requires the canonical lint command.");
  assert.equal(scripts.typecheck, "tsc --noEmit", "Ordered source floor requires the canonical TypeScript command.");
  const syntaxFiles = [...new Set((options.changedFiles.length ? options.changedFiles : [...options.sources.keys()])
    .filter(file => /\.[cm]?[jt]sx?$/u.test(file) && options.sources.has(file)))].sort();
  const checks: Array<{ stage: string; step: string; limitMs: number; result: Awaited<ReturnType<typeof runOwnedVerificationChild>> }> = [];
  const prior = options.prior?.contextSha256 === contextSha256 && options.prior.sourceSha256 === sourceSha256 ? options.prior : undefined;
  for (const file of syntaxFiles) {
    if (options.drainControlPulse) await checkpoint();
    options.signal.throwIfAborted(); options.verifySource();
    const parsed = ts.createSourceFile(file, options.sources.get(file)!.toString(), ts.ScriptTarget.Latest, false,
      /\.[cm]?tsx?$/u.test(file) ? (/\.tsx$/u.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : /\.jsx$/u.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.JS);
    const diagnostics = (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
    assert.equal(diagnostics.length, 0, "Ordered Syntax check failed: " + file + "; diagnostic=" + (diagnostics[0]?.code ?? "none"));
  }
  receipt(options.context, "ordered-source-syntax.json", { status: "PASS", sourceSha256, syntaxFiles,
    fallback: options.changedFiles.length ? "affected_source" : "complete_source_without_affected_qualification", behaviorExecuted: false });
  const children = new Set<ChildProcess>(), seen = new Set<string>();
  let firstFailure: unknown;
  const run = async (stage: string, step: string, args: string[], limitMs: number) => {
    limitMs = localVerificationOperationalDeadlineMs(limitMs, options.operationalBudget);
    if (options.drainControlPulse) await checkpoint();
    options.signal.throwIfAborted(); options.verifySource();
    if (seen.has(step)) {
      assert.equal(checks.find(check => check.step === step)?.limitMs, limitMs, "Duplicate leaf has an ambiguous deadline.");
      return;
    }
    seen.add(step);
    const retained = prior?.checks.find(check => check.step === step && check.limitMs === limitMs);
    let result: Awaited<ReturnType<typeof runOwnedVerificationChild>>;
    if (retained) result = retained.result;
    else {
      const name = options.canonical && checks.length < 2 ? options.canonical.childNames[checks.length]! : "ordered-" + (checks.length + 1) + "-" + stage;
      options.canonical?.onStart?.(name);
      result = await runOwnedVerificationChild({ sourceDirectory: options.sourceDirectory, context: options.context, children, signal: options.signal },
        args, environment, name, limitMs);
    }
    checks.push({ stage, step, limitMs, result });
    receipt(options.context, "ordered-source-" + checks.length + ".json", { stage, step, sourceSha256, contextSha256,
      sameLiveContextReused: Boolean(retained), result });
    if (result.code !== 0 || result.rawExit.code !== 0 || result.rawExit.signal !== null || result.cleanup.status !== "PASS"
      || result.cleanup.liveProcesses !== 0 || !result.cleanup.processTreeVerified) {
      const failure = new Error("Ordered " + stage + " check failed; dependent verification was not started.");
      Object.defineProperty(failure, "childResult", { value: result }); throw failure;
    }
    if (options.drainControlPulse) await checkpoint();
    options.signal.throwIfAborted(); options.verifySource();
  };
  try {
    await run("eslint", options.canonical ? "npm run lint" : "eslint --max-warnings=0", options.canonical
      ? [options.canonical.npmCli, "run", "lint"] : [join(options.sourceDirectory, "node_modules/eslint/bin/eslint.js"), "--max-warnings=0"], localVerificationQualityPrefixDeadlineMs());
    await run("typescript", options.canonical ? "npm run typecheck" : "tsc --noEmit", options.canonical
      ? [options.canonical.npmCli, "run", "typecheck"] : [join(options.sourceDirectory, "node_modules/typescript/bin/tsc"), "--noEmit"], localVerificationQualityPrefixDeadlineMs());
    assert.equal(options.governanceQualified, true, "Affected Governance / Contracts lack qualified execution; conservative Full Gate fallback remains required.");
    for (const target of options.governance) {
      assert.ok(/^node (?:--experimental-strip-types )?[a-zA-Z0-9_./-]+\.(?:mjs|mts|js|ts)(?: [a-zA-Z0-9_./:=+,-]+)*$/u.test(target.step),
        "Ordered Governance requires an existing qualified literal Node leaf.");
      await run("governance", target.step, target.step.split(" ").slice(1), target.limitMs);
      if (target.successMarker !== undefined) assert.equal(checks.find(check => check.step === target.step)!.result.stdout.includes(target.successMarker), true,
        "Qualified Governance leaf lacks its original success marker.");
    }
  } catch (error) {
    firstFailure = error;
    try { receipt(options.context, "ordered-source-floor-failure.json", { status: "BLOCKED", sourceSha256, contextSha256,
      completed: checks.map(check => ({ stage: check.stage, step: check.step, code: check.result.code })),
      childResult: error instanceof Error && "childResult" in error ? error.childResult : null, dependentVerificationStarted: false }); }
    catch { /* preserve the original source check failure */ }
    throw error;
  }
  finally {
    const cleanup = await Promise.allSettled([...children].map(async child => { await stopChild(child, options.context.cleanEnvironment(), "owner_shutdown"); children.delete(child); }));
    const failed = cleanup.find(result => result.status === "rejected");
    if (failed?.status === "rejected") {
      if (firstFailure !== undefined) {
        if (firstFailure instanceof Error && Object.isExtensible(firstFailure) && !Object.hasOwn(firstFailure, "sourceFloorCleanupFailure"))
          Object.defineProperty(firstFailure, "sourceFloorCleanupFailure", { value: failed.reason });
      } else throw failed.reason;
    }
  }
  return { contextSha256, sourceSha256, syntaxFiles, checks };
}
export type LocalVerificationSourceImpact = {
  proofBoundary: "source_discovery_only";
  sourceSha256: string; deltaSha256: string;
  ownerBindings?: readonly { owner: string; capability?: string; files: readonly string[]; manifest: string }[];
  assertionRelocationDemand?: ReturnType<typeof localVerificationAssertionRelocationRequired>;
  changes: readonly { file: string; owners: readonly string[]; capabilities: readonly string[]; consumers: readonly string[];
    contracts: readonly string[]; candidateChecks: readonly string[]; unresolved: readonly string[];
    semanticChange: boolean; presentationOnly: boolean }[];
  obligations: readonly { file: string; owner: string; contract: string; before: string | null; after: string | null; addedCapabilityAxis: boolean }[];
  protections: readonly { file: string; check: string; beforeSha256: string | null; afterSha256: string;
    semanticChange: boolean; assertionChanges: readonly { sha256: string; references: readonly string[]; contracts: readonly string[] }[];
    references: readonly string[]; dynamicCapabilityAxes: boolean }[];
  /** Conservative AST regressions only; this does not establish complete behavioral assertion equivalence. */
  qaQuality?: readonly { file: string; assertionsBefore: number; assertionsAfter: number; failures: readonly string[];
    rawFailures?: readonly string[]; qualifiedRelocation?: unknown }[];
};
export type LocalVerificationProtectionMaintenance = {
  file: string; contract: string; protectionFile: string; check: string;
  beforeSha256: string | null; afterSha256: string;
  mode: "updated" | "existing_dynamic_axes"; reviewedBy: string; rationale: string;
  /** Exact changed assertion/vector dependency fingerprint reviewed for this obligation. */
  assertionSha256?: string;
};
/** A reviewed batch evidence record, not an owner/dependency/test registry. */
export type LocalVerificationImpact = Omit<LocalVerificationInputs, "changes" | "verificationCoverage" | "changeImpact" | "admissionQualification"> & {
  changes: readonly LocalVerificationChange[];
  verificationEntries?: readonly { check: string; entry: string }[];
  protectionMaintenance?: readonly LocalVerificationProtectionMaintenance[];
};

/** AST projection only: contract bodies remain authoritative; narrative evidence is not a contract edit. */
export function localVerificationSemanticSource(file: string, source: string) {
  const narrativeMetadata = file === "src/lib/admin/interaction-system/adoption-manifest.ts" || file === "src/lib/admin/form-system/adoption-manifest.ts";
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  assert.deepEqual((tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics, [],
    "Cannot classify malformed verification impact source: " + file);
  const transformed = ts.transform(tree, [context => {
    const visit: ts.Visitor = node => {
      if (narrativeMetadata && ts.isPropertyAssignment(node) && node.name.getText(tree).replace(/^["']|["']$/gu, "") === "rationale"
        && ts.isStringLiteralLike(node.initializer)) return context.factory.updatePropertyAssignment(node, node.name,
          context.factory.createStringLiteral(node.initializer.text.trim() ? "nonempty narrative" : ""));
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit) as ts.SourceFile;
  }]);
  try { return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]); }
  finally { transformed.dispose(); }
}

/** Literal spacing/radius presentation only; all other AST nodes and class tokens remain binding. */
export function localVerificationPresentationSource(file: string, source: string) {
  const tree = ts.createSourceFile(file, localVerificationSemanticSource(file, source), ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
  const transformed = ts.transform(tree, [context => {
    const visit: ts.Visitor = node => {
      if (ts.isJsxAttribute(node) && node.name.getText(tree) === "className") {
        const literal = node.initializer && (ts.isStringLiteralLike(node.initializer) ? node.initializer
          : ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isStringLiteralLike(node.initializer.expression) ? node.initializer.expression : undefined);
        if (literal) {
          const tokens = literal.text.split(/\s+/u).map(token => token
            .replace(/^((?:[a-z0-9-]+:)*)(p[trblxyse]?)-(?:\d+(?:\.\d+)?|px)$/u, "$1$2-PRESENTATION")
            .replace(/^((?:[a-z0-9-]+:)*)(rounded(?:-[trblse]{1,2})?)(?:-(?:none|sm|md|lg|xl|[23]xl|full))?$/u, "$1$2-PRESENTATION"));
          return context.factory.updateJsxAttribute(node, node.name, context.factory.createStringLiteral(tokens.join(" ")));
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit) as ts.SourceFile;
  }]);
  try { return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]); }
  finally { transformed.dispose(); }
}

/** Source-derived execution demand; this coarse detector never grants relocation authority. */
export function localVerificationAssertionRelocationRequired(input: {
  baselineSources: ReadonlyMap<string, string | Buffer>;
  currentSources: ReadonlyMap<string, string | Buffer>;
}) {
  const files = new Set<string>(), providers = new Set<string>();
  const parse = (file: string, value: string) => ts.createSourceFile(file, value, ts.ScriptTarget.Latest, true, /x$/u.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const normalized = (file: string, value: string) => ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(parse(file, value));
  const observedAdapter = (file: string, value: string | undefined) => {
    if (!value?.includes("nativeAssert")) return false;
    const tree = parse(file, value); let found = false;
    const visit = (node: ts.Node) => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Proxy"
        && node.arguments?.[0] && ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === "nativeAssert") found = true;
      ts.forEachChild(node, visit);
    }; visit(tree); return found;
  };
  const observedProviders = new Set<string>(), changedProviders = new Set<string>();
  for (const file of new Set([...input.baselineSources.keys(), ...input.currentSources.keys()])) {
    const previous = input.baselineSources.get(file)?.toString(), current = input.currentSources.get(file)?.toString();
    if (!(observedAdapter(file, previous) || observedAdapter(file, current))) continue;
    observedProviders.add(file);
    if (previous === undefined || current === undefined || normalized(file, previous) !== normalized(file, current)) {
      changedProviders.add(file); providers.add(file); files.add(file);
    }
  }
  const assertions = (tree: ts.SourceFile) => {
    const scopes = new Map<string, { total: number; comparisons: number; shapes: string[] }>();
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && /^(?:assert(?:\.[A-Za-z]+)?|expect(?:\.[A-Za-z]+)?)$/u.test(node.expression.getText(tree))) {
        const names: string[] = [];
        for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionDeclaration(parent) && parent.name) names.unshift(parent.name.text);
        const scope = names.join("/"), value = scopes.get(scope) ?? { total: 0, comparisons: 0, shapes: [] };
        value.total += 1;
        if (/^assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual|notEqual|notStrictEqual|notDeepEqual|notDeepStrictEqual)$/u.test(node.expression.getText(tree))) value.comparisons += 1;
        value.shapes.push(node.getText(tree)); scopes.set(scope, value);
      } ts.forEachChild(node, visit);
    }; visit(tree); return scopes;
  };
  for (const [file, before] of input.baselineSources) {
    const current = input.currentSources.get(file);
    if (!current || !/^(?:scripts|tests)\/.+\.[cm]?[jt]sx?$/u.test(file)) continue;
    const oldTree = parse(file, before.toString()), nextTree = parse(file, current.toString()), previous = assertions(oldTree), next = assertions(nextTree);
    const consumerChanged = normalized(file, before.toString()) !== normalized(file, current.toString());
    if ([...previous].some(([scope, value]) => (next.get(scope)?.total ?? 0) < value.total || (next.get(scope)?.comparisons ?? 0) < value.comparisons)) files.add(file);
    const delegates = new Set<string>();
    const delegatedProviders = new Set<string>();
    for (const tree of [oldTree, nextTree]) for (const statement of tree.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.moduleSpecifier.text.startsWith(".") && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      const base = resolve(ROOT, dirname(file), statement.moduleSpecifier.text).slice(ROOT.length + 1).replaceAll("\\", "/");
      const target = [base, base + ".mts", base + ".ts", base + ".tsx"].find(candidate => observedProviders.has(candidate));
      if (target) {
        delegatedProviders.add(target);
        for (const element of statement.importClause.namedBindings.elements) if (!element.isTypeOnly) delegates.add(element.name.text);
      }
    }
    if (delegates.size) {
      let invoked = false;
      const visit = (node: ts.Node, tree: ts.SourceFile) => { if (ts.isCallExpression(node) && delegates.has(node.expression.getText(tree))) invoked = true; ts.forEachChild(node, child => visit(child, tree)); }; visit(oldTree, oldTree); visit(nextTree, nextTree);
      if (invoked && (consumerChanged || [...delegatedProviders].some(provider => changedProviders.has(provider)))) { files.add(file); for (const provider of delegatedProviders) providers.add(provider); }
    }
  }
  return { required: files.size > 0, files: [...files].sort(), providers: [...providers].sort() };
}

/** Finite source correspondence plus actual native assertion observations. Unsupported source stays blocked. */
export function validateLocalVerificationAssertionRelocations(input: {
  baselineSources: ReadonlyMap<string, string | Buffer>;
  currentSources: ReadonlyMap<string, string | Buffer>;
  observations: readonly unknown[];
}) {
  type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value };
  type Environment = Map<string, Value>;
  type Predicate = { operator: string; actual: Value; expected: Value; case: Value };
  const failures: Array<{ file: string; scope: string; reason: string }> = [];
  const obligations: Array<{ file: string; scope: string; site: number; predicate: string; cases: number }> = [];
  const relocations: Array<{ file: string; scope: string; before: number; after: number; matched: number; beforeFingerprint: string; afterFingerprint: string }> = [];
  const providerProofs = new Map<string, { file: string; sourceSha256: string; consumers: string[]; assertionSites: number }>();
  const demand: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
  const record = (value: unknown): Record<string, unknown> => { demand(value !== null && typeof value === "object" && !Array.isArray(value), "Expected bounded observation object"); return value as Record<string, unknown>; };
  const stable = (value: unknown): string => JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === undefined) return { $undefined: true };
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) return Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)));
    return entry;
  });
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const source = (map: ReadonlyMap<string, string | Buffer>, file: string) => { const value = map.get(file); demand(value !== undefined, "Missing source closure member: " + file); return value.toString(); };
  const parse = (file: string, value: string) => ts.createSourceFile(file, value, ts.ScriptTarget.Latest, true, /x$/u.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const observedAdapter = (tree: ts.SourceFile) => {
    let found = false;
    const visit = (node: ts.Node) => { if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Proxy"
      && node.arguments?.[0] && ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === "nativeAssert") found = true; ts.forEachChild(node, visit); };
    visit(tree); return found;
  };
  const key = (node: ts.Node, tree: ts.SourceFile) => {
    const project = (part: ts.Node): unknown => {
      if (ts.isParenthesizedExpression(part)) return project(part.expression);
      if (ts.isIdentifier(part) || ts.isPrivateIdentifier(part) || ts.isStringLiteralLike(part) || ts.isNumericLiteral(part)
        || ts.isBigIntLiteral(part) || ts.isRegularExpressionLiteral(part) || ts.isTemplateHead(part)
        || ts.isTemplateMiddle(part) || ts.isTemplateTail(part) || ts.isJsxText(part)) return [part.kind, part.text];
      const children: unknown[] = []; ts.forEachChild(part, child => { children.push(project(child)); });
      const flags = ts.isVariableDeclarationList(part) ? part.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)
        : ts.isPrefixUnaryExpression(part) || ts.isPostfixUnaryExpression(part) ? part.operator : null;
      return [part.kind, flags, children];
    };
    // Parsing, rather than a context-free scanner, identifies template tails and
    // regex literals. Literal values remain exact; only trivia is excluded.
    demand(node.getSourceFile() === tree, "Predicate node belongs to another source closure");
    return stable(project(node));
  };
  const namedScope = (node: ts.Node) => { const names: string[] = []; for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionDeclaration(parent) && parent.name) names.unshift(parent.name.text); return names.join("/"); };
  const calls = (tree: ts.SourceFile) => {
    const result: ts.CallExpression[] = [];
    const visit = (node: ts.Node) => { if (ts.isCallExpression(node) && /^(?:assert(?:\.[A-Za-z]+)?|expect(?:\.[A-Za-z]+)?)$/u.test(node.expression.getText(tree))) result.push(node); ts.forEachChild(node, visit); };
    visit(tree); return result;
  };
  const count = (nodes: readonly ts.CallExpression[], tree: ts.SourceFile) => ({ total: nodes.length,
    comparisons: nodes.filter(node => /^assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual|notEqual|notStrictEqual|notDeepEqual|notDeepStrictEqual)$/u.test(node.expression.getText(tree))).length });
  const lookupFunction = (tree: ts.SourceFile, name: string) => {
    const found: ts.FunctionDeclaration[] = [];
    const visit = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found.push(node); ts.forEachChild(node, visit); }; visit(tree);
    demand(found.length === 1 && found[0].body, "Ambiguous or missing actual function: " + name); return found[0];
  };
  const beneath = (node: ts.Node, ancestor: ts.Node) => { for (let parent: ts.Node | undefined = node; parent; parent = parent.parent) if (parent === ancestor) return true; return false; };
  const meaningful = (node: ts.Node, tree: ts.SourceFile) => key(node, tree);
  const objectTerm = (value: Value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  const symbol = (kind: string, fields: { [key: string]: Value } = {}): Value => ({ $kind: kind, ...fields });
  const truthy = (value: Value): boolean => {
    const object = objectTerm(value);
    if (object?.$kind === "not") return !truthy(object.value);
    demand(!object?.$kind || ["react", "function"].includes(String(object.$kind)), "Symbolic/dynamic control cannot authorize an assertion case");
    return Boolean(value);
  };
  const receipts = input.observations.filter(value => value !== null && typeof value === "object" && record(value).kind === "assertion-relocation-observations").map(record);
  const changed = [...input.baselineSources].filter(([file, value]) => /^(?:scripts|tests)\/.+\.[cm]?[jt]sx?$/u.test(file) && input.currentSources.has(file) && value.toString() !== input.currentSources.get(file)!.toString());
  for (const [file, oldSource] of changed) {
    const oldTree = parse(file, oldSource.toString()), nextTree = parse(file, source(input.currentSources, file));
    const oldCalls = calls(oldTree), nextCalls = calls(nextTree);
    const observedImports = new Set<string>();
    for (const tree of [oldTree, nextTree]) for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith(".")
        || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
      const base = resolve(ROOT, dirname(file), statement.moduleSpecifier.text).slice(ROOT.length + 1).replaceAll("\\", "/");
      const target = [base, base + ".mts", base + ".ts", base + ".tsx"].find(candidate => [input.baselineSources, input.currentSources].some(map => {
        const value = map.get(candidate); return value !== undefined && observedAdapter(parse(candidate, value.toString()));
      }));
      if (target) for (const imported of statement.importClause.namedBindings.elements) if (!imported.isTypeOnly) observedImports.add(imported.name.text);
    }
    if ((observedAdapter(oldTree) || observedAdapter(nextTree))
      && ts.createPrinter({ removeComments: true }).printFile(oldTree) !== ts.createPrinter({ removeComments: true }).printFile(nextTree)) {
      failures.push({ file, scope: "", reason: "Changed observed shared predicate/operator requires direct provider qualification; raw count inflation cannot authorize it" });
    }
    const scopes = new Set(oldCalls.map(namedScope));
    for (const scope of scopes) {
      const oldScopeCalls = oldCalls.filter(node => namedScope(node) === scope), nextScopeCalls = nextCalls.filter(node => namedScope(node) === scope);
      const previousCount = count(oldScopeCalls, oldTree), nextCount = count(nextScopeCalls, nextTree);
      const receipt = receipts.find(value => value.consumer === file && value.scope === scope);
      let observedDelegation = false;
      const inspectObserved = (node: ts.Node, tree: ts.SourceFile) => { if (ts.isCallExpression(node) && namedScope(node) === scope && observedImports.has(node.expression.getText(tree))) observedDelegation = true; ts.forEachChild(node, child => inspectObserved(child, tree)); }; inspectObserved(oldTree, oldTree); inspectObserved(nextTree, nextTree);
      if (nextCount.total >= previousCount.total && nextCount.comparisons >= previousCount.comparisons && !receipt && !observedDelegation) continue;
      try {
        const scopeName = scope.split("/").at(-1)!;
        const oldOwner = lookupFunction(oldTree, scopeName), nextOwner = lookupFunction(nextTree, scopeName);
        const beforeFingerprint = hash(stable(oldScopeCalls.map(node => key(node, oldTree)))), afterFingerprint = hash(stable(nextScopeCalls.map(node => key(node, nextTree))));
        // Command ownership changed extraction, rather than moving a Section predicate.
        if (scopeName === "registeredVerificationNodeEntries") {
          demand(oldScopeCalls.every(node => node.expression.getText(oldTree) === "assert.ok") && nextScopeCalls.every(node => node.expression.getText(nextTree) === "assert.ok"), "Registered-command assertion operators changed");
          const currentBody = nextOwner.body!.getText(nextTree), oldBody = oldOwner.body!.getText(oldTree);
          demand(oldBody.includes("active.has") && oldBody.includes("Object.hasOwn") && oldBody.includes("sourceIncluded") && currentBody.includes("localVerificationCommandSteps"), "Command parser origin is not the supported recursive ownership extraction");
          const recursive = lookupFunction(nextTree, "localVerificationCommandSteps"), recursiveText = recursive.body!.getText(nextTree);
          demand(/Object\.hasOwn\(scripts,\s*check\)/u.test(recursiveText) && /typeof scripts\[check\]\s*!==\s*["']string["']/u.test(recursiveText)
            && recursiveText.includes("active.has(check)") && recursiveText.includes("[\\r\\n]") && recursiveText.includes("localVerificationCommandSteps(scripts, wrapper[1], next)"), "Recursive command owner lost an original boundary");
          demand(currentBody.includes("Object.hasOwn(scripts, check)") && currentBody.includes("assert.ok(steps") && currentBody.includes("assert.ok(sourceIncluded(entry)"), "Entry owner must preserve its actual assertion operator and private source boundary");
          const commandProofs: Record<string, unknown>[] = [];
          for (const observation of input.observations) {
            if (observation === null || typeof observation !== "object") continue;
            const envelope = record(observation), raw = envelope.observations;
            if (raw && typeof raw === "object") {
              const runtime = record(raw).runtimeProofs;
              if (Array.isArray(runtime)) for (const proof of runtime) if (proof && typeof proof === "object" && record(proof).control === "registered_node_entries") commandProofs.push(record(proof));
            }
            if (envelope.control === "registered_node_entries") commandProofs.push(envelope);
          }
          demand(commandProofs.length === 1, "Fresh actual registered-command positive/negative controls are required");
          const proof = commandProofs[0];
          demand(proof.actualSourceProjection === true && proof.sourceOwnerSha256 === hash(source(input.currentSources, file)), "Actual parser observations use stale or copied source");
          const verifierFile = "scripts/verify-isolated-supabase.mts";
          demand(proof.sourceVerifierSha256 === hash(source(input.currentSources, verifierFile)), "Actual parser controls do not bind the current registered verifier");
          demand(Array.isArray(proof.events), "Actual parser API observations are missing");
          const parserEvents = proof.events.map(record).filter(event => event.method === "registeredVerificationNodeEntries");
          const positive = parserEvents.filter(event => event.outcome === "RETURNED"), negative = parserEvents.filter(event => event.outcome === "REJECTED");
          demand(positive.length >= 2 && negative.length >= 12 && positive.every(event => Array.isArray(event.result) && event.result.length > 0), "Registered-command controls are incomplete");
          const negativeNames = negative.map(value => String(value.case));
          for (const family of ["inherit", "cycle", "newline", "private", "sibling"]) demand(negativeNames.some(name => name.includes(family)), "Missing command boundary family: " + family);
          demand(negativeNames.some(name => /own string|type/u.test(name)), "Missing recursive own-string type boundary");
          const mutant = record(proof.mutant);
          demand(mutant.actualRejected === true && Array.isArray(mutant.removedGuardOutput) && mutant.removedGuardOutput.some(value => typeof value === "string" && value.includes("/../private/")), "Actual private-entry assertion removal must be detected");
          obligations.push({ file, scope, site: oldOwner.getStart(oldTree), predicate: "recursive-own-literal-command-and-private-entry-boundaries", cases: negative.length + positive.length });
          relocations.push({ file, scope, before: previousCount.total, after: nextCount.total, matched: previousCount.total, beforeFingerprint, afterFingerprint });
          continue;
        }
        demand(receipt && receipt.schema === 1 && typeof receipt.nonce === "string" && /^[a-f0-9-]{36}$/iu.test(receipt.nonce), "Missing current native Section assertion observations");
        const calleeFile = String(receipt.calleeFile), subjectFile = String(receipt.subjectFile);
        demand(/^(?:scripts|tests)\/.+\.[cm]?[jt]sx?$/u.test(calleeFile) && /^src\/.+\.tsx$/u.test(subjectFile), "Unsupported actual callee/subject source");
        const calleeSource = source(input.currentSources, calleeFile), subjectSource = source(input.currentSources, subjectFile);
        demand(source(input.baselineSources, subjectFile) === subjectSource, "Changed subject owner cannot inherit a relocation-only proof");
        const binding = record(receipt.sourceBindings);
        demand(binding.consumerRawSha256 === hash(source(input.currentSources, file)) && binding.calleeRawSha256 === hash(calleeSource) && binding.subjectRawSha256 === hash(subjectSource), "Runtime source binding is stale");
        const readSubject = binding.subjectReadMode === "raw-utf8" ? subjectSource : binding.subjectReadMode === "normalizeVerificationText" ? subjectSource.replace(/\r\n/gu, "\n") : undefined;
        demand(readSubject !== undefined && binding.subjectReadSha256 === hash(readSubject), "Actual source read/normalization is not bound");
        demand(typeof binding.canonicalSourcePath === "string" && binding.canonicalSourcePath.replaceAll("\\", "/").endsWith("/" + subjectFile), "Subject read changed owner");
        const callee = record(binding.callee), exportName = String(callee.export);
        const calleeTree = parse(calleeFile, calleeSource), calleeOwner = lookupFunction(calleeTree, exportName);
        const imported = nextTree.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier)
          && resolve(dirname(file), node.moduleSpecifier.text).replaceAll("\\", "/") === resolve(calleeFile).replaceAll("\\", "/"));
        demand(imported.length === 1 && imported[0].importClause?.namedBindings && ts.isNamedImports(imported[0].importClause.namedBindings)
          && imported[0].importClause.namedBindings.elements.some(element => !element.propertyName && element.name.text === exportName && !element.isTypeOnly), "Actual helper must use one unshadowed direct canonical import");
        const shadowedHelper: ts.Node[] = [];
        const inspectShadow = (node: ts.Node) => {
          if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === exportName) shadowedHelper.push(node);
          ts.forEachChild(node, inspectShadow);
        }; inspectShadow(nextOwner);
        demand(shadowedHelper.length === 0, "A local or foreign binding shadows the actual imported helper");
        const delegates: ts.CallExpression[] = [];
        const inspectDelegate = (node: ts.Node) => { if (ts.isCallExpression(node) && node.expression.getText(nextTree) === exportName) delegates.push(node); ts.forEachChild(node, inspectDelegate); }; inspectDelegate(nextOwner);
        demand(delegates.length === 1, "A consumer must invoke its actual helper exactly once");
        const delegate = delegates[0];
        demand(ts.isExpressionStatement(delegate.parent) && delegate.parent.parent === nextOwner.body, "Delegation must run directly in the consumer continuation, not a branch/thunk/catch");
        const delegateIndex = nextOwner.body!.statements.indexOf(delegate.parent);
        demand(!nextOwner.body!.statements.slice(0, delegateIndex).some(statement => ts.isReturnStatement(statement) || ts.isThrowStatement(statement) || ts.isTryStatement(statement)), "Delegation is unreachable or protected by unsupported control");
        demand(delegate.arguments.length === 2 && ts.isObjectLiteralExpression(delegate.arguments[1]), "Actual helper ports must be explicit");
        const ports = delegate.arguments[1], port = (name: string) => ports.properties.find(property => (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && property.name.getText(nextTree) === name);
        const loaderPort = port("loadSection"), observePort = port("observe");
        demand(loaderPort && observePort && ts.isShorthandPropertyAssignment(loaderPort), "Actual source loader and observation ports are required");
        const allVariables = (tree: ts.SourceFile) => { const result: ts.VariableDeclaration[] = []; const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node)) result.push(node); ts.forEachChild(node, visit); }; visit(tree); return result; };
        const actualSections = allVariables(calleeTree).filter(node => ts.isIdentifier(node.name) && node.name.text === "Section" && beneath(node, calleeOwner));
        demand(actualSections.length === 1 && actualSections[0].initializer && ts.isCallExpression(actualSections[0].initializer)
          && actualSections[0].initializer.expression.getText(calleeTree) === "loadSection" && actualSections[0].initializer.arguments.length === 1
          && actualSections[0].initializer.arguments[0].getText(calleeTree) === "candidate", "Shared predicates replaced or cached the actual loaded Section");
        const currentVariables = allVariables(nextTree);
        const loaderBinding = currentVariables.filter(node => ts.isIdentifier(node.name) && node.name.text === loaderPort.name.text && beneath(node, nextOwner));
        demand(loaderBinding.length === 1 && loaderBinding[0].initializer && ts.isArrowFunction(loaderBinding[0].initializer), "Actual loader callback changed or is shadowed");
        const loader = loaderBinding[0].initializer;
        demand(loader.parameters.length === 1 && ts.isIdentifier(loader.parameters[0].name), "Unsupported loader parameter");
        const loaderParameter = loader.parameters[0].name.text;
        let loaderExpression: ts.Expression = loader.body as ts.Expression;
        while (ts.isAsExpression(loaderExpression) || ts.isParenthesizedExpression(loaderExpression)) loaderExpression = loaderExpression.expression;
        demand(ts.isPropertyAccessExpression(loaderExpression) && loaderExpression.name.text === "AdminFormSection" && ts.isCallExpression(loaderExpression.expression), "Actual loader must return the canonical compiled Section");
        const compileCall = loaderExpression.expression;
        demand(compileCall.arguments[0] && ts.isIdentifier(compileCall.arguments[0]) && compileCall.arguments[0].text === loaderParameter, "Loader ignores or replaces the actual mutant candidate");
        const compilerName = compileCall.expression.getText(nextTree);
        const oldSectionCalls: ts.CallExpression[] = [];
        const inspectOldSection = (node: ts.Node) => {
          if (ts.isVariableDeclaration(node) && node.initializer) {
            let initializer = node.initializer;
            while (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
            if (ts.isObjectBindingPattern(node.name) && node.name.elements.some(element => element.name.getText(oldTree) === "Section" && element.propertyName?.getText(oldTree) === "AdminFormSection") && ts.isCallExpression(initializer)) oldSectionCalls.push(initializer);
            if (ts.isIdentifier(node.name) && node.name.text === "Section" && ts.isPropertyAccessExpression(initializer) && initializer.name.text === "AdminFormSection" && ts.isCallExpression(initializer.expression)) oldSectionCalls.push(initializer.expression);
          } ts.forEachChild(node, inspectOldSection);
        }; inspectOldSection(oldOwner);
        demand(oldSectionCalls.length === 1 && key(oldSectionCalls[0], oldTree) === key(compileCall, nextTree), "Actual consumer compiler arguments/dependencies changed from the original owner");
        const argumentSource = delegate.arguments[0];
        demand(ts.isIdentifier(argumentSource), "Actual consumer source must use its direct read binding");
        const readBinding = currentVariables.filter(node => ts.isIdentifier(node.name) && node.name.text === argumentSource.text && beneath(node, nextOwner));
        demand(readBinding.length === 1 && readBinding[0].initializer && ts.isCallExpression(readBinding[0].initializer)
          && readBinding[0].initializer.expression.getText(nextTree) === "read" && readBinding[0].initializer.arguments.length === 1
          && ts.isStringLiteral(readBinding[0].initializer.arguments[0]) && readBinding[0].initializer.arguments[0].text === subjectFile, "Actual shared subject read was replaced or cached");
        const namedVariable = (tree: ts.SourceFile, name: string, within: ts.Node = tree) => { const found = allVariables(tree).filter(node => ts.isIdentifier(node.name) && node.name.text === name && beneath(node, within)); demand(found.length === 1 && found[0].initializer, "Ambiguous dependency/read binding: " + name); return found[0]; };
        for (const name of ["read", "jiti"]) demand(key(namedVariable(oldTree, name), oldTree) === key(namedVariable(nextTree, name), nextTree), "Canonical read or installed module loader changed");
        for (const tree of [oldTree, nextTree]) for (const [name, module] of [["createElement", "react"], ["isValidElement", "react"], ["renderToStaticMarkup", "react-dom/server"]]) demand(tree.statements.some(node => ts.isImportDeclaration(node)
          && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          && node.importClause.namedBindings.elements.some(element => !element.propertyName && element.name.text === name)), "Actual React assertion/render import changed owner");
        if (compileCall.arguments.length === 2) {
          const dependenciesName = compileCall.arguments[1].getText(nextTree), dependencyVariable = namedVariable(nextTree, dependenciesName, nextOwner);
          const previousDependencyVariable = namedVariable(oldTree, dependenciesName, oldOwner);
          demand(key(previousDependencyVariable, oldTree) === key(dependencyVariable, nextTree), "Actual dependency factory invocation changed");
          let factoryCall = dependencyVariable.initializer!; if (ts.isAwaitExpression(factoryCall)) factoryCall = factoryCall.expression;
          demand(ts.isCallExpression(factoryCall) && ts.isIdentifier(factoryCall.expression), "Unsupported dependency factory");
          const factoryName = factoryCall.expression.text;
          demand(key(lookupFunction(oldTree, factoryName), oldTree) === key(lookupFunction(nextTree, factoryName), nextTree), "Canonical dependency factory changed");
        } else {
          demand(compileCall.arguments.length === 3 && ts.isObjectLiteralExpression(compileCall.arguments[2]), "Unsupported compiler dependency ports");
          const arrayFactories = (tree: ts.SourceFile) => allVariables(tree).filter(node => beneath(node, tree === oldTree ? oldOwner : nextOwner) && ts.isArrayBindingPattern(node.name) && node.name.elements.some(element => ts.isBindingElement(element) && element.name.getText(tree) === "styles"));
          const previousFactories = arrayFactories(oldTree), currentFactories = arrayFactories(nextTree);
          demand(previousFactories.length === 1 && currentFactories.length === 1 && key(previousFactories[0], oldTree) === key(currentFactories[0], nextTree), "Actual imported component/style factory changed");
        }
        const findCompiler = (tree: ts.SourceFile) => {
          const declarations: ts.Node[] = [];
          const visit = (node: ts.Node) => { if (ts.isFunctionDeclaration(node) && node.name?.text === compilerName || ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === compilerName && beneath(node, tree === oldTree ? oldOwner : nextOwner)) declarations.push(node); ts.forEachChild(node, visit); }; visit(tree);
          demand(declarations.length === 1, "Ambiguous compiler closure"); return declarations[0];
        };
        demand(meaningful(findCompiler(oldTree), oldTree) === meaningful(findCompiler(nextTree), nextTree), "Canonical compiler closure changed; fresh different-loader qualification is required");
        const compiler = record(binding.compiler), callback = record(binding.loaderCallback);
        demand(compiler.binding === compilerName && typeof compiler.runtimeSource === "string" && compiler.runtimeSha256 === hash(compiler.runtimeSource)
          && typeof callback.runtimeSource === "string" && callback.runtimeSha256 === hash(callback.runtimeSource), "Actual runtime compiler/callback identity is missing");
        const runtimeKey = (value: string) => {
          const tree = parse("runtime.mts", "const __proof = (" + value.replace(/^export\s+(?:default\s+)?/u, "") + ");");
          const variable = tree.statements[0]; demand(ts.isVariableStatement(variable), "Runtime function source is not a function");
          const initializer = variable.declarationList.declarations[0].initializer; demand(initializer, "Runtime function source is empty");
          let expression = initializer; while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
          return key(expression, tree);
        };
        const emittedFunctionKey = (node: ts.Node, tree: ts.SourceFile) => {
          let expression = node; if (ts.isVariableDeclaration(node)) { demand(node.initializer, "Compiler has no value"); expression = node.initializer; }
          const text = expression.getText(tree).replace(/^export\s+(?:default\s+)?/u, "");
          const emitted = ts.transpileModule("const __proof = (" + text + ");", { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;
          const output = parse("emitted.mts", emitted), statement = output.statements[0]; demand(ts.isVariableStatement(statement), "Unable to project actual runtime function");
          let initializer = statement.declarationList.declarations[0].initializer!; while (ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
          return key(initializer, output);
        };
        demand(runtimeKey(compiler.runtimeSource) === emittedFunctionKey(findCompiler(nextTree), nextTree)
          && runtimeKey(callback.runtimeSource) === emittedFunctionKey(loader, nextTree), "Runtime compiler/callback does not execute its current source declaration");
        demand(typeof callee.runtimeSource === "string" && callee.runtimeSha256 === hash(callee.runtimeSource)
          && runtimeKey(callee.runtimeSource) === emittedFunctionKey(calleeOwner, calleeTree), "Runtime helper is not the current actual source function");
        const subjectTree = parse(subjectFile, subjectSource);
        const styleImports = subjectTree.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          && node.importClause.namedBindings.elements.some(element => (element.propertyName ?? element.name).text === "ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME"));
        demand(styleImports.length === 1 && ts.isStringLiteral(styleImports[0].moduleSpecifier), "Actual subject style authority is missing");
        const styleBase = resolve(ROOT, dirname(subjectFile), styleImports[0].moduleSpecifier.text).slice(ROOT.length + 1).replaceAll("\\", "/");
        const styleFile = [styleBase, styleBase + ".ts", styleBase + ".tsx"].find(candidate => input.currentSources.has(candidate)); demand(styleFile, "Missing canonical style owner source");
        demand(source(input.baselineSources, styleFile) === source(input.currentSources, styleFile), "Changed style authority cannot inherit original inputs");
        const styleTree = parse(styleFile, source(input.currentSources, styleFile)), styleDeclaration = namedVariable(styleTree, "ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME");
        demand(styleDeclaration.initializer && ts.isStringLiteralLike(styleDeclaration.initializer), "Only the actual literal style authority is supported");
        const premiumValue = styleDeclaration.initializer.text, premiumPort = port("premiumSurfaceClassName");
        demand(premiumPort && ts.isPropertyAssignment(premiumPort), "Actual style port is missing");
        const premiumPortExpression = premiumPort.initializer.getText(nextTree);
        const dependencyBindings = record(binding.dependencyBindings);
        demand(dependencyBindings.premiumSurfaceClassName === premiumValue, "Runtime style is not the authoritative current owner value");
        const requiredDependencies = ["AdminCard", "AdminModuleSectionHeader", "adminFormHintClassName", "createElement", "transpileModule",
          ...(compileCall.arguments.length === 2 ? ["adminFormLabelClassName"] : [])];
        for (const name of requiredDependencies) demand(Object.hasOwn(dependencyBindings, name), "Missing actual compiler dependency observation: " + name);
        if (compileCall.arguments.length === 2) demand(dependencyBindings.formStackClassName === "space-y-5", "Canonical compiled Form stack constant changed");
        for (const [name, value] of Object.entries(dependencyBindings)) {
          if (name === "premiumSurfaceClassName" || name === "formStackClassName") continue;
          const dependency = record(value); demand(typeof dependency.runtimeSource === "string" && dependency.runtimeSha256 === hash(dependency.runtimeSource), "Actual dependency function evidence is malformed");
        }
        const componentImports = subjectTree.statements.filter(ts.isImportDeclaration).filter(node => ts.isStringLiteral(node.moduleSpecifier)
          && (node.importClause?.name?.text === "AdminCard" || node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
            && node.importClause.namedBindings.elements.some(element => element.name.text === "AdminModuleSectionHeader")));
        demand(componentImports.length === 2, "Subject canonical component dependencies changed");
        for (const imported of componentImports) {
          demand(ts.isStringLiteral(imported.moduleSpecifier), "Nonliteral component dependency");
          const base = resolve(ROOT, dirname(subjectFile), imported.moduleSpecifier.text).slice(ROOT.length + 1).replaceAll("\\", "/");
          const dependency = [base, base + ".tsx", base + ".ts"].find(candidate => input.currentSources.has(candidate)); demand(dependency, "Missing actual component dependency");
          demand(source(input.baselineSources, dependency) === source(input.currentSources, dependency), "Changed component dependency cannot inherit relocation proof");
        }
        const baselinePrelude = new Set(oldOwner.body!.statements.map(statement => key(statement, oldTree)));
        for (const statement of nextOwner.body!.statements.slice(0, delegateIndex)) {
          if (baselinePrelude.has(key(statement, nextTree))) continue;
          if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              demand(ts.isIdentifier(declaration.name) && ["observationEnabled", "nonce", "observations", loaderPort.name.text].includes(declaration.name.text), "Consumer added an effect before its actual helper");
              if (declaration.name.text === "observations") demand(declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer) && declaration.initializer.elements.length === 0, "Observation collector was prefilled or replaced");
              if (declaration.name.text === "observationEnabled") demand(declaration.initializer?.getText(nextTree) === 'process.env.VENESIA_QA_ASSERTION_RELOCATION_RECEIPT === "1"', "Actual observation flag changed");
              if (declaration.name.text === "nonce") demand(declaration.initializer?.getText(nextTree) === "process.env.VENESIA_QA_ASSERTION_RELOCATION_NONCE", "Current owner nonce binding changed");
            } continue;
          }
          demand(ts.isIfStatement(statement) && ts.isThrowStatement(statement.thenStatement) && !statement.elseStatement
            && statement.expression.getText(nextTree).includes("observationEnabled") && statement.expression.getText(nextTree).includes(".test(nonce"),
          "Consumer has an unsupported control/effect before actual delegation");
        }
        // The evidence adapter must really delegate to node:assert, preserving the native exception.
        demand(calleeTree.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "node:assert/strict" && node.importClause?.name?.text === "nativeAssert"), "Native assertion module changed");
        const calleeText = calleeOwner.getText(calleeTree);
        demand(calleeText.includes("new Proxy(nativeAssert") && calleeText.includes("Reflect.get(target, property, receiver)") && calleeText.includes("Reflect.apply(method, target, args)")
          && calleeText.includes("throw error;") && calleeText.includes('outcome: "passed"') && calleeText.includes('outcome: "failed"'), "Native assertion delegation/exception path is unsupported");
        for (const native of ["createElement", "isValidElement"]) demand(calleeTree.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
          && node.moduleSpecifier.text === "react" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          && node.importClause.namedBindings.elements.some(element => !element.propertyName && element.name.text === native)), "React predicate/vector factory changed owner");
        const forbiddenShadows = new Set(["Reflect", "Proxy", "Object", "Array", "JSON", "Buffer", "Error", "nativeAssert", "createElement", "renderToStaticMarkup", "isValidElement"]);
        const shadowedNative: ts.Node[] = [];
        const inspectNative = (node: ts.Node) => {
          if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)) && node.name && ts.isIdentifier(node.name) && forbiddenShadows.has(node.name.text)) shadowedNative.push(node);
          ts.forEachChild(node, inspectNative);
        }; inspectNative(calleeTree);
        demand(shadowedNative.length === 0, "Actual assertion/factory native is shadowed");
        const assertionBindings = currentVariables.filter(node => ts.isIdentifier(node.name) && node.name.text === "assert" && beneath(node, nextOwner));
        demand(assertionBindings.length === 0, "Consumer native assertions are shadowed");
        const adapterVariables = allVariables(calleeTree).filter(node => ts.isIdentifier(node.name) && node.name.text === "assert" && beneath(node, calleeOwner));
        demand(adapterVariables.length === 1 && adapterVariables[0].initializer && ts.isConditionalExpression(adapterVariables[0].initializer), "Actual assertion adapter binding is missing");
        const adapter = adapterVariables[0].initializer;
        demand(adapter.condition.getText(calleeTree) === "observe" && adapter.whenFalse.getText(calleeTree) === "nativeAssert"
          && ts.isNewExpression(adapter.whenTrue) && adapter.whenTrue.expression.getText(calleeTree) === "Proxy"
          && adapter.whenTrue.arguments?.[0].getText(calleeTree) === "nativeAssert", "Actual assertions do not select the native delegate");
        const proxyHandler = adapter.whenTrue.arguments?.[1];
        demand(proxyHandler && ts.isObjectLiteralExpression(proxyHandler), "Native adapter has no explicit handler");
        const getter = proxyHandler.properties.filter(ts.isMethodDeclaration).find(node => node.name.getText(calleeTree) === "get");
        demand(getter?.body && getter.parameters.map(parameter => parameter.name.getText(calleeTree)).join(",") === "target,property,receiver", "Native operator receiver binding changed");
        demand(getter.body.statements.length === 3 && ts.isVariableStatement(getter.body.statements[0])
          && getter.body.statements[0].getText(calleeTree).replace(/\s+/gu, "") === "constmethod=Reflect.get(target,property,receiver);"
          && ts.isIfStatement(getter.body.statements[1]) && ts.isReturnStatement(getter.body.statements[1].thenStatement)
          && getter.body.statements[1].expression.getText(calleeTree).replace(/\s+/gu, "") === 'typeofproperty!=="string"||!["ok","equal","notEqual","throws"].includes(property)'
          && getter.body.statements[1].thenStatement.expression?.getText(calleeTree) === "method" && !getter.body.statements[1].elseStatement,
        "Native getter contains an unsupported effect or method substitution");
        const returned = getter.body.statements.filter(ts.isReturnStatement);
        demand(returned.length === 1 && returned[0].expression && ts.isArrowFunction(returned[0].expression) && ts.isBlock(returned[0].expression.body), "Native adapter must return its one actual operator wrapper");
        demand(returned[0].expression.parameters.length === 1 && returned[0].expression.parameters[0].dotDotDotToken
          && returned[0].expression.parameters[0].name.getText(calleeTree) === "args" && !returned[0].expression.parameters[0].initializer,
        "Actual received native operands must use the unmodified rest-argument binding");
        const operatorBody = returned[0].expression.body, operatorTries = operatorBody.statements.filter(ts.isTryStatement), finalReturns = operatorBody.statements.filter(ts.isReturnStatement);
        demand(operatorBody.statements.length === 5 && ts.isVariableStatement(operatorBody.statements[0])
          && operatorBody.statements[0].getText(calleeTree).replace(/\s+/gu, "") === "conststack=newError().stack,actualContext={...context};"
          && ts.isVariableStatement(operatorBody.statements[1]) && operatorBody.statements[1].declarationList.declarations.length === 1
          && operatorBody.statements[1].declarationList.declarations[0].name.getText(calleeTree) === "result"
          && !operatorBody.statements[1].declarationList.declarations[0].initializer
          && ts.isTryStatement(operatorBody.statements[2]) && ts.isExpressionStatement(operatorBody.statements[3])
          && ts.isCallExpression(operatorBody.statements[3].expression) && operatorBody.statements[3].expression.expression.getText(calleeTree) === "emit"
          && ts.isReturnStatement(operatorBody.statements[4]), "Native operator wrapper contains unsupported pre/post effects");
        demand(operatorTries.length === 1 && operatorTries[0].tryBlock.statements.length === 1
          && operatorTries[0].tryBlock.statements[0].getText(calleeTree).replace(/\s+/gu, "") === "result=Reflect.apply(method,target,args);"
          && finalReturns.length === 1 && finalReturns[0].expression?.getText(calleeTree) === "result", "Observed pass is not produced by the actual native operator");
        const nativeCatch = operatorTries[0].catchClause;
        demand(nativeCatch?.variableDeclaration?.name.getText(calleeTree) === "error" && nativeCatch.block.statements.length === 2
          && ts.isTryStatement(nativeCatch.block.statements[0]) && ts.isThrowStatement(nativeCatch.block.statements[1])
          && nativeCatch.block.statements[1].expression?.getText(calleeTree) === "error", "Native failure identity or observation path changed");
        const unsafeWrites: ts.Node[] = [], extraReturns: ts.Node[] = [];
        const inspectOperator = (node: ts.Node) => {
          if (node !== operatorBody && ts.isFunctionLike(node)) return;
          if (ts.isReturnStatement(node) && node !== operatorBody.statements[4]) extraReturns.push(node);
          if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
            && /^(?:args|method|target|property|actualContext)(?:\b|\[|\.)/u.test(node.left.getText(calleeTree))) unsafeWrites.push(node);
          ts.forEachChild(node, inspectOperator);
        }; inspectOperator(operatorBody);
        demand(unsafeWrites.length === 0 && extraReturns.length === 0, "Received native operands/method/context were mutated or bypassed");
        const events = receipt.events, loaders = receipt.loaders, vectors = receipt.vectors, mutants = receipt.mutants;
        demand(Array.isArray(events) && events.length > 0 && events.length <= 4096 && Array.isArray(loaders) && Array.isArray(vectors) && Array.isArray(mutants), "Bounded actual execution observations are required");
        const mutationLoops = calleeOwner.body!.statements.filter(ts.isForOfStatement).filter(loop => ts.isVariableDeclarationList(loop.initializer)
          && loop.initializer.declarations.length === 1 && ts.isArrayBindingPattern(loop.initializer.declarations[0].name)
          && loop.initializer.declarations[0].name.elements.map(element => element.getText(calleeTree)).join(",") === "label,from,to");
        demand(mutationLoops.length === 1 && ts.isArrayLiteralExpression(mutationLoops[0].expression), "Actual mutation controls must use one finite source tuple vector");
        const mutationCases = mutationLoops[0].expression.elements.map(element => {
          demand(ts.isArrayLiteralExpression(element) && element.elements.length === 3 && element.elements.every(ts.isStringLiteralLike), "Mutation tuple has unsupported source syntax");
          const [label, from, to] = element.elements.map(value => { demand(ts.isStringLiteralLike(value), "Mutation tuple members must be exact literals"); return value; });
          return { label: label.text, from: from.text, to: to.text, candidateSha256: hash(readSubject.replaceAll(from.text, to.text)) };
        });
        demand(mutationCases.length > 0 && mutationCases.length <= 32 && new Set(mutationCases.map(value => value.label)).size === mutationCases.length
          && new Set(mutationCases.map(value => value.candidateSha256)).size === mutationCases.length, "Mutation source vectors must be bounded and distinct");
        const controlSites = calls(calleeTree).filter(node => beneath(node, mutationLoops[0]));
        demand(controlSites.length === 2 && controlSites.some(node => node.expression.getText(calleeTree) === "assert.notEqual")
          && controlSites.some(node => node.expression.getText(calleeTree) === "assert.throws"), "Actual mutation loop lost its change/rejection native assertions");
        demand(mutants.length === mutationCases.length, "Actual mutant observations do not cover the complete source tuple vector");
        for (const expected of mutationCases) {
          demand(expected.candidateSha256 !== hash(readSubject), "An actual source mutation became vacuous");
          const matching = mutants.map(record).filter(value => value.label === expected.label && value.candidateSha256 === expected.candidateSha256
            && record(value.replacement).from === expected.from && record(value.replacement).to === expected.to);
          demand(matching.length === 1, "Every effective source mutation requires one exact actual rejection receipt");
          demand(loaders.map(record).filter(value => value.candidateKind === "mutant" && value.mutation === expected.label
            && value.candidateSha256 === expected.candidateSha256).length === 1, "Every effective source mutation requires one exact actual loader invocation");
          demand(events.map(record).filter(value => value.outcome === "failed" && record(value.context).phase === "predicate"
            && record(value.context).candidateKind === "mutant" && record(value.context).mutation === expected.label
            && record(value.context).candidateSha256 === expected.candidateSha256).length === 1, "Every effective source mutation requires its actual failed positive predicate");
          for (const control of controlSites) demand(events.map(record).filter(value => value.outcome === "passed"
            && value.operator === control.expression.getText(calleeTree) && record(value.context).phase === "control"
            && record(value.context).mutation === expected.label && record(value.context).candidateSha256 === expected.candidateSha256).length === 1,
          "Every effective source mutation requires both actual native control outcomes");
        }
        demand(loaders.length === mutants.length + 1 && mutants.length > 0, "Each actual mutation must call the actual loader");
        const originalDigest = hash(readSubject);
        demand(loaders.some(value => record(value).candidateSha256 === originalDigest && record(value).candidateKind === "original"), "Original actual source was not loaded");
        const expectedSection = (candidate: string) => {
          const tree = parse(subjectFile, candidate), section = lookupFunction(tree, "AdminFormSection");
          const emitted = ts.transpileModule(section.getText(tree), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
          const output = parse("actual-section.js", emitted); return hash(lookupFunction(output, "AdminFormSection").getText(output));
        };
        for (const value of loaders) {
          const observed = record(value);
          const mutation = observed.candidateKind === "original" ? undefined : mutants.map(record).find(value => value.label === observed.mutation);
          const replacement = mutation ? record(mutation.replacement) : undefined;
          const candidate = replacement ? readSubject.replaceAll(String(replacement.from), String(replacement.to)) : readSubject;
          demand(observed.candidateSha256 === hash(candidate) && observed.callbackSha256 === callback.runtimeSha256
            && observed.actualSectionSha256 === expectedSection(candidate) && observed.actualSectionName === "AdminFormSection", "Actual compiled Section does not originate from the passed canonical candidate");
        }
        const locate = (event: Record<string, unknown>) => {
          const location = record(event.site), url = String(location.file);
          demand(url.startsWith("file:") && fileURLToPath(url).replaceAll("\\", "/").endsWith("/" + calleeFile), "Assertion came from a foreign helper");
          demand(Number.isSafeInteger(location.line) && Number.isSafeInteger(location.column), "Invalid actual assertion source coordinates");
          const position = calleeTree.getPositionOfLineAndCharacter(Number(location.line) - 1, Number(location.column) - 1);
          const found = calls(calleeTree).filter(node => node.getStart(calleeTree) <= position && position < node.end);
          demand(found.length === 1 && event.operator === found[0].expression.getText(calleeTree), "Actual assertion operator/site is not the bound AST call"); return found[0];
        };
        for (const value of events) { const event = record(value); locate(event); demand(event.outcome === "passed" || event.outcome === "failed", "Unknown native assertion outcome"); }
        const allSharedSites = calls(calleeTree).filter(node => beneath(node, calleeOwner));
        for (const site of allSharedSites) demand(events.some(value => { const event = record(value); return event.outcome === "passed" && locate(event) === site; }), "A current shared assertion site was not actually invoked successfully");
        for (const value of mutants) {
          const mutation = record(value), replacement = record(mutation.replacement);
          demand(typeof replacement.from === "string" && typeof replacement.to === "string", "Actual source mutation is missing");
          const candidate: string = readSubject.replaceAll(replacement.from, replacement.to);
          demand(candidate !== readSubject && mutation.sourceSha256 === originalDigest && mutation.candidateSha256 === hash(candidate), "Mutation was vacuous or used another source");
          const failed = record(mutation.failedPredicate), failedContext = record(failed.context);
          demand(failedContext.phase === "predicate" && failedContext.candidateSha256 === mutation.candidateSha256, "Unrelated setup error cannot prove predicate rejection");
          locate({ ...failed, outcome: "failed" });
          demand(events.some(value => { const event = record(value); return event.outcome === "failed" && stable(event.site) === stable(failed.site) && stable(event.context) === stable(failed.context); }), "Missing actual failed positive predicate");
        }
        const buildProjector = (tree: ts.SourceFile, owner: ts.Node) => {
          const variables = allVariables(tree);
          const scopeOf = (node: ts.Node) => { let parent = node.parent; while (parent && !ts.isBlock(parent) && !ts.isForOfStatement(parent) && !ts.isFunctionLike(parent) && !ts.isSourceFile(parent)) parent = parent.parent; return parent ?? tree; };
          const findVariable = (name: string, at: ts.Node) => {
            const matching = variables.filter(node => ts.isIdentifier(node.name) && node.name.text === name && node.getStart(tree) < at.getStart(tree) && beneath(at, scopeOf(node)));
            matching.sort((left, right) => right.getStart(tree) - left.getStart(tree)); return matching[0];
          };
          let work = 0;
          const evaluate = (expression: ts.Expression, environment: Environment, seen = new Set<ts.Node>()): Value => {
            demand(++work <= 500_000 && seen.size <= 64, "Finite predicate projection budget exceeded");
            while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
            if (ts.isStringLiteralLike(expression)) return expression.text;
            if (ts.isNumericLiteral(expression)) return Number(expression.text);
            if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
            if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
            if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
            if (ts.isRegularExpressionLiteral(expression)) { const literal = expression.text, last = literal.lastIndexOf("/"); return symbol("regex", { pattern: literal.slice(1, last), flags: literal.slice(last + 1) }); }
            if (ts.isIdentifier(expression)) {
              const name = expression.text;
              if (environment.has(name)) return environment.get(name);
              if (name === "undefined") return undefined;
              if (name === "Section") return symbol("section-owner");
              if (name === "premiumSurfaceClassName") return premiumValue;
              const declaration = findVariable(name, expression);
              if (declaration?.initializer) { demand(!seen.has(declaration), "Recursive value binding is unsupported"); return evaluate(declaration.initializer, environment, new Set([...seen, declaration])); }
              if (["source", "candidate", "formSource"].includes(name)) return symbol("subject-source");
              throw new Error("Unsupported finite identifier: " + name);
            }
            if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return symbol("function", { body: key(expression.body, tree) });
            if (ts.isArrayLiteralExpression(expression)) {
              const values: Value[] = [];
              for (const element of expression.elements) { if (ts.isSpreadElement(element)) { const spread = evaluate(element.expression, environment, seen); demand(Array.isArray(spread), "Only finite array spreads are supported"); values.push(...spread); } else { demand(!ts.isOmittedExpression(element), "Sparse vectors are unsupported"); values.push(evaluate(element, environment, seen)); } }
              demand(values.length <= 32, "Finite vector array bound exceeded"); return values;
            }
            if (ts.isObjectLiteralExpression(expression)) {
              const value: { [key: string]: Value } = {};
              for (const property of expression.properties) {
                if (ts.isSpreadAssignment(property)) { const spread = objectTerm(evaluate(property.expression, environment, seen)); demand(spread, "Only finite object spreads are supported"); Object.assign(value, spread); }
                else { demand(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property), "Unsupported vector member"); const name = property.name.getText(tree).replace(/^["']|["']$/gu, ""); demand(!name.startsWith("$"), "Reserved symbolic member"); value[name] = evaluate(ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer, environment, seen); }
              } return value;
            }
            if (ts.isConditionalExpression(expression)) return evaluate(truthy(evaluate(expression.condition, environment, seen)) ? expression.whenTrue : expression.whenFalse, environment, seen);
            if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) return symbol("not", { value: evaluate(expression.operand, environment, seen) });
            if (ts.isBinaryExpression(expression)) {
              const left = evaluate(expression.left, environment, seen);
              if (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return left === undefined || left === null ? evaluate(expression.right, environment, seen) : left;
              const right = evaluate(expression.right, environment, seen);
              if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return symbol("and", { left, right });
              if (expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) return stable(left) === stable(right);
              if (expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) return truthy(left) ? left : right;
              throw new Error("Unsupported predicate binary operator");
            }
            if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
              if (ts.isPropertyAccessExpression(expression) && expression.name.text === "ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME") {
                demand(expression.getText(tree) === premiumPortExpression, "A same-named style value came from a foreign binding"); return premiumValue;
              }
              const base = evaluate(expression.expression, environment, seen);
              const member = ts.isPropertyAccessExpression(expression) ? expression.name.text : evaluate(expression.argumentExpression!, environment, seen);
              demand(typeof member === "string" || typeof member === "number", "Dynamic property access is unsupported");
              if (Array.isArray(base)) { if (member === "length") return base.length; return base[Number(member)]; }
              const object = objectTerm(base); demand(object, "Unknown finite property receiver");
              if (object.$kind === "component" || object.$kind === "output-property") return symbol("output-property", { element: object.$kind === "component" ? base : object.element,
                path: [...(object.$kind === "output-property" ? object.path as Value[] : []), String(member)] });
              if (object.$kind === "match" && member === "length") return symbol("match-count", { target: object.target, pattern: object.pattern });
              if (object.$kind === "react" && member === "props") return object.props;
              return object[String(member)];
            }
            if (ts.isCallExpression(expression)) {
              const name = expression.expression.getText(tree);
              if (name === "read") { demand(expression.arguments.length === 1 && ts.isStringLiteral(expression.arguments[0]) && expression.arguments[0].text === subjectFile, "Source path changed"); return symbol("subject-source"); }
              if (name === "Section") { demand(expression.arguments.length === 1, "Unsupported Section invocation"); return symbol("component", { props: evaluate(expression.arguments[0], environment, seen) }); }
              if (name === "createElement") {
                const type = evaluate(expression.arguments[0], environment, seen), props = expression.arguments[1] ? evaluate(expression.arguments[1], environment, seen) : {};
                const fields = objectTerm(props); demand(fields, "React vector props must be finite");
                const properties = { ...fields }; if (expression.arguments.length === 3) properties.children = evaluate(expression.arguments[2], environment, seen); demand(expression.arguments.length <= 3, "Multiple React children are unsupported");
                return objectTerm(type)?.$kind === "section-owner" ? symbol("component", { props: properties }) : symbol("react", { type, props: properties });
              }
              if (name === "renderToStaticMarkup") { const element = evaluate(expression.arguments[0], environment, seen); demand(objectTerm(element)?.$kind === "component", "Only canonical Section markup is projected"); return symbol("render", { element }); }
              if (name === "isValidElement") return symbol("valid-element", { element: evaluate(expression.arguments[0], environment, seen) });
              if (ts.isPropertyAccessExpression(expression.expression)) {
                const receiver = evaluate(expression.expression.expression, environment, seen), member = expression.expression.name.text;
                if (member === "entries") { demand(Array.isArray(receiver) && expression.arguments.length === 0, "Only literal vector entries are supported"); return receiver.map((value, index) => [index, value]); }
                if (member === "includes" || member === "match") return symbol(member === "includes" ? "includes" : "match", { target: receiver, pattern: evaluate(expression.arguments[0], environment, seen) });
                if (member === "replaceAll") return symbol("mutation", { target: receiver, from: evaluate(expression.arguments[0], environment, seen), to: evaluate(expression.arguments[1], environment, seen) });
              }
              throw new Error("Unsupported finite call: " + name);
            }
            throw new Error("Unsupported predicate syntax: " + ts.SyntaxKind[expression.kind]);
          };
          const contexts = (node: ts.Node) => {
            const loops: ts.ForOfStatement[] = [];
            for (let parent = node.parent; parent && beneath(parent, owner); parent = parent.parent) if (ts.isForOfStatement(parent)) loops.unshift(parent);
            let environments: Environment[] = [new Map()];
            for (const loop of loops) {
              demand(ts.isVariableDeclarationList(loop.initializer) && loop.initializer.declarations.length === 1, "Finite loop binding required");
              const pattern = loop.initializer.declarations[0].name, expanded: Environment[] = [];
              for (const environment of environments) {
                const values = evaluate(loop.expression, environment); demand(Array.isArray(values), "Only literal finite loop cases are supported");
                for (const value of values) {
                  const next = new Map(environment);
                  if (ts.isIdentifier(pattern)) next.set(pattern.text, value);
                  else { demand(ts.isArrayBindingPattern(pattern) && Array.isArray(value), "Unsupported finite loop destructuring"); pattern.elements.forEach((element, index) => { demand(ts.isBindingElement(element) && ts.isIdentifier(element.name), "Unsupported loop binding"); next.set(element.name.text, value[index]); }); }
                  expanded.push(next);
                }
              } demand(expanded.length <= 256, "Finite case expansion bound exceeded"); environments = expanded;
            }
            return environments.filter(environment => {
              for (let parent = node.parent; parent && beneath(parent, owner); parent = parent.parent) if (ts.isIfStatement(parent)) {
                const selected = truthy(evaluate(parent.expression, environment));
                if (beneath(node, parent.thenStatement) !== selected) return false;
              } return true;
            });
          };
          const canonical = (value: Value): Value => {
            if (Array.isArray(value)) return value.map(canonical);
            const object = objectTerm(value); if (!object) return value;
            const normalized = Object.fromEntries(Object.entries(object).map(([name, entry]) => [name, canonical(entry)]));
            return normalized;
          };
          const predicates = (node: ts.CallExpression, environment: Environment): Predicate[] => {
            const operator = node.expression.getText(tree), args = node.arguments;
            demand(args.length > 0, "Assertion has no tested argument");
            const actual = evaluate(args[0], environment), expected = args[1] && !["assert.ok", "assert"].includes(operator) ? evaluate(args[1], environment) : true;
            const result: Predicate[] = [];
            const add = (value: Value, wanted: Value, nativeOperator: string) => {
              const object = objectTerm(value);
              if (object?.$kind === "and" && wanted === true) { add(object.left, true, nativeOperator); add(object.right, true, nativeOperator); return; }
              if (object?.$kind === "not") { add(object.value, wanted === true ? false : wanted === false ? true : wanted, nativeOperator); return; }
              result.push({ operator: ["assert", "assert.ok"].includes(nativeOperator) ? "truth" : nativeOperator, actual: canonical(value), expected: canonical(wanted), case: environment.has("profile") ? canonical(environment.get("profile")) : null });
            }; add(actual, expected, operator); return result;
          };
          const dependencyFingerprint = (node: ts.CallExpression) => {
            const fragments = new Set<string>(), visited = new Set<ts.Node>();
            const visit = (part: ts.Node) => {
              if (ts.isIdentifier(part) && !(ts.isPropertyAccessExpression(part.parent) && part.parent.name === part)
                && !(ts.isPropertyAssignment(part.parent) && part.parent.name === part)) {
                let declaration: ts.VariableDeclaration | undefined = findVariable(part.text, part);
                if (!declaration) declaration = variables.find(candidate => ts.isObjectBindingPattern(candidate.name)
                  && candidate.name.elements.some(element => ts.isIdentifier(element.name) && element.name.text === part.text)
                  && candidate.getStart(tree) < part.getStart(tree) && beneath(part, scopeOf(candidate)));
                if (declaration?.initializer && !visited.has(declaration)) {
                  visited.add(declaration); demand(visited.size <= 64, "Finite dependency binding bound exceeded");
                  fragments.add(key(declaration.initializer, tree)); visit(declaration.initializer);
                }
              } ts.forEachChild(part, visit);
            };
            for (const argument of node.arguments.slice(0, 2)) visit(argument);
            const controls: string[] = [];
            for (let parent = node.parent; parent && beneath(parent, owner); parent = parent.parent) {
              if (ts.isIfStatement(parent)) controls.push("if:" + key(parent.expression, tree) + ":" + beneath(node, parent.thenStatement));
              if (ts.isForOfStatement(parent)) controls.push("for:" + key(parent.expression, tree));
            }
            return stable({ fragments: [...fragments].sort(), controls });
          };
          return { evaluate, contexts, predicates, canonical, dependencyFingerprint };
        };
        const original = buildProjector(oldTree, oldOwner), shared = buildProjector(calleeTree, calleeOwner);
        const passed = events.map(record).filter(event => event.outcome === "passed" && record(event.context).candidateKind === "original");
        const witnesses: Array<{ node: ts.CallExpression; context: Record<string, unknown>; predicates: Predicate[] }> = [];
        const decoded = (value: unknown): unknown => { const facts = record(value); if (facts.type === "undefined") return undefined; if (facts.type === "null") return null; return facts.value; };
        for (const event of passed) {
          const node = locate(event), context = record(event.context), cases = shared.contexts(node);
          demand(context.phase === "predicate" && context.mutation === null && context.candidateSha256 === originalDigest, "Actual positive event has a foreign candidate/control origin");
          const matching = cases.filter(environment => {
            const profile = objectTerm(environment.get("profile")); if (!profile) return false;
            const native = objectTerm(profile.nativeProps), header = environment.get("header"), headerElement = objectTerm(header);
            const observedNative = record(context.nativeProps), observedHeader = record(context.header);
            return environment.get("vector") === context.vector && native?.name === observedNative.name && native?.defaultValue === observedNative.defaultValue
              && native?.required === observedNative.required && native?.disabled === observedNative.disabled && Object.hasOwn(native!, "onChange") === observedNative.hasOnChange
              && profile.id === context.id && Object.hasOwn(profile, "eyebrow") && (profile.eyebrow !== undefined) === context.eyebrowPresent
              && stable(profile.eyebrow) === stable(decoded(context.eyebrow)) && (profile.className !== undefined) === context.classNamePresent
              && stable(profile.className) === stable(decoded(context.className)) && Boolean(headerElement) === observedHeader.present
              && (!headerElement || headerElement.type === observedHeader.type && objectTerm(headerElement.props)?.children === observedHeader.text
                && stable(Object.fromEntries(Object.entries(objectTerm(headerElement.props)!).filter(([name]) => name.startsWith("data-")))) === stable(observedHeader.markers))
              && (environment.has("presentation") ? environment.get("presentation") ?? "undefined" : "omitted") === context.presentation
              && (!environment.has("text") || environment.get("text") === context.metadataText);
          });
          demand(matching.length === 1, "Actual event does not identify one exact source-derived finite input case");
          const predicates = shared.predicates(node, matching[0]);
          const firstComponent = (value: Value): { [key: string]: Value } | undefined => {
            if (Array.isArray(value)) { for (const entry of value) { const found = firstComponent(entry); if (found) return found; } return undefined; }
            const object = objectTerm(value); if (!object) return undefined;
            if (object.$kind === "component") return object;
            for (const entry of Object.values(object)) { const found = firstComponent(entry); if (found) return found; } return undefined;
          };
          const component = firstComponent(predicates[0].actual), componentProps = component && objectTerm(component.props);
          demand(componentProps && (Object.hasOwn(componentProps, "surface") ? componentProps.surface : "omitted") === context.surface
            && (Object.hasOwn(componentProps, "presentation") ? componentProps.presentation ?? "undefined" : "omitted") === context.presentation, "Actual event changed its source-derived surface/presentation context");
          demand(Array.isArray(event.arguments), "Native actual argument facts are missing");
          const facts = event.arguments.map(record);
          if (event.operator === "assert.ok") demand(facts[0].type === "boolean" && facts[0].value === true, "Truth assertion did not execute on a real true scalar");
          else if (event.operator === "assert.equal") {
            demand(facts.length >= 2, "Comparison did not execute both real operands");
            if (facts[0].type === "react-element" || facts[1].type === "react-element") demand(facts[0].reference === facts[1].reference && facts[0].role === facts[1].role, "React identity was replaced by matching shapes");
            else demand(stable(facts[0]) === stable(facts[1]), "Actual native equal operands differ");
          }
          witnesses.push({ node, context, predicates });
        }
        const paritySites = witnesses.filter(witness => {
          const node = witness.node, first = node.arguments[0], second = node.arguments[1];
          return node.expression.getText(calleeTree) === "assert.equal" && first && ts.isCallExpression(first) && first.expression.getText(calleeTree) === "renderToStaticMarkup"
            && first.arguments[0] && ts.isCallExpression(first.arguments[0]) && first.arguments[0].expression.getText(calleeTree) === "createElement"
            && first.arguments[0].arguments[0]?.getText(calleeTree) === "Section" && first.arguments[0].arguments[1]?.getText(calleeTree) === "props"
            && second?.getText(calleeTree) === "panel";
        });
        const originalVectors = vectors.map(record).filter(vector => record(vector.context).candidateKind === "original");
        demand(originalVectors.length > 0 && originalVectors.every(vector => paritySites.some(witness => witness.context.vector === record(vector.context).vector
          && stable(witness.context.header) === stable(record(vector.context).header))), "Original React/direct invocation boundary lacks actual parity evidence");
        const compatible = (old: Predicate, next: Predicate) => {
          const equalTruth = (predicate: Predicate) => predicate.operator === "truth" || predicate.operator === "assert.equal" && typeof predicate.expected === "boolean";
          if (stable(old.actual) === stable(next.actual) && stable(old.expected) === stable(next.expected) && (old.operator === next.operator || equalTruth(old) && equalTruth(next))) return true;
          const actual = objectTerm(old.actual), stronger = objectTerm(next.actual);
          if (equalTruth(old) && old.expected === true && actual?.$kind === "includes" && next.operator === "assert.equal" && next.expected === 1 && stronger?.$kind === "match-count") {
            const regex = objectTerm(stronger.pattern);
            return regex?.$kind === "regex" && /^[gu]*$/u.test(String(regex.flags)) && /^[a-zA-Z0-9_ ='"-]+$/u.test(String(regex.pattern))
              && regex.pattern === actual.pattern && stable(stronger.target) === stable(actual.target);
          } return false;
        };
        const retainedProjector = buildProjector(nextTree, nextOwner);
        const currentKeys = new Map<string, ts.CallExpression[]>(); for (const node of nextScopeCalls) { const entry = key(node, nextTree); currentKeys.set(entry, [...(currentKeys.get(entry) ?? []), node]); }
        let matched = 0;
        for (const old of oldScopeCalls) {
          const operator = old.expression.getText(oldTree);
          const entry = key(old, oldTree), retained = currentKeys.get(entry) ?? [];
          const negative = operator === "assert.notEqual" || operator === "assert.throws";
          const originalDependencies = original.dependencyFingerprint(old);
          // Equal assertion syntax can occur in distinct Section/Field loops.
          // Consume only the matching dataflow/control site; another identical
          // spelling remains available for its own original obligation.
          const retainedIndex = retained.findIndex(next => negative || originalDependencies === retainedProjector.dependencyFingerprint(next));
          if (retainedIndex >= 0) {
            const next = retained.splice(retainedIndex, 1)[0];
            if (negative && originalDependencies !== retainedProjector.dependencyFingerprint(next)) {
              const oldCases = original.contexts(old), nextCases = retainedProjector.contexts(next);
              for (const environment of oldCases) {
                const from = environment.get("from"), to = environment.get("to");
                demand(typeof from === "string" && typeof to === "string" && (nextCases.some(candidate => candidate.get("from") === from && candidate.get("to") === to)
                  || mutants.some(value => { const replacement = record(record(value).replacement); return replacement.from === from && replacement.to === to; })), "A retained negative site lost an original input mutation");
              }
            } else demand(originalDependencies === retainedProjector.dependencyFingerprint(next), "A retained assertion changed its input, control or canonical dependency binding");
            matched += 1; continue;
          }
          if (operator === "assert.notEqual" || operator === "assert.throws" || operator === "assert.ok" && old.arguments[0] && ts.isCallExpression(old.arguments[0]) && old.arguments[0].expression.getText(oldTree) === "rejects") {
            const mutationCases = original.contexts(old);
            for (const environment of mutationCases) {
              const from = environment.get("from"), to = environment.get("to");
              demand(typeof from === "string" && typeof to === "string" && mutants.some(value => { const mutation = record(value), replacement = record(mutation.replacement); return replacement.from === from && replacement.to === to; }), "An original actual-source negative case was lost");
            }
            obligations.push({ file, scope, site: old.getStart(oldTree), predicate: operator + ":actual-source-mutation-rejection", cases: mutationCases.length }); matched += 1; continue;
          }
          const cases = original.contexts(old);
          demand(cases.length > 0, "Original assertion was not reachable in a finite case");
          for (const environment of cases) for (const predicate of original.predicates(old, environment)) {
            demand(witnesses.some(witness => witness.predicates.some(candidate => compatible(predicate, candidate))), "An original predicate/operator/input case has no actual canonical native execution witness");
          }
          obligations.push({ file, scope, site: old.getStart(oldTree), predicate: hash(stable(cases.map(environment => original.predicates(old, environment)))), cases: cases.length }); matched += 1;
        }
        demand(matched === oldScopeCalls.length, "A declining bucket contains an unmatched original assertion");
        relocations.push({ file, scope, before: previousCount.total, after: nextCount.total, matched, beforeFingerprint, afterFingerprint });
        const previousProvider = providerProofs.get(calleeFile);
        providerProofs.set(calleeFile, { file: calleeFile, sourceSha256: hash(calleeSource), consumers: [...new Set([...(previousProvider?.consumers ?? []), file])].sort(), assertionSites: allSharedSites.length });
      } catch (error) { failures.push({ file, scope, reason: error instanceof Error ? error.message : "Unsupported assertion relocation proof" }); }
    }
  }
  return { status: failures.length ? "BLOCKED" as const : "PASS" as const, obligations, failures, relocations, providers: [...providerProofs.values()] };
}

/** Source-derived candidates, not a second registry and not proof that an assertion executed. */
export function deriveLocalVerificationSourceImpact(scripts: Readonly<Record<string, string>>,
  changes: LocalVerificationInputs["changes"], current: ReadonlyMap<string, string | Buffer>, before: ReadonlyMap<string, string | Buffer>): LocalVerificationSourceImpact {
  const authorities = ["src/lib/admin/interaction-system/adoption-manifest.ts", "src/lib/admin/form-system/adoption-manifest.ts"];
  const parse = (file: string, source: string) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  // One discovery invocation owns both immutable source versions. Never reuse a projection across calls or source bytes.
  const semanticCache = new Map<string, Map<string, string>>();
  const semanticSource = (file: string, source: string) => {
    const versions = semanticCache.get(file), cached = versions?.get(source);
    if (cached !== undefined) return cached;
    const projected = localVerificationSemanticSource(file, source);
    const next = versions ?? new Map<string, string>(); next.set(source, projected); semanticCache.set(file, next);
    return projected;
  };
  const name = (node: ts.PropertyName) => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : "";
  const unique = (values: Iterable<string>) => [...new Set(values)].sort();
  const text = (sources: ReadonlyMap<string, string | Buffer>, file: string) => sources.get(file)?.toString();
  const codeSources = new Proxy(new Map([...current].filter(([file]) => /\.[cm]?[jt]sx?$/u.test(file)).map(([file, source]) => [file, source.toString()])), {
    get(target, property) {
      if (property === "get") return (file: string) => { assert.ok(target.has(file), "Graph dependency is outside the bound source snapshot: " + file); return target.get(file); };
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const pathCache = new WeakMap<ts.Node, ReadonlySet<string>>();
  const sourcePaths = (node: ts.Node) => {
    const cached = pathCache.get(node); if (cached) return new Set(cached);
    const paths = new Set<string>();
    const visit = (part: ts.Node) => {
      if (ts.isStringLiteralLike(part) && /^(?:src|scripts|tests)\/[a-zA-Z0-9_./()[\]@+-]+\.(?:[cm]?[jt]sx?|css|sql)$/u.test(part.text)) paths.add(part.text);
      ts.forEachChild(part, visit);
    };
    visit(node); pathCache.set(node, paths); return new Set(paths);
  };
  type Owner = { owner: string; capability?: string; files: string[]; manifest: string; current: boolean };
  type Consumer = { id: string; manifest: string; files: string[] };
  const owners: Owner[] = [], consumers: Consumer[] = [], unresolvedAuthorities = new Set<string>();
  for (const sources of [before, current]) for (const file of authorities) {
    const source = text(sources, file);
    if (source === undefined) { unresolvedAuthorities.add(file + ":missing_authority"); continue; }
    const tree = parse(file, source);
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const fields = new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [name(property.name), property.initializer]));
        const paths = (keys: string[]) => unique(keys.flatMap(key => fields.has(key) ? [...sourcePaths(fields.get(key)!)] : []));
        const string = (key: string) => { const value = fields.get(key); return value && ts.isStringLiteralLike(value) ? value.text : undefined; };
        if (fields.has("executableBindings") && string("owner")) owners.push({ owner: string("owner")!,
          capability: ts.isPropertyAssignment(node.parent) ? name(node.parent.name) : undefined, files: paths(["sourceFiles"]), manifest: file, current: sources === current });
        if (string("classification") === "independent_runtime" && string("id")) owners.push({ owner: string("id")!, files: paths(["sourceFiles"]), manifest: file, current: sources === current });
        if (fields.has("capabilityAudit")) {
          const files = paths(["sourceFiles", "pageSourceFiles", "presentationSourceFiles"]);
          if (string("id") && files.length) consumers.push({ id: string("id")!, manifest: file, files });
          else unresolvedAuthorities.add(file + ":generated_or_dynamic_consumer");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  const graphCache = new Map<string, Set<string>>(), graphProblems = new Map<string, string>();
  const references = (entry: string) => {
    const cached = graphCache.get(entry); if (cached) return cached;
    const found = new Set<string>([entry]);
    try {
      assert.ok(current.has(entry), "Entry missing from bound source snapshot.");
      const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [entry], symbolAware: false, sourceOverrides: codeSources });
      for (const [file, tree] of graph) { found.add(file); for (const target of sourcePaths(tree)) found.add(target); }
    } catch { graphProblems.set(entry, "unresolved_source_graph:" + entry); }
    graphCache.set(entry, found); return found;
  };
  const checks: Array<{ check: string; entries: string[]; references: Set<string> }> = [];
  for (const check of Object.keys(scripts).sort()) {
    if (!/^(?:verify|qa):[a-zA-Z0-9:_-]+$/u.test(check)) continue;
    try {
      const entries = registeredVerificationNodeEntries(scripts, check), targets = new Set<string>();
      for (const entry of entries) for (const target of references(entry)) targets.add(target);
      checks.push({ check, entries, references: targets });
    } catch { /* Unsupported shell/native entries cannot authorize source-derived coverage. */ }
  }
  const obligations: LocalVerificationSourceImpact["obligations"][number][] = [];
  const exportedShapes = (file: string, source: string | undefined) => {
    const result = new Map<string, string>(); if (source === undefined || !/\.[cm]?[jt]sx?$/u.test(file)) return result;
    const semantic = semanticSource(file, source), tree = parse(file, semantic);
    const authority = authorities.includes(file), explicitContract = /(?:^|[\/._-])contracts?(?:[\/._-]|$)/iu.test(file);
    if (authority) { result.set("manifest-obligations", semantic); return result; }
    for (const node of tree.statements) {
      if (!ts.canHaveModifiers(node) || !ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) result.set(node.name.text, node.getText(tree));
      else if (ts.isFunctionDeclaration(node)) result.set(node.name?.text ?? "default",
        node.getText(tree).slice(0, node.body ? node.body.getStart(tree) - node.getStart(tree) : undefined));
      else if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
        if (explicitContract) result.set(declaration.name.getText(tree), declaration.getText(tree));
        else if (declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
          const functionValue = declaration.initializer;
          result.set(declaration.name.getText(tree), declaration.name.getText(tree) + ":" + (declaration.type?.getText(tree) ?? "") + ":"
            + functionValue.getText(tree).slice(0, functionValue.body.getStart(tree) - functionValue.getStart(tree)));
        }
      }
    }
    return result;
  };
  const capabilityAxes = (source: string | undefined) => {
    const rows = new Map<string, string>(); if (!source) return rows;
    const tree = parse(authorities[0], localVerificationSemanticSource(authorities[0], source));
    for (const statement of tree.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(tree) !== "ADMIN_CURRENT_SHARED_CAPABILITY_SET" || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue;
      const object = declaration.initializer.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) for (const property of object.properties) if (ts.isPropertyAssignment(property)) rows.set(name(property.name), property.initializer.getText(tree));
    }
    return rows;
  };
  for (const change of changes) {
    const previousBytes = before.get(change.file), nextBytes = current.get(change.file);
    const previous = previousBytes?.toString(), next = nextBytes?.toString();
    assert.equal(previousBytes === undefined ? null : digest(previousBytes), change.beforeSha256, "Impact baseline bytes differ: " + change.file);
    assert.equal(nextBytes === undefined ? null : digest(nextBytes), change.afterSha256, "Impact current bytes differ: " + change.file);
    const oldShapes = exportedShapes(change.file, previous), newShapes = exportedShapes(change.file, next);
    const oldAxes = capabilityAxes(change.file === authorities[0] ? previous : undefined), newAxes = capabilityAxes(change.file === authorities[0] ? next : undefined);
    const onlyAxesAdded = newAxes.size > oldAxes.size && [...oldAxes].every(([key, value]) => newAxes.get(key) === value);
    // Dynamic-axis preservation is intentionally narrow: the rest of the authority must be unchanged.
    const withoutAxes = (source: string | undefined) => {
      if (source === undefined) return "";
      const tree = parse(change.file, source);
      for (const statement of tree.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
        if (declaration.name.getText(tree) === "ADMIN_CURRENT_SHARED_CAPABILITY_SET" && declaration.initializer)
          return semanticSource(change.file, source.slice(0, declaration.initializer.getStart(tree)) + "{}" + source.slice(declaration.initializer.end));
      return semanticSource(change.file, source);
    };
    const pureAxisAddition = onlyAxesAdded && withoutAxes(previous) === withoutAxes(next);
    for (const contract of unique([...oldShapes.keys(), ...newShapes.keys()])) if (oldShapes.get(contract) !== newShapes.get(contract)) obligations.push({
      file: change.file, owner: unique(owners.filter(owner => owner.files.includes(change.file)).map(owner => owner.owner)).join(", ") || change.file,
      contract: change.file + "#" + contract, before: oldShapes.has(contract) ? digest(oldShapes.get(contract)!) : null,
      after: newShapes.has(contract) ? digest(newShapes.get(contract)!) : null, addedCapabilityAxis: pureAxisAddition && contract === "manifest-obligations",
    });
  }
  const protections: LocalVerificationSourceImpact["protections"][number][] = [];
  const needsDynamicAxes = obligations.some(obligation => obligation.addedCapabilityAxis);
  const authorityTree = parse(authorities[0], needsDynamicAxes ? text(current, authorities[0]) ?? "" : "");
  const keyDeriver = authorityTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "adminSharedCapabilityKeys");
  const keyReturn = keyDeriver?.body?.statements.length === 1 && ts.isReturnStatement(keyDeriver.body.statements[0]) ? keyDeriver.body.statements[0].expression : undefined;
  let keyExpression = keyReturn;
  while (keyExpression && (ts.isAsExpression(keyExpression) || ts.isTypeAssertionExpression(keyExpression) || ts.isParenthesizedExpression(keyExpression))) keyExpression = keyExpression.expression;
  const derivesActualKeys = Boolean(keyDeriver?.parameters.length === 1 && keyExpression && ts.isCallExpression(keyExpression)
    && keyExpression.expression.getText(authorityTree) === "Object.keys" && keyExpression.arguments.length === 1
    && keyExpression.arguments[0].getText(authorityTree) === keyDeriver.parameters[0].name.getText(authorityTree));
  // File reachability does not establish that an assertion protects this changed export.
  // Compare explicit test inputs with declared shapes; never manufacture expected values.
  const exportedKinds = (file: string, source: string | undefined) => {
    const kinds = new Map<string, { runtime: boolean; members: ReadonlyMap<string, string> }>();
    if (source === undefined) return kinds;
    const tree = parse(file, semanticSource(file, source));
    for (const node of tree.statements) {
      if (!ts.canHaveModifiers(node) || !ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
        const members = ts.isInterfaceDeclaration(node) ? node.members : ts.isTypeLiteralNode(node.type) ? node.type.members : [];
        kinds.set(node.name.text, { runtime: false, members: new Map(members.flatMap(member => member.name
          ? [[name(member.name), member.getText(tree)] as const] : [])) });
      } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
        if (node.name) kinds.set(node.name.text, { runtime: true, members: new Map() });
      } else if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations)
        kinds.set(declaration.name.getText(tree), { runtime: true, members: new Map() });
    }
    return kinds;
  };
  const contractShapeFiles = new Map(unique(obligations.map(obligation => obligation.file)).map(file => [file, {
    previous: exportedShapes(file, text(before, file)), next: exportedShapes(file, text(current, file)),
    previousKinds: exportedKinds(file, text(before, file)), nextKinds: exportedKinds(file, text(current, file)),
  }]));
  const compactShape = (value: string) => value.replace(/\s+/gu, "").replace(/;(?=\})/gu, "");
  const obligationShapes = obligations.map(obligation => {
    const key = obligation.contract.slice(obligation.file.length + 1);
    const { previous, next, previousKinds, nextKinds } = contractShapeFiles.get(obligation.file)!;
    const declaration = nextKinds.get(key) ?? previousKinds.get(key);
    return { ...obligation, key, previous: previous.get(key) ?? "", next: next.get(key) ?? "",
      siblings: [...previous, ...next].filter(([name]) => name !== key).map(([, shape]) => shape),
      runtime: declaration?.runtime === true, valueExport: declaration?.runtime === true,
      changedTypeMembers: declaration?.runtime === false ? new Set(unique([
        ...(previousKinds.get(key)?.members.keys() ?? []), ...(nextKinds.get(key)?.members.keys() ?? []),
      ]).filter(member => previousKinds.get(key)?.members.get(member) !== nextKinds.get(key)?.members.get(member))) : new Set<string>() };
  });
  const assertionShapes = (file: string, source: string | undefined) => {
    const shapes = new Map<string, { references: string[]; contracts: string[] }>(); if (source === undefined) return shapes;
    const tree = parse(file, semanticSource(file, source));
    const bindings = new Map<string, ts.Node[]>(), imports = new Map<string, string>(), importedNames = new Map<string, string>();
    const bindingScopes = new Map<ts.Node, ts.Node>(), typedApiBindings = new Map<string, Array<{ target: string; scope: ts.Node; members: ReadonlySet<string> | null }>>();
    const typedValueBindings = new Map<string, Array<{ target: string; typeName: string; scope: ts.Node; members: ReadonlySet<string> | null }>>();
    let shadowedPick = false;
    const detectPick = (node: ts.Node) => {
      if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)
        || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node) || ts.isTypeParameterDeclaration(node) || ts.isImportSpecifier(node)
        || ts.isImportClause(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node)) && node.name?.getText(tree) === "Pick") shadowedPick = true;
      ts.forEachChild(node, detectPick);
    };
    detectPick(tree);
    // Bind only the receiver's actual imported type, or an unshadowed built-in Pick of it.
    // A nested generic/object type does not type its outer receiver as the imported owner.
    const receiverImport = (type: ts.TypeNode): { imported: ts.ImportTypeNode; members: ReadonlySet<string> | null } | undefined => {
      while (ts.isParenthesizedTypeNode(type)) type = type.type;
      if (ts.isImportTypeNode(type)) return { imported: type, members: null };
      if (!shadowedPick && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === "Pick"
        && type.typeArguments?.length === 2 && ts.isImportTypeNode(type.typeArguments[0])) {
        const selector = type.typeArguments[1], keys = ts.isUnionTypeNode(selector) ? selector.types : [selector];
        if (keys.every(key => ts.isLiteralTypeNode(key) && ts.isStringLiteral(key.literal)))
          return { imported: type.typeArguments[0], members: new Set(keys.map(key => ((key as ts.LiteralTypeNode).literal as ts.StringLiteral).text)) };
      }
      return undefined;
    };
    const moduleTarget = (specifier: string) => {
      if (!specifier.startsWith(".")) return undefined;
      const base = resolve(ROOT, dirname(file), specifier).slice(ROOT.length + 1).replaceAll("\\", "/");
      return [base, base + ".ts", base + ".tsx", base + ".mts", base + ".mjs", base + "/index.ts"].find(candidate => current.has(candidate) || before.has(candidate));
    };
    const declarationScope = (declaration: ts.Node) => {
      let scope = declaration.parent;
      while (scope && !ts.isSourceFile(scope) && !ts.isBlock(scope) && !ts.isFunctionLike(scope)) scope = scope.parent;
      return scope ?? tree;
    };
    const nearest = <T,>(part: ts.Node, candidates: readonly T[], scopeOf: (candidate: T) => ts.Node): readonly T[] => {
      for (let scope = part.parent; scope; scope = scope.parent) {
        const local = candidates.filter(candidate => scopeOf(candidate) === scope);
        if (local.length) return local;
      }
      return [];
    };
    const register = (key: string, node: ts.Node, declaration: ts.Node) => {
      bindingScopes.set(node, declarationScope(declaration)); bindings.set(key, [...(bindings.get(key) ?? []), node]);
    };
    const declarations = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) register(node.name.text, node.initializer, node);
      if (ts.isFunctionDeclaration(node) && node.name && node.body) register(node.name.text, node.body, node);
      if (ts.isParameter(node) && ts.isIdentifier(node.name)) register(node.name.text, node.initializer ?? node, node);
      if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && ts.isIdentifier(node.name) && node.type) {
        const parameterName = node.name.text;
        const receiver = receiverImport(node.type), imported = receiver?.imported;
        if (imported && ts.isLiteralTypeNode(imported.argument) && ts.isStringLiteral(imported.argument.literal)) {
          const target = moduleTarget(imported.argument.literal.text), members = receiver!.members;
          if (target && !imported.isTypeOf && imported.qualifier && ts.isIdentifier(imported.qualifier)) typedValueBindings.set(parameterName,
            [...(typedValueBindings.get(parameterName) ?? []), { target, typeName: imported.qualifier.text, scope: declarationScope(node), members }]);
          else if (target && imported.isTypeOf && !imported.qualifier) typedApiBindings.set(parameterName,
            [...(typedApiBindings.get(parameterName) ?? []), { target, scope: declarationScope(node), members }]);
        }
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith(".")) {
        const target = moduleTarget(node.moduleSpecifier.text);
        if (target) {
          if (node.importClause?.name) imports.set(node.importClause.name.text, target);
          const named = node.importClause?.namedBindings;
          if (named && ts.isNamedImports(named)) for (const element of named.elements) {
            imports.set(element.name.text, target); importedNames.set(element.name.text, (element.propertyName ?? element.name).text);
          }
        }
      }
      ts.forEachChild(node, declarations);
    };
    declarations(tree);
    const dependencyPaths = (node: ts.Node, seen: Set<string>, closure: Set<string>, fragments: Set<string>, calls: Set<string>, testedExports: Set<string>, testedTypeMembers: Set<string>, tested = true): string[] => {
      const targets = sourcePaths(node);
      const visit = (part: ts.Node) => {
        if (tested && ts.isStringLiteralLike(part)) fragments.add(part.text.replace(/\s+/gu, ""));
        if (tested && ts.isPropertyAssignment(part) && (ts.isIdentifier(part.name) || ts.isStringLiteralLike(part.name))) fragments.add(part.name.text);
        if (tested && ts.isPropertyAccessExpression(part) && ts.isIdentifier(part.expression)) {
          const local = nearest(part, bindings.get(part.expression.text) ?? [], binding => bindingScopes.get(binding)!);
          const typed = local.length === 1 ? nearest(part, typedValueBindings.get(part.expression.text) ?? [], binding => binding.scope)
            .filter(binding => binding.scope === bindingScopes.get(local[0])) : [];
          if (typed.length === 1) {
            const binding = typed[0], contract = binding.target + "#" + binding.typeName;
            if ((!binding.members || binding.members.has(part.name.text))
              && obligationShapes.some(obligation => obligation.contract === contract && obligation.changedTypeMembers.has(part.name.text))) {
              targets.add(binding.target); testedTypeMembers.add(contract);
            }
          }
        }
        if (tested && ts.isCallExpression(part) && !/^(?:assert|check|expect)(?:\.|$)/u.test(part.expression.getText(tree))) {
          if (ts.isIdentifier(part.expression)) {
            const shadowed = nearest(part, bindings.get(part.expression.text) ?? [], binding => bindingScopes.get(binding)!);
            const target = shadowed.length ? undefined : imports.get(part.expression.text), symbol = importedNames.get(part.expression.text);
            if (target && symbol) calls.add(target + "#" + symbol);
          } else if (ts.isPropertyAccessExpression(part.expression)) {
            const receiver = part.expression.expression, member = part.expression.name.text, typed = ts.isIdentifier(receiver) ? typedApiBindings.get(receiver.text) : undefined;
            const local = ts.isIdentifier(receiver) ? nearest(part, bindings.get(receiver.text) ?? [], binding => bindingScopes.get(binding)!) : [];
            const typedTargets = new Set((local.length === 1 ? nearest(part, typed ?? [], binding => binding.scope)
              .filter(binding => binding.scope === bindingScopes.get(local[0]) && (!binding.members || binding.members.has(member))) : []).map(binding => binding.target));
            if (typedTargets.size === 1) for (const target of typedTargets) { targets.add(target); calls.add(target + "#" + part.expression.name.text); }
            else if (!typed?.length) calls.add(part.expression.name.text);
          }
        }
        const propertyName = ts.isIdentifier(part) && (ts.isPropertyAccessExpression(part.parent) && part.parent.name === part
          || ts.isPropertyAssignment(part.parent) && part.parent.name === part || ts.isPropertySignature(part.parent) && part.parent.name === part
          || ts.isMethodDeclaration(part.parent) && part.parent.name === part);
        if (ts.isIdentifier(part) && !propertyName && !seen.has(part.text)) {
          seen.add(part.text);
          const candidates = nearest(part, bindings.get(part.text) ?? [], binding => bindingScopes.get(binding)!);
          const imported = candidates.length ? undefined : imports.get(part.text); if (imported) targets.add(imported);
          const importedName = importedNames.get(part.text); if (tested && imported && importedName) testedExports.add(imported + "#" + importedName);
          if (candidates?.length === 1) {
            if (!ts.isBlock(candidates[0]) && !ts.isParameter(candidates[0])) closure.add(candidates[0].getText(tree));
            for (const target of dependencyPaths(candidates[0], seen, closure, fragments, calls, testedExports, testedTypeMembers, tested && !ts.isBlock(candidates[0]))) targets.add(target);
          }
        }
        ts.forEachChild(part, visit);
      };
      visit(node); return unique(targets);
    };
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && /^(?:assert(?:\.[A-Za-z]+)?|check|expect(?:\.[A-Za-z]+)?)$/u.test(node.expression.getText(tree))) {
        const callee = node.expression.getText(tree);
        const argumentsUnderTest = callee === "check" ? node.arguments.slice(1, 2) : /^(?:assert|assert\.ok|expect)$/u.test(callee) ? node.arguments.slice(0, 1) : node.arguments.slice(0, 2);
        // Callback-based check wrappers have their assertions inspected independently.
        if (!argumentsUnderTest.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) || callee !== "check") {
          const closure = new Set<string>(), fragments = new Set<string>(), calls = new Set<string>(), testedExports = new Set<string>(), testedTypeMembers = new Set<string>();
          const references = unique(argumentsUnderTest.flatMap(argument => dependencyPaths(argument, new Set(), closure, fragments, calls, testedExports, testedTypeMembers)));
          const contracts = obligationShapes.filter(obligation => references.includes(obligation.file) && (obligation.valueExport && testedExports.has(obligation.contract)
            || testedTypeMembers.has(obligation.contract)
            || obligation.runtime && (calls.has(obligation.contract) || calls.has(obligation.key)) || [...fragments].some(fragment => {
            if (fragment.length < 2 || /^(?:true|false|null|undefined|number|string|boolean|object|function|any|unknown|void|never|readonly|export|type|const|interface|\d+)$/u.test(fragment)) return false;
            const previous = compactShape(obligation.previous), next = compactShape(obligation.next), expected = compactShape(fragment);
            // An export name proves availability only, not applicable contract protection.
            if (expected === obligation.key) return false;
            return previous.includes(expected) !== next.includes(expected)
              && !obligation.siblings.some(shape => compactShape(shape).includes(expected));
          }))).map(obligation => obligation.contract);
          shapes.set(JSON.stringify([callee, argumentsUnderTest.map(argument => argument.getText(tree)), unique(closure)]), { references, contracts: unique(contracts) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); return shapes;
  };
  const protectionCache = new Map<string, Omit<LocalVerificationSourceImpact["protections"][number], "check" | "references">>();
  const obligationFiles = new Set(obligations.map(obligation => obligation.file));
  for (const check of obligations.length ? checks : []) for (const file of check.entries) {
    const entryReferences = references(file);
    if (![...obligationFiles].some(target => entryReferences.has(target))) continue;
    const cached = protectionCache.get(file);
    if (cached) { protections.push({ ...cached, check: check.check, references: unique(entryReferences) }); continue; }
    const source = text(current, file); if (source === undefined) continue;
    const previous = text(before, file), tree = parse(file, needsDynamicAxes ? source : "");
    // This recognizes the existing dynamic capability audit, not arbitrary caller declarations.
    const keyDeclarations = new Set<string>(); let importsAuthority = false, rejectsMissingAxis = false, iteratesAxes = false;
    for (const statement of tree.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && /interaction-system\/adoption-manifest\.ts$/u.test(statement.moduleSpecifier.text)) {
        const text = statement.getText(tree); importsAuthority ||= text.includes("ADMIN_CURRENT_SHARED_CAPABILITY_SET") && text.includes("adminSharedCapabilityKeys");
      }
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name) && declaration.initializer
        && ts.isCallExpression(declaration.initializer) && declaration.initializer.expression.getText(tree) === "adminSharedCapabilityKeys"
        && declaration.initializer.arguments.length === 1 && declaration.initializer.arguments[0].getText(tree) === "ADMIN_CURRENT_SHARED_CAPABILITY_SET") keyDeclarations.add(declaration.name.text);
    }
    const inspect = (node: ts.Node) => {
      if (ts.isForOfStatement(node) && ts.isIdentifier(node.expression) && keyDeclarations.has(node.expression.text)
        && /ADMIN_CURRENT_SHARED_CAPABILITY_SET\[\s*capability\s*\]/u.test(node.statement.getText(tree))
        && /decisions\[\s*capability\s*\]/u.test(node.statement.getText(tree))) iteratesAxes = true;
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "push"
        && node.arguments.some(argument => ts.isStringLiteralLike(argument) && argument.text === "unclassified_capability_axis")) rejectsMissingAxis = true;
      ts.forEachChild(node, inspect);
    };
    inspect(tree);
    const beforeSha256 = before.has(file) ? digest(before.get(file)!) : null, afterSha256 = digest(current.get(file)!);
    const semanticChange = beforeSha256 !== afterSha256 && (previous === undefined || semanticSource(file, previous) !== semanticSource(file, source));
    const oldAssertions = semanticChange ? assertionShapes(file, previous) : new Map<string, { references: string[]; contracts: string[] }>();
    const newAssertions = semanticChange ? assertionShapes(file, source) : new Map<string, { references: string[]; contracts: string[] }>();
    const protection = { file, beforeSha256, afterSha256, semanticChange,
      assertionChanges: [...newAssertions].filter(([shape]) => !oldAssertions.has(shape)).map(([shape, projection]) => ({ sha256: digest(shape), ...projection })),
      dynamicCapabilityAxes: derivesActualKeys && importsAuthority && iteratesAxes && rejectsMissingAxis };
    protectionCache.set(file, protection);
    protections.push({ ...protection, check: check.check, references: unique(entryReferences) });
  }
  const rows = changes.map(change => {
    const matched = owners.filter(owner => owner.files.includes(change.file));
    const registered = consumers.filter(consumer => consumer.files.includes(change.file) || matched.some(owner => consumer.files.some(entry =>
      [...references(entry)].some(target => owner.files.includes(target)))));
    const qualityChecks = /^(?:scripts|tests)\//u.test(change.file)
      ? ["verify:executable-governance", "verify:verification-infrastructure"].filter(check => Object.hasOwn(scripts, check)) : [];
    const covering = checks.filter(check => check.references.has(change.file));
    const unresolved = unique([...(matched.length ? unresolvedAuthorities : []), ...(covering.length ? [] : ["no_positive_source_protection_relationship"]),
      ...registered.flatMap(consumer => consumer.files.flatMap(entry => graphProblems.has(entry) ? [graphProblems.get(entry)!] : []))]);
    const previous = text(before, change.file), next = text(current, change.file), code = /\.[cm]?[jt]sx?$/u.test(change.file);
    const semanticChange = previous === undefined || next === undefined || !code || semanticSource(change.file, previous) !== semanticSource(change.file, next);
    const presentationOnly = Boolean(semanticChange && previous !== undefined && next !== undefined && /\.[jt]sx$/u.test(change.file)
      && localVerificationPresentationSource(change.file, previous) === localVerificationPresentationSource(change.file, next));
    return { file: change.file, owners: matched.length ? unique(matched.map(owner => owner.owner)) : [change.file], capabilities: unique(matched.flatMap(owner => owner.capability ? [owner.capability] : [])),
      consumers: unique(registered.map(consumer => consumer.manifest + "#" + consumer.id)),
      contracts: unique([...obligations.filter(row => row.file === change.file).map(row => row.contract), ...registered.map(consumer => consumer.manifest)]),
      candidateChecks: unique([...covering.map(check => check.check), ...qualityChecks]), unresolved, semanticChange, presentationOnly };
  });
  const assertionRelocationDemand = localVerificationAssertionRelocationRequired({ baselineSources: before, currentSources: current });
  const demanded = new Set([...assertionRelocationDemand.files, ...assertionRelocationDemand.providers]);
  const qaQuality = changes.filter(change => /^(?:scripts|tests)\/.+\.[cm]?[jt]sx?$/u.test(change.file)).map(change => {
    const assertions = (source: string | undefined) => {
      const found: ts.CallExpression[] = [], coverage = new Map<string, number>(); if (source === undefined) return { found, coverage };
      const tree = parse(change.file, semanticSource(change.file, source));
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && /^(?:assert(?:\.[A-Za-z]+)?|expect(?:\.[A-Za-z]+)?)$/u.test(node.expression.getText(tree))) {
          found.push(node);
          const scope: string[] = [];
          for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent)
            if (ts.isFunctionDeclaration(parent) && parent.name) scope.unshift(parent.name.text);
          const key = JSON.stringify([scope, "assertion_count"]);
          coverage.set(key, (coverage.get(key) ?? 0) + 1);
          if (/^assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual|notEqual|notStrictEqual|notDeepEqual|notDeepStrictEqual)$/u.test(node.expression.getText(tree))) {
            const strict = JSON.stringify([scope, "comparison_count"]);
            coverage.set(strict, (coverage.get(strict) ?? 0) + 1);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(tree); return { found, coverage };
    };
    const previous = assertions(text(before, change.file)), next = assertions(text(current, change.file));
    const predicate = (call: ts.CallExpression) => JSON.stringify(call.arguments.slice(0,
      /\.(?:ok|throws|rejects)$/u.test(call.expression.getText()) ? 1 : 2).map(argument => argument.getText()));
    const identities = new WeakMap<ts.CallExpression, { operator: string; predicate: string; scope: string }>();
    const identity = (call: ts.CallExpression) => {
      const cached = identities.get(call); if (cached) return cached;
      const scope: string[] = [];
      for (let parent: ts.Node | undefined = call.parent; parent; parent = parent.parent)
        if (ts.isFunctionDeclaration(parent) && parent.name) scope.unshift(parent.name.text);
      const value = { operator: call.expression.getText(), predicate: predicate(call), scope: JSON.stringify(scope) }; identities.set(call, value); return value;
    };
    const original = new Map<string, number>(), currentOperators = new Map<string, Set<string>>();
    for (const call of previous.found) { const value = identity(call), id = JSON.stringify(value); original.set(id, (original.get(id) ?? 0) + 1); }
    for (const call of next.found) { const value = identity(call), id = value.scope + value.predicate;
      const operators = currentOperators.get(id) ?? new Set<string>(); operators.add(value.operator); currentOperators.set(id, operators); }
    const tautology = (call: ts.CallExpression) => {
      const operator = call.expression.getText(), first = call.arguments[0], second = call.arguments[1];
      if (!first) return true;
      if (/^(?:assert(?:\.ok)?|expect)$/u.test(operator) && [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.StringLiteral,
        ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral].includes(first.kind)) return true;
      return /^assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual)$/u.test(operator) && second !== undefined && first.getText() === second.getText();
    };
    let formal = false;
    for (const call of next.found) if (tautology(call)) {
      const id = JSON.stringify(identity(call)), count = original.get(id) ?? 0;
      if (count === 0) formal = true; else original.set(id, count - 1);
    }
    const operatorChanged = previous.found.some(call => { const value = identity(call), operators = currentOperators.get(value.scope + value.predicate);
      return operators !== undefined && !operators.has(value.operator); });
    return { file: change.file, assertionsBefore: previous.found.length, assertionsAfter: next.found.length,
      failures: [...(next.found.length < previous.found.length ? ["qa_assertion_count_decreased_requires_explicit_protection_review"]
        : [...previous.coverage].some(([key, count]) => (next.coverage.get(key) ?? 0) < count)
          ? ["qa_assertion_owner_or_operator_coverage_decreased_requires_explicit_protection_review"] : []),
        ...(formal ? ["qa_new_tautological_assertion_cannot_replace_protection"] : []),
        ...(operatorChanged ? ["qa_predicate_operator_changed_requires_equivalence_proof"] : []),
        ...(demanded.has(change.file) && next.found.length >= previous.found.length
          && [...previous.coverage].every(([key, count]) => (next.coverage.get(key) ?? 0) >= count)
          ? ["qa_assertion_relocation_requires_qualified_execution"] : [])] };
  });
  const sorted = <T extends { file: string }>(rows: readonly T[]) => [...rows].sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
  return { proofBoundary: "source_discovery_only", ownerBindings: [...new Map(owners.filter(owner => owner.current).map(owner => [JSON.stringify(owner), owner])).values()],
    sourceSha256: digest(JSON.stringify(sorted([...current].map(([file, source]) => ({ file, sha256: digest(source) }))))),
    deltaSha256: digest(JSON.stringify(sorted(changes.map(({ file, beforeSha256, afterSha256 }) => ({ file, beforeSha256, afterSha256 }))))), changes: rows, obligations, protections, qaQuality, assertionRelocationDemand };
}

/** Trusted event data identifies Git objects; no ref strings, network lookup or missing-history fallback is accepted. */
export function resolveLocalVerificationCiBaseline(input: { eventName: string; event: unknown; githubSha: string; checkoutHead: string },
  history: { exists(sha: string): boolean; isAncestor(ancestor: string, descendant: string): boolean; parents(sha: string): readonly string[] }) {
  const sha = (value: unknown, label: string, requireLocalCommit = true) => {
    assert.ok(typeof value === "string" && /^[a-f0-9]{40}$/u.test(value) && value !== "0".repeat(40), "Invalid or missing immutable CI " + label);
    if (requireLocalCommit) assert.ok(history.exists(value), "Missing local Git history for CI " + label); return value;
  };
  const current = sha(input.checkoutHead, "checkout HEAD"), expected = sha(input.githubSha, "GITHUB_SHA");
  assert.equal(current, expected, "CI checkout HEAD differs from GITHUB_SHA.");
  assert.ok(input.event && typeof input.event === "object" && !Array.isArray(input.event), "Invalid immutable CI event payload.");
  const event = input.event as Record<string, unknown>; let baseline: string;
  if (input.eventName === "pull_request") {
    const request = event.pull_request as { base?: { sha?: unknown }; head?: { sha?: unknown }; merge_commit_sha?: unknown } | undefined;
    baseline = sha(request?.base?.sha, "pull request base"); const head = sha(request?.head?.sha, "pull request head");
    // The captured GitHub event can carry the previous test merge here. Only immutable checkout,
    // event base/head and their exact Git topology authorize admission; advisory metadata never does.
    if (request?.merge_commit_sha !== undefined && request.merge_commit_sha !== null) sha(request.merge_commit_sha, "pull request advisory merge metadata", false);
    if (current !== head) {
      const parents = history.parents(current);
      assert.equal(parents.length, 2, "CI merge checkout requires exactly two Git parents.");
      assert.deepEqual(parents.map((parent, index) => sha(parent, "pull request merge parent " + index)), [baseline, head],
        "CI merge checkout parents differ from the immutable pull request base and head.");
    }
    assert.ok(history.isAncestor(head, current), "Pull request head is not an ancestor of the actual CI checkout.");
  } else {
    assert.equal(input.eventName, "push", "Unsupported CI event for source impact.");
    baseline = sha(event.before, "push before"); assert.equal(sha(event.after, "push after"), current, "Push event differs from the actual CI checkout.");
  }
  assert.ok(history.isAncestor(baseline, current), "CI baseline is not an ancestor of the actual checkout; no fallback or fetch was attempted.");
  return { baselineHead: baseline, finalHead: current, eventName: input.eventName };
}

/** Bounded public Git bindings only; no event text, credentials, paths or Git error output is retained. */
export function localVerificationCiDiagnostic(input: { eventName: string; event: unknown; githubSha: string; checkoutHead: string; lastCommitLookup?: string;
  lastCommitProbe?: { sha: string; exitCode: number | null; identity: string | null } },
  probe: (operation: "identity" | "objectType" | "parents" | "ancestry", sha: string, descendant?: string) => { exitCode: number | null; output: string }) {
  const canonical = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
  const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const field = (container: Record<string, unknown>, key: string) => {
    const value = container[key]; return { present: Object.hasOwn(container, key), type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
      value: canonical(value) ? value : null };
  };
  const event = object(input.event), request = object(event.pull_request);
  const bindings = { checkoutHead: field(object(input), "checkoutHead"), githubSha: field(object(input), "githubSha"),
    base: field(object(request.base), "sha"), head: field(object(request.head), "sha"), mergeCommitSha: field(request, "merge_commit_sha"),
    pushBefore: field(event, "before"), pushAfter: field(event, "after"), lastCommitLookup: field(object(input), "lastCommitLookup") };
  const query = (operation: "identity" | "objectType" | "parents" | "ancestry", sha: string, descendant?: string) => {
    try {
      const result = probe(operation, sha, descendant);
      return { exitCode: Number.isInteger(result.exitCode) && result.exitCode! >= 0 && result.exitCode! <= 255 ? result.exitCode : null, output: result.output.trim() };
    } catch { return { exitCode: null, output: "" }; }
  };
  const objects = [...new Set(Object.values(bindings).flatMap(binding => binding.value ? [binding.value] : []))].map(sha => {
    const identity = query("identity", sha), kind = query("objectType", sha), parents = query("parents", sha), values = parents.output.split(/\s+/u).filter(Boolean);
    return { sha, identity: { exitCode: identity.exitCode, value: canonical(identity.output) ? identity.output : null },
      objectType: { exitCode: kind.exitCode, value: ["commit", "tree", "blob", "tag"].includes(kind.output) ? kind.output : null },
      parents: { exitCode: parents.exitCode, values: values.length <= 8 && values.every(canonical) ? values : [], complete: parents.exitCode === 0 && values.length <= 8 && values.every(canonical) } };
  });
  const ancestry = bindings.checkoutHead.value ? [...new Set([bindings.base.value, bindings.head.value, bindings.mergeCommitSha.value, bindings.pushBefore.value].filter((sha): sha is string => sha !== null))]
    .map(ancestor => { const result = query("ancestry", ancestor, bindings.checkoutHead.value!); return { ancestor, descendant: bindings.checkoutHead.value,
      exitCode: result.exitCode, isAncestor: result.exitCode === 0 ? true : result.exitCode === 1 ? false : null }; }) : [];
  const original = input.lastCommitProbe;
  return { schema: "ci_event_binding_diagnostic_v1", eventName: ["pull_request", "push"].includes(input.eventName) ? input.eventName : "unsupported",
    bindings, originalCommitProbe: original ? { operation: "identity", sha: canonical(original.sha) ? original.sha : null,
      exitCode: Number.isInteger(original.exitCode) && original.exitCode! >= 0 && original.exitCode! <= 255 ? original.exitCode : null,
      identity: canonical(original.identity) ? original.identity : null } : null, objects, ancestry };
}

/** Automatic source correspondence is distinct from reviewed local admission and from behavioral/runtime proof. */
export function deriveLocalVerificationSourceCoherence(scripts: Readonly<Record<string, string>>, actual: LocalVerificationInputs) {
  const analysis = actual.changeImpact; assert.ok(analysis, "Automatic coherence requires complete actual source discovery.");
  assert.equal(analysis.sourceSha256, actual.sourceSha256, "Automatic selector has stale source snapshot bytes.");
  const changes = actual.changes.map(({ file, beforeSha256, afterSha256 }) => ({ file, beforeSha256, afterSha256 }))
    .sort((left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : 0);
  assert.equal(new Set(changes.map(change => change.file)).size, changes.length, "Automatic source delta contains duplicate selectors.");
  assert.equal(analysis.deltaSha256, digest(JSON.stringify(changes)), "Automatic selector has stale or partial changed-file bindings.");
  assert.deepEqual(analysis.changes.map(change => change.file).sort(), changes.map(change => change.file).sort(), "Automatic selector omits actual changed inputs.");
  const correspondence = analysis.obligations.map(obligation => {
    const protections = analysis.protections.filter(protection => protection.references.includes(obligation.file)
      && (protection.semanticChange && protection.beforeSha256 !== protection.afterSha256
        && actual.changes.some(change => change.file === protection.file && change.beforeSha256 === protection.beforeSha256 && change.afterSha256 === protection.afterSha256)
        && protection.assertionChanges.some(assertion => assertion.references.includes(obligation.file) && assertion.contracts.includes(obligation.contract))
        || obligation.addedCapabilityAxis && protection.dynamicCapabilityAxes && !protection.semanticChange && protection.beforeSha256 === protection.afterSha256));
    const consumers = analysis.changes.find(change => change.file === obligation.file)?.consumers ?? [];
    return { file: obligation.file, owner: obligation.owner, contract: obligation.contract, consumers, protected: protections.length > 0,
      protections: protections.map(protection => ({ file: protection.file, check: protection.check, afterSha256: protection.afterSha256 })),
      reason: protections.length ? "bound_changed_assertion_or_existing_dynamic_axis" : "missing_applicable_source_protection" };
  });
  const functional = analysis.changes.filter(change => /\.[cm]?[jt]sx?$/u.test(change.file) && change.semanticChange && !change.presentationOnly);
  const unknowns = analysis.changes.flatMap(change => change.unresolved.map(reason => ({ file: change.file, reason })));
  const names = [...new Set(analysis.changes.flatMap(change => change.candidateChecks))].sort();
  const targeted = names.map(check => {
    assert.ok(Object.hasOwn(scripts, check), "Automatic candidate is not a current canonical command.");
    const reasons = analysis.changes.filter(change => change.candidateChecks.includes(check)).map(change => ({ file: change.file,
      owners: change.owners, capabilities: change.capabilities, contracts: change.contracts, consumers: change.consumers }));
    return { check, command: scripts[check], steps: localVerificationCommandSteps(scripts, check) ?? [], reasons,
      proofLevel: "unexecuted_source_candidate" as const, effects: ["unknown"], executionAllowed: false };
  });
  const failures = correspondence.filter(row => !row.protected);
  const qualityFailures = (analysis.qaQuality ?? []).flatMap(row => row.failures.map(reason => ({ file: row.file, reason })));
  const preflight = Object.keys(scripts).filter(check => /^(?:lint|typecheck|(?:verify|qa):[a-zA-Z0-9:_-]+)$/u.test(check)).sort().map(check => {
    const selected = names.includes(check) || check === "lint" || check === "typecheck";
    const affected = analysis.changes.filter(change => change.candidateChecks.includes(check));
    let owner: string[];
    try { owner = registeredVerificationNodeEntries(scripts, check); }
    catch { owner = ["package.json#scripts." + check]; }
    return { check, selected, reason: check === "lint" || check === "typecheck" ? "mandatory_source_floor"
      : selected ? "affected_source_or_required_qa_quality_guard" : "no_positive_source_relationship_not_an_unaffected_behavior_claim",
      owner, affectedOwners: [...new Set(affected.flatMap(change => change.owners))].sort(),
      contract: [...new Set(affected.flatMap(change => change.contracts))].sort(), command: scripts[check],
      durationMs: 0, result: "NOT RUN" as const, evidence: null, sourceSha256: actual.sourceSha256,
      proofBoundary: "source_discovery_only" as const };
  });
  return { status: failures.length || qualityFailures.length ? "DRIFT" : "PASS_AUTOMATIC_SOURCE_PROTECTION", exitCode: failures.length || qualityFailures.length ? 2 : 0,
    sourceSha256: actual.sourceSha256, automatic: true, ownerReviewSatisfied: false, behavioralPass: false, releaseEvidence: false,
    fast: { profile: "fast_source", checksExecuted: 4 + correspondence.length, candidateCommandsExecuted: 0, browserExecuted: false, databaseCalls: 0,
      checks: ["actual_snapshot_binding", "complete_changed_file_binding", "current_contract_projection", "applicable_source_protection_correspondence"], correspondence },
    targeted, preflight, qaQuality: analysis.qaQuality ?? [], functionalEvidenceRequired: functional.map(change => ({ file: change.file, owners: change.owners, consumers: change.consumers,
      required: ["functional_behavior", "affected_native_integration_or_readback"], sourceChecksAdequate: false })),
    fullRequired: functional.length > 0 || unknowns.length > 0, fullCommand: "ci:check", unknowns,
    diagnostics: [...failures.map(row => `file=${row.file}; owner=${row.owner}; contract=${row.contract}; consumers=${row.consumers.join(",") || "unresolved"}; missing applicable assertion/vector protection.`),
      ...qualityFailures.map(row => `file=${row.file}; owner=existing QA quality guards; contract=assertion preservation; ${row.reason}`)] };
}

/** Bounded Admission package bytes; optional/peer traversal is explicit, separate from the unchanged source-guard proof. */
export function localVerificationInstalledRuntimePackages(packageNames: Iterable<string>, includeInstalledOptionalAndPeers = false) {
  const packages: Array<{ root: string; files: number; bytes: number; sha256: string }> = [];
  const seen = new Set<string>(), queue = [...packageNames].map(name => ({ name, from: join(ROOT, "package.json"), optional: false }));
  let totalBytes = 0, totalFiles = 0;
  while (queue.length) {
    const request = queue.shift()!;
    assert.ok(/^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/u.test(request.name)
      && !request.name.split("/").some(part => part === "." || part === ".."), "Runtime dependencies require literal installed package names.");
    const native = nodeModule.createRequire(request.from);
    let directory: string;
    try { directory = dirname(native.resolve(request.name)); }
    catch (error) {
      if (!includeInstalledOptionalAndPeers) throw error;
      // Export-restricted packages can expose only a native/other subpath. The
      // native resolver's own search directories still identify their manifest.
      const manifest = (native.resolve.paths(request.name) ?? []).map(at => join(at, request.name, "package.json"))
        .filter(file => file.startsWith(join(ROOT, "node_modules") + sep)).find(file => existsSync(file));
      if (!manifest) {
        if (request.optional && error && typeof error === "object" && "code" in error && error.code === "MODULE_NOT_FOUND") continue;
        throw error;
      }
      directory = dirname(manifest);
    }
    while (directory !== dirname(directory) && (!existsSync(join(directory, "package.json"))
      || JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).name !== request.name)) directory = dirname(directory);
    const relative = directory.slice(ROOT.length + 1).replaceAll("\\", "/");
    assert.ok(directory.startsWith(join(ROOT, "node_modules") + sep) && /^node_modules\//u.test(relative), "Runtime dependency escaped the installed project.");
    if (includeInstalledOptionalAndPeers) assert.ok(lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink()
      && realpathSync(directory) === directory, "Runtime package root has an unqualified link.");
    if (seen.has(relative)) continue; seen.add(relative);
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as { name: string; dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; peerDependenciesMeta?: Record<string, { optional?: boolean }> };
    assert.equal(manifest.name, request.name);
    const files: Array<{ file: string; sha256: string }> = []; let bytes = 0;
    const walk = (at: string) => { for (const name of readdirSync(at).sort()) {
      const file = join(at, name), stat = lstatSync(file); assert.equal(stat.isSymbolicLink(), false, "Runtime package contains an unqualified link.");
      if (stat.isDirectory()) walk(file);
      else { assert.ok(stat.isFile()); const content = readFileSync(file); bytes += content.length; totalBytes += content.length; totalFiles++;
        assert.ok(totalBytes <= 96 * 1024 * 1024 && totalFiles <= 10_000, "Runtime dependency closure exceeded its bounded read budget.");
        files.push({ file: file.slice(directory.length + 1).replaceAll("\\", "/"), sha256: digest(content) }); }
    } };
    walk(directory); packages.push({ root: relative, files: files.length, bytes, sha256: digest(JSON.stringify(files)) });
    const dependencies = manifest.dependencies ?? {}, optional = includeInstalledOptionalAndPeers ? manifest.optionalDependencies ?? {} : {};
    const peers = includeInstalledOptionalAndPeers ? manifest.peerDependencies ?? {} : {};
    for (const name of [...new Set([...Object.keys(dependencies), ...Object.keys(optional), ...Object.keys(peers)])].sort()) queue.push({ name,
      from: join(directory, "package.json"), optional: Object.hasOwn(optional, name)
        || !Object.hasOwn(dependencies, name) && Object.hasOwn(peers, name) && manifest.peerDependenciesMeta?.[name]?.optional === true });
  }
  return packages.sort((left, right) => left.root.localeCompare(right.root));
}

/** Actual installed/runtime identity; mismatch or an unresolved bounded package closure rejects qualification. */
export function localVerificationAdmissionRuntimeIdentity(packageNames: Iterable<string>) {
  const installedSource = readFileSync(join(ROOT, "node_modules/.package-lock.json"), "utf8"), projectSource = readFileSync(join(ROOT, "package-lock.json"), "utf8");
  const installed = JSON.parse(installedSource).packages as Record<string, Record<string, unknown>>;
  const locked = JSON.parse(projectSource).packages as Record<string, Record<string, unknown>>;
  assert.ok(installed && locked && Object.hasOwn(installed, "node_modules/typescript"));
  for (const [file, value] of Object.entries(installed)) for (const field of ["version", "resolved", "integrity", "link"])
    assert.deepEqual(value[field], locked[file]?.[field], "Installed package differs from the current package lock.");
  const packages = localVerificationInstalledRuntimePackages(packageNames, true);
  for (const entry of packages) {
    assert.ok(Object.hasOwn(installed, entry.root), "Runtime package is absent from the installed lock.");
    const manifest = JSON.parse(readFileSync(join(ROOT, entry.root, "package.json"), "utf8")) as { version?: string };
    assert.equal(manifest.version, installed[entry.root].version, "Actual runtime package version differs from the installed lock.");
  }
  return { node: process.version, v8: process.versions.v8, modules: process.versions.modules, platform: process.platform, arch: process.arch,
    executable: process.execPath, executableSha256: digest(readFileSync(process.execPath)), execArgv: [...process.execArgv],
    installedLockSha256: digest(installedSource), projectLockSha256: digest(projectSource), installedDependenciesMatchProjectLock: true as const, packages };
}

/** Recompute the native eager executable closure from bound bytes; generated/unresolved execution is never qualified. */
export function localVerificationSourceGuardEffects(entry: string, sources: ReadonlyMap<string, string | Buffer>, runtime: {
  node: string; v8: string; modules: string; platform: string; arch: string; executableSha256: string; installedLockSha256: string; execArgv: readonly string[];
} = { node: process.version, v8: process.versions.v8, modules: process.versions.modules, platform: process.platform, arch: process.arch,
  executableSha256: digest(readFileSync(process.execPath)), installedLockSha256: existsSync(join(ROOT, "node_modules/.package-lock.json"))
    ? digest(readFileSync(join(ROOT, "node_modules/.package-lock.json"))) : "", execArgv: process.execArgv },
  installedLockSource = existsSync(join(ROOT, "node_modules/.package-lock.json")) ? readFileSync(join(ROOT, "node_modules/.package-lock.json"), "utf8") : "") {
  const unresolved: string[] = [];
  const overrides = new Proxy(new Map([...sources].map(([file, source]) => [file, source.toString()])), {
    get(target, property) {
      if (property === "get") return (file: string) => { assert.ok(target.has(file), "Executable closure dependency is outside the bound snapshot: " + file); return target.get(file); };
      const value: unknown = Reflect.get(target, property, target); return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const closure: Array<{ file: string; sha256: string }> = [];
  const dynamicInputs: Array<{ owner: string; selector: string; file: string; sha256: string }> = [];
  const reviewedDynamic = new Map<string, string>();
  const runtimePackages: Array<{ root: string; files: number; bytes: number; sha256: string }> = [];
  const additionalEntries = new Set<string>();
  if (entry === "scripts/verify-verification-infrastructure.mts") {
    try {
      // Current, manually reviewed producers only. The complete bytes bind the
      // callee, temporary input, extraction predicate and controlled port wiring.
      // A renamed/added call or path is not renewed by merely recomputing a hash.
      const producers = new Map([
        ["scripts/verify-verification-infrastructure.mts", "55299aa79b97f9bebae2a8c5b538ac893cb76c0c3bbb7dea9287ade56fdcd3a8"],
        ["scripts/lib/verification-module-loader.mjs", "23b537191a2f7eafc6b15ac9631faa1f701bfa0b7858c8870eff19254532d9e4"],
        ["scripts/fixtures/verification-text-contract.mjs", "392c0e259233b4c8e67b03375c4e5f5eb66c9754a9843cfcaa64deb8778366e7"],
        ["scripts/fixtures/admin-core-query-presentation-plan.mjs", "0edabba8604f429fe2ce8ddf8738fc545c395ee559f851c086305e7153552001"],
      ]);
      const read = (file: string) => {
        assert.ok(/^(?:scripts|src)\/[a-zA-Z0-9_./()[\]@+-]+\.[cm]?[jt]sx?$/u.test(file)
          && !file.split("/").some(part => part === "." || part === ".."), "Unsafe dynamic execution input.");
        const value = sources.get(file); assert.ok(value !== undefined, "Missing bound dynamic execution input."); return value.toString().replaceAll("\r\n", "\n");
      };
      const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
      const nodes = <T extends ts.Node>(tree: ts.Node, predicate: (node: ts.Node) => node is T) => {
        const found: T[] = []; const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }; visit(tree); return found;
      };
      const bind = (owner: string, selector: string, file: string, source: string) => dynamicInputs.push({ owner, selector, file, sha256: digest(source) });
      for (const [file, approved] of producers) {
        const actual = digest(read(file)); assert.equal(actual, approved, "Unreviewed dynamic execution producer."); reviewedDynamic.set(file, actual);
      }
      const textOwner = "scripts/fixtures/verification-text-contract.mjs", textTree = parse(textOwner);
      const adoptersFile = "scripts/fixtures/verification-text-adopters.json", adoptersBytes = sources.get(adoptersFile);
      assert.ok(adoptersBytes !== undefined, "Missing source-bound adopter inventory.");
      const adopters = JSON.parse(adoptersBytes.toString()) as unknown;
      assert.ok(Array.isArray(adopters) && adopters.every(file => typeof file === "string") && new Set(adopters).size === adopters.length);
      bind(textOwner, "read_only_adopter_inventory", adoptersFile, adoptersBytes.toString().replaceAll("\r\n", "\n"));
      for (const file of adopters as string[]) bind(textOwner, "read_only_adopter_source", file, read(file));
      const specs = nodes(textTree, ts.isForOfStatement).filter(node => ts.isArrayLiteralExpression(node.expression)
        && node.expression.elements.every(element => ts.isObjectLiteralExpression(element)
          && element.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(textTree) === "forbidden")));
      assert.equal(specs.length, 1); assert.ok(ts.isArrayLiteralExpression(specs[0].expression));
      for (const element of specs[0].expression.elements) {
        assert.ok(ts.isObjectLiteralExpression(element));
        const fields = new Map(element.properties.map(property => { assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer));
          return [property.name.getText(textTree), property.initializer.text] as const; }));
        const file = fields.get("owner")!, variable = fields.get("variable")!, owner = parse(file);
        bind(textOwner, "read_only_guard_input", fields.get("file")!, read(fields.get("file")!));
        for (const needle of [fields.get("required")!, fields.get("forbidden")!]) {
          const selected = owner.statements.filter(node => ts.isExpressionStatement(node) && (node.getText(owner).includes(JSON.stringify(needle))
            || node.getText(owner).includes("'" + needle.replaceAll("\n", "\\n") + "'")));
          assert.equal(selected.length, 1, "Generated guard selector must be unique.");
          const calls = nodes(selected[0], ts.isCallExpression);
          assert.equal(calls.length, 2); assert.ok(calls.some(call => call.expression.getText(owner) === "assert.ok"));
          assert.ok(calls.some(call => call.expression.getText(owner) === variable + ".includes"
            && call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text === needle));
          bind(textOwner, "actual_assertion_statement", file, selected[0].getText(owner));
        }
      }
      const schedulingFile = "scripts/verify-admin-core-query-fixture-contract.mjs", schedulingTree = parse(schedulingFile);
      const scheduling = schedulingTree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "verifyCoreQueryFixtureScheduling");
      assert.equal(scheduling.length, 1); bind(textOwner, "actual_scheduling_declaration", schedulingFile, scheduling[0].getText(schedulingTree));
      const fixtureFile = "scripts/fixtures/admin-core-query-presentation-fixtures.mts", fixtureTree = parse(fixtureFile);
      const loops = nodes(fixtureTree, ts.isForOfStatement).filter(node => node.expression.getText(fixtureTree) === "plan" && node.initializer.getText(fixtureTree) === "const spec");
      assert.equal(loops.length, 1);
      assert.equal(nodes(loops[0], ts.isIdentifier).some(node => ["process", "globalThis", "global", "require", "eval", "Function", "fetch", "WebSocket"].includes(node.text)), false,
        "Generated scheduling loop cannot acquire an ambient execution/transport port.");
      bind(schedulingFile, "actual_controlled_fixture_loop", fixtureFile, loops[0].getText(fixtureTree));
      const planFile = "scripts/fixtures/admin-core-query-presentation-plan.mjs", planTree = parse(planFile);
      const recipes = planTree.statements.flatMap(node => ts.isVariableStatement(node) ? node.declarationList.declarations.filter(row => row.name.getText(planTree) === "recipes") : []);
      assert.equal(recipes.length, 1); assert.ok(recipes[0].initializer && ts.isObjectLiteralExpression(recipes[0].initializer));
      const recipeArrays: ts.ArrayLiteralExpression[] = recipes[0].initializer.properties.map(property => {
        assert.ok(ts.isPropertyAssignment(property) && ts.isArrayLiteralExpression(property.initializer)); return property.initializer;
      });
      for (const statement of planTree.statements.filter(ts.isForOfStatement)) for (const assignment of nodes(statement.statement, ts.isBinaryExpression)) {
        if (!ts.isElementAccessExpression(assignment.left) || assignment.left.expression.getText(planTree) !== "recipes") continue;
        assert.equal(assignment.operatorToken.kind, ts.SyntaxKind.EqualsToken); assert.ok(ts.isArrayLiteralExpression(assignment.right)); recipeArrays.push(assignment.right);
      }
      const recipePaths = new Set(recipeArrays.map(array => { const first = array.elements[0]; assert.ok(ts.isStringLiteral(first)); return first.text; }));
      let recipeImports = 0;
      for (const call of nodes(planTree, ts.isCallExpression).filter(call => ts.isPropertyAccessExpression(call.expression) && call.expression.getText(planTree) === "jiti.import")) {
        assert.equal(call.arguments.length, 1); const argument = call.arguments[0];
        if (ts.isStringLiteral(argument)) additionalEntries.add(resolve(ROOT, dirname(planFile), argument.text).slice(ROOT.length + 1).replaceAll("\\", "/"));
        else {
          assert.equal(argument.getText(planTree).replaceAll(" ", ""), "'../../src/lib/admin/'+modulePath+'.ts'"); recipeImports++;
          for (const path of recipePaths) { assert.ok(/^[a-zA-Z0-9_/-]+$/u.test(path) && !path.split("/").includes("..")); additionalEntries.add("src/lib/admin/" + path + ".ts"); }
        }
      }
      assert.equal(recipeImports, 1); assert.ok(additionalEntries.size > 8);
      for (const file of additionalEntries) read(file);
    } catch {
      unresolved.push(entry + ":unresolved_reviewed_generated_execution_inputs"); reviewedDynamic.clear();
    }
  }
  try {
    assert.ok(sources.has(entry), "Missing source guard entry.");
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [entry, ...additionalEntries], sourceOverrides: overrides, symbolAware: false, nativeEagerImports: true });
    const packageNames = new Set<string>();
    for (const [file, tree] of graph) {
      const bytes = sources.get(file); assert.ok(bytes !== undefined, "Executable closure escaped its immutable source snapshot.");
      closure.push({ file, sha256: digest(bytes.toString().replaceAll("\r\n", "\n")) });
      const dynamicLoaders = new Set(["require", "createRequire", "eval", "Function"]);
      for (const statement of tree.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
        && statement.moduleSpecifier.text === "node:module" && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
        for (const binding of statement.importClause.namedBindings.elements) if ((binding.propertyName ?? binding.name).text === "createRequire") dynamicLoaders.add(binding.name.text);
      const visit = (node: ts.Node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          && /^(?:@\/|@src\/|file:|https?:|\/|[A-Za-z]:)/u.test(node.moduleSpecifier.text)) unresolved.push(file + ":unresolved_native_module_alias");
        if (entry === "scripts/verify-verification-infrastructure.mts" && (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
          && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.moduleSpecifier.text.startsWith(".") && !nodeModule.isBuiltin(node.moduleSpecifier.text)) {
          const parts = node.moduleSpecifier.text.split("/"); packageNames.add(parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
        }
        if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ts.isIdentifier(node.expression) && dynamicLoaders.has(node.expression.text))
          if (!reviewedDynamic.has(file)) unresolved.push(file + ":unresolved_dynamic_execution:" + node.expression.text);
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
    if (entry === "scripts/verify-verification-infrastructure.mts" && reviewedDynamic.size) {
      packageNames.add("js-yaml");
      const seen = new Set<string>(), queue = [...packageNames].map(name => ({ name, from: join(ROOT, "package.json") }));
      let totalBytes = 0, totalFiles = 0;
      while (queue.length) {
        const request = queue.shift()!, native = nodeModule.createRequire(request.from);
        let directory = dirname(native.resolve(request.name));
        while (directory !== dirname(directory) && (!existsSync(join(directory, "package.json"))
          || JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).name !== request.name)) directory = dirname(directory);
        const relative = directory.slice(ROOT.length + 1).replaceAll("\\", "/");
        assert.ok(directory.startsWith(join(ROOT, "node_modules") + sep) && /^node_modules\//u.test(relative), "Runtime dependency escaped the installed project.");
        if (seen.has(relative)) continue; seen.add(relative);
        const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as { name: string; dependencies?: Record<string, string> };
        assert.equal(manifest.name, request.name);
        const files: Array<{ file: string; sha256: string }> = []; let bytes = 0;
        const walk = (at: string) => { for (const name of readdirSync(at).sort()) {
          const file = join(at, name), stat = lstatSync(file); assert.equal(stat.isSymbolicLink(), false, "Runtime package contains an unqualified link.");
          if (stat.isDirectory()) walk(file);
          else { assert.ok(stat.isFile()); const content = readFileSync(file); bytes += content.length; totalBytes += content.length; totalFiles++;
            assert.ok(totalBytes <= 96 * 1024 * 1024 && totalFiles <= 10_000, "Runtime dependency closure exceeded its bounded read budget.");
            files.push({ file: file.slice(directory.length + 1).replaceAll("\\", "/"), sha256: digest(content) }); }
        } };
        walk(directory); runtimePackages.push({ root: relative, files: files.length, bytes, sha256: digest(JSON.stringify(files)) });
        for (const name of Object.keys(manifest.dependencies ?? {}).sort()) queue.push({ name, from: join(directory, "package.json") });
      }
      runtimePackages.sort((left, right) => left.root.localeCompare(right.root));
    }
  } catch { unresolved.push(entry + ":unresolved_executable_import_closure"); }
  const inputs = ["package.json", "package-lock.json", "tsconfig.json"].map(file => {
    const bytes = sources.get(file); if (bytes === undefined) unresolved.push(file + ":missing_execution_input");
    return { file, sha256: bytes === undefined ? null : digest(bytes.toString().replaceAll("\r\n", "\n")) };
  });
  for (const hash of [runtime.executableSha256, runtime.installedLockSha256]) if (!/^[a-f0-9]{64}$/u.test(hash)) unresolved.push("missing_runtime_or_installed_dependency_identity");
  try {
    assert.equal(digest(installedLockSource), runtime.installedLockSha256);
    const installed = JSON.parse(installedLockSource).packages as Record<string, Record<string, unknown>>;
    const locked = JSON.parse(sources.get("package-lock.json")!.toString()).packages as Record<string, Record<string, unknown>>;
    assert.ok(installed && locked && Object.hasOwn(installed, "node_modules/typescript"));
    for (const [file, value] of Object.entries(installed)) for (const field of ["version", "resolved", "integrity", "link"])
      assert.deepEqual(value[field], locked[file]?.[field], "Installed package differs from the current package lock.");
  } catch { unresolved.push("installed_dependencies_do_not_match_current_lock"); }
  closure.sort((left, right) => left.file.localeCompare(right.file));
  const reasons = [...new Set(unresolved)].sort();
  const generated = entry === "scripts/verify-verification-infrastructure.mts" ? { producers: [...reviewedDynamic].map(([file, sha256]) => ({ file, sha256 })),
    fragments: dynamicInputs, dynamicSourceEntries: [...additionalEntries].sort(), runtimePackages } : null;
  return { entry, closure, inputs, runtime, generated, unresolved: reasons,
    fingerprint: reasons.length ? null : digest(JSON.stringify({ schema: "native-source-guard-effects-v1", entry, closure, inputs, runtime, ...(generated ? { generated } : {}) })) };
}

/** One reviewed effect contract for an existing canonical leaf, never an arbitrary-command execution registry. */
export function qualifyLocalVerificationTargets(scripts: Readonly<Record<string, string>>, analysis: LocalVerificationSourceImpact, fixtureSha256: string,
  sourceGuardSha256: Readonly<Record<string, string>> = {}) {
  const entry = "scripts/qa-admin-form-guarded-navigation.mts";
  const step = "node --experimental-strip-types " + entry + " --save-cache-only";
  const fixtureApproved = fixtureSha256 === "2209ce6ae21e7c3ed2855cad5f5a6a904971735084d0f90aafce066fe71d7dbf";
  const bindings = (analysis.ownerBindings ?? []).filter(binding => binding.capability === "form_runtime");
  const commands = Object.keys(scripts).filter(check => localVerificationCommandSteps(scripts, check)?.includes(step)).sort();
  // This exact native port executes the existing Browser leaf. A QA lifecycle
  // change needs that consumer proof even when Product/fixture bytes are unchanged.
  const nativePort = (file: string) => ["scripts/lib/windows-owned-process.mts", "scripts/lib/windows-owned-process.cs"].includes(file);
  const reasons = analysis.changes.filter(change => change.semanticChange && !change.presentationOnly && (nativePort(change.file)
    || commands.some(check => change.candidateChecks.includes(check)) && (change.file === entry || change.file === "src/lib/admin/form-system/adoption-manifest.ts" || bindings.some(binding => binding.files.includes(change.file))
      || change.capabilities.includes("form_runtime") || change.contracts.some(contract => bindings.some(binding => contract.startsWith(binding.manifest))))));
  const blockers = [
    ...(!fixtureApproved ? ["qualified_fixture_bytes_changed_review_effect_contract"] : []),
    ...(!bindings.length ? ["missing_current_manifest_form_runtime_owner"] : []),
    ...(!commands.length ? ["missing_exact_registered_save_cache_leaf"] : []),
    ...(analysis.changes.some(change => ["package.json", "package-lock.json"].includes(change.file) && change.semanticChange) ? ["dependency_or_command_contract_changed"] : []),
  ];
  const targets = reasons.length && !blockers.length ? [{ kind: "browser_behavior" as "browser_behavior" | "source_guard", family: "admin-form-save-cache", entry, step,
    canonicalChecks: commands.filter(check => reasons.some(change => nativePort(change.file) || change.candidateChecks.includes(check))),
    owners: [...new Set(bindings.map(binding => binding.owner))].sort(), capabilities: [...new Set(bindings.flatMap(binding => binding.capability ? [binding.capability] : []))].sort(),
    contracts: [...new Set([...bindings.map(binding => binding.manifest), ...reasons.flatMap(change => change.contracts)])].sort(),
    consumers: [...new Set(reasons.flatMap(change => change.consumers))].sort(),
    reasons: reasons.map(change => ({ file: change.file, owners: change.owners, capabilities: change.capabilities, contracts: change.contracts, consumers: change.consumers })),
    fixtureSha256, effects: ["browser", "owned_filesystem", "owned_process", "owned_loopback_http"], supportedPlatforms: ["win32", "linux"], limitMs: 300_000,
    proofLevel: "shared_owner_controlled_browser_behavior" as "shared_owner_controlled_browser_behavior" | "source_guard_execution",
    successMarker: "", nativePersistenceVerified: false, businessConsumerAdoptionVerified: false }] : [];
  const qualityReasons = analysis.changes.filter(change => /^(?:scripts|tests)\//u.test(change.file) && change.semanticChange);
  // These are reviewed effect contracts for two existing direct source leaves, not their npm composites.
  // The complete native eager import closure, dependency lock and actual runtime must match reviewed effect bytes.
  // Exact Windows24/Linux22 contexts share this order; an unknown or mixed context is never inherited.
  const sourceGuards = [
    { check: "verify:executable-governance", entry: "scripts/verify-executable-governance.mts", sha256: ["b803957f15b95977eb4b3403ba1437b66dd6de2559115f4e1c2e243cebce434f", "f5f8d2bdd3b5bc3fc9970c8635e481ce2d3577783adec7d474fd46e73e899dee"], marker: "Executable governance PASS" },
    { check: "verify:verification-infrastructure", entry: "scripts/verify-verification-infrastructure.mts", sha256: ["c42cbcb64cb07d6d9dd72fa440b344aceb0333fc5e0ce8a62c9591f38326224b", "96c02fd6676dfc6140a75f618fb240613091cf63bf27d8ff0c6c1a52ceaaba33"], marker: "PASS verification infrastructure:" },
  ];
  const knownContexts = sourceGuards.map(guard => guard.sha256.indexOf(sourceGuardSha256[guard.entry])).filter(index => index >= 0);
  const mixedContexts = new Set(knownContexts).size > 1;
  const qualityBlockers: string[] = [];
  const selections = [{ family: "admin-form-save-cache", selected: reasons.length > 0, qualified: targets.length > 0,
    reason: reasons.length ? blockers.length ? "effect_contract_blocked" : "affected_qualified_form_runtime" : "no_affected_form_runtime",
    command: step, owner: bindings.map(binding => binding.owner), contract: bindings.map(binding => binding.manifest) }];
  for (const guard of sourceGuards) {
    const command = "node --experimental-strip-types " + guard.entry;
    const canonicalChecks = Object.keys(scripts).filter(check => localVerificationCommandSteps(scripts, check)?.includes(command)).sort();
    const affected = qualityReasons.filter(change => change.candidateChecks.includes(guard.check)
      || canonicalChecks.some(check => change.candidateChecks.includes(check)));
    const failures = [...(!guard.sha256.every(value => /^[a-f0-9]{64}$/u.test(value)) || new Set(guard.sha256).size !== guard.sha256.length
      || !guard.sha256.includes(sourceGuardSha256[guard.entry]) || mixedContexts ? ["qualified_source_guard_bytes_changed_review_effect_contract:" + guard.entry] : []),
      ...(!canonicalChecks.length ? ["missing_exact_registered_source_guard:" + guard.entry] : []),
      ...(analysis.changes.some(change => ["package.json", "package-lock.json"].includes(change.file) && change.semanticChange) ? ["dependency_or_command_contract_changed"] : [])];
    if (affected.length) qualityBlockers.push(...failures);
    selections.push({ family: guard.entry, selected: affected.length > 0, qualified: affected.length > 0 && !failures.length,
      reason: affected.length ? failures.length ? "effect_contract_blocked" : "mandatory_qa_quality_guard" : "no_changed_qa_input",
      command, owner: [guard.entry], contract: ["docs/QA_RELEASE_CLOSURE.md#3.2.2"] });
    if (affected.length && !failures.length) targets.push({ kind: "source_guard", family: guard.entry, entry: guard.entry, step: command,
      canonicalChecks, owners: [guard.entry], capabilities: ["verification_quality"], contracts: ["docs/QA_RELEASE_CLOSURE.md#3.2.2"],
      consumers: [...new Set(affected.map(change => change.file))].sort(),
      reasons: affected.map(change => ({ file: change.file, owners: change.owners, capabilities: change.capabilities, contracts: change.contracts, consumers: change.consumers })),
      fixtureSha256: sourceGuardSha256[guard.entry], effects: ["source_read", "owned_temp_filesystem", "owned_process"], supportedPlatforms: ["win32", "linux"], limitMs: 180_000,
      proofLevel: "source_guard_execution", successMarker: guard.marker, nativePersistenceVerified: false, businessConsumerAdoptionVerified: false });
  }
  return { targets: [...new Map(targets.map(target => [target.step, target])).values()]
    .sort((left, right) => Number(left.kind === "browser_behavior") - Number(right.kind === "browser_behavior")), blockers: [...new Set([...blockers, ...qualityBlockers])],
    blocking: [...new Set([...(reasons.length ? blockers : []), ...qualityBlockers])], selections,
    applicable: reasons.length > 0 || qualityReasons.length > 0, unqualifiedRemainUnderExistingGates: true as const };
}

/** A changed obligation cannot be silently blessed by changed Product bytes or a free-form waiver. */
export function assertLocalVerificationProtectionMaintenance(impact: LocalVerificationImpact, actual: LocalVerificationInputs) {
  const analysis = actual.changeImpact;
  if (!analysis) return; // The real admission reader always supplies this; legacy pure callers are not release admission.
  assert.equal(analysis.proofBoundary, "source_discovery_only");
  assert.deepEqual(analysis.changes.map(row => row.file).sort(), actual.changes.map(row => row.file).sort(),
    "Derived impact must cover every actual changed file.");
  for (const obligation of analysis.obligations) {
    const diagnostic = `Contract drift: file=${obligation.file}; owner=${obligation.owner}; contract=${obligation.contract}`;
    const reviews = (impact.protectionMaintenance ?? []).filter(row => row.file === obligation.file && row.contract === obligation.contract);
    assert.equal(reviews.length, 1, diagnostic + "; missing unique reviewed protection maintenance.");
    const review = reviews[0];
    assert.ok(review.reviewedBy?.trim() && review.rationale?.trim(), diagnostic + "; protection review is incomplete.");
    const protection: LocalVerificationSourceImpact["protections"][number] | undefined = analysis.protections.find(row => row.file === review.protectionFile && row.check === review.check);
    assert.ok(protection && protection.references.includes(obligation.file), diagnostic + "; protection has no bound source relationship.");
    assert.equal(review.beforeSha256, protection.beforeSha256, diagnostic + "; stale protection baseline bytes.");
    assert.equal(review.afterSha256, protection.afterSha256, diagnostic + "; stale protection current bytes.");
    assert.ok(impact.changes.some(row => row.checks.includes(review.check)), diagnostic + "; protection check is not selected fresh.");
    if (review.mode === "updated") {
      const changed = actual.changes.find(row => row.file === review.protectionFile);
      assert.ok(changed && /^(?:scripts|tests)\//u.test(changed.file) && protection.semanticChange
        && protection.assertionChanges.some(assertion => assertion.sha256 === review.assertionSha256 && assertion.references.includes(obligation.file) && assertion.contracts.includes(obligation.contract)),
        diagnostic + "; updated protection must contain a real verification-source change.");
      assert.equal(changed.beforeSha256, review.beforeSha256); assert.equal(changed.afterSha256, review.afterSha256);
    } else {
      assert.equal(review.mode, "existing_dynamic_axes", diagnostic + "; unknown maintenance mode.");
      assert.ok(obligation.addedCapabilityAxis && protection.dynamicCapabilityAxes && !protection.semanticChange
        && protection.beforeSha256 === protection.afterSha256,
      diagnostic + "; unchanged protection is valid only for proven existing dynamic capability-axis expansion.");
    }
  }
  for (const review of impact.protectionMaintenance ?? []) assert.ok(analysis.obligations.some(row => row.file === review.file && row.contract === review.contract),
    `Unexpected protection maintenance: file=${review.file}; contract=${review.contract}`);
}

/** Exact literal command/argv identity only; unsupported command shapes are never pruned. */
export function localVerificationCommandSteps(scripts: Readonly<Record<string, string>>, check: string, active = new Set<string>()): string[] | undefined {
  // Validate every recursive wrapper before reading its command; a prototype
  // property cannot authorize an executable package step.
  if (!/^[a-zA-Z0-9:_-]+$/u.test(check) || !Object.hasOwn(scripts, check)
    || active.has(check) || typeof scripts[check] !== "string" || /[\r\n]/u.test(scripts[check])) return undefined;
  const next = new Set([...active, check]), result: string[] = [];
  for (const raw of scripts[check].split("&&")) {
    const step = raw.trim(), wrapper = /^npm run ([a-zA-Z0-9:_-]+)$/u.exec(step);
    if (wrapper) {
      const nested = localVerificationCommandSteps(scripts, wrapper[1], next); if (!nested) return undefined;
      result.push(...nested);
    } else if (/^node (?:--experimental-strip-types )?[a-zA-Z0-9_./-]+\.(?:mjs|mts|js|ts)(?: [a-zA-Z0-9_./:=+,-]+)*$/u.test(step)) result.push(step);
    else return undefined;
  }
  return result.length ? result : undefined;
}

/** Select existing named checks; unresolved impact widens to the unchanged full gate. */
export function planLocalVerification(scripts: Readonly<Record<string, string>>, impact: LocalVerificationImpact, actual: LocalVerificationInputs, request?: PublicGateRequest) {
  const fullPrefix = finalQualityScriptNames(scripts);
  const nativeGate = localVerificationNativeGate(request);
  if (actual.verificationNativeGate || impact.changes.some(row => row.checks.includes("admin-adoption"))) {
    assert.ok(nativeGate, "Native coverage requires the actually selected complete fresh Admin tail.");
    assert.deepEqual(actual.verificationNativeGate, nativeGate, "Coverage must bind the selected native gate descriptor.");
  }
  for (const input of [impact, actual]) {
    assert.match(input.baselineHead, /^[a-f0-9]{40}$/u); assert.match(input.finalHead, /^[a-f0-9]{40}$/u);
    assert.match(input.sourceSha256, /^[a-f0-9]{64}$/u);
    assert.ok(Array.isArray(input.changes) && input.changes.length > 0, "A risk record must cover a nonempty batch.");
    assert.equal(new Set(input.changes.map(row => row.file)).size, input.changes.length, "Changed files must be unique.");
  }
  assert.equal(impact.baselineHead, actual.baselineHead); assert.equal(impact.finalHead, actual.finalHead);
  assert.equal(impact.sourceSha256, actual.sourceSha256, "Risk evidence must bind the actual source snapshot.");
  const bindings = (rows: LocalVerificationInputs["changes"]) => rows.map(({ file, beforeSha256, afterSha256 }) =>
    ({ file, beforeSha256, afterSha256 })).sort((a, b) => a.file.localeCompare(b.file));
  assert.deepEqual(bindings(impact.changes), bindings(actual.changes), "Risk evidence must cover every actual changed file and byte identity.");
  assertLocalVerificationProtectionMaintenance(impact, actual);
  assert.deepEqual((actual.changeImpact?.qaQuality ?? []).flatMap(row => row.failures.map(reason => ({ file: row.file, reason }))), [],
    "QA assertion coverage decreased; preserve the original assertions or obtain explicit protection review before admission.");
  const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const risks = ["A", "B", "C", "D", "E"] as const;
  let rank = 0, bounded = true;
  const selected = new Set<string>(["lint", "typecheck"]);
  const unresolvedVerificationInputs: string[] = [];
  for (const discovery of actual.changeImpact?.changes ?? []) if (discovery.unresolved.length) bounded = false;
  if (actual.changeImpact?.obligations.some(obligation => /(?:^|[\/._-])contracts?(?:[\/._-]|$)/iu.test(obligation.file)
    || /(?:^|\/)adoption-manifest\.[cm]?ts$/u.test(obligation.file))) rank = Math.max(rank, 2);
  for (const row of impact.changes) {
    assert.ok(sourceIncluded(row.file), "Risk evidence cannot include private or generated source.");
    for (const sha of [row.beforeSha256, row.afterSha256]) if (sha !== null) assert.match(sha, /^[a-f0-9]{64}$/u);
    assert.notEqual(row.beforeSha256, row.afterSha256, "A changed file must have different before/after bytes.");
    const level = risks.indexOf(row.risk); assert.ok(level >= 0, "Unknown risk class cannot select a bounded gate.");
    rank = Math.max(rank, level);
    // Conservative floors only raise risk. They are not a complete semantic/dependency classifier.
    if (/(?:^|\/)(?:sql|migrations)(?:\/|$)|\.sql$/iu.test(row.file) ||
      /(?:^|[\/._-])(?:auth|authentication|authorization|rls|permissions?)(?:[\/._-]|$)/iu.test(row.file)) rank = Math.max(rank, 3);
    if (/^\.github\//u.test(row.file) || /^(?:package(?:-lock)?\.json|tsconfig(?:\.[^/]+)?\.json|(?:next|eslint|postcss|tailwind)\.config\.[^/]+|vercel\.json)$/u.test(row.file) ||
      /^scripts\/(?:lib\/(?:isolated-|verification-|typescript-executable-graph)|verify-(?:isolated-supabase|verification-infrastructure)\.)/u.test(row.file)) rank = 4;
    assert.ok([row.owner, row.reviewedBy, row.rationale].every(present), "Every change requires an explicit owner review.");
    for (const list of [row.contracts, row.consumers, row.checks]) {
      assert.ok(Array.isArray(list) && list.length > 0 && list.every(present), "Every changed input requires contracts, consumers and fresh covering checks.");
      assert.equal(new Set(list).size, list.length);
    }
    bounded &&= row.bounded === true && row.nonImportImpactReviewed === true;
    if (row.risk === "B") bounded &&= Boolean(row.adoption &&
      [row.adoption.applicabilityEvidence, row.adoption.sourceProofEvidence, row.adoption.consumerEvidence]
        .every(check => present(check) && check !== "lint" && check !== "typecheck" && row.checks.includes(check)));
    for (const check of row.checks) {
      assert.ok(check === nativeGate?.name || /^(?:lint|typecheck|(?:verify|qa):[a-zA-Z0-9:_-]+)$/u.test(check) && Object.hasOwn(scripts, check),
        "Covering checks must be existing named verification commands.");
      assert.ok(!["build", "verify:product-surface-identity-build", "verify:platform-contracts", "test:e2e:public"].includes(check),
        "Canonical Public gates belong to the unchanged tail.");
      if (check !== nativeGate?.name) selected.add(check);
    }
    if (/^(?:scripts|tests)\//u.test(row.file)) {
      assert.ok(row.checks.some(check => check !== "lint" && check !== "typecheck"), "Changed verification inputs require a fresh executable check.");
      const covered = Boolean(actual.verificationCoverage?.some(coverage => coverage.file === row.file &&
        coverage.checks.some(check => row.checks.includes(check) || check === "test:e2e:public")));
      if (!covered) unresolvedVerificationInputs.push(row.file);
      bounded &&= covered;
    }
  }
  assert.ok(Object.hasOwn(scripts, "lint") && Object.hasOwn(scripts, "typecheck"));
  const mode = rank <= 1 && bounded ? "bounded" : "full";
  const coveredChains = fullPrefix.map(check => localVerificationCommandSteps(scripts, check)).filter((chain): chain is string[] => Boolean(chain));
  const invokedChecks = new Set<string>();
  const collectInvocations = (name: string, active = new Set<string>()) => {
    if (active.has(name) || !localVerificationCommandSteps(scripts, name)) return;
    const next = new Set([...active, name]);
    for (const step of scripts[name].split("&&")) {
      const nested = /^npm run ([a-zA-Z0-9:_-]+)$/u.exec(step.trim());
      if (nested) { invokedChecks.add(nested[1]); collectInvocations(nested[1], next); }
    }
  };
  for (const check of fullPrefix) collectInvocations(check);
  const redundantAdditionalChecks = mode === "full" ? [...selected].filter(check => {
    if (fullPrefix.includes(check) || !invokedChecks.has(check)) return false;
    const additional = localVerificationCommandSteps(scripts, check);
    return Boolean(additional && coveredChains.some(chain => chain.some((_, index) => additional.every((step, offset) => chain[index + offset] === step))));
  }) : [];
  const prefix = mode === "bounded" ? [...selected] : [...new Set([...fullPrefix, ...[...selected].filter(check => !redundantAdditionalChecks.includes(check))])];
  return { risk: risks[rank], mode, prefix, tail: GATES.map(gate => gate.name), unresolvedVerificationInputs,
    redundantAdditionalChecks,
    ...(actual.changeImpact ? { changeImpact: actual.changeImpact } : {}),
    fast: { profile: "fast" as const, prefix: [...selected], tail: [], releaseEvidence: false as const },
    ...(nativeGate ? { nativeGate } : {}) };
}

/** Bounded requests cannot borrow an older subset/retained/measurement admission. */
export function assertLocalVerificationRequest(request: PublicGateRequest, plan: ReturnType<typeof planLocalVerification>) {
  assert.ok(request.localVerification);
  assert.ok(!("profile" in plan) && !("releaseEvidence" in plan), "A Fast report cannot authorize release execution.");
  if (plan.nativeGate) assert.deepEqual(localVerificationNativeGate(request), plan.nativeGate,
    "Native tail coverage cannot be borrowed by a different request, script, cohort or argument selection.");
  assert.deepEqual(plan.unresolvedVerificationInputs, [],
    "Full Gate selection alone cannot prove an affected verification input executes; supply positive coverage or stop.");
  if (plan.mode === "full") {
    assert.equal(request.finalQualityGate, true, "Unbounded/high-risk impact requires the existing Full Local Gate admission.");
    return;
  }
  for (const key of ["finalQualityGate", "selection", "retainedAdminBehaviorAdmissionSha256", "heroCompatibilityFinalHead",
    "adoptionScope", "adoptionCohort", "adoptionJourneySelection", "adminMeasurement"] as const)
    assert.equal(request[key], undefined, "Bounded verification cannot combine with a legacy subset or retained evidence mode.");
}

/** Bind reviewed impact to Git's actual delta and source bytes; Git remains the membership owner. */
function readLocalVerificationInputs(context: Pick<PrivatePublicVerificationContext, "cleanEnvironment">, impact: LocalVerificationImpact,
  manifest: readonly { file: string; sha256: string }[], additionalSourceFiles: readonly string[], request: PublicGateRequest, previous?: LocalVerificationInputs): LocalVerificationInputs {
  assert.match(impact.baselineHead, /^[a-f0-9]{40}$/u);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, env: context.cleanEnvironment(),
    windowsHide: true, timeout: 30_000, maxBuffer: 32_000_000, stdio: ["ignore", "pipe", "pipe"] });
  const finalHead = git("rev-parse", "HEAD").toString("utf8").trim();
  if (!previous) {
    assert.equal(git("rev-parse", "--verify", impact.baselineHead + "^{commit}").toString("utf8").trim(), impact.baselineHead);
    git("merge-base", "--is-ancestor", impact.baselineHead, finalHead);
  }
  const baselineFiles = previous ? undefined : new Set(git("ls-tree", "-r", "--name-only", "-z", impact.baselineHead).toString("utf8").split("\0").filter(Boolean));
  const changed = new Set([...git("diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--name-only", "-z", impact.baselineHead, "--").toString("utf8").split("\0").filter(Boolean), ...additionalSourceFiles]);
  if (previous) assert.deepEqual([...changed].sort(), previous.changes.map(row => row.file));
  // The verified immutable baseline blob supplies both its digest and discovery bytes in this invocation.
  const baselineBytes = new Map<string, ReturnType<typeof git>>();
  const changes = [...changed].sort().map(file => {
    const source = safeSourcePath(file), exists = existsSync(source);
    if (exists) {
      assert.ok(lstatSync(source).isFile() && realpathSync(source) === source, "Changed source cannot traverse a symlink or junction.");
    }
    const afterSha256 = exists ? digest(readFileSync(source)) : null;
    if (exists) assert.equal(manifest.find(row => row.file === file)?.sha256, afterSha256, "The source snapshot omits or differs from changed source.");
    if (!previous && baselineFiles!.has(file)) baselineBytes.set(file, git("show", impact.baselineHead + ":" + file));
    return { file, beforeSha256: previous ? previous.changes.find(row => row.file === file)!.beforeSha256 : baselineBytes.has(file) ? digest(baselineBytes.get(file)!) : null,
      afterSha256 };
  });
  const scripts = JSON.parse(readFileSync(safeSourcePath("package.json"), "utf8")).scripts as Record<string, string>;
  const verificationNativeGate = localVerificationNativeGate(request);
  if (previous) assert.deepEqual(verificationNativeGate, previous.verificationNativeGate, "Cached executable coverage cannot change its selected native tail.");
  const sourceSha256 = digest(JSON.stringify(manifest));
  if (previous) assert.equal(sourceSha256, previous.sourceSha256, "Cached source discovery cannot survive a changed source manifest.");
  const admissionQualification = request.admissionQualification;
  const qualifiedInvocation = admissionQualification ? assertLocalVerificationAdmissionQualification(admissionQualification,
    { baselineHead: impact.baselineHead, finalHead, sourceSha256 }) : undefined;
  if (qualifiedInvocation) {
    assert.deepEqual(qualifiedInvocation.sourceDiscovery.additionalSourceFiles, [...additionalSourceFiles],
      "Preallocation source discovery cannot change its explicit additional files even when their bytes are already tracked.");
    assert.deepEqual(qualifiedInvocation.sourceDiscovery.changes, changes,
      "Preallocation source discovery differs from the current exact Git and explicit-file delta.");
  }
  if (previous) assert.equal(admissionQualification, previous.admissionQualification, "Admission cannot change during an active verification.");
  const verificationCoverage = previous?.verificationCoverage ?? localVerificationCoverage(scripts, impact, manifest, request).map(row => ({
    ...row, checks: [...new Set([...row.checks, ...(admissionQualification?.inputs?.coverage ?? [])
      .filter(binding => binding.file === row.file && impact.changes.some(change => change.file === row.file && change.checks.includes(binding.check))
        && registeredVerificationNodeEntries(scripts, binding.check).includes(binding.entry))
      .map(binding => binding.check)])].sort(),
  }));
  const changeImpact = previous?.changeImpact ?? (() => {
    // Reuse only this owner's private, source-bound pure discovery. The current
    // request's coverage/native descriptor and live evidence are checked above.
    // Every returned discovery is cloned; a caller cannot mutate the private fact.
    const discovery = qualifiedInvocation ? structuredClone(qualifiedInvocation.sourceDiscovery.changeImpact) : (() => {
    const currentSources = new Map(manifest.map(row => { const source = readFileSync(safeSourcePath(row.file)); assert.equal(digest(source), row.sha256,
      "Impact source differs from the bound manifest: " + row.file); return [row.file, source] as const; }));
    const baselineSources = new Map(currentSources);
    for (const change of changes) {
      if (change.beforeSha256 === null) baselineSources.delete(change.file);
      else baselineSources.set(change.file, baselineBytes.get(change.file)!);
    }
    return deriveLocalVerificationSourceImpact(scripts, changes, currentSources, baselineSources);
    })();
    if (!admissionQualification) return discovery;
    assert.equal(admissionQualification.assertions?.status, "PASS");
    const relocations = admissionQualification.assertions.relocations;
    return { ...discovery, qaQuality: discovery.qaQuality?.map(row => {
      const proofs = relocations.filter(proof => proof.file === row.file);
      const providers = admissionQualification.assertions!.providers.filter(proof => proof.file === row.file);
      return proofs.length || providers.length ? { ...row, rawFailures: row.failures, failures: row.failures.filter(reason =>
        !(proofs.length && ["qa_assertion_count_decreased_requires_explicit_protection_review", "qa_assertion_owner_or_operator_coverage_decreased_requires_explicit_protection_review"].includes(reason))
        && reason !== "qa_assertion_relocation_requires_qualified_execution"),
        qualifiedRelocation: { predicates: proofs, providers } } : row;
    }) };
  })();
  return { baselineHead: impact.baselineHead, finalHead, sourceSha256, changes, verificationCoverage,
    changeImpact, ...(admissionQualification ? { admissionQualification } : {}),
    ...(verificationNativeGate ? { verificationNativeGate } : {}) };
}

/** Revalidation is deliberately separate from pure source discovery. */
function assertLocalVerificationAdmissionQualification(value: LocalVerificationAdmissionQualification,
  binding: { baselineHead: string; finalHead: string; sourceSha256: string }) {
  const invocation = localVerificationAdmissionInvocations.get(value);
  assert.ok(invocation, "Admission requires this owner's live qualified execution; serialized or old receipts cannot authorize it.");
  assert.equal(value.status, "PASS");
  assert.equal(digest(JSON.stringify(value)), invocation.sha256, "Admission receipt was altered after qualification.");
  assert.equal(digest(JSON.stringify(invocation.sourceFloor)), invocation.sourceFloorSha256, "Private ordered source floor was altered after qualification.");
  for (const key of ["baselineHead", "finalHead", "sourceSha256"] as const) assert.equal(value[key], binding[key], "Admission receipt has a stale source or baseline.");
  const current = invocation.snapshot();
  assert.equal(current.finalHead, binding.finalHead); assert.equal(current.sourceSha256, binding.sourceSha256);
  assert.deepEqual(current.runtime, value.runtime, "Admission runtime or dependency bytes changed.");
  assert.ok(invocation.sourceDiscovery, "Live admission lacks its private preallocation source discovery; cold analysis on an active control connection is forbidden.");
  assert.equal(digest(JSON.stringify(invocation.sourceDiscovery)), invocation.sourceDiscoverySha256,
    "Private preallocation source discovery is missing or corrupt.");
  for (const key of ["baselineHead", "finalHead", "sourceSha256"] as const)
    assert.equal(invocation.sourceDiscovery[key], binding[key], "Private preallocation source discovery has a stale binding.");
  for (const artifact of value.artifacts) {
    const file = resolve(ROOT, artifact.path);
    assert.ok(artifact.path.startsWith(".tmp-qa/") && !artifact.path.split("/").some(part => part === ".." || !part)
      && file.startsWith(resolve(ROOT, ".tmp-qa") + sep), "Admission artifact escaped owned evidence.");
    assert.ok(lstatSync(file).isFile() && realpathSync(file) === file, "Admission artifact cannot traverse links.");
    assert.equal(digest(readFileSync(file)), artifact.sha256, "Admission artifact is missing or corrupt.");
  }
  return invocation;
}

/** Execute only the existing finite consumer/input profiles under the existing child owner.
 * No Docker, DB, Browser, release result or caller-supplied receipt is accepted here. */
export async function qualifyLocalVerificationAdmission(options: { baselineHead?: string; additionalSourceFiles?: readonly string[];
  operationalBudget?: LocalVerificationOperationalBudget;
  ci?: { eventName: string; event: unknown; githubSha: string } }, signal: AbortSignal): Promise<LocalVerificationAdmissionQualification> {
  signal.throwIfAborted();
  const operationalBudget = options.operationalBudget;
  const admissionDeadlineMs = localVerificationOperationalDeadlineMs(300_000, operationalBudget);
  const started = performance.now(), nonce = globalThis.crypto.randomUUID();
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"])
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, env: environment, windowsHide: true,
    timeout: 30_000, maxBuffer: 32_000_000, stdio: ["ignore", "pipe", "pipe"] });
  if (operationalBudget !== undefined) git("merge-base", "--is-ancestor", "9edaf02f4cd476315d71b306d5f786f3d8d1efd0", "HEAD");
  // Reuse immutable CI baseline selection. Its source-only DRIFT is diagnostic,
  // never permission to omit the fresh behavioral qualification below.
  const additional = [...(options.additionalSourceFiles ?? [])];
  const initial = inspectLocalVerificationChangeImpact({ ...options, additionalSourceFiles: additional, automatic: true });
  assert.ok("baselineHead" in initial && initial.baselineHead && initial.changeImpact,
    "Admission qualification requires a resolved immutable baseline and source discovery.");
  assert.ok("fast" in initial && initial.fast.correspondence.every(row => row.protected),
    "Admission observations cannot repair missing source contract protection.");
  const baselineHead = initial.baselineHead;
  const sourceSnapshot = () => {
    const manifest = selectSourceInventory(git("ls-files", "-z").toString("utf8").split("\0").filter(Boolean), additional).flatMap(file => {
      const absolute = safeSourcePath(file); if (!existsSync(absolute)) return [];
      assert.ok(lstatSync(absolute).isFile() && realpathSync(absolute) === absolute, "Admission source cannot traverse links.");
      return [{ file, sha256: digest(readFileSync(absolute)) }];
    });
    return { finalHead: git("rev-parse", "HEAD").toString("utf8").trim(), sourceSha256: digest(JSON.stringify(manifest)), manifest };
  };
  const before = sourceSnapshot();
  assert.equal(before.finalHead, initial.finalHead); assert.equal(before.sourceSha256, initial.sourceSha256);
  const currentSources = new Map(before.manifest.map(row => {
    const bytes = readFileSync(safeSourcePath(row.file)); assert.equal(digest(bytes), row.sha256); return [row.file, bytes] as const;
  }));
  const baselineSources = new Map(currentSources);
  for (const change of initial.actualDelta) {
    if (change.beforeSha256 === null) baselineSources.delete(change.file);
    else { const bytes = git("show", baselineHead + ":" + change.file); assert.equal(digest(bytes), change.beforeSha256); baselineSources.set(change.file, bytes); }
  }
  const profiles = [
    { entry: "scripts/verify-admin-form-system.mts", args: ["--field-row-composition"], receipt: "assertion-relocation-observations" },
    { entry: "scripts/verify-page-block-editor-presentation.mts", args: ["--panel-composition"], receipt: "assertion-relocation-observations" },
    { entry: "scripts/verify-isolated-supabase.mts", args: ["--admission-qualification-only"], receipt: "verification-input-observations" },
  ];
  assert.equal(new Set(profiles.map(profile => [profile.entry, ...profile.args].join(" "))).size, profiles.length, "Admission cannot execute a duplicate leaf.");
  const scripts = JSON.parse(currentSources.get("package.json")!.toString()).scripts as Record<string, string>;
  for (const profile of profiles) assert.ok(Object.keys(scripts).some(check => {
    try { return registeredVerificationNodeEntries(scripts, check).includes(profile.entry); } catch { return false; }
  }), "Admission profile must use an existing registered executable owner.");
  const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: profiles.map(profile => profile.entry),
    sourceOverrides: new Map([...currentSources].filter(([file]) => /\.[cm]?[jt]sx?$/u.test(file)).map(([file, bytes]) => [file, bytes.toString()])),
    symbolAware: false, nativeEagerImports: true });
  const packageNames = new Set<string>(["typescript", "react", "react-dom"]);
  for (const tree of graph.values()) {
    const visit = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (!specifier.startsWith(".") && !nodeModule.isBuiltin(specifier)) {
          assert.ok(!/^(?:@\/|@src\/|file:|https?:|\/|[A-Za-z]:)/u.test(specifier), "Admission has an unresolved native module alias.");
          const parts = specifier.split("/"); packageNames.add(parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
        }
      }
      ts.forEachChild(node, visit);
    }; visit(tree);
  }
  const runtime = localVerificationAdmissionRuntimeIdentity(packageNames);
  const snapshot = () => { const source = sourceSnapshot(); return { finalHead: source.finalHead, sourceSha256: source.sourceSha256,
    runtime: localVerificationAdmissionRuntimeIdentity(packageNames) }; };
  const assertSnapshot = () => assert.deepEqual(snapshot(), { finalHead: before.finalHead, sourceSha256: before.sourceSha256, runtime },
    "Admission source, dependency or runtime closure changed during execution.");
  const evidenceRoot = resolve(ROOT, ".tmp-qa"); mkdirSync(evidenceRoot, { recursive: true });
  assert.equal(realpathSync(evidenceRoot), evidenceRoot, "Admission evidence cannot traverse links.");
  const runDirectory = realpathSync(mkdtempSync(join(evidenceRoot, "admission-qualification-")));
  const context = { runDirectory, sanitize: (value: string) => value, cleanEnvironment: () => ({ ...environment }) };
  const children = new Set<ChildProcess>(), executions: Array<LocalVerificationAdmissionQualification["executions"][number]> = [];
  const assertionsRaw: unknown[] = [], artifacts = new Map<string, string>(), failures: string[] = [];
  let inputRaw: LocalVerificationInputObservations | undefined;
  let assertions: LocalVerificationAdmissionQualification["assertions"] = null, inputs: LocalVerificationAdmissionQualification["inputs"] = null;
  let sourceFloor: Awaited<ReturnType<typeof runLocalVerificationSourceFloor>> | undefined;
  const addArtifact = (absolute: string, expected?: string) => {
    assert.ok(absolute.startsWith(evidenceRoot + sep) && lstatSync(absolute).isFile() && realpathSync(absolute) === absolute,
      "Admission artifact is not an owned regular evidence file.");
    const relative = absolute.slice(ROOT.length + 1).replaceAll("\\", "/"), sha256 = digest(readFileSync(absolute));
    if (expected !== undefined) assert.equal(sha256, expected, "Admission raw artifact fingerprint differs.");
    const prior = artifacts.get(relative); assert.ok(prior === undefined || prior === sha256, "Admission evidence changed before preservation.");
    artifacts.set(relative, sha256);
  };
  const validateChild = (result: Awaited<ReturnType<typeof runOwnedVerificationChild>>) => {
    assert.equal(result.code, 0); assert.deepEqual(result.rawExit, { code: 0, signal: null });
    assert.equal(result.cleanup.status, "PASS"); assert.equal(result.cleanup.liveProcesses, 0); assert.equal(result.cleanup.processTreeVerified, true);
    if (process.platform === "win32") {
      const identity = result.nativeJobIdentity, native = result.nativeJobReceipt;
      assert.ok(identity && native && result.nativeCapability);
      assert.equal(identity.ownerJobAssignedBeforeResume, true); assert.equal(identity.jobHandleNonInheritable, true);
      assert.equal(identity.effectiveLimitFlags, 0x2000); assert.ok(identity.jobBeforeResume.processIds.includes(identity.rootPid));
      assert.equal(native.jobToken, identity.jobToken); assert.equal(native.rootPid, identity.rootPid);
      assert.equal(native.status, "PASS"); assert.equal(native.reason, "completed"); assert.equal(native.rootExitCode, 0);
      assert.deepEqual(result.helperExit, { code: 0, signal: null }); assert.equal(native.nativeFailure, null);
      assert.equal(native.cleanup.activeProcessesAfterCleanup, 0); assert.deepEqual(native.cleanup.activeProcessIdsAfterCleanup, []);
      assert.equal(native.cleanup.rootHandleExited, true); assert.equal(native.cleanup.jobHandleClosed, true);
      assert.equal(result.nativeCapability.sourceSha256, digest(currentSources.get("scripts/lib/windows-owned-process.cs")!));
    } else assert.equal(process.platform, "linux", "Admission cleanup is unqualified for this platform.");
  };
  try {
    const targets = "qualifiedTargets" in initial ? initial.qualifiedTargets : undefined;
    const governanceQualified = targets ? targets.selections.every(selection => !selection.selected || selection.qualified)
      : !initial.actualDelta.some(change => /^(?:scripts|tests)\//u.test(change.file));
    receipt(context, "governance-qualification.json", { status: governanceQualified ? "PASS" : "BLOCKED", proofBoundary: "source_effect_eligibility_only",
      baselineHead, finalHead: before.finalHead, sourceSha256: before.sourceSha256,
      selections: targets?.selections.map(({ family, selected, qualified, reason }) => ({ family, selected, qualified, reason })) ?? [],
      blocking: targets?.blocking ?? [],
      sourceGuardEffects: "sourceGuardEffects" in initial ? initial.sourceGuardEffects.map(({ entry, fingerprint, unresolved }) => ({ entry, fingerprint, unresolved })) : [] });
    sourceFloor = await runLocalVerificationSourceFloor({ sourceDirectory: ROOT, context, signal, sources: currentSources,
      operationalBudget,
      changedFiles: initial.actualDelta.map(change => change.file), verifySource: assertSnapshot,
      governance: targets?.targets.filter(target => target.kind === "source_guard") ?? [],
      governanceQualified });
    for (const [index, profile] of profiles.entries()) {
      signal.throwIfAborted(); assertSnapshot();
      const args = ["--experimental-strip-types", profile.entry, ...profile.args];
      const env = { ...environment, VENESIA_QA_ASSERTION_RELOCATION_RECEIPT: "1", VENESIA_QA_ASSERTION_RELOCATION_NONCE: nonce,
        VENESIA_QA_ADMISSION_NONCE: nonce };
      const result = await runOwnedVerificationChild({ sourceDirectory: ROOT, context, children, signal }, args, env, "admission-" + (index + 1), admissionDeadlineMs);
      executions.push({ entry: profile.entry, args, result }); validateChild(result); assertSnapshot();
      let raw: unknown;
      if (profile.receipt === "assertion-relocation-observations") {
        const lines = result.stdout.split(/\r?\n/u).filter(line => line.startsWith("{")).flatMap(line => {
          try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
        }).filter(value => value.kind === profile.receipt);
        assert.equal(lines.length, 1, "The actual consumer must emit exactly one successful observation envelope."); raw = lines[0];
        assert.equal((raw as Record<string, unknown>).consumer, profile.entry); assertionsRaw.push(raw);
      } else {
        const envelope = JSON.parse(result.stdout) as { status: unknown; rawObservations: LocalVerificationInputObservations };
        assert.equal(envelope.status, "PASS"); inputRaw = envelope.rawObservations; raw = inputRaw;
        assert.equal(inputRaw.entry, profile.entry);
        for (const artifact of inputRaw.artifacts) addArtifact(resolve(ROOT, artifact.path), artifact.sha256);
      }
      assert.ok(raw && typeof raw === "object" && !Array.isArray(raw));
      assert.equal((raw as Record<string, unknown>).schema, 1); assert.equal((raw as Record<string, unknown>).nonce, nonce,
        "Missing or stale observations cannot prove this invocation.");
    }
    assertions = validateLocalVerificationAssertionRelocations({ baselineSources, currentSources, observations: [...assertionsRaw, inputRaw] });
    inputs = validateLocalVerificationInputObservations({ sources: currentSources, observations: inputRaw });
    assert.equal(assertions.status, "PASS", "Original predicates lack qualified source/execution correspondence.");
    assert.equal(inputs.status, "PASS", "Four verification inputs lack qualified actual-consumer evidence.");
    assertSnapshot();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Admission qualification failed.");
    if (sourceFloor && error instanceof Error && "childResult" in error) executions.push({ entry: profiles[executions.length]?.entry ?? "unknown",
      args: profiles[executions.length]?.args ?? [], result: error.childResult });
  } finally {
    for (const child of children) {
      try { await stopChild(child, environment, "owner_shutdown"); children.delete(child); }
      catch (error) { failures.push(error instanceof Error ? error.message : "Admission cleanup failed."); }
    }
    if (children.size) failures.push("Admission retained an undrained owned child.");
  }
  const collect = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name), stat = lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, "Admission evidence contains an unqualified link.");
      if (stat.isDirectory()) collect(absolute); else addArtifact(absolute);
    }
  };
  try { collect(runDirectory); } catch (error) { failures.push(error instanceof Error ? error.message : "Admission evidence preservation failed."); }
  const value: LocalVerificationAdmissionQualification = { schema: 1, kind: "owned-admission-qualification", nonce,
    ...(operationalBudget === undefined ? {} : { operationalBudget }),
    status: failures.length ? "BLOCKED" : "PASS", baselineHead, finalHead: before.finalHead, sourceSha256: before.sourceSha256,
    runtime, executions, assertions, inputs, artifacts: [...artifacts].sort(([left], [right]) => left.localeCompare(right)).map(([path, sha256]) => ({ path, sha256 })),
    failures, runDirectory, durationMs: performance.now() - started, behavioralPass: false, releaseEvidence: false };
  receipt(context, "admission-result.json", value);
  if (value.status === "PASS") {
    assert.ok(sourceFloor, "Admission cannot pass without its ordered source floor.");
    const sourceDiscovery = structuredClone({ baselineHead, finalHead: before.finalHead, sourceSha256: before.sourceSha256,
      additionalSourceFiles: [...additional], changes: initial.actualDelta, changeImpact: initial.changeImpact });
    localVerificationAdmissionInvocations.set(value, { sha256: digest(JSON.stringify(value)), snapshot, sourceFloor, sourceFloorSha256: digest(JSON.stringify(sourceFloor)),
      sourceDiscovery, sourceDiscoverySha256: digest(JSON.stringify(sourceDiscovery)) });
  }
  return value;
}

/** Read-only source consistency entry: no owned lifecycle, fixture, Browser, database or verification check starts. */
export function inspectLocalVerificationChangeImpact(options: { baselineHead?: string; additionalSourceFiles?: readonly string[]; impact?: LocalVerificationImpact;
  automatic?: boolean; ci?: { eventName: string; event: unknown; githubSha: string }; admissionQualification?: LocalVerificationAdmissionQualification }) {
  const inspectionStarted = performance.now();
  const timings = { sourceSnapshotAndHashMs: 0, sourceDiscoveryMs: 0, contractCoherenceMs: 0, totalMs: 0 };
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT"]) if (process.env[key] !== undefined) environment[key] = process.env[key];
  const context = { cleanEnvironment: () => ({ ...environment }) };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, env: context.cleanEnvironment(), windowsHide: true,
    timeout: 30_000, maxBuffer: 32_000_000, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  const checkoutHead = git("rev-parse", "HEAD").trim();
  let baselineHead = options.baselineHead;
  if (options.ci) {
    assert.equal(options.automatic, true, "CI source selection requires automatic source coherence.");
    assert.equal(options.impact, undefined, "CI source coherence cannot fabricate or borrow local approval records.");
    assert.deepEqual(options.additionalSourceFiles ?? [], [], "CI source selection accepts committed source only.");
    let lastCommitLookup: string | undefined, lastCommitProbe: { sha: string; exitCode: number | null; identity: string | null } | undefined;
    const exitStatus = (failure: unknown) => failure !== null && typeof failure === "object" && "status" in failure && typeof failure.status === "number" ? failure.status : null;
    const history = { exists: (sha: string) => {
      lastCommitLookup = sha;
      try { const identity = git("rev-parse", "--verify", sha + "^{commit}").trim(); lastCommitProbe = { sha, exitCode: 0, identity }; return identity === sha; }
      catch (failure) { lastCommitProbe = { sha, exitCode: exitStatus(failure), identity: null }; return false; }
    },
      isAncestor: (ancestor: string, descendant: string) => { try { git("merge-base", "--is-ancestor", ancestor, descendant); return true; } catch { return false; } },
      parents: (sha: string) => git("show", "--no-patch", "--format=%P", sha, "--").trim().split(/\s+/u).filter(Boolean) };
    try { baselineHead = resolveLocalVerificationCiBaseline({ ...options.ci, checkoutHead }, history).baselineHead; }
    catch (error) {
      const ciBinding = localVerificationCiDiagnostic({ ...options.ci, checkoutHead, ...(lastCommitLookup ? { lastCommitLookup } : {}), ...(lastCommitProbe ? { lastCommitProbe } : {}) }, (operation, sha, descendant) => {
        const commands = { identity: ["rev-parse", "--verify", sha + "^{commit}"], objectType: ["cat-file", "-t", sha],
          parents: ["show", "--no-patch", "--format=%P", sha, "--"], ancestry: ["merge-base", "--is-ancestor", sha, descendant!] };
        try { return { exitCode: 0, output: git(...commands[operation]) }; }
        catch (failure) { return { exitCode: exitStatus(failure), output: "" }; }
      });
      return { status: "BLOCKED_SOURCE_CONSISTENCY", exitCode: 1, releaseEvidence: false, checksExecuted: 0, browserExecuted: false,
        databaseCalls: 0, networkRequests: 0, diagnostic: error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Invalid CI source admission.", ciBinding,
        timings: { ...timings, totalMs: performance.now() - inspectionStarted } };
    }
    git("diff", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--");
  }
  assert.ok(baselineHead && /^[a-f0-9]{40}$/u.test(baselineHead), "An explicit immutable impact baseline is required.");
  const tracked = git("ls-files", "-z").split("\0").filter(Boolean), additional = [...(options.additionalSourceFiles ?? [])];
  const files = selectSourceInventory(tracked, additional);
  for (const file of additional) assert.ok(existsSync(safeSourcePath(file)), "Explicit additional source is missing: " + file);
  const snapshotStarted = performance.now();
  const manifest = files.flatMap(file => {
    const path = safeSourcePath(file); if (!existsSync(path)) return [];
    assert.ok(lstatSync(path).isFile() && realpathSync(path) === path, "Impact source cannot traverse a symlink or junction: " + file);
    return [{ file, sha256: digest(readFileSync(path)) }];
  });
  const sourceSha256 = digest(JSON.stringify(manifest));
  timings.sourceSnapshotAndHashMs = performance.now() - snapshotStarted;
  const finalHead = git("rev-parse", "HEAD").trim();
  const impact = options.impact ?? { baselineHead, finalHead, sourceSha256, changes: [] };
  assert.equal(impact.baselineHead, baselineHead, "The reviewed impact baseline differs from the explicitly requested baseline.");
  const discoveryStarted = performance.now();
  const actual = readLocalVerificationInputs(context, impact, manifest, additional, { additionalSourceFiles: additional,
    ...(options.admissionQualification ? { admissionQualification: options.admissionQualification } : {}) });
  timings.sourceDiscoveryMs = performance.now() - discoveryStarted;
  // Discovery includes Git binding, graph and assertion analysis; timing never authorizes coverage or changes its identity.
  const measuredTimings = () => ({ ...timings, totalMs: performance.now() - inspectionStarted });
  const base = { baselineHead: actual.baselineHead, finalHead: actual.finalHead, sourceSha256: actual.sourceSha256,
    actualDelta: actual.changes, changeImpact: actual.changeImpact, releaseEvidence: false as const,
    proofBoundary: "source_discovery_only" as const, checksExecuted: 0, browserExecuted: false, databaseCalls: 0, networkRequests: 0,
    admissionQualification: actual.admissionQualification ?? null };
  if (options.automatic) {
    assert.equal(options.impact, undefined, "Automatic source coherence cannot replace reviewed local admission.");
    const scripts = JSON.parse(readFileSync(safeSourcePath("package.json"), "utf8")).scripts as Record<string, string>;
    const coherenceStarted = performance.now();
    const coherence = deriveLocalVerificationSourceCoherence(scripts, actual);
    timings.contractCoherenceMs = performance.now() - coherenceStarted;
    const sourceBytes = new Map(manifest.map(row => { const bytes = readFileSync(safeSourcePath(row.file));
      assert.equal(digest(bytes), row.sha256, "Source effect closure snapshot changed: " + row.file); return [row.file, bytes] as const; }));
    const sourceGuardEffects = ["scripts/verify-executable-governance.mts", "scripts/verify-verification-infrastructure.mts"]
      .map(entry => localVerificationSourceGuardEffects(entry, sourceBytes));
    const qualifiedTargets = qualifyLocalVerificationTargets(scripts, actual.changeImpact!, digest(readFileSync(safeSourcePath("scripts/qa-admin-form-guarded-navigation.mts"), "utf8").replaceAll("\r\n", "\n")),
      Object.fromEntries(sourceGuardEffects.map(effect => [effect.entry, effect.fingerprint ?? ""])));
    return { ...base, ...coherence, checksExecuted: coherence.fast.checksExecuted, candidateCommandsExecuted: 0,
      qualifiedTargets, sourceGuardEffects,
      ciBinding: options.ci ? { eventName: options.ci.eventName, checkoutHead } : null, timings: measuredTimings() };
  }
  if (!options.impact) return { ...base, status: actual.changeImpact!.obligations.length ? "DRIFT" : "REVIEW_REQUIRED", exitCode: 2,
    diagnostics: actual.changeImpact!.obligations.map(obligation => `file=${obligation.file}; owner=${obligation.owner}; contract=${obligation.contract}; reviewed protection maintenance is required.`), timings: measuredTimings() };
  try {
    const scripts = JSON.parse(readFileSync(safeSourcePath("package.json"), "utf8")).scripts as Record<string, string>;
    const coherenceStarted = performance.now();
    const plan = planLocalVerification(scripts, impact, actual);
    timings.contractCoherenceMs = performance.now() - coherenceStarted;
    assert.deepEqual(plan.unresolvedVerificationInputs, [], "Source consistency requires positive executable coverage for every changed verification input.");
    return { ...base, status: "PASS_SOURCE_CONSISTENCY", exitCode: 0, plan,
      diagnostics: ["Source consistency only. Selected checks have not executed; behavior and release readiness remain unverified."], timings: measuredTimings() };
  } catch (error) {
    return { ...base, status: "DRIFT", exitCode: 2, diagnostics: [error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Invalid reviewed source consistency evidence."], timings: measuredTimings() };
  }
}

/** A later PASS cannot overwrite an earlier terminal failure from the same immutable leaf. */
export function localVerificationFamilyReceipt(stdout: string, family: string) {
  const matching: Record<string, unknown>[] = [];
  for (const line of stdout.split(/\r?\n/u)) if (line.startsWith("{")) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { continue; }
    if (value && typeof value === "object" && !Array.isArray(value) && "family" in value && value.family === family)
      matching.push(value as Record<string, unknown>);
  }
  assert.equal(matching.length, 1, "The canonical leaf must emit exactly one matching terminal family receipt.");
  return matching[0]!;
}

/** Classify only owner-observed causal facts. Assertion text and a retry can never establish a Product cause. */
export function localVerificationFailureClassification(facts: {
  stage: "execution" | "terminal_receipt" | "cleanup" | "evidence";
  error?: unknown; exitCode?: number | null; childReason?: string | null;
  nativeEvidence?: { stderr: string; stderrSha256: string; signal?: string | null };
}) {
  const categories = ["Product", "QA / Test", "Fixture", "Harness", "Environment", "UNKNOWN"] as const;
  const error = facts.error instanceof Error ? facts.error : undefined;
  const ownedCause = error?.cause;
  const code = error && "code" in error ? String(error.code) : ownedCause && typeof ownedCause === "object" && "code" in ownedCause ? String(ownedCause.code) : null;
  const operatingSystemCodes = ["EACCES", "EPERM", "ENOSPC", "EROFS", "ENOENT", "EMFILE", "ENFILE"];
  if (code && operatingSystemCodes.includes(code)) return { category: categories[4], technicalKind: facts.stage + "_os_failure",
    failureClass: "Environment Failure", rootCause: "UNKNOWN", confidence: "observed_os_code",
    evidence: "The owner observed the operating-system error code " + code + ".", osCode: code };
  const native = facts.nativeEvidence;
  if (native && /^[a-f0-9]{64}$/u.test(native.stderrSha256) && facts.exitCode !== 0 &&
      (facts.exitCode === 2147483651 || native.signal === "SIGABRT") &&
      /(?:^|\n)[^\n]*Check failed: jit_page_->allocations_\.erase\(addr\) == 1\./u.test(native.stderr))
    return { category: "Runtime Crash" as const, failureClass: "Node/V8 Runtime Crash", rootCause: "UNKNOWN",
      technicalKind: "owned_node_v8_native_abort", confidence: "native_fatal_and_exit",
      evidence: "Owned child retained the V8 CHECK fatal, native abort exit/signal and stderr SHA-256; the initiating defect remains UNKNOWN.",
      evidenceSha256: native.stderrSha256, osCode: null };
  if (code === "APPLICATION_CLIENT_DISCONNECTED") return { category: "Database Transport" as const,
    failureClass: "Database Transport Failure", rootCause: "UNKNOWN", technicalKind: "owned_pg_control_connection_disconnected",
    confidence: "observed_owner_error_code", evidence: "The owned PostgreSQL control client disconnected; no Codex, Sleep, Docker or memory cause is inferred.", osCode: null };
  if (facts.stage === "terminal_receipt" && facts.exitCode === 0) return { category: categories[2], technicalKind: "terminal_receipt_contract_violation",
    failureClass: "QA / Harness Failure", rootCause: "UNKNOWN", confidence: "owner_validated_protocol_violation",
    evidence: "The canonical process exited zero but its required family receipt failed explicit owner validation.", osCode: null };
  return { category: categories[5], technicalKind: facts.stage + (facts.childReason ? "_" + facts.childReason : "_failure"),
    failureClass: facts.childReason === "timeout" ? "Timeout" : facts.childReason === "cancelled" ? "Cancellation" : "UNKNOWN",
    rootCause: "UNKNOWN", confidence: facts.childReason === "timeout" || facts.childReason === "cancelled" ? "observed_termination_reason" : "insufficient_causal_evidence",
    evidence: "The original failure is retained. Exit status, assertion labels, cancellation and timeout alone do not establish a Product, Test, Fixture, Harness or Environment root cause.", osCode: null };
}

/** Explicit targeted mode reuses the same child lifecycle; it never fabricates Supabase readiness or replaces a release gate. */
export async function executeLocalVerificationTargets(options: { baselineHead: string }, signal: AbortSignal) {
  const started = performance.now();
  const invocationId = "impact-" + globalThis.crypto.randomUUID();
  // Recompute the actual delta and existing manifest bindings here. A caller cannot supply a stale or altered selector.
  assert.deepEqual(Object.keys(options), ["baselineHead"], "Targeted execution accepts only an immutable baseline, never supplied impact analysis.");
  let input = inspectLocalVerificationChangeImpact({ baselineHead: options.baselineHead, automatic: true });
  if ("changeImpact" in input && input.changeImpact?.qaQuality?.some(row => row.failures.length)
      && "fast" in input && input.fast.correspondence.every(row => row.protected)) {
    const admissionQualification = await qualifyLocalVerificationAdmission({ baselineHead: options.baselineHead }, signal);
    if (admissionQualification.status === "PASS") input = inspectLocalVerificationChangeImpact({ baselineHead: options.baselineHead,
      automatic: true, admissionQualification });
    else return { sourceReport: input, status: "BLOCKED" as const, exitCode: 1,
      results: [], runId: invocationId, flakyStatus: "NOT_RUN", executedCommands: 0, commandAttempts: 0, browserExecuted: false,
      durationMs: performance.now() - started, attempt: 0, retry: 0, fullGatesPreserved: true, admissionQualification };
  }
  if (input.status !== "PASS_AUTOMATIC_SOURCE_PROTECTION" || input.exitCode !== 0 || !("qualifiedTargets" in input) || !input.changeImpact)
    return { sourceReport: input, status: "BLOCKED" as const, exitCode: 1, results: [], runId: invocationId, flakyStatus: "NOT_RUN", executedCommands: 0, commandAttempts: 0,
      browserExecuted: false, durationMs: performance.now() - started, attempt: 0, retry: 0, fullGatesPreserved: true };
  const changeImpact = input.changeImpact;
  const phaseTimings = { sourceInspectionMs: performance.now() - started, snapshotVerificationMs: 0, executionMs: 0, evidenceAndCleanupMs: 0 };
  const environment: NodeJS.ProcessEnv = { NODE_ENV: "test", CI: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "ComSpec", "PATHEXT", "LOCALAPPDATA", "PLAYWRIGHT_BROWSERS_PATH"])
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, env: environment, windowsHide: true, timeout: 30_000,
    maxBuffer: 32_000_000, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  const verifySource = () => {
    const snapshotStarted = performance.now();
    assert.equal(git("rev-parse", "HEAD").trim(), input.finalHead, "Targeted execution has a changed commit.");
    const manifest = selectSourceInventory(git("ls-files", "-z").split("\0").filter(Boolean), []).flatMap(file => {
      const path = safeSourcePath(file); if (!existsSync(path)) return [];
      assert.ok(lstatSync(path).isFile() && realpathSync(path) === path, "Targeted source cannot traverse links.");
      return [{ file, sha256: digest(readFileSync(path)) }];
    });
    assert.equal(digest(JSON.stringify(manifest)), input.sourceSha256, "Targeted execution has a stale source snapshot.");
    assert.equal(changeImpact.sourceSha256, input.sourceSha256);
    const scripts = JSON.parse(readFileSync(safeSourcePath("package.json"), "utf8")).scripts as Record<string, string>;
    const sourceBytes = new Map(manifest.map(row => { const bytes = readFileSync(safeSourcePath(row.file));
      assert.equal(digest(bytes), row.sha256, "Source effect closure snapshot changed: " + row.file); return [row.file, bytes] as const; }));
    const sourceGuardEffects = ["scripts/verify-executable-governance.mts", "scripts/verify-verification-infrastructure.mts"]
      .map(entry => localVerificationSourceGuardEffects(entry, sourceBytes));
    assert.ok("sourceGuardEffects" in input, "Missing complete source guard effect closure.");
    assert.deepEqual(sourceGuardEffects, input.sourceGuardEffects, "Targeted source guard effect closure changed before execution.");
    assert.deepEqual(qualifyLocalVerificationTargets(scripts, changeImpact,
      digest(readFileSync(safeSourcePath("scripts/qa-admin-form-guarded-navigation.mts"), "utf8").replaceAll("\r\n", "\n")),
      Object.fromEntries(sourceGuardEffects.map(effect => [effect.entry, effect.fingerprint ?? ""]))), input.qualifiedTargets, "Targeted selector is stale or incomplete.");
    phaseTimings.snapshotVerificationMs += performance.now() - snapshotStarted;
  };
  verifySource();
  const qualified = input.qualifiedTargets;
  if (!qualified.targets.length) return { status: qualified.applicable ? "BLOCKED" as const : "NOT RUN" as const, exitCode: qualified.applicable ? 1 : 0,
    sourceReport: input, commitSha: input.finalHead, sourceSha256: input.sourceSha256, results: [], runId: invocationId, flakyStatus: "NOT_RUN", executedCommands: 0, commandAttempts: 0, browserExecuted: false, durationMs: performance.now() - started,
    attempt: 0, retry: 0, reason: qualified.applicable ? qualified.blockers : ["no_affected_qualified_family"], fullGatesPreserved: true };
  assert.equal(new Set(qualified.targets.map(row => row.step)).size, qualified.targets.length, "A qualified leaf cannot execute twice in one path.");
  if (qualified.targets.some(target => !target.supportedPlatforms.includes(process.platform))) return { sourceReport: input, status: "BLOCKED" as const, exitCode: 1,
    results: [], runId: invocationId, flakyStatus: "NOT_RUN", executedCommands: 0, commandAttempts: 0, browserExecuted: false, attempt: 0, retry: 0,
    reason: ["qualified_process_tree_cleanup_not_proved_for_platform"], durationMs: performance.now() - started, fullGatesPreserved: true };
  const evidenceRoot = resolve(ROOT, ".tmp-qa"); mkdirSync(evidenceRoot, { recursive: true });
  assert.ok(lstatSync(evidenceRoot).isDirectory() && realpathSync(evidenceRoot) === evidenceRoot, "Targeted evidence root cannot traverse links.");
  const runDirectory = realpathSync(mkdtempSync(join(evidenceRoot, "impact-targeted-")));
  assert.ok(runDirectory.startsWith(evidenceRoot + sep));
  let processReadiness: Awaited<ReturnType<typeof verifyOwnedProcessReadiness>>;
  try {
    processReadiness = await verifyOwnedProcessReadiness({ sourceDirectory: ROOT,
      context: { runDirectory, sanitize: (value: string) => value, cleanEnvironment: () => ({ ...environment }) }, signal });
  } catch (error) {
    return { sourceReport: input, status: "BLOCKED" as const, exitCode: 1, results: [], runId: invocationId,
      commitSha: input.finalHead, sourceSha256: input.sourceSha256, executedCommands: 0, commandAttempts: 0,
      attempt: 0, retry: 0, flakyStatus: "NOT_RUN", browserExecuted: false, durationMs: performance.now() - started,
      reason: ["owned_process_execution_context_not_qualified"], evidenceReference: ".tmp-qa/" + runDirectory.slice(evidenceRoot.length + 1).replaceAll("\\", "/") + "/process-readiness.json",
      failurePreserved: error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Owned process readiness failed", fullGatesPreserved: true };
  }
  const results: Array<Record<string, unknown>> = [];
  const sourceFloorContext = { runDirectory, sanitize: (value: string) => value, cleanEnvironment: () => ({ ...environment }) };
  const sourceFloorSources = new Map(selectSourceInventory(git("ls-files", "-z").split("\0").filter(Boolean), [])
    .filter(file => existsSync(safeSourcePath(file))).map(file => [file, readFileSync(safeSourcePath(file))] as const));
  let sourceFloor: Awaited<ReturnType<typeof runLocalVerificationSourceFloor>>;
  try {
    const prior = input.admissionQualification ? assertLocalVerificationAdmissionQualification(input.admissionQualification,
      { baselineHead: input.baselineHead, finalHead: input.finalHead, sourceSha256: input.sourceSha256 }).sourceFloor : undefined;
    sourceFloor = await runLocalVerificationSourceFloor({ sourceDirectory: ROOT, context: sourceFloorContext, signal,
      sources: sourceFloorSources, changedFiles: input.actualDelta.map(change => change.file), verifySource,
      governance: qualified.targets.filter(target => target.kind === "source_guard"), governanceQualified: qualified.blocking.length === 0, prior });
  } catch (error) {
    const childResult = error instanceof Error && "childResult" in error ? error.childResult : null;
    return { sourceReport: input, status: "BLOCKED" as const, exitCode: 1, results: [], runId: invocationId,
      commitSha: input.finalHead, sourceSha256: input.sourceSha256, executedCommands: 0, commandAttempts: 0,
      attempt: 0, retry: 0, flakyStatus: "NOT_RUN", browserExecuted: false, durationMs: performance.now() - started,
      reason: ["ordered_source_floor_failed"], originalChildResult: childResult,
      failurePreserved: error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Ordered source floor failed", fullGatesPreserved: true };
  }
  let browserExecuted = false, executedCommands = 0;
  for (const [targetIndex, target] of qualified.targets.entries()) {
  const targetName = `targeted-${targetIndex + 1}-${target.kind}`;
  const tempDirectory = join(runDirectory, "temp-" + (targetIndex + 1)); mkdirSync(tempDirectory);
  environment.TEMP = environment.TMP = tempDirectory;
  const context = { runDirectory, sanitize: (value: string) => value, cleanEnvironment: () => ({ ...environment }) };
  const children = new Set<ChildProcess>();
  let child: Awaited<ReturnType<typeof runOwnedVerificationChild>> | undefined;
  let failure: unknown, cleanupFailure: unknown;
  let failureStage: "execution" | "terminal_receipt" = "execution";
  let cleanupStarted = 0;
  let fixture: { family?: string; status?: string; proofLevel?: string; scenariosStarted?: number; scenariosCompleted?: number;
    browserExecuted?: boolean; databaseExecuted?: boolean; nativePersistenceVerified?: boolean; businessConsumerAdoptionVerified?: boolean;
    cleanup?: Array<{ resource: string; status: string }>; deniedForeignRequests?: unknown[];
    timings?: { preparationMs: number; executionMs: number; cleanupMs: number } } | undefined;
  try {
    signal.throwIfAborted(); verifySource();
    child = target.kind === "source_guard" ? sourceFloor.checks.find(check => check.stage === "governance" && check.step === target.step)?.result : undefined;
    child ??= await runOwnedVerificationChild({ sourceDirectory: ROOT, context, children, signal }, target.step.split(" ").slice(1),
      environment, targetName, target.limitMs);
    phaseTimings.executionMs += child.durationMs;
    assert.equal(child.code, 0, "Qualified canonical leaf failed; retain its original stdout/stderr and exit code.");
    failureStage = "terminal_receipt";
    if (target.kind === "browser_behavior") {
    assert.equal(qualified.targets.filter(row => row.kind === "browser_behavior").length, 1, "Only the qualified existing Form family is executable.");
    assert.equal(target.step, "node --experimental-strip-types scripts/qa-admin-form-guarded-navigation.mts --save-cache-only");
    fixture = localVerificationFamilyReceipt(child.stdout, target.family) as typeof fixture;
    assert.ok(fixture, "A successful process without the actual family receipt is not behavioral proof.");
    assert.equal(fixture.status, "PASS"); assert.equal(fixture.proofLevel, target.proofLevel);
    assert.equal(fixture.scenariosStarted, 13); assert.equal(fixture.scenariosCompleted, 13);
    assert.equal(fixture.browserExecuted, true); assert.equal(fixture.databaseExecuted, false);
    assert.equal(fixture.nativePersistenceVerified, false); assert.equal(fixture.businessConsumerAdoptionVerified, false);
    assert.deepEqual(fixture.cleanup?.map(row => [row.resource, row.status]), [["browser", "PASS"], ["server", "PASS"], ["temp", "PASS"]]);
    assert.deepEqual(fixture.deniedForeignRequests, []);
    } else {
      assert.equal(target.kind, "source_guard");
      assert.equal(target.step, "node --experimental-strip-types " + target.entry);
      assert.ok(target.successMarker && child.stdout.includes(target.successMarker), "Source guard terminal success evidence is missing.");
    }
    failureStage = "execution";
    assert.equal(child.cleanup.status, "PASS");
    assert.equal(child.cleanup.liveProcesses, 0);
    if (process.platform === "linux") assert.equal(child.cleanup.processTreeVerified, true);
    failureStage = "execution";
    verifySource();
  } catch (error) { failure = error; }
  finally {
    cleanupStarted = performance.now();
    try {
      for (const active of children) await stopChild(active, environment);
      assert.equal(children.size, 0, "Targeted child termination must precede temporary cleanup.");
      assert.equal(realpathSync(tempDirectory), tempDirectory);
      const inspect = (directory: string): void => { for (const name of readdirSync(directory)) {
        const path = join(directory, name), stat = lstatSync(path); assert.equal(stat.isSymbolicLink(), false, "Refuse linked targeted temporary cleanup.");
        if (stat.isDirectory()) inspect(path);
      } };
      inspect(tempDirectory); rmSync(tempDirectory, { recursive: true, force: true });
    } catch (error) { cleanupFailure = error; }
  }
  const logs = (kind: "stdout" | "stderr") => {
    const path = ownedPath(context, `public-${targetName}.${kind}.log`);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  let evidenceFailure: unknown;
  let stdout = child?.stdout ?? "", stderr = child?.stderr ?? "";
  try { stdout = child?.stdout ?? logs("stdout"); stderr = child?.stderr ?? logs("stderr"); } catch (error) { evidenceFailure = error; }
  const status = failure || cleanupFailure || evidenceFailure ? "FAIL" as const : "PASS" as const;
  const retainedChild = failure instanceof Error && "childResult" in failure ? failure.childResult as {
    code?: number | null; signal?: string | null; durationMs?: number; reason?: string | null;
    identity?: { pid: number | null; ppid: number; spawnedAtUtc: string }; rawExit?: { code: number | null; signal: string | null };
    stdout?: string | null; stderr?: string | null; cleanup?: unknown;
  } : undefined;
  const rawExit = child ? child.rawExit : retainedChild ? retainedChild.rawExit
    ?? { code: retainedChild.code === undefined ? null : retainedChild.code, signal: retainedChild.signal ?? null } : null;
  if (!child && retainedChild?.durationMs !== undefined) phaseTimings.executionMs += retainedChild.durationMs;
  const originalCause = failure ? localVerificationFailureClassification({ stage: failureStage, error: failure,
    exitCode: rawExit?.code, childReason: retainedChild?.reason,
    nativeEvidence: { stderr, stderrSha256: digest(stderr), signal: rawExit?.signal } }) : null;
  const cause = originalCause ?? (status === "PASS" ? null : localVerificationFailureClassification({
    stage: cleanupFailure ? "cleanup" : evidenceFailure ? "evidence" : failureStage,
    error: cleanupFailure ?? evidenceFailure ?? failure, exitCode: rawExit?.code, childReason: retainedChild?.reason,
    nativeEvidence: { stderr, stderrSha256: digest(stderr), signal: rawExit?.signal },
  }));
  phaseTimings.evidenceAndCleanupMs += performance.now() - cleanupStarted;
  const result = { status, runId: invocationId, commitSha: input.finalHead, sourceSha256: input.sourceSha256, owners: target.owners, capabilities: target.capabilities,
    contracts: target.contracts, consumers: target.consumers, test: target.entry, canonicalChecks: target.canonicalChecks, command: target.step,
    durationMs: child?.durationMs ?? retainedChild?.durationMs ?? performance.now() - started, attempt: 1, retry: 0,
    flakyStatus: "NOT_ASSESSED_SINGLE_ATTEMPT", attempts: [{ attempt: 1, retry: 0, status, cause }], cause, originalCause,
    cleanupCause: cleanupFailure ? localVerificationFailureClassification({ stage: "cleanup", error: cleanupFailure }) : null,
    exitCode: rawExit?.code === undefined ? null : rawExit.code,
    childOutcome: retainedChild ? { ...retainedChild, rawExit } : child ? { code: child.code, rawExit, identity: child.identity, cleanup: child.cleanup } : null,
    timings: { ...phaseTimings, source: input.timings, fixture: fixture?.timings ?? null, finalReceiptWriteIncluded: false },
    proofLevel: target.proofLevel, behavioralPass: target.kind === "browser_behavior" && status === "PASS", fixture: fixture ?? null, nativePersistenceVerified: false, businessConsumerAdoptionVerified: false,
    selected: true, reason: target.reasons, owner: target.owners, contract: target.contracts,
    evidenceReference: ".tmp-qa/" + runDirectory.slice(evidenceRoot.length + 1).replaceAll("\\", "/") + "/" + targetName + "-result.json",
    evidence: { stdoutSha256: digest(stdout), stderrSha256: digest(stderr), stdout, stderr },
    cleanup: { childProcessesClosed: children.size === 0, ownedTempRemoved: !existsSync(tempDirectory), status: cleanupFailure ? "FAIL" : "PASS" },
    failurePreserved: failure instanceof Error ? failure.message.split(/\r?\n/u)[0] : failure ? "Original execution failed" : null,
    cleanupFailurePreserved: cleanupFailure instanceof Error ? cleanupFailure.message.split(/\r?\n/u)[0] : cleanupFailure ? "Owned cleanup failed" : null };
  const receiptStarted = performance.now();
  try { receipt(context, targetName + "-result.json", result); } catch (error) { evidenceFailure = error; }
  const receiptPersistenceMs = performance.now() - receiptStarted;
  const finalStatus = evidenceFailure ? "FAIL" as const : status;
  results.push(evidenceFailure ? { ...result, status: "FAIL" as const, evidencePersistence: "FAIL", originalCause,
      originalAttempt: { status: result.status, cause: result.cause, exitCode: result.exitCode },
      attempts: [{ attempt: 1, retry: 0, status: "FAIL" as const, cause: localVerificationFailureClassification({ stage: "evidence", error: evidenceFailure }) }],
      cause: localVerificationFailureClassification({ stage: "evidence", error: evidenceFailure }),
      evidenceFailurePreserved: evidenceFailure instanceof Error ? evidenceFailure.message.split(/\r?\n/u)[0] : "Evidence persistence failed" }
    : { ...result, originalCause, receiptPersistenceMs });
  executedCommands += child || retainedChild?.identity && Number.isSafeInteger(retainedChild.identity.pid) && retainedChild.identity.pid! > 0 ? 1 : 0;
  browserExecuted ||= fixture?.browserExecuted === true;
  if (finalStatus !== "PASS") break;
  }
  const preflight = qualified.selections.map(selection => {
    const result = results.find(row => row.command === selection.command);
    return { ...selection, sourceSha256: input.sourceSha256, durationMs: result?.durationMs ?? 0,
      result: result?.status ?? "NOT RUN", evidence: result?.evidenceReference ?? null,
      reason: result ? selection.reason : selection.selected && selection.qualified ? "blocked_or_prior_leaf_failed" : selection.reason };
  });
  const status = results.length !== qualified.targets.length || results.some(result => result.status !== "PASS") ? "FAIL" as const
    : qualified.blocking.length ? "BLOCKED" as const : "PASS" as const;
  const report = { sourceReport: input, status, exitCode: status === "PASS" ? 0 : 1, commitSha: input.finalHead, sourceSha256: input.sourceSha256,
    results, preflight, processReadiness, executedCommands, commandAttempts: results.length, runId: invocationId, flakyStatus: "NOT_ASSESSED_SINGLE_ATTEMPT",
    timings: { ...phaseTimings, source: input.timings }, browserExecuted,
    qualifiedBehavioralPass: results.some(result => result.proofLevel === "shared_owner_controlled_browser_behavior" && result.status === "PASS"),
    behavioralPass: false, releaseEvidence: false, durationMs: performance.now() - started, attempt: 1, retry: 0, fullGatesPreserved: true };
  try { receipt({ runDirectory, sanitize: (value: string) => value }, "targeted-result.json", report); }
  catch (error) { return { ...report, status: "FAIL" as const, exitCode: 1,
    evidenceFailurePreserved: error instanceof Error ? error.message.split(/\r?\n/u)[0] : "Evidence persistence failed" }; }
  return report;
}

/** Inspect literal registered command chains without executing or expanding the gate prefix. */
export function registeredVerificationNodeEntries(scripts: Readonly<Record<string, string>>, check: string): string[] {
  assert.ok(/^[a-zA-Z0-9:_-]+$/u.test(check) && Object.hasOwn(scripts, check),
    "Verification wrappers must name an existing literal package command.");
  const steps = localVerificationCommandSteps(scripts, check);
  assert.ok(steps, "Verification coverage requires literal Node entries or argument-free npm run wrappers; shell, environment, cycles and dynamic commands are unsupported.");
  return [...new Set(steps.map(step => {
    const words = step.split(" "), entry = words[1] === "--experimental-strip-types" ? words[2] : words[1];
    assert.ok(sourceIncluded(entry), "A verification entry cannot include private or generated source.");
    return entry;
  }))];
}

/** Bounded four-input protocol only; orchestration owns nonce, outer cleanup and artifact byte verification. */
export function validateLocalVerificationInputObservations(input: {
  sources: ReadonlyMap<string, string | Buffer>; observations: unknown;
}) {
  const failures: string[] = [], entry = "scripts/verify-isolated-supabase.mts", check = "verify:isolated-supabase";
  const coverage: Array<{ file: string; check: string; entry: string; evidence: Record<string, unknown> }> = [];
  let stage = "envelope", nativeAcceptancePlatform: "win32" | "linux" | null = null;
  const record = (value: unknown): Record<string, unknown> => {
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
    assert.ok([Object.prototype, null].includes(Object.getPrototypeOf(value))); return value as Record<string, unknown>;
  };
  const rows = (value: unknown) => { assert.ok(Array.isArray(value) && value.length <= 10_000); return value as unknown[]; };
  const strings = (value: unknown) => { const result = rows(value); assert.ok(result.every(row => typeof row === "string"));
    assert.equal(new Set(result).size, result.length); return result as string[]; };
  const trees = new Map<string, ts.SourceFile>();
  const source = (file: string) => { const bytes = input.sources.get(file); assert.ok(bytes !== undefined); return bytes.toString(); };
  const tree = (file: string) => {
    let parsed = trees.get(file); if (parsed) return parsed;
    parsed = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, /\.[cm]?ts$/u.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    assert.deepEqual((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics, []); trees.set(file, parsed); return parsed;
  };
  const nodes = (at: ts.Node) => { const result: ts.Node[] = []; const visit = (node: ts.Node) => { result.push(node); ts.forEachChild(node, visit); }; visit(at); return result; };
  const declaration = (file: string, name: string) => {
    const parsed = tree(file), found = name === "$module" ? [parsed] : name === "$dispatch" ? parsed.statements.filter(ts.isTryStatement)
      : parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(found.length, 1); return found[0]!;
  };
  // Structural expression identity retains literals and operators, rather than names or a source hash alone.
  const keys = new WeakMap<ts.Node, string>();
  const key = (node: ts.Node): string => {
    const cached = keys.get(node); if (cached !== undefined) return cached;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) return key(node.expression);
    const children: string[] = []; ts.forEachChild(node, child => { children.push(key(child)); });
    const literal = ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : null;
    const result = "[" + node.kind + ":" + JSON.stringify(literal) + ":" + children.join(",") + "]"; keys.set(node, result); return result;
  };
  const expression = (value: string) => {
    const parsed = ts.createSourceFile("input-proof.ts", "(" + value + ")", ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.deepEqual((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics, []);
    const statement = parsed.statements[0]; assert.ok(statement && ts.isExpressionStatement(statement)); return statement.expression;
  };
  const has = (at: ts.Node, value: string) => { const expected = key(expression(value)); return nodes(at).some(node => key(node) === expected && live(node, at)); };
  const requireExpressions = (at: ts.Node, expressions: string[]) => { for (const value of expressions) assert.ok(has(at, value), "Required behavioral expression absent."); };
  const noTautologies = (at: ts.Node) => {
    for (const node of nodes(at)) {
      if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        assert.notEqual(node.name.getText(), "assert", "A local assertion receiver cannot qualify the imported guard.");
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "assert") {
      if (node.expression.name.text === "ok" && node.arguments[0]) assert.ok(![ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword,
        ts.SyntaxKind.StringLiteral, ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.NoSubstitutionTemplateLiteral].includes(node.arguments[0].kind));
      if (["equal", "deepEqual", "strictEqual", "deepStrictEqual"].includes(node.expression.name.text) && node.arguments.length >= 2)
        assert.notEqual(key(node.arguments[0]!), key(node.arguments[1]!));
      }
    }
  };
  const directCall = (at: ts.Node, name: string) => nodes(at).filter((node): node is ts.CallExpression => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== name) return false;
    for (let parent = node.parent; parent && parent !== at; parent = parent.parent)
      if (ts.isFunctionLike(parent) || ts.isIfStatement(parent) || ts.isConditionalExpression(parent) || ts.isIterationStatement(parent, false)) return false;
    return true;
  });
  const live = (candidate: ts.Node, at: ts.Node): boolean => {
    const ownerName = ts.isFunctionDeclaration(at) ? at.name?.text : ts.isTryStatement(at) ? "$dispatch" : "$module";
    const knownIf = (condition: ts.Expression) => {
      if (ownerName === "verifyWindowsOwnedProcessContracts") return ['process.platform === "win32"', 'process.platform === "linux"'].some(value => key(condition) === key(expression(value)));
      if (ownerName === "nativeBuild") return key(condition) === key(expression("build"));
      if (ownerName !== "options") return false;
      if (nodes(condition).some(node => node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)) return false;
      return ["!output", 'key === "--platform-only" || key === "--cleanup-only"', "flags.has(key)", 'injection && injection !== "before-handoff"'].some(value => key(condition) === key(expression(value)))
        || has(condition, "values.has(key)") && has(condition, 'argv[index + 1].startsWith("--")');
    };
    for (let part: ts.Node = candidate; part !== at; part = part.parent) {
      const parent: ts.Node | undefined = part.parent; if (!parent) return false;
      if (ts.isIfStatement(parent) && !knownIf(parent.expression)) return false;
      if (ts.isConditionalExpression(parent)) {
        if (ownerName !== "$dispatch" || !["--connection-lifecycle-only", "--final-public-proof", "--build-contracts-proof", "--media-upload-limit-proof", "--hero-compatibility-proof"]
          .some(flag => key(parent.condition) === key(expression("args.includes(" + JSON.stringify(flag) + ")")))) return false;
      }
      if (ts.isIterationStatement(parent, false)) {
        if (ownerName === "options" && ts.isForStatement(parent) && parent.condition && key(parent.condition) === key(expression("index < argv.length"))) continue;
        if (ownerName === "$module" && ts.isForOfStatement(parent)
          && key(parent.expression) === key(expression('["idle_timeout", "session_lifetime_timeout", "owner_shutdown", "peer_closed"]'))) continue;
        if (!ts.isForOfStatement(parent) || !ts.isIdentifier(parent.expression)
          || !(["negative", "routes", "invalid"].includes(parent.expression.text) && ["verifyReleaseLockInputContracts", "verifyIsolatedCliInputContracts"].includes(ownerName ?? ""))) return false;
      }
      if (ts.isFunctionLike(parent) && parent !== at) {
        const holder = parent.parent;
        if (ts.isCallExpression(holder) && holder.arguments.some(argument => argument === parent)
          && (["control", "prove", "check", "assert.throws", "assert.rejects"].includes(holder.expression.getText())
            || ownerName === "$module" && at.getSourceFile().fileName === "scripts/qa-isolated-supabase-transport.mjs"
              && holder.expression.getText() === "transportSetupCase" && directCall(at, "transportSetupCase").includes(holder))) {
          if (holder.expression.getText() === "control" && ownerName === "verifySharedChildControls"
            && !directCall(at, "control").includes(holder)) return false;
        } else if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)
          && ["read", "invoke"].includes(holder.name.text) && directCall(at, holder.name.text).length > 0) {
          // Existing local helpers are invoked by the positive vector in this exact declaration.
        } else if (ts.isFunctionDeclaration(parent) && parent.name && directCall(at, parent.name.text).length > 0) {
          // Existing native contract helper; its returned observations are consumed by the caller.
        } else return false;
      }
      if (ts.isBlock(parent)) {
        const index = parent.statements.findIndex(statement => statement === part);
        if (index >= 0) for (const previous of parent.statements.slice(0, index)) {
          if (ts.isReturnStatement(previous) || ts.isThrowStatement(previous) || ts.isBreakStatement(previous) || ts.isContinueStatement(previous)) return false;
          if (ts.isIfStatement(previous) && nodes(previous.thenStatement).some(node => ts.isReturnStatement(node) || ts.isThrowStatement(node)) && !knownIf(previous.expression)) return false;
        }
      }
    }
    return true;
  };
  try {
    const raw = record(input.observations); assert.equal(raw.schema, 1); assert.equal(raw.kind, "verification-input-observations");
    assert.equal(raw.entry, entry); assert.equal(raw.executionScope, "affected_input_controls");
    assert.ok(typeof raw.nonce === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(raw.nonce));
    const observedSources = new Map<string, string>();
    for (const value of rows(raw.sources)) { const row = record(value); assert.ok(typeof row.file === "string" && typeof row.sha256 === "string");
      assert.equal(observedSources.has(row.file), false); assert.equal(digest(source(row.file)), row.sha256); observedSources.set(row.file, row.sha256); }
    const witnessed = new Set<string>();
    for (const value of rows(raw.sourceWitnesses)) {
      const witness = record(value); assert.ok(typeof witness.file === "string" && typeof witness.declaration === "string");
      assert.ok(observedSources.has(witness.file)); const id = witness.file + "#" + witness.declaration; assert.equal(witnessed.has(id), false); witnessed.add(id);
      const parsed = tree(witness.file), actual = declaration(witness.file, witness.declaration), calls: Array<{ expression: string; arguments: string[]; position: number }> = [];
      for (const node of nodes(actual)) if (ts.isCallExpression(node)) calls.push({ expression: node.expression.getText(parsed),
        arguments: node.arguments.map(argument => argument.getText(parsed)), position: node.getStart(parsed) });
      assert.equal(witness.kind, ts.SyntaxKind[actual.kind]); assert.equal(witness.text, actual.getText(parsed));
      assert.equal(witness.sha256, digest(actual.getText(parsed))); assert.deepEqual(witness.calls, calls);
    }
    const bound = (file: string, name: string) => { assert.ok(witnessed.has(file + "#" + name)); return declaration(file, name); };
    const shared = bound(entry, "verifySharedChildControls"), json = bound(entry, "verifyReleaseLockInputContracts"), cli = bound(entry, "verifyIsolatedCliInputContracts");
    const nativeControls = bound(entry, "verifyWindowsOwnedProcessContracts");
    for (const node of [shared, json, cli, nativeControls, bound(entry, "readSource")]) noTautologies(node);
    const admission = bound(entry, "admissionQualificationOnly");
    requireExpressions(admission, ["verifySharedChildControls({ admissionOnly: true })"]);
    assert.equal(directCall(admission, "verifySharedChildControls").length, 1);
    requireExpressions(shared, ['import("./lib/isolated-supabase.mts")', "verifyIsolatedCliInputContracts(lifecycleOwner.IsolatedSupabaseError)",
      'run("transport-contracts", [path.join(root, "scripts/qa-isolated-supabase-transport.mjs")], undefined, 30_000)',
      'run("cli-missing-output", ["--experimental-strip-types", path.join(root, "scripts/qa-isolated-supabase.mts")], undefined, 30_000)',
      'assert.deepEqual(result.rawExit, { code: 0, signal: null })', 'assert.deepEqual(result.rawExit, { code: 1, signal: null })',
      'assert.equal(result.cleanup.liveProcesses, 0)', 'assert.deepEqual(failures, [{ status: "needs_attention", stage: "cli", code: "OUTPUT_REQUIRED" }])']);
    const jsonCalls = directCall(shared, "verifyReleaseLockInputContracts"), cliCalls = directCall(shared, "verifyIsolatedCliInputContracts");
    assert.equal(jsonCalls.length, 1); assert.equal(cliCalls.length, 1); assert.equal(directCall(shared, "verifyWindowsOwnedProcessContracts").length, 1);
    assert.equal(key(jsonCalls[0]!.arguments[0]!), key(expression("lifecycleOwner"))); assert.equal(jsonCalls[0]!.arguments.length, 2);
    assert.ok(ts.isArrowFunction(jsonCalls[0]!.arguments[1]!));
    const lifecycleBindings = nodes(shared).filter((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText() === "lifecycleOwner");
    assert.equal(lifecycleBindings.length, 1); assert.ok(lifecycleBindings[0]!.initializer);
    assert.equal(key(lifecycleBindings[0]!.initializer!), key(expression('await import("./lib/isolated-supabase.mts")')));
    for (const [at, names] of [[admission, ["verifySharedChildControls"]], [shared, ["verifyReleaseLockInputContracts", "verifyIsolatedCliInputContracts", "verifyWindowsOwnedProcessContracts"]]] as const)
      for (const node of nodes(at)) if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node)) && node.name)
        assert.ok(!(names as readonly string[]).includes(node.name.getText()), "A local alias cannot qualify an unused canonical helper.");
    for (const file of [entry, "scripts/lib/windows-owned-process.mts"]) assert.ok(tree(file).statements.some(node => ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "node:assert/strict" && node.importClause?.name?.text === "assert"));
    const body = record(raw.observations); assert.equal(body.status, "PASS"); assert.equal(body.sourceInputsUnchanged, true);
    const runtime = record(body.runtime); assert.ok(runtime.platform === "win32" || runtime.platform === "linux"); nativeAcceptancePlatform = runtime.platform;
    for (const field of ["dockerExecuted", "unrelatedNativeLifecycleReexecuted", "automaticQualificationClaimed"]) assert.equal(body[field], false);
    assert.equal(body.databaseCalls, 0); assert.equal(body.externalNetworkRequests, 0); assert.equal(body.originalFinallyExecuted, true);
    const proofs = new Map<string, Record<string, unknown>>();
    for (const value of rows(body.runtimeProofs)) { const proof = record(value); assert.ok(typeof proof.control === "string"); assert.equal(proofs.has(proof.control), false); proofs.set(proof.control, proof); }
    const proof = (control: string) => { const value = proofs.get(control); assert.ok(value); return value; };
    const artifacts = new Map<string, string>();
    for (const value of rows(raw.artifacts)) { const row = record(value); assert.ok(typeof row.path === "string" && typeof row.sha256 === "string");
      assert.match(row.path, /^\.tmp-qa\/[a-zA-Z0-9._/-]+$/u); assert.ok(!row.path.split("/").some(part => part === "." || part === ".."));
      assert.match(row.sha256, /^[a-f0-9]{64}$/u); assert.equal(artifacts.has(row.path), false); artifacts.set(row.path, row.sha256); }
    const archive = proof(nativeAcceptancePlatform === "win32" ? "windows_native_evidence_archive" : "owned_child_evidence_archive"); assert.ok(typeof archive.directory === "string");
    const archiveRelative = archive.directory.replaceAll("\\", "/").split("/.tmp-qa/"); assert.equal(archiveRelative.length, 2);
    assert.match(archiveRelative[1]!, /^owned-process-controls-[a-zA-Z0-9_-]+$/u); const archiveRoot = ".tmp-qa/" + archiveRelative[1] + "/";
    const archived = new Map<string, string>();
    for (const value of rows(archive.files)) { const row = record(value); assert.ok(typeof row.file === "string" && typeof row.sha256 === "string");
      assert.equal(archived.has(row.file), false); assert.equal(artifacts.get(archiveRoot + row.file), row.sha256); archived.set(row.file, row.sha256); }
    assert.ok(artifacts.has(archiveRoot + "evidence-index.json"));
    stage = "json_read_parse_validation";
    const lockFile = "scripts/fixtures/isolated-supabase/stack.lock.json", lockProof = proof("actual_release_lock_input");
    assert.equal(lockProof.status, "PASS"); assert.equal(lockProof.input, lockFile); assert.equal(lockProof.sourceSha256, digest(source(lockFile)));
    assert.equal(lockProof.actualOwnerReadParseValidation, true); assert.equal(lockProof.tempFixtureCleanupVerified, true);
    requireExpressions(json, ['readSource("scripts/fixtures/isolated-supabase/stack.lock.json")', "JSON.parse(input)", "owner.readReleaseLock(file)",
      "assert.deepEqual(actual, expected)", 'assert.throws(() => read("{"), SyntaxError)',
      "assert.throws(() => read(JSON.stringify(changed)), error => error instanceof owner.IsolatedSupabaseError && error.code === code)",
      "assert.equal(actual.compose.sha256, sha256(readSource(actual.compose.path)))", "assert.equal(actual.transport.sha256, sha256(readSource(actual.transport.path)))"]);
    const negativeBindings = nodes(json).filter((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText() === "negative");
    assert.equal(negativeBindings.length, 1); const negativeArray = negativeBindings[0]!.initializer; assert.ok(negativeArray && ts.isArrayLiteralExpression(negativeArray));
    const negativeContracts = [
      ["schema drift", "UNAPPROVED_RELEASE", 'value => { Object.assign(value, { schemaVersion: 2 }); }'],
      ["release drift", "UNAPPROVED_RELEASE", 'value => { value.release.commit = "0".repeat(40); }'],
      ["release source drift", "INCOMPLETE_RELEASE_LOCK", 'value => { value.release.sourceBaseUrl = "https://example.invalid/"; }'],
      ["missing upstream inputs", "INCOMPLETE_RELEASE_LOCK", 'value => { value.files = []; }'],
      ["duplicate upstream input", "DUPLICATE_LOCK_PATH", 'value => { value.files.push({ ...value.files[0]! }); }'],
      ["unsafe upstream path", "UNSAFE_UPSTREAM_PATH", 'value => { value.files[0]!.path = "docker/../outside.sql"; }'],
      ["upstream digest drift", "UNSAFE_UPSTREAM_PATH", 'value => { value.files[0]!.sha256 = "unqualified"; }'],
      ["missing image", "INVALID_IMAGE_SET", 'value => { delete value.images.db; }'],
      ["mutable image", "UNPINNED_IMAGE", 'value => { value.images.db!.reference = "supabase/postgres:latest"; }'],
      ["image config drift", "UNPINNED_IMAGE", 'value => { value.images.db!.configDigest = "unqualified"; }'],
      ["image manifest mismatch", "UNPINNED_IMAGE", 'value => { value.images.db!.manifestDigest = "sha256:" + "0".repeat(64); }'],
      ["compose content drift", "SOURCE_HASH_MISMATCH", 'value => { value.compose.sha256 = "0".repeat(64); }'],
      ["transport content drift", "TRANSPORT_SOURCE_HASH_MISMATCH", 'value => { value.transport.sha256 = "0".repeat(64); }'],
      ["transport owner substitution", "TRANSPORT_SOURCE_HASH_MISMATCH", 'value => { value.transport.path = "scripts/qa-isolated-supabase-transport.mjs"; }'],
    ];
    assert.equal(negativeArray.elements.length, negativeContracts.length);
    for (const [index, contract] of negativeContracts.entries()) { const tuple: ts.Expression | undefined = negativeArray.elements[index]; assert.ok(tuple && ts.isArrayLiteralExpression(tuple) && tuple.elements.length === 3);
      for (const field of [0, 1]) { const value: ts.Expression | undefined = tuple.elements[field]; assert.ok(value && ts.isStringLiteral(value)); assert.equal(value.text, contract[field]); }
      assert.equal(key(tuple.elements[2]!), key(expression(contract[2]!))); }
    assert.deepEqual(strings(lockProof.names), ["actual current JSON bytes parse and validate through the existing release lock owner", ...negativeContracts.map(row => row[0]), "malformed JSON rejects before any lifecycle entry"]);
    const lifecycle = "scripts/lib/isolated-supabase.mts", readLock = bound(lifecycle, "readReleaseLock");
    requireExpressions(readLock, ['JSON.parse(readFileSync(lockPath, "utf8"))',
      'requireThat(value.schemaVersion === 1 && object(value.release).commit === RELEASE_COMMIT, "UNAPPROVED_RELEASE", "provenance")']);
    requireExpressions(bound(lifecycle, "runIsolatedSupabase"), ["readReleaseLock(lockPath)"]);
    const jsonFiles = rows(lockProof.inputArtifacts); assert.equal(jsonFiles.length, 16);
    for (let i = 0; i < jsonFiles.length; i++) { const row = record(jsonFiles[i]); assert.equal(row.file, "release-lock-inputs/lock-" + (i + 1) + ".json"); assert.equal(archived.get(String(row.file)), row.sha256); }
    stage = "cli_actual_parser_dispatcher";
    const cliProof = proof("actual_cli_parser_dispatcher"); assert.equal(cliProof.status, "PASS"); assert.equal(cliProof.source, "scripts/qa-isolated-supabase.mts");
    assert.equal(cliProof.sourceSha256, digest(source("scripts/qa-isolated-supabase.mts"))); assert.equal(strings(cliProof.names).length, 29);
    assert.equal(cliProof.actualParserAndDispatcher, true); assert.equal(cliProof.actualResourceAllocations, 0);
    requireExpressions(cli, ["api.dispatchActualCli()", "assert.deepEqual(result.calls, [])", "assert.equal(result.exitCode, 1)",
      'assert.deepEqual(JSON.parse(result.stderr), { status: "needs_attention", stage: "cli", code })',
      'assert.deepEqual(result.calls, [{ name, input: ["--output", output] }])', "assert.equal(parsed.handoff, undefined)"]);
    requireExpressions(cli, ['readSource("scripts/qa-isolated-supabase.mts")', 'options.getText(tree) + "\\nasync function dispatchActualCli(){" + dispatch[0]!.getText(tree) + "}"',
      'new Function(...Object.keys(ports), body + ";return {options,dispatchActualCli};")(...Object.values(ports))']);
    const cliFile = "scripts/qa-isolated-supabase.mts", options = bound(cliFile, "options"), dispatch = bound(cliFile, "$dispatch");
    requireExpressions(options, ['new IsolatedSupabaseError("OUTPUT_REQUIRED", "cli")', 'new IsolatedSupabaseError("INVALID_ARGUMENT", "cli")',
      "values.has(key)", 'argv[index + 1].startsWith("--")']);
    requireExpressions(dispatch, ["proofModes.length <= 1", "options(args)", "runIsolatedSupabase(options(args))"]);
    stage = "native_compiler_and_owned_execution";
    const nativeProof = proof("windows_imported_type_and_source_contracts"), publication = record(nativeProof.nativeBuildPublication), integrity = record(nativeProof.nativeIntegrity);
    assert.equal(nativeProof.status, "PASS"); assert.equal(publication.status, "PASS"); assert.equal(publication.checks, 10); assert.equal(strings(publication.cases).length, 10);
    assert.equal(publication.actualNativeSourceInput, "scripts/lib/windows-owned-process.cs"); assert.equal(publication.actualNativeSourceSha256, digest(source("scripts/lib/windows-owned-process.cs")));
    assert.equal(integrity.status, "PASS"); assert.equal(integrity.actualRootProcessesAllocated, 0);
    requireExpressions(nativeControls, ['readSource("scripts/lib/windows-owned-process.cs")', "windowsOwnedProcessCapability()", "assert.equal(native.sourceSha256, sha256(nativeSource))",
      'assert.equal(readFileSync(native.sourceSnapshot, "utf8"), nativeSource)', "assert.equal(provenance.flags.at(-1), native.sourceSnapshot)"]);
    const nativeOwner = "scripts/lib/windows-owned-process.mts", build = bound(nativeOwner, "nativeBuild");
    requireExpressions(build, ['join(ROOT, "scripts/lib/windows-owned-process.cs")', "readFileSync(source)", 'writeFileSync(sourceSnapshot, bytes, { flag: "wx", mode: 0o600 })',
      'assert.equal(hash(readFileSync(source)), sourceSha256, "Native source changed during compilation.")',
      'assert.equal(hash(readFileSync(compiler)), compilerSha256, "Native compiler changed during compilation.")',
      'writeFileSync(provenance, provenanceBytes, { flag: "wx", mode: 0o600 })']);
    assert.ok(nodes(build).some(node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "execFileSync"
      && node.arguments.length === 3 && key(node.arguments[0]!) === key(expression("compiler")) && key(node.arguments[1]!) === key(expression("flags"))));
    assert.ok(ts.isFunctionDeclaration(build) && build.body); assert.equal(build.parameters.length, 0); noTautologies(build);
    for (const node of nodes(build)) if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.name) assert.notEqual(node.name.getText(), "process");
    for (const statement of tree(nativeOwner).statements) {
      if (ts.isVariableStatement(statement)) for (const value of statement.declarationList.declarations) assert.notEqual(value.name.getText(), "process");
      if (ts.isImportDeclaration(statement) && statement.importClause) {
        assert.notEqual(statement.importClause.name?.text, "process"); const named = statement.importClause.namedBindings;
        if (named && ts.isNamespaceImport(named)) assert.notEqual(named.name.text, "process");
        if (named && ts.isNamedImports(named)) for (const value of named.elements) assert.notEqual(value.name.text, "process");
      }
    }
    const first = build.body.statements[0];
    assert.ok(first && ts.isExpressionStatement(first) && ts.isCallExpression(first.expression)); assert.equal(first.expression.expression.getText(), "assert.equal");
    assert.equal(key(first.expression.arguments[0]!), key(expression("process.platform"))); assert.equal(key(first.expression.arguments[1]!), key(expression('"win32"')));
    const flagBindings = nodes(build).filter((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText() === "flags");
    assert.equal(flagBindings.length, 1); const flagArray = flagBindings[0]!.initializer; assert.ok(flagArray && ts.isArrayLiteralExpression(flagArray));
    assert.equal(key(flagArray.elements.at(-1)!), key(expression("sourceSnapshot")));
    const native = record(body.native); let built: Record<string, unknown> | null = null;
    if (nativeAcceptancePlatform === "win32") {
      assert.equal(native.status, "PASS"); built = record(native.native);
      assert.equal(integrity.modifiedOwnedExecutableRejectedBeforeSpawn, true); assert.equal(integrity.originalExecutableRestored, true);
      assert.equal(built.sourceSha256, digest(source("scripts/lib/windows-owned-process.cs"))); assert.equal(rows(built.frameworkReferences).length, 5);
      assert.equal(integrity.executableSha256, built.executableSha256);
      for (const field of ["sourceSnapshot", "provenance", "executable"]) { assert.ok(typeof built[field] === "string"); const relative: string[] = String(built[field]).replaceAll("\\", "/").split("/.tmp-qa/");
        assert.equal(relative.length, 2); assert.match(relative[1]!, /^windows-native-build-[a-zA-Z0-9_-]+\/[^/]+$/u); assert.ok(artifacts.has(".tmp-qa/" + relative[1])); }
    } else {
      assert.equal(native.status, "BLOCKED"); assert.equal(native.native, undefined); assert.equal(native.missingProof, "windows_native_job_launch_unavailable");
      assert.equal(integrity.scope, "non_windows_platform_rejection_before_compiler_or_spawn");
      assert.equal(integrity.capabilityStatus, "BLOCKED"); assert.equal(integrity.platform, "linux"); assert.equal(integrity.nativeExecuted, false); assert.equal(integrity.compilerProcessesExecuted, 0);
      requireExpressions(nativeControls, ['assert.equal(capability.status, "BLOCKED")']);
    }
    const owned = (control: string, file: string, exitCode: number) => {
      const row = proof(control); assert.equal(row.entry, file); const result = record(row.actualResult); assert.equal(result.code, exitCode);
      assert.deepEqual(result.rawExit, { code: exitCode, signal: null }); assert.deepEqual(row.rawExit, result.rawExit); assert.deepEqual(row.cleanup, result.cleanup);
      const cleanup = record(result.cleanup); assert.equal(cleanup.status, "PASS"); assert.equal(cleanup.liveProcesses, 0); assert.equal(cleanup.processTreeVerified, true);
      assert.equal(cleanup.platform, nativeAcceptancePlatform);
      const prefix = control === "actual_owned_transport_leaf" ? "public-transport-contracts" : "public-cli-missing-output";
      for (const stream of ["stdout", "stderr"] as const) {
        assert.equal(typeof result[stream], "string");
        assert.equal(archived.get(prefix + "." + stream + ".log"), digest(result[stream] as string), "Owned raw stream differs from its archived bytes.");
      }
      if (nativeAcceptancePlatform === "linux") {
        assert.equal(cleanup.method, "linux-marker-and-process-identity"); assert.ok(Number.isSafeInteger(cleanup.observedProcesses) && Number(cleanup.observedProcesses) >= 1);
        const identity = record(result.identity); assert.ok(Number.isSafeInteger(identity.pid) && Number(identity.pid) > 1);
        assert.ok(result.nativeJobReceipt == null && result.nativeJobIdentity == null && result.nativeCapability == null);
        const lifecycleOwner = bound("scripts/lib/isolated-public-verification.mts", "runOwnedVerificationChild");
        assert.ok(nodes(lifecycleOwner).some(node => ts.isVariableDeclaration(node) && node.name.getText() === "markerKey" && node.initializer
          && ts.isStringLiteral(node.initializer) && node.initializer.text === "VENESIA_QA_OWNED_CHILD"));
        return { row, result };
      }
      assert.ok(built); assert.equal(cleanup.method, "windows-private-job");
      const receipt = record(result.nativeJobReceipt), identity = record(result.nativeJobIdentity), capability = record(result.nativeCapability);
      assert.equal(receipt.status, "PASS"); assert.equal(receipt.nativeFailure, null); assert.equal(receipt.rootExitCode, exitCode); assert.equal(receipt.rootSignal, null);
      for (const field of ["jobToken", "helperPid", "rootPid", "rootCreationTimeFileTime"]) assert.deepEqual(receipt[field], identity[field]);
      assert.equal(receipt.ownerJobAssignedBeforeResume, true); assert.equal(receipt.jobHandleNonInheritable, true); assert.equal(receipt.effectiveLimitFlags, 8192); assert.equal(receipt.resumeSucceeded, true);
      const zero = record(receipt.cleanup); assert.equal(zero.status, "PASS"); assert.equal(zero.activeProcessesAfterCleanup, 0); assert.deepEqual(zero.activeProcessIdsAfterCleanup, []);
      assert.equal(zero.rootHandleExited, true); assert.equal(zero.processTreeVerified, true); assert.equal(zero.jobHandleClosed, true);
      for (const field of ["sourceSha256", "executableSha256", "compilerSha256", "provenance"]) assert.equal(capability[field], built[field]);
      for (const suffix of [".native-identity.json", ".native-result.json"]) assert.ok(archived.has(prefix + suffix));
      return { row, result };
    };
    stage = "transport_actual_entry";
    const transport = owned("actual_owned_transport_leaf", "scripts/qa-isolated-supabase-transport.mjs", 0);
    const transportModule = bound("scripts/qa-isolated-supabase-transport.mjs", "$module"); noTautologies(transportModule);
    const registrations: Array<{ position: number; names: string[] }> = [], helperPushes = new Set<ts.Node>();
    const caseBindings = nodes(transportModule).filter(node => (ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.name.getText() === "cases");
    assert.equal(caseBindings.length, 1); const caseBinding = caseBindings[0];
    assert.ok(caseBinding && ts.isVariableDeclaration(caseBinding) && caseBinding.initializer && ts.isArrayLiteralExpression(caseBinding.initializer));
    assert.equal(caseBinding.initializer.elements.length, 0);
    for (const helperName of ["check", "protocolCase", "transportSetupCase"]) {
      const helper = declaration("scripts/qa-isolated-supabase-transport.mjs", helperName); assert.ok(ts.isFunctionDeclaration(helper) && helper.body);
      assert.equal(helper.parameters.length, 2); assert.equal(helper.parameters[0]!.name.getText(), "name");
      const pushes = nodes(helper).filter((node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText() === "cases.push");
      assert.equal(pushes.length, 1); assert.equal(pushes[0]!.arguments.length, 1); const pushedName = pushes[0]!.arguments[0];
      assert.ok(pushedName && ts.isIdentifier(pushedName) && pushedName.text === "name");
      assert.ok(live(pushes[0]!, helper)); helperPushes.add(pushes[0]!);
      if (helperName !== "protocolCase") {
        assert.equal(helper.parameters[1]!.name.getText(), "run"); assert.equal(helper.body.statements.length, 2);
        const first = helper.body.statements[0]; assert.ok(first && ts.isExpressionStatement(first));
        let action: ts.Expression = first.expression;
        if (helperName === "transportSetupCase") { assert.ok(ts.isAwaitExpression(action)); action = action.expression; }
        assert.equal(key(action), key(expression("run()"))); assert.equal(helper.body.statements[1]!.getText(), pushes[0]!.parent.getText());
      }
      const calls = directCall(transportModule, helperName); assert.ok(calls.length > 0);
      assert.equal(nodes(transportModule).filter(node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === helperName).length, calls.length,
        "Conditional or indirect transport registrations are not qualified.");
      for (const call of calls) {
        assert.ok(live(call, transportModule)); assert.equal(call.arguments.length, 2); const label = call.arguments[0]; assert.ok(label && ts.isStringLiteral(label));
        if (helperName !== "protocolCase") assert.ok(ts.isArrowFunction(call.arguments[1]!));
        if (helperName !== "check") assert.ok(ts.isAwaitExpression(call.parent));
        registrations.push({ position: call.getStart(), names: [label.text] });
      }
    }
    for (const push of nodes(transportModule).filter((node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText() === "cases.push")) {
      if (helperPushes.has(push)) continue;
      assert.ok(live(push, transportModule)); assert.equal(push.arguments.length, 1); const label = push.arguments[0]!;
      if (ts.isStringLiteral(label)) registrations.push({ position: push.getStart(), names: [label.text] });
      else {
        assert.ok(ts.isTemplateExpression(label) && label.templateSpans.length === 1);
        let loop: ts.Node | undefined = push.parent; while (loop && loop !== transportModule && !ts.isForOfStatement(loop)) loop = loop.parent;
        assert.ok(loop && ts.isForOfStatement(loop) && ts.isArrayLiteralExpression(loop.expression)
          && ts.isVariableDeclarationList(loop.initializer) && loop.initializer.declarations.length === 1);
        const binding = loop.initializer.declarations[0]!.name, span = label.templateSpans[0]!;
        assert.ok(ts.isIdentifier(binding) && ts.isIdentifier(span.expression) && span.expression.text === binding.text);
        // live() accepts only the existing literal four-reason loop here. No expression or callback is evaluated.
        const names = loop.expression.elements.map(reason => { assert.ok(ts.isStringLiteral(reason)); return label.head.text + reason.text + span.literal.text; });
        registrations.push({ position: push.getStart(), names });
      }
    }
    const expectedCases = registrations.sort((a, b) => a.position - b.position).flatMap(row => row.names);
    assert.ok(expectedCases.length > 0); assert.equal(new Set(expectedCases).size, expectedCases.length);
    assert.equal(transport.row.status, "PASS"); assert.equal(transport.row.checks, expectedCases.length); assert.deepEqual(strings(transport.row.cases), expectedCases);
    assert.equal(transport.result.stderr, ""); assert.ok(typeof transport.result.stdout === "string");
    const terminal = record(JSON.parse(transport.result.stdout)); assert.equal(terminal.status, "PASS"); assert.equal(terminal.checks, expectedCases.length); assert.deepEqual(terminal.cases, expectedCases);
    for (const field of ["dockerExecuted", "productionAccess", "externalConnections"]) assert.equal(terminal[field], false);
    requireExpressions(transportModule, ["runContainerPipe('db', input, output)", "assert.equal(requestDigest, hash(request))",
      "assert.equal(hash(Buffer.concat(chunks)), hash(reply))", "assert.equal(snapshot.active, 0)", "assert.equal(snapshot.localProcesses, 0)", "assert.equal(bridge.snapshot().listeners.length, 0)"]);
    requireExpressions(transportModule, ["validateTransportOptions({ ...options, dockerHost: 'tcp://remote.invalid:2375' })",
      "validateTransportOptions({ ...options, ports: { ...ports, extra: 56169 } })", "validateTransportOptions({ ...options, ports: { ...ports, rest: ports.db } })",
      "runContainerPipe('https://external.invalid')"]);
    requireExpressions(transportModule, ["assert.equal(setupTimers, 1)", "assert.equal(first, second)",
      "assert.deepEqual(actual.snapshot().cleanup, { status: 'PASS', listeners: 0, pendingListenerCloses: 0, active: 0, localProcesses: 0, pendingSocketCloses: 0, setupTimerActive: false })",
      "assert.equal(attempted, 1)", "assert.equal(failure.diagnostic.listenerIndex, 0)", "assert.equal(failure.cause.code, original.code)", "assert.equal(holder.listening, true)",
      "assert.equal(attempted, 3)", "assert.equal(failure.diagnostic.listenerIndex, 2)",
      "assert.deepEqual(failure.cause, { name: 'Error', code: 'EACCES', errno: -13, syscall: 'listen', address: '127.0.0.1', port: ports.rest, phase: 'listen' })",
      "assert.equal(Object.isFrozen(failure.cause), true)", "assert.equal(Object.isFrozen(failure.diagnostic), true)",
      "assert.ok(Object.getOwnPropertySymbols(failure).some(key => failure[key] === original))",
      "assert.equal(JSON.stringify(failure).includes(secret), false)", "assert.equal(inspect(failure).includes(secret), false)",
      "assert.equal(failure.cause.syscall, null)", "assert.equal(inspect(failure).includes('private unstructured failure'), false)",
      "assert.equal(error.diagnostic.cleanup.status, 'NOT_STARTED')", "assert.equal(servers, 0)", "assert.equal(timers, 0)",
      "assert.equal(getEventListeners(controller.signal, 'abort').length, 0)", "assert.equal(failure.code, 'QA_TRANSPORT_CANCELLED')",
      "assert.equal(failure.code, 'QA_TRANSPORT_SETUP_TIMEOUT')", "assert.equal(failure.diagnostic.originalErrorRetainedPrivately, false)",
      "assert.equal(snapshot.failure.code, 'QA_TRANSPORT_CANCELLED')", "assert.equal(snapshot.cleanup.pendingSocketCloses, 0)",
      "assert.deepEqual(unhandled, [])", "assert.equal(actual.snapshot().failure.phase, 'active_listener')", "assert.equal(actual.snapshot().failure.causeCode, 'EIO')",
      "assert.equal(failure.diagnostic.cleanup.status, 'FAIL')", "assert.equal(failure.cause.code, 'EACCES')",
      "assert.rejects(closing, /QA_TRANSPORT_CLEANUP_INCOMPLETE/u)", "assert.equal(actual.snapshot().cleanup.pendingListenerCloses, 1)", "assert.equal(cleared, true)"]);
    const setupCleanup = declaration("scripts/qa-isolated-supabase-transport.mjs", "setupCleanup");
    requireExpressions(setupCleanup, ["assert.equal(error.diagnostic.cleanup.status, expected)", "assert.equal(error.diagnostic.cleanup.listeners, 0)",
      "assert.equal(error.diagnostic.cleanup.active, 0)", "assert.equal(error.diagnostic.cleanup.localProcesses, 0)",
      "assert.equal(error.diagnostic.cleanup.pendingSocketCloses, 0)", "assert.equal(error.diagnostic.cleanup.setupTimerActive, false)"]);
    stage = "cli_actual_no_allocation_entry";
    const rejected = owned("actual_cli_no_allocation_rejection", cliFile, 1); assert.equal(rejected.result.stdout, ""); assert.equal(rejected.row.applicationOutputSupplied, false);
    assert.deepEqual(rejected.row.failure, { status: "needs_attention", stage: "cli", code: "OUTPUT_REQUIRED" });
    assert.ok(typeof rejected.result.stderr === "string"); assert.equal(rejected.row.stderrSha256, digest(rejected.result.stderr));
    assert.deepEqual(rejected.result.stderr.split(/\r?\n/u).filter(line => line.trim().startsWith("{")).map(line => JSON.parse(line)), [rejected.row.failure]);
    for (const [file, role, control] of [[lockFile, "read_parse_validate_data", "actual_release_lock_input"], ["scripts/lib/windows-owned-process.cs", "compiled_native_owner", "windows_imported_type_and_source_contracts"],
      ["scripts/qa-isolated-supabase-transport.mjs", "owned_executable_leaf", "actual_owned_transport_leaf"], [cliFile, "actual_parser_dispatcher_and_rejection", "actual_cli_parser_dispatcher"]])
      coverage.push({ file: file!, check, entry, evidence: { kind: "qualified_input_control_observations",
        role: file === "scripts/lib/windows-owned-process.cs" && nativeAcceptancePlatform === "linux" ? "platform_rejection_and_compiler_input_controls_only" : role,
        control, nonce: raw.nonce, artifacts: [...artifacts.keys()] } });
  } catch { failures.push("four_input_observations_invalid:" + stage); }
  return { status: failures.length ? "BLOCKED" as const : "PASS" as const, failures, coverage: failures.length ? [] : coverage,
    nativeAcceptancePlatform, nativeAcceptanceStatus: failures.length ? "BLOCKED" : nativeAcceptancePlatform === "win32" ? "ACTUAL_NATIVE_EXECUTION" : "PLATFORM_REJECTION_AND_SOURCE_CONTRACT_ONLY",
    nativeExecuted: !failures.length && nativeAcceptancePlatform === "win32",
    proofLimits: nativeAcceptancePlatform === "linux" ? ["C# compiler inputs use controlled ports; Windows capability rejects this platform before compiler/spawn.", "No Windows native build or lifecycle execution is established; this evidence cannot qualify Windows Full E."]
      : ["Only the affected input controls execute; the unchanged broader native lifecycle matrix is not rerun.", "Full E admission additionally requires the owner's fresh nonce, outer cleanup and complete artifact/dependency/runtime closure."],
    proofBoundary: "source_and_behavior_observations_only" as const, requiresOwnerNonceOuterReceiptAndArtifactClosure: true };
}

/** Positive executable proof only; dynamic/non-import fixture use cannot authorize a bounded gate. */
export function localVerificationCoverage(scripts: Readonly<Record<string, string>>, impact: LocalVerificationImpact,
  manifest: readonly { file: string; sha256: string }[], request?: PublicGateRequest) {
  const coverage = new Map(impact.changes.filter(row => /^(?:scripts|tests)\//u.test(row.file)).map(row => [row.file, new Set<string>()]));
  const nativeGate = localVerificationNativeGate(request);
  const sourceOverrides = impact.verificationEntries?.length || nativeGate ? new Map(manifest.filter(row => /\.(?:[cm]?[jt]sx?)$/u.test(row.file))
    .map(row => [row.file, readFileSync(safeSourcePath(row.file), "utf8")])) : undefined;
  for (const binding of impact.verificationEntries ?? []) {
    assert.ok(/^(?:verify|qa):[a-zA-Z0-9:_-]+$/u.test(binding.check) && Object.hasOwn(scripts, binding.check));
    assert.ok(/^scripts\/[a-zA-Z0-9_./-]+\.(?:mjs|mts|js|ts)$/u.test(binding.entry) && sourceIncluded(binding.entry));
    assert.ok(manifest.some(row => row.file === binding.entry), "A verification entry must belong to the bound source snapshot.");
    assert.ok(impact.changes.some(row => row.checks.includes(binding.check)), "An executable binding must be a selected fresh check.");
    assert.ok(registeredVerificationNodeEntries(scripts, binding.check).includes(binding.entry),
      "A verification entry must be positively reachable through its selected literal registered command chain.");
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [binding.entry], symbolAware: false, sourceOverrides });
    for (const [file, checks] of coverage) if (graph.has(file)) checks.add(binding.check);
  }
  if (nativeGate && impact.changes.some(row => row.checks.includes(nativeGate.name))) {
    const driver = manifest.find(row => row.file === nativeGate.script);
    assert.ok(driver, "The selected native driver must belong to the bound source snapshot.");
    assert.equal(digest(sourceOverrides!.get(nativeGate.script)!), driver.sha256, "Native driver coverage must bind its actual source bytes.");
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [nativeGate.script], symbolAware: false, sourceOverrides });
    for (const [file, checks] of coverage) if (graph.has(file)) checks.add(nativeGate.name);
  }
  for (const [file, checks] of coverage) if (GATES.some(gate => gate.name === "public-e2e" && (gate.args as readonly string[]).includes(file))) checks.add("test:e2e:public");
  return [...coverage].map(([file, checks]) => ({ file, checks: [...checks] }));
}

const activeLocalVerifications = new WeakSet<PrivatePublicVerificationContext>();
/** Only a validated, source-bound active job may renew the existing control lease. */
export function isOwnedLocalVerificationActive(context: PrivatePublicVerificationContext) {
  return activeLocalVerifications.has(context);
}

/** An owned build-only configuration; Product config remains byte-for-byte source evidence. */
export function isolatedPublicImageConfigSource(apiPort: number, sourceConfigSha256: string) {
  assert.ok(Number.isSafeInteger(apiPort) && apiPort >= 1024 && apiPort <= 65535 && apiPort !== 3000,
    "Isolated image configuration requires the lifecycle-owned API port.");
  assert.match(sourceConfigSha256, /^[a-f0-9]{64}$/u);
  const images = { domains: [], remotePatterns: [{ protocol: "http", hostname: "127.0.0.1", port: String(apiPort),
    pathname: "/storage/v1/object/public/cms-images/**", search: "" }], dangerouslyAllowLocalIP: true, maximumRedirects: 0 };
  return [
    'import assert from "node:assert/strict";',
    'import { createHash } from "node:crypto";',
    'import { readFileSync } from "node:fs";',
    'import { dirname } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    'import { transpileConfig } from "next/dist/build/next-config-ts/transpile-config.js";',
    'import { normalizeConfig } from "next/dist/server/config-shared.js";',
    'const nextConfigPath = fileURLToPath(new URL("./next.config.ts", import.meta.url));',
    `assert.equal(createHash("sha256").update(readFileSync(nextConfigPath)).digest("hex"), ${JSON.stringify(sourceConfigSha256)});`,
    'export default async function isolatedPublicConfig(phase) {',
    '  const transpiledConfig = await transpileConfig({ nextConfigPath, dir: dirname(nextConfigPath) });',
    '  const config = await normalizeConfig(phase, transpiledConfig.default ?? transpiledConfig);',
    `  return { ...config, images: { ...config.images, ...${JSON.stringify(images)} } };`,
    '}',
    '',
  ].join("\n");
}

/** Constructed only inside the canonical lifecycle; never returned by its handle. */
export type PrivatePublicVerificationContext = {
  runDirectory: string;
  apiPort: number;
  anonKey: string;
  serviceKey: string;
  cleanEnvironment(): NodeJS.ProcessEnv;
  assertOwned(): Promise<void>;
  sanitize(value: string): string;
  record(stage: string, values: Record<string, string | number | boolean | null>): void;
};

type FinalQualityArtifactRef = { path: string; sha256: string };
type FinalQualitySource = { invocationHeadSha: string; sourceSha256: string; manifest: Array<{ file: string; sha256: string }> };
type FinalQualityOperation = { id: string; qualification: FinalQualityArtifactRef; run: string; sourceHead: string; sourceSha256: string; ownedRunId: string };
type FinalQualityNamedCell = { key: string; disposition: string; evidence: FinalQualityArtifactRef[] };
const FINAL_QUALITY_ACCOUNTING = ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/accounting/";
const FINAL_QUALITY_READINESS = FINAL_QUALITY_ACCOUNTING + "final-quality-readiness.json";
const RETAINED_FINAL_QUALITY_AUTHORITY = Object.freeze({
  retainedQualificationRoot: ".tmp-qa/core-final-closure/held37-final52-closure-2026-10-03/accounting/",
  final27Plan: { path: ".tmp-qa/core-final-closure/remaining-41-52-retry88-stage/qualification-adoption/selection-boundary-follow-on/qualification-plan.json",
    sha256: "69c927001ed4fa447a8a752eb2017ef0c5b0d1d8ddbe051987c7aad5b75a95bc" },
  operationIdentitySha256: "15721c1324f7123bcdbb6d72669ff81cf34229ff748e0e04ffbd39709f42d517",
  caseIdentitySha256: "f8a774a6e85c6ab9ec0bce374a5e18f286e8b840ed5b46349714ee00dae44d71",
  predicateCorrectionManifest: Object.freeze({
    path: "src/lib/admin/interaction-system/adoption-manifest.ts",
    historicalSha256: "fd5f69d19908c685a9d60a9f2f4ee1577074fa3b4381bdf9ea026d256091b36e",
    currentSha256: "5de0324b48ab33bb2052b72a7592c9a2f5f2af8896b74363b74726aee295b279",
    physicalPath: ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/root/offline-source-preimages/fd5f69d19908c685a9d60a9f2f4ee1577074fa3b4381bdf9ea026d256091b36e.txt",
    authority: { path: ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/root/offline-source-preimages.json",
      sha256: "393da014a1175e3bb70f9d625a374ce86c006fc5abf671a7a00dbdd99f92be71" },
  }),
  predicateCorrectionProof: Object.freeze({
    path: ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/root/specialized-atomic-integrated-proof.json",
    sha256: "7a9e4254a2886c918be56360dd88dd00cda01448c027ff0377828b2a013483cd",
  }),
  priorAccounting: Object.freeze({
    path: ".tmp-qa/core-final-closure/cumulative-accounting-stage/current77-retained84-partial79-85-86-application-stage/accounting-metadata-follow-on/current-accounting-successor.json",
    sha256: "34f9f296582055191d68b8415f44324587b68a77d29169317f159c84d3f573ab",
  }),
});

type RetainedQualityLifecycleCorrection = {
  baselineSource: FinalQualitySource;
  baselineReportImpact: {
    status: string; retained: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
    candidate: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
    changes: Array<{ path: string; beforeSha256: string | null; afterSha256: string; role: string }>;
    retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;
  };
  trackedPublicEnvironmentTemplate: {
    path: string;
    retainedGit: { head: string; sha256: string }; baselineGit: { head: string; sha256: string }; candidateGit: { head: string; sha256: string };
    gitSource: string; workingTreeSource: string; workingTreeSha256: string;
  };
  reviewStatus: string;
  owners: Array<{ path: string; beforeSource: string; afterSource: string; beforeSha256: string; afterSha256: string }>;
};

/** Exact post151 lifecycle correction; the existing behavioral and report-only guards stay intact. */
export function assertRetainedFinalQualityLifecycleSource(impact: Parameters<typeof assertRetainedFinalQualitySource>[0], retained: FinalQualitySource, candidate: FinalQualitySource): { originalSourceHead: string; originalSourceSha256: string; currentSourceHead: string; currentSourceSha256: string; reportChanges: Array<{ path: string; beforeSha256: string | null; afterSha256: string; role: string }> } {
  assert.equal(impact.status, "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT");
  assert.equal(impact.retainedBehaviorRelabelled, false); assert.equal(impact.retainedBehaviorReexecuted, false);
  assert.deepEqual(impact.automaticCoverage, []); assert.equal(impact.globalClosed, false);
  const correction = impact.qualityLifecycleCorrection; assert.ok(correction);
  assert.equal(correction.reviewStatus, "ROOT_REVIEWED_EXACT_POST151_LIFECYCLE_CORRECTION");
  const baseline = correction.baselineSource;
  assert.equal(baseline.invocationHeadSha, RETAINED_QUALITY_LIFECYCLE_BASELINE.sourceHead);
  assert.equal(baseline.sourceSha256, RETAINED_QUALITY_LIFECYCLE_BASELINE.sourceSha256);
  assert.equal(baseline.sourceSha256, digest(JSON.stringify(baseline.manifest)));
  assert.equal(correction.baselineReportImpact.status, "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT");
  assert.equal(Object.hasOwn(correction.baselineReportImpact, "qualityLifecycleCorrection"), false);
  assert.deepEqual(correction.baselineReportImpact.retained, impact.retained);
  const originalBinding = assertRetainedFinalQualitySource(correction.baselineReportImpact, retained, baseline);
  assert.match(candidate.invocationHeadSha, /^[a-f0-9]{40}$/u);
  assert.equal(impact.candidate.sourceHead, candidate.invocationHeadSha); assert.equal(impact.candidate.sourceSha256, candidate.sourceSha256);
  assert.equal(candidate.sourceSha256, digest(JSON.stringify(candidate.manifest)));
  assert.equal(new Set(candidate.manifest.map(row => row.file)).size, candidate.manifest.length);
  for (const row of candidate.manifest) { assert.ok(sourceIncluded(row.file)); assert.match(row.sha256, /^[a-f0-9]{64}$/u); }
  const before = new Map(baseline.manifest.map(row => [row.file, row.sha256])), after = new Map(candidate.manifest.map(row => [row.file, row.sha256]));
  const template = correction.trackedPublicEnvironmentTemplate;
  assert.ok(template, "The sole public template addition requires its exact tracked byte provenance.");
  const templateAuthority = RETAINED_QUALITY_LIFECYCLE_BASELINE.publicTemplate;
  assert.equal(template.path, templateAuthority.path);
  for (const [binding, source] of [[template.retainedGit, retained], [template.baselineGit, baseline], [template.candidateGit, candidate]] as const) {
    assert.deepEqual(binding, { head: source.invocationHeadSha, sha256: templateAuthority.gitSha256 });
  }
  assert.equal(digest(template.gitSource), templateAuthority.gitSha256);
  assert.equal(template.workingTreeSha256, templateAuthority.workingTreeSha256);
  assert.equal(digest(template.workingTreeSource), template.workingTreeSha256);
  assert.equal(template.workingTreeSource.replace(/\r\n/gu, "\n"), template.gitSource);
  assert.equal(retained.manifest.some(row => row.file === template.path), false);
  assert.equal(before.has(template.path), false);
  assert.equal(after.get(template.path), template.workingTreeSha256);
  const owners = RETAINED_QUALITY_LIFECYCLE_BASELINE.owners;
  assert.deepEqual(correction.owners.map(row => row.path).sort(), Object.keys(owners).sort());
  const parsed = new Map<string, { before: ts.SourceFile; after: ts.SourceFile }>();
  for (const row of correction.owners) {
    const name = row.path as keyof typeof owners;
    assert.equal(row.beforeSha256, owners[name]); assert.equal(before.get(name), row.beforeSha256);
    assert.equal(row.afterSha256, after.get(name)); assert.notEqual(row.afterSha256, row.beforeSha256);
    assert.equal(digest(row.beforeSource), row.beforeSha256); assert.equal(digest(row.afterSource), row.afterSha256);
    const parse = (source: string) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    parsed.set(name, { before: parse(row.beforeSource), after: parse(row.afterSource) });
  }
  const statementText = (node: ts.Node, file: ts.SourceFile) => node.getText(file).replace(/\r\n/gu, "\n");
  const declarationName = (node: ts.Statement) => ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) ? node.name?.text
    : ts.isVariableStatement(node) && node.declarationList.declarations.length === 1 && ts.isIdentifier(node.declarationList.declarations[0].name)
      ? node.declarationList.declarations[0].name.text : undefined;
  const exactReplace = (text: string, from: string, to: string, count = 1) => {
    assert.equal(text.split(from).length - 1, count, "The reviewed lifecycle transformation no longer matches its exact predecessor.");
    return text.split(from).join(to);
  };
  const pub = parsed.get("scripts/lib/isolated-public-verification.mts")!;
  const workerNames = ["RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS", "RETAINED_QUALITY_WORKER_SOURCE", "loadRetainedFinalQualityAdmissionAsync"];
  const addedNames = [...workerNames, "RetainedQualityLifecycleCorrection", "RETAINED_QUALITY_LIFECYCLE_BASELINE", "assertRetainedFinalQualityLifecycleSource"];
  const added = pub.after.statements.filter(node => addedNames.includes(declarationName(node) ?? ""));
  assert.deepEqual(added.map(node => declarationName(node)).sort(), [...addedNames].sort());
  assert.equal(digest(added.filter(node => workerNames.includes(declarationName(node)!)).map(node => statementText(node, pub.after)).join("\n")), RETAINED_QUALITY_LIFECYCLE_BASELINE.workerStatementsSha256);
  const proof = added.find(node => declarationName(node) === "assertRetainedFinalQualityLifecycleSource")!;
  assert.equal(digest(statementText(proof, pub.after)), RETAINED_QUALITY_LIFECYCLE_BASELINE.proofFunctionSha256);
  const declaredBaseline = added.find(node => declarationName(node) === "RETAINED_QUALITY_LIFECYCLE_BASELINE")! as ts.VariableStatement;
  const initializer = declaredBaseline.declarationList.declarations[0].initializer;
  assert.ok(initializer && ts.isCallExpression(initializer) && initializer.expression.getText(pub.after) === "Object.freeze" && initializer.arguments.length === 1);
  assert.deepEqual(JSON.parse(initializer.arguments[0].getText(pub.after)), RETAINED_QUALITY_LIFECYCLE_BASELINE);
  const additions = new Set(['import { Worker } from "node:worker_threads";', 'import ts from "typescript";']);
  assert.deepEqual(pub.after.statements.filter(node => additions.has(statementText(node, pub.after))).map(node => statementText(node, pub.after)).sort(), [...additions].sort());
  const preserved = pub.after.statements.filter(node => !addedNames.includes(declarationName(node) ?? "") && !additions.has(statementText(node, pub.after)));
  assert.equal(preserved.length, pub.before.statements.length);
  for (let index = 0; index < preserved.length; index++) {
    const previous = pub.before.statements[index]; let expected = statementText(previous, pub.before);
    if (declarationName(previous) === "assertRetainedFinalQualitySource") {
      expected = exactReplace(expected, "  retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;", "  retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;\n  qualityLifecycleCorrection?: RetainedQualityLifecycleCorrection;");
      expected = exactReplace(expected, '  assert.equal(impact.status, "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT");', '  if (impact.status === "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT") return assertRetainedFinalQualityLifecycleSource(impact, retained, candidate);\n  assert.equal(impact.status, "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT");');
    }
    if (declarationName(previous) === "isolatedPublicImageConfigSource") {
      expected = exactReplace(expected, "'  const module = await transpileConfig({ nextConfigPath, dir: dirname(nextConfigPath) });',", "'  const transpiledConfig = await transpileConfig({ nextConfigPath, dir: dirname(nextConfigPath) });',");
      expected = exactReplace(expected, "'  const config = await normalizeConfig(phase, module.default ?? module);',", "'  const config = await normalizeConfig(phase, transpiledConfig.default ?? transpiledConfig);',");
    }
    if (declarationName(previous) === "runOwnedPublicVerification") {
      expected = exactReplace(expected, "assert.equal(/^\\.env(?:\\.|$)/iu.test(name), false);", "assert.equal(/^\\.env(?:\\.|$)/iu.test(name) && !(name === \".env.example\" && manifest.some(row => row.file === name)), false);");
      expected = exactReplace(expected, "environmentFilesCopied: false", "privateEnvironmentFilesCopied: false, publicEnvironmentTemplateCopied: manifest.some(row => row.file === \".env.example\")", 2);
      expected = exactReplace(expected, "let retainedAdmission: ReturnType<typeof loadRetainedFinalQualityAdmission> | undefined;", "let retainedAdmission: Awaited<ReturnType<typeof loadRetainedFinalQualityAdmissionAsync>> | undefined;");
      expected = exactReplace(expected, "retainedAdmission = loadRetainedFinalQualityAdmission(request.retainedAdminBehaviorAdmissionSha256!,\n          { invocationHeadSha: headSha, sourceSha256: digest(JSON.stringify(manifest)), manifest });", "retainedAdmission = await loadRetainedFinalQualityAdmissionAsync(request.retainedAdminBehaviorAdmissionSha256!,\n          { invocationHeadSha: headSha, sourceSha256: digest(JSON.stringify(manifest)), manifest }, signal);");
      expected = exactReplace(expected, "retainedAdmission?.verify();", "await retainedAdmission?.verify();", 2);
      expected = exactReplace(expected, "    const childCleanup = await Promise.allSettled([...children].map(child => stopChild(child, context.cleanEnvironment())));", "    const [workerCleanup, childCleanup] = await Promise.all([\n      Promise.allSettled(retainedAdmission ? [retainedAdmission.close()] : []),\n      Promise.allSettled([...children].map(child => stopChild(child, context.cleanEnvironment()))),\n    ]);");
      expected = exactReplace(expected, "otherResourcesTouched: false });\n  }\n  const result = { status:", "otherResourcesTouched: false,\n      ...(retainedAdmission ? { retainedEvidenceWorkerStopped: retainedAdmission.workerStopped } : {}) });\n    if (retainedAdmission) assert.equal(retainedAdmission.workerStopped, true, \"Retained evidence worker must stop before cleanup completes.\");\n    for (const settled of workerCleanup) if (settled.status === \"rejected\") throw settled.reason;\n  }\n  const result = { status:");
    }
    assert.equal(statementText(preserved[index], pub.after), expected, "An existing Quality assertion, gate or owner statement changed outside the reviewed lifecycle transform.");
  }
  const lifecycle = parsed.get("scripts/lib/isolated-supabase.mts")!;
  const priorLifecycle = lifecycle.before.text.replace(/\r\n/gu, "\n");
  const nextLifecycle = lifecycle.after.text.replace(/\r\n/gu, "\n");
  assert.equal(digest(nextLifecycle), RETAINED_QUALITY_LIFECYCLE_BASELINE.lifecycleAfterLfSha256);
  assert.equal(digest(priorLifecycle), RETAINED_QUALITY_LIFECYCLE_BASELINE.lifecycleBeforeLfSha256);
  const navigation = parsed.get("scripts/verify-admin-core-navigation-permission-join.mjs")!;
  assert.equal(digest(navigation.after.text), RETAINED_QUALITY_LIFECYCLE_BASELINE.navigationAfterSha256);
  let expectedNavigation = navigation.before.text;
  expectedNavigation = exactReplace(expectedNavigation, "const target='scripts/verify-admin-adoption-readback-isolated.mts',source=fs.readFileSync(target,'utf8');", "const target='scripts/verify-admin-adoption-readback-isolated.mts',sourceBytes=fs.readFileSync(target),source=sourceBytes.toString('utf8').replace(/\\r\\n/gu,'\\n');");
  expectedNavigation = exactReplace(expectedNavigation, "sourceSha256:crypto.createHash('sha256').update(source).digest('hex')", "sourceSha256:crypto.createHash('sha256').update(sourceBytes).digest('hex')");
  assert.equal(navigation.after.text, expectedNavigation, "Only the two reviewed Navigation control statements may change; raw source identity and every assertion must be preserved.");
  const inventory = parsed.get("scripts/lib/verification-source-inventory.mts")!;
  assert.equal(digest(inventory.after.text), RETAINED_QUALITY_LIFECYCLE_BASELINE.inventoryAfterSha256);
  let expectedInventory = inventory.before.text.replace(/\r\n/gu, "\n");
  expectedInventory = exactReplace(expectedInventory, "  const parts = file.split(\"/\");", "  // The tracked public template is verification input, never an environment override.\n  if (file === \".env.example\") return true;\n  const parts = file.split(\"/\");");
  expectedInventory = exactReplace(expectedInventory, "  for (const file of additional) assert.ok(sourceIncluded(file), `Unsafe additional source: ${file}`);", "  for (const file of additional) {\n    assert.notEqual(file, \".env.example\", \"The public environment template must be Git tracked.\");\n    assert.ok(sourceIncluded(file), `Unsafe additional source: ${file}`);\n  }");
  assert.equal(inventory.after.text.replace(/\r\n/gu, "\n"), expectedInventory, "Only the exact tracked public template exception and additional-source rejection may change the inventory owner.");
  const infrastructure = parsed.get("scripts/verify-verification-infrastructure.mts")!;
  assert.equal(digest(infrastructure.after.text), RETAINED_QUALITY_LIFECYCLE_BASELINE.infrastructureAfterSha256);
  const expectedInfrastructure = exactReplace(infrastructure.before.text.replace(/\r\n/gu, "\n"), "assert.equal(sourceIncluded(\".env.local\"), false);", "assert.equal(sourceIncluded(\".env.example\"), true, \"The exact public template is eligible verification input.\");\nassert.deepEqual(selectSourceInventory([...required, \".env.example\"]), [...required, \".env.example\"].sort(),\n  \"Only the exact tracked template must enter the snapshot.\");\nassert.deepEqual(selectSourceInventory(required), required.slice().sort(), \"The template must not be synthesized when absent from Git.\");\nassert.throws(() => selectSourceInventory(required, [\".env.example\"]), /must be Git tracked/u);\nassert.throws(() => selectSourceInventory([...required, \".env.example\"], [\".env.example\"]), /must be Git tracked/u);\nfor (const file of [\".env\", \".env.local\", \".env.production\", \".env.production.local\", \".ENV.example\", \".env.EXAMPLE\",\n  \"nested/.env.example\", \"src/.env.example\", \".env.example.local\", \".env.example/child\", \"./.env.example\", \"../.env.example\",\n  \"/.env.example\", \"C:/.env.example\", \"C:\\\\.env.example\", \".env.example\\0\", \"private/.env.example\"]) {\n  assert.equal(sourceIncluded(file), false, `Private or aliased template path must stay excluded: ${file}`);\n  assert.equal(selectSourceInventory([...required, file]).includes(file), false);\n  assert.throws(() => selectSourceInventory(required, [file]), /Unsafe additional source/u);\n}\nassert.equal(sourceIncluded(\".env.local\"), false);");
  assert.equal(infrastructure.after.text.replace(/\r\n/gu, "\n"), expectedInfrastructure, "Every existing infrastructure assertion must remain intact beside the exact template controls.");
  const cliPulse = parsed.get("scripts/verify-isolated-application-cli-pulse.mjs")!;
  assert.equal(digest(cliPulse.after.text), RETAINED_QUALITY_LIFECYCLE_BASELINE.cliPulseAfterSha256);
  const expectedCliPulse = exactReplace(cliPulse.before.text, "assert.ok(source.includes('cliJobAbort?.abort();\\n        if (handle) activeHandles.delete(handle)'));", "assert.ok(source.replace(/\\r\\n/gu,'\\n').includes('cliJobAbort?.abort();\\n        if (handle) activeHandles.delete(handle)'));");
  assert.equal(cliPulse.after.text, expectedCliPulse, "Only the exact CRLF comparison correction may change the CLI control proof; every original assertion and raw source read must remain intact.");
  const controls = parsed.get("scripts/verify-isolated-supabase.mts")!;
  assert.equal(digest(controls.after.text), RETAINED_QUALITY_LIFECYCLE_BASELINE.controlsAfterSha256);
  const controlName = "verifyRetainedFinalQualityWorkerControls";
  assert.equal(controls.after.statements.filter(node => declarationName(node) === controlName).length, 1);
  const retainedControls = controls.after.statements.filter(node => declarationName(node) !== controlName);
  assert.equal(retainedControls.length, controls.before.statements.length);
  let addedControlCalls = 0;
  for (let index = 0; index < retainedControls.length; index++) {
    let expected = statementText(controls.before.statements[index], controls.before);
    const name = declarationName(controls.before.statements[index]);
    if (name === "main" || name === "retainedFinalQualityOnly") {
      expected = exactReplace(expected, "await verifyRetainedFinalQualityAdmissionControls();", "await verifyRetainedFinalQualityAdmissionControls(); await verifyRetainedFinalQualityWorkerControls();");
      addedControlCalls++;
      if (name === "retainedFinalQualityOnly") expected = exactReplace(expected,
        "memoryOnlyArtifacts: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0",
        "memoryOnlyArtifacts: false, tempFixtureCleanupVerified: true, realWorkers: true, trackedArtifactsWritten: false, browserExecuted: false, databaseCalls: 0, networkRequests: 0");
    }
    assert.equal(statementText(retainedControls[index], controls.after), expected, "Existing maintained controls must remain intact.");
  }
  assert.equal(addedControlCalls, 2);
  const original = new Map(retained.manifest.map(row => [row.file, row.sha256]));
  const changes = [...new Set([...original.keys(), ...after.keys()])].sort().flatMap(path => {
    if (original.get(path) === after.get(path)) return [];
    assert.ok(after.has(path), "A Quality lifecycle correction may not delete source.");
    const owner = Object.hasOwn(owners, path);
    const publicTemplate = path === template.path;
    if (!owner && !publicTemplate) assert.match(path, /^docs\/reports\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:md|json)$/u, "Only the exact reviewed Quality lifecycle owners and reports may differ from retained behavior.");
    return [{ path, beforeSha256: original.get(path) ?? null, afterSha256: after.get(path)!, role: owner ? "exact-quality-lifecycle-correction" : publicTemplate ? "preexisting-tracked-public-environment-template" : "non-executable-closure-report" }];
  });
  assert.deepEqual(impact.changes, changes);
  return { ...originalBinding, currentSourceHead: candidate.invocationHeadSha, currentSourceSha256: candidate.sourceSha256,
    reportChanges: changes.filter(row => row.role === "non-executable-closure-report") };
}

const RETAINED_QUALITY_LIFECYCLE_BASELINE = Object.freeze({
  "sourceHead": "233e5da3c20395cbd30bd289aa2ed11415b4eeea",
  "sourceSha256": "f0bdff669dafed8d11dff882bcdf802f2ac9e11a59e0e4736321105b35fd5fc1",
  "owners": {
    "scripts/lib/isolated-public-verification.mts": "42e7166eafc2f29176fa5be8b7e072b563b9b55d2ed2c682d31317d46afb6f3a",
    "scripts/lib/isolated-supabase.mts": "1e463410e5af6b15223df1bc099554f23c0c026eed3c3757934dfe86213c962b",
    "scripts/verify-isolated-supabase.mts": "d09900fcd7405baeb02f70e86bbe77fc82a419ed326dd29c0e752e4c97b1882c",
    "scripts/verify-admin-core-navigation-permission-join.mjs": "820bbbf23f31291c0449798bd3e11e272344bbee39db6eee45eca4e8417d6b93",
    "scripts/lib/verification-source-inventory.mts": "f9733f5798f6360215d58820b3a7fcedfeb00225d04bd5a7721d277f00d68f4f",
    "scripts/verify-verification-infrastructure.mts": "a59689a3faa08fecbd20eb9f183fe06717f58a841f0cbee562371d4ca6023eab",
    "scripts/verify-isolated-application-cli-pulse.mjs": "ed8c845a55c25a81c7f6615102f846e4a2bd9107b0f36171878baa2319325567"
  },
  "workerStatementsSha256": "c0e3683cd91bfd6413fcbf59f488be8593f7fc65be52ce480aa204a3bfee6634",
  "proofFunctionSha256": "aab18a7b5ddd412889f58831f0744a34052ad3bffba3c0d79d1a7334609a9304",
  "lifecycleBeforeLfSha256": "2973edeefb1bb931b453db333a89ab9d09b9b0044893c02ab917a3a057c1e6de",
  "lifecycleAfterLfSha256": "fa6507e20eb5d7636aecb807aada43c47aa8638d7473c4004a73607329b14eeb",
  "navigationAfterSha256": "765824e551d06e0879fc6dc1d2830bcde30bed1b77854749b89bf8567816f64c",
  "controlsAfterSha256": "450b70ede339aef3f119c919c7227521a96a36805479cc976806e45d942f7f89",
  "inventoryAfterSha256": "e0f484806258d05744d6fbf707570579ca111fc4894699e14a13055d8a88f897",
  "infrastructureAfterSha256": "10788b81821be2d3bc6fef3d3ca76558bc29df745cd45e812c9cad86291b17b4",
  "publicTemplate": {
    "path": ".env.example",
    "gitSha256": "4fdf4cae62b0073b860dccfced0d07aa485f139cf996e56c37850f89fcc0dea8",
    "workingTreeSha256": "d24dc04f7c75949da64afd12ab7255d8292ffbd9fbc3c031a8434303520e2bae"
  },
  "cliPulseAfterSha256": "330a62b5259d81d8c76b3f7c2e717953e5cb8a896ebb143e212b57c44b334bdf"
});

/** Exact retained source, with only the finite reviewed report delta admitted. */
type RetainedQualityReconciliationCorrection = {
 previousSource: FinalQualitySource;
 previousImpactSource: string;
 owners: Array<{path:string;beforeSha256:string;afterSha256:string;beforeSource:string;afterSource:string}>;
 reviewStatus: 'ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION';
};

const RETAINED_QUALITY_RECONCILIATION_BASELINE = Object.freeze({
  "reportPaths": [
    "docs/reports/ADMIN_CORE_HELD37_FINAL52_BOUNDED_CLOSURE_STOP_2026-10-04.json",
    "docs/reports/ADMIN_CORE_HELD37_FINAL52_BOUNDED_CLOSURE_STOP_2026-10-04.md"
  ],
  "historicalQualificationGuards": [
    {
      "path": "scripts/fixtures/admin-core-domain-form-journeys.mjs",
      "export": "assertCoreControlPartial158Completion",
      "qualification": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/accounting/browser-r158-partial-control-observations.json",
        "sha256": "6047cbebc9a1af0db9b9f3e6714dc63f1c36c8a790414c429c86a5eeb6086686"
      },
      "historicalOwner": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/inventories/control-target-preparation/post158/qualification-owner-c75855482da1a0253bdb7a9e78e25a1c9e04be8ee76a71117d10a59a8764a23e.txt",
        "sha256": "c75855482da1a0253bdb7a9e78e25a1c9e04be8ee76a71117d10a59a8764a23e"
      },
      "declarationSha256": "6a104b610573a683348c0f57ba2baf321c7696037dcf35ff2e803a3e2f21f471"
    },
    {
      "path": "scripts/fixtures/admin-core-domain-form-journeys.mjs",
      "export": "assertCoreControlPartial159Completion",
      "qualification": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/accounting/browser-r159-partial-control-observations.json",
        "sha256": "696d31160a11b3bb8238b6e2f1abb48aa7ad6ba944f10b0bc9041608cf1fa784"
      },
      "historicalOwner": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/inventories/control-target-preparation/post159/partial159-owner-candidate.txt",
        "sha256": "bd2cf598420d3cb8928a86b421ca7d9ee8e1f872c2e38d2572d2abc09f768887"
      },
      "declarationSha256": "4d935d2cbd166341195ca6c148e11928690adb2bc52c96fd7390441bb5898837"
    },
    {
      "path": "scripts/fixtures/admin-core-domain-form-journeys.mjs",
      "export": "assertCoreControlPartial161Completion",
      "qualification": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/accounting/browser-r161-partial-control-observations.json",
        "sha256": "c290ba993d27343626d123d21a9135f26611b57f63502312182e774025a92644"
      },
      "historicalOwner": {
        "path": ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/inventories/control-target-preparation/post161/qualification-owner-cc3d50b7942a7b1f9901576eaf9e685b90997f8158642e655b8f17984d2ca0bf.txt",
        "sha256": "cc3d50b7942a7b1f9901576eaf9e685b90997f8158642e655b8f17984d2ca0bf"
      },
      "declarationSha256": "be1655568bc2694628db997a8f957428016d68a8ca0484b74812f9f2800d1585"
    }
  ],
  "sourceHead": "9cbdf71b0951ec61dc4acee6e171d279cde490d6",
  "sourceSha256": "9649d351b8af4d9e0110ba2b5024d8d0917afd4cdb79b17c8b87ed232c970211",
  "previousImpactSha256": "7496d93c3bf66554dc3907ce7d6955aa7124f285743691f440bd092de8fc3e7c",
  "owners": {
    "scripts/fixtures/admin-core-descendant-presentation-journeys.mjs": {
      "beforeSha256": "6c11e075e94109db21750f76a305489321ad43de5edcd638063616d97ca92b06",
      "beforeStatementsSha256": "3383764fd1286b2c37a1316079cc4677f823c35a50e56baf7063cc602958882c",
      "afterSha256": "c41d62075cfcad8d7d652800e3c6525d7a7b0eef3c46503335a8dd91c232b093",
      "afterStatementsSha256": "50f23c623b1e81404d39ef74c263929a789a4abfbdf7733bf7f241624a0321ed",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-descendant-presentation-plan.mjs": {
      "beforeSha256": "015e180f6e802c7063a4257b9c923d8a0d76983cc7ce8a6abe2fedf3821ec3d5",
      "beforeStatementsSha256": "80b2445306bce008b0a321fede78fbf58ebd7e4982ca0e8369cd8f65376caa29",
      "afterSha256": "e05b6f88ad6cf38cc40bc03eaaa57e6a4d4ba4b78ae22bf3dd0eceb265bea68d",
      "afterStatementsSha256": "446932cb4785a29768f99d8819a718a4a86d2ca9f9e020274e476efa604737ee",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-domain-bulk-journeys.mjs": {
      "beforeSha256": "0ebda7811a473cdaf305859ddea8790e11a65d9eaae4f62c90cd3c655043f818",
      "beforeStatementsSha256": "9c1e64e0846b58726d08b764724abe4f32791f3bfe0059e5898a5ad85c4268b1",
      "afterSha256": "f919ff8410aa879b92849cb5c832ca2555e160e102b19bb8e325e12cafc98578",
      "afterStatementsSha256": "587eb2aff31283d7f89d51e79ab7efb766f7254c346bbdf7285cc798dc5bb417",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-domain-form-journeys.mjs": {
      "beforeSha256": "2787eaeb8da121e06bd7d4040e1176455ab5c1747f0428362190aab020ee4624",
      "beforeStatementsSha256": "450ea2bccbe2789272f034f27de1d123a28b24425c0062243a2c9c68f2e8fe84",
      "afterSha256": "89bf1d066100ee867a390e3411b246ad5d03d1fab11a16b6a531da4f0c956433",
      "afterStatementsSha256": "95147002b2a92b385bc07978401a2b3ff71629bd0bb3087fb8e17480bbb4d03e",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-form-journeys.mjs": {
      "beforeSha256": "f22e0a80149bbf622a6c27d895f4568c021d8aa2881b6f63f5fa94d47b0d111a",
      "beforeStatementsSha256": "2952b3682b998f55c9db7d87f5db24724bf99f6243c0d34994651bfb6ae0e4a0",
      "afterSha256": "b25bc73a20a6a765ff2a95b91a212e0af3b3ef8e514760a3a5c323652b569eb7",
      "afterStatementsSha256": "c4c2ae54e2c3eb6e6920b267223f046b05193fa00d363e906fe5e2d8f67b28d7",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-navigation-settings-journeys.mjs": {
      "beforeSha256": "0de5ff4e5c76a0d64661a502d611e9763e98ea23774504e35efc4d268a78e80b",
      "beforeStatementsSha256": "44806a29bb563df370a779b80f5d5a9831e07c4400cc4d8c65ca9bc40e0fa2d0",
      "afterSha256": "2a6316d640e6b3642c64fac56beef96c53927692ea84448817f994e595328980",
      "afterStatementsSha256": "5377b486c9e304a4289b895d6641ffff84c5d630f099ec12a5e3e5bec77a9e4a",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-operational-form-journeys.mjs": {
      "beforeSha256": "9ee6b60ef8923181835d84e3ae56faec474bf751faca9c96dec0916f0a66c444",
      "beforeStatementsSha256": "992f817e09c9298eac23a383da6e9229f9088739bb8e2de1d79e7bc669f027c9",
      "afterSha256": "73f4f126f84f96b4a2b0fb77d277a753fb0df1248717974c11425eefd3729ad8",
      "afterStatementsSha256": "7995aa96208187d65da6979fb879ff7e56f20debded78700b216f88386efcc38",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-page-composition-journeys.mjs": {
      "beforeSha256": "bd18bf5fcdae9c7dc73cb5e4ffafca7ad7796fd72c9f46857dd51d4e4e89519f",
      "beforeStatementsSha256": "2fa634dd526fe122b8139cf8e75016398f6cf068369b44a6ce32fcd22fa27643",
      "afterSha256": "2c06c301c6bbbeaca3dae111b6a5d85405e8c01d0ba6b8596cee479894be3c29",
      "afterStatementsSha256": "b82435ed1490e3e5e16a8c4b91fc794c9e6660913f450155545f416a28f2d864",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-presentation-controls-journeys.mjs": {
      "beforeSha256": "ca7adccfb96af78b67967acae19e85f2c9d6ad7e62bd92765184c18e80a1db07",
      "beforeStatementsSha256": "23d876cae1dafe7f5d681e96b31914abf098b00c04e03f50d7c2fd731707327d",
      "afterSha256": "ed9ba1f029b20ea577635d61489c8d8c979054a5b37d1258880da034aada8d0d",
      "afterStatementsSha256": "5d32b51ead0d3fa5f4ba950915cf1c183fa189b91c6dc9a94034c5ff530522e7",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-query-presentation-journeys.mjs": {
      "beforeSha256": "07d9a46f12c16fa350b57c83e04753fb100e30246d44516039cd9b057f3c5ec9",
      "beforeStatementsSha256": "af0760f98bf53b5594aceb46767a39ff63629789f125821dffc03dc51f275ebf",
      "afterSha256": "b47f656656409497a5188e5ba2ffdd0daf79e9bbf72f471010c6cf809a229b38",
      "afterStatementsSha256": "3d4b168b97976e8f95e95fd462950dd24a0e7a4e15ea6db8cf5d12b92545811b",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-query-presentation-plan.mjs": {
      "beforeSha256": "fc10ddf4f35cffa3bbe75e841e0ca23192beb8dea1e511d4f4d9054919c7c4d5",
      "beforeStatementsSha256": "8698d412caaa6ba2e2ed6182b819f4e338ac1137ebc69dee6a9159b0474020f0",
      "afterSha256": "0edabba8604f429fe2ce8ddf8738fc545c395ee559f851c086305e7153552001",
      "afterStatementsSha256": "9f07951cda286b7ac17e67237904917e4f52c4443eb825b6b027f518a3e9e7f9",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-readonly-journeys.mjs": {
      "beforeSha256": "3277a78c0d23b13080d993cd9a16fe226dd6e16e798b03959633d264af4800a2",
      "beforeStatementsSha256": "24c6f71312fe2e03e28635920efa62797149849dc159dac174baa4c613d1abdb",
      "afterSha256": "7797b0ae78157c69111621387b315997fc4aab4366c16b6f2474ad62a0105b19",
      "afterStatementsSha256": "a6ae2fae125f621822e708b04157fcb27f8b7053b9bf12019b5dd014fc1a42c1",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-rendered-adoption.mjs": {
      "beforeSha256": "c0f3dc1f3f476ec9d1769d1b05a2c4be54c9ae437cf0ba8738bd83a0dcc8f967",
      "beforeStatementsSha256": "5c0ed792c6489a7ac0ae009a1466ae9d478d2aca7b65f6c677381f65dcc6dddf",
      "afterSha256": "3e86bfa09be496103553f9269e58a3cfc4b4c2a2d94f49fbd790364be6ffabf0",
      "afterStatementsSha256": "139e6677117239862fdd8d022c244fb4bd4dc9602a2cf1c6478f22661c7ce24e",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-settings-journeys.mjs": {
      "beforeSha256": "cec59b24d23faee38eb81d1af200d4a333f22e765163808cd87eb1a014aaf94f",
      "beforeStatementsSha256": "220c2a4f935bcdbb85c9d380aaefc9f931fde9a37b6196f9a112d12832176487",
      "afterSha256": "e6ec34127ee7e65c4987dfb7bd967071c73038144ec87385f89cdf56db389234",
      "afterStatementsSha256": "13dc99feb6b5acbe6f82aa0f8b8bb39eb8ddcfdc63811d619837b48c563fee10",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-core-specialized-settings-journeys.mjs": {
      "beforeSha256": "eeffbd9dbb3b1337cdc66e401cb99dcdc81ac4f6c9a9a195f0cfde5b74f57745",
      "beforeStatementsSha256": "b4f911451ca58b5facb37b34e2cb1f4577c82a97a4295305cb24945e6bd20a7e",
      "afterSha256": "2f419f828020f7f5c40e9ed0711ab2e700b55c53ed309ada9cbac7e9046ad7ff",
      "afterStatementsSha256": "40d770d50cb1947fd70955b53b8b9c13fd7b9f1b20d7c108bfb7bb95d512afea",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/fixtures/admin-interaction-fixtures.mts": {
      "beforeSha256": "3fb0bd53fef9dcefaf558fd084d4bb55a23a136a28535a60401c7e0c54468e05",
      "beforeStatementsSha256": "d93ec02f51d08273db18bee88d0816b5604eab927bd99ebd91e53c8cbfdce3d1",
      "afterSha256": "1205c438480e05ece83095908dda9516b23143499c00c4ec93e154eab900bb05",
      "afterStatementsSha256": "ac6303d92b04cdcb5302043b1d599fadaa54efd9ffc9e4d293396d99fb581a82",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/lib/isolated-public-verification.mts": {
      "beforeSha256": "ea7f02cefea03676467e63eb1c2a8a8cd073568dd800aa9695bec580de214298",
      "beforeStatementsSha256": "83a1412c8ace3277ec70f9ea46f575c5dee7687afced5d3aaff2356918c839cd",
      "afterSha256": null,
      "afterStatementsSha256": "56ebcf57ee4ba47f0004af230a8d9534912fc862d4e0501b58edc712db9dc9ae",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/qa-admin-adoption-journeys.mjs": {
      "beforeSha256": "b711f1b339dbead879384496683a2bee780a4c52de86f5021074f75ac23a176c",
      "beforeStatementsSha256": "8e7ea6f363796b6450d810b4093d4ff38ac9890efb7d69d8784278ab5d390179",
      "afterSha256": "39a92348756fbc06fbdf6d5eb4a84ab16171290e36f9c2e3197a4d897d9f4d31",
      "afterStatementsSha256": "424a27f1f67dfbdeec648818f948e2e81da6b53ffd0e982912907fce24659d77",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-adoption-closure.mjs": {
      "beforeSha256": "281daaed74d4565aacc5346545e4bf622e34296b1797b219f33cf9bae4fac247",
      "beforeStatementsSha256": "a306fe3862580a64bd9162a85b16aabe5246b055a63c5c7e4154e4c6aaafebd3",
      "afterSha256": "6858baf2dd659ac393dc47d7821bdd3020dad7199f1f47de3ad0e7b84e30bec4",
      "afterStatementsSha256": "f9c4df6590a4b631464f1c5def931c2943bf371b6eca3ba7acb0a66eaa4e4d50",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-adoption-readback-isolated.mts": {
      "beforeSha256": "ad0359c818e4d021c5083f9542b732c29b2112b77c58697924f3c129faa84db5",
      "beforeStatementsSha256": "7d910e3ca0375b46e8d8a7e5f44fc477c6cbb034034b0256595c71cc5271a0f2",
      "afterSha256": "eb22c05b727965c3d5838535326d5b0a62dc9806e1536081bf838328064da3d9",
      "afterStatementsSha256": "57878829fd7e01382aa710f36eae38e1ef75aa8d4f90b453c9013eb299831778",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-descendant-presentation-isolated.mts": {
      "beforeSha256": "8d8f0daea38dc24d888da839252e47906f4a1ad1abfe627611f305649ce9eec4",
      "beforeStatementsSha256": "3652fedbbb2a99475db9cf47accbecd1be792d1781b15cebc2b292651b3437c3",
      "afterSha256": "042e873a901caf907131cbe113b723fa236b4b4b482d6ed1ca4a2db29f61888e",
      "afterStatementsSha256": "c9fcee391086e0ec668d6710e891e82e3fa0ad86adf25f39089ae0f81e229f5c",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-descendant-presentation.mjs": {
      "beforeSha256": "446742dd011eab84dfdfdbf32e3eaf31a5745594c29e673574b3703e8e77d37c",
      "beforeStatementsSha256": "4976c6403cbfee4def57a8080bda5571a72c4e22b8cf46429de06d60a0e031a3",
      "afterSha256": "dfbf76bf361cd85bd522818324bdf2552ca90bfdfec2723c431be205d18c1293",
      "afterStatementsSha256": "121563eb51864a308c2bd9c65a8bff21ce511c2b8fd0a527fc593b87a0616eda",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-domain-bulk.mjs": {
      "beforeSha256": "28fa9dff975bd788db3113e89686632c0422dc3bc76b9cf6c4c3b6b27e598657",
      "beforeStatementsSha256": "b7021ab762ff7db73ee930d1b582626f5a8bba5539e7203ed96d9689cc1f8c2e",
      "afterSha256": "00bfb8bdf9ee9e59f9743e31ef621d5ac8adb4a9191a0563c13b35afcd121eb1",
      "afterStatementsSha256": "587b5261016101537a2f338838314ff131499a53ad3ed18b256e9d5a92d2d5eb",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-domain-readback-isolated.mts": {
      "beforeSha256": "1193d779667cf6915dd651df054e88d1baa6d4dbfd03cbc4a90e10a8a0ab0025",
      "beforeStatementsSha256": "b4e4006e4cf8d2a708eadb5334f2966af1aa1d88d3b99fd1b1cdcc1552ede07f",
      "afterSha256": "6d18d21238f4728c24a515d2dd6e7f5aff5877aac336d387e44a013702f6f018",
      "afterStatementsSha256": "f4dfe02e4f5c0c80aa7ecff59d263bc2210a1fbb2e3b6d853be8c8187718c82d",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-domain-readback.mts": {
      "beforeSha256": "e38505065f6cd8ad3b7e939adf8ec60d1113dc94e4b5714897ad5d04bbb0cff4",
      "beforeStatementsSha256": "d121a73a6315610d1ebaacb2c47b41663765cd9c10ac5a7ce1afa4e1fe8f174f",
      "afterSha256": "15ab7b7296eaf04b84d61de768b05db82b347ce8f5e87048b88d90e697e82402",
      "afterStatementsSha256": "006fbacd804007b8f51eee70e26407eef45192d369ee4544ea49daa084a6423d",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-journey-selection.mjs": {
      "beforeSha256": "6610ac8931282a5566bf444d68efc300e8089efc7b0628008e6ed843c9b3338f",
      "beforeStatementsSha256": "7b0ecfc47b6fb2702f2188c88e6c8c8cceeeb39c618bf026866dfefdc7eac606",
      "afterSha256": "0d13f51f90836e55a36875ed4efba3a056f20d5766d2a6d99c368f8f768e9ba8",
      "afterStatementsSha256": "654c15e85174c9e041703ceadd31f06663779da1e355958c88ea70d79e36ad85",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-navigation-settings.mts": {
      "beforeSha256": "bb0ea353b5da08212c8cc0960ee68aab1cf4c27ba290c7d304fd5a3165420b4d",
      "beforeStatementsSha256": "33ba8e27ecda16bf0b0acfc77151d1f9fc0d34496672cb780efc7def621ecb72",
      "afterSha256": "bbb40fdc3d59cfd3d32c9660bf2fe67527cd0d7925dc85e3f07ea293f306b6e4",
      "afterStatementsSha256": "9a56be194a6c532f786ac7ee5e64cf52ae04fbca88ae0ca50dfc8dd232183d4c",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-page-seo.mts": {
      "beforeSha256": "6c034c9e84d6440d3ebfb817c26b2e4c9bfb7bd5fb9eb46362e42d89d04741a6",
      "beforeStatementsSha256": "0dbc9e982107a087176fc836934428ba825ab9cda94a7fc002f1e3995c5a8a33",
      "afterSha256": "c76876d268386a3b7c8dff0d3ccda6ef0476b7a84f080cdc590744381a65e9c5",
      "afterStatementsSha256": "d5c7d70d99b19756ba2d0395a8ea75891f9c635fe6f9a194e212da3afc95a617",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-presentation-controls-isolated.mts": {
      "beforeSha256": "06c55fd052e0a161ae44bcd3a2242f632c810d48ce089fee75bf99d6bdb769f5",
      "beforeStatementsSha256": "a9e03947f8a697d32ee480cd95002965f7dfc99c5177ba0f61b2f56ab29a7a1f",
      "afterSha256": "b016c1c9c26a30b086d6ae004af3992acbdb52badd7a481c30f6a3f85f8f37da",
      "afterStatementsSha256": "219d6cf1bc5959537b9760786a0a19b232a58e28280680434794080eb0d1c042",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-query-presentation-isolated.mts": {
      "beforeSha256": "f2e5b678d5484ee10fec71f944a14974481290c5eb22d76f6aa9bc0a01d7ed32",
      "beforeStatementsSha256": "35051a775a8877c43ffcd700e494fc175e42bf2c489c4ff9dd0f058fe5b5fc90",
      "afterSha256": "956675ba5777701fe9f8075c2ce5a42f9fe7976ddf44785ec809aae9ecd738bc",
      "afterStatementsSha256": "2cbdfea185f102385220d16896aa336a7e0dffedbedbcd9782e6f86e94a5d182",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-query-presentation.mts": {
      "beforeSha256": "2850d28b21f36ae315ea963a7462a82a00c43d4e508ddbf4376fefb411eb90e2",
      "beforeStatementsSha256": "770faec6a45d90df08c60b27ef48eb11bc989ac7185aa673a04da0fab63ddbaa",
      "afterSha256": "6d163acb1745cf3fbe32ec2697e4550f75cb583cb02fdfb2caf73e66aed03af9",
      "afterStatementsSha256": "17b6199ae90c76cf9504b943133e788d0c606746ac31f8dd86b2aac4f2f2d86f",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-rendered-adoption.mjs": {
      "beforeSha256": "be2c026d1572313f01d3cc40c69c2b79f8295aa286e9cb40aa5793bff4b7ed47",
      "beforeStatementsSha256": "a5ae1784944a021cf8edfcd0d72e9267fbda767ada379963834e1648627f316c",
      "afterSha256": "54c2852440798b3daf36c3e12ac1358f3b6a7adee8098a4a346ee6dd322396e0",
      "afterStatementsSha256": "619a9fed0918a860bbba1221103530953e2b0de6af6b8ca04feb3aa694f88e69",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-specialized-settings-isolated.mts": {
      "beforeSha256": "36b1e47303c712d54687915081e5143609209d39d92067f692ab68ca59d98525",
      "beforeStatementsSha256": "45ad7e7889936e94b857b36676e1ef5746403a16af9e76aeafa84fed2265d66f",
      "afterSha256": "a5813d8cc763b1eaed530afb3d06094c99569c5237a6b810c61b829bc9ce7232",
      "afterStatementsSha256": "162ee3a2e3015c6c067c5632feb189bc5d0b0b3de3adefbaad1bba362eed58cf",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-specialized-settings.mts": {
      "beforeSha256": "ec8d760a26e2bb067f86b365bf5bcff6d37b4c52457cf62a92a5c74bad404068",
      "beforeStatementsSha256": "156e1e18a9060627fe570d671d8d09399d620e2c882e7f765a8d4dfaca7c219d",
      "afterSha256": "6cbe3f1b475737e3d935081f53a1bf02253c7b620c8630af0097baf718b3749a",
      "afterStatementsSha256": "6804e6fe1a0800d898000c4819cca2fba114fe64449cd109b2c3207ac6c00bcd",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-row-actions-capability.mts": {
      "beforeSha256": "9ba5398df86b2195946302269d3623ee3ad7ad75e76e9a1ccc80381b8046bd90",
      "beforeStatementsSha256": "a1ae87b4cd3a00955bcd43297b24ba213112410cc219774b208eb716fbcec7fa",
      "afterSha256": "1d86fb0e7894028fdfb3ff265b8e6326488c9b9af20e0435219d7ab022bb5f29",
      "afterStatementsSha256": "4c10412fd10d32dbd41908779ce873dc9d3f2b7e534d480057c49b6e58e2edd4",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-isolated-supabase.mts": {
      "beforeSha256": "450b70ede339aef3f119c919c7227521a96a36805479cc976806e45d942f7f89",
      "beforeStatementsSha256": "387fa617424869ac456fafac892b1d63ee04dced344e1cde7f7ebbc73c5f6148",
      "afterSha256": "989635d135134416c00cef56c45febe0f2bcbb1bf492fac86f150ce69bc8aeaf",
      "afterStatementsSha256": "0e6faa39aa8baa060819660927ef634f1df26af35aef3aa50d604058fccbb270",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "src/lib/admin/interaction-system/adoption-manifest.ts": {
      "beforeSha256": "fd5f69d19908c685a9d60a9f2f4ee1577074fa3b4381bdf9ea026d256091b36e",
      "beforeStatementsSha256": "28ea6ca2ebb7df602aa85a3208a3aaf8c8c0de8dd936c88d7c23e5567811c91e",
      "afterSha256": "5de0324b48ab33bb2052b72a7592c9a2f5f2af8896b74363b74726aee295b279",
      "afterStatementsSha256": "53fceb196e000d16d331297b5c04077ce90f5133c1061ca729ea51488861577f",
      "role": "exact-current-absent-listbox-nonpass-declaration"
    },
    "scripts/fixtures/admin-core-form-draft-restoration.mjs": {
      "beforeSha256": "7adc5725f6ed33c68d2adf34bd474a1564b94d8c89ad61f65e535a2a6ec22cce",
      "beforeStatementsSha256": "5518d30740b11388e91359c5c698d679e631b4545c15db1444ec7c9b0b8ded14",
      "afterSha256": "857e6c2bd215f4789a47da11db4e5ad38475b8f9778206072fb1152025596d57",
      "afterStatementsSha256": "045a760244051c3b4ed00b8a0f40345dfe3568ab3a20906021db8d7527f054aa",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-presentation-controls.mts": {
      "beforeSha256": "482004cfda70136c4ef09b4f4f45060e603e7ecf32f4379626f919c725458ff0",
      "beforeStatementsSha256": "da4708b6f983b95fa25820579029fc8b5e7564189c1bc8f28c65cb0d89e69fd6",
      "afterSha256": "33147a94b4854535574bb3db8eff5781de280e9764d5a7de248fc47cafca224f",
      "afterStatementsSha256": "b24196a9243e27117177c22c4be38949ba5f4d5a82116da2765fd20301aad400",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/lib/isolated-supabase.mts": {
      "beforeSha256": "366b42ea77b888caae2c0e387c61e1c994a2bdc1d67cefe16fe81ea85b7b5fff",
      "beforeStatementsSha256": "a3b1dbacb9baa81f511761208ac775fb879f944f0fe50fb247d7f9d2027909d2",
      "afterSha256": "ce2b0e36f7b8312a63174f39072722317a10b7f32210e79155e59da19566a465",
      "afterStatementsSha256": "6a1d2ea9b39f1cd3b1ce5ac3f033cc9182f26e7e9bce1b0b26724e75eaaa826f",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "src/app/admin/pages-blocks/pages/[id]/PageLayoutManager.tsx": {
      "beforeSha256": "dc44167f9bee627b493cc5425773374986e36933e3bffacdb0833e6bdb23dc64",
      "beforeStatementsSha256": "12e57cc34b9e905a966f700ad24a7115bf878253cce4a7f2a4d0fed394b6cea5",
      "afterSha256": "6429137fb71e9af9e40b27292a22f4ade07020135f49c6568d36dd2f09a2b4e5",
      "afterStatementsSha256": "c4b193c941a12cc48cc86267c48c3da87b8aa169e5555a2f79f9153046591192",
      "role": "exact-page-layout-event-value-capture-correction"
    },
    "src/components/admin/integrations/IntegrationConnectionWizard.tsx": {
      "beforeSha256": "8158c02350428bdd7ad2f16f423a1ee39f85655b7e509b199e30d46743cf68e9",
      "beforeStatementsSha256": "6002e9f0fad7098b08d4b07a436928d18b342889657385d18e3d189ee0b5068a",
      "afterSha256": "45e137d968bd86476cd51017cf8ecef188a53a4e58ec8542fd07c93c2e346d83",
      "afterStatementsSha256": "f72bc3f7e25e83553541ae2d486d7d7dbe191e08157d978963c579bebeaa7807",
      "role": "exact-integration-authorization-native-navigation-correction"
    },
    "scripts/verify-admin-core-navigation-permission-join.mjs": {
      "beforeSha256": "765824e551d06e0879fc6dc1d2830bcde30bed1b77854749b89bf8567816f64c",
      "beforeStatementsSha256": "90a9cc6b698a791ead122e854549b7b283b315a068f3b78dee39263de7abfc57",
      "afterSha256": "ca7c70c9088f1e95b824aae69fe3b1f07d4c0859dc34d5d7afa59d7a70c5d2c5",
      "afterStatementsSha256": "6e08ca0bfee3d3c157137433542ca7e6650ea34ad95d524497489bde5a4b04ad",
      "role": "reviewed-verification-ledger-reconciliation"
    },
    "scripts/verify-admin-core-query-search-boundaries.mjs": {
      "beforeSha256": "7b0e1189333a01bc48326b28193c163c230d9f3e63fedc2c07bc0dc891eb9947",
      "beforeStatementsSha256": "5b8705c4b5887fdae26ad40932e35eae342c5bfc95a85e3ee3d793dc12cb30bc",
      "afterSha256": "79df17e4719212100a9f1c5497af856b1b198a0994f463b33f300b2df058468a",
      "afterStatementsSha256": "0f07b00e8d0b88a85fd746160c2e5b03b8144f50001661ac19cd6ced05c1c1d7",
      "role": "reviewed-verification-ledger-reconciliation"
    }
  },
  "proofFunctionSha256": "7cbfeb8ddea148c59b628b2be6ac5d242a8beec4fadae427e7354c903ce7316a",
  "correctionTypeSha256": "c8eec6e73592cbe4e0381f87112385f2a9ac5d8768115ddfc442268863e55277",
  "entryAdditions": [
    "  ledgerReconciliation?: RetainedQualityReconciliationCorrection;\n",
    "  if (impact.status === \"ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION_SOURCE_IMPACT\") return assertRetainedFinalQualityReconciliationSource(impact, retained, candidate);\n"
  ],
  "absentListboxInsertion": "listbox: {\r\n                state: \"not_applicable\",\r\n                rationale:\r\n                  \"The Updates page mounts TrackingUpdateFormModal without a Listbox; collection bulk and selection are not required and enableSelection is false. Stage/Item selectors are separate mounted routes.\",\r\n              },\r\n              ",
  "authorizationNavigation": {
    "path": "src/components/admin/integrations/IntegrationConnectionWizard.tsx",
    "role": "exact-integration-authorization-native-navigation-correction",
    "beforeElement": "<Link\r\n              href={`/api/admin/integrations/${item.key}/authorize`}\r\n              className=\"inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/[.08] px-5 text-xs font-semibold text-[#E8CF9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]\"\r\n            >\r\n              {item.connectionId ? \"إعادة التفويض\" : \"بدء التفويض\"}\r\n            </Link>",
    "afterElement": "<a\r\n              href={`/api/admin/integrations/${item.key}/authorize`}\r\n              className=\"inline-flex min-h-11 items-center rounded-xl border border-[#D8B87A]/35 bg-[#D8B87A]/[.08] px-5 text-xs font-semibold text-[#E8CF9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]\"\r\n            >\r\n              {item.connectionId ? \"إعادة التفويض\" : \"بدء التفويض\"}\r\n            </a>"
  }
});

export function assertRetainedFinalQualityReconciliationSource(impact:Parameters<typeof assertRetainedFinalQualitySource>[0],retained:FinalQualitySource,candidate:FinalQualitySource): { originalSourceHead: string; originalSourceSha256: string; currentSourceHead: string; currentSourceSha256: string; reportChanges: Array<{path:string;beforeSha256:string|null;afterSha256:string;role:string}> } {
 const correction=impact.ledgerReconciliation;assert.ok(correction);const authority=RETAINED_QUALITY_RECONCILIATION_BASELINE;
 assert.equal(impact.status,'ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION_SOURCE_IMPACT');assert.equal(correction.reviewStatus,'ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION');
 assert.equal(impact.retainedBehaviorRelabelled,false);assert.equal(impact.retainedBehaviorReexecuted,false);assert.deepEqual(impact.automaticCoverage,[]);assert.equal(impact.globalClosed,false);
 assert.equal(digest(correction.previousImpactSource),authority.previousImpactSha256);const previousImpact=JSON.parse(correction.previousImpactSource) as Parameters<typeof assertRetainedFinalQualitySource>[0];assert.equal(previousImpact.status,'ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT');assert.equal(Object.hasOwn(previousImpact,'ledgerReconciliation'),false);
 const previous=correction.previousSource;assert.equal(previous.invocationHeadSha,authority.sourceHead);assert.equal(previous.sourceSha256,authority.sourceSha256);assert.deepEqual(previousImpact.retained,impact.retained);
 const retainedBinding=assertRetainedFinalQualitySource(previousImpact,retained,previous);
 assert.match(candidate.invocationHeadSha,/^[a-f0-9]{40}$/u);assert.equal(candidate.sourceSha256,digest(JSON.stringify(candidate.manifest)));assert.equal(impact.candidate.sourceHead,candidate.invocationHeadSha);assert.equal(impact.candidate.sourceSha256,candidate.sourceSha256);
 assert.equal(new Set(candidate.manifest.map(row=>row.file)).size,candidate.manifest.length);for(const row of candidate.manifest){assert.ok(sourceIncluded(row.file));assert.match(row.sha256,/^[a-f0-9]{64}$/u);}
 const prior=new Map(previous.manifest.map(row=>[row.file,row.sha256])),next=new Map(candidate.manifest.map(row=>[row.file,row.sha256]));assert.deepEqual([...next.keys()].sort(),[...prior.keys()].sort(),'This round cannot add/delete source files, including environment/config/migrations.');
 assert.deepEqual(correction.owners.map(row=>row.path).sort(),Object.keys(authority.owners).sort());
 const statement=(node:ts.Node,tree:ts.SourceFile)=>node.getText(tree).replace(/\r\n/gu,'\n'),parse=(path:string,text:string)=>{const tree=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal((tree as ts.SourceFile&{parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length,0);return tree;};
 const name=(node:ts.Statement)=>ts.isFunctionDeclaration(node)||ts.isTypeAliasDeclaration(node)?node.name?.text:ts.isVariableStatement(node)&&node.declarationList.declarations.length===1&&ts.isIdentifier(node.declarationList.declarations[0].name)?node.declarationList.declarations[0].name.text:undefined;
 const isReport=(path:string)=>authority.reportPaths.includes(path);
 const roles=new Map<string,string>();
 for(const row of correction.owners){
  const rule=authority.owners[row.path as keyof typeof authority.owners];assert.ok(rule);assert.equal(row.beforeSha256,rule.beforeSha256);assert.equal(prior.get(row.path),row.beforeSha256);assert.equal(next.get(row.path),row.afterSha256);assert.equal(digest(row.beforeSource),row.beforeSha256);assert.equal(digest(row.afterSource),row.afterSha256);assert.notEqual(row.beforeSha256,row.afterSha256);
  const before=parse(row.path,row.beforeSource),after=parse(row.path,row.afterSource);assert.equal(digest(before.statements.map(node=>statement(node,before)).join('\n')),rule.beforeStatementsSha256);
  if(row.path!=='scripts/lib/isolated-public-verification.mts'){
   assert.equal(row.afterSha256,rule.afterSha256);assert.equal(digest(after.statements.map(node=>statement(node,after)).join('\n')),rule.afterStatementsSha256);
  }else{
   // The self-authority has no self-referential full-file hash: every added body and every other statement is still exact.
   const addedNames=['RetainedQualityReconciliationCorrection','RETAINED_QUALITY_RECONCILIATION_BASELINE','assertRetainedFinalQualityReconciliationSource'];const additions=after.statements.filter(node=>addedNames.includes(name(node)??''));assert.deepEqual(additions.map(name).sort(),[...addedNames].sort());
   const proof=additions.find(node=>name(node)==='assertRetainedFinalQualityReconciliationSource')!;assert.equal(digest(statement(proof,after)),authority.proofFunctionSha256);
   const type=additions.find(node=>name(node)==='RetainedQualityReconciliationCorrection')!;assert.equal(digest(statement(type,after)),authority.correctionTypeSha256);
   const constant=additions.find(node=>name(node)==='RETAINED_QUALITY_RECONCILIATION_BASELINE')! as ts.VariableStatement;const init=constant.declarationList.declarations[0].initializer;assert.ok(init&&ts.isCallExpression(init)&&init.expression.getText(after)==='Object.freeze'&&init.arguments.length===1);assert.deepEqual(JSON.parse(init.arguments[0].getText(after)),authority);
   const remaining=after.statements.filter(node=>!addedNames.includes(name(node)??'')).map(node=>{let text=statement(node,after);if(name(node)==='assertRetainedFinalQualitySource'){for(const addition of authority.entryAdditions){assert.equal(text.split(addition).length,2);text=text.replace(addition,'');}}return text;});assert.equal(digest(remaining.join('\n')),rule.afterStatementsSha256);
  }
  roles.set(row.path,rule.role);
 }
 for(const expected of authority.historicalQualificationGuards){const row=correction.owners.find(value=>value.path===expected.path);assert.ok(row);const tree=parse(row.path,row.afterSource),found=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text===expected.export);assert.equal(found.length,1);assert.equal(digest(found[0].getText(tree)),expected.declarationSha256,'The actual accepted partial qualification declaration remains byte-identical.');}
 // The exact source deltas are the recorded absence declaration and the reviewed two-handler PageLayoutManager correction; both whole files and their distinct roles are pinned above.
 const declaration=correction.owners.find(row=>row.path==='src/lib/admin/interaction-system/adoption-manifest.ts');assert.ok(declaration);const exact=authority.absentListboxInsertion;assert.equal(declaration.beforeSource.includes(exact),false);assert.equal(declaration.afterSource.split(exact).length,2);assert.equal(declaration.afterSource.replace(exact,''),declaration.beforeSource);

 const navigation=authority.authorizationNavigation;assert.equal(navigation.path,'src/components/admin/integrations/IntegrationConnectionWizard.tsx');assert.equal(navigation.role,'exact-integration-authorization-native-navigation-correction');const wizard=correction.owners.find(row=>row.path===navigation.path);assert.ok(wizard);assert.equal(roles.get(wizard.path),navigation.role);
 assert.equal(navigation.afterElement.replace(/^<a/u,'<Link').replace(/<\/a>$/u,'</Link>'),navigation.beforeElement);assert.equal(wizard.beforeSource.split(navigation.beforeElement).length,2);assert.equal(wizard.afterSource.split(navigation.afterElement).length,2);assert.equal(wizard.afterSource.replace(navigation.afterElement,navigation.beforeElement),wizard.beforeSource,'Only the reviewed authorization opening and closing tags may change.');
 for(const [source,element,tag] of [[wizard.beforeSource,navigation.beforeElement,'Link'],[wizard.afterSource,navigation.afterElement,'a']]){const tree=parse(wizard.path,source),elements:ts.JsxElement[]=[];const visit=(node:ts.Node)=>{if(ts.isJsxElement(node)&&node.getText(tree)===element)elements.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(elements.length,1);assert.equal(elements[0].openingElement.tagName.getText(tree),tag);assert.equal(elements[0].closingElement.tagName.getText(tree),tag);}
 const actualRoundChanges=[...prior.keys()].filter(path=>prior.get(path)!==next.get(path));assert.deepEqual(actualRoundChanges.filter(path=>!isReport(path)).sort(),[...roles.keys()].sort());
 const previousRoles=new Map(previousImpact.changes.map(row=>[row.path,row.role])),original=new Map(retained.manifest.map(row=>[row.file,row.sha256]));const changes=[...new Set([...original.keys(),...next.keys()])].sort().flatMap(path=>{if(original.get(path)===next.get(path))return[];assert.ok(next.has(path));const role=isReport(path)?'non-executable-closure-report':roles.get(path)??previousRoles.get(path);assert.ok(role);return[{path,beforeSha256:original.get(path)??null,afterSha256:next.get(path)!,role}];});assert.deepEqual(impact.changes,changes);
 return{originalSourceHead:retainedBinding.originalSourceHead,originalSourceSha256:retainedBinding.originalSourceSha256,currentSourceHead:candidate.invocationHeadSha,currentSourceSha256:candidate.sourceSha256,reportChanges:changes};
}

export function assertRetainedFinalQualitySource(impact: {
  status: string; retained: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  candidate: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  changes: Array<{ path: string; beforeSha256: string | null; afterSha256: string; role: string }>;
  retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;
  qualityLifecycleCorrection?: RetainedQualityLifecycleCorrection;
  ledgerReconciliation?: RetainedQualityReconciliationCorrection;
}, retained: FinalQualitySource, candidate: FinalQualitySource) {
  if (impact.status === "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT") return assertRetainedFinalQualityLifecycleSource(impact, retained, candidate);
  if (impact.status === "ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION_SOURCE_IMPACT") return assertRetainedFinalQualityReconciliationSource(impact, retained, candidate);
  assert.equal(impact.status, "ROOT_REVIEWED_EXACT_REPORT_ONLY_SOURCE_IMPACT");
  assert.equal(impact.retainedBehaviorRelabelled, false); assert.equal(impact.retainedBehaviorReexecuted, false);
  assert.deepEqual(impact.automaticCoverage, []); assert.equal(impact.globalClosed, false);
  for (const [binding, source] of [[impact.retained, retained], [impact.candidate, candidate]] as const) {
    assert.match(source.invocationHeadSha, /^[a-f0-9]{40}$/u); assert.equal(binding.sourceHead, source.invocationHeadSha);
    assert.equal(binding.sourceSha256, source.sourceSha256); assert.equal(source.sourceSha256, digest(JSON.stringify(source.manifest)));
    assert.equal(new Set(source.manifest.map(row => row.file)).size, source.manifest.length);
    for (const row of source.manifest) { assert.ok(sourceIncluded(row.file)); assert.match(row.sha256, /^[a-f0-9]{64}$/u); }
  }
  const prior = new Map(retained.manifest.map(row => [row.file, row.sha256]));
  const next = new Map(candidate.manifest.map(row => [row.file, row.sha256]));
  const changes = [...new Set([...prior.keys(), ...next.keys()])].sort().flatMap(path => {
    if (prior.get(path) === next.get(path)) return [];
    assert.ok(next.has(path), "A report-only source impact cannot delete a retained source file.");
    assert.match(path, /^docs\/reports\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:md|json)$/u,
      "Executable, Product, Verification, migration, config and package source must remain equal to Final27.");
    return [{ path, beforeSha256: prior.get(path) ?? null, afterSha256: next.get(path)!, role: "non-executable-closure-report" }];
  });
  assert.deepEqual(impact.changes, changes, "Every actual source difference needs its exact reviewed report path and before/after hash.");
  return { originalSourceHead: retained.invocationHeadSha, originalSourceSha256: retained.sourceSha256,
    currentSourceHead: candidate.invocationHeadSha, currentSourceSha256: candidate.sourceSha256, reportChanges: changes };
}

/** Retain the older partial leaf only across the finite reviewed Verification corrections. */
export function assertRetainedFinalQualityCompositeSource(impact: {
  status: string; retained: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  candidate: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  changes: Array<{ path: string; beforeSha256: string; afterSha256: string; role: string }>;
  retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;
}, retained: FinalQualitySource, candidate: FinalQualitySource) {
  assert.equal(impact.status, "ROOT_REVIEWED_EXACT_VERIFICATION_ONLY_SOURCE_IMPACT");
  assert.equal(impact.retainedBehaviorRelabelled, false); assert.equal(impact.retainedBehaviorReexecuted, false);
  assert.deepEqual(impact.automaticCoverage, []); assert.equal(impact.globalClosed, false);
  const allowed = new Set([
    "scripts/fixtures/admin-core-domain-form-journeys.mjs", "scripts/fixtures/admin-core-operational-form-journeys.mjs",
    "scripts/fixtures/admin-core-tracking-media-adoption.mjs", "scripts/fixtures/admin-core-project-create-journeys.mjs",
    "scripts/qa-admin-adoption-journeys.mjs", "scripts/verify-admin-adoption-readback-isolated.mts",
    "scripts/lib/isolated-public-verification.mts", "scripts/verify-isolated-supabase.mts",
    "scripts/verify-admin-core-date-controls.mjs", "scripts/verify-admin-core-tracking-media-adoption.mjs",
    "scripts/verify-admin-core-journey-selection.mjs",
  ]);
  for (const [recorded, source] of [[impact.retained, retained], [impact.candidate, candidate]] as const) {
    assert.match(source.invocationHeadSha, /^[a-f0-9]{40}$/u); assert.equal(recorded.sourceHead, source.invocationHeadSha);
    assert.equal(recorded.sourceSha256, source.sourceSha256); assert.equal(source.sourceSha256, digest(JSON.stringify(source.manifest)));
    assert.equal(new Set(source.manifest.map(row => row.file)).size, source.manifest.length);
    for (const row of source.manifest) { assert.ok(sourceIncluded(row.file)); assert.match(row.sha256, /^[a-f0-9]{64}$/u); }
  }
  const before = new Map(retained.manifest.map(row => [row.file, row.sha256])), after = new Map(candidate.manifest.map(row => [row.file, row.sha256]));
  assert.deepEqual([...before.keys()].sort(), [...after.keys()].sort(), "Composite source retention may not add or delete source files.");
  const changes = [...before.keys()].sort().filter(file => before.get(file) !== after.get(file)).map(file => {
    assert.ok(allowed.has(file), "Only the finite reviewed Verification owners may differ from the partial source.");
    return { path: file, beforeSha256: before.get(file)!, afterSha256: after.get(file)!, role: "verification-only-residual-correction" };
  });
  assert.deepEqual(impact.changes, changes);
  return { originalSourceHead: retained.invocationHeadSha, originalSourceSha256: retained.sourceSha256,
    currentSourceHead: candidate.invocationHeadSha, currentSourceSha256: candidate.sourceSha256, verificationChanges: changes };
}

/** Consume the existing materializer's fixed, reviewed outputs; never recompute behavioral qualification. */
export function loadRetainedFinalQualityAdmission(admissionSha256: string, expected: FinalQualitySource) {
  assert.match(admissionSha256, /^[a-f0-9]{64}$/u);
  const bindings = new Map<string, FinalQualityArtifactRef>();
  const approvedTracked = new Map(expected.manifest.map(row => {
    assert.ok(sourceIncluded(row.file)); assert.match(row.sha256, /^[a-f0-9]{64}$/u);
    return [resolve(ROOT, row.file), row.sha256];
  }));
  const artifactPath = (ref: FinalQualityArtifactRef, inspect = true) => {
    assert.equal(typeof ref.path, "string"); assert.match(ref.sha256, /^[a-f0-9]{64}$/u);
    const path = resolve(ROOT, ref.path), boundary = resolve(ROOT, ".tmp-qa/core-final-closure") + sep;
    assert.ok(path.startsWith(boundary) || approvedTracked.get(path) === ref.sha256,
      "Evidence hashes outside the QA boundary require an exact finite current-source path and digest.");
    if (inspect) { assert.equal(realpathSync(path), path, "Evidence may not traverse a symlink or junction."); assert.ok(lstatSync(path).isFile()); }
    return path;
  };
  const pin = (ref: FinalQualityArtifactRef) => {
    const path = artifactPath(ref), bytes = readFileSync(path); assert.equal(digest(bytes), ref.sha256, ref.path);
    const previous = bindings.get(path); if (previous) assert.equal(previous.sha256, ref.sha256, "Conflicting evidence pins.");
    bindings.set(path, { path, sha256: ref.sha256 }); return bytes;
  };
  const read = <T,>(ref: FinalQualityArtifactRef): T => {
    assert.ok(artifactPath(ref, false).startsWith(resolve(ROOT, ".tmp-qa/core-final-closure") + sep), "JSON authorities must remain inside the fixed QA evidence boundary.");
    return JSON.parse(pin(ref).toString("utf8")) as T;
  };
  const fixed = <T,>(ref: FinalQualityArtifactRef, name: string) => { assert.equal(ref.path, FINAL_QUALITY_ACCOUNTING + name); return read<T>(ref); };
  const retainedFixed = <T,>(ref: FinalQualityArtifactRef, name: string) => { assert.equal(ref.path, RETAINED_FINAL_QUALITY_AUTHORITY.retainedQualificationRoot + name); return read<T>(ref); };
  const admissionRef = { path: FINAL_QUALITY_READINESS, sha256: admissionSha256 };
  const admission = read<{
    status: string; sourceHead: string; sourceManifest: FinalQualityArtifactRef; accounting: FinalQualityArtifactRef;
    operations: FinalQualityArtifactRef; integrity: FinalQualityArtifactRef; sourceCompatibility: FinalQualityArtifactRef;
    accountingOwner: FinalQualityArtifactRef & { export: string }; producerExecution: FinalQualityArtifactRef;
    closureEligible: boolean; closureBlockers: FinalQualityArtifactRef[];
    final27: { qualification: FinalQualityArtifactRef; sourceManifest: FinalQualityArtifactRef; gateReceipt: FinalQualityArtifactRef; originalHookRun: string; composition?: FinalQualityArtifactRef };
    operationCounts: Record<string, number>; namedCellCounts: Record<string, number>; remainingPredicates: number;
    incompleteDomainInventories: number; openPreviewStates: number; cleanup: { remainingOwnedResources: number; remainingOwnedProcesses: number };
    automaticCoverage: unknown[]; globalClosed: boolean;
  }>(admissionRef);
  assert.equal(admission.status, "ROOT_REVIEWED_FINAL_BEHAVIOR_READY_FOR_QUALITY"); assert.equal(admission.sourceHead, expected.invocationHeadSha);
  assert.deepEqual(admission.automaticCoverage, []); assert.equal(admission.globalClosed, false);
  const candidate = fixed<FinalQualitySource & { inventoryOnly: boolean; buildClaimed: boolean }>(admission.sourceManifest, "final-source-manifest.json");
  assert.equal(candidate.inventoryOnly, true); assert.equal(candidate.buildClaimed, false); assert.deepEqual(candidate.manifest, expected.manifest);
  assert.equal(candidate.invocationHeadSha, expected.invocationHeadSha); assert.equal(candidate.sourceSha256, expected.sourceSha256);
  const operations = fixed<{
    status: string; sourceHead: string; originalIdentitySha256: string; retained73Authority: FinalQualityArtifactRef;
    partitions: { qualified: FinalQualityOperation[]; notApplicable: Array<{ id: string; authority: FinalQualityArtifactRef; countsAsPass: boolean }>; hardOpen: unknown[]; held: unknown[] };
    counts: Record<string, number>; globalClosed: boolean;
  }>(admission.operations, "final-111-reconciliation.json");
  assert.equal(operations.status, "EXACT_ORIGINAL111_RECONCILED"); assert.equal(operations.sourceHead, expected.invocationHeadSha); assert.equal(operations.globalClosed, false);
  assert.equal(operations.retained73Authority.path, ".tmp-qa/core-final-closure/final-accounting-interim/progress-73-retained-1-na-0-hard-37-held-after-hard-open-2026-10-03.json");
  const original = read<{ retained: Array<{ id: string; run: string; sourceHead: string; qualification: FinalQualityArtifactRef }>; held: Array<{ id: string; run: string }>; notApplicable: Array<{ id: string; disposition: FinalQualityArtifactRef }> }>(operations.retained73Authority);
  const originalIds = [...original.retained, ...original.held, ...original.notApplicable].map(row => row.id).sort();
  assert.equal(originalIds.length, 111); assert.equal(new Set(originalIds).size, 111);
  assert.equal(digest(JSON.stringify(originalIds)), RETAINED_FINAL_QUALITY_AUTHORITY.operationIdentitySha256);
  assert.equal(operations.originalIdentitySha256, digest(JSON.stringify(originalIds)));
  const { qualified, notApplicable, hardOpen, held } = operations.partitions;
  assert.deepEqual(hardOpen, []); assert.deepEqual(held, []); assert.equal(notApplicable.length, 1);
  assert.deepEqual([...qualified, ...notApplicable].map(row => row.id).sort(), originalIds);
  assert.equal(new Set(qualified.map(row => row.id)).size, qualified.length);
  assert.equal(notApplicable[0].countsAsPass, false); assert.equal(notApplicable[0].id, original.notApplicable[0].id);
  assert.deepEqual(notApplicable[0].authority, original.notApplicable[0].disposition); pin(notApplicable[0].authority);
  const operationCounts = { qualified: qualified.length, notApplicable: notApplicable.length, hardOpen: hardOpen.length, held: held.length, total: originalIds.length };
  assert.deepEqual(operations.counts, operationCounts); assert.deepEqual(admission.operationCounts, operationCounts);
  for (const row of qualified) { assert.match(row.sourceHead, /^[a-f0-9]{40}$/u); assert.match(row.sourceSha256, /^[a-f0-9]{64}$/u); assert.ok(row.ownedRunId); pin(row.qualification); }
  for (const originalRow of original.retained) {
    const matches = qualified.filter(row => row.id === originalRow.id); assert.equal(matches.length, 1);
    const row = matches[0]; assert.equal(row.run, originalRow.run); assert.equal(row.sourceHead, originalRow.sourceHead);
    assert.deepEqual(row.qualification, originalRow.qualification, "Retained73 must keep their exact accepted qualification; no replacement or requalification.");
    const q = read<{ sourceHead: string; sourceSha256: string; ownedRunId: string }>(originalRow.qualification);
    assert.equal(row.sourceHead, q.sourceHead); assert.equal(row.sourceSha256, q.sourceSha256); assert.equal(row.ownedRunId, q.ownedRunId);
  }
  const mediaIds = original.held.filter(row => row.run === "browser-r101").map(row => row.id); assert.equal(mediaIds.length, 10);
  const mediaQualifications = new Map<string, { run: string; sourceHead: string; sourceSha256: string; ownedRunId: string; globalClosed: boolean;
    observations: Array<{ status: string; journeyId: string; sourceSha256: string; ownedRunId: string }> }>();
  for (const id of mediaIds) {
    const matches = qualified.filter(row => row.id === id); assert.equal(matches.length, 1); const row = matches[0];
    const path = artifactPath(row.qualification);
    const media = mediaQualifications.get(path) ?? read<{ run: string; sourceHead: string; sourceSha256: string; ownedRunId: string; globalClosed: boolean;
      observations: Array<{ status: string; journeyId: string; sourceSha256: string; ownedRunId: string }> }>(row.qualification);
    mediaQualifications.set(path, media);
    assert.match(media.run, /^browser-r[1-9][0-9]*$/u); assert.notEqual(media.run, "browser-r101"); assert.equal(media.globalClosed, false);
    assert.equal(row.run, media.run); assert.equal(row.sourceHead, media.sourceHead); assert.equal(row.sourceSha256, media.sourceSha256); assert.equal(row.ownedRunId, media.ownedRunId);
    const observations = media.observations.filter(observation => observation.journeyId === id); assert.equal(observations.length, 1);
    assert.equal(observations[0].status, "QUALIFIED_SCOPED_BEHAVIORAL_OBSERVATION");
    assert.equal(observations[0].sourceSha256, media.sourceSha256); assert.equal(observations[0].ownedRunId, media.ownedRunId);
  }
  const admittedMediaIds = [...mediaQualifications.values()].flatMap(value => value.observations.map(row => row.journeyId)).sort();
  assert.deepEqual(admittedMediaIds, [...mediaIds].sort(), "Exact Media identities must be conserved across the existing reviewed partial/follow-up qualifications.");
  const final = admission.final27; assert.equal(final.originalHookRun, "browser-r52");
  const q = read<{
    status: string; statusEnvelope: string; cohort: string; run: string; sourceHead: string; sourceSha256: string; ownedRunId: string;
    originalHookRun: string; deferredFinalQuality: boolean; finalQuality: boolean; journeyCount: number; inputArtifacts: FinalQualityArtifactRef[]; completion: { pointers: string[] };
    observations: Array<{ status: string; journeyId: string; sourceSha256: string; ownedRunId: string }>; automaticCoverage: unknown[]; globalClosed: boolean;
  }>(final.qualification);
  assert.equal(q.status, "QUALIFIED_SCOPED_COHORT_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT"); assert.equal(q.statusEnvelope, "qualified-sealed-cohort-envelope");
  assert.equal(q.cohort, "domain-forms"); assert.match(q.run, /^browser-r[1-9][0-9]*$/u); assert.notEqual(q.run, "browser-r52");
  assert.ok([RETAINED_FINAL_QUALITY_AUTHORITY.retainedQualificationRoot, ".tmp-qa/core-final-closure/cumulative-accounting-stage/"].some(base => final.qualification.path === base + q.run + "-qualified-observations.json"));
  assert.equal(q.originalHookRun, "browser-r52"); assert.equal(q.deferredFinalQuality, true); assert.equal(q.finalQuality, false);
  assert.deepEqual(q.automaticCoverage, []); assert.equal(q.globalClosed, false);
  const expectedIds = original.held.filter(row => row.run === "browser-r52").map(row => row.id);
  assert.equal(expectedIds.length, 27);
  let admittedIds = expectedIds;
  let admittedSelection = "domain-forms-final-six-followup";
  let compositionEvidence: { authority: FinalQualityArtifactRef; qualifications: Array<{ role: string; qualification: FinalQualityArtifactRef; run: string; sourceHead: string; sourceSha256: string; ownedRunId: string }>; sourceCompatibility: FinalQualityArtifactRef; sourceBinding: ReturnType<typeof assertRetainedFinalQualityCompositeSource>; residualSourceCompatibility?: FinalQualityArtifactRef; residualSourceBinding?: ReturnType<typeof assertRetainedFinalQualityCompositeSource>; sameRun: false } | undefined;
  if (final.composition) {
    const composition = retainedFixed<{
      status: string; statusEnvelope: string; cohort: string; originalHookRun: string; originalPlan: FinalQualityArtifactRef; originalProgress: FinalQualityArtifactRef;
      originalJourneyIds: string[]; journeyCount: number; sameRun: boolean; deferredFinalQuality: boolean; finalQuality: boolean; automaticCoverage: unknown[]; globalClosed: boolean;
      qualifications: Array<{ role: string; qualification: FinalQualityArtifactRef; run: string; sourceHead: string; sourceSha256: string; ownedRunId: string; sourceManifest: FinalQualityArtifactRef; gateReceipt?: FinalQualityArtifactRef; rawArtifacts: FinalQualityArtifactRef[] }>;
      sourceCompatibility: FinalQualityArtifactRef; residualSourceCompatibility?: FinalQualityArtifactRef; completionAssignments: Array<{ field: string; qualifications: FinalQualityArtifactRef[] }>;
      completionRecipeAssignments?: Array<{ field: string; qualifications: Array<{ qualification: FinalQualityArtifactRef; recipeKinds: string[] }> }>;
    }>(final.composition, "final27-composite-qualification.json");
    assert.equal(composition.status, "QUALIFIED_SCOPED_DOMAIN_FORM_COMPOSITE_OBSERVATIONS_NO_AUTOMATIC_AXIS_CREDIT");
    assert.equal(composition.statusEnvelope, "qualified-sealed-composite-cohort-envelope"); assert.equal(composition.cohort, "domain-forms");
    assert.equal(composition.originalHookRun, "browser-r52"); assert.equal(composition.journeyCount, 27); assert.deepEqual(composition.originalJourneyIds, expectedIds);
    assert.equal(composition.sameRun, false); assert.equal(composition.deferredFinalQuality, true); assert.equal(composition.finalQuality, false);
    assert.deepEqual(composition.automaticCoverage, []); assert.equal(composition.globalClosed, false);
    for (const key of ["run", "sourceHead", "sourceSha256", "ownedRunId", "buildIdSha256", "gateReceipt"]) assert.ok(!Object.hasOwn(composition, key), "A composite cannot fabricate one run or one build for both leaves.");
    assert.deepEqual(composition.originalPlan, RETAINED_FINAL_QUALITY_AUTHORITY.final27Plan);
    assert.deepEqual(composition.originalProgress, operations.retained73Authority);
    const plan = read<{ cohortHooks: Array<{ run: string; cohort: string; expectedJourneyIds: string[]; privateCompletionFields: string[]; finalQuality: boolean }> }>(composition.originalPlan);
    const hooks = plan.cohortHooks.filter(row => row.run === "browser-r52"); assert.equal(hooks.length, 1); const hook = hooks[0];
    assert.equal(hook.cohort, "domain-forms"); assert.equal(hook.finalQuality, true); assert.deepEqual(hook.expectedJourneyIds, expectedIds);
    const threeLeaves = composition.qualifications.length === 3;
    assert.deepEqual(composition.qualifications.map(row => row.role), threeLeaves
      ? ["partial-original-failed", "partial-final-six-failed", "fresh-final-update"] : ["partial-original-failed", "fresh-final-six"]);
    const priorLeaf = composition.qualifications[0], latestLeaf = composition.qualifications.at(-1)!, middleLeaf = threeLeaves ? composition.qualifications[1] : undefined;
    if (!threeLeaves) { assert.ok(!Object.hasOwn(composition, "residualSourceCompatibility")); assert.ok(!Object.hasOwn(composition, "completionRecipeAssignments")); }
    assert.equal(priorLeaf.qualification.path, RETAINED_FINAL_QUALITY_AUTHORITY.retainedQualificationRoot + "browser-r148-qualified-observations.json");
    assert.ok(!Object.hasOwn(priorLeaf, "gateReceipt")); assert.deepEqual(latestLeaf.qualification, final.qualification);
    assert.deepEqual(latestLeaf.sourceManifest, final.sourceManifest); assert.deepEqual(latestLeaf.gateReceipt, final.gateReceipt);
    const prior = read<typeof q & { partialOriginalHook: boolean; originalJourneyCount: number; originalPrivateCompletionFields: string[];
      completion: { pointers: string[]; fields: Record<string, unknown>; missingOriginalFields: string[] } }>(priorLeaf.qualification);
    let middle: (typeof prior & { selectedJourneyCount: number; selectedJourneyIds: string[]; excludedJourneyIds: string[] }) | undefined;
    assert.equal(prior.status, "QUALIFIED_SCOPED_DOMAIN_FORM_PARTIAL_OBSERVATIONS_ORIGINAL_FAILED");
    assert.equal(prior.statusEnvelope, "qualified-sealed-partial-cohort-envelope"); assert.equal(prior.cohort, "domain-forms");
    assert.equal(prior.run, "browser-r148"); assert.notEqual(q.run, prior.run); assert.equal(prior.originalHookRun, "browser-r52");
    assert.equal(prior.partialOriginalHook, true); assert.equal(prior.originalJourneyCount, 27); assert.equal(prior.journeyCount, 21);
    assert.equal(prior.deferredFinalQuality, true); assert.equal(prior.finalQuality, false); assert.deepEqual(prior.automaticCoverage, []); assert.equal(prior.globalClosed, false);
    for (const key of ["buildIdSha256", "gateReceipt"]) assert.ok(!Object.hasOwn(prior, key));
    assert.deepEqual(prior.originalPrivateCompletionFields, hook.privateCompletionFields);
    assert.deepEqual(prior.completion.missingOriginalFields, ["trackingDates", "trackingMedia", "trackingMediaApplicability"]);
    assert.deepEqual(Object.keys(prior.completion.fields).sort(), ["companyImages", "currentIdentityProtection", "draftRestoration", "writes"]);
    const priorBase = ".tmp-qa/core-final-closure/" + prior.run + "/";
    assert.equal(priorLeaf.sourceManifest.path, priorBase + "public-source-manifest.json");
    const priorSource = read<FinalQualitySource>(priorLeaf.sourceManifest);
    assert.equal(priorSource.invocationHeadSha, prior.sourceHead); assert.equal(priorSource.sourceSha256, prior.sourceSha256);
    for (const [leaf, value] of [[priorLeaf, prior], [latestLeaf, q]] as const) {
      for (const key of ["run", "sourceHead", "sourceSha256", "ownedRunId"] as const) assert.equal(leaf[key], value[key]);
      assert.deepEqual(leaf.rawArtifacts, value.inputArtifacts); assert.ok(leaf.rawArtifacts.length > 0);
      for (const ref of leaf.rawArtifacts) pin(ref);
    }
    const priorInput = new Map(prior.inputArtifacts.map(ref => [artifactPath(ref), ref.sha256]));
    assert.equal(priorInput.get(artifactPath(priorLeaf.sourceManifest)), priorLeaf.sourceManifest.sha256);
    const priorRaw = <T,>(name: string) => { const path = priorBase + name, sha256 = priorInput.get(resolve(ROOT, path)); assert.ok(sha256, "Missing original failed-leaf raw evidence: " + name); return read<T>({ path, sha256 }); };
    for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) {
      const receipt = priorRaw<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }>("public-" + name + ".json");
      assert.equal(receipt.name, name); assert.equal(receipt.code, name === "admin-adoption" ? 1 : 0);
      assert.match(receipt.stdoutSha256, /^[a-f0-9]{64}$/u); assert.match(receipt.stderrSha256, /^[a-f0-9]{64}$/u);
      for (const stream of ["stdout", "stderr"] as const) assert.equal(priorInput.get(resolve(ROOT, priorBase + "public-" + name + "." + stream + ".log")), receipt[stream === "stdout" ? "stdoutSha256" : "stderrSha256"], "Each original gate digest must bind its sealed raw log bytes.");
    }
    assert.ok(!priorInput.has(resolve(ROOT, priorBase + "public-and-admin-adoption-gates.json")), "The failed original leaf did not emit a successful full gate receipt.");
    const browser = priorRaw<{ status: string; sourceSha256: string; journeySelection: string | null; evidence: Array<{ id: string; status: string }> }>("admin-adoption-browser.json");
    assert.equal(browser.status, "fail"); assert.equal(browser.sourceSha256, prior.sourceSha256); assert.equal(browser.journeySelection, null);
    assert.equal(browser.evidence[0].id, "existing-auth-login"); assert.equal(browser.evidence[0].status, "pass");
    const originalRows = browser.evidence.slice(1); assert.deepEqual(originalRows.map(row => row.id), expectedIds);
    assert.ok(originalRows.every(row => ["pass", "fail"].includes(row.status)));
    const priorIds = originalRows.filter(row => row.status === "pass").map(row => row.id);
    assert.equal(priorIds.length, 21); assert.deepEqual(prior.observations.map(row => row.journeyId), priorIds);
    admittedIds = expectedIds.filter(id => !priorIds.includes(id)); assert.equal(admittedIds.length, 6);
    assert.deepEqual(originalRows.filter(row => row.status === "fail").map(row => row.id), admittedIds);
    if (middleLeaf) {
      assert.equal(middleLeaf.qualification.path, RETAINED_FINAL_QUALITY_AUTHORITY.retainedQualificationRoot + "browser-r149-qualified-observations.json");
      assert.ok(!Object.hasOwn(middleLeaf, "gateReceipt"));
      middle = read<typeof prior & { selectedJourneyCount: number; selectedJourneyIds: string[]; excludedJourneyIds: string[] }>(middleLeaf.qualification);
      assert.equal(middle.status, "QUALIFIED_SCOPED_DOMAIN_FORM_PARTIAL_OBSERVATIONS_ORIGINAL_FAILED");
      assert.equal(middle.statusEnvelope, "qualified-sealed-partial-cohort-envelope"); assert.equal(middle.cohort, "domain-forms");
      assert.equal(middle.run, "browser-r149"); assert.notEqual(q.run, middle.run); assert.equal(middle.originalHookRun, "browser-r52");
      assert.equal(middle.partialOriginalHook, true); assert.equal(middle.originalJourneyCount, 27); assert.equal(middle.journeyCount, 5);
      assert.equal(middle.selectedJourneyCount, 6); assert.deepEqual(middle.selectedJourneyIds, admittedIds);
      assert.equal(middle.deferredFinalQuality, true); assert.equal(middle.finalQuality, false); assert.deepEqual(middle.automaticCoverage, []); assert.equal(middle.globalClosed, false);
      for (const key of ["buildIdSha256", "gateReceipt"]) assert.ok(!Object.hasOwn(middle, key));
      assert.deepEqual(middle.originalPrivateCompletionFields, hook.privateCompletionFields);
      assert.deepEqual(Object.keys(middle.completion.fields).sort(), ["draftRestoration", "trackingDates", "trackingMediaApplicability", "writes"]);
      for (const field of ["trackingDates", "trackingMediaApplicability"]) {
        const fragment = middle.completion.fields[field] as { status: string; recipeKinds: string[]; completeTrackingFamily: boolean };
        assert.equal(fragment.status, "partial-not-global-pass"); assert.deepEqual(fragment.recipeKinds, ["profile", "stage", "item"]); assert.equal(fragment.completeTrackingFamily, false);
      }
      assert.equal((middle.completion.fields.trackingDates as { familyAxisQualified: boolean }).familyAxisQualified, false);
      assert.deepEqual((middle.completion.fields.trackingMediaApplicability as { dispositions: unknown[] }).dispositions, []);
      for (const key of ["run", "sourceHead", "sourceSha256", "ownedRunId"] as const) assert.equal(middleLeaf[key], middle[key]);
      assert.deepEqual(middleLeaf.rawArtifacts, middle.inputArtifacts); assert.ok(middle.inputArtifacts.length > 0); for (const ref of middle.inputArtifacts) pin(ref);
      const middleBase = ".tmp-qa/core-final-closure/" + middle.run + "/";
      assert.equal(middleLeaf.sourceManifest.path, middleBase + "public-source-manifest.json");
      const middleSource = read<FinalQualitySource>(middleLeaf.sourceManifest);
      assert.equal(middleSource.invocationHeadSha, middle.sourceHead); assert.equal(middleSource.sourceSha256, middle.sourceSha256);
      const middleInput = new Map(middle.inputArtifacts.map(ref => [artifactPath(ref), ref.sha256]));
      assert.equal(middleInput.get(artifactPath(middleLeaf.sourceManifest)), middleLeaf.sourceManifest.sha256);
      const middleRaw = <T,>(name: string) => { const path = middleBase + name, sha256 = middleInput.get(resolve(ROOT, path)); assert.ok(sha256, "Missing failed follow-up raw evidence: " + name); return read<T>({ path, sha256 }); };
      for (const name of ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]) {
        const receipt = middleRaw<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }>("public-" + name + ".json");
        assert.equal(receipt.name, name); assert.equal(receipt.code, name === "admin-adoption" ? 1 : 0);
        for (const stream of ["stdout", "stderr"] as const) {
          const expectedHash = receipt[stream === "stdout" ? "stdoutSha256" : "stderrSha256"]; assert.match(expectedHash, /^[a-f0-9]{64}$/u);
          assert.equal(middleInput.get(resolve(ROOT, middleBase + "public-" + name + "." + stream + ".log")), expectedHash, "Each failed follow-up gate must retain its exact raw log bytes.");
        }
      }
      assert.ok(!middleInput.has(resolve(ROOT, middleBase + "public-and-admin-adoption-gates.json")), "The failed follow-up did not produce a successful full gate receipt.");
      const middleBrowser = middleRaw<{ status: string; sourceSha256: string; scope: string; cohort: string; journeySelection: string; driverCompleted: boolean; wholeCohortExecuted: boolean; selectedJourneyIds: string[]; executedJourneyIds: string[]; evidence: Array<{ id: string; status: string }> }>("admin-adoption-browser.json");
      assert.equal(middleBrowser.status, "fail"); assert.equal(middleBrowser.sourceSha256, middle.sourceSha256); assert.equal(middleBrowser.scope, "core-closure"); assert.equal(middleBrowser.cohort, "domain-forms");
      assert.equal(middleBrowser.journeySelection, "domain-forms-final-six-followup"); assert.equal(middleBrowser.driverCompleted, true); assert.equal(middleBrowser.wholeCohortExecuted, false);
      assert.deepEqual(middleBrowser.selectedJourneyIds, admittedIds); assert.deepEqual(middleBrowser.executedJourneyIds, admittedIds);
      assert.deepEqual(middleBrowser.evidence.map(row => row.id), ["existing-auth-login", ...admittedIds]); assert.equal(middleBrowser.evidence[0].status, "pass");
      const middleRows = middleBrowser.evidence.slice(1); assert.ok(middleRows.every(row => ["pass", "fail"].includes(row.status)));
      const middleIds = middleRows.filter(row => row.status === "pass").map(row => row.id); assert.equal(middleIds.length, 5);
      assert.deepEqual(middle.observations.map(row => row.journeyId), middleIds);
      admittedIds = admittedIds.filter(id => !middleIds.includes(id)); assert.equal(admittedIds.length, 1);
      assert.deepEqual(middleRows.filter(row => row.status === "fail").map(row => row.id), admittedIds); assert.deepEqual(middle.excludedJourneyIds, admittedIds);
      admittedSelection = "domain-forms-update-followup";
      for (const row of middle.observations) {
        assert.equal(row.status, "QUALIFIED_SCOPED_BEHAVIORAL_OBSERVATION"); assert.equal(row.sourceSha256, middle.sourceSha256); assert.equal(row.ownedRunId, middle.ownedRunId);
        const retained = qualified.filter(item => item.id === row.journeyId); assert.equal(retained.length, 1);
        assert.deepEqual(retained[0], { id: row.journeyId, qualification: middleLeaf.qualification, run: middle.run, sourceHead: middle.sourceHead, sourceSha256: middle.sourceSha256, ownedRunId: middle.ownedRunId });
      }
      for (const name of ["partial-native-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json"])
        assert.ok(middleInput.has(resolve(ROOT, middleBase + name)), "The partial follow-up must preserve native/draft/cleanup artifacts.");
    }
    for (const row of prior.observations) {
      assert.equal(row.status, "QUALIFIED_SCOPED_BEHAVIORAL_OBSERVATION"); assert.equal(row.sourceSha256, prior.sourceSha256); assert.equal(row.ownedRunId, prior.ownedRunId);
      const retained = qualified.filter(item => item.id === row.journeyId); assert.equal(retained.length, 1);
      assert.deepEqual(retained[0], { id: row.journeyId, qualification: priorLeaf.qualification, run: prior.run, sourceHead: prior.sourceHead, sourceSha256: prior.sourceSha256, ownedRunId: prior.ownedRunId });
    }
    for (const name of ["partial-native-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json"])
      assert.ok(priorInput.has(resolve(ROOT, priorBase + name)), "The partial qualification must preserve actual native/draft/cleanup artifacts.");
    const assignments = hook.privateCompletionFields.map(field => ({ field, qualifications: field === "draftRestoration" || field === "writes"
      ? [priorLeaf.qualification, ...(middleLeaf ? [middleLeaf.qualification] : []), latestLeaf.qualification] : field === "companyImages" ? [priorLeaf.qualification]
      : middleLeaf && ["trackingDates", "trackingMediaApplicability"].includes(field) ? [middleLeaf.qualification, latestLeaf.qualification] : [latestLeaf.qualification] }));
    assert.deepEqual(composition.completionAssignments, assignments);
    for (const assignment of assignments) for (const ref of assignment.qualifications) {
      const value = ref === priorLeaf.qualification ? prior : ref === middleLeaf?.qualification ? middle! : q;
      assert.ok(value.completion.pointers.includes("/" + assignment.field), "Every original completion field must retain its actual owning leaf.");
    }
    if (middleLeaf) {
      const recipes = hook.privateCompletionFields.filter(field => ["trackingDates", "trackingMedia", "trackingMediaApplicability"].includes(field)).map(field => ({ field,
        qualifications: [...(field === "trackingMedia" ? [] : [{ qualification: middleLeaf.qualification, recipeKinds: ["profile", "stage", "item"] }]), { qualification: latestLeaf.qualification, recipeKinds: ["update"] }] }));
      assert.deepEqual(composition.completionRecipeAssignments, recipes, "Tracking recipe coverage remains assigned to its exact successful leaf.");
    }
    const compatibility = retainedFixed<Parameters<typeof assertRetainedFinalQualityCompositeSource>[0]>(composition.sourceCompatibility, threeLeaves ? "source-impact-partial148-to-final-update.json" : "source-impact-partial148-to-final-six.json");
    assert.deepEqual(compatibility.retained.sourceManifest, priorLeaf.sourceManifest); assert.deepEqual(compatibility.candidate.sourceManifest, final.sourceManifest);
    const latestSource = read<FinalQualitySource>(final.sourceManifest);
    const sourceBinding = assertRetainedFinalQualityCompositeSource(compatibility, priorSource, latestSource);
    let residualSourceBinding: ReturnType<typeof assertRetainedFinalQualityCompositeSource> | undefined;
    if (middleLeaf) {
      assert.ok(composition.residualSourceCompatibility);
      const residualImpact = retainedFixed<Parameters<typeof assertRetainedFinalQualityCompositeSource>[0]>(composition.residualSourceCompatibility, "source-impact-partial149-to-final-update.json");
      assert.deepEqual(residualImpact.retained.sourceManifest, middleLeaf.sourceManifest); assert.deepEqual(residualImpact.candidate.sourceManifest, final.sourceManifest);
      residualSourceBinding = assertRetainedFinalQualityCompositeSource(residualImpact, read<FinalQualitySource>(middleLeaf.sourceManifest), latestSource);
    }
    compositionEvidence = { authority: final.composition, qualifications: composition.qualifications.map(({ role, qualification, run, sourceHead, sourceSha256, ownedRunId }) => ({ role, qualification, run, sourceHead, sourceSha256, ownedRunId })), sourceCompatibility: composition.sourceCompatibility, sourceBinding,
      ...(residualSourceBinding ? { residualSourceCompatibility: composition.residualSourceCompatibility!, residualSourceBinding } : {}), sameRun: false };
  }
  assert.equal(q.journeyCount, admittedIds.length); assert.deepEqual(q.observations.map(row => row.journeyId), admittedIds);
  for (const row of q.observations) {
    assert.equal(row.status, "QUALIFIED_SCOPED_BEHAVIORAL_OBSERVATION"); assert.equal(row.sourceSha256, q.sourceSha256); assert.equal(row.ownedRunId, q.ownedRunId);
    const retained = qualified.filter(item => item.id === row.journeyId); assert.equal(retained.length, 1);
    assert.deepEqual(retained[0], { id: row.journeyId, qualification: final.qualification, run: q.run, sourceHead: q.sourceHead, sourceSha256: q.sourceSha256, ownedRunId: q.ownedRunId });
  }
  const rawBase = ".tmp-qa/core-final-closure/" + q.run + "/";
  assert.equal(final.sourceManifest.path, rawBase + "public-source-manifest.json"); assert.equal(final.gateReceipt.path, rawBase + "public-and-admin-adoption-gates.json");
  const retainedSource = read<FinalQualitySource>(final.sourceManifest);
  assert.equal(retainedSource.invocationHeadSha, q.sourceHead); assert.equal(retainedSource.sourceSha256, q.sourceSha256);
  const gates = read<{ status: string; selection: string; sourceSha256: string; buildIdSha256: string; gates: Array<{ name: string; code: number }> }>(final.gateReceipt);
  assert.equal(gates.status, "pass"); assert.equal(gates.selection, "admin-adoption"); assert.equal(gates.sourceSha256, q.sourceSha256); assert.match(gates.buildIdSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(gates.gates.map(row => row.name), ["normal-build", "product-surface-build", "platform-contracts", "admin-adoption"]); assert.ok(gates.gates.every(row => row.code === 0));
  assert.ok(q.inputArtifacts.length > 0); for (const ref of q.inputArtifacts) pin(ref);
  const input = new Map(q.inputArtifacts.map(ref => [artifactPath(ref), ref.sha256]));
  for (const ref of [final.sourceManifest, final.gateReceipt]) assert.equal(input.get(artifactPath(ref)), ref.sha256);
  for (const name of ["admin-adoption-browser.json", "admin-adoption-database-readback.json", "core-native-control-readback.json", "admin-core-draft-restoration.json", "cleanup.json", "public-process-cleanup.json", "host-access-closed.json"])
    assert.ok(input.has(resolve(ROOT, rawBase + name)), "Qualified Final27 must seal its actual Browser/native/cleanup inputs.");
  if (final.composition) {
    const path = rawBase + "admin-adoption-browser.json", sha256 = input.get(resolve(ROOT, path)); assert.ok(sha256);
    const browser = read<{ status: string; sourceSha256: string; scope: string; cohort: string; journeySelection: string; driverCompleted: boolean; wholeCohortExecuted: boolean; selectedJourneyIds: string[]; executedJourneyIds: string[]; evidence: Array<{ id: string; status: string }> }>({ path, sha256 });
    assert.equal(browser.status, "pass"); assert.equal(browser.sourceSha256, q.sourceSha256); assert.equal(browser.scope, "core-closure"); assert.equal(browser.cohort, "domain-forms");
    assert.equal(browser.journeySelection, admittedSelection); assert.equal(browser.driverCompleted, true); assert.equal(browser.wholeCohortExecuted, false);
    assert.deepEqual(browser.selectedJourneyIds, admittedIds); assert.deepEqual(browser.executedJourneyIds, admittedIds);
    assert.deepEqual(browser.evidence.map(row => row.id), ["existing-auth-login", ...admittedIds]); assert.ok(browser.evidence.every(row => row.status === "pass"));
    if (admittedSelection === "domain-forms-update-followup") {
      const readbackPath = rawBase + "admin-adoption-database-readback.json", readbackSha256 = input.get(resolve(ROOT, readbackPath)); assert.ok(readbackSha256);
      type DateRow = { journeyId: string; surface: string; nativeId: string; sourceSha256: string; ownedRunId: string };
      const joined = read<{ status: string; globalClosed: boolean; companyImages: null;
        trackingDates: { status: string; recipeKinds: string[]; completeTrackingFamily: boolean; familyAxisQualified: boolean; qualified: DateRow[];
          aliases: Array<{ candidateRequiredCase: string; childSurfaces: string[]; nativeIds: string[] }>; candidateRequiredCases: string[]; automaticCoverage: unknown[]; globalClosed: boolean };
        trackingMediaApplicability: { status: string; recipeKinds: string[]; completeTrackingFamily: boolean; mounted: Array<DateRow & { kind: string }>;
          nativeSaveCount: number; dispositions: unknown[]; positiveControl: { consumer: string; nativeIds: string[]; mediaApplicable: boolean }; automaticCoverage: unknown[]; globalClosed: boolean };
        trackingMedia: { status: string; exactWrites: number; nativeSaveReceipts: string[]; automaticCoverage: unknown[]; globalClosed: boolean };
      }>({ path: readbackPath, sha256: readbackSha256 });
      assert.equal(joined.status, "pass"); assert.equal(joined.globalClosed, false); assert.equal(joined.companyImages, null);
      const dates = joined.trackingDates, applicability = joined.trackingMediaApplicability, media = joined.trackingMedia;
      const surfaces = ["update-create", "update-edit"];
      for (const fragment of [dates, applicability]) { assert.equal(fragment.status, "pass"); assert.deepEqual(fragment.recipeKinds, ["update"]); assert.equal(fragment.completeTrackingFamily, false); }
      for (const fragment of [dates, applicability, media]) { assert.deepEqual(fragment.automaticCoverage, []); assert.equal(fragment.globalClosed, false); }
      assert.equal(dates.familyAxisQualified, false); assert.deepEqual(dates.qualified.map(row => row.surface), surfaces);
      const nativeIds = dates.qualified.map(row => row.nativeId); assert.equal(new Set(nativeIds).size, 2); assert.ok(nativeIds.every(id => typeof id === "string" && id.length > 0));
      for (const row of dates.qualified) { assert.equal(row.journeyId, admittedIds[0]); assert.equal(row.sourceSha256, q.sourceSha256); assert.equal(row.ownedRunId, q.ownedRunId); }
      assert.equal(dates.aliases.length, 1); assert.deepEqual(dates.aliases[0].childSurfaces, surfaces); assert.deepEqual(dates.aliases[0].nativeIds, nativeIds);
      assert.deepEqual(dates.candidateRequiredCases, dates.aliases.map(row => row.candidateRequiredCase));
      assert.deepEqual(applicability.mounted.map(({ journeyId, surface, nativeId, sourceSha256, ownedRunId, kind }) => ({ journeyId, surface, nativeId, sourceSha256, ownedRunId, kind })),
        dates.qualified.map(({ journeyId, surface, nativeId, sourceSha256, ownedRunId }) => ({ journeyId, surface, nativeId, sourceSha256, ownedRunId, kind: "update" })));
      assert.equal(applicability.nativeSaveCount, 2); assert.deepEqual(applicability.dispositions, []);
      assert.deepEqual(applicability.positiveControl, { consumer: "project-tracking-updates", nativeIds, mediaApplicable: true });
      assert.equal(media.status, "partial-not-global-pass"); assert.equal(media.exactWrites, 2); assert.deepEqual(media.nativeSaveReceipts, nativeIds);
    }
  }
  const impact = fixed<Parameters<typeof assertRetainedFinalQualitySource>[0]>(admission.sourceCompatibility, "source-impact-current-to-final.json");
  assert.deepEqual(impact.retained.sourceManifest, final.sourceManifest); assert.deepEqual(impact.candidate.sourceManifest, admission.sourceManifest);
  const sourceBinding = assertRetainedFinalQualitySource(impact, retainedSource, candidate);
  type Predicate = { id: string; [key: string]: unknown };
  type CorrectionEvidence = {
    sourceManifest: FinalQualityArtifactRef; formManifest: FinalQualityArtifactRef; collectionManifest: FinalQualityArtifactRef;
    review?: FinalQualityArtifactRef; analysis?: FinalQualityArtifactRef;
    sourceGraph?: { owner: FinalQualityArtifactRef; entry: string; sources: FinalQualityArtifactRef[] };
    graphOwner?: FinalQualityArtifactRef; entry?: string; currentSources?: FinalQualityArtifactRef[]; child?: FinalQualityArtifactRef;
    dirtyNavigationBinding?: boolean; specializedConfirmationPreserved?: boolean;
  };
  type PredicateCorrection = { moduleId: string; key: string; predicateId: string; kind: string; previousPredicate: Predicate;
    countsAsPass: boolean; qualifiedNamedCell: boolean; wholeCellNotApplicable: boolean; evidence: CorrectionEvidence };
  type PredicateDisposition = Omit<PredicateCorrection, "moduleId" | "key" | "kind"> & { status: string };
  const ledger = fixed<{
    sourceHead: string; globalClosed: boolean; automaticCoverage: unknown[];
    closureEligibility: { eligible: boolean; namedCells: FinalQualityNamedCell[]; namedCellCounts: Record<string, number>; remainingPredicates: number; incompleteDomainInventories: number; openPreviewStates: number;
      domainInventories: Array<{ boundary: string; id: string; surfaces: string[]; asRecordedComplete: boolean; complete: boolean }> ;
      previewStates: Array<{ consumer: string; publication: string; session: string; status: string; evidence: FinalQualityArtifactRef[] }> };
    accounting: { historical: number; applicable: number; pendingNotApplicable: number; provenNotApplicable: number; pending: Array<{ key: string }>; proven: Array<{ key: string }> };
    modules: Record<string, Array<{ key: string; status: string; completeNamedContract: boolean; qualifiedPredicates: Predicate[]; openPredicates: Predicate[]; dispositionEvidence?: { status?: string; previousOpenPredicates?: Predicate[] }; predicateDispositions?: PredicateDisposition[] }>>;
    U03: { cells: Array<{ key: string; status: string; qualifiedNamedCell: boolean; remainingConditions: unknown[] }> };
    predicateCorrections: unknown[];
    U01: { lifecycle: { denominator: number; qualified: number; remaining: number }; scopedFormRuntime: { denominator: number; qualified: number; open: number } };
  }>(admission.accounting, "final-current-accounting-successor.json");
  assert.equal(ledger.sourceHead, expected.invocationHeadSha); assert.equal(ledger.globalClosed, false); assert.deepEqual(ledger.automaticCoverage, []);
  const eligibility = ledger.closureEligibility; assert.equal(typeof eligibility.eligible, "boolean");
  const keys = eligibility.namedCells.map(row => row.key).sort(); assert.equal(keys.length, 959); assert.equal(new Set(keys).size, keys.length);
  assert.equal(digest(JSON.stringify(keys)), RETAINED_FINAL_QUALITY_AUTHORITY.caseIdentitySha256);
  for (const row of eligibility.namedCells) { assert.ok(["QUALIFIED", "PROVEN_NOT_APPLICABLE", "OPEN", "NOT_APPLICABLE_PENDING_PROOF"].includes(row.disposition)); if (["QUALIFIED", "PROVEN_NOT_APPLICABLE"].includes(row.disposition)) assert.ok(row.evidence.length > 0); for (const ref of row.evidence) pin(ref); }
  const count = (disposition: string) => eligibility.namedCells.filter(row => row.disposition === disposition).length;
  const namedCellCounts = { historical: keys.length, applicable: count("QUALIFIED") + count("OPEN"), qualifiedApplicable: count("QUALIFIED"), openApplicable: count("OPEN"), pendingNotApplicable: count("NOT_APPLICABLE_PENDING_PROOF"), provenNotApplicable: count("PROVEN_NOT_APPLICABLE") };
  assert.deepEqual(eligibility.namedCellCounts, namedCellCounts); assert.deepEqual(admission.namedCellCounts, namedCellCounts);
  assert.equal(namedCellCounts.applicable + namedCellCounts.pendingNotApplicable + namedCellCounts.provenNotApplicable, keys.length);
  for (const key of ["historical", "applicable", "pendingNotApplicable", "provenNotApplicable"] as const) assert.equal(ledger.accounting[key], namedCellCounts[key]);
  assert.deepEqual(ledger.accounting.pending.map(row => row.key).sort(), eligibility.namedCells.filter(row => row.disposition === "NOT_APPLICABLE_PENDING_PROOF").map(row => row.key).sort());
  assert.deepEqual(ledger.accounting.proven.map(row => row.key).sort(), eligibility.namedCells.filter(row => row.disposition === "PROVEN_NOT_APPLICABLE").map(row => row.key).sort());
  const accepted = read<typeof ledger>(RETAINED_FINAL_QUALITY_AUTHORITY.priorAccounting);
    // The accepted correction prefix is immutable. Additional non-pass corrections must be the
    // exact existing materializer output approved for this round, never a caller-supplied exemption.
    assert.deepEqual(ledger.predicateCorrections.slice(0, accepted.predicateCorrections.length), accepted.predicateCorrections);
    const pinPredicateEvidence = (ref: FinalQualityArtifactRef) => {
      if (ref.path === "src/components/admin/integrations/IntegrationConnectionWizard.tsx") {
        const navigation = RETAINED_QUALITY_RECONCILIATION_BASELINE.authorizationNavigation;
        const navigationRule = RETAINED_QUALITY_RECONCILIATION_BASELINE.owners["src/components/admin/integrations/IntegrationConnectionWizard.tsx"];
        if (ref.sha256 === navigationRule.beforeSha256) {
          assert.equal(navigation.path, "src/components/admin/integrations/IntegrationConnectionWizard.tsx"); assert.equal(navigation.role, navigationRule.role);
          assert.equal(impact.status, "ROOT_REVIEWED_EXACT_LEDGER959_RECONCILIATION_SOURCE_IMPACT");
          // The canonical source guard above already proves this owner's exact two-tag inverse.
          const reconciliation = impact.ledgerReconciliation; assert.ok(reconciliation);
          const owners = reconciliation.owners.filter(row => row.path === navigation.path); assert.equal(owners.length, 1); const owner = owners[0];
          assert.equal(owner.beforeSha256, navigationRule.beforeSha256); assert.equal(owner.afterSha256, navigationRule.afterSha256);
          assert.equal(digest(owner.beforeSource), owner.beforeSha256); assert.equal(digest(owner.afterSource), owner.afterSha256);
          assert.equal(approvedTracked.get(resolve(ROOT, navigation.path)), navigationRule.afterSha256);
          const preimages = read<{ preimages: Array<{ logicalPath: string; path: string; sha256: string }> }>(RETAINED_FINAL_QUALITY_AUTHORITY.predicateCorrectionManifest.authority);
          const rows = preimages.preimages.filter(row => row.logicalPath === ref.path && row.sha256 === ref.sha256); assert.equal(rows.length, 1);
          const physicalPath = ".tmp-qa/core-final-closure/ledger959-reconciliation-2026-10-04/root/offline-source-preimages/" + ref.sha256 + ".txt";
          assert.equal(rows[0].path, physicalPath);
          assert.equal(pin({ path: physicalPath, sha256: ref.sha256 }).toString("utf8"), owner.beforeSource);
          assert.equal(pin({ path: navigation.path, sha256: navigationRule.afterSha256 }).toString("utf8"), owner.afterSource);
          return;
        }
      }
      const role = RETAINED_FINAL_QUALITY_AUTHORITY.predicateCorrectionManifest;
      if (ref.path !== role.path || ref.sha256 !== role.historicalSha256) {
        assert.equal(approvedTracked.get(resolve(ROOT, ref.path)), ref.sha256); pin(ref); return;
      }
      // A historical non-pass disposition retains its original source bytes. The only
      // current declaration change is the separately reviewed Updates Listbox absence.
      assert.equal(approvedTracked.get(resolve(ROOT, role.path)), role.currentSha256);
      const preimages = read<{ preimages: Array<{ logicalPath: string; path: string; sha256: string }> }>(role.authority);
      const rows = preimages.preimages.filter(row => row.logicalPath === ref.path && row.sha256 === ref.sha256);
      assert.equal(rows.length, 1); assert.equal(rows[0].path, role.physicalPath);
      const historical = pin({ path: rows[0].path, sha256: ref.sha256 }).toString("utf8").replace(/\r\n/gu, "\n");
      const current = pin({ path: role.path, sha256: role.currentSha256 }).toString("utf8").replace(/\r\n/gu, "\n");
      const needle = "              ...ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,\n              date_picker: ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,";
      const replacement = "              ...ADMIN_SWITCH_MODAL_MEDIA_LISTBOX_CONSUMER_CAPABILITIES,\n              listbox: {\n                state: \"not_applicable\",\n                rationale:\n                  \"The Updates page mounts TrackingUpdateFormModal without a Listbox; collection bulk and selection are not required and enableSelection is false. Stage/Item selectors are separate mounted routes.\",\n              },\n              date_picker: ADMIN_DATE_PICKER_OWNER_ADOPTION_DECISION,";
      assert.equal(historical.split(needle).length, 2);
      assert.equal(historical.replace(needle, replacement), current, "Every historical predicate source statement is conserved outside the exact approved declaration insertion.");
    };
    const addedCorrections = ledger.predicateCorrections.slice(accepted.predicateCorrections.length) as PredicateCorrection[];
    let approvedCorrections: PredicateCorrection[] = [];
    if (addedCorrections.length) {
      const proof = read<{ status: string; deltas: PredicateCorrection[]; globalClosed: boolean }>(RETAINED_FINAL_QUALITY_AUTHORITY.predicateCorrectionProof);
      assert.equal(proof.status, "PURE_COMPOSED_EXISTING_OWNER_SPECIALIZED_ATOMIC_PASS"); assert.equal(proof.globalClosed, false);
      approvedCorrections = proof.deltas.filter(row => row.kind === "PREDICATE_CONTRACT_DISPOSITION");
      assert.equal(approvedCorrections.length, 8);
      assert.deepEqual(addedCorrections, approvedCorrections, "Only the exact eight approved non-pass corrections may be appended.");
      for (const correction of addedCorrections) {
        assert.equal(correction.moduleId, "U04"); assert.equal(correction.countsAsPass, false);
        assert.equal(correction.qualifiedNamedCell, false); assert.equal(correction.wholeCellNotApplicable, false);
        const evidence = correction.evidence, graph = evidence.sourceGraph;
        const sources = graph?.sources ?? evidence.currentSources; assert.ok(sources?.length);
        const entry = graph?.entry ?? evidence.entry; assert.equal(typeof entry, "string");
        assert.equal(new Set(sources.map(row => row.path)).size, sources.length);
        assert.ok(sources.some(row => row.path === entry));
        for (const ref of sources) pinPredicateEvidence(ref);
        for (const ref of [evidence.formManifest, evidence.collectionManifest, graph?.owner ?? evidence.graphOwner]) { assert.ok(ref); pinPredicateEvidence(ref); }
        const originalSource = read<FinalQualitySource>(evidence.sourceManifest);
        assert.equal(originalSource.sourceSha256, digest(JSON.stringify(originalSource.manifest)));
        for (const ref of sources) assert.equal(originalSource.manifest.find(row => row.file === ref.path)?.sha256, ref.sha256);
        if (graph) {
          assert.ok(evidence.review && evidence.analysis); pin(evidence.review); pin(evidence.analysis);
          assert.ok(!sources.some(row => ["src/components/admin/ui/AdminFormRuntime.tsx", "src/components/admin/ui/AdminConfirmDialog.tsx"].includes(row.path)));
        } else {
          assert.equal(evidence.dirtyNavigationBinding, false); assert.equal(evidence.specializedConfirmationPreserved, true);
          assert.ok(evidence.child && sources.some(row => row.path === evidence.child!.path && row.sha256 === evidence.child!.sha256));
          assert.ok(sources.some(row => row.path === "src/components/admin/ui/AdminConfirmDialog.tsx"));
        }
      }
    }
    const correctionIdentity = (row: PredicateCorrection) => [row.moduleId, row.key, row.predicateId].join("|");
    assert.equal(new Set(addedCorrections.map(correctionIdentity)).size, addedCorrections.length);
    const matchedCorrections: string[] = [];
  for (const moduleId of ["U02", "U04", "U05"]) {
    const priorCells = accepted.modules[moduleId], cells = ledger.modules[moduleId];
    assert.equal(new Set(cells.map(cell => cell.key)).size, cells.length);
    assert.deepEqual(cells.map(cell => cell.key).sort(), priorCells.map(cell => cell.key).sort(), "Every existing module cell must remain present.");
    for (const cell of cells) {
      const prior = priorCells.find(row => row.key === cell.key)!;
      const predicateIds = (value: typeof cell) => {
        const rows = [...value.qualifiedPredicates, ...value.openPredicates,
          ...(value.dispositionEvidence?.previousOpenPredicates ?? [])];
        const ids = rows.map(row => row.id); assert.equal(new Set(ids).size, ids.length, "A predicate must occur exactly once across qualified, open and non-pass history.");
        return ids.sort();
      };
      assert.deepEqual(predicateIds(cell), predicateIds(prior), "Existing finite predicates cannot disappear behind a zero-open total.");
      const dispositions = cell.predicateDispositions ?? [];
      const priorDispositions = prior.predicateDispositions ?? [];
      assert.deepEqual(dispositions.slice(0, priorDispositions.length), priorDispositions);
      for (const disposition of dispositions.slice(priorDispositions.length)) {
        const correction = addedCorrections.filter(row => row.moduleId === moduleId && row.key === cell.key && row.predicateId === disposition.predicateId);
        assert.equal(correction.length, 1, "Every new non-pass disposition needs exactly one approved correction.");
        const row = correction[0], originals = prior.openPredicates.filter(predicate => predicate.id === row.predicateId);
        assert.equal(originals.length, 1); assert.deepEqual(row.previousPredicate, originals[0]);
        assert.deepEqual(disposition.previousPredicate, row.previousPredicate); assert.deepEqual(disposition.evidence, row.evidence);
        assert.deepEqual(cell.dispositionEvidence?.previousOpenPredicates?.find(predicate => predicate.id === row.predicateId), row.previousPredicate);
        assert.equal(cell.dispositionEvidence?.status, "PREDICATE_CONTRACT_CORRECTIONS_ONLY");
        assert.equal(disposition.status, row.evidence.sourceGraph ? "PROVEN_NO_DIRTY_FORM_AFFORDANCE" : "PROVEN_NO_DIRTY_NAVIGATION_AFFORDANCE");
        assert.equal(disposition.countsAsPass, false); assert.equal(disposition.qualifiedNamedCell, false); assert.equal(disposition.wholeCellNotApplicable, false);
        assert.ok(!["PROVEN_NOT_APPLICABLE", "NOT_APPLICABLE_PENDING_PROOF"].includes(cell.status), "A predicate correction cannot dispose the entire cell.");
        matchedCorrections.push(correctionIdentity(row));
      }
      if (cell.status !== "PROVEN_NOT_APPLICABLE") {
        assert.deepEqual((cell.dispositionEvidence?.previousOpenPredicates ?? []).map(row => row.id).sort(), dispositions.map(row => row.predicateId).sort(), "Non-pass identity history must be fully accounted for.");
      } else assert.equal(dispositions.length, 0, "Whole-cell N/A evidence and per-predicate corrections are separate contracts.");
      for (const predicate of prior.qualifiedPredicates) assert.deepEqual(cell.qualifiedPredicates.find(row => row.id === predicate.id), predicate, "Prior qualified proof is immutable.");
      if (!["PROVEN_NOT_APPLICABLE", "NOT_APPLICABLE_PENDING_PROOF"].includes(cell.status))
        assert.equal(cell.completeNamedContract, cell.openPredicates.length === 0);
    }
  }
  assert.deepEqual(matchedCorrections.sort(), addedCorrections.map(correctionIdentity).sort(), "Every approved appended correction must retain exactly one non-pass cell disposition.");
  assert.equal(new Set(ledger.U03.cells.map(cell => cell.key)).size, ledger.U03.cells.length);
  assert.deepEqual(ledger.U03.cells.map(cell => cell.key).sort(), accepted.U03.cells.map(cell => cell.key).sort());
  assert.equal(ledger.U01.lifecycle.denominator, accepted.U01.lifecycle.denominator);
  assert.equal(ledger.U01.scopedFormRuntime.denominator, accepted.U01.scopedFormRuntime.denominator);
  assert.equal(ledger.U01.lifecycle.qualified + ledger.U01.lifecycle.remaining, ledger.U01.lifecycle.denominator);
  assert.equal(ledger.U01.scopedFormRuntime.qualified + ledger.U01.scopedFormRuntime.open, ledger.U01.scopedFormRuntime.denominator);
  const remainingPredicates = ["U02", "U04", "U05"].reduce((sum, moduleId) => sum + ledger.modules[moduleId].reduce((n, cell) => n + cell.openPredicates.length, 0), 0);
  assert.equal(eligibility.remainingPredicates, remainingPredicates);
  const canonicalPath = rawBase + "selected-journey-canonical-inventory/admin-adoption-browser.json";
  const canonicalSha = input.get(resolve(ROOT, canonicalPath)); assert.ok(canonicalSha);
  const canonical = read<{ inventoryOnly: boolean; driverCompleted: boolean; globalClosed: boolean;
    inventory: Array<{ boundary: string; id: string; surfaces: string[]; domainJourneyInventoryComplete: boolean }>;
    previewMatrix: Array<{ consumer: string; publication: string; session: string }> } >({ path: canonicalPath, sha256: canonicalSha });
  assert.equal(canonical.inventoryOnly, true); assert.equal(canonical.driverCompleted, false); assert.equal(canonical.globalClosed, false);
  const domainIdentity = (row: { boundary: string; id: string; surfaces: string[] }) => ({ boundary: row.boundary, id: row.id, surfaces: row.surfaces });
  assert.deepEqual(eligibility.domainInventories.map(domainIdentity), canonical.inventory.map(domainIdentity));
  assert.equal(new Set(eligibility.domainInventories.map(row => row.boundary + ":" + row.id)).size, canonical.inventory.length);
  for (const [index, row] of eligibility.domainInventories.entries()) { assert.equal(row.asRecordedComplete, canonical.inventory[index].domainJourneyInventoryComplete); assert.equal(typeof row.complete, "boolean"); }
  const previewIdentity = (row: { consumer: string; publication: string; session: string }) => ({ consumer: row.consumer, publication: row.publication, session: row.session });
  assert.deepEqual(eligibility.previewStates.map(previewIdentity), canonical.previewMatrix.map(previewIdentity));
  assert.equal(new Set(eligibility.previewStates.map(row => JSON.stringify(previewIdentity(row)))).size, canonical.previewMatrix.length);
  for (const row of eligibility.previewStates) { assert.ok(["pass", "open"].includes(row.status)); if (row.status === "pass") assert.ok(row.evidence.length > 0); for (const ref of row.evidence) pin(ref); }
  assert.equal(eligibility.incompleteDomainInventories, eligibility.domainInventories.filter(row => !row.complete).length);
  assert.equal(eligibility.openPreviewStates, eligibility.previewStates.filter(row => row.status !== "pass").length);
  for (const key of ["remainingPredicates", "incompleteDomainInventories", "openPreviewStates"] as const) assert.equal(admission[key], eligibility[key]);
  assert.equal(admission.closureEligible, eligibility.eligible); assert.ok(Array.isArray(admission.closureBlockers));
  if (namedCellCounts.openApplicable || namedCellCounts.pendingNotApplicable || remainingPredicates || eligibility.incompleteDomainInventories || eligibility.openPreviewStates || ledger.U01.lifecycle.remaining || ledger.U01.scopedFormRuntime.open) {
    assert.equal(eligibility.eligible, false); assert.ok(admission.closureBlockers.length > 0, "Open obligations need explicit retained Closure blockers, not a Quality failure.");
  }
  for (const ref of admission.closureBlockers) pin(ref);
  const accountingState = { namedCellCounts, remainingPredicates, incompleteDomainInventories: eligibility.incompleteDomainInventories,
    openPreviewStates: eligibility.openPreviewStates, lifecycle: ledger.U01.lifecycle, scopedFormRuntime: ledger.U01.scopedFormRuntime,
    openFeedbackConditions: ledger.U03.cells.reduce((sum, cell) => sum + cell.remainingConditions.length, 0),
    closureEligible: eligibility.eligible, closureBlockers: admission.closureBlockers };
  assert.equal(admission.accountingOwner.path, ".tmp-qa/core-final-closure/cumulative-accounting-stage/current77-retained84-partial79-85-86-application-stage/accounting-metadata-follow-on/materialize.mjs");
  assert.equal(admission.accountingOwner.export, "materializeFinalAccountingReviewed"); pin(admission.accountingOwner);
  const producer = fixed<{ status: string; sourceHead: string; accountingOwner: typeof admission.accountingOwner; review: FinalQualityArtifactRef;
    inputs: FinalQualityArtifactRef[]; outputs: { accounting: FinalQualityArtifactRef; operations: FinalQualityArtifactRef }; automaticCoverage: unknown[]; globalClosed: boolean }>(admission.producerExecution, "final-accounting-producer-execution.json");
  assert.equal(producer.status, "FINAL_ACCOUNTING_MATERIALIZED_REVIEWED"); assert.equal(producer.sourceHead, expected.invocationHeadSha);
  assert.deepEqual(producer.accountingOwner, admission.accountingOwner); assert.deepEqual(producer.outputs, { accounting: admission.accounting, operations: admission.operations });
  assert.deepEqual(producer.automaticCoverage, []); assert.equal(producer.globalClosed, false);
  const review = fixed<{ status: string; sourceHead: string; accountingOwner: typeof admission.accountingOwner; inputs: FinalQualityArtifactRef[];
    qualifiedOperations: FinalQualityArtifactRef[] }>(producer.review, "final-accounting-root-review.json");
  assert.equal(review.status, "ROOT_REVIEWED_FINAL_ACCOUNTING_MATERIALIZATION"); assert.equal(review.sourceHead, expected.invocationHeadSha);
  assert.deepEqual(review.accountingOwner, admission.accountingOwner); assert.deepEqual(review.inputs, producer.inputs);
  const qualifierRefs = [...new Map(qualified.map(row => [artifactPath(row.qualification), { path: artifactPath(row.qualification), sha256: row.qualification.sha256 }])).values()].sort((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(review.qualifiedOperations.map(ref => ({ path: artifactPath(ref), sha256: ref.sha256 })).sort((a, b) => a.path.localeCompare(b.path)), qualifierRefs);
  assert.ok(producer.inputs.length > 0); for (const ref of producer.inputs) pin(ref);
  assert.deepEqual(admission.cleanup, { remainingOwnedResources: 0, remainingOwnedProcesses: 0 });
  const integrity = fixed<{
    status: string; sourceHead: string; requiredReferences: FinalQualityArtifactRef[]; checkedReferences: FinalQualityArtifactRef[]; failedReferences: unknown[];
    historicalFailedSealsPreserved: boolean; qualifiedSourceIdentitiesPreserved: boolean; remainingOwnedResources: number; remainingOwnedProcesses: number;
  }>(admission.integrity, "final-evidence-integrity.json");
  assert.equal(integrity.status, "FINAL_EVIDENCE_INTEGRITY_PASS"); assert.equal(integrity.sourceHead, expected.invocationHeadSha);
  assert.deepEqual(integrity.failedReferences, []); assert.equal(integrity.historicalFailedSealsPreserved, true); assert.equal(integrity.qualifiedSourceIdentitiesPreserved, true);
  assert.equal(integrity.remainingOwnedResources, 0); assert.equal(integrity.remainingOwnedProcesses, 0);
  // Normalization compares identities; pin below still validates every physical path and byte.
  const normalized = (refs: FinalQualityArtifactRef[]) => refs.map(ref => ({ path: artifactPath(ref, false), sha256: ref.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
  const required = normalized(integrity.requiredReferences), checked = normalized(integrity.checkedReferences);
  assert.equal(new Set(required.map(ref => ref.path)).size, required.length); assert.deepEqual(checked, required); assert.ok(required.length > 0);
  for (const ref of integrity.checkedReferences) pin(ref);
  const covered = new Map(required.map(ref => [ref.path, ref.sha256]));
  const admissionPath = artifactPath(admissionRef), integrityPath = artifactPath(admission.integrity);
  for (const [path, ref] of bindings) if (path !== admissionPath && path !== integrityPath)
    assert.equal(covered.get(path), ref.sha256, "Final integrity must cover every consumed evidence binding.");
  const verify = () => { for (const ref of bindings.values()) assert.equal(digest(readFileSync(artifactPath(ref))), ref.sha256, "Retained Quality admission changed during execution."); };
  return { verify, receipt: { mode: "retained" as const, reexecuted: false, originalHookRun: "browser-r52", run: q.run,
    ownedRunId: q.ownedRunId, sourceHead: q.sourceHead, sourceSha256: q.sourceSha256, buildIdSha256: gates.buildIdSha256,
    qualification: final.qualification, sourceManifest: final.sourceManifest, gateReceipt: final.gateReceipt,
    ...(compositionEvidence ? { composition: compositionEvidence, primaryQualificationJourneyIds: admittedIds } : {}),
    admission: admissionRef, accounting: admission.accounting, operations: admission.operations, integrity: admission.integrity,
    sourceCompatibility: admission.sourceCompatibility, sourceBinding, accountingState, accountingOwner: admission.accountingOwner,
    producerExecution: admission.producerExecution, qualifiedJourneyIds: expectedIds, automaticCoverage: [], globalClosed: false } };
}

const RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS = 300_000;
const RETAINED_QUALITY_WORKER_SOURCE = String.raw`const { parentPort, workerData } = require("node:worker_threads");
const assert = require("node:assert/strict");
void (async () => {
  assert.ok(parentPort);
  const owner = await import(workerData.ownerUrl);
  let admission, sequence = 0;
  parentPort.on("message", message => {
    assert.deepEqual(Object.keys(message).sort(), ["action", "sequence"]);
    assert.equal(message.sequence, ++sequence);
    if (message.action === "load") {
      assert.equal(sequence, 1); assert.equal(admission, undefined);
      admission = owner.loadRetainedFinalQualityAdmission(workerData.admissionSha256, workerData.expected);
      parentPort.postMessage({ sequence, kind: "loaded", receipt: admission.receipt });
    } else {
      assert.equal(message.action, "verify"); assert.ok(admission); assert.ok(sequence > 1);
      admission.verify();
      parentPort.postMessage({ sequence, kind: "verified" });
    }
  });
})();`;

/** Run the same complete admission and recheck off the transport's heartbeat event loop. */
export async function loadRetainedFinalQualityAdmissionAsync(admissionSha256: string, expected: FinalQualitySource, signal: AbortSignal) {
  signal.throwIfAborted();
  const worker = new Worker(RETAINED_QUALITY_WORKER_SOURCE, { eval: true,
    workerData: { ownerUrl: import.meta.url, admissionSha256, expected }, env: {},
    execArgv: ["--experimental-strip-types"], stdout: true, stderr: true });
  type Receipt = ReturnType<typeof loadRetainedFinalQualityAdmission>["receipt"];
  type Reply = { sequence: number; kind: "loaded"; receipt: Receipt } | { sequence: number; kind: "verified" };
  let sequence = 0, failed = false, failure: unknown, closing = false, workerStopped = false, outputBytes = 0;
  let stopped: Promise<void> | undefined;
  let pending: { sequence: number; kind: Reply["kind"]; resolve(value: Reply): void; reject(reason: unknown): void; timer: ReturnType<typeof setTimeout> } | undefined;
  const stop = () => {
    if (!stopped) {
      closing = true; signal.removeEventListener("abort", abort);
      stopped = worker.terminate().then(() => { workerStopped = true; });
    }
    return stopped;
  };
  const fail = (reason: unknown) => {
    if (!failed) { failed = true; failure = reason; }
    if (pending) { clearTimeout(pending.timer); pending.reject(failure); pending = undefined; }
    void stop().catch(() => undefined);
  };
  const abort = () => fail(signal.reason);
  const request = (action: "load" | "verify") => {
    signal.throwIfAborted();
    if (failed) return Promise.reject(failure);
    assert.equal(closing, false, "Retained Quality evidence worker is closed.");
    assert.equal(pending, undefined, "Only one exact evidence check may be active.");
    return new Promise<Reply>((resolveReply, reject) => {
      const current = ++sequence;
      const timer = setTimeout(() => fail(new Error("Retained Quality exact evidence check exceeded its worker bound.")), RETAINED_QUALITY_WORKER_REQUEST_LIMIT_MS);
      pending = { sequence: current, kind: action === "load" ? "loaded" : "verified", resolve: resolveReply, reject, timer };
      try { worker.postMessage({ sequence: current, action }); } catch (error) { fail(error); }
    });
  };
  worker.on("message", (message: Reply) => {
    try {
      assert.ok(pending, "Unexpected evidence worker response.");
      assert.equal(message.sequence, pending.sequence); assert.equal(message.kind, pending.kind);
      assert.deepEqual(Object.keys(message).sort(), message.kind === "loaded" ? ["kind", "receipt", "sequence"] : ["kind", "sequence"]);
      const waiting = pending; pending = undefined; clearTimeout(waiting.timer); waiting.resolve(message);
    } catch (error) { fail(error); }
  });
  worker.once("error", fail);
  worker.once("exit", code => { if (!closing) fail(new Error("Retained Quality evidence worker exited before disposal: " + code)); });
  const output = (chunk: Buffer) => { outputBytes += chunk.length; if (outputBytes > 65_536) fail(new Error("Retained Quality evidence worker output exceeded its bound.")); };
  worker.stdout.on("data", output); worker.stderr.on("data", output);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try {
    const loaded = await request("load"); assert.equal(loaded.kind, "loaded");
    return { receipt: (loaded as Extract<Reply, { kind: "loaded" }>).receipt, get workerStopped() { return workerStopped; },
      async verify() { const verified = await request("verify"); assert.equal(verified.kind, "verified"); },
      async close() {
        if (pending) fail(new Error("Retained Quality evidence worker disposed during an unfinished check."));
        await stop(); if (failed) throw failure;
      } };
  } catch (error) { await stop(); throw error; }
}

export type PublicGateRequest = {
  additionalSourceFiles: readonly string[];
  /** Live proof from this owner's qualification, never a serialized approval record. */
  admissionQualification?: LocalVerificationAdmissionQualification;
  /** Reviewed batch-local impact evidence; this creates no persistent impact registry. */
  localVerification?: LocalVerificationImpact;
  /** Full ci:check prefix, followed once by the existing build/Public/Admin gates. */
  finalQualityGate?: true;
  /** Explicit retained Final27 admission from the existing accounting owner; no Admin replay. */
  retainedAdminBehaviorAdmissionSha256?: string;
  /** Fixed affected-build subset; omission retains the complete Public gate contract. */
  selection?: "build-contracts" | "admin-interactions" | "admin-adoption" | "media-upload-limit" | "hero-compatibility";
  /** Owner-authorized narrow Hero proof followed by the unchanged complete ci:check gate. */
  heroCompatibilityFinalHead?: string;
  /** Fixed follow-up journeys; retained Audit2 outcomes are not replayed. */
  adoptionScope?: "core-closure";
  /** Bounded independent Core families; the final gate still runs the Public suite. */
  adoptionCohort?: "preview-recovery-templates" | "domain-forms" | "domain-commands" | "page-composition" | "template-libraries" | "readonly-hubs" | "recovery-templates" | "specialized-settings" | "media-library" | "template-bulk" | "navigation-settings" | "auth-entry" | "media-recovery" | "query-presentation" | "template-controls" | "domain-bulk" | "topic-controls" | "project-controls" | "presentation-controls";
  /** Optional exact affected journeys within the existing domain-forms cohort. */
  adoptionJourneySelection?: "domain-form-controls-followup" | "domain-form-controls-remaining-followup" | "domain-form-controls-final-two-followup" | "domain-form-controls-user-followup" | "template-create-controls-followup" | "presentation-content-controls-followup" | "page-composition-closure-followup" | "page-composition-controls-followup" | "navigation-closure-followup" | "navigation-controls-followup" | "query-pending-followup" | "atomic-confirmation-followup" | "specialized-closure-followup" | "specialized-controls-followup" | "sitemap-closure-followup" | "media-library-final-three-followup" | "media-library-held-followup" | "media-recovery-followup" | "media-recovery-missing-followup" | "topic-video-followup" | "topic-controls-followup" | "specialized-settings-followup" | "page-composition-seo-followup" | "page-composition-content-seo-followup" | "page-composition-followup" | "readonly-hubs-followup" | "template-cards-presentation" | "query-layout-followup" | "text-topic-forms" | "domain-forms-final-six-followup" | "domain-forms-update-followup" | "preview-public-impact" | "template-form-creates" | "template-form-creates-followup" | "domain-command-tail" | "tracking-permissions" | "readonly-query-proof";
  /** Fixed local QA measurement, with an immutable reviewed source snapshot. */
  adminMeasurement?: {
    study?: "heavy-editor-performance";
    round?: "closure";
    phase: "before" | "after";
    frozenSourceManifest: string;
    controlDirectory: string;
    resumeAfterFromRuntime09?: true;
    resumeFinalAfterFromRuntime11?: true;
    resumeCorrectionAfterFromRuntime12?: true;
  };
};
export type PublicFixtureReadiness = {
  status: "ready"; latestVersion: string; registeredMigrations: number;
  syntheticTopicCreated: boolean; syntheticCategoryCreated: boolean;
  articlePublicationValid: true; persistedSeoValid: true; searchCompositionReady: true;
  topicsCmsState: "absent"; topicsListingState: "fallback"; topicsManageabilityGap: true;
  requiredSearchCompositions: 2;
  localDataApiReadable: true; sourceOwnerFingerprint: string; fixtureContentSha256: string;
};
const prepared = new WeakMap<PrivatePublicVerificationContext, PublicFixtureReadiness>();
const completed = new WeakSet<PrivatePublicVerificationContext>();
const adminPhases = new WeakMap<PrivatePublicVerificationContext, Set<string>>();
const adminStudies = new WeakMap<PrivatePublicVerificationContext, "legacy" | "heavy-editor-performance" | "heavy-editor-closure">();
const adminStudyHarnesses = new WeakMap<PrivatePublicVerificationContext, Array<{ file: string; sha256: string }>>();
const adminCredentials = new WeakMap<PrivatePublicVerificationContext, { username: string; password: string; secret: string }>();

export const validateAcceptedAdminBefore09 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control");
  const lifecyclePath=join(control,"before-lifecycle.json"),lifecycle=JSON.parse(readFileSync(lifecyclePath,"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"before");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"bf1367d8554f1e547a18742da3381a1446d9662831547994c8ba1193189aac94");
  assert.equal(lifecycle.buildIdSha256,"b2a0619c2ce3a6906ca55d084386e33209c55b6c56811b18ff2cc7cd950f7950");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const beforeRoot=resolve(base,"production-runtime-09/admin-before"),jobs=readdirSync(control).filter(file=>/^before-job-[a-z0-9-]+\.json$/u.test(file));assert.equal(jobs.length,31);
  const receipts=jobs.map(file=>{
    const job=JSON.parse(readFileSync(join(control,file),"utf8"));const pointer=JSON.parse(readFileSync(join(control,`before-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(beforeRoot+sep),"Retained Before receipt must belong to runtime09");
    const raw=readFileSync(path),receipt=JSON.parse(raw.toString());assert.equal(receipt.id,job.id);assert.equal(receipt.phase,"before");assert.equal(receipt.status,pointer.status);assert.ok(["pass","fail"].includes(receipt.status));
    assert.ok(Array.isArray(receipt.measurements)&&Number.isFinite(receipt.finishedAt));
    return {id:job.id,status:receipt.status,path,sha256:createHash("sha256").update(raw).digest("hex")};
  });
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-09/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);
  return {lifecycle,receipts,beforeDatabase:"cleaned after fixture reset failure",afterDatabase:"fresh canonical owned DB; identical returned fixture model required",repeatedBeforeBuild:false,repeatedBeforeJobs:false};
};

export const validateAcceptedAdminAfter11 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control");
  const lifecyclePath=join(control,"after-lifecycle.json"),lifecycle=JSON.parse(readFileSync(lifecyclePath,"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"after");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"91aa9401a07482bddb53a71a80ace45acea36a4adb182d8b6afa36b054dd0aa2");
  assert.equal(lifecycle.buildIdSha256,"457638f37754fa57e57581a189d4eac4d97de867098f927d312f4baaffdb8f9f");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const afterRoot=resolve(base,"production-runtime-11/admin-after"),summaryPath=join(afterRoot,"browser-summary.json"),summaryRaw=readFileSync(summaryPath),summary=JSON.parse(summaryRaw.toString());
  assert.equal(summary.phase,"after");assert.ok(Array.isArray(summary.jobs)&&summary.jobs.length>0);assert.equal(new Set(summary.jobs).size,summary.jobs.length);
  const receipts=summary.jobs.map((file:string)=>{
    assert.match(file,/^after-job-[a-z0-9-]+\.json$/u);
    const job=JSON.parse(readFileSync(join(control,file),"utf8")),pointer=JSON.parse(readFileSync(join(control,`after-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(afterRoot+sep),"Retained After receipt must belong to runtime11");
    const raw=readFileSync(path),receipt=JSON.parse(raw.toString());assert.equal(receipt.id,job.id);assert.equal(receipt.phase,"after");assert.equal(receipt.status,pointer.status);assert.ok(["pass","fail"].includes(receipt.status));
    assert.ok(Array.isArray(receipt.measurements)&&Number.isFinite(receipt.finishedAt));
    return {id:job.id,status:receipt.status,path,sha256:digest(raw)};
  });
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-11/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);
  return {lifecycle,receipts,browserSummarySha256:digest(summaryRaw),priorDatabase:"cleaned normally after preserved browser summary",nextDatabase:"fresh canonical owned DB; fixture model equality required",repeatedPriorBuild:false,repeatedPriorJobs:false,retainedFailuresAreNotPasses:true};
};

export const validateAcceptedAdminAfter12 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control-final-delta");
  const lifecycle=JSON.parse(readFileSync(join(control,"after-lifecycle.json"),"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"after");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"ddc0d27237b435a2e766ae3adbef85a2853e32ab4c6ce4fd550871dfeb741a3d");
  assert.equal(lifecycle.buildIdSha256,"149049e42b900bd5021e71caa53ce13b938d692b5b88078d3fddba949a82a897");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const afterRoot=resolve(base,"production-runtime-12/admin-after"),jobs=readdirSync(control).filter(file=>/^after-job-[a-z0-9-]+\.json$/u.test(file));assert.equal(jobs.length,26);
  const receipts=jobs.map(file=>{
    const jobRaw=readFileSync(join(control,file)),job=JSON.parse(jobRaw.toString()),pointer=JSON.parse(readFileSync(join(control,`after-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(afterRoot+sep),"Retained After receipt must belong to runtime12");
    const raw=readFileSync(path),retained=JSON.parse(raw.toString());assert.equal(retained.id,job.id);assert.equal(retained.phase,"after");assert.equal(retained.status,pointer.status);assert.ok(["pass","fail"].includes(retained.status));
    assert.equal(retained.scenarioSha256,digest(jobRaw));assert.ok(Array.isArray(retained.measurements)&&Number.isFinite(retained.finishedAt));
    return {file,id:job.id,status:retained.status,path,sha256:digest(raw)};
  });
  assert.equal(new Set(receipts.map(row=>row.id)).size,receipts.length);
  const summaryPath=join(afterRoot,"browser-driver-2/browser-summary.json"),summaryRaw=readFileSync(summaryPath),summary=JSON.parse(summaryRaw.toString());
  assert.equal(summary.phase,"after");assert.ok(Array.isArray(summary.jobs)&&summary.jobs.length>0);assert.equal(new Set(summary.jobs).size,summary.jobs.length);
  for(const file of summary.jobs){assert.match(file,/^after-job-[a-z0-9-]+\.json$/u);assert.ok(jobs.includes(file));}
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-12/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);assert.equal(cleanup.privateEnvRemoved,true);
  return {lifecycle,receipts,browserSummarySha256:digest(summaryRaw),terminalDriverJobs:summary.jobs.length,allCompletedJobs:receipts.length,summaryIsTerminalDriverSubset:true,priorDatabase:"cleaned normally after both driver attempts",nextDatabase:"fresh canonical owned DB; fixture model equality required",repeatedPriorBuild:false,repeatedPriorJobs:false,retainedFailuresAreNotPasses:true};
};

export function registerOwnedAdminMeasurement(context: PrivatePublicVerificationContext, credentials: { username: string; password: string; secret: string }) {
  assert.equal(adminCredentials.has(context), false);
  adminCredentials.set(context, Object.freeze({ ...credentials }));
}

function ownedPath(context: Pick<PrivatePublicVerificationContext, "runDirectory">, name: string) {
  assert.ok(!isAbsolute(name) && !name.split(/[\\/]/u).includes(".."));
  const path = resolve(context.runDirectory, name);
  assert.ok(path.startsWith(resolve(context.runDirectory) + sep));
  return path;
}
function receipt(context: Pick<PrivatePublicVerificationContext, "runDirectory" | "sanitize">, name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  assert.equal(context.sanitize(text), text, "Public receipt contains a generated credential.");
  writeFileSync(ownedPath(context, name), `${text}\n`, { flag: "wx", mode: 0o600 });
}
const identifier = (value: string) => {
  assert.match(value, /^[a-z_][a-z0-9_]*$/u); return `"${value}"`;
};

/** Node-only resolution for actual pure publication modules, without mocks. */
async function publicationOwner() {
  type Context = { parentURL?: string };
  type Result = { url: string };
  const { registerHooks } = nodeModule as unknown as { registerHooks(value: {
    resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Result): Result;
  }): { deregister(): void } };
  assert.equal(typeof registerHooks, "function");
  const sourceRoot = new URL("../../src/", import.meta.url);
  const hook = registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ERR_MODULE_NOT_FOUND"
        || !context.parentURL?.startsWith(sourceRoot.href) || !(specifier.startsWith("./") || specifier.startsWith("../"))
        || extname(specifier) || /[?#]/u.test(specifier)) throw error;
      const target = new URL(`${specifier}.ts`, context.parentURL);
      if (!target.href.startsWith(sourceRoot.href)) throw error;
      return next(target.href, context);
    }
  } });
  try { return await import("../../src/lib/admin/content-workflow/topic-publish-validation.ts"); }
  finally { hook.deregister(); }
}

export async function prepareOwnedPublicVerification(context: PrivatePublicVerificationContext, handle: OwnedLocalHandle): Promise<PublicFixtureReadiness> {
  await context.assertOwned();
  assert.equal(prepared.has(context), false, "Public fixture preparation is one-shot per owned run.");
  const files = readdirSync(join(ROOT, "sql/migrations")).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file)).sort();
  const registry = (await handle.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  assert.deepEqual(registry.map(row => `${row.version}_${row.name}.sql`), files, "Public fixtures require the complete current application corpus.");
  const topicsPages = (await handle.query("select id,slug,path from public.pages where slug='topics' or path='/topics'")).rows;
  assert.equal(topicsPages.length, 0, "The approved fresh Public fixture requires the absent Topics CMS state; do not manufacture or repair it.");
  const seo = loadEntitySeoPersistenceOwner();
  const owner = await publicationOwner();
  const columns = [...new Set([...seo.TOPIC_SEO_SOURCE_COLUMNS, "id", "status", "deleted_at", "category_slug", "category_id", "canonical_url", "seo_score", "seo_score_version", "seo_score_input_hash"])];
  const readCandidates = () => handle.query(`select ${columns.map(identifier).join(",")} from public.topics
    where status='published' and deleted_at is null and content_type='article' and title like '%ملكية%' order by id`);
  const qualifies = (row: Record<string, unknown>) => {
    const input = owner.topicRowToPublishInput(row);
    if (owner.getTopicPublishValidationError(input) !== null || !/^#{2,4}\s+\S/mu.test(input.content)) return false;
    const score = seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource));
    return row.seo_score === score.seo_score && row.seo_score_version === score.seo_score_version && row.seo_score_input_hash === score.seo_score_input_hash;
  };
  let article = (await readCandidates()).rows.find(qualifies);
  let syntheticTopicCreated = false, syntheticCategoryCreated = false;
  if (!article) {
    assert.equal((await handle.query("select id from public.topics where slug=$1", [FIXTURE_SLUG])).rows.length, 0, "An incompatible existing fixture must not be repaired.");
    // A real isolated Storage object replaces the retired repository image fixture.
    // This is fixture provisioning, not Signed Upload behavioral evidence.
    await context.assertOwned();
    const origin = `http://127.0.0.1:${context.apiPort}`;
    const storage = createClient(origin, context.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const imageBytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#245670" } }).png().toBuffer();
    const objectKey = `images/${FIXTURE_SLUG}.png`;
    const uploaded = await storage.storage.from("cms-images").upload(objectKey, imageBytes, { contentType: "image/png", upsert: false });
    assert.equal(uploaded.error, null, "Owned fixture must exist in real Storage before Catalog registration.");
    const imageUrl = storage.storage.from("cms-images").getPublicUrl(objectKey).data.publicUrl;
    const imageReadback = await fetch(imageUrl, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    assert.equal(imageReadback.status, 200);
    assert.deepEqual(Buffer.from(await imageReadback.arrayBuffer()), imageBytes);
    await handle.query("begin");
    try {
      await handle.query(`insert into public.media_assets(provider,bucket,object_key,public_url,original_filename,display_name,
        media_kind,mime_type,extension,byte_size,width,height,checksum,folder_path,status,reconciliation_state,metadata)
        values('supabase','cms-images',$1,$2,$3,$3,'image','image/png','.png',$4,64,64,$5,'images','active','synced',
        '{"fixture":"isolated-public-verification"}'::jsonb)`, [objectKey,imageUrl,`${FIXTURE_SLUG}.png`,imageBytes.length,digest(imageBytes)]);
      // This category is synthetic fixture data, never an application default.
      let category = (await handle.query(`with recursive media as (
        select id from public.topic_categories where slug='media-center'
        union all select c.id from public.topic_categories c join media p on c.parent_id=p.id)
        select id,name,slug from public.topic_categories where parent_id is null and status='published'
          and is_active is true and id not in (select id from media) order by id limit 1`)).rows[0];
      if (!category) {
        assert.equal((await handle.query("select id from public.topic_categories where slug=$1", [FIXTURE_CATEGORY])).rows.length, 0);
        category = (await handle.query(`insert into public.topic_categories(name,slug,status,is_active,show_in_menu,created_at,updated_at)
          values('مقالات التحقق المعزول',$1,'published',true,false,$2,$2) returning id,name,slug`, [FIXTURE_CATEGORY, FIXTURE_DATE])).rows[0];
        syntheticCategoryCreated = true;
      }
      const row: Record<string, unknown> = {
        slug: FIXTURE_SLUG, title: "ملكية العقارات: دليل اصطناعي للتحقق من القراءة والبحث",
        excerpt: "مقال اصطناعي داخل بيئة الاختبار المعزولة للتحقق من عرض المحتوى العربي والبحث فيه والتنقل بين صفحاته.",
        content: "## ملكية العقارات\n\nهذا المقال بيانات اصطناعية للاختبار المعزول، ويتيح التحقق من القراءة والبحث دون استخدام بيانات حقيقية.\n\n### مراجعة المعلومات\n\nتعرض الفقرة بنية دلالية واضحة مع عنوان فرعي ومحتوى قابل للقراءة. يمكن العودة إلى [الموضوعات](/topics) لمتابعة التنقل.\n\n### التخطيط للخطوات التالية\n\nنستخدم هذه البيانات للتحقق من عرض المحتوى العربي وترتيب العناوين وسلوك الاقتراحات في البحث فقط.",
        image: imageUrl, image_alt: "صورة توضيحية لمقال التحقق المعزول",
        category: category.name, category_slug: category.slug, category_id: category.id,
        content_type: "article", status: "published", deleted_at: null,
        seo_title: "دليل ملكية العقارات وفهم خطوات الشراء والاستثمار الآمن",
        seo_description: "محتوى اصطناعي معزول يشرح ملكية العقارات وخطوات مراجعة المستندات والتخطيط المالي، لاختبار عرض المقالات والبحث والتنقل دون بيانات حقيقية.",
        seo_keywords: ["ملكية", "عقارات"], focus_keyword: "ملكية", canonical_url: null,
        og_image: null, og_image_alt: "", robots_index: true, robots_follow: true, faq: [],
        show_title_on_page: true, show_image_on_page: true, show_excerpt_on_page: true,
        created_at: FIXTURE_DATE, updated_at: FIXTURE_DATE, published_at: FIXTURE_DATE,
      };
      assert.equal(row.image, imageUrl, "Public fixture consumes the verified managed object.");
      assert.equal(owner.getTopicPublishValidationError(owner.topicRowToPublishInput(row)), null, "Synthetic article must satisfy the current publication owner.");
      Object.assign(row, seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource)));
      const fields = Object.keys(row);
      await handle.query(`insert into public.topics(${fields.map(identifier).join(",")}) values(${fields.map((field, index) => `$${index + 1}${field === "faq" ? "::jsonb" : ""}`).join(",")})`,
        fields.map(field => field === "faq" ? JSON.stringify(row[field]) : row[field]));
      article = (await readCandidates()).rows.find(qualifies);
      assert.ok(article, "Synthetic article readback did not meet the canonical publication/SEO contract.");
      await handle.query("commit"); syntheticTopicCreated = true;
    } catch (error) { await handle.query("rollback"); throw error; }
  }
  const composition = (await handle.query(`select p.slug as page_slug,t.slug as template_slug,p.status as page_status,
      t.status as template_status,a.is_visible from public.pages p
      join public.page_content_block_assignments a on a.page_id=p.id
      join public.content_block_templates t on t.id=a.template_id
      where (p.slug,t.slug) in (('media-center-news','media-news-search'),('search','search-platform'))
      order by p.slug,t.slug`)).rows;
  assert.deepEqual(composition.map(row => [row.page_slug, row.template_slug]),
    [["media-center-news", "media-news-search"], ["search", "search-platform"]],
    "The existing Search composition migration must supply Media News and central Search without a fabricated Topics page.");
  assert.ok(composition.every(row => row.page_status === "published" && row.template_status === "published" && row.is_visible === true));
  const response = await fetch(`http://127.0.0.1:${context.apiPort}/rest/v1/topics?select=id&slug=eq.${encodeURIComponent(String(article.slug))}`,
    { headers: { apikey: context.anonKey, Authorization: `Bearer ${context.anonKey}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, "The current local Data API must expose the published article through the real role policy.");
  const result: unknown = await response.json(); assert.ok(Array.isArray(result) && result.length === 1);
  const semantic = Object.fromEntries(Object.entries(article).filter(([key]) => !["id", "category_id"].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
  const ready: PublicFixtureReadiness = { status: "ready", latestVersion: String(registry.at(-1)!.version), registeredMigrations: registry.length,
    syntheticTopicCreated, syntheticCategoryCreated, articlePublicationValid: true, persistedSeoValid: true,
    topicsCmsState: "absent", topicsListingState: "fallback", topicsManageabilityGap: true, requiredSearchCompositions: 2,
    searchCompositionReady: true, localDataApiReadable: true, sourceOwnerFingerprint: seo.sourceFingerprint, fixtureContentSha256: digest(JSON.stringify(semantic)) };
  prepared.set(context, ready); receipt(context, "public-fixture-readiness.json", ready);
  context.record("public-fixture-ready", { createdTopics: Number(syntheticTopicCreated), createdCategories: Number(syntheticCategoryCreated), registered: registry.length });
  return ready;
}

function safeSourcePath(file: string) {
  assert.ok(file && !isAbsolute(file) && !file.includes("\\") && sourceIncluded(file));
  return resolve(ROOT, file);
}
async function gitSourceInventory(context: PrivatePublicVerificationContext, request: PublicGateRequest) {
  assert.ok(Array.isArray(request.additionalSourceFiles));
  const inventory = (options: string[]) => new Promise<string[]>((done, reject) => {
    const child = spawn("git", ["ls-files", ...options, "-z"], { cwd: ROOT, env: context.cleanEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let data = "", stopped = false;
    const stop = () => { if (stopped) return; stopped = true; void stopChild(child, context.cleanEnvironment()).catch(() => reject(new Error("Source inventory cleanup failed."))); };
    const timer = setTimeout(stop, 30_000);
    child.stdout.on("data", value => { data += String(value); if (data.length > 2_000_000) stop(); });
    child.once("error", () => { clearTimeout(timer); reject(new Error("Source inventory failed.")); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0 && !stopped) done(data.split("\0").filter(Boolean));
      else reject(new Error("Source inventory failed."));
    });
  });
  const tracked = await inventory(["--cached"]);
  const eligibleAdditional = new Set(await inventory(["--others", "--exclude-standard"]));
  const additional: string[] = [...request.additionalSourceFiles];
  assert.equal(new Set(additional).size, additional.length);
  for (const file of additional) {
    safeSourcePath(file); assert.match(file, /^(?:src|scripts|sql|tests|docs)\//u);
    assert.ok(eligibleAdditional.has(file), "Additional Public source must be a reviewed, nonignored new source file.");
  }
  return selectSourceInventory(tracked, additional);
}

async function gitHead(context: PrivatePublicVerificationContext) {
  return new Promise<string>((done, reject) => {
    const child = spawn("git", ["rev-parse", "HEAD"], { cwd: ROOT, env: context.cleanEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", value => { output += String(value); });
    child.once("error", reject);
    child.once("close", code => code === 0 && /^[a-f0-9]{40}\s*$/u.test(output) ? done(output.trim()) : reject(new Error("Snapshot HEAD binding failed.")));
  });
}

async function stopChild(child: ChildProcess, environment: NodeJS.ProcessEnv, reason: WindowsStopReason = "owner_shutdown") {
  const windows = (child as ChildProcess & { verificationWindowsCleanup?: (reason: WindowsStopReason) => Promise<{
    status: "PASS"; platform: string; method: string; processTreeVerified: boolean; forcedTermination: boolean;
    observedProcesses: number; liveProcesses: number; residualProcessesAfterExit: number | null; nativeJobReceipt: WindowsJobReceipt | null;
  }> }).verificationWindowsCleanup;
  if (process.platform === "win32" && windows) return windows(reason);
  const owned = (child as ChildProcess & { verificationLinuxCleanup?: () => Promise<{
    status: "PASS"; platform: string; method: string; processTreeVerified: boolean; forcedTermination: boolean;
    observedProcesses: number; liveProcesses: number; residualProcessesAfterExit: number | null;
  }> }).verificationLinuxCleanup;
  if (process.platform === "linux" && owned) return owned();
  let forcedTermination = false, terminationExitCode: number | null = null;
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return {
    status: "PASS" as const, platform: process.platform, method: "closed-child", processTreeVerified: false,
    forcedTermination, observedProcesses: Number(Boolean(child.pid)), liveProcesses: 0,
    residualProcessesAfterExit: process.platform === "win32" && child.pid ? null : 0,
    descendantObservation: process.platform === "win32" && child.pid ? "UNVERIFIED_AFTER_ROOT_EXIT" : "root-only",
  };
  if (process.platform === "win32") {
    await new Promise<void>((done, reject) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { env: environment, windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(() => { killer.kill(); reject(new Error("Owned child cleanup exceeded its bound.")); }, 15_000);
      killer.once("error", (error: NodeJS.ErrnoException) => { clearTimeout(timer); reject(new Error("Owned child cleanup failed.", {
        cause: { code: typeof error.code === "string" && /^[A-Z0-9_]+$/u.test(error.code) ? error.code : null },
      })); });
      killer.once("close", code => {
        clearTimeout(timer); terminationExitCode = code;
        // A concurrent root exit cannot qualify a failed tree termination command.
        if (code === 0) done();
        else reject(new Error("Owned child cleanup failed.", { cause: { exitCode: code, signal: killer.signalCode } }));
      });
    });
    forcedTermination = true;
  } else {
    child.kill("SIGTERM");
    await new Promise<void>(done => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      const timer = setTimeout(done, 1_500);
      child.once("close", () => { clearTimeout(timer); done(); });
    });
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); forcedTermination = true; }
  }
  if (child.exitCode === null && child.signalCode === null) await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned child did not stop.")), 15_000);
    child.once("close", () => { clearTimeout(timer); done(); });
  });
  return { status: "PASS" as const, platform: process.platform, method: process.platform === "win32" ? "windows-taskkill-tree" : "owned-child-signals",
    processTreeVerified: process.platform === "win32", forcedTermination, terminationExitCode, observedProcesses: 1, liveProcesses: 0, residualProcessesAfterExit: 0 };
}

/** One owned Node-child lifecycle shared by Public gates and qualified targeted verification. */
export function runOwnedVerificationChild(ports: {
  sourceDirectory: string;
  context: Pick<PrivatePublicVerificationContext, "runDirectory" | "sanitize" | "cleanEnvironment">;
  children: Set<ChildProcess>;
  signal: AbortSignal;
}, args: string[], env: NodeJS.ProcessEnv, name: string, limitMs: number): Promise<{ code: number; stdout: string; stderr: string; durationMs: number;
  rawExit: { code: number | null; signal: NodeJS.Signals | null }; identity: { pid: number | null; ppid: number; spawnedAtUtc: string };
  cleanup: { status: "PASS"; platform: string; method: string; processTreeVerified: boolean; forcedTermination: boolean;
    observedProcesses: number; liveProcesses: number; residualProcessesAfterExit: number | null };
  nativeJobIdentity?: WindowsJobIdentity | null; nativeJobReceipt?: WindowsJobReceipt | null;
  nativeCapability?: { executable: string; executableSha256: string; sourceSha256: string; compilerSha256: string; provenance: string };
  helperExit?: { code: number | null; signal: NodeJS.Signals | null };
  helperIdentity?: { pid: number | null; ppid: number };
  timingEvidence?: { file: string; sha256: string; status: "COMPLETE_DIAGNOSTIC_ONLY" | "PARTIAL_DIAGNOSTIC_ONLY";
    overhead: { setupMs: number; observerMs: number; readParseMs: number; serializationMs: number; writeMs: number } } }> {
  const { sourceDirectory, context, children, signal } = ports;
  const started = performance.now();
  return new Promise((done, reject) => {
    signal.throwIfAborted();
    assert.ok(Number.isSafeInteger(limitMs) && limitMs > 0 && limitMs <= 2_147_483_647, "Owned child deadline must be a finite timer-safe positive integer.");
    const stdoutPath = ownedPath(context, `public-${name}.stdout.log`), stderrPath = ownedPath(context, `public-${name}.stderr.log`);
    assert.equal(existsSync(stdoutPath) || existsSync(stderrPath), false, "Owned child evidence already exists; refuse duplicate execution.");
    const gate57Timing = (() => {
      // Unrelated owners/argv perform no additional filesystem or runtime work.
      if (args.length !== 3 || args[1] !== "run" || args[2] !== "verify:admin-runtime") return undefined;
      const invocationArgv = [...args], setupStarted = performance.now(), nodeDirectory = dirname(process.execPath);
      const npmCli = [join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"), resolve(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
        resolve(nodeDirectory, "../share/nodejs/npm/bin/npm-cli.js")].find(file => existsSync(file) && lstatSync(file).isFile());
      if (!npmCli || args[0] !== npmCli) return undefined;
      const npmRoot = resolve(dirname(npmCli), ".."), npmPackageFile = join(npmRoot, "package.json");
      let npmPackage: { version?: string };
      try { npmPackage = JSON.parse(readFileSync(npmPackageFile, "utf8")) as { version?: string }; } catch { return undefined; }
      // An unsupported package manager retains its original command/environment;
      // absence of this version-specific observer is never timing qualification.
      if (npmPackage.version !== "11.9.0") return undefined;
      const enabled = true, issues = new Set<string>();
      const packageFile = join(sourceDirectory, "package.json"), packageBytes = readFileSync(packageFile);
      const pkg = JSON.parse(packageBytes.toString()) as { name?: string; version?: string; scripts?: Record<string, string> };
      const scripts = pkg.scripts ?? {}, preorder: Array<{ id: number; script: string; parentId: number | null }> = [], postorder: number[] = [];
      const nodeLeaves = enabled ? localVerificationCommandSteps(scripts, "verify:admin-runtime") : undefined;
      if (enabled && (!nodeLeaves || typeof pkg.name !== "string" || typeof pkg.version !== "string")) issues.add("UNSUPPORTED_BOUND_COMMAND_OR_PACKAGE");
      if (nodeLeaves) {
        const visit = (script: string, parentId: number | null) => {
          const id = preorder.length; preorder.push({ id, script, parentId });
          if (scripts["pre" + script] || scripts["post" + script]) issues.add("UNMODELED_NPM_LIFECYCLE_SCRIPT");
          for (const step of scripts[script]!.split("&&")) { const wrapper = /^npm run ([a-zA-Z0-9:_-]+)$/u.exec(step.trim()); if (wrapper) visit(wrapper[1]!, id); }
          postorder.push(id);
        };
        visit("verify:admin-runtime", null);
        if (new Set(preorder.map(row => row.script)).size !== preorder.length) issues.add("REPEATED_SCRIPT_INVOCATION_AMBIGUOUS");
      }
      const checkedFile = (file: string) => {
        const stat = lstatSync(file); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && realpathSync(file) === file,
          "Owned npm timing evidence requires a physical ordinary file."); return stat;
      };
      const boundFiles = [npmPackageFile, npmCli, ...(enabled ? ["lib/npm.js", "lib/utils/timers.js", "lib/utils/display.js", "lib/utils/log-file.js",
        "lib/commands/run.js", "node_modules/@npmcli/run-script/lib/run-script-pkg.js", "node_modules/proc-log/lib/index.js"].map(file => join(npmRoot, file)) : [])]
        .map(file => { checkedFile(file); return { file, sha256: digest(readFileSync(file)) }; });
      const runtime = { node: process.version, v8: process.versions.v8, modules: process.versions.modules, platform: process.platform, arch: process.arch,
        executable: process.execPath, executableSha256: digest(readFileSync(process.execPath)), parentExecArgv: [...process.execArgv], npmVersion: npmPackage.version ?? null,
        npmPackageManagerOutsideProjectLock: true, npmSourceBinding: "Finite installed format-producing source files; not a complete npm dependency closure", files: boundFiles };
      const directory = ownedPath(context, `public-${name}-npm-timing`);
      if (enabled) {
        assert.equal(existsSync(directory), false, "Preserve earlier npm timing evidence rather than reusing its directory.");
        mkdirSync(directory, { mode: 0o700 }); assert.equal(realpathSync(directory), directory);
        assert.ok(directory.startsWith(realpathSync(context.runDirectory) + sep));
      }
      const clockOriginMonotonicMs = performance.now(), startedWall = Date.now(), setupMs = clockOriginMonotonicMs - setupStarted;
      let ownerTimeoutReferenceMonotonicMs: number | null = null;
      const starts: Array<{ script: string; planId: number | null; deliveryMonotonicMs: number; deliveryUtc: string; nominalRemainingMs: number | null; wallMinusMonotonicMs: number }> = [];
      const ends: Array<{ npmCommandInclusiveWallMs: number; deliveryMonotonicMs: number; deliveryUtc: string; nominalRemainingMs: number | null; wallMinusMonotonicMs: number }> = [];
      const carries = { stdout: "", stderr: "" }, dropping = { stdout: false, stderr: false };
      const lastDelivery: Partial<Record<"stdout" | "stderr", { utcMs: number; monotonicMs: number }>> = {};
      const packageIdentity = `${pkg.name}@${pkg.version}`, bannerPrefix = `> ${packageIdentity} `;
      const knownScripts = new Set(preorder.map(row => row.script)), ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "gu");
      let observerMs = 0, observerCalls = 0, observedCharacters = 0, droppedLines = 0;
      const stamp = (stream: "stdout" | "stderr") => { const now = performance.now(), deliveryUtc = new Date().toISOString(), utcMs = Date.parse(deliveryUtc), previous = lastDelivery[stream];
        if (previous && now >= previous.monotonicMs && utcMs < previous.utcMs) issues.add("DELIVERY_UTC_MOVED_BACKWARDS_WITH_MONOTONIC_PROGRESS");
        lastDelivery[stream] = { utcMs, monotonicMs: now };
        return { deliveryMonotonicMs: now - started, deliveryUtc,
        nominalRemainingMs: ownerTimeoutReferenceMonotonicMs === null ? null : limitMs - (now - ownerTimeoutReferenceMonotonicMs),
        wallMinusMonotonicMs: Date.now() - startedWall - (now - clockOriginMonotonicMs) }; };
      const line = (stream: "stdout" | "stderr", raw: string) => {
        const value = raw.replace(ansi, "").replace(/\r$/u, "");
        if (stream === "stdout" && value.startsWith(bannerPrefix)) {
          const script = value.slice(bannerPrefix.length);
          if (!knownScripts.has(script)) { issues.add("UNEXPECTED_SCRIPT_BANNER"); return; }
          if (starts.length >= preorder.length) { issues.add("EXCESS_START_EVENTS"); return; }
          const expected = preorder[starts.length]!, matches = expected.script === script;
          if (!matches) issues.add("START_PREORDER_MISMATCH");
          starts.push({ script, planId: matches ? expected.id : null, ...stamp(stream) });
        } else if (stream === "stderr") {
          const match = /^npm timing command:run Completed in (-?[0-9]+)ms$/u.exec(value);
          if (!match) return;
          const duration = Number(match[1]);
          if (!Number.isSafeInteger(duration) || ends.length >= preorder.length) { issues.add("INVALID_OR_EXCESS_END_EVENT"); return; }
          if (duration < 0) issues.add("NEGATIVE_NPM_WALL_DURATION");
          ends.push({ npmCommandInclusiveWallMs: duration, ...stamp(stream) });
        }
      };
      const observe = (stream: "stdout" | "stderr", chunk: string) => {
        if (!enabled) return;
        const before = performance.now(); observerCalls++; observedCharacters += chunk.length;
        try {
          let offset = 0;
          while (offset < chunk.length) {
            const newline = chunk.indexOf("\n", offset), end = newline < 0 ? chunk.length : newline;
            if (!dropping[stream]) {
              const segment = chunk.slice(offset, end);
              if (carries[stream].length + segment.length <= 4096) carries[stream] += segment;
              else {
                const prefix = (carries[stream] + segment.slice(0, 4096)).replace(ansi, "");
                if (prefix.startsWith(bannerPrefix) || prefix.startsWith("npm timing command:run")) issues.add("TIMING_LINE_CARRY_BOUND");
                carries[stream] = ""; dropping[stream] = true; droppedLines++;
              }
            }
            if (newline >= 0) { if (!dropping[stream]) line(stream, carries[stream]); carries[stream] = ""; dropping[stream] = false; offset = newline + 1; }
            else break;
          }
        } catch { issues.add("OBSERVER_PARSE_FAILURE"); }
        finally { observerMs += performance.now() - before; }
      };
      const finish = (facts: { code: number | null; reason: string | null; stdout: string | null; stderr: string | null;
        cleanup?: Cleanup; nativeJobIdentity: WindowsJobIdentity | null; nativeJobReceipt: WindowsJobReceipt | null }) => {
        const readStarted = performance.now();
        for (const stream of ["stdout", "stderr"] as const) if (carries[stream]) { issues.add("UNTERMINATED_STREAM_LINE"); carries[stream] = ""; }
        const files: Array<{ file: string; bytes: number; sha256: string }> = [], closedFiles: Array<{ file: string; bytes: number; sha256: string }> = [];
        const timings: Array<{ script: string; commandInclusiveWallMs: number; npmInclusiveWallMs: number; id: string }> = [];
        let rawMemberCount: number | null = null, rawNamesSha256: string | null = null;
        let captureFailure: unknown;
        try {
          assert.deepEqual(args, invocationArgv, "Owned npm argv changed during execution.");
          assert.equal(digest(readFileSync(packageFile)), digest(packageBytes), "Bound npm package scripts changed during execution.");
          for (const row of boundFiles) { checkedFile(row.file); assert.equal(digest(readFileSync(row.file)), row.sha256, "Installed npm format source changed during execution."); }
          assert.equal(digest(readFileSync(process.execPath)), runtime.executableSha256);
          if (facts.stdout === null || facts.stderr === null || facts.cleanup?.status !== "PASS" || facts.cleanup.liveProcesses !== 0 || facts.cleanup.processTreeVerified !== true) issues.add("CLOSED_CHILD_EVIDENCE_UNAVAILABLE");
          if (ownerTimeoutReferenceMonotonicMs === null) issues.add("OWNER_TIMEOUT_REFERENCE_UNAVAILABLE");
          for (const [file, text] of [[stdoutPath, facts.stdout], [stderrPath, facts.stderr]] as const) if (text !== null) {
            checkedFile(file); const bytes = readFileSync(file); assert.equal(digest(bytes), digest(text), "Closed child stream differs from its timing binding.");
            closedFiles.push({ file, bytes: bytes.length, sha256: digest(bytes) });
          }
          if (process.platform === "win32") {
            if (!facts.nativeJobIdentity || !facts.nativeJobReceipt) issues.add("NATIVE_CLOSURE_EVIDENCE_UNAVAILABLE");
            else {
              if (facts.nativeJobReceipt.status !== "PASS" || facts.nativeJobReceipt.cleanup.activeProcessesAfterCleanup !== 0
                || facts.nativeJobReceipt.jobToken !== facts.nativeJobIdentity.jobToken || facts.nativeJobReceipt.rootPid !== facts.nativeJobIdentity.rootPid)
                issues.add("NATIVE_CLOSURE_EVIDENCE_UNQUALIFIED");
              for (const [suffix, value] of [["native-identity", facts.nativeJobIdentity], ["native-result", facts.nativeJobReceipt]] as const) {
              const file = ownedPath(context, `public-${name}.${suffix}.json`); checkedFile(file);
              const bytes = readFileSync(file); assert.deepEqual(JSON.parse(bytes.toString()), value, "Closed Native receipt differs from its timing binding.");
              closedFiles.push({ file, bytes: bytes.length, sha256: digest(bytes) });
              }
            }
          }
          if (enabled) {
            const stat = lstatSync(directory); assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && realpathSync(directory) === directory);
            const names = readdirSync(directory).sort(); rawMemberCount = names.length; rawNamesSha256 = digest(JSON.stringify(names));
            if (names.length > preorder.length) issues.add("EXCESS_TIMING_FILE_MEMBERSHIP");
            else for (const member of names) {
              const file = join(directory, member), stat = checkedFile(file);
              if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}_[0-9]{2}_[0-9]{2}_[0-9]{3}Z-timing\.json$/u.test(member)) { issues.add("UNEXPECTED_TIMING_FILE_NAME"); continue; }
              if (stat.size > 8_000_000) { issues.add("TIMING_FILE_PARSE_BOUND"); continue; }
              const bytes = readFileSync(file), row = { file, bytes: bytes.length, sha256: digest(bytes) }; files.push(row);
              let value: unknown; try { value = JSON.parse(bytes.toString()); } catch { issues.add("MALFORMED_TIMING_JSON"); continue; }
              if (!value || typeof value !== "object" || Array.isArray(value)) { issues.add("INVALID_TIMING_JSON"); continue; }
              const data = value as { metadata?: { id?: unknown; command?: unknown; version?: unknown; logfiles?: unknown }; timers?: Record<string, unknown>; unfinishedTimers?: unknown };
              const command = data.metadata?.command, id = data.metadata?.id, commandMs = data.timers?.["command:run"], npmMs = data.timers?.npm;
              const dateParts = typeof id === "string" ? /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2})_([0-9]{2})_([0-9]{2})_([0-9]{3})Z$/u.exec(id) : null;
              const utc = dateParts ? `${dateParts[1]}T${dateParts[2]}:${dateParts[3]}:${dateParts[4]}.${dateParts[5]}Z` : null;
              const validId = utc !== null && Number.isFinite(Date.parse(utc)) && new Date(Date.parse(utc)).toISOString() === utc;
              if (!Array.isArray(command) || command.length !== 2 || command[0] !== "run" || typeof command[1] !== "string" || !knownScripts.has(command[1])
                || typeof id !== "string" || !validId || member !== id + "-timing.json" || data.metadata?.version !== "11.9.0"
                || !Array.isArray(data.metadata.logfiles) || data.metadata.logfiles.length !== 0
                || !Number.isSafeInteger(commandMs) || !Number.isSafeInteger(npmMs) || (commandMs as number) < 0 || (npmMs as number) < (commandMs as number)
                || !data.unfinishedTimers || typeof data.unfinishedTimers !== "object" || Array.isArray(data.unfinishedTimers) || Object.keys(data.unfinishedTimers).length !== 0) {
                issues.add("UNQUALIFIED_TIMING_METADATA_OR_WALL_CLOCK"); continue;
              }
              timings.push({ script: command[1], commandInclusiveWallMs: commandMs as number, npmInclusiveWallMs: npmMs as number, id });
            }
            assert.deepEqual(readdirSync(directory).sort(), names, "Npm timing membership changed after Native closure.");
            for (const row of files) { checkedFile(row.file); assert.equal(digest(readFileSync(row.file)), row.sha256, "Npm timing bytes changed after capture."); }
          }
        } catch (error) { captureFailure = error; issues.add("TIMING_EVIDENCE_INTEGRITY_OR_IO_FAILURE"); }
        const startedIds = new Set(starts.flatMap(row => row.planId === null ? [] : [row.planId]));
        const observedPostorder = postorder.filter(id => startedIds.has(id));
        if (ends.length > observedPostorder.length) issues.add("END_POSTORDER_AMBIGUOUS");
        const byScript = new Map<string, typeof timings[number]>();
        for (const row of timings) { if (byScript.has(row.script)) issues.add("DUPLICATE_TIMING_COMMAND"); else byScript.set(row.script, row); }
        const completedPrefix = observedPostorder.slice(0, ends.length).map(id => preorder[id]!);
        const mappingUnambiguous = enabled && issues.size === 0 && starts.every(row => row.planId !== null) && ends.length === timings.length
          && byScript.size === timings.length && completedPrefix.length === ends.length
          && completedPrefix.every((row, index) => byScript.get(row.script)?.commandInclusiveWallMs === ends[index]!.npmCommandInclusiveWallMs)
          && timings.every(row => completedPrefix.some(invocation => invocation.script === row.script));
        if (!mappingUnambiguous) issues.add("END_FILE_SEQUENCE_OR_DURATION_AMBIGUOUS");
        const reconciled = ends.map((end, index) => ({ ...end, planId: mappingUnambiguous ? completedPrefix[index]!.id : null,
          script: mappingUnambiguous ? completedPrefix[index]!.script : null, timingFileMatched: mappingUnambiguous }));
        const complete = enabled && facts.code === 0 && facts.reason === null && starts.length === preorder.length && ends.length === preorder.length && timings.length === preorder.length;
        if (!complete) issues.add("INCOMPLETE_OR_INTERRUPTED_NPM_OBSERVATIONS");
        const status = complete && issues.size === 0 ? "COMPLETE_DIAGNOSTIC_ONLY" as const : "PARTIAL_DIAGNOSTIC_ONLY" as const;
        const readParseMs = performance.now() - readStarted, receiptFile = `public-${name}.npm-timing.json`;
        const value = { schema: 1, status, enabled, gate: "verify:admin-runtime", childArgv: invocationArgv, childArgvSha256: digest(JSON.stringify(invocationArgv)),
          source: { packageFile, packageSha256: digest(packageBytes), sourceDirectory, invocationPreorder: preorder, invocationPostorder: postorder, nodeLeaves: nodeLeaves ?? null }, runtime,
          child: { code: facts.code, reason: facts.reason, nativeJobIdentity: facts.nativeJobIdentity, nativeJobReceipt: facts.nativeJobReceipt,
            cleanup: facts.cleanup ?? null, rawFiles: closedFiles, stdout: { file: stdoutPath, sha256: facts.stdout === null ? null : digest(facts.stdout) }, stderr: { file: stderrPath, sha256: facts.stderr === null ? null : digest(facts.stderr) } },
          observations: { starts, ends: reconciled, mappingUnambiguous, unobservedOrUnfinished: preorder.filter(row => !reconciled.some(end => end.planId === row.id && end.timingFileMatched)).map(row => ({ id: row.id, script: row.script, startObserved: startedIds.has(row.id), endAttribution: "UNKNOWN" })),
            futureUnstartedBranchesPrunedOnlyForNonzero: facts.reason === "nonzero_exit" && mappingUnambiguous,
            clockPolicy: "Delivery timestamps only; wall-minus-monotonic is recorded without a tolerance or clock-accuracy claim. Cross-pipe order never defines a stack." },
          rawTimingDirectory: enabled ? directory : null, files, timings, issues: [...issues], nominalLimitMs: limitMs,
          rawMembership: { memberCount: rawMemberCount, sortedNamesSha256: rawNamesSha256, hashedOrdinaryFiles: files.length,
            allMemberBytesHashed: rawMemberCount !== null && rawMemberCount === files.length,
            incompleteRawMetadataNeverQualifies: true, rawFilesRetainedInOwnedDirectory: true },
          clockOrigins: { ownerInvocationMonotonicMs: started, ownerTimeoutReferenceMonotonicMs, wallComparisonOriginMonotonicMs: clockOriginMonotonicMs,
            wallComparisonOriginUtcMs: startedWall, nominalRemainingIsExactNativeRemaining: false,
            boundary: "Owner timeout reference is captured immediately before its existing setTimeout. Invocation setup, Native root creation/duration and cleanup have separate origins." },
          overhead: { setupMs, observerMs, readParseMs, observerCalls, observedCharacters, carryLimitCharacters: 4096, droppedNonCandidateLines: droppedLines, maximumEventsPerStream: preorder.length,
            serializationAndWriteMs: "Measured after receipt completion in the returned timingEvidence reference", npmChildTimingEffect: "UNKNOWN_UNTIL_BOUNDED_PROBE" },
          attribution: { npmTimers: "Date.now inclusive wall durations; nested durations must not be summed as CPU or total elapsed time", cpu: "UNKNOWN", io: "UNKNOWN", wait: "UNKNOWN", historicalTimeoutCause: "UNKNOWN" },
          qualificationGranted: false, nativePassGranted: false, gatePassGranted: false, releaseEvidence: false };
        const serializationStart = performance.now(), text = JSON.stringify(value, null, 2) + "\n", serializationMs = performance.now() - serializationStart;
        assert.equal(context.sanitize(text), text, "Npm diagnostic receipt contains a generated credential.");
        const writeStart = performance.now(); writeFileSync(ownedPath(context, receiptFile), text, { flag: "wx", mode: 0o600 }); const writeMs = performance.now() - writeStart;
        if (captureFailure !== undefined) throw captureFailure;
        return { file: receiptFile, sha256: digest(text), status, overhead: { setupMs, observerMs, readParseMs, serializationMs, writeMs } };
      };
      return { environment: enabled ? { npm_config_timing: "true", npm_config_logs_dir: directory, npm_config_logs_max: "0" } : {}, observe, finish,
        beginDeadline: () => { ownerTimeoutReferenceMonotonicMs = performance.now(); } };
    })();
    const invocationEnvironment = gate57Timing ? { ...env, ...gate57Timing.environment } : env;
    if (process.platform === "linux") {
      assert.equal(typeof process.getuid, "function", "Owned Linux cleanup needs current-user process identity.");
      assert.ok(readFileSync("/proc/self/stat", "utf8").length > 0 && lstatSync("/proc").isDirectory(), "Owned Linux cleanup needs inspectable procfs.");
    }
    // This nonsecret marker is inherited by the reviewed Playwright fixture, including its detached Chromium groups.
    // Linux discovery never retains environment contents and excludes every process older than this owned root.
    const markerKey = "VENESIA_QA_OWNED_CHILD", marker = globalThis.crypto.randomUUID();
    const spawnedAtUtc = new Date().toISOString();
    const windows = process.platform === "win32" ? spawnWindowsOwnedProcess({ args, cwd: sourceDirectory, env: { ...invocationEnvironment, [markerKey]: marker },
      identityPath: ownedPath(context, `public-${name}.native-identity.json`), receiptPath: ownedPath(context, `public-${name}.native-result.json`), limitMs }) : undefined;
    const child = windows?.child ?? spawn(process.execPath, args, { cwd: sourceDirectory, env: { ...invocationEnvironment, [markerKey]: marker },
      detached: process.platform === "linux", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child); let stdout = "", stderr = "", failed = false;
    let processFailure: Error | undefined;
    type Cleanup = Awaited<ReturnType<typeof stopChild>>;
    let cleanupPromise: Promise<Cleanup> | undefined;
    let failureReason: "timeout" | "cancelled" | "output_limit" | "process_failure" | undefined;
    if (process.platform === "linux" && child.pid) {
      try {
      type Identity = { pid: number; ppid: number; group: number; start: string; state: string };
      const readIdentity = (pid: number): Identity | undefined => {
        try {
          const raw = readFileSync(`/proc/${pid}/stat`, "utf8"), fields = raw.slice(raw.lastIndexOf(")") + 2).trim().split(/\s+/u);
          assert.ok(fields.length > 19 && /^\d+$/u.test(fields[19]!), "Owned Linux process identity is malformed.");
          return { pid, state: fields[0]!, ppid: Number(fields[1]), group: Number(fields[2]), start: fields[19]! };
        } catch (error) {
          if (["ENOENT", "ESRCH"].includes(String((error as NodeJS.ErrnoException).code))) return undefined;
          throw new Error("Owned Linux process identity cannot be inspected.");
        }
      };
      const rootIdentity = readIdentity(child.pid), observed = new Map<number, Identity>();
      if (rootIdentity) observed.set(rootIdentity.pid, rootIdentity);
      const live = (identity: Identity) => !["Z", "X", "x"].includes(identity.state);
      const snapshot = (): Identity[] => {
        assert.ok(rootIdentity, "Owned Linux root identity was not captured; cleanup is unverified.");
        const inspectionDeadline = performance.now() + 1_000;
        const names = readdirSync("/proc").filter(value => /^\d+$/u.test(value));
        assert.ok(names.length <= 32_768, "Owned Linux process discovery exceeded its bound.");
        const current = new Map<number, Identity>();
        for (const value of names) {
          assert.ok(performance.now() < inspectionDeadline, "Owned Linux process identity discovery exceeded its time bound.");
          const pid = Number(value), identity = readIdentity(pid);
          if (!identity || BigInt(identity.start) < BigInt(rootIdentity.start)) continue;
          try {
            if (lstatSync(`/proc/${pid}`).uid !== process.getuid!()) {
              const prior = observed.get(pid);
              assert.ok((!prior || prior.start !== identity.start) && identity.group !== rootIdentity.pid, "Owned Linux process changed its user identity.");
              continue;
            }
          }
          catch (error) { if (["ENOENT", "ESRCH"].includes(String((error as NodeJS.ErrnoException).code))) continue; throw error; }
          current.set(pid, identity);
        }
        const owned = new Map<number, Identity>();
        for (const identity of current.values()) {
          assert.ok(performance.now() < inspectionDeadline, "Owned Linux process marker discovery exceeded its time bound.");
          const prior = observed.get(identity.pid);
          if ((prior && prior.start === identity.start) || identity.group === rootIdentity.pid) { owned.set(identity.pid, identity); continue; }
          try {
            const environment = readFileSync(`/proc/${identity.pid}/environ`);
            assert.ok(environment.length <= 262_144, "Owned Linux process marker inspection exceeded its byte bound.");
            const entry = Buffer.from(`${markerKey}=${marker}\0`);
            // Compare only the inherited marker. No original environment values enter state, errors, logs or receipts.
            if (environment.subarray(0, entry.length).equals(entry) || environment.includes(Buffer.from(`\0${markerKey}=${marker}\0`))) owned.set(identity.pid, identity);
          } catch (error) {
            if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes(String((error as NodeJS.ErrnoException).code))) throw new Error("Owned Linux marker discovery failed.");
          }
        }
        for (let changed = true; changed;) {
          changed = false;
          for (const identity of current.values()) if (!owned.has(identity.pid) && owned.has(identity.ppid)) { owned.set(identity.pid, identity); changed = true; }
        }
        for (const identity of owned.values()) observed.set(identity.pid, identity);
        return [...owned.values()].filter(live);
      };
      const send = (identity: Identity, requested: NodeJS.Signals) => {
        const current = readIdentity(identity.pid);
        if (!current || !live(current) || current.start !== identity.start) return;
        assert.notEqual(identity.pid, process.pid, "Owned cleanup cannot signal its owner.");
        try {
          assert.equal(lstatSync(`/proc/${identity.pid}`).uid, process.getuid!(), "Owned Linux process changed its user identity before signaling.");
          process.kill(identity.pid, requested);
        } catch (error) { if (!["ESRCH", "ENOENT"].includes(String((error as NodeJS.ErrnoException).code))) throw new Error("Owned Linux process signal failed."); }
      };
      let linuxCleanup: Promise<Cleanup> | undefined;
      const cleanupLinux = (): Promise<Cleanup> => linuxCleanup ??= (async () => {
        let remaining = snapshot(), forcedTermination = false;
        const residualProcessesAfterExit = child.exitCode !== null || child.signalCode !== null ? remaining.length : 0;
        if (remaining.length) {
          for (const identity of remaining) send(identity, "SIGTERM");
          const deadline = performance.now() + 1_500;
          while ((remaining = snapshot()).length && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 25));
        }
        if (remaining.length) {
          forcedTermination = true;
          const freezeDeadline = performance.now() + 3_000;
          for (;;) {
            for (const identity of remaining) send(identity, "SIGSTOP");
            await new Promise<void>(done => setTimeout(done, 25));
            remaining = snapshot();
            if (remaining.every(identity => identity.state === "T" || identity.state === "t")) break;
            assert.ok(performance.now() < freezeDeadline, "Owned Linux process tree could not be frozen.");
          }
          // Frozen parents cannot create a new detached descendant between discovery and the final identity-checked signal.
          for (const identity of remaining.sort((a, b) => Number(a.pid === rootIdentity!.pid) - Number(b.pid === rootIdentity!.pid))) send(identity, "SIGKILL");
          const deadline = performance.now() + 5_000;
          while ((remaining = snapshot()).length && performance.now() < deadline) await new Promise<void>(done => setTimeout(done, 25));
        }
        assert.equal(remaining.length, 0, "Owned Linux process tree is still live.");
        return { status: "PASS" as const, platform: process.platform, method: "linux-marker-and-process-identity", processTreeVerified: true,
          forcedTermination, observedProcesses: observed.size, liveProcesses: 0, residualProcessesAfterExit };
      })();
      Object.defineProperty(child, "verificationLinuxCleanup", { value: cleanupLinux });
      } catch (error) {
        // Keep admission/error listeners active even when procfs changes after the preflight. Unknown ownership is never a PASS.
        const failure = new Error("Owned Linux process cleanup identity could not be established.", { cause: error });
        Object.defineProperty(child, "verificationLinuxCleanup", { value: () => Promise.reject(failure) });
      }
    }
    const abort = (reason: "timeout" | "cancelled" | "output_limit") => {
      if (failed) return;
      failed = true; failureReason = reason;
      cleanupPromise = stopChild(child, context.cleanEnvironment(), reason);
      // The close handler retains the original failure and writes the final cleanup/evidence result before settling.
      void cleanupPromise.catch(error => { void settle(child.exitCode, error).catch(reject); });
    };
    const abortSignal = () => abort("cancelled");
    signal.addEventListener("abort", abortSignal, { once: true });
    gate57Timing?.beginDeadline();
    const timeout = setTimeout(() => abort("timeout"), limitMs);
    child.stdout.on("data", value => { const chunk = String(value); stdout += chunk; gate57Timing?.observe("stdout", chunk); if (stdout.length > 8_000_000) abort("output_limit"); });
    child.stderr.on("data", value => { const chunk = String(value); stderr += chunk; gate57Timing?.observe("stderr", chunk); if (stderr.length > 8_000_000) abort("output_limit"); });
    child.once("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout); signal.removeEventListener("abort", abortSignal);
      const code = typeof error.code === "string" && /^[A-Z0-9_]+$/u.test(error.code) ? error.code : null;
      failureReason ??= "process_failure"; processFailure = new Error(`Public ${name} process failed.`, { cause: { code } });
    });
    let settling = false;
    const settle = async (code: number | null, knownCleanupFailure?: unknown) => {
      if (settling) return; settling = true;
      clearTimeout(timeout); signal.removeEventListener("abort", abortSignal);
      let cleanup: Cleanup | undefined, cleanupFailure: unknown = knownCleanupFailure;
      try { cleanup = await (cleanupPromise ?? stopChild(child, context.cleanEnvironment())); children.delete(child); }
      catch (error) { cleanupFailure = error; }
      let nativeJobIdentity: WindowsJobIdentity | null = null, nativeJobReceipt: WindowsJobReceipt | null = null;
      try { nativeJobIdentity = windows?.readIdentity() ?? null; nativeJobReceipt = windows?.readReceipt() ?? null; }
      catch (error) { cleanupFailure ??= error; }
      if (windows && nativeJobReceipt && nativeJobReceipt.reason !== "completed") {
        failed = true;
        failureReason ??= nativeJobReceipt.reason === "timeout" ? "timeout"
          : ["cancelled", "owner_lost", "owner_shutdown"].includes(nativeJobReceipt.reason) ? "cancelled"
          : nativeJobReceipt.reason === "output_limit" ? "output_limit" : "process_failure";
      }
      const rootCode = windows ? nativeJobReceipt?.rootExitCode ?? null : code;
      const rootSignal = windows ? null : child.signalCode;
      const identity = windows ? { pid: nativeJobIdentity?.rootPid ?? null, ppid: nativeJobIdentity?.rootPpid ?? child.pid ?? process.pid,
        spawnedAtUtc: nativeJobIdentity?.rootCreationTimeUtc ?? spawnedAtUtc } : { pid: child.pid ?? null, ppid: process.pid, spawnedAtUtc };
      const nativeProof = windows ? { nativeJobIdentity, nativeJobReceipt, nativeCapability: windows.native, helperIdentity: { pid: child.pid ?? null, ppid: process.pid },
        helperExit: { code, signal: child.signalCode } } : {};
      let cleanOutput: string | null = null, cleanErrors: string | null = null, evidenceFailure: unknown;
      try {
        cleanOutput = context.sanitize(stdout.replaceAll(marker, "[REDACTED_CHILD_OWNERSHIP]"));
        cleanErrors = context.sanitize(stderr.replaceAll(marker, "[REDACTED_CHILD_OWNERSHIP]"));
        writeFileSync(stdoutPath, cleanOutput, { mode: 0o600, flag: "wx" });
        writeFileSync(stderrPath, cleanErrors, { mode: 0o600, flag: "wx" });
      } catch (error) { evidenceFailure = error; }
      let timingEvidence: ReturnType<NonNullable<typeof gate57Timing>["finish"]> | undefined;
      try { timingEvidence = gate57Timing?.finish({ code: rootCode, reason: failureReason ?? (rootCode ? "nonzero_exit" : null), stdout: cleanOutput,
        stderr: cleanErrors, cleanup, nativeJobIdentity, nativeJobReceipt }); }
      catch (error) {
        if (evidenceFailure === undefined) evidenceFailure = error;
        else if (evidenceFailure instanceof Error && Object.isExtensible(evidenceFailure) && !Object.hasOwn(evidenceFailure, "timingEvidenceFailure"))
          Object.defineProperty(evidenceFailure, "timingEvidenceFailure", { value: error });
        if (cleanupFailure instanceof Error && Object.isExtensible(cleanupFailure) && !Object.hasOwn(cleanupFailure, "timingEvidenceFailure"))
          Object.defineProperty(cleanupFailure, "timingEvidenceFailure", { value: error });
      }
      // Keep bounded cleanup facts even when the original native/FS Error has no cause.
      // The exact Error remains private on the rejection; never project its message/stack.
      const cleanupError = cleanupFailure instanceof Error ? cleanupFailure : undefined;
      const cleanupCause = cleanupError && Object.getOwnPropertyDescriptor(cleanupError, "cause")?.value;
      const cleanupData = (value: unknown, key: string): unknown => value !== null && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
      const cleanupCode = cleanupData(cleanupError, "code") ?? cleanupData(cleanupCause, "code");
      const cleanupExit = cleanupData(cleanupCause, "exitCode");
      const childResult = { code: rootCode ?? null, signal: rootSignal,
        identity, ...nativeProof, ...(timingEvidence ? { timingEvidence } : {}), durationMs: performance.now() - started,
        reason: failureReason ?? (rootCode ? "nonzero_exit" : null), stdout: cleanOutput, stderr: cleanErrors,
        cleanup: cleanup ?? { status: "FAIL" as const, platform: process.platform, method: "owned-child-cleanup", processTreeVerified: false,
          forcedTermination: null, observedProcesses: null, liveProcesses: null, residualProcessesAfterExit: null },
        cleanupFailure: cleanupError ? {
          stage: "owned-child-cleanup", name: cleanupError instanceof assert.AssertionError ? "AssertionError"
            : cleanupError instanceof TypeError ? "TypeError" : cleanupError instanceof SyntaxError ? "SyntaxError"
              : cleanupError instanceof RangeError ? "RangeError" : "Error",
          code: typeof cleanupCode === "string" && /^[A-Z0-9_]{1,64}$/u.test(cleanupCode) ? cleanupCode : null,
          exitCode: typeof cleanupExit === "number" && Number.isFinite(cleanupExit) ? cleanupExit : null,
          nativeReceipt: windows ? nativeJobReceipt ? "present" : "unavailable" : "not-applicable",
        } : null,
        evidence: { stdout: `public-${name}.stdout.log`, stderr: `public-${name}.stderr.log`, sanitized: cleanOutput !== null && cleanErrors !== null } };
      const error = failed ? new Error(`Public ${name} was aborted or exceeded its bound.`, { cause: cleanupFailure ?? evidenceFailure })
        : processFailure ?? (cleanupFailure ? new Error(`Public ${name} cleanup failed.`, { cause: cleanupFailure }) : evidenceFailure);
      if (error) { if (error instanceof Error) Object.defineProperty(error, "childResult", { value: childResult, enumerable: true }); reject(error); }
      else { assert.ok(cleanup && cleanOutput !== null && cleanErrors !== null); done({ code: rootCode ?? -1, rawExit: { code: rootCode, signal: rootSignal },
        identity: childResult.identity, ...nativeProof, ...(timingEvidence ? { timingEvidence } : {}), stdout: cleanOutput, stderr: cleanErrors, durationMs: childResult.durationMs, cleanup }); }
    };
    child.once("close", code => { void settle(code).catch(reject); });
  });
}

/** Owner capability prerequisite only; it never replaces the actual caller-context process probe. */
export function ownedProcessCleanupQualification() {
  const rootExitQualified = process.platform === "linux" || (process.platform === "win32" && windowsOwnedProcessCapability().status === "PASS");
  return { status: rootExitQualified ? "PASS" as const : "BLOCKED" as const,
    missingProof: rootExitQualified ? null : process.platform === "win32"
      ? "windows_native_job_launch_unavailable" : "unsupported_process_cleanup_platform",
    fullEProcessCleanupQualified: rootExitQualified };
}

/** Qualify this execution context with a real, disposable owned tree before Docker allocation. */
export async function verifyOwnedProcessReadiness(options: {
  sourceDirectory: string;
  context: Pick<PrivatePublicVerificationContext, "runDirectory" | "sanitize" | "cleanEnvironment">;
  signal: AbortSignal;
}) {
  const started = performance.now(), { context, signal, sourceDirectory } = options;
  signal.throwIfAborted();
  assert.ok(process.platform === "win32" || process.platform === "linux", "Owned process readiness is unqualified on this platform.");
  const controller = new AbortController(), children = new Set<ChildProcess>();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  // Both identities are reported by their actual child processes. No foreign process is selected or signaled.
  const expiresAt = Date.now() + 12_000;
  const leaf = `setTimeout(()=>process.exit(0),Math.max(1,${expiresAt}-Date.now()));process.stdout.write(JSON.stringify({pid:process.pid,ppid:process.ppid})+'\\n');setInterval(()=>{},1000);`;
  const root = `setTimeout(()=>process.exit(0),Math.max(1,${expiresAt}-Date.now()));const {spawn}=require('node:child_process');const leaf=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{env:process.env,detached:process.platform==='linux',windowsHide:true,stdio:['ignore','pipe','pipe']});leaf.stdout.once('data',data=>process.stdout.write(JSON.stringify({root:{pid:process.pid,ppid:process.ppid},leaf:JSON.parse(String(data))})+'\\n'));setInterval(()=>{},1000);`;
  const knownPids = new Set<number>();
  const alive = (pid: number) => {
    if (process.platform === "linux") {
      try { const raw = readFileSync(`/proc/${pid}/stat`, "utf8"); return !["Z", "X", "x"].includes(raw.slice(raw.lastIndexOf(")") + 2).split(" ")[0]!); }
      catch (error) { if (["ENOENT", "ESRCH"].includes(String((error as NodeJS.ErrnoException).code))) return false; throw error; }
    }
    try { process.kill(pid, 0); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
      if ((error as NodeJS.ErrnoException).code === "EPERM") return true; throw error; }
  };
  const pending = runOwnedVerificationChild({ sourceDirectory, context, children, signal: controller.signal }, ["-e", root], context.cleanEnvironment(), "process-readiness", 10_000);
  const outcome = pending.then(value => ({ value, error: undefined }), (error: unknown) => ({ value: undefined, error }));
  try {
    const child = [...children][0]; assert.ok(child?.stdout, "Owned process readiness did not start its child.");
    if (child.pid) knownPids.add(child.pid);
    const identities = await new Promise<{ root: { pid: number; ppid: number }; leaf: { pid: number; ppid: number } }>((done, reject) => {
      let output = "";
      const finish = (error?: Error) => {
        clearTimeout(timer); child.stdout!.off("data", data); child.off("close", closed);
        controller.signal.removeEventListener("abort", aborted); if (error) reject(error);
      };
      const data = (value: Buffer) => {
        output += String(value);
        if (output.length > 4_096) return finish(new Error("Owned process readiness identity output exceeded its bound."));
        if (!output.includes("\n")) return;
        try { const row = JSON.parse(output.split("\n")[0]!); finish(); done(row); }
        catch { finish(new Error("Owned process readiness identity output is invalid.")); }
      };
      const closed = () => finish(new Error("Owned process readiness exited before its tree was observed."));
      const aborted = () => finish(new Error("Owned process readiness was cancelled before observation."));
      const timer = setTimeout(() => finish(new Error("Owned process readiness observation exceeded its bound.")), 8_000);
      child.stdout!.on("data", data); child.once("close", closed); controller.signal.addEventListener("abort", aborted, { once: true });
      if (controller.signal.aborted) aborted();
    });
    const nativeIdentity = (child as ChildProcess & { verificationWindowsIdentity?: () => WindowsJobIdentity | null }).verificationWindowsIdentity?.();
    assert.equal(identities.root.pid, nativeIdentity?.rootPid ?? child.pid); assert.equal(identities.root.ppid, nativeIdentity?.rootPpid ?? process.pid);
    assert.ok(Number.isSafeInteger(identities.leaf.pid) && identities.leaf.pid > 1 && identities.leaf.pid !== identities.root.pid);
    assert.equal(identities.leaf.ppid, identities.root.pid);
    knownPids.add(identities.leaf.pid);
    signal.throwIfAborted(); controller.abort(new Error("Controlled owned process readiness cancellation."));
    const result = await outcome;
    assert.ok(result.error instanceof Error, "Owned process readiness must observe cancellation, not a passing command.");
    const retained = (result.error as Error & { childResult?: { code: number | null; signal: NodeJS.Signals | null; reason: string;
      cleanup: Awaited<ReturnType<typeof stopChild>> } }).childResult;
    assert.ok(retained && retained.reason === "cancelled" && retained.cleanup.status === "PASS" && retained.cleanup.processTreeVerified,
      "Owned process readiness did not prove live-tree termination in this execution context.");
    for (const pid of knownPids) assert.equal(alive(pid), false, "Owned process readiness left a known owned process live.");
    assert.equal(children.size, 0, "Owned process readiness retained an undrained child registration.");
    const cleanupQualification = ownedProcessCleanupQualification();
    const readinessReceipt = { status: "PASS" as const, platform: process.platform, scope: "self-owned-live-tree-cancellation" as const,
      durationMs: performance.now() - started, rootIdentity: identities.root, descendantIdentity: identities.leaf,
      rawExit: { code: retained.code, signal: retained.signal }, cleanup: retained.cleanup,
      cleanupQualification: { ...cleanupQualification, liveRootTreeProved: true,
        rootExitTreeSupported: cleanupQualification.fullEProcessCleanupQualified },
      limitations: process.platform === "win32" ? ["Task-private native Job contains cooperative CreateProcess descendants; broker/service-created processes are outside this qualification."]
        : ["Detached descendants that clear the inherited ownership marker remain outside qualification."] };
    receipt(context, "process-readiness.json", readinessReceipt); return readinessReceipt;
  } catch (error) {
    if (!controller.signal.aborted) controller.abort(new Error("Owned process readiness failure cleanup."));
    const finished = await outcome;
    // This diagnostic tree has its own finite expiry. A denied tree-kill remains BLOCKED;
    // wait for the known identities to disappear without selecting any foreign PID for termination.
    const fallbackDeadline = performance.now() + 14_000;
    while ([...knownPids].some(alive) && performance.now() < fallbackDeadline) await new Promise<void>(done => setTimeout(done, 50));
    const knownOwnedProcessesAbsent = [...knownPids].every(pid => !alive(pid));
    const retained = finished.error instanceof Error ? (finished.error as Error & { childResult?: {
      code: number | null; signal: NodeJS.Signals | null; identity: unknown; reason: unknown; cleanup: unknown; cleanupFailure: unknown; evidence: unknown;
    } }).childResult : undefined;
    const startupFailure = !retained && finished.error instanceof Error ? finished.error : undefined;
    // A failure before registration has no childResult. Retain that original
    // error without letting the secondary "no child" observation erase it.
    if (error instanceof Error && startupFailure && error !== startupFailure) {
      if (error.cause === undefined) Object.defineProperty(error, "cause", { value: startupFailure });
      else Object.defineProperty(error, "startupFailure", { value: startupFailure });
    }
    if (!existsSync(ownedPath(context, "process-readiness.json"))) receipt(context, "process-readiness.json", {
      status: "BLOCKED", platform: process.platform, scope: "self-owned-live-tree-cancellation", durationMs: performance.now() - started,
      rawExit: retained ? { code: retained.code, signal: retained.signal } : null, identity: retained?.identity ?? null,
      reason: retained?.reason ?? "readiness_unproved", cleanup: retained?.cleanup ?? null, evidence: retained?.evidence ?? null,
      cleanupFailure: retained?.cleanupFailure ?? null,
      startupFailure: startupFailure ? { name: ["Error", "ReferenceError", "TypeError", "AssertionError"].includes(startupFailure.name) ? startupFailure.name : "Error",
        code: "code" in startupFailure && typeof startupFailure.code === "string" && /^[A-Z0-9_]{1,64}$/u.test(startupFailure.code) ? startupFailure.code : null } : null,
      finiteSelfExpiryMs: 12_000, knownOwnedProcessesAbsent, knownIdentities: knownPids.size,
    });
    if (error instanceof Error && retained) Object.defineProperty(error, "childResult", { value: retained, enumerable: true });
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!controller.signal.aborted) controller.abort(new Error("Owned process readiness final cleanup."));
    await outcome;
  }
}

export async function runOwnedPublicVerification(context: PrivatePublicVerificationContext, request: PublicGateRequest, signal: AbortSignal, drainControlPulse: (phase?: "archive-preservation") => Promise<void>) {
  assert.ok(request.admissionQualification, "Public execution requires fresh live source qualification before dependency staging or Build; conservative Full Gate fallback remains required.");
  const preallocationAdmission = localVerificationAdmissionInvocations.get(request.admissionQualification);
  assert.ok(preallocationAdmission, "Public execution requires this owner's live source qualification; serialized or old receipts cannot authorize it.");
  assert.equal(request.admissionQualification.status, "PASS");
  assert.equal(digest(JSON.stringify(request.admissionQualification)), preallocationAdmission.sha256, "Admission receipt was altered after qualification.");
  const operationalBudget = request.admissionQualification.operationalBudget;
  localVerificationOperationalDeadlineMs(1, operationalBudget);
  if (operationalBudget !== undefined) {
    assert.equal(request.selection, "admin-adoption", "Temporary PR #229 budget requires the complete Public/Admin release path.");
    assert.equal(request.adoptionScope, undefined); assert.equal(request.adoptionCohort, undefined);
    assert.equal(request.adoptionJourneySelection, undefined); assert.equal(request.adminMeasurement, undefined);
  }
  assert.equal(digest(JSON.stringify(preallocationAdmission.sourceFloor)), preallocationAdmission.sourceFloorSha256, "Private ordered source floor was altered after qualification.");
  if (request.localVerification && request.finalQualityGate === true)
    assert.ok(request.admissionQualification,
      "Final Quality source admission requires this owner's preallocation live qualification before an active database control connection.");
  if (request.finalQualityGate && !ownedProcessCleanupQualification().fullEProcessCleanupQualified) {
    const failure = new Error("Final quality requires qualified owned descendant cleanup after root exit.");
    Object.defineProperty(failure, "code", { value: "FINAL_QUALITY_PROCESS_CLEANUP_UNQUALIFIED" });
    throw failure;
  }
  await context.assertOwned();
  const localImpact = request.localVerification;
  if (localImpact !== undefined) assert.ok(localImpact && typeof localImpact === "object", "Invalid local verification impact record.");
  const localImpactSha256 = localImpact ? digest(JSON.stringify(localImpact)) : undefined;
  const readiness = prepared.get(context); assert.ok(readiness, "Public fixture readiness must precede gates.");
  assert.ok(request.selection === undefined || request.selection === "build-contracts" || request.selection === "admin-interactions" || request.selection === "admin-adoption" || request.selection === "media-upload-limit" || request.selection === "hero-compatibility", "Unknown fixed Public gate selection.");
  const measurement = request.selection === "admin-interactions" ? request.adminMeasurement : undefined;
  assert.equal(Boolean(request.adminMeasurement), Boolean(measurement));
  const adoption = request.selection === "admin-adoption";
  const mediaUpload = request.selection === "media-upload-limit";
  const heroCompatibility = request.selection === "hero-compatibility";
  if (request.heroCompatibilityFinalHead !== undefined) {
    assert.ok(heroCompatibility && request.finalQualityGate === true);
    assert.match(request.heroCompatibilityFinalHead, /^[a-f0-9]{40}$/u);
    assert.equal(await gitHead(context), request.heroCompatibilityFinalHead, "Hero Final Quality must run on the explicitly selected final HEAD.");
  }
  if (heroCompatibility && request.finalQualityGate) assert.ok(request.heroCompatibilityFinalHead);
  const retainedQuality = request.retainedAdminBehaviorAdmissionSha256 !== undefined;
  if (retainedQuality) {
    assert.equal(request.finalQualityGate, true); assert.equal(request.selection, undefined);
    assert.equal(request.adoptionScope, undefined); assert.equal(request.adoptionCohort, undefined);
    assert.equal(request.adoptionJourneySelection, undefined); assert.equal(request.adminMeasurement, undefined);
    assert.deepEqual(request.additionalSourceFiles, []);
    assert.match(request.retainedAdminBehaviorAdmissionSha256!, /^[a-f0-9]{64}$/u);
  }
  adminAdoptionGate(request);
  assert.ok(request.finalQualityGate === undefined || (request.finalQualityGate === true && (adoption || retainedQuality || heroCompatibility)), "Final Quality Gate requires complete Admin adoption, retained Final27 admission, or the explicit Hero compatibility final HEAD.");
  const credentials = measurement || adoption || mediaUpload || heroCompatibility ? adminCredentials.get(context) : undefined;
  if (adoption || mediaUpload || heroCompatibility) assert.ok(credentials, "Owned Admin fixture preparation is required for adoption journeys.");
  const originalContext = context;
  let frozenDirectory: string | undefined;
  let frozenManifest: Array<{ file: string; sha256: string }> | undefined;
  let frozenProvenance: { acceptedBaselineHeadSha: string; measurementCorrection: string | null } | undefined;
  if (measurement) {
    assert.ok(credentials, "The canonical owned local Admin fixture must be prepared first.");
    assert.ok(measurement.study === undefined || measurement.study === "heavy-editor-performance", "Unknown fixed Admin study.");
    assert.ok(measurement.round === undefined || (measurement.round === "closure" && measurement.study === "heavy-editor-performance"), "Unknown fixed Admin study round.");
    const study = measurement.study ?? "legacy";
    const studyIdentity = measurement.round === "closure" ? "heavy-editor-closure" : study;
    const priorStudy = adminStudies.get(context);
    assert.ok(priorStudy === undefined || priorStudy === studyIdentity, "An owned Admin fixture cannot change studies or rounds between phases.");
    adminStudies.set(context, studyIdentity);
    assert.ok(measurement.phase === "before" || measurement.phase === "after");
    const phases = adminPhases.get(context) ?? new Set<string>();
    assert.equal(phases.has(measurement.phase), false, "A successful measurement phase is one-shot.");
    if (study === "heavy-editor-performance") {
      assert.equal(measurement.resumeAfterFromRuntime09, undefined, "The new study cannot reuse a legacy Before phase.");
      assert.equal(measurement.resumeFinalAfterFromRuntime11, undefined);
      assert.equal(measurement.resumeCorrectionAfterFromRuntime12, undefined);
      const studyBase = resolve(ROOT, measurement.round === "closure" ? ".tmp-qa/heavy-editor-closure-2026-09-18" : ".tmp-qa/heavy-editor-performance-excellence-2026-09-18");
      assert.equal(resolve(measurement.frozenSourceManifest), join(studyBase, measurement.phase === "before" ? "baseline-source-manifest.json" : "after-source-manifest.json"));
      assert.equal(resolve(measurement.controlDirectory), join(studyBase, "control"));
      if (measurement.phase === "after") assert.ok(phases.has("before"), "The new study requires its own completed Before phase on the same fixture.");
    }
    if(measurement.resumeAfterFromRuntime09)assert.equal(measurement.phase,"after");
    if(measurement.resumeCorrectionAfterFromRuntime12){
      assert.equal(measurement.phase,"after");assert.equal(measurement.resumeAfterFromRuntime09,true);assert.equal(measurement.resumeFinalAfterFromRuntime11,true);
      assert.equal(resolve(measurement.frozenSourceManifest),resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17/after-source-manifest-v5.json"));
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17/control-final-correction"));
      receipt(context,"admin-retained-after-runtime12.json",validateAcceptedAdminAfter12());
    }
    if(measurement.resumeFinalAfterFromRuntime11){
      assert.equal(measurement.phase,"after");assert.equal(measurement.resumeAfterFromRuntime09,true);
      assert.equal(resolve(measurement.frozenSourceManifest),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/after-source-manifest-${measurement.resumeCorrectionAfterFromRuntime12?"v5":"v4"}.json`));
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/${measurement.resumeCorrectionAfterFromRuntime12?"control-final-correction":"control-final-delta"}`));
      receipt(context,"admin-retained-after-runtime11.json",validateAcceptedAdminAfter11());
    }
    if(measurement.phase==="after"&&!phases.has("before")){
      assert.equal(measurement.resumeAfterFromRuntime09,true,"After requires a completed or explicitly retained Before cohort");
      const retained=validateAcceptedAdminBefore09();
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/${measurement.resumeCorrectionAfterFromRuntime12?"control-final-correction":measurement.resumeFinalAfterFromRuntime11?"control-final-delta":"control"}`));
      receipt(context,"admin-retained-before-runtime09.json",retained);
    }
    adminPhases.set(context, phases);
    const boundary = resolve(ROOT, study === "heavy-editor-performance"
      ? measurement.round === "closure" ? ".tmp-qa/heavy-editor-closure-2026-09-18" : ".tmp-qa/heavy-editor-performance-excellence-2026-09-18"
      : ".tmp-qa/admin-near-instant-continuation-2026-09-17") + sep;
    const manifestPath = resolve(measurement.frozenSourceManifest);
    assert.ok(manifestPath.startsWith(boundary) && realpathSync(manifestPath) === manifestPath && lstatSync(manifestPath).isFile());
    const frozen = JSON.parse(readFileSync(manifestPath, "utf8"));
    frozenDirectory = resolve(frozen.sourceDirectory);
    assert.ok(frozenDirectory.startsWith(boundary) && realpathSync(frozenDirectory) === frozenDirectory);
    frozenManifest = frozen.manifest.map((row: { file: string; sha256: string }) => ({ file: row.file, sha256: row.sha256 }));
    assert.ok(frozenManifest!.length > 100 && new Set(frozenManifest!.map(row => row.file)).size === frozenManifest!.length);
    for (const row of frozenManifest!) { safeSourcePath(row.file); assert.match(row.sha256, /^[a-f0-9]{64}$/u); }
    assert.match(frozen.acceptedHead, /^[a-f0-9]{40}$/u, "Frozen measurement lacks an immutable accepted baseline HEAD.");
    assert.equal(frozen.sourceSha256, digest(JSON.stringify(frozenManifest)), "Frozen measurement manifest checksum differs from its file inventory.");
    frozenProvenance = { acceptedBaselineHeadSha: frozen.acceptedHead,
      measurementCorrection: typeof frozen.measurementCorrection === "string" ? frozen.measurementCorrection : null };
    const control = resolve(measurement.controlDirectory);
    assert.ok(control.startsWith(boundary) && realpathSync(control) === control && lstatSync(control).isDirectory());
    const phaseDirectory = ownedPath(context, `admin-${measurement.phase}`);
    mkdirSync(phaseDirectory);
    const baseSanitize = context.sanitize;
    context = { ...context, runDirectory: phaseDirectory,
      sanitize: value => [credentials.username, credentials.password, credentials.secret].reduce((text, item) => text.replaceAll(item, "[REDACTED_LOCAL_ADMIN]"), baseSanitize(value)) };
  }
  if ((adoption || mediaUpload || heroCompatibility) && credentials) {
    const baseSanitize = context.sanitize;
    context = { ...context, sanitize: value => [credentials.username, credentials.password, credentials.secret]
      .reduce((text, item) => text.replaceAll(item, "[REDACTED_LOCAL_ADMIN]"), baseSanitize(value)) };
  }
  const heroGate = { name: "hero-compatibility", script: "scripts/fixtures/hero-compatibility-journey.mjs", args: [], limitMs: 600_000 };
  const gates = heroCompatibility ? [GATES[0], heroGate] : mediaUpload ? [GATES[0], { name: "media-upload-limit", script: "scripts/fixtures/media-upload-limit-journey.mjs", args: [], limitMs: 600_000 }] : adoption ? [...(request.adoptionCohort && !request.finalQualityGate ? GATES.filter(gate => gate.name !== "public-e2e") : GATES), adminAdoptionGate(request)!] : measurement ? [GATES[0], { name: "admin-interactions", script: "scripts/qa-admin-production-interactions.mjs", args: [], limitMs: measurement.study === "heavy-editor-performance" ? 21_600_000 : 7_200_000 }] : request.selection === "build-contracts"
    ? GATES.filter(gate => gate.name !== "public-e2e") : GATES;
  assert.equal(gates.length, heroCompatibility ? 2 : mediaUpload ? 2 : adoption ? (request.adoptionCohort && !request.finalQualityGate ? 4 : 5) : measurement ? 2 : request.selection === "build-contracts" ? 3 : 4);
  assert.equal(completed.has(originalContext), false, "Successful selected gates cannot be rerun in this fixture.");
  const sourceDirectory = ownedPath(context, "public-build-source");
  assert.equal(existsSync(sourceDirectory), false, "Preserve any prior build workspace.");
  const files = frozenManifest?.map(row => row.file) ?? await gitSourceInventory(context, request);
  const sourcePath = (file: string) => frozenDirectory ? join(frozenDirectory, file) : safeSourcePath(file);
  const manifest = files.map(file => {
    const original = sourcePath(file);
    assert.ok(lstatSync(original).isFile());
    assert.equal(realpathSync(original), original, "Public source must not traverse a symlink or junction.");
    const sha256 = digest(readFileSync(original));
    if (frozenManifest) assert.equal(sha256, frozenManifest.find(row => row.file === file)!.sha256);
    return { file, sha256 };
  });
  const localInputs = localImpact ? readLocalVerificationInputs(context, localImpact, manifest, request.additionalSourceFiles, request) : undefined;
  const localPlan = localImpact ? planLocalVerification(JSON.parse(readFileSync(sourcePath("package.json"), "utf8")).scripts, localImpact, localInputs!, request) : undefined;
  if (localPlan) assertLocalVerificationRequest(request, localPlan);
  const sourceConfig = manifest.find(row => row.file === "next.config.ts");
  assert.ok(sourceConfig, "The isolated image environment must derive from the canonical Product config.");
  assert.equal(manifest.some(row => /^next\.config\.(?:js|mjs|mts|cts)$/u.test(row.file)), false,
    "An additional Next config could shadow the isolated build configuration.");
  const imageConfigSource = isolatedPublicImageConfigSource(context.apiPort, sourceConfig.sha256);
  const imageConfig = { file: "next.config.mjs", sha256: digest(imageConfigSource), sourceConfig,
    apiOrigin: `http://127.0.0.1:${context.apiPort}`, pathname: "/storage/v1/object/public/cms-images/**",
    search: "", dangerouslyAllowLocalIP: true, maximumRedirects: 0, productConfigUnchanged: true };
  mkdirSync(sourceDirectory);
  const childEnvironment: NodeJS.ProcessEnv = { ...context.cleanEnvironment(), CI: "1", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${context.apiPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: context.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: context.serviceKey,
    ...(credentials ? { ADMIN_SESSION_SECRET: credentials.secret, ADMIN_SESSION_COOKIE_SECURE: "false" } : {}) };
  const children = new Set<ChildProcess>();
  let appPort: number | null = null;
  let appFailed = false;
  type NativeApplication = { child: ChildProcess; name: string; windows: ReturnType<typeof spawnWindowsOwnedProcess>;
    stopping: boolean; closed: Promise<void>; failure?: unknown; logFailure?: unknown; stop?: Promise<void> };
  const nativeApplications = new Map<ChildProcess, NativeApplication>();
  const stopNativeApplication = (state: NativeApplication) => state.stop ??= (async () => {
    // Mark intent before requesting closure, but the original native reason still decides whether the root exited unexpectedly.
    state.stopping = true;
    let cleanupFailure: unknown;
    try {
      const cleanup = await stopChild(state.child, context.cleanEnvironment());
      await state.closed;
      const identity = state.windows.readIdentity(), terminal = state.windows.readReceipt();
      assert.ok(identity && terminal, "Owned application native identity and terminal evidence are required.");
      assert.equal(terminal.reason, "owner_shutdown", "Owned application exited before its intentional shutdown.");
      receipt(context, `public-${state.name}-server-lifecycle.json`, { status: "PASS", intentionalStop: true,
        nativeJobIdentity: identity, nativeJobReceipt: terminal, helperExit: { code: state.child.exitCode, signal: state.child.signalCode }, cleanup });
    } catch (error) { cleanupFailure = error; }
    const failure = state.failure ?? state.logFailure ?? cleanupFailure;
    if (failure !== undefined) {
      if (failure instanceof Error && cleanupFailure !== undefined && failure !== cleanupFailure && Object.isExtensible(failure)
        && !Object.hasOwn(failure, "applicationCleanupFailure")) Object.defineProperty(failure, "applicationCleanupFailure", { value: cleanupFailure });
      throw failure;
    }
  })();
  let publicFailed = false, publicFailure: unknown;
  const reports: Array<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  const qualityReports: Array<{ script: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  let buildIdSha256: string | null = null;
  let retainedAdmission: Awaited<ReturnType<typeof loadRetainedFinalQualityAdmissionAsync>> | undefined;
  const downloadFixture = adoption && (request.adoptionCohort === undefined || ["template-controls", "navigation-settings"].includes(request.adoptionCohort)) ? createCoreDownloadPdfFixture() : null;
  const verifySource = () => {
    if (localImpact) {
      assert.equal(digest(JSON.stringify(request.localVerification)), localImpactSha256, "Reviewed risk evidence changed during verification.");
      assert.deepEqual(readLocalVerificationInputs(context, localImpact, manifest, request.additionalSourceFiles, request, localInputs), localInputs,
        "Risk evidence no longer matches the actual Git/source delta.");
    }
    if (downloadFixture) assert.equal(digest(readFileSync(join(sourceDirectory, "public", CORE_DOWNLOAD_MEDIA_KEY))), digest(downloadFixture));
    for (const row of manifest) { assert.equal(digest(readFileSync(sourcePath(row.file))), row.sha256); assert.equal(digest(readFileSync(join(sourceDirectory, row.file))), row.sha256); }
    assert.equal(digest(readFileSync(join(sourceDirectory, imageConfig.file))), imageConfig.sha256,
      "The owned image environment configuration changed after binding.");
    for (const name of readdirSync(sourceDirectory)) {
      assert.equal(/^\.env(?:\.|$)/iu.test(name) && !(name === ".env.example" && manifest.some(row => row.file === name)), false);
      if (/^next\.config\./u.test(name)) assert.ok(["next.config.ts", imageConfig.file].includes(name), "Unexpected Next config precedence.");
    }
  };
  let nativeArchiveBinding: Readonly<{ headSha: string; sourceSha256: string; sourceManifestSha256: string;
    runtimeSha256: string; projectLockSha256: string; installedLockSha256: string }> | undefined;
  const closedVerificationChildren: Array<{ name: string; args: string[]; commandSha256: string;
    binding: typeof nativeArchiveBinding; result: unknown }> = [];
  const closedNativeArchiveCandidate = (args: readonly string[], result: unknown) => {
    if (result === null || typeof result !== "object") return false;
    const value = result as { stderr?: unknown; code?: unknown };
    return typeof value.stderr === "string" && value.stderr.includes('"ownedNativeEvidenceDirectory"')
      || process.platform === "win32" && value.code === 0 && (args.length === 3 && args[1] === "run" && args[2] === "verify:admin-runtime"
        || args.length === 2 && args[0] === "--experimental-strip-types" && args[1] === join(sourceDirectory, "scripts/verify-isolated-supabase.mts"));
  };
  const runChild = async (args: string[], env: NodeJS.ProcessEnv, name: string, limitMs: number) => {
    const command = [...args], binding = nativeArchiveBinding;
    try {
      const result = await runOwnedVerificationChild({ sourceDirectory, context, children, signal }, args, env, name, limitMs);
      if (closedNativeArchiveCandidate(command, result))
        closedVerificationChildren.push({ name, args: command, commandSha256: digest(JSON.stringify(command)), binding, result });
      return result;
    } catch (error) {
      const result: unknown = error !== null && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "childResult")?.value : undefined;
      if (closedNativeArchiveCandidate(command, result))
        closedVerificationChildren.push({ name, args: command, commandSha256: digest(JSON.stringify(command)), binding, result });
      throw error;
    }
  };
  const preserveClosedNativeArchives = async () => {
    // Settle the existing pulse before synchronous archive/source reads. Cleanup
    // must preserve evidence after cancellation; the lifecycle still owns and
    // propagates heartbeat failure after this preservation-only boundary.
    await drainControlPulse("archive-preservation");
    const archives: Array<Record<string, unknown>> = [], failures: Array<{ stage: string; code: string | null }> = [];
    let firstFailure: unknown, stage = "closed_child_declaration", bindingChecked = false;
    const record = (value: unknown): Record<string, unknown> => {
      assert.ok(value !== null && typeof value === "object" && !Array.isArray(value)); return value as Record<string, unknown>;
    };
    const failure = (error: unknown) => {
      if (!failures.length) firstFailure = error;
      const code: unknown = error !== null && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
      failures.push({ stage, code: typeof code === "string" && /^[A-Z0-9_]+$/u.test(code) ? code : null });
    };
    const checkedPath = (file: string, root: string, directory: boolean) => {
      assert.ok(file === root || file.startsWith(root + sep), "Native evidence escaped its owned physical root.");
      const stat = lstatSync(file);
      assert.equal(stat.isSymbolicLink(), false, "Native evidence cannot traverse a link.");
      assert.equal(directory ? stat.isDirectory() : stat.isFile(), true, "Native evidence requires ordinary files and directories.");
      assert.equal(realpathSync(file), file, "Native evidence cannot traverse an indirect physical path.");
      if (!directory) assert.equal(stat.nlink, 1, "Native evidence cannot contain a hard-linked file.");
      return stat;
    };
    const tree = (root: string) => {
      const directories: string[] = [], files: Array<{ file: string; sha256: string; bytes: number }> = [];
      const visit = (at: string) => {
        checkedPath(at, root, true);
        for (const name of readdirSync(at).sort()) {
          assert.ok(name && !/[\\/:]/u.test(name) && name !== "." && name !== "..", "Invalid Native evidence member.");
          const file = join(at, name), stat = lstatSync(file), relative = file.slice(root.length + 1).replaceAll("\\", "/");
          if (stat.isDirectory()) { directories.push(relative); visit(file); }
          else { checkedPath(file, root, false); const bytes = readFileSync(file); files.push({ file: relative, sha256: digest(bytes), bytes: bytes.length }); }
        }
      };
      visit(root); return { directories: directories.sort(), files: files.sort((a, b) => a.file.localeCompare(b.file)) };
    };
    const declared = new Set<string>();
    let adminRuntimeProducesArchive: boolean | undefined;
    for (const child of closedVerificationChildren) {
      try {
        stage = "closed_child_declaration";
        const result = record(child.result), stderr = result.stderr;
        const lines = typeof stderr === "string" ? stderr.split(/\r?\n/u) : [];
        const declarations = lines.map((line, index) => ({ line, index: index + 1 }))
          .filter(row => row.line.includes('"ownedNativeEvidenceDirectory"'));
        // A failed wrapper may have stopped before the producer. Only an actual successful,
        // registered Gate57 command establishes that its Windows producer must have run.
        if (!declarations.length && result.code === 0 && process.platform === "win32") {
          let producerExecuted = child.args.length === 2 && child.args[0] === "--experimental-strip-types"
            && child.args[1] === join(sourceDirectory, "scripts/verify-isolated-supabase.mts");
          if (child.args.length === 3 && child.args[1] === "run" && child.args[2] === "verify:admin-runtime") {
            if (adminRuntimeProducesArchive === undefined) {
              const scripts = record(JSON.parse(readFileSync(join(sourceDirectory, "package.json"), "utf8"))).scripts;
              adminRuntimeProducesArchive = registeredVerificationNodeEntries(record(scripts) as Record<string, string>, "verify:admin-runtime")
                .includes("scripts/verify-isolated-supabase.mts");
            }
            producerExecuted = adminRuntimeProducesArchive;
          }
          assert.equal(producerExecuted, false, "A completed Native archive producer omitted its declaration.");
        }
        if (!declarations.length) continue;
        stage = "closed_child_binding";
        assert.ok(nativeArchiveBinding && child.binding === nativeArchiveBinding, "Native archives require this invocation's private child binding.");
        assert.equal(child.commandSha256, digest(JSON.stringify(child.args)));
        assert.equal(typeof result.stdout, "string"); assert.equal(typeof stderr, "string");
        const stdoutFile = ownedPath(context, `public-${child.name}.stdout.log`), stderrFile = ownedPath(context, `public-${child.name}.stderr.log`);
        for (const file of [stdoutFile, stderrFile]) checkedPath(file, realpathSync(context.runDirectory), false);
        assert.equal(digest(readFileSync(stdoutFile)), digest(result.stdout as string));
        assert.equal(digest(readFileSync(stderrFile)), digest(stderr as string));
        const cleanup = record(result.cleanup);
        assert.equal(cleanup.status, "PASS"); assert.equal(cleanup.processTreeVerified, true); assert.equal(cleanup.liveProcesses, 0);
        const native = result.nativeJobReceipt, identity = result.nativeJobIdentity;
        if (process.platform === "win32") {
          const terminal = record(native), initial = record(identity), nativeCleanup = record(terminal.cleanup);
          assert.equal(terminal.status, "PASS"); assert.equal(terminal.jobToken, initial.jobToken); assert.equal(terminal.rootPid, initial.rootPid);
          assert.equal(terminal.rootExitCode, result.code); assert.equal(terminal.rootCreationTimeFileTime, initial.rootCreationTimeFileTime);
          assert.equal(record(result.identity).pid, initial.rootPid); assert.equal(initial.ownerJobAssignedBeforeResume, true);
          assert.equal(nativeCleanup.status, "PASS"); assert.equal(nativeCleanup.processTreeVerified, true); assert.equal(nativeCleanup.activeProcessesAfterCleanup, 0);
          for (const [suffix, value] of [["native-identity", identity], ["native-result", native]] as const) {
            const file = ownedPath(context, `public-${child.name}.${suffix}.json`); checkedPath(file, realpathSync(context.runDirectory), false);
            assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), value, "Native closed-child receipt changed after settlement.");
          }
        }
        stage = "source_runtime_binding";
        if (!bindingChecked) {
          assert.equal(digest(readFileSync(ownedPath(context, "public-source-manifest.json"))), nativeArchiveBinding.sourceManifestSha256);
          assert.equal(nativeArchiveBinding.sourceSha256, digest(JSON.stringify(manifest)));
          assert.equal(nativeArchiveBinding.headSha, request.admissionQualification!.finalHead);
          assert.equal(nativeArchiveBinding.sourceSha256, request.admissionQualification!.sourceSha256);
          assert.equal(nativeArchiveBinding.runtimeSha256, digest(JSON.stringify(request.admissionQualification!.runtime)));
          assert.equal(digest(readFileSync(join(ROOT, "package-lock.json"))), nativeArchiveBinding.projectLockSha256);
          assert.equal(digest(readFileSync(join(ROOT, "node_modules/.package-lock.json"))), nativeArchiveBinding.installedLockSha256);
          assertLocalVerificationAdmissionQualification(request.admissionQualification!, { baselineHead: request.admissionQualification!.baselineHead,
            finalHead: request.admissionQualification!.finalHead, sourceSha256: request.admissionQualification!.sourceSha256 });
          verifySource(); bindingChecked = true;
        }
        for (const declaration of declarations) {
          const archive: Record<string, unknown> = { status: "BLOCKED", qualificationGranted: false, nativePassClaimed: false, gatePassClaimed: false,
            child: { name: child.name, commandSha256: child.commandSha256, code: result.code, reason: result.reason ?? "completed",
              identity: result.identity, nativeJobIdentity: identity ?? null, nativeJobReceipt: native ?? null },
            declarationStream: { file: stderrFile, sha256: digest(stderr as string), line: declaration.index }, sourceBinding: nativeArchiveBinding };
          archives.push(archive);
          try {
            stage = "declared_archive_path";
            const value = record(JSON.parse(declaration.line));
            assert.deepEqual(Object.keys(value).sort(), ["ownedNativeEvidenceDirectory", "retainedFiles"]);
            assert.equal(typeof value.ownedNativeEvidenceDirectory, "string");
            const originalRoot = value.ownedNativeEvidenceDirectory as string, temporary = join(sourceDirectory, ".tmp-qa");
            assert.equal(dirname(originalRoot), temporary); checkedPath(temporary, sourceDirectory, true);
            const name = originalRoot.slice(temporary.length + 1);
            assert.match(name, /^owned-process-controls-[a-zA-Z0-9_-]+$/u);
            assert.equal(declared.has(originalRoot), false, "Duplicate Native archive declaration."); declared.add(originalRoot);
            assert.ok(Number.isSafeInteger(value.retainedFiles) && (value.retainedFiles as number) >= 0);
            archive.originalRoot = originalRoot; checkedPath(originalRoot, temporary, true);
            stage = "raw_archive_copy";
            const before = tree(originalRoot), destination = ownedPath(context, "native-archives-preserved");
            if (!existsSync(destination)) mkdirSync(destination);
            checkedPath(destination, realpathSync(context.runDirectory), true);
            const preservedRoot = join(destination, name); assert.equal(existsSync(preservedRoot), false, "Preserve any earlier Native archive copy.");
            mkdirSync(preservedRoot); archive.preservedRoot = preservedRoot; archive.before = before;
            for (const directory of before.directories) mkdirSync(join(preservedRoot, directory), { recursive: true });
            for (const row of before.files) {
              const original = join(originalRoot, row.file); checkedPath(original, originalRoot, false);
              const bytes = readFileSync(original); assert.equal(digest(bytes), row.sha256); assert.equal(bytes.length, row.bytes);
              writeFileSync(join(preservedRoot, row.file), bytes, { flag: "wx", mode: 0o600 });
            }
            const after = tree(originalRoot), copied = tree(preservedRoot); archive.after = after; archive.copied = copied;
            assert.deepEqual(after, before, "Native archive changed while preserving its bytes.");
            assert.deepEqual(copied, before, "Native archive copy lost raw bytes or directory membership.");
            archive.rawBytesUnmodified = true; archive.completeTreeAndEmptyDirectories = true;
            archive.fileMappings = before.files.map(row => ({ originalPath: join(originalRoot, row.file), preservedPath: join(preservedRoot, row.file), bytes: row.bytes, sha256: row.sha256 }));
            archive.snapshotSha256 = digest(JSON.stringify(before));
            stage = "archive_index_membership";
            const indexFile = join(preservedRoot, "evidence-index.json"), index = record(JSON.parse(readFileSync(indexFile, "utf8")));
            assert.equal(index.schema, 1); assert.equal(index.originalNativeEvidenceRetained, true); assert.ok(Array.isArray(index.files));
            assert.ok(Array.isArray(index.finalCleanup) && index.finalCleanup.every(value => value === "fulfilled"));
            const indexed = (index.files as unknown[]).map(value => {
              const row = record(value); assert.deepEqual(Object.keys(row).sort(), ["bytes", "file", "sha256"]);
              assert.equal(typeof row.file, "string"); assert.ok(!isAbsolute(row.file as string) && !/[\\:]/u.test(row.file as string));
              assert.ok(!(row.file as string).split("/").some(part => !part || part === "." || part === ".."));
              assert.match(String(row.sha256), /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(row.bytes) && (row.bytes as number) >= 0);
              return { file: row.file as string, sha256: row.sha256 as string, bytes: row.bytes as number };
            }).sort((a, b) => a.file.localeCompare(b.file));
            assert.equal(new Set(indexed.map(row => row.file)).size, indexed.length); assert.equal(indexed.length, value.retainedFiles);
            assert.deepEqual(before.files.filter(row => row.file !== "evidence-index.json"), indexed, "Native archive index differs from exact raw file membership.");
            archive.index = { originalPath: join(originalRoot, "evidence-index.json"), preservedPath: indexFile, sha256: digest(readFileSync(indexFile)) };
            archive.status = "PASS_PRESERVATION_ONLY";
          } catch (error) { archive.failureStage = stage; failure(error); }
        }
      } catch (error) { failure(error); }
    }
    if (!archives.length && !failures.length) return;
    receipt(context, "public-native-evidence-preservation.json", { schema: 1, status: failures.length ? "BLOCKED" : "PASS_PRESERVATION_ONLY",
      sourceBinding: nativeArchiveBinding ?? null, archives, failures, qualificationGranted: false, nativePassClaimed: false, gatePassClaimed: false, liveAdmissionGranted: false });
    if (failures.length) throw firstFailure;
  };
  const stageInstalledDependencies = async () => {
    const started = performance.now(), deadlineMs = 600_000;
    const sourceRoot = join(ROOT, "node_modules"), targetRoot = join(sourceDirectory, "node_modules");
    const entries: Array<{ file: string; kind: "directory" | "file"; mode: number; bytes?: number; sha256?: string }> = [];
    const closeFailures: Array<{ name: string; code: string | null }> = [];
    let filesCopied = 0, bytesCopied = 0;
    const checkpoint = () => {
      signal.throwIfAborted();
      assert.ok(performance.now() - started < deadlineMs, "Owned dependency staging exceeded its preparation deadline.");
    };
    const step = async <T,>(operation: () => Promise<T>) => {
      checkpoint(); await drainControlPulse(); checkpoint();
      const value = await operation(); checkpoint(); return value;
    };
    const identity = (stat: Stats) => ({ dev: stat.dev, ino: stat.ino, mode: stat.mode,
      size: stat.size, nlink: stat.nlink, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs });
    const checkedStat = async (file: string, boundary: string, directory: boolean) => {
      assert.ok(file === boundary || file.startsWith(boundary + sep), "Owned dependency path escaped its physical root.");
      const stat = await step(() => asyncFs.lstat(file));
      assert.equal(stat.isSymbolicLink(), false, "Owned dependencies cannot contain a symlink or junction.");
      assert.equal(directory ? stat.isDirectory() : stat.isFile(), true, "Owned dependencies require ordinary directories and files.");
      if (!directory) assert.equal(stat.nlink, 1, "Owned dependencies cannot contain a hard-linked file.");
      assert.equal(await step(() => asyncFs.realpath(file)), file, "Owned dependencies cannot traverse an indirect physical path.");
      return stat;
    };
    try {
      assert.equal(await step(() => asyncFs.realpath(ROOT)), ROOT);
      assert.equal(await step(() => asyncFs.realpath(sourceDirectory)), sourceDirectory);
      assert.ok(sourceDirectory.startsWith(await step(() => asyncFs.realpath(context.runDirectory)) + sep));
      const lockRow = manifest.find(row => row.file === "package-lock.json"); assert.ok(lockRow, "Owned dependencies require the frozen project lock.");
      const before = localVerificationAdmissionRuntimeIdentity([]);
      assert.equal(before.projectLockSha256, lockRow.sha256, "Installed dependencies do not match the frozen project lock.");
      assert.equal(digest(await step(() => asyncFs.readFile(join(sourceDirectory, "package-lock.json")))), lockRow.sha256);
      await checkedStat(sourceRoot, sourceRoot, true);
      await step(() => asyncFs.mkdir(targetRoot));
      const walk = async (relative: string): Promise<void> => {
        const source = relative ? join(sourceRoot, relative) : sourceRoot, target = relative ? join(targetRoot, relative) : targetRoot;
        const initial = await checkedStat(source, sourceRoot, true);
        await checkedStat(target, targetRoot, true);
        const names = (await step(() => asyncFs.readdir(source))).sort();
        assert.ok(entries.length + names.length + 1 <= 200_000, "Owned dependency inventory exceeded its finite entry bound.");
        entries.push({ file: relative.replaceAll("\\", "/"), kind: "directory", mode: initial.mode & 0o777 });
        for (const name of names) {
          assert.ok(entries.length + 1 <= 200_000, "Owned dependency inventory exceeded its finite entry bound.");
          assert.ok(name !== "." && name !== ".." && !/[\\/]/u.test(name));
          const file = relative ? join(relative, name) : name, inputPath = join(sourceRoot, file), outputPath = join(targetRoot, file);
          const stat = await step(() => asyncFs.lstat(inputPath));
          assert.equal(stat.isSymbolicLink(), false, "Owned dependencies cannot contain a symlink or junction.");
          if (stat.isDirectory()) { await step(() => asyncFs.mkdir(outputPath)); await walk(file); continue; }
          const original = await checkedStat(inputPath, sourceRoot, false);
          assert.ok(original.size <= 512 * 1024 * 1024 && bytesCopied + original.size <= 4 * 1024 * 1024 * 1024,
            "Owned dependency bytes exceeded their finite preparation bound.");
          let input: Awaited<ReturnType<typeof asyncFs.open>> | undefined, output: Awaited<ReturnType<typeof asyncFs.open>> | undefined, failure: unknown, failed = false;
          try {
            await step(async () => { input = await asyncFs.open(inputPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)); });
            assert.deepEqual(identity(await step(() => input!.stat())), identity(original), "Owned dependency source identity changed before reading.");
            const bytes = await step(() => input!.readFile()), sha256 = digest(bytes);
            assert.equal(bytes.length, original.size);
            await step(async () => { output = await asyncFs.open(outputPath,
              fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0), 0o600); });
            await step(() => output!.writeFile(bytes));
            await step(() => output!.chmod(original.mode & 0o777));
            const copied = await checkedStat(outputPath, targetRoot, false);
            assert.deepEqual(identity(await step(() => output!.stat())), identity(copied), "Owned dependency destination identity changed during copying.");
            assert.equal(copied.mode & 0o777, original.mode & 0o777, "Owned dependency file mode changed during copying.");
            assert.equal(copied.size, original.size);
            assert.equal(digest(await step(() => asyncFs.readFile(outputPath))), sha256, "Owned dependency destination bytes changed during copying.");
            assert.deepEqual(identity(await checkedStat(inputPath, sourceRoot, false)), identity(original), "Owned dependency source identity changed during copying.");
            assert.equal(digest(await step(() => asyncFs.readFile(inputPath))), sha256, "Owned dependency source bytes changed during copying.");
            assert.deepEqual(identity(await step(() => input!.stat())), identity(original), "Owned dependency source handle changed during copying.");
            entries.push({ file: file.replaceAll("\\", "/"), kind: "file", mode: original.mode & 0o777, bytes: bytes.length, sha256 });
            filesCopied++; bytesCopied += bytes.length;
          } catch (error) { failed = true; failure = error; throw error; }
          finally {
            // Handle closure must settle even after cancellation; only then may the outer workspace cleanup begin.
            const closed = await Promise.allSettled([...(output ? [output.close()] : []), ...(input ? [input.close()] : [])]);
            const rejected = closed.filter((result): result is PromiseRejectedResult => result.status === "rejected");
            for (const result of rejected) closeFailures.push({ name: result.reason instanceof Error ? result.reason.name : "Error",
              code: result.reason && typeof result.reason === "object" && "code" in result.reason && typeof result.reason.code === "string"
                && /^[A-Z0-9_]{1,64}$/u.test(result.reason.code) ? result.reason.code : null });
            if (failed && rejected.length && failure instanceof Error && Object.isExtensible(failure)
              && !Object.hasOwn(failure, "dependencyStagingCloseFailures")) {
              try { Object.defineProperty(failure, "dependencyStagingCloseFailures", { value: rejected.map(result => result.reason) }); }
              catch { /* preserve the original staging failure even when secondary annotation is unavailable */ }
            }
            if (!failed && rejected.length) throw rejected[0]!.reason;
          }
        }
        assert.deepEqual((await step(() => asyncFs.readdir(source))).sort(), names, "Owned dependency membership changed during copying.");
        assert.deepEqual(identity(await checkedStat(source, sourceRoot, true)), identity(initial), "Owned dependency directory changed during copying.");
        await step(() => asyncFs.chmod(target, initial.mode & 0o777));
      };
      await walk("");
      const membership = new Map<string, string[]>();
      for (const entry of entries) {
        if (entry.kind === "directory") membership.set(entry.file, []);
        if (entry.file) {
          const slash = entry.file.lastIndexOf("/"), parent = slash === -1 ? "" : entry.file.slice(0, slash);
          membership.get(parent)!.push(entry.file.slice(slash + 1));
        }
      }
      for (const boundary of [sourceRoot, targetRoot]) for (const entry of entries) {
        const file = entry.file ? join(boundary, entry.file) : boundary;
        const stat = await checkedStat(file, boundary, entry.kind === "directory");
        assert.equal(stat.mode & 0o777, entry.mode, "Owned dependency mode changed after copying.");
        if (entry.kind === "directory") assert.deepEqual((await step(() => asyncFs.readdir(file))).sort(), membership.get(entry.file)!.sort(),
          "Owned dependency membership changed after copying.");
        else {
          assert.equal(stat.size, entry.bytes);
          assert.equal(digest(await step(() => asyncFs.readFile(file))), entry.sha256, "Owned dependency bytes changed after copying.");
        }
      }
      assert.deepEqual(localVerificationAdmissionRuntimeIdentity([]), before, "Installed dependency locks or runtime changed during copying.");
      assert.equal(digest(await step(() => asyncFs.readFile(join(targetRoot, ".package-lock.json")))), before.installedLockSha256);
      assert.equal(digest(await step(() => asyncFs.readFile(join(sourceDirectory, "package-lock.json")))), before.projectLockSha256);
      await step(() => context.assertOwned());
      receipt(context, "public-installed-dependencies.json", { status: "PASS", method: "physical-same-installed-tree", sourceRoot, targetRoot,
        deadlineMs, durationMs: performance.now() - started, filesCopied, bytesCopied, manifestSha256: digest(JSON.stringify(entries)), manifest: entries,
        installedIdentity: before, sourceAndDestinationBytesVerified: true, noLinksOrHardlinks: true, networkUsed: false, reinstallPerformed: false });
      checkpoint();
    } catch (error) {
      try { receipt(context, "public-installed-dependencies-failure.json", { status: "BLOCKED", method: "physical-same-installed-tree", deadlineMs,
        durationMs: performance.now() - started, filesCopied, bytesCopied, partialManifestSha256: digest(JSON.stringify(entries)), closeFailures,
        failure: { name: error instanceof Error ? error.name : "Error", code: error && typeof error === "object" && "code" in error
          && typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/u.test(error.code) ? error.code : null } }); } catch { /* preserve the original staging failure */ }
      throw error;
    }
  };
  try {
    for (const row of manifest) { const target = join(sourceDirectory, row.file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(sourcePath(row.file)), { flag: "wx" }); }
    await context.assertOwned();
    if (downloadFixture) {
      const target = join(sourceDirectory, "public", CORE_DOWNLOAD_MEDIA_KEY);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, downloadFixture, { flag: "wx" });
      receipt(context, "owned-download-fixture.json", { path: CORE_DOWNLOAD_MEDIA_KEY, sha256: digest(downloadFixture), deployedContentDependency: false });
    }
    if (heroCompatibility) {
      const fixtureRoute = join(sourceDirectory, "src/app/qa-isolated-hero-compatibility/page.tsx");
      mkdirSync(dirname(fixtureRoute), { recursive: true });
      const fixtureSource = readFileSync(sourcePath("scripts/fixtures/hero-compatibility-preview.tsx.fixture"), "utf8");
      writeFileSync(fixtureRoute, fixtureSource, { flag: "wx" });
      receipt(context, "hero-compatibility-preview-fixture.json", { path: "src/app/qa-isolated-hero-compatibility/page.tsx", sha256: digest(fixtureSource), isolatedOnly: true, deployed: false });
    }
    if (mediaUpload) {
      // Only the owned, loopback-only build receives this fixture. No app route is deployed.
      const fixtureRoute = join(sourceDirectory, "src/app/qa-isolated-hero/page.tsx");
      mkdirSync(dirname(fixtureRoute), { recursive: true });
      const fixtureSource = readFileSync(sourcePath("scripts/fixtures/media-hero-preview.tsx.fixture"), "utf8");
      writeFileSync(fixtureRoute, fixtureSource, { flag: "wx" });
      receipt(context, "media-hero-preview-fixture.json", { path: "src/app/qa-isolated-hero/page.tsx",
        sha256: digest(fixtureSource), isolatedOnly: true, deployed: false, templateId: 900003 });
    }
    writeFileSync(join(sourceDirectory, imageConfig.file), imageConfigSource, { flag: "wx", mode: 0o600 });
    if (process.platform === "win32") await stageInstalledDependencies();
    else symlinkSync(join(ROOT, "node_modules"), join(sourceDirectory, "node_modules"), "junction");
    const headSha = await gitHead(context);
    const collectorSha256 = manifest.find(row => row.file === "scripts/lib/isolated-public-verification.mts")?.sha256;
    assert.match(collectorSha256 ?? "", /^[a-f0-9]{64}$/u, "Snapshot omits its own verification collector.");
    receipt(context, "public-isolated-image-config.json", { ...imageConfig, generatedSource: imageConfigSource,
      verificationOwner: { file: "scripts/lib/isolated-public-verification.mts", sha256: collectorSha256 },
      scope: "Derived environment configuration only; canonical source manifest and Product config are unchanged." });
    const imageConfigReceipt = { path: "public-isolated-image-config.json",
      sha256: digest(readFileSync(ownedPath(context, "public-isolated-image-config.json"))) };
    receipt(context, "public-source-manifest.json", { isolatedImageConfiguration: { ...imageConfig, receipt: imageConfigReceipt }, invocationHeadSha: headSha, frozenProvenance: frozenProvenance ?? null,
      inventoryBasis: frozenManifest ? "reviewed-frozen-manifest" : "git-index-plus-reviewed-additions",
      byteSource: frozenManifest ? "reviewed-frozen-directory" : "working-tree", additionalSourceFiles: request.additionalSourceFiles,
      fixtureContentSha256: readiness.fixtureContentSha256, collectorSha256,
      manifest, sourceSha256: digest(JSON.stringify(manifest)), privateEnvironmentFilesCopied: false, publicEnvironmentTemplateCopied: manifest.some(row => row.file === ".env.example"), generatedLocalCredentialsOnly: true });
    const archiveRuntime = request.admissionQualification!.runtime as ReturnType<typeof localVerificationAdmissionRuntimeIdentity>;
    nativeArchiveBinding = Object.freeze({ headSha, sourceSha256: digest(JSON.stringify(manifest)),
      sourceManifestSha256: digest(readFileSync(ownedPath(context, "public-source-manifest.json"))),
      runtimeSha256: digest(JSON.stringify(archiveRuntime)), projectLockSha256: archiveRuntime.projectLockSha256,
      installedLockSha256: archiveRuntime.installedLockSha256 });
    let qualityScripts: string[] = [];
    let qualityEnvironment = context.cleanEnvironment();
    let npmCli: string | undefined;
    if (request.finalQualityGate || localPlan) {
      assert.equal(request.additionalSourceFiles.length, 0, "Final batch verification requires committed source membership.");
      const gitOptions = { cwd: ROOT, env: context.cleanEnvironment(), encoding: "utf8" as const, windowsHide: true, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"] };
      execFileSync("git", ["diff", "--quiet", "HEAD", "--"], gitOptions);
      const gitDirectory = realpathSync(execFileSync("git", ["rev-parse", "--absolute-git-dir"], gitOptions).trim());
      assert.ok(lstatSync(gitDirectory).isDirectory(), "Final gate requires canonical read-only Git provenance.");
      const scripts = JSON.parse(readFileSync(join(sourceDirectory, "package.json"), "utf8")).scripts as Record<string, string>;
      qualityScripts = localPlan?.prefix ?? finalQualityScriptNames(scripts);
      if (retainedQuality) {
        retainedAdmission = await loadRetainedFinalQualityAdmissionAsync(request.retainedAdminBehaviorAdmissionSha256!,
          { invocationHeadSha: headSha, sourceSha256: digest(JSON.stringify(manifest)), manifest }, signal);
        execFileSync("git", ["merge-base", "--is-ancestor", retainedAdmission.receipt.sourceHead, headSha], gitOptions);
      }
      const nodeDirectory = dirname(process.execPath);
      npmCli = [join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"), resolve(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js"), resolve(nodeDirectory, "../share/nodejs/npm/bin/npm-cli.js")]
        .find(candidate => existsSync(candidate) && lstatSync(candidate).isFile());
      assert.ok(npmCli, "Installed Node must provide npm-cli.js for the complete Quality Gate.");
      const npmUserConfig = ownedPath(context, "quality-empty-user-npmrc"), npmGlobalConfig = ownedPath(context, "quality-empty-global-npmrc");
      for (const file of [npmUserConfig, npmGlobalConfig]) writeFileSync(file, "", { flag: "wx", mode: 0o600 });
      qualityEnvironment = { ...context.cleanEnvironment(), GIT_DIR: gitDirectory, GIT_WORK_TREE: sourceDirectory,
        GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0", npm_config_userconfig: npmUserConfig, npm_config_globalconfig: npmGlobalConfig };
      receipt(context, localPlan?.mode === "bounded" ? "local-verification-plan.json" : "final-quality-plan.json", { headSha, sourceSha256: digest(JSON.stringify(manifest)),
        prefix: qualityScripts, tail: GATES.map(gate => gate.name), adminAdoptionAfterPublic: adoption,
        ...(localPlan ? { localVerification: { impact: localImpact, impactSha256: localImpactSha256, inputs: localInputs, plan: localPlan },
          fullQualityGateClaimed: localPlan.mode === "full", retainedPassReused: false } : {}),
        ...(heroCompatibility ? { mode: "hero-compatibility", targetedBrowserBeforeQuality: true, expectedHead: request.heroCompatibilityFinalHead } : {}),
        ...(retainedAdmission ? { mode: "retained-admin-behavior", retainedAdminBehavior: retainedAdmission.receipt } : {}),
        privateEnvironmentFilesCopied: false, publicEnvironmentTemplateCopied: manifest.some(row => row.file === ".env.example"), prefixUsesDatabaseCredentials: false });
      if (localPlan?.mode === "bounded") { await drainControlPulse(); verifySource(); assert.equal(localInputs!.finalHead, headSha); activeLocalVerifications.add(originalContext); }
    }
    const qualityPrefix = qualityScripts.map((script, index) => ({ name: `quality-${index + 1}-${script.replace(/[^a-zA-Z0-9_-]/gu, "-")}`, qualityScript: script, limitMs: localVerificationOperationalDeadlineMs(script === "verify:admin-runtime" ? 2_220_000 : localVerificationQualityPrefixDeadlineMs(), operationalBudget) }));
    const liveAdmission = request.admissionQualification ? assertLocalVerificationAdmissionQualification(request.admissionQualification,
      { baselineHead: request.admissionQualification.baselineHead, finalHead: headSha, sourceSha256: digest(JSON.stringify(manifest)) }) : undefined;
    if (qualityPrefix.length) assert.deepEqual(qualityScripts.slice(0, 2), ["lint", "typecheck"], "Canonical quality must start with ESLint then TypeScript.");
    const sourceFloor = await runLocalVerificationSourceFloor({ sourceDirectory, context, signal,
      operationalBudget,
      sources: new Map(manifest.map(row => [row.file, readFileSync(join(sourceDirectory, row.file))] as const)),
      changedFiles: liveAdmission?.sourceDiscovery.changes.map(change => change.file) ?? localInputs?.changes.map(change => change.file) ?? [],
      verifySource, drainControlPulse, governance: [],
      governanceQualified: Boolean(liveAdmission),
      ...(qualityPrefix.length ? { canonical: { npmCli: npmCli!, environment: qualityEnvironment,
        childNames: [qualityPrefix[0]!.name, qualityPrefix[1]!.name] as const,
        onStart: (name: string) => context.record("public-gate-start", { gate: name }) } } : {}) });
    receipt(context, "ordered-public-prerequisites.json", { sourceSha256: digest(JSON.stringify(manifest)),
      sourceFloorContextSha256: sourceFloor.contextSha256, governance: liveAdmission!.sourceFloor.checks
        .filter(check => check.stage === "governance").map(check => ({ step: check.step, code: check.result.code })),
      governanceContextSha256: liveAdmission!.sourceFloor.contextSha256, governanceExecutionContext: "original-live-admission-source",
      governanceClaimedAsCopiedContextExecution: false, canonicalCopiedContextLeavesPreserved: true });
    // These two canonical npm leaves already executed above in this exact copy,
    // environment and lifecycle. Keep all named gates/receipts, never run them twice.
    for (const [index, check] of sourceFloor.checks.slice(0, qualityPrefix.length ? 2 : 0).entries()) {
      const gate = qualityPrefix[index]!, result = check.result;
      const report = { script: gate.qualityScript, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
      qualityReports.push(report); receipt(context, `${gate.name}.json`, report);
      context.record("public-gate-pass", { gate: gate.name });
    }
    const pendingQualityPrefix = qualityPrefix.slice(qualityPrefix.length ? 2 : 0);
    const executionGates = heroCompatibility && request.finalQualityGate
      ? [{ ...GATES[0], name: "hero-compatibility-build" }, heroGate, ...pendingQualityPrefix, ...GATES]
      : [...pendingQualityPrefix, ...gates];
    for (const originalGate of executionGates) {
      const gate = "qualityScript" in originalGate ? originalGate : { ...originalGate,
        limitMs: localVerificationOperationalDeadlineMs(originalGate.limitMs, operationalBudget) };
      await drainControlPulse(); verifySource(); await retainedAdmission?.verify(); await context.assertOwned(); signal.throwIfAborted();
      let env: NodeJS.ProcessEnv = "qualityScript" in gate ? qualityEnvironment : context.cleanEnvironment();
      let gateApp: ChildProcess | undefined;
      if (gate.name === "normal-build" || gate.name === "hero-compatibility-build") env = childEnvironment;
      if (!("qualityScript" in gate) && gate.name !== "normal-build" && gate.name !== "hero-compatibility-build") assert.equal(digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID"))), buildIdSha256);
      if (gate.name === "public-e2e" || gate.name === "admin-interactions" || gate.name === "admin-adoption" || gate.name === "media-upload-limit" || gate.name === "hero-compatibility") {
        const measurementHarness = measurement ? ["scripts/qa-admin-production-interactions.mjs","scripts/fixtures/admin-atomic-readiness.mjs","scripts/fixtures/admin-core-auth-entry-journeys.mjs","scripts/fixtures/admin-measurement-restore-transition.mjs","scripts/fixtures/admin-interaction-server-trace.cjs"]
          .map(file=>({file,sha256:digest(readFileSync(safeSourcePath(file)))})) : null;
        if (measurement?.study === "heavy-editor-performance") {
          const priorHarness = adminStudyHarnesses.get(originalContext);
          if (priorHarness) assert.deepEqual(measurementHarness, priorHarness, "Both study phases require the same collector and trace source.");
          else adminStudyHarnesses.set(originalContext, measurementHarness!);
          for (const row of measurementHarness!) assert.equal(row.sha256, manifest.find(source => source.file === row.file)?.sha256, "The study harness must match its frozen source.");
        }
        if(measurementHarness) receipt(context,"admin-measurement-harness.json",{manifest:measurementHarness,diagnosticInstrumentation:true,productSourceUnchanged:true});
        appPort = await new Promise<number>((done, reject) => { const reservation = net.createServer(); reservation.once("error", reject);
          reservation.listen(0, "127.0.0.1", () => { const port = (reservation.address() as net.AddressInfo).port; reservation.close(error => error ? reject(error) : done(port)); }); });
        const coreFault = gate.name === "admin-adoption" && request.adoptionScope === "core-closure";
        const coreControl = coreFault ? ownedPath(context, "admin-core-cache-control.json") : null;
        if (coreControl) writeFileSync(coreControl, JSON.stringify({ schemaVersion: 1, mode: "off" }), { flag: "wx", mode: 0o600 });
        const appArgs = [...(coreFault ? ["--require", join(sourceDirectory, "scripts/fixtures/admin-core-command-cache-fault.cjs")] : []), ...(measurement?["--require",join(ROOT,"scripts/fixtures/admin-interaction-server-trace.cjs")]:[]),join(sourceDirectory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(appPort)];
        const appEnvironment = measurement ? {...childEnvironment,
            QA_ADMIN_SERVER_TRACE_PATH:ownedPath(context,"admin-server-trace.jsonl"),
            ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_TRACE_CONTROL_PATH: join(resolve(measurement.controlDirectory), "server-trace-mode.json") } : {})} : coreControl ? { ...childEnvironment, QA_ADMIN_CORE_CACHE_CONTROL: coreControl } : childEnvironment;
        const windows = process.platform === "win32" ? spawnWindowsOwnedProcess({ args: appArgs, cwd: sourceDirectory, env: appEnvironment,
          identityPath: ownedPath(context, `public-${gate.name}-server.native-identity.json`), receiptPath: ownedPath(context, `public-${gate.name}-server.native-result.json`),
          limitMs: 120_000 + gate.limitMs + 20_000 }) : undefined;
        const app = process.platform === "win32" ? windows!.child : spawn(process.execPath, appArgs,
          { cwd: sourceDirectory, env: appEnvironment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        gateApp = app;
        children.add(app); let appOutput = "";
        let nativeApplication: NativeApplication | undefined;
        let appClosed: (() => void) | undefined;
        if (windows) {
          const closed = new Promise<void>(done => { appClosed = done; });
          nativeApplication = { child: app, name: gate.name, windows, stopping: false, closed };
          nativeApplications.set(app, nativeApplication);
        }
        const finishAppLog = () => {
          if (!appClosed && nativeApplication) return;
          try { writeFileSync(ownedPath(context, adoption ? `public-${gate.name}-server.log` : "public-server.log"), context.sanitize(appOutput), { mode: 0o600 }); }
          catch (error) { if (!nativeApplication) throw error; nativeApplication.logFailure ??= error; }
          finally { appClosed?.(); appClosed = undefined; }
        };
        const captureAppOutput = (value: Buffer) => {
          if (appFailed) return;
          appOutput += String(value);
          if (appOutput.length > 8_000_000) {
            appFailed = true;
            if (nativeApplication) nativeApplication.failure ??= new Error("Owned application output exceeded its bound.");
            void (nativeApplication ? stopNativeApplication(nativeApplication) : stopChild(app, context.cleanEnvironment())).catch(() => undefined);
          }
        };
        app.stdout!.on("data", captureAppOutput); app.stderr!.on("data", captureAppOutput);
        app.once("error", error => { appFailed = true; if (nativeApplication) { nativeApplication.failure ??= error; if (!app.pid) finishAppLog(); } });
        app.once("close", () => {
          children.delete(app);
          if (nativeApplication && !nativeApplication.stopping) {
            appFailed = true;
            nativeApplication.failure ??= new Error("Owned application exited before its intentional shutdown.");
          }
          finishAppLog();
        });
        const origin = `http://127.0.0.1:${appPort}`; let ready = false;
        const deadline = Date.now() + 120_000;
        while (!ready && Date.now() < deadline) {
          signal.throwIfAborted(); if (nativeApplication?.failure !== undefined) throw nativeApplication.failure;
          assert.equal(appFailed, false, "Owned application process failed.");
          assert.equal(app.exitCode, null, "Owned application exited before readiness.");
          try { const result = await fetch(`${origin}/admin/login`, { redirect: "error", signal: AbortSignal.timeout(3_000) }); ready = result.status === 200; await result.body?.cancel(); } catch { /* bounded startup polling only */ }
          if (!ready) await new Promise(done => setTimeout(done, 500));
        }
        assert.ok(ready, "Owned application readiness failed.");
        env = { ...context.cleanEnvironment(), E2E_BASE_URL: origin, E2E_ADMIN_STORAGE_STATE: "", E2E_TOPICS_CMS_STATE: readiness.topicsCmsState };
        if ((adoption || mediaUpload || heroCompatibility) && credentials) env = { ...env, QA_ADMIN_USERNAME: credentials.username, QA_ADMIN_PASSWORD: credentials.password,
          QA_ADMIN_OUTPUT: context.runDirectory, QA_ADMIN_FIXTURES: ownedPath(originalContext, "admin-adoption-fixtures.json"),
          QA_ADMIN_SOURCE_SHA256: digest(JSON.stringify(manifest)),
          QA_ADMIN_STORAGE_PUBLIC_PREFIXES: JSON.stringify(["cms-images", "cms-documents"].map(bucket => `http://127.0.0.1:${context.apiPort}/storage/v1/object/public/${bucket}/`)) };
        if (heroCompatibility) env = { ...env, QA_HERO_FIXTURES: ownedPath(originalContext, "hero-compatibility-fixtures.json"), QA_HERO_CONTROL: ownedPath(originalContext, "hero-compatibility-control") };
        if (measurement && credentials) env = { ...env, QA_ADMIN_USERNAME: credentials.username, QA_ADMIN_PASSWORD: credentials.password,
          QA_ADMIN_PHASE: measurement.phase, QA_ADMIN_CONTROL: resolve(measurement.controlDirectory), QA_ADMIN_OUTPUT: context.runDirectory,
          ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_STUDY: measurement.study } : {}),
          QA_ADMIN_STORAGE_PUBLIC_PREFIXES: JSON.stringify(["cms-images","cms-documents"].map(bucket=>`http://127.0.0.1:${context.apiPort}/storage/v1/object/public/${bucket}/`)),
          QA_ADMIN_SOURCE_SHA256: digest(JSON.stringify(manifest)) };
      }
      context.record("public-gate-start", { gate: gate.name });
      const args: string[] = "qualityScript" in gate ? [npmCli!, "run", gate.qualityScript] : "script" in gate ? ["--experimental-strip-types", join(gate.name === "admin-interactions" ? ROOT : sourceDirectory, gate.script), ...gate.args]
        : [join(sourceDirectory, "node_modules", gate.module), ...gate.args];
      const result: Awaited<ReturnType<typeof runChild>> = await runChild(args, env, gate.name, gate.limitMs).catch(error => {
        const first = gateApp ? nativeApplications.get(gateApp)?.failure : undefined;
        if (first === undefined) throw error;
        if (first instanceof Error && Object.isExtensible(first) && !Object.hasOwn(first, "applicationDriverFailure"))
          Object.defineProperty(first, "applicationDriverFailure", { value: error });
        throw first;
      });
      if ("qualityScript" in gate) {
        const report = { script: gate.qualityScript, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
        qualityReports.push(report); receipt(context, `${gate.name}.json`, report);
        assert.equal(result.code, 0, `Required Final Quality Gate failed: ${gate.qualityScript}`);
        context.record("public-gate-pass", { gate: gate.name });
        continue;
      }
      if (measurement && gate.name === "admin-interactions" && result.code !== 0) {
        receipt(context, "admin-driver-restart-rejected.json", {
          status: "rejected", driverCode: result.code, cleanLifecycleRestartRequired: true,
          sourceSha256: digest(JSON.stringify(manifest)), qualityPassClaimed: false,
        });
        assert.fail("Admin measurement driver failed; the owned fixture must be recreated before any further job. No repair child was launched.");
      }
      if (gateApp && nativeApplications.get(gateApp)?.failure !== undefined) throw nativeApplications.get(gateApp)!.failure;
      assert.equal(appFailed, false, "Owned application process failed during Public verification.");
      const report = { name: gate.name, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
      reports.push(report); receipt(context, `public-${gate.name}.json`, report);
      assert.equal(result.code, 0, `Required Public gate failed: ${gate.name}`);
      if (gate.name === "public-e2e") assert.equal(/(?:^|\n)\s*[1-9][0-9]*\s+(?:skipped|flaky)\b/iu.test(result.stdout), false, "Public E2E skipped/flaky coverage cannot pass.");
      if (gate.name === "normal-build" || gate.name === "hero-compatibility-build") buildIdSha256 = digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID")));
      if (gateApp && nativeApplications.has(gateApp)) await stopNativeApplication(nativeApplications.get(gateApp)!);
      context.record("public-gate-pass", { gate: gate.name });
      if (gateApp && !nativeApplications.has(gateApp)) await stopChild(gateApp, context.cleanEnvironment());
      if (heroCompatibility && request.finalQualityGate && gate.name === "hero-compatibility") {
        // The targeted preview must not become part of canonical final-HEAD coverage.
        const fixtureDirectory = join(sourceDirectory, "src/app/qa-isolated-hero-compatibility");
        const fixtureRoute = join(fixtureDirectory, "page.tsx");
        assert.equal(digest(readFileSync(fixtureRoute)), digest(readFileSync(sourcePath("scripts/fixtures/hero-compatibility-preview.tsx.fixture"))));
        assert.deepEqual(readdirSync(fixtureDirectory), ["page.tsx"]);
        const generated = ["src/app/qa-isolated-hero-compatibility", ".next", "next-env.d.ts", "tsconfig.tsbuildinfo"];
        assert.equal(realpathSync(sourceDirectory), sourceDirectory);
        assert.ok(sourceDirectory.startsWith(realpathSync(context.runDirectory) + sep));
        for (const file of generated) {
          assert.equal(manifest.some(row => row.file === file || row.file.startsWith(file + "/")), false);
          const target = resolve(sourceDirectory, file);
          assert.ok(target.startsWith(sourceDirectory + sep));
          if (existsSync(target)) {
            assert.equal(realpathSync(target), target, "Owned generated cleanup cannot cross a symlink or junction.");
            rmSync(target, { recursive: true, force: false });
          }
          assert.equal(existsSync(target), false);
        }
        buildIdSha256 = null;
        // Regenerate route helpers from the final HEAD before its normal typecheck.
        const types = await runChild([join(sourceDirectory, "node_modules/next/dist/bin/next"), "typegen"], childEnvironment, "hero-compatibility-typegen", 180_000);
        assert.equal(types.code, 0, "Final-HEAD route type generation failed.");
        assert.equal(existsSync(fixtureDirectory), false);
        // The next gate drains the control pulse before verifying the reset source.
        receipt(context, "hero-compatibility-final-source-reset.json", { fixtureRemoved: true, prerequisiteBuildRemoved: true,
          generatedTypesFromFinalHead: true, headSha, stdoutSha256: digest(types.stdout), stderrSha256: digest(types.stderr) });
      }
    }
    await drainControlPulse(); verifySource(); await retainedAdmission?.verify();
    assert.equal(await gitHead(context), headSha, "Repository HEAD changed during the source snapshot gates.");
    if (!frozenManifest) assert.deepEqual(await gitSourceInventory(context, request), files, "Git source membership changed during the source snapshot gates.");
    if (measurement) adminPhases.get(originalContext)!.add(measurement.phase);
    else completed.add(originalContext);
  } catch (error) { publicFailed = true; publicFailure = error; throw error; }
  finally {
    try {
    activeLocalVerifications.delete(originalContext);
    const [workerCleanup, childCleanup, applicationCleanup] = await Promise.all([
      Promise.allSettled(retainedAdmission ? [retainedAdmission.close()] : []),
      Promise.allSettled([...children].filter(child => !nativeApplications.has(child)).map(child => stopChild(child, context.cleanEnvironment()))),
      Promise.allSettled([...nativeApplications.values()].map(stopNativeApplication)),
    ]);
    assert.ok(childCleanup.every(result => result.status === "fulfilled"), "An owned Public process could not be stopped.");
    for (const settled of applicationCleanup) if (settled.status === "rejected") throw settled.reason;
    if (appPort !== null) {
      const releasedPort = appPort;
      await new Promise<void>((done, reject) => { const probe = net.createServer(); probe.once("error", reject);
        probe.listen(releasedPort, "127.0.0.1", () => probe.close(error => error ? reject(error) : done())); });
    }
    assert.equal(realpathSync(sourceDirectory), sourceDirectory);
    assert.ok(sourceDirectory.startsWith(realpathSync(context.runDirectory) + sep));
    let preservationFailed = false, preservationFailure: unknown;
    try { await preserveClosedNativeArchives(); } catch (error) { preservationFailed = true; preservationFailure = error; }
    rmSync(sourceDirectory, { recursive: true, force: false });
    receipt(context, "public-process-cleanup.json", { ownedProcessesStopped: true, loopbackPortReleased: true, buildWorkspaceRemoved: !existsSync(sourceDirectory), otherResourcesTouched: false,
      ...(retainedAdmission ? { retainedEvidenceWorkerStopped: retainedAdmission.workerStopped } : {}) });
    if (retainedAdmission) assert.equal(retainedAdmission.workerStopped, true, "Retained evidence worker must stop before cleanup completes.");
    for (const settled of workerCleanup) if (settled.status === "rejected") throw settled.reason;
    if (preservationFailed) throw preservationFailure;
    } catch (cleanupFailure) {
      if (!publicFailed) throw cleanupFailure;
      if (publicFailure instanceof Error && Object.isExtensible(publicFailure) && !Object.hasOwn(publicFailure, "publicCleanupFailure"))
        Object.defineProperty(publicFailure, "publicCleanupFailure", { value: cleanupFailure });
      try { context.record("public-cleanup-failure", { originalFailurePreserved: true, cleanupFailed: true }); } catch { /* preserve the original failure */ }
    }
  }
  const result = { status: "pass", gates: reports, buildIdSha256, isolatedImageConfigurationSha256: imageConfig.sha256, sourceSha256: digest(JSON.stringify(manifest)), retainedGatesRerun: false };
  if (localPlan?.mode === "bounded") {
    assert.deepEqual(reports.map(report => report.name), localPlan.tail);
    assert.deepEqual(qualityReports.map(report => report.script), localPlan.prefix);
    const value = { ...result, localVerification: { impactSha256: localImpactSha256, inputs: localInputs, plan: localPlan,
      freshChecks: qualityReports }, fullQualityGateClaimed: false, retainedPassReused: false, globalClosedClaimed: false };
    receipt(context, "local-verification-gates.json", value); return value;
  }
  if (measurement) { const value = { ...result, selection: "admin-interactions", phase: measurement.phase, ...(measurement.study ? { study: measurement.study } : {}), priorQualityGatesRerun: false };
    receipt(context, "admin-measurement-lifecycle.json", value); return value; }
  if (adoption) {
    const value = { ...result, selection: "admin-adoption", globalClosedClaimed: false,
      ...(request.finalQualityGate ? { finalQualityGate: { status: "pass", prefix: qualityReports, tail: reports.filter(report => report.name !== "admin-adoption") } } : {}) };
    if (request.finalQualityGate) receipt(context, "final-quality-gate.json", { ...value.finalQualityGate, sourceSha256: result.sourceSha256, buildIdSha256 });
    receipt(context, "public-and-admin-adoption-gates.json", value); return value;
  }
  if (heroCompatibility) {
    const tail = reports.filter(report => GATES.some(gate => gate.name === report.name));
    if (request.finalQualityGate) assert.deepEqual(tail.map(report => report.name), GATES.map(gate => gate.name));
    const value = { ...result, selection: "hero-compatibility", globalClosedClaimed: false,
      ...(request.finalQualityGate ? { finalQualityGate: { status: "pass", prefix: qualityReports, tail, headSha: request.heroCompatibilityFinalHead } } : {}) };
    if (request.finalQualityGate) receipt(context, "final-quality-gate.json", { ...value.finalQualityGate, sourceSha256: result.sourceSha256, buildIdSha256 });
    receipt(context, "hero-compatibility-gates.json", value); return value;
  }
  if (mediaUpload) {
    const value = { ...result, selection: "media-upload-limit", scope: "configured-image-size", globalClosedClaimed: false };
    receipt(context, "media-upload-limit-gates.json", value); return value;
  }
  if (request.selection === "build-contracts") {
    const buildResult = { ...result, selection: "build-contracts", publicE2EReexecuted: false };
    receipt(context, "public-build-contract-gates.json", buildResult); return buildResult;
  }
  if (retainedAdmission) {
    assert.deepEqual(reports.map(report => report.name), GATES.map(gate => gate.name));
    const value = { ...result, mode: "retained-admin-behavior", globalClosedClaimed: false,
      finalQualityGate: { status: "pass", mode: "retained-admin-behavior", prefix: qualityReports, tail: reports,
        retainedAdminBehavior: retainedAdmission.receipt, sourceHead: retainedAdmission.receipt.sourceBinding.currentSourceHead,
        sourceSha256: result.sourceSha256, buildIdSha256 } };
    receipt(context, "final-quality-gate.json", value.finalQualityGate);
    receipt(context, "public-four-gates.json", value); return value;
  }
  receipt(context, "public-four-gates.json", result); return result;
}

/** Fixed synthetic Preview preparation stays under this verification boundary. */
export { prepareVercelCacheProbe } from "./vercel-cache-probe.mts";
