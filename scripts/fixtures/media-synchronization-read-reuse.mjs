import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Execute the actual synchronization owner; isolate Catalog, provider and RPC ports.
// No database, Storage or network writes occur in this fixture.
function harness(sourceRoot, options = {}) {
  const state = { catalogReads: 0, scans: [], rpcCalls: [], uncertainMarks: [], logs: [] };
  const assetMap = revision => new Map([["fixture-identity", { id: `asset-${revision}` }]]);
  const context = { provider: "local", environment: "test", identity: "isolated" };
  const ports = {
    "../../supabase-admin": { getSupabaseAdmin: () => ({ rpc: async (name, args) => {
      assert.equal(name, "replace_media_references_for_entity");
      state.rpcCalls.push(args);
      return { error: options.rpcFailure === args.p_entity_identity ? { code: "fixture_rpc_failed" } : null };
    } }) },
    "../media-storage-adapter": { resolveMediaStorageRuntimeContext: () => context },
    "./catalog": {
      getAllCatalogAssetIdentityMap: async () => {
        const revision = ++state.catalogReads;
        if (options.catalogRead) return options.catalogRead(revision, assetMap);
        if (options.catalogFailure) throw new Error("fixture_catalog_failed");
        return options.missingAsset ? new Map() : assetMap(revision);
      },
      getMediaCatalogRuntimeState: async () => ({ state: "synced", warnings: [] }),
      setMediaCatalogRuntimeState: async value => { state.uncertainMarks.push(value); },
    },
    "./identity": { getCanonicalMediaIdentityKey: identity => identity.key },
    "./reference-providers": {
      MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION: "fixture",
      getMediaReferenceProvider: domainKey => domainKey === "missing-provider" ? null : ({
        domainKey, entityType: domainKey,
        scanEntity: async entityIdentity => {
          state.scans.push({ domainKey, entityIdentity });
          if (options.scanFailure === entityIdentity) throw new Error("fixture_scan_failed");
          if (entityIdentity.startsWith("cleanup-empty")) return [];
          return [{ identity: { key: "fixture-identity" }, domainKey, entityType: domainKey, entityIdentity,
            entityLabel: "Fixture", fieldKey: "image", editHref: "/admin/fixture", publicHref: null,
            referenceState: "active", restorable: false }];
        },
      }),
    },
    "./write-lease": {},
  };
  const modules = new Map();
  function load(relative) {
    const absolute = path.resolve(sourceRoot, relative);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const loadedModule = { exports: {} }; modules.set(absolute, loadedModule);
    const nativeRequire = createRequire(absolute);
    const require = name => {
      if (name === "server-only") return {};
      if (ports[name]) return ports[name];
      if (!name.startsWith(".")) return nativeRequire(name);
      return load(path.resolve(path.dirname(absolute), `${name}.ts`));
    };
    const code = ts.transpileModule(readFileSync(absolute, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function("require", "module", "exports", "console", code)(require, loadedModule, loadedModule.exports,
      { error: (...args) => state.logs.push(args) });
    return loadedModule.exports;
  }
  return { owner: load("src/lib/admin/media-catalog/synchronization.ts"), state };
}

const target = (index, domainKey = "project_media") => ({ domainKey, entityIdentity: String(index), leaseEntityIdentity: `lease-${index}` });
const targets = count => Array.from({ length: count }, (_, index) => target(index + 1));
const cleanup = entityIdentity => ({ domainKey: "project_media", entityIdentity });

export async function verifyMediaSynchronizationReadReuse({ sourceRoot = process.cwd(), baseline = false, onCheck = () => {} } = {}) {
  const observations = [];
  let checks = 0;
  const check = (label, actual, expected = true) => { assert.deepEqual(actual, expected, label); checks++; onCheck(label); };
  for (const count of [6, 25]) {
    const { owner, state } = harness(sourceRoot);
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(count), "active-lease");
    check(`${count} target batch reads Catalog once per invocation`, state.catalogReads, baseline ? count : 1);
    check(`${count} target batch scans every actual provider target`, state.scans.length, count);
    check(`${count} target batch preserves each lease-bound synchronization RPC`, state.rpcCalls.map(args => [args.p_lease_token, args.p_lease_entity_identity]), targets(count).map(row => ["active-lease", row.leaseEntityIdentity]));
    check(`${count} target batch keeps complete reference result`, [result.status, result.referenceCount, result.explicitEmpty], ["synced", count, false]);
    observations.push({ targets: count, catalogReads: state.catalogReads, providerScans: state.scans.length, synchronizationRpcs: state.rpcCalls.length });
  }
  {
    const { owner, state } = harness(sourceRoot);
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2), "active-lease", [cleanup("cleanup-empty-1"), cleanup("cleanup-empty-2")]);
    check("write and cleanup targets share only their invocation Catalog read", state.catalogReads, baseline ? 4 : 1);
    check("cleanup retains explicit empty references and no write lease identity", state.rpcCalls.filter(args => args.p_entity_identity.startsWith("cleanup-")).map(args => [args.p_references, args.p_lease_token, args.p_lease_entity_identity]), [[[], null, "cleanup-empty-1"], [[], null, "cleanup-empty-2"]]);
    check("mixed write and explicit-empty cleanup remains synced", result.status, "synced");
  }
  {
    const { owner, state } = harness(sourceRoot);
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation([], null);
    check("empty batch does not acquire Catalog or provider data", [state.catalogReads, state.scans.length, state.rpcCalls.length, result.explicitEmpty], [0, 0, 0, true]);
    const missing = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation([target(1, "missing-provider")], null);
    check("missing provider does not start an unused Catalog read", [state.catalogReads, missing.status, state.uncertainMarks.length], [0, "saved_with_media_sync_warning", 1]);
  }
  {
    const { owner, state } = harness(sourceRoot, { catalogFailure: true });
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(3), "active-lease");
    check("Catalog rejection is shared without retrying or emitting synchronization writes", [state.catalogReads, state.scans.length, state.rpcCalls.length], [baseline ? 3 : 1, 3, 0]);
    check("Catalog rejection retains each target's uncertainty", [result.status, result.uncertainties.length, state.uncertainMarks.length], ["saved_with_media_sync_warning", 3, 3]);
  }
  for (const options of [{ scanFailure: "2" }, { rpcFailure: "2" }, { missingAsset: true }]) {
    const { owner, state } = harness(sourceRoot, options);
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(3), "active-lease");
    const writes = options.scanFailure ? 2 : options.rpcFailure ? 3 : 0;
    check(`${Object.keys(options)[0]} retains fail-closed per-target handling`, [result.status, state.rpcCalls.length, state.uncertainMarks.length], ["saved_with_media_sync_warning", writes, options.missingAsset ? 3 : 1]);
  }
  {
    const { owner, state } = harness(sourceRoot);
    const result = await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation([], null, [cleanup("cleanup-nonempty")]);
    check("nonempty cleanup never counts as successful empty cleanup", [result.status, result.uncertainties.includes("media_reference_cleanup_not_explicit_empty:project_media:cleanup-nonempty"), state.uncertainMarks.length], ["saved_with_media_sync_warning", true, 1]);
  }
  {
    const gates = [];
    const { owner, state } = harness(sourceRoot, { catalogRead: (revision, map) => new Promise(resolve => { gates.push(() => resolve(map(revision))); }) });
    const first = owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2), "lease-first");
    const second = owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2), "lease-second");
    check("overlapping invocations never share a Catalog promise", state.catalogReads, baseline ? 4 : 2);
    for (const resolve of gates) resolve();
    await Promise.all([first, second]);
    if (!baseline) check("each overlapping invocation retains its own fresh Catalog identities", state.rpcCalls.map(args => [args.p_lease_token, args.p_references[0].assetId]).sort(), [["lease-first", "asset-1"], ["lease-first", "asset-1"], ["lease-second", "asset-2"], ["lease-second", "asset-2"]]);
    const next = owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(1), "lease-next");
    gates.at(-1)(); await next;
    check("later invocation performs a fresh Catalog read", state.catalogReads, baseline ? 5 : 3);
  }
  {
    const { owner, state } = harness(sourceRoot);
    await owner.syncMediaReferencesForEntity("projects", "1");
    await owner.synchronizeMediaReferencesAfterDomainMutation("projects", "1");
    check("standalone exported synchronization reads remain fresh", state.catalogReads, 2);
  }
  return { sourceRoot, baseline, checks, observations, scope: "Actual synchronization owner with isolated Catalog/provider/RPC ports; no live timing or database claim" };
}
