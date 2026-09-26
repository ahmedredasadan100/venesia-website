import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJiti } from 'jiti';
import ts from 'typescript';

// Fixed verification recipes, checked against the live Product registry and
// manifest. This table grants no Product capability and is never imported by it.
const recipes = {
 topics: ['content/entity-list-contracts/topics','topicsQueryContract','topics','title','title','content-topics','status','unpublished','الحالة','غير منشور'],
 categories: ['content/entity-list-contracts/categories','categoriesQueryContract','topic_categories','name','name','content-categories','status','unpublished','الحالة','غير منشور'],
 series: ['content/entity-list-contracts/series','seriesQueryContract','topic_series','name','name','content-series','status','unpublished','الحالة','غير منشور'],
 pages: ['pages/entity-list-contract','pagesQueryContract','pages','title','title','pages'],
 projects: ['projects/entity-list-contract','projectsQueryContract','projects','arabic_name','arabic_name',null,'publication_status','unpublished','حالة النشر','غير منشور'],
 redirects: ['redirects/entity-list-contract','redirectsQueryContract','url_redirects','source_path','updated_at','seo-redirects','status','inactive','الحالة','غير نشط'],
 activity_log: ['audit/entity-list-contract','activityLogQueryContract','admin_audit_logs','entity_label','created_at','activity-log','entityType','topic','نوع الكيان','topic'],
 topics_without_image: ['media-catalog/topics-without-image-entity-list-contract','topicsWithoutImageQueryContract','topics','title','updated_at','reports-topics-without-image','type','article','نوع المحتوى','مقال'],
 admin_users: ['users/entity-list-contract','adminUsersQueryContract','admin_users','username','created_at','admin-users','status','inactive','الحالة','موقوف'],
};
for(const level of ['governorate','city','main_area','sub_area'])recipes['project_locations_'+level]=['projects/location-management-contract','projectLocationsQueryContract','project_locations','name_ar','name_ar',null,'status','inactive','الحالة','غير نشط'];
for(const kind of ['stages','items','updates'])recipes['project_tracking_'+kind]=['projects/tracking-contract','tracking'+kind[0].toUpperCase()+kind.slice(1)+'QueryContract','project_tracking_'+kind,kind==='updates'?'title':'name',kind==='updates'?'occurred_at':'name','project-tracking-'+kind,kind==='updates'?'publication':'visibility',kind==='updates'?'draft':'hidden',kind==='updates'?'النشر':'الظهور',kind==='updates'?'مسودة':'مخفي'];

