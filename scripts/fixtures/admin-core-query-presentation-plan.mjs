import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
 const contentRoutes=await jiti.import('../../src/lib/admin/content-routes.ts');
 const contentTypes=await jiti.import('../../src/lib/admin/content/content-types.ts'),audit=await jiti.import('../../src/lib/admin/audit/audit-actions.ts');
 const loginAction=audit.AUDIT_ACTION_OPTIONS.find(row=>row.value==='auth.login.success');assert.ok(loginAction);
 const booleanOptions=[{value:'yes',label:'مميز'},{value:'no',label:'غير مميز'}];
 const extraFilters={
  topics:[{id:'content-type',key:'content_type',label:'نوع المحتوى',options:contentTypes.CONTENT_TYPE_OPTIONS},{id:'category',key:'category',label:'التصنيف',dynamicCategory:true},{id:'series',key:'series',label:'السلسلة',dynamicSeries:true,options:[{value:'any',label:'مرتبط بأي سلسلة'}]},{id:'featured',key:'featured',label:'التمييز',options:booleanOptions},{id:'image',key:'image',label:'الصورة',options:[{value:'without',label:'بدون صورة'}]}],
  series:[{id:'series-category-filter',key:'category',label:'التصنيف',dynamicCategory:true}],
  projects:[{id:'project-featured',key:'featured',label:'التمييز',options:booleanOptions}],
  redirects:[{id:'redirect-type-filter',key:'type',label:'نوع التحويل',options:[{value:'301',label:'301 دائم'},{value:'302',label:'302 مؤقت'}]}],
  activity_log:[{id:'activity-actor',key:'actor',label:'المستخدم',options:[{value:'qa_admin_interaction',label:'qa_admin_interaction'}]},{id:'activity-action',key:'action',label:'نوع العملية',options:[loginAction]}],
  topics_without_image:[{id:'topics-without-image-status',key:'status',label:'الحالة',options:[{value:'published',label:'منشور'},{value:'unpublished',label:'غير منشور'}]}],
  admin_users:[{id:'users-role',key:'role',label:'الدور',options:[{value:'admin',label:'مدير'}]}],
  project_tracking_items:[{id:'tracking-status',key:'status',label:'الحالة',options:[{value:'not_started',label:'لم يبدأ'},{value:'in_progress',label:'جاري التنفيذ'},{value:'completed',label:'مكتمل'}]}],
 };
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
   const viewLink=Object.hasOwn(contract.rawFilterSchemas,'view')?coreQueryTrashLinkFromSource(readFileSync(new URL('../../src/app'+route+'/page.tsx',import.meta.url),'utf8'),route,contentRoutes.ADMIN_CONTENT_ROUTES):null;
   plan.push({viewLink,key,entity,extraFilters:extraFilters[entity]??[],consumerId:declaration.id,table,labelColumn,sortField,contract,type,level,kind,route,viewKey:type?'projects-'+type:level?location.getProjectLocationManagementListViewKey(level):viewKey,columnVisibility:declaration.columnVisibility,rowActions:manifest.ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities.find(r=>r.entity===entity)?.actions??null,filter:filterKey?{key:filterKey,value:filterValue,label:filterLabel,optionLabel}:null,rowCount:2*Math.min(...contract.pageSizeOptions)+3,
    normalizeQuery(params,f){const locked=type?{type}:kind?{project_id:String(f.projectId),...(kind==='items'?{stage_id:String(f.stageId)}:kind==='updates'?{item_id:String(f.itemId)}:{})}:{};return queryOwner.normalizeAdminEntityListQueryWithRouteParams(contract,params,locked);},
    publicPathFor(row){return entity==='projects'?projects.getProjectHref({slug:row.slug}):entity==='pages'?row.path:null;},
    routeFor(f){return route??(kind==='stages'?tracking.trackingProjectPath(f.projectId):kind==='items'?tracking.trackingStagePath(f.projectId,f.stageId):tracking.trackingItemPath(f.projectId,f.itemId));}});
  }
 }
 assert.deepEqual([...new Set(plan.map(r=>r.entity))].sort(),registeredEntityKeys(registry));return plan;
}
export const CORE_QUERY_SCENARIOS=['first','second','third','descending','filtered','empty','clamp','wide','preferences'];
export function coreQueryScenario(spec,fixture,scenario){
 const extraFilterCase=scenario.startsWith('extra-filter-')?coreQueryExtraFilterCases(spec,fixture).find(row=>row.scenario===scenario):null;
 assert.ok(extraFilterCase||CORE_QUERY_SCENARIOS.includes(scenario)||CORE_QUERY_SEARCH_SCENARIOS.includes(scenario)||CORE_QUERY_STALE_SCENARIOS.includes(scenario)||coreQueryViewScenarios(spec).includes(scenario)||(spec.entity==='activity_log'&&Object.hasOwn(CORE_ACTIVITY_DATE_SCENARIOS,scenario)));assert.ok(/^qa-b1-[a-z0-9-]+$/.test(fixture.search));
 if(scenario==='view-trash-before'||scenario==='view-trash-after')return new URLSearchParams({view:'trash'});
 const size=Math.min(...spec.contract.pageSizeOptions),params=new URLSearchParams({q:scenario==='empty'?fixture.search+'-absent':fixture.search,sort:spec.sortField+'_'+(scenario==='descending'?'desc':'asc'),limit:String(size)});
 if(CORE_QUERY_SEARCH_SCENARIOS.includes(scenario)){
  const symbols={'search-literal-percent':'%','search-literal-underscore':'_','search-literal-star':'*','search-literal-quote':'"','search-literal-backslash':'\\'};
  if(Object.hasOwn(symbols,scenario))params.set('q',fixture.search+symbols[scenario]);
  else if(scenario==='search-short')params.set('q','q');else if(scenario==='search-cleared')params.delete('q');else assert.equal(scenario,'search-restored');
 }
 if(scenario==='stale-held')params.set('q',fixture.search+'-held-older-read');
 if(extraFilterCase?.phase==='applied')params.set(extraFilterCase.key,extraFilterCase.value);
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

export const CORE_QUERY_SEARCH_SCENARIOS=['search-literal-percent','search-literal-underscore','search-literal-star','search-literal-quote','search-literal-backslash','search-short','search-cleared','search-restored'];
/** Verification projections bound by the canonical guard to current searchable source fields. */
export function coreQuerySearchColumns(spec){
 const fields={topics:['title'],categories:['name'],series:['name','slug'],pages:['title','slug','path','page_type','status'],projects:['arabic_name','english_name','slug','location_label'],redirects:['source_path','destination_path','note'],activity_log:['actor_username','entity_label'],topics_without_image:['title','slug'],admin_users:['username','email','full_name']};
 const selected=spec.level?['name_ar','name_en']:spec.kind?(spec.kind==='updates'?['title','body']:['name','description']):fields[spec.entity];assert.ok(selected,'Unknown registered search projection.');return [...selected];
}
export function assertCoreQuerySearchReceipts(outcome,proofs,spec,fixture){
 const result=outcome.searchBoundary;assert.ok(result);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);
 assert.deepEqual(result.observations.map(row=>row.scenario),CORE_QUERY_SEARCH_SCENARIOS);const selected=proofs.filter(row=>CORE_QUERY_SEARCH_SCENARIOS.includes(row.scenario));assert.deepEqual(selected.map(row=>row.scenario),CORE_QUERY_SEARCH_SCENARIOS);assert.equal(new Set(selected.map(row=>row.id)).size,selected.length);
 const first=proofs.find(row=>row.scenario==='first');assert.ok(first);const used=[];
 for(const[index,observation]of result.observations.entries()){
  const proof=selected[index],params=coreQueryScenario(spec,fixture,observation.scenario),requested=params.get('q')??'',normalized=spec.normalizeQuery(params,fixture).search;
  assert.equal(observation.requested,requested);assert.equal(observation.normalizedSearch,normalized);assert.equal(observation.nativeId,proof.id);assert.equal(observation.actualInputInteraction,true);assert.equal(observation.actualClearButton,observation.scenario==='search-cleared');assert.equal(observation.registeredRouteScopeVerified,true);
  assert.equal(proof.query,params.toString());assert.equal(proof.actorId,outcome.nativeActorId);assert.equal(proof.ownedRunId,first.ownedRunId);assert.equal(proof.fixtureFingerprint,first.fixtureFingerprint);assert.deepEqual(proof.searchProjection,{scenario:observation.scenario,normalizedSearch:normalized,columns:coreQuerySearchColumns(spec),scope:'full-registered-route',completeIds:proof.completeIds});
  if(observation.scenario.startsWith('search-literal-'))assert.deepEqual(proof.completeIds,[],'Wildcard broadening cannot become literal-search proof.');
  if(observation.scenario==='search-restored')assert.deepEqual(proof.completeIds,first.completeIds);used.push(proof.id);
 }
 assert.deepEqual(used,selected.map(row=>row.id));return {consumerId:spec.consumerId,nativeIds:used,actorId:outcome.nativeActorId,fragments:['literal-punctuation','contract-normalized-short-input','actual-clear','namespace-restoration'],staleResponseOrdering:'pending-separate-proof',automaticCoverage:[],globalClosed:false};
}

