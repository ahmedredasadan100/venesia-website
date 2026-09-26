import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

// Actual current Page/native join and owned Navigation completion under controlled ports.
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const dir=path.join(root,'.tmp-qa/core-final-closure');fs.mkdirSync(dir,{recursive:true});
const target='scripts/verify-admin-adoption-readback-isolated.mts',source=fs.readFileSync(target,'utf8');
function extract(text,names){const ast=ts.createSourceFile('actual.mts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);return names.map(name=>{const rows=ast.statements.filter(node=>(ts.isFunctionDeclaration(node)&&node.name?.text===name)||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(row=>row.name.getText(ast)===name)));assert.equal(rows.length,1);return rows[0].getText(ast).replace(/^export /,'');}).join('\n');}
const ownerSource=fs.readFileSync('scripts/verify-admin-core-navigation-settings-isolated.mts','utf8');
const declarations=extract(ownerSource,['NAVIGATION_SETTINGS_PHASES','CORE_NAVIGATION_RECIPE','assertCoreNavigationSettingsCompleted'])+'\n'+extract(source,['assertCoreNavigationPermissionReceipts']);
const js=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const handles=new WeakSet(),states=new WeakMap(),own=handle=>assert.ok(handles.has(handle),'Foreign owned handle');
const owner=new Function('assert','assertOwnedLocalHandle','states',js+';return {assertCoreNavigationPermissionReceipts,assertCoreNavigationSettingsCompleted,NAVIGATION_SETTINGS_PHASES,CORE_NAVIGATION_RECIPE};')(assert,own,states);
assert.match(source,/if \(browser\.cohort === "navigation-settings"\) navigationPermission = assertCoreNavigationPermissionReceipts\(handle, browser, nativeCheckpoints\)/);
assert.match(source,/navigationSettings = browser\.cohort === "navigation-settings" \? \{ \.\.\.assertCoreNavigationSettingsCompleted\(handle\), permission: navigationPermission \}/);
function fixture(){const handle={identity:{runId:'owned-page-permission-controls'}};handles.add(handle);
const navigation=Object.entries(owner.NAVIGATION_SETTINGS_PHASES).flatMap(([entity,phases])=>phases.map(phase=>({id:crypto.randomUUID(),kind:'navigation-settings-state',entity,phase,status:'pass',pageId:91,actorBoundAuditCount:phase==='created'?1:0,snapshotHash:'a'.repeat(64),globalClosed:false})));
assert.equal(navigation.length,31);const recipe=owner.CORE_NAVIGATION_RECIPE.page;
const saved={id:crypto.randomUUID(),kind:'form-save-native',caseId:'core-navigation-page-create-accepted-save',formConsumer:'pages-quick-create',surface:'create',status:'partial-not-global-pass',globalClosed:false,writes:[{table:'pages',id:91,deleted:false,actual:{title:recipe.title,path:recipe.path,slug:recipe.slug,status:'unpublished',page_type:'static'},json:[],expectedActorId:7,audit:[{id:72,action:'page.create',entity_type:'page',entity_id:91,entity_label:recipe.title,actor_admin_user_id:7}]}]};
const base={kind:'form-permission-fingerprint',status:'pass',ownedRunId:handle.identity.runId,correlationId:crypto.randomUUID(),adminAuditIncluded:true,adminUsersIncluded:true,publicTableCount:4,publicTableInventorySha256:'b'.repeat(64),publicDataSha256:'c'.repeat(64)};
const before={...base,id:crypto.randomUUID(),phase:'before'},after={...base,id:crypto.randomUUID(),phase:'after'};
const proof={status:'pass',caseId:saved.caseId,formConsumer:saved.formConsumer,surface:saved.surface,candidateRequiredCase:'form:pages-quick-create:create:permission_denied',sourceSha256:'d'.repeat(64),actionSha256:'e'.repeat(64),routePathname:'/admin/pages-blocks/pages',originalActionHttpStatus:200,originalUiSuccessVerified:true,originalNativeSaveVerified:true,replayCount:1,replayCookieFree:true,replayRedirectsFollowed:0,denial:{kind:'http-unauthorized',httpStatus:401,actionBodyExecutionProven:false},nativeBefore:before.id,nativeAfter:after.id,ownedRunId:handle.identity.runId,publicTableCount:4,publicDomainAuditDependentsUnchanged:true,automaticCoverage:[],bodyOrCookieArtifactsWritten:false,originalNativeSaveReceipt:saved.id,originalProjectionCount:1};
const result={status:'pass',globalClosed:false,requiresOwnedCleanupBeforePromotion:true,checkpoints:structuredClone(navigation),permissionEvidence:[proof],permissionCandidateKeys:[proof.candidateRequiredCase]};
const browser={status:'pass',driverCompleted:true,inventoryOnly:false,scope:'core-closure',cohort:'navigation-settings',errors:[],sourceSha256:proof.sourceSha256,navigationSettings:result,evidence:[{id:'core-navigation-page-create-rejection-retry-reload',status:'pass',consumer:'pages-quick-create',surface:'create',permissionEvidence:[structuredClone(proof)],automaticCoverage:[]}],requiredCases:[{boundary:'form',consumer:'pages-quick-create',surface:'create',scenario:'permission_denied',key:proof.candidateRequiredCase}]};
const native={status:'pass',records:[...navigation]};native.records.splice(3,0,saved,before,after);
states.set(handle,{phase:Object.fromEntries(Object.entries(owner.NAVIGATION_SETTINGS_PHASES).map(([entity,phases])=>[entity,phases.length])),cleanup:true});
const check=()=>{const permission=owner.assertCoreNavigationPermissionReceipts(handle,browser,native),completion=owner.assertCoreNavigationSettingsCompleted(handle);assert.equal(completion.status,'pass');return permission;};
return{handle,browser,native,result,proof,saved,before,after,navigation,check};}
const checks=[];function test(name,fn){fn();checks.push(name);}
test('actual-canonical-Page-save-31-navigation-and-denial-pair-completion',()=>{const f=fixture(),result=f.check();assert.equal(result.navigationCheckpoints,31);assert.equal(result.nativeCheckpoints,34);assert.equal(result.pagePermissionIntents,1);assert.equal(result.globalClosed,false);assert.deepEqual(result.automaticCoverage,[]);});
test('actual-owned-login-denial-alternative',()=>{const f=fixture();f.proof.denial={kind:'owned-admin-login-denial',httpStatus:303,destination:'/admin/login',actionBodyExecutionProven:false};f.browser.evidence[0].permissionEvidence=structuredClone(f.result.permissionEvidence);f.check();});
const mutations={
'missing-navigation-phase':f=>f.native.records.splice(0,1),
'missing-native-save':f=>f.native.records.splice(3,1),
'missing-before':f=>f.native.records.splice(4,1),
'missing-after':f=>f.native.records.splice(5,1),
'unknown-native-kind':f=>f.native.records.push({id:crypto.randomUUID(),kind:'unknown',status:'pass'}),
'orphan-navigation':f=>f.native.records.push({...f.navigation[0],id:crypto.randomUUID()}),
'extra-save':f=>f.native.records.push({...f.saved,id:crypto.randomUUID()}),
'orphan-fingerprint':f=>f.native.records.push({...f.after,id:crypto.randomUUID()}),
'duplicate-native-id':f=>f.native.records.push({...f.before}),
'foreign-native-consumer':f=>f.saved.formConsumer='menu-quick-create',
'foreign-native-surface':f=>f.saved.surface='edit',
'foreign-native-case':f=>f.saved.caseId='other-case',
'foreign-page-id':f=>f.saved.writes[0].id=92,
'foreign-page-title':f=>f.saved.writes[0].actual.title='Other title',
'foreign-audit-actor':f=>f.saved.writes[0].audit[0].actor_admin_user_id=8,
'missing-canonical-actor':f=>delete f.saved.writes[0].expectedActorId,
'foreign-audit-target':f=>f.saved.writes[0].audit[0].entity_id=92,
'foreign-audit-label':f=>f.saved.writes[0].audit[0].entity_label='Other label',
'extra-page-audit':f=>f.saved.writes[0].audit.push({...f.saved.writes[0].audit[0],id:73}),
'foreign-fingerprint-run':f=>f.after.ownedRunId='another-owned-run',
'foreign-correlation':f=>f.after.correlationId=crypto.randomUUID(),
'changed-all-public-data':f=>f.after.publicDataSha256='f'.repeat(64),
'changed-public-table-inventory':f=>f.after.publicTableInventorySha256='f'.repeat(64),
'missing-users-scope':f=>f.before.adminUsersIncluded=false,
'missing-audit-scope':f=>f.before.adminAuditIncluded=false,
'out-of-order-fingerprint':f=>[f.native.records[4],f.native.records[5]]=[f.native.records[5],f.native.records[4]],
'replayed-native-id':f=>f.proof.nativeAfter=f.proof.nativeBefore,
'missing-receipt':f=>f.result.permissionEvidence=[],
'duplicate-receipt':f=>f.result.permissionEvidence.push({...f.proof}),
'foreign-receipt-run':f=>f.proof.ownedRunId='other-run',
'foreign-source-sha':f=>f.proof.sourceSha256='f'.repeat(64),
'foreign-canonical-cell':f=>f.proof.candidateRequiredCase='form:menu-quick-create:menu-create:permission_denied',
'missing-canonical-cell':f=>f.browser.requiredCases=[],
'duplicate-canonical-cell':f=>f.browser.requiredCases.push({...f.browser.requiredCases[0]}),
'missing-case-evidence':f=>f.browser.evidence=[],
'duplicate-case-evidence':f=>f.browser.evidence.push({...f.browser.evidence[0]}),
'failed-case-evidence':f=>f.browser.evidence[0].status='fail',
'altered-browser-checkpoint':f=>f.result.checkpoints[0].snapshotHash='f'.repeat(64),
'missing-actual-ui-success':f=>f.proof.originalUiSuccessVerified=false,
'extra-replay':f=>f.proof.replayCount=2,
'body-artifact':f=>f.proof.bodyOrCookieArtifactsWritten=true,
'nonempty-automatic-credit':f=>f.proof.automaticCoverage=['blanket'],
'foreign-route':f=>f.proof.routePathname='/admin/pages-blocks/menus',
'non-auth-denial':f=>f.proof.denial={kind:'other',httpStatus:200,actionBodyExecutionProven:false},
'missing-owned-cleanup':f=>states.get(f.handle).cleanup=false,
'missing-owned-phase-completion':f=>states.get(f.handle).phase.footer--,
'foreign-handle':f=>handles.delete(f.handle)
};
for(const[name,mutate]of Object.entries(mutations))test('reject-'+name,()=>{const f=fixture();mutate(f);assert.throws(f.check);});
const artifact={status:'pass',count:checks.length,checks,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),canonicalOwnerSha256:crypto.createHash('sha256').update(ownerSource).digest('hex'),automaticCoverage:[],boundary:'Actual canonical aggregate and current Navigation completion functions with controlled native/Browser ports; no live Browser or database permission evidence.'};fs.writeFileSync(path.join(dir,'navigation-permission-join-controls.json'),JSON.stringify(artifact,null,2)+'\n');console.log(JSON.stringify({status:artifact.status,count:artifact.count}));
