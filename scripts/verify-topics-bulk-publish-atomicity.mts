import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = "src/lib/admin/content/topics-bulk-publish.ts";
const ACTION_PATH = "src/app/admin/content/topics/actions.ts";
const CACHE_OWNER_PATH = "src/lib/cache/revalidate-public-cache-tags.ts";
const REFERENCE_PROVIDERS_PATH =
  "src/lib/admin/media-catalog/reference-providers.ts";
const MIGRATION_PATH =
  "sql/migrations/20260905090000_topics_bulk_publish_atomicity.sql";

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n");
}

function sourceSection(
  source: string,
  startToken: string,
  endToken?: string,
) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `Missing source section start: ${startToken}`);
  if (!endToken) return source.slice(start);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `Missing source section end: ${endToken}`);
  return source.slice(start, end);
}

function countMatches(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].length;
}

function loadTypeScriptModule<T>(
  path: string,
  dependencies: Readonly<Record<string, unknown>>,
) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: path,
  }).outputText;
  const commonJsModule = { exports: {} as T };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier: string) => {
      if (Object.hasOwn(dependencies, specifier)) {
        return dependencies[specifier];
      }
      throw new Error(`Unsupported isolated dependency: ${specifier}`);
    },
  );
  return commonJsModule.exports;
}

function walkSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(path);
    return entry.isFile() && [".ts", ".tsx"].includes(extname(entry.name))
      ? [path]
      : [];
  });
}

type TopicMutationOperation = "insert" | "update" | "upsert" | "delete";

function findChainedFromCall(node: ts.Node): ts.CallExpression | null {
  if (ts.isCallExpression(node)) {
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length === 1
    ) {
      return node;
    }
    return findChainedFromCall(node.expression);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return findChainedFromCall(node.expression);
  }
  if (ts.isElementAccessExpression(node)) {
    return findChainedFromCall(node.expression);
  }
  return null;
}

function chainContainsTopicsFrom(node: ts.Node): boolean {
  const fromCall = findChainedFromCall(node);
  return Boolean(
    fromCall &&
      ts.isStringLiteralLike(fromCall.arguments[0]) &&
      fromCall.arguments[0].text === "topics",
  );
}

