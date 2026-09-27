import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import ts from 'typescript';
import {runCoreDescendantPresentationJourneys} from './fixtures/admin-core-descendant-presentation-journeys.mjs';
import assert from 'node:assert/strict';
import {randomUUID,createHash}from'node:crypto';
import{createJiti}from'jiti';
import{loadCoreResidualSearchContract,coreResidualSearchQueries,projectCoreResidualSearchRows,assertCoreResidualSearchFragments,assertCoreResidualSearchReceipt,bindCoreResidualSearchCells,coreResidualMediaRows,assertCoreResidualSearchCompletion}from'./fixtures/admin-core-residual-search.mjs';
let controls=0;const positive=fn=>{fn();controls++;},negative=fn=>{assert.throws(fn);controls++;};const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const {ADMIN_COLLECTION_SURFACE_ADOPTION:manifest}=await jiti.import('../src/lib/admin/interaction-system/adoption-manifest.ts');
const symbolText="qa % _ * ' \\";const raw={menus:{name:symbolText,slug:'specific',location:'custom'},items:{item:{label:symbolText,href:'/query-target',linked_type:null,linked_id:null},parentLabel:null},assignments:{template_name:symbolText,module_kind:'content',template_slug:'specific',template_variant:'default',slot:'main'},integrations:{label:symbolText,description:'controlled projection',category:'analytics'},media:{displayName:symbolText,originalFilename:'specific.png',objectKey:'images/owned/file',defaultAltText:'controlled alt'}};
positive(()=>assert.equal(typeof runCoreDescendantPresentationJourneys,'function'));
const contracts={},required=[];
for(const key of Object.keys(raw)){
 const contract=await loadCoreResidualSearchContract(key);contracts[key]=contract;for(const consumer of contract.consumers){positive(()=>assert.equal(manifest.surfaces.filter(row=>row.id===consumer).length,1));required.push({key:'collection:'+consumer+':capability:search',boundary:'collection',consumer,axis:'search',scenario:manifest.surfaces.find(row=>row.id===consumer).capabilityAudit.overrides.search?.state==='approved_exception'?'approved_exception_contract_behavior':'complete_applicable_capability_behavior',declaration:manifest.surfaces.find(row=>row.id===consumer).capabilityAudit.overrides.search?.state??'adopted'});}
 const rows=[{id:'1',text:contract.textFor(raw[key],{main:'Main'})},{id:'2',text:'entirely unrelated'}];positive(()=>assert.ok(rows[0].text.includes('%')&&rows[0].text.includes('\\')));
 const observations=coreResidualSearchQueries('qa').map(query=>({...query,ids:projectCoreResidualSearchRows(contract,rows,query.query),uiExact:true,queryStateExact:true}));for(const row of observations.slice(0,5))positive(()=>assert.deepEqual(row.ids,['1']));positive(()=>assert.deepEqual(observations[6].ids,['1','2']));const receipt=assertCoreResidualSearchFragments(contract,rows,'qa',observations);positive(()=>assertCoreResidualSearchReceipt(contract,rows,'qa',receipt));
 for(const mutate of [r=>r.observations[0].ids.push('2'),r=>r.observations[1].ids.push('1'),r=>r.observations[2].ids=['foreign'],r=>r.observations[3].query='%',r=>r.observations.pop(),r=>r.observations.reverse(),r=>r.observations[4].uiExact=false,r=>r.observations[5].queryStateExact=false,r=>r.ownerSha256='f'.repeat(64),r=>r.projectionSha256='f'.repeat(64),r=>r.globalClosed=true,r=>r.automaticCoverage=['invented']]){const bad=structuredClone(receipt);mutate(bad);negative(()=>assertCoreResidualSearchReceipt(contract,rows,'qa',bad));}
 negative(()=>projectCoreResidualSearchRows(contract,[rows[0],rows[0]],'%'));
}
positive(()=>assert.equal(required.find(row=>row.consumer==='settings-pages').scenario,'approved_exception_contract_behavior'));
for(const contract of Object.values(contracts)){for(const consumer of contract.consumers){const bad=structuredClone(required),row=bad.find(item=>item.consumer===consumer);row.scenario=row.scenario==='approved_exception_contract_behavior'?'complete_applicable_capability_behavior':'approved_exception_contract_behavior';negative(()=>bindCoreResidualSearchCells(contract,bad));const wrong=structuredClone(required);wrong.find(item=>item.consumer===consumer).declaration='foreign';negative(()=>bindCoreResidualSearchCells(contract,wrong));}positive(()=>assert.equal(bindCoreResidualSearchCells(contract,required).length,contract.consumers.length));for(const cells of [required.filter(row=>row.consumer!==contract.consumers[0]),[...required,required.find(row=>row.consumer===contract.consumers[0])]])negative(()=>bindCoreResidualSearchCells(contract,cells));}
const sourceInventory=Object.values(contracts).map(contract=>({file:contract.path,sha256:contract.sourceSha256})),independentSource={manifest:sourceInventory,sourceSha256:createHash('sha256').update(JSON.stringify(sourceInventory)).digest('hex')};
const nativeBase={status:'pass',ownedRunId:'controlled-owned'},browserBase={sourceSha256:independentSource.sourceSha256,status:'pass',driverCompleted:true,errors:[],requiredCases:required};
const {INTEGRATION_DEFINITIONS:definitions}=await jiti.import('../src/lib/admin/integrations/integrations-contract.ts');
const integrationRecords=Array.from({length:2},()=>({id:randomUUID(),kind:'readonly-hub-state',entity:'integration-search',...nativeBase,value:{publicDataSha256:'a'.repeat(64),publicTableInventorySha256:'b'.repeat(64)}}));
const makeFragment=(contract,rows,restore)=>assertCoreResidualSearchFragments(contract,rows,restore,coreResidualSearchQueries(restore).map(query=>({...query,ids:projectCoreResidualSearchRows(contract,rows,query.query),uiExact:true,queryStateExact:true})));
const integrationRows=definitions.map(row=>({id:row.key,text:contracts.integrations.textFor(row)}));
const integrationBrowser={...browserBase,cohort:'readonly-hubs',evidence:[{id:'readonly-integrations-catalog-query-filter-empty-reset',status:'pass',coverage:[],searchWrites:0,searchNamedCellBindings:bindCoreResidualSearchCells(contracts.integrations,required),searchNativeCheckpointIds:integrationRecords.map(row=>row.id),searchReloadResetsLocal:true,searchFragments:makeFragment(contracts.integrations,integrationRows,definitions[0].label)}]};
const namespace='qa-core-media-0123456789abcdef',folder='images/'+namespace;
const assets=Array.from({length:10},(_,index)=>({id:randomUUID(),status:'active',folder_path:folder,display_name:namespace+'-'+index,original_filename:'image.png',object_key:folder+'/'+index+'.png',default_alt_text:null}));
const mediaState={kind:'media-library-state',...nativeBase,qaActorId:91,namespace,articleId:12,assets,objects:[],folders:[],references:[],leases:[],reservations:[],audits:[],storageSha256:'a'.repeat(64),publicDataSha256:'b'.repeat(64),publicTableInventorySha256:'c'.repeat(64)};
const mediaRecords=Array.from({length:2},()=>({id:randomUUID(),...mediaState})),mediaRows=coreResidualMediaRows(contracts.media,mediaState,folder);
const mediaBrowser={...browserBase,cohort:'media-library',media:{checkpoints:mediaRecords.map((row,index)=>({receiptId:row.id,label:index?'query-after':'query-baseline'}))},evidence:[{id:'core-media-catalog-query',status:'pass',coverage:[],searchWrites:0,searchFolder:folder,searchReloadRetained:true,searchNamedCellBindings:bindCoreResidualSearchCells(contracts.media,required),searchNativeCheckpointIds:mediaRecords.map(row=>row.id),searchFragments:makeFragment(contracts.media,mediaRows,namespace)}]};
for(const [browser,records]of [[integrationBrowser,integrationRecords],[mediaBrowser,mediaRecords]]){
 const native={...nativeBase,records};
 for(const mutation of [b=>{b.sourceSha256='f'.repeat(64);},b=>{delete b.sourceSha256;},(b,p)=>{delete p.sourceSha256;},(b,p)=>{p.sourceSha256='invalid';},(b,p)=>{p.sourceSha256='f'.repeat(64);b.sourceSha256=p.sourceSha256;},(b,p)=>{p.manifest=[];},(b,p)=>{p.manifest.push(p.manifest[0]);p.sourceSha256=createHash('sha256').update(JSON.stringify(p.manifest)).digest('hex');b.sourceSha256=p.sourceSha256;},(b,p)=>{p.manifest=p.manifest.filter(row=>row.file!==b.evidence[0].searchFragments.ownerPath);p.sourceSha256=createHash('sha256').update(JSON.stringify(p.manifest)).digest('hex');b.sourceSha256=p.sourceSha256;},(b,p)=>{p.manifest.find(row=>row.file===b.evidence[0].searchFragments.ownerPath).sha256='f'.repeat(64);p.sourceSha256=createHash('sha256').update(JSON.stringify(p.manifest)).digest('hex');b.sourceSha256=p.sourceSha256;b.evidence[0].searchFragments.ownerSha256='f'.repeat(64);}]){const b=structuredClone(browser),p=structuredClone(independentSource);mutation(b,p);await assert.rejects(()=>assertCoreResidualSearchCompletion(b,native,p));controls++;}
 await assert.rejects(()=>assertCoreResidualSearchCompletion(browser,native));controls++;
 await assertCoreResidualSearchCompletion(browser,native,independentSource);controls++;
 for(const mutate of [(b,n)=>n.records[1].ownedRunId='foreign',(b,n)=>n.records.reverse(),(b,n)=>n.records.push(n.records[0]),b=>b.evidence[0].searchNativeCheckpointIds.reverse(),b=>b.evidence[0].searchWrites=1,b=>b.evidence[0].searchNamedCellBindings=[],b=>b.evidence[0].searchFragments.observations[0].ids=['foreign'],b=>b.requiredCases=b.requiredCases.filter(r=>r.consumer!==b.evidence[0].searchNamedCellBindings[0].consumer),b=>b.driverCompleted=false,b=>b.errors=['failure']]){const b=structuredClone(browser),n=structuredClone(native);mutate(b,n);await assert.rejects(()=>assertCoreResidualSearchCompletion(b,n,independentSource));controls++;}
}
for(const mutate of [r=>r.value.publicDataSha256='f'.repeat(64),r=>r.value.publicTableInventorySha256='f'.repeat(64),r=>r.entity='foreign']){const records=structuredClone(integrationRecords);mutate(records[1]);await assert.rejects(()=>assertCoreResidualSearchCompletion(integrationBrowser,{...nativeBase,records},independentSource));controls++;}
for(const field of ['assets','audits','storageSha256','publicDataSha256']){const records=structuredClone(mediaRecords);records[1][field]=Array.isArray(records[1][field])?[]:'f'.repeat(64);if(field==='audits')records[1].audits=[{id:'unexpected'}];await assert.rejects(()=>assertCoreResidualSearchCompletion(mediaBrowser,{...nativeBase,records},independentSource));controls++;}
// Execute the actual collector initializer with the independent artifact read port.
// Structural controls keep that port and its position after private native joins mandatory.
const collectorPath=resolve(process.cwd(),'scripts/verify-admin-adoption-readback-isolated.mts');
const collectorSource=readFileSync(collectorPath,'utf8');
function assertCollectorResidualBinding(source){
 const tree=ts.createSourceFile(collectorPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),printer=ts.createPrinter();
 assert.equal(tree.parseDiagnostics.length,0);
 const emit=node=>printer.printNode(ts.EmitHint.Unspecified,node,tree).replace(/\s+/gu,'');
 const imports=tree.statements.filter(ts.isImportDeclaration).filter(node=>node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings)&&node.importClause.namedBindings.elements.some(item=>item.name.text==='assertCoreResidualSearchCompletion'));
 assert.equal(imports.length,1);assert.equal(imports[0].moduleSpecifier.text,'./fixtures/admin-core-residual-search.mjs');
 const imported=imports[0].importClause.namedBindings.elements.find(item=>item.name.text==='assertCoreResidualSearchCompletion');assert.equal(imported.propertyName,undefined);
 const main=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='verifyAdminAdoptionReadback');assert.ok(main?.body);
 const declarations=[];const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='residualSearch')declarations.push(node);ts.forEachChild(node,visit);};visit(main);
 assert.equal(declarations.length,1);const declaration=declarations[0],statement=declaration.parent.parent,block=statement.parent;
 assert.ok(ts.isVariableStatement(statement)&&Boolean(statement.declarationList.flags&ts.NodeFlags.Const));assert.ok(ts.isBlock(block)&&ts.isIfStatement(block.parent));assert.equal(emit(block.parent.expression),'browser.scope==="core-closure"');assert.equal(block.parent.thenStatement,block);
 const init=declaration.initializer;assert.ok(init&&ts.isConditionalExpression(init));
 assert.equal(emit(init.condition),'["readonly-hubs","media-library"].includes(browser.cohort??"")');assert.equal(init.whenFalse.kind,ts.SyntaxKind.NullKeyword);
 assert.ok(ts.isAwaitExpression(init.whenTrue)&&ts.isCallExpression(init.whenTrue.expression));const call=init.whenTrue.expression;
 assert.equal(emit(call.expression),'assertCoreResidualSearchCompletion');assert.equal(call.arguments.length,3);
 assert.equal(emit(call.arguments[0]),'browser');assert.equal(emit(call.arguments[1]),'nativeCheckpoints');
 assert.equal(emit(call.arguments[2]),'JSON.parse(readFileSync(join(artifactDir,"public-source-manifest.json"),"utf8"))');
 const direct=name=>{const rows=block.statements.filter(ts.isVariableStatement).flatMap(node=>[...node.declarationList.declarations]).filter(node=>ts.isIdentifier(node.name)&&node.name.text===name);assert.equal(rows.length,1);return rows[0];};
 const writes=direct('writes'),mediaCompletion=direct('mediaCompletion'),readOnly=direct('readOnly'),result=direct('result');
 assert.equal(emit(writes.initializer),'awaitverifyCoreDomainWrites(handle,browser)');
 assert.equal(emit(mediaCompletion.initializer),'browser.cohort==="media-library"?assertCoreMediaCompletionReceipts(handle,browser,nativeCheckpoints):null');
 for(const prerequisite of [writes,mediaCompletion,readOnly])assert.ok(prerequisite.end<statement.pos,'Residual search must follow completed private native joins.');
 assert.ok(declaration.end<result.pos);assert.ok(ts.isObjectLiteralExpression(result.initializer));
 const properties=result.initializer.properties.filter(node=>node.name?.getText(tree)==='residualSearch');assert.equal(properties.length,1);assert.ok(ts.isShorthandPropertyAssignment(properties[0]));
 assert.ok(block.statements.some(node=>ts.isReturnStatement(node)&&node.expression&&emit(node.expression)==='result'&&node.pos>result.end));
 return {initializer:init.getText(tree),statement:statement.getText(tree),importStatement:imports[0].getText(tree)};
}
const collectorBinding=assertCollectorResidualBinding(collectorSource);controls++;
const replaceOnce=(source,from,to)=>{assert.equal(source.split(from).length,2);return source.replace(from,()=>to);};
const badCollectors=[
 source=>replaceOnce(source,collectorBinding.importStatement,''),
 source=>replaceOnce(source,"'./fixtures/admin-core-residual-search.mjs'","'./fixtures/foreign-residual-search.mjs'"),
 source=>replaceOnce(source,collectorBinding.statement,''),
 source=>replaceOnce(source,collectorBinding.statement,collectorBinding.statement+'\n'+collectorBinding.statement),
 source=>replaceOnce(source,'await assertCoreResidualSearchCompletion(browser, nativeCheckpoints,','await foreignCompletion(browser, nativeCheckpoints,'),
 source=>replaceOnce(source,'assertCoreResidualSearchCompletion(browser, nativeCheckpoints, JSON.parse','assertCoreResidualSearchCompletion(browser, browser.nativeCheckpoints, JSON.parse'),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('JSON.parse(readFileSync(join(artifactDir, "public-source-manifest.json"), "utf8"))','browser.sourceManifest')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('"public-source-manifest.json"','"admin-adoption-browser.json"')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('join(artifactDir, "public-source-manifest.json")','browser.sourceManifestPath')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace(', JSON.parse(readFileSync(join(artifactDir, "public-source-manifest.json"), "utf8"))','')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('["readonly-hubs", "media-library"]','["readonly-hubs"]')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('["readonly-hubs", "media-library"]','["readonly-hubs", "media-library", "navigation-settings"]')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('["readonly-hubs", "media-library"]','["readonly-hubs", "media-recovery"]')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('browser.cohort','browser.scope')),
 source=>replaceOnce(source,collectorBinding.initializer,collectorBinding.initializer.replace('await assertCoreResidualSearchCompletion','assertCoreResidualSearchCompletion')),
 source=>replaceOnce(source,'status: "pass", residualSearch, downloadMedia','status: "pass", downloadMedia'),
 source=>replaceOnce(source,'status: "pass", residualSearch, downloadMedia','status: "pass", residualSearch: null, downloadMedia'),
 source=>{const removed=replaceOnce(source,collectorBinding.statement,'');return replaceOnce(removed,'const writes = await verifyCoreDomainWrites(handle, browser);',collectorBinding.statement+'\nconst writes = await verifyCoreDomainWrites(handle, browser);');},
 source=>replaceOnce(source,'const writes = await verifyCoreDomainWrites(handle, browser);','const writes = verifyCoreDomainWrites(handle, browser);'),
 source=>replaceOnce(source,'const mediaCompletion = browser.cohort === "media-library" ? assertCoreMediaCompletionReceipts(handle, browser, nativeCheckpoints) : null;','const mediaCompletion = null;'),
];
for(const mutate of badCollectors)negative(()=>assertCollectorResidualBinding(mutate(collectorSource)));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const executeCollectorHook=new AsyncFunction('browser','nativeCheckpoints','artifactDir','readFileSync','join','assertCoreResidualSearchCompletion','return '+collectorBinding.initializer+';');
async function executeBoundHook(browser,native){
 let reads=0,joins=0;const artifactDir=resolve(process.cwd(),'.tmp-qa','controlled-residual-source');
 const read=(file,encoding)=>{assert.equal(file,join(artifactDir,'public-source-manifest.json'));assert.equal(encoding,'utf8');reads++;return JSON.stringify(independentSource);};
 const complete=async(b,n,source)=>{assert.equal(b,browser);assert.equal(n,native);assert.deepEqual(source,independentSource);joins++;return assertCoreResidualSearchCompletion(b,n,source);};
 const result=await executeCollectorHook(browser,native,artifactDir,read,join,complete);return {result,reads,joins};
}
for(const [browser,records]of [[integrationBrowser,integrationRecords],[mediaBrowser,mediaRecords]]){
 const native={...nativeBase,records},joined=await executeBoundHook(browser,native);assert.equal(joined.result.status,'search-fragments-joined');assert.equal(joined.reads,1);assert.equal(joined.joins,1);controls++;
 for(const mutate of [b=>b.sourceSha256='f'.repeat(64),b=>{b.sourceManifest=structuredClone(independentSource);b.sourceManifest.manifest.push({file:'foreign-owner.ts',sha256:'a'.repeat(64)});b.sourceManifest.sourceSha256=createHash('sha256').update(JSON.stringify(b.sourceManifest.manifest)).digest('hex');b.sourceSha256=b.sourceManifest.sourceSha256;}]){const bad=structuredClone(browser);mutate(bad);await assert.rejects(()=>executeBoundHook(bad,native));controls++;}
}
for(const cohort of ['navigation-settings','page-composition','media-recovery','template-libraries','domain-forms',undefined]){const other={...integrationBrowser,cohort};assert.deepEqual(await executeBoundHook(other,null),{result:null,reads:0,joins:0});controls++;}
const registeredPackage=JSON.parse(readFileSync(resolve(process.cwd(),'package.json'),'utf8'));
function assertCanonicalRegistration(pkg){assert.equal(pkg.scripts['verify:admin-core-residual-search'],'node scripts/verify-admin-core-residual-search.mjs');const commands=pkg.scripts['verify:admin-core-closure'].split(' && ');assert.equal(commands.filter(command=>command==='npm run verify:admin-core-residual-search').length,1);assert.equal(commands.at(-1),'npm run verify:admin-core-residual-search');assert.ok(pkg.scripts['ci:check'].split(' && ').includes('npm run verify:admin-core-closure'));}
positive(()=>assertCanonicalRegistration(registeredPackage));
for(const mutate of [p=>delete p.scripts['verify:admin-core-residual-search'],p=>p.scripts['verify:admin-core-residual-search']='node scripts/foreign.mjs',p=>p.scripts['verify:admin-core-closure']=p.scripts['verify:admin-core-closure'].replace(' && npm run verify:admin-core-residual-search',''),p=>p.scripts['verify:admin-core-closure']+=' && npm run verify:admin-core-residual-search']){const bad=structuredClone(registeredPackage);mutate(bad);negative(()=>assertCanonicalRegistration(bad));}

console.log(JSON.stringify({status:'pass',controls,physicalSearchOwners:Object.keys(contracts).length,namedSearchFragments:required.length,boundary:'Actual current search expressions and canonical normalization with controlled positive/negative receipts. No authenticated Browser or native PostgreSQL execution; no automatic named-cell credit.',globalClosed:false}));
