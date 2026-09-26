import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{chromium,expect}from'playwright/test';
import ts from'typescript';

function declaration(source,name,kind=ts.ScriptKind.JS){const file=ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,kind),found=[];const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found.push(node);ts.forEachChild(node,visit);};visit(file);assert.equal(found.length,1);return found[0].getText(file).replace(/^export\s+/,'');}
export async function verifyCoreQueryInformation(source){
 const current=readFileSync('src/components/admin/content/UnifiedContentRowActions.tsx','utf8');
 assert.match(current,/title:\s*"معلومات نشاط المحتوى"/);assert.match(current,/label:\s*"عدد المشاهدات:"/);assert.match(current,/formatAdminDataGridNumber\(row\.views_count \?\? 0\)/);
 const grid=readFileSync('src/components/admin/ui/AdminDataGrid.tsx','utf8'),formatter=declaration(grid,'formatAdminDataGridNumber',ts.ScriptKind.TSX);
 const gridFile=ts.createSourceFile('grid.tsx',grid,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const numberDeclaration=gridFile.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(row=>row.name.getText(gridFile)==='ADMIN_DATA_GRID_NUMBER_FORMATTER'));assert.ok(numberDeclaration);
 const formatterCode=ts.transpileModule(numberDeclaration.getText(gridFile)+'\n'+formatter,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const formatNumber=new Function(formatterCode+'return formatAdminDataGridNumber;')();
 const code=declaration(source,'assertCoreQueryInformation'),testFunction=new Function('assert','expect',code+'return assertCoreQueryInformation;');
 const bounded=expect.configure({timeout:120}),actual=testFunction(assert,bounded),checks=[];
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();await context.route('**/*',route=>route.abort());const page=await context.newPage();
 const spec={entity:'topics'},row={id:51,label:'Native Topic title absent from its activity panel',information:{viewCount:1234}};
 const body=({id=51,title='معلومات نشاط المحتوى',label='عدد المشاهدات:',value=formatNumber(1234)+' مشاهدة',extra=''}={})=>'<section data-admin-entity-id="'+id+'"><h3 data-admin-row-actions-information-title>'+title+'</h3><dl><dt>'+label+'</dt><dd>'+value+'</dd></dl>'+extra+'</section>';
 const info=()=>page.locator('section'),run=(value=row)=>actual(spec,value,info()),test=async(name,work)=>{await work();checks.push(name);};
 try{
  await test('Source-proven Topic activity panel passes native identity and native view count without invented title content',async()=>{await page.setContent(body());const result=await run();assert.deepEqual(result,{kind:'information',nativeEntityId:51,nativeViewCount:1234,actualActivityPanel:true});});
  await test('Old universal title assertion demonstrably rejects the correct activity-only panel',async()=>{await page.setContent(body());await assert.rejects(bounded(info()).toContainText(row.label));});
  await test('Native view-count formatting agrees with the actual shared formatter including thousands',async()=>{for(const viewCount of [0,1,1234,1234567]){await page.setContent(body({value:formatNumber(viewCount)+' مشاهدة'}));await run({...row,information:{viewCount}});}});
  await test('Wrong native entity identity remains a rejection',async()=>{await page.setContent(body({id:52}));await assert.rejects(run());});
  await test('Missing, negative, fractional and nonfinite native counts cannot establish information truth',async()=>{await page.setContent(body());for(const viewCount of [undefined,-1,0.5,NaN,Infinity])await assert.rejects(run({...row,information:{viewCount}}));await assert.rejects(run({...row,information:undefined}));});
  await test('Wrong rendered view count cannot borrow a correct title or row ID',async()=>{await page.setContent(body({value:'1,235 مشاهدة'}));await assert.rejects(run());});
  await test('Wrong activity title remains a rejection even with correct count',async()=>{await page.setContent(body({title:row.label}));await assert.rejects(run());});
  await test('Missing semantic view-count label remains a rejection',async()=>{await page.setContent(body({label:'other'}));await assert.rejects(run());});
  await test('A duplicated matching count is not accepted as one canonical value',async()=>{await page.setContent(body({extra:'<p>1,234 مشاهدة</p>'}));await assert.rejects(run());});
  await test('Matching text outside the row panel cannot replace its native view count',async()=>{await page.setContent(body({value:'0 مشاهدة'})+'<aside>1,234 مشاهدة</aside>');await assert.rejects(run());});
  await test('Other consumers retain their native row-label requirement',async()=>{await page.setContent(body({title:'Category native label'}));const category={id:51,label:'Category native label'};assert.equal((await actual({entity:'topic_categories'},category,info())).nativeLabel,category.label);await assert.rejects(actual({entity:'topic_categories'},{...category,label:'Wrong label'},info()));});
  await test('Hidden or duplicate information panels remain strict failures',async()=>{await page.setContent('<div hidden>'+body()+'</div>');await assert.rejects(run());await page.setContent(body()+body());await assert.rejects(run());});
 }finally{await context.close();await browser.close();}
 return{status:'pass',checks:checks.length,cases:checks,scope:'Actual extracted Browser assertion and installed Playwright on source-bound controlled DOM. Actual shared formatter is executed. Native SQL projection is covered separately; no live application or global capability claim.'};
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const file=process.argv.includes('--candidate')?'.tmp-qa/core-final-closure/b1-information-contract-patch/files/scripts/fixtures/admin-core-query-presentation-journeys.mjs':'scripts/fixtures/admin-core-query-presentation-journeys.mjs';console.log(JSON.stringify(await verifyCoreQueryInformation(readFileSync(file,'utf8')),null,2));}
