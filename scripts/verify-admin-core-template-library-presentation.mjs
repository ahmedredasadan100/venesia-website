import ts from 'typescript';
import {createJiti} from 'jiti';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {selectCoreLinkPreviewAction,assertCoreReadOnlyEditRequests} from './fixtures/admin-core-template-library-presentation-journeys.mjs';
import {registerHooks} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {CORE_TEMPLATE_CARDS_SELECTION,assertCoreTemplateCardsSelectionReceipt,loadCoreTemplatePresentationPlan,assertCoreTemplatePresentationProjection,coreTemplateSearchCases,buildCoreTemplateSearchProjection,assertCoreTemplateSearchIds,assertCoreTemplateSearchObservation} from './fixtures/admin-core-template-library-presentation-plan.mjs';
import {createRemainingContentOwnerHarness} from './fixtures/remaining-content-owner-harness.mjs';

function searchReceipt(spec,nativeSearch,binding){return{mode:nativeSearch.mode,minLength:nativeSearch.minLength,sourceHashes:nativeSearch.sourceHashes,binding,posts:0,automaticCoverage:[],globalClosed:false,cases:nativeSearch.cases.map(item=>{const ids=item.groups.flat(),limit=Math.max(...spec.pageSizeOptions);return{...item,inputValue:item.query,queryParam:item.query||null,firstPageParam:null,limit,unrelatedParams:[],clearClicked:item.id==='clear',enterPressed:item.id!=='clear',pages:Array.from({length:Math.max(1,Math.ceil(ids.length/limit))},(_,index)=>ids.slice(index*limit,(index+1)*limit))};})};}
let controls=0;const positive=(body)=>{body();controls++;},negative=(body)=>{assert.throws(body);controls++;};

const worker='app/admin/pages-blocks/blocks/cards/[id]/page',actionId='a'.repeat(40),origin='http://127.0.0.1:3000',pathname='/admin/pages-blocks/blocks/cards/52';
const actionManifest={node:{[actionId]:{filename:'src/lib/admin/links/actions.ts',exportedName:'resolveAdminLinkAjax',workers:{[worker]:{}}}}};
const projectDirectory=process.cwd(),buildMetadata={appDir:projectDirectory,relativeAppDir:'',config:{outputFileTracingRoot:projectDirectory,turbopack:{root:projectDirectory}}},context={buildMetadata,projectDirectory};
positive(()=>assert.equal(selectCoreLinkPreviewAction(actionManifest,worker,context),actionId));
for(const change of [v=>v.node={},v=>v.node['b'.repeat(40)]=v.node[actionId],v=>v.node[actionId].filename='src/foreign.ts',v=>v.node[actionId].exportedName='saveAdminLinkAjax',v=>v.node[actionId].workers={},v=>{v.node.bad=v.node[actionId];delete v.node[actionId]}]){const v=structuredClone(actionManifest);change(v);negative(()=>selectCoreLinkPreviewAction(v,worker,context));}
const root=mkdtempSync(join(tmpdir(),'core-resolver-owner-')),project=join(root,'owned','public-build-source'),owner='src/lib/admin/links/actions.ts';mkdirSync(join(project,'src/lib/admin/links'),{recursive:true});writeFileSync(join(project,owner),readFileSync(resolve(projectDirectory,owner)));
try{
 const metadata={appDir:project,relativeAppDir:'owned/public-build-source',config:{outputFileTracingRoot:root,turbopack:{root}}},ctx={buildMetadata:metadata,projectDirectory:project},nested=structuredClone(actionManifest);nested.node[actionId].filename='owned/public-build-source/'+owner;
 positive(()=>assert.equal(selectCoreLinkPreviewAction(nested,worker,ctx),actionId));positive(()=>assert.equal(selectCoreLinkPreviewAction(actionManifest,worker,ctx),actionId));
 positive(()=>{let projection;const invalid=structuredClone(nested);invalid.node[actionId].workers={foreign:{}};assert.throws(()=>selectCoreLinkPreviewAction(invalid,worker,{...ctx,recordProjection:v=>{projection=v;}}));assert.equal(projection.matches,0);assert.equal(projection.candidates.length,1);assert.equal(projection.candidates[0].workerPresent,false);assert.equal(Object.hasOwn(projection,'encryptionKey'),false);assert.equal(JSON.stringify(projection).includes(actionId),false);});
 for(const filename of ['foreign/public-build-source/'+owner,'owned/other/'+owner,'prefix/'+owner,'../'+owner,'owned/public-build-source/src/lib/admin/links/other.ts']){const invalid=structuredClone(nested);invalid.node[actionId].filename=filename;negative(()=>selectCoreLinkPreviewAction(invalid,worker,ctx));}
 for(const change of [m=>m.appDir=root,m=>m.relativeAppDir='other',m=>m.config.turbopack.root=project,m=>m.config.outputFileTracingRoot=project,m=>{m.config.outputFileTracingRoot=join(root,'owned');m.config.turbopack.root=join(root,'owned');}]){const invalid=structuredClone(metadata);change(invalid);negative(()=>selectCoreLinkPreviewAction(nested,worker,{...ctx,buildMetadata:invalid}));}
 negative(()=>selectCoreLinkPreviewAction(nested,'app/admin/foreign/[id]/page',ctx));
 const duplicate=structuredClone(nested);duplicate.node['b'.repeat(40)]=structuredClone(actionManifest.node[actionId]);negative(()=>selectCoreLinkPreviewAction(duplicate,worker,ctx));
 const foreign=join(root,'foreign');mkdirSync(join(foreign,'src/lib/admin/links'),{recursive:true});writeFileSync(join(foreign,owner),'foreign');const sibling={appDir:project,relativeAppDir:'../owned/public-build-source',config:{outputFileTracingRoot:foreign,turbopack:{root:foreign}}};negative(()=>selectCoreLinkPreviewAction(nested,worker,{...ctx,buildMetadata:sibling}));
 const linked=join(root,'linked');mkdirSync(join(linked,'src/lib/admin'),{recursive:true});symlinkSync(join(foreign,'src/lib/admin/links'),join(linked,'src/lib/admin/links'),'junction');negative(()=>selectCoreLinkPreviewAction(actionManifest,worker,{projectDirectory:linked,buildMetadata:{appDir:linked,relativeAppDir:'linked',config:{outputFileTracingRoot:root,turbopack:{root}}}}));
}finally{assert.equal(resolve(root),root);assert.equal(dirname(root),resolve(tmpdir()));assert.ok(basename(root).startsWith('core-resolver-owner-'));rmSync(root,{recursive:true,force:true});}
const expectedValues=[{link_kind:'internal',linked_type:'pages',linked_id:7,href:'/qa-admin-page-interaction',target:'_self'}],requestEvidence={method:'POST',url:origin+pathname,actionId,contentType:'text/plain;charset=UTF-8',body:JSON.stringify(expectedValues)};
const args={origin,pathname,actionId,expectedValues};
positive(()=>assert.equal(assertCoreReadOnlyEditRequests([requestEvidence],args).count,1));
positive(()=>assert.equal(assertCoreReadOnlyEditRequests([],{origin,pathname,actionId:null,expectedValues:[]}).count,0));
for(const change of [v=>v.method='GET',v=>v.url='https://example.com'+pathname,v=>v.url=origin+'/admin/other',v=>v.actionId='b'.repeat(40),v=>v.actionId='',v=>v.contentType='application/json',v=>v.body='{',v=>v.body=JSON.stringify([...expectedValues,'extra']),v=>v.body=JSON.stringify([{...expectedValues[0],linked_id:8}])]){const v=structuredClone(requestEvidence);change(v);negative(()=>assertCoreReadOnlyEditRequests([v],args));}
negative(()=>assertCoreReadOnlyEditRequests([],args));negative(()=>assertCoreReadOnlyEditRequests([requestEvidence,requestEvidence],args));negative(()=>assertCoreReadOnlyEditRequests([requestEvidence],{origin,pathname,actionId:null,expectedValues:[]}));

