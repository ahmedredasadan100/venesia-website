import assert from "node:assert/strict";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "../lib/isolated-supabase.mts";

/** Data only, scoped to a live owned disposable database and this QA namespace. */
export async function seedAdminPageInteractionFixtures(handle: OwnedLocalHandle): Promise<Record<string, unknown>> {
  assertOwnedLocalHandle(handle);
  const namespace = "qa-admin-page-interaction";
  const title = "QA Page Interaction";
  const pageResult = await handle.query(`
    insert into public.pages (title,slug,path,page_type,status,seo_title,seo_description,focus_keyword)
    values ($1,$2,$3,'static','published',$4,$5,$6)
    on conflict (slug) do update set title=excluded.title,path=excluded.path,status=excluded.status,
      seo_title=excluded.seo_title,seo_description=excluded.seo_description,focus_keyword=excluded.focus_keyword
    returning id
  `, [title, namespace, `/${namespace}`, "QA Page SEO Title", "QA saved page description", "QA"]);
  const pageId = Number(pageResult.rows[0].id);
  const mutateComposition = async (operation: string, payload: Record<string, unknown>) => {
    await handle.query(
      "select public.mutate_page_composition($1::bigint,$2::text,$3::jsonb,null::bigint,$4::text)",
      [pageId, operation, JSON.stringify(payload), `system:${namespace}`],
    );
  };
  // Reset through the same atomic owner while preserving the measured identities.
  const existingAssignments = await handle.query(
    "select kind,id,template_id from public.page_composition_assignments where page_id=$1 order by kind,id",
    [pageId],
  );
  const retainedAssignments = new Set<string>();
  const kinds = [
    { kind: "content", template: "content_block_templates", assignment: "page_content_block_assignments" },
    { kind: "cta", template: "cta_block_templates", assignment: "page_cta_block_assignments" },
    { kind: "cards", template: "cards_block_templates", assignment: "page_cards_block_assignments" },
    { kind: "breadcrumb", template: "breadcrumb_block_templates", assignment: "page_breadcrumb_block_assignments" },
    { kind: "feed", template: "feed_module_templates", assignment: "page_feed_module_assignments", extra: "feed_type", extraValue: "latest" },
    { kind: "featured", template: "featured_module_templates", assignment: "page_featured_module_assignments" },
    { kind: "hero", template: "hero_templates", assignment: "hero_assignments" },
    { kind: "media-sidebar", template: "media_sidebar_module_templates", assignment: "page_media_sidebar_module_assignments", extra: "widget_key", extraValue: "sections" },
    { kind: "media-hub", template: "media_hub_module_templates", assignment: "page_media_hub_module_assignments", extra: "section_key", extraValue: "site-updates" },
  ];
  const templates: Array<{ kind: string; id: number; name: string; slug: string; assigned: boolean }> = [];
  for (const entry of kinds) {
    for (let index = 0; index < 9; index += 1) {
      const assigned = index === 0;
      const name = `QA ${entry.kind} ${assigned ? "Assigned" : `Unused ${index}`}`;
      const slug = `${namespace}-${entry.kind}-${index}`;
      const config = {
        title: `QA authored ${entry.kind}`,
        text: assigned ? `Saved ${entry.kind} authored copy` : "Unused authored reference content. ".repeat(512),
        ...(entry.kind === "content" ? { body: "<p>QA saved content body</p>" } : {}),
        ...(entry.kind === "cards" ? { items: [{ title: "QA saved card", body: "QA saved card description", href: `/${namespace}` }] } : {}),
        ...(entry.kind === "featured" ? { source: { kind: "media-center", contentType: "news" } } : {}),
        presentation: { title: `QA ${entry.kind}`, variant: "editorial" },
      };
      const result = await handle.query(`
        insert into public.${entry.template} (name,slug,status,config${entry.extra ? `,${entry.extra}` : ""})
        values ($1,$2,'published',$3::jsonb${entry.extra ? ",$4" : ""})
        on conflict (slug) do update set name=excluded.name,status=excluded.status,config=excluded.config${entry.extra ? `,${entry.extra}=excluded.${entry.extra}` : ""}
        returning id
      `, [name, slug, JSON.stringify(config), ...(entry.extra ? [entry.extraValue] : [])]);
      const templateId = Number(result.rows[0].id);
      templates.push({ kind: entry.kind, id: templateId, name, slug, assigned });
      if (!assigned) continue;
      const databaseKind = entry.kind.replaceAll("-", "_");
      const matching = existingAssignments.rows.filter(row => row.kind === databaseKind && Number(row.template_id) === templateId);
      assert.ok(matching.length <= 1, "A fixture assignment identity is ambiguous; do not replace measured rows.");
      const assignmentId = matching.length === 1 ? Number(matching[0].id) : undefined;
      const identity = assignmentId === undefined ? {} : { assignment_id: assignmentId };
      if (entry.kind === "hero") {
        await mutateComposition("save_hero_assignment", { ...identity, hero_id: templateId, sort_order: 0, is_visible: true });
      } else {
        await mutateComposition("save_assignment", {
          ...identity,
          kind: databaseKind,
          template_id: templateId,
          slot: entry.kind === "media-sidebar" ? "sidebar" : "main",
          sort_order: (kinds.indexOf(entry) + 1) * 10,
          is_visible: true,
        });
      }
      const current = (await handle.query(
        "select id from public.page_composition_assignments where page_id=$1 and kind=$2 and template_id=$3 order by id",
        [pageId, databaseKind, templateId],
      )).rows;
      assert.equal(current.length, 1, "The canonical assignment save must resolve one fixture row.");
      if (assignmentId !== undefined) assert.equal(Number(current[0].id), assignmentId, "Reset replaced a measured assignment identity.");
      retainedAssignments.add(`${databaseKind}:${current[0].id}`);
    }
  }
  const extraAssignments = existingAssignments.rows.filter(row => !retainedAssignments.has(`${row.kind}:${row.id}`));
  if (extraAssignments.length > 0) {
    for (const row of extraAssignments) assert.ok(templates.some(template =>
      template.kind.replaceAll("-", "_") === row.kind && template.id === Number(row.template_id)),
    "Only assignments to this QA namespace may be removed during fixture reset.");
    await mutateComposition("bulk", {
      changes: extraAssignments.map(row => ({ kind: row.kind, id: Number(row.id), action: "delete" })),
    });
  }
  return { pageId, title, slug: namespace, editorPath: `/admin/pages-blocks/pages/${pageId}`, seoTitle: "QA Page SEO Title", templates, unusedPerKind: 8, assignedKinds: 9 };
}
