import assert from 'node:assert/strict';
import { assertOwnedLocalHandle,type OwnedLocalHandle } from './lib/isolated-supabase.mts';
import { loadCoreDomainBulkPlan,coreDomainBulkStep,coreDomainBulkDescriptors,assertCoreDomainBulkNative } from './fixtures/admin-core-domain-bulk-journeys.mjs';

type Row=Record<string,unknown>;
function object(value:unknown):Row{assert.ok(value&&typeof value==='object'&&!Array.isArray(value));return value as Row;}
function rows(value:unknown):Row[]{assert.ok(Array.isArray(value));return value.map(object);}
/**
 * Join only the existing native broker's captured result, supplied by the owning
 * runner. It is not accepted from Browser metadata. No new SQL/protocol/registry.
 */
export async function verifyCoreDomainBulkCompletion(handle:OwnedLocalHandle,browserInput:unknown,fixtures:unknown,nativeBrokerInput:unknown){
 assertOwnedLocalHandle(handle);const browser=object(browserInput),broker=object(nativeBrokerInput);
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.equal(browser.cohort,'domain-bulk');assert.deepEqual(browser.errors,[]);
 assert.equal(broker.status,'pass');assert.equal(broker.ownedRunId,handle.identity.runId);
 const result=object(browser.domainBulk);assert.equal(result.status,'pass');const outcomes=rows(result.outcomes),evidence=rows(browser.evidence),records=rows(broker.records);
 assert.equal(new Set(records.map(row=>row.id)).size,records.length,'Duplicate native IDs cannot be joined.');
 const {plan}=await loadCoreDomainBulkPlan(fixtures);assertOwnedLocalHandle(handle);
 assert.deepEqual(outcomes.map(row=>row.entity).sort(),plan.map((row:{entity:string})=>row.entity).sort());
 assert.equal(result.expectedConsumers,plan.length);const used:string[]=[],allAuditIds=new Set<number>();let bulkCommands=0,publicationAudits=0,rowPreparations=0;
 function claim(id:unknown,kind:string){assert.equal(typeof id,'string');assert.ok(!used.includes(id as string),'A checkpoint cannot prove two different operations.');const row=records.find(item=>item.id===id);assert.ok(row,'A Browser receipt cannot invent native proof.');assert.equal(row.kind,kind);used.push(id as string);return row;}
 function unchanged(value:unknown){
  const pair=object(value),before=claim(pair.before,'form-permission-fingerprint'),after=claim(pair.after,'form-permission-fingerprint');
  for(const row of [before,after]){assert.equal(row.status,'pass');assert.equal(row.ownedRunId,handle.identity.runId);assert.equal(row.adminAuditIncluded,true);assert.equal(row.adminUsersIncluded,true);assert.ok(Number(row.publicTableCount)>0);}
  assert.equal(before.phase,'before');assert.equal(after.phase,'after');assert.equal(after.correlationId,before.correlationId);
  for(const key of ['publicTableCount','publicTableInventorySha256','publicDataSha256'])assert.equal(after[key],before[key]);
 }
 for(const recipe of plan){
  const outcome=outcomes.find(row=>row.entity===recipe.entity)!;assert.equal(outcome.consumer,recipe.consumer);assert.deepEqual(outcome.targetIds,recipe.ids);
  const receipt=evidence.filter(row=>row.id==='domain-bulk-'+recipe.entity+'-registered-options');assert.equal(receipt.length,1);assert.equal(receipt[0].status,'pass');
  for(const [key,value]of Object.entries(outcome))assert.deepEqual(receipt[0][key],value,'Final evidence must match its complete successful journey.');
  for(const key of ['pendingDuplicateBlocked','selectionRetainedOnFailure','selectionClearedAfterSuccess'])assert.equal(outcome[key],true);
  const rejection=object(outcome.rejection);assert.equal(rejection.attempts,1);unchanged(rejection);
  const operations=rows(outcome.actualCommands);assert.deepEqual(operations.map(row=>row.action),recipe.steps);
  for(const [ordinal,operation]of operations.entries()){
   assert.equal(operation.ordinal,ordinal);assert.equal(operation.requests,1);const step=coreDomainBulkStep(recipe,operation.action,ordinal);
   if(step.confirmation)unchanged(operation.cancelled);else assert.equal(operation.cancelled,null);
   const state=claim(operation.nativeState,'terminal-domain-state'),write=claim(operation.nativeWrite,'form-save-native');
   const since=String(rows(write.writes)[0]?.auditSince);assert.ok(Number.isFinite(Date.parse(since)));
   const descriptors=coreDomainBulkDescriptors(recipe,step,since,state);assertCoreDomainBulkNative(write,recipe,step);
   const saved=rows(write.writes);for(const descriptor of descriptors){const row=saved.find(value=>value.id===descriptor.id)!;if(!step.deleted)assert.deepEqual(row.actual,descriptor.expected);}
   const stateAudit=rows(state.audit),writeAudit=Array.from(new Set(saved.flatMap(row=>rows(row.audit).map(audit=>Number(audit.id)))));
   const aggregateIds=stateAudit.filter(row=>recipe.entity==='pages'||row.entity_id===null).map(row=>Number(row.id));
   assert.deepEqual([...writeAudit].sort((a,b)=>a-b),aggregateIds.sort((a,b)=>a-b));
   for(const id of writeAudit){assert.ok(!allAuditIds.has(id),'Two commands cannot claim one audit event.');allAuditIds.add(id);}
   if(recipe.entity==='topics'&&step.action==='publish'){
    const published=claim(operation.publicationAudit,'form-save-native');assert.equal(published.status,'partial-not-global-pass');assert.equal(published.caseId,'domain-bulk-topics-publication');assert.equal(published.formConsumer,recipe.consumer);assert.equal(published.surface,'bulk-publication-audit');
    const writes=rows(published.writes);assert.equal(writes.length,2);assert.deepEqual(writes.map(row=>row.id).sort(),[...recipe.ids].sort());
    for(const row of writes){assert.equal(row.table,'topics');assert.equal(row.expectedActorId,recipe.actorId);assert.equal(row.commandReceiptCount,0);assert.equal(row.deleted,false);
     const target=recipe.targets.find((target:{id:number})=>target.id===row.id);assert.ok(target);assert.deepEqual(row.actual,{title:target.label,status:'published'});
     const audit=rows(row.audit);assert.equal(audit.length,1);const event=audit[0];assert.equal(Number(event.actor_admin_user_id),recipe.actorId);assert.equal(Number(event.entity_id),row.id);assert.equal(event.entity_label,target.label);assert.equal(event.action,'topic.publish');
     assert.ok(stateAudit.some(value=>Number(value.id)===Number(event.id)));assert.ok(!allAuditIds.has(Number(event.id)));allAuditIds.add(Number(event.id));publicationAudits++;
    }
   }else assert.equal(operation.publicationAudit,null);
   bulkCommands++;
  }
  const preparations=outcome.preparationNativeIds;assert.ok(Array.isArray(preparations));assert.equal(preparations.length,recipe.entity==='categories'?2:0);
  for(const [index,id]of preparations.entries()){
   const proof=claim(id,'form-save-native');assert.equal(proof.status,'partial-not-global-pass');assert.equal(proof.caseId,'domain-bulk-categories-prepare');assert.equal(proof.formConsumer,recipe.consumer);assert.equal(proof.surface,'row-preparation');
   const writes=rows(proof.writes);assert.equal(writes.length,1);const row=writes[0],target=recipe.targets[index];assert.equal(row.id,target.id);assert.equal(row.expectedActorId,recipe.actorId);assert.equal(row.table,'topic_categories');assert.equal(row.deleted,false);assert.deepEqual(row.actual,{name:target.label,status:'unpublished',is_active:false});
   const audit=rows(row.audit);assert.equal(audit.length,1);const event=audit[0];assert.equal(Number(event.actor_admin_user_id),recipe.actorId);assert.equal(Number(event.entity_id),target.id);assert.equal(event.entity_type,'topic_category');assert.equal(event.entity_label,target.label);assert.equal(event.action,'topic_category.delete');
   assert.ok(!allAuditIds.has(Number(event.id)));allAuditIds.add(Number(event.id));rowPreparations++;
  }
 }
 assert.deepEqual([...used].sort(),records.map(row=>String(row.id)).sort(),'Every captured cohort checkpoint must be consumed exactly once.');
 assertOwnedLocalHandle(handle);return {status:'pass' as const,ownedRunId:handle.identity.runId,consumers:plan.length,bulkCommands,nativeCheckpoints:used.length,distinctAuditEvents:allAuditIds.size,publicationAudits,rowPreparations,automaticCoverage:[],globalClosed:false,
  boundary:'Current bulk recipes joined to this lifecycle broker records. Source-only no-bulk declarations are not behavioral proof; permission/persistence outages and mixed protected batches remain outside this cohort.'};
}

