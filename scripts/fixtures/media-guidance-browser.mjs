import {verifyHomeDeletedMediaRendering} from './home-deleted-media-rendering.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
export async function verifyMediaGuidanceBrowser(){
 const require=createRequire(import.meta.url),root=process.cwd(),out=path.join(root,'.tmp-qa/media-guidance-browser');await mkdir(out,{recursive:true});
 const loader=path.join(out,'loader.cjs'),picker=path.join(out,'picker.js');
 await writeFile(loader,`module.exports=function(source){return require('typescript').transpileModule(source,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;};`);
 await writeFile(picker,`import React from 'react'; export default function Picker({open,onSelect,onClose}) { return open ? React.createElement('button',{type:'button',onClick:()=>{onSelect('/original.png');onClose();}},'Select fixture asset') : null; }`);
 const css=(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process('@import "tailwindcss";\n@source "'+path.join(root,'src').replaceAll('\\','/')+'";\n',{from:path.join(root,'src/app/globals.css')})).css;
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 const compiler=webpack({mode:'development',target:'web',entry:path.join(root,'scripts/fixtures/media-guidance-browser.jsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.jsx','.js'],alias:{'server-only':false}},plugins:[new webpack.ProvidePlugin({process:require.resolve("next/dist/build/polyfills/process")}),new webpack.NormalModuleReplacementPlugin(/AdminMediaPickerModal$/,picker)],module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:loader}]},devtool:false});
 await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(e=>error||e||stats.hasErrors()?reject(error||e||Error(stats.toString({all:false,errors:true}))):resolve())));
 const binary=await require('sharp')({create:{width:400,height:600,channels:3,background:'#8d7044'}}).png().toBuffer();const metadata=await require('sharp')(binary).metadata();
 const homeGeometry=verifyHomeDeletedMediaRendering().geometryCases;
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
 await retained.getByRole('button',{name:'استبدال',exact:true}).click();await retained.getByRole('button',{name:'Select fixture asset',exact:true}).click();
 await retained.locator('img').waitFor();await retained.getByRole('button',{name:'Save fixture',exact:true}).click();await retained.getByRole('button',{name:'Reload fixture',exact:true}).click();await retained.locator('img').waitFor();
 assert.equal(await retained.locator('[name="retained_url"]').inputValue(),'/original.png');assert.equal(await retained.locator('[name="retained_caption"]').inputValue(),'Retained caption');
 assert.equal(await page.locator('img[src=""]').count(),0);
 const cards=page.locator('[data-qa="gallery"] [data-admin-media-gallery-card="image"]');assert.equal(await cards.count(),3);
 const expected=['400 × 600 px','900 × 300 px','غير متاحة'];for(let n=0;n<3;n++){assert((await cards.nth(n).locator('[data-media-original]').innerText()).includes(expected[n]));assert(await cards.nth(n).evaluate(el=>{const img=el.querySelector('img'),text=el.querySelector('[data-media-original]');return text.getBoundingClientRect().top>=img.getBoundingClientRect().bottom-1&&text.getBoundingClientRect().bottom<=el.getBoundingClientRect().bottom;}));}
 assert.equal(await page.locator('[data-qa="gallery"] [data-media-original]').count(),3);assert.equal(requests.filter(r=>r.assets.length===3).length,1,'Gallery batch, no per-card reads');
 assert.match(await page.locator('[data-qa="topic"] [data-media-slot]').innerText(),/3840 × 2560/);
 await page.getByRole('button',{name:'Change presentation'}).click();assert.match(await page.locator('[data-qa="variant"] [data-media-slot]').innerText(),/2560 × 1920/);assert.match(await page.locator('[data-qa="variant"] [data-media-original]').innerText(),/400 × 600/);
 const alt=page.locator('#topic-image-alt');await alt.focus();await alt.press('Control+End');assert(await alt.evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollTop>0));await alt.hover();const scrollbar=await alt.evaluate(e=>({width:getComputedStyle(e).scrollbarWidth,color:getComputedStyle(e).scrollbarColor}));assert.deepEqual(scrollbar,await page.locator('[data-qa="scrollbar-owner"]').evaluate(e=>({width:getComputedStyle(e).scrollbarWidth,color:getComputedStyle(e).scrollbarColor})));assert.equal(scrollbar.width,'thin');
 await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 for(const width of [375,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await alt.focus();await alt.press('Control+End');assert(await alt.evaluate(e=>document.activeElement===e&&e.scrollTop>0));assert(await page.locator('[data-qa="compact-deleted"] [data-admin-media-preview-state]').evaluateAll(es=>es.every(e=>{const frame=e.getBoundingClientRect();return [...e.querySelectorAll('span')].every(s=>{const r=s.getBoundingClientRect();return r.top>=frame.top&&r.bottom<=frame.bottom})})), 'Compact deleted status must fit its frame');await page.screenshot({path:path.join(out,'mobile-'+width+'.png'),fullPage:true});}
 await cards.nth(0).getByRole('button',{name:'تحريك الصورة لأسفل',exact:true}).click();await cards.nth(1).getByText('400 × 600 px',{exact:true}).waitFor();assert.match(await cards.nth(1).locator('[data-media-original]').innerText(),/400 × 600/);assert.equal(await page.locator('[name="gallery_alt"]').inputValue(),'وصف الأصل');assert.equal(await page.locator('[name="gallery_caption"]').inputValue(),'تعليق محفوظ');assert.deepEqual(errors,[]);
 const geometryProof=[];await page.goto('http://127.0.0.1:48198/geometry');
 for(const width of [375,390,430,1440]){await page.setViewportSize({width,height:932});
 const result=await page.evaluate(()=>{const measure=(name,selector)=>{const root=document.querySelector(`[data-geometry="${name}"]`),base=root.getBoundingClientRect();return [...root.querySelectorAll(selector)].map(e=>{const r=e.getBoundingClientRect();return {x:r.x-base.x,y:r.y-base.y,width:r.width,height:r.height}})};return {storyValid:measure('story-valid','.home-story-frame'),storyDeleted:measure('story-deleted-all','.home-story-frame'),contactValid:measure('contact-valid','section'),contactDeleted:measure('contact-deleted','section')};});
 assert.deepEqual(result.storyValid,result.storyDeleted);assert.deepEqual(result.contactValid,result.contactDeleted);assert(result.storyDeleted.every(r=>r.width>0&&r.height>0));assert.equal(await page.locator('[data-geometry="story-deleted-all"] img,[data-geometry="contact-deleted"] img').count(),0);geometryProof.push({width,...result});await page.screenshot({path:path.join(out,'slot-geometry-'+width+'.png'),fullPage:true});}
 await writeFile(path.join(out,'geometry-proof.json'),JSON.stringify(geometryProof,null,2));
 await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',original:{width:metadata.width,height:metadata.height},recommendations:['3840 × 2560','2560 × 1920'],galleryCards:3,unknown:true,batched:true,scrollbar,mobile:[375,390,430],errors,scope:'Real components + Next Image; isolated read-only Catalog transport; no DB or Storage mutations'},null,2));
 console.log('PASS Media guidance: real field/gallery DOM, original binary dimensions, per-card placement, batch, unknown, owner change, shared scrollbar and mobile');
 }finally{await browser.close();}
}
