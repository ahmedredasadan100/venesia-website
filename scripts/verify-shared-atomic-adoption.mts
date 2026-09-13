import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=(file:string)=>readFileSync(file,"utf8");
function body(file:string,name:string){const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);assert.ok(fn&&ts.isFunctionDeclaration(fn)&&fn.body,`${file}: missing ${name}`);return fn.body.getText(ast);}
const families={content:"ContentBlock",cta:"CtaBlock",cards:"CardsBlock",breadcrumb:"BreadcrumbBlock",feed:"FeedModule",featured:"FeaturedModule","media-sidebar":"MediaSidebarModule","media-hub":"MediaHubModule"};
for(const [kind,name] of Object.entries(families)){
 const source=body(`src/app/admin/pages-blocks/blocks/${kind}/actions.ts`,`update${name}`);const compact=source.replace(/\s+/gu,"");
 assert.equal((source.match(/saveModuleTemplateWithPageAssignments\(/gu)||[]).length,1,`${kind}: one atomic save`);
 assert.ok(compact.includes(`saveModuleTemplateWithPageAssignments("${kind}",`));
 assert.ok(source.includes("requireAdminSession()"));assert.ok(source.includes("coordinat"));assert.ok(source.includes("parsePageIdsFromForm(formData)"));
 assert.doesNotMatch(source,/\.update\(|sync(?:Block|MediaHub|MediaSidebar)ModulePageAssignments/u);
 assert.ok(source.includes("runBoundedPublicCacheRevalidation"));assert.ok(source.includes("affectedPageIds"));assert.ok(source.includes("cache_warning=1"));assert.ok(source.includes("saved_with_media_sync_warning"));
}
const owner=read("src/lib/page-blocks/sync-module-page-assignments.ts");
assert.equal((owner.match(/\.rpc\(/gu)||[]).length,1);assert.ok(owner.includes('p_operation: "save_template"'));assert.ok(owner.includes('p_page_id: null'));assert.ok(owner.includes("getDefaultAssignmentPosition(moduleKind)"));assert.doesNotMatch(owner,/sync_template_pages|\.update\(/u);
const pages=body("src/app/admin/pages-blocks/pages/page-actions/page-delete.ts","deletePages");assert.equal((pages.match(/mutatePageComposition\(/gu)||[]).length,1);assert.ok(pages.includes('"delete_pages"'));assert.ok(pages.includes("result.blocked_ids"));assert.ok(pages.includes("runBoundedPublicCacheRevalidation"));
const menus=body("src/app/admin/pages-blocks/menus/menu-actions/bulk.ts","bulkMenuAction");assert.equal((menus.match(/mutateMenuTree\(/gu)||[]).length,1);assert.ok(menus.includes('"delete_menus"'));assert.ok(menus.includes("committed.deleted_item_ids"));assert.ok(menus.includes("runBoundedPublicCacheRevalidation"));
const sql=read("sql/migrations/20260912224809_shared_composition_menu_atomic_completion.sql");
assert.match(sql,/\nbegin;[\s\S]+\ncommit;/u);assert.doesNotMatch(sql,/\bgrant\s+\w+\s+on|\btruncate\b/iu);assert.ok(sql.includes("Atomic owner ACL changed"));assert.ok(sql.includes("marker missing or ambiguous"));assert.ok(sql.includes("and username=p_actor_username and is_active"));
assert.ok(sql.indexOf("pg_advisory_xact_lock(hashtext('public.page_composition:aggregate'))") < sql.indexOf("for update"));assert.ok(sql.includes("pg_advisory_xact_lock_shared"));
for(const key of ["template_saved_config_mismatch","template_save_field_forbidden","v_protected_path in ('/','/projects')","v_affected_page_ids","order by value::bigint","delete_page","delete_menu"])assert.ok(sql.includes(key),key);
assert.ok(sql.includes("p_operation <> 'save_template' or cardinality(v_affected_page_ids) > 0"),"preserve assigned SQL audit and unassigned best-effort CMS audit");
const runtime=read("src/lib/admin/entity-list/data-engine/instant-mutation.ts");assert.ok(runtime.includes("reconcileDeletedRows"));assert.ok(runtime.includes("removeAdminEntityRows(value, ids)"));assert.ok(runtime.includes("Committed mutation refetch failed"));
assert.ok(read("src/app/admin/pages-blocks/pages/PagesTableClient.tsx").includes("reconcileDeletedRows(new Set(result.deletedIds as number[]))"));
console.log("Shared atomic adoption: PASS (eight real update bodies, Composition/Menu owners, transaction/ACL/Audit and post-commit truth; actual DB proof is a separate required local test).");
