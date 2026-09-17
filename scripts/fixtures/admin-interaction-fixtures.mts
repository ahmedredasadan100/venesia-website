import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "../lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "../backfill-entity-seo-scores.mts";
import type { ProjectSeoSource, TopicSeoSource } from "../../src/lib/admin/seo/entity-seo-persistence.ts";

const root = resolve(import.meta.dirname, "../..");
const key = (name: string) => {
  const value = createHash("sha256").update(`qa-admin-interaction:${name}`).digest("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
const credentialsByHandle = new WeakMap<OwnedLocalHandle, { username: string; password: string; secret: string }>();
const originalTopicByHandle = new WeakMap<OwnedLocalHandle, Record<string, unknown>>();

/** Credentials remain in the canonical lifecycle process and never enter receipts. */
export async function prepareOwnedAdminMeasurementAccount(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  let credentials = credentialsByHandle.get(handle);
  if (!credentials) {
    credentials = { username: "qa_admin_interaction", password: randomBytes(32).toString("base64url"), secret: randomBytes(48).toString("base64url") };
    const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false,
      alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
    const owner = await jiti.import<{ hashPassword(value: string): Promise<string> }>(resolve(root, "src/lib/admin/auth/password.ts"));
    const passwordHash = await owner.hashPassword(credentials.password);
    await handle.query(`insert into public.admin_users(email,username,password_hash,full_name,role,is_active,session_version)
      values('qa-admin-interaction@example.invalid',$1,$2,'QA Local Admin','admin',true,1)
      on conflict (username) do update set password_hash=excluded.password_hash,is_active=true,session_version=1`, [credentials.username, passwordHash]);
    credentialsByHandle.set(handle, credentials);
  }
  return credentials;
}

export async function seedOwnedAdminInteractionFixtures(handle: OwnedLocalHandle, credentials: { username: string; password: string; secret: string }) {
  assertOwnedLocalHandle(handle);
  const categories = [];
  for (let i = 0; i < 3; i++) {
    const row = (await handle.query(`insert into public.topic_categories(name,slug,status,is_active,show_in_menu)
      values($1,$2,'published',true,false) on conflict(slug) do update set name=excluded.name,status=excluded.status,is_active=true returning id,name,slug`,
    [`QA تصنيف ${i + 1}`, `qa-admin-category-${i + 1}`])).rows[0]; categories.push(row);
  }
  const series = (await handle.query(`insert into public.topic_series(name,slug,status,category_id)
    values('QA سلسلة كاملة','qa-admin-series','published',$1) on conflict(slug) do update set name=excluded.name,status=excluded.status,category_id=excluded.category_id returning id,name,slug`, [categories[0].id])).rows[0];
  const topicRow = originalTopicByHandle.get(handle) ?? (await handle.query(`select * from public.topics where slug='isolated-public-property-ownership'`)).rows[0];
  const seo = loadEntitySeoPersistenceOwner();
  const topic = topicRow && {id:topicRow.id,title:topicRow.title,slug:topicRow.slug};
  assert.ok(topic, "The existing canonical Public seed provides a fully authored article.");
  originalTopicByHandle.set(handle,topicRow);
  const image="/images/projects/c35/hero.jpg";
  const registeredImage=(await handle.query("select id from public.admin_media_assets_catalog where object_key=$1 and provider='filesystem' and bucket='public' and status='active' and reconciliation_state='synced'",["images/projects/c35/hero.jpg"])).rows;
  assert.ok(registeredImage.length>0,"The published canonical filesystem fixture asset must already exist in the Catalog");
  const restoredTopic={...topicRow,image,category_id:categories[0].id,category:categories[0].name,category_slug:categories[0].slug,series_id:series.id};
  Object.assign(restoredTopic,seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(restoredTopic as unknown as TopicSeoSource)));
  const topicFields=["title","content","excerpt","image","category_id","category","category_slug","series_id","seo_title","seo_description","seo_keywords","focus_keyword","seo_score","seo_score_version","seo_score_input_hash"];
  await handle.query(`update public.topics set ${topicFields.map((field,index)=>`${field}=$${index+1}`).join(",")} where id=$${topicFields.length+1}`,[...topicFields.map(field=>restoredTopic[field as keyof typeof restoredTopic]),topic.id]);
  const locations: number[] = [];
  for (const [index, level] of ["governorate", "city", "main_area", "sub_area"].entries()) {
    const row = (await handle.query(`insert into public.project_locations(client_key,level,parent_id,name_ar,name_en,sort_order,is_active)
      values($1,$2,$3,$4,$5,0,true) on conflict(client_key) do update set is_active=true returning id`,
    [key(`location-${level}`),level,index ? locations[index - 1] : null,`QA موقع ${index + 1}`,`QA Location ${index + 1}`])).rows[0]; locations.push(Number(row.id));
  }
  const project = { type: "residential", arabic_name: "QA مشروع متكامل", english_name: "QA Complete Project", slug: "qa-admin-complete-project",
    general_description: "QA وصف عام مكتمل للمشروع", short_description: "QA وصف مختصر مكتمل",
    image, image_alt: "QA صورة", hero_image: image, hero_image_alt: "QA هيرو", small_box_image: image, small_box_image_alt: "QA بطاقة",
    governorate_id: locations[0],city_id: locations[1],main_area_id: locations[2],sub_area_id: locations[3],
    location_label: "QA عنوان المشروع", location_description: "QA وصف الموقع", google_maps_url: "https://www.google.com/maps?q=30.012345,31.123456", latitude: "30.012345",longitude: "31.123456",map_zoom: "15",
    overview_title: "QA نظرة عامة", overview_body: "<p>QA محتوى محفوظ للنظرة العامة</p>",overview_media_type: "image",overview_main_image: image,overview_main_image_alt: "QA نظرة عامة",
    delivery_title: "QA التنفيذ والتسليم",delivery_body: "<p>QA مواصفات وتسليم محفوظة</p>",plans_title: "QA الخطط",gallery_title: "QA المعرض",
    seo_title: "QA عنوان المشروع الكامل",seo_description: "QA وصف المشروع لمحركات البحث",focus_keyword: "مشروع",seo_keywords: ["مشروع","عقارات"],
    canonical_url: null,robots_index: true,robots_follow: true,og_image: null,og_image_alt: "" };
  const previous = (await handle.query("select id from public.projects where slug=$1", [project.slug])).rows[0];
  const payload = { project, deleted: {}, location_points: [{ client_key: key("point"),kind: "road",label: "QA طريق رئيسي",distance_text: "5 دقائق" }],
    features: Array.from({ length: 3 },(_,i) => ({ client_key: key(`feature-${i}`),body: `QA ميزة ${i + 1}` })),
    floor_plans: Array.from({ length: 2 },(_,i) => ({ client_key: key(`plan-${i}`),name: `QA خطة ${i + 1}`,area_text: "150",featured: i === 0,
      architectural_image: image,architectural_image_alt: "QA معماري",furnishing_image: image,furnishing_image_alt: "QA فرش",
      details: Array.from({length: 2},(_,j) => ({ client_key: key(`detail-${i}-${j}`),label: `QA تفصيل ${j + 1}`,value: "100" })) })),
    delivery_items: Array.from({ length: 2 },(_,i) => ({client_key:key(`delivery-${i}`),body:`QA تسليم ${i + 1}`})),
    media: Array.from({length:3},(_,i) => ({client_key:key(`media-${i}`),section:"gallery",image,alt_text:`QA معرض ${i + 1}`})),videos: [] };
  Object.assign(project, seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(project as ProjectSeoSource)));
  const saveFixture = async (id: unknown, input: typeof payload) => {
    const value=structuredClone(input);
    if(id) {
      const deleted:Record<string,number[]>={};
      for(const [table,field,array] of [["project_location_points","location_point_ids",value.location_points],["project_features","feature_ids",value.features],
        ["project_floor_plans","floor_plan_ids",value.floor_plans],["project_delivery_items","delivery_item_ids",value.delivery_items],
        ["project_media","media_ids",value.media],["project_videos","video_ids",value.videos]] as const) {
        const existing=(await handle.query(`select id,client_key from public.${table} where project_id=$1`,[id])).rows;
        const wanted=new Set(array.map(item=>item.client_key));
        for(const item of array){const persisted=existing.find(row=>row.client_key===item.client_key);if(persisted)Object.assign(item,{id:Number(persisted.id)});}
        deleted[field]=existing.filter(row=>!wanted.has(String(row.client_key))).map(row=>Number(row.id));
      }
      const existingDetails=(await handle.query("select d.id,d.client_key,p.client_key as plan_client_key from public.project_floor_plan_details d join public.project_floor_plans p on p.id=d.floor_plan_id where p.project_id=$1",[id])).rows;
      const details=new Set(value.floor_plans.flatMap(plan=>plan.details.map(detail=>detail.client_key)));
      for(const plan of value.floor_plans)for(const detail of plan.details){
        const persisted=existingDetails.find(row=>row.client_key===detail.client_key);
        if(persisted){assert.equal(persisted.plan_client_key,plan.client_key,"Owned fixture detail must retain its actual parent plan");Object.assign(detail,{id:Number(persisted.id)});}
      }
      deleted.floor_plan_detail_ids=existingDetails.filter(row=>!details.has(String(row.client_key))).map(row=>Number(row.id));
      value.deleted=deleted;
    }
    return (await handle.query("select * from public.save_project_admin_entry($1::bigint,$2::jsonb)",[id??null,JSON.stringify(value)])).rows[0];
  };
  const saved = await saveFixture(previous?.id,payload);
  assert.ok(saved?.project_id);
  const commercial=JSON.parse(JSON.stringify(payload, (name,value)=>name === "client_key" ? key(`commercial-${value}`) : value)) as typeof payload;
  Object.assign(commercial.project,{type:"commercial",arabic_name:"QA مشروع تجاري متكامل",english_name:"QA Complete Commercial Project",slug:"qa-admin-complete-commercial-project"});
  Object.assign(commercial.project,seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(commercial.project as ProjectSeoSource)));
  const commercialPrevious=(await handle.query("select id from public.projects where slug=$1",[commercial.project.slug])).rows[0];
  const commercialSaved=await saveFixture(commercialPrevious?.id,commercial);
  const projectMetadata=(id:unknown,value:typeof project)=>({id:Number(id),slug:value.slug,title:value.arabic_name,arabicName:value.arabic_name,overviewTitle:value.overview_title,overviewBody:"QA محتوى محفوظ للنظرة العامة",deliveryTitle:value.delivery_title,deliveryBody:"QA مواصفات وتسليم محفوظة",
    subAreaId:locations[3],locationIds:locations,editorPath:`/admin/projects/${id}`,listPath:`/admin/projects/${value.type}`,listQuery:`?q=QA&type=${value.type}&page=1&limit=20`});
  const pageFixturePath=resolve(root,"scripts/fixtures/admin-page-interaction-fixtures.mts");
  const pageFixtureHash=createHash("sha256").update(readFileSync(pageFixturePath)).digest("hex");
  const {seedAdminPageInteractionFixtures}=await import(`${pathToFileURL(pageFixturePath).href}?fixture=${pageFixtureHash}`);
  const pages = await seedAdminPageInteractionFixtures(handle);
  return { credentials, fixtures: { category: categories[0], categories,series,topic,
    project:projectMetadata(saved.project_id,project),commercialProject:projectMetadata(commercialSaved.project_id,commercial.project),pages,
    baselineShape: { plans:2,detailsPerPlan:2,features:3,delivery:2,gallery:3,locationDepth:4 } } };
}
