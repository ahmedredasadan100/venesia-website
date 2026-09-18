import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { validateAcceptedAdminAfter11, validateAcceptedAdminAfter12, validateAcceptedAdminBefore09 } from "./lib/isolated-public-verification.mts";
import { assertOwnedLocalHandle, runIsolatedSupabase, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

const root=resolve(import.meta.dirname,"..");
const args=process.argv.slice(2);assert.ok(args.length===6||args.length===7);assert.equal(args[0],"--cli-binary");assert.equal(args[2],"--docker-binary");assert.equal(args[4],"--attempt");assert.match(args[5],/^\d{2}$/u);
const closureStudy=args[6]==="--study=heavy-editor-closure";
const heavyStudy=closureStudy||args[6]==="--study=heavy-editor-performance";
const base=resolve(root,closureStudy?".tmp-qa/heavy-editor-closure-2026-09-18":heavyStudy?".tmp-qa/heavy-editor-performance-excellence-2026-09-18":".tmp-qa/admin-near-instant-continuation-2026-09-17");
const study=heavyStudy?{study:"heavy-editor-performance" as const,...(closureStudy?{round:"closure" as const}:{})}:{};
const fixtureStudy=heavyStudy?{study:"heavy-editor-performance" as const}:undefined;
const resumeCorrection=args[6]==="--resume-final-correction-after",resumeFinal=args[6]==="--resume-final-after"||resumeCorrection,resumeAfter=args.length===7&&!heavyStudy;
if(resumeAfter)assert.ok(args[6]==="--resume-after"||resumeFinal);if(resumeFinal)assert.equal(args[5],resumeCorrection?"13":"12");
const control=join(base,resumeCorrection?"control-final-correction":resumeFinal?"control-final-delta":"control");mkdirSync(control,{recursive:true});
if(resumeAfter){const accepted=validateAcceptedAdminBefore09();const retainedAfter=resumeFinal?validateAcceptedAdminAfter11():null;const retainedCorrection=resumeCorrection?validateAcceptedAdminAfter12():null;assert.ok(existsSync(join(base,resumeCorrection?"after-source-manifest-v5.json":resumeFinal?"after-source-manifest-v4.json":"after-source-manifest-v3.json")));writeFileSync(join(base,`resume-after-${args[5]}.json`),`${JSON.stringify({...accepted,...(retainedAfter?{retainedAfter}: {}),...(retainedCorrection?{retainedCorrection}:{})},null,2)}\n`,{flag:"wx"});}
const runName=`production-runtime-${args[5]}`;

// Fixed public fixture/read relations only: no Auth, settings, audit, secrets,
// migration history or unrelated application tables are read into this receipt.
const fixtureRelations = [
  "projects", "project_locations", "project_location_points", "project_features",
  "project_floor_plans", "project_floor_plan_details", "project_delivery_items", "project_media", "project_videos",
  "topics", "topic_categories", "topic_series", "pages",
  "content_block_templates", "cta_block_templates", "cards_block_templates", "breadcrumb_block_templates",
  "feed_module_templates", "featured_module_templates", "hero_templates", "media_sidebar_module_templates", "media_hub_module_templates",
  "page_content_block_assignments", "page_cta_block_assignments", "page_cards_block_assignments", "page_breadcrumb_block_assignments",
  "page_feed_module_assignments", "page_featured_module_assignments", "hero_assignments", "page_media_sidebar_module_assignments", "page_media_hub_module_assignments",
  "admin_media_assets_catalog", "admin_media_folders_catalog",
] as const;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fixtureSources = ["scripts/fixtures/admin-interaction-fixtures.mts", "scripts/fixtures/admin-page-interaction-fixtures.mts"] as const;
const captureFixtureIdentity = async (handle: OwnedLocalHandle, phase: "calibration-initial" | "before" | "after") => {
  assertOwnedLocalHandle(handle);
  const startedAt = new Date().toISOString();
  const rows: Array<{ relation: string; rowCount: number; fullSha256: string; logicalSha256: string }> = [];
  await handle.query("begin isolation level repeatable read read only");
  try {
    for (const relation of fixtureRelations) {
      assert.match(relation, /^[a-z_]+$/u);
      const result = await handle.query(`select to_jsonb(fixture_row)::text as full_row,
        (to_jsonb(fixture_row) - array['created_at','updated_at'])::text as logical_row
        from public.${relation} as fixture_row`);
      const full = result.rows.map(row => { assert.equal(typeof row.full_row, "string"); return row.full_row as string; }).sort();
      const logical = result.rows.map(row => { assert.equal(typeof row.logical_row, "string"); return row.logical_row as string; }).sort();
      rows.push({ relation, rowCount: result.rows.length, fullSha256: hash(JSON.stringify(full)), logicalSha256: hash(JSON.stringify(logical)) });
    }
    await handle.query("commit");
  } catch (error) {
    await handle.query("rollback");
    throw error;
  }
  const manifestPath = join(base, phase === "after" ? "after-source-manifest.json" : "baseline-source-manifest.json");
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/u);
  const result = {
    kind: "heavy-editor-fixed-fixture-data-identity", phase, startedAt, finishedAt: new Date().toISOString(),
    sourceSha256: manifest.sourceSha256, sourceManifestSha256: hash(manifestBytes),
    fixtureSources: fixtureSources.map(file => ({ file, sha256: hash(readFileSync(join(root, file))) })),
    serialization: "PostgreSQL jsonb canonical text; sorted complete row strings; SHA256 of JSON string array; duplicate rows retained",
    logicalExcludedColumns: ["created_at", "updated_at"],
    logicalExclusionReason: "Canonical seed upserts and successful writes refresh bookkeeping timestamps. All IDs, revision counters, publication/deletion timestamps, values and references remain included.",
    scope: "All rows of the fixed 33 public entity, reference, template, assignment and media Catalog relations consumed by this study; not a database-wide snapshot.",
    credentialsOrRowsExported: false, rows,
    fullSha256: hash(JSON.stringify(rows.map(({ relation, rowCount, fullSha256 }) => ({ relation, rowCount, fullSha256 })))),
    logicalSha256: hash(JSON.stringify(rows.map(({ relation, rowCount, logicalSha256 }) => ({ relation, rowCount, logicalSha256 })))),
  };
  writeFileSync(join(control, `${phase}-fixture-data-identity.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return result;
};
const compareFixtureIdentity = (before: Awaited<ReturnType<typeof captureFixtureIdentity>>, after: Awaited<ReturnType<typeof captureFixtureIdentity>>, stage: "calibration" | "reset") => {
  const changedRelations = after.rows.filter(row =>
    row.logicalSha256 !== before.rows.find(beforeRow => beforeRow.relation === row.relation)?.logicalSha256
  ).map(row => row.relation);
  const comparison = {
    kind: `heavy-editor-fixture-${stage}-comparison`, status: changedRelations.length === 0 ? "match" : "mismatch",
    fullRowsMatch: after.fullSha256 === before.fullSha256, logicalRowsMatch: after.logicalSha256 === before.logicalSha256,
    before: before.logicalSha256, after: after.logicalSha256, changedRelations,
    timestampDifferencesAreNotLogicalFailure: true, rowValuesExported: false,
  };
  writeFileSync(join(control, `fixture-data-${stage}-comparison.json`), `${JSON.stringify(comparison, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  assert.equal(comparison.logicalRowsMatch, true, "Fixture logical rows changed; inspect the named relation fingerprints before building.");
};

try {
const result=await runIsolatedSupabase({lockPath:resolve(root,"scripts/fixtures/isolated-supabase/stack.lock.json"),artifactDir:join(base,runName),
  cliBinary:resolve(args[1]),dockerBinary:resolve(args[3]),handoff:async handle=>{
    await runApplicationHandoff(handle, [], heavyStudy ? { mode: "measurement-provision" } : {});
    await handle.preparePublicVerification();
    let fixtures:Record<string,unknown>|undefined;
    for(let attempt=1;attempt<=6;attempt++) {
      try {fixtures=await handle.prepareAdminInteractions(fixtureStudy);break;}
      catch(error) {
        writeFileSync(join(control,`fixture-preparation-${args[5]}-${attempt}.json`),`${JSON.stringify({status:"paused-on-fixture-error",attempt,code:error&&typeof error==="object"&&"code" in error?error.code:null,sourceRepairOnly:true,qualityPassClaimed:false},null,2)}\n`,{flag:"wx"});
        const commandPath=join(control,`fixture-repair-${args[5]}-${attempt}.json`),deadline=Date.now()+1_800_000;
        while(!existsSync(commandPath)&&Date.now()<deadline) {await handle.query("select 1 as owned_fixture_repair_wait");await new Promise(done=>setTimeout(done,5_000));}
        assert.ok(existsSync(commandPath),"Fixed fixture repair control lease expired");
        assert.deepEqual(JSON.parse(readFileSync(commandPath,"utf8")),{operation:"retry-fixed-fixtures"});
      }
    }
    assert.ok(fixtures,"Fixed fixture repair attempts exhausted");
    // One new-fixture calibration, before any build or accepted browser action.
    // This is not a replay of bootstrap, migration, provenance or prior suites.
    const calibrationInitial = heavyStudy ? await captureFixtureIdentity(handle, "calibration-initial") : undefined;
    if (heavyStudy) assert.deepEqual(await handle.prepareAdminInteractions(fixtureStudy), fixtures, "Calibration changed fixture IDs/model.");
    const beforeFixtureIdentity = heavyStudy ? await captureFixtureIdentity(handle, "before") : undefined;
    if (heavyStudy) compareFixtureIdentity(calibrationInitial!, beforeFixtureIdentity!, "calibration");
    if(resumeFinal)assert.deepEqual(JSON.parse(readFileSync(join(base,"control/fixtures.json"),"utf8")),fixtures,"Final delta fixture model differs from the accepted canonical model");
    const fixtureReceipt=join(control,"fixtures.json");
    if(existsSync(fixtureReceipt)) assert.deepEqual(JSON.parse(readFileSync(fixtureReceipt,"utf8")),fixtures,"Preserved fixture IDs/model differ from the new owned preparation");
    else writeFileSync(fixtureReceipt,`${JSON.stringify(fixtures,null,2)}\n`,{flag:"wx"});
    if(!resumeAfter){
      const before=await handle.runPublicVerification({additionalSourceFiles:[],selection:"admin-interactions",adminMeasurement:{...study,phase:"before",frozenSourceManifest:join(base,"baseline-source-manifest.json"),controlDirectory:control}});
      writeFileSync(join(control,"before-lifecycle.json"),`${JSON.stringify(before,null,2)}\n`,{flag:"wx"});
    }
    const afterManifest=join(base,resumeCorrection?"after-source-manifest-v5.json":resumeFinal?"after-source-manifest-v4.json":resumeAfter?"after-source-manifest-v3.json":"after-source-manifest.json");const deadline=Date.now()+3_600_000;
    if (heavyStudy) assert.ok(existsSync(afterManifest), "Keep the Before driver active until After is frozen; its active job owns the renewing database lease.");
    while(!existsSync(afterManifest) && Date.now()<deadline) { await handle.query("select 1 as owned_measurement_phase_wait");await new Promise(done=>setTimeout(done,10_000)); }
    assert.ok(existsSync(afterManifest),"Awaited frozen After source did not arrive within lease");
    if(!resumeAfter){
      const reset=await handle.prepareAdminInteractions(fixtureStudy);
      if (heavyStudy) assert.deepEqual(reset, fixtures, "Before and After must retain the same canonical fixture identities and visible expectations.");
      if (heavyStudy) {
        const afterFixtureIdentity = await captureFixtureIdentity(handle, "after");
        compareFixtureIdentity(beforeFixtureIdentity!, afterFixtureIdentity, "reset");
      }
      writeFileSync(join(control,"after-fixture-reset.json"),`${JSON.stringify(reset,null,2)}\n`,{flag:"wx"});
    }else writeFileSync(join(control,`after-fresh-fixtures-${args[5]}.json`),`${JSON.stringify({fixtures,identicalAcceptedModel:true,initialSeedOnly:true,priorDatabaseRemoved:true},null,2)}\n`,{flag:"wx"});
    const after=await handle.runPublicVerification({additionalSourceFiles:[],selection:"admin-interactions",adminMeasurement:{...study,phase:"after",frozenSourceManifest:afterManifest,controlDirectory:control,...(resumeAfter?{resumeAfterFromRuntime09:true as const}:{}),...(resumeFinal?{resumeFinalAfterFromRuntime11:true as const}:{}),...(resumeCorrection?{resumeCorrectionAfterFromRuntime12:true as const}:{})}});
    writeFileSync(join(control,"after-lifecycle.json"),`${JSON.stringify(after,null,2)}\n`,{flag:"wx"});
  }});
writeFileSync(join(base,`${runName}-result.json`),`${JSON.stringify(result,null,2)}\n`,{flag:"wx"});
assert.equal(JSON.parse(readFileSync(join(base,`${runName}/cleanup.json`),"utf8")).status,"complete");
} finally {
  if (heavyStudy) {
    const privateSessionPath=join(control,"local-browser-session.private.json");
    const sessionFilePresent=existsSync(privateSessionPath);
    if(sessionFilePresent)unlinkSync(privateSessionPath);
    writeFileSync(join(control,`private-session-cleanup-${args[5]}.json`),`${JSON.stringify({
      kind:"heavy-editor-private-browser-session-cleanup",finishedAt:new Date().toISOString(),
      sessionFilePresent,removed:sessionFilePresent,sessionFileRemaining:existsSync(privateSessionPath),credentialsExported:false,
    },null,2)}\n`,{flag:"wx",mode:0o600});
  }
}
