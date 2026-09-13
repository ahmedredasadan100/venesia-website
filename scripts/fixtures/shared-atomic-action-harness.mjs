import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

/** Real Actions, Auth, Domain and Supabase SDK; only named side-service ports are isolated. */
export async function createSharedAtomicActionHarness(out) {
  await mkdir(out, { recursive: true });
  const state = {
    cookie: "", cacheCalls: [], cacheFailures: 0, auditContextFailure: false,
    mediaMode: "success", cleanupCalls: [], uncertaintyCalls: [], leaseCalls: [],
  };
  globalThis.__sharedAtomicPorts = state;
  const ports = {
    "server-only": "export {};",
    "next/headers": `export async function cookies(){return {get(){return {value:globalThis.__sharedAtomicPorts.cookie}}}};export async function headers(){if(globalThis.__sharedAtomicPorts.auditContextFailure)throw Error('isolated audit context');return new Headers();}`,
    "next/cache": `function cache(kind,args){const state=globalThis.__sharedAtomicPorts;state.cacheCalls.push({kind,args});if(state.cacheFailures>0){state.cacheFailures--;throw Error('isolated cache failure')}}export const revalidatePath=(...args)=>cache('path',args);export const revalidateTag=(...args)=>cache('tag',args);export const updateTag=(...args)=>cache('update',args);export const unstable_cache=(fn)=>fn;`,
    "write-lease": `export class MediaReferenceWriteLeaseError extends Error{};export const getMediaReferenceWriteLeaseUserMessage=x=>x;export async function acquireMediaReferenceWriteLease(input){globalThis.__sharedAtomicPorts.leaseCalls.push(input.requestIdentity);return null};export async function completeMediaReferenceWriteLease(){};export async function failMediaReferenceWriteLease(){}`,
    "synchronization": `const synced={status:'synced',code:'media_reference_sync_succeeded',domainKey:'isolated',entityIdentity:'fixture',failureReason:null,requiresReconciliation:false,mediaSynchronizationState:'synced',uncertainties:[],explicitEmpty:true};export async function markMediaCatalogRuntimeUncertain(reasons){globalThis.__sharedAtomicPorts.uncertaintyCalls.push(reasons)};export async function synchronizeMediaReferencesAfterDomainMutation(){if(globalThis.__sharedAtomicPorts.mediaMode==='throw')throw Error('isolated media failure');return {...synced}};export async function synchronizeMediaReferenceWriteScopesAfterDomainMutation(write,lease,cleanup){globalThis.__sharedAtomicPorts.cleanupCalls.push(cleanup);if(globalThis.__sharedAtomicPorts.mediaMode==='throw')throw Error('isolated cleanup failure');return {...synced}};`,
  };
  const entry = `export {handleAdminLoginRequest} from '@src/lib/admin/auth/handle-admin-login';
export {hashPassword} from '@src/lib/admin/auth/password';
export {requireAdminSession} from '@src/lib/admin/auth/require-admin-session';
export {recordCmsAdminAudit} from '@src/lib/admin/audit-log';
export {getModuleAssignmentContext,getMediaSidebarModuleAssignmentContext,getMediaHubModuleAssignmentContext} from '@src/lib/page-blocks/module-assignments-query';
export {getSupabaseAdmin} from '@src/lib/supabase-admin';
export {saveModuleTemplateWithPageAssignments} from '@src/lib/page-blocks/sync-module-page-assignments';
export {deletePages} from '@src/app/admin/pages-blocks/pages/page-actions/page-delete';
export {bulkMenuAction} from '@src/app/admin/pages-blocks/menus/menu-actions/bulk';
export {getPageDeleteBlockReason} from '@src/lib/pages/page-admin-policy';
${[['content','ContentBlock'],['cta','CtaBlock'],['cards','CardsBlock'],['breadcrumb','BreadcrumbBlock'],['feed','FeedModule'],['featured','FeaturedModule'],['media-sidebar','MediaSidebarModule'],['media-hub','MediaHubModule']].map(([kind,name])=>`export {update${name}} from '@src/app/admin/pages-blocks/blocks/${kind}/actions';`).join('\n')}`;
  await writeFile(path.join(out,"entry.ts"), entry);
  const require = createRequire(import.meta.url), modules = new Map();
  function load(file, suppliedSource) {
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} }; modules.set(file,loadedModule);
    const compiled=ts.transpileModule(suppliedSource ?? readFileSync(file,"utf8"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const resolve = (specifier) => {
      if (ports[specifier]) return load(specifier+".ts",ports[specifier]);
      const base = specifier.startsWith("@src/") ? path.resolve("src",specifier.slice(5)) : specifier.startsWith(".") ? path.resolve(path.dirname(file),specifier) : null;
      if (!base) return require(specifier);
      if (/media-catalog[\\/](write-lease|synchronization)$/.test(base)) {
        const name=path.basename(base);return load(name+".ts",ports[name]);
      }
      const target=[base,base+".ts",base+".tsx",path.join(base,"index.ts"),path.join(base,"index.tsx")].find(candidate=>existsSync(candidate)&&statSync(candidate).isFile());
      if (!target) throw new Error("Unresolved source module: "+base);
      return load(target);
    };
    new Function("require","module","exports",compiled)(resolve,loadedModule,loadedModule.exports);
    return loadedModule.exports;
  }
  return {actions:load(path.join(out,"entry.ts")),state};
}
