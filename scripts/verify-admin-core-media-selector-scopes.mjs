import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, expect } from 'playwright/test';
import ts from 'typescript';

function textAssertions(source) {
 const file=ts.createSourceFile('media-journeys.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS), found=[];
 const ownerOf=node=>{
  for(let parent=node.parent;parent;parent=parent.parent){
   if(ts.isCallExpression(parent)&&parent.expression.getText(file)==='group'&&ts.isStringLiteral(parent.arguments[0]))return parent.arguments[0].text;
   if(ts.isFunctionDeclaration(parent)&&parent.name?.text==='prepareFinalThreePrerequisite')return parent.name.text;
  }
  return null;
 };
 const visit=node=>{
  if(ts.isAwaitExpression(node)&&ts.isCallExpression(node.expression)&&ts.isPropertyAccessExpression(node.expression.expression)&&node.expression.expression.name.text==='toContainText'){
   const call=node.expression.expression.expression;
   if(ts.isCallExpression(call)&&call.expression.getText(file)==='expect'&&call.arguments.length===1&&call.arguments[0].getText(file).startsWith('main()')){
    assert.equal(node.expression.arguments.length,1);
    const argument=node.expression.arguments[0];
    found.push({owner:ownerOf(node),target:call.arguments[0].getText(file),text:ts.isStringLiteral(argument)?argument.text:argument.getText(file),statement:node.getText(file)});
   }
  }
  ts.forEachChild(node,visit);
 };visit(file);
 const expected=[
  ['prepareFinalThreePrerequisite','plan.article.title'],
  ['catalog-query','لا توجد ملفات مطابقة داخل هذا العرض.'],
  ['picker-use','plan.article.title'],
  ['detach-delete','لا توجد استخدامات حالية لهذا الملف.'],
 ];
 assert.deepEqual(found.map(({owner,text})=>[owner,text]),expected,'Preserve the three original assertions and the exact uncredited prerequisite title assertion in their owners.');
 return {historical:found.slice(1).map(row=>row.statement),prerequisite:found[0].statement,targets:found.map(row=>row.target)};
}
export async function verifyCoreMediaSelectorScopes(source) {
 const sources=['src/components/admin/AdminShell.tsx','src/app/admin/media-library/page.tsx'].map(file=>readFileSync(file,'utf8'));
 for(const source of sources){const file=ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0;const visit=node=>{if(ts.isJsxOpeningElement(node)&&node.tagName.getText(file)==='main')count++;ts.forEachChild(node,visit);};visit(file);assert.equal(count,1,'Current Shell + Media page both render main landmarks.');}
 const core=readFileSync('src/components/admin/media/MediaLibraryCore.tsx','utf8');assert.match(core,/data-media-library-mode=\{mode\}/);
 const extracted=textAssertions(source),assertions=extracted.historical,checks=[],texts=['لا توجد ملفات مطابقة داخل هذا العرض.','QA exact Article label','لا توجد استخدامات حالية لهذا الملف.'];
 const run=new Function('page','expect','plan','return (async()=>{const main=()=>page.locator("main");'+assertions.join(';')+';})();');
 assert.ok(extracted.targets.every(target=>target==='main().locator(\'[data-media-library-mode="manage"]\')'));
 const prerequisiteRun=new Function('page','expect','plan','return (async()=>{const main=()=>page.locator("main");'+extracted.prerequisite+';})();');
 const baseline=source.replaceAll('main().locator(\'[data-media-library-mode="manage"]\')','main()');
 const oldStatements=textAssertions(baseline).historical;assert.ok(oldStatements.every(statement=>statement.includes('expect(main())')));
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
  await test('Extracted uncredited prerequisite checks the owned article title in the manage owner',async()=>{await page.setContent(body([texts[1]]));await prerequisiteRun(page,bounded,plan);});
  for(const [name,inside,outside,mode,extra] of [
   ['missing owned title',[],[],'manage',''],
   ['wrong owned title',['Different article'],[],'manage',''],
   ['title only outside manage owner',[],[texts[1]],'manage',''],
   ['title only in picker owner',[texts[1]],[],'picker',''],
   ['duplicate manage owner',[texts[1]],[],'manage','<div data-media-library-mode="manage">'+texts[1]+'</div>'],
  ])await test('Prerequisite rejects '+name,async()=>{await page.setContent(body(inside,outside,mode,extra));await assert.rejects(prerequisiteRun(page,bounded,plan));});
  await test('Extractor rejects missing prerequisite assertion',async()=>{assert.throws(()=>textAssertions(source.replace(extracted.prerequisite,'')));});
  await test('Extractor rejects duplicate prerequisite assertion',async()=>{assert.throws(()=>textAssertions(source.replace(extracted.prerequisite,extracted.prerequisite+';'+extracted.prerequisite)));});
  await test('Extractor rejects wrong prerequisite owner',async()=>{assert.throws(()=>textAssertions(source.replaceAll('prepareFinalThreePrerequisite','unexpectedPrerequisite')));});
  await test('Extractor rejects wrong prerequisite expected value',async()=>{assert.throws(()=>textAssertions(source.replace(extracted.prerequisite,extracted.prerequisite.replace('plan.article.title','plan.article.otherTitle'))));});
  await test('Existing descendant control queries deduplicate nodes across the nested main scope',async()=>{await page.setContent(body(texts,[],'manage','<button>one actual button</button>'));assert.equal(await page.locator('main').getByRole('button',{name:'one actual button',exact:true}).count(),1);});
 }finally{await context.close();await browser.close();}
 return{status:'pass',checks:checks.length,cases:checks,boundary:'Actual Playwright + extracted journey assertions on a controlled DOM matching source-proven nested landmarks. No live application, DB, Docker or global Browser claim.'};
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const candidate=process.argv.includes('--candidate'),file=candidate?'.tmp-qa/core-final-closure/media-library-scope-patch/files/scripts/fixtures/admin-core-media-journeys.mjs':'scripts/fixtures/admin-core-media-journeys.mjs';console.log(JSON.stringify(await verifyCoreMediaSelectorScopes(readFileSync(file,'utf8')),null,2));}
