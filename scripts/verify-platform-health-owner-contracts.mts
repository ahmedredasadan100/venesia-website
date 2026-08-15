import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "../src/lib/database.types.ts";
import {
  createTopicDraft,
  encodeTopicRevision,
  parseTopicDraft,
  parseTopicRevisionToken,
  TOPIC_REVISION_CONFLICT_CODE,
  topicRevisionMatches,
} from "../src/lib/admin/content/topic-revision.ts";

const read = (path: string) => readFileSync(path, "utf8");

function readTypeScriptSources(root: string): Array<{
  path: string;
  source: string;
}> {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return readTypeScriptSources(path);
    if (!/\.(?:ts|tsx|mts)$/u.test(entry.name)) return [];
    return [{ path, source: read(path) }];
  });
}

function verifyGeneratedDatabaseCompileContract(client: SupabaseClient<Database>) {
  const topicId: Tables<"topics">["id"] = 1;
  client.from("topics").select("id").eq("id", topicId);
  // @ts-expect-error generated relations must reject unknown tables
  client.from("platform_health_invalid_table");
  // @ts-expect-error generated rows must reject unknown columns
  client.from("topics").select("id").eq("platform_health_invalid_column", 1);
}

void verifyGeneratedDatabaseCompileContract;

const nullableCategoryRpcArgs: Database["public"]["Functions"]["admin_update_topic_category"]["Args"] = {
  p_actor_id: 1,
  p_category_id: 1,
  p_color_token: null,
  p_is_active: true,
  p_name: "Category",
  p_parent_id: null,
};
const nullableAuthorizationRpcArgs: Database["public"]["Functions"]["promote_integration_authorization"]["Args"] = {
  p_access_expires_at: null,
  p_access_secret_id: "access-secret",
  p_actor_admin_user_id: 1,
  p_credential_strategy: "oauth",
  p_environment_key: "production",
  p_external_subject_id: null,
  p_granted_scopes: [],
  p_integration_key: "provider",
  p_refresh_expires_at: null,
  p_refresh_secret_id: null,
};
const nullableCredentialRpcArgs: Database["public"]["Functions"]["rotate_integration_credentials"]["Args"] = {
  p_access_expires_at: null,
  p_access_secret_id: "access-secret",
  p_connection_id: "00000000-0000-0000-0000-000000000001",
  p_granted_scopes: [],
  p_refresh_expires_at: null,
  p_refresh_secret_id: null,
};
const nullableMediaLeaseRpcArgs: Database["public"]["Functions"]["replace_media_references_for_entity"]["Args"] = {
  p_domain_key: "domain",
  p_entity_identity: "entity",
  p_entity_type: "entity",
  p_lease_entity_identity: null,
  p_lease_token: null,
  p_references: [],
};

void [
  nullableCategoryRpcArgs,
  nullableAuthorizationRpcArgs,
  nullableCredentialRpcArgs,
  nullableMediaLeaseRpcArgs,
];

const structuredDraft = createTopicDraft("draft body", "2026-08-14T12:00:00Z");
const parsedStructuredDraft = parseTopicDraft(JSON.stringify(structuredDraft));
assert.equal(parsedStructuredDraft?.legacy, false);
assert.equal(parsedStructuredDraft?.content, "draft body");
assert.equal(parsedStructuredDraft?.baselineRevision, "2026-08-14T12:00:00Z");

const jsonObjectMarkdown = '{"section":"legacy raw Markdown"}';
const parsedJsonObjectMarkdown = parseTopicDraft(jsonObjectMarkdown);
assert.equal(parsedJsonObjectMarkdown?.legacy, true);
assert.equal(parsedJsonObjectMarkdown?.content, jsonObjectMarkdown);
assert.equal(parseTopicDraft("# legacy raw Markdown")?.legacy, true);
const restoredLegacyDraft = createTopicDraft(
  parsedJsonObjectMarkdown?.content ?? "",
  "2026-08-14T12:00:00Z",
);
const immediatelyReloadedDraft = parseTopicDraft(
  JSON.stringify(restoredLegacyDraft),
);
assert.equal(immediatelyReloadedDraft?.legacy, false);
assert.equal(immediatelyReloadedDraft?.content, jsonObjectMarkdown);
assert.equal(
  immediatelyReloadedDraft?.baselineRevision,
  "2026-08-14T12:00:00Z",
);

assert.deepEqual(parseTopicRevisionToken(encodeTopicRevision(null)), {
  provided: true,
  value: null,
});
assert.deepEqual(parseTopicRevisionToken("2026-08-14T12:00:00Z"), {
  provided: true,
  value: "2026-08-14T12:00:00Z",
});
assert.deepEqual(parseTopicRevisionToken(""), { provided: false });
assert.equal(topicRevisionMatches(null, null), true);
assert.equal(
  topicRevisionMatches("2026-08-14T12:00:00Z", "2026-08-14T12:00:01Z"),
  false,
);
assert.equal(TOPIC_REVISION_CONFLICT_CODE, "content_revision_conflict");

