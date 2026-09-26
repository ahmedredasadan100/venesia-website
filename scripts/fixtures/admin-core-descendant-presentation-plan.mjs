import assert from 'node:assert/strict';
import {createJiti} from 'jiti';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {collectExecutableSourceGraph} from '../lib/typescript-executable-graph.mts';

// Existing physical consumers and their declared aggregate descendants only.
// These test bindings grant no Product capability and add no new cohort.
const recipes=[
 {key:'menus',scope:'navigation',consumer:'menus-list',aliases:[],route:'/admin/pages-blocks/menus',preferenceId:'menus',rowType:'menu',optional:'status',label:'الحالة'},
 {key:'items',scope:'navigation',consumer:'menu-items',aliases:['menu-editor-shell'],route:'/admin/pages-blocks/menus/[id]',preferenceId:'menuItems',rowType:'menu_item',optional:'status',label:'الحالة'},
 {key:'assignments',scope:'composition',consumer:'page-block-assignments',aliases:['page-composition-shell'],route:'/admin/pages-blocks/pages/[id]',preferenceId:'pageAssignments',rowType:null,optional:'status',label:'الحالة'},
 {key:'footer',scope:'navigation',consumer:'footer-manual-links',aliases:['footer-builder-shell','footer-fixed-slots'],route:'/admin/pages-blocks/footer',preferenceId:null,rowType:'footer_manual_link',optional:null,label:null},
];
export async function loadCoreDescendantPresentationPlan(scope,root=process.cwd()){
 assert.ok(['navigation','composition'].includes(scope));const jiti=createJiti(resolve(root,'package.json'),{fsCache:false,moduleCache:false});
 const [{ADMIN_COLLECTION_SURFACE_ADOPTION:manifest},{PAGE_COMPOSITION_COLUMN_PREFERENCES:columns},pagination]=await Promise.all([jiti.import(resolve(root,'src/lib/admin/interaction-system/adoption-manifest.ts')),jiti.import(resolve(root,'src/lib/page-blocks/admin-collection-columns.ts')),jiti.import(resolve(root,'src/lib/admin/entity-list/pagination.ts'))]);
 return recipes.filter(recipe=>recipe.scope===scope).map(recipe=>{
  const declaration=manifest.surfaces.find(row=>row.id===recipe.consumer);assert.ok(declaration);assert.deepEqual(declaration.routes,[recipe.route]);assert.equal(declaration.paginationOwner,'AdminTablePagination');
  const graph=collectExecutableSourceGraph({root,entrySourceFiles:declaration.pageSourceFiles,symbolAware:false});
  assert.ok(graph.has('src/components/admin/ui/AdminTablePagination.tsx'));const sourceHashes={};
  for(const path of declaration.presentationSourceFiles){assert.ok(graph.has(path));sourceHashes[path]=createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');}
  for(const alias of recipe.aliases){const parent=manifest.surfaces.find(row=>row.id===alias);assert.ok(parent);assert.deepEqual(parent.routes,[recipe.route]);assert.equal(parent.paginationState,'not_required');assert.equal(parent.capabilityAudit.overrides.pagination.state,'adopted');if(recipe.preferenceId)assert.equal(parent.capabilityAudit.overrides.column_visibility.state,'adopted');
   const parentGraph=collectExecutableSourceGraph({root,entrySourceFiles:parent.pageSourceFiles,symbolAware:false});for(const path of declaration.presentationSourceFiles)assert.ok(parentGraph.has(path),'An aggregate alias must reach the actual mounted descendant source.');
  }
  const preference=recipe.preferenceId?columns[recipe.preferenceId]:null;if(preference){assert.equal(declaration.columnVisibility,'shared_optional_columns');assert.ok(preference.columns.some(column=>column.key===recipe.optional&&column.hideable));}
  return {...recipe,sourceHashes,pageSize:pagination.ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE,pageSizeOptions:[...pagination.ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS],rowCount:2*pagination.ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE+3,viewKey:preference?.viewKey??null,columns:preference?.columns??[],defaults:preference?.columns.filter(column=>column.hideable&&column.defaultVisible).map(column=>column.key)??[],paginationMode:recipe.key==='footer'?'local-form-session':'bounded-url-history'};
 });
}
export function bindCoreDescendantCells(spec,requiredCases){
 assert.ok(Array.isArray(requiredCases));const axes=['pagination',...(spec.preferenceId?['column_visibility']:[])];const cells=[];
 for(const consumer of [spec.consumer,...spec.aliases])for(const axis of axes){const expected='collection:'+consumer+':capability:'+axis,matches=requiredCases.filter(row=>row.key===expected);assert.equal(matches.length,1);const row=matches[0];assert.equal(row.consumer,consumer);assert.equal(row.boundary,'collection');assert.equal(row.axis,axis);assert.equal(row.scenario,'complete_applicable_capability_behavior');cells.push({key:row.key,consumer,axis,physicalConsumer:spec.consumer,binding:consumer===spec.consumer?'mounted-owner':'same-route-executable-descendant'});}
 return cells;
}
export function assertCoreDescendantProjection(spec,expected,outcome){
 assert.equal(expected.length,spec.rowCount);assert.equal(new Set(expected).size,spec.rowCount);assert.deepEqual(outcome.pages.flat(),expected);assert.equal(new Set(outcome.pages.flat()).size,spec.rowCount);assert.equal(outcome.pages.length,Math.ceil(spec.rowCount/spec.pageSize));assert.equal(outcome.paginationMode,spec.paginationMode);assert.equal(outcome.pageSizeChanged,true);assert.equal(outcome.nativeRowsUnchanged,true);
 if(spec.paginationMode==='bounded-url-history'){for(const key of ['backAndReload','clamp','searchReset'])assert.equal(outcome[key],true);assert.equal(outcome.preferencePosts,2);assert.equal(outcome.headerAndCellsPersisted,true);assert.equal(outcome.preferenceSemanticRestored,true);}else{assert.equal(outcome.preferencePosts,0);assert.equal(outcome.localReloadReset,true);assert.equal(outcome.urlPagingClaimed,false);assert.equal(outcome.structuralSlotsPaged,false);}
 assert.deepEqual(outcome.automaticCoverage,[]);assert.equal(outcome.globalClosed,false);
}
