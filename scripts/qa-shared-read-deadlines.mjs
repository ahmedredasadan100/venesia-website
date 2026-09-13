import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Exercise the real read owners against a delayed loopback HTTP server.
// The short deadline is a test setting; the product's existing default is unchanged.
const root = path.resolve(import.meta.dirname, "..");
let delay = 700;
let failed = false;
const server = createServer((request, response) => {
  setTimeout(() => {
    response.setHeader("Content-Type", "application/json");
    if (failed) {
      response.statusCode = 503;
      response.end("{}");
      return;
    }
    response.end(JSON.stringify(request.url.includes("site_settings")
      ? [{ value: true }]
      : [{ source_path: "/old", destination_path: "/new", redirect_type: "301" }]));
  }, delay);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-fixture";
process.env.SUPABASE_FETCH_TIMEOUT_MS = "100";

function load(file) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", output)(
    specifier => load(`${path.resolve(path.dirname(file), specifier)}.ts`), exports,
  );
  return exports;
}

try {
  for (const [file, method, args] of [
    ["src/lib/maintenance/read-maintenance-mode.ts", "isMaintenanceModeEnabled", []],
    ["src/lib/redirects/load-active-redirects.ts", "loadActiveRedirectForRuntime", ["/old"]],
  ]) {
    const read = () => load(path.join(root, file))[method](...args);
    const started = performance.now();
    const result = await read();
    const elapsed = Math.round(performance.now() - started);
    assert.ok(elapsed < 600, `${file}: configured deadline must precede the 700ms response`);
    assert.equal(result, args.length ? null : false);
    delay = 0;
    assert.deepEqual(await read(), args.length
      ? { sourcePath: "/old", destinationPath: "/new", redirectType: "301" }
      : true);
    failed = true;
    assert.equal(await read(), args.length ? null : false);
    failed = false;
    delay = 700;
    console.log(`PASS ${method}: deadline (${elapsed}ms), successful read, unchanged HTTP failure policy`);
  }
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
