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
 assert.ok(CORE_QUERY_SCENARIOS.includes(scenario));assert.ok(/^qa-b1-[a-z0-9-]+$/.test(fixture.search));
 const size=Math.min(...spec.contract.pageSizeOptions),params=new URLSearchParams({q:scenario==='empty'?fixture.search+'-absent':fixture.search,sort:spec.sortField+'_'+(scenario==='descending'?'desc':'asc'),limit:String(size)});
 if(spec.type)params.set('type',spec.type);
 if(spec.kind){params.set('project_id',String(fixture.projectId));if(spec.kind==='items')params.set('stage_id',String(fixture.stageId));if(spec.kind==='updates')params.set('item_id',String(fixture.itemId));}
 if(scenario==='filtered'){assert.ok(spec.filter,'Consumer has no filter recipe.');params.set(spec.filter.key,spec.filter.value);}
 if(['second','third','clamp'].includes(scenario))params.set('page',scenario==='second'?'2':scenario==='third'?'3':'999999');
 if(scenario==='wide'){const next=spec.contract.pageSizeOptions.find(v=>v>size);assert.ok(next);params.set('limit',String(next));}return params;
}

