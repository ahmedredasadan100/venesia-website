import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentArchitectureBoundaryFiles, evaluateArchitectureBoundaries } from "./lib/architecture-boundary-guard.mts";
import { classifyVerificationImport, loadVerificationOwner } from "./lib/verification-module-loader.mjs";
import { selectSourceInventory, sourceIncluded } from "./lib/verification-source-inventory.mts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = ["package.json", "package-lock.json", "tsconfig.json"];
assert.deepEqual(selectSourceInventory([...required, "new-root-config.mjs", "src/new-owner.ts"]),
  [...required, "new-root-config.mjs", "src/new-owner.ts"].sort(), "A valid new tracked source must enter the snapshot automatically.");
assert.throws(() => selectSourceInventory(required.slice(1)), /Required tracked build input is missing: package.json/u);
assert.equal(sourceIncluded(".env.local"), false);
assert.equal(sourceIncluded("scripts/private/secret.ts"), false);
assert.equal(sourceIncluded("docs/new-contract.md"), true);

const scratch = mkdtempSync(join(tmpdir(), "venisia-verification-loader-"));
try {
  mkdirSync(join(scratch, "src"));
  writeFileSync(join(scratch, "src", "helper.ts"), "export const answer = 42;\n");
  writeFileSync(join(scratch, "entry.ts"), `import { createHash } from "node:crypto";
import { answer } from "./src/helper";
import { answer as aliasAnswer } from "@/helper";
export const result = [createHash("sha256").update("x").digest("hex").length, answer, aliasAnswer];\n`);
  const entry = join(scratch, "entry.ts");
  assert.deepEqual(loadVerificationOwner(entry, scratch).result, [64, 42, 42],
    "A Node builtin, a local module and a source alias must resolve without treating the builtin as a file.");
  assert.equal(classifyVerificationImport("typescript", entry, scratch).kind, "package");
  assert.equal(classifyVerificationImport("node:fs", entry, scratch).kind, "builtin");
  assert.throws(() => classifyVerificationImport("../foreign", entry, scratch), /escapes the source root/u);
} finally {
  rmSync(scratch, { recursive: true });
}

const files = currentArchitectureBoundaryFiles(root);
assert.deepEqual(evaluateArchitectureBoundaries(root, files), [], "Current canonical owners must satisfy architecture direction.");
const readOwner = "src/lib/admin/projects/project-entry-data.ts";
const invalidReadOwner = evaluateArchitectureBoundaries(root, [readOwner], new Map([
  [readOwner, 'import { createSupabaseFetch } from "../../supabase-fetch"; export const read = createSupabaseFetch;'],
]));
assert.equal(invalidReadOwner.length, 1, "A read owner importing transport internals must fail.");
assert.match(invalidReadOwner[0].contract, /timing callbacks/u);
assert.deepEqual(evaluateArchitectureBoundaries(root, [readOwner], new Map([
  [readOwner, "export function read(onTiming: (stage: string) => void) { onTiming('read'); }"],
])), [], "Coordinator supplied callbacks must remain allowed.");
const shared = "src/components/admin/entity-list/AdminEntityList.tsx";
assert.equal(evaluateArchitectureBoundaries(root, [shared], new Map([
  [shared, 'import { getSupabaseAdmin } from "../../../lib/supabase-admin"; export { getSupabaseAdmin };'],
])).length, 1, "A shared component bypassing its data owner must fail.");
const runtime = "src/lib/admin/entity-list/data-engine/fixture.ts";
assert.equal(evaluateArchitectureBoundaries(root, [runtime], new Map([
  [runtime, 'import { loadProjectEntry } from "../../projects/project-entry-data"; export { loadProjectEntry };'],
])).length, 1, "A generic runtime importing an entity owner must fail.");

console.log("PASS verification infrastructure: dynamic tracked inventory, required inputs, privacy policy, Node/local/alias resolution and owner boundary positive/negative controls.");
