import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "../lib/isolated-supabase.mts";

/** Fixed synthetic rows for the existing Data/RowActions consumers; never a Product registry. */
export async function seedOwnedCoreDomainFixtures(handle: OwnedLocalHandle, fixtures: { project: { id: number } }, namespace: "command" | "terminal" = "command") {
  assertOwnedLocalHandle(handle);
  assert.ok(namespace === "command" || namespace === "terminal");
  assert.ok(Number.isSafeInteger(fixtures.project.id) && fixtures.project.id > 0);
  const root = resolve(import.meta.dirname, "../..");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false,
    alias: { "server-only": resolve(root, "node_modules/next/dist/compiled/server-only/empty.js") } });
  const owner = await jiti.import<{ hashPassword(value: string): Promise<string> }>(resolve(root, "src/lib/admin/auth/password.ts"));
  const passwordHash = await owner.hashPassword(randomBytes(32).toString("base64url"));
  const levels = ["governorate", "city", "main_area", "sub_area"] as const;
  const locations: Array<{ entity: string; id: number; label: string; level: string }> = [];
  await handle.query("begin");
  try {
    // Each actionable target is a leaf; the ordinary domain dependency guards
    // stay intact instead of disabling a location already used by a Project.
    for (let depth = 0; depth < levels.length; depth++) {
      let parent: number | null = null;
      for (let index = 0; index <= depth; index++) {
        const level = levels[index], label = `QA Core ${namespace} Location ${depth} ${level}`;
        assert.equal((await handle.query("select id from public.project_locations where name_ar=$1", [label])).rows.length, 0);
        const row: Record<string, unknown> = (await handle.query("insert into public.project_locations(client_key,level,parent_id,name_ar,name_en,sort_order,is_active) values($1,$2,$3,$4,$4,0,true) returning id", [randomUUID(), level, parent, label])).rows[0];
        parent = Number(row.id);
        if (index === depth) locations.push({ entity: "project_locations_" + level, id: parent, label, level });
      }
    }
    const projectId = fixtures.project.id;
    const stageLabel = `QA Core ${namespace} Stage`, itemLabel = `QA Core ${namespace} Item`, updateLabel = `QA Core ${namespace} Update`;
    assert.equal((await handle.query("select id from public.project_tracking_stages where project_id=$1 and name=$2", [projectId, stageLabel])).rows.length, 0);
    const stage = (await handle.query("insert into public.project_tracking_stages(project_id,name,sort_order,is_visible) select $1,$2,coalesce(max(sort_order)+1,0),true from public.project_tracking_stages where project_id=$1 returning id", [projectId, stageLabel])).rows[0];
    const item = (await handle.query("insert into public.project_tracking_items(stage_id,name,sort_order,status,is_visible) values($1,$2,0,'not_started',true) returning id", [stage.id, itemLabel])).rows[0];
    const update = (await handle.query("insert into public.project_tracking_updates(item_id,title,body,occurred_at,publication_status) values($1,$2,'QA authored isolated construction evidence',now(),'draft') returning id", [item.id, updateLabel])).rows[0];
    const redirectLabel = `/qa-core-${namespace}-redirect`;
    assert.equal((await handle.query("select id from public.url_redirects where source_path=$1", [redirectLabel])).rows.length, 0);
    const redirect = (await handle.query("insert into public.url_redirects(source_path,destination_path,redirect_type,status) values($1,'/topics','302','active') returning id", [redirectLabel])).rows[0];
    const userLabel = `qa_core_${namespace}_user`;
    assert.equal((await handle.query("select id from public.admin_users where username=$1", [userLabel])).rows.length, 0);
    const user = (await handle.query("insert into public.admin_users(email,username,password_hash,full_name,role,is_active,session_version) values($3,$1,$2,'QA Core Synthetic User','admin',true,1) returning id", [userLabel, passwordHash, `qa-core-${namespace}@example.invalid`])).rows[0];
    await handle.query("commit");
    return { locations, tracking: { projectId, stage: { id: Number(stage.id), label: stageLabel }, item: { id: Number(item.id), label: itemLabel }, update: { id: Number(update.id), label: updateLabel } },
      redirect: { id: Number(redirect.id), label: redirectLabel }, adminUser: { id: Number(user.id), label: userLabel } };
  } catch (error) { await handle.query("rollback"); throw error; }
}
