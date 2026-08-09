import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8");

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function exportedFunction(source: string, name: string, nextName?: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const end = nextName
    ? source.indexOf(`export async function ${nextName}`, start + 1)
    : source.length;
  assert.notEqual(end, -1, `Missing boundary after ${name}`);
  return source.slice(start, end);
}

function functionSection(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `Missing boundary ${endMarker}`);
  return source.slice(start, end);
}

const contract = read(
  "src/lib/admin/content/entity-list-contracts/topics.ts",
);
const loader = read("src/lib/admin/content/load-unified-content.ts");
const actions = read("src/app/admin/content/topics/actions.ts");
const rowActions = read(
  "src/components/admin/content/UnifiedContentRowActions.tsx",
);
const listClient = read("src/components/admin/content/TopicsListClient.tsx");
const trashHeader = read(
  "src/components/admin/entity-list/AdminEntityTrashHeader.tsx",
);
const list = read("src/components/admin/content/UnifiedContentList.tsx");
const columns = read(
  "src/components/admin/content/unified-content-columns.tsx",
);
const topicsPage = read("src/app/admin/content/topics/page.tsx");
const sharedRowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const auditActions = read("src/lib/admin/audit/cms-audit-actions.ts");
const bulkLabels = read(
  "src/lib/admin/entity-list/bulk-action-labels.ts",
);

const softDelete = functionSection(
  actions,
  "export async function softDeleteUnifiedContent",
  "async function restoreTopicsWithCanonicalOwner",
);
const restoreAction = exportedFunction(
  actions,
  "restoreUnifiedContent",
  "permanentlyDeleteUnifiedContent",
);
const purgeAction = exportedFunction(
  actions,
  "permanentlyDeleteUnifiedContent",
  "emptyUnifiedContentTrash",
);
const emptyTrashAction = exportedFunction(
  actions,
  "emptyUnifiedContentTrash",
  "bulkUpdateUnifiedContent",
);
const bulkAction = exportedFunction(
  actions,
  "bulkUpdateUnifiedContent",
  "saveContentTablePreferences",
);
const restoreOwner = functionSection(
  actions,
  "async function restoreTopicsWithCanonicalOwner",
  "async function permanentlyDeleteTopicsWithCanonicalOwner",
);
const purgeOwner = functionSection(
  actions,
  "async function permanentlyDeleteTopicsWithCanonicalOwner",
  "export async function restoreUnifiedContent",
);
const metricItems = functionSection(
  listClient,
  "const metricItems:",
  "const trashCount",
);

