import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  guard: resolve(ROOT, "scripts/lib/media-live-qa-guard.mts"),
  live: resolve(ROOT, "scripts/qa-media-coordination-live.mts"),
  retiredBrowserWriter: resolve(ROOT, "scripts/qa-media-recovery-browser.mts"),
  example: resolve(ROOT, "scripts/fixtures/media-live-qa-authority.example.json"),
};
const normalize = (source) => source.replace(/\r\n?/g, "\n");
const guard = normalize(readFileSync(files.guard, "utf8"));
const live = normalize(readFileSync(files.live, "utf8"));
const example = normalize(readFileSync(files.example, "utf8"));

const checks = [];
function check(name, condition) {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${name}\n`);
  assert(passed, name);
}

check(
  "guard accepts Development/QA classifications only",
  guard.includes('authority.classification !== "development" && authority.classification !== "qa"'),
);
check(
  "guard denies Production authority and Production-like runtime",
  guard.includes("production !== false") && guard.includes("Runtime environment must be local or preview"),
);
check(
  "guard binds exact project, dataset, registry, and image bucket identity",
  ["expected-project-ref", "expected-environment-key", "expected-provider-registry-version", "expected-image-bucket"]
    .every((marker) => guard.includes(marker)),
);
check(
  "guard keeps destructive authority external, expiring, and explicitly approved",
  guard.includes("Environment Authority has expired")
    && guard.includes("must remain outside the repository")
    && guard.includes('MEDIA_QA_DESTRUCTIVE_ENV_OPT_IN = "ALLOW_DESTRUCTIVE_MEDIA_QA"'),
);
check(
  "guard requires backup and applied security-registry proof",
  guard.includes("backupProof")
    && guard.includes("securityMigrationProof")
    && guard.includes("registryVerified")
    && guard.includes("remotely ACL-verified"),
);
check(
  "live harness never loads repository credentials",
  !live.includes(".env.local") && !live.includes("loadEnv(") && live.includes("process.env[serviceRoleEnvironmentName]"),
);
check(
  "live harness proves Admin context and effective upload bucket before mutation",
  live.indexOf('appRequest("/api/admin/media-library/recovery")') < live.indexOf("const upload = new FormData()")
    && live.includes("actual.imageBucket !== expected.imageBucket"),
);
check(
  "live harness uses capability-owned upload, coordination RPCs, and Safe Delete",
  live.includes("fixtureFolder")
    && live.includes("appSafeDelete")
    && live.includes("media_delete_write_lease_unresolved")
    && live.includes("media_reference_write_lease_mismatch")
    && live.includes("RECOVERY_REQUIRED"),
);
check(
  "direct-provider Browser QA writer is retired",
  !existsSync(files.retiredBrowserWriter),
);
check(
  "authority example contains no credential",
  !/service[_-]?role[_-]?key|password|access[_-]?token/i.test(example),
);

const refusal = spawnSync(process.execPath, ["--experimental-strip-types", files.live], {
  cwd: ROOT,
  encoding: "utf8",
  env: {},
  timeout: 15_000,
});
check("live harness refuses execution without opt-in", refusal.status === 2 && refusal.stderr.includes("GUARD_REFUSAL"));
check(
  "live harness reports that no network work started on refusal",
  refusal.stderr.includes("no network") || refusal.stderr.includes("no browser or network"),
);

process.stdout.write(`\nMedia live-QA guard verifier: ${checks.length}/${checks.length} checks passed.\n`);