/** Fixed source-bound verification recipes; they do not declare Product capabilities. */
export function coreQueryExtraFilterCases(spec,fixture){
 const cases=[];
 for(const filter of spec.extraFilters??[]){
  assert.ok(Object.hasOwn(spec.contract.rawFilterSchemas,filter.key));
  const seriesOption=filter.dynamicSeries?fixture.filterOptions?.series:null;if(filter.dynamicSeries){assert.equal(filter.key,'series');assert.equal(spec.entity,'topics');assert.ok(Number.isSafeInteger(seriesOption?.id)&&seriesOption.id>0);assert.ok(typeof seriesOption.name==='string'&&seriesOption.name.length>0);}
  const options=filter.dynamicCategory?[{value:String(fixture.filterOptions?.category?.id),label:fixture.filterOptions?.category?.name}]:filter.dynamicSeries?[...filter.options,{value:String(seriesOption.id),label:seriesOption.name}]:filter.options;
  if(filter.dynamicCategory){assert.ok(Number.isSafeInteger(fixture.filterOptions?.category?.id)&&fixture.filterOptions.category.id>0);assert.ok(typeof fixture.filterOptions.category.name==='string'&&fixture.filterOptions.category.name.length>0);}
  assert.ok(Array.isArray(options)&&options.length>0);
  for(const[ordinal,option]of options.entries()){
   assert.equal(typeof option.value,'string');assert.ok(typeof option.label==='string'&&option.label.length>0);
   assert.ok(spec.contract.rawFilterSchemas[filter.key].safeParse(option.value).success);
   for(const phase of ['applied','cleared'])cases.push({scenario:'extra-filter-'+filter.key+'-'+ordinal+'-'+phase,key:filter.key,fieldId:filter.id,label:filter.label,value:option.value,optionLabel:option.label,phase});
  }
 }
 assert.equal(new Set(cases.map(row=>row.scenario)).size,cases.length);return cases;
}
export function assertCoreQueryExtraFilterReceipts(outcome,proofs,spec,fixture){
 const planned=coreQueryExtraFilterCases(spec,fixture),result=outcome.extraFilterEvidence;assert.ok(result);assert.deepEqual(result.automaticCoverage,[]);assert.equal(result.globalClosed,false);
 assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.routeKey,spec.key);
 assert.deepEqual(result.observations.map(row=>row.scenario),planned.map(row=>row.scenario));
 const native=proofs.filter(row=>row.scenario.startsWith('extra-filter-'));assert.deepEqual(native.map(row=>row.scenario),planned.map(row=>row.scenario));assert.equal(new Set(native.map(row=>row.id)).size,native.length);
 const first=proofs.find(row=>row.scenario==='first');assert.ok(first&&first.completeIds.length>0);const used=[];
 for(const[ordinal,recipe]of planned.entries()){
  const observation=result.observations[ordinal],proof=native[ordinal];assert.equal(observation.nativeId,proof.id);
  for(const key of ['key','fieldId','label','value','optionLabel','phase'])assert.equal(observation[key],recipe[key]);
  for(const key of ['actualOptionInteraction','cancelPreservedQuery','cancelRestoredTriggerFocus','reloadPreservedAppliedQuery','querySortSizePreserved'])assert.equal(observation[key],true);
  assert.equal(observation.actualChipClear,recipe.phase==='cleared');
  assert.equal(proof.actorId,outcome.nativeActorId);assert.equal(proof.ownedRunId,first.ownedRunId);assert.equal(proof.fixtureFingerprint,first.fixtureFingerprint);assert.equal(proof.routeKey,spec.key);
  assert.equal(proof.query,coreQueryScenario(spec,fixture,recipe.scenario).toString());
  const projection=proof.extraFilterProjection;assert.ok(projection);assert.equal(projection.key,recipe.key);assert.equal(projection.value,recipe.phase==='applied'?recipe.value:null);assert.equal(projection.phase,recipe.phase);assert.equal(projection.scope,'registered-fixture-namespace');assert.deepEqual(projection.completeIds,proof.completeIds);
  assert.equal(new Set(proof.completeIds).size,proof.completeIds.length);assert.ok(proof.completeIds.every(id=>first.completeIds.includes(id)));
  if(recipe.phase==='cleared')assert.deepEqual(proof.completeIds,first.completeIds);
  used.push(proof.id);
 }
 return{consumerId:spec.consumerId,routeKey:spec.key,filterKeys:[...new Set(planned.map(row=>row.key))],nativeIds:used,automaticCoverage:[],globalClosed:false,boundary:'Actual fixed modal options, cancellation, reload and individual chip clear joined to native registered fixture projections. View links and unrepresented options remain explicit.'};
}

