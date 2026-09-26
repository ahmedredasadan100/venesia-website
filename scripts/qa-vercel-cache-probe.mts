import assert from "node:assert/strict";
import { createHash, randomUUID, sign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect, type Page } from "playwright/test";
import { prepareVercelCacheProbe } from "./lib/isolated-public-verification.mts";
import { classifyVercelCacheProbeRequest, parseVercelCacheProbeFenceMode, parseVercelCacheProbeReadTransport } from "./lib/vercel-cache-probe.mts";

const args = process.argv.slice(2);
if (args[0] === "prepare") {
  assert.equal(args.length, 1);
  console.log(JSON.stringify(prepareVercelCacheProbe()));
} else if (args[0] === "run") {
  const option = (name: string) => { const index = args.indexOf(name); assert.ok(index >= 0 && args[index + 1], "Missing " + name); return args[index + 1]; };
  const deployment = new URL(option("--deployment")), head = option("--head"), output = resolve(option("--output"));
  assert.equal(deployment.protocol, "https:"); assert.ok(/^[a-z0-9-]+\.vercel\.app$/u.test(deployment.hostname));
  assert.equal(deployment.pathname, "/"); assert.equal(deployment.search, ""); assert.equal(deployment.username, ""); assert.equal(deployment.password, "");
  assert.match(head, /^[a-f0-9]{40}$/u);
  const expectFenced = parseVercelCacheProbeFenceMode(args);
  const readTransport = parseVercelCacheProbeReadTransport(args);
  const privateKey = readFileSync(resolve(option("--private-key")), "utf8");
  const privateValues = [privateKey];
  const sanitize = (error: unknown) => {
    let message = String(error instanceof Error ? error.message : error);
    for (const value of privateValues) message = message.replaceAll(value, "[redacted]");
    return message.replace(/https?:\/\/[^\s<>"']+/gu, value => { try { const url = new URL(value); return url.origin + url.pathname; } catch { return "[url]"; } }).slice(0, 400);
  };
  const manifest = JSON.parse(readFileSync(new URL("./fixtures/vercel-cache-probe/manifest.json", import.meta.url), "utf8"));
  assert.ok(Date.now() < manifest.expiresAt);
  mkdirSync(output, { recursive: true });
  const results: unknown[] = [], proof = { status: "running", sourceHead: head, deployment: deployment.origin,
    generationFenced: expectFenced, readTransport, adapter: "pending ambient verification", scenarios: results, productionWrites: false,
    network: { allowedForeignRequests: 0, blockedExpectedPreviewFeedbackRequests: 0, blockedUnexpectedForeignRequests: 0, deniedRequests: [] as Array<{ classification: string; origin: string | null; pathname: string | null; method: string; resourceType: string }> },
    scope: "Actual Preview ambient cache adapter; per-worker synthetic in-memory SQLite and two real Server Action HTTP contexts; independent HTTP cache-read (transport recorded separately). Not hosted Supabase, multi-region consistency, or Production mutation." };
  const flush = () => writeFileSync(resolve(output, "vercel-cache-probe.json"), JSON.stringify(proof, null, 2) + "\n");
  flush();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(30_000);
  let scenariosCompleted = false;
  await context.route("**/*", async route => {
    const request = route.request();
    const classification = classifyVercelCacheProbeRequest({ url: request.url(), method: request.method(), resourceType: request.resourceType() }, deployment.origin);
    if (classification === "allowed-owned-or-inline") await route.continue();
    else {
      let deniedOrigin: string | null = null, deniedPathname: string | null = null;
      try { const denied = new URL(request.url()); deniedOrigin = denied.origin; deniedPathname = denied.pathname; } catch { /* No raw malformed URL is persisted. */ }
      proof.network.deniedRequests.push({ classification, origin: deniedOrigin, pathname: deniedPathname,
        method: request.method(), resourceType: request.resourceType() });
      if (classification === "expected-denied-preview-feedback") proof.network.blockedExpectedPreviewFeedbackRequests++;
      else proof.network.blockedUnexpectedForeignRequests++;
      await route.abort("blockedbyclient");
    }
  });
  const pageA = await context.newPage(), pageB = await context.newPage();
  const ticket = (run: string, scenario: string, phase: string, worker?: string) => {
    const payload = { requestId: randomUUID(), run, scenario, phase, sourceHead: head, worker,
      expiresAt: Math.min(Date.now() + 600_000, manifest.expiresAt) };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const raw = encoded + "." + sign(null, Buffer.from(encoded), privateKey).toString("base64url");
    privateValues.push(raw);
    return { raw, payload };
  };
  const action = async (page: Page, run: string, scenario: string, phase: string, worker?: string) => {
    const signed = ticket(run, scenario, phase, worker);
    await page.locator('input[name="ticket"]').fill(signed.raw);
    await page.getByRole("button", { name: "Execute fixed phase", exact: true }).click();
    await page.waitForFunction(requestId => {
      try { return JSON.parse(document.querySelector("[data-cache-probe-result]")?.textContent ?? "null")?.requestId === requestId; }
      catch { return false; }
    }, signed.payload.requestId, { timeout: 55_000 });
    const result = JSON.parse(await page.locator("[data-cache-probe-result]").innerText());
    assert.ok(["ok", "expected-reader-failure"].includes(result.status), JSON.stringify({status:result.status,reason:result.reason,diagnostic:result.diagnostic}));
    return result;
  };
  const read = async (run: string, scenario: string, worker: string) => {
    if (readTransport === "action") return action(pageB, run, scenario, "read-after", worker);
    const signed = ticket(run, scenario, "read-after", worker);
    const response = await context.request.get(new URL("/api/verification-cache-probe", deployment).href,
      { headers: { authorization: "Bearer " + signed.raw }, timeout: 30_000, maxRedirects: 0 });
    assert.equal(response.status(), 200);
    const result = await response.json(); assert.equal(result.status, "ok", JSON.stringify({status:result.status,reason:result.reason,diagnostic:result.diagnostic})); return result;
  };
  const statusUntil = async (run: string, scenario: string, worker: string, predicate: (row: Record<string, unknown>) => boolean) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const row = await action(pageB, run, scenario, "status", worker);
      if (predicate(row)) return row;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error("Bounded cache phase observation did not settle.");
  };
  try {
    const accessIndex = args.indexOf("--access-file");
    if (accessIndex >= 0) {
      const access = new URL(readFileSync(resolve(args[accessIndex + 1]), "utf8").trim());
      privateValues.push(access.href);
      assert.equal(access.origin, deployment.origin, "Protection link must belong to this exact deployment.");
      await pageA.goto(access.href, { waitUntil: "domcontentloaded" });
    }
    await Promise.all([pageA, pageB].map(page => page.goto(new URL("/verification-cache-probe", deployment).href, { waitUntil: "domcontentloaded" })));
    await Promise.all([pageA, pageB].map(page => expect(page.getByRole("heading", { name: "Isolated cache verification", exact: true })).toBeVisible()));
    // Invalid signatures never create a DB or expose ambient adapter details.
    await pageB.locator('input[name="ticket"]').fill("invalid.invalid");
    await pageB.getByRole("button", { name: "Execute fixed phase", exact: true }).click();
    await expect(pageB.locator("[data-cache-probe-result]")).toHaveText('{"status":"denied"}');
    for (const scenario of ["no-invalidation", "serial", "reordered", "repeated", "reader-failure"]) {
      const run = randomUUID(), initial = await action(pageA, run, scenario, "init"), worker = initial.worker;
      assert.equal(initial.generationFenced === true, expectFenced, "Deployment fence mode must match the explicitly requested proof.");
      proof.adapter = initial.adapter.binding;
      const row: Record<string, unknown> = { scenario, run, status: "running", adapter: initial.adapter, initial };
      results.push(row); flush();
      let held: Promise<{ result?: Awaited<ReturnType<typeof action>>; error?: unknown }> | null = null;
      try {
        const gated = ["reordered", "repeated", "reader-failure"].includes(scenario);
        if (gated) {
          held = action(pageA, run, scenario, "read-old", worker).then(result => ({ result }), error => ({ error }));
          row.captured = await statusUntil(run, scenario, worker, item => Boolean(item.captureAt));
        } else row.oldRead = await action(pageA, run, scenario, "read-old", worker);
        row.mutation = await action(pageB, run, scenario, "mutate", worker);
        if (scenario !== "no-invalidation") row.invalidated = await statusUntil(run, scenario, worker, item =>
          Array.isArray(item.invalidations) && item.invalidations.length === 1 &&
          item.invalidations.every(value => value.calls === 1 && value.completedAt && !value.failed));
        if (gated) {
          row.release = await action(pageB, run, scenario, "release", worker);
          const completed = await held!;
          if (completed.error) throw completed.error;
          row.oldRead = completed.result;
        }
        const old = row.oldRead as { key: string; callbackSha256?: string; readerSourceSha256?: string; captureAt: number; commitAt: number; releaseAt: number; writeCompleteAt: number; status: string; invalidations: Array<{generation:string;generationCommittedAt:number;startedAt:number;completedAt:number;calls:number}> };
        if (expectFenced && scenario !== "no-invalidation") {
          assert.equal(old.invalidations[0].generation, "1");
          assert.ok(old.commitAt <= old.invalidations[0].generationCommittedAt);
          assert.ok(old.invalidations[0].generationCommittedAt <= old.invalidations[0].startedAt);
        }
        if (gated) {
          assert.ok(old.captureAt <= old.commitAt && old.commitAt <= old.invalidations[0].startedAt);
          assert.ok(old.invalidations[0].startedAt <= old.invalidations[0].completedAt && old.invalidations[0].completedAt <= old.releaseAt);
          if (scenario !== "reader-failure") assert.ok(old.releaseAt <= old.writeCompleteAt);
        }
        if (scenario === "reader-failure") assert.equal(old.status, "expected-reader-failure");
        if (scenario === "repeated") {
          row.secondInvalidation = await action(pageB, run, scenario, "invalidate-again", worker);
          row.secondInvalidationCompleted = await statusUntil(run, scenario, worker, item =>
            Array.isArray(item.invalidations) && item.invalidations.length === 2 &&
            item.invalidations.every(value => value.calls === 1 && value.completedAt && !value.failed));
        }
        if (expectFenced && scenario === "repeated") {
          const second = row.secondInvalidationCompleted as { invalidations: Array<{generation:string;generationCommittedAt:number;startedAt:number}> };
          assert.equal(second.invalidations[1].generation, "2");
          assert.ok(second.invalidations[1].generationCommittedAt <= second.invalidations[1].startedAt);
        }
        const subsequent = await read(run, scenario, worker); row.subsequent = subsequent;
        assert.equal(subsequent.adapter.constructorSha256, initial.adapter.constructorSha256);
        if (expectFenced) {
          assert.equal(subsequent.worker, worker, "Synthetic SQL generation requires this same owned worker.");
          assert.equal(subsequent.generationFenced, true);
          if (scenario === "no-invalidation") assert.equal(subsequent.key, old.key);
          else assert.notEqual(subsequent.key, old.key, "Committed generation must select a different cache key.");
          assert.equal(subsequent.generation, scenario === "no-invalidation" ? "0" : scenario === "repeated" ? "2" : "1");
        } else assert.equal(subsequent.key, old.key, "Separate HTTP request did not use the exact same cache key.");
        if (old.callbackSha256) assert.equal(subsequent.callbackSha256, old.callbackSha256);
        assert.match(subsequent.readerSourceSha256, /^[a-f0-9]{64}$/u);
        if (old.readerSourceSha256) assert.equal(subsequent.readerSourceSha256, old.readerSourceSha256);
        assert.equal(subsequent.sourceRevision, "New");
        if (scenario === "no-invalidation") {
          assert.equal(subsequent.value.revision, "Old"); assert.equal(subsequent.callbackCount, 0);
        } else if (scenario === "reordered" && !expectFenced) {
          assert.ok(["Old", "New"].includes(subsequent.value.revision));
          row.classification = subsequent.value.revision === "Old" && subsequent.callbackCount === 0
            ? "stale-refill-reproduced-on-actual-preview-adapter" : "stale-refill-not-observed";
          if (subsequent.value.revision === "Old") assert.equal(subsequent.callbackCount, 0);
          else assert.equal(subsequent.callbackCount, 1);
        } else { assert.equal(subsequent.value.revision, "New"); assert.equal(subsequent.callbackCount, 1); }
        if (expectFenced && scenario === "reordered") row.classification = "late-old-fill-isolated-by-production-generation-helper";
        const hit = await read(run, scenario, worker);
        assert.deepEqual(hit.value, subsequent.value); assert.equal(hit.callbackCount, 0);
        assert.equal(hit.key, subsequent.key); assert.equal(hit.callbackSha256, subsequent.callbackSha256);
        assert.equal(hit.readerSourceSha256, subsequent.readerSourceSha256); row.followupHit = hit;
        row.cleanup = await action(pageB, run, scenario, "cleanup", worker);
        row.status = "pass"; flush();
      } catch (error) {
        if (held) await held;
        row.status = "inconclusive"; row.reason = sanitize(error);
        try { row.cleanup = await action(pageB, run, scenario, "cleanup", worker); }
        catch { row.cleanup = { status: "not-confirmed", expiryCleanupOnWorker: true }; }
        flush(); throw error;
      }
    }
    scenariosCompleted = true;
  } catch (error) {
    proof.status = "inconclusive";
    results.push({ phase: "driver", status: "inconclusive", reason: sanitize(error) });
    process.exitCode = 1;
  } finally {
    await context.close(); await browser.close();
    // Check after the guarded context closes, so late foreign traffic cannot follow a premature complete receipt.
    if (scenariosCompleted) {
      try {
        assert.equal(proof.network.allowedForeignRequests, 0);
        assert.equal(proof.network.blockedUnexpectedForeignRequests, 0, "Unexpected foreign request was denied.");
        proof.status = "complete";
      } catch (error) {
        proof.status = "inconclusive";
        results.push({ phase: "network-policy", status: "inconclusive", reason: sanitize(error) });
        process.exitCode = 1;
      }
    }
    flush();
  }
  console.log(JSON.stringify({ status: proof.status, sourceHead: head, receiptSha256: createHash("sha256").update(readFileSync(resolve(output, "vercel-cache-probe.json"))).digest("hex") }));
} else {
  throw Error("Expected prepare or run with the fixed deployment/head/output/private-key options.");
}
