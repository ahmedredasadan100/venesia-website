import {readFileSync} from 'node:fs';
import {validateCoreJourneySelection} from './fixtures/admin-core-domain-form-journeys.mjs';
import {coreTemplateBulkSubmittedAction,selectCoreTemplateBulkPlan,assertCoreTemplateHeroBulkReceipt,CORE_TEMPLATE_HERO_BULK_SELECTION,CORE_TEMPLATE_HERO_BULK_IDS} from './fixtures/admin-core-template-bulk-journeys.mjs';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCoreTemplateBulkPlan, assertCoreTemplateBulkNative } from './fixtures/admin-core-template-bulk-journeys.mjs';
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,jsx:{runtime:"automatic"}});
const manifest=await jiti.import('../src/lib/admin/interaction-system/adoption-manifest.ts');
const declarations=manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(row=>row.id==='block-template-libraries').consumerAdoptionEvidence;
const templates=declarations.flatMap((row,kindIndex)=>Array.from({length:9},(_,index)=>{const kind=row.id.replace(/-template-library$/,'');return {kind,id:kindIndex*100+index+1,assigned:index===0,name:`QA ${kind} ${index===0?'Assigned':'Unused '+index}`,slug:`qa-admin-page-interaction-${kind}-${index}`};}));
const input={collectionAdoption:manifest.ADMIN_COLLECTION_SURFACE_ADOPTION,rowActions:manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,fixtures:{pages:{templates}}};
const checks=[];const pass=(name,fn)=>{fn();checks.push(name);};
const plan=buildCoreTemplateBulkPlan(input);
pass('Current manifest binds every declared library to independent final-two unassigned rows',()=>{assert.equal(plan.length,declarations.length);for(const row of plan){assert.equal(row.targets.length,2);assert.ok(row.targets.every(target=>target.name.endsWith('Unused 7')||target.name.endsWith('Unused 8')));assert.ok(row.targets.every(target=>target.id!==row.source.id&&target.id!==row.assigned.id));}});
for(const [name,change] of [
 ['missing-library',v=>v.collectionAdoption.surfaces.find(x=>x.id==='block-template-libraries').consumerAdoptionEvidence.pop()],
 ['too-few-owned-fixtures',v=>v.fixtures.pages.templates.splice(v.fixtures.pages.templates.findIndex(x=>x.kind==='content'&&!x.assigned),1)],
 ['foreign-name',v=>v.fixtures.pages.templates.find(x=>x.kind==='content'&&x.name.endsWith('Unused 8')).name='Original template'],
 ['foreign-slug',v=>v.fixtures.pages.templates.find(x=>x.kind==='content'&&x.name.endsWith('Unused 8')).slug='original-content'],
 ['duplicate-target',v=>{const a=v.fixtures.pages.templates.filter(x=>x.kind==='content'&&!x.assigned);a.at(-1).id=a.at(-2).id;}],
 ['assigned-target',v=>{const a=v.fixtures.pages.templates.filter(x=>x.kind==='content');a.at(-1).id=a[0].id;}],
 ['invalid-target-id',v=>{v.fixtures.pages.templates.find(x=>x.kind==='content'&&x.name.endsWith('Unused 8')).id=-1;}],
])pass(name+' rejected',()=>{const next=structuredClone(input);change(next);assert.throws(()=>buildCoreTemplateBulkPlan(next));});
const recipe=plan[0];const receipt=action=>({kind:'form-save-native',status:'partial-not-global-pass',writes:recipe.targets.map(target=>({id:target.id,table:recipe.table,deleted:action==='delete',actual:{status:action==='publish'?'published':'unpublished'},audit:[{id:91,actor_admin_user_id:7,entity_id:null,entity_label:recipe.table,action:'content_block_template.'+(action==='hide'?'unpublish':action)}]}))});
for(const action of ['hide','publish','delete'])pass(action+' exact two-row aggregate audit accepted',()=>assertCoreTemplateBulkNative(receipt(action),recipe,action));
for(const [name,change] of [
 ['missing-row',v=>v.writes.pop()],['wrong-row',v=>v.writes[0].id++],['wrong-table',v=>v.writes[0].table='topics'],['wrong-status',v=>v.writes[0].actual.status='published'],['unexpected-delete',v=>v.writes[0].deleted=true],['missing-audit',v=>v.writes[0].audit=[]],['duplicate-audit',v=>v.writes[0].audit.push({...v.writes[0].audit[0]})],['row-audit-instead-of-aggregate',v=>v.writes[0].audit[0].entity_id=v.writes[0].id],['wrong-aggregate-table',v=>v.writes[0].audit[0].entity_label='other'],['wrong-action',v=>v.writes[0].audit[0].action='content_block_template.publish'],['missing-actor',v=>v.writes[0].audit[0].actor_admin_user_id=null],['two-distinct-commands',v=>v.writes[0].audit[0].id++],['failed-native',v=>v.status='fail'],
])pass(name+' rejected',()=>{const value=receipt('hide');change(value);assert.throws(()=>assertCoreTemplateBulkNative(value,recipe,'hide'));});
const {default:Bulk}=await jiti.import('../src/components/admin/ui/AdminBulkActionBar.tsx');
const html=busy=>renderToStaticMarkup(React.createElement(Bulk,{selectedIds:recipe.ids,entityLabel:'قوالب',options:[{value:'hide',label:'إخفاء المحدد'}],onClearSelection:()=>{},onExecute:()=>{},isBusy:busy}));
pass('Actual shared bulk SSR emits combobox and both exact hidden identities',()=>{const s=html(false);assert.match(s,/role="combobox"/);for(const id of recipe.ids)assert.ok(s.includes(`name="ids" value="${id}"`));assert.match(s,/name="bulk_action" value="hide"/);});
pass('Actual pending bulk SSR disables stable submit control despite changing its label',()=>{const s=html(true);assert.match(s,/aria-busy="true"/);assert.match(s,/<button[^>]*type="submit"[^>]*disabled/);assert.ok(s.includes('جار التنفيذ...'));});

