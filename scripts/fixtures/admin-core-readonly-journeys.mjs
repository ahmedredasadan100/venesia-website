import assert from "node:assert/strict";
import { request, expect } from "playwright/test";

export async function runCoreReadonlyJourneys(ctx) {
  const {page,context,origin,fixtures,run,observe,readOnlyReadback}=ctx;
  assert.equal(new URL(origin).hostname,"127.0.0.1");assert.ok(Array.isArray(readOnlyReadback));
  assert.ok(fixtures.readonlyClosure?.id&&fixtures.topic?.title);
  const plan=[
    {entity:"activity_log",path:"/admin/activity-log",placeholder:"بحث في المستخدم أو الكيان...",label:fixtures.topic.title,fields:["id","actor_admin_user_id","action","entity_type","entity_id","entity_label"]},
    {entity:"topics_without_image",path:"/admin/reports/topics-without-image",placeholder:"بحث بالعنوان أو slug",label:fixtures.readonlyClosure.title,fields:["id","title","slug","status","contentType"]},
  ];
  for(const spec of plan)await run("core-readonly-"+spec.entity+"-query-failure-retry-auth",[],async()=>{
    const endpoint="/api/admin/entity-lists/"+spec.entity,missing="qa-core-absent-"+spec.entity+"-"+Date.now();
    await observe("readonly-open",()=>page.goto(origin+spec.path,{waitUntil:"domcontentloaded"}));
    const search=page.getByPlaceholder(spec.placeholder,{exact:true});await expect(search).toBeVisible();
    const matches=(response,q)=>{const url=new URL(response.url());return url.origin===origin&&url.pathname===endpoint&&url.searchParams.get("q")===q&&response.request().method()==="GET";};
    const positive=page.waitForResponse(response=>matches(response,spec.label));await search.fill(spec.label);const response=await positive;
    assert.equal(response.status(),200);assert.match(response.headers()["cache-control"],/private.*no-store/);assert.equal(response.headers()["x-admin-entity-list"],spec.entity);
    const payload=await response.json();assert.ok(payload.rows.length>0);assert.ok(payload.pagination.totalRows>=payload.rows.length);
    if(spec.entity==="topics_without_image")assert.deepEqual(payload.rows.map(row=>row.id),[fixtures.readonlyClosure.id]);
    await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    const rows=payload.rows.map(row=>Object.fromEntries(spec.fields.map(field=>[field,row[field]])));
    let denied=0;const fail=async route=>{const url=new URL(route.request().url());if(url.origin===origin&&url.pathname===endpoint&&url.searchParams.get("q")===missing){denied++;await route.abort("failed");}else await route.fallback();};
    await page.route("**/*",fail);
    try{
      await search.fill(missing);const error=page.locator("[data-admin-entity-list-query-error]");await expect(error).toBeVisible({timeout:60000});
      assert.ok(denied>0&&denied<=3,"Current shared query owner permits the first attempt plus two retries.");
      await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();await expect(error).toContainText("النتائج السابقة");
    }finally{await page.unroute("**/*",fail);}
    const retried=page.waitForResponse(value=>matches(value,missing));await page.locator("[data-admin-entity-list-query-error]").getByRole("button",{name:"إعادة المحاولة",exact:true}).click();
    const retry=await retried;assert.equal(retry.status(),200);const empty=await retry.json();assert.equal(empty.pagination.totalRows,0);assert.deepEqual(empty.rows,[]);
    await expect(page.locator("[data-admin-entity-list-query-error]")).toHaveCount(0);await expect(page.getByRole("row").filter({hasText:spec.label})).toHaveCount(0);
    const invalid=await context.request.get(origin+endpoint+"?page=0",{maxRedirects:0});assert.equal(invalid.status(),400);assert.equal((await invalid.json()).error.code,"invalid_query");
    const anonymous=await request.newContext({baseURL:origin});try{const deniedRead=await anonymous.get(endpoint,{maxRedirects:0});assert.equal(deniedRead.status(),401);assert.deepEqual(await deniedRead.json(),{error:"Unauthorized"});}finally{await anonymous.dispose();}
    await search.fill(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    await observe("readonly-reload",()=>page.reload({waitUntil:"domcontentloaded"}));await expect(search).toHaveValue(spec.label);await expect(page.getByRole("row").filter({hasText:spec.label}).first()).toBeVisible();
    readOnlyReadback.push({entity:spec.entity,rows});
    return {entity:spec.entity,authenticatedProjectionRows:rows.length,transportFailures:denied,previousRowsPreserved:true,explicitRetrySucceeded:true,invalidQueryRejected:true,anonymousApiRejected:true,reloaded:true,nativeReadbackRequired:true,mutatingCommands:"not-applicable-registered-read-owner"};
  });
}
