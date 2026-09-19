import assert from "node:assert/strict";

// Git supplies membership. This policy only excludes private and generated paths.
const EXCLUDED_PART = /^(?:\.git|\.tmp-qa|\.next|node_modules|\.codex|\.agents|\.vercel|\.supabase|protected|private)$/iu;
const PRIVATE_FILE = /(?:^\.env(?:\.|$)|^debug\.log$|\.private\.|\.(?:pem|key)$)/iu;
const REQUIRED_BUILD_INPUTS = ["package.json", "package-lock.json", "tsconfig.json"];

export function sourceIncluded(file: string) {
  if (!file || file.includes("\\") || file.startsWith("/") || file.includes("\0")) return false;
  const parts = file.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || EXCLUDED_PART.test(part) || PRIVATE_FILE.test(part))) return false;
  // Hidden root files are opt-in because they may carry local credentials.
  if (parts[0].startsWith(".") && parts[0] !== ".github" && file !== ".gitignore") return false;
  return true;
}

export function selectSourceInventory(tracked: readonly string[], additional: readonly string[] = []) {
  assert.equal(new Set(tracked).size, tracked.length, "Git tracked inventory contains duplicate paths.");
  assert.equal(new Set(additional).size, additional.length, "Additional source inventory contains duplicate paths.");
  for (const file of additional) assert.ok(sourceIncluded(file), `Unsafe additional source: ${file}`);
  const files = [...new Set([...tracked, ...additional])].filter(sourceIncluded).sort();
  for (const file of REQUIRED_BUILD_INPUTS) {
    assert.ok(tracked.includes(file), `Required tracked build input is missing: ${file}`);
  }
  return files;
}