const plan=await loadCoreTemplatePresentationPlan();
positive(()=>assert.equal(new Set(plan.map(row=>row.consumer)).size,plan.length));
// Selected page projection and inherited options must remain exact; no generic
// name/slug substitute may mask retired rows or private Breadcrumb identity.
const sample={id:901,name:'ordinary',slug:'privateunique',description:null,status:'published',sort_order:1,variant:'rawvariant',feed_type:'latest',config:{presentation:{variant:'editorial'}},section_key:'detailunique',widget_key:'detailunique'};
positive(()=>assert.deepEqual(plan.find(spec=>spec.kind==='breadcrumb').searchProjection([sample],'privateunique'),[]));
for(const kind of ['cards','cta','feed','featured','content','hero','media-hub','media-sidebar'])positive(()=>assert.deepEqual(plan.find(spec=>spec.kind===kind).searchProjection([sample],'privateunique').flat(),[901]));
positive(()=>assert.deepEqual(plan.find(spec=>spec.kind==='content').searchProjection([{...sample,slug:'media-center-news-listing-shell'}],''),[]));
positive(()=>assert.deepEqual(plan.find(spec=>spec.kind==='feed').searchProjection([{...sample,feed_type:'unique_feed_value'}],'unique_feed_value').flat(),[901]));
for(const kind of ['media-hub','media-sidebar']){const spec=plan.find(row=>row.kind===kind);positive(()=>assert.deepEqual(spec.searchProjection([sample],'detailunique').flat(),[901]));const groups=spec.searchProjection([{...sample,id:901},{...sample,id:902},{...sample,id:903,sort_order:2}],'');positive(()=>assertCoreTemplateSearchIds(groups,[902,901,903]));negative(()=>assertCoreTemplateSearchIds(groups,[903,902,901]));negative(()=>assertCoreTemplateSearchIds(groups,[902,902,903]));positive(()=>assertCoreTemplateSearchIds(groups,[902],{offset:0,count:1}));}
for(const kind of ['cards','cta'])negative(()=>assertCoreTemplateSearchIds(plan.find(row=>row.kind===kind).searchProjection([{...sample,id:901},{...sample,id:902}],''),[902,901]));
negative(()=>coreTemplateSearchCases('foreign'));negative(()=>assertCoreTemplateSearchIds([[1],[1]],[1,1]));negative(()=>assertCoreTemplateSearchIds([[1]],[]));
const fixtures=new Map();
for(const spec of plan){
 const rows=Array.from({length:spec.rowCount},(_,index)=>({id:index+101,name:'Name '+(spec.rowCount-index),slug:'slug-'+((index*7)%spec.rowCount+1),status:index%2?'published':'unpublished',updated_at:new Date(Date.UTC(2026,0,1,0,0,(index*5)%spec.rowCount)).toISOString(),variant:spec.variants[index%spec.variants.length]?.[0],feed_type:spec.variants[index%spec.variants.length]?.[0],config:{presentation:{variant:spec.variants[index%spec.variants.length]?.[0]}},...(spec.detailField?{[spec.detailField]:spec.detailValues[index%spec.detailValues.length]}:{})}));fixtures.set(spec.kind,rows);
 const observation={pages:Array.from({length:Math.ceil(rows.length/spec.pageSize)},(_,index)=>rows.slice(index*spec.pageSize,(index+1)*spec.pageSize).map(row=>row.id)),sorts:spec.sorts.map(sort=>({key:sort.key,ascending:spec.expectedIds(rows,sort.key,'asc'),descending:spec.expectedIds(rows,sort.key,'desc'),reset:spec.expectedIds(rows)}))};
 positive(()=>assertCoreTemplatePresentationProjection(spec,rows,observation));
 for(const key of ['ascending','descending','reset'])for(const sort of spec.sorts){const bad=structuredClone(observation),item=bad.sorts.find(row=>row.key===sort.key);[item[key][0],item[key][1]]=[item[key][1],item[key][0]];negative(()=>assertCoreTemplatePresentationProjection(spec,rows,bad));}
 for(const modify of [bad=>bad.sorts.pop(),bad=>bad.sorts.push(bad.sorts[0]),bad=>bad.sorts[0].key='unregistered',bad=>bad.pages.pop(),bad=>bad.pages[1][0]=bad.pages[0][0],bad=>bad.pages.reverse()]){const bad=structuredClone(observation);modify(bad);negative(()=>assertCoreTemplatePresentationProjection(spec,rows,bad));}
 const namespace='qa-library-presentation-abcdef012345-'+spec.kind,searchRows=rows.map((row,index)=>({...row,name:namespace+' '+index,sort_order:index+1}));
 const searchNative=buildCoreTemplateSearchProjection(spec,searchRows,namespace),binding={beforeCheckpointId:randomUUID(),afterCheckpointId:randomUUID(),actorId:91,ownedRunId:'controlled-run',moduleKind:spec.kind,consumer:spec.consumer};const search=searchReceipt(spec,searchNative,binding);
 positive(()=>assertCoreTemplateSearchObservation(spec,searchNative,search,binding));positive(()=>assert.equal(searchNative.cases.at(-1).groups.flat().length,spec.rowCount));positive(()=>assert.deepEqual(searchNative.cases.slice(0,5).map(item=>item.groups.flat()),[[],[],[],[],[]]));positive(()=>assert.equal(searchNative.cases.find(item=>item.id==='one-character').groups.flat().length,spec.rowCount));
 for(const scenario of coreTemplateSearchCases(namespace).slice(0,5)){const punctuationRow={...searchRows[0],name:scenario.query};positive(()=>assert.deepEqual(spec.searchProjection([punctuationRow],scenario.query).flat(),[punctuationRow.id]));positive(()=>assert.deepEqual(spec.searchProjection([searchRows[0]],scenario.query),[]));}
 for(const change of [v=>v.cases.pop(),v=>v.cases.push(v.cases[0]),v=>v.cases.reverse(),v=>v.cases[0].query='foreign',v=>v.cases[0].queryParam='foreign',v=>v.cases[0].inputValue='foreign',v=>v.cases[0].pages=[[searchRows[0].id]],v=>v.cases.at(-1).pages[0].pop(),v=>v.cases.at(-1).pages[0].push(999),v=>v.cases.at(-1).pages[0].reverse(),v=>v.cases[6].clearClicked=false,v=>v.cases[0].enterPressed=false,v=>v.cases[0].firstPageParam='2',v=>v.cases[0].unrelatedParams=[['status','published']],v=>v.cases[0].limit=10,v=>v.sourceHashes.page='foreign',v=>v.binding.actorId=92,v=>v.binding.ownedRunId='foreign',v=>v.binding.beforeCheckpointId=randomUUID(),v=>v.binding.moduleKind='foreign',v=>v.minLength=2,v=>v.mode='server',v=>v.posts=1,v=>v.automaticCoverage=['invented'],v=>v.globalClosed=true]){const bad=structuredClone(search);change(bad);negative(()=>assertCoreTemplateSearchObservation(spec,searchNative,bad,binding));}
 const equalRows=rows.map(row=>({...row,status:'published'}));negative(()=>assertCoreTemplatePresentationProjection(spec,equalRows,observation));
 // Equal values must retain native sort_order, including descending. No new
 // ID tie-breaker can be substituted for the existing stable-sort contract.
 const status=observation.sorts.find(row=>row.key==='status'),groups=Map.groupBy(rows,row=>String(spec.sortValue(row,'status')));for(const group of groups.values())for(const direction of ['ascending','descending'])positive(()=>assert.deepEqual(status[direction].filter(id=>group.some(row=>row.id===id)),group.map(row=>row.id)));
}

