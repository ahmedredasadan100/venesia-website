import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createJiti} from 'jiti';
import ts from 'typescript';

// The existing parent validates the full canonical inventory. This binding also honors the exact current owner's explicit search exception.
const {ADMIN_COLLECTION_SURFACE_ADOPTION:collectionAdoption}=await createJiti(import.meta.url,{fsCache:false,moduleCache:false}).import('../../src/lib/admin/interaction-system/adoption-manifest.ts');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const files={menus:'src/app/admin/pages-blocks/menus/MenusTableClient.tsx',items:'src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx',assignments:'src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx',integrations:'src/components/admin/integrations/AdminIntegrationsPlatform.tsx',media:'src/lib/admin/media-catalog/catalog.ts'};
const consumers={menus:['menus-list'],items:['menu-items','menu-editor-shell'],assignments:['page-block-assignments','page-composition-shell'],integrations:['settings-pages'],media:['media-library']};
function walk(node,test){const result=[];function visit(n){if(test(n))result.push(n);ts.forEachChild(n,visit);}visit(node);return result;}
const one=(values,label)=>{assert.equal(values.length,1,label);return values[0];};
const compile=text=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
/** Execute the exact current owner search projection, not a copied search-field list. */
export async function loadCoreResidualSearchContract(key,root=process.cwd()){
 assert.ok(Object.hasOwn(files,key));const path=files[key],source=readFileSync(resolve(root,path),'utf8'),file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),jiti=createJiti(resolve(root,'package.json'),{fsCache:false,moduleCache:false});
 const searchOwner=await jiti.import(resolve(root,'src/lib/admin/entity-list/search-normalization.ts'));
 const variable=name=>one(walk(file,n=>ts.isVariableDeclaration(n)&&n.name.getText(file)===name),name);
 let textFor,includes=searchOwner.adminCollectionSearchIncludes,minimum=null;
 if(key==='integrations'){
  const labels=Function(compile('const '+variable('CATEGORY_LABELS').getText(file))+';return CATEGORY_LABELS')();
  const matches=variable('matchesQuery').initializer;
  const candidate=one(walk(matches,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='includes'),'actual includes candidate');
  textFor=Function('CATEGORY_LABELS',compile('const text = item => '+candidate.expression.expression.getText(file))+';return text')(labels);
  const normalize=Function(compile('const normalize = query => '+variable('normalizedQuery').initializer.getText(file))+';return normalize')();
  includes=(text,query)=>text.includes(normalize(query));
 }else{
  const owner=key==='media'?one(walk(file,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildMediaLibraryReadModel'),'catalog function'):variable('queryContract');
  const call=one(walk(owner,n=>ts.isCallExpression(n)&&n.expression.getText(file)==='adminCollectionSearchIncludes'),'actual canonical search call');
  if(key!=='media')minimum=Number(one(walk(owner,n=>ts.isPropertyAssignment(n)&&n.name.getText(file)==='minLength'),'actual minimum').initializer.getText(file));
  let args='asset',body=call.arguments[0].getText(file),ports={};
  if(key!=='media'){
   const matcher=one(walk(owner,n=>ts.isPropertyAssignment(n)&&n.name.getText(file)==='matchesRow'),'actual matcher').initializer;args=matcher.parameters[0].getText(file);
   if(key==='menus'){const fn=one(walk(file,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='locationLabel'),'location label');ports.locationLabel=Function(compile(fn.getText(file))+';return locationLabel')();}
   if(key==='assignments'){Object.assign(ports,await jiti.import(resolve(root,'src/lib/page-blocks/admin-utils.ts')),await jiti.import(resolve(root,'src/lib/page-blocks/layout-slots.ts')));ports.regionLabels={};}
  }
  const names=Object.keys(ports),factory=Function(...names,compile('const text = ('+args+') => '+body)+';return text');
  textFor=(row,regionLabels={})=>factory(...names.map(name=>name==='regionLabels'?regionLabels:ports[name]))(row);
 }
 if(['menus','items','assignments'].includes(key))assert.equal(minimum,1,'This bounded-client recipe requires the actual declared minimum; drift must be reviewed.');
 return{key,path,sourceSha256:createHash('sha256').update(source).digest('hex'),minimum,consumers:consumers[key],textFor,includes};
}
export function bindCoreResidualSearchCells(contract,requiredCases){return contract.consumers.map(consumer=>{const key='collection:'+consumer+':capability:search',row=one(requiredCases.filter(value=>value.key===key),key);assert.equal(row.boundary,'collection');assert.equal(row.consumer,consumer);assert.equal(row.axis,'search');const surface=one(collectionAdoption.surfaces.filter(item=>item.id===consumer),'Canonical collection consumer'),exception=surface.capabilityAudit.overrides.search;const approved=exception?.state==='approved_exception';if(approved){assert.ok(exception.evidence.includes(contract.path),'Approved search exception must name this actual owner.');assert.ok(exception.scope&&exception.approvingOwner);}assert.equal(row.scenario,approved?'approved_exception_contract_behavior':'complete_applicable_capability_behavior');if(row.declaration!==undefined)assert.equal(row.declaration,approved?'approved_exception':'adopted');return{key,consumer,physicalConsumer:contract.consumers[0],binding:consumer===contract.consumers[0]?'mounted-owner':'same-route-executable-descendant'};});}
export function coreResidualSearchQueries(restore){assert.ok(typeof restore==='string'&&restore.length>1);return[{id:'literal-percent',query:'%'},{id:'literal-underscore',query:'_'},{id:'literal-asterisk',query:'*'},{id:'literal-quote',query:"'"},{id:'literal-backslash',query:'\\'},{id:'short-one-character',query:restore.slice(0,1)},{id:'clear',query:''},{id:'restore',query:restore}];}
export function projectCoreResidualSearchRows(contract,rows,query){assert.ok(Array.isArray(rows)&&rows.length>0);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);for(const row of rows){assert.equal(typeof row.id,'string');assert.equal(typeof row.text,'string');}return rows.filter(row=>contract.includes(row.text,query)).map(row=>row.id);}
export function assertCoreResidualSearchFragments(contract,rows,restore,observations){const queries=coreResidualSearchQueries(restore);assert.deepEqual(observations.map(row=>({id:row.id,query:row.query})),queries);for(const [index,row]of observations.entries()){assert.deepEqual(row.ids,projectCoreResidualSearchRows(contract,rows,queries[index].query));assert.equal(new Set(row.ids).size,row.ids.length);assert.equal(row.uiExact,true);assert.equal(row.queryStateExact,true);}assert.ok(observations[5].ids.length>0,'Actual one-character positive cannot be vacuous.');assert.ok(observations[7].ids.length>0,'Restored query must have a real native positive.');return{status:'search-fragments-observed',ownerPath:contract.path,ownerSha256:contract.sourceSha256,projectionSha256:hash(rows),observations,automaticCoverage:[],globalClosed:false};}
export function assertCoreResidualSearchReceipt(contract,rows,restore,receipt){assert.ok(receipt);const expected=assertCoreResidualSearchFragments(contract,rows,restore,receipt.observations);assert.deepEqual(receipt,expected);return expected;}
export function assertCoreIntegrationSearchNative(before,after){for(const value of [before,after]){assert.equal(value.kind,'readonly-hub-state');assert.equal(value.entity,'integration-search');assert.equal(value.status,'pass');assert.match(value.value.publicDataSha256,/^[a-f0-9]{64}$/);assert.match(value.value.publicTableInventorySha256,/^[a-f0-9]{64}$/);assert.ok(value.ownedRunId);}assert.notEqual(before.id,after.id);assert.equal(before.ownedRunId,after.ownedRunId);assert.deepEqual(before.value,after.value);}
export function coreResidualMediaRows(contract,state,folder){assert.equal(contract.key,'media');assert.equal(folder,'images/'+state.namespace);return state.assets.filter(row=>row.status==='active'&&(row.folder_path===folder||row.folder_path.startsWith(folder+'/'))).map(row=>({id:String(row.id),text:contract.textFor({displayName:row.display_name,originalFilename:row.original_filename,objectKey:row.object_key,defaultAltText:row.default_alt_text})})).sort((a,b)=>a.id.localeCompare(b.id));}
/** Parent invokes after the existing owned native aggregate join. No new inventory or coverage state. */
export async function assertCoreResidualSearchCompletion(browser,native,independentSource){
 // Supplied by the parent from public-source-manifest.json, never from the Browser report.
 assert.ok(independentSource&&Array.isArray(independentSource.manifest)&&independentSource.manifest.length>0);
 assert.match(independentSource.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(independentSource.sourceSha256,hash(independentSource.manifest),'Independent source inventory checksum must match its exact bytes.');
 assert.equal(new Set(independentSource.manifest.map(row=>row.file)).size,independentSource.manifest.length,'Source inventory cannot contain duplicate file identities.');
 assert.equal(browser.sourceSha256,independentSource.sourceSha256,'Browser source must match the independent owned snapshot.');
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.deepEqual(browser.errors,[]);assert.equal(native.status,'pass');assert.ok(native.ownedRunId&&Array.isArray(native.records));
 const key=browser.cohort==='readonly-hubs'?'integrations':browser.cohort==='media-library'?'media':null;assert.ok(key);const id=key==='integrations'?'readonly-integrations-catalog-query-filter-empty-reset':'core-media-catalog-query';const row=one(browser.evidence.filter(value=>value.id===id),id);assert.equal(row.status,'pass');assert.deepEqual(row.coverage,[]);assert.equal(row.searchWrites,0);
 const contract=await loadCoreResidualSearchContract(key);const sourceOwner=one(independentSource.manifest.filter(row=>row.file===contract.path),'Independent snapshot must contain this actual search owner');assert.equal(sourceOwner.sha256,contract.sourceSha256,'Actual owner differs from the independent frozen source.');assert.deepEqual(row.searchNamedCellBindings,bindCoreResidualSearchCells(contract,browser.requiredCases));assert.equal(row.searchNativeCheckpointIds.length,2);const proofs=row.searchNativeCheckpointIds.map(id=>one(native.records.filter(value=>value.id===id),'exact native search identity'));for(const proof of proofs)assert.equal(proof.ownedRunId,native.ownedRunId);assert.notEqual(proofs[0].id,proofs[1].id);assert.ok(native.records.indexOf(proofs[0])<native.records.indexOf(proofs[1]));
 let rows,restore;
 if(key==='integrations'){
  assertCoreIntegrationSearchNative(...proofs);assert.deepEqual(native.records.filter(value=>value.entity==='integration-search').map(value=>value.id),row.searchNativeCheckpointIds);assert.equal(row.searchReloadResetsLocal,true);
  const {INTEGRATION_DEFINITIONS}=await createJiti(import.meta.url,{fsCache:false,moduleCache:false}).import('../../src/lib/admin/integrations/integrations-contract.ts');rows=INTEGRATION_DEFINITIONS.map(item=>({id:item.key,text:contract.textFor(item)}));restore=INTEGRATION_DEFINITIONS[0].label;
 }else{
  for(const proof of proofs){assert.equal(proof.kind,'media-library-state');assert.equal(proof.status,'pass');}
  for(const name of ['qaActorId','namespace','articleId','assets','objects','folders','references','leases','reservations','audits','storageSha256','publicDataSha256','publicTableInventorySha256'])assert.deepEqual(proofs[0][name],proofs[1][name]);
  for(const name of ['storageSha256','publicDataSha256','publicTableInventorySha256'])assert.match(proofs[0][name],/^[a-f0-9]{64}$/);assert.equal(row.searchReloadRetained,true);
  const labels=browser.media.checkpoints;assert.equal(one(labels.filter(value=>value.label==='query-baseline'),'Media baseline').receiptId,proofs[0].id);assert.equal(one(labels.filter(value=>value.label==='query-after'),'Media after').receiptId,proofs[1].id);
  rows=coreResidualMediaRows(contract,proofs[0],row.searchFolder);assert.equal(rows.length,10);restore=proofs[0].namespace;
 }
 const search=assertCoreResidualSearchReceipt(contract,rows,restore,row.searchFragments);return{status:'search-fragments-joined',sourceSha256:independentSource.sourceSha256,journey:id,namedCellBindings:row.searchNamedCellBindings,nativeCheckpointIds:row.searchNativeCheckpointIds,search,automaticCoverage:[],globalClosed:false};
}
