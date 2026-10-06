import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createCoreFormPermissionReplayCollector, classifyFormPermissionHttpResponse, validateFormPermissionFingerprintRequest } from "./fixtures/admin-core-form-permission-replay.mjs";

const origin="http://127.0.0.1:3000", sourceSha256="a".repeat(64), secret="PRIVATE-TEST-BODY-NEVER-ARTIFACT";
const requiredCases=[{key:"form:topic-category-create-edit:create:permission_denied",boundary:"form",consumer:"topic-category-create-edit",surface:"create",scenario:"permission_denied"}];
const mapping={caseId:"actual-category-create",formConsumer:"topic-category-create-edit",surface:"create"};
const checks=[];
for(const kind of ["redirect-denied","explicit-401","action-login-redirect","original-flight-303","wrong-origin","wrong-url","missing-action","bad-content-type","missing-body","request-body-drift","not-flight","original-failed","not-ui-success","not-native-save","duplicate-actions","duplicate-validation","unknown500","foreign-login","missing-native","wrong-native-id","changed-native","different-owned-run","contaminated-client","transport-secret-error","dispose-secret-error"]){
 const page=new EventEmitter(), originalBody=Buffer.from(secret), headers={"next-action":"1".repeat(40),origin,"content-type":"text/plain;charset=UTF-8",accept:"text/x-component",cookie:"PRIVATE-COOKIE"};
 let posts=0,disposed=0,checkpoints=0,created=0,drift=false;
 if(kind==="wrong-origin")headers.origin="http://127.0.0.1:3001";
 if(kind==="missing-action")delete headers["next-action"];
 if(kind==="bad-content-type")headers["content-type"]="application/octet-stream";
 const request={method:()=>"POST",url:()=>kind==="wrong-url"?origin+"/admin/login":origin+"/admin/content/categories/new",
  headers:()=>headers,allHeaders:async()=>headers,postDataBuffer:()=>kind==="missing-body"?null:Buffer.from(drift?"different-private-input":originalBody)};
 const createRequestContext=async options=>{
  created++;assert.deepEqual(options.storageState,{cookies:[],origins:[]});assert.equal(options.ignoreHTTPSErrors,false);
  return {storageState:async()=>({cookies:kind==="contaminated-client"?[{name:"leak"}]:[],origins:[]}),
   post:async(url,options)=>{
    posts++;assert.equal(url,origin+"/admin/content/categories/new");assert.equal(options.headers.origin,origin);assert.equal(options.headers["next-action"],headers["next-action"]);
    assert.equal(Object.keys(options.headers).some(key=>["cookie","authorization"].includes(key.toLowerCase())),false);
    assert.ok(options.data.equals(originalBody));assert.equal(options.maxRedirects,0);assert.equal(options.maxRetries,0);assert.equal(options.failOnStatusCode,false);
    if(kind==="transport-secret-error")throw Error(secret);
    const status=kind==="explicit-401"?401:kind==="duplicate-validation"?200:kind==="unknown500"?500:kind==="action-login-redirect"?200:307;
    return {status:()=>status,headers:()=>kind==="explicit-401"?{"content-type":"application/json"}:kind==="action-login-redirect"?{"x-action-redirect":"/admin/login;replace"}:{location:kind==="foreign-login"?"https://example.invalid/admin/login":"/admin/login?next=%2Fadmin"},
     json:async()=>({error:"Unauthorized"})};
   },dispose:async()=>{disposed++;if(kind==="dispose-secret-error")throw Error(secret);}};
 };
 const nativeCheckpoint=async request=>{
  checkpoints++;if(kind==="missing-native")return null;
  return {...request,id:kind==="wrong-native-id"?"00000000-0000-4000-8000-000000000000":request.id,status:"pass",ownedRunId:kind==="different-owned-run"&&request.phase==="after"?"other-owned-run":"current-owned-run",
   publicTableCount:63,publicTableInventorySha256:"b".repeat(64),publicDataSha256:kind==="changed-native"&&request.phase==="after"?"d".repeat(64):"c".repeat(64),adminAuditIncluded:true,adminUsersIncluded:true};
 };
 const owner=createCoreFormPermissionReplayCollector({page,origin,sourceSha256,requiredCases,nativeCheckpoint,createRequestContext});
 const session=owner.begin(mapping);
 page.emit("request",request);
 if(kind==="duplicate-actions")page.emit("request",{...request});
 page.emit("response",{request:()=>request,status:()=>kind==="original-failed"?500:kind==="original-flight-303"?303:200,headers:()=>({"content-type":kind==="not-flight"?"text/html":"text/x-component"})});
 if(kind==="request-body-drift"){await new Promise(resolve=>setImmediate(resolve));drift=true;}
 const positive=["redirect-denied","explicit-401","action-login-redirect","original-flight-303"].includes(kind);
 try{
  const result=await session.verifyAfterSuccessfulUI({canonicalUiSuccessVerified:kind!=="not-ui-success",nativeSaveVerified:kind!=="not-native-save"});
  assert.equal(positive,true,kind);assert.equal(result.status,"pass");assert.deepEqual(result.automaticCoverage,[]);
  assert.equal(result.denial.actionBodyExecutionProven,false);assert.equal(result.routePathname,"/admin/content/categories/new");
  assert.equal(result.candidateRequiredCase,requiredCases[0].key);assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(posts,1);assert.equal(checkpoints,2);
 }catch(error){assert.equal(positive,false,kind+" "+error.message);assert.equal(error.message.includes(secret),false);assert.match(error.message,/^Form permission verification:/u);}
 assert.equal(page.listenerCount("request"),0);assert.equal(page.listenerCount("response"),0);assert.equal(disposed,created);assert.ok(posts<=1);if(kind==="request-body-drift")assert.equal(posts,0,"Drift must reject before HTTP replay.");
 if(["duplicate-validation","unknown500","foreign-login","transport-secret-error","changed-native","different-owned-run"].includes(kind))assert.equal(checkpoints,2,"After native checkpoint required after attempted HTTP replay.");
 owner.close();checks.push(kind);
}
for(const [status,headers,body] of [[401,{},null],[401,{"content-type":"application/json"},{error:"Duplicate slug"}],[500,{"x-action-redirect":"/admin/login"},null],[200,{location:"/admin/login"},null],[307,{location:origin+"/admin/login-neighbor"},null]]){
 assert.equal(classifyFormPermissionHttpResponse({status,headers,unauthorizedJson:body},origin),null);
 checks.push("classifier-reject-"+status+"-"+checks.length);
}
for(const patch of [{origin:"https://external.invalid"},{sourceSha256:""},{requiredCases:[]},{nativeCheckpoint:null}]){
 assert.throws(()=>{const owner=createCoreFormPermissionReplayCollector({page:new EventEmitter(),origin,sourceSha256,requiredCases,nativeCheckpoint:async()=>{},...patch});owner.begin(mapping);});
 checks.push("invalid-owner-or-mapping-"+checks.length);
}
const nativePath="scripts/verify-admin-core-form-permission-isolated.mts", nativeSource=readFileSync(nativePath,"utf8");
const transpiled=ts.transpileModule(nativeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
for(const kind of ["read-only-complete","unowned","bad-request","empty-tables","missing-audit","unsafe-identifier","bad-checksum","missing-checksum","duplicate-checksum","reordered-checksum","query-failure"]){
 const statements=[],handle={identity:{runId:"owned-fixture-run"},withDatabaseConnection:async task=>task({query:async sql=>{
  statements.push(sql);
  assert.ok(/^(?:begin isolation level repeatable read read only|set local |select |commit$|rollback$)/u.test(sql),"Only read-only fingerprint commands permitted.");
  if(sql.startsWith("select current_database"))return {rows:[{database:"postgres",role:"postgres",readonly:"on",isolation:"repeatable read"}]};
  if(sql.startsWith("select tablename"))return {rows:(kind==="empty-tables"?[]:kind==="missing-audit"?["admin_users"]:kind==="unsafe-identifier"?["admin_audit_logs","admin_users","unsafe\";write"]:["admin_audit_logs","admin_users","project_children"]).map(tablename=>({tablename}))};
  if(sql.startsWith("select * from (")){
   if(kind==="query-failure")throw Error("native controlled failure");
   assert.ok(sql.includes("jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)"));
   assert.equal((sql.match(/ union all /gu)||[]).length,2);
   assert.ok(sql.endsWith("fingerprints order by table_name"));
   let rows=["admin_audit_logs","admin_users","project_children"].map(table_name=>({table_name,count:"2",hash:kind==="bad-checksum"?"invalid":"1".repeat(32)}));
   if(kind==="missing-checksum")rows.pop();
   if(kind==="duplicate-checksum")rows[2]=rows[0];
   if(kind==="reordered-checksum")rows.reverse();
   return {rows};
  }
  return {rows:[]};
 }})};
 const exports={},sandbox={exports,require:name=>{
  if(name==="node:assert/strict")return assert;
  if(name==="node:crypto")return {createHash};
  if(name.includes("isolated-supabase"))return {assertOwnedLocalHandle:value=>{assert.equal(value,handle);assert.notEqual(kind,"unowned");}};
  if(name.includes("form-permission-replay"))return {validateFormPermissionFingerprintRequest};
  throw Error("Unexpected dependency");
 }};
 vm.runInNewContext(transpiled,sandbox);
 const request={id:"2c79a763-3c47-4fb6-b030-5a9a9c3be531",kind:"form-permission-fingerprint",correlationId:"299c5ddb-228a-4bc7-bf6d-69b48e57d384",phase:"before",...(kind==="bad-request"?{table:"admin_users"}:{})};
 const result=exports.readCoreFormPermissionFingerprint(handle,request);
 if(kind==="read-only-complete"){
  const proof=await result;assert.equal(proof.publicTableCount,3);assert.match(proof.publicDataSha256,/^[a-f0-9]{64}$/u);assert.equal(Object.hasOwn(proof,"rows"),false);assert.equal(Object.hasOwn(proof,"data"),false);assert.equal(statements.at(-1),"commit");assert.equal(statements.filter(sql=>sql.startsWith("select * from (")).length,1);
 }else{await assert.rejects(result);if(!["unowned","bad-request"].includes(kind))assert.equal(statements.at(-1),"rollback");else assert.equal(statements.length,0);}
 checks.push("native-"+kind);
}
const artifact=".tmp-qa/core-final-closure/form-permission-replay-controls.json";mkdirSync(".tmp-qa/core-final-closure",{recursive:true});
const hashes=Object.fromEntries(["scripts/fixtures/admin-core-form-permission-replay.mjs",nativePath].map(file=>[file,createHash("sha256").update(readFileSync(file)).digest("hex")]));
writeFileSync(artifact,JSON.stringify({status:"pass",checks,sourceHashes:hashes,behaviorPromoted:false,scope:"Actual new collector/classifier and native function via controlled ports; actual current-build Browser/HTTP/owned DB joined proof remains pending."},null,2)+"\n");
console.log(JSON.stringify({status:"pass",checks:checks.length,artifact}));
