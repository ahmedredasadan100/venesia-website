import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from 'playwright/test';
import ts from 'typescript';

function textAssertions(source) {
 const file=ts.createSourceFile('media-journeys.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS), found=[];
 const visit=node=>{
  if(ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='toContainText'){
   const call=node.expression.expression.expression;
   if(ts.isCallExpression(call)&&call.expression.getText(file)==='expect'&&call.arguments.length===1&&call.arguments[0].getText(file).startsWith('main()'))found.push(node.getText(file));
  }
  ts.forEachChild(node,visit);
 };visit(file);assert.equal(found.length,3,'Keep the exact empty-result, used-title and unused assertions.');return found;
}
export async function verifyCoreMediaSelectorScopes(source) {
 const sources=['src/components/admin/AdminShell.tsx','src/app/admin/media-library/page.tsx'].map(file=>readFileSync(file,'utf8'));
 for(const source of sources){const file=ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0;const visit=node=>{if(ts.isJsxOpeningElement(node)&&node.tagName.getText(file)==='main')count++;ts.forEachChild(node,visit);};visit(file);assert.equal(count,1,'Current Shell + Media page both render main landmarks.');}
 const core=readFileSync('src/components/admin/media/MediaLibraryCore.tsx','utf8');assert.match(core,/data-media-library-mode=\{mode\}/);
 const assertions=textAssertions(source),checks=[],texts=['لا توجد ملفات مطابقة داخل هذا العرض.','QA exact Article label','لا توجد استخدامات حالية لهذا الملف.'];
 const run=new Function('page','expect','plan','return (async()=>{const main=()=>page.locator("main");'+assertions.join(';')+';})();');
 const baseline=source.replaceAll('main().locator(\'[data-media-library-mode="manage"]\')','main()');
 const oldStatements=textAssertions(baseline);assert.ok(oldStatements.every(statement=>statement.includes('expect(main())')));
 const oldRun=new Function('page','expect','plan','return (async()=>{const main=()=>page.locator("main");'+oldStatements.join(';')+';})();');
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();await context.route('**/*',route=>route.abort());
 const page=await context.newPage(),bounded=expect.configure({timeout:120}),plan={article:{title:texts[1]}};
 const body=(inside=texts,outside=[],mode='manage',extra='')=>'<main><p>'+outside.join('</p><p>')+'</p><main><div data-media-library-mode="'+mode+'"><p>'+inside.join('</p><p>')+'</p></div>'+extra+'</main></main>';
 const test=async(name,work)=>{await work();checks.push(name);};
 try{
  await test('Actual installed Playwright rejects original nested-main assertions despite correct text',async()=>{await page.setContent(body());assert.equal(await page.locator('main').count(),2);await assert.rejects(oldRun(page,bounded,plan),error=>error.message.includes('strict mode violation'));});
  await test('Actual extracted three corrected assertions resolve the existing manage owner',async()=>{await page.setContent(body());await run(page,bounded,plan);});
  for(let i=0;i<texts.length;i++)await test('Exact required Media invariant '+i+' still fails when missing',async()=>{await page.setContent(body(texts.filter((_,index)=>index!==i)));await assert.rejects(run(page,bounded,plan));});
  await test('Matching unrelated Shell text cannot satisfy missing library text',async()=>{await page.setContent(body([],texts));await assert.rejects(run(page,bounded,plan));});
  await test('Picker mode cannot satisfy a manage-only assertion',async()=>{await page.setContent(body(texts,[],'picker'));await assert.rejects(run(page,bounded,plan));});
  await test('Multiple manage owners remain a strict failure, never first-match selection',async()=>{await page.setContent(body(texts,[],'manage','<div data-media-library-mode="manage">'+texts.join(' ')+'</div>'));await assert.rejects(run(page,bounded,plan),error=>error.message.includes('strict mode violation'));});
  await test('Existing descendant control queries deduplicate nodes across the nested main scope',async()=>{await page.setContent(body(texts,[],'manage','<button>one actual button</button>'));assert.equal(await page.locator('main').getByRole('button',{name:'one actual button',exact:true}).count(),1);});
 }finally{await context.close();await browser.close();}
 return{status:'pass',checks:checks.length,cases:checks,boundary:'Actual Playwright + extracted journey assertions on a controlled DOM matching source-proven nested landmarks. No live application, DB, Docker or global Browser claim.'};
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const candidate=process.argv.includes('--candidate'),file=candidate?'.tmp-qa/core-final-closure/media-library-scope-patch/files/scripts/fixtures/admin-core-media-journeys.mjs':'scripts/fixtures/admin-core-media-journeys.mjs';console.log(JSON.stringify(await verifyCoreMediaSelectorScopes(readFileSync(file,'utf8')),null,2));}
