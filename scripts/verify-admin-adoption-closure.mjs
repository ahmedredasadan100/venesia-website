import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual collector's receipt against adversarial coverage states.
// These controls do not infer closure from the spelling of its predicate.
const path = resolve("scripts/qa-admin-adoption-journeys.mjs");
const source = readFileSync(path, "utf8");
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === "receipt");
assert.equal(declarations.length, 1, "The current collector must expose its existing receipt calculation.");
const collector = declarations[0].getText(ast);
const context = patch => ({ requiredCases: [{key:"current-applicable-cell"}], evidence:[{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]}],
  inventory:[{domainJourneyInventoryComplete:true}],previewMatrix:[{status:"behavior_verified",evidence:"actual-journey"}],errors:[],driverCompleted:true,inventoryOnly:false,coreClosure:true,coreCohort:"preview-recovery-templates",
  specializedSettingsResult:null,mediaResult:null,navigationSettingsResult:null,authEntryResult:null,mediaRecoveryResult:null,queryPresentationResult:null,sourceHashes:{},process:{env:{}},startedAt:"2026-09-26T00:00:00.000Z",databaseReadback:[],readOnlyReadback:[],menuIntegrityReadback:[],previewNonApplicability:[],...patch });
const evaluate = patch => vm.runInNewContext(collector + "; receipt()",context(patch));
const checks = [
 ["complete-real-inventories-and-preview",{},true],
 ["running-driver-cannot-close",{driverCompleted:false},false],
 ["recorded-error-cannot-close",{errors:[{id:"failed-step"}]},false],
 ["empty-applicable-proof-cannot-close",{requiredCases:[]},false],
 ["uncovered-applicable-cell-cannot-close",{evidence:[]},false],
 ["failed-evidence-cannot-cover",{evidence:[{id:"failed",status:"fail",coverage:["current-applicable-cell"]}]},false],
 ["missing-domain-inventory-cannot-close",{inventory:[{domainJourneyInventoryComplete:false}]},false],
 ["open-preview-cell-cannot-close",{previewMatrix:[{status:"open"}]},false],
 ["mixed-preview-cannot-close",{previewMatrix:[{status:"behavior_verified"},{status:"open"}]},false],
 ["pass-plus-fail-same-id-cannot-cover",{evidence:[{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]},{id:"actual-journey",status:"fail",coverage:[]}]},false],
 ["duplicate-pass-id-cannot-cover",{evidence:[{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]},{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]}]},false],
 ["orphan-preview-evidence-cannot-close",{previewMatrix:[{status:"behavior_verified",evidence:"unknown-case"}]},false],
 ["failed-preview-evidence-cannot-close",{previewMatrix:[{status:"behavior_verified",evidence:"failed-preview"}],evidence:[{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]},{id:"failed-preview",status:"fail",coverage:[]}]},false],
];
for(const [name,patch,expected] of checks) assert.equal(evaluate(patch).globalClosed,expected,name);
const runNode=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="run");assert.ok(runNode);
const identityChecks=[];
for(const mode of ["domain-id","conflicting-owned-fields","explicit-entity-id","ordinary-details","failed-task"]){
 const evidence=[],errors=[];
 const sandbox={activeCase:"",checkpoint:()=>{},evidence,errors,previewMatrix:[],assert,receipt:()=>({}),write:()=>{},failureScreenshot:async()=>{},UnacknowledgedActionError:class extends Error{}};
 const task=async()=>{if(mode==="failed-task")throw Error("actual failure");return mode==="domain-id"?{id:51}:mode==="explicit-entity-id"?{id:51,entityId:91}:mode==="conflicting-owned-fields"?{id:51,status:"fail",coverage:["forged"],startedAt:"forged",finishedAt:"forged"}:{detail:"retained"};};
 await vm.runInNewContext(runNode.getText(ast)+";run",sandbox)("named-actual-case",["actual-cell"],task);
 assert.equal(evidence.length,1);assert.equal(evidence[0].id,"named-actual-case");assert.equal(evidence[0].status,mode==="failed-task"?"fail":"pass");assert.equal(JSON.stringify(evidence[0].coverage),JSON.stringify(mode==="failed-task"?[]:["actual-cell"]));
 assert.ok(Number.isFinite(Date.parse(evidence[0].startedAt)));assert.ok(Number.isFinite(Date.parse(evidence[0].finishedAt)));
 if(mode==="domain-id"||mode==="conflicting-owned-fields")assert.equal(evidence[0].entityId,51);
 if(mode==="explicit-entity-id")assert.equal(evidence[0].entityId,91);
 if(mode==="ordinary-details")assert.equal(evidence[0].detail,"retained");
 assert.equal(errors.length,mode==="failed-task"?1:0);identityChecks.push(mode);
}
const previewValidationChecks=[];
for(const mode of ["valid-preview", "unknown-preview", "later-unknown-preview", "duplicate-preview", "owned-preview-fields"]){
 const evidence=[],errors=[],previewMatrix=[{consumer:"actual-consumer",publication:"published",session:"authorized",status:"open",evidence:null}];
 const valid={consumer:"actual-consumer",publication:"published",session:"authorized"};
 const invalid={consumer:"unknown-consumer",publication:"published",session:"authorized"};
 const previewCells=mode==="unknown-preview"?[invalid]:mode==="later-unknown-preview"?[valid,invalid]:mode==="duplicate-preview"?[valid,valid]:[{...valid,...(mode==="owned-preview-fields"?{status:"open",evidence:"forged"}:{})}];
 const sandbox={activeCase:"",checkpoint:()=>{},evidence,errors,previewMatrix,assert,receipt:()=>({}),write:()=>{},failureScreenshot:async()=>{},UnacknowledgedActionError:class extends Error{}};
 await vm.runInNewContext(runNode.getText(ast)+";run",sandbox)("actual-journey",["current-applicable-cell"],async()=>({previewCells}));
 const successful=mode==="valid-preview"||mode==="owned-preview-fields";
 assert.equal(evidence.length,1);assert.equal(evidence[0].status,successful?"pass":"fail");
 assert.equal(errors.length,successful?0:1);
 assert.equal(previewMatrix[0].status,successful?"behavior_verified":"open");
 assert.equal(previewMatrix[0].evidence,successful?"actual-journey":null);
 const settled=evaluate({evidence,errors,previewMatrix});
 assert.equal(settled.requiredCases[0].status,successful?"behavior_verified":"open");
 assert.equal(settled.globalClosed,successful);previewValidationChecks.push(mode);
}
for(const duplicateStatus of ["pass","fail"]){
 const settled=evaluate({evidence:[{id:"actual-journey",status:"pass",coverage:["current-applicable-cell"]},{id:"actual-journey",status:duplicateStatus,coverage:[]} ]});
 assert.equal(settled.requiredCases[0].status,"open");assert.equal(settled.previewMatrix[0].status,"open");
}
const failedIdentity=evaluate({errors:[{id:"actual-journey"}]});
assert.equal(failedIdentity.requiredCases[0].status,"open");assert.equal(failedIdentity.previewMatrix[0].status,"open");
const logoutNode=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="revokeSession");assert.ok(logoutNode);
const logoutChecks=[];
for(const kind of ["acknowledged-no-navigation","disposed-response-body","http-failure","redirect-failure","no-retained-cookie","click-failure","no-request-timeout","non-post-ignored","wrong-url-ignored","duplicate-post"]){
  const endpoint="http://127.0.0.1:3000/api/admin/auth/logout";
  let listener=null,removed=0,waiter=null,resolveResponse,rejectResponse,posts=0,bodyReads=0;
  const success=["acknowledged-no-navigation","disposed-response-body","non-post-ignored"].includes(kind);
  const request={url:()=>endpoint,method:()=>"POST"};
  const response={request:()=>request,status:()=>kind==="http-failure"?401:kind==="redirect-failure"?302:200,
    body:()=>{bodyReads++;throw Error("CDP body disposed");},json:()=>{bodyReads++;throw Error("CDP body disposed");},finished:()=>{bodyReads++;throw Error("EOF is not semantic settlement");}};
  const sandbox={assert,URL,origin:"http://127.0.0.1:3000",expectedLogoutDestination:null,
    context:{storageState:async()=>({cookies:kind==="no-retained-cookie"?[]:[{httpOnly:true,value:"synthetic-signed-cookie"}]})},
    observe:async(_label,task)=>task(),page:{goto:async()=>{},
      locator:()=>({first:()=>({getAttribute:async()=>"https://public.example.invalid/"})}),
      on:(event,callback)=>{assert.equal(event,"request");listener=callback;},
      off:(event,callback)=>{assert.equal(event,"request");assert.equal(callback,listener);removed++;},
      route:()=>{throw Error("Collector must not intercept/replay the logout");},
      waitForResponse:(predicate,options)=>{waiter=predicate;assert.equal(options.timeout,25000);return new Promise((resolve,reject)=>{resolveResponse=resolve;rejectResponse=reject;});},
      getByRole:()=>({click:async()=>{
        if(kind==="click-failure")throw Error("click-failure");
        if(kind==="no-request-timeout"){rejectResponse(Error("bounded wait expired"));return;}
        if(kind==="non-post-ignored"){const get={url:()=>endpoint,method:()=>"GET"};listener(get);assert.equal(waiter({...response,request:()=>get}),false);}
        if(kind==="wrong-url-ignored"){const other={url:()=>endpoint+"-other",method:()=>"POST"};listener(other);assert.equal(waiter({...response,request:()=>other}),false);rejectResponse(Error("no matching response"));return;}
        listener(request);posts++;
        if(kind==="duplicate-post"){listener(request);posts++;}
        assert.equal(waiter(response),true);resolveResponse(response);
      }}),
    }};
  const actual=vm.runInNewContext(logoutNode.getText(ast)+";revokeSession()",sandbox);
  if(success){const retained=await actual;assert.equal(retained.cookies[0].value,"synthetic-signed-cookie");assert.equal(posts,1);assert.equal(sandbox.expectedLogoutDestination,"https://public.example.invalid/");}
  else await assert.rejects(actual);
  assert.equal(bodyReads,0);assert.equal(removed,kind==="no-retained-cookie"?0:1);logoutChecks.push(kind);
}
let networkNode;
for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText(ast)==="ownedNetworkOnly")networkNode=declaration.initializer;
assert.ok(networkNode);
const networkChecks=[];
for(const kind of ["owned-local","unexpected-external","configured-logout-denied","project-map-denied","map-outside-project-denied"]){
 const sandbox={URL,origin:"http://127.0.0.1:3000",allowedStorage:[],coreClosure:true,activeCase:kind==="project-map-denied"?"core-project-residential-create":"another-case",expectedLogoutDestination:kind==="configured-logout-denied"?"https://public.example.invalid/":null,externalRequests:[],expectedBlockedRequests:[]};
 let continued=0,aborted=0;
 const url=kind==="owned-local"?sandbox.origin+"/admin":kind.includes("map")?"https://maps.google.com/maps?q=30,31&output=embed":"https://public.example.invalid/";
 const route={request:()=>({url:()=>url,isNavigationRequest:()=>true,resourceType:()=>"document",frame:()=>({parentFrame:()=>({})})}),continue:async()=>{continued++},abort:async reason=>{assert.equal(reason,"blockedbyclient");aborted++}};
 await vm.runInNewContext(networkNode.getText(ast),sandbox)(route);
 assert.equal(continued,kind==="owned-local"?1:0);assert.equal(aborted,kind==="owned-local"?0:1);
 assert.equal(sandbox.expectedBlockedRequests.length,["configured-logout-denied","project-map-denied"].includes(kind)?1:0);
 assert.equal(sandbox.externalRequests.length,["unexpected-external","map-outside-project-denied"].includes(kind)?1:0);networkChecks.push(kind);
}
const output=resolve(".tmp-qa/core-final-closure/closure-receipt-controls.json");mkdirSync(resolve(output,".."),{recursive:true});
writeFileSync(output,JSON.stringify({status:"pass",checks:checks.map(([name])=>name),logoutChecks,networkChecks,identityChecks,previewValidationChecks,classification:"STALE_TEST collector predicate omitted Preview completion and driver/error settlement",behaviorEvidenceClaimed:false},null,2));
console.log(JSON.stringify({status:"pass",negativeAndPositiveControls:checks.length+logoutChecks.length+networkChecks.length+identityChecks.length+previewValidationChecks.length+3}));