check(
  "Topics owns an active/trash view in its existing query contract",
  contract.includes('view: "active" | "trash"') &&
    contract.includes('view === "trash" ? "trash" : "active"') &&
    contract.includes('params.set("view", "trash")'),
);
check(
  "The shared Topics loader separates active and deleted rows by deleted_at",
  loader.includes('filters.view === "trash"') &&
    loader.includes('query.not("deleted_at", "is", null)') &&
    loader.includes('query.is("deleted_at", null)'),
);
check(
  "Soft delete keeps the slug and stays an update mutation",
  softDelete.includes(".update({") &&
    softDelete.includes("deleted_at: now") &&
    softDelete.includes("slug_retained: true") &&
    !softDelete.includes(".delete()"),
);
check(
  "Soft delete is presented as moving to Trash",
  rowActions.includes('label: isTrashView ? "حذف نهائي" : "نقل إلى المحذوفات"') &&
    rowActions.includes("سيبقى الـSlug محجوزًا"),
);
check(
  "Restore only targets deleted Topics and restores them unpublished",
  restoreOwner.includes("loadDeletedTopics(input.ids)") &&
    restoreOwner.includes('.not("deleted_at", "is", null)') &&
    restoreOwner.includes('status: "unpublished"') &&
    restoreOwner.includes("deleted_at: null"),
);
check(
  "Restore blocks a conflicting active slug with a clear domain result",
  actions.includes("findActiveTopicSlugConflict(topics)") &&
    actions.includes('.is("deleted_at", null)') &&
    restoreOwner.includes("topicRestoreSlugConflict(topic.slug, topic.id)"),
);
check(
  "Permanent delete requires explicit confirmation and only targets Trash",
  purgeAction.includes('getString(formData, "confirm_permanent") !== "true"') &&
    purgeAction.includes("permanentlyDeleteTopicsWithCanonicalOwner") &&
    purgeOwner.includes("loadDeletedTopics(input.ids)") &&
    purgeOwner.includes(".delete()") &&
    purgeOwner.includes('.not("deleted_at", "is", null)'),
);
check(
  "Permanent delete releases the slug and delegates media cleanup",
  purgeOwner.includes("slug_released: true") &&
    purgeOwner.includes(
      "synchronizeMediaReferenceWriteScopesAfterDomainMutation",
    ),
);
check(
  "Single and bulk mutations delegate to the same restore and purge owners",
  restoreAction.includes("restoreTopicsWithCanonicalOwner") &&
    purgeAction.includes("permanentlyDeleteTopicsWithCanonicalOwner") &&
    bulkAction.includes("restoreTopicsWithCanonicalOwner") &&
    bulkAction.includes("permanentlyDeleteTopicsWithCanonicalOwner"),
);
check(
  "Bulk Trash mutations reject active or missing Topics before writing",
  restoreOwner.includes("topics.length !== input.ids.length") &&
    restoreOwner.includes("لم تتم استعادة أي Topic نشط") &&
    purgeOwner.includes("topics.length !== input.ids.length") &&
    purgeOwner.includes("لم يتم حذف أي Topic نشط"),
);
check(
  "Empty Trash counts and reloads deleted Topics before canonical purge",
  emptyTrashAction.includes("loadAllDeletedTopics()") &&
    emptyTrashAction.includes("topics.length !== expectedCount") &&
    emptyTrashAction.includes('scope: "empty_trash"') &&
    purgeOwner.includes("expectedTotalDeletedCount") &&
    purgeOwner.includes('.not("deleted_at", "is", null)'),
);
check(
  "Restore and permanent delete use the existing Topic audit owner",
  actions.includes('action: "restore"') &&
    actions.includes('action: "permanent_delete"') &&
    actions.includes("recordCmsAdminAudit(") &&
    auditActions.includes('permanent_delete: "حذف نهائي"') &&
    auditActions.includes('restore: "استعادة"'),
);
check(
  "Trash actions use the shared confirmation runtime",
  rowActions.includes('mode: "shared"') &&
    rowActions.includes('title: "استعادة الموضوع؟"') &&
    rowActions.includes('title: "حذف الموضوع نهائيًا؟"') &&
    sharedRowActions.includes("AdminConfirmDialog"),
);
check(
  "The Topics header owns the explicit Trash entry instead of a metric card",
  topicsPage.includes('href={`${ADMIN_CONTENT_ROUTES.topics}?view=trash`}') &&
    topicsPage.includes("key={query.filters.view}") &&
    topicsPage.includes("المحذوفات") &&
    !metricItems.includes("المحذوفات"),
);
check(
  "The core seven Topic metrics stay in one non-wrapping row",
  [
    "إجمالي الموضوعات",
    "منشور",
    "غير منشور",
    "بدون صورة",
    "مرتبطة بسلسلة",
    "مميزة",
    "متوسط SEO",
  ].every((label) => metricItems.includes(label)) &&
    listClient.includes('className="min-w-[1146px]"'),
);
check(
  "Trash bulk selection exposes the formal restore and permanent-delete labels",
  bulkLabels.includes('restoreSelected: "استعادة المحدد"') &&
    bulkLabels.includes(
      'permanentlyDeleteSelected: "حذف نهائي للمحدد"',
    ) &&
    list.includes("ADMIN_BULK_ACTION_LABELS.restoreSelected") &&
    list.includes("ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected") &&
    list.includes("enableSelection") &&
    list.includes("getBulkConfirmation"),
);
check(
  "Permanent selected deletion confirms count and irreversibility",
  list.includes('action === "permanent_delete"') &&
    list.includes("ids.length") &&
    list.includes("لا يمكن التراجع عن هذا الإجراء") &&
    list.includes("ADMIN_BULK_ACTION_LABELS.permanentlyDeleteSelected"),
);
check(
  "Empty Trash uses shared confirmation with a server-verified count",
  listClient.includes("AdminEntityTrashHeader") &&
    trashHeader.includes("floating.openConfirmation") &&
    bulkLabels.includes('emptyTrash: "إفراغ المحذوفات"') &&
    trashHeader.includes("ADMIN_BULK_ACTION_LABELS.emptyTrash") &&
    listClient.includes('formData.set("expected_count", String(expectedCount))') &&
    emptyTrashAction.includes('getString(formData, "confirm_permanent") !== "true"'),
);
check(
  "Featured state is read-only in Trash through the shared inline contract",
  columns.includes('display="featured"') &&
    !columns.includes('role="img"') &&
    rowActions.includes('display === "featured"') &&
    rowActions.includes('disabledReason: "عرض فقط داخل المحذوفات."') &&
    rowActions.includes("isFeatured: Boolean(row.is_featured)") &&
    sharedRowActions.includes('display?: "menu" | "visibility" | "featured"'),
);
check(
  "The Topics client adopts restore and purge through the instant mutation owner",
  listClient.includes('action: "restore"') &&
    listClient.includes('action: "permanent_delete"') &&
    listClient.includes("instant.mutateAsync({"),
);
check(
  "Topic Trash does not introduce ad-hoc browser mutation owners",
  !rowActions.includes("window.confirm") &&
    !listClient.includes("router.refresh") &&
    !listClient.includes("window.location.reload"),
);

console.log(`Topic Trash verification passed (${passed} checks).`);