// Exercise the real verifier SQL, request validation and exact finally cleanup
// against in-memory PostgreSQL-compatible SQL. This is explicitly not the owned
// native PostgreSQL or authenticated Product Browser proof.
const nativeUrl=new URL('./verify-admin-core-template-library-presentation-isolated.mts',import.meta.url).href;
const hooks=registerHooks({resolve(specifier,context,next){if(context.parentURL===nativeUrl&&specifier==='./lib/isolated-supabase.mts')return{url:'data:text/javascript,'+encodeURIComponent('import assert from "node:assert/strict"; export function assertOwnedLocalHandle(h){assert.equal(h.controlledVerifierPort,true)}'),shortCircuit:true};if(context.parentURL===nativeUrl&&specifier==='./verify-admin-core-domain-readback-isolated.mts')return{url:'data:text/javascript,'+encodeURIComponent('export async function readCoreFixedQaActor(connection){return Number((await connection.query("select 91::int id")).rows[0].id)}'),shortCircuit:true};return next(specifier,context);}});
const native=await import('./verify-admin-core-template-library-presentation-isolated.mts');hooks.deregister();
// Execute the actual Cards value producer and AdminLinkField effect. The Action
// receives value, not the separate serialized hidden-input representation.
const product=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const {linkDefaultFromContainer}=product('../src/lib/admin/links/link-defaults.ts');
const {serializeAdminLink,deserializeAdminLink}=product('../src/lib/admin/links/serialize.ts');
const parseTsx=file=>ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const cardsSource=parseTsx('src/components/admin/page-blocks/CardsModuleEditClient.tsx'),renderCard=cardsSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='renderCardHref');assert.ok(renderCard);
const renderJs=ts.transpileModule(renderCard.getText(cardsSource),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,jsxFactory:'jsx'}}).outputText;
const renderActual=new Function('jsx','AdminLinkField','linkDefaultFromContainer',renderJs+';return renderCardHref;')((type,props)=>({type,props}),Symbol.for('AdminLinkField'),linkDefaultFromContainer);
const fieldSource=parseTsx('src/components/admin/ui/AdminLinkField.tsx');let effect;
const visitEffect=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='useEffect'){assert.equal(effect,undefined);effect=node.arguments[0];}ts.forEachChild(node,visitEffect);};visitEffect(fieldSource);assert.ok(effect);
const actualPreviewValues=item=>{const value=renderActual(item,0).props.defaultValue,calls=[];const callback=new Function('value','valueKey','display','resolveAdminLinkAjax','setDisplay','unstable_rethrow','return ('+effect.getText(fieldSource)+');')(value,JSON.stringify(serializeAdminLink(value)),null,next=>{calls.push(structuredClone(next));return Promise.resolve({ok:false});},()=>assert.fail('Unexpected display update'),error=>{throw error;});const cleanup=callback();cleanup?.();return calls;};
for(const item of [{title:'Legacy card',href:'/qa-admin-page-interaction'},{title:'Structured card',link:{link_kind:'internal',linked_type:'pages',linked_id:7,href:'/qa-admin-page-interaction',target:'_self'}},{title:'Unlinked card'}]){
 const actual=actualPreviewValues(item),expected=native.coreTemplateLinkPreviewValues('cards',{config:{items:[item]}}),context={origin,pathname,actionId:actual.length?actionId:null,expectedValues:expected};
 positive(()=>assert.deepEqual(expected,actual));positive(()=>assert.equal(assertCoreReadOnlyEditRequests(actual.map(value=>({...requestEvidence,body:JSON.stringify([value])})),context).count,actual.length));
}
const legacyItem={title:'Legacy card',href:'/qa-admin-page-interaction'},legacyValues=actualPreviewValues(legacyItem),legacyExpected=native.coreTemplateLinkPreviewValues('cards',{config:{items:[legacyItem]}}),legacyArgs={origin,pathname,actionId,expectedValues:legacyExpected},legacyRequest={...requestEvidence,body:JSON.stringify(legacyValues)};
positive(()=>assert.deepEqual(legacyExpected,[{link_kind:'legacy',href:'/qa-admin-page-interaction',target:'_self'}]));
negative(()=>assertCoreReadOnlyEditRequests([legacyRequest],{...legacyArgs,expectedValues:legacyExpected.map(deserializeAdminLink)}));
for(const change of [value=>value.href='/foreign',value=>value.target='_blank',value=>value.link_kind='external',value=>value.linked_id=7,value=>value.foreign=null,value=>value.linked_type=null,value=>value.anchor=null,value=>value.meta=null,value=>delete value.target]){const value=structuredClone(legacyValues[0]);change(value);negative(()=>assertCoreReadOnlyEditRequests([{...legacyRequest,body:JSON.stringify([value])}],legacyArgs));}
positive(()=>assert.deepEqual(native.coreTemplateLinkPreviewValues('hero',{config:{items:[legacyItem]}}),[]));

