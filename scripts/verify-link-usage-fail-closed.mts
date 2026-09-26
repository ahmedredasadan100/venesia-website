import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import type { AdminActionResult } from "../src/lib/admin/admin-action-result";
import type { LinkedResourceType } from "../src/lib/admin/links/types";
import type { LinkUsageQuery } from "../src/lib/admin/links/usage";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_ERROR = "private database transport sentinel";
const SAFE_ERROR = "تعذر التحقق من استخدام الروابط. أعد المحاولة قبل المتابعة.";
const TOPIC_ID = 17;
const TOPIC_PATH = "/topics/linked-topic";
const READ_STAGES = [
  "path:topics",
  "menu:typed",
  "menu:href",
  "hero_templates",
  "cta_block_templates",
  "content_block_templates",
  "cards_block_templates",
  "breadcrumb_block_templates",
  "footer.slots",
  "footer.contact_items",
] as const;
const RESOURCE_TYPES = [
  "pages", "projects", "topics", "topic_categories", "topic_series",
] as const satisfies readonly LinkedResourceType[];

type FixtureOptions = {
  failureStage?: string;
  failureMode?: "returned" | "thrown";
  usageStage?: string;
  slotsMissing?: boolean;
  pathMissing?: boolean;
};

// Only supplied modules may load: no real Supabase client, Next runtime,
// authentication, media synchronization, network or database writes.
function loadSource<T>(file: string, dependencies: Record<string, unknown> = {}): T {
  const compiled = ts.transpileModule(readFileSync(resolve(ROOT, file), "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const isolatedModule = { exports: {} };
  Function("exports", "module", "require", compiled)(
    isolatedModule.exports,
    isolatedModule,
    (specifier: string) => {
      assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency ${file}: ${specifier}`);
      return dependencies[specifier];
    },
  );
  return isolatedModule.exports as T;
}

const staticRoutes = loadSource("src/lib/admin/links/static-routes.ts");
const contentTypes = loadSource("src/lib/admin/content/content-types.ts");
const serialization = loadSource("src/lib/admin/links/serialize.ts", {
  "./static-routes": staticRoutes,
  "./types": loadSource("src/lib/admin/links/types.ts"),
});
const publicPaths = loadSource("src/lib/content/public-content-path.ts", {
  "../admin/links/static-routes": staticRoutes,
});
const unexpected = () => { throw new Error("Unexpected side effect in isolated link-usage proof."); };
const projectPaths = loadSource("src/lib/projects/public-helpers.ts", {
  "../admin/links/static-routes": staticRoutes,
  "../seo/seo-utils": { absoluteUrlWithBase: unexpected },
});
const actionResults = loadSource("src/lib/admin/admin-action-result.ts");

function fixture(options: FixtureOptions = {}) {
  const reads: string[] = [];
  let deletes = 0;
  let appAudits = 0;
  let receiptReads = 0;
  let receiptCommandId: string | null = null;
  let synchronizations = 0;
  let seoCalls = 0;
  const unexpectedSeoCalculation = () => {
    seoCalls += 1;
    throw new Error("Permanent deletion must not resolve or calculate Entity SEO.");
  };
  const topic = {
    id: TOPIC_ID,
    title: "موضوع مرتبط",
    slug: "linked-topic",
    content_type: "article",
    deleted_at: "2026-09-13T10:00:00.000Z",
  };
  const internalLink = {
    link_kind: "internal", linked_type: "topics", linked_id: TOPIC_ID,
    href: TOPIC_PATH, target: "_self",
  };

  function readData(stage: string): unknown {
    const used = options.usageStage === stage;
    if (stage.startsWith("path:")) {
      return options.pathMissing ? null : { slug: topic.slug, path: TOPIC_PATH, content_type: topic.content_type };
    }
    if (stage.startsWith("menu:")) {
      return used ? [{ id: 91, label: "رابط", menu_id: 8, href: TOPIC_PATH, menus: { name: "قائمة" } }] : [];
    }
    if (stage === "footer.slots") {
      if (options.slotsMissing) return null;
      return { value: { slots: used ? [{ config: { cta: { link: internalLink } } }] : [] } };
    }
    if (stage === "footer.contact_items") return { value: used ? [{ href: TOPIC_PATH }] : [] };
    const configs: Record<string, unknown> = {
      hero_templates: { primaryCtaLink: internalLink },
      cta_block_templates: { primaryCta: { link: internalLink } },
      content_block_templates: { button: { href: TOPIC_PATH } },
      cards_block_templates: { items: [{ link: internalLink }] },
      breadcrumb_block_templates: { manualItems: [{ href: TOPIC_PATH }] },
    };
    assert.ok(Object.hasOwn(configs, stage), `Unexpected read stage: ${stage}`);
    return used ? [{ id: 92, name: "مرجع", config: configs[stage] }] : [];
  }

  const supabase = {
    from(table: string) {
      let columns = "";
      const filters = new Map<string, unknown>();
      let ids: number[] = [];
      const query = {
        select(value: string) { columns = value; return query; },
        eq(key: string, value: unknown) { filters.set(key, value); return query; },
        contains(key: string, value: unknown) { filters.set(key, value); return query; },
        in(key: string, value: number[]) { assert.equal(key, "id"); ids = value; return query; },
        not(key: string, operator: string, value: unknown) {
          assert.deepEqual([key, operator, value], ["deleted_at", "is", null]);
          return query;
        },
        order() { return query; },
        delete: unexpected,
        insert: unexpected,
        update: unexpected,
        upsert: unexpected,
        async maybeSingle() { return execute(); },
        then(onFulfilled: (result: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          return execute().then(onFulfilled, onRejected);
        },
      };
      async function execute() {
        if (table === "admin_audit_logs") {
          assert.equal(columns, "metadata");
          assert.equal(filters.get("actor_admin_user_id"), 73);
          const commandId = (filters.get("metadata") as { command: { id: string } }).command.id;
          assert.match(commandId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u);
          receiptCommandId = commandId;
          receiptReads += 1;
          return { data: null, error: null };
        }
        if (table === "topics" && columns === "id,title,slug,content_type,deleted_at") {
          assert.deepEqual(ids, [TOPIC_ID]);
          return { data: [topic], error: null };
        }
        const stage = table === "site_settings"
          ? String(filters.get("key"))
          : table === "menu_items"
            ? filters.has("href") ? "menu:href" : "menu:typed"
            : RESOURCE_TYPES.includes(table as typeof RESOURCE_TYPES[number])
              ? `path:${table}`
              : table;
        reads.push(stage);
        if (options.failureStage === stage) {
          if (options.failureMode === "thrown") throw new Error(RAW_ERROR);
          // Also provide plausible data: an error must never be ignored merely
          // because a response happens to contain a usable-looking data value.
          return { data: readData(stage), error: { code: "XX000", message: RAW_ERROR } };
        }
        return { data: readData(stage), error: null };
      }
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "admin_mutate_topics_batch_atomically");
      assert.equal(args.p_action, "permanent_delete");
      assert.deepEqual(args.p_topic_ids, [TOPIC_ID]);
      assert.equal(args.p_actor_id, 73);
      assert.equal(args.p_command_id, receiptCommandId, "The RPC must use the identity checked by the receipt pre-read.");
      assert.equal(typeof args.p_command_id, "string");
      assert.match(args.p_command_id as string, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u);
      deletes += 1;
      // The real RPC owns its atomic audit; this action fixture acknowledges
      // that command and forbids an additional best-effort application audit.
      return { data: { ok: true, commandId: args.p_command_id, requestedIds: [TOPIC_ID], changedIds: [TOPIC_ID] }, error: null };
    },
  };

  const usage = loadSource<typeof import("../src/lib/admin/links/usage")>("src/lib/admin/links/usage.ts", {
    "server-only": {},
    "../../supabase-admin": { getSupabaseAdmin: () => supabase },
    "../content/content-types": contentTypes,
    "../../content/public-content-path": publicPaths,
    "./serialize": serialization,
    "../../projects/public-helpers": projectPaths,
  });
  const cache = loadSource("src/lib/cache/revalidate-public-cache-tags.ts", {
    "server-only": {},
    "next/cache": { revalidatePath: () => undefined, revalidateTag: () => undefined, updateTag: () => undefined },
    "./public-cache-generation": { advancePublicCacheGeneration: async () => { throw new Error("Topics SWR deletion must not advance the public cache generation"); } },
  });
  const dependencies: Record<string, unknown> = {
    "node:async_hooks": { AsyncLocalStorage },
    "../../../../lib/admin/seo/entity-seo-persistence": {
      toTopicSeoScoreInput: unexpectedSeoCalculation,
      deriveEntitySeoScore: unexpectedSeoCalculation,
    },
    "next/cache": { revalidatePath: () => undefined },
    "../../../../lib/admin/auth/require-admin-session": { requireAdminSession: async () => ({ id: 73 }) },
    "../../../../lib/admin/admin-action-result": actionResults,
    "../../../../lib/admin/audit/cms-audit-actions": { buildCmsAuditAction: () => "topic.permanent_delete" },
    "../../../../lib/admin/audit-log": { recordCmsAdminAudit: async () => { appAudits += 1; } },
    "../../../../lib/admin/content-workflow/media-publish-validation": {},
    "../../../../lib/admin/content-workflow/topic-publish-validation": {},
    "../../../../lib/admin/content-workflow/content-review-capability": {},
    "../../../../lib/admin/content/content-types": contentTypes,
    "../../../../lib/admin/content-routes": {
      ADMIN_CONTENT_ROUTES: { topics: "/admin/content/topics" },
      adminContentTopicPath: (id: number) => `/admin/content/topics/${id}`,
    },
    "../../../../lib/content-public-visibility": {},
    "../../../../lib/cache/revalidate-public-cache-tags": cache,
    "../../../../lib/media-center/revalidate-public-paths": { revalidateMediaCenterPublicPaths: () => undefined },
    "../../../../lib/admin/content/topics-list-config": {},
    "../../../../lib/admin/content/topics-bulk-publish": {},
    "../../../../lib/admin/preferences/admin-column-preferences": {},
    "../../../../lib/supabase-admin": { getSupabaseAdmin: () => supabase },
    "../../../../lib/logging": { logError: () => undefined },
    "../../../../lib/admin/content/category-hierarchy": {},
    "../../../../lib/admin/media-catalog/domain-write-coordination": { coordinateMediaReferenceEntityMutation: unexpected },
    "../../../../lib/admin/media-catalog/synchronization": {
      synchronizeMediaReferenceWriteScopesAfterDomainMutation: async () => {
        synchronizations += 1;
        return { status: "synchronized" };
      },
    },
    "../../../../lib/admin/media-catalog/write-lease": { MediaReferenceWriteLeaseError: class extends Error {} },
    "../../../../lib/admin/links/usage": usage,
    "../../../../lib/admin/media-topic-payload": {},
  };
  const actions = loadSource<{
    permanentlyDeleteUnifiedContent(input: FormData): Promise<AdminActionResult>;
  }>("src/app/admin/content/topics/actions.ts", dependencies);

  return {
    usage,
    reads,
    effects: () => ({ deletes, appAudits, synchronizations }),
    async remove() {
      const input = new FormData();
      input.set("id", String(TOPIC_ID));
      input.set("confirm_permanent", "true");
      const result = await actions.permanentlyDeleteUnifiedContent(input);
      assert.equal(receiptReads, 1, "The real action checks its durable command receipt before mutation.");
      assert.equal(seoCalls, 0, "Non-SEO permanent deletion must never enter scoring, including failure paths.");
      return result;
    },
  };
}

let passed = 0;
let failed = 0;
async function check(label: string, run: () => Promise<void>) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const topicQuery: LinkUsageQuery = { linkedType: "topics", linkedId: TOPIC_ID };
for (const linkedType of RESOURCE_TYPES) {
  for (const failureMode of ["returned", "thrown"] as const) {
    await check(`${linkedType} path ${failureMode} error rejects usage count safely`, async () => {
      const proof = fixture({ failureStage: `path:${linkedType}`, failureMode });
      await assert.rejects(proof.usage.getResourceLinkUsageCount({ linkedType, linkedId: TOPIC_ID }), { message: SAFE_ERROR });
      assert.deepEqual(proof.effects(), { deletes: 0, appAudits: 0, synchronizations: 0 });
    });
  }
}

for (const failureStage of READ_STAGES) {
  for (const failureMode of ["returned", "thrown"] as const) {
    await check(`real delete action stops on ${failureStage} ${failureMode} error`, async () => {
      const proof = fixture({ failureStage, failureMode });
      const result = await proof.remove();
      assert.equal(result.ok, false);
      assert.equal(result.feedbackStatus, "error");
      assert.equal(result.message, SAFE_ERROR);
      assert.deepEqual(proof.effects(), { deletes: 0, appAudits: 0, synchronizations: 0 });
      assert.ok(proof.reads.includes(failureStage));
    });
  }
}

for (const usageStage of READ_STAGES.filter((stage) => !stage.startsWith("path:"))) {
  await check(`real ${usageStage} usage blocks actual delete action`, async () => {
    const proof = fixture({ usageStage });
    assert.equal(await proof.usage.isResourceLinked(topicQuery), true);
    const result = await proof.remove();
    assert.equal(result.ok, false);
    assert.match(result.message, /مستخدم في 1 من الروابط الداخلية/u);
    assert.deepEqual(proof.effects(), { deletes: 0, appAudits: 0, synchronizations: 0 });
  });
}

for (const failureMode of ["returned", "thrown"] as const) {
  await check(`footer contacts ${failureMode} error still blocks when slots are absent`, async () => {
    const proof = fixture({ slotsMissing: true, failureStage: "footer.contact_items", failureMode });
    const result = await proof.remove();
    assert.equal(result.ok, false);
    assert.equal(result.message, SAFE_ERROR);
    assert.deepEqual(proof.effects(), { deletes: 0, appAudits: 0, synchronizations: 0 });
  });
}

await check("footer contact link still blocks when slots are absent", async () => {
  const proof = fixture({ slotsMissing: true, usageStage: "footer.contact_items" });
  const result = await proof.remove();
  assert.equal(result.ok, false);
  assert.match(result.message, /مستخدم في 1 من الروابط الداخلية/u);
  assert.deepEqual(proof.effects(), { deletes: 0, appAudits: 0, synchronizations: 0 });
});

for (const slotsMissing of [false, true]) {
  await check(`complete successful zero usage allows one atomic purge RPC (slots missing=${slotsMissing})`, async () => {
    const proof = fixture({ slotsMissing });
    assert.equal(await proof.usage.getResourceLinkUsageCount(topicQuery), 0);
    assert.equal(await proof.usage.isResourceLinked(topicQuery), false);
    const result = await proof.remove();
    assert.equal(result.ok, true);
    assert.equal(result.code, "permanently_deleted");
    assert.equal(result.completion, "committed");
    assert.deepEqual(proof.effects(), { deletes: 1, appAudits: 0, synchronizations: 1 });
    assert.deepEqual([...new Set(proof.reads)].sort(), [...READ_STAGES].sort());
  });
}

await check("absent path preserves typed menu matching without inventing an href query", async () => {
  const proof = fixture({ pathMissing: true, usageStage: "menu:typed" });
  assert.equal(await proof.usage.getResourceLinkUsageCount(topicQuery), 1);
  assert.equal(proof.reads.includes("menu:href"), false);
});

console.log(`Link usage fail-closed proof: ${passed} passed, ${failed} failed; isolated actual owners, zero real DB/network writes.`);
if (failed > 0) process.exitCode = 1;
