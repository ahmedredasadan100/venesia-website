import assert from "node:assert/strict";
import { resolveTopicControlOptionIndex } from "./fixtures/admin-core-topic-controls-journeys.mjs";
import ts from "typescript";
import { createRequire } from "node:module";
const pg = createRequire(import.meta.url)("pg") as { types: { getTypeParser(oid: 20, format: "text"): (value: string) => string } };
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { PGlite } from "@electric-sql/pglite";
import { buildCoreTopicControlsPlan, coreTopicControlFixtureSlug, TOPIC_CONTROL_ASSET_KEYS, TOPIC_CONTROL_KINDS, TOPIC_CONTROL_PHASES, TOPIC_CONTROL_VALUES as v, expectedTopicControlPayload, validateTopicControlsRequest, assertTopicControlsProjection } from "./fixtures/admin-core-topic-controls-contract.mjs";
const root=resolve(import.meta.dirname,".."),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root,"src/lib/admin/form-system/adoption-manifest.ts"));
const media=await jiti.import<typeof import("../src/app/admin/content/topics/media-actions/helpers.ts")>(resolve(root,"src/app/admin/content/topics/media-actions/helpers.ts"));
const article=await jiti.import<typeof import("../src/app/admin/content/topics/article-actions/helpers.ts")>(resolve(root,"src/app/admin/content/topics/article-actions/helpers.ts"));
const payload=await jiti.import<typeof import("../src/lib/admin/media-topic-payload.ts")>(resolve(root,"src/lib/admin/media-topic-payload.ts"));
const dates=await jiti.import<typeof import("../src/lib/content-dates.ts")>(resolve(root,"src/lib/content-dates.ts"));
const review=await jiti.import<typeof import("../src/lib/admin/content-workflow/content-review-capability.ts")>(resolve(root,"src/lib/admin/content-workflow/content-review-capability.ts"));
const fixtures={topics:TOPIC_CONTROL_KINDS.map((kind,index)=>({kind,id:index+100,slug:coreTopicControlFixtureSlug(kind),editPath:"/admin/content/topics/"+(index+100)})),assets:TOPIC_CONTROL_ASSET_KEYS.map((objectKey,index)=>({id:String(index+1),objectKey,publicUrl:"/"+objectKey})),category:{id:41,name:"التصنيف الأول",slug:"qa-category"},otherCategory:{id:42,name:"التصنيف الثاني",slug:"qa-other"},series:{id:51,name:"سلسلة الفحص",slug:"qa-series"}};
const cases:string[]=[],test=(name:string,callback:()=>unknown)=>{callback();cases.push(name);};
test("Derive all six current Topic surfaces, no axis/global promotion",()=>{const plan=buildCoreTopicControlsPlan({manifest,fixtures});assert.equal(plan.recipes.length,TOPIC_CONTROL_KINDS.length);assert.ok(plan.recipes.every((row:{coverage:unknown[]})=>row.coverage.length===0));assert.equal(plan.globalClosed,false);assert.deepEqual(plan.automaticAxisCoverage,[]);});
for(const consumer of ["topic-article-create-edit","topic-media-create-edit"])test("Missing manifest consumer rejects: "+consumer,()=>assert.throws(()=>buildCoreTopicControlsPlan({manifest:manifest.filter(row=>row.id!==consumer),fixtures})));
for(const change of [{topics:fixtures.topics.slice(1)},{topics:[...fixtures.topics,fixtures.topics[0]]},{assets:fixtures.assets.map((row,index)=>index?row:{...row,publicUrl:"https://foreign.invalid/x"})},{topics:fixtures.topics.map((row,index)=>index?row:{...row,slug:"unowned"})}])test("Incomplete/unowned fixture rejects "+cases.length,()=>assert.throws(()=>buildCoreTopicControlsPlan({manifest,fixtures:{...fixtures,...change}})));
const request={id:randomUUID(),kind:"topic-controls-state",recipe:"article",phase:"baseline"};
test("Fixed finite checkpoints accepted",()=>{for(const recipe of TOPIC_CONTROL_KINDS)for(const phase of TOPIC_CONTROL_PHASES)validateTopicControlsRequest({...request,recipe,phase});});
for(const delta of [{sql:"select 1"},{expected:{}},{table:"topics"},{id:"unowned"},{kind:"other"},{recipe:"__proto__"},{recipe:"constructor"},{phase:"skip-to-final"}])test("Untrusted checkpoint rejects "+JSON.stringify(delta),()=>assert.throws(()=>validateTopicControlsRequest({...request,...delta})));
const original={id:101,slug:"qa-core-topic-controls",title:"عنوان محتوى صالح",excerpt:"مقتطف صالح لاختبار بيانات الحفظ المتخصصة الحالية.",content:"الأصل",created_at:"2026-01-01T00:00:00Z",created_by:8,published_by:null,view_count:0,deleted_at:null,date_label:null,faq:[],media_payload:null};
const forms=(kind:string)=>{
 const form=new FormData();const scalar={title:original.title,slug:original.slug,excerpt:original.excerpt,content:v.markdown,image:fixtures.assets[1].publicUrl,image_alt:v.imageAlt,content_type:kind,category_id:String(fixtures.category.id),series_id:String(fixtures.series.id),status:"unpublished",is_featured:"on",is_popular:"on",date_label:"",published_at:"",media_project:["news","site_update"].includes(kind)?v.mediaProject:"",seo_title:"",seo_description:"",focus_keyword:"",canonical_url:"",og_image:"",og_image_alt:"",video_url:v.videoUrl,video_duration:v.duration??"",video_thumbnail:fixtures.assets[2].publicUrl,faq_editor_present:"true",show_faq_on_page:"on"};
 for(const[key,value]of Object.entries(scalar))form.append(key,value);
 for(const[key,value]of Object.entries(v.display))if(value)form.append(key,"on");
 if(kind==="article")for(const item of [v.faq[1],v.faq[0]]){form.append("faq_question",item.question);form.append("faq_answer",item.answer);}
 if(kind==="gallery")for(const item of expectedTopicControlPayload(kind,fixtures)!.images!){form.append("gallery_image_url",item.url);form.append("gallery_image_alt",item.alt);form.append("gallery_image_caption",item.caption);}
 return form;
};
for(const kind of TOPIC_CONTROL_KINDS){
 const f=forms(kind);let saved:Record<string,unknown>;
 if(kind==="article")saved={...original,...article.buildTopicWritePayload(article.getPayload(f),fixtures.category as Parameters<typeof article.buildTopicWritePayload>[1],fixtures.series as Parameters<typeof article.buildTopicWritePayload>[2],"unpublished","2026-01-02T00:00:00Z",original as unknown as Parameters<typeof article.buildTopicWritePayload>[5]),updated_by:8};
 else {const p=payload.parseMediaPayloadFromForm(kind,f),canonical=p?.kind==="video"?payload.normalizeVideoPayloadForStorage(p):p;saved={...original,...media.buildMediaWritePayload(media.getPayload(f),fixtures.category,kind as Parameters<typeof media.buildMediaWritePayload>[2],canonical,"2026-01-02T00:00:00Z",original as unknown as Parameters<typeof media.buildMediaWritePayload>[5],fixtures.series),updated_by:8};}
 test("Real canonical write builder matches authored control projection: "+kind,()=>assertTopicControlsProjection(kind,saved,original,fixtures,8));
 test("Native PostgreSQL bigint identities retain the exact intended Topic links: "+kind,()=>{
   const parse=pg.types.getTypeParser(20,"text"),categoryId=parse(String(fixtures.category.id)),seriesId=parse(String(fixtures.series.id));
   assert.equal(categoryId,String(fixtures.category.id));assert.equal(seriesId,String(fixtures.series.id));
   assertTopicControlsProjection(kind,{...saved,category_id:categoryId,series_id:seriesId},original,fixtures,8);
 });
 if(kind==="article")for(const [key,id]of [["category_id",fixtures.category.id],["series_id",fixtures.series.id]] as const){
   for(const value of [null,undefined,true,id+1,String(id+1)," "+id,"0"+id,id+".0",id+"e0",9007199254740992,"9007199254740993"]){
     test("Exact Topic identity rejects "+key+" "+String(value),()=>assert.throws(()=>assertTopicControlsProjection(kind,{...saved,[key]:value},original,fixtures,8)));
   }
 }

 for(const[key,value]of Object.entries({image:"/images/stale.jpg",series_id:999,is_featured:false,show_intro_card_on_page:true,status:"published",updated_by:999}))test("Native guard rejects "+kind+" corruption "+key,()=>assert.throws(()=>assertTopicControlsProjection(kind,{...saved,[key]:value},original,fixtures,8)));
}
test("Current Gallery parser preserves duplicate row identity/order rather than inventing dedup",()=>{const form=new FormData();for(const alt of ["واحد","اثنان"]){form.append("gallery_image_url",fixtures.assets[0].publicUrl);form.append("gallery_image_alt",alt);form.append("gallery_image_caption",alt);}assert.deepEqual(payload.parseGalleryPayloadFromForm(form).images.map(row=>row.alt),["واحد","اثنان"]);});
test("Unpublished date never manufactures publication timestamp",()=>assert.equal(dates.resolveTopicPublishedAt({formPublishedDate:"2026-01-12",currentPublishedAt:null,status:"unpublished",nowIso:"2026-01-02T00:00:00Z"}),null));
test("Existing published date is immutable under later field input",()=>assert.equal(dates.resolveTopicPublishedAt({formPublishedDate:"2026-01-12",currentPublishedAt:"2026-01-01T12:00:00Z",status:"published",nowIso:"2026-01-02T00:00:00Z"}),"2026-01-01T12:00:00Z"));
const reviewInput={title:original.title,slug:original.slug,excerpt:original.excerpt,content:v.markdown,image:fixtures.assets[1].publicUrl,imageAlt:v.imageAlt,categorySlug:fixtures.category.slug,seoTitle:"",seoDescription:"",focusKeyword:"",canonicalUrl:"",ogImage:"",ogImageAlt:""};
test("Actual published Video invalid-provider rule gives exact video_url issue",()=>{const input={...reviewInput,contentType:"video" as const,mediaPayload:{kind:"video" as const,provider:"youtube" as const,video_url:"https://example.invalid/not-youtube"}};assert.ok(review.getContentPublishBlockingChecks(input).some(row=>row.field==="video_url"));assert.equal(review.getContentDraftBlockingChecks(input).some(row=>row.field==="video_url"),false);});
test("Actual published Gallery missing alt gives exact gallery_image_alt issue",()=>{const input={...reviewInput,contentType:"gallery" as const,mediaPayload:{kind:"gallery" as const,images:[{url:fixtures.assets[0].publicUrl,alt:""}]}};assert.ok(review.getContentPublishBlockingChecks(input).some(row=>row.field==="gallery_image_alt"));assert.equal(review.getContentDraftBlockingChecks(input).some(row=>row.field==="gallery_image_alt"),false);});
test("Video duration retains actual free-text contract",()=>{const form=forms("video");form.set("video_duration","custom-duration");const parsed=payload.parseVideoPayloadFromForm(form);assert.ok(parsed);assert.equal(parsed.duration,"custom-duration");});
const source=readFileSync(resolve(root,"scripts/fixtures/admin-core-topic-controls-journeys.mjs"),"utf8");
test("No hidden/forced form writes, arbitrary HTTP client or alternate route owner",()=>{assert.doesNotMatch(source,/page\.(route|unroute|request)|force:\s*true|\.selectOption\(/u);assert.match(source,/nativeFinalityRequired: true/u);assert.match(source,/published_at/u);});

const runtimeSource=readFileSync(resolve(root,"src/components/admin/ui/AdminFormRuntime.tsx"),"utf8");
const runtimeTree=ts.createSourceFile("AdminFormRuntime.tsx",runtimeSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function renderedAttributes(name:string){
 const declarations=runtimeTree.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.equal(declarations.length,1);
 const rows:Array<{tag:string;attributes:Map<string,string>}> = [];
 const visit=(node:ts.Node)=>{if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){const attributes=new Map<string,string>();for(const attr of node.attributes.properties)if(ts.isJsxAttribute(attr))attributes.set(attr.name.getText(runtimeTree),attr.initializer?.getText(runtimeTree)??"");rows.push({tag:node.tagName.getText(runtimeTree),attributes});}ts.forEachChild(node,visit);};visit(declarations[0]);return rows;
}
const runtimeElements=renderedAttributes("AdminFormRuntimeInstance"),specializedElements=renderedAttributes("AdminFormPendingFields");
test("Actual Runtime owns disabled fieldset and form busy; specialized wrapper is not mounted inside Runtime",()=>{
 const form=runtimeElements.filter(row=>row.tag==="form"),fields=runtimeElements.filter(row=>row.tag==="fieldset"&&row.attributes.has("data-admin-form-fields"));assert.equal(form.length,1);assert.equal(fields.length,1);assert.equal(form[0].attributes.get("aria-busy"),"{pending || undefined}");assert.equal(fields[0].attributes.get("disabled"),"{pending}");assert.equal(fields[0].attributes.has("inert"),false);assert.equal(runtimeElements.some(row=>row.attributes.has("data-admin-form-pending-fields")),false);
});
test("Actual specialized wrapper separately owns inert; never infer it for Runtime consumers",()=>{const rows=specializedElements.filter(row=>row.tag==="fieldset"&&row.attributes.has("data-admin-form-pending-fields"));assert.equal(rows.length,1);assert.equal(rows[0].attributes.get("disabled"),"{pending}");assert.equal(rows[0].attributes.get("inert"),"{pending}");});
function assertTopicPendingOwner(candidate:string){
 const selected=/const pending = form\(\)\.locator\("\[([^\]]+)\]"\)/u.exec(candidate);assert.ok(selected);assert.ok(runtimeElements.some(row=>row.tag==="fieldset"&&row.attributes.has(selected[1])),"Topic pending selector must resolve inside actual AdminFormRuntimeInstance.");assert.match(candidate,/expect\(form\(\)\)\.toHaveAttribute\("aria-busy", "true"\)/u);assert.match(candidate,/expect\(pending\)\.toHaveJSProperty\("disabled", true\)/u);assert.doesNotMatch(candidate,/expect\(pending\)\.toHaveAttribute\("inert"/u);
}
test("Topic pending selector adopts the actual current owner",()=>assertTopicPendingOwner(source));
test("Regression: substituting specialized wrapper or an invented inert requirement fails",()=>{assert.throws(()=>assertTopicPendingOwner(source.replace('[data-admin-form-fields]','[data-admin-form-pending-fields]')));assert.throws(()=>assertTopicPendingOwner(source.replace('await expect(pending).toHaveJSProperty("disabled", true);','await expect(pending).toHaveAttribute("inert", "");')));});


const option=(value:string,disabled=false)=>({id:"qa-series-option-"+value,disabled});
test("Actual selectable empty Series option contributes to Home/ArrowDown indexing",()=>assert.deepEqual(resolveTopicControlOptionIndex("qa-series-listbox",[option(""),option("51")],"51"),{index:1,target:"qa-series-option-51",first:"qa-series-option-"}));
test("Category without a rendered selectable placeholder starts directly at its first real option",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option("41"),option("42")],"41").index,0));
test("Disabled options never consume a keyboard selection step",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option("",true),option("40",true),option("41"),option("42")],"42").index,1));
test("Explicit empty selection remains a real rendered choice",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option(""),option("51")],"").index,0));
for(const [label,options,value]of[["missing",[option("51")],"52"],["disabled",[option("51",true)],"51"],["duplicate",[option("51"),option("51")],"51"],["foreign-menu",[{id:"other-option-51",disabled:false}],"51"],["no-options",[],"51"]] as const)test("Rendered listbox control rejects "+label,()=>assert.throws(()=>resolveTopicControlOptionIndex("qa-series-listbox",options,value)));
test("Regression empty-value filtering reproduces wrong index and fails intended active-descendant contract",()=>{const rendered=[option(""),option("51")],oldIndex=rendered.filter(row=>!row.id.endsWith("option-")).findIndex(row=>row.id.endsWith("51"));assert.notEqual(rendered[oldIndex].id,resolveTopicControlOptionIndex("qa-series-listbox",rendered,"51").target);});


