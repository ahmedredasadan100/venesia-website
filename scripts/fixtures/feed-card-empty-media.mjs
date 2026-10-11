import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

/** Existing Feed verifier executes actual consumers and next/image. Only Link
 * navigation and uncalled server read ports are isolated; no DB or Storage writes. */
export async function verifyFeedCardEmptyMedia(){
  const root=process.cwd(),output=path.join(root,'.tmp-qa/feed-card-empty-media'),require=createRequire(import.meta.url);
  await mkdir(output,{recursive:true});
  const expose={
    'FeaturedCarousel.tsx':['FeaturedEditorialSecondaryCard'],
    'MediaCenterCollectionItems.tsx':['CollectionListItem','CollectionGridItem'],
    'MediaCenterHubFeatured.tsx':['FeaturedPrimaryCard'],
    'MediaCenterHubMosaic.tsx':['MosaicItem'],
    'MediaSidebar.tsx':['SidebarMediaItem'],
    'SearchPlatformModule.tsx':['SearchResultCard'],
  };
  const entry=path.join(root,'scripts/fixtures/feed-card-empty-media-browser.jsx');
  const entrySource=readFileSync(entry,'utf8');
  const covered=new Set([...entrySource.matchAll(/from ['"]\.\.\/\.\.\/(src\/components\/[^'"]+)['"]/gu)].map(m=>m[1]+'.tsx'));
  covered.add('src/components/topics/TopicImage.tsx'); // exercised by the real TopicCard, not replaced
  const sources={};
  for(const directory of ['sidebar-feeds','featured','media-center','search-platform','topics']){
    for(const file of readdirSync(path.join(root,'src/components',directory))){
      if(!file.endsWith('.tsx'))continue;
      const relative='src/components/'+directory+'/'+file,source=readFileSync(path.join(root,relative),'utf8');
      if(!source.includes('from "next/image"')&&!source.includes('from "../public/PublicMediaImage"'))continue;
      // Detail gallery uses the independent public-content-delivery gallery proof.
      if(relative==='src/components/media-center/MediaDetailArticle.tsx')continue;
      assert(covered.has(relative),'New image consumer requires behavior coverage: '+relative);
      sources[relative]=createHash('sha256').update(source).digest('hex');
    }
  }
  const linkPath=path.join(output,'link.jsx'),navigationPath=path.join(output,'navigation.js'),portsPath=path.join(output,'read-ports.js'),loaderPath=path.join(output,'source-loader.cjs');
  await Promise.all([
    writeFile(linkPath,"import React from 'react';export default function Link({href,children,prefetch,scroll,onNavigate,...props}){return <a href={href} {...props}>{children}</a>}"),
    writeFile(navigationPath,"export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(){throw Error('Unexpected navigation')},replace(){throw Error('Unexpected navigation')}});"),
    writeFile(portsPath,"export const loadPublicContentCollection=()=>{throw Error('Unexpected DB read')};export const loadPublicContentFilterOptions=loadPublicContentCollection;export class PublicContentReadError extends Error{};"),
    writeFile(loaderPath,'const path=require("node:path"),expose='+JSON.stringify(expose)+';module.exports=function(source){const names=expose[path.basename(this.resourcePath)];return names?source+"\\nexport {"+names.join(",")+"};":source};'),
  ]);
  const postcss=require('postcss'),tailwind=require('@tailwindcss/postcss');
  const css=(await postcss([tailwind()]).process('@import "tailwindcss" source(none);\n@source "'+path.join(root,'src/components').replaceAll('\\','/')+'";\n',{from:path.join(root,'src/app/globals.css')})).css;
  await require('next/dist/build/swc').loadBindings();
  const webpack=require('next/dist/compiled/webpack/webpack').webpack;
  const compiler=webpack({mode:'development',target:'web',context:root,entry,output:{path:output,filename:'bundle.js'},devtool:false,optimization:{minimize:false},plugins:[new webpack.DefinePlugin({'process.env':JSON.stringify({})}),new webpack.NormalModuleReplacementPlugin(/public-content-read[\\/]owner$/u,portsPath)],resolve:{extensions:['.tsx','.ts','.jsx','.js'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'server-only':false,'next/navigation':navigationPath,'next/link':linkPath}},module:{rules:[{test:/\.[jt]sx?$/u,exclude:/node_modules/u,use:[{loader:require.resolve('next/dist/build/webpack/loaders/next-swc-loader'),options:{rootDir:root,isServer:false,compilerType:'client',hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:path.join(output,'swc-cache'),serverComponents:false,serverReferenceHashSalt:'feed-empty-media-proof',esm:false,transpilePackages:[]}},loaderPath]}]}});
  await new Promise((done,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>{if(error||closeError||stats?.hasErrors())reject(error||closeError||new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors)));else done();})));
  const bundle=await readFile(path.join(output,'bundle.js'));
  const png=require('sharp');const pixel=await png({create:{width:16,height:16,channels:4,background:'#D8B87A'}}).png().toBuffer();
  const requests=[],errors=[],foreign=[];
  const server=createServer((req,res)=>{
    const url=new URL(req.url,'http://fixture');requests.push({method:req.method,path:url.pathname});
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    if(url.pathname==='/bundle.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8'});res.end(bundle);return;}
    if(url.pathname==='/styles.css'){res.writeHead(200,{'content-type':'text/css'});res.end(css);return;}
    if(url.pathname==='/fixture.png'||url.pathname==='/_next/image'){res.writeHead(200,{'content-type':'image/png'});res.end(pixel);return;}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
  const results=[];
  const geometryByWidth=new Map();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('empty string')||m.text().includes('missing required "src"'))errors.push(m.text());});
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){foreign.push(route.request().url());return route.abort();}return route.continue();});
    await page.goto(origin,{waitUntil:'load'});await page.waitForFunction(()=>window.imageFixtureReady);
    for(const width of [1280,390]) {
    await page.setViewportSize({width,height:900});
    for(const spec of [{name:'valid',value:'/fixture.png',allowed:true},{name:'empty',value:'',allowed:true},{name:'null',value:null,allowed:true},{name:'undefined',value:undefined,allowed:true},{name:'whitespace',value:' \t\r\n ',allowed:true},{name:'deleted-public-projection',value:'',allowed:true},{name:'genuinely-absent',value:null,allowed:true},{name:'image-disabled',value:'/fixture.png',allowed:false}]){
      await page.evaluate(({value,allowed})=>window.renderImageCases(value,allowed),spec);
      const cards=await page.locator('[data-image-case]').evaluateAll(es=>es.map(el=>({name:el.getAttribute('data-image-case'),images:[...el.querySelectorAll('img')].map(i=>i.getAttribute('src')),text:el.textContent})));
      const policies=await page.evaluate(()=>window.imageCasePolicies);
      assert.equal(cards.length,policies.length);
      assert(policies.length>0);
      for(const card of cards){const expected=spec.name==='valid'||(spec.name==='image-disabled'&&policies.find(p=>p.name===card.name).policy==='always');assert.equal(card.images.length>0,expected,card.name+'/'+spec.name);assert(card.images.every(Boolean),card.name+' has an empty image element');assert(card.text.trim().length>0,card.name+' must preserve non-image content');}
      if(spec.name==='valid'||spec.name==='image-disabled'){for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await page.waitForFunction(i=>i.complete&&i.naturalWidth>0,await img.elementHandle());}await page.evaluate(()=>scrollTo(0,0));}
      if(spec.name==='valid'){
        const frames=await page.locator('[data-image-case]').evaluateAll(es=>es.filter(e=>!e.dataset.imageCase.startsWith('search-')).flatMap(e=>[...e.querySelectorAll('img')].map(img=>{
          const frame=img.parentElement;let node=frame;const chain=[];
          while(node!==e){chain.unshift(':scope > :nth-child('+([...node.parentElement.children].indexOf(node)+1)+')');node=node.parentElement;}
          const r=frame.getBoundingClientRect();return {name:e.dataset.imageCase,chain,width:r.width,height:r.height};
        })));
        geometryByWidth.set(width,frames);
      } else if(spec.allowed){
        for(const expected of geometryByWidth.get(width)){
          let frame=page.locator('[data-image-case="'+expected.name+'"]');
          for(const selector of expected.chain)frame=frame.locator(selector);
          const box=await frame.boundingBox();assert(box,expected.name+' keeps its requested frame');
          assert(Math.abs(box.width-expected.width)<1,expected.name+'/'+spec.name+' width');
          assert(Math.abs(box.height-expected.height)<1,expected.name+'/'+spec.name+' height');
        }
        assert(!cards.some(c=>c.text.includes('صورة اختبار')),'Absent image alt is not public text');
      }
      if(spec.name==='empty'){
        for(const name of ['search-full-list']){const cls=await page.locator('[data-image-case="'+name+'"]').innerHTML();assert(!cls.includes('grid-cols-[6.5rem_')&&!cls.includes('grid-cols-[7rem_')&&!cls.includes('md:grid-cols-[15rem_')&&!cls.includes('grid-cols-[minmax(0,1fr)_250px]'),name+' must drop the image column');}
        await page.screenshot({path:path.join(output,'reserved-empty-'+width+'.png'),fullPage:true});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Reserved media slots must fit the viewport');
      }
      results.push({width,case:spec.name,consumers:cards.length,imageElements:cards.reduce((n,c)=>n+c.images.length,0),status:'PASS'});
    }
    }
    for(const value of ['/fixture.png','']){
      await page.evaluate(value=>window.renderImageCases(value,true),value);
      const on=await page.locator('[data-image-case="topic-card"] [data-collection-image-slot]').count();assert.equal(on,1);
      await page.getByRole('switch',{name:'Show image'}).click({force:true});
      assert.equal(await page.locator('[data-image-case="topic-card"] [data-collection-image-slot]').count(),0);
      await page.getByRole('switch',{name:'Show image'}).click({force:true});
      assert.equal(await page.locator('[data-image-case="topic-card"] [data-collection-image-slot]').count(),1);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);assert(requests.every(r=>r.method==='GET'));assert.equal(requests.filter(r=>r.path==='/').length,1,'Absent sources must not request the page again');
    const receipt={status:'PASS',sources,results,errors,externalRequests:foreign,productionWrites:0,realNextImage:true,scope:'Actual consumers, actual shared display/media adapters, real next/image, isolated loopback image transport; server read ports throw if invoked. Deleted projection itself is verified by public-content-delivery owner.'};
    await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log('PASS Feed/Card empty media: '+results.length+' cases × '+results[0].consumers+' consumer variants; geometry retained; actual display switch ON/OFF; actual Next Image; zero empty sources/warnings or external requests.');return receipt;
  }finally{await browser.close();await new Promise(done=>server.close(done));}
}