export function registeredEntityKeys(source){
 const ast=ts.createSourceFile('registry.ts',source,ts.ScriptTarget.Latest,true);let declaration;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='adminEntityListAdapterRegistry')declaration=node.initializer;ts.forEachChild(node,visit);}visit(ast);
 while(declaration&&(ts.isAsExpression(declaration)||ts.isParenthesizedExpression(declaration)))declaration=declaration.expression;
 assert.ok(declaration&&ts.isObjectLiteralExpression(declaration));
 return declaration.properties.map(p=>{assert.ok(ts.isPropertyAssignment(p));return p.name.getText(ast).replace(/^['"]|['"]$/g,'');}).sort();
}
export async function loadCoreQueryPresentationPlan(){
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
 const manifest=await jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
 const registry=readFileSync(new URL('../../src/lib/admin/entity-list/data-engine/registry.ts',import.meta.url),'utf8');
 assert.deepEqual(registeredEntityKeys(registry),Object.keys(recipes).sort(),'Changed registry requires explicit recipe review.');
 const declarations=manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.flatMap(s=>s.consumerAdoptionEvidence?.length?s.consumerAdoptionEvidence.map(child=>({...s,...child})):[s]).filter(s=>s.dataRegistryEntities?.length);
 const queryOwner=await jiti.import('../../src/lib/admin/entity-list/data-engine/contracts.ts');
 const location=await jiti.import('../../src/lib/admin/projects/location-management-contract.ts');
 const tracking=await jiti.import('../../src/lib/admin/projects/tracking-contract.ts');const projects=await jiti.import('../../src/lib/projects/public-helpers.ts');const plan=[];
 for(const [entity,tuple]of Object.entries(recipes)){
  const [modulePath,exportName,table,labelColumn,sortField,viewKey,filterKey,filterValue,filterLabel,optionLabel]=tuple;
  assert.ok(typeof modulePath==='string'&&typeof exportName==='string'&&typeof table==='string'&&typeof labelColumn==='string'&&typeof sortField==='string');
  const loaded=await jiti.import('../../src/lib/admin/'+modulePath+'.ts'),contract=loaded[exportName];assert.ok(contract?.sortFields.includes(sortField));
  const consumers=declarations.filter(s=>s.dataRegistryEntities.includes(entity));assert.equal(consumers.length,1);const declaration=consumers[0];
  for(const type of entity==='projects'?['residential','commercial']:[null]){
   const key=type?entity+'-'+type:entity,level=entity.startsWith('project_locations_')?entity.slice('project_locations_'.length):null,kind=entity.startsWith('project_tracking_')?entity.slice('project_tracking_'.length):null;
   const route=type?'/admin/projects/'+type:level?location.projectLocationManagementPath(level):kind?null:declaration.routes[0];assert.ok(kind||(typeof route==='string'&&route.startsWith('/admin/')));
   plan.push({key,entity,consumerId:declaration.id,table,labelColumn,sortField,contract,type,level,kind,route,viewKey:type?'projects-'+type:level?location.getProjectLocationManagementListViewKey(level):viewKey,columnVisibility:declaration.columnVisibility,rowActions:manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities.find(r=>r.entity===entity)?.actions??null,filter:filterKey?{key:filterKey,value:filterValue,label:filterLabel,optionLabel}:null,rowCount:2*Math.min(...contract.pageSizeOptions)+3,
    normalizeQuery(params,f){const locked=type?{type}:kind?{project_id:String(f.projectId),...(kind==='items'?{stage_id:String(f.stageId)}:kind==='updates'?{item_id:String(f.itemId)}:{})}:{};return queryOwner.normalizeAdminEntityListQueryWithRouteParams(contract,params,locked);},
    publicPathFor(row){return entity==='projects'?projects.getProjectHref({slug:row.slug}):entity==='pages'?row.path:null;},
    routeFor(f){return route??(kind==='stages'?tracking.trackingProjectPath(f.projectId):kind==='items'?tracking.trackingStagePath(f.projectId,f.stageId):tracking.trackingItemPath(f.projectId,f.itemId));}});
  }
 }
 assert.deepEqual([...new Set(plan.map(r=>r.entity))].sort(),registeredEntityKeys(registry));return plan;
}
export const CORE_QUERY_SCENARIOS=['first','second','third','descending','filtered','empty','clamp','wide','preferences'];
export function coreQueryScenario(spec,fixture,scenario){
 assert.ok(CORE_QUERY_SCENARIOS.includes(scenario)||(spec.entity==='activity_log'&&Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,scenario)));assert.ok(/^qa-b1-[a-z0-9-]+$/.test(fixture.search));
 const size=Math.min(...spec.contract.pageSizeOptions),params=new URLSearchParams({q:scenario==='empty'?fixture.search+'-absent':fixture.search,sort:spec.sortField+'_'+(scenario==='descending'?'desc':'asc'),limit:String(size)});
 if(spec.type)params.set('type',spec.type);
 if(spec.kind){params.set('project_id',String(fixture.projectId));if(spec.kind==='items')params.set('stage_id',String(fixture.stageId));if(spec.kind==='updates')params.set('item_id',String(fixture.itemId));}
 if(scenario==='filtered'||Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,scenario)){assert.ok(spec.filter,'Consumer has no filter recipe.');params.set(spec.filter.key,spec.filter.value);}
 if(Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,scenario)){assert.equal(spec.entity,'activity_log');for(const [key,value]of Object.entries(CORE_ACTIVITY_DATE_SCENARIOS[scenario]))params.set(key,value);}
 if(['second','third','clamp'].includes(scenario))params.set('page',scenario==='second'?'2':scenario==='third'?'3':'999999');
 if(scenario==='wide'){const next=spec.contract.pageSizeOptions.find(v=>v>size);assert.ok(next);params.set('limit',String(next));}return params;
}


