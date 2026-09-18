import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

// Execute the actual synchronization owner; isolate Catalog, provider and RPC ports.
// No database, Storage or network writes occur in this fixture.
function harness(sourceRoot, options = {}) {
  const state = { catalogReads: 0, scans: [], batchScans: [], providerQueries: [], rpcCalls: [], uncertainMarks: [], logs: [] };
  const assetMap = revision => new Map([["fixture-identity", { id: `asset-${revision}` }]]);
  const context = { provider: "local", environment: "test", identity: "isolated" };
  const ports = {
    "../../supabase-admin": { getSupabaseAdmin: () => ({
      from: table => {
        const query = { table };
        return {
          select(columns) { query.columns = columns; return this; },
          in(field, identities) { query.field = field; query.identities = identities; return this; },
          eq(field, identity) { query.field = field; query.identities = [identity]; return this; },
          order(field, order) { query.order = { field, ...order }; return this; },
          range(from, to) {
            query.range = [from, to]; state.providerQueries.push(query);
            return Promise.resolve({ data: options.providerRows?.(query) ?? [], error: options.providerError ?? null });
          },
        };
      },
      rpc: async (name, args) => {
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
    "./identity": { getCanonicalMediaIdentityKey: identity => identity.key,
      parseLegacyPublicMediaAsset: value => typeof value === "string" && value.startsWith("/images/") ? {key:"fixture-identity"} : null },
    "../../storage/upload-cms-asset": { parseManagedStorageAsset: () => null },
    "../content/content-types": { isContentType: () => true },
    "../../content/public-content-path": { resolvePublicContentPath: () => "/fixture" },
    "../seo/entity-seo-persistence": { TOPIC_SEO_SOURCE_COLUMNS: [], PERSISTED_ENTITY_SEO_FIELDS: [] },
    "./reference-providers": {
      MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION: "fixture",
      getMediaReferenceProvider: domainKey => domainKey === "missing-provider" ? null : ({
        domainKey, entityType: domainKey,
        scanEntity: async entityIdentity => {
          state.scans.push({ domainKey, entityIdentity });
          if (options.scanFailure === entityIdentity) throw new Error("fixture_scan_failed");
          if (entityIdentity.startsWith("cleanup-empty")) return [];
          return [{ identity: { key: "fixture-identity" }, domainKey, entityType: domainKey,
            entityIdentity: options.fallbackForeignResult === entityIdentity ? "foreign" : entityIdentity,
            entityLabel: "Fixture", fieldKey: "image", editHref: "/admin/fixture", publicHref: null,
            referenceState: "active", restorable: false }];
        },
        ...(options.batched ? { scanEntities: async identities => {
          state.batchScans.push({domainKey, identities});
          if (options.batchFailure) throw new Error("fixture_batch_failed");
          if (options.batchRead) return options.batchRead(domainKey, identities);
          return new Map(identities.filter(entityIdentity => entityIdentity !== options.missingResult).map(entityIdentity => [entityIdentity,
            entityIdentity.startsWith("cleanup-empty") ? [] : [{ identity:{key:"fixture-identity"}, domainKey,
              entityType:domainKey, entityIdentity:options.foreignResult === entityIdentity ? "foreign" : entityIdentity,
              entityLabel:"Fixture", fieldKey:"image", editHref:"/admin/fixture", publicHref:null, referenceState:"active", restorable:false }]]));
        } } : {}),
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
      if (name === "./reference-providers" && options.actualProviders) return load("src/lib/admin/media-catalog/reference-providers.ts");
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
  return { owner: load("src/lib/admin/media-catalog/synchronization.ts"),
    providers: options.actualProviders ? load("src/lib/admin/media-catalog/reference-providers.ts") : null, state };
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
  if (!baseline) {
    {
      const { owner, state } = harness(sourceRoot, {batched:true});
      const entries=[target(1,"projects"),...targets(12).map(row=>({...row,domainKey:"project_floor_plans"})),...targets(3)];
      const result=await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(entries,"batch-lease",[cleanup("cleanup-empty-1")]);
      check("heavy aggregate groups only its requested provider identities",state.batchScans.map(row=>[row.domainKey,row.identities.length]),[["projects",1],["project_floor_plans",12],["project_media",4]]);
      check("grouped scans preserve every target RPC and lease identity",state.rpcCalls.slice(0,16).map(row=>[row.p_domain_key,row.p_entity_identity,row.p_lease_entity_identity,row.p_lease_token]),entries.map(row=>[row.domainKey,row.entityIdentity,row.leaseEntityIdentity,"batch-lease"]));
      check("grouped cleanup remains explicit-empty and lease-free",state.rpcCalls.at(-1).p_references.length===0&&state.rpcCalls.at(-1).p_lease_token===null);
      check("grouped aggregate retains all reference results",[result.status,result.referenceCount,state.catalogReads,state.scans.length],["synced",16,1,0]);
    }
    {
      const {owner,state}=harness(sourceRoot,{batched:true,batchFailure:true,scanFailure:"2"});
      const result=await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(3),"batch-failure");
      check("failed group falls back to existing per-target failure isolation",[state.batchScans.length,state.scans.length,state.rpcCalls.map(row=>row.p_entity_identity),result.status,state.uncertainMarks.length],[1,3,["1","3"],"saved_with_media_sync_warning",1]);
    }
    for (const options of [{foreignResult:"2"}, {missingResult:"2"}, {batchFailure:true,fallbackForeignResult:"2"}]) {
      const {owner,state}=harness(sourceRoot,{batched:true,...options});
      const result=await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(3),"invalid-group");
      check(`${Object.keys(options).at(-1)} cannot write unproved references into an entity`,[state.rpcCalls.map(row=>row.p_entity_identity),result.status,state.uncertainMarks.length],[["1","3"],"saved_with_media_sync_warning",1]);
    }
    {
      const {owner,state}=harness(sourceRoot,{batched:true,rpcFailure:"2"});
      const result=await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation([target(1),target(2),target(1)],"duplicate-targets",[cleanup("cleanup-nonempty")]);
      check("duplicate targets reuse only their read and retain each synchronization RPC",[state.batchScans[0].identities,state.rpcCalls.map(row=>row.p_entity_identity)],[["1","2","cleanup-nonempty"],["1","2","1","cleanup-nonempty"]]);
      check("grouped RPC failure and nonempty cleanup retain their warnings",[result.status,state.uncertainMarks.length,result.uncertainties.includes("media_reference_cleanup_not_explicit_empty:project_media:cleanup-nonempty")],["saved_with_media_sync_warning",2,true]);
    }
    {
      const gates=[];
      const {owner,state}=harness(sourceRoot,{batched:true,batchRead:(domainKey,identities)=>{
        assert.equal(domainKey,"project_media");
        return new Promise(resolve=>gates.push(()=>resolve(new Map(identities.map(id=>[id,[]])))));
      }});
      const first=owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2),"first");
      const second=owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2),"second");
      check("overlapping operations own separate provider scan promises",state.batchScans.length,2);
      gates.forEach(resolve=>resolve());await Promise.all([first,second]);
      const next=owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets(2),"next");gates.at(-1)();await next;
      check("later operation reads provider data afresh",state.batchScans.length,3);
      await owner.syncMediaReferencesForEntity("projects","1");
      check("standalone synchronization retains its individual fresh scan",state.scans.length,1);
    }
    {
      const {providers,state}=harness(sourceRoot,{actualProviders:true,providerRows:query=>query.identities.filter(id=>id!=="missing").map(id=>({id:Number(id),image:"/images/fixture.jpg"})).reverse()});
      const provider=providers.getMediaReferenceProvider("projects");
      const ids=Array.from({length:401},(_,index)=>String(index+1));
      const result=await provider.scanEntities([...ids,"missing","1"]);
      check("provider queries chunk unique requested identities at the existing 200-row bound",state.providerQueries.map(query=>[query.field,query.identities.length,query.range]),[["id",200,[0,199]],["id",200,[0,199]],["id",2,[0,199]]]);
      check("reordered provider rows retain exact identities and missing rows are explicit empty",[result.get("1")[0].entityIdentity,result.get("401")[0].entityIdentity,result.get("missing"),result.size],["1","401",[],402]);
      const before=state.providerQueries.length;await provider.scanEntities([]);
      check("empty provider identity group performs no read",state.providerQueries.length,before);
      await assert.rejects(provider.scanEntities([""]),/invalid_entity_identity/);
      check("invalid requested identity is rejected before querying",state.providerQueries.length,before);
    }
    for(const row of [{id:999,image:"/images/fixture.jpg"}, {id:1,image:"/images/fixture.jpg"}]) {
      const {providers}=harness(sourceRoot,{actualProviders:true,providerRows:()=>row.id===1?[row,row]:[row]});
      await assert.rejects(providers.getMediaReferenceProvider("projects").scanEntities(["1"]),/unexpected_entity_identity/);
      check(row.id===1?"duplicate primary-key rows fail closed":"unrequested returned entity fails closed",true);
    }
    {
      const keys=["seo.global","footer.\"literal,key\"", "absent"];
      const {providers,state}=harness(sourceRoot,{actualProviders:true,providerRows:query=>query.identities.filter(key=>key!=="absent").map(key=>({key,value:{}}))});
      const result=await providers.getMediaReferenceProvider("site_settings").scanEntities(keys);
      check("text primary keys pass unchanged through the typed in filter",[state.providerQueries[0].field,state.providerQueries[0].identities,[...result.keys()]],["key",keys,keys]);
    }
  }
  return { sourceRoot, baseline, checks, observations, scope: "Actual synchronization owner with isolated Catalog/provider/RPC ports; no live timing or database claim" };
}
