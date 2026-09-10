import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERIES_ACTION_PATH = "src/app/admin/content/series/actions.ts";
const RAW_DATABASE_MESSAGE =
  'insert or update on table "topic_series" violates foreign key constraint "topic_series_category_id_fkey"';
const SAFE_CATEGORY_MESSAGE =
  "التصنيف المرتبط لم يعد منشورًا ونشطًا ومتاحًا. حدّث الصفحة ثم اختر تصنيفًا متاحًا قبل المحاولة مرة أخرى.";

const read = (relativePath: string) =>
  readFileSync(resolve(ROOT, relativePath), "utf8");

type InsertPayload = Record<string, unknown>;
type IsolatedActionModule = {
  duplicateSeriesAjax(id: number): Promise<Record<string, unknown>>;
};

function loadDuplicateAction() {
  let auditCalls = 0;
  let publicCacheRevalidations = 0;
  const revalidatedPaths: string[] = [];
  let insertedPayload: InsertPayload | null = null;

  const sourceSeries = {
    name: "سلسلة أصلية",
    slug: "source-series",
    sort_order: 37,
    category_id: 9,
  };

  const supabase = {
    from(table: string) {
      assert.equal(table, "topic_series");
      let selectedColumns = "";
      let operation: "read" | "insert" = "read";
      const query = {
        select(columns: string) {
          selectedColumns = columns;
          return query;
        },
        eq() {
          return query;
        },
        is() {
          return query;
        },
        limit() {
          return query;
        },
        insert(payload: InsertPayload) {
          operation = "insert";
          insertedPayload = payload;
          return query;
        },
        async maybeSingle() {
          if (selectedColumns === "name, slug, sort_order, category_id") {
            return { data: sourceSeries, error: null };
          }
          assert.equal(selectedColumns, "id");
          return { data: null, error: null };
        },
        async single() {
          assert.equal(operation, "insert");
          assert.equal(selectedColumns, "id");
          return {
            data: null,
            error: {
              code: "23503",
              message: RAW_DATABASE_MESSAGE,
              details: "internal database detail",
            },
          };
        },
      };
      return query;
    },
  };

  class TaxonomyMutationDatabaseError extends Error {}
  const unexpectedLifecycleMutation = async () => {
    throw new Error("Unexpected lifecycle mutation during duplicate proof.");
  };
  const dependencies: Readonly<Record<string, unknown>> = {
    "next/cache": {
      revalidatePath: (value: string) => revalidatedPaths.push(value),
    },
    "../../../../lib/admin/admin-action-result": {
      adminActionFailure: (
        title: string,
        message: string,
        options: Record<string, unknown> = {},
      ) => ({
        ok: false,
        feedbackStatus: "error",
        title,
        message,
        ...options,
      }),
      adminActionSuccess: (
        title: string,
        message: string,
        options: Record<string, unknown> = {},
      ) => ({
        ok: true,
        feedbackStatus: "success",
        title,
        message,
        ...options,
      }),
    },
    "../../../../lib/admin/auth/require-admin-session": {
      requireAdminSession: async () => ({ id: 73 }),
    },
    "../../../../lib/admin/audit/cms-audit-actions": {
      buildCmsAuditAction: () => "topic_series.duplicate",
    },
    "../../../../lib/admin/audit-log": {
      recordCmsAdminAudit: async () => {
        auditCalls += 1;
      },
    },
    "../../../../lib/admin/content/series-list-config": {
      SERIES_DEFAULT_COLUMN_KEYS: [],
      SERIES_LIST_VIEW_KEY: "content-series",
      SERIES_PREFERENCE_COLUMN_KEYS: [],
    },
    "../../../../lib/admin/content/taxonomy-mutations": {
      moveTopicSeriesToTrashAtomically: unexpectedLifecycleMutation,
      permanentlyDeleteTopicSeriesAtomically: unexpectedLifecycleMutation,
      restoreTopicSeriesAtomically: unexpectedLifecycleMutation,
      TaxonomyMutationDatabaseError,
    },
    "../../../../lib/admin/preferences/admin-column-preferences": {
      saveAdminColumnPreferences: async () => undefined,
    },
    "../../../../lib/cache/revalidate-public-cache-tags": {
      revalidateTopicsCache: () => {
        publicCacheRevalidations += 1;
      },
    },
    "../../../../lib/supabase-admin": {
      getSupabaseAdmin: () => supabase,
    },
  };

  const compiled = ts.transpileModule(read(SERIES_ACTION_PATH), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: SERIES_ACTION_PATH,
  }).outputText;
  const isolatedModule = { exports: {} as IsolatedActionModule };
  Function("exports", "module", "require", compiled)(
    isolatedModule.exports,
    isolatedModule,
    (specifier: string) => {
      assert.ok(
        Object.hasOwn(dependencies, specifier),
        `Unsupported isolated Action dependency: ${specifier}`,
      );
      return dependencies[specifier];
    },
  );

  return {
    action: isolatedModule.exports.duplicateSeriesAjax,
    auditCalls: () => auditCalls,
    publicCacheRevalidations: () => publicCacheRevalidations,
    revalidatedPaths: () => [...revalidatedPaths],
    insertedPayload: () => insertedPayload,
  };
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolutePath);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [absolutePath] : [];
  });
}

