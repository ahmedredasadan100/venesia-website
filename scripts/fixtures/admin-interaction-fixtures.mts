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

export async function seedOwnedAdminInteractionFixtures(handle: OwnedLocalHandle, credentials: { username: string; password: string; secret: string }, study?: {
  study: "heavy-editor-performance"; apiPort: number; serviceKey: string;
}) {
  assertOwnedLocalHandle(handle);
  if (study) {
    assert.equal(study.study, "heavy-editor-performance");
    assert.ok(Number.isSafeInteger(study.apiPort) && study.apiPort > 0 && study.apiPort < 65536);
    assert.ok(study.serviceKey.length > 0);
  }
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
  // This study measures a separate persistent aggregate. The normal fixtures
  // retain their legacy shape, and reset reuses every heavy child client key/ID.
  let heavy: typeof payload | undefined;
  let heavySaved: Awaited<ReturnType<typeof saveFixture>> | undefined;
  if (study) {
    heavy=JSON.parse(JSON.stringify(payload, (name,value)=>name === "client_key" ? key(`heavy-${value}`) : value)) as typeof payload;
    Object.assign(heavy.project,{arabic_name:"QA مشروع ثقيل متكامل",english_name:"QA Complete Heavy Project",slug:"qa-admin-heavy-project",overview_title:"QA saved residential overview",publication_status:"unpublished"});
    heavy.features.push({client_key:key("heavy-feature-4"),body:"QA saved residential generated feature"});
    const planNames=["QA خطة 1",...Array.from({length:10},(_,index)=>`QA Heavy Clone ${10-index}`),"QA خطة 2"];
    heavy.floor_plans=planNames.map((name,index)=>({
      client_key:key(`heavy-plan-${index}`),name,area_text:"150",featured:index===0,
      architectural_image:image,architectural_image_alt:"QA معماري",furnishing_image:image,furnishing_image_alt:"QA فرش",
      details:["QA تفصيل 1","QA تفصيل 2","QA Heavy Detail 3","QA Heavy Detail 4"].map((label,detailIndex)=>({
        client_key:key(`heavy-detail-${index}-${detailIndex}`),label,value:["100","100","300","400"][detailIndex],
      })),
    }));
    Object.assign(heavy.project,seo.deriveEntitySeoScore(seo.toProjectSeoScoreInput(heavy.project as ProjectSeoSource)));
    const heavyPrevious=(await handle.query("select id from public.projects where slug=$1",[heavy.project.slug])).rows[0];
    heavySaved=await saveFixture(heavyPrevious?.id,heavy);
    assert.ok(heavySaved?.project_id);
    const publication=(await handle.query("select publication_status from public.projects where id=$1",[heavySaved.project_id])).rows[0];
    assert.equal(publication?.publication_status,"unpublished","The heavy editor fixture starts unpublished in both phases.");
  }
  const projectMetadata=(id:unknown,value:typeof project)=>({id:Number(id),slug:value.slug,title:value.arabic_name,arabicName:value.arabic_name,overviewTitle:value.overview_title,overviewBody:"QA محتوى محفوظ للنظرة العامة",deliveryTitle:value.delivery_title,deliveryBody:"QA مواصفات وتسليم محفوظة",
    subAreaId:locations[3],locationIds:locations,editorPath:`/admin/projects/${id}`,listPath:`/admin/projects/${value.type}`,listQuery:`?q=QA&type=${value.type}&page=1&limit=20`});
  const pageFixturePath=resolve(root,"scripts/fixtures/admin-page-interaction-fixtures.mts");
  const pageFixtureHash=createHash("sha256").update(readFileSync(pageFixturePath)).digest("hex");
  const {seedAdminPageInteractionFixtures}=await import(`${pathToFileURL(pageFixturePath).href}?fixture=${pageFixtureHash}`);
  const pages = await seedAdminPageInteractionFixtures(handle);
  if (study) {
    // Canonical scoped reference writes make the initial Catalog identity equal
    // to the post-save/reset identity. No Catalog rows or reference counts are
    // invented here; the existing providers and guarded RPC remain authoritative.
    const projectIds=[saved.project_id,commercialSaved.project_id,heavySaved!.project_id];
    const targets=[{domainKey:"topics",entityIdentity:topic.id},
      ...categories.map(row=>({domainKey:"topic_categories",entityIdentity:row.id})),
      ...projectIds.map(id=>({domainKey:"projects",entityIdentity:id}))];
    for(const table of ["project_floor_plans","project_media","project_videos"] as const) {
      const children=await handle.query(`select id from public.${table} where project_id=any($1::bigint[]) order by id`,[projectIds]);
      targets.push(...children.rows.map(row=>({domainKey:table,entityIdentity:row.id})));
    }
    const templateDomains:Record<string,string>={content:"content_block_templates",cta:"cta_block_templates",cards:"cards_block_templates",breadcrumb:"breadcrumb_block_templates",feed:"feed_module_templates",featured:"featured_module_templates",hero:"hero_templates","media-sidebar":"media_sidebar_module_templates","media-hub":"media_hub_module_templates"};
    for(const template of pages.templates as Array<{kind:string;id:number}>) {
      assert.ok(templateDomains[template.kind]);
      targets.push({domainKey:templateDomains[template.kind],entityIdentity:template.id});
    }
    const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousServiceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      // Private, sequential provisioning only, supplied by the live owned
      // lifecycle. These values never enter fixture metadata or disk receipts.
      process.env.NEXT_PUBLIC_SUPABASE_URL=`http://127.0.0.1:${study.apiPort}`;
      process.env.SUPABASE_SERVICE_ROLE_KEY=study.serviceKey;
      const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
      const owner=await jiti.import<{
        synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets:Array<{domainKey:string;entityIdentity:string;leaseEntityIdentity:string}>,leaseToken:null):Promise<{status:string}>;
      }>(resolve(root,"src/lib/admin/media-catalog/synchronization.ts"));
      for(let offset=0;offset<targets.length;offset+=8) {
        const result=await owner.synchronizeMediaReferenceWriteScopesAfterDomainMutation(targets.slice(offset,offset+8).map(target=>({
          domainKey:target.domainKey,entityIdentity:String(target.entityIdentity),leaseEntityIdentity:String(target.entityIdentity),
        })),null);
        assert.equal(result.status,"synced","Owned fixture media references must synchronize before identity capture.");
      }
    } finally {
      if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
      if(previousServiceKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousServiceKey;
    }
  }
  const browserIdentity = <T extends Record<string, unknown>>(row: T) => {
    assert.ok(typeof row.id === "number" || typeof row.id === "string" && /^[1-9][0-9]*$/.test(row.id));
    const id = Number(row.id); assert.ok(Number.isSafeInteger(id) && id > 0, "Owned Browser fixture identity must be a positive safe integer.");
    return { ...row, id };
  };
  const browserCategories=categories.map(browserIdentity);
  return { credentials, fixtures: { category: browserCategories[0], categories:browserCategories,series:browserIdentity(series),topic:browserIdentity(topic),
    project:projectMetadata(saved.project_id,project),commercialProject:projectMetadata(commercialSaved.project_id,commercial.project),pages,
    ...(heavy&&heavySaved?{heavyProject:projectMetadata(heavySaved.project_id,heavy.project),heavyShape:{plans:12,detailsPerPlan:4,features:4,delivery:2,gallery:3,locationDepth:4}}:{}),
    baselineShape: { plans:2,detailsPerPlan:2,features:3,delivery:2,gallery:3,locationDepth:4 } } };
}

