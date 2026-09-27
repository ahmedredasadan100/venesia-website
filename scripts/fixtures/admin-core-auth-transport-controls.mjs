import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{createRequire}from'node:module';import{createServer}from'node:http';import{chromium,expect}from'playwright/test';import{registerCorePageRoute}from'./admin-core-form-permission-context.mjs';import{coreAuthEntryBrowserOptions}from'./admin-core-auth-entry-journeys.mjs';

/** Actual Maintenance form/PWA owners with local HTTP ports, no real credential
 * or Auth service. The native application proof remains a separate gate. */
export async function verifyCoreMaintenanceTransportControl(){
 const root=process.cwd(),out=resolve('.tmp-qa/core-maintenance-transport-contract');mkdirSync(out,{recursive:true});const require=createRequire(import.meta.url);
 const entry=out+'/entry.tsx';writeFileSync(entry,"import React from'react';import{createRoot}from'react-dom/client';import MaintenanceLoginForm from'@src/app/maintenance/MaintenanceLoginForm';import MaintenanceInstallTeaser from'@src/app/maintenance/MaintenanceInstallTeaser';createRoot(document.getElementById('root')).render(<><MaintenanceLoginForm/><MaintenanceInstallTeaser/></>);");
 writeFileSync(out+'/navigation.js',"export const useSearchParams=()=>new URLSearchParams(location.search);");
 await require('next/dist/build/swc').loadBindings();const webpack=require('next/dist/compiled/webpack/webpack').webpack,compiler=webpack({mode:'development',target:'web',context:root,entry,output:{path:out,filename:'fixture.js'},devtool:false,plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development'),'process.env.NEXT_PUBLIC_SITE_URL':JSON.stringify('http://127.0.0.1')})],resolve:{extensions:['.tsx','.ts','.jsx','.js'],alias:{'@src':resolve('src'),'next/navigation':out+'/navigation.js'}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:[{loader:require.resolve('next/dist/build/webpack/loaders/next-swc-loader'),options:{rootDir:root,isServer:false,compilerType:'client',hasReactRefresh:false,nextConfig:{},jsConfig:{},swcCacheDir:out+'/swc',serverComponents:false,serverReferenceHashSalt:'maintenance-transport-controls',esm:false,transpilePackages:[]}}]}]}});
 await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(closeError=>error||closeError||stats?.hasErrors()?reject(error??closeError??new Error(JSON.stringify(stats.toJson({all:false,errors:true}).errors))):resolve())));
 const bundle=readFileSync(out+'/fixture.js'),worker=readFileSync('public/sw.js');let delivered=0;const cases=[];
 const server=createServer((req,res)=>{if(req.url==='/api/maintenance/login'){assert.equal(req.method,'POST');delivered++;res.writeHead(401,{'content-type':'application/json'}).end(JSON.stringify({error:'بيانات الدخول غير صحيحة.'}));return;}res.setHeader('content-type',req.url==='/fixture.js'||req.url==='/sw.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle:req.url==='/sw.js'?worker:'<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,endpoint=origin+'/api/maintenance/login';let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const mode of ['allow','block']){
   const context=await browser.newContext(mode==='allow'?{}:coreAuthEntryBrowserOptions('maintenance-login'));let unexpected=0,serviceWorkerPosts=0;
   await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();unexpected++;return route.abort();});context.on('request',request=>{if(request.url()===endpoint&&request.serviceWorker())serviceWorkerPosts++;});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(5000);let remove;
   try{
    await page.goto(origin+'/maintenance');
    await page.locator('input[name="username"]').fill('controlled-owned-user');await page.locator('input[name="password"]').fill('controlled-not-a-real-secret');
    if(mode==='allow')await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,{},{timeout:10000});
    else{assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===null),true);assert.equal(context.serviceWorkers().length,0);}
    let denied=0;remove=await registerCorePageRoute(page,'**/*',async route=>{if(route.request().url()===endpoint&&route.request().method()==='POST'){denied++;await route.abort('failed');}else await route.fallback();});const before=delivered;
    if(mode==='allow'){
     const response=page.waitForResponse(value=>value.url()===endpoint&&value.request().method()==='POST');await page.locator('button[type="submit"]').click();const actual=await response;assert.equal(actual.fromServiceWorker(),true);await expect(page.getByText('بيانات الدخول غير صحيحة.',{exact:true})).toBeVisible();assert.equal(denied,0);assert.equal(delivered,before+1);assert.equal(serviceWorkerPosts,1);assert.equal(await page.getByText('تعذر الاتصال بالخادم.',{exact:true}).count(),0);cases.push('Before: actual network-only SW owns request and bypasses page-scoped abort; obsolete transport assertion fails');
    }else{
     const failed=page.waitForEvent('requestfailed',{predicate:request=>request.url()===endpoint&&request.method()==='POST',timeout:5000});failed.catch(()=>{});await page.locator('button[type="submit"]').click();const actual=await failed;assert.equal(actual.serviceWorker(),null);await expect(page.getByText('تعذر الاتصال بالخادم.',{exact:true})).toBeVisible();await expect(page.locator('button[type="submit"]')).toBeEnabled();assert.equal(denied,1);assert.equal(delivered,before);assert.equal(serviceWorkerPosts,0);assert.equal(await page.locator('input[name="password"]').evaluate(node=>node.value==='controlled-not-a-real-secret'),true);cases.push('After: SW-blocked isolated maintenance context proves one actual aborted request, exact error, retained draft and zero server delivery');
    }
    assert.equal(unexpected,0);assert.deepEqual(errors,[]);await remove();remove=null;
   }finally{if(remove)await remove();await context.close();}
  }
  return{status:'pass',controls:cases.length,cases,actualMountedMaintenanceForm:true,actualNetworkOnlyServiceWorker:true,actualPageRouteOwner:true,actualAuthServer:false,realCredentialsUsed:false,automaticCoverage:[],globalClosed:false};
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
