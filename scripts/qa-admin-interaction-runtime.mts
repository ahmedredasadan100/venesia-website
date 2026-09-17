import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { validateAcceptedAdminAfter11, validateAcceptedAdminAfter12, validateAcceptedAdminBefore09 } from "./lib/isolated-public-verification.mts";
import { runIsolatedSupabase } from "./lib/isolated-supabase.mts";

const root=resolve(import.meta.dirname,"..");
const base=resolve(root,".tmp-qa/admin-near-instant-continuation-2026-09-17");
const args=process.argv.slice(2);assert.ok(args.length===6||args.length===7);assert.equal(args[0],"--cli-binary");assert.equal(args[2],"--docker-binary");assert.equal(args[4],"--attempt");assert.match(args[5],/^\d{2}$/u);
const resumeCorrection=args[6]==="--resume-final-correction-after",resumeFinal=args[6]==="--resume-final-after"||resumeCorrection,resumeAfter=args.length===7;
if(resumeAfter)assert.ok(args[6]==="--resume-after"||resumeFinal);if(resumeFinal)assert.equal(args[5],resumeCorrection?"13":"12");
const control=join(base,resumeCorrection?"control-final-correction":resumeFinal?"control-final-delta":"control");mkdirSync(control,{recursive:true});
if(resumeAfter){const accepted=validateAcceptedAdminBefore09();const retainedAfter=resumeFinal?validateAcceptedAdminAfter11():null;const retainedCorrection=resumeCorrection?validateAcceptedAdminAfter12():null;assert.ok(existsSync(join(base,resumeCorrection?"after-source-manifest-v5.json":resumeFinal?"after-source-manifest-v4.json":"after-source-manifest-v3.json")));writeFileSync(join(base,`resume-after-${args[5]}.json`),`${JSON.stringify({...accepted,...(retainedAfter?{retainedAfter}: {}),...(retainedCorrection?{retainedCorrection}:{})},null,2)}\n`,{flag:"wx"});}
const runName=`production-runtime-${args[5]}`;
const result=await runIsolatedSupabase({lockPath:resolve(root,"scripts/fixtures/isolated-supabase/stack.lock.json"),artifactDir:join(base,runName),
  cliBinary:resolve(args[1]),dockerBinary:resolve(args[3]),handoff:async handle=>{
    await runApplicationHandoff(handle);
    await handle.preparePublicVerification();
    let fixtures:Record<string,unknown>|undefined;
    for(let attempt=1;attempt<=6;attempt++) {
      try {fixtures=await handle.prepareAdminInteractions();break;}
      catch(error) {
        writeFileSync(join(control,`fixture-preparation-${args[5]}-${attempt}.json`),`${JSON.stringify({status:"paused-on-fixture-error",attempt,code:error&&typeof error==="object"&&"code" in error?error.code:null,sourceRepairOnly:true,qualityPassClaimed:false},null,2)}\n`,{flag:"wx"});
        const commandPath=join(control,`fixture-repair-${args[5]}-${attempt}.json`),deadline=Date.now()+1_800_000;
        while(!existsSync(commandPath)&&Date.now()<deadline) {await handle.query("select 1 as owned_fixture_repair_wait");await new Promise(done=>setTimeout(done,5_000));}
        assert.ok(existsSync(commandPath),"Fixed fixture repair control lease expired");
        assert.deepEqual(JSON.parse(readFileSync(commandPath,"utf8")),{operation:"retry-fixed-fixtures"});
      }
    }
    assert.ok(fixtures,"Fixed fixture repair attempts exhausted");
    if(resumeFinal)assert.deepEqual(JSON.parse(readFileSync(join(base,"control/fixtures.json"),"utf8")),fixtures,"Final delta fixture model differs from the accepted canonical model");
    const fixtureReceipt=join(control,"fixtures.json");
    if(existsSync(fixtureReceipt)) assert.deepEqual(JSON.parse(readFileSync(fixtureReceipt,"utf8")),fixtures,"Preserved fixture IDs/model differ from the new owned preparation");
    else writeFileSync(fixtureReceipt,`${JSON.stringify(fixtures,null,2)}\n`,{flag:"wx"});
    if(!resumeAfter){
      const before=await handle.runPublicVerification({additionalSourceFiles:[],selection:"admin-interactions",adminMeasurement:{phase:"before",frozenSourceManifest:join(base,"baseline-source-manifest.json"),controlDirectory:control}});
      writeFileSync(join(control,"before-lifecycle.json"),`${JSON.stringify(before,null,2)}\n`,{flag:"wx"});
    }
    const afterManifest=join(base,resumeCorrection?"after-source-manifest-v5.json":resumeFinal?"after-source-manifest-v4.json":resumeAfter?"after-source-manifest-v3.json":"after-source-manifest.json");const deadline=Date.now()+3_600_000;
    while(!existsSync(afterManifest) && Date.now()<deadline) { await handle.query("select 1 as owned_measurement_phase_wait");await new Promise(done=>setTimeout(done,10_000)); }
    assert.ok(existsSync(afterManifest),"Awaited frozen After source did not arrive within lease");
    if(!resumeAfter){
      const reset=await handle.prepareAdminInteractions();
      writeFileSync(join(control,"after-fixture-reset.json"),`${JSON.stringify(reset,null,2)}\n`,{flag:"wx"});
    }else writeFileSync(join(control,`after-fresh-fixtures-${args[5]}.json`),`${JSON.stringify({fixtures,identicalAcceptedModel:true,initialSeedOnly:true,priorDatabaseRemoved:true},null,2)}\n`,{flag:"wx"});
    const after=await handle.runPublicVerification({additionalSourceFiles:[],selection:"admin-interactions",adminMeasurement:{phase:"after",frozenSourceManifest:afterManifest,controlDirectory:control,...(resumeAfter?{resumeAfterFromRuntime09:true as const}:{}),...(resumeFinal?{resumeFinalAfterFromRuntime11:true as const}:{}),...(resumeCorrection?{resumeCorrectionAfterFromRuntime12:true as const}:{})}});
    writeFileSync(join(control,"after-lifecycle.json"),`${JSON.stringify(after,null,2)}\n`,{flag:"wx"});
  }});
writeFileSync(join(base,`${runName}-result.json`),`${JSON.stringify(result,null,2)}\n`,{flag:"wx"});
assert.equal(JSON.parse(readFileSync(join(base,`${runName}/cleanup.json`),"utf8")).status,"complete");
