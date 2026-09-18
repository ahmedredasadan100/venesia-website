import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { chromium } from "playwright";
import { browserAtomicReadiness } from "./fixtures/admin-atomic-readiness.mjs";

const output = process.argv[2] ? resolve(process.argv[2]) : null;
if (output) assert.ok(output.includes(`${sep}.tmp-qa${sep}`));
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1365,height:900}});
  await page.setContent('<form id="fixture"><button type="button" id="action">Apply</button><input id="value" name="value" value="old"><input id="hidden" type="hidden" value="kept"><button type="button" id="disabled" disabled>Pending</button><div id="invisible" style="display:none">Hidden</div></form>');
  const snapshot = criteria => page.evaluate(browserAtomicReadiness, {operation:"snapshot",criteria});
  const pass = await snapshot([
    {target:{css:"#action"},visible:true,enabled:true,count:1},
    {target:{css:"#value"},value:"old",nonEmpty:true},
    {target:{css:"#hidden"},visible:false,value:"kept"},
    {target:{css:"#disabled"},enabled:false},
    {target:{css:"#invisible"},visible:false},
    {target:{css:"#missing"},visible:false,count:0},
  ]);
  assert.deepEqual(pass.failures,[]);
  const fail = await snapshot([
    {target:{css:"#missing"},visible:true},
    {target:{css:"input"},value:"old"},
    {target:{css:"#disabled"},enabled:true},
    {target:{css:"#value"},value:"wrong"},
    {target:{css:"#invisible"},visible:true},
  ]);
  assert.deepEqual(fail.failures.map(item=>item.condition),["strict-cardinality","strict-cardinality","enabled","value","visible"]);
  await page.evaluate(()=>{
    const form=document.querySelector("form");
    // A pre-existing feedback event cannot settle the next Save.
    form.dispatchEvent(new CustomEvent("admin-form-saved",{detail:{entityId:7,savedRevision:"old"}}));
    document.querySelector("#action").onclick=()=>{
      form.dispatchEvent(new CustomEvent("admin-form-saved",{detail:{entityId:8,savedRevision:"wrong-identity"}}));
      requestAnimationFrame(()=>{
        document.querySelector("#value").value="new";
        requestAnimationFrame(()=>{
          window.__qaCorrectCommitAt=performance.timeOrigin+performance.now();
          form.dispatchEvent(new CustomEvent("admin-form-saved",{detail:{entityId:7,savedRevision:"new"}}));
        });
      });
    };
  });
  await page.evaluate(browserAtomicReadiness,{operation:"arm",id:"saved",eventType:"click",criteria:[{target:{css:"#value"},value:"new",enabled:true}],requireFormSaved:{entityId:"7"}});
  await page.click("#action");
  const saved=await page.evaluate(browserAtomicReadiness,{operation:"result",id:"saved"});
  const committedAt=await page.evaluate(()=>window.__qaCorrectCommitAt);
  assert.deepEqual(saved.failures,[]); assert.equal(saved.formSaved.savedRevision,"new");
  assert.ok(saved.actionAt < committedAt && saved.firstReadyAt >= committedAt && saved.confirmedAt >= saved.firstReadyAt);
  // A single ready frame followed by the deadline must fail, never return an
  // empty failure list without a confirmed endpoint. Control the scheduler only
  // in this synthetic document, after the trusted click passed actionability.
  await page.evaluate(()=>{
    document.querySelector("#action").onclick=null;
    const originalTimer=window.setTimeout, originalFrame=window.requestAnimationFrame;
    window.__qaFrames=[];
    window.setTimeout=(callback,delay,...args)=>{
      if(delay===45_000){window.__qaDeadline=callback;return 0;}
      return originalTimer(callback,delay,...args);
    };
    window.addEventListener("click",()=>{window.requestAnimationFrame=callback=>{window.__qaFrames.push(callback);return 0;};},{capture:true,once:true});
    window.__qaRestoreScheduler=()=>{window.setTimeout=originalTimer;window.requestAnimationFrame=originalFrame;};
  });
  await page.evaluate(browserAtomicReadiness,{operation:"arm",id:"partial",eventType:"click",criteria:[{target:{css:"#value"},value:"new"}]});
  await page.click("#action");
  await page.evaluate(()=>{window.__qaFrames.shift()();window.__qaDeadline();window.__qaRestoreScheduler();});
  const expired=await page.evaluate(browserAtomicReadiness,{operation:"result",id:"partial"});
  assert.equal(expired.firstReadyAt,undefined);assert.ok(expired.failures.some(item=>item.condition==="readiness-deadline"));
  // Calibrate the former per-locator protocol cost separately from renderer work.
  await page.setContent(`<form>${Array.from({length:465},(_,index)=>`<input name="field-${index}" value="${index}">`).join("")}</form>`);
  const criteria=Array.from({length:465},(_,index)=>({target:{css:`[name="field-${index}"]`},value:String(index),enabled:true}));
  const overhead=[];
  for(let sample=0;sample<10;sample++) {
    const start=performance.now(), observation=await snapshot(criteria);
    assert.deepEqual(observation.failures,[]);
    overhead.push({sample,rendererMs:observation.inspectionMs,protocolAndRendererMs:performance.now()-start});
  }
  const lookupStart=performance.now(),handles=[];
  for(const item of criteria) handles.push(...await page.locator(item.target.css).elementHandles());
  const legacyLookupMs=performance.now()-lookupStart;
  await Promise.all(handles.map(handle=>handle.dispose()));
  const sourceHashes=Object.fromEntries(["scripts/fixtures/admin-atomic-readiness.mjs","scripts/qa-admin-production-interactions.mjs","scripts/fixtures/admin-interaction-server-trace.cjs"].map(file=>[file,createHash("sha256").update(readFileSync(file)).digest("hex")]));
  const result={status:"pass",semanticAssertions:14,fixtureControls:465,saved,expired,overhead,legacyLookupMs,sourceHashes,latencyThreshold:false,productionAccess:false};
  if(output)writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify(result));
} finally {await browser.close();}
