import assert from "node:assert/strict";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { readCoreFixedQaActor } from "./verify-admin-core-domain-readback-isolated.mts";
import { AUDIT_ACTIONS } from "../src/lib/admin/audit/audit-actions.ts";
type Row=Record<string,unknown>;
export const CORE_AUTH_ENTRY_PHASES=["baseline","forgot","admin-invalid","admin-transport","admin-normal","admin-reload","admin-remember","maintenance-invalid","maintenance-transport","maintenance-normal","maintenance-reload"] as const;
type Phase=typeof CORE_AUTH_ENTRY_PHASES[number];
type State={index:number;actorId:number;cursor:number;account:Row;last:Row;events:Row[]};
const states=new WeakMap<OwnedLocalHandle,State>();
const stable=(row:Row)=>Object.fromEntries(Object.entries(row).filter(([key])=>!["last_login_at","updated_at"].includes(key)));
export function validateCoreAuthEntryRequest(input:unknown){assert.ok(input&&typeof input==='object');const row=input as Row;assert.deepEqual(Object.keys(row).sort(),['id','kind','phase']);assert.match(String(row.id),/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);assert.equal(row.kind,'auth-entry-state');assert.ok(CORE_AUTH_ENTRY_PHASES.includes(row.phase as Phase));return row as {id:string;kind:'auth-entry-state';phase:Phase};}
export function assertCoreAuthEntryTransition(previous:Row,current:Row,events:Row[],phase:Phase,actorId:number){
 assert.deepEqual(stable(current),stable(previous),'Login must preserve fixed account identity, role, activation and session version.');
 const invalid=phase.endsWith('-invalid'),success=['admin-normal','admin-remember','maintenance-normal'].includes(phase);
 assert.equal(events.length,invalid||success?1:0,'Exactly one real login audit belongs to each delivered attempt.');
 if(invalid){const event=events[0];assert.equal(event.action,AUDIT_ACTIONS.authLoginFailed);assert.equal(event.actor_admin_user_id,null);assert.equal(event.actor_username,'qa_admin_interaction');assert.equal(event.entity_type,'auth');assert.equal(event.entity_label,'qa_admin_interaction');assert.deepEqual(event.metadata,{reason:'invalid_credentials'});assert.deepEqual(current,previous,'Rejected credentials cannot update login timestamps.');}
 else if(success){const event=events[0];assert.equal(event.action,AUDIT_ACTIONS.authLoginSuccess);assert.equal(Number(event.actor_admin_user_id),actorId);assert.equal(event.actor_username,'qa_admin_interaction');assert.equal(event.entity_type,'admin_user');assert.equal(Number(event.entity_id),actorId);assert.equal((event.metadata as Row)?.rememberMe,phase==='admin-remember');assert.ok(Number.isFinite(Date.parse(String(current.last_login_at))));assert.ok(Date.parse(String(current.last_login_at))>=Date.parse(String(previous.last_login_at??'1970-01-01')));}
 else assert.deepEqual(current,previous,'Read-only navigation and rejected transport must preserve account timestamps.');
}
export async function readCoreAuthEntryCheckpoint(handle:OwnedLocalHandle,input:unknown){
 assertOwnedLocalHandle(handle);const request=validateCoreAuthEntryRequest(input);let state=states.get(handle);
 assert.equal(request.phase,CORE_AUTH_ENTRY_PHASES[state?.index??0],'Fixed Auth phases cannot be skipped, repeated or reordered.');
 return handle.withDatabaseConnection(async connection=>{
  await connection.query('begin isolation level repeatable read read only');let committed=false;
  try{
   const actorId=await readCoreFixedQaActor(connection);const account=(await connection.query("select id,email,username,full_name,role,is_active,session_version,last_login_at::text,updated_at::text from public.admin_users where id=$1",[actorId])).rows[0];assert.ok(account);
   const head=Number((await connection.query('select coalesce(max(id),0)::bigint id from public.admin_audit_logs')).rows[0].id);
   if(!state){state={index:0,actorId,cursor:head,account,last:account,events:[]};states.set(handle,state);}assert.equal(actorId,state.actorId);
   const events=(await connection.query("select id,action,actor_admin_user_id,actor_username,entity_type,entity_id,entity_label,metadata from public.admin_audit_logs where id>$1 and (actor_admin_user_id=$2 or actor_username='qa_admin_interaction') order by id limit 9",[state.cursor,actorId])).rows;
   assertCoreAuthEntryTransition(state.last,account,events,request.phase,actorId);
   await connection.query('commit');committed=true;state.index++;state.cursor=head;state.last=account;state.events.push(...events);
   return {...request,status:'pass',ownedRunId:handle.identity.runId,actorId,auditDelta:events.map(row=>({id:row.id,action:row.action,actorId:row.actor_admin_user_id,rememberMe:(row.metadata as Row).rememberMe??null})),accountIdentityUnchanged:true,loginTimestampAcknowledged:['admin-normal','admin-remember','maintenance-normal'].includes(request.phase),automaticCoverage:[]};
  }finally{if(!committed)await connection.query('rollback');}
 });
}
export function assertCoreAuthEntryCompleted(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);assert.equal(state.index,CORE_AUTH_ENTRY_PHASES.length);assert.equal(state.events.filter(row=>row.action===AUDIT_ACTIONS.authLoginSuccess).length,3);assert.equal(state.events.filter(row=>row.action===AUDIT_ACTIONS.authLoginFailed).length,2);return {status:'pass',phases:state.index,successfulLogins:3,rejectedCredentials:2,accountIdentityPreserved:true,globalClosed:false};}
