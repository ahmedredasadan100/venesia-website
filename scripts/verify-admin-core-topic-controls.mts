import assert from "node:assert/strict";
import { resolveTopicControlOptionIndex } from "./fixtures/admin-core-topic-controls-journeys.mjs";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { buildCoreTopicControlsPlan, TOPIC_CONTROL_ASSET_KEYS, TOPIC_CONTROL_KINDS, TOPIC_CONTROL_PHASES, TOPIC_CONTROL_VALUES as v, expectedTopicControlPayload, validateTopicControlsRequest, assertTopicControlsProjection } from "./fixtures/admin-core-topic-controls-contract.mjs";
const root=resolve(import.meta.dirname,".."),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root,"src/lib/admin/form-system/adoption-manifest.ts"));
const media=await jiti.import<typeof import("../src/app/admin/content/topics/media-actions/helpers.ts")>(resolve(root,"src/app/admin/content/topics/media-actions/helpers.ts"));
const article=await jiti.import<typeof import("../src/app/admin/content/topics/article-actions/helpers.ts")>(resolve(root,"src/app/admin/content/topics/article-actions/helpers.ts"));
const payload=await jiti.import<typeof import("../src/lib/admin/media-topic-payload.ts")>(resolve(root,"src/lib/admin/media-topic-payload.ts"));
const dates=await jiti.import<typeof import("../src/lib/content-dates.ts")>(resolve(root,"src/lib/content-dates.ts"));
const review=await jiti.import<typeof import("../src/lib/admin/content-workflow/content-review-capability.ts")>(resolve(root,"src/lib/admin/content-workflow/content-review-capability.ts"));
const fixtures={topics:TOPIC_CONTROL_KINDS.map((kind,index)=>({kind,id:index+100,slug:"qa-core-topic-controls-"+kind,editPath:"/admin/content/topics/"+(index+100)})),assets:TOPIC_CONTROL_ASSET_KEYS.map((objectKey,index)=>({id:String(index+1),objectKey,publicUrl:"/"+objectKey})),category:{id:41,name:"التصنيف الأول",slug:"qa-category"},otherCategory:{id:42,name:"التصنيف الثاني",slug:"qa-other"},series:{id:51,name:"سلسلة الفحص",slug:"qa-series"}};
const cases:string[]=[],test=(name:string,callback:()=>unknown)=>{callback();cases.push(name);};
test("Derive all six current Topic surfaces, no axis/global promotion",()=>{const plan=buildCoreTopicControlsPlan({manifest,fixtures});assert.equal(plan.recipes.length,TOPIC_CONTROL_KINDS.length);assert.ok(plan.recipes.every((row:{coverage:unknown[]})=>row.coverage.length===0));assert.equal(plan.globalClosed,false);assert.deepEqual(plan.automaticAxisCoverage,[]);});
for(const consumer of ["topic-article-create-edit","topic-media-create-edit"])test("Missing manifest consumer rejects: "+consumer,()=>assert.throws(()=>buildCoreTopicControlsPlan({manifest:manifest.filter(row=>row.id!==consumer),fixtures})));
for(const change of [{topics:fixtures.topics.slice(1)},{topics:[...fixtures.topics,fixtures.topics[0]]},{assets:fixtures.assets.map((row,index)=>index?row:{...row,publicUrl:"https://foreign.invalid/x"})},{topics:fixtures.topics.map((row,index)=>index?row:{...row,slug:"unowned"})}])test("Incomplete/unowned fixture rejects "+cases.length,()=>assert.throws(()=>buildCoreTopicControlsPlan({manifest,fixtures:{...fixtures,...change}})));
const request={id:randomUUID(),kind:"topic-controls-state",recipe:"article",phase:"baseline"};
test("Fixed finite checkpoints accepted",()=>{for(const recipe of TOPIC_CONTROL_KINDS)for(const phase of TOPIC_CONTROL_PHASES)validateTopicControlsRequest({...request,recipe,phase});});
for(const delta of [{sql:"select 1"},{expected:{}},{table:"topics"},{id:"unowned"},{kind:"other"},{recipe:"__proto__"},{recipe:"constructor"},{phase:"skip-to-final"}])test("Untrusted checkpoint rejects "+JSON.stringify(delta),()=>assert.throws(()=>validateTopicControlsRequest({...request,...delta})));
const original={id:101,slug:"qa-core-topic-controls",title:"عنوان محتوى صالح",excerpt:"مقتطف صالح لاختبار بيانات الحفظ المتخصصة الحالية.",content:"الأصل",created_at:"2026-01-01T00:00:00Z",created_by:8,published_by:null,view_count:0,deleted_at:null,date_label:null,faq:[],media_payload:null};
const forms=(kind:string)=>{
 const form=new FormData();const scalar={title:original.title,slug:original.slug,excerpt:original.excerpt,content:v.markdown,image:fixtures.assets[1].publicUrl,image_alt:v.imageAlt,content_type:kind,category_id:String(fixtures.category.id),series_id:String(fixtures.series.id),status:"unpublished",is_featured:"on",is_popular:"on",date_label:"",published_at:"",media_project:["news","site_update"].includes(kind)?v.mediaProject:"",seo_title:"",seo_description:"",focus_keyword:"",canonical_url:"",og_image:"",og_image_alt:"",video_url:v.videoUrl,video_duration:v.duration,video_thumbnail:fixtures.assets[2].publicUrl,faq_editor_present:"true",show_faq_on_page:"on"};
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
 for(const[key,value]of Object.entries({image:"/images/stale.jpg",series_id:999,is_featured:false,show_intro_card_on_page:true,status:"published",updated_by:999}))test("Native guard rejects "+kind+" corruption "+key,()=>assert.throws(()=>assertTopicControlsProjection(kind,{...saved,[key]:value},original,fixtures,8)));
}
test("Current Gallery parser preserves duplicate row identity/order rather than inventing dedup",()=>{const form=new FormData();for(const alt of ["واحد","اثنان"]){form.append("gallery_image_url",fixtures.assets[0].publicUrl);form.append("gallery_image_alt",alt);form.append("gallery_image_caption",alt);}assert.deepEqual(payload.parseGalleryPayloadFromForm(form).images.map(row=>row.alt),["واحد","اثنان"]);});
test("Unpublished date never manufactures publication timestamp",()=>assert.equal(dates.resolveTopicPublishedAt({formPublishedDate:"2026-01-12",currentPublishedAt:null,status:"unpublished",nowIso:"2026-01-02T00:00:00Z"}),null));
test("Existing published date is immutable under later field input",()=>assert.equal(dates.resolveTopicPublishedAt({formPublishedDate:"2026-01-12",currentPublishedAt:"2026-01-01T12:00:00Z",status:"published",nowIso:"2026-01-02T00:00:00Z"}),"2026-01-01T12:00:00Z"));
const reviewInput={title:original.title,slug:original.slug,excerpt:original.excerpt,content:v.markdown,image:fixtures.assets[1].publicUrl,imageAlt:v.imageAlt,categorySlug:fixtures.category.slug,seoTitle:"",seoDescription:"",focusKeyword:"",canonicalUrl:"",ogImage:"",ogImageAlt:""};
test("Actual published Video invalid-provider rule gives exact video_url issue",()=>{const input={...reviewInput,contentType:"video" as const,mediaPayload:{kind:"video" as const,provider:"youtube" as const,video_url:"https://example.invalid/not-youtube"}};assert.ok(review.getContentPublishBlockingChecks(input).some(row=>row.field==="video_url"));assert.equal(review.getContentDraftBlockingChecks(input).some(row=>row.field==="video_url"),false);});
test("Actual published Gallery missing alt gives exact gallery_image_alt issue",()=>{const input={...reviewInput,contentType:"gallery" as const,mediaPayload:{kind:"gallery" as const,images:[{url:fixtures.assets[0].publicUrl,alt:""}]}};assert.ok(review.getContentPublishBlockingChecks(input).some(row=>row.field==="gallery_image_alt"));assert.equal(review.getContentDraftBlockingChecks(input).some(row=>row.field==="gallery_image_alt"),false);});
test("Video duration retains actual free-text contract",()=>{const form=forms("video");form.set("video_duration","custom-duration");assert.equal(payload.parseVideoPayloadFromForm(form).duration,"custom-duration");});
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
 const selected=/const pending = form\(\)\.locator\("\[([^\]]+)\]"\)/u.exec(candidate);assert.ok(selected);assert.ok(runtimeElements.some(row=>row.tag==="fieldset"&&row.attributes.has(selected[1])),"Topic pending selector must resolve inside actual AdminFormRuntimeInstance.");assert.match(candidate,/expect\(form\(\)\)\.toHaveAttribute\("aria-busy", "true"\)/u);assert.match(candidate,/expect\(pending\)\.toBeDisabled\(\)/u);assert.doesNotMatch(candidate,/expect\(pending\)\.toHaveAttribute\("inert"/u);
}
test("Topic pending selector adopts the actual current owner",()=>assertTopicPendingOwner(source));
test("Regression: substituting specialized wrapper or an invented inert requirement fails",()=>{assert.throws(()=>assertTopicPendingOwner(source.replace('[data-admin-form-fields]','[data-admin-form-pending-fields]')));assert.throws(()=>assertTopicPendingOwner(source.replace('await expect(pending).toBeDisabled();','await expect(pending).toHaveAttribute("inert", "");')));});