const request=(kind,phase)=>({id:randomUUID(),kind:'template-library-presentation-state',moduleKind:kind,phase});
positive(()=>native.validateCoreTemplatePresentationRequest(request(plan[0].kind,'before')));
for(const change of [row=>row.sql='delete',row=>row.id='bad',row=>row.kind='other',row=>row.phase='all',row=>row.actorId=1]){const row=request(plan[0].kind,'before');change(row);negative(()=>native.validateCoreTemplatePresentationRequest(row));}
const db=new PGlite();await db.exec('create table admin_user_preferences(admin_user_id bigint,view_key text,preferences jsonb,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(admin_user_id,view_key)); create table admin_audit_logs(id bigint primary key,action text); create table hero_assignments(id bigint,hero_id bigint);');
const templates=[];
for(const spec of plan){await db.exec(`create table ${spec.table}(id bigserial primary key,name text,slug text unique,status text,config jsonb,variant text,feed_type text,section_key text,widget_key text,sort_order integer,created_at timestamptz,updated_at timestamptz);`);const source=await db.query(`insert into ${spec.table}(name,slug,status,config,variant,sort_order) values('Native source','native-source','published','{"presentation":{"variant":"editorial"}}','default',1),('Native source two','native-source-two','published','{"presentation":{"variant":"editorial"}}','default',2) returning id`);templates.push(...source.rows.map(row=>({kind:spec.kind,id:Number(row.id),assigned:false})));}
await db.query('update '+plan.find(row=>row.kind==='cards').table+' set config=$1::jsonb where id=2',[JSON.stringify({presentation:{variant:'editorial'},items:[{title:'Controlled card',link:{link_kind:'internal',linked_type:'pages',linked_id:7,href:'/qa-admin-page-interaction',target:'_self'}}]})]);
const original={visibleColumns:['slug'],special:'preserve exact original'};await db.query('insert into admin_user_preferences values(91,$1,$2::jsonb,\'2026-01-01T00:00:00.123456Z\',\'2026-01-02T00:00:00.654321Z\')',[plan[0].viewKey,JSON.stringify(original)]);
const handle={controlledVerifierPort:true,identity:{runId:'control-run-unique'},withDatabaseConnection:async callback=>callback({query:(sql,values=[])=>db.query(sql,values)})};
try{
 const seeded=await native.seedOwnedCoreTemplatePresentationFixture(handle,{pages:{templates}});positive(()=>assert.deepEqual(Object.keys(seeded.templateLibraryPresentation.contexts).sort(),plan.map(row=>row.kind).sort()));
 const evidence=[];
 for(const spec of plan){
  const before=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'before'));controls++;
  positive(()=>assert.equal(before.rows[0].linkPreviewValues.length,spec.kind==='cards'?1:0));
  await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'after')));controls++;
  await db.query(`update ${spec.table} set name='Unexpected mutation' where id=$1`,[before.rows[0].id]);await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden')));controls++;
  await db.query(`update ${spec.table} set name=$1 where id=$2`,[before.rows[0].name,before.rows[0].id]);
  await db.query("insert into admin_audit_logs values(1,'unexpected')");await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden')));controls++;await db.query('delete from admin_audit_logs where id=1');
  await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:spec.defaults.filter(key=>key!=='status')}),spec.viewKey]);
  const hidden=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-hidden'));controls++;
  await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:spec.defaults}),spec.viewKey]);
  const restored=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'columns-restored')),after=await native.readCoreTemplatePresentationCheckpoint(handle,request(spec.kind,'after'));controls+=2;
  evidence.push({id:'core-template-presentation-'+spec.kind,status:'pass',moduleKind:spec.kind,consumer:spec.consumer,nativeActorId:91,nativeCheckpointIds:[before,hidden,restored,after].map(row=>row.id),searchEvidence:searchReceipt(spec,before.search,{beforeCheckpointId:before.id,afterCheckpointId:after.id,actorId:91,ownedRunId:handle.identity.runId,moduleKind:spec.kind,consumer:spec.consumer}),pages:Array.from({length:Math.ceil(before.rows.length/spec.pageSize)},(_,index)=>before.orderedIds.slice(index*spec.pageSize,(index+1)*spec.pageSize)),sorts:before.sorts,preferencePosts:2,readOnlyEdit:assertCoreReadOnlyEditRequests(before.rows[0].linkPreviewValues.map(value=>({...requestEvidence,body:JSON.stringify([value])})),{origin,pathname,actionId:before.rows[0].linkPreviewValues.length?actionId:null,expectedValues:before.rows[0].linkPreviewValues}),backAndReload:true,pageSizeChanged:true,outOfRangeClamped:true,optionalHeaderAndCellsRestored:true,informationNativeFields:true,ownedEditNavigation:true,domainAndAuditUnchanged:true,copyPublicLink:'hidden-by-current-contract',automaticCoverage:[]});
 }
 const sourceSha256='a'.repeat(64),requiredCases=plan.map(spec=>({key:'collection:'+spec.consumer+':capability:scrollbar',boundary:'collection',consumer:spec.consumer,axis:'scrollbar',scenario:'complete_applicable_capability_behavior',declaration:'adopted'}));
 for(const row of evidence){const spec=plan.find(value=>value.kind===row.moduleKind);row.renderedAdoption=[{id:'template-library-'+spec.kind+'-scrollbar',status:'rendered-fragments-observed',receiptId:randomUUID(),sourceSha256,axis:'scrollbar',containment:'overscroll-contain',routePathname:spec.route,bindings:[{key:'collection:'+spec.consumer+':capability:scrollbar',boundary:'collection',consumer:spec.consumer,surface:spec.route}],automaticCoverage:[],globalClosed:false,observations:[{viewport:'desktop',width:1280,height:900},{viewport:'narrow',width:390,height:760}].map(view=>({...view,state:'overflow-observed',targetReachable:true,targetHitTestPassed:true,computedCanonicalThin:true,extent:900,client:300,actualWheelMoved:true,farBoundaryReached:true,backgroundPositionRetained:true}))}];}
 evidence.unshift({id:'existing-auth-login',status:'pass',authenticated:true});
 const receipt={sourceSha256,requiredCases,status:'pass',driverCompleted:true,inventoryOnly:false,cohort:'template-libraries',errors:[],evidence};negative(()=>native.verifyCoreTemplatePresentationCompletion(handle,receipt));
 const restored=await native.restoreOwnedCoreTemplatePresentationPreferences(handle);positive(()=>assert.equal(restored.exactOriginalPreferenceRowsOrAbsenceRestored,plan.length));positive(()=>assert.equal(native.verifyCoreTemplatePresentationCompletion(handle,receipt).nativeCheckpoints,plan.length*4));

 const preserved=await db.query('select preferences,created_at::text,updated_at::text from admin_user_preferences');positive(()=>assert.equal(preserved.rows.length,1));positive(()=>assert.deepEqual(preserved.rows[0].preferences,original));positive(()=>assert.match(preserved.rows[0].created_at,/123456/));positive(()=>assert.match(preserved.rows[0].updated_at,/654321/));
 for(const change of [row=>row.evidence.pop(),row=>row.evidence.push(row.evidence[1]),row=>row.evidence[1].nativeCheckpointIds.reverse(),row=>row.evidence[1].nativeCheckpointIds[0]=randomUUID(),row=>row.evidence[1].nativeActorId=92,row=>row.evidence[1].optionalHeaderAndCellsRestored=false,row=>row.evidence[1].sorts.pop(),row=>row.evidence[1].preferencePosts=3,row=>row.evidence[1].readOnlyEdit.count=99,row=>delete row.evidence[1].searchEvidence,row=>row.evidence[1].searchEvidence.binding.afterCheckpointId=randomUUID(),row=>row.evidence[1].searchEvidence.cases[6].pages[0].pop(),row=>row.evidence[1].searchEvidence.sourceHashes.page='foreign',row=>row.evidence[1].readOnlyEdit.owner='foreign',row=>row.evidence[1].readOnlyEdit.payloadSha256=['b'.repeat(64)],row=>delete row.evidence[1].readOnlyEdit,row=>row.evidence.find(v=>v.moduleKind==='cards').readOnlyEdit.actionIdSha256='bad',row=>row.evidence[1].automaticCoverage=['invented'],row=>row.status='running',row=>row.evidence[1].renderedAdoption=[],row=>delete row.evidence[1].renderedAdoption[0].containment,row=>row.evidence[1].renderedAdoption[0].containment='foreign',row=>row.evidence[1].renderedAdoption[0].sourceSha256='b'.repeat(64),row=>row.evidence[1].renderedAdoption[0].observations[0].targetHitTestPassed=false]){const bad=structuredClone(receipt);change(bad);negative(()=>native.verifyCoreTemplatePresentationCompletion(handle,bad));}
 await assert.rejects(()=>native.readCoreTemplatePresentationCheckpoint(handle,request(plan[0].kind,'before')));controls++;

 // The same owned completion must accept exactly four Cards phases only after
 // exact preferences restoration, and must still reject this as a full cohort.
 const selectedHandle={...handle,identity:{runId:'controlled-cards-selection'}};
 await native.seedOwnedCoreTemplatePresentationFixture(selectedHandle,{pages:{templates}});
 const cardsSpec=plan.find(row=>row.kind==='cards'),cardBefore=await native.readCoreTemplatePresentationCheckpoint(selectedHandle,request('cards','before'));
 await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:cardsSpec.defaults.filter(key=>key!=='status')}),cardsSpec.viewKey]);
 const cardHidden=await native.readCoreTemplatePresentationCheckpoint(selectedHandle,request('cards','columns-hidden'));
 await db.query('update admin_user_preferences set preferences=$1::jsonb where admin_user_id=91 and view_key=$2',[JSON.stringify({visibleColumns:cardsSpec.defaults}),cardsSpec.viewKey]);
 const cardRestored=await native.readCoreTemplatePresentationCheckpoint(selectedHandle,request('cards','columns-restored')),cardAfter=await native.readCoreTemplatePresentationCheckpoint(selectedHandle,request('cards','after'));
 const selectedRow={...structuredClone(evidence.find(row=>row.moduleKind==='cards')),coverage:[],globalClosed:false,nativeCheckpointIds:[cardBefore,cardHidden,cardRestored,cardAfter].map(row=>row.id),searchEvidence:searchReceipt(cardsSpec,cardBefore.search,{beforeCheckpointId:cardBefore.id,afterCheckpointId:cardAfter.id,actorId:91,ownedRunId:selectedHandle.identity.runId,moduleKind:'cards',consumer:cardsSpec.consumer}),pages:Array.from({length:Math.ceil(cardBefore.rows.length/cardsSpec.pageSize)},(_,index)=>cardBefore.orderedIds.slice(index*cardsSpec.pageSize,(index+1)*cardsSpec.pageSize)),sorts:cardBefore.sorts};
 const selectedReceipt={...receipt,scope:'core-closure',journeySelection:CORE_TEMPLATE_CARDS_SELECTION,wholeCohortExecuted:false,globalClosed:false,selectedJourneyIds:[selectedRow.id],executedJourneyIds:[selectedRow.id],requiredCases:requiredCases.map(row=>({...row,status:'open',evidence:null})),databaseReadback:[],readOnlyReadback:[],menuIntegrityReadback:[],evidence:[{id:'existing-auth-login',status:'pass',coverage:[],authenticated:true,sessionArtifactWritten:false,dashboardState:'Dashboard جاهزة'},selectedRow]};
 positive(()=>assertCoreTemplateCardsSelectionReceipt(selectedReceipt,plan,requiredCases));negative(()=>native.verifyCoreTemplatePresentationCompletion(selectedHandle,selectedReceipt));
 const selectedRestore=await native.restoreOwnedCoreTemplatePresentationPreferences(selectedHandle);positive(()=>assert.equal(selectedRestore.exactOriginalPreferenceRowsOrAbsenceRestored,plan.length));
 positive(()=>{const result=native.verifyCoreTemplatePresentationCompletion(selectedHandle,selectedReceipt);assert.equal(result.libraries,1);assert.equal(result.nativeCheckpoints,4);assert.equal(result.exactPreferenceCleanup,true);assert.equal(result.globalClosed,false);});
 for(const change of [r=>r.journeySelection=null,r=>r.journeySelection='foreign',r=>r.evidence[1].nativeCheckpointIds.pop(),r=>r.evidence[1].nativeCheckpointIds.reverse(),r=>r.evidence[1].nativeCheckpointIds[0]=randomUUID(),r=>r.evidence[1].nativeActorId=92,r=>r.evidence[1].searchEvidence.binding.ownedRunId='foreign',r=>r.evidence[1].moduleKind='content',r=>r.evidence[1].readOnlyEdit.count=0,r=>r.evidence[1].ownedEditNavigation=false]){const bad=structuredClone(selectedReceipt);change(bad);negative(()=>native.verifyCoreTemplatePresentationCompletion(selectedHandle,bad));}
}finally{await db.close();}

