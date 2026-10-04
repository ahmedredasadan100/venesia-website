import { CORE_PREVIEW_PUBLIC_IMPACT_SELECTION, validateCorePreviewPublicImpactSelection } from "../fixtures/admin-core-preview-journeys.mjs";
import { validateCoreJourneySelection } from "../fixtures/admin-core-domain-form-journeys.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import net from "node:net";
import { Worker } from "node:worker_threads";
import ts from "typescript";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEntitySeoPersistenceOwner } from "../backfill-entity-seo-scores.mts";
import { selectSourceInventory, sourceIncluded } from "./verification-source-inventory.mts";
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
const FINAL_QUALITY_ACCOUNTING = ".tmp-qa/core-final-closure/held37-final52-closure-2026-10-03/accounting/";
const FINAL_QUALITY_READINESS = FINAL_QUALITY_ACCOUNTING + "final-quality-readiness.json";
const RETAINED_FINAL_QUALITY_AUTHORITY = Object.freeze({
  final27Plan: { path: ".tmp-qa/core-final-closure/remaining-41-52-retry88-stage/qualification-adoption/selection-boundary-follow-on/qualification-plan.json",
    sha256: "69c927001ed4fa447a8a752eb2017ef0c5b0d1d8ddbe051987c7aad5b75a95bc" },
  operationIdentitySha256: "15721c1324f7123bcdbb6d72669ff81cf34229ff748e0e04ffbd39709f42d517",
  caseIdentitySha256: "f8a774a6e85c6ab9ec0bce374a5e18f286e8b840ed5b46349714ee00dae44d71",
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
    if (!owner) assert.match(path, /^docs\/reports\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:md|json)$/u, "Only the exact reviewed Quality lifecycle owners and reports may differ from retained behavior.");
    return [{ path, beforeSha256: original.get(path) ?? null, afterSha256: after.get(path)!, role: owner ? "exact-quality-lifecycle-correction" : "non-executable-closure-report" }];
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
    "scripts/verify-admin-core-navigation-permission-join.mjs": "820bbbf23f31291c0449798bd3e11e272344bbee39db6eee45eca4e8417d6b93"
  },
  "workerStatementsSha256": "c0e3683cd91bfd6413fcbf59f488be8593f7fc65be52ce480aa204a3bfee6634",
  "proofFunctionSha256": "6910502780b2214e41e2f0a23161e1e8a3a4a8e68991b1fefbde2c0af46b627b",
  "lifecycleBeforeLfSha256": "2973edeefb1bb931b453db333a89ab9d09b9b0044893c02ab917a3a057c1e6de",
  "lifecycleAfterLfSha256": "fa6507e20eb5d7636aecb807aada43c47aa8638d7473c4004a73607329b14eeb",
  "navigationAfterSha256": "765824e551d06e0879fc6dc1d2830bcde30bed1b77854749b89bf8567816f64c",
  "controlsAfterSha256": "bc1300d5efa72d136bee94bdcaca0a5c28648f53f16a43391d6ecbb3f5cdc324"
});

