import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  preflightLocalDevelopmentSupabase,
  resetLocalDevelopmentSupabase,
  startLocalDevelopmentSupabase,
  stopLocalDevelopmentSupabase,
} from "./lib/local-development-supabase.mts";

const command = process.argv[2];
assert.ok(["start", "stop", "reset", "preflight"].includes(command ?? ""),
  "Use start, stop, reset, or preflight.");

let result: Record<string, unknown>;
if (command === "start") result = await startLocalDevelopmentSupabase();
else if (command === "stop") result = stopLocalDevelopmentSupabase();
else if (command === "reset") result = await resetLocalDevelopmentSupabase();
else result = await preflightLocalDevelopmentSupabase();

console.log(JSON.stringify(result, null, 2));

assert.equal(resolve(process.argv[1]), fileURLToPath(import.meta.url));
