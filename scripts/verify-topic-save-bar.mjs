import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const saveBar = read("src/components/admin/SaveBar.tsx");
const previousButton = read("src/components/admin/content/editors/article/TopicPreviousTabButton.tsx");
const createEditor = read("src/components/admin/content/editors/ArticleCreateEditor.tsx");
const editEditor = read("src/components/admin/content/editors/ArticleEditor.tsx");
const createAction = read("src/app/admin/content/topics/article-actions/create.ts");

let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

check(
  "create and edit render the same shared save bar once",
  createEditor.match(/<SaveBar/g)?.length === 1 &&
    editEditor.match(/<SaveBar/g)?.length === 1 &&
    createEditor.includes('mode="create"') &&
    editEditor.includes('mode="edit"'),
);
check(
  "create no longer owns duplicate publishing buttons",
  !createEditor.includes("إنشاء كمسودة") &&
    !createEditor.includes("نشر الآن") &&
    !createEditor.includes("TopicPreviousTabButton"),
);
check(
  "shared bar exposes the required common actions",
  previousButton.includes("السابق") &&
    ["حفظ", "حفظ وإغلاق", "إغلاق", "نشر الموضوع"].every((label) => saveBar.includes(label)),
);
check(
  "create actions submit explicit draft, close, and publish intents",
  saveBar.includes('value="draft"') &&
    saveBar.includes('value="draft-close"') &&
    saveBar.includes('value="publish"') &&
    !saveBar.includes("props.createAction") &&
    createEditor.includes('action={createTopic}'),
);
check(
  "create save-and-close redirects to the topics list",
  createAction.includes('intent === "draft-close"') &&
    createAction.includes('"/admin/content/topics?notice=created"'),
);
check(
  "draft save is hidden when redundant and named by its real transition",
  saveBar.includes('props.status !== "draft"') &&
    saveBar.includes("تحويل إلى مسودة") &&
    !saveBar.includes("حفظ كمسودة"),
);
check(
  "preview actions are edit-only and public view requires published status",
  saveBar.includes('props.mode === "edit"') &&
    saveBar.includes("isPublished && props.slug") &&
    !createEditor.includes("معاينة داخلية") &&
    !createEditor.includes("النسخة العامة"),
);
check(
  "edit header no longer duplicates internal preview",
  !editEditor.includes("معاينة داخلية") && editEditor.includes("closeHref={returnPath}"),
);
check(
  "all save and status buttons bind their current form server actions",
  [
    "props.saveAction",
    "props.saveAndCloseAction",
    "props.draftAction",
    "props.publishAction",
    "props.unpublishAction",
  ].every((action) => saveBar.includes(`formAction={${action}}`)),
);
check(
  "shared pending state disables actions and announces progress",
  saveBar.includes("useFormStatus") &&
    saveBar.includes("disabled={pending}") &&
    saveBar.includes('aria-live="polite"') &&
    saveBar.includes("ACTION_LABELS"),
);
check(
  "shared dirty guard covers close, links, and browser unload",
  saveBar.includes("serializeForm") &&
    saveBar.includes('window.addEventListener("beforeunload"') &&
    saveBar.includes('document.addEventListener("click"') &&
    saveBar.includes("window.confirm(LEAVE_WARNING)") &&
    saveBar.includes("router.push(closeHref)"),
);
check(
  "shared bar retains responsive wrapping without horizontal overflow",
  saveBar.includes("flex-1") &&
    saveBar.includes("sm:flex-none") &&
    saveBar.includes("basis-full") &&
    saveBar.includes("AdminStickyFormBar"),
);

console.log(`verify:topic-save-bar passed (${passed} assertions)`);
