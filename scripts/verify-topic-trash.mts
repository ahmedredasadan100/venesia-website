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

const contract = read(
  "src/lib/admin/content/entity-list-contracts/topics.ts",
);
const loader = read("src/lib/admin/content/load-unified-content.ts");
const actions = read("src/app/admin/content/topics/actions.ts");
const rowActions = read(
  "src/components/admin/content/UnifiedContentRowActions.tsx",
);
const listClient = read("src/components/admin/content/TopicsListClient.tsx");
const sharedRowActions = read(
  "src/components/admin/ui/AdminDataGridRowActions.tsx",
);
const auditActions = read("src/lib/admin/audit/cms-audit-actions.ts");

const softDelete = exportedFunction(
  actions,
  "softDeleteUnifiedContent",
  "restoreUnifiedContent",
);
const restore = exportedFunction(
  actions,
  "restoreUnifiedContent",
  "permanentlyDeleteUnifiedContent",
);
const purge = exportedFunction(
  actions,
  "permanentlyDeleteUnifiedContent",
  "bulkUpdateUnifiedContent",
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
  restore.includes('.not("deleted_at", "is", null)') &&
    restore.includes('status: "unpublished"') &&
    restore.includes("deleted_at: null"),
);
check(
  "Restore blocks a conflicting active slug with a clear domain result",
  restore.includes('.eq("slug", slug)') &&
    restore.includes('.is("deleted_at", null)') &&
    restore.includes("topicRestoreSlugConflict(slug, id)"),
);
check(
  "Permanent delete requires explicit confirmation and only targets Trash",
  purge.includes('getString(formData, "confirm_permanent") !== "true"') &&
    purge.includes("loadDeletedTopic(id)") &&
    purge.includes(".delete()") &&
    purge.includes('.not("deleted_at", "is", null)'),
);
check(
  "Permanent delete releases the slug and delegates media cleanup",
  purge.includes("slug_released: true") &&
    purge.includes(
      "synchronizeMediaReferenceWriteScopesAfterDomainMutation",
    ),
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
