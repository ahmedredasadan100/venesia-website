import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

// ADDITIVE FRAGMENT ONLY in scripts/verify-admin-adoption-closure.mjs.
// The existing default controls and live single-run Browser receipt are untouched.
export function assertCoreFinalEvidenceClosureBoundary({sourceHead,sourceSha256,ledger,operations,originalOperations,retainedReceipt,canonicalNotApplicable,qualityReview,ciReview},deriveClosure959Eligibility){
 assert.match(sourceHead,/^[a-f0-9]{40}$/u);assert.match(sourceSha256,/^[a-f0-9]{64}$/u);assert.equal(ledger.sourceHead,sourceHead);assert.equal(operations.sourceHead,sourceHead);assert.equal(ledger.globalClosed,false);assert.deepEqual(ledger.automaticCoverage,[]);
 assert.equal(operations.status,'EXACT_ORIGINAL111_RECONCILED');assert.deepEqual(operations.partitions,originalOperations.partitions);assert.deepEqual(operations.counts,{qualified:110,notApplicable:1,hardOpen:0,held:0,total:111});assert.equal(operations.partitions.qualified.length,110);assert.equal(new Set(operations.partitions.qualified.map(r=>r.id)).size,110);assert.equal(operations.partitions.notApplicable.length,1);assert.equal(operations.partitions.notApplicable[0].countsAsPass,false);assert.equal(operations.partitions.notApplicable[0].id,'core-navigation-footer-default-restore-confirm-reject-retry');assert.deepEqual(operations.partitions.hardOpen,[]);assert.deepEqual(operations.partitions.held,[]);
 const e=ledger.closureEligibility,counts=e.namedCellCounts;assert.deepEqual(counts,{historical:959,applicable:950,qualifiedApplicable:950,openApplicable:0,pendingNotApplicable:0,provenNotApplicable:9});assert.equal(e.namedCells.length,959);assert.equal(new Set(e.namedCells.map(r=>r.key)).size,959);assert.equal(canonicalNotApplicable.length,9);assert.equal(new Set(canonicalNotApplicable).size,9);assert.deepEqual(e.namedCells.filter(r=>r.disposition==='PROVEN_NOT_APPLICABLE').map(r=>r.key).sort(),[...canonicalNotApplicable].sort());assert.equal(e.namedCells.filter(r=>r.disposition==='QUALIFIED').length,950);assert.ok(e.namedCells.every(r=>['QUALIFIED','PROVEN_NOT_APPLICABLE'].includes(r.disposition)));assert.deepEqual(ledger.accounting.pending,[]);assert.deepEqual(ledger.accounting.proven.map(r=>r.key).sort(),[...canonicalNotApplicable].sort());assert.ok(ledger.accounting.proven.every(r=>r.disposition==='PROVEN_NOT_APPLICABLE'));assert.equal(ledger.accounting.provenNotApplicable,9);assert.equal(ledger.accounting.pendingNotApplicable,0);assert.equal(ledger.accounting.applicable,950);for(const row of[...e.namedCells.filter(r=>r.disposition==='PROVEN_NOT_APPLICABLE'),...ledger.accounting.proven])if(Object.hasOwn(row,'countsAsPass'))assert.equal(row.countsAsPass,false,'Not-applicable evidence cannot become successful behavior.');
 const remainingPredicates=Object.values(ledger.modules).flat().reduce((n,c)=>n+c.openPredicates.length,0),remainingInventories=e.domainInventories.filter(r=>!r.complete),feedbackConditions=ledger.U03.cells.reduce((n,c)=>n+c.remainingConditions.length,0);assert.equal(e.remainingPredicates,remainingPredicates);assert.equal(e.incompleteDomainInventories,remainingInventories.length);assert.equal(e.openPreviewStates,e.previewStates.filter(r=>r.status!=='pass').length);assert.deepEqual(e.blockers,[]);
 const eligible=deriveClosure959Eligibility({counts,remainingPredicates,remainingInventories,feedbackConditions,next:ledger,current:ledger});assert.equal(eligible,true,'Actual existing materializer closure predicate must settle every obligation');assert.equal(e.eligible,eligible);assert.equal(retainedReceipt.accountingState.closureEligible,true);assert.deepEqual(retainedReceipt.accountingState.closureBlockers,[]);assert.equal(retainedReceipt.reexecuted,false);assert.equal(retainedReceipt.sourceBinding.currentSourceHead,sourceHead);assert.equal(retainedReceipt.sourceBinding.currentSourceSha256,sourceSha256);
 assert.equal(qualityReview.sourceHead,sourceHead);assert.equal(qualityReview.sourceSha256,sourceSha256);assert.equal(qualityReview.finalQualityPassed,true);assert.equal(qualityReview.finalClosurePassed,false);assert.equal(qualityReview.freshAdminExecuted,false);assert.equal(qualityReview.behaviorReplayed,false);assert.equal(qualityReview.retainedEvidenceWorkerStopped,true);assert.deepEqual(qualityReview.cleanup,{remainingOwnedResources:0,remainingOwnedProcesses:0,queueFree:true});assert.equal(ciReview.sourceHead,sourceHead);assert.equal(ciReview.requiredJobCount,8);assert.equal(ciReview.passed,8);assert.equal(ciReview.failed,0);assert.equal(ciReview.pending,0);assert.equal(ciReview.jobs.length,8);assert.equal(new Set(ciReview.jobs.map(r=>r.name)).size,8);assert.ok(ciReview.jobs.every(r=>r.conclusion==='success'));
 return{original111:operations.counts,named959:counts,originalOperationNotApplicable:{id:operations.partitions.notApplicable[0].id,countsAsPass:false},namedNotApplicable:canonicalNotApplicable.map(key=>({key,disposition:'PROVEN_NOT_APPLICABLE',countsAsPass:false})),eligible:true};
}

