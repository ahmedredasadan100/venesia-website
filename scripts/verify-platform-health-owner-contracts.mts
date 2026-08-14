import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  createTopicDraft,
  encodeTopicRevision,
  parseTopicDraft,
  parseTopicRevisionToken,
  TOPIC_REVISION_CONFLICT_CODE,
  topicRevisionMatches,
} from "../src/lib/admin/content/topic-revision.ts";

const read = (path: string) => readFileSync(path, "utf8");

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
const loginOwner = read("src/lib/admin/auth/handle-admin-login.ts");
const adminUserManagement = read("src/lib/admin/users/admin-users-management.ts");
const selfAccountActions = read("src/app/admin/settings/security/actions.ts");
const userActions = read("src/app/admin/users-roles/actions.ts");
const migration = read("sql/migrations/20260814174238_admin_users_active_invariant.sql");

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

console.log("verify-platform-health-owner-contracts: targeted contracts passed");
