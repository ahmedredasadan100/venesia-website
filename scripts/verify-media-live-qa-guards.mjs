import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  guard: resolve(ROOT, "scripts/lib/media-live-qa-guard.mts"),
  live: resolve(ROOT, "scripts/qa-media-coordination-live.mts"),
  browser: resolve(ROOT, "scripts/qa-media-recovery-browser.mts"),
  example: resolve(ROOT, "scripts/fixtures/media-live-qa-authority.example.json"),
};
const sources = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, "utf8")]),
);

const checks = [];
function check(name, condition) {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\n`);
  assert(passed, name);
}

check("guard accepts Development/QA classifications only", sources.guard.includes('authority.classification !== "development" && authority.classification !== "qa"'));
check("guard denies Production runtime and authority", sources.guard.includes('production !== false') && sources.guard.includes('Runtime environment must be local or preview'));
check("guard requires exact project, dataset, registry, and image bucket identity", sources.guard.includes("expected-project-ref") && sources.guard.includes("expected-environment-key") && sources.guard.includes("expected-provider-registry-version") && sources.guard.includes("expected-image-bucket"));
const reviewedAllowlistSource = sources.guard.match(
  /const REVIEWED_MEDIA_QA_PROJECT_REFS = new Set<string>\(\[([\s\S]*?)\]\);/,
)?.[1] ?? "";
const reviewedProjectRefs = [...reviewedAllowlistSource.matchAll(/"([a-z0-9]{20})"/g)].map((match) => match[1]);
check("guard allowlists only the repository-reviewed controlled project", JSON.stringify(reviewedProjectRefs) === JSON.stringify(["pmqsfqvvekrlujqgurcu"]));
check("guard requires a repository-reviewed positive project allowlist", sources.guard.includes("REVIEWED_MEDIA_QA_PROJECT_REFS") && sources.guard.includes("repository-reviewed disposable QA allowlist"));
check("guard requires an expiring external authority record", sources.guard.includes("Environment Authority has expired") && sources.guard.includes("must remain outside the repository"));
check("guard requires the named destructive environment opt-in", sources.guard.includes('MEDIA_QA_DESTRUCTIVE_ENV_OPT_IN = "ALLOW_DESTRUCTIVE_MEDIA_QA"') && sources.guard.includes('!== "1"'));
check("guard requires backup, both registry versions, and corrective ACL application proof", sources.guard.includes("backupProof") && sources.guard.includes("securityMigrationProof") && sources.guard.includes("registryVerified") && sources.guard.includes('["20260725180000", "20260726070000"]') && sources.guard.includes("remotely ACL-verified"));
check("guard requires unique dedicated fixture namespace", sources.guard.includes("Fixture namespace must be unique"));
check("guard keeps authenticated state outside Git", sources.guard.includes("Authenticated browser state is secret material"));
check("live harness never loads local env files", !sources.live.includes(".env.local") && !sources.live.includes("loadEnv("));
check("live harness reads only the explicitly named credential", sources.live.includes("process.env[serviceRoleEnvironmentName]"));
check("live harness proves protected Admin authentication before mutation", sources.live.indexOf('appRequest("/api/admin/media-library/recovery")') < sources.live.indexOf("const upload = new FormData()"));
check("live harness proves the application's effective upload bucket before mutation", sources.live.includes("actual.imageBucket !== expected.imageBucket") && sources.live.indexOf("assertRecoveryQueueContext(recoveryProbe") < sources.live.indexOf("const upload = new FormData()"));
check("live harness uses namespaced upload and application Safe Delete", sources.live.includes("fixtureFolder") && sources.live.includes("appSafeDelete") && sources.live.includes("RECOVERY_REQUIRED"));
check("live harness exercises coordination conflict and compensated partial/stale writes", sources.live.includes("media_delete_write_lease_unresolved") && sources.live.includes("media_write_lease_sync_incomplete") && sources.live.includes("media_reference_write_lease_mismatch"));
check("live harness has no intentionally unresolved recovery-checkpoint mode", !sources.live.includes("MEDIA_UNRESOLVED_QA_FIXTURE_REQUIRES_RECONCILIATION") && !sources.live.includes("MEDIA_RECOVERY_CHECKPOINT_CREATED"));
check("browser harness never loads local env files", !sources.browser.includes(".env.local") && !sources.browser.includes("loadEnv("));
check("browser harness reads only the explicitly named service-role credential", sources.browser.includes("service-role-env") && sources.browser.includes("process.env[serviceRoleEnvironmentName]"));
check("browser harness binds setup and cleanup to the authority image bucket", sources.browser.includes("expected-image-bucket") && sources.browser.includes("authority.imageBucket") && sources.browser.includes("assert.equal(asset.bucket, authority.imageBucket)"));
check("browser harness proves real auth/context before Supabase setup and intercepted Recovery UI", sources.browser.indexOf("const authProbe = await context.request.get") < sources.browser.indexOf("supabase = createClient(authority.supabaseUrl") && sources.browser.indexOf("const authProbe = await context.request.get") < sources.browser.indexOf("await runRecoveryUiChecks(context"));
check("browser harness binds navigation and API responses to the approved origin", sources.browser.includes("assertApprovedPageLocation") && sources.browser.includes("isApprovedAppRequest") && sources.browser.includes("escaped the approved application origin"));
check("browser harness blocks cross-origin mutating redirects and API cleanup redirects", sources.browser.includes("MUTATING_HTTP_METHODS.has(request.method())") && sources.browser.includes('route.abort("blockedbyclient")') && sources.browser.includes("maxRedirects: 0"));
check("browser harness proves the application's effective upload bucket before mutation", sources.browser.includes("context.imageBucket !== authority.imageBucket") && sources.browser.indexOf("assertQueueContext(await authProbe") < sources.browser.indexOf("topic = await createDraftTopic"));
check("browser harness refuses reused namespaces before mutation", sources.browser.includes("assertNamespaceUnused") && sources.browser.indexOf("assertNamespaceUnused(supabase") < sources.browser.indexOf("createDraftTopic(supabase"));
check("browser harness uploads through the real Media UI", sources.browser.includes("setInputFiles") && sources.browser.includes("uploadThroughMediaUi") && sources.browser.includes("waitForResponse"));
check("browser harness adopts a real disposable draft Topic and picker/save UI", sources.browser.includes('.from("topics")') && sources.browser.includes("createDraftTopic") && sources.browser.includes("data-media-picker-root") && sources.browser.includes("data-admin-form-action"));
check("browser harness proves used Safe Delete rejection through the UI and server", sources.browser.includes("clickSafeDeleteAndCapture(scenarioPage, authority, 409)") && sources.browser.includes("media_delete_in_use") && sources.browser.includes("storageObjectExists"));
check("browser harness proves direct reservation versus stale form before Domain commit", sources.browser.includes("reserve_media_asset_deletion") && sources.browser.includes("stale-should-not-commit") && sources.browser.includes("Stale title reached Domain") && sources.browser.includes("Stale asset reached Domain"));
check("browser harness proves explicit unlink, zero usage, and verified-existing cancellation", sources.browser.includes("Explicit unlink and zero usage") && sources.browser.includes("referenceCount") && sources.browser.includes("cancel_media_asset_deletion") && sources.browser.includes("Reservation cancellation requires exact Storage-exists proof"));
check("browser harness completes final application Safe Delete through UI and reopens state", sources.browser.includes("clickSafeDeleteAndCapture(scenarioPage, authority, 200)") && sources.browser.includes("reopened Topic and Media Library") && sources.browser.includes('status !== "deleted"'));
check("browser harness has rigorous cleanup and explicit Recovery escalation", sources.browser.includes("cleanupFixture") && sources.browser.includes("replace_media_references_for_entity") && sources.browser.includes("RECOVERY_REQUIRED") && sources.browser.includes("Final cleanup proof"));
check("browser harness discovers ambiguous Topic/upload commits and exact Storage orphans", sources.browser.includes("discoverAmbiguousTopic") && sources.browser.includes("discoverAmbiguousUpload") && sources.browser.includes("storage_object_without_catalog_identity"));
check("browser upload identity matches exact bucket, object key, URL origin, and path", sources.browser.includes("Upload object key is outside the exact disposable identity") && sources.browser.includes("new URL(authority.supabaseUrl).origin") && sources.browser.includes("/storage/v1/object/public/"));
check("browser harness intercepts the recovery mutation", sources.browser.includes('route.request().method() === "POST"') && sources.browser.includes("QA injected recovery action failure"));
check("browser harness covers RTL, mobile, keyboard, and failure feedback", sources.browser.includes("direction") && sources.browser.includes("width: 390") && sources.browser.includes("Shift+Tab") && sources.browser.includes("qa_injected_queue_failure"));
check("authority example contains no credential", !/service[_-]?role[_-]?key|password|access[_-]?token/i.test(sources.example));

function probeRejectedAuthority(overrides = {}, environmentOverrides = {}) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "venisia-media-qa-guard-"));
  const authorityPath = join(temporaryRoot, "authority.json");
  const projectRef = "abcdefghijklmnopqrst";
  const authority = {
    schemaVersion: 2,
    approvalId: "reviewed-qa-probe",
    approvedBy: "independent-reviewer",
    evidence: "https://example.com/environment-authority",
    classification: "qa",
    runtimeEnvironment: "local",
    writable: true,
    production: false,
    projectRef,
    supabaseUrl: `https://${projectRef}.supabase.co/`,
    appBaseUrl: "http://localhost:3000/",
    environmentKey: `local:supabase:${projectRef}`,
    provider: "supabase",
    imageBucket: "cms-images",
    providerRegistryVersion: "qa-probe-v1",
    fixturePrefix: "mediaqa",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    backupProof: {
      verified: true,
      verifiedAt: new Date().toISOString(),
      evidence: "https://example.com/backup-proof",
    },
    securityMigrationProof: {
      version: "20260726070000",
      sha256: "E6C198BB698B668CF01557D9FD64074C30CB486EFB9F72574EB89E0A6E2CDBEE",
      applied: true,
      aclVerified: true,
      registryVerified: true,
      registryVersions: ["20260725180000", "20260726070000"],
      verifiedAt: new Date().toISOString(),
      evidence: "https://example.com/security-migration-proof",
    },
    ...overrides,
  };
  writeFileSync(authorityPath, `${JSON.stringify(authority)}\n`, "utf8");
  try {
    return spawnSync(process.execPath, [
      "--experimental-strip-types",
      files.browser,
      "--allow-browser-qa=MEDIA_RECOVERY_AUTHENTICATED_BROWSER_QA",
      `--authority-file=${authorityPath}`,
      `--expected-environment=${authority.classification}`,
      `--expected-runtime-environment=${authority.runtimeEnvironment}`,
      `--expected-project-ref=${authority.projectRef}`,
      `--expected-environment-key=${authority.environmentKey}`,
      `--expected-provider-registry-version=${authority.providerRegistryVersion}`,
      `--expected-image-bucket=${authority.imageBucket}`,
      "--fixture-namespace=mediaqa-uniqueprobe1",
      `--auth-state=${join(temporaryRoot, "not-used.json")}`,
      "--service-role-env=MEDIA_QA_PROBE_KEY",
      "--confirm-cleanup-plan=SAFE_DELETE_OR_RECORDED_RECOVERY",
    ], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ALLOW_DESTRUCTIVE_MEDIA_QA: "1",
        MEDIA_QA_PROBE_KEY: "never-used",
        ...environmentOverrides,
      },
      timeout: 15_000,
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const unknownProjectProbe = probeRejectedAuthority();
check("unknown project cannot self-declare itself as QA", unknownProjectProbe.status === 2 && unknownProjectProbe.stderr.includes("repository-reviewed disposable QA allowlist"));
const reviewedProjectProbe = probeRejectedAuthority({
  projectRef: "pmqsfqvvekrlujqgurcu",
  supabaseUrl: "https://pmqsfqvvekrlujqgurcu.supabase.co/",
  environmentKey: "local:supabase:pmqsfqvvekrlujqgurcu",
});
check(
  "reviewed project still requires external authenticated browser state before network work",
  reviewedProjectProbe.status === 2
    && reviewedProjectProbe.stderr.includes("--auth-state")
    && !reviewedProjectProbe.stderr.includes("allowlist"),
);
const missingDestructiveOptInProbe = probeRejectedAuthority({
  projectRef: "pmqsfqvvekrlujqgurcu",
  supabaseUrl: "https://pmqsfqvvekrlujqgurcu.supabase.co/",
  environmentKey: "local:supabase:pmqsfqvvekrlujqgurcu",
}, {
  ALLOW_DESTRUCTIVE_MEDIA_QA: "",
});
check(
  "reviewed project still requires ALLOW_DESTRUCTIVE_MEDIA_QA=1 before network work",
  missingDestructiveOptInProbe.status === 2
    && missingDestructiveOptInProbe.stderr.includes("ALLOW_DESTRUCTIVE_MEDIA_QA=1"),
);
const missingSecurityProofProbe = probeRejectedAuthority({
  projectRef: "pmqsfqvvekrlujqgurcu",
  supabaseUrl: "https://pmqsfqvvekrlujqgurcu.supabase.co/",
  environmentKey: "local:supabase:pmqsfqvvekrlujqgurcu",
  securityMigrationProof: undefined,
});
check(
  "reviewed project remains blocked before corrective migration proof",
  missingSecurityProofProbe.status === 2
    && missingSecurityProofProbe.stderr.includes("exact corrective ACL migration"),
);
const productionHostProbe = probeRejectedAuthority({
  runtimeEnvironment: "preview",
  appBaseUrl: "https://www.example.com/",
  environmentKey: "preview:supabase:abcdefghijklmnopqrst",
});
check("Production-like Preview host is rejected before any network work", productionHostProbe.status === 2 && productionHostProbe.stderr.includes("resembles Production"));

for (const [label, script] of [
  ["live harness", files.live],
  ["browser harness", files.browser],
]) {
  const refusal = spawnSync(process.execPath, ["--experimental-strip-types", script], {
    cwd: ROOT,
    encoding: "utf8",
    env: {},
    timeout: 15_000,
  });
  check(`${label} refuses execution without opt-in`, refusal.status === 2 && refusal.stderr.includes("GUARD_REFUSAL"));
  check(`${label} says no network work started`, refusal.stderr.includes("no network") || refusal.stderr.includes("no browser or network"));
}

process.stdout.write(`\nMedia live-QA guard verifier: ${checks.length}/${checks.length} checks passed.\n`);