const option=(value:string,disabled=false)=>({id:"qa-series-option-"+value,disabled});
test("Actual selectable empty Series option contributes to Home/ArrowDown indexing",()=>assert.deepEqual(resolveTopicControlOptionIndex("qa-series-listbox",[option(""),option("51")],"51"),{index:1,target:"qa-series-option-51",first:"qa-series-option-"}));
test("Category without a rendered selectable placeholder starts directly at its first real option",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option("41"),option("42")],"41").index,0));
test("Disabled options never consume a keyboard selection step",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option("",true),option("40",true),option("41"),option("42")],"42").index,1));
test("Explicit empty selection remains a real rendered choice",()=>assert.equal(resolveTopicControlOptionIndex("qa-series-listbox",[option(""),option("51")],"").index,0));
for(const [label,options,value]of[["missing",[option("51")],"52"],["disabled",[option("51",true)],"51"],["duplicate",[option("51"),option("51")],"51"],["foreign-menu",[{id:"other-option-51",disabled:false}],"51"],["no-options",[],"51"]] as const)test("Rendered listbox control rejects "+label,()=>assert.throws(()=>resolveTopicControlOptionIndex("qa-series-listbox",options,value)));
test("Regression empty-value filtering reproduces wrong index and fails intended active-descendant contract",()=>{const rendered=[option(""),option("51")],oldIndex=rendered.filter(row=>!row.id.endsWith("option-")).findIndex(row=>row.id.endsWith("51"));assert.notEqual(rendered[oldIndex].id,resolveTopicControlOptionIndex("qa-series-listbox",rendered,"51").target);});

console.log(JSON.stringify({status:"pass",controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));