// Block identity is the canonical persistence family plus its saved subtype,
// never the display name. These are actual Server Action bodies with the
// existing owner loader; every infrastructure operation is memory-only.
const moduleIdentity=await product('../src/lib/page-blocks/module-edit-registry.ts');
const canonicalKinds=await product('../src/lib/page-blocks/types.ts');
const physicalRegistry=await product('../src/lib/page-blocks/block-module-registry.ts');
const heroIdentity=await product('../src/lib/hero/hero-content-controls.ts');
positive(()=>assert.deepEqual(plan.map(spec=>spec.kind).sort(),[...canonicalKinds.PAGE_MODULE_KINDS].sort()));
for(const [kind,registration]of Object.entries(physicalRegistry.BLOCK_MODULE_REGISTRY))positive(()=>assert.equal(plan.find(spec=>spec.kind===kind).table,registration.templateTable));

function contentVariantOptions(source,rows){
 const file=ts.createSourceFile('ContentBlocksTableClient.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
 const visit=node=>{nodes.push(node);ts.forEachChild(node,visit);};visit(file);
 const declaration=name=>{const matches=nodes.filter(node=>ts.isVariableDeclaration(node)&&node.name.getText(file)===name);assert.equal(matches.length,1);return matches[0];};
 const variants=declaration('VARIANT_OPTIONS').initializer,filters=declaration('filters').initializer;
 assert.ok(ts.isCallExpression(filters));assert.ok(ts.isArrowFunction(filters.arguments[0]));
 const label=nodes.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='variantLabel');assert.ok(label);
 const javascript=ts.transpileModule('const VARIANT_OPTIONS = '+variants.getText(file)+';\n'+label.getText(file)+'\nconst readFilters = '+filters.arguments[0].getText(file)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return Function('rows','statusMeta',javascript+';return readFilters().find(filter=>filter.paramKey==="variant").options;')(rows,plan.find(spec=>spec.kind==='content').statusLabel);
}
const contentPath='src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx',contentSource=readFileSync(contentPath,'utf8');
const savedVariantRows=[...moduleIdentity.STRUCTURAL_CONTENT_TEMPLATE_SLUGS,'legacy-custom-pattern','default','default'].map((variant,index)=>({id:800+index,variant,status:index%2?'published':'unpublished'}));
// Keep the real shared predicate implementation rather than an includes stub.
const variantSearchOwner=await product('../src/lib/admin/entity-list/search-normalization.ts');
function verifySavedVariants(source){
 const options=contentVariantOptions(source,savedVariantRows),values=options.map(option=>option.value);
 assert.equal(new Set(values).size,values.length);
 for(const row of savedVariantRows)assert.ok(values.includes(row.variant),'Loaded subtype absent from actual filter: '+row.variant);
 assert.equal(options.find(option=>option.value==='default').label,'افتراضي');
 assert.equal(options.find(option=>option.value==='legacy-custom-pattern').label,'legacy-custom-pattern');
 const file=ts.createSourceFile(contentPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let predicate;
 const visit=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(file)==='matchesRow')predicate=node.initializer;ts.forEachChild(node,visit);};visit(file);assert.ok(predicate);
 const js=ts.transpileModule('const matches = '+predicate.getText(file),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 const matches=Function('adminCollectionSearchIncludes',js+';return matches;')(variantSearchOwner.adminCollectionSearchIncludes);
 for(const value of values)assert.deepEqual(savedVariantRows.filter(row=>matches({...row,name:'misleading Hero CTA Feed',slug:'row-'+row.id},{search:'',filters:{status:'all',variant:value}})).map(row=>row.id),savedVariantRows.filter(row=>row.variant===value).map(row=>row.id));
}
positive(()=>verifySavedVariants(contentSource));
const oldOptionsSource=contentSource.replace(/options: \[\.\.\.new Set\(\[[\s\S]*?\]\)\]\.map\(\(value\) => \(\{ value, label: variantLabel\(value\) \}\)\),/u,'options: VARIANT_OPTIONS.map(([value, label]) => ({ value, label })),');
assert.notEqual(oldOptionsSource,contentSource,'The old-options regression mutation must apply.');negative(()=>verifySavedVariants(oldOptionsSource));
const wrongPredicate=contentSource.replace('return variant === "all" || row.variant === variant;','return variant === "all" || row.name === variant;');assert.notEqual(wrongPredicate,contentSource);negative(()=>verifySavedVariants(wrongPredicate));

const memory=new Map(plan.map(spec=>[spec.table,[]])),memoryState={failWrite:false,denyActor:false,writes:0};
const category={id:1,name:'Synthetic category',slug:'synthetic-category',status:'published',is_active:true,deleted_at:null,parent_id:null,sort_order:1};
function memoryFrom(table){
 assert.ok(memory.has(table)||physicalRegistry.ALL_ASSIGNMENT_TABLES.includes(table)||['pages','topics','topic_categories','topic_series','hero_assignments'].includes(table),'Undeclared isolated table '+table);
 let rows=memory.get(table)??(table==='pages'?[{id:1}]:table==='topic_categories'?[category]:[]),insert;
 const query={select(){return query;},order(){return query;},limit(n){rows=rows.slice(0,n);return query;},eq(key,value){rows=rows.filter(row=>row[key]===value);return query;},neq(key,value){rows=rows.filter(row=>row[key]!==value);return query;},is(key,value){rows=rows.filter(row=>(row[key]??null)===value);return query;},in(key,values){rows=rows.filter(row=>values.includes(row[key]));return query;},insert(value){assert.ok(memory.has(table));insert=structuredClone(value);return query;},async maybeSingle(){return{data:structuredClone(rows[0]??null),error:null};},async single(){assert.ok(insert);if(memoryState.failWrite)return{data:null,error:{message:'isolated_write_rejected'}};const stored={...insert,id:101+memory.get(table).length,sort_order:memory.get(table).length+1,updated_at:'2026-10-20T00:00:00Z',hero_assignments:[]};memory.get(table).push(stored);memoryState.writes++;return{data:structuredClone(stored),error:null};},then(resolve){return Promise.resolve({data:structuredClone(rows),error:null}).then(resolve);}};
 return query;
}
async function memoryRpc(name,args){
 assert.equal(name,'mutate_page_composition');assert.equal(args.p_actor_admin_user_id,7);
 if(memoryState.failWrite)return{data:null,error:{message:'isolated_write_rejected'}};
 const payload=args.p_payload;assert.deepEqual(payload.page_ids,[],'Classification tests never add public assignments.');
 const kind=args.p_operation==='replace_hero_template'?'hero':payload.kind.replaceAll('_','-'),spec=plan.find(row=>row.kind===kind);assert.ok(spec);
 assert.ok(['save_template','replace_hero_template'].includes(args.p_operation));
 const row=memory.get(spec.table).find(row=>row.id===(payload.template_id??payload.hero_id));assert.ok(row);Object.assign(row,structuredClone(payload.template));memoryState.writes++;
 return{data:{updated_at:row.updated_at,affected_page_ids:[]},error:null};
}
const ownerHarness=createRemainingContentOwnerHarness(projectDirectory,{additionalPorts:new Map([
 ['src/lib/supabase-admin',{getSupabaseAdmin:()=>({from:memoryFrom,rpc:memoryRpc})}],
 ['src/lib/cache/public-cache-generation',{async advancePublicCacheGeneration(){}}],
 ['src/lib/admin/auth/require-admin-session',{async requireAdminSession(){if(memoryState.denyActor)throw Error('isolated_permission_rejected');return{id:7,username:'synthetic'};}}],
 ['src/lib/admin/media-catalog/synchronization',{async synchronizeMediaReferenceWriteScopesAfterDomainMutation(){return{status:'synchronized'};}}],
])});
const createNames={content:'createContentBlock',hero:'createHeroTemplate',cards:'createCardsBlock',cta:'createCtaBlock',breadcrumb:'createBreadcrumbBlock',feed:'createFeedModule',featured:'createFeaturedModule'};
const updateNames={content:'updateContentBlock',hero:'updateHeroTemplateDetails',cards:'updateCardsBlock',cta:'updateCtaBlock',breadcrumb:'updateBreadcrumbBlock',feed:'updateFeedModule',featured:'updateFeaturedModule'};
const blockRoundTrips=[];
for(const spec of plan.filter(row=>Object.hasOwn(createNames,row.kind))){
 const actions=ownerHarness.load(resolve(projectDirectory,'src/app/admin/pages-blocks/blocks',spec.kind,'actions.ts'),[createNames[spec.kind],updateNames[spec.kind]]);
 const variants=spec.kind==='hero'?heroIdentity.HERO_TEMPLATE_VARIANT_OPTIONS_AR.map(option=>[option.value,option.label]):spec.variants.length?spec.variants:[['default','default']];
 let lastFields;
 for(const [variant]of variants){
  const fields={name:'Hero CTA Featured misleading '+spec.kind+' '+variant,slug:'isolated-'+spec.kind+'-'+variant,variant,feed_type:variant,widget_title:'Synthetic Feed',title:'Authored title',limit:'6',item_limit:'6',source:'auto',category_slug:category.slug,source_kind:'categories',selection_mode:'automatic',presentation_variant:variant,item_0_title:'Authored Card',item_0_body:'Authored Card body'};
  lastFields=fields;
  const form=()=>{const value=new FormData();for(const[key,item]of Object.entries(fields))value.set(key,String(item));return value;};
  const created=await actions[createNames[spec.kind]]({status:'idle',mode:'create',revision:0},form());assert.equal(created.status,'success',spec.kind+': '+created.message);controls++;
  assert.equal(created.editHref,spec.route+'/'+created.entityId);const saved=memory.get(spec.table).find(row=>row.id===created.entityId);assert.ok(saved);assert.equal(saved.status,'unpublished');
  assert.equal(spec.project(JSON.parse(JSON.stringify(saved))).variant??'default',variant);
  assert.deepEqual(spec.searchProjection(JSON.parse(JSON.stringify(memory.get(spec.table))),fields.name).flat(),[saved.id]);
  const update=form();update.set('id',String(saved.id));update.set('name',fields.name+' edited');
  await assert.rejects(()=>actions[updateNames[spec.kind]](update),error=>error.href===spec.route+'/'+saved.id+'?saved=1');controls++;
  const reloaded=JSON.parse(JSON.stringify(memory.get(spec.table).find(row=>row.id===saved.id)));
  assert.equal(reloaded.name,fields.name+' edited');assert.equal(spec.project(reloaded).variant??'default',variant);assert.equal(moduleIdentity.resolveModuleProductKind(spec.kind,reloaded.slug,reloaded.variant),spec.kind);
  assert.deepEqual(spec.searchProjection([reloaded],reloaded.name).flat(),[saved.id]);
  blockRoundTrips.push({kind:spec.kind,variant,table:spec.table,id:saved.id,status:'pass'});
 }
 const invalid=new FormData();const before=JSON.stringify([...memory]);const rejected=await actions[createNames[spec.kind]]({status:'idle',mode:'create',revision:0},invalid);assert.equal(rejected.status,'error');assert.equal(JSON.stringify([...memory]),before);controls++;
 memoryState.denyActor=true;await assert.rejects(()=>actions[createNames[spec.kind]]({revision:0},invalid),/isolated_permission_rejected/);memoryState.denyActor=false;assert.equal(JSON.stringify([...memory]),before);controls++;
 const rejectedForm=new FormData();for(const[key,value]of Object.entries(lastFields))rejectedForm.set(key,String(value));rejectedForm.set('name','Rejected synthetic '+spec.kind);rejectedForm.set('slug','isolated-rejected-'+spec.kind);
 if(spec.kind==='hero')rejectedForm.set('variant','internal-page');
 memoryState.failWrite=true;
 const failedCreate=await actions[createNames[spec.kind]]({revision:0},rejectedForm);assert.equal(failedCreate.status,'error');assert.match(failedCreate.message,/isolated_write_rejected/);assert.equal(JSON.stringify([...memory]),before);controls++;
 const last=memory.get(spec.table).at(-1);rejectedForm.set('id',String(last.id));rejectedForm.set('slug',last.slug);
 rejectedForm.set('variant',lastFields.variant);
 await assert.rejects(()=>actions[updateNames[spec.kind]](rejectedForm),/isolated_write_rejected/);assert.equal(JSON.stringify([...memory]),before);controls++;
 memoryState.failWrite=false;
}
for(const slug of moduleIdentity.STRUCTURAL_CONTENT_TEMPLATE_SLUGS){const expected=slug==='projects-hub-hero'?'hero':'content';positive(()=>assert.equal(moduleIdentity.resolveModuleProductKind('content',slug,'default'),expected));positive(()=>assert.equal(moduleIdentity.resolveModuleProductKind('content','legacy-renamed-'+slug,slug),expected));}
const slotRegistry=await product('../src/lib/page-composition/slot-module-registry.ts');
for(const kind of ['gallery','faq','slider','__proto__'])positive(()=>assert.equal(slotRegistry.resolveSlotModuleRegistration(kind),null));
const retired=await product('../src/lib/page-blocks/deprecated-block-modules.ts');
const contentActions=ownerHarness.load(resolve(projectDirectory,'src/app/admin/pages-blocks/blocks/content/actions.ts'),['createContentBlock']);
for(const slug of [...retired.RETIRED_MEDIA_CENTER_LISTING_SHELL_TEMPLATE_SLUGS,...retired.RETIRED_PROJECT_LOCATION_PRESENTATION_TEMPLATE_SLUGS]){
 const before=JSON.stringify([...memory]),form=new FormData();form.set('name','Retired identity');form.set('slug',slug);
 const result=await contentActions.createContentBlock({revision:0},form);assert.equal(result.status,'error');assert.equal(result.focusTarget,'slug');assert.equal(JSON.stringify([...memory]),before);controls++;
}
console.log(JSON.stringify({status:'pass',controls,libraries:plan.length,declaredVisibleSortKeys:plan.reduce((sum,spec)=>sum+spec.sorts.length,0),searchCases:plan.length*coreTemplateSearchCases('qa-library-presentation-abcdef012345-controlled').length,blockRoundTrips,proofBoundary:'Canonical source-derived list projection and actual create/update Action owners on memory-only Supabase/RPC ports; verifier SQL on controlled PGlite. No real database writes, authenticated Browser or native PostgreSQL claim.',globalClosed:false}));