const editor = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
const richTextEditor = read("src/components/admin/AdminRichTextEditor.tsx");
const shell = read("src/components/admin/content/editors/ContentEditorShell.tsx");
const formDomPreservation = read("src/lib/admin/form-dom-preservation.ts");
const topicRevisionOwner = read("src/lib/admin/content/topic-revision.ts");
const articleEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const mediaForm = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
const articleSave = read("src/app/admin/content/topics/article-actions/save.ts");
const mediaSave = read("src/app/admin/content/topics/media-actions/save.ts");
const articleHelpers = read("src/app/admin/content/topics/article-actions/helpers.ts");
const mediaHelpers = read("src/app/admin/content/topics/media-actions/helpers.ts");
const databaseTypes = read("src/lib/database.types.ts");
const supabaseAdmin = read("src/lib/supabase-admin.ts");
const mediaCoordinationQa = read("scripts/qa-media-coordination-live.mts");
const applicationTypeScriptSources = readTypeScriptSources("src");

assert.match(editor, /draftIdentity/u);
assert.doesNotMatch(editor, /window\.location\.pathname/u);
assert.match(editor, /data-topic-draft-restore/u);
assert.match(editor, /data-topic-draft-discard/u);
assert.match(editor, /!savedDraft\.legacy/u);
assert.match(editor, /readOnly=\{Boolean\(pendingDraft\)\}/u);
assert.match(editor, /pendingDraftRef/u);
assert.match(editor, /addEventListener\("submit", blockUnresolvedDraftSubmit, true\)/u);
assert.match(editor, /event\.preventDefault\(\)/u);
assert.match(editor, /event\.stopPropagation\(\)/u);
assert.match(editor, /event\.stopImmediatePropagation\(\)/u);
assert.match(editor, /prompt\?\.scrollIntoView/u);
assert.match(editor, /data-topic-draft-restore/u);
assert.match(editor, /if \(pendingDraftRef\.current\) return;/u);
assert.match(editor, /createTopicDraft\(restoredContent, baselineRevision\)/u);
assert.match(richTextEditor, /editor\?\.setEditable\(!editorReadOnly\)/u);
assert.match(richTextEditor, /disabled=\{editorReadOnly\}/u);
assert.match(shell, /name="expected_updated_at"/u);
assert.match(shell, /data-admin-form-server-owned/u);
assert.match(formDomPreservation, /!serverOwnedNames\.has\(name\)/u);
assert.match(shell, /Content edit forms require a baseline revision/u);
assert.match(articleEditor, /baselineRevision=\{topic\.updated_at\}/u);
assert.match(mediaForm, /baselineRevision=\{mode === "edit"/u);
for (const source of [articleSave, mediaSave]) {
  assert.match(source, /parseTopicRevisionToken/u);
  assert.match(source, /topicRevisionMatches/u);
  assert.match(source, /\.eq\("updated_at", expectedRevision\.value\)/u);
  assert.match(source, /\.is\("updated_at", null\)/u);
  assert.match(source, /TopicRevisionConflictError/u);
}
assert.ok(
  articleSave.indexOf("topicRevisionMatches(expectedRevision.value") <
    articleSave.indexOf("payload.image = await uploadTopicImage"),
  "Article stale baseline must fail before the upload boundary",
);
assert.ok(
  mediaSave.indexOf("topicRevisionMatches(expectedRevision.value") <
    mediaSave.indexOf("const uploadedImage = await uploadMediaImage"),
  "Media stale baseline must fail before the upload boundary",
);
for (const source of [articleHelpers, mediaHelpers]) {
  assert.doesNotMatch(source, /\.storage\b|uploadCms|uploadImage\(/u);
  assert.match(source, /الرفع المباشر[^\n]+متوقف/u);
}

const contentTypes = read("src/lib/admin/content/content-types.ts");
assert.match(contentTypes, /export type MediaEditableContentType/u);
assert.match(contentTypes, /export const MEDIA_EDITABLE_CONTENT_TYPES/u);
assert.match(contentTypes, /export function isMediaEditableContentType/u);
assert.equal(
  existsSync("src/components/admin/content/editors/media/media-content-config.ts"),
  false,
);
for (const path of [
  "src/app/admin/content/topics/editor-actions/save.ts",
  "src/app/admin/content/topics/media-actions/save.ts",
  "src/app/admin/content/topics/media-actions/validation.ts",
  "src/app/admin/content/topics/media-actions/helpers.ts",
]) {
  assert.doesNotMatch(read(path), /components\/admin\/content\/editors\/media/u);
}

const adminUsers = read("src/lib/admin/auth/admin-users.ts");
const mediaHubConfigParser = read("src/lib/media-hub-modules/parse-config.ts");
const mediaSidebarConfigParser = read("src/lib/media-sidebar-modules/parse-config.ts");
const typedSupabaseConsumerSources = [
  {
    path: "src/lib/load-hero-section.ts",
    source: read("src/lib/load-hero-section.ts"),
  },
  {
    path: "src/lib/projects/load-published-projects.ts",
    source: read("src/lib/projects/load-published-projects.ts"),
  },
  {
    path: "src/lib/projects/map-public-project.ts",
    source: read("src/lib/projects/map-public-project.ts"),
  },
  {
    path: "src/lib/admin/projects/location-management-adapter.ts",
    source: read("src/lib/admin/projects/location-management-adapter.ts"),
  },
  {
    path: "src/lib/admin/content-workflow/load-content-review-report.ts",
    source: read("src/lib/admin/content-workflow/load-content-review-report.ts"),
  },
  {
    path: "src/lib/admin/auth/admin-users.ts",
    source: adminUsers,
  },
  {
    path: "src/lib/media-hub-modules/load-media-hub-modules.ts",
    source: read("src/lib/media-hub-modules/load-media-hub-modules.ts"),
  },
  {
    path: "src/lib/media-sidebar-modules/load-media-sidebar-modules.ts",
    source: read("src/lib/media-sidebar-modules/load-media-sidebar-modules.ts"),
  },
  {
    path: "src/lib/projects/load-projects-hub-composition.ts",
    source: read("src/lib/projects/load-projects-hub-composition.ts"),
  },
  {
    path: "src/lib/seo/run-global-seo-health.ts",
    source: read("src/lib/seo/run-global-seo-health.ts"),
  },
  {
    path: "src/lib/admin/media-catalog/delete-reservation.ts",
    source: read("src/lib/admin/media-catalog/delete-reservation.ts"),
  },
  {
    path: "src/lib/admin/media-catalog/write-lease.ts",
    source: read("src/lib/admin/media-catalog/write-lease.ts"),
  },
  {
    path: "src/lib/admin/links/usage.ts",
    source: read("src/lib/admin/links/usage.ts"),
  },
  {
    path: "src/lib/admin/projects/project-entry-data.ts",
    source: read("src/lib/admin/projects/project-entry-data.ts"),
  },
  {
    path: "src/app/admin/projects/project-actions/save-entry.ts",
    source: read("src/app/admin/projects/project-actions/save-entry.ts"),
  },
  {
    path: "src/app/admin/projects/project-actions/publication.ts",
    source: read("src/app/admin/projects/project-actions/publication.ts"),
  },
  {
    path: "src/app/admin/projects/project-actions/featured.ts",
    source: read("src/app/admin/projects/project-actions/featured.ts"),
  },
  {
    path: "src/app/admin/projects/project-actions/duplicate.ts",
    source: read("src/app/admin/projects/project-actions/duplicate.ts"),
  },
  {
    path: "src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx",
    source: read("src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx"),
  },
  {
    path: "src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx",
    source: read("src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx"),
  },
] as const;
const loginOwner = read("src/lib/admin/auth/handle-admin-login.ts");
const adminUserManagement = read("src/lib/admin/users/admin-users-management.ts");
const selfAccountActions = read("src/app/admin/settings/security/actions.ts");
const userActions = read("src/app/admin/users-roles/actions.ts");
const migration = read("sql/migrations/20260814174238_admin_users_active_invariant.sql");

for (const { path, source } of typedSupabaseConsumerSources) {
  assert.doesNotMatch(
    source,
    /\bas unknown as\b/u,
    `${path} must consume generated Supabase query contracts without double assertions`,
  );
  assert.doesNotMatch(
    source,
    /const\s+[A-Z0-9_]*(?:SELECT|COLUMNS)[A-Z0-9_]*\s*=\s*\[[\s\S]{0,5000}?\]\.join\(\s*["'],["']\s*\)/u,
    `${path} must keep Supabase select projections as compiler-visible literals`,
  );
  assert.doesNotMatch(
    source,
    /\bas\s+\{/u,
    `${path} must not replace generated relation or RPC rows with local object assertions`,
  );
  assert.doesNotMatch(
    source,
    /\bas\s+Record<string,\s*unknown>/u,
    `${path} must narrow generated JSON instead of asserting a broad local record`,
  );
  assert.doesNotMatch(
    source,
    /\bfirstRpcRow\b/u,
    `${path} must consume generated RPC row arrays directly`,
  );
  assert.doesNotMatch(
    source,
    /Array\.isArray\(\s*(?:data|[A-Za-z]+Result\.data)\s*\)/u,
    `${path} must not retain array-or-object compatibility for generated RPC results`,
  );
}
for (const source of [mediaHubConfigParser, mediaSidebarConfigParser]) {
  assert.match(source, /import type \{ Json \} from "\.\.\/database\.types"/u);
  assert.doesNotMatch(source, /\braw:\s*unknown\b|\bas\s+Record<string,\s*unknown>/u);
}
assert.doesNotMatch(
  adminUsers,
  /\bcolumns\s*:\s*string\b/u,
  "Admin Users must not accept an untyped dynamic Supabase column projection",
);
assert.doesNotMatch(
  adminUsers,
  /\.select\(columns\)/u,
  "Admin Users must not pass an untyped dynamic column projection to Supabase",
);

assert.match(adminUsers, /status: "empty"/u);
assert.match(adminUsers, /status: "unavailable"/u);
assert.match(adminUsers, /AdminAuthDependencyError/u);
assert.match(adminUsers, /admin_auth_dependency_unavailable/u);
assert.doesNotMatch(adminUsers, /export type AdminUsersDependencyState/u);
assert.match(loginOwner, /admin_auth_not_initialized/u);
assert.match(loginOwner, /dependencyState\.error\.code/u);
assert.match(loginOwner, /handleUnexpectedAdminLoginError/u);
assert.doesNotMatch(loginOwner, /Set ADMIN_SESSION_SECRET|Apply the admin_users migration/u);
assert.match(selfAccountActions, /await updateAdminUserIdentity/u);
assert.doesNotMatch(selfAccountActions, /updateAdminUserFullName/u);
assert.doesNotMatch(
  topicRevisionOwner,
  /export (?:const TOPIC_NULL_REVISION_TOKEN|type (?:ParsedTopicRevision|TopicDraftRecord))/u,
);

const updateUserAction = userActions.slice(
  userActions.indexOf("export async function updateAdminUserAction"),
  userActions.indexOf("export async function deleteAdminUserAction"),
);
assert.match(updateUserAction, /password: input\.password/u);
assert.doesNotMatch(updateUserAction, /await adminResetUserPassword/u);
const updateProfileOwner = adminUserManagement.slice(
  adminUserManagement.indexOf("export async function updateAdminUserProfile"),
  adminUserManagement.indexOf("export async function setAdminUserActiveStatus"),
);
assert.match(updateProfileOwner, /password_hash: passwordHash/u);
assert.equal(updateProfileOwner.match(/\.update\(/gu)?.length, 1);
assert.match(
  userActions,
  /input\.id === actor\.id && input\.password\?\.trim\(\)/u,
);
assert.match(
  userActions,
  /throw new Error\(ADMIN_SELF_PASSWORD_SETTINGS_MESSAGE\)/u,
);

assert.match(migration, /pg_advisory_xact_lock/u);
assert.match(migration, /for update skip locked/u);
assert.match(migration, /security invoker/u);
assert.match(migration, /set search_path = ''/u);
assert.match(migration, /from public, anon, authenticated/u);
assert.match(migration, /errcode = '23514'/u);

assert.match(databaseTypes, /export type Database =/u);
assert.match(databaseTypes, /__InternalSupabase:/u);
assert.match(databaseTypes, /export type Tables</u);
assert.match(databaseTypes, /export type TablesInsert</u);
assert.match(databaseTypes, /export type TablesUpdate</u);
assert.doesNotMatch(databaseTypes, /\bany\b/u);
assert.match(supabaseAdmin, /import type \{ Database \} from "\.\/database\.types"/u);
assert.equal(supabaseAdmin.match(/SupabaseClient<Database>/gu)?.length, 4);
assert.equal(supabaseAdmin.match(/createClient<Database>/gu)?.length, 2);
assert.doesNotMatch(
  supabaseAdmin,
  /(?:let (?:adminClient|storageAdminClient):|function getSupabase(?:Storage)?Admin\(\):) SupabaseClient(?:\s|\||\{)/u,
);
assert.match(mediaCoordinationQa, /SupabaseClient<Database>/u);
assert.match(mediaCoordinationQa, /createClient<Database>/u);

const localSupabaseResultOverrides = applicationTypeScriptSources.filter(
  ({ source }) => /\.(?:maybeSingle|single|returns|overrideTypes)</u.test(source),
);
assert.deepEqual(
  localSupabaseResultOverrides.map(({ path }) => path),
  [],
  "Supabase query results must use the generated Database contract instead of local result overrides",
);

const databaseConsumersWithDoubleAssertions = applicationTypeScriptSources
  .filter(({ source }) =>
    /getSupabase(?:Storage)?Admin/u.test(source),
  )
  .filter(({ source }) => /\bas unknown as\b/u.test(source));
assert.deepEqual(
  databaseConsumersWithDoubleAssertions.map(({ path }) => path),
  [],
  "Database consumers must not bypass generated contracts with double assertions",
);

console.log("verify-platform-health-owner-contracts: targeted contracts passed");