// Real native fixture expression must round-trip unchanged through the canonical save parser.
const nativeSeedSource=readFileSync(resolve(root,"scripts/verify-admin-core-topic-controls-isolated.mts"),"utf8"),nativeSeedTree=ts.createSourceFile("native.mts",nativeSeedSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let slugExpression:ts.Expression|undefined;
function findFixtureSlug(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(nativeSeedTree)==="slug")slugExpression=node.initializer;ts.forEachChild(node,findFixtureSlug);}findFixtureSlug(nativeSeedTree);assert.ok(slugExpression);
for(const kind of TOPIC_CONTROL_KINDS)test("Actual native fixture slug round-trips through real save: "+kind,()=>{const actual=new Function("kind","coreTopicControlFixtureSlug","return "+slugExpression!.getText(nativeSeedTree))(kind,coreTopicControlFixtureSlug);const form=forms(kind);form.set("slug",actual);assert.equal((kind==="article"?article:media).getPayload(form).slug,actual);assert.equal(media.validateSlug(actual),true);assert.equal(actual,fixtures.topics.find(row=>row.kind===kind)!.slug);});
test("Old site_update seed is noncanonical and real save changes it",()=>{const form=forms("site_update"),old="qa-core-topic-controls-site_update";form.set("slug",old);assert.equal(media.validateSlug(old),false);assert.equal(media.getPayload(form).slug,"qa-core-topic-controls-site-update");assert.notEqual(media.getPayload(form).slug,old);});
test("Noncanonical site_update identity cannot enter the updated exact plan",()=>assert.throws(()=>buildCoreTopicControlsPlan({manifest,fixtures:{...fixtures,topics:fixtures.topics.map(row=>row.kind==="site_update"?{...row,slug:"qa-core-topic-controls-site_update"}:row)}})));