/** CI may retain a prior job only through a separate, complete final-source review. */
export function assertCoreFinalCiEvidence({review,baseline,candidate,baselineSourceRef,read,check}) {
 const names=baseline.jobs.map(row=>row.name).sort(),head=candidate.invocationHeadSha;
 assert.equal(names.length,8);assert.equal(new Set(names).size,8);assert.equal(review.sourceHead,head);
 assert.equal(review.requiredJobCount,8);assert.equal(review.passed,8);assert.equal(review.failed,0);assert.equal(review.pending,0);
 assert.equal(review.jobs.length,8);assert.deepEqual(review.jobs.map(row=>row.name).sort(),names);assert.equal(new Set(review.jobs.map(row=>row.jobId)).size,8);assert.ok(review.jobs.every(row=>row.conclusion==='success'));
 const observe=(ref,expectedHead)=>{const value=read(ref);assert.equal(value.sourceHead,expectedHead);assert.equal(value.ci.headSha,expectedHead);assert.equal(value.runId,value.ci.databaseId);assert.ok(Number.isSafeInteger(value.runId)&&value.runId>0);assert.equal(new Set(value.ci.jobs.map(row=>row.databaseId)).size,value.ci.jobs.length);assert.equal(new Set(value.ci.jobs.map(row=>row.name)).size,value.ci.jobs.length);assert.deepEqual(value.ci.jobs.map(row=>row.name).sort(),names,'An observation must preserve the complete eight-job result set');return value;};
 const actualJob=(observation,row)=>{const job=observation.ci.jobs.find(value=>value.databaseId===row.jobId);assert.ok(job);assert.equal(job.name,row.name);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');return job;};
 if(!Object.hasOwn(review,'compatibleRetention')) {
  const terminal=observe(review.terminal,head);assert.equal(terminal.ci.conclusion,'success');assert.deepEqual(terminal.ci.jobs.map(row=>row.name).sort(),names);
  return{candidateHead:head,jobs:review.jobs.map(row=>{actualJob(terminal,row);return{name:row.name,mode:'fresh-exact-head',sourceHead:head,runId:terminal.runId,jobId:row.jobId,observation:review.terminal};}),retainedJobs:0};
 }
 assert.equal(review.status,'ROOT_REVIEWED_FINAL_CANDIDATE_CI_WITH_COMPATIBLE_RETENTION');assert.deepEqual(review.unresolvedCurrentHeadFailures,[]);
 const compatibility=read(review.compatibleRetention);
 assert.equal(compatibility.status,'ROOT_REVIEWED_COMPLETE_FINAL_CANDIDATE_CI_INPUT_COMPATIBILITY');assert.equal(compatibility.sourceHead,head);assert.equal(compatibility.sourceSha256,candidate.sourceSha256);assert.deepEqual(compatibility.baselineSource,baselineSourceRef);
 const historical=read(baselineSourceRef);assert.equal(historical.invocationHeadSha,baseline.sourceHead);assert.equal(compatibility.baselineHead,baseline.sourceHead);assert.equal(compatibility.baselineSourceSha256,historical.sourceSha256);assert.deepEqual(compatibility.candidateSourceBinding,{sourceHead:head,sourceSha256:candidate.sourceSha256});
 const manifestMap=value=>{assert.ok(Array.isArray(value.manifest)&&value.manifest.length>0);const map=new Map();for(const row of value.manifest){assert.equal(typeof row.file,'string');assert.ok(row.file&&!row.file.includes('\\')&&!row.file.startsWith('/')&&!row.file.split('/').some(part=>!part||part==='.'||part==='..'));assert.match(row.sha256,/^[a-f0-9]{64}$/u);assert.equal(map.has(row.file),false);map.set(row.file,row.sha256);}return map;};
 const before=manifestMap(historical),after=manifestMap(candidate),keys=[...new Set([...before.keys(),...after.keys()])].sort();
 const inputs=keys.filter(file=>before.has(file)&&before.get(file)===after.get(file)).map(file=>({file,sha256:after.get(file)}));
 const changes=keys.filter(file=>before.get(file)!==after.get(file)).map(file=>({file,beforeSha256:before.get(file)??null,afterSha256:after.get(file)??null}));
 assert.ok(changes.length>0);assert.deepEqual(compatibility.completeUnchangedInputUniverse,inputs,'The complete unchanged source universe must be retained, not a caller-selected subset');assert.deepEqual(compatibility.sourceChanges,changes);
 for(const file of['.github/workflows/quality-gate.yml','package.json','package-lock.json','tsconfig.json']){assert.ok(before.has(file));assert.equal(after.get(file),before.get(file),'CI workflow/dependency/tool inputs must be unchanged for this compatibility mode');}
 const retained=review.jobs.filter(row=>row.mode==='retained-compatible');assert.ok(retained.length>0);assert.equal(compatibility.jobs.length,retained.length);assert.deepEqual(compatibility.jobs.map(row=>row.name).sort(),retained.map(row=>row.name).sort());
 const original=observe(baseline.terminal,baseline.sourceHead);assert.equal(original.ci.conclusion,'success');assert.deepEqual(original.ci.jobs.map(row=>row.name).sort(),names);
 assert.ok(Array.isArray(review.currentHeadObservations)&&review.currentHeadObservations.length>0);const current=review.currentHeadObservations.map(ref=>({ref,value:observe(ref,head)}));
 const sameRef=(a,b)=>a?.path===b?.path&&a?.sha256===b?.sha256;const output=[];
 for(const row of review.jobs){
  assert.ok(['fresh-exact-head','retained-compatible'].includes(row.mode));assert.equal(row.sourceHead,row.mode==='fresh-exact-head'?head:baseline.sourceHead);assert.ok(Number.isSafeInteger(row.runId)&&row.runId>0);
  if(row.mode==='fresh-exact-head'){
   const found=current.find(value=>sameRef(value.ref,row.observation));assert.ok(found,'Fresh jobs must come from a pinned current-head observation');assert.equal(found.value.runId,row.runId);actualJob(found.value,row);
  }else{
   assert.ok(!['Lint · Typecheck · Verify · Build','Command Recovery and Public Read Integrity · Full Supabase'].includes(row.name),'The two changed verification job families require fresh evidence');
   assert.deepEqual(row.observation,baseline.terminal);assert.equal(row.runId,baseline.runId);actualJob(original,row);const old=baseline.jobs.find(value=>value.name===row.name);assert.equal(row.jobId,old.jobId);assert.equal(row.reexecuted,false);
   const proof=compatibility.jobs.find(value=>value.name===row.name);assert.deepEqual(proof.original,{sourceHead:row.sourceHead,runId:row.runId,jobId:row.jobId});assert.equal(proof.completeInputsReviewed,true);
   assert.deepEqual(proof.excludedChanges.map(value=>({file:value.file,beforeSha256:value.beforeSha256,afterSha256:value.afterSha256})),changes,'Every changed source must have a job-specific exclusion proof');
   for(const exclusion of proof.excludedChanges){assert.equal(exclusion.disposition,'NOT_REACHABLE_FROM_THIS_JOB');assert.ok(typeof exclusion.reason==='string'&&exclusion.reason.trim().length>0);assert.ok(Array.isArray(exclusion.sourceProof)&&exclusion.sourceProof.length>0);for(const ref of exclusion.sourceProof)check(ref);}
   assert.ok(Array.isArray(proof.dependencyEvidence)&&proof.dependencyEvidence.length>0);for(const ref of proof.dependencyEvidence)check(ref);
  }
  // A known failed current job cannot be replaced by a historical success. Only its later exact-head success can settle it.
  for(const observation of current)for(const seen of observation.value.ci.jobs.filter(value=>value.name===row.name&&value.status==='completed'&&value.conclusion!=='success')){assert.equal(row.mode,'fresh-exact-head');const selected=current.find(value=>sameRef(value.ref,row.observation));const passed=actualJob(selected.value,row);assert.ok(Number.isFinite(Date.parse(seen.completedAt))&&Number.isFinite(Date.parse(passed.completedAt)));assert.ok(Date.parse(passed.completedAt)>Date.parse(seen.completedAt),'A failed job remains unresolved without a later observed success');}
  output.push({name:row.name,mode:row.mode,sourceHead:row.sourceHead,runId:row.runId,jobId:row.jobId,observation:row.observation,...(row.mode==='retained-compatible'?{compatibility:review.compatibleRetention,reexecuted:false}:{})});
 }
 return{candidateHead:head,jobs:output,retainedJobs:retained.length,compatibleRetention:review.compatibleRetention};
}

/** Actual post-Quality gate: delegate admission and result semantics to existing owners. */
export async function verifyCoreFinalEvidenceClosure(reviewRef){
 const fs=await import('node:fs'),path=await import('node:path'),crypto=await import('node:crypto'),{execFileSync}=await import('node:child_process'),{pathToFileURL}=await import('node:url'),{createJiti}=await import('jiti');
 const root=path.resolve('.'),base='.tmp-qa/core-final-closure/',b=base+'held37-final52-closure-2026-10-03/',a=base+'ledger959-reconciliation-2026-10-04/accounting/',output=a+'final-closure-gate.json',owner='scripts/lib/isolated-public-verification.mts',caller=b+'run-admitted.mjs',hash=x=>crypto.createHash('sha256').update(x).digest('hex'),consumed=new Map();
 const bytes=p=>{const absolute=path.resolve(p);assert.ok(absolute.startsWith(root+path.sep));assert.equal(fs.realpathSync(absolute),absolute);assert.ok(fs.lstatSync(absolute).isFile());const raw=fs.readFileSync(absolute),sha256=hash(raw),key=absolute.toLowerCase();if(consumed.has(key))assert.equal(consumed.get(key).sha256,sha256,'Evidence changed during final gate');else consumed.set(key,{path:path.relative(root,absolute).replaceAll('\\','/'),sha256});return raw;};
 const check=ref=>{assert.match(ref.sha256,/^[a-f0-9]{64}$/u);assert.equal(hash(bytes(ref.path)),ref.sha256,ref.path);},json=p=>JSON.parse(bytes(p)),read=ref=>(check(ref),json(ref.path));
 assert.equal(reviewRef.path,a+'final-closure-root-review.json');const review=read(reviewRef);assert.equal(review.status,'ROOT_REVIEWED_EXACT_HEAD_FINAL_CLOSURE_INVOCATION');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),review.sourceHead);assert.equal(execFileSync('git',['status','--porcelain=v1'],{encoding:'utf8',windowsHide:true}).trim(),'');assert.equal(fs.existsSync(output),false);
 assert.equal(review.readiness.path,a+'final-quality-readiness.json');const readiness=read(review.readiness);assert.equal(readiness.sourceHead,review.sourceHead);const source=read(readiness.sourceManifest);assert.equal(source.invocationHeadSha,review.sourceHead);assert.equal(review.qualityOwner.path,owner);check(review.qualityOwner);assert.equal(source.manifest.find(r=>r.file===owner)?.sha256,review.qualityOwner.sha256);
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false}),qualityOwner=await jiti.import(path.resolve(owner)),retainedAdmission=qualityOwner.loadRetainedFinalQualityAdmission(review.readiness.sha256,source);retainedAdmission.verify();
 const ledger=read(readiness.accounting),operations=read(readiness.operations),originalOperations=read({path:b+'accounting/final-111-reconciliation.json',sha256:'7d57838d7da26d66f6c8013de16c5aa1a5f8f943a1e5cac056839d66603c2112'});assert.equal(readiness.accountingOwner.export,'materializeFinalAccountingReviewed');check(readiness.accountingOwner);const accountingOwner=await import(pathToFileURL(path.resolve(readiness.accountingOwner.path)).href);assert.equal(typeof accountingOwner.deriveClosure959Eligibility,'function');
 // Canonical N/A identity comes from the existing collector declaration, never a copied nine-key list.
 const collectorPath='scripts/qa-admin-adoption-journeys.mjs',collectorText=bytes(collectorPath).toString('utf8');assert.equal(hash(collectorText),source.manifest.find(r=>r.file===collectorPath)?.sha256);const collectorAst=ts.createSourceFile(collectorPath,collectorText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),notApplicable=collectorAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='retainedTrackingMediaCases');assert.equal(notApplicable.length,1);const canonicalNotApplicable=Array.from(vm.runInNewContext(notApplicable[0].getText(collectorAst)+';retainedTrackingMediaCases()'),r=>r.key);
 const qualityReview=read(review.qualityReview);assert.match(qualityReview.run,/^browser-r\d+$/u);const run=qualityReview.run,prefix=base+run+'/';assert.equal(qualityReview.canonicalResultOwner.path,caller);assert.equal(qualityReview.canonicalResultOwner.export,'assertRetainedQualityResult');check(qualityReview.canonicalResultOwner);assert.equal(qualityReview.finalQualityPassed,true);const execution=read(qualityReview.execution);assert.equal(execution.status,'passed');assert.equal(execution.exitCode,0);assert.equal(execution.queueReleased,true);assert.equal(execution.sourceHead,review.sourceHead);assert.deepEqual(execution.scope.cases,[]);assert.equal(execution.scope.qualifiedReplayed,false);
 const admission=read(qualityReview.admission);assert.deepEqual(admission.retainedAdminBehaviorAdmission,review.readiness);const summary=read(qualityReview.summary),report=json(prefix+'browser-result.json'),cleanup=json(prefix+'cleanup.json'),executedSource=json(prefix+'public-source-manifest.json');assert.equal(executedSource.invocationHeadSha,source.invocationHeadSha);assert.equal(executedSource.sourceSha256,source.sourceSha256);assert.deepEqual(executedSource.manifest,source.manifest);
 // Invoke the actual existing successful-Quality result validator with its real filesystem/owner ports.
 const callerText=bytes(caller).toString('utf8'),callerAst=ts.createSourceFile(caller,callerText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),validators=callerAst.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='assertRetainedQualityResult');assert.equal(validators.length,1);const cleanupOwner=await import(pathToFileURL(path.resolve(base+'continuation-82-79-80-stage/run-batch-82-79-80.mjs')).href);const ports={assert,assertOwnedCleanup:cleanupOwner.assertOwnedCleanup,run,cohort:'domain-forms',sourceHead:review.sourceHead,admission,existsSync:fs.existsSync,json,receipt:execution,sha:hash,qualityOwner,retainedAdmission,check};const actualResult=new Function(...Object.keys(ports),validators[0].getText(callerAst)+';return assertRetainedQualityResult;')(...Object.values(ports));actualResult(summary,report,cleanup,executedSource,prefix);assert.equal(report.status,'passed');for(const ref of qualityReview.rawReferences)check(ref);
 const ciRef={path:b+'host-resumed-2026-10-04/ci-9cbdf71b-final-review.json',sha256:'c1614df2390925cb64d13578e356b66dfa1827656a8a568d30f6b814fc0ea3b4'};assert.deepEqual(review.requiredCiBaseline,ciRef);const ciReview=read(review.ciReview),ciBaseline=read(ciRef);if(Object.hasOwn(ciReview,'compatibleRetention')){assert.equal(ciReview.compatibleRetention.path,a+'final-ci-compatible-input-review.json');assert.deepEqual(review.ciInputCompatibility,ciReview.compatibleRetention);}const ciEvidence=assertCoreFinalCiEvidence({review:ciReview,baseline:ciBaseline,candidate:source,baselineSourceRef:{path:b+'accounting/final-source-manifest.json',sha256:'175a022b83509a099f3f78bb7199687ec48911306ea07deb165a3d2a7d66a903'},read,check});
 const boundary=assertCoreFinalEvidenceClosureBoundary({sourceHead:review.sourceHead,sourceSha256:source.sourceSha256,ledger,operations,originalOperations,retainedReceipt:retainedAdmission.receipt,canonicalNotApplicable,qualityReview,ciReview},accountingOwner.deriveClosure959Eligibility);
 const queue=JSON.parse(fs.readFileSync(base+'execution-queue.json','utf8'));assert.equal(queue.active,null);retainedAdmission.verify();for(const ref of consumed.values())check(ref);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),review.sourceHead);assert.equal(execFileSync('git',['status','--porcelain=v1'],{encoding:'utf8',windowsHide:true}).trim(),'');
 const result={status:'FINAL_CLOSURE_GATE_PASS',sourceHead:review.sourceHead,sourceSha256:source.sourceSha256,review:reviewRef,readiness:review.readiness,accounting:readiness.accounting,operations:readiness.operations,integrity:readiness.integrity,qualityReview:review.qualityReview,ciReview:review.ciReview,ciEvidence,canonicalAdmissionOwner:review.qualityOwner,canonicalAccountingOwner:readiness.accountingOwner,canonicalQualityResultOwner:qualityReview.canonicalResultOwner,...boundary,inputs:[...consumed.values()],cleanup:{remainingOwnedResources:0,remainingOwnedProcesses:0,queueFree:true},scope:{adminCoreClosureOnly:true,production:false,migrationReadiness:false,merge:false,deploy:false},retainedBehaviorReexecuted:false,accountingRewritten:false,automaticCoverage:[],globalClosed:true};assert.equal(fs.existsSync(output),false);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return{path:output,sha256:hash(fs.readFileSync(output)),status:result.status,sourceHead:result.sourceHead,globalClosed:true};
}
// Insert this dispatch immediately after imports and before existing default control execution.
// if (process.argv[2] === '--final-evidence') {
//   assert.equal(process.argv.length,5); console.log(JSON.stringify(await verifyCoreFinalEvidenceClosure({path:process.argv[3],sha256:process.argv[4]}))); process.exit(0);
// }