function directTopicMutations(path: string) {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const mutations: TopicMutationOperation[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["insert", "update", "upsert", "delete"].includes(
        node.expression.name.text,
      ) &&
      chainContainsTopicsFrom(node.expression.expression)
    ) {
      mutations.push(node.expression.name.text as TopicMutationOperation);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return mutations.sort();
}

function dynamicTableMutations(path: string) {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const mutations: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["insert", "update", "upsert", "delete"].includes(
        node.expression.name.text,
      )
    ) {
      const fromCall = findChainedFromCall(node.expression.expression);
      const tableArgument = fromCall?.arguments[0];
      if (tableArgument && !ts.isStringLiteralLike(tableArgument)) {
        mutations.push(
          `${node.expression.name.text}:${tableArgument.getText(sourceFile)}`,
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return mutations.sort();
}

type SqlFunctionSource = {
  body: string;
  fullSource: string;
  path: string;
};

function latestPublicSqlFunctions() {
  const functions = new Map<string, SqlFunctionSource>();
  const migrationsDirectory = join(ROOT, "sql/migrations");
  const migrationPaths = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of migrationPaths) {
    const path = `sql/migrations/${name}`;
    const source = read(path);
    const lifecycleEvent =
      /^[\t ]*(?:create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(|drop\s+function\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s*\()/gimu;
    for (const match of source.matchAll(lifecycleEvent)) {
      const createdFunctionName = match[1];
      const droppedFunctionName = match[2];
      if (droppedFunctionName) {
        functions.delete(droppedFunctionName);
        continue;
      }

      assert.ok(createdFunctionName);
      const declarationOffset = match[0].search(/\bcreate\b/iu);
      assert.notEqual(declarationOffset, -1);
      const functionName = createdFunctionName;
      const start = (match.index ?? 0) + declarationOffset;
      const remainder = source.slice(start);
      const bodyMarker = /\bas\s+(\$[a-z0-9_]*\$)/iu.exec(remainder);
      assert.ok(bodyMarker, `Unable to find SQL body marker for ${functionName}`);
      const marker = bodyMarker[1];
      const bodyStart = start + (bodyMarker.index ?? 0) + bodyMarker[0].length;
      const bodyEnd = source.indexOf(marker, bodyStart);
      assert.notEqual(bodyEnd, -1, `Unable to close SQL body for ${functionName}`);
      functions.set(functionName, {
        body: source.slice(bodyStart, bodyEnd),
        fullSource: source.slice(start, bodyEnd + marker.length),
        path,
      });
    }
  }
  return functions;
}

for (const path of [
  CONTRACT_PATH,
  ACTION_PATH,
  CACHE_OWNER_PATH,
  REFERENCE_PROVIDERS_PATH,
  MIGRATION_PATH,
]) {
  assert.ok(existsSync(join(ROOT, path)), `${path} must exist`);
}

const nativeRequire = createRequire(import.meta.url);
const moduleLoader = nativeRequire("node:module") as {
  _load(request: string, parent: NodeModule | null, isMain: boolean): unknown;
};
const originalLoad = moduleLoader._load;
moduleLoader._load = (request, parent, isMain) =>
  request === "server-only"
    ? {}
    : originalLoad(request, parent, isMain);
nativeRequire.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  (module as NodeModule & {
    _compile(source: string, filename: string): void;
  })._compile(output, filename);
};

const contract = nativeRequire(
  join(ROOT, CONTRACT_PATH),
) as typeof import("../src/lib/admin/content/topics-bulk-publish.ts");
const contractSource = read(CONTRACT_PATH);
const cacheOwnerSource = read(CACHE_OWNER_PATH);
const cacheOwner = loadTypeScriptModule<
  Pick<
    typeof import("../src/lib/cache/revalidate-public-cache-tags.ts"),
    | "PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS"
    | "runBoundedPublicCacheRevalidation"
  >
>(CACHE_OWNER_PATH, {
  "server-only": {},
  "next/cache": {
    revalidatePath: () => undefined,
    revalidateTag: () => undefined,
    updateTag: () => undefined,
  },
});

const {
  TOPICS_BULK_PUBLISH_MAX_ITEMS,
  createTopicsBulkPublishSafeMetadata,
  parseTopicsBulkPublishIds,
  parseTopicsBulkPublishRpcResult,
  runTopicsBulkPublishPostCommit,
} = contract;
const {
  PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS,
  runBoundedPublicCacheRevalidation,
} = cacheOwner;

assert.equal(TOPICS_BULK_PUBLISH_MAX_ITEMS, 50);
assert.match(
  contractSource,
  /import\s*\{\s*TOPICS_LIST_MAX_PAGE_SIZE\s*\}\s*from\s*["']\.\/topics-list-config["']/u,
);
assert.match(
  contractSource,
  /TOPICS_BULK_PUBLISH_MAX_ITEMS\s*=\s*TOPICS_LIST_MAX_PAGE_SIZE/u,
);

const normalized = parseTopicsBulkPublishIds(["7", "2"]);
assert.deepEqual(normalized, { ok: true, ids: [2, 7] });

const duplicateIds = parseTopicsBulkPublishIds(["7", "2", "7", "2"]);
assert.deepEqual(duplicateIds, {
  ok: false,
  code: "duplicate_ids",
  duplicateIds: [2, 7],
});

const duplicateHeavy = parseTopicsBulkPublishIds(
  Array.from({ length: TOPICS_BULK_PUBLISH_MAX_ITEMS + 1 }, () => "9"),
);
assert.deepEqual(duplicateHeavy, {
  ok: false,
  code: "batch_limit",
  limit: TOPICS_BULK_PUBLISH_MAX_ITEMS,
});

const overLimit = parseTopicsBulkPublishIds(
  Array.from(
    { length: TOPICS_BULK_PUBLISH_MAX_ITEMS + 1 },
    (_, index) => String(index + 1),
  ),
);
assert.deepEqual(overLimit, {
  ok: false,
  code: "batch_limit",
  limit: TOPICS_BULK_PUBLISH_MAX_ITEMS,
});
assert.deepEqual(parseTopicsBulkPublishIds(["1", "invalid"]), {
  ok: false,
  code: "invalid_input",
});

const parsedSuccess = parseTopicsBulkPublishRpcResult({
  ok: true,
  code: "published",
  requestedIds: [2, 7],
  publishedIds: [2],
  alreadyPublishedIds: [7],
  committedAt: "2026-09-05T09:00:00.000Z",
  auditIds: [101],
});
assert.equal(parsedSuccess.ok, true);
assert.equal(parsedSuccess.code, "published");

for (const malformed of [
  null,
  {},
  { ok: true, code: "published" },
  {
    ok: true,
    code: "published",
    requestedIds: [1],
    publishedIds: [1],
    alreadyPublishedIds: [],
    committedAt: "2026-09-05T09:00:00.000Z",
    auditIds: [],
  },
  {
    ok: true,
    code: "published",
    requestedIds: [1],
    publishedIds: [1],
    alreadyPublishedIds: [1],
    committedAt: "2026-09-05T09:00:00.000Z",
    auditIds: [10],
  },
  {
    ok: true,
    code: "published",
    requestedIds: [1],
    publishedIds: [1],
    alreadyPublishedIds: [],
    committedAt: "not-a-timestamp",
    auditIds: [10],
  },
  { ok: false, code: "unknown" },
  { ok: false, code: "batch_limit", limit: 49 },
  { ok: false, code: "duplicate_ids", duplicateIds: [2, 2] },
  { ok: false, code: "missing_topics", topic_ids: [1] },
]) {
  assert.throws(() => parseTopicsBulkPublishRpcResult(malformed));
}

const metadata = createTopicsBulkPublishSafeMetadata(
  [7, 2],
  "topics-bulk-publish-test-correlation",
);
assert.deepEqual(metadata, {
  topic_ids: [7, 2],
  count: 2,
  correlation_id: "topics-bulk-publish-test-correlation",
});

assert.equal(PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS, 2);
assert.match(
  cacheOwnerSource,
  /PUBLIC_CACHE_REVALIDATION_MAX_ATTEMPTS\s*=\s*2/u,
);
let recoveredCacheAttempts = 0;
const recoveredCacheResult = await runBoundedPublicCacheRevalidation(() => {
  recoveredCacheAttempts += 1;
  if (recoveredCacheAttempts === 1) {
    throw new Error("injected first cache failure");
  }
});
assert.deepEqual(recoveredCacheResult, { ok: true, attempts: 2 });
assert.equal(recoveredCacheAttempts, 2);

let exhaustedCacheAttempts = 0;
const exhaustedCacheResult = await runBoundedPublicCacheRevalidation(() => {
  exhaustedCacheAttempts += 1;
  throw new Error("injected persistent cache failure");
});
assert.equal(exhaustedCacheResult.ok, false);
assert.equal(exhaustedCacheResult.attempts, 2);
assert.equal(exhaustedCacheAttempts, 2);
if (exhaustedCacheResult.ok) {
  assert.fail("Persistent cache failure must return the bounded pending state.");
}
assert.ok(exhaustedCacheResult.error instanceof Error);

const postCommitEvents: string[] = [];
const postCommitResult = await runTopicsBulkPublishPostCommit(metadata, {
  cacheInvalidations: [
    {
      name: "topics-cache",
      run: () => {
        postCommitEvents.push("cache:topics");
        throw new Error("injected topics cache failure");
      },
    },
    {
      name: "admin-list-cache",
      run: () => {
        postCommitEvents.push("cache:admin-list");
      },
    },
  ],
  runCacheInvalidation: runBoundedPublicCacheRevalidation,
  logError: (message, error, safeMetadata) => {
    assert.match(message, /cache[\s\S]*2 attempts/iu);
    assert.ok(error instanceof Error);
    assert.deepEqual(safeMetadata, metadata);
    postCommitEvents.push("log");
  },
});
assert.deepEqual(postCommitEvents, [
  "cache:topics",
  "cache:topics",
  "log",
  "cache:admin-list",
]);
assert.deepEqual(postCommitResult, {
  feedbackStatus: "warning",
  code: "committed_cache_revalidation_pending",
  correlationId: "topics-bulk-publish-test-correlation",
  failedCacheOperations: ["topics-cache"],
});

const successfulPostCommitResult = await runTopicsBulkPublishPostCommit(metadata, {
  cacheInvalidations: [],
  runCacheInvalidation: runBoundedPublicCacheRevalidation,
  logError: () => assert.fail("Successful cache completion must not log."),
});
assert.deepEqual(successfulPostCommitResult, {
  feedbackStatus: "success",
  code: "published",
  failedCacheOperations: [],
});

async function verifyCommittedRpcPayloadWarningComposition() {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;

      create table public.admin_users (
        id bigint primary key,
        username text not null,
        is_active boolean not null
      );

      create table public.admin_audit_logs (
        id bigserial primary key,
        actor_admin_user_id bigint references public.admin_users(id),
        actor_username text not null,
        action text not null,
        entity_type text,
        entity_id bigint,
        entity_label text,
        metadata jsonb not null default '{}'::jsonb,
        ip_address text,
        user_agent text,
        created_at timestamptz not null default now()
      );

      create table public.topics (
        id bigint primary key,
        title text,
        status text not null,
        published_at timestamptz,
        published_by bigint,
        updated_by bigint,
        updated_at timestamptz not null,
        deleted_at timestamptz
      );

      insert into public.admin_users(id, username, is_active)
      values (1, 'topics-pglite-actor', true);
      insert into public.topics(
        id, title, status, published_at, published_by, updated_by, updated_at, deleted_at
      ) values
        (41, 'Topic 41', 'unpublished', null, null, null, '2026-09-05T06:00:41Z', null),
        (42, 'Topic 42', 'unpublished', null, null, null, '2026-09-05T06:00:42Z', null);
    `);
    await db.exec(read(MIGRATION_PATH));
    await db.exec(`
      grant usage on schema public to service_role;
      grant select, update on public.admin_users to service_role;
      grant select, update on public.topics to service_role;
      grant insert on public.admin_audit_logs to service_role;
      grant select (id) on public.admin_audit_logs to service_role;
      grant usage, select on sequence public.admin_audit_logs_id_seq
        to service_role;
    `);

    const expectedRevisions = (
      await db.query<{ id: bigint; updated_at: string }>(`
        select id, updated_at::text as updated_at
        from public.topics
        order by id
      `)
    ).rows.map((row) => ({
      id: Number(row.id),
      expected_updated_at: row.updated_at,
    }));

    let rpcPayload: unknown;
    await db.exec("set role service_role");
    try {
      rpcPayload = (
        await db.query<{ payload: unknown }>(
          `select public.admin_publish_topics_atomically($1, $2::jsonb) as payload`,
          [1, JSON.stringify(expectedRevisions)],
        )
      ).rows[0]?.payload;
    } finally {
      await db.exec("reset role");
    }

    const parsedRpcPayload = parseTopicsBulkPublishRpcResult(rpcPayload);
    assert.equal(parsedRpcPayload.ok, true);
    if (!parsedRpcPayload.ok) {
      assert.fail("Expected a committed PGlite publish payload.");
    }

    const composedEvents: string[] = [];
    const composedResult = await runTopicsBulkPublishPostCommit(
      createTopicsBulkPublishSafeMetadata(
        parsedRpcPayload.requestedIds,
        "topics-bulk-publish-composed-pglite",
      ),
      {
        cacheInvalidations: [
          {
            name: "injected-composed-cache",
            run: () => {
              composedEvents.push("cache");
              throw new Error("injected composed cache failure");
            },
          },
        ],
        runCacheInvalidation: runBoundedPublicCacheRevalidation,
        logError: () => {
          composedEvents.push("log");
        },
      },
    );
    assert.deepEqual(composedEvents, ["cache", "cache", "log"]);
    assert.deepEqual(composedResult, {
      feedbackStatus: "warning",
      code: "committed_cache_revalidation_pending",
      correlationId: "topics-bulk-publish-composed-pglite",
      failedCacheOperations: ["injected-composed-cache"],
    });

    const committedRows = (
      await db.query<{ status: string; updated_at: string }>(`
        select status, updated_at::text as updated_at
        from public.topics
        where id = any($1::bigint[])
        order by id
      `, [parsedRpcPayload.requestedIds])
    ).rows;
    assert.equal(committedRows.length, parsedRpcPayload.requestedIds.length);
    assert.ok(committedRows.every((row) => row.status === "published"));
    assert.ok(
      committedRows.every(
        (row) =>
          new Date(row.updated_at).getTime() ===
          new Date(parsedRpcPayload.committedAt).getTime(),
      ),
    );
  } finally {
    await db.close();
  }
}

await verifyCommittedRpcPayloadWarningComposition();

const actions = read(ACTION_PATH);
const publishBranch = sourceSection(
  actions,
  'if (action === "publish")',
  '} else if (action === "unpublish")',
);
assert.doesNotMatch(
  publishBranch,
  /Promise\.all\s*\(/u,
  "Bulk publish must not execute independent Promise.all writes.",
);
assert.match(
  publishBranch,
  /\.rpc\(\s*["']admin_publish_topics_atomically["']/u,
);
assert.match(publishBranch, /p_actor_id\s*:\s*actor\.id/u);
assert.match(publishBranch, /p_topics\s*:/u);
assert.match(publishBranch, /expected_updated_at\s*:\s*topic\.updated_at/u);
assert.match(publishBranch, /parseTopicsBulkPublishRpcResult/u);
assert.match(publishBranch, /runTopicsBulkPublishPostCommit/u);
assert.match(publishBranch, /runBoundedPublicCacheRevalidation/u);
assert.match(publishBranch, /postCommit\.feedbackStatus\s*===\s*["']warning["']/u);
assert.match(publishBranch, /adminActionWarning\s*\(/u);
assert.match(
  publishBranch,
  /code\s*:\s*["']committed_cache_revalidation_pending["']/u,
);
assert.match(publishBranch, /correlationId\s*:\s*postCommit\.correlationId/u);
assert.doesNotMatch(publishBranch, /recordCmsAdminAudit\s*\(/u);
assert.doesNotMatch(publishBranch, /outbox|guaranteed retry|crash-safe/iu);
assert.match(publishBranch, /code\s*:\s*["']missing_topics["']/u);
assert.match(publishBranch, /code\s*:\s*["']deleted_topics["']/u);
assert.match(publishBranch, /topic\.status\s*!==\s*["']published["']/u);

assert.match(actions, /parseTopicsBulkPublishIds/u);
assert.match(contractSource, /code:\s*["']duplicate_ids["']/u);
assert.match(contractSource, /requestedIds:\s*requestedTopicIdsSchema/u);
assert.match(contractSource, /publishedIds:\s*optionalTopicIdsSchema/u);
assert.match(contractSource, /alreadyPublishedIds:\s*optionalTopicIdsSchema/u);
assert.match(contractSource, /committedAt:\s*z\.string\(\)\.datetime/u);
assert.match(contractSource, /auditIds:\s*auditIdsSchema/u);
assert.doesNotMatch(
  publishBranch,
  /ids\.length\s*>\s*50|Math\.min\([^)]*50/u,
  "The Action must use the shared batch contract rather than a local limit.",
);

const topicPublishAdapter = read(
  "src/lib/admin/content-workflow/topic-publish-validation.ts",
);
const mediaPublishAdapter = read(
  "src/lib/admin/content-workflow/media-publish-validation.ts",
);
for (const source of [topicPublishAdapter, mediaPublishAdapter]) {
  assert.match(source, /from ["']\.\/content-review-capability["']/u);
  assert.match(source, /getContentPublishBlockingChecks/u);
}
const publishFailureOwner = sourceSection(
  actions,
  "function getPublishFailure",
  "function invalidMutation",
);
assert.match(publishBranch, /getPublishFailure/u);
assert.match(publishFailureOwner, /getTopicPublishBlockingChecks/u);
assert.match(publishFailureOwner, /topicRowToPublishInput/u);
assert.match(publishFailureOwner, /getMediaPublishBlockingChecks/u);
assert.match(publishFailureOwner, /mediaRowToPublishInput/u);

const migration = read(MIGRATION_PATH);
const sqlLimit = /v_batch_limit\s+constant\s+integer\s*:=\s*(\d+)\s*;/iu.exec(
  migration,
);
assert.ok(sqlLimit, "Migration must expose the drift-proof SQL batch marker.");
assert.equal(Number(sqlLimit[1]), TOPICS_BULK_PUBLISH_MAX_ITEMS);
assert.match(migration, /v_item_count\s*>\s*v_batch_limit/iu);
assert.match(migration, /'code'\s*,\s*'duplicate_ids'[\s\S]*'duplicateIds'/iu);
assert.match(migration, /'code'\s*,\s*'missing_topics'[\s\S]*'topicIds'/iu);
assert.match(migration, /'code'\s*,\s*'deleted_topics'[\s\S]*'topicIds'/iu);

const sqlFunctions = latestPublicSqlFunctions();
const publishRpc = sqlFunctions.get("admin_publish_topics_atomically");
assert.ok(publishRpc, "The atomic Topics publish RPC must be the active SQL owner.");
assert.equal(publishRpc.path, MIGRATION_PATH);
assert.match(publishRpc.fullSource, /returns\s+jsonb/iu);
assert.match(publishRpc.fullSource, /language\s+plpgsql/iu);
assert.match(publishRpc.fullSource, /\bvolatile\b/iu);
assert.match(publishRpc.fullSource, /security\s+invoker/iu);
assert.match(publishRpc.fullSource, /set\s+search_path\s*=\s*''/iu);
assert.match(publishRpc.body, /public\.admin_users/iu);
assert.match(publishRpc.body, /is_active\s+is\s+true/iu);
assert.match(
  publishRpc.body,
  /select\s+admin_user\.username[^;]*?from\s+public\.admin_users\s+as\s+admin_user[^;]*?is_active\s+is\s+true[^;]*?for\s+share/iu,
  "The active Admin actor row must stay locked through the publish transaction.",
);
assert.match(publishRpc.body, /public\.topics/iu);
assert.match(publishRpc.body, /order\s+by\s+[^;]*id[\s\S]*for\s+update/iu);
assert.match(publishRpc.body, /expected_updated_at/iu);
assert.equal(
  countMatches(publishRpc.body, /update\s+public\.topics\b/giu),
  1,
  "The RPC must own one set-based Topics update.",
);
assert.match(publishRpc.body, /published_at\s*=\s*coalesce\s*\(/iu);
assert.match(publishRpc.body, /status\s+is\s+distinct\s+from\s+'published'/iu);
assert.doesNotMatch(publishRpc.body, /\bexecute\b/iu);
assert.equal(
  countMatches(publishRpc.body, /insert\s+into\s+public\.admin_audit_logs\b/giu),
  1,
  "The RPC must own one transactional Audit insert for newly published Topics.",
);
assert.match(publishRpc.body, /'topic\.publish'/u);
assert.match(publishRpc.body, /entity_id[\s\S]*topic\.id/iu);
assert.match(publishRpc.body, /returning\s+id/iu);
assert.match(publishRpc.body, /'auditIds'\s*,\s*v_audit_ids/u);
assert.doesNotMatch(publishRpc.body, /outbox/iu);

for (const semanticField of [
  "slug",
  "excerpt",
  "content_type",
  "media_payload",
  "seo_title",
  "seo_description",
  "focus_keyword",
  "canonical_url",
  "og_image",
  "og_image_alt",
  "image_alt",
  "category_slug",
  "faq",
]) {
  assert.doesNotMatch(
    publishRpc.body,
    new RegExp(`\\b${semanticField}\\b`, "iu"),
    `The RPC must not duplicate semantic validation for ${semanticField}.`,
  );
}

assert.match(
  migration,
  /revoke\s+all\s+on\s+function\s+public\.admin_publish_topics_atomically\(bigint,\s*jsonb\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/iu,
);
assert.match(
  migration,
  /grant\s+execute\s+on\s+function\s+public\.admin_publish_topics_atomically\(bigint,\s*jsonb\)\s+to\s+service_role/iu,
);

type RebindProviderRuntime = {
  domainKey: string;
  table: string;
  supportsRebind: boolean;
  rebind(reference: Record<string, unknown>, nextPublicValue: string): Promise<void>;
};

type ReferenceProvidersRuntime = {
  MEDIA_REFERENCE_PROVIDER_REGISTRY: RebindProviderRuntime[];
  getMediaReferenceProvider(domainKey: string): RebindProviderRuntime | null;
};

const previousMediaValue = "/images/topics/original.jpg";
const nextMediaValue = "/images/topics/rebound.jpg";
const previousRevision = "2020-01-01T00:00:00.000Z";
const rebindCapture: { update: Record<string, unknown> | null } = {
  update: null,
};
const capturedRebindComparisons: [string, unknown][] = [];
const rebindSupabase = {
  from(table: string) {
    assert.equal(table, "topics");
    let isUpdate = false;
    const query = {
      select() {
        return query;
      },
      update(payload: unknown) {
        assert.ok(payload && typeof payload === "object" && !Array.isArray(payload));
        rebindCapture.update = payload as Record<string, unknown>;
        isUpdate = true;
        return query;
      },
      eq(field: string, value: unknown) {
        if (isUpdate) capturedRebindComparisons.push([field, value]);
        return query;
      },
      single() {
        return Promise.resolve({
          data: {
            id: 42,
            image: previousMediaValue,
            updated_at: previousRevision,
          },
          error: null,
        });
      },
      maybeSingle() {
        assert.equal(isUpdate, true);
        return Promise.resolve({ data: { id: 42 }, error: null });
      },
    };
    return query;
  },
};
const referenceProvidersSource = read(REFERENCE_PROVIDERS_PATH);
const topicsReferenceProviderConfig = sourceSection(
  referenceProvidersSource,
  'domainKey: "topics"',
  'domainKey: "topic_categories"',
);
assert.equal(
  countMatches(topicsReferenceProviderConfig, /revisionField:\s*["']updated_at["']/gu),
  1,
  "The Topics media-reference provider must opt into one updated_at revision write.",
);
assert.match(
  topicsReferenceProviderConfig,
  /revisionField:\s*["']updated_at["']/u,
);
const referenceProvidersRuntime =
  loadTypeScriptModule<ReferenceProvidersRuntime>(REFERENCE_PROVIDERS_PATH, {
    "server-only": {},
    "node:util": nativeRequire("node:util"),
    "../../storage/upload-cms-asset": {
      parseManagedStorageAsset: () => null,
    },
    "../../supabase-admin": { getSupabaseAdmin: () => rebindSupabase },
    "../content/content-types": { isContentType: () => true },
    "../../content/public-content-path": {
      resolvePublicContentPath: () => "/topics/test",
    },
    "./identity": {
      getCanonicalMediaIdentityKey: () => "test-media-identity",
      parseLegacyPublicMediaAsset: () => null,
    },
  });

const topicReferenceProvider =
  referenceProvidersRuntime.getMediaReferenceProvider("topics");
assert.ok(topicReferenceProvider);
const rebindStartedAt = Date.now();
await topicReferenceProvider.rebind(
  {
    identity: {
      provider: "supabase",
      bucket: "cms-images",
      objectKey: "images/topics/original.jpg",
    },
    publicValue: previousMediaValue,
    domainKey: "topics",
    entityType: "topic",
    entityIdentity: "42",
    entityLabel: "Topic 42",
    fieldKey: "image",
    editHref: null,
    publicHref: null,
    referenceState: "active",
    restorable: false,
  },
  nextMediaValue,
);
const rebindFinishedAt = Date.now();
const capturedRebindUpdate = rebindCapture.update;
assert.ok(capturedRebindUpdate);
assert.deepEqual(Object.keys(capturedRebindUpdate).sort(), ["image", "updated_at"]);
assert.equal(capturedRebindUpdate.image, nextMediaValue);
const rebindRevision = capturedRebindUpdate.updated_at;
assert.ok(typeof rebindRevision === "string");
const rebindRevisionTime = Date.parse(rebindRevision);
assert.equal(Number.isFinite(rebindRevisionTime), true);
assert.notEqual(rebindRevision, previousRevision);
assert.ok(rebindRevisionTime >= rebindStartedAt);
assert.ok(rebindRevisionTime <= rebindFinishedAt);
assert.deepEqual(capturedRebindComparisons, [
  ["id", "42"],
  ["image", previousMediaValue],
]);

const actualDynamicTopicWriters =
  referenceProvidersRuntime.MEDIA_REFERENCE_PROVIDER_REGISTRY
    .filter((provider) => provider.table === "topics" && provider.supportsRebind)
    .map(
      (provider) =>
        `${REFERENCE_PROVIDERS_PATH}#${provider.domainKey}.rebind`,
    );
const expectedDynamicTopicWriters = [
  `${REFERENCE_PROVIDERS_PATH}#topics.rebind`,
];
assert.deepEqual(actualDynamicTopicWriters, expectedDynamicTopicWriters);

const expectedDirectWriters = new Map<string, TopicMutationOperation[]>([
  [
    "src/app/admin/content/topics/actions.ts",
    ["delete", "insert", "update", "update", "update", "update", "update"],
  ],
  ["src/app/admin/content/topics/article-actions/create-domain.ts", ["insert"]],
  ["src/app/admin/content/topics/article-actions/save.ts", ["update"]],
  [
    "src/app/admin/content/topics/media-actions/save.ts",
    ["insert", "update"],
  ],
]);

const actualDirectWriters = new Map<string, TopicMutationOperation[]>();
const actualDynamicTableWriters = new Map<string, string[]>();
for (const absolutePath of walkSourceFiles(join(ROOT, "src"))) {
  const mutations = directTopicMutations(absolutePath);
  const dynamicMutations = dynamicTableMutations(absolutePath);
  const relativePath = relative(ROOT, absolutePath).replace(/\\/gu, "/");
  if (mutations.length > 0) {
    actualDirectWriters.set(relativePath, mutations);
  }
  if (dynamicMutations.length > 0) {
    actualDynamicTableWriters.set(relativePath, dynamicMutations);
  }
}
assert.deepEqual(
  [...actualDirectWriters.keys()].sort(),
  [...expectedDirectWriters.keys()].sort(),
  "A direct Topics mutation writer is unknown or a registered writer disappeared.",
);
for (const [path, expectedOperations] of expectedDirectWriters) {
  assert.deepEqual(
    actualDirectWriters.get(path),
    [...expectedOperations].sort(),
    `Direct Topics mutation inventory drifted: ${path}`,
  );
}
const expectedDynamicTableWriters = new Map<string, string[]>([
  [REFERENCE_PROVIDERS_PATH, ["update:config.table"]],
]);
assert.deepEqual(
  [...actualDynamicTableWriters.keys()].sort(),
  [...expectedDynamicTableWriters.keys()].sort(),
  "A dynamic table mutation writer is unknown or the registered writer disappeared.",
);
for (const [path, expectedOperations] of expectedDynamicTableWriters) {
  assert.deepEqual(
    actualDynamicTableWriters.get(path),
    [...expectedOperations].sort(),
    `Dynamic table mutation inventory drifted: ${path}`,
  );
}
assert.deepEqual(
  [...actualDirectWriters.keys(), ...actualDynamicTopicWriters].sort(),
  [...expectedDirectWriters.keys(), ...expectedDynamicTopicWriters].sort(),
  "The tracked Topics writer inventory must include direct and dynamic writers.",
);

const articleHelpers = read(
  "src/app/admin/content/topics/article-actions/helpers.ts",
);
const articleCreate = read(
  "src/app/admin/content/topics/article-actions/create-domain.ts",
);
const articleSave = read(
  "src/app/admin/content/topics/article-actions/save.ts",
);
const mediaHelpers = read(
  "src/app/admin/content/topics/media-actions/helpers.ts",
);
const mediaSave = read(
  "src/app/admin/content/topics/media-actions/save.ts",
);

assert.match(articleHelpers, /function buildTopicWritePayload[\s\S]*updated_at:\s*now/u);
assert.match(articleCreate, /buildTopicWritePayload[\s\S]*\.insert\(\{[\s\S]*\.\.\.writePayload/u);
assert.match(articleSave, /buildTopicWritePayload[\s\S]*\.update\(\{[\s\S]*\.\.\.writePayload/u);
assert.match(articleSave, /\.eq\(["']updated_at["'],\s*expectedRevision\.value\)/u);
assert.match(mediaHelpers, /function buildMediaWritePayload[\s\S]*updated_at:\s*now/u);
assert.match(mediaSave, /buildMediaWritePayload[\s\S]*\.insert\(\{[\s\S]*\.\.\.domainPayload/u);
assert.match(mediaSave, /buildMediaWritePayload[\s\S]*\.update\(\{[\s\S]*\.\.\.domainPayload/u);
assert.match(mediaSave, /\.eq\(["']updated_at["'],\s*expectedRevision\.value\)/u);

for (const [startToken, endToken] of [
  ["export async function setUnifiedContentStatus", "export async function toggleUnifiedContentFeatured"],
  ["export async function toggleUnifiedContentFeatured", "async function createUniqueCopySlug"],
  ["export async function duplicateUnifiedContent", "export async function softDeleteUnifiedContent"],
  ["export async function softDeleteUnifiedContent", "async function restoreTopicsWithCanonicalOwner"],
  ["async function restoreTopicsWithCanonicalOwner", "async function permanentlyDeleteTopicsWithCanonicalOwner"],
] as const) {
  assert.match(
    sourceSection(actions, startToken, endToken),
    /updated_at\s*:\s*now|updated_at\s*:\s*new Date\(\)\.toISOString\(\)/u,
    `${startToken} must advance the Topic revision.`,
  );
}
assert.match(
  sourceSection(actions, "export async function bulkUpdateUnifiedContent"),
  /updated_at\s*:\s*now/u,
);

const activeSqlTopicWriters = new Map(
  [...sqlFunctions.entries()].filter(([, source]) =>
    /(?:update|insert\s+into|delete\s+from)\s+public\.topics\b/iu.test(
      source.body,
    ),
  ),
);
assert.deepEqual(
  [...activeSqlTopicWriters.keys()].sort(),
  [
    "admin_publish_topics_atomically",
    "admin_update_topic_category",
    "admin_update_topic_series",
    "increment_topic_view",
  ],
  "The active SQL Topics writer inventory drifted.",
);

for (const name of [
  "admin_publish_topics_atomically",
  "admin_update_topic_category",
  "admin_update_topic_series",
]) {
  const writer = activeSqlTopicWriters.get(name);
  assert.ok(writer, `Missing active semantic Topics writer: ${name}`);
  assert.match(
    writer.body,
    /updated_at\s*=/iu,
    `${name} must advance updated_at when it changes publish semantics.`,
  );
}

const viewCounter = activeSqlTopicWriters.get("increment_topic_view");
assert.ok(viewCounter, "The non-semantic Topic view counter must stay inventoried.");
const viewCounterSetClause = /update\s+public\.topics\s+set([\s\S]*?)\bwhere\b/iu.exec(
  viewCounter.body,
)?.[1];
assert.ok(viewCounterSetClause, "Unable to isolate the Topic view-counter SET clause.");
assert.match(viewCounterSetClause, /views_count\s*=\s*views_count\s*\+\s*1/iu);
assert.doesNotMatch(viewCounterSetClause, /updated_at\s*=/iu);
for (const semanticField of [
  "title",
  "slug",
  "excerpt",
  "content",
  "image",
  "category_id",
  "category_slug",
  "status",
  "deleted_at",
  "seo_title",
  "seo_description",
  "focus_keyword",
  "canonical_url",
  "og_image",
  "faq",
  "media_payload",
]) {
  assert.doesNotMatch(
    viewCounterSetClause,
    new RegExp(`\\b${semanticField}\\b\\s*=`, "iu"),
    `The view counter must remain non-semantic: ${semanticField}`,
  );
}

moduleLoader._load = originalLoad;

console.log(
  "verify-topics-bulk-publish-atomicity: pure contract, parser, post-commit fault injection, canonical validation, RPC source, batch parity, and tracked writer revision proofs passed.",
);
