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
const controlledVideoResult = Object.freeze({ status: "unavailable", reason: "unsupported" });

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function loadValidationModule(relativePath, validationSource = source(relativePath)) {
  const state = {
    authorized: false,
    authCalls: 0,
    privilegedReads: 0,
    videoReads: 0,
    videoPayload: undefined,
  };
  const output = ts.transpileModule(validationSource, {
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
    "../../../../../lib/admin/content-workflow/topic-publish-validation": {
      parseTopicFaq() {
        return [];
      },
    },
    "../../../../../lib/logging": { logError() {} },
    "../../../../../lib/supabase-admin": {
      getSupabaseAdmin() {
        state.privilegedReads += 1;
        throw privilegedReadReached;
      },
    },
    "../../../../../lib/admin/content/content-types": {
      isMediaEditableContentType: () => true,
      MEDIA_EDITABLE_CONTENT_TYPES: ["news", "press", "site_update", "video", "gallery"],
    },
    "../../../../../lib/content/public-content-read/owner": {
      async readMetaVideoEmbed(payload) {
        // This is the network owner's controlled boundary, never a live read.
        state.videoReads += 1;
        state.videoPayload = payload;
        return controlledVideoResult;
      },
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
  const videoReadsBefore = state.videoReads;
  await assert.rejects(action, (error) => error === unauthorized, label);
  assert.equal(state.authCalls, authCallsBefore + 1, `${label} must consult the Auth owner once`);
  assert.equal(
    state.privilegedReads,
    privilegedReadsBefore,
    `${label} must reject before a Service Role read`,
  );
  assert.equal(state.videoReads, videoReadsBefore, `${label} must reject before a public network read`);
  console.log(`PASS ${label}: unauthenticated request rejected before privileged or network read`);
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
const mediaPayload = Object.freeze({ provider: "instagram", video_url: "https://www.instagram.com/reel/QA_AUTH_BOUNDARY/" });

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
  ["media.readMediaVideoEmbed", () => media.actions.readMediaVideoEmbed(mediaPayload), media.state],
  ["media.readMediaVideoEmbed.invalid-before-validation", () => media.actions.readMediaVideoEmbed(null), media.state],
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

media.state.authorized = true;
const authCallsBeforeVideo = media.state.authCalls;
const privilegedReadsBeforeVideo = media.state.privilegedReads;
const videoReadsBefore = media.state.videoReads;
assert.equal(await media.actions.readMediaVideoEmbed(mediaPayload), controlledVideoResult);
assert.equal(media.state.authCalls, authCallsBeforeVideo + 1);
assert.equal(media.state.privilegedReads, privilegedReadsBeforeVideo);
assert.equal(media.state.videoReads, videoReadsBefore + 1);
assert.equal(media.state.videoPayload, mediaPayload, "Authenticated read must delegate the exact payload to its canonical owner");
media.state.authorized = false;
console.log("PASS media.readMediaVideoEmbed: authenticated request delegates exactly once to the controlled network owner");

const mediaValidationPath = "src/app/admin/content/topics/media-actions/validation.ts";
const mediaValidationSource = source(mediaValidationPath);
assert.throws(
  () => loadValidationModule(mediaValidationPath, `${mediaValidationSource}\nimport \"unregistered-auth-test-dependency\";`),
  /Unsupported dependency unregistered-auth-test-dependency/,
  "The constrained loader must still reject unregistered dependencies",
);
const readBeforeAuthSource = mediaValidationSource.replace(
  /  await requireAdminSession\(\);\r?\n  return readMetaVideoEmbed\(payload\);/u,
  "  const result = await readMetaVideoEmbed(payload);\n  await requireAdminSession();\n  return result;",
);
assert.notEqual(readBeforeAuthSource, mediaValidationSource, "The negative must mutate the actual media read action");
const readBeforeAuth = loadValidationModule(mediaValidationPath, readBeforeAuthSource);
await assert.rejects(() => proveUnauthorizedBoundary(
  "negative media read before Auth",
  () => readBeforeAuth.actions.readMediaVideoEmbed(mediaPayload),
  readBeforeAuth.state,
), /must reject before a public network read/);
assert.equal(readBeforeAuth.state.videoReads, 1, "The negative must actually reach the controlled read before rejection");
console.log("PASS Auth harness negatives: unsupported dependencies and network-before-Auth regressions are rejected");

console.log(`\nUnified Content Server Action Auth boundary: ${cases.length + 5}/${cases.length + 5} checks passed.`);
