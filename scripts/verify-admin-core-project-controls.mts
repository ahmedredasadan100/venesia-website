import {createRequire} from "node:module";
const pgTimestamp=createRequire(import.meta.url)("pg").types.getTypeParser(1184,"text") as (value:string)=>Date;
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createJiti} from "jiti";
import {PROJECT_CONTROL_KINDS,PROJECT_CONTROL_PHASES,PROJECT_CONTROL_TABLES,PROJECT_CONTROL_ASSETS,buildCoreProjectControlsPlan,projectControlSlug,validateProjectControlsRequest,expectedProjectControlsProjection,projectGraphProjection,projectPayloadGraph,assertProjectControlGraph} from "./fixtures/admin-core-project-controls-contract.mjs";
const root=resolve(import.meta.dirname,".."),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
const contract=await jiti.import<typeof import("../src/lib/admin/projects/project-entry-contract.ts")>(resolve(root,"src/lib/admin/projects/project-entry-contract.ts"));
const{ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import<typeof import("../src/lib/admin/form-system/adoption-manifest.ts")>(resolve(root,"src/lib/admin/form-system/adoption-manifest.ts"));
const audit=await jiti.import<typeof import("../src/lib/admin/projects/project-publishing-capability.ts")>(resolve(root,"src/lib/admin/projects/project-publishing-capability.ts"));
type Row=Record<string,unknown>;
const cases:string[]=[],test=(name:string,check:()=>unknown)=>{check();cases.push(name);};
const fixtures={projects:PROJECT_CONTROL_KINDS.map((kind,index)=>({kind,id:index+101,slug:projectControlSlug(kind),editPath:"/admin/projects/"+(index+101)})),assets:PROJECT_CONTROL_ASSETS.map((objectKey,index)=>({id:String(index+1),objectKey,publicUrl:"/"+objectKey,displayName:objectKey}))};
test("Actual current Project edit surfaces only, no inferred axis promotion",()=>{const plan=buildCoreProjectControlsPlan({manifest,fixtures});assert.equal(plan.recipes.length,2);assert.ok(plan.recipes.every((row:{coverage:unknown[]})=>row.coverage.length===0));assert.deepEqual(plan.automaticAxisCoverage,[]);assert.equal(plan.globalClosed,false);});
test("Missing canonical adopter rejects",()=>assert.throws(()=>buildCoreProjectControlsPlan({manifest:manifest.filter(row=>row.id!=="projects-create-edit"),fixtures})));
for(const change of [{projects:fixtures.projects.slice(1)},{projects:[...fixtures.projects,fixtures.projects[0]]},{projects:fixtures.projects.map((row,index)=>index?row:{...row,id:0})},{projects:fixtures.projects.map((row,index)=>index?row:{...row,slug:"real-project"})},{assets:fixtures.assets.map((row,index)=>index?row:{...row,publicUrl:"https://external.invalid"})}])test("Unowned fixture rejected "+cases.length,()=>assert.throws(()=>buildCoreProjectControlsPlan({manifest,fixtures:{...fixtures,...change}})));
const request={id:randomUUID(),kind:"project-controls-state",recipe:"residential",phase:"baseline"};test("Finite checkpoint protocol",()=>{for(const recipe of PROJECT_CONTROL_KINDS)for(const phase of PROJECT_CONTROL_PHASES)validateProjectControlsRequest({...request,recipe,phase});});
for(const delta of[{sql:"select 1"},{expected:{}},{table:"projects"},{phase:"jump"},{recipe:"constructor"},{recipe:"__proto__"},{id:"bad"},{kind:"other"}])test("Protocol rejects "+JSON.stringify(delta),()=>assert.throws(()=>validateProjectControlsRequest({...request,...delta})));
const asset=fixtures.assets[0].publicUrl,epoch="2026-01-01T00:00:00Z";
function initial(kind:"residential"|"commercial"){
 const p=contract.createEmptyProjectEntry(kind),id=kind==="residential"?101:102;
 Object.assign(p.project,{id,code:"QA-PROJECT",arabic_name:"مشروع اختبار كامل",english_name:"Complete Fixture",slug:projectControlSlug(kind),general_description:"وصف عام مكتمل",short_description:"وصف مختصر مكتمل",image:asset,image_alt:"صورة",hero_image:asset,hero_image_alt:"هيرو",small_box_image:asset,small_box_image_alt:"بطاقة",governorate_id:1,city_id:2,main_area_id:3,sub_area_id:4,location_label:"عنوان كامل",google_maps_url:"https://example.invalid/map",latitude:"30",longitude:"31",map_zoom:"15",overview_body:"<p>نظرة عامة مكتملة</p>",overview_main_image:asset,overview_main_image_alt:"صورة النظرة",delivery_body:"<p>مواصفات كاملة</p>",created_at:epoch,updated_at:epoch});
 const row=(id:number)=>({id,client_key:randomUUID(),created_at:epoch,updated_at:epoch,project_id:p.project.id});
 p.location_points=[{...row(1),kind:"road",label:"QA طريق رئيسي",distance_text:"5 دقائق"}];p.features=[1,2,3].map(i=>({...row(10+i),body:"QA ميزة "+i}));p.delivery_items=[1,2].map(i=>({...row(20+i),body:"QA تسليم "+i}));
 p.floor_plans=[1,2].map(i=>({...row(30+i),name:"QA خطة "+i,area_text:"150",featured:i===1,architectural_image:asset,architectural_image_alt:"QA معماري",furnishing_image:asset,furnishing_image_alt:"QA فرش",details:[1,2].map(j=>({...row(40+i*10+j),label:"QA تفصيل "+j,value:"100"}))}));
 p.media=[1,2,3].map(i=>({...row(100+i),section:"gallery",image:asset,alt_text:"QA معرض "+i}));return p;
}
function authored(initialPayload:ReturnType<typeof initial>){
 const original=projectPayloadGraph(initialPayload),wanted=expectedProjectControlsProjection(original,fixtures),p=structuredClone(initialPayload);let nextId=1000;
 const fresh=()=>({id:++nextId,client_key:randomUUID(),created_at:epoch,updated_at:epoch,project_id:p.project.id});
 p.location_points=wanted.location_points.map((value:Row,index:number)=>({...index===2?p.location_points[0]:fresh(),...value})) as typeof p.location_points;
 p.features=wanted.features.map((value:Row,index:number)=>({...index<2?p.features[index===0?1:0]:fresh(),...value})) as typeof p.features;
 p.delivery_items=wanted.delivery_items.map((value:Row,index:number)=>({...index===0?p.delivery_items[1]:fresh(),...value})) as typeof p.delivery_items;
 const oldPlan=p.floor_plans[0];p.floor_plans=wanted.floor_plans.map((value:Row,index:number)=>({...index===1?oldPlan:fresh(),...value,details:(value.details as Row[]).map((detail,j)=>({...index===1&&j===0?oldPlan.details[1]:fresh(),...detail}))})) as typeof p.floor_plans;
 p.media=wanted.media.map((value:Row,index:number)=>({...index<2?p.media[index===0?1:0]:fresh(),...value})) as typeof p.media;p.videos=wanted.videos.map((value:Row)=>({...fresh(),section:"gallery" as const,video_url:String(value.video_url),poster_image:String(value.poster_image),poster_alt:String(value.poster_alt)}));return p;
}
function formFor(payload:ReturnType<typeof initial>){
 const form=new FormData();for(const[key,value]of Object.entries(payload.project))if(value!==null)form.append(key,Array.isArray(value)?value.join(","):String(value));
 const append=(prefix:string,row:Row,fields:string[])=>{for(const name of fields)form.append(prefix+name,String(row[name]??""));};
 for(const row of payload.location_points)append("location_point_",row,["id","client_key","kind","label","distance_text"]);
 for(const row of payload.features)append("feature_",row,["id","client_key","body"]);for(const row of payload.delivery_items)append("delivery_item_",row,["id","client_key","body"]);
 for(const row of payload.floor_plans){append("floor_plan_",row,["id","client_key","name","area_text","featured","architectural_image","architectural_image_alt","furnishing_image","furnishing_image_alt"]);for(const detail of row.details){append("floor_plan_detail_",detail,["id","client_key","label","value"]);form.append("floor_plan_detail_plan_key",row.client_key);}}
 for(const row of payload.media)append("media_",row,["id","client_key","section","image","alt_text"]);for(const row of payload.videos)append("video_",row,["id","client_key","section"]);
 // Visible video input names omit the video_ prefix for these three fields.
 for(const[name,values]of[["video_url",payload.videos.map(row=>row.video_url)],["video_poster_image",payload.videos.map(row=>row.poster_image)],["video_poster_alt",payload.videos.map(row=>row.poster_alt)]] as const){for(const value of values)form.append(name,value);}
 for(const[name,ids]of Object.entries(payload.deleted))for(const id of ids)form.append("deleted_"+name.replace(/_ids$/,"_id"),String(id));return form;
}
for(const kind of PROJECT_CONTROL_KINDS as Array<"residential"|"commercial">){
 const baseline=initial(kind),value=authored(baseline),original=projectPayloadGraph(baseline),saved=projectPayloadGraph(value);
 test("Fixed authored aggregate projection: "+kind,()=>assertProjectControlGraph(saved,original,fixtures));
 // Separate native reads return distinct Date objects for the same stored instant.
 const nativeOriginal=structuredClone(original),nativeSaved=structuredClone(saved);for(const graph of[nativeOriginal,nativeSaved])for(const table of PROJECT_CONTROL_TABLES)for(const row of graph[table as keyof typeof graph] as Row[])row.created_at=pgTimestamp("2026-01-01 00:00:00+00");
 test("Native pg timestamps preserve value across distinct object instances: "+kind,()=>{const before=nativeOriginal.project_features.find((row:Row)=>row.client_key===nativeSaved.project_features[0].client_key)!;assert.ok(before.created_at instanceof Date);assert.ok(nativeSaved.project_features[0].created_at instanceof Date);assert.notEqual(nativeSaved.project_features[0].created_at,before.created_at);assert.equal(nativeSaved.project_features[0].created_at.valueOf(),before.created_at.valueOf());assertProjectControlGraph(nativeSaved,nativeOriginal,fixtures);});
 for(const[reason,value]of Object.entries({changedInstant:pgTimestamp("2026-01-01 00:00:00.001+00"),stringRepresentation:epoch,missing:undefined,invalidDate:new Date(Number.NaN)}))test("Native timestamp invariant rejects "+kind+" "+reason,()=>{const broken=structuredClone(nativeSaved);broken.project_features[0].created_at=value;assert.throws(()=>assertProjectControlGraph(broken,nativeOriginal,fixtures));});

 const parsed=contract.projectEntryPayloadFromFormData(formFor(value));
 test("Real current parallel FormData parsing preserves all seven child graphs: "+kind,()=>assert.deepEqual(projectGraphProjection(projectPayloadGraph(parsed)),projectGraphProjection(saved)));
 test("Actual current aggregate validation accepts authored controls: "+kind,()=>assert.deepEqual(contract.assessProjectEntryPayload(parsed).fieldErrors,{}));
 test("Partial child detail rejects exact field, root remains valid: "+kind,()=>{const broken=structuredClone(parsed);broken.floor_plans[0].details[0].label="";const errors=contract.assessProjectEntryPayload(broken).fieldErrors;assert.deepEqual(Object.keys(errors),["floor_plan_detail_label"]);});
 const empty=structuredClone(value);for(const name of["location_points","features","floor_plans","delivery_items","media","videos"] as const)empty[name]=[];
 for(const[name,table]of Object.entries({location_point_ids:"project_location_points",feature_ids:"project_features",floor_plan_ids:"project_floor_plans",floor_plan_detail_ids:"project_floor_plan_details",delivery_item_ids:"project_delivery_items",media_ids:"project_media",video_ids:"project_videos"}))empty.deleted[name as keyof typeof empty.deleted]=(saved[table as keyof typeof saved] as Row[]).map((row:Row)=>Number(row.id));
 const emptyParsed=contract.projectEntryPayloadFromFormData(formFor(empty));
 test("Explicit empty children + exact deletion tombstones survive real parser: "+kind,()=>{assert.deepEqual(emptyParsed.deleted,empty.deleted);assert.deepEqual(contract.assessProjectEntryPayload(emptyParsed).fieldErrors,{});assertProjectControlGraph(projectPayloadGraph(empty),original,fixtures,true);});
 test("Edit unpublished does not mislabel a publish audit: "+kind,()=>assert.equal(audit.resolveProjectPublicationAuditOperation({mode:"edit",previousStatus:"unpublished",nextStatus:"unpublished"}),"update"));
 for(const table of PROJECT_CONTROL_TABLES)test("Native projection rejects missing child "+kind+" "+table,()=>{const broken=structuredClone(saved);(broken[table as keyof typeof broken] as Row[]).pop();assert.throws(()=>assertProjectControlGraph(broken,original,fixtures));});
 for(const[name,change]of Object.entries({root:(g:typeof saved)=>{g.project.image="/wrong";},order:(g:typeof saved)=>{g.project_features[0].sort_order=9;},identity:(g:typeof saved)=>{g.project_features[0].id=99999;},orphan:(g:typeof saved)=>{g.project_floor_plan_details[0].floor_plan_id=99999;},copiedKey:(g:typeof saved)=>{g.project_floor_plan_details[0].client_key=original.project_floor_plan_details[0].client_key;}}))test("Native invariant rejects "+kind+" "+name,()=>{const broken=structuredClone(saved);change(broken);assert.throws(()=>assertProjectControlGraph(broken,original,fixtures));});
}
const source=readFileSync(resolve(root,"scripts/fixtures/admin-core-project-controls-journeys.mjs"),"utf8");test("No alternate network interception/hidden mutation/direct API or forced click",()=>{assert.doesNotMatch(source,/page\.(route|unroute|request)|force:\s*true|\.selectOption\(/u);assert.match(source,/nativeFinalityRequired:true/u);assert.match(source,/payload\.deleted\[name\]/u);});
console.log(JSON.stringify({status:"pass",controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));
