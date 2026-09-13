import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { createSharedAtomicActionHarness } from "./fixtures/shared-atomic-action-harness.mjs";

const out = path.resolve(process.env.SHARED_ATOMIC_PROOF_DIR ?? ".tmp-qa/shared-corrections-adoption/atomic");
mkdirSync(out, { recursive: true });
const connectionString = process.env.SHARED_ATOMIC_DATABASE_URL;
const restOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(connectionString && restOrigin, "Explicit isolated DB and REST configuration required");
const dbUrl = new URL(connectionString), restUrl = new URL(restOrigin);
assert.equal(dbUrl.hostname, "127.0.0.1");
assert.equal(dbUrl.pathname, "/shared_atomic_test");
assert.equal(restUrl.origin, "http://127.0.0.1:55436");
const client = new pg.Client({ connectionString, application_name: "shared-atomic-isolated-proof" });
await client.connect();
const query = (text, values) => client.query(text, values);
const identity = (await query("select current_database() as database,current_user as role,inet_server_port() as port,version() as version")).rows[0];
assert.equal(identity.database, "shared_atomic_test");
assert.match(identity.version, /PostgreSQL 17\./);
assert.equal(identity.role, "supabase_admin");
writeFileSync(path.join(out,"action-before-write-isolation.json"),JSON.stringify({at:new Date().toISOString(),identity,restOrigin:restUrl.origin,networkGuard:"Every fetch restricted to the exact isolated REST origin; no environment file is loaded."},null,2));
const requests = [], results = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input,init) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
  assert.equal(url.origin, restUrl.origin, "Unexpected outbound origin blocked before network");
  url.pathname = url.pathname.replace(/^\/rest\/v1(?=\/|$)/, "");
  requests.push({method:init?.method ?? "GET",path:url.pathname});
  return originalFetch(url,init);
};
const { actions, state } = await createSharedAtomicActionHarness(path.join(out,"action-harness"));
const filter = process.env.SHARED_ATOMIC_CASE;
const previousResults = process.env.SHARED_ATOMIC_RESUME
  ? JSON.parse(readFileSync(process.env.SHARED_ATOMIC_RESUME,"utf8")).results : [];