export const CORE_QUERY_STALE_SCENARIOS=['stale-held','stale-restored'];
export function coreQueryStaleOwner(){const path='src/lib/admin/entity-list/data-engine/client-controller.ts',source=readFileSync(new URL('../../'+path,import.meta.url),'utf8');assert.ok(source.includes('signal: AbortSignal')&&source.includes('queryFn: ({ signal }) => loadResult(query, signal)'));return{path,sha256:createHash('sha256').update(source).digest('hex')};}
export function coreQueryStaleRequestMatches(spec,fixture,url,origin){
 const actual=new URL(url);if(actual.origin!==origin||actual.pathname!=='/api/admin/entity-lists/'+spec.entity)return false;
 const expected=coreQueryScenario(spec,fixture,'stale-held');if(actual.searchParams.get('q')!==expected.get('q'))return false;
 const allowed=new Set(['q','sort','page','limit',...Object.keys(spec.contract.rawFilterSchemas)]);assert.ok([...actual.searchParams.keys()].every(key=>allowed.has(key)));assert.deepEqual(spec.normalizeQuery(actual.searchParams,fixture),spec.normalizeQuery(expected,fixture));return true;
}
export function assertCoreQueryStaleReceipts(outcome,proofs,spec,fixture){
 const observation=outcome.staleReadEvidence;assert.ok(observation);assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.routeKey,spec.key);assert.equal(spec.contract.mode,'server-page');assert.deepEqual(observation.sourceOwner,coreQueryStaleOwner());assert.deepEqual(observation.automaticCoverage,[]);assert.equal(observation.globalClosed,false);
 const selected=proofs.filter(row=>CORE_QUERY_STALE_SCENARIOS.includes(row.scenario));assert.deepEqual(selected.map(row=>row.scenario),CORE_QUERY_STALE_SCENARIOS);assert.equal(new Set(selected.map(row=>row.id)).size,2);const first=proofs.find(row=>row.scenario==='first');assert.ok(first&&first.completeIds.length);
 const[held,current]=selected;assert.equal(observation.heldNativeId,held.id);assert.equal(observation.currentNativeId,current.id);for(const proof of selected){assert.equal(proof.routeKey,spec.key);assert.equal(proof.actorId,outcome.nativeActorId);assert.equal(proof.ownedRunId,first.ownedRunId);assert.equal(proof.fixtureFingerprint,first.fixtureFingerprint);assert.equal(proof.query,coreQueryScenario(spec,fixture,proof.scenario).toString());const query=spec.normalizeQuery(new URLSearchParams(proof.query),fixture);assert.deepEqual(proof.searchProjection,{scenario:proof.scenario,normalizedSearch:query.search,columns:coreQuerySearchColumns(spec),scope:'full-registered-route',completeIds:proof.completeIds});}
 assert.deepEqual(held.completeIds,[]);assert.deepEqual(current.completeIds,first.completeIds);const size=Math.min(...spec.contract.pageSizeOptions),expected=first.completeIds.slice(0,size);assert.deepEqual(observation.beforeReleaseIds,expected);assert.deepEqual(observation.afterReleaseIds,expected);assert.deepEqual(observation.heldResponseIds,[]);assert.equal(observation.heldResponseStatus,200);assert.equal(observation.strictRequestCount,1);assert.equal(observation.posts,0);assert.equal(observation.actualSearchInteraction,true);assert.equal(observation.currentQueryRetained,true);assert.equal(observation.method,'GET');assert.equal(observation.pathname,'/api/admin/entity-lists/'+spec.entity);
 const events=observation.events;assert.deepEqual(Object.keys(events).sort(),['currentSettled','held','released','terminal']);for(const value of Object.values(events))assert.ok(Number.isSafeInteger(value)&&value>0);assert.equal(new Set(Object.values(events)).size,4);assert.ok(events.held<events.currentSettled&&events.currentSettled<events.released&&events.held<events.terminal);
 if(observation.terminal==='aborted'){assert.equal(observation.failure,'net::ERR_ABORTED');assert.equal(observation.responseDelivered,false);}else{assert.equal(observation.terminal,'completed');assert.equal(observation.failure,null);assert.equal(observation.responseDelivered,true);assert.ok(events.terminal>events.released);}
 return{consumerId:spec.consumerId,routeKey:spec.key,nativeIds:selected.map(row=>row.id),actorId:outcome.nativeActorId,terminal:observation.terminal,sourceOwner:observation.sourceOwner,automaticCoverage:[],globalClosed:false,boundary:'Actual old registered GET held after genuine HTTP/native projection, current query settled first, old read aborted or delivered late without replacing current native IDs. No synthetic response or whole-axis credit.'};
}