/** Activity-only fixed date boundaries over the existing Jan-03 read fixtures. */
export const CORE_ACTIVITY_DATE_SCENARIOS={
 'date-from-included':{dateFrom:'2026-01-03'},'date-from-empty':{dateFrom:'2026-01-04'},'date-from-cleared':{},
 'date-to-included':{dateTo:'2026-01-03'},'date-to-empty':{dateTo:'2026-01-02'},'date-to-cleared':{},
};
export function assertCoreActivityDateReceipts(outcome,proofs,spec,fixture){
 if(spec.entity!=='activity_log'){assert.equal(outcome.dateFilterEvidence,null);assert.ok(proofs.every(row=>!Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,row.scenario)));return null;}
 assert.equal(spec.consumerId,'activity-log');assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.routeKey,spec.key);
 const result=outcome.dateFilterEvidence;assert.ok(result);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);assert.deepEqual(result.observations.map(row=>row.field),['dateFrom','dateTo']);
 const base=proofs.filter(row=>row.scenario==='filtered');assert.equal(base.length,1);assert.ok(base[0].completeIds.length>0);
 const dates=proofs.filter(row=>Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,row.scenario));assert.deepEqual(dates.map(row=>row.scenario),Object.keys(CORE_ACTIVITY_DATE_SCENARIOS));assert.equal(new Set(dates.map(row=>row.id)).size,dates.length);
 const used=[];
 for(const observation of result.observations){
  const from=observation.field==='dateFrom',prefix=from?'date-from':'date-to',seed='2026-01-03',empty=from?'2026-01-04':'2026-01-02';
  assert.equal(observation.sourceControlId,from?'activity-date-from':'activity-date-to');assert.equal(observation.type,'date');assert.equal(observation.focused,true);assert.equal(observation.seed,seed);assert.match(observation.keyboardChanged,/^\d{4}-\d{2}-\d{2}$/u);assert.notEqual(observation.keyboardChanged,seed);assert.equal(observation.keyboardRestored,seed);assert.equal(observation.clearedValue,'');assert.equal(observation.emptyValue,empty);assert.deepEqual(observation.appliedValues,[seed,empty,'']);assert.equal(observation.unrelatedQuerySortEntityTypePreserved,true);assert.equal(observation.appliedClearRemovedParam,true);
  assert.equal(observation.nativeCheckpointIds.length,3);
  for(const [index,suffix]of ['included','empty','cleared'].entries()){
   const matches=dates.filter(row=>row.id===observation.nativeCheckpointIds[index]);assert.equal(matches.length,1);const proof=matches[0],scenario=prefix+'-'+suffix;assert.equal(proof.scenario,scenario);assert.equal(proof.actorId,outcome.nativeActorId);assert.equal(proof.ownedRunId,base[0].ownedRunId);assert.equal(proof.fixtureFingerprint,base[0].fixtureFingerprint);used.push(proof.id);
   const params=coreQueryScenario(spec,fixture,scenario);assert.equal(proof.query,params.toString());assert.equal(params.get('entityType'),spec.filter.value);assert.equal(params.get('q'),fixture.search);
   const p=proof.dateFilterProjection;assert.ok(p);assert.equal(p.dateFrom,params.get('dateFrom')??'');assert.equal(p.dateTo,params.get('dateTo')??'');assert.equal(p.lower,p.dateFrom?p.dateFrom+'T00:00:00.000Z':null);assert.equal(p.upper,p.dateTo?p.dateTo+'T23:59:59.999Z':null);
   assert.deepEqual(proof.completeIds,suffix==='empty'?[]:base[0].completeIds);assert.deepEqual(p.timestamps.map(row=>row.id),proof.completeIds);
   for(const row of p.timestamps){assert.equal(typeof row.createdAt,'string');const stamp=Date.parse(row.createdAt);assert.ok(Number.isFinite(stamp));if(p.lower)assert.ok(stamp>=Date.parse(p.lower));if(p.upper)assert.ok(stamp<=Date.parse(p.upper));}
  }
 }
 assert.deepEqual(used,dates.map(row=>row.id));return {candidateRequiredCase:'collection:'+spec.consumerId+':capability:date_picker',nativeIds:used,actorId:outcome.nativeActorId,automaticCoverage:[],globalClosed:false,boundary:result.boundary};
}