if (process.argv[2] === '--final-evidence') {
 assert.equal(process.argv.length,5); console.log(JSON.stringify(await verifyCoreFinalEvidenceClosure({path:process.argv[3],sha256:process.argv[4]}))); process.exit(0);
}

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
  journeySelection:null,selectedJourneyIds:[],executedJourneyIds:[],specializedSettingsResult:null,mediaResult:null,navigationSettingsResult:null,authEntryResult:null,mediaRecoveryResult:null,queryPresentationResult:null,templateControlsResult:null,topicControlsResult:null,projectControlsResult:null,presentationControlsResult:null,domainBulkResult:null,publicPreviewImpactResult:null,sourceHashes:{},process:{env:{}},startedAt:"2026-09-26T00:00:00.000Z",databaseReadback:[],readOnlyReadback:[],menuIntegrityReadback:[],previewNonApplicability:[],...patch });
const evaluate = patch => vm.runInNewContext(collector + "; receipt()",context(patch));
const checks = [
 ["retained-not-applicable-cell-cannot-behavior-pass",{requiredCases:[{key:"current-applicable-cell",declaration:"not_applicable",disposition:"NOT_APPLICABLE_PENDING_PROOF"}]},false],
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
 const sandbox={journeySelection:null,selectedJourneyIds:[],executedJourneyIds:[],activeCase:"",checkpoint:()=>{},evidence,errors,previewMatrix:[],assert,receipt:()=>({}),write:()=>{},failureScreenshot:async()=>{},UnacknowledgedActionError:class extends Error{}};
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
 const sandbox={journeySelection:null,selectedJourneyIds:[],executedJourneyIds:[],activeCase:"",checkpoint:()=>{},evidence,errors,previewMatrix,assert,receipt:()=>({}),write:()=>{},failureScreenshot:async()=>{},UnacknowledgedActionError:class extends Error{}};
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