function receiverContainsTopicSeriesFrom(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "from" &&
    node.arguments.length === 1 &&
    ts.isStringLiteralLike(node.arguments[0]) &&
    node.arguments[0].text === "topic_series"
  ) {
    return true;
  }
  if (ts.isCallExpression(node)) {
    return receiverContainsTopicSeriesFrom(node.expression);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return receiverContainsTopicSeriesFrom(node.expression);
  }
  if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node)) {
    return receiverContainsTopicSeriesFrom(node.expression);
  }
  return false;
}

function findDirectTopicSeriesInsertConsumers() {
  const consumers: string[] = [];
  for (const absolutePath of listTypeScriptFiles(resolve(ROOT, "src"))) {
    const relativePath = path.relative(ROOT, absolutePath).replaceAll("\\", "/");
    const source = readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "insert" &&
        receiverContainsTopicSeriesFrom(node.expression.expression)
      ) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        consumers.push(`${relativePath}:${line}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return consumers;
}

let passed = 0;
function pass(label: string) {
  passed += 1;
  console.log(`PASS ${label}`);
}

const harness = loadDuplicateAction();
const result = await harness.action(41);

assert.deepEqual(result, {
  ok: false,
  feedbackStatus: "error",
  title: "تعذر نسخ السلسلة",
  message: SAFE_CATEGORY_MESSAGE,
  code: "invalid_input",
  entityId: 41,
});
assert.equal(result.message, SAFE_CATEGORY_MESSAGE);
assert.equal(String(result.message).includes(RAW_DATABASE_MESSAGE), false);
pass("SQLSTATE 23503 maps to a typed Arabic category-unavailable failure without raw SQL detail");

assert.deepEqual(harness.insertedPayload(), {
  name: "سلسلة أصلية - نسخة",
  slug: "source-series-copy",
  status: "unpublished",
  sort_order: 37,
  category_id: 9,
  deleted_at: null,
  created_at: (harness.insertedPayload() as InsertPayload).created_at,
  updated_at: (harness.insertedPayload() as InsertPayload).updated_at,
});
assert.equal(
  (harness.insertedPayload() as InsertPayload).created_at,
  (harness.insertedPayload() as InsertPayload).updated_at,
);
pass("duplicate remains a direct insert and preserves the source Series sort_order");

assert.equal(harness.auditCalls(), 0);
assert.equal(harness.publicCacheRevalidations(), 0);
assert.deepEqual(harness.revalidatedPaths(), []);
pass("the rejected insert does not emit success audit or cache/path revalidation");

const directInsertConsumers = findDirectTopicSeriesInsertConsumers();
assert.equal(directInsertConsumers.length, 1, directInsertConsumers.join(", "));
assert.match(
  directInsertConsumers[0],
  /^src\/app\/admin\/content\/series\/actions\.ts:\d+$/u,
);
pass("the duplicate action is the only application direct-insert consumer of topic_series");

const actionSource = read(SERIES_ACTION_PATH);
assert.match(actionSource, /insertError\?\.code === "23503"/u);
assert.doesNotMatch(
  actionSource.slice(
    actionSource.indexOf('if (insertError?.code === "23503")'),
    actionSource.indexOf("if (insertError || !inserted)"),
  ),
  /insertError\?\.message/u,
);
pass("the 23503 source branch cannot serialize insertError.message");

console.log(
  `Series duplicate Category guard verification passed (${passed}/${passed}).`,
);