// This disposable PostgreSQL instance proves the existing JSONB storage contract.
// It deliberately does not claim the complete application/RLS/server-action path.
const videoDb = new PGlite();
try {
 await videoDb.exec("create table video_payload_fixture (id integer generated always as identity primary key, status text not null, media_payload jsonb not null)");
 const providerUrls = {
  youtube:"https://youtu.be/dQw4w9WgXcQ",vimeo:"https://vimeo.com/76979871?h=a1b2c3",
  facebook:"https://www.facebook.com/Venesia/videos/123456789/",tiktok:"https://www.tiktok.com/@venesia/video/1234567890123456789",
  instagram:"https://www.instagram.com/reel/ABC_def-123/",direct:"https://cdn.example.com/video.mp4?token=signed",
 } as const;
 type StoredVideo = {id:number;status:string;media_payload:Parameters<typeof payload.parseMediaTopicPayload>[0]};
 for (const provider of payload.VIDEO_PROVIDERS) {
  const form=forms("video");form.set("video_provider",provider.value);form.set("video_url",providerUrls[provider.value]);form.set("video_duration","legacy-3:45");form.set("video_start_seconds",provider.supportsStartTime?"17":"0");form.set("seo_title","Video provider storage round-trip and playback proof");form.set("seo_description","وصف فيديو ".repeat(14).trim());form.set("focus_keyword","فينيسيا");
  const native=media.getPayload(form),resolved=media.resolveWriteMediaPayload("video",form,native);assert.equal(resolved.ok,true);
  assert.equal(media.getDraftValidationChecks("video",resolved.mediaPayload,native).length,0);
  assert.deepEqual(media.getPublishedValidationChecks("video",resolved.mediaPayload,"published",native),[]);
  const created=media.buildMediaWritePayload(native,fixtures.category,"video",resolved.mediaPayload,"2026-10-23T10:00:00Z",null,fixtures.series);
  const inserted=await videoDb.query<StoredVideo>("insert into video_payload_fixture(status,media_payload) values ($1,$2::jsonb) returning *",[created.status,JSON.stringify(created.media_payload)]);
  const record=inserted.rows[0];assert.ok(record);
  const reloaded=payload.parseMediaTopicPayload(record.media_payload);assert.ok(reloaded?.kind==="video");
  test("Isolated JSONB Create/reload retains canonical provider/start/duration: "+provider.value,()=>{assert.deepEqual(reloaded,created.media_payload);assert.equal(reloaded.duration,"legacy-3:45");assert.equal(reloaded.start_seconds,provider.supportsStartTime?17:undefined);if(provider.value==="vimeo")assert.equal(reloaded.video_url,"https://vimeo.com/76979871/a1b2c3");});
  form.set("video_url",reloaded.video_url);form.set("video_duration",reloaded.duration??"");form.set("video_thumbnail",reloaded.thumbnail??"");form.set("video_start_seconds",String(reloaded.start_seconds??0));
  const editNative=media.getPayload(form),editResolved=media.resolveWriteMediaPayload("video",form,editNative);assert.equal(editResolved.ok,true);
  const edited=media.buildMediaWritePayload(editNative,fixtures.category,"video",editResolved.mediaPayload,"2026-10-23T10:01:00Z",original as unknown as Parameters<typeof media.buildMediaWritePayload>[5],fixtures.series);
  const updated=await videoDb.query<StoredVideo>("update video_payload_fixture set media_payload=$1::jsonb where id=$2 returning *",[JSON.stringify(edited.media_payload),record.id]);
  test("Isolated JSONB Edit preserves legacy duration and timing: "+provider.value,()=>assert.deepEqual(payload.parseMediaTopicPayload(updated.rows[0].media_payload),reloaded));
  const duplicate=await videoDb.query<StoredVideo>("insert into video_payload_fixture(status,media_payload) select 'unpublished',media_payload from video_payload_fixture where id=$1 returning *",[record.id]);
  test("Isolated JSONB Duplicate preserves the complete payload as unpublished: "+provider.value,()=>{assert.equal(duplicate.rows[0].status,"unpublished");assert.notEqual(duplicate.rows[0].id,record.id);assert.deepEqual(payload.parseMediaTopicPayload(duplicate.rows[0].media_payload),reloaded);});
  form.set("video_url","authored incomplete URL");
  const draftNative=media.getPayload(form),draftResolved=media.resolveWriteMediaPayload("video",form,draftNative);assert.equal(draftResolved.ok,true);
  assert.equal(media.getDraftValidationChecks("video",draftResolved.mediaPayload,draftNative).length,0);
  assert.ok(media.getPublishedValidationChecks("video",draftResolved.mediaPayload,"published",draftNative).some(issue=>issue.field==="video_url"));
  const draft=media.buildMediaWritePayload(draftNative,fixtures.category,"video",draftResolved.mediaPayload,"2026-10-23T10:02:00Z",null,fixtures.series);
  const storedDraft=await videoDb.query<StoredVideo>("insert into video_payload_fixture(status,media_payload) values ('unpublished',$1::jsonb) returning *",[JSON.stringify(draft.media_payload)]);
  test("Isolated JSONB incomplete Draft remains correctable and cannot publish: "+provider.value,()=>{const actual=payload.parseMediaTopicPayload(storedDraft.rows[0].media_payload);assert.ok(actual?.kind==="video");assert.equal(actual.video_url,"authored incomplete URL");assert.equal(actual.duration,"legacy-3:45");assert.equal(actual.provider,provider.value);});
  const before=(await videoDb.query<{count:number}>("select count(*)::integer as count from video_payload_fixture")).rows[0].count;
  form.set("video_provider","untrusted-provider");
  const badProvider=media.resolveWriteMediaPayload("video",form,media.getPayload(form));
  test("Unsupported provider fails at the existing write owner before storage: "+provider.value,()=>{assert.equal(badProvider.ok,false);if(!badProvider.ok)assert.equal(badProvider.field,"video_provider");});
  form.set("video_provider",provider.value);form.set("video_start_seconds",provider.supportsStartTime?"1.5":"17");
  const badStart=media.resolveWriteMediaPayload("video",form,media.getPayload(form));
  test("Invalid or unsupported start fails before storage: "+provider.value,()=>{assert.equal(badStart.ok,false);if(!badStart.ok)assert.equal(badStart.field,"video_start_seconds");});
  const after=(await videoDb.query<{count:number}>("select count(*)::integer as count from video_payload_fixture")).rows[0].count;
  assert.equal(after,before,"Rejected native submissions must not issue a storage write");
 }
 const actualDuplicate=readFileSync(resolve(root,"src/app/admin/content/topics/actions.ts"),"utf8");
 test("Actual duplicate owner retains whole media_payload via copyable row",()=>{assert.match(actualDuplicate,/\.\.\.copyable\s*\n\s*\}\s*=\s*topic/u);assert.match(actualDuplicate,/const nextRow = \{\s*\.\.\.copyable,/u);assert.match(actualDuplicate,/status: "unpublished"/u);});
} finally {
 await videoDb.close();
}

console.log(JSON.stringify({status:"pass",controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));