/** Exact retained source, with only the finite reviewed report delta admitted. */
export function assertRetainedFinalQualitySource(impact: {
  status: string; retained: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  candidate: { sourceHead: string; sourceSha256: string; sourceManifest: FinalQualityArtifactRef };
  changes: Array<{ path: string; beforeSha256: string | null; afterSha256: string; role: string }>;
  retainedBehaviorRelabelled: boolean; retainedBehaviorReexecuted: boolean; automaticCoverage: unknown[]; globalClosed: boolean;
  qualityLifecycleCorrection?: RetainedQualityLifecycleCorrection;
}, retained: FinalQualitySource, candidate: FinalQualitySource) {
  if (impact.status === "ROOT_REVIEWED_EXACT_QUALITY_LIFECYCLE_SOURCE_IMPACT") return assertRetainedFinalQualityLifecycleSource(impact, retained, candidate);
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
  const artifactPath = (ref: FinalQualityArtifactRef) => {
    assert.equal(typeof ref.path, "string"); assert.match(ref.sha256, /^[a-f0-9]{64}$/u);
    const path = resolve(ROOT, ref.path), boundary = resolve(ROOT, ".tmp-qa/core-final-closure") + sep;
    assert.ok(path.startsWith(boundary) || approvedTracked.get(path) === ref.sha256,
      "Evidence hashes outside the QA boundary require an exact finite current-source path and digest.");
    assert.equal(realpathSync(path), path, "Evidence may not traverse a symlink or junction."); assert.ok(lstatSync(path).isFile());
    return path;
  };
  const pin = (ref: FinalQualityArtifactRef) => {
    const path = artifactPath(ref), bytes = readFileSync(path); assert.equal(digest(bytes), ref.sha256, ref.path);
    const previous = bindings.get(path); if (previous) assert.equal(previous.sha256, ref.sha256, "Conflicting evidence pins.");
    bindings.set(path, { path, sha256: ref.sha256 }); return bytes;
  };
  const read = <T,>(ref: FinalQualityArtifactRef): T => {
    assert.ok(artifactPath(ref).startsWith(resolve(ROOT, ".tmp-qa/core-final-closure") + sep), "JSON authorities must remain inside the fixed QA evidence boundary.");
    return JSON.parse(pin(ref).toString("utf8")) as T;
  };
  const fixed = <T,>(ref: FinalQualityArtifactRef, name: string) => { assert.equal(ref.path, FINAL_QUALITY_ACCOUNTING + name); return read<T>(ref); };
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
  assert.ok([FINAL_QUALITY_ACCOUNTING, ".tmp-qa/core-final-closure/cumulative-accounting-stage/"].some(base => final.qualification.path === base + q.run + "-qualified-observations.json"));
  assert.equal(q.originalHookRun, "browser-r52"); assert.equal(q.deferredFinalQuality, true); assert.equal(q.finalQuality, false);
  assert.deepEqual(q.automaticCoverage, []); assert.equal(q.globalClosed, false);
  const expectedIds = original.held.filter(row => row.run === "browser-r52").map(row => row.id);
  assert.equal(expectedIds.length, 27);
  let admittedIds = expectedIds;
  let admittedSelection = "domain-forms-final-six-followup";
  let compositionEvidence: { authority: FinalQualityArtifactRef; qualifications: Array<{ role: string; qualification: FinalQualityArtifactRef; run: string; sourceHead: string; sourceSha256: string; ownedRunId: string }>; sourceCompatibility: FinalQualityArtifactRef; sourceBinding: ReturnType<typeof assertRetainedFinalQualityCompositeSource>; residualSourceCompatibility?: FinalQualityArtifactRef; residualSourceBinding?: ReturnType<typeof assertRetainedFinalQualityCompositeSource>; sameRun: false } | undefined;
  if (final.composition) {
    const composition = fixed<{
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
    assert.equal(priorLeaf.qualification.path, FINAL_QUALITY_ACCOUNTING + "browser-r148-qualified-observations.json");
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
      assert.equal(middleLeaf.qualification.path, FINAL_QUALITY_ACCOUNTING + "browser-r149-qualified-observations.json");
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
    const compatibility = fixed<Parameters<typeof assertRetainedFinalQualityCompositeSource>[0]>(composition.sourceCompatibility, threeLeaves ? "source-impact-partial148-to-final-update.json" : "source-impact-partial148-to-final-six.json");
    assert.deepEqual(compatibility.retained.sourceManifest, priorLeaf.sourceManifest); assert.deepEqual(compatibility.candidate.sourceManifest, final.sourceManifest);
    const latestSource = read<FinalQualitySource>(final.sourceManifest);
    const sourceBinding = assertRetainedFinalQualityCompositeSource(compatibility, priorSource, latestSource);
    let residualSourceBinding: ReturnType<typeof assertRetainedFinalQualityCompositeSource> | undefined;
    if (middleLeaf) {
      assert.ok(composition.residualSourceCompatibility);
      const residualImpact = fixed<Parameters<typeof assertRetainedFinalQualityCompositeSource>[0]>(composition.residualSourceCompatibility, "source-impact-partial149-to-final-update.json");
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
  const ledger = fixed<{
    sourceHead: string; globalClosed: boolean; automaticCoverage: unknown[];
    closureEligibility: { eligible: boolean; namedCells: FinalQualityNamedCell[]; namedCellCounts: Record<string, number>; remainingPredicates: number; incompleteDomainInventories: number; openPreviewStates: number;
      domainInventories: Array<{ boundary: string; id: string; surfaces: string[]; asRecordedComplete: boolean; complete: boolean }> ;
      previewStates: Array<{ consumer: string; publication: string; session: string; status: string; evidence: FinalQualityArtifactRef[] }> };
    accounting: { historical: number; applicable: number; pendingNotApplicable: number; provenNotApplicable: number; pending: Array<{ key: string }>; proven: Array<{ key: string }> };
    modules: Record<string, Array<{ key: string; status: string; completeNamedContract: boolean; qualifiedPredicates: Array<{ id: string }>; openPredicates: Array<{ id: string }>; dispositionEvidence?: { previousOpenPredicates?: Array<{ id: string }> } }>>;
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
  assert.deepEqual(ledger.predicateCorrections, accepted.predicateCorrections);
  for (const moduleId of ["U02", "U04", "U05"]) {
    const priorCells = accepted.modules[moduleId], cells = ledger.modules[moduleId];
    assert.equal(new Set(cells.map(cell => cell.key)).size, cells.length);
    assert.deepEqual(cells.map(cell => cell.key).sort(), priorCells.map(cell => cell.key).sort(), "Every existing module cell must remain present.");
    for (const cell of cells) {
      const prior = priorCells.find(row => row.key === cell.key)!;
      const predicateIds = (value: typeof cell) => [...new Set([...value.qualifiedPredicates, ...value.openPredicates,
        ...(value.status === "PROVEN_NOT_APPLICABLE" ? value.dispositionEvidence?.previousOpenPredicates ?? [] : [])].map(row => row.id))].sort();
      assert.deepEqual(predicateIds(cell), predicateIds(prior), "Existing finite predicates cannot disappear behind a zero-open total.");
      for (const predicate of prior.qualifiedPredicates) assert.deepEqual(cell.qualifiedPredicates.find(row => row.id === predicate.id), predicate, "Prior qualified proof is immutable.");
      if (!["PROVEN_NOT_APPLICABLE", "NOT_APPLICABLE_PENDING_PROOF"].includes(cell.status))
        assert.equal(cell.completeNamedContract, cell.openPredicates.length === 0);
    }
  }
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
  const normalized = (refs: FinalQualityArtifactRef[]) => refs.map(ref => ({ path: artifactPath(ref), sha256: ref.sha256 })).sort((a, b) => a.path.localeCompare(b.path));
  const required = normalized(integrity.requiredReferences), checked = normalized(integrity.checkedReferences);
  assert.equal(new Set(required.map(ref => ref.path)).size, required.length); assert.deepEqual(checked, required); assert.ok(required.length > 0);
  for (const ref of integrity.checkedReferences) pin(ref);
  const covered = new Map(required.map(ref => [ref.path, ref.sha256]));
  for (const [path, ref] of bindings) if (path !== artifactPath(admissionRef) && path !== artifactPath(admission.integrity))
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
  /** Full ci:check prefix, followed once by the existing build/Public/Admin gates. */
  finalQualityGate?: true;
  /** Explicit retained Final27 admission from the existing accounting owner; no Admin replay. */
  retainedAdminBehaviorAdmissionSha256?: string;
  /** Fixed affected-build subset; omission retains the complete Public gate contract. */
  selection?: "build-contracts" | "admin-interactions" | "admin-adoption";
  /** Fixed follow-up journeys; retained Audit2 outcomes are not replayed. */
  adoptionScope?: "core-closure";
  /** Bounded independent Core families; the final gate still runs the Public suite. */
  adoptionCohort?: "preview-recovery-templates" | "domain-forms" | "domain-commands" | "page-composition" | "template-libraries" | "readonly-hubs" | "recovery-templates" | "specialized-settings" | "media-library" | "template-bulk" | "navigation-settings" | "auth-entry" | "media-recovery" | "query-presentation" | "template-controls" | "domain-bulk" | "topic-controls" | "project-controls" | "presentation-controls";
  /** Optional exact affected journeys within the existing domain-forms cohort. */
  adoptionJourneySelection?: "media-library-final-three-followup" | "media-library-held-followup" | "media-recovery-followup" | "media-recovery-missing-followup" | "topic-video-followup" | "topic-controls-followup" | "specialized-settings-followup" | "page-composition-seo-followup" | "page-composition-content-seo-followup" | "page-composition-followup" | "readonly-hubs-followup" | "template-cards-presentation" | "query-layout-followup" | "text-topic-forms" | "domain-forms-final-six-followup" | "domain-forms-update-followup" | "preview-public-impact" | "template-form-creates" | "template-form-creates-followup" | "domain-command-tail" | "tracking-permissions" | "readonly-query-proof";
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

function ownedPath(context: PrivatePublicVerificationContext, name: string) {
  assert.ok(!isAbsolute(name) && !name.split(/[\\/]/u).includes(".."));
  const path = resolve(context.runDirectory, name);
  assert.ok(path.startsWith(resolve(context.runDirectory) + sep));
  return path;
}
function receipt(context: PrivatePublicVerificationContext, name: string, value: unknown) {
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
    await handle.query("begin");
    try {
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
        image: "/images/venesia-5.png", image_alt: "صورة توضيحية لمقال التحقق المعزول",
        category: category.name, category_slug: category.slug, category_id: category.id,
        content_type: "article", status: "published", deleted_at: null,
        seo_title: "دليل ملكية العقارات وفهم خطوات الشراء والاستثمار الآمن",
        seo_description: "محتوى اصطناعي معزول يشرح ملكية العقارات وخطوات مراجعة المستندات والتخطيط المالي، لاختبار عرض المقالات والبحث والتنقل دون بيانات حقيقية.",
        seo_keywords: ["ملكية", "عقارات"], focus_keyword: "ملكية", canonical_url: null,
        og_image: null, og_image_alt: "", robots_index: true, robots_follow: true, faq: [],
        show_title_on_page: true, show_image_on_page: true, show_excerpt_on_page: true,
        created_at: FIXTURE_DATE, updated_at: FIXTURE_DATE, published_at: FIXTURE_DATE,
      };
      assert.ok(existsSync(join(ROOT, "public", String(row.image))));
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

async function stopChild(child: ChildProcess, environment: NodeJS.ProcessEnv) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    await new Promise<void>((done, reject) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { env: environment, windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(() => { killer.kill(); reject(new Error("Owned child cleanup exceeded its bound.")); }, 15_000);
      killer.once("error", () => { clearTimeout(timer); reject(new Error("Owned child cleanup failed.")); });
      killer.once("close", code => {
        clearTimeout(timer);
        if (code === 0 || child.exitCode !== null || child.signalCode !== null) done();
        else reject(new Error("Owned child cleanup failed."));
      });
    });
  } else child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned child did not stop.")), 15_000);
    child.once("close", () => { clearTimeout(timer); done(); });
  });
}

export async function runOwnedPublicVerification(context: PrivatePublicVerificationContext, request: PublicGateRequest, signal: AbortSignal) {
  await context.assertOwned();
  const readiness = prepared.get(context); assert.ok(readiness, "Public fixture readiness must precede gates.");
  assert.ok(request.selection === undefined || request.selection === "build-contracts" || request.selection === "admin-interactions" || request.selection === "admin-adoption", "Unknown fixed Public gate selection.");
  const measurement = request.selection === "admin-interactions" ? request.adminMeasurement : undefined;
  assert.equal(Boolean(request.adminMeasurement), Boolean(measurement));
  const adoption = request.selection === "admin-adoption";
  const retainedQuality = request.retainedAdminBehaviorAdmissionSha256 !== undefined;
  if (retainedQuality) {
    assert.equal(request.finalQualityGate, true); assert.equal(request.selection, undefined);
    assert.equal(request.adoptionScope, undefined); assert.equal(request.adoptionCohort, undefined);
    assert.equal(request.adoptionJourneySelection, undefined); assert.equal(request.adminMeasurement, undefined);
    assert.deepEqual(request.additionalSourceFiles, []);
    assert.match(request.retainedAdminBehaviorAdmissionSha256!, /^[a-f0-9]{64}$/u);
  }
  assert.ok(request.adoptionScope === undefined || (adoption && request.adoptionScope === "core-closure"), "Unknown fixed adoption scope.");
  assert.ok(request.adoptionCohort === undefined || (request.adoptionScope === "core-closure" && ["preview-recovery-templates", "domain-forms", "domain-commands", "page-composition", "template-libraries", "readonly-hubs", "recovery-templates", "specialized-settings", "media-library", "template-bulk", "navigation-settings", "auth-entry", "media-recovery", "query-presentation", "template-controls", "domain-bulk", "topic-controls", "project-controls", "presentation-controls"].includes(request.adoptionCohort)), "Unknown Core cohort.");
  if (request.adoptionJourneySelection === CORE_PREVIEW_PUBLIC_IMPACT_SELECTION) validateCorePreviewPublicImpactSelection({ scope: request.adoptionScope, cohort: request.adoptionCohort, selection: request.adoptionJourneySelection });
  else validateCoreJourneySelection({ scope: request.adoptionScope, cohort: request.adoptionCohort, selection: request.adoptionJourneySelection });
  if (request.adoptionJourneySelection !== undefined) assert.equal(request.selection, "admin-adoption");
  assert.ok(request.finalQualityGate === undefined || (request.finalQualityGate === true && (adoption || retainedQuality)), "Final Quality Gate requires complete Admin adoption or the explicit retained Final27 admission.");
  const credentials = measurement || adoption ? adminCredentials.get(context) : undefined;
  if (adoption) assert.ok(credentials, "Owned Admin fixture preparation is required for adoption journeys.");
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
  if (adoption && credentials) {
    const baseSanitize = context.sanitize;
    context = { ...context, sanitize: value => [credentials.username, credentials.password, credentials.secret]
      .reduce((text, item) => text.replaceAll(item, "[REDACTED_LOCAL_ADMIN]"), baseSanitize(value)) };
  }
  const gates = adoption ? [...(request.adoptionCohort && !request.finalQualityGate ? GATES.filter(gate => gate.name !== "public-e2e") : GATES), { name: "admin-adoption", script: "scripts/qa-admin-adoption-journeys.mjs", args: request.adoptionScope === "core-closure" ? ["--core-closure", ...(request.adoptionCohort ? ["--core-cohort=" + request.adoptionCohort] : []), ...(request.adoptionJourneySelection ? ["--core-journey-selection=" + request.adoptionJourneySelection] : [])] : [], limitMs: request.adoptionCohort === "media-recovery" ? 1_200_000 : (request.adoptionCohort === "domain-commands" || request.adoptionCohort === "query-presentation") ? 1_800_000 : 900_000 }] : measurement ? [GATES[0], { name: "admin-interactions", script: "scripts/qa-admin-production-interactions.mjs", args: [], limitMs: measurement.study === "heavy-editor-performance" ? 21_600_000 : 7_200_000 }] : request.selection === "build-contracts"
    ? GATES.filter(gate => gate.name !== "public-e2e") : GATES;
  assert.equal(gates.length, adoption ? (request.adoptionCohort && !request.finalQualityGate ? 4 : 5) : measurement ? 2 : request.selection === "build-contracts" ? 3 : 4);
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
  const reports: Array<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  const qualityReports: Array<{ script: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  let buildIdSha256: string | null = null;
  let retainedAdmission: Awaited<ReturnType<typeof loadRetainedFinalQualityAdmissionAsync>> | undefined;
  const verifySource = () => {
    for (const row of manifest) { assert.equal(digest(readFileSync(sourcePath(row.file))), row.sha256); assert.equal(digest(readFileSync(join(sourceDirectory, row.file))), row.sha256); }
    assert.equal(digest(readFileSync(join(sourceDirectory, imageConfig.file))), imageConfig.sha256,
      "The owned image environment configuration changed after binding.");
    for (const name of readdirSync(sourceDirectory)) {
      assert.equal(/^\.env(?:\.|$)/iu.test(name), false);
      if (/^next\.config\./u.test(name)) assert.ok(["next.config.ts", imageConfig.file].includes(name), "Unexpected Next config precedence.");
    }
  };
  const runChild = (args: string[], env: NodeJS.ProcessEnv, name: string, limitMs: number) => new Promise<{ code: number; stdout: string; stderr: string }>((done, reject) => {
    signal.throwIfAborted();
    const child = spawn(process.execPath, args, { cwd: sourceDirectory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child); let stdout = "", stderr = "", failed = false;
    const abort = () => {
      if (failed) return;
      failed = true;
      void stopChild(child, context.cleanEnvironment()).catch(() => reject(new Error(`Public ${name} cleanup failed.`)));
    };
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, limitMs);
    child.stdout.on("data", value => { stdout += String(value); if (stdout.length > 8_000_000) abort(); });
    child.stderr.on("data", value => { stderr += String(value); if (stderr.length > 8_000_000) abort(); });
    child.once("error", () => { clearTimeout(timeout); signal.removeEventListener("abort", abort); reject(new Error(`Public ${name} process failed.`)); });
    child.once("close", code => {
      clearTimeout(timeout); signal.removeEventListener("abort", abort); children.delete(child);
      const cleanOutput = context.sanitize(stdout), cleanErrors = context.sanitize(stderr);
      writeFileSync(ownedPath(context, `public-${name}.stdout.log`), cleanOutput, { mode: 0o600 });
      writeFileSync(ownedPath(context, `public-${name}.stderr.log`), cleanErrors, { mode: 0o600 });
      if (failed) reject(new Error(`Public ${name} was aborted or exceeded its bound.`));
      else done({ code: code ?? -1, stdout: cleanOutput, stderr: cleanErrors });
    });
  });
  try {
    for (const row of manifest) { const target = join(sourceDirectory, row.file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(sourcePath(row.file)), { flag: "wx" }); }
    await context.assertOwned();
    writeFileSync(join(sourceDirectory, imageConfig.file), imageConfigSource, { flag: "wx", mode: 0o600 });
    symlinkSync(join(ROOT, "node_modules"), join(sourceDirectory, "node_modules"), "junction");
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
      manifest, sourceSha256: digest(JSON.stringify(manifest)), environmentFilesCopied: false, generatedLocalCredentialsOnly: true });
    let qualityScripts: string[] = [];
    let qualityEnvironment = context.cleanEnvironment();
    let npmCli: string | undefined;
    if (request.finalQualityGate) {
      assert.equal(request.additionalSourceFiles.length, 0, "Final Quality Gate requires committed source membership.");
      const gitOptions = { cwd: ROOT, env: context.cleanEnvironment(), encoding: "utf8" as const, windowsHide: true, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"] };
      execFileSync("git", ["diff", "--quiet", "HEAD", "--"], gitOptions);
      const gitDirectory = realpathSync(execFileSync("git", ["rev-parse", "--absolute-git-dir"], gitOptions).trim());
      assert.ok(lstatSync(gitDirectory).isDirectory(), "Final gate requires canonical read-only Git provenance.");
      const scripts = JSON.parse(readFileSync(join(sourceDirectory, "package.json"), "utf8")).scripts as Record<string, string>;
      qualityScripts = finalQualityScriptNames(scripts);
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
      receipt(context, "final-quality-plan.json", { headSha, sourceSha256: digest(JSON.stringify(manifest)),
        prefix: qualityScripts, tail: GATES.map(gate => gate.name), adminAdoptionAfterPublic: !retainedQuality,
        ...(retainedAdmission ? { mode: "retained-admin-behavior", retainedAdminBehavior: retainedAdmission.receipt } : {}),
        environmentFilesCopied: false, prefixUsesDatabaseCredentials: false });
    }
    const executionGates = [...qualityScripts.map((script, index) => ({ name: `quality-${index + 1}-${script.replace(/[^a-zA-Z0-9_-]/gu, "-")}`, qualityScript: script, limitMs: 1_800_000 })), ...gates];
    for (const gate of executionGates) {
      verifySource(); await retainedAdmission?.verify(); await context.assertOwned(); signal.throwIfAborted();
      let env: NodeJS.ProcessEnv = "qualityScript" in gate ? qualityEnvironment : context.cleanEnvironment();
      let gateApp: ChildProcess | undefined;
      if (gate.name === "normal-build") env = childEnvironment;
      if (!("qualityScript" in gate) && gate.name !== "normal-build") assert.equal(digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID"))), buildIdSha256);
      if (gate.name === "public-e2e" || gate.name === "admin-interactions" || gate.name === "admin-adoption") {
        const measurementHarness = measurement ? ["scripts/qa-admin-production-interactions.mjs","scripts/fixtures/admin-atomic-readiness.mjs","scripts/fixtures/admin-measurement-restore-transition.mjs","scripts/fixtures/admin-interaction-server-trace.cjs"]
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
        const app = spawn(process.execPath, [...(coreFault ? ["--require", join(sourceDirectory, "scripts/fixtures/admin-core-command-cache-fault.cjs")] : []), ...(measurement?["--require",join(ROOT,"scripts/fixtures/admin-interaction-server-trace.cjs")]:[]),join(sourceDirectory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(appPort)],
          { cwd: sourceDirectory, env: measurement ? {...childEnvironment,
            QA_ADMIN_SERVER_TRACE_PATH:ownedPath(context,"admin-server-trace.jsonl"),
            ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_TRACE_CONTROL_PATH: join(resolve(measurement.controlDirectory), "server-trace-mode.json") } : {})} : coreControl ? { ...childEnvironment, QA_ADMIN_CORE_CACHE_CONTROL: coreControl } : childEnvironment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        gateApp = app;
        children.add(app); let appOutput = "";
        const captureAppOutput = (value: Buffer) => {
          if (appFailed) return;
          appOutput += String(value);
          if (appOutput.length > 8_000_000) { appFailed = true; void stopChild(app, context.cleanEnvironment()).catch(() => undefined); }
        };
        app.stdout!.on("data", captureAppOutput); app.stderr!.on("data", captureAppOutput);
        app.once("error", () => { appFailed = true; });
        app.once("close", () => { children.delete(app); writeFileSync(ownedPath(context, adoption ? `public-${gate.name}-server.log` : "public-server.log"), context.sanitize(appOutput), { mode: 0o600 }); });
        const origin = `http://127.0.0.1:${appPort}`; let ready = false;
        const deadline = Date.now() + 120_000;
        while (!ready && Date.now() < deadline) {
          signal.throwIfAborted(); assert.equal(appFailed, false, "Owned application process failed.");
          assert.equal(app.exitCode, null, "Owned application exited before readiness.");
          try { const result = await fetch(`${origin}/admin/login`, { redirect: "error", signal: AbortSignal.timeout(3_000) }); ready = result.status === 200; await result.body?.cancel(); } catch { /* bounded startup polling only */ }
          if (!ready) await new Promise(done => setTimeout(done, 500));
        }
        assert.ok(ready, "Owned application readiness failed.");
        env = { ...context.cleanEnvironment(), E2E_BASE_URL: origin, E2E_ADMIN_STORAGE_STATE: "", E2E_TOPICS_CMS_STATE: readiness.topicsCmsState };
        if (adoption && credentials) env = { ...env, QA_ADMIN_USERNAME: credentials.username, QA_ADMIN_PASSWORD: credentials.password,
          QA_ADMIN_OUTPUT: context.runDirectory, QA_ADMIN_FIXTURES: ownedPath(originalContext, "admin-adoption-fixtures.json"),
          QA_ADMIN_SOURCE_SHA256: digest(JSON.stringify(manifest)),
          QA_ADMIN_STORAGE_PUBLIC_PREFIXES: JSON.stringify(["cms-images", "cms-documents"].map(bucket => `http://127.0.0.1:${context.apiPort}/storage/v1/object/public/${bucket}/`)) };
        if (measurement && credentials) env = { ...env, QA_ADMIN_USERNAME: credentials.username, QA_ADMIN_PASSWORD: credentials.password,
          QA_ADMIN_PHASE: measurement.phase, QA_ADMIN_CONTROL: resolve(measurement.controlDirectory), QA_ADMIN_OUTPUT: context.runDirectory,
          ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_STUDY: measurement.study } : {}),
          QA_ADMIN_STORAGE_PUBLIC_PREFIXES: JSON.stringify(["cms-images","cms-documents"].map(bucket=>`http://127.0.0.1:${context.apiPort}/storage/v1/object/public/${bucket}/`)),
          QA_ADMIN_SOURCE_SHA256: digest(JSON.stringify(manifest)) };
      }
      context.record("public-gate-start", { gate: gate.name });
      const args = "qualityScript" in gate ? [npmCli!, "run", gate.qualityScript] : "script" in gate ? ["--experimental-strip-types", join(gate.name === "admin-interactions" ? ROOT : sourceDirectory, gate.script), ...gate.args]
        : [join(sourceDirectory, "node_modules", gate.module), ...gate.args];
      const result = await runChild(args, env, gate.name, gate.limitMs);
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
      assert.equal(appFailed, false, "Owned application process failed during Public verification.");
      const report = { name: gate.name, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
      reports.push(report); receipt(context, `public-${gate.name}.json`, report);
      assert.equal(result.code, 0, `Required Public gate failed: ${gate.name}`);
      if (gate.name === "public-e2e") assert.equal(/(?:^|\n)\s*[1-9][0-9]*\s+(?:skipped|flaky)\b/iu.test(result.stdout), false, "Public E2E skipped/flaky coverage cannot pass.");
      if (gate.name === "normal-build") buildIdSha256 = digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID")));
      context.record("public-gate-pass", { gate: gate.name });
      if (gateApp) await stopChild(gateApp, context.cleanEnvironment());
    }
    verifySource(); await retainedAdmission?.verify();
    assert.equal(await gitHead(context), headSha, "Repository HEAD changed during the source snapshot gates.");
    if (!frozenManifest) assert.deepEqual(await gitSourceInventory(context, request), files, "Git source membership changed during the source snapshot gates.");
    if (measurement) adminPhases.get(originalContext)!.add(measurement.phase);
    else completed.add(originalContext);
  } finally {
    const [workerCleanup, childCleanup] = await Promise.all([
      Promise.allSettled(retainedAdmission ? [retainedAdmission.close()] : []),
      Promise.allSettled([...children].map(child => stopChild(child, context.cleanEnvironment()))),
    ]);
    assert.ok(childCleanup.every(result => result.status === "fulfilled"), "An owned Public process could not be stopped.");
    if (appPort !== null) {
      const releasedPort = appPort;
      await new Promise<void>((done, reject) => { const probe = net.createServer(); probe.once("error", reject);
        probe.listen(releasedPort, "127.0.0.1", () => probe.close(error => error ? reject(error) : done())); });
    }
    assert.equal(realpathSync(sourceDirectory), sourceDirectory);
    assert.ok(sourceDirectory.startsWith(realpathSync(context.runDirectory) + sep));
    rmSync(sourceDirectory, { recursive: true, force: false });
    receipt(context, "public-process-cleanup.json", { ownedProcessesStopped: true, loopbackPortReleased: true, buildWorkspaceRemoved: !existsSync(sourceDirectory), otherResourcesTouched: false,
      ...(retainedAdmission ? { retainedEvidenceWorkerStopped: retainedAdmission.workerStopped } : {}) });
    if (retainedAdmission) assert.equal(retainedAdmission.workerStopped, true, "Retained evidence worker must stop before cleanup completes.");
    for (const settled of workerCleanup) if (settled.status === "rejected") throw settled.reason;
  }
  const result = { status: "pass", gates: reports, buildIdSha256, isolatedImageConfigurationSha256: imageConfig.sha256, sourceSha256: digest(JSON.stringify(manifest)), retainedGatesRerun: false };
  if (measurement) { const value = { ...result, selection: "admin-interactions", phase: measurement.phase, ...(measurement.study ? { study: measurement.study } : {}), priorQualityGatesRerun: false };
    receipt(context, "admin-measurement-lifecycle.json", value); return value; }
  if (adoption) {
    const value = { ...result, selection: "admin-adoption", globalClosedClaimed: false,
      ...(request.finalQualityGate ? { finalQualityGate: { status: "pass", prefix: qualityReports, tail: reports.filter(report => report.name !== "admin-adoption") } } : {}) };
    if (request.finalQualityGate) receipt(context, "final-quality-gate.json", { ...value.finalQualityGate, sourceSha256: result.sourceSha256, buildIdSha256 });
    receipt(context, "public-and-admin-adoption-gates.json", value); return value;
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
