import {verifyHomeDeletedMediaRendering} from './home-deleted-media-rendering.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
export async function waitForFeaturedCardAnimations(page,{timeout=5000}={}){
 await page.waitForFunction(()=>{
  const featured=document.querySelector('[data-case="featured"]');
  return featured!==null&&featured.getAnimations({subtree:true}).every(animation=>animation.playState==='finished');
 },null,{timeout});
}
export function assertFeaturedSecondaryFrames(frames){
 assert.equal(frames.length,3,'Featured fixture must retain its lead and both secondary image frames');
 assert(frames.slice(1).every(frame=>frame.width===973&&frame.height===175),JSON.stringify({viewport:1023,frames}));
}
export async function verifyMediaGuidanceBrowser({authoringOnly=false,outputDir}={}){
 const require=createRequire(import.meta.url),root=process.cwd(),out=outputDir??path.join(root,'.tmp-qa/media-guidance-browser');await mkdir(out,{recursive:true});
 const loader=path.join(out,'loader.cjs'),picker=path.join(out,'picker.js');
 await writeFile(loader,`module.exports=function(source){return require('typescript').transpileModule(source,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;};`);
 await writeFile(picker,`import React from 'react'; export default function Picker({open,onSelect,onClose}) { return open ? React.createElement('button',{type:'button',onClick:()=>{onSelect('/original.png');onClose();}},'Select fixture asset') : null; }`);
 const cssPath=path.join(root,'src/app/globals.css');
 const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile(cssPath,'utf8')+'\n@source "'+path.join(root,'src').replaceAll('\\','/')+'";\n',{from:cssPath})).css;
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 const compiler=webpack({mode:'development',target:'web',entry:path.join(root,'scripts/fixtures/media-guidance-browser.jsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],alias:{'server-only':false}},plugins:[new webpack.ProvidePlugin({process:require.resolve("next/dist/build/polyfills/process")}),new webpack.NormalModuleReplacementPlugin(/AdminMediaPickerModal$/,picker)],module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:loader}]},devtool:false});
 await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(e=>error||e||stats.hasErrors()?reject(error||e||Error(stats.toString({all:false,errors:true}))):resolve())));
 const binary=await require('sharp')({create:{width:400,height:600,channels:3,background:'#8d7044'}}).png().toBuffer();const metadata=await require('sharp')(binary).metadata();
 const homeGeometry=authoringOnly?[]:verifyHomeDeletedMediaRendering().geometryCases;
 const browser=await chromium.launch({headless:true});const errors=[],requests=[];try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture browser:',e.message)});
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());assert.equal(url.hostname,'127.0.0.1');
 if(url.pathname==='/api/admin/media-library'){const body=req.postDataJSON();assert.equal(body.operation,'reference_state');requests.push(body);return route.fulfill({json:{deleted:body.assets.filter(value=>value==='/deleted.png'),missing:body.assets.filter(value=>value==='/missing.png'),originals:body.assets.map(value=>({value,width:value==='/original.png'?metadata.width:value==='/wide.png'?900:null,height:value==='/original.png'?metadata.height:value==='/wide.png'?300:null}))}});}
 if(url.pathname==='/geometry')return route.fulfill({contentType:'text/html',body:'<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body>'+homeGeometry.map(item=>'<div class="@container/slot-module" data-geometry="'+item.name+'">'+item.html+'</div>').join('')+'</body></html>'});
 if(url.pathname==='/bundle.js')return route.fulfill({contentType:'application/javascript',body:await readFile(path.join(out,'bundle.js'))});
 if(url.pathname==='/style.css')return route.fulfill({contentType:'text/css',body:css});
 assert(!req.url().includes('deleted.png')&&!req.url().includes('missing.png'),'No retained deleted/missing URL request');
 if(url.pathname.endsWith('.png')||url.pathname==='/_next/image')return route.fulfill({contentType:'image/png',body:binary});
 assert.equal(req.method(),'GET');return route.fulfill({contentType:'text/html',body:'<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>'});});
 await page.goto('http://127.0.0.1:48198/');await page.waitForFunction(()=>window.guidanceFixtureReady);await page.locator('[data-qa="gallery"]').getByText('400 × 600 px',{exact:true}).waitFor();
 await page.locator('[data-qa="deleted-default"] [data-admin-media-preview-state="deleted"]').waitFor();
 for(const name of ['deleted-default','deleted-compact','missing','retained']){assert.equal(await page.locator(`[data-qa="${name}"] img`).count(),0);assert(await page.locator(`[data-qa="${name}"] input[type="hidden"]`).evaluateAll(elements=>elements.some(e=>e.value==='/deleted.png'||e.value==='/missing.png')));}
 const retained=page.locator('[data-qa="retained"]');
 await retained.getByRole('button',{name:'Save fixture',exact:true}).click();await retained.getByRole('button',{name:'Reload fixture',exact:true}).click();
 assert.equal(await retained.locator('[name="retained_alt"]').inputValue(),'Retained alt');assert.equal(await retained.locator('[name="retained_caption"]').inputValue(),'Retained caption');
 await retained.getByRole('button',{name:'اختيار بديل',exact:true}).click();await retained.getByRole('button',{name:'Select fixture asset',exact:true}).click();
 await retained.locator('img').waitFor();await retained.getByRole('button',{name:'Save fixture',exact:true}).click();await retained.getByRole('button',{name:'Reload fixture',exact:true}).click();await retained.locator('img').waitFor();
 assert.equal(await retained.locator('[name="retained_url"]').inputValue(),'/original.png');assert.equal(await retained.locator('[name="retained_caption"]').inputValue(),'Retained caption');
 assert.equal(await page.locator('img[src=""]').count(),0);
 assert.equal(await page.locator('[data-qa="project-card"] [data-media-slot]').count(),0,'No practical recommendation means no guidance');
 assert.match(await page.locator('[data-qa="project-card"] [data-media-original]').innerText(),/400 × 600/);
 await page.getByRole('button',{name:'Change project presentation',exact:true}).click();
 assert.equal(await page.locator('[data-qa="project-card"] [data-media-slot]').count(),0,'Future presentation cannot reintroduce ratio prose');
 assert.match(await page.locator('[data-qa="project-card"] [data-media-original]').innerText(),/400 × 600/);
 const cards=page.locator('[data-qa="gallery"] [data-admin-media-gallery-card="image"]');assert.equal(await cards.count(),3);
 const expected=['400 × 600 px','900 × 300 px','غير متاحة'];for(let n=0;n<3;n++){assert((await cards.nth(n).locator('[data-media-original]').innerText()).includes(expected[n]));assert(await cards.nth(n).evaluate(el=>{const img=el.querySelector('img'),text=el.querySelector('[data-media-original]');return text.getBoundingClientRect().top>=img.getBoundingClientRect().bottom-1&&text.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom;}));}
 assert.equal(await page.locator('[data-qa="gallery"] [data-media-original]').count(),3);assert.equal(requests.filter(r=>r.assets.length===3).length,1,'Gallery batch, no per-card reads');
 const topic=page.locator('[data-qa="topic"]'),recommended=topic.locator('[data-admin-media-dimension="recommended"]'),original=topic.locator('[data-admin-media-dimension="original"]');
 const preservedTopicValues=async()=>({image:await topic.locator('[name="image"]').inputValue(),alt:await topic.locator('[name="image_alt"]').inputValue()});
 const topicValues=await preservedTopicValues();
 assert.equal(await topic.locator('[data-admin-media-image-dimensions] details').count(),2,'Article adopts both existing dimension owners as adjacent disclosures');
 for(const [control,title] of [[recommended,'الموصى به'],[original,'الأبعاد الأصلية']]){
  assert.equal(await control.evaluate(element=>element.tagName),'DETAILS');
  assert.equal(await control.locator('summary').innerText(),title);
  assert.equal(await control.getAttribute('open'),null,'Dimension values start collapsed');
  assert.equal(await control.innerText(),title,'Collapsed dimensions expose the title only');
 }
 await recommended.locator('summary').click();assert.equal(await recommended.locator('p').getAttribute('aria-label'),'3840 × 2560 px');assert.match(await recommended.locator('bdi').innerText(),/^3840×2560(?: px)?$/);assert.notEqual(await recommended.getAttribute('open'),null);
 await original.locator('summary').focus();await original.locator('summary').press('Enter');assert.equal(await original.locator('p').getAttribute('aria-label'),'400 × 600 px');assert.match(await original.locator('bdi').innerText(),/^400×600(?: px)?$/);assert.notEqual(await original.getAttribute('open'),null);
 assert.deepEqual(await preservedTopicValues(),topicValues,'Opening dimension controls cannot mutate image or Alt');
 assert(await topic.locator('[data-admin-media-image-dimensions]').evaluate(element=>{
  const bounds=element.getBoundingClientRect(),frame=element.closest('[data-admin-media-image-field]').querySelector('[data-admin-media-image-frame]').getBoundingClientRect(),controls=[...element.querySelectorAll('details')].map(control=>control.getBoundingClientRect());
  return bounds.top>=frame.bottom-1&&controls.length===2&&Math.abs(controls[0].top-controls[1].top)<1&&(controls[0].right<=controls[1].left+1||controls[1].right<=controls[0].left+1);
 }),'Article dimensions sit below the preview in one adjacent row');
 await topic.screenshot({path:path.join(out,'topic-dimensions-open-desktop.png')});
 await original.locator('summary').press('Space');assert.equal(await original.getAttribute('open'),null,'Original dimensions close with the keyboard');
 await recommended.locator('summary').click();assert.equal(await recommended.getAttribute('open'),null,'Recommended dimensions close independently');
 assert.deepEqual(await preservedTopicValues(),topicValues,'Closing dimensions cannot mutate image or Alt');
 await page.getByRole('button',{name:'Change presentation'}).click();assert.equal(await page.locator('[data-qa="variant"] [data-media-slot]').innerText(),'المقاس التصميمي الموصى به: 2560 × 1920 px');assert.match(await page.locator('[data-qa="variant"] [data-media-original]').innerText(),/400 × 600/);
 for(const name of ['deleted-default','deleted-compact']){
  const field=page.locator('[data-qa="'+name+'"]');
  assert.equal(await field.locator('[data-admin-media-preview-state="deleted"]').innerText(),'الأصل محذوف');
  assert.equal(await field.getByRole('button',{name:'اختيار بديل',exact:true}).count(),1);
 }
 assert.doesNotMatch(await page.locator('main').innerText(),/100vh|Responsive|cover|crop|density|Safe Area|ليست شرطًا|لا يوجد مقاس|نسبة حاوية|تملأ الصورة|بياناته محفوظة|تفاصيل المرجع المحفوظ/iu);
 for(const name of ['variant','gallery']){
  const field=page.locator('[data-qa="'+name+'"]');
  assert(await field.locator('[data-media-slot]').evaluate(el=>el.getBoundingClientRect().bottom<=el.parentElement.querySelector('img').getBoundingClientRect().top));
 }
 const alt=page.locator('#topic-image-alt');await alt.focus();await alt.press('Control+End');assert(await alt.evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollTop>0));await alt.hover();const scrollbar=await alt.evaluate(e=>({width:getComputedStyle(e).scrollbarWidth,color:getComputedStyle(e).scrollbarColor}));assert.deepEqual(scrollbar,await page.locator('[data-qa="scrollbar-owner"]').evaluate(e=>({width:getComputedStyle(e).scrollbarWidth,color:getComputedStyle(e).scrollbarColor})));assert.equal(scrollbar.width,'thin');
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 for(const name of ['topic','gallery','deleted-default'])await page.locator('[data-qa="'+name+'"]').screenshot({path:path.join(out,name+'-desktop.png')});
 for(const width of [375,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await alt.focus();await alt.press('Control+End');assert(await alt.evaluate(e=>document.activeElement===e&&e.scrollTop>0));assert(await page.locator('[data-qa="compact-deleted"] [data-admin-media-preview-state]').evaluateAll(es=>es.every(e=>{const frame=e.getBoundingClientRect();return [...e.querySelectorAll('span')].every(s=>{const r=s.getBoundingClientRect();return r.top>=frame.top&&r.bottom<=frame.bottom})})), 'Compact deleted status must fit its frame');await page.screenshot({path:path.join(out,'mobile-'+width+'.png'),fullPage:true});if(width===390)for(const name of ['topic','gallery','deleted-default'])await page.locator('[data-qa="'+name+'"]').screenshot({path:path.join(out,name+'-mobile.png')});}
 await cards.nth(0).getByRole('button',{name:'تحريك الصورة لأسفل',exact:true}).click();await cards.nth(1).getByText('400 × 600 px',{exact:true}).waitFor();assert.match(await cards.nth(1).locator('[data-media-original]').innerText(),/400 × 600/);assert.equal(await page.locator('[name="gallery_alt"]').inputValue(),'وصف الأصل');assert.equal(await page.locator('[name="gallery_caption"]').inputValue(),'تعليق محفوظ');assert.deepEqual(errors,[]);
 if(authoringOnly){await writeFile(path.join(out,'authoring-receipt.json'),JSON.stringify({status:'PASS',recommendations:['3840 × 2560','2560 × 1920'],original:{width:metadata.width,height:metadata.height},unknown:true,batched:true,deletedSlot:'الأصل محذوف',replacement:'اختيار بديل',retainedAltCaptionSaveReload:true,futurePresentationVerboseGuidance:false,mobile:[375,390,430],errors,scope:'Affected shared Admin components only; existing controlled Catalog/picker transport. Prior real Upload/Picker/Save/Reload proof reused; no DB or Storage mutations.'},null,2));console.log('PASS minimal Admin media authoring: numeric recommendations, original dimensions, concise deleted slots, replacement, retained Alt/Caption, save/reload, desktop and mobile');return;}
 const projectFrames=[];await page.goto('http://127.0.0.1:48198/project-cards');await page.locator('[data-case="district"] img').waitFor();
 for(const width of [320,375,390,430,639,640,767,768,1023,1024,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});
  await waitForFeaturedCardAnimations(page);
  const cases=await page.locator('[data-case]').evaluateAll(es=>es.map(e=>({name:e.dataset.case,frames:[...e.querySelectorAll('img')].map(i=>{const r=i.parentElement.getBoundingClientRect(),s=getComputedStyle(i);return {width:r.width,height:r.height,cssHeight:getComputedStyle(i.parentElement).height,ratio:r.width/r.height,fit:s.objectFit,position:s.objectPosition};})})));
  assert.equal(cases.length,5);assert(cases.every(c=>c.frames.length>0));
  assert(cases.flatMap(c=>c.frames).every(f=>f.fit==='cover'&&f.position==='50% 50%'));
  const home=cases.find(c=>c.name==='home').frames;assert.equal(home.length,3);// Hover translation can round DOMRect by ~0.00003px; CSS height stays exact.
  assert(home.every(f=>f.cssHeight==='360px'&&Math.abs(f.height-360)<0.001),JSON.stringify({viewport:width,home}));
  const expectedWidth=width<768?width-(width<576?34:50):(Math.min(width-48,1280)-40)/3-2;
  assert(home.every(f=>Math.abs(f.width-expectedWidth)<0.05));
  if(width===1023)assertFeaturedSecondaryFrames(cases.find(c=>c.name==='featured').frames);
  projectFrames.push({viewport:width,cases});
  if([390,1440].includes(width))await page.screenshot({path:path.join(out,'project-cards-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:390,height:1000});await page.locator('.home-project-card').nth(1).hover();
 const hoverFrames=await page.locator('.home-project-card').nth(1).evaluate(async e=>{const frame=[...e.children].find(x=>x.classList.contains('h-[360px]')),samples=[];for(let i=0;i<12;i++){samples.push({height:frame.getBoundingClientRect().height,cssHeight:getComputedStyle(frame).height});await new Promise(requestAnimationFrame);}return samples;});
 assert(hoverFrames.every(f=>f.cssHeight==='360px'&&Math.abs(f.height-360)<0.001));
 await writeFile(path.join(out,'project-card-hover.json'),JSON.stringify(hoverFrames,null,2));
 await writeFile(path.join(out,'project-card-frames.json'),JSON.stringify(projectFrames,null,2));
 assert.deepEqual(errors,[]);
 await page.mouse.move(0,0);
 const geometryProof=[];await page.goto('http://127.0.0.1:48198/geometry');
 for(const width of [375,390,430,1440]){await page.setViewportSize({width,height:932});
 const result=await page.evaluate(()=>{const measure=(name,selector)=>{const root=document.querySelector(`[data-geometry="${name}"]`),base=root.getBoundingClientRect();return [...root.querySelectorAll(selector)].map(e=>{const r=e.getBoundingClientRect();return {x:r.x-base.x,y:r.y-base.y,width:r.width,height:r.height}})};return {storyValid:measure('story-valid','.home-story-frame'),storyDeleted:measure('story-deleted-all','.home-story-frame'),contactValid:measure('contact-valid','section'),contactDeleted:measure('contact-deleted','section')};});
 assert.deepEqual(result.storyValid,result.storyDeleted);assert.deepEqual(result.contactValid,result.contactDeleted);assert(result.storyDeleted.every(r=>r.width>0&&r.height>0));assert.equal(await page.locator('[data-geometry="story-deleted-all"] img,[data-geometry="contact-deleted"] img').count(),0);geometryProof.push({width,...result});await page.screenshot({path:path.join(out,'slot-geometry-'+width+'.png'),fullPage:true});}
 await writeFile(path.join(out,'geometry-proof.json'),JSON.stringify(geometryProof,null,2));
 await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',original:{width:metadata.width,height:metadata.height},recommendations:['3840 × 2560','2560 × 1920'],galleryCards:3,unknown:true,batched:true,scrollbar,mobile:[375,390,430],errors,scope:'Real components + Next Image; isolated read-only Catalog transport; no DB or Storage mutations'},null,2));
 console.log('PASS Media guidance: real field/gallery DOM, original binary dimensions, per-card placement, batch, unknown, owner change, shared scrollbar and mobile');
 }finally{await browser.close();}
}
