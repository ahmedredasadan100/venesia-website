import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCoreFormPermissionReplayCollector } from "./admin-core-form-permission-replay.mjs";

/** Existing local file broker only; request bodies and credentials stay in the collector's memory. */
export function createCoreNativeCheckpoint({ origin, output }) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  async function nativeCheckpoint(request) {
    const temporary=join(output,"core-native-request-"+request.id+".tmp"),target=join(output,"core-native-request-"+request.id+".json");
    assert.equal(existsSync(target),false);
    writeFileSync(temporary,JSON.stringify(request));renameSync(temporary,target);
    const response=join(output,"core-native-response-"+request.id+".json"),deadline=Date.now()+60_000;
    while(!existsSync(response)) {
      assert.ok(Date.now()<deadline,"The fixed native checkpoint did not arrive.");
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const result=JSON.parse(readFileSync(response,"utf8"));
    assert.equal(result.id,request.id);assert.equal(result.kind,request.kind);
    assert.notEqual(result.status,"fail","The fixed native invariant failed.");
    return result;
  }
  return nativeCheckpoint;
}

export function createCoreFormPermissionContext({ page, origin, output, sourceSha256, requiredCases }) {
  const nativeCheckpoint=createCoreNativeCheckpoint({origin,output});
  const collector=createCoreFormPermissionReplayCollector({page,origin,sourceSha256,requiredCases,nativeCheckpoint});
  return {
    begin:collector.begin,
    close:collector.close,
    nativeSave:async(descriptors,metadata)=>{
      assert.deepEqual(Object.keys(metadata).sort(),["caseId","formConsumer","startedAt","surface"]);
      assert.ok(Array.isArray(descriptors)&&descriptors.length>0&&descriptors.length<=4);
      return nativeCheckpoint({id:randomUUID(),kind:"form-save-native",descriptors,...metadata});
    },
  };
}
