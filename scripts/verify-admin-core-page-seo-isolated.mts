import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import { PAGE_SEO_PHASES, assertPageSeoEvidence } from "./fixtures/admin-core-page-seo-contract.mjs";
type Row = Record<string, unknown>;
type Connection = { query(sql: string, parameters?: unknown[]): Promise<{ rows: Row[] }> };
const tables: Record<string,string> = { content:"content_block_templates",cta:"cta_block_templates",cards:"cards_block_templates",breadcrumb:"breadcrumb_block_templates",feed:"feed_module_templates",featured:"featured_module_templates",hero:"hero_templates",media_sidebar:"media_sidebar_module_templates",media_hub:"media_hub_module_templates" };
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const states = new WeakMap<OwnedLocalHandle,{ pageId:number; startedAt:string; phases:string[]; baseline:SeoEvidence; saved?:SeoEvidence }>();
type SeoEvidence = { ownedRunId:string; pageId:number; actorId:number; page:Row; audit:Row[]; otherPagesHash:string; compositionHash:string; assignedTemplatesHash:string; semanticContentHash:string; expectedScore:Row };
/** Called only from the existing Page Composition read-only repeatable-read transaction. */
export async function captureCorePageSeoState(connection:Connection, handle:OwnedLocalHandle, pageId:number, actorId:number, composition:{assignments:Row[];layouts:Row[];regions:Row[];audit:Row[];templates:Row[]}) : Promise<SeoEvidence> {
 const rows=(await connection.query("select to_jsonb(p) value from public.pages p where id=$1 and slug='qa-admin-page-interaction'",[pageId])).rows;assert.equal(rows.length,1);const page=rows[0].value as Row;
 const otherPages=(await connection.query("select id,md5(to_jsonb(p)::text) row_hash from public.pages p where id<>$1 order by id",[pageId])).rows;
 const owner=loadEntitySeoPersistenceOwner(), parts:Row[]=[];
 const templateProjection=Object.entries(tables).map(([kind,table])=>"select '"+kind+"'::text kind,id,slug,status,config from public."+table).join(" union all ");
 const sources=(await connection.query("select a.kind,a.id assignment_id,t.id,t.slug,t.status,t.config from public.page_composition_assignments a join ("+templateProjection+") t on t.kind=a.kind and t.id=a.template_id where a.page_id=$1 order by a.kind,a.id limit 129",[pageId])).rows;
 assert.equal(sources.length,composition.assignments.length,"Every current assignment must resolve its actual template.");
 for(const a of composition.assignments){
  const kind=String(a.kind),t=sources.find(row=>row.kind===kind&&Number(row.assignment_id)===Number(a.id));assert.ok(t);
  if(!owner.isPageModulePubliclyVisible(a.is_visible,t.status as string|null)||(kind==="content"&&owner.isRetiredContentBlockTemplateSlug(String(t.slug))))continue;
  const content=owner.extractPageBlockSeoText(t.config);if(content)parts.push({content,slot:owner.normalizeLayoutSlot(a.slot as string|null),sortOrder:Number(a.sort_order),moduleKind:kind.replaceAll("_","-"),assignmentId:Number(a.id)});
 }
 const regionKeys=composition.regions.filter(row=>Number(row.layout_id)===Number(page.layout_id)).map(row=>String(row.key));
 const semantic=owner.buildPageSeoSemanticContent(parts,regionKeys), expectedScore=owner.deriveEntitySeoScore(owner.toPageSeoScoreInput({...page,semanticContent:semantic}));
 const audit=(await connection.query("select id,action,entity_type,entity_id,actor_admin_user_id,metadata from public.admin_audit_logs where entity_type='page' and entity_id=$1 order by id",[pageId])).rows;
 return {ownedRunId:handle.identity.runId,pageId,actorId,page,audit,otherPagesHash:digest(otherPages),compositionHash:digest(composition),assignedTemplatesHash:digest(sources),semanticContentHash:digest(semantic),expectedScore:{...expectedScore}};
}
/** Accept only ordered, server-owned observations after the read-only snapshot commits. */
export function acceptCorePageSeoCheckpoint(handle:OwnedLocalHandle, phase:string, startedAt:string, observation:SeoEvidence) {
 assertOwnedLocalHandle(handle);assert.ok(PAGE_SEO_PHASES.includes(phase));let state=states.get(handle);
 if(!state){assert.equal(phase,"before");state={pageId:observation.pageId,startedAt,phases:[],baseline:observation};}
 assert.equal(state.pageId,observation.pageId);assert.equal(state.startedAt,startedAt);assert.equal(phase,PAGE_SEO_PHASES[state.phases.length],"SEO phases cannot skip, repeat or replay.");
 if(phase!=="before")assertPageSeoEvidence(state.baseline,observation,phase);
 if(phase==="saved")state.saved=observation;if(phase==="reloaded")assert.deepEqual(observation,state.saved,"Reload must preserve the complete saved row, audit and semantic input.");
 state.phases.push(phase);states.set(handle,state);
 return {phase,status:"pass",exactWrites:phase==="saved"||phase==="reloaded"?1:0,canonicalScoreVerified:phase==="saved"||phase==="reloaded",auditIds:observation.audit.slice(state.baseline.audit.length).map(row=>row.id),
  pageHash:digest(observation.page),otherPagesHash:observation.otherPagesHash,compositionHash:observation.compositionHash,semanticContentHash:observation.semanticContentHash,assignedTemplatesHash:observation.assignedTemplatesHash,
  boundary:"Read-only fixed owned Page; exact authored SEO, unchanged non-SEO/other Pages/composition/templates, current semantic score and actor audit. Actual authored OG values are included; no generic Form rollback claim."};
}
export function assertCorePageSeoCompleted(handle:OwnedLocalHandle){assertOwnedLocalHandle(handle);const state=states.get(handle);assert.ok(state);assert.deepEqual(state.phases,PAGE_SEO_PHASES);assert.ok(state.saved);return{status:"pass",phases:[...state.phases],nativeCheckpoints:4,exactWrites:1,pageId:state.pageId,actorId:state.baseline.actorId,globalClosed:false};}
