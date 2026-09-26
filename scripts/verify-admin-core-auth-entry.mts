import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { CORE_AUTH_ENTRY_PHASES,assertCoreAuthEntryTransition,validateCoreAuthEntryRequest } from './verify-admin-core-auth-entry-isolated.mts';
import { buildCoreAuthEntryPlan,assertCoreAuthCookieMetadata } from './fixtures/admin-core-auth-entry-journeys.mjs';
const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});const {ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:manifest}=await jiti.import<{ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST:Array<Record<string,unknown>>}>('../src/lib/admin/form-system/adoption-manifest.ts');
const cases:string[]=[];const pass=(name:string,fn:()=>void)=>{fn();cases.push(name);};
pass('Actual Auth manifest derives its two existing session entry surfaces',()=>assert.equal(buildCoreAuthEntryPlan(manifest).surfaces.length,2));
pass('Missing Auth owner rejected',()=>assert.throws(()=>buildCoreAuthEntryPlan(manifest.filter(row=>row.id!=='authentication-login'))));
pass('Duplicate Auth owner rejected',()=>assert.throws(()=>buildCoreAuthEntryPlan([...manifest,manifest.find(row=>row.id==='authentication-login')])));
for(const phase of CORE_AUTH_ENTRY_PHASES)pass('Fixed phase '+phase,()=>assert.equal(validateCoreAuthEntryRequest({id:randomUUID(),kind:'auth-entry-state',phase}).phase,phase));
for(const patch of [{sql:'select secret'},{actorId:7},{kind:'run-sql'},{phase:'other'},{id:'invalid'}])pass('Closed native request rejects '+Object.keys(patch)[0],()=>assert.throws(()=>validateCoreAuthEntryRequest({id:randomUUID(),kind:'auth-entry-state',phase:'baseline',...patch})));
const before={id:7,username:'qa_admin_interaction',role:'admin',is_active:true,session_version:1,last_login_at:'2026-09-26T00:00:00Z',updated_at:'2026-09-26T00:00:00Z'};
const after={...before,last_login_at:'2026-09-26T00:00:02Z',updated_at:'2026-09-26T00:00:02Z'};
const success={id:1,action:'auth.login.success',actor_admin_user_id:7,actor_username:'qa_admin_interaction',entity_type:'admin_user',entity_id:7,entity_label:'qa_admin_interaction',metadata:{rememberMe:false}};
const rejected={id:2,action:'auth.login.failed',actor_admin_user_id:null,actor_username:'qa_admin_interaction',entity_type:'auth',entity_id:null,entity_label:'qa_admin_interaction',metadata:{reason:'invalid_credentials'}};
pass('Actual success audit and acknowledged timestamp accepted',()=>assertCoreAuthEntryTransition(before,after,[success],'admin-normal',7));
pass('Rejected credentials retain timestamps and anonymous failed audit',()=>assertCoreAuthEntryTransition(before,before,[rejected],'admin-invalid',7));
pass('Pre-delivery rejected transport changes no account or audit',()=>assertCoreAuthEntryTransition(before,before,[],'admin-transport',7));
for(const [name,mutate]of [
 ['missing-audit',(row:{account:typeof after;events:typeof success[]})=>{row.events=[];}],
 ['duplicate-audit',(row:{account:typeof after;events:typeof success[]})=>row.events.push({...success,id:3})],
 ['wrong-actor',(row:{account:typeof after;events:typeof success[]})=>{row.events[0].actor_admin_user_id=8;}],
 ['wrong-username',(row:{account:typeof after;events:typeof success[]})=>{row.events[0].actor_username='other';}],
 ['wrong-remember-value',(row:{account:typeof after;events:typeof success[]})=>{row.events[0].metadata.rememberMe=true;}],
 ['session-version-changed',(row:{account:typeof after;events:typeof success[]})=>{row.account.session_version++;}],
 ['role-changed',(row:{account:typeof after;events:typeof success[]})=>{row.account.role='other';}],
 ['activation-changed',(row:{account:typeof after;events:typeof success[]})=>{row.account.is_active=false;}],
]as const)pass(name+' rejected',()=>{const row={account:structuredClone(after),events:[structuredClone(success)]};mutate(row);assert.throws(()=>assertCoreAuthEntryTransition(before,row.account,row.events,'admin-normal',7));});
pass('Invalid credentials cannot borrow success audit',()=>assert.throws(()=>assertCoreAuthEntryTransition(before,before,[success],'admin-invalid',7)));
pass('Read-only reload cannot mutate timestamps',()=>assert.throws(()=>assertCoreAuthEntryTransition(before,after,[],'admin-reload',7)));
const cookie={name:'venesia_admin_session',domain:'127.0.0.1',path:'/',httpOnly:true,secure:false,sameSite:'Lax',expires:44200};
pass('Current local cookie security and bounded TTL accepted',()=>assertCoreAuthCookieMetadata(cookie,'http://127.0.0.1:3000',43200,1000,1001));
for(const patch of [{domain:'foreign.invalid'},{path:'/other'},{httpOnly:false},{sameSite:'None'},{secure:true},{expires:999999}])pass('Wrong cookie metadata rejected '+Object.keys(patch)[0],()=>assert.throws(()=>assertCoreAuthCookieMetadata({...cookie,...patch},'http://127.0.0.1:3000',43200,1000,1001)));
console.log(JSON.stringify({status:'pass',controls:cases.length,cases,runtimeExecuted:false,globalClosed:false}));