const hero=plan.find(row=>row.kind==='hero');
pass('Hero current UI and action owner submit show but persist published and audit publish',()=>{const ui=readFileSync('src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx','utf8'),owner=readFileSync('src/app/admin/pages-blocks/blocks/hero/actions.ts','utf8');assert.match(ui,/value: "show",\s+label: ADMIN_BULK_ACTION_LABELS.showSelected/u);assert.match(owner,/action === "show" \? "published" : "unpublished"/u);assert.match(owner,/action === "show"\s+\? "publish"/u);assert.match(owner,/metadata: \{ blockType: "hero", action, ids, count: ids.length \}/u);assert.equal(coreTemplateBulkSubmittedAction(hero,'publish'),'show');assert.equal(coreTemplateBulkSubmittedAction(hero,'hide'),'hide');assert.equal(coreTemplateBulkSubmittedAction(hero,'delete'),'delete');});
pass('All other current libraries retain exact existing action values',()=>{for(const row of plan.filter(x=>x!==hero))for(const action of ['hide','publish','delete'])assert.equal(coreTemplateBulkSubmittedAction(row,action),action);assert.throws(()=>coreTemplateBulkSubmittedAction(hero,'show'));});
pass('Only original Hero journey selected, omission preserves all libraries',()=>{assert.deepEqual(selectCoreTemplateBulkPlan(plan,CORE_TEMPLATE_HERO_BULK_SELECTION),[hero]);assert.equal(selectCoreTemplateBulkPlan(plan,null),plan);assert.equal(validateCoreJourneySelection({scope:'core-closure',cohort:'template-bulk',selection:CORE_TEMPLATE_HERO_BULK_SELECTION}),CORE_TEMPLATE_HERO_BULK_SELECTION);assert.throws(()=>selectCoreTemplateBulkPlan(plan,'unknown'));assert.throws(()=>selectCoreTemplateBulkPlan(plan.filter(r=>r!==hero),CORE_TEMPLATE_HERO_BULK_SELECTION));assert.throws(()=>validateCoreJourneySelection({scope:'core-closure',cohort:'domain-forms',selection:CORE_TEMPLATE_HERO_BULK_SELECTION}));});
const required=[{key:'original-universe'}],selected={journeySelection:CORE_TEMPLATE_HERO_BULK_SELECTION,cohort:'template-bulk',scope:'core-closure',inventoryOnly:false,driverCompleted:true,status:'pass',errors:[],wholeCohortExecuted:false,globalClosed:false,selectedJourneyIds:[...CORE_TEMPLATE_HERO_BULK_IDS],executedJourneyIds:[...CORE_TEMPLATE_HERO_BULK_IDS],evidence:[{id:'existing-auth-login',status:'pass'},{id:CORE_TEMPLATE_HERO_BULK_IDS[0],status:'pass'}],requiredCases:required};
pass('Exact selected receipt accepted without whole cohort promotion',()=>assert.deepEqual(assertCoreTemplateHeroBulkReceipt(selected,required).executedJourneyIds,CORE_TEMPLATE_HERO_BULK_IDS));
for(const[label,edit]of [['missing executed',r=>r.executedJourneyIds=[]],['extra journey',r=>r.executedJourneyIds.push('invented')],['failed evidence',r=>r.evidence[1].status='fail'],['changed universe',r=>r.requiredCases=[]],['global promotion',r=>r.globalClosed=true],['whole cohort promotion',r=>r.wholeCohortExecuted=true]])pass('Hero selection denies '+label,()=>{const r=structuredClone(selected);edit(r);assert.throws(()=>assertCoreTemplateHeroBulkReceipt(r,required));});

console.log(JSON.stringify({status:'pass',checks:checks.length,cases:checks,boundary:'Actual manifest, helper negative controls and shared Bulk/Listbox server rendering. Browser dispatch and DB/audit remain pending; no automatic capability coverage.'},null,2));
