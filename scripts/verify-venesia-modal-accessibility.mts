import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const normalizePath = (value: string) => value.replaceAll("\\", "/");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8").replaceAll("\r\n", "\n");

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
  modal.indexOf('window.addEventListener("keydown", handleKeyDown)'),
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
      /window\.addEventListener\("keydown", handleKeyDown\)/g,
    ) === 1 &&
    occurrenceCount(
      modal,
      /window\.removeEventListener\("keydown", handleKeyDown\)/g,
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
  "src/app/admin/projects/locations/ProjectLocationFormModal.tsx",
  "src/app/admin/seo/redirects/RedirectFormModal.tsx",
  "src/app/admin/users-roles/AdminUserFormModal.tsx",
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/media/AdminMediaImageField.tsx",
  "src/components/admin/media/AdminMediaPickerModal.tsx",
  "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  "src/components/admin/projects/tracking/TrackingForms.tsx",
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

// This bounded inventory makes exclusions explicit without changing the shared
// Modal default. A newly registered mount must receive its own close-path review.
const excludedMounts = new Map([
  ["src/app/admin/users-roles/AdminUserFormModal.tsx", "sensitive status confirmation"],
  ["src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx", "raw form close without Runtime protection"],
  ["src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx", "raw assignment pending boundary"],
  ["src/components/admin/ui/AdminDuplicateResourceModal.tsx", "dormant raw one-shot close"],
]);
const ordinaryMounts = new Set([
  "src/components/admin/entity-list/AdminEntityListFilters.tsx",
  "src/components/admin/media/AdminMediaImageField.tsx",
  "src/components/admin/ui/AdminLinkPicker.tsx",
  "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
  "src/components/admin/media/AdminMediaPickerModal.tsx",
]);
function assertMountPolicies(overrides: Record<string, string> = {}) {
  let total = 0, enabled = 0, excluded = 0, guarded = 0;
  for (const path of expectedConsumers) {
    const file = ts.createSourceFile(path, overrides[path] ?? read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let mounts = 0;
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(file) === "VenesiaModal") {
        mounts += 1; total += 1;
        const attr = (name: string, element = node) => element.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText(file) === name) as ts.JsxAttribute | undefined;
        const escape = attr("closeOnEscape");
        const optedIn = Boolean(escape && (!escape.initializer || ts.isJsxExpression(escape.initializer) && escape.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword));
        if (excludedMounts.has(path)) {
          assert.ok(!escape, `${path}: ${excludedMounts.get(path)} retains the shared default`); excluded += 1;
        } else {
          assert.ok(optedIn, `${path}: reviewed mount explicitly opts into Escape`); enabled += 1;
          if (!ordinaryMounts.has(path)) {
            guarded += 1;
            const onClose = attr("onClose");
            assert.ok(onClose?.initializer && ts.isJsxExpression(onClose.initializer) && onClose.initializer.expression, `${path}: actual close binding exists`);
            let callback: ts.Node = onClose.initializer.expression;
            if (ts.isIdentifier(callback)) {
              const name = callback.text;
              let scope: ts.Node = node;
              while (scope.parent && !ts.isFunctionDeclaration(scope)) scope = scope.parent;
              let declaration: ts.Node | undefined;
              const find = (candidate: ts.Node) => {
                if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === name) declaration = candidate;
                if (ts.isVariableDeclaration(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name) declaration = candidate.initializer;
                ts.forEachChild(candidate, find);
              };
              find(scope); assert.ok(declaration, `${path}: close callback resolves within its component`); callback = declaration;
            }
            const calls: ts.CallExpression[] = [];
            const findCalls = (candidate: ts.Node) => { if (ts.isCallExpression(candidate)) calls.push(candidate); ts.forEachChild(candidate, findCalls); };
            findCalls(callback);
            assert.equal(calls.length, 1, `${path}: Escape routes only to the Runtime close owner`);
            const call = calls[0], member = call.expression;
            assert.ok(ts.isPropertyAccessExpression(member) && member.name.text === "requestClose" && ts.isPropertyAccessExpression(member.expression) && member.expression.name.text === "current" && ts.isIdentifier(member.expression.expression) && call.arguments.length === 0, `${path}: close invokes its Runtime ref`);
            const refName = member.expression.expression.text;
            let boundRuntime = false;
            const findRuntime = (candidate: ts.Node) => {
              if (ts.isJsxOpeningElement(candidate) && candidate.tagName.getText(file) === "AdminFormRuntime") {
                const ref = attr("runtimeRef", candidate)?.initializer;
                if (ref && ts.isJsxExpression(ref) && ref.expression?.getText(file) === refName) boundRuntime = true;
              }
              ts.forEachChild(candidate, findRuntime);
            };
            findRuntime(node.parent); assert.ok(boundRuntime, `${path}: the same Runtime ref owns the nested form`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    assert.equal(mounts, path.endsWith("/TrackingForms.tsx") ? 4 : 1, `${path}: every actual mount is classified`);
  }
  assert.deepEqual({ total, enabled, excluded, guarded }, { total: 20, enabled: 16, excluded: 4, guarded: 11 });
}
assertMountPolicies();
check("AST classifies all 20 mounts: 16 explicit opt-ins including 11 bound Runtime forms, four exclusions", true);
for (const [label, path, source] of [
  ["lost reviewed opt-in", "src/components/admin/entity-list/AdminEntityListFilters.tsx", read("src/components/admin/entity-list/AdminEntityListFilters.tsx").replace("        closeOnEscape\n", "")],
  ["unsafe excluded adoption", "src/components/admin/ui/AdminDuplicateResourceModal.tsx", read("src/components/admin/ui/AdminDuplicateResourceModal.tsx").replace("<VenesiaModal", "<VenesiaModal closeOnEscape")],
  ["orphan guarded-close tokens", "src/app/admin/seo/redirects/RedirectFormModal.tsx", redirectModal.replace("onClose={requestClose}", "onClose={() => onClose()}")],
] as const) {
  assert.ok(source !== read(path), `Policy mutation applied: ${label}`);
  assert.throws(() => assertMountPolicies({ [path]: source }), { name: "AssertionError" });
  check(`negative rejects ${label}`, true);
}

// Execute the existing owners, not a second dismissal implementation. The ports
// model event phase order, connected focus targets and RAF cleanup; actual browser
// focus, geometry and RTL remain separate Local Product Review evidence.
type Props = Record<string, unknown>;
type Tree = { type: unknown; props: Props };
type Component = (props: Props) => unknown;
type Effect = () => void | (() => void);
type Slot = { value?: unknown; current?: unknown; deps?: unknown[]; effect?: Effect; cleanup?: () => void; pending?: boolean };

function loadModule<T>(path: string, source: string, ports: Props, globals: Props = {}): T {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const commonJsModule = { exports: {} };
  Function("exports", "module", "require", ...Object.keys(globals), output)(commonJsModule.exports, commonJsModule, (name: string) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    assert.ok(Object.hasOwn(ports, name), `Unexpected lifecycle fixture import ${name} in ${path}`);
    return ports[name];
  }, ...Object.values(globals));
  return commonJsModule.exports as T;
}

const LIFECYCLE_TAB_ICON_BOUNDARY_ERROR =
  "AdminModuleTabIcon is outside the Modal lifecycle fixture execution boundary";

function lifecycleSourceTree(path: string, source: string) {
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(
    (tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length,
    0,
    path + ": lifecycle source must independently parse",
  );
  return tree;
}

function canonicalLifecycleTabIconPort(
  runtimeSource = formRuntime,
  tabsSource = read("src/components/admin/ui/AdminModuleTabs.tsx"),
) {
  const runtimeTree = lifecycleSourceTree("AdminFormRuntime.tsx", runtimeSource);
  const imports = runtimeTree.statements.filter(ts.isImportDeclaration).filter(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminModuleTabs");
  assert.equal(imports.length, 1, "Runtime retains its one canonical Tabs import");
  const clause = imports[0]!.importClause;
  assert.ok(clause && !clause.isTypeOnly && !clause.name);
  const bindings = clause.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  assert.deepEqual(
    bindings.elements.filter(node => !node.isTypeOnly).map(node => ({
      local: node.name.text,
      exported: (node.propertyName ?? node.name).text,
    })),
    [{ local: "AdminModuleTabIcon", exported: "AdminModuleTabIcon" }],
    "Only the existing canonical icon binding is outside this lifecycle fixture",
  );
  const tabsTree = lifecycleSourceTree("AdminModuleTabs.tsx", tabsSource);
  const exports = tabsTree.statements.filter(ts.isFunctionDeclaration).filter(node =>
    node.name?.text === "AdminModuleTabIcon" &&
    node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    !node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  assert.equal(exports.length, 1, "The actual canonical Tabs module exports its named icon");
  assert.ok(exports[0]!.body);
  // This fixture executes the Runtime close/dirty hook, not AdminFormActions.
  // An unexpected presentation call must fail rather than render a parallel icon.
  const outsideLifecycleIcon = (): never => {
    throw new Error(LIFECYCLE_TAB_ICON_BOUNDARY_ERROR);
  };
  return {
    importSource: imports[0]!.getText(runtimeTree),
    port: { AdminModuleTabIcon: outsideLifecycleIcon },
  };
}

function canonicalLifecycleListboxStyles(
  source = read("src/components/admin/ui/AdminListboxSelect.tsx"),
) {
  const tree = lifecycleSourceTree("AdminListboxSelect.tsx", source);
  const imports = tree.statements.filter(ts.isImportDeclaration).filter(node =>
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "../../../lib/admin/admin-ui-styles");
  assert.equal(imports.length, 1, "Listbox retains its exact canonical styles module");
  const clause = imports[0]!.importClause;
  assert.equal(Boolean(clause && !clause.isTypeOnly && !clause.name), true);
  const bindings = clause!.namedBindings;
  assert.equal(Boolean(bindings && ts.isNamedImports(bindings)), true);
  assert.ok(bindings && ts.isNamedImports(bindings));
  assert.deepEqual(
    bindings.elements.filter(node => !node.isTypeOnly).map(node => ({
      local: node.name.text,
      exported: (node.propertyName ?? node.name).text,
    })),
    [{ local: "ADMIN_CINEMATIC_GOLD_V1", exported: "ADMIN_CINEMATIC_GOLD_V1" }],
  );
  const scrollbar = loadModule<Props>(
    "src/components/venesia-scrollbar-styles.ts",
    read("src/components/venesia-scrollbar-styles.ts"),
    {},
  );
  const port = loadModule<Props>(
    "src/lib/admin/admin-ui-styles.ts",
    read("src/lib/admin/admin-ui-styles.ts"),
    { "../../components/venesia-scrollbar-styles": scrollbar },
  );
  assert.equal(typeof port.ADMIN_CINEMATIC_GOLD_V1, "object");
  assert.notEqual(port.ADMIN_CINEMATIC_GOLD_V1, null);
  return { source, importSource: imports[0]!.getText(tree), port };
}

function trees(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(trees);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const tree = value as Tree;
  return [tree, ...trees(tree.props.children)];
}

function controlledHooks() {
  let active: { slots: Slot[]; index: number };
  const equal = (left: unknown[] | undefined, right: unknown[] | undefined) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const effect = (callback: Effect, deps?: unknown[]) => {
    const index = active.index++, previous = active.slots[index];
    if (!previous || !equal(previous.deps, deps)) active.slots[index] = { effect: callback, deps, cleanup: previous?.cleanup, pending: true };
  };
  const hooks = {
    useRef(value: unknown) { return active.slots[active.index++] ??= { current: value }; },
    useId() { return `modal-fixture-${active.index++}`; },
    useState(initial: unknown) {
      const owner = active, index = owner.index++;
      const slot = owner.slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slot.value, (update: unknown) => { slot.value = typeof update === "function" ? update(slot.value) : update; }];
    },
    useMemo(factory: () => unknown, deps?: unknown[]) {
      const index = active.index++, previous = active.slots[index];
      if (!previous || !equal(previous.deps, deps)) active.slots[index] = { value: factory(), deps };
      return active.slots[index].value;
    },
    useCallback(callback: unknown, deps?: unknown[]) { return hooks.useMemo(() => callback, deps); },
    useEffect: effect,
    useLayoutEffect: effect,
    createContext: () => ({ Provider: Symbol("fixture-context") }),
  };
  return {
    hooks,
    runner(component: Component) {
      const state = { slots: [] as Slot[], index: 0 };
      return {
        render(props: Props) { const previous = active; active = state; state.index = 0; try { return component(props); } finally { active = previous; } },
        effects() { for (const slot of state.slots) if (slot?.pending) { slot.pending = false; slot.cleanup?.(); const cleanup = slot.effect?.(); slot.cleanup = typeof cleanup === "function" ? cleanup : undefined; } },
        cleanup() { for (const slot of state.slots) { slot?.cleanup?.(); if (slot) slot.cleanup = undefined; } },
      };
    },
  };
}

class LocalEventTarget extends EventTarget {
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    super.addEventListener(type, listener, options);
    if (listener) { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); }
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    super.removeEventListener(type, listener, options);
    if (listener) this.listeners.get(type)?.delete(listener);
  }
  count(type: string) { return this.listeners.get(type)?.size ?? 0; }
}

function domPorts() {
  const document = new LocalEventTarget();
  const window = new LocalEventTarget();
  const frames = new Map<number, () => void>();
  let frame = 0;
  const connected: FixtureElement[] = [];
  class FixtureElement extends LocalEventTarget {
    tagName: string;
    attrs: Record<string, string>;
    children: FixtureElement[] = [];
    parent: FixtureElement | null = null;
    style = { overflow: "auto", display: "block", visibility: "visible" };
    isConnected = true;
    tabIndex = 0;
    disabled = false;
    textContent = "";
    value = "seed";
    constructor(tagName = "button", attrs: Record<string, string> = {}) { super(); this.tagName = tagName.toUpperCase(); this.attrs = attrs; connected.push(this); }
    get id() { return this.attrs.id ?? ""; }
    get ownerDocument() { return document; }
    getAttribute(name: string) { return this.attrs[name] ?? null; }
    hasAttribute(name: string) { return Object.hasOwn(this.attrs, name); }
    contains(value: unknown): boolean { return this === value || this.children.some(child => child.contains(value)); }
    append(child: FixtureElement) { child.parent = this; this.children.push(child); }
    matches(selector: string) { return selector === ":disabled" ? this.disabled : false; }
    closest(selector: string): FixtureElement | null {
      if (selector === "form") return this instanceof FixtureForm ? this : this.parent?.closest(selector) ?? null;
      if (selector.includes("[hidden]")) return this.hasAttribute("hidden") || this.attrs["aria-hidden"] === "true" || this.hasAttribute("inert") ? this : this.parent?.closest(selector) ?? null;
      return null;
    }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 30 }; }
    getClientRects() { return this.isConnected && this.style.display !== "none" ? [this.getBoundingClientRect()] : []; }
    querySelectorAll(): FixtureElement[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
    querySelector(selector: string) { return this.querySelectorAll().find(child => selector.startsWith("[") ? child.hasAttribute(selector.slice(1, -1)) : true) ?? null; }
    focus() { doc.activeElement = this; }
    remove() { this.isConnected = false; this.children.forEach(child => child.remove()); }
  }
  class FixtureForm extends FixtureElement {
    constructor() { super("form"); }
    get elements() { return this.children; }
  }
  class FixtureFormData {
    form: FixtureForm;
    constructor(form: FixtureForm) { this.form = form; }
    entries() { return this.form.elements.filter(element => element.hasAttribute("name") && !element.disabled).map(element => [element.getAttribute("name")!, element.value] as [string, string]).values(); }
  }
  const body = new FixtureElement("body"), root = new FixtureElement("html");
  body.tabIndex = root.tabIndex = -1;
  const scrolling = { scrollTop: 37, scrollLeft: 4, scrollTo(position: { top: number; left: number }) { this.scrollTop = position.top; this.scrollLeft = position.left; } };
  const doc = Object.assign(document, {
    body, documentElement: root, activeElement: body, scrollingElement: scrolling,
    querySelectorAll(selector: string) { return connected.filter(element => element.isConnected && (selector.includes('[role="dialog"]') ? element.attrs.role === "dialog" && element.attrs["aria-modal"] === "true" : element !== body && element !== root && element.tabIndex >= 0 && element.attrs.role !== "dialog" && !(element instanceof FixtureForm))); },
    getElementById(id: string) { return connected.find(element => element.isConnected && element.id === id) ?? null; },
  });
  const win = Object.assign(window, {
    getComputedStyle: (element: FixtureElement) => element.style,
    requestAnimationFrame(callback: () => void) { frames.set(++frame, callback); return frame; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    location: { href: "http://fixture.local/admin/content/topics", origin: "http://fixture.local", assign() { throw new Error("Navigation outside fixture callback scope"); } },
  });
  return {
    document: doc, window: win, FixtureElement, FixtureForm,
    globals: { document: doc, window: win, Node: FixtureElement, Element: FixtureElement, HTMLElement: FixtureElement, HTMLFormElement: FixtureForm, FormData: FixtureFormData },
    frames,
    flushFrames() { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback()); },
    key(key = "Escape", options: { prevented?: boolean; shift?: boolean; targetHandler?: (event: Event) => void } = {}) {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperties(event, { key: { value: key }, shiftKey: { value: options.shift ?? false } });
      if (options.prevented) event.preventDefault();
      options.targetHandler?.(event);
      // Native EventTarget preserves registration order and removals in-flight.
      // Browser target/React handlers precede document bubble, then window bubble.
      doc.dispatchEvent(event);
      if (!event.cancelBubble) win.dispatchEvent(event);
      return event;
    },
    input(target: FixtureElement) { const event = new Event("input"); Object.defineProperty(event, "target", { value: target }); doc.dispatchEvent(event); },
  };
}

function lifecycleFixture(modalSource = modal, runtimeSource = formRuntime) {
  const dom = domPorts(), controlled = controlledHooks();
  const empty = () => null;
  const buttons = { AdminModalCancelButton: empty, AdminModalDangerButton: empty, AdminModalPrimaryButton: empty };
  const stylePorts = { ADMIN_FORM: {}, ADMIN_MODAL: {}, ADMIN_MODAL_COMPACT: {}, ADMIN_MODAL_SIZES: { md: "" } };
  const commonPorts = { react: controlled.hooks, "react-dom": { createPortal: (tree: unknown) => tree }, "../../../hooks/use-client-mounted": { useClientMounted: () => true }, "../../../lib/admin/admin-ui-styles": stylePorts, "./AdminModalButtons": buttons };
  const Confirm = loadModule<{ default: Component }>("AdminConfirmDialog.tsx", confirmDialog, commonPorts, dom.globals).default;
  const Modal = loadModule<{ default: Component }>("VenesiaModal.tsx", modalSource, {
    react: controlled.hooks, "react-dom": { createPortal: (tree: unknown) => tree },
    "../../lib/admin/admin-ui-styles": stylePorts, "./ui/AdminModalButtons": buttons,
    "../../hooks/use-client-mounted": { useClientMounted: () => true },
    "../venesia-scrollbar-styles": { VENESIA_SCROLLBAR_VISUAL_CLASSES: "" },
    "./AdminFeedbackProvider": { useAdminFeedbackModalHost: () => ({ current: null }) },
  }, dom.globals).default;
  const pure = <T,>(path: string, ports: Props = {}) => loadModule<T>(path, read(path), ports, dom.globals);
  const safe = pure<Props>("src/lib/security/safe-internal-path.ts");
  const formDecision = pure<Props>("src/lib/admin/form-runtime.ts", { "../security/safe-internal-path.ts": safe });
  const formDom = pure<Props>("src/lib/admin/form-dom-preservation.ts");
  const tabIconBoundary = canonicalLifecycleTabIconPort(runtimeSource);
  type Guard = { isDirty: boolean; dialog: unknown; requestCallback: (callback: () => void) => void };
  const Runtime = loadModule<{ useAdminUnsavedChangesGuard: (props: Props) => Guard }>("AdminFormRuntime.tsx", runtimeSource, {
    react: controlled.hooks, "react-dom": {}, "next/navigation": { useRouter: () => ({ push() { throw new Error("Unexpected fixture navigation"); } }) },
    "@tanstack/react-query": {}, "../../../lib/admin/form-dom-preservation": formDom,
    "../../../lib/admin/form-runtime": formDecision,
    "../../../lib/admin/entity-list/data-engine/instant-mutation-cache": {},
    "../../../lib/security/safe-internal-path": safe,
    "../AdminFeedbackProvider": {}, "./AdminConfirmDialog": { default: Confirm }, "./AdminForm": {},
    "./AdminModuleTabs": tabIconBoundary.port,
  }, dom.globals);
  const listboxStyles = canonicalLifecycleListboxStyles();
  const Listbox = loadModule<{ default: Component }>("AdminListboxSelect.tsx", listboxStyles.source, {
    react: controlled.hooks, "react-dom": { createPortal: (tree: unknown) => tree },
    "../../../hooks/use-client-mounted": { useClientMounted: () => true },
    "../../../lib/admin/admin-ui-styles": listboxStyles.port,
    "./admin-filter-styles": { ADMIN_FILTER_MENU_ATTR: "data-filter-menu", isInsideAdminFilterMenu: () => false },
    "./useAdminFloatingMenuPosition": { useAdminFloatingMenuPosition: () => ({ style: {}, placement: "bottom" }) },
  }, dom.globals).default;
  function mount(props: Props, component = Modal, panelAttribute = "data-venesia-modal") {
    const runner = controlled.runner(component);
    const panel = new dom.FixtureElement("section", { role: "dialog", "aria-modal": "true" });
    panel.tabIndex = -1;
    const first = new dom.FixtureElement("button", { "data-admin-confirm-cancel": "" }), last = new dom.FixtureElement("button");
    panel.append(first); panel.append(last);
    let current = props;
    const render = () => {
      const tree = runner.render({ open: true, title: "اختبار دورة الحياة", ...current });
      const ref = trees(tree).find(node => Object.hasOwn(node.props, panelAttribute))?.props.ref as { current: unknown } | undefined;
      if (current.open === false) {
        assert.equal(tree, null); panel.isConnected = false;
      } else {
        assert.ok(ref, "Actual owner panel ref exists"); ref.current = panel;
        panel.isConnected = true; panel.children.forEach(child => { child.isConnected = true; });
      }
      runner.effects(); return tree;
    };
    render();
    return { panel, first, last, render, update(next: Props) { current = { ...current, ...next }; return render(); }, close() { runner.cleanup(); panel.remove(); } };
  }
  return { ...dom, controlled, Confirm, Modal, Listbox, Runtime, mount };
}

function execute(label: string, proof: () => void) { proof(); check(label, true); }

function ordinaryClose(source = modal) {
  const fixture = lifecycleFixture(source);
  let closed = 0;
  const opener = new fixture.FixtureElement("button", { id: "opener" }); opener.focus();
  const modal = fixture.mount({ closeOnEscape: true, onClose() { closed += 1; modal.close(); } });
  fixture.flushFrames();
  assert.equal(fixture.document.activeElement, modal.first);
  assert.equal(fixture.window.count("keydown"), 1);
  assert.equal(fixture.document.count("keydown"), 0);
  const event = fixture.key();
  assert.equal(closed, 1); assert.equal(event.defaultPrevented, true);
  assert.equal(fixture.window.count("keydown"), 0);
  fixture.flushFrames();
  assert.equal(fixture.document.activeElement, opener);
  assert.equal(fixture.document.documentElement.style.overflow, "auto");
  assert.equal(fixture.document.body.style.overflow, "auto");
  assert.deepEqual([fixture.document.scrollingElement.scrollTop, fixture.document.scrollingElement.scrollLeft], [37, 4]);
  fixture.key(); assert.equal(closed, 1);
}
execute("actual Modal opt-in Escape consumes once, cleans listeners, restores opener and scroll", ordinaryClose);

execute("actual Modal default and explicit false preserve existing Escape retention", () => {
  for (const props of [{}, { closeOnEscape: false }]) {
    const fixture = lifecycleFixture(); let closed = 0;
    const modal = fixture.mount({ ...props, onClose() { closed += 1; } });
    assert.equal(fixture.key().defaultPrevented, false); assert.equal(closed, 0);
    modal.close(); fixture.flushFrames();
  }
});

function consumedEscape(source = modal) {
  const fixture = lifecycleFixture(source); let closed = 0;
  const modal = fixture.mount({ closeOnEscape: true, onClose() { closed += 1; } });
  fixture.key("Escape", { prevented: true });
  fixture.key("Escape", { targetHandler: event => event.preventDefault() });
  assert.equal(closed, 0); modal.close();
}
execute("actual Modal respects already-consumed native and target-handler Escape", consumedEscape);

execute("actual Modal uses latest close callback without reinstalling the lifecycle listener", () => {
  const fixture = lifecycleFixture(); let stale = 0, latest = 0;
  const modal = fixture.mount({ closeOnEscape: true, onClose() { stale += 1; } });
  modal.update({ onClose() { latest += 1; } });
  fixture.key(); assert.deepEqual([stale, latest], [0, 1]);
  assert.equal(fixture.window.count("keydown"), 1); modal.close();
});

execute("actual Modal cancels initial and obsolete return frames on a rapid reopen", () => {
  const fixture = lifecycleFixture();
  const modal = fixture.mount({ onClose() {} });
  assert.equal(fixture.frames.size, 1);
  modal.update({ open: false });
  assert.equal(fixture.window.count("keydown"), 0); assert.equal(fixture.frames.size, 1);
  modal.update({ open: true });
  assert.equal(fixture.frames.size, 1); fixture.flushFrames();
  assert.equal(fixture.document.activeElement, modal.first);
  modal.close(); fixture.flushFrames(); assert.equal(fixture.frames.size, 0);
});

execute("actual Modal recalculates Tab recovery for disabled, outside and empty descendants", () => {
  const fixture = lifecycleFixture();
  const modal = fixture.mount({ onClose() {} }); fixture.flushFrames();
  modal.last.focus(); fixture.key("Tab"); assert.equal(fixture.document.activeElement, modal.first);
  modal.first.focus(); fixture.key("Tab", { shift: true }); assert.equal(fixture.document.activeElement, modal.last);
  modal.last.disabled = true; fixture.key("Tab"); assert.equal(fixture.document.activeElement, modal.first);
  fixture.document.body.focus(); fixture.key("Tab", { shift: true }); assert.equal(fixture.document.activeElement, modal.first);
  modal.first.disabled = true; fixture.key("Tab"); assert.equal(fixture.document.activeElement, modal.panel);
  modal.close();
});

function nestedClose(source = modal) {
  for (const childListenerFirst of [false, true]) {
    const fixture = lifecycleFixture(source); let parentCloses = 0, childCloses = 0;
    const parent = fixture.mount({ closeOnEscape: true, onClose() { parentCloses += 1; } });
    const child = fixture.mount({ closeOnEscape: true, onClose() { childCloses += 1; child.close(); } });
    if (childListenerFirst) { parent.update({ open: false }); parent.update({ open: true }); }
    fixture.key(); assert.deepEqual([parentCloses, childCloses], [0, 1]);
    fixture.key(); assert.deepEqual([parentCloses, childCloses], [1, 1]);
    parent.close(); fixture.flushFrames();
  }
}
execute("actual nested Modals close only the topmost in either listener order with synchronous removal", nestedClose);

function listboxFirst(source = modal) {
  const fixture = lifecycleFixture(source); let closed = 0;
  const modal = fixture.mount({ closeOnEscape: true, onClose() { closed += 1; } });
  const runner = fixture.controlled.runner(fixture.Listbox);
  let layer: string | null = "inner";
  const trigger = new fixture.FixtureElement("button"), search = new fixture.FixtureElement("input");
  modal.panel.append(trigger);
  const props: Props = { layerId: "inner", value: "one", searchable: true, options: [{ value: "one", label: "الأول" }], onChange() {}, onOpenLayer(next: string | null) { layer = next; render(); } };
  function render() {
    const tree = runner.render({ ...props, openLayerId: layer });
    for (const node of trees(tree)) {
      const ref = node.props.ref as { current: unknown } | undefined;
      if (ref && node.type === "button") ref.current = trigger;
      if (ref && node.type === "input") ref.current = search;
    }
    runner.effects(); return tree;
  }
  let tree = render();
  assert.equal(fixture.document.count("keydown"), 1);
  fixture.key(); assert.equal(layer, null); assert.equal(closed, 0); assert.equal(fixture.document.activeElement, trigger);
  assert.equal(fixture.document.count("keydown"), 0);
  layer = "inner"; tree = render();
  const onKeyDown = trees(tree).find(node => node.type === "input")?.props.onKeyDown as (event: Event) => void;
  assert.equal(typeof onKeyDown, "function");
  fixture.key("Escape", { targetHandler: onKeyDown });
  assert.equal(layer, null); assert.equal(closed, 0);
  fixture.key(); assert.equal(closed, 1);
  runner.cleanup(); modal.close();
}
execute("actual Listbox document and search-target Escape close the inner layer before its Modal", listboxFirst);

function requestCloseFromSource(source: string, bindings: Props) {
  const file = ts.createSourceFile("AdminFormRuntime.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const runtime = file.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "AdminFormRuntimeInstance");
  assert.ok(runtime, "Actual AdminFormRuntimeInstance declaration exists");
  assert.ok(source.includes("<AdminFormRuntimeInstance"), "Default Runtime mounts the tested instance owner");
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "requestClose" && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(runtime); assert.ok(callback, "Actual Runtime requestClose callback exists");
  return loadModule<{ close: () => void }>("requestClose.ts", `exports.close = ${callback.getText(file)};`, {}, bindings).close;
}

function runtimeDismissal(runtimeSource = formRuntime, modalSource = modal) {
  for (const state of ["clean", "dirty", "pending"] as const) {
    const fixture = lifecycleFixture(modalSource, runtimeSource);
    const form = new fixture.FixtureForm(), field = new fixture.FixtureElement("input", { name: "title" }); form.append(field);
    const rootRef = { current: form };
    const runner = fixture.controlled.runner(props => fixture.Runtime.useAdminUnsavedChangesGuard(props));
    const options = { rootRef, pending: state === "pending" };
    const readGuard = () => { const result = runner.render(options) as ReturnType<typeof fixture.Runtime.useAdminUnsavedChangesGuard>; runner.effects(); return result; };
    let guard = readGuard();
    if (state === "dirty") { field.value = "edited retained value"; fixture.input(field); guard = readGuard(); assert.equal(guard.isDirty, true); }
    let closed = 0;
    const requestClose = requestCloseFromSource(runtimeSource, { onClose() { closed += 1; }, closeHref: undefined, requestCallback: (callback: () => void) => guard.requestCallback(callback), requestNavigation() { throw new Error("Close callback must not navigate"); } });
    const modal = fixture.mount({ closeOnEscape: true, onClose: requestClose });
    fixture.key(); guard = readGuard();
    if (state === "clean") { assert.equal(closed, 1); assert.equal(guard.dialog, null); }
    if (state === "pending") {
      assert.equal(closed, 0); assert.equal(guard.dialog, null);
      options.pending = false; guard = readGuard();
      fixture.key(); assert.equal(closed, 1);
    }
    if (state === "dirty") {
      assert.equal(closed, 0); assert.equal(field.value, "edited retained value");
      let confirmProps = trees(guard.dialog).find(node => node.type === fixture.Confirm)?.props;
      assert.ok(confirmProps, "Actual Runtime asks its existing confirmation owner");
      const cancelConfirmation = confirmProps.onCancel as () => void;
      const confirmation = fixture.mount({ ...confirmProps, onCancel() { cancelConfirmation(); confirmation.close(); } }, fixture.Confirm, "data-admin-confirm-dialog");
      fixture.key(); // actual document confirmation cancellation, then window Modal
      guard = readGuard();
      assert.equal(closed, 0); assert.equal(guard.dialog, null); assert.equal(field.value, "edited retained value");
      fixture.key(); guard = readGuard();
      confirmProps = trees(guard.dialog).find(node => node.type === fixture.Confirm)?.props;
      assert.ok(confirmProps); (confirmProps.onConfirm as () => void)(); guard = readGuard();
      assert.equal(closed, 1); assert.equal(guard.dialog, null);
    }
    modal.close(); runner.cleanup(); fixture.flushFrames();
    assert.equal(fixture.document.count("input"), 0);
    assert.equal(fixture.document.count("click"), 0);
    assert.equal(fixture.window.count("beforeunload"), 0);
  }
}
execute("actual Runtime requestClose and unsaved guard preserve clean, dirty cancellation/confirmation and pending paths", runtimeDismissal);

execute("actual confirmation Escape cancels when editable and protects pending actions", () => {
  for (const pending of [false, true]) {
    const fixture = lifecycleFixture(); let cancelled = 0;
    const confirmation = fixture.mount({ pending, onCancel() { cancelled += 1; }, onConfirm() {} }, fixture.Confirm, "data-admin-confirm-dialog");
    fixture.key(); assert.equal(cancelled, pending ? 0 : 1);
    confirmation.close(); fixture.flushFrames();
  }
});

const modalMutants = [
  { name: "old document ordering", source: modal.replaceAll('window.addEventListener("keydown", handleKeyDown)', 'document.addEventListener("keydown", handleKeyDown)').replaceAll('window.removeEventListener("keydown", handleKeyDown)', 'document.removeEventListener("keydown", handleKeyDown)'), probe: listboxFirst },
  { name: "ignoring consumed Escape", source: modal.replace("if (event.defaultPrevented) return;", ""), probe: consumedEscape },
  { name: "missing topmost ownership", source: modal.replace("if (!panel || !isTopmostDialog(panel)) return;", "if (!panel) return;"), probe: nestedClose },
  { name: "closing before event consumption", source: modal.replace("event.preventDefault();\n        closeRef.current();", "closeRef.current();"), probe: nestedClose },
  { name: "default dismissal expansion", source: modal.replace("closeOnEscape = false", "closeOnEscape = true"), probe(source: string) { const fixture = lifecycleFixture(source); let closed = false; const modal = fixture.mount({ onClose() { closed = true; } }); fixture.key(); assert.equal(closed, false); modal.close(); } },
];
for (const mutant of modalMutants) {
  assert.notEqual(mutant.source, modal, `Mutation applied: ${mutant.name}`);
  execute(`negative rejects ${mutant.name}`, () => assert.throws(() => mutant.probe(mutant.source), { name: "AssertionError" }));
}
for (const [name, source] of [
  ["pending bypass", formRuntime.replaceAll('if (decision === "blocked_pending") return;', "")],
  ["dirty confirmation bypass", formRuntime.replace('setPendingNavigation({ kind: "callback", callback });', "completeCallback(callback);")],
  ["Runtime close bypass", formRuntime.replace("requestCallback(onClose);", "onClose();")],
] as const) {
  assert.notEqual(source, formRuntime, `Mutation applied: ${name}`);
  execute(`negative rejects ${name}`, () => assert.throws(() => runtimeDismissal(source), { name: "AssertionError" }));
}

execute("canonical Runtime icon import stays explicit without claiming presentation execution", () => {
  const tabsSource = read("src/components/admin/ui/AdminModuleTabs.tsx");
  const actual = canonicalLifecycleTabIconPort(formRuntime, tabsSource);
  const imported = loadModule<{ icon: unknown }>(
    "ActualRuntimeTabIconImport.tsx",
    actual.importSource + "\nexports.icon = AdminModuleTabIcon;",
    { "./AdminModuleTabs": actual.port },
  );
  assert.equal(imported.icon === actual.port.AdminModuleTabIcon, true);
  for (const [name, runtimeSource, ownerSource] of [
    ["foreign module", formRuntime.replace('from "./AdminModuleTabs"', 'from "./ParallelModuleTabs"'), tabsSource],
    ["wrong named export", formRuntime.replace('import { AdminModuleTabIcon } from "./AdminModuleTabs"', 'import { ParallelLifecycleIcon as AdminModuleTabIcon } from "./AdminModuleTabs"'), tabsSource],
    ["missing named export", formRuntime, tabsSource.replace("export function AdminModuleTabIcon(", "function AdminModuleTabIcon(")],
    ["renamed canonical export", formRuntime, tabsSource.replace("export function AdminModuleTabIcon(", "export function ParallelLifecycleIcon(")],
  ] as const) {
    assert.equal(runtimeSource !== formRuntime || ownerSource !== tabsSource, true, name + ": actual source changes");
    lifecycleSourceTree("RuntimeMutation.tsx", runtimeSource);
    lifecycleSourceTree("TabsMutation.tsx", ownerSource);
    assert.throws(() => canonicalLifecycleTabIconPort(runtimeSource, ownerSource), { name: "AssertionError" });
  }
});

execute("actual Runtime import rejects unknown, omitted module and missing named ports", () => {
  const actual = canonicalLifecycleTabIconPort();
  const evaluate = (importSource: string, ports: Props) => {
    const imported = loadModule<{ icon: unknown }>(
      "ActualRuntimeTabIconImport.tsx",
      importSource + "\nexports.icon = AdminModuleTabIcon;",
      ports,
    );
    assert.equal(typeof imported.icon, "function", "Actual named import must not resolve an empty UI module");
    return imported.icon;
  };
  assert.equal(evaluate(actual.importSource, { "./AdminModuleTabs": actual.port }) === actual.port.AdminModuleTabIcon, true);
  assert.throws(() => evaluate(actual.importSource, {}), {
    name: "AssertionError",
    message: /Unexpected lifecycle fixture import \.\/AdminModuleTabs in ActualRuntimeTabIconImport/u,
  });
  const unknown = actual.importSource.replace("./AdminModuleTabs", "./ParallelModuleTabs");
  assert.equal(unknown !== actual.importSource, true);
  lifecycleSourceTree("UnknownRuntimeTabIconImport.tsx", unknown + "\nexport { AdminModuleTabIcon };");
  assert.throws(() => evaluate(unknown, { "./AdminModuleTabs": actual.port }), {
    name: "AssertionError",
    message: /Unexpected lifecycle fixture import \.\/ParallelModuleTabs in ActualRuntimeTabIconImport/u,
  });
  assert.throws(() => evaluate(actual.importSource, { "./AdminModuleTabs": {} }), { name: "AssertionError" });
});

execute("unexpected icon execution in the actual Runtime dirty hook fails the lifecycle boundary", () => {
  const runtimeTree = lifecycleSourceTree("AdminFormRuntime.tsx", formRuntime);
  const hooks = runtimeTree.statements.filter(ts.isFunctionDeclaration).filter(node =>
    node.name?.text === "useAdminUnsavedChangesGuard");
  assert.equal(hooks.length, 1);
  assert.ok(hooks[0]!.body);
  const start = hooks[0]!.body.getStart(runtimeTree) + 1;
  const invoked = formRuntime.slice(0, start) +
    '\n  AdminModuleTabIcon({ name: "content" });\n' + formRuntime.slice(start);
  assert.equal(invoked !== formRuntime, true);
  lifecycleSourceTree("RuntimeUnexpectedIconCall.tsx", invoked);
  assert.throws(() => runtimeDismissal(invoked), {
    name: "Error",
    message: LIFECYCLE_TAB_ICON_BOUNDARY_ERROR,
  });
});

execute("actual Listbox styles import uses the canonical pure modules and rejects missing bindings", () => {
  const actual = canonicalLifecycleListboxStyles();
  const evaluate = (importSource: string, ports: Props) => {
    const imported = loadModule<{ token: unknown }>(
      "ActualListboxStylesImport.tsx",
      importSource + "\nexports.token = ADMIN_CINEMATIC_GOLD_V1;",
      ports,
    );
    assert.equal(typeof imported.token, "object");
    assert.notEqual(imported.token, null);
    return imported.token;
  };
  assert.equal(evaluate(actual.importSource, {
    "../../../lib/admin/admin-ui-styles": actual.port,
  }) === actual.port.ADMIN_CINEMATIC_GOLD_V1, true);
  assert.throws(() => evaluate(actual.importSource, {}), {
    name: "AssertionError",
    message: /Unexpected lifecycle fixture import .*admin-ui-styles in ActualListboxStylesImport/u,
  });
  assert.throws(() => evaluate(actual.importSource, {
    "../../../lib/admin/admin-ui-styles": {},
  }), { name: "AssertionError" });
  for (const [name, source] of [
    ["foreign Listbox styles module", actual.source.replace('from "../../../lib/admin/admin-ui-styles"', 'from "../../../lib/admin/parallel-ui-styles"')],
    ["wrong Listbox styles binding", actual.source.replace("  ADMIN_CINEMATIC_GOLD_V1,", "  PARALLEL_CINEMATIC_GOLD as ADMIN_CINEMATIC_GOLD_V1,")],
  ] as const) {
    assert.equal(source !== actual.source, true, name + ": actual source changes");
    lifecycleSourceTree("ListboxMutation.tsx", source);
    assert.throws(() => canonicalLifecycleListboxStyles(source), { name: "AssertionError" });
  }
  const stylesSource = read("src/lib/admin/admin-ui-styles.ts");
  assert.throws(() => loadModule("admin-ui-styles.ts", stylesSource, {}), {
    name: "AssertionError",
    message: /Unexpected lifecycle fixture import .*venesia-scrollbar-styles in admin-ui-styles/u,
  });
});

console.log(
  `VenesiaModal accessibility verifier passed (${passed} assertions, ${actualConsumers.length} consumers).`,
);
