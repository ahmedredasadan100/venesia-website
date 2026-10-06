import ts from 'typescript';
import {loadCoreResidualSearchContract} from './admin-core-residual-search.mjs';
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

export async function loadCoreDescendantFilterContract(key, nativeRows, regions, root=process.cwd()) {
 assert.ok(['menus','items','assignments'].includes(key));assert.ok(Array.isArray(nativeRows)&&nativeRows.length>0);assert.ok(Array.isArray(regions));
 const shared=await loadCoreResidualSearchContract(key,root),source=readFileSync(resolve(root,shared.path),'utf8');
 const file=ts.createSourceFile(shared.path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const walk=test=>{const found=[];function visit(n){if(test(n))found.push(n);ts.forEachChild(n,visit);}visit(file);return found;};
 const one=items=>{assert.equal(items.length,1);return items[0];},variable=name=>one(walk(n=>ts.isVariableDeclaration(n)&&n.name.getText(file)===name));
 const owner=variable('queryContract'),properties=[];function visit(n){if(ts.isPropertyAssignment(n)||ts.isShorthandPropertyAssignment(n))properties.push(n);ts.forEachChild(n,visit);}visit(owner);
 const prop=name=>one(properties.filter(n=>n.name.getText(file)===name));
 const filterProperty=prop('filters'),filterName=ts.isShorthandPropertyAssignment(filterProperty)?filterProperty.name.getText(file):filterProperty.initializer.getText(file);
 const filterMemo=variable(filterName).initializer;assert.ok(ts.isCallExpression(filterMemo));assert.equal(filterMemo.expression.getText(file),'useMemo');assert.ok(ts.isArrowFunction(filterMemo.arguments[0]));
 const jiti=createJiti(resolve(root,'package.json'),{fsCache:false,moduleCache:false});
 const ports={instant:{rows:nativeRows},activeItems:nativeRows.map(r=>r.item??r),assignments:nativeRows,regions,
  regionLabels:Object.fromEntries(regions.map(r=>[r.key,r.adminLabel])),adminCollectionSearchIncludes:shared.includes};
 if(key==='menus'){const fn=one(walk(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='locationLabel'));ports.locationLabel=Function(ts.transpileModule(fn.getText(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+';return locationLabel')();}
 if(key==='items')Object.assign(ports,await jiti.import(resolve(root,'src/app/admin/pages-blocks/menus/menu-builder-shared.ts')));
 if(key==='assignments')for(const p of ['src/lib/page-blocks/admin-utils.ts','src/lib/page-blocks/layout-slots.ts','src/lib/page-blocks/module-edit-registry.ts','src/app/admin/pages-blocks/pages/[id]/page-blocks/page-blocks-utils.ts'])Object.assign(ports,await jiti.import(resolve(root,p)));
 const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const evaluate=text=>Function(...Object.keys(ports),compile('const fn='+text)+';return fn')(...Object.values(ports));
 const filters=evaluate(filterMemo.arguments[0].getText(file))(),matchesRow=evaluate(prop('matchesRow').initializer.getText(file));
 const id=key==='items'?row=>String(row.item.id):key==='assignments'?ports.assignmentRowId:row=>String(row.id);
 assert.equal(new Set(filters.map(f=>f.paramKey)).size,filters.length);assert.equal(new Set(nativeRows.map(id)).size,nativeRows.length);
 const all=Object.fromEntries(filters.map(f=>[f.paramKey,f.allValue??'all']));
 return{key,path:shared.path,sourceSha256:shared.sourceSha256,consumers:shared.consumers,filters,all,
  project:(query,values)=>nativeRows.filter(row=>matchesRow(row,{search:query,filters:{...all,...values}})).map(id),
  selectableIds:ids=>key==='items'?[]:nativeRows.filter(row=>ids.includes(id(row))&&(key!=='assignments'||ports.isManageableAssignment(row))).map(id)};
}


export function coreDescendantCheckpointPhases(spec,mode='presentation'){assert.ok(['presentation','closure'].includes(mode));return mode==='closure'||!spec.preferenceId?['before','after']:['before','hidden','restored','after'];}

export function coreDescendantFilterCases(contract,query){
 return contract.filters.flatMap(filter=>{const options=[...(filter.options??[]),...(filter.groups??[]).flatMap(group=>group.options)].filter(row=>!row.disabled);assert.ok(options.length);const positive=options.find(option=>contract.project(query,{[filter.paramKey]:option.value}).length>0);assert.ok(positive,'Every declared filter needs a real native positive.');const alternate=options.find(option=>option.value!==positive.value&&JSON.stringify(contract.project(query,{[filter.paramKey]:option.value}))!==JSON.stringify(contract.project(query,{[filter.paramKey]:positive.value})));return [positive,...(alternate?[alternate]:[])].map(option=>({filter,option,ids:contract.project(query,{[filter.paramKey]:option.value})}));});
}
export function bindCoreDescendantClosureCells(spec,requiredCases){
 const axes=spec.key==='footer'?['table']:['collection','toolbar'];return [spec.consumer,...spec.aliases].flatMap(consumer=>axes.map(axis=>{const key='collection:'+consumer+':capability:'+axis,matches=requiredCases.filter(row=>row.key===key);assert.equal(matches.length,1);assert.equal(matches[0].scenario,'complete_applicable_capability_behavior');return{key,consumer,axis,physicalConsumer:spec.consumer};}));
}
export function assertCoreDescendantFilterReceipt(contract,query,value){
 assert.equal(value.key,contract.key);assert.equal(value.filterOwnerSha256,contract.sourceSha256);assert.deepEqual(value.observations,coreDescendantFilterCases(contract,query).map(({filter,option,ids})=>({paramKey:filter.paramKey,value:option.value,ids,cancelPreserved:true,reloadRetained:true,chipRemoved:true})));
 const selectable=contract.selectableIds(contract.project(query,{}));assert.deepEqual(value.selection,contract.key==='items'?[]:[{ids:selectable,rowSelectClear:true,visibleAllSelectClear:true,commandsSubmitted:0}]);if(contract.key!=='items')assert.ok(selectable.length>0);
 assert.equal(value.writes,0);assert.equal(value.restored,true);assert.deepEqual(value.automaticCoverage,[]);assert.equal(value.globalClosed,false);
}
export function assertCoreFooterEmptyReceipt(value){assert.equal(value.key,'footer');assert.equal(value.emptySlot,2);assert.equal(value.originalType,'text');assert.equal(value.observedType,'custom_links');assert.deepEqual(value.headers,['#','اسم العنصر','الرابط','الهدف','الحالة','الترتيب','الإجراءات']);for(const key of ['emptyMessageVisible','paginationAbsent','restored','nativeUnchanged'])assert.equal(value[key],true);assert.equal(value.visibleRows,0);assert.equal(value.writes,0);assert.deepEqual(value.automaticCoverage,[]);assert.equal(value.globalClosed,false);}
