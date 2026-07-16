// Maintenance/Admin login `next` redirect security test.
// Imports the real sanitizer used by both login forms and asserts the
// redirect target can never leave the site origin.
// Run: node scripts/maintenance-redirect-security-test.mjs

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), "..");
const modulePath = resolve(root, "src/lib/security/safe-internal-path.ts");

let resolveSafeInternalPath;
try {
  ({ resolveSafeInternalPath } = await import(pathToFileURL(modulePath).href));
} catch {
  if (process.env.__STRIP_TYPES_RETRY === "1") {
    console.error("FAIL: could not load safe-internal-path.ts even with type stripping.");
    process.exit(1);
  }
  const rerun = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", scriptPath],
    { stdio: "inherit", env: { ...process.env, __STRIP_TYPES_RETRY: "1" } },
  );
  process.exit(rerun.status ?? 1);
}

const FALLBACK = "/";
const cases = [
  // Allowed internal paths.
  { input: "/about", expected: "/about", label: "internal path allowed" },
  { input: "/contact?source=test", expected: "/contact?source=test", label: "internal path with query allowed" },
  { input: "/topics/some-slug", expected: "/topics/some-slug", label: "nested internal path allowed" },
  // Open-redirect vectors — all must fall back.
  { input: "//evil.example", expected: FALLBACK, label: "protocol-relative URL rejected" },
  { input: "https://evil.example", expected: FALLBACK, label: "https external URL rejected" },
  { input: "http://evil.example", expected: FALLBACK, label: "http external URL rejected" },
  { input: "javascript:alert(1)", expected: FALLBACK, label: "javascript: URI rejected" },
  { input: "/\\evil.example", expected: FALLBACK, label: "backslash escape rejected" },
  { input: "/%09/evil.example", expected: "/%09/evil.example", label: "encoded path stays same-origin" },
  { input: "https:/evil.example", expected: FALLBACK, label: "malformed scheme rejected" },
  { input: " //evil.example", expected: FALLBACK, label: "whitespace-prefixed protocol-relative rejected" },
  // Empty / malformed values — safe fallback.
  { input: "", expected: FALLBACK, label: "empty value falls back" },
  { input: null, expected: FALLBACK, label: "null value falls back" },
  { input: undefined, expected: FALLBACK, label: "missing value falls back" },
  { input: "no-leading-slash", expected: FALLBACK, label: "relative value falls back" },
  { input: "/line\nbreak", expected: FALLBACK, label: "control characters rejected" },
];

let failed = 0;
for (const testCase of cases) {
  const actual = resolveSafeInternalPath(testCase.input, FALLBACK);
  const sameOrigin =
    actual.startsWith("/") && !actual.startsWith("//") && !actual.startsWith("/\\");

  if (actual === testCase.expected && sameOrigin) {
    console.log(`PASS ${testCase.label}: ${JSON.stringify(testCase.input)} -> ${JSON.stringify(actual)}`);
  } else {
    failed += 1;
    console.error(
      `FAIL ${testCase.label}: ${JSON.stringify(testCase.input)} -> ${JSON.stringify(actual)} (expected ${JSON.stringify(testCase.expected)})`,
    );
  }
}

// Custom fallback survives sanitization too.
const adminFallback = resolveSafeInternalPath("https://evil.example/admin", "/admin");
if (adminFallback === "/admin") {
  console.log('PASS custom fallback: external admin URL -> "/admin"');
} else {
  failed += 1;
  console.error(`FAIL custom fallback: got ${JSON.stringify(adminFallback)}`);
}

const total = cases.length + 1;
console.log(`\n${total - failed}/${total} redirect security checks passed`);
if (failed > 0) process.exit(1);
console.log("Maintenance redirect security test OK.");
