import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const normalizePath = (value: string) => value.replaceAll("\\", "/");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

const modal = read("src/components/admin/VenesiaModal.tsx");
const redirectModal = read(
  "src/app/admin/seo/redirects/RedirectFormModal.tsx",
);
const formRuntime = read("src/components/admin/ui/AdminFormRuntime.tsx");
const confirmDialog = read("src/components/admin/ui/AdminConfirmDialog.tsx");
const linkPicker = read("src/components/admin/ui/AdminLinkPicker.tsx");
const pendingConsumer = read(
  "src/app/admin/pages-blocks/pages/CreatePageModal.tsx",
);

const keyDownSection = modal.slice(
  modal.indexOf("function handleKeyDown"),
  modal.indexOf('document.addEventListener("keydown", handleKeyDown)'),
);
const emptyFocusablesSection = keyDownSection.slice(
  keyDownSection.indexOf("if (!focusable.length)"),
  keyDownSection.indexOf("const first = focusable[0]"),
);
const outsidePanelRecoverySection = keyDownSection.slice(
  keyDownSection.indexOf(
    "if (!(activeElement instanceof Node) || !panel.contains(activeElement))",
  ),
  keyDownSection.indexOf(
    "if (!focusable.includes(activeElement as HTMLElement))",
  ),
);
const cleanupSection = modal.slice(
  modal.indexOf("return () => {", modal.indexOf("function handleKeyDown")),
  modal.indexOf("}, [closeOnEscape, mounted, open])"),
);

