import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createJiti } from 'jiti';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';

const root = process.cwd(), require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
const { cleanText } = await jiti.import('../src/lib/page-blocks/admin-utils.ts');
const { plainTextToMarkdown } = await jiti.import('../src/lib/rich-text/html-utils.ts');
const { buildPageBlockTextFormattingPatch, pageBlockTextAlignClass } = await jiti.import('../src/lib/page-blocks/configs.ts');
const actionSource = await readFile(path.join(root, 'src/app/admin/pages-blocks/blocks/content/actions.ts'), 'utf8');
const ast = ts.createSourceFile('actions.ts', actionSource, ts.ScriptTarget.Latest, true);
const names = new Set(['CONTENT_FORMATTING_FIELDS', 'optionalImagePath', 'readColumnItems', 'buildVisionGoalsConfig', 'mergeSubmittedContentFormatting']);
const selected = ast.statements.filter(node => ts.isFunctionDeclaration(node)
  ? names.has(node.name?.text) : ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(ast))));
assert.equal(selected.length, names.size, 'Use the real existing save helpers, without a fixture serializer');
const serializer = ts.transpileModule(selected.map(n => n.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const saveConfig = new Function('cleanText', 'buildPageBlockTextFormattingPatch', serializer + '\nreturn data => mergeSubmittedContentFormatting(data, buildVisionGoalsConfig(data));')(cleanText, buildPageBlockTextFormattingPatch);

const initial = {
  eyebrow: 'رؤيتنا وأهدافنا', title: 'حيث تلتقي جودة الحياة بقيمة الاستثمار',
  intro: ['النص الأصلي محفوظ دون تحويل إلى HTML.\nسطر داخل الفقرة.', 'فقرة ثانية مستقلة للاختبار.', '*حرفي* <tag> &lt;tag&gt; _نص_ [رابط](/about)'],
  image: '/fixture-image.svg',
  imageAlt: 'الصورة الأصلية', showIntro: true, showTitle: true, showEyebrow: true,
  titleBold: true, introBold: false, introAlignment: 'right', titleAlignment: 'right', eyebrowAlignment: 'right',
  vision: { title: 'رؤيتنا', items: [{ title: 'الثقة', text: 'النص الأول' }] },
  goals: { title: 'أهدافنا', items: [{ title: 'الجودة', text: 'النص الثاني' }] },
};
let saved = structuredClone(initial), saves = 0;
const source = `import React,{useLayoutEffect} from 'react';import{createRoot}from'react-dom/client';
import Editor from '${root.replaceAll('\\', '/')}/src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx';
import Section from '${root.replaceAll('\\', '/')}/src/components/modules/VisionGoalsModuleSection.tsx';
import{mapVisionGoalsBlock}from'${root.replaceAll('\\', '/')}/src/components/modules/vision-goals-mappers.ts';
import SharedEditor from '${root.replaceAll('\\', '/')}/src/components/admin/AdminRichTextEditor.tsx';
import ArticleEditor from '${root.replaceAll('\\', '/')}/src/components/admin/content/editors/article/TopicMarkdownEditor.tsx';
import RichText from '${root.replaceAll('\\', '/')}/src/components/content/RichTextContent.tsx';
const root=createRoot(document.getElementById('root'));let generation=0;
window.mountShared=(mode,value)=>{window.ready=false;root.render(<React.Fragment key={++generation}><Ready/><form dir="rtl">{mode==='article'?<ArticleEditor defaultValue={value} draftIdentity={"isolated-compatibility-"+generation} baselineRevision="fixture"/>:<SharedEditor name="content" label="HTML" defaultValue={value}/>}</form></React.Fragment>)};
window.mountPreview=(mode,value)=>{window.ready=false;root.render(<React.Fragment key={++generation}><Ready/><RichText mode={mode} value={value} className="article-rich-text"/></React.Fragment>)};
function Ready(){useLayoutEffect(()=>{window.ready=true});return null;}
window.mount=(mode,config=window.initialConfig)=>{window.ready=false;root.render(<React.Fragment key={++generation}><Ready/>{mode==='editor'?<form dir="rtl" onSubmit={async e=>{e.preventDefault();const result=await window.persist([...new FormData(e.currentTarget)]);window.mount('editor',result);window.saved=true;}}><Editor config={config}/><button type="submit">حفظ الاختبار المعزول</button></form>:<div className="@container/slot-module"><Section cmsContent={mapVisionGoalsBlock({template:{config}})}/></div>}</React.Fragment>)};window.mount(new URLSearchParams(location.search).get('mode')||'public');`;
const dataModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
// Only unrelated media transport is stubbed. Editor, format controls, layout and serializers are real.
const mediaStub = dataModule(`import React from '${require.resolve('react').replaceAll('\\', '/')}';export default function Media(p){return <><input type="hidden" name={p.name} value={p.defaultValue}/><input type="hidden" name={p.altName} value={p.defaultAlt}/></>}`);
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
let bundle;
const compiler = webpack({ mode: 'development', target: 'web', context: root, entry: dataModule(source),
  output: { path: path.join(root, '.tmp-qa/about17'), filename: 'fixture.js' }, devtool: false,
  resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false } },
  plugins: [new webpack.NormalModuleReplacementPlugin(/AdminMediaImageField$/, mediaStub),
    new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$/, dataModule(`export const browseAdminLinksAjax=reject,browseTopicCategoriesPickerAjax=reject,browseMenusPickerAjax=reject,browseMenuItemsPickerAjax=reject,resolveAdminLinkAjax=reject;function reject(){throw Error('Unrelated network transport is outside this test')}`)),
    new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }),
    { apply(c) { c.hooks.shouldEmit.tap('MemoryFixture', () => false);c.hooks.compilation.tap('MemoryFixture', compilation => {
      webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('MemoryFixture', async context => {
        if (/\.[jt]sx?$/.test(context.resourcePath) && !context.resourcePath.includes('node_modules')) return ts.transpileModule(await readFile(context.resourcePath,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
      });
    }); } }],
});
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{if(!error&&!stats.hasErrors())bundle=Buffer.from(stats.compilation.assets['fixture.js'].source());compiler.close(closeError=>error||closeError||stats.hasErrors()?reject(error||closeError||Error(stats.toString({all:false,errors:true}))):resolve());}));
const css = (await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')})).css;
const server = createServer((req,res)=>{if(req.url==='/fixture-image.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#a78a56"/></svg>');return;}if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>'+css+'</style><div id="root"></div><script>window.initialConfig='+JSON.stringify(saved).replaceAll('<','\\u003c')+'</script><script src="/fixture.js"></script></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}), page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
await page.exposeFunction('persist', entries=>{const data=new FormData();for(const [k,v]of entries)data.append(k,v);saved=saveConfig(data);saves++;return saved;});
const url='http://127.0.0.1:'+server.address().port;
const ready=()=>page.waitForFunction(()=>window.ready===true);
try {
  for(const alignment of ['right','center','left']){
    assert.equal(pageBlockTextAlignClass(alignment),'!text-'+alignment+' [&_*]:!text-'+alignment,'Existing consumers retain the subtree contract');
    assert.equal(pageBlockTextAlignClass(alignment,'container'),'!text-'+alignment,'Rich text uses inherited alignment without overriding authored paragraphs');
  }
  await page.goto(url);await ready();
  for(const width of [1440,1024,768,390,1440]){
    await page.setViewportSize({width,height:1000});
    const boxes=await page.locator('section').evaluate(e=>{
      const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom,right:r.right}};
      const copy=e.querySelector('.slot-editorial-copy'),title=e.querySelector('h2');
      return {title:box(title),copy:box(copy),image:box(e.querySelector('.slot-editorial-media')),body:box(title.nextElementSibling),titleInCopy:copy.contains(title),separateHeader:!!e.querySelector('header'),overflow:document.documentElement.scrollWidth>innerWidth,rtl:getComputedStyle(e).direction,paddingBottom:getComputedStyle(e).paddingBottom};
    });
    assert.equal(boxes.overflow,false);assert.equal(boxes.rtl,'rtl');assert.equal(boxes.titleInCopy,true);assert.equal(boxes.separateHeader,false);
    assert.ok(boxes.title.bottom<=boxes.body.y,'Title must remain above the long content in the same column');
    if(width>=1280){assert.ok(boxes.copy.x>=boxes.image.right,'RTL copy column must be to the right of the image');assert.equal(boxes.title.width,boxes.copy.width);}
    else if(width<768)assert.ok(boxes.title.y>=boxes.image.bottom,'Mobile preserves image, then title and body order');
    assert.equal(boxes.paddingBottom,width>=768?'48px':'40px','Existing section spacing remains unchanged');
    console.log('Public RTL layout PASS '+width);
  }
  for(const override of [{image:''},{showTitle:false,showEyebrow:false},{showIntro:false},{title:'',eyebrow:'',intro:[],vision:{title:'',items:[]},goals:{title:'',items:[]}}]){
    await page.evaluate(c=>window.mount('public',c),{...initial,...override});await ready();assert.equal(await page.locator('section').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(c=>window.mount('public',c),{...initial,image:'',eyebrow:'',intro:[],vision:{title:'',items:[]},goals:{title:'',items:[]}});await ready();
  await expect(page.locator('.slot-editorial-copy > h2')).toHaveText(initial.title);
  const invalidFormat = new FormData();invalidFormat.set('intro_content_format','html');
  assert.throws(()=>saveConfig(invalidFormat),/صيغة المحتوى الطويل/);
  const legacyForm = new FormData();legacyForm.set('intro',initial.intro.join('\n\n'));
  assert.deepEqual(saveConfig(legacyForm).intro,initial.intro);assert.equal(saveConfig(legacyForm).introContentFormat,undefined);
  await page.goto(url+'?mode=editor');await ready();
  const intro=page.getByRole('textbox',{name:'المحتوى الطويل',exact:true});
  const editorScope=page.locator('[data-admin-rich-text-scope]');
  const readParagraphs=()=>intro.locator(':scope > p').evaluateAll(ps=>ps.map(p=>p.innerText));
  await expect(intro).toBeVisible();assert.deepEqual(await readParagraphs(),initial.intro);
  await intro.focus();await expect(intro).toBeFocused();
  const submit=async()=>{await page.evaluate(()=>window.saved=false);await page.getByRole('button',{name:'حفظ الاختبار المعزول'}).click();await page.waitForFunction(()=>window.saved);await page.reload();await ready();await expect(intro).toBeVisible();};
  await submit();
  assert.deepEqual(saved.intro,initial.intro.map(plainTextToMarkdown));assert.equal(saved.introContentFormat,'markdown');
  assert.equal(saved.image,initial.image);assert.equal(saved.imageAlt,initial.imageAlt);assert.equal(saved.introAlignment,'right');assert.equal(saved.showIntro,true);
  assert.deepEqual(await readParagraphs(),initial.intro);
  await page.evaluate(c=>window.mount('public',c),saved);await ready();
  assert.deepEqual(await page.locator('.rich-text-content > p').evaluateAll(ps=>ps.map(p=>p.innerText)),initial.intro);
  // Content 17 opts into the same WYSIWYG surface as the existing Article consumer.
  const toolbarSnapshot=()=>page.locator('[data-admin-rich-text-scope] [role="toolbar"] button').evaluateAll(buttons=>buttons.map(b=>({name:b.getAttribute('aria-label')||b.title||b.textContent,classes:b.className,icon:b.querySelector('svg')?.getAttribute('class')||null})));
  await page.evaluate(()=>window.mountShared('article','فقرة للمقارنة'));await ready();
  await expect(page.locator('[contenteditable="true"]')).toBeVisible();
  const articleToolbar=await toolbarSnapshot();
  const articleMinHeight=await page.locator('[contenteditable="true"]').evaluate(e=>getComputedStyle(e).minHeight);
  await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
  assert.deepEqual(await toolbarSnapshot(),articleToolbar,'Content 17 must adopt the exact Article toolbar and control scale');
  assert.equal(await intro.evaluate(e=>getComputedStyle(e).minHeight),articleMinHeight);
  assert.equal(await editorScope.getByRole('button',{name:'H1',exact:true}).count(),0,'No new H1 action outside the Article contract');
  const boldControl=editorScope.getByRole('button',{name:'تنسيق عريض',exact:true});
  await boldControl.focus();await expect(boldControl).toBeFocused();
  await page.keyboard.press('Tab');await expect(editorScope.getByRole('button',{name:'فقرة',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(boldControl).toBeFocused();
  assert.notEqual(await boldControl.evaluate(e=>getComputedStyle(e).outlineStyle),'none','Keyboard focus remains visible');
  console.log('Article toolbar, dimensions and keyboard/focus parity PASS');
  for(const [name,editorTag,publicTag,level]of [['عنوان رئيسي داخل المقال','h2','h3','2'],['عنوان فرعي داخل المقال','h3','h4','3'],['فقرة','p','p',null]]){
    saved={...saved,intro:['نص عنوان محفوظ']};
    await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
    await intro.focus();await intro.press('Control+A');
    if(editorTag==='p')await editorScope.getByRole('button',{name:'عنوان فرعي داخل المقال',exact:true}).click();
    await editorScope.getByRole('button',{name,exact:true}).click();
    // StarterKit retains its legitimate empty cursor paragraph when a heading becomes a paragraph.
    if(editorTag==='p')await expect(intro.locator(':scope > p')).toHaveText(['نص عنوان محفوظ','']);
    else await expect(intro.locator(':scope > '+editorTag)).toHaveText('نص عنوان محفوظ');
    await submit();await expect(intro.locator(':scope > '+editorTag)).toHaveText('نص عنوان محفوظ');
    await page.evaluate(c=>window.mount('public',c),saved);await ready();
    await expect(page.locator('.rich-text-content > '+publicTag)).toHaveText('نص عنوان محفوظ');
    if(level)await expect(page.locator('.rich-text-content > '+publicTag)).toHaveAttribute('data-article-heading-level',level);
    assert.equal(await page.locator('section h1').count(),0);
    await expect(page.locator('.slot-editorial-copy > h2')).toHaveText(initial.title);
    console.log('Edit -> format -> save -> reload -> public heading '+editorTag+' PASS');
  }
  for(const [name,alignment]of [['محاذاة للوسط','center'],['محاذاة لليسار','left'],['ضبط النص من الجانبين','justify'],['محاذاة لليمين','right']]){
    saved={...saved,intro:['نص المحاذاة المحفوظ']};
    await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
    await intro.focus();await intro.press('Control+A');await editorScope.getByRole('button',{name,exact:true}).click();
    assert.equal(await intro.locator('p').evaluate(e=>getComputedStyle(e).textAlign),alignment);
    await submit();assert.equal(await intro.locator('p').evaluate(e=>getComputedStyle(e).textAlign),alignment);
    await page.evaluate(c=>window.mount('public',c),saved);await ready();
    assert.equal(await page.locator('.rich-text-content > p').evaluate(e=>getComputedStyle(e).textAlign),alignment,JSON.stringify({stored:saved.intro,rendered:await page.locator('.rich-text-content').innerHTML()}));
    await expect(page.locator('.rich-text-content > p')).toHaveText('نص المحاذاة المحفوظ');
    console.log('Edit -> format -> save -> reload -> public alignment '+alignment+' PASS');
  }
  saved={...saved,intro:['فقرة أولى']};
  await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
  await intro.fill('فقرة أولى');await intro.press('Enter');await page.keyboard.insertText('فقرة ثانية');
  await intro.press('Shift+Enter');await page.keyboard.insertText('سطر داخل الفقرة الثانية');
  const enteredParagraphs=['فقرة أولى','فقرة ثانية\nسطر داخل الفقرة الثانية'];
  assert.deepEqual(await readParagraphs(),enteredParagraphs);
  await editorScope.getByRole('button',{name:'محاذاة للوسط',exact:true}).click();
  await submit();assert.deepEqual(await readParagraphs(),enteredParagraphs);assert.deepEqual(saved.intro,[enteredParagraphs[0],'::center:: '+enteredParagraphs[1]]);
  assert.equal(await intro.locator('p').nth(1).evaluate(e=>getComputedStyle(e).textAlign),'center');
  await page.evaluate(c=>window.mount('public',c),saved);await ready();
  assert.deepEqual(await page.locator('.rich-text-content > p').evaluateAll(ps=>ps.map(p=>p.innerText)),enteredParagraphs);
  assert.equal(await page.locator('.rich-text-content > p').nth(1).evaluate(e=>getComputedStyle(e).textAlign),'center');
  console.log('Enter paragraphs / aligned Shift+Enter line break save/reload/public PASS');
  for(const alignment of ['right','center','left']){
    await page.evaluate(c=>window.mount('public',c),{...initial,introAlignment:alignment});await ready();
    assert.equal(await page.locator('.slot-editorial-copy > p').last().evaluate(e=>getComputedStyle(e).textAlign),alignment,'Legacy field alignment is unchanged');
    await page.evaluate(c=>window.mount('public',c),{...initial,introContentFormat:'markdown',introAlignment:alignment,intro:['نص موروث','::center:: محاذاة الفقرة']});await ready();
    assert.equal(await page.locator('.rich-text-content > p').first().evaluate(e=>getComputedStyle(e).textAlign),alignment);
    assert.equal(await page.locator('.rich-text-content > p').last().evaluate(e=>getComputedStyle(e).textAlign),'center');
  }
  console.log('Legacy alignment defaults and explicit rich paragraph precedence PASS');
  const literal='نص *حرفي* <tag>';
  for(const [button,tag]of [['تنسيق عريض','strong'],['مائل','em'],['تحته خط','u'],['قائمة نقطية','ul'],['قائمة مرقمة','ol'],['رابط','a']]){
    await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
    await intro.fill(literal);await intro.press('Control+A');
    // Reset marks inherited from the previous saved selection through the existing toolbar.
    for(const name of ['تنسيق عريض','مائل','تحته خط','قائمة نقطية','قائمة مرقمة']){const control=editorScope.getByRole('button',{name,exact:true});if(await control.getAttribute('aria-pressed')==='true')await control.click();}
    await editorScope.getByRole('button',{name:button,exact:true}).click();
    if(tag==='a'){await editorScope.getByRole('textbox',{name:'عنوان الرابط',exact:true}).fill('/about');await editorScope.getByRole('button',{name:'تطبيق الرابط',exact:true}).click();}
    await expect(intro.locator(tag)).toHaveText(literal);
    if(tag==='ul'||tag==='ol')assert.equal(await intro.locator(tag).evaluate(e=>getComputedStyle(e).listStyleType),tag==='ul'?'disc':'decimal');
    await submit();await expect(intro.locator(tag)).toHaveText(literal);
    await page.evaluate(c=>window.mount('public',c),saved);await ready();
    await expect(page.locator('.rich-text-content '+tag)).toHaveText(literal);
    if(tag==='ul'||tag==='ol')assert.equal(await page.locator('.rich-text-content '+tag).evaluate(e=>getComputedStyle(e).listStyleType),tag==='ul'?'disc':'decimal');
    assert.equal(await page.locator('.rich-text-content').textContent(),literal);
    if(tag==='a')await expect(page.locator('.rich-text-content a')).toHaveAttribute('href','/about');
    console.log('Vision Goals editor -> real serializer -> reload -> public '+tag+' PASS');
  }
  saved={...saved,intro:['## عنوان داخلي','### عنوان فرعي','فقرة **عريضة** مع <u>خط</u> و'+plainTextToMarkdown('*حرفي* <tag>'),'فقرة ثانية','- الأول\n- الثاني','[من نحن](/about)']};
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1100});await page.goto(url+'?mode=editor');await ready();await expect(intro).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await intro.focus();await expect(intro).toBeFocused();assert.equal(await intro.getAttribute('dir'),'rtl');
    if(width!==768)await page.locator('[data-module-editor-field-nature="long-content"]').screenshot({path:'.tmp-qa/about17/rich-editor-'+width+'.png'});
    await page.evaluate(c=>window.mount('public',c),saved);await ready();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await expect(page.locator('section img')).toHaveJSProperty('naturalWidth',800);
    const copy=page.locator('.slot-editorial-copy');await expect(copy.locator(':scope > h2')).toHaveText(initial.title);
    await expect(copy.locator('.rich-text-content strong')).toHaveText('عريضة');await expect(copy.locator('.rich-text-content u')).toHaveText('خط');
    assert.equal(await copy.evaluate(e=>getComputedStyle(e).direction),'rtl');
    if(width!==768)await page.locator('section').screenshot({path:'.tmp-qa/about17/rich-public-'+width+'.png'});
    console.log('Formatted Content 17 Desktop/Mobile/RTL PASS '+width);
  }
  for(const config of [
    {...initial,intro:['**حرفي** <u>حرفي</u>']},
    {...initial,introContentFormat:'unknown',intro:['**حرفي** <u>حرفي</u>']},
  ]){await page.evaluate(c=>window.mount('public',c),config);await ready();assert.equal(await page.locator('.slot-editorial-copy > p').last().textContent(),config.intro[0]);assert.equal(await page.locator('.slot-editorial-copy > p strong,.slot-editorial-copy > p u').count(),0);}
  await page.evaluate(c=>window.mount('public',c),{...saved,showIntro:false});await ready();assert.equal(await page.locator('.rich-text-content').count(),0);
  await page.evaluate(c=>window.mount('public',c),{...saved,intro:['<script>window.xss=true</script><p onclick="window.xss=true">نص</p>','[خطر](javascript:alert(1))']});await ready();
  assert.equal(await page.locator('.rich-text-content script,.rich-text-content [onclick],.rich-text-content [href^="javascript:"]').count(),0);assert.equal(await page.evaluate(()=>window.xss),undefined);
  console.log('Legacy markers, invalid format, visibility and unsafe payload handling PASS');
  // Actual Article consumer and the default HTML editor share the same engine; transport remains isolated.
  for(const mode of ['article','html']){
    const initialValue=mode==='article'?'## عنوان\n\n**عريض** و<u>خط</u>\n\n::center:: سطر أول\nسطر ثان\n\n'+plainTextToMarkdown('*حرفي* <tag>'):'<p><strong>عريض</strong> و<u>خط</u></p><p>*حرفي* &lt;tag&gt;</p>';
    await page.evaluate(([m,v])=>window.mountShared(m,v),[mode,initialValue]);await ready();
    const field=page.locator('[contenteditable="true"]');await expect(field).toBeVisible();await expect(field.locator('u')).toHaveText('خط');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(mode==='article'){
      const aligned=field.locator('p').filter({hasText:'سطر أول'});
      await expect(aligned).toHaveText('سطر أولسطر ثان');
      assert.equal(await aligned.locator('br').count(),1);
      assert.equal(await aligned.evaluate(e=>getComputedStyle(e).textAlign),'center');
    }
    await field.focus();await field.press('Control+A');await page.locator('[data-admin-rich-text-scope]').getByRole('button',{name:'قائمة نقطية',exact:true}).click();
    assert.equal(await field.locator('ul').first().evaluate(e=>getComputedStyle(e).listStyleType),'disc');
    await page.locator('[data-admin-rich-text-scope]').getByRole('button',{name:'قائمة نقطية',exact:true}).click();
    await field.fill(literal);await field.press('Control+A');await page.locator('[data-admin-rich-text-scope]').getByRole('button',{name:'تحته خط',exact:true}).click();
    await expect(field.locator('u')).toHaveText(literal);
    const stored=await page.locator('form').evaluate(f=>new FormData(f).get('content'));
    await page.reload();await ready();await page.evaluate(([m,v])=>window.mountShared(m,v),[mode,stored]);await ready();await expect(field.locator('u')).toHaveText(literal);
    await page.evaluate(([m,v])=>window.mountPreview(m==='article'?'markdown':'rich',v),[mode,stored]);await ready();await expect(page.locator('.rich-text-content u')).toHaveText(literal);
    console.log('Existing '+mode+' consumer save/reload/public preservation PASS');
  }
  assert.equal(saves,15);assert.deepEqual(errors,[]);
  console.log('Rich text adoption PASS: actual controls, serializers and renderers; isolated memory transport; no DB writes.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