export function coreQueryTrashLinkFromSource(source,route,contentRoutes){
 const file=ts.createSourceFile('selected-page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),matches=[];function walk(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(file)==='AdminActionButton'&&node.children.filter(ts.isJsxText).map(row=>row.text.trim()).join('')==='المحذوفات')matches.push(node);ts.forEachChild(node,walk);}walk(file);assert.equal(matches.length,1);
 const prop=matches[0].openingElement.attributes.properties.find(row=>ts.isJsxAttribute(row)&&row.name.text==='href');assert.ok(prop?.initializer);let href;
 if(ts.isStringLiteral(prop.initializer))href=prop.initializer.text;else{const expression=prop.initializer.expression;assert.ok(ts.isTemplateExpression(expression)&&expression.head.text===''&&expression.templateSpans.length===1);const span=expression.templateSpans[0];assert.ok(ts.isPropertyAccessExpression(span.expression)&&span.expression.expression.getText(file)==='ADMIN_CONTENT_ROUTES');assert.ok(source.includes('import { ADMIN_CONTENT_ROUTES } from "../../../../lib/admin/content-routes"'));href=contentRoutes[span.expression.name.text]+span.literal.text;}
 assert.equal(href,route+'?view=trash');return{href,label:'المحذوفات',pageSourceSha256:createHash('sha256').update(source).digest('hex')};
}
export function coreQueryViewScenarios(spec){if(!spec.viewLink)return[];assert.ok(['topics','categories','series'].includes(spec.entity));return['view-trash-before','view-trash-after','view-active-restored'];}
export function assertCoreQueryViewReceipts(outcome,proofs,spec,fixture){
 const scenarios=coreQueryViewScenarios(spec),selected=proofs.filter(row=>row.scenario.startsWith('view-'));assert.deepEqual(selected.map(row=>row.scenario),scenarios);const observation=outcome.viewLinkEvidence;
 if(!scenarios.length){assert.equal(observation,null);return null;}
 assert.ok(observation);assert.equal(outcome.consumerId,spec.consumerId);assert.equal(outcome.routeKey,spec.key);assert.deepEqual(observation.sourceLink,spec.viewLink);assert.deepEqual(observation.nativeIds,selected.map(row=>row.id));assert.equal(new Set(selected.map(row=>row.id)).size,3);const first=proofs.find(row=>row.scenario==='first');assert.ok(first);
 for(const proof of selected){assert.equal(proof.actorId,outcome.nativeActorId);assert.equal(proof.ownedRunId,first.ownedRunId);assert.equal(proof.routeKey,spec.key);assert.equal(proof.fixtureFingerprint,first.fixtureFingerprint);assert.equal(proof.query,coreQueryScenario(spec,fixture,proof.scenario).toString());assert.deepEqual(proof.viewProjection.completeIds,proof.completeIds);assert.equal(proof.viewProjection.scope,proof.scenario==='view-active-restored'?'active-namespace-restored':'full-current-trash');assert.match(proof.viewProjection.domainAuditFingerprint,/^[a-f0-9]{32}:[a-f0-9]{32}$/u);}
 assert.deepEqual(selected[0].completeIds,selected[1].completeIds);assert.deepEqual(selected[2].completeIds,first.completeIds);assert.ok(selected.every(row=>row.viewProjection.domainAuditFingerprint===selected[0].viewProjection.domainAuditFingerprint));assert.deepEqual(observation.trashCompleteIds,selected[0].completeIds);assert.deepEqual(observation.activeCompleteIds,first.completeIds);assert.equal(observation.clickedHref,spec.viewLink.href);for(const key of ['actualLinkClicked','actualTrashHeader','reloadPreserved','backRestoredPriorQuery','priorRowsRestored','canonicalDefaultsObserved'])assert.equal(observation[key],true);assert.equal(observation.posts,0);assert.equal(observation.activeControl,'browser-history-back');assert.deepEqual(observation.automaticCoverage,[]);assert.equal(observation.globalClosed,false);
 return{consumerId:spec.consumerId,routeKey:spec.key,nativeIds:selected.map(row=>row.id),actorId:outcome.nativeActorId,observedTrashRows:selected[0].completeIds.length,automaticCoverage:[],globalClosed:false,boundary:'Exact current Trash link, default query/ordered first page, reload and browser Back to prior active query. Native full trash membership and complete domain/audit fingerprint joined; no invented active toggle or lifecycle mutation claim.'};
}