check(
  "VenesiaModal exposes a generic initial-focus contract",
  modal.includes(
    "initialFocusRef?: RefObject<HTMLElement | null>",
  ) &&
    modal.includes("const configuredInitialFocusRef = useRef(initialFocusRef)") &&
    modal.includes(
      "const configuredTarget = configuredInitialFocusRef.current?.current ?? null",
    ),
);
check(
  "configured initial focus is constrained to a visible enabled modal descendant",
  modal.includes("panel.contains(configuredTarget)") &&
    modal.includes("isVisibleAndEnabled(configuredTarget)") &&
    modal.includes("document.activeElement === configuredTarget"),
);
check(
  "default initial focus uses the first current interactive element and the panel fallback",
  modal.includes("const first = getFocusableElements(panel)[0]") &&
    modal.includes("(first ?? panel).focus({ preventScroll: true })") &&
    modal.includes("tabIndex={-1}") &&
    modal.includes("ref={panelRef}"),
);
check(
  "hidden, disabled, inert, and untabbable elements are excluded",
  modal.includes('element.matches(":disabled")') &&
    modal.includes('element.getAttribute("aria-disabled") === "true"') &&
    modal.includes("[hidden], [aria-hidden=\"true\"], [inert]") &&
    modal.includes("element.getClientRects().length > 0") &&
    modal.includes("element.tabIndex >= 0"),
);
check(
  "focusables are recalculated inside every Tab event",
  keyDownSection.includes("const focusable = getFocusableElements(panel)") &&
    !modal.slice(0, modal.indexOf("function handleKeyDown")).includes(
      "const focusable = getFocusableElements(panel)",
    ),
);
check(
  "forward focus trap wraps the current last element to the current first element",
  keyDownSection.includes("!event.shiftKey && activeElement === last") &&
    keyDownSection.includes("first.focus({ preventScroll: true })"),
);
check(
  "backward focus trap wraps the current first element to the current last element",
  keyDownSection.includes("event.shiftKey && activeElement === first") &&
    keyDownSection.includes("last.focus({ preventScroll: true })"),
);
check(
  "Tab recovery prevents escape when the active element leaves the modal",
  outsidePanelRecoverySection.includes("event.preventDefault()") &&
    outsidePanelRecoverySection.includes("return;"),
);
check(
  "Tab from outside the modal restores the current first focusable element",
  outsidePanelRecoverySection.includes("if (event.shiftKey)") &&
    outsidePanelRecoverySection.includes(
      "first.focus({ preventScroll: true })",
    ),
);
check(
  "Shift+Tab from outside the modal restores the current last focusable element",
  outsidePanelRecoverySection.includes(
    "last.focus({ preventScroll: true })",
  ) &&
    outsidePanelRecoverySection.indexOf(
      "last.focus({ preventScroll: true })",
    ) < outsidePanelRecoverySection.indexOf("} else {"),
);
check(
  "an empty dynamic focusable set prevents escape and focuses the modal panel",
  emptyFocusablesSection.includes("event.preventDefault()") &&
    emptyFocusablesSection.includes("panel.focus({ preventScroll: true })") &&
    emptyFocusablesSection.includes("return;"),
);
check(
  "a disabled active descendant recovers within the modal",
  keyDownSection.includes("!focusable.includes(activeElement as HTMLElement)") &&
    keyDownSection.includes("event.shiftKey ? last : first"),
);
check(
  "only the topmost ARIA modal owns the active focus trap",
  modal.includes("function isTopmostDialog") &&
    modal.includes("openDialogs.at(-1) === panel") &&
    keyDownSection.includes("!isTopmostDialog(panel)"),
);
check(
  "the non-interactive backdrop is outside the tab order",
  modal.includes('data-venesia-modal-root=""') &&
    modal.includes('data-venesia-modal=""') &&
    modal.indexOf("tabIndex={-1}") < modal.indexOf("ref={panelRef}"),
);
check(
  "open lifecycle captures a generic focus-return snapshot",
  modal.includes("type FocusReturnSnapshot") &&
    modal.includes("function captureFocusReturnSnapshot") &&
    modal.includes("focusReturnSnapshotRef.current =") &&
    modal.includes("captureFocusReturnSnapshot(document.activeElement)"),
);
check(
  "close cleanup restores a still-connected visible opener",
  modal.includes("function resolveFocusReturnTarget") &&
    modal.includes("snapshot.element.isConnected") &&
    modal.includes("isVisibleAndEnabled(snapshot.element)") &&
    cleanupSection.includes(
      "focusSafely(resolveFocusReturnTarget(focusReturnSnapshot))",
    ),
);
check(
  "replaced openers are recovered through generic semantic and context identity",
  modal.includes("function replacementFocusScore") &&
    modal.includes("data-focus-return-context") &&
    modal.includes("commonPrefixLength(snapshot.contextText, candidateContext)") &&
    modal.includes("return scoredCandidates[0]?.candidate ?? null"),
);
check(
  "opener disappearance uses dialog and document-order fallbacks before body",
  cleanupSection.includes("const remainingDialogs") &&
    cleanupSection.includes("const fallbackDialog = remainingDialogs.at(-1)") &&
    cleanupSection.includes("focusFirstOrPanel(fallbackDialog)") &&
    cleanupSection.includes(
      "focusSafely(resolveDocumentFocusFallback(focusReturnSnapshot))",
    ) &&
    cleanupSection.indexOf("focusFirstOrPanel(fallbackDialog)") <
      cleanupSection.indexOf("resolveDocumentFocusFallback") &&
    cleanupSection.indexOf("resolveDocumentFocusFallback") <
      cleanupSection.indexOf("document.body.focus") &&
    cleanupSection.includes("document.body.focus({ preventScroll: true })"),
);
check(
  "focus scheduling is cancelled and listeners are paired exactly once",
  cleanupSection.includes("window.cancelAnimationFrame(focusFrame)") &&
    occurrenceCount(
      modal,
      /document\.addEventListener\("keydown", handleKeyDown\)/g,
    ) === 1 &&
    occurrenceCount(
      modal,
      /document\.removeEventListener\("keydown", handleKeyDown\)/g,
    ) === 1,
);
check(
  "close owns one restore scheduler and clears its captured snapshot",
  occurrenceCount(
    modal,
    /returnFocusFrameRef\.current = window\.requestAnimationFrame/g,
  ) === 1 &&
    cleanupSection.includes("focusReturnSnapshotRef.current = null") &&
    cleanupSection.includes("returnFocusFrameRef.current = null"),
);
check(
  "VenesiaModal contains no Redirect-specific policy or selectors",
  !/Redirect|redirect|source_path|destination_path/.test(modal),
);
check(
  "Redirect remains a presentation and Form Runtime consumer without a local focus trap",
  redirectModal.includes("<VenesiaModal") &&
    redirectModal.includes("<AdminFormRuntime<UrlRedirectRecord>") &&
    !redirectModal.includes("initialFocusRef") &&
    !redirectModal.includes("document.addEventListener") &&
    !redirectModal.includes("activeElement") &&
    !redirectModal.includes("onKeyDown="),
);
check(
  "programmatic successful save closes through the shared modal lifecycle",
  redirectModal.indexOf("onSaved(state.result);") >= 0 &&
    redirectModal.indexOf("onSaved(state.result);") <
      redirectModal.indexOf("onClose();", redirectModal.indexOf("onSaved(state.result);")) &&
    cleanupSection.includes(
      "focusSafely(resolveFocusReturnTarget(focusReturnSnapshot))",
    ),
);
check(
  "Admin Form Runtime retains validation-focus ownership",
  formRuntime.includes("function focusTarget(targetIdOrName: string)") &&
    formRuntime.includes("firstFieldError(state)") &&
    formRuntime.includes("focusable?.focus({ preventScroll: true })"),
);
check(
  "VenesiaModal exposes opt-in topmost Escape while confirmation keeps its independent cancel owner",
  modal.includes("closeOnEscape?: boolean") &&
    keyDownSection.includes('event.key === "Escape" && closeOnEscape') &&
    keyDownSection.includes("closeRef.current()") &&
    confirmDialog.includes('event.key === "Escape"') &&
    confirmDialog.includes("cancelRef.current()"),
);
check(
  "the shared confirmation reference retains dynamic trapping and focus return",
  confirmDialog.includes(
    "panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)",
  ) &&
    confirmDialog.includes("focusTarget?.isConnected") &&
    confirmDialog.includes("returnFocusRef"),
);
check(
  "nested-control and disabled-pending VenesiaModal consumers remain represented",
  linkPicker.includes("<AdminMediaPickerModal") &&
    pendingConsumer.includes("<AdminFormRuntime") &&
    pendingConsumer.includes("disabled={pending}") &&
    pendingConsumer.includes("<VenesiaModal"),
);

const actualConsumers = collectTsxFiles(join(ROOT, "src"))
  .filter((sourceFile) => readFileSync(sourceFile, "utf8").includes("<VenesiaModal"))
  .map((sourceFile) =>
    normalizePath(relative(ROOT, sourceFile)),
  )
  .sort();
const expectedConsumers = [
  "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
  "src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx",
  "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx",
  "src/app/admin/pages-blocks/pages/CreatePageModal.tsx",
  "src/app/admin/seo/redirects/RedirectFormModal.tsx",
  "src/app/admin/users-roles/AdminUserFormModal.tsx",
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/media/AdminMediaPickerModal.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/components/admin/ui/AdminDuplicateResourceModal.tsx",
  "src/components/admin/ui/AdminLinkPicker.tsx",
].sort();
check(
  "all VenesiaModal consumers are inventoried for the shared correction",
  actualConsumers.length === expectedConsumers.length &&
    actualConsumers.every(
      (sourceFile, index) => sourceFile === expectedConsumers[index],
    ),
);

console.log(
  `VenesiaModal accessibility verifier passed (${passed} assertions, ${actualConsumers.length} consumers).`,
);