/** Twelve isolated records whose state is read back before and after Preview proof. */
export async function seedOwnedCorePreviewFixtures(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false,
    alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
  const publication = await jiti.import<typeof import("../../src/lib/admin/content-workflow/content-review-capability.ts")>(resolve(root, "src/lib/admin/content-workflow/content-review-capability.ts"));
  const articleInput = await jiti.import<typeof import("../../src/lib/admin/content-workflow/topic-publish-validation.ts")>(resolve(root, "src/lib/admin/content-workflow/topic-publish-validation.ts"));
  const manifest = await jiti.import<typeof import("../../src/lib/admin/interaction-system/adoption-manifest.ts")>(resolve(root, "src/lib/admin/interaction-system/adoption-manifest.ts"));
  const contracts = [
    { consumer: "topic-article-edit-preview-public", kind: "article", table: "topics" },
    { consumer: "topic-media-edit-preview", kind: "news", table: "topics" },
    { consumer: "topic-category-collection-preview", kind: "category", table: "topic_categories" },
    { consumer: "topic-series-collection-preview", kind: "series", table: "topic_series" },
  ] as const;
  assert.deepEqual(contracts.map(row => row.consumer).sort(), manifest.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.map(row => row.id).sort(), "Every current Preview consumer needs a concrete fixture contract.");
  const template = (await handle.query("select * from public.topics where slug='isolated-public-property-ownership' and status='published' and deleted_at is null")).rows[0];
  assert.ok(template, "Use the existing fully authored Public fixture.");
  const category = (await handle.query("select id,name,slug from public.topic_categories where slug='qa-admin-category-1' and deleted_at is null")).rows[0];
  assert.ok(category);
  const topicColumns = (await handle.query("select attname from pg_catalog.pg_attribute where attrelid='public.topics'::regclass and attnum>0 and not attisdropped and attgenerated='' and attidentity='' and attname<>'id' order by attnum")).rows.map(row => String(row.attname));
  assert.ok(topicColumns.length > 10 && topicColumns.every(name => /^[a-z_][a-z0-9_]*$/.test(name)));
  const seo = loadEntitySeoPersistenceOwner();
  const records: Array<{ consumer: string; publication: string; kind: string; table: string; id: number; name: string; title: string; slug: string; expectedStatus: string; expectedDeleted: boolean; expectedActive: boolean | null }> = [];
  await handle.query("begin");
  try {
    for (const contract of contracts) for (const state of ["published", "unpublished", "deleted"] as const) {
      const slug = `qa-core-preview-${contract.kind}-${state}`;
      const name = `معاينة الإغلاق ${contract.kind} ${state}`;
      const status = state === "published" ? "published" : "unpublished";
      const deletedAt = state === "deleted" ? "2026-01-02T00:00:00.000Z" : null;
      assert.equal((await handle.query(`select id from public.${contract.table} where slug=$1`, [slug])).rows.length, 0, "Never overwrite an existing fixture identity.");
      let id: number;
      if (contract.table === "topics") {
        const row: Record<string, unknown> = { ...template, slug, title: name, content_type: contract.kind,
          status, deleted_at: deletedAt, published_at: state === "published" ? "2026-01-01T00:00:00.000Z" : null,
          is_featured: false, media_payload: null, series_id: null, series: null, series_slug: null,
          category_id: category.id, category: category.name, category_slug: category.slug,
          created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
        const input = { ...articleInput.topicRowToPublishInput(row), contentType: contract.kind, mediaPayload: null,
          canonicalUrl: "", ogImage: "", ogImageAlt: "" };
        assert.equal(publication.getContentPublishValidationError(input), null, "All synthetic publication states retain valid content; visibility alone varies.");
        Object.assign(row, seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource)));
        const selected = topicColumns.map(name => `"${name}"`).join(",");
        id = Number((await handle.query(`insert into public.topics(${selected}) select ${selected} from jsonb_populate_record(null::public.topics,$1::jsonb) returning id`, [JSON.stringify(row)])).rows[0].id);
      } else if (contract.table === "topic_categories") {
        id = Number((await handle.query("insert into public.topic_categories(name,slug,status,is_active,show_in_menu,deleted_at) values($1,$2,$3,$4,false,$5) returning id", [name, slug, status, state === "published", deletedAt])).rows[0].id);
      } else {
        id = Number((await handle.query("insert into public.topic_series(name,slug,status,category_id,deleted_at) values($1,$2,$3,$4,$5) returning id", [name, slug, status, category.id, deletedAt])).rows[0].id);
      }
      records.push({ ...contract, publication: state, id, name, title: name, slug, expectedStatus: status,
        expectedDeleted: state === "deleted", expectedActive: contract.kind === "category" ? state === "published" : null });
    }
    await handle.query("commit");
  } catch (error) { await handle.query("rollback"); throw error; }
  assert.equal(records.length, manifest.ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.length * 3);
  return records;
}
/** Explicit specialized-settings opt-in after the existing primary account is prepared. */
export async function seedOwnedCoreSpecializedSettingsFixtures(handle: OwnedLocalHandle) {
  assertOwnedLocalHandle(handle);
  const credentials = credentialsByHandle.get(handle);
  assert.ok(credentials, "Prepare the canonical owned Admin account before specialized fixtures.");
  const { prepareCoreSpecializedSettingsFixtures } = await import("../verify-admin-core-specialized-settings-isolated.mts");
  return prepareCoreSpecializedSettingsFixtures(handle, credentials);
}
