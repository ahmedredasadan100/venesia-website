import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const unauthorized = new Error("Unauthorized");
const privilegedReadReached = new Error("PRIVILEGED_READ_REACHED");

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function loadValidationModule(relativePath) {
  const state = {
    authorized: false,
    authCalls: 0,
    privilegedReads: 0,
  };
  const output = ts.transpileModule(source(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  const dependencies = {
    "../../../../../lib/admin/auth/require-admin-session": {
      async requireAdminSession() {
        state.authCalls += 1;
        if (!state.authorized) throw unauthorized;
        return { id: 1, is_active: true };
      },
    },
    "../../../../../lib/admin/article-topic-categories": {
      resolveArticleTopicCategory() {
        throw new Error("Article category resolution must follow authorization.");
      },
    },
    "../../../../../lib/logging": { logError() {} },
    "../../../../../lib/supabase-admin": {
      getSupabaseAdmin() {
        state.privilegedReads += 1;
        throw privilegedReadReached;
      },
    },
    "../../../../../components/admin/content/editors/media/media-content-config": {
      isMediaEditableContentType: () => true,
      MEDIA_EDITABLE_CONTENT_TYPES: ["news", "press", "site_update", "video", "gallery"],
    },
  };

  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier) => {
      if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
      if (specifier.startsWith("node:")) return nativeRequire(specifier);
      throw new Error(`Unsupported dependency ${specifier} while loading ${relativePath}`);
    },
  );

  return { actions: commonJsModule.exports, state };
}

async function proveUnauthorizedBoundary(label, action, state) {
  const authCallsBefore = state.authCalls;
  const privilegedReadsBefore = state.privilegedReads;
  await assert.rejects(action, (error) => error === unauthorized, label);
  assert.equal(state.authCalls, authCallsBefore + 1, `${label} must consult the Auth owner once`);
  assert.equal(
    state.privilegedReads,
    privilegedReadsBefore,
    `${label} must reject before a Service Role read`,
  );
  console.log(`PASS ${label}: unauthenticated request rejected before privileged read`);
}

async function proveAuthenticatedContinuation(label, action, state) {
  state.authorized = true;
  const privilegedReadsBefore = state.privilegedReads;
  await assert.rejects(action, (error) => error === privilegedReadReached, label);
  assert.equal(
    state.privilegedReads,
    privilegedReadsBefore + 1,
    `${label} must continue to the existing data path after authorization`,
  );
  state.authorized = false;
  console.log(`PASS ${label}: authenticated request continues to existing privileged read`);
}

const article = loadValidationModule(
  "src/app/admin/content/topics/article-actions/validation.ts",
);
const media = loadValidationModule(
  "src/app/admin/content/topics/media-actions/validation.ts",
);

const cases = [
  ["article.getTopicById", () => article.actions.getTopicById("1"), article.state],
  ["article.ensureUniqueSlug", () => article.actions.ensureUniqueSlug("slug"), article.state],
  [
    "article.getConflictingTopicSlugs",
    () => article.actions.getConflictingTopicSlugs(["slug"]),
    article.state,
  ],
  ["article.getCategory", () => article.actions.getCategory(1), article.state],
  [
    "article.getCategoryValidationError",
    () => article.actions.getCategoryValidationError(1),
    article.state,
  ],
  ["article.getSeries", () => article.actions.getSeries(1), article.state],
  [
    "article.getTopicForDuplicate",
    () => article.actions.getTopicForDuplicate("1"),
    article.state,
  ],
  [
    "media.resolveMediaSection",
    () => media.actions.resolveMediaSection("1", "news"),
    media.state,
  ],
  ["media.ensureUniqueSlug", () => media.actions.ensureUniqueSlug("slug"), media.state],
  [
    "media.getEditableMediaTopicById",
    () => media.actions.getEditableMediaTopicById("1"),
    media.state,
  ],
];

for (const [label, action, state] of cases) {
  await proveUnauthorizedBoundary(label, action, state);
}

await proveAuthenticatedContinuation(
  "article.getTopicById",
  () => article.actions.getTopicById("1"),
  article.state,
);
await proveAuthenticatedContinuation(
  "media.getEditableMediaTopicById",
  () => media.actions.getEditableMediaTopicById("1"),
  media.state,
);

console.log(`\nUnified Content Server Action Auth boundary: ${cases.length + 2}/${cases.length + 2} checks passed.`);