const record = () => writeFileSync(path.join(out,`persistence${filter ? "-"+filter : ""}.json`),JSON.stringify({at:new Date().toISOString(),identity,results,requests,scope:"Actual signed Admin login/session, Actions, validation, Domain RPC, PostgreSQL and read adapters. Next cache/headers transport and Media lease/sync side-service ports are isolated explicitly. No external Storage claim.",globalClosed:false},null,2));
async function check(name,run) {
  if (filter && !name.includes(filter)) return;
  const previous=previousResults.find(result=>result.name===name&&result.ok);
  if(previous){results.push({...previous,reused:true});record();return;}
  const started=Date.now();
  try {const detail=await run();results.push({name,ok:true,ms:Date.now()-started,detail});console.log("PASS "+name);}
  catch(error){results.push({name,ok:false,error:String(error)});throw error;}
  finally {record();}
}
const actorId=9001;
const form=(values,ids=[])=>{const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,String(value));for(const id of ids)data.append("page_ids",String(id));return data;};
const base=(id,name="Atomic saved")=>({id,name,slug:"atomic-"+id,status:"unpublished",title:"Persisted title",description:"Persisted description",variant:"default",style_preset:"premium-dark"});
const snapshots = async () => (await query(`select jsonb_build_object('template',(select to_jsonb(t) from cta_block_templates t where id=101),'assignments',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from page_cta_block_assignments t where template_id=101),'audit',(select count(*) from admin_audit_logs)) snapshot`)).rows[0].snapshot;
async function redirectAction(fn,data){try{await fn(data);assert.fail("Expected real Next redirect control flow");}catch(error){if(!error.digest?.startsWith("NEXT_REDIRECT;"))throw error;return error.digest.split(";").slice(2,-2).join(";");}}
async function login(){const response=await actions.handleAdminLoginRequest(new Request("http://127.0.0.1:55436/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"atomic-admin",password:process.env.SHARED_ATOMIC_PASSWORD})}));assert.equal(response.status,200);const cookie=response.headers.get("set-cookie");assert.ok(cookie?.includes("venesia_admin_session="));state.cookie=cookie.match(/venesia_admin_session=([^;]+)/)[1];const actor=await actions.requireAdminSession();assert.equal(actor.id,actorId);return {id:actor.id,username:actor.username,role:actor.role};}
const seedFile=path.join(out,"fixtures-seeded.json");
try {
  // Synthetic identities only, hashed by the current password owner.
  const passwordHash=await actions.hashPassword(process.env.SHARED_ATOMIC_PASSWORD);
  await query("insert into admin_users(id,email,username,password_hash,role) values($1,'atomic@example.test','atomic-admin',$2,'admin') on conflict(id) do update set password_hash=excluded.password_hash,is_active=true",[actorId,passwordHash]);
  const actor=await login();
  await query(`insert into pages(id,title,slug,path,status) values (91,'Atomic One','atomic-one','/atomic-one','unpublished'),(92,'Atomic Two','atomic-two','/atomic-two','unpublished'),(93,'Atomic Reject','atomic-reject','/atomic-reject','unpublished') on conflict(id) do nothing`);
  const familyTables={content:"content_block_templates",cta:"cta_block_templates",cards:"cards_block_templates",breadcrumb:"breadcrumb_block_templates",feed:"feed_module_templates",featured:"featured_module_templates","media-sidebar":"media_sidebar_module_templates","media-hub":"media_hub_module_templates"};
  for(const [kind,table] of Object.entries(familyTables)){
    const extra=kind==="feed"?",feed_type":kind==="media-sidebar"?",widget_key":kind==="media-hub"?",section_key":"";
    const value=kind==="feed"?",'latest'":kind==="media-sidebar"?",'latest'":kind==="media-hub"?",'videos'":"";
    await query(`insert into ${table}(id,name,slug,status${extra}) values(101,'Atomic original','atomic-101','unpublished'${value}) on conflict(id) do nothing`);
  }
  writeFileSync(seedFile,JSON.stringify({actor,fixturePages:[91,92,93],templateId:101,syntheticOnly:true},null,2));
  await check("auth-and-acl",async()=>{
    const cookie=state.cookie;state.cookie="invalid";
    await assert.rejects(()=>actions.updateCtaBlock(form(base(101),[91])),/Unauthorized/);
    state.cookie=cookie;await query("update admin_users set is_active=false where id=$1",[actorId]);
    await assert.rejects(()=>actions.deletePages([91]),/Unauthorized/);
    await query("update admin_users set is_active=true where id=$1",[actorId]);
    const acl=(await query("select proname,proacl::text,prosecdef,proconfig from pg_proc where proname in ('mutate_page_composition','mutate_menu_tree') order by proname")).rows;
    assert.deepEqual(acl,JSON.parse(readFileSync(path.join(out,"before-acl.json"),"utf8")));
    for(const role of ["anon","authenticated"]){await query("begin");try{await query(`set local role ${role}`);await assert.rejects(()=>query("select mutate_page_composition(null,'save_template','{}',$1,'atomic-admin')",[actorId]),/permission denied/);}finally{await query("rollback");}}
    await assert.rejects(()=>query("select mutate_page_composition(null,'save_template','{}',9001,'forged-client')"),/actor_invalid/);
    return {actor,aclPreserved:true,rejected:["invalid cookie","inactive actor","anon","authenticated","forged actor"]};
  });
  await check("template-real-failure-rollback-retry",async()=>{
    await redirectAction(actions.updateCtaBlock,form(base(101,"Before"),[91]));
    await query(`create sequence if not exists public.qa_template_write_attempt;
      create or replace function public.qa_template_attempt() returns trigger language plpgsql as $$ begin perform nextval('public.qa_template_write_attempt');return new;end;$$;
      create or replace function public.qa_reject_assignment() returns trigger language plpgsql as $$ begin if new.page_id=93 then raise exception 'qa_second_write_assignment_failure';end if;return new;end;$$;
      create trigger qa_template_attempt after update on cta_block_templates for each row execute function qa_template_attempt();
      create trigger qa_reject_assignment before insert on page_cta_block_assignments for each row execute function qa_reject_assignment();`);
    const before=await snapshots();
    await assert.rejects(()=>actions.updateCtaBlock(form(base(101,"Must rollback"),[92,93])),/qa_second_write_assignment_failure/);
    assert.deepEqual(await snapshots(),before);
    assert.equal((await query("select is_called from qa_template_write_attempt")).rows[0].is_called,true);
    await query("drop trigger qa_reject_assignment on page_cta_block_assignments;drop trigger qa_template_attempt on cta_block_templates");
    const href=await redirectAction(actions.updateCtaBlock,form(base(101,"Retry persisted"),[92,93]));
    assert.match(href,/saved=1/);
    const read=await actions.getSupabaseAdmin().from("cta_block_templates").select("name,config,updated_at").eq("id",101).single();assert.equal(read.error,null);assert.equal(read.data.name,"Retry persisted");assert.equal(read.data.config.title,"Persisted title");
    const assignments=await actions.getModuleAssignmentContext("cta",101);assert.deepEqual(assignments.assignments.map(x=>x.page_id).sort(),[92,93]);
    return {href,writeAttemptObserved:true,rollback:["template","assignments","audit"],readName:read.data.name};
  });
  await check("no-assignment-and-audit-policy",async()=>{
    await redirectAction(actions.updateCtaBlock,form(base(101,"Detached"),[]));
    await query(`create or replace function qa_reject_audit() returns trigger language plpgsql as $$ begin raise exception 'qa_audit_failure';end;$$;create trigger qa_reject_audit before insert on admin_audit_logs for each row execute function qa_reject_audit();`);
    const href=await redirectAction(actions.updateCtaBlock,form(base(101,"Unassigned audit failure"),[]));assert.match(href,/saved=1/);
    assert.equal((await query("select name from cta_block_templates where id=101")).rows[0].name,"Unassigned audit failure");
    assert.equal((await query("select count(*)::int count from page_cta_block_assignments where template_id=101")).rows[0].count,0);
    const before=await snapshots();await assert.rejects(()=>actions.updateCtaBlock(form(base(101,"Assigned audit policy"),[91])),/qa_audit_failure/);assert.deepEqual(await snapshots(),before);
    await query("drop trigger qa_reject_audit on admin_audit_logs");
    state.auditContextFailure=true;await redirectAction(actions.updateCtaBlock,form(base(101,"Context failure still saved"),[]));state.auditContextFailure=false;
    return {emptyAssignmentSaved:true,cmsAuditFailure:"non-blocking",existingAssignmentRpcAudit:"blocking unchanged",contextFailure:"non-blocking"};
  });
  await check("eight-family-action-contracts",async()=>{
    const functions={content:"updateContentBlock",cta:"updateCtaBlock",cards:"updateCardsBlock",breadcrumb:"updateBreadcrumbBlock",feed:"updateFeedModule",featured:"updateFeaturedModule","media-sidebar":"updateMediaSidebarModule","media-hub":"updateMediaHubModule"};const proof=[];
    const familyProofPath=path.join(out,"family-action-proof.json");
    const existingProof=existsSync(familyProofPath)?JSON.parse(readFileSync(familyProofPath,"utf8")):[];
    for(const [kind,name] of Object.entries(functions)){
      const previous=existingProof.find(item=>item.kind===kind);if(previous){proof.push({...previous,reused:true});continue;}
      const values={...base(101,kind+" actual action"),items_json:JSON.stringify([{title:"Real card",body:"Real body"}]),widget_title:"Real widget",limit:4,feed_type:"latest",widget_key:"latest",section_key:"videos",item_limit:4,details_text:"Details",presentation:kind==="media-sidebar"?"list":"cards",source_kind:"media-center",content_type:"video"};
      const href=await redirectAction(actions[name],form(values,[91]));assert.match(href,/saved=1/);
      const row=(await query(`select name,config,updated_at from ${familyTables[kind]} where id=101`)).rows[0];assert.equal(row.name,values.name);assert.equal(typeof row.config,"object");
      const context=await (kind==="media-sidebar"?actions.getMediaSidebarModuleAssignmentContext(101):kind==="media-hub"?actions.getMediaHubModuleAssignmentContext(101):actions.getModuleAssignmentContext(kind,101));assert.deepEqual(context.assignments.map(x=>x.page_id),[91]);proof.push({kind,href,configKeys:Object.keys(row.config),savedRevision:row.updated_at});
      writeFileSync(familyProofPath,JSON.stringify(proof,null,2));
    }
    return proof;
  });
  await check("saved-config-mismatch-rolls-back",async()=>{
    await query(`create or replace function qa_distort_config() returns trigger language plpgsql as $$ begin new.config='{}';return new;end;$$;create trigger qa_distort_config before update on cta_block_templates for each row execute function qa_distort_config();`);
    const before=await snapshots();await assert.rejects(()=>actions.updateCtaBlock(form(base(101,"Distorted"),[92])),/template_saved_config_mismatch/);assert.deepEqual(await snapshots(),before);
    await query("drop trigger qa_distort_config on cta_block_templates");return {triggerMismatch:"rolled back inside transaction"};
  });
  await check("pages-batch-rollback-protection-retry",async()=>{
    await query(`insert into pages(id,title,slug,path,status) values(501,'Delete One','delete-one','/delete-one','unpublished'),(502,'Delete Two','delete-two','/delete-two','unpublished'),(503,'Protected Home',' HoMe ','/home-alias','unpublished'),(504,'Protected Projects','projects-alias','/projects/','unpublished');
      insert into hero_templates(id,name,slug,status) values(801,'Keep Hero','keep-hero','unpublished');
      begin;select set_config('app.page_composition_write','on',true);insert into hero_assignments(hero_id,target_type,target_id) values(801,'page',501),(801,'route',501);commit;
      create sequence qa_page_delete_attempt;
      create function qa_page_delete_failure() returns trigger language plpgsql as $$ begin if old.id=501 then perform nextval('public.qa_page_delete_attempt');end if;if old.id=502 then raise exception 'qa_later_page_delete_failure';end if;return old;end;$$;
      create trigger qa_page_delete_failure before delete on pages for each row execute function qa_page_delete_failure();`);
    const before=(await query("select count(*)::int count from admin_audit_logs")).rows[0].count;
    const result=await actions.deletePages([502,501,503,504]);assert.equal(result.ok,false);assert.match(result.message,/qa_later_page_delete_failure/);
    assert.equal((await query("select is_called from qa_page_delete_attempt")).rows[0].is_called,true);
    assert.equal((await query("select count(*)::int count from pages where id in (501,502)")).rows[0].count,2);assert.equal((await query("select count(*)::int count from hero_assignments where hero_id=801")).rows[0].count,2);assert.equal((await query("select count(*)::int count from admin_audit_logs")).rows[0].count,before);
    await query("drop trigger qa_page_delete_failure on pages");
    const retry=await actions.deletePages([502,501,503,504]);assert.equal(retry.ok,true);assert.deepEqual(retry.deletedIds,[501,502]);assert.deepEqual(retry.blockedIds,[503,504]);
    assert.equal((await query("select count(*)::int count from hero_templates where id=801")).rows[0].count,1);assert.deepEqual((await query("select target_type from hero_assignments where hero_id=801")).rows.map(x=>x.target_type),["route"]);
    assert.equal((await actions.deletePages([])).code,"invalid_pages");assert.equal((await actions.deletePages([503,504])).code,"pages_protected");
    for(const row of (await query("select slug,path from pages where id in(503,504)")).rows)assert.ok(actions.getPageDeleteBlockReason(row));
    return {result,retry,heroTemplatePreserved:true,routeAssignmentPreserved:true};
  });
  const menuForm=ids=>{const data=form({bulk_action:"delete"});ids.forEach(id=>data.append("menu_ids",String(id)));return data;};
  await check("menus-batch-rollback-capture-retry",async()=>{
    await query(`insert into menus(id,name,slug) values(601,'Delete A','menu-601'),(602,'Delete B','menu-602');begin;select set_config('app.menu_tree_write','on',true);insert into menu_items(id,menu_id,label) values(701,601,'Root A'),(702,602,'Root B');commit;
      create sequence qa_menu_delete_attempt;
      create function qa_menu_delete_failure() returns trigger language plpgsql as $$ begin if old.id=601 then perform nextval('public.qa_menu_delete_attempt');end if;if old.id=602 then raise exception 'qa_later_menu_delete_failure';end if;return old;end;$$;create trigger qa_menu_delete_failure before delete on menus for each row execute function qa_menu_delete_failure();`);
    const before=(await query("select count(*)::int count from admin_audit_logs")).rows[0].count;
    const result=await actions.bulkMenuAction(menuForm([602,601]));assert.equal(result.ok,false);assert.match(result.message,/qa_later_menu_delete_failure/);assert.equal((await query("select is_called from qa_menu_delete_attempt")).rows[0].is_called,true);
    assert.equal((await query("select count(*)::int count from menus where id in(601,602)")).rows[0].count,2);assert.equal((await query("select count(*)::int count from menu_items where menu_id in(601,602)")).rows[0].count,2);assert.equal((await query("select count(*)::int count from admin_audit_logs")).rows[0].count,before);
    await query("drop trigger qa_menu_delete_failure on menus");const retry=await actions.bulkMenuAction(menuForm([602,601]));assert.equal(retry.ok,true);assert.deepEqual(retry.deletedIds,[601,602]);assert.deepEqual(state.cleanupCalls.at(-1).map(x=>x.entityIdentity),[701,702]);assert.equal((await actions.bulkMenuAction(menuForm([]))).code,"menu_bulk_empty");return {result,retry,cleanupCapturedInsideTransaction:true};
  });
  await check("post-commit-cache-media-failure",async()=>{
    state.cacheFailures=1;state.cacheCalls=[];const retryHref=await redirectAction(actions.updateCtaBlock,form(base(101,"Cache retried"),[]));assert.ok(!retryHref.includes("cache_warning"));assert.ok(state.cacheCalls.length>1);
    state.cacheFailures=999;state.mediaMode="throw";const href=await redirectAction(actions.updateCtaBlock,form(base(101,"Committed warning"),[]));assert.match(href,/cache_warning=1/);assert.match(href,/saved_with_media_sync_warning/);assert.equal((await query("select name from cta_block_templates where id=101")).rows[0].name,"Committed warning");
    await query("insert into menus(id,name,slug) values(603,'Cleanup warning','menu-603');begin;select set_config('app.menu_tree_write','on',true);insert into menu_items(id,menu_id,label) values(703,603,'Cleanup');commit;insert into pages(id,title,slug,path,status) values(505,'Cache warning','page-505','/page-505','unpublished')");
    const menu=await actions.bulkMenuAction(menuForm([603]));assert.equal(menu.ok,true);assert.equal(menu.feedbackStatus,"warning");assert.equal((await query("select count(*)::int count from menus where id=603")).rows[0].count,0);
    const page=await actions.deletePages([505]);assert.equal(page.ok,true);assert.equal(page.feedbackStatus,"warning");assert.equal((await query("select count(*)::int count from pages where id=505")).rows[0].count,0);
    state.cacheFailures=0;state.mediaMode="success";assert.ok(state.uncertaintyCalls.length>0);return {href,menu,page,cacheRetry:"existing bounded owner",mediaRecovery:"existing uncertainty and reconciliation contract"};
  });
  await check("concurrent-template-and-menu-transactions",async()=>{
    const outcomes=await Promise.all([redirectAction(actions.updateCtaBlock,form(base(101,"Concurrent A"),[91])),redirectAction(actions.updateCtaBlock,form(base(101,"Concurrent B"),[92,93]))]);assert.equal(outcomes.length,2);
    const persisted=(await query("select name from cta_block_templates where id=101")).rows[0].name;const assigned=(await query("select page_id::int from page_cta_block_assignments where template_id=101 order by page_id")).rows.map(x=>x.page_id);assert.deepEqual(assigned,persisted==="Concurrent A"?[91]:[92,93]);
    await query("insert into menus(id,name,slug) values(610,'A','menu-610'),(611,'B','menu-611'),(612,'C','menu-612')");
    const menus=await Promise.all([actions.bulkMenuAction(menuForm([611,610])),actions.bulkMenuAction(menuForm([612,611]))]);assert.equal(menus.filter(x=>x.ok).length,1);assert.equal(menus.filter(x=>!x.ok).length,1);const left=(await query("select id::int from menus where id between 610 and 612 order by id")).rows.map(x=>x.id);assert.deepEqual(left,menus[0].ok?[612]:[610]);return {persisted,assigned,menuResults:menus.map(x=>({ok:x.ok,message:x.message})),remaining:left};
  });
  await check("new-code-before-db-and-old-rpc-compatibility",async()=>{
    const definitions=(await query("select pg_get_functiondef(oid) definition from pg_proc where proname in ('mutate_page_composition','mutate_menu_tree') order by proname")).rows.map(x=>x.definition).join(";\n");
    const before=await snapshots();
    try{await query(readFileSync(path.join(out,"before-functions.sql"),"utf8").replace(/\$function\$(?=\s*(?:CREATE|$))/g,'$function$;'));await assert.rejects(()=>actions.updateCtaBlock(form(base(101,"Must not fallback"),[91])),/page_id_invalid|operation_unsupported/);assert.deepEqual(await snapshots(),before);}
    finally{await query(definitions);await query("notify pgrst,'reload schema'");}
    const actor=await actions.requireAdminSession();
    const result=await actions.getSupabaseAdmin().rpc("mutate_page_composition",{p_page_id:91,p_operation:"sync_template_pages",p_payload:{kind:"cta",template_id:101,page_ids:[91],default_slot:"main"},p_actor_admin_user_id:actor.id,p_actor_username:actor.username});assert.equal(result.error,null);assert.deepEqual(result.data.page_ids,[91]);
    return {newBeforeDb:"fails before core write; no fallback",legacySync:"same signature/ACL and result",rollback:"isolated function definitions restored without data restoration"};
  });
  await check("locked-page-policy-and-invalid-input",async()=>{
    const identities=[{slug:"other",path:"///"},{slug:"\tHoMe\n",path:"/alias-tab"},{slug:"\u00a0PROJECTS\ufeff",path:"/alias-unicode"},{slug:"other-path",path:"\t///projects///\n"}];
    for(const [index,row] of identities.entries()){
      assert.ok(actions.getPageDeleteBlockReason(row));
      await query("insert into pages(id,title,slug,path,status) values($1,'Policy fixture',$2,$3,'unpublished')",[820+index,row.slug,row.path]);
    }
    const result=await actions.deletePages([820,821,822,823]);assert.equal(result.ok,false);assert.equal(result.code,"pages_protected");assert.deepEqual(result.blockedIds,[820,821,822,823]);
    const before=await snapshots();
    for(const ids of [[91,91],[0],[null],[999999]]){
      await assert.rejects(()=>actions.saveModuleTemplateWithPageAssignments("cta",101,{name:"Invalid",status:"unpublished",config:{}},ids,actor),/assignment_invalid/);assert.deepEqual(await snapshots(),before);
    }
    await assert.rejects(()=>actions.saveModuleTemplateWithPageAssignments("cta",101,{name:"Forbidden",status:"unpublished",config:{},created_at:"2020-01-01"},[],actor),/field_forbidden/);
    await assert.rejects(()=>actions.updateCtaBlock(form(base(101),["bad"])),/معرّفات الصفحات/);
    return {result,malformedAndForbiddenPayloads:"rejected without writes",unicodeTrimAndSlashPolicy:"same as current Page owner"};
  });
  await check("observed-concurrent-lock-contention",async()=>{
    await query("begin;select pg_advisory_xact_lock(hashtext('public.page_composition:aggregate'))");
    const pending=Promise.all([redirectAction(actions.updateCtaBlock,form(base(101,"Contended A"),[91])),redirectAction(actions.updateCtaBlock,form(base(101,"Contended B"),[92,93]))]);
    let waiting=0;
    try{
      for(let i=0;i<100&&waiting<2;i++){
        await query("select pg_stat_clear_snapshot()");
        waiting=(await query("select count(*)::int count from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and wait_event='advisory' and query like '%mutate_page_composition%'")).rows[0].count;
        if(waiting<2)await new Promise(resolve=>setTimeout(resolve,20));
      }
      assert.equal(waiting,2,"Two independent PostgREST requests must actually contend inside PostgreSQL");
    }finally{await query("rollback");await pending;}
    const row=(await query("select name,updated_at from cta_block_templates where id=101")).rows[0];
    const ids=(await query("select page_id::int from page_cta_block_assignments where template_id=101 order by page_id")).rows.map(x=>x.page_id);
    assert.deepEqual(ids,row.name==="Contended A"?[91]:[92,93]);return {waiting,persisted:row,assignmentIds:ids,noMixedCommit:true};
  });
  await check("corrected-migration-acl-and-replay-refusal",async()=>{
    const before=(await query("select pg_get_functiondef(oid) definition,proacl::text,prosecdef,proconfig from pg_proc where proname in ('mutate_page_composition','mutate_menu_tree') order by proname")).rows;
    assert.deepEqual(before.map((row,i)=>({proname:i===0?"mutate_menu_tree":"mutate_page_composition",proacl:row.proacl,prosecdef:row.prosecdef,proconfig:row.proconfig})),JSON.parse(readFileSync(path.join(out,"before-acl.json"),"utf8")));
    const migration=readFileSync("sql/migrations/20260912224809_shared_composition_menu_atomic_completion.sql","utf8");
    try{await assert.rejects(()=>query(migration),/marker missing or ambiguous/);}finally{await query("rollback");}
    assert.deepEqual((await query("select pg_get_functiondef(oid) definition,proacl::text,prosecdef,proconfig from pg_proc where proname in ('mutate_page_composition','mutate_menu_tree') order by proname")).rows,before);
    return {sha256:createHash("sha256").update(migration).digest("hex"),replay:"refused and rolled back",existingAcl:"unchanged",signatureCount:before.length};
  });
  await check("after-trigger-config-readback-rollback",async()=>{
    await query(`create function qa_after_config_change() returns trigger language plpgsql as $$ begin if pg_trigger_depth()=1 then update public.cta_block_templates set config='{}' where id=new.id;end if;return new;end;$$;create trigger qa_after_config_change after update on cta_block_templates for each row execute function qa_after_config_change();`);
    const before=await snapshots();await assert.rejects(()=>actions.updateCtaBlock(form(base(101,"After trigger mismatch"),[91])),/template_saved_config_mismatch/);assert.deepEqual(await snapshots(),before);await query("drop trigger qa_after_config_change on cta_block_templates");
    const href=await redirectAction(actions.updateCtaBlock,form(base(101,"Final persisted read"),[91]));assert.match(href,/saved=1/);assert.equal((await actions.getSupabaseAdmin().from("cta_block_templates").select("config").eq("id",101).single()).data.config.title,"Persisted title");
    return {afterTriggerReadback:"actual SELECT after UPDATE, rollback on mismatch",retry:href};
  });
  console.log(`PASS actual persistence proof: ${results.length} cases`);
} finally {
  record();globalThis.fetch=originalFetch;await client.end();
}
