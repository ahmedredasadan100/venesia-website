import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import * as ts from "typescript";
import { Children, Fragment, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT,
  ADMIN_BLOCK_EDITOR_INFORMATIONAL_NOTICE_SCOPES,
  ADMIN_FORM_CONFIRM_DEBT,
  ADMIN_FORM_BEHAVIOR_PROOF_LEDGER,
  ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS,
  ADMIN_FORM_RUNTIME_MODULE,
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
  ADMIN_FORM_SYSTEM_CLOSURE,
  type AdminBlockEditorFeedbackAdoptionDebt,
  type AdminFormAdoptionClassification,
} from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION,
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS,
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  PRODUCT_SURFACE_IDENTITIES,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { ADMIN_INTERACTION_SYSTEM_CLOSURE } from "../src/lib/admin/interaction-system/governance-closure.ts";
import { PAGE_MODULE_KINDS } from "../src/lib/page-blocks/types.ts";
import { collectExecutableSourceGraph } from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { fsCache: false, jsx: { runtime: "automatic" } });
const { createTopicFormDraft, parseTopicFormDraft } = await jiti.import<
  typeof import("../src/lib/admin/content/topic-revision.ts")
>("../src/lib/admin/content/topic-revision.ts");
const { resolveAdminEntityPreviewActions } = await jiti.import<
  typeof import("../src/lib/admin/interaction-system/entity-preview-capability.ts")
>("../src/lib/admin/interaction-system/entity-preview-capability.ts");
const {
  buildAdminContentPreviewCapability,
  buildAdminCategoryCollectionPreviewCapability,
  buildAdminSeriesCollectionPreviewCapability,
} = await jiti.import<
  typeof import("../src/lib/admin/content/entity-preview-capabilities.ts")
>("../src/lib/admin/content/entity-preview-capabilities.ts");
const { adminContentTopicPreviewPath } = await jiti.import<
  typeof import("../src/lib/admin/content-routes.ts")
>("../src/lib/admin/content-routes.ts");
const { resolvePublicContentPath } = await jiti.import<
  typeof import("../src/lib/content/public-content-path.ts")
>("../src/lib/content/public-content-path.ts");
const { MEDIA_EDITABLE_CONTENT_TYPES } = await jiti.import<
  typeof import("../src/lib/admin/content/content-types.ts")
>("../src/lib/admin/content/content-types.ts");
const { resolveAdminFormNavigationDecision, resolveAdminFormReturnPath, adminFormEditHref } = await jiti.import<
  typeof import("../src/lib/admin/form-runtime.ts")
>("../src/lib/admin/form-runtime.ts");
const {
  ADMIN_DATE_ONLY_PATTERN,
  ADMIN_DATE_TIME_PATTERN,
  ADMIN_TIME_ZONE,
  formatAdminDateOnly,
  formatAdminDateTime,
  serializeAdminDateTimeDisplay,
  parseFormPublishedDate,
  resolveTopicPublishedAt,
} = await jiti.import<typeof import("../src/lib/content-dates.ts")>(
  "../src/lib/content-dates.ts",
);

const normalizePath = (value: string) => value.replaceAll("\\", "/");
const absolutePath = (sourceFile: string) => join(ROOT, sourceFile);
const read = (sourceFile: string) =>
  readFileSync(absolutePath(sourceFile), "utf8");
const maintenanceSettingsPage = read("src/app/admin/settings/general/page.tsx");
const maintenanceSettingsPanel = read(
  "src/app/admin/settings/general/MaintenanceModePanel.tsx",
);
const maintenanceSettingsAction = read(
  "src/app/admin/settings/general/actions.ts",
);
const maintenanceNoticeOwner = read("src/components/admin/AdminNotice.tsx");
function hasMaintenanceUnavailableAlert(source: string, noticeSource: string) {
  const tree = ts.createSourceFile("MaintenanceModePanel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const canonicalImport = tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith("/components/admin/AdminNotice"));
  const owner = canonicalImport?.importClause?.name?.text;
  const panel = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "MaintenanceModePanel");
  const returned = panel?.body?.statements.find(ts.isReturnStatement)?.expression;
  if (!owner || !returned || !noticeSource.includes('const role = variant === "danger" ? "alert" : "status"') || !noticeSource.includes("role={role}")) return false;
  let found = false;
  const inspectBranch = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === owner) {
      const attribute = (name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer;
      const variant = attribute("variant");
      const dismissible = attribute("dismissible");
      const message = attribute("message");
      found ||= Boolean(variant && ts.isStringLiteral(variant) && variant.text === "danger" && dismissible && ts.isJsxExpression(dismissible) && dismissible.expression?.kind === ts.SyntaxKind.FalseKeyword && message && ts.isStringLiteral(message) && message.text === "تعذرت قراءة إعداد وضع الصيانة. أعد المحاولة قبل إجراء أي تغيير.");
    }
    ts.forEachChild(node, inspectBranch);
  };
  const visit = (node: ts.Node) => {
    if (ts.isConditionalExpression(node) && node.condition.getText(tree) === "!readAvailable") inspectBranch(node.whenTrue);
    ts.forEachChild(node, visit);
  };
  visit(returned);
  return found;
}

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

if (process.argv.includes("--layout-profile-only")) {
  await verifyAdminFormLayoutProfile();
  console.log(`Admin Form Layout profile verification passed (${passed} focused checks; no Browser).`);
  process.exit(0);
}

if (process.argv.includes("--field-row-composition")) {
  await verifyProjectFieldRowComposition();
  check("shared Section metadata and native fields survive panel and neutral composition", await verifyUnifiedFormFields());
  console.log(`Project field-row composition verification passed (${passed} affected checks; source/SSR only).`);
  process.exit(0);
}

if (process.argv.includes("--settings-layout-refinement")) {
  check("shared Grid keeps default/native output and limits the explicit 60/40 ratio to two-column consumers", verifySettingsRatioGridPort());
  console.log(`Settings layout refinement verification passed (${passed} affected owner check; the full Form guard was not executed).`);
  process.exit(0);
}

if (process.argv.includes("--unified-presentation")) {
  check("Unified Card/Header defaults retain native identity, children and embedded/standalone composition", await verifyUnifiedCardAndHeader());
  check("Unified Layout retains natural flow, aside/secondary ordering and the existing Grid port", await verifyUnifiedFormLayout());
  check("Unified Field defaults retain native bindings, hints/errors and mixed-row slots", await verifyUnifiedFormFields());
  check("Unified Actions retain Pending, native Save/Close, save-only and runtime callback ownership", await verifyUnifiedFormActions());
  console.log(`Unified presentation verification passed (${passed} affected owner checks; source/SSR only).`);
  process.exit(0);
}

await verifyAdminFormLayoutProfile();

async function verifyAdminFormLayoutProfile() {
  const source = read("scripts/qa-admin-form-layout.mjs"), path = await import("node:path");
  const parse = (input: string) => ts.createSourceFile("qa-admin-form-layout.mjs", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tree = parse(source);
  const helpers = ["selectAdminFormLayoutProfile", "prepareAdminFormLayoutProfileOutput"].map(name => {
    const found = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(found.length, 1); return found[0].getText(tree);
  });
  type Environment = Record<string, string | undefined>;
  type Profile = { name: string; selectors: Record<string, string> } | null;
  const actual = new Function("assert", "path", "realpath", "mkdir", "lstat", "mkdtemp", helpers.join("\n") + ";return { selectAdminFormLayoutProfile, prepareAdminFormLayoutProfileOutput };")(
    assert, path, fs.realpath, fs.mkdir, fs.lstat, fs.mkdtemp,
  ) as { selectAdminFormLayoutProfile(args: string[], environment: Environment): Profile; prepareAdminFormLayoutProfileOutput(root: string): Promise<string> };
  const select = actual.selectAdminFormLayoutProfile, prepare = actual.prepareAdminFormLayoutProfileOutput;
  const argument = "--profile=taxonomy-current-after";
  const environment = Object.freeze({ ADMIN_FORM_LAYOUT_SCOPE: "legacy-scope", ADMIN_UI_RECOVERY_PHASE: "before", ADMIN_FORM_LAYOUT_OUTPUT: "legacy-output" });
  assert.equal(select([], environment), null);
  assert.deepEqual(environment, { ADMIN_FORM_LAYOUT_SCOPE: "legacy-scope", ADMIN_UI_RECOVERY_PHASE: "before", ADMIN_FORM_LAYOUT_OUTPUT: "legacy-output" });
  const profile = select([argument], {});
  assert.deepEqual(profile, { name: "taxonomy-current-after", selectors: { ADMIN_FORM_LAYOUT_SCOPE: "consistency", ADMIN_FORM_LAYOUT_FAMILY: "taxonomy", ADMIN_UI_RECOVERY_PHASE: "consistency-after" } });
  assert.deepEqual(select([argument], { ...profile!.selectors }), profile);
  for (const args of [["--profile=unknown"], ["--profile=taxonomy-current-before"], [argument, argument], ["--profile", "taxonomy-current-after"], [argument, "--foreign"]]) assert.throws(() => select(args, {}));
  for (const name of Object.keys(profile!.selectors)) assert.throws(() => select([argument], { [name]: "foreign" }), name);
  for (const output of [join(ROOT, ".tmp-qa", "existing-layout-receipt"), resolve(ROOT, "outside-layout-evidence")]) assert.throws(() => select([argument], { ADMIN_FORM_LAYOUT_OUTPUT: output }));
  for (const name of ["ADMIN_FORM_LAYOUT_SETTINGS_REFINE", "ADMIN_FORM_LAYOUT_SCREENSHOT"]) assert.throws(() => select([argument], { [name]: "0" }), name);
  check("actual Layout selector stays default-off and rejects unknown, duplicate, conflicting and output-override requests", true);

  const topVariables = (file: ts.SourceFile) => new Map(file.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations.map(node => [node.name.getText(file), node] as const)));
  const bindingIsCanonical = (input: string) => {
    const file = parse(input), variables = topVariables(file), root = variables.get("root")?.initializer;
    const selected = variables.get("selectedProfile"), recovery = variables.get("recoveryPhase");
    const application = file.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && node.expression.getText(file) === "selectedProfile");
    if (!root || !ts.isCallExpression(root) || root.expression.getText(file) !== "path.resolve" || root.arguments.length !== 2 || root.arguments[0].getText(file) !== "import.meta.dirname" || !ts.isStringLiteral(root.arguments[1]) || root.arguments[1].text !== ".." || !selected?.initializer || !recovery || !application || !(selected.pos < application.pos && application.end < recovery.pos)) return false;
    const compact = (node: ts.Node) => node.getText(file).replace(/\s+/gu, "");
    const body: readonly ts.Statement[] = ts.isBlock(application.thenStatement) ? application.thenStatement.statements : [application.thenStatement];
    const expressions = body.filter(ts.isExpressionStatement).map(node => node.expression);
    const apply = expressions.find(node => ts.isCallExpression(node) && node.expression.getText(file) === "Object.assign");
    const output = expressions.find((node): node is ts.BinaryExpression => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(file) === "process.env.ADMIN_FORM_LAYOUT_OUTPUT");
    return compact(selected.initializer) === "selectAdminFormLayoutProfile(process.argv.slice(2),process.env)" &&
      Boolean(apply && ts.isCallExpression(apply) && apply.arguments.map(compact).join("|") === "process.env|selectedProfile.selectors" && output && apply.pos < output.pos &&
        ts.isAwaitExpression(output.right) && ts.isCallExpression(output.right.expression) && output.right.expression.expression.getText(file) === "prepareAdminFormLayoutProfileOutput" && output.right.expression.arguments.length === 1 && output.right.expression.arguments[0].getText(file) === "root");
  };
  assert.ok(bindingIsCanonical(source));
  const selectedStatement = tree.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(tree) === "selectedProfile"))!;
  const application = tree.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && node.expression.getText(tree) === "selectedProfile")!;
  const recovery = topVariables(tree).get("recoveryPhase")!;
  const lateApplication = source.slice(0, selectedStatement.getStart(tree)) + source.slice(application.end, recovery.parent.parent.end) + "\n" + selectedStatement.getText(tree) + "\n" + application.getText(tree) + source.slice(recovery.parent.parent.end);
  for (const negative of [
    source.replace("root = path.resolve(import.meta.dirname, '..')", "root = process.cwd()"),
    source.replace("Object.assign(process.env, selectedProfile.selectors)", "Object.keys(selectedProfile.selectors)"),
    source.replace("prepareAdminFormLayoutProfileOutput(root)", "prepareAdminFormLayoutProfileOutput(process.cwd())"),
    lateApplication,
  ]) { assert.notEqual(negative, source); assert.equal(bindingIsCanonical(negative), false); }
  assert.equal((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts["qa:admin-form-layout:taxonomy-current"], "node scripts/qa-admin-form-layout.mjs --profile=taxonomy-current-after");
  check("registered Layout profile applies canonical selectors and fresh output before native branch capture, rooted at the actual script", true);

  const base = await prepare(ROOT);
  assert.ok(base.startsWith(join(await fs.realpath(ROOT), ".tmp-qa") + sep));
  try {
    const workspace = join(base, "workspace"); await fs.mkdir(workspace);
    const first = await prepare(workspace), sentinel = join(first, "receipt.json");
    await fs.writeFile(sentinel, "original receipt", { flag: "wx" });
    const second = await prepare(workspace);
    assert.notEqual(first, second);
    for (const output of [first, second]) {
      assert.equal(await fs.realpath(dirname(output)), join(await fs.realpath(workspace), ".tmp-qa"));
      assert.ok(path.basename(output).startsWith("admin-form-layout-taxonomy-current-"));
      assert.equal((await fs.lstat(output)).isDirectory(), true);
    }
    assert.equal(await fs.readFile(sentinel, "utf8"), "original receipt");
    const captures = ["recoveryPhase", "leanPixelScope", "consistencyScope", "taxonomyConsistencyOnly", "requestedOutput", "out"];
    const variables = topVariables(tree);
    const captureSource = captures.map(name => "const " + variables.get(name)!.getText(tree) + ";").join("\n");
    const evaluate = new Function("selectAdminFormLayoutProfile", "prepareAdminFormLayoutProfileOutput", "process", "root", "path", "console",
      "return (async () => {" + selectedStatement.getText(tree) + application.getText(tree) + captureSource + ";return { recoveryPhase, consistencyScope, taxonomyConsistencyOnly, out }; })();") as
      (select: typeof actual.selectAdminFormLayoutProfile, prepare: typeof actual.prepareAdminFormLayoutProfileOutput, process: { argv: string[]; env: Environment }, root: string, path: typeof import("node:path"), console: { log(): void }) => Promise<{ recoveryPhase?: string; consistencyScope: boolean; taxonomyConsistencyOnly: boolean; out: string }>;
    const defaultEnvironment: Environment = {};
    const normal = await evaluate(select, prepare, { argv: ["node", "runner"], env: defaultEnvironment }, workspace, path, { log() {} });
    assert.deepEqual(normal, { recoveryPhase: undefined, consistencyScope: false, taxonomyConsistencyOnly: false, out: join(workspace, ".tmp-qa/admin-form-layout/browser") });
    assert.deepEqual(defaultEnvironment, {});
    const current = await evaluate(select, prepare, { argv: ["node", "runner", argument], env: {} }, workspace, path, { log() {} });
    assert.equal(current.recoveryPhase, "consistency-after"); assert.equal(current.consistencyScope, true); assert.equal(current.taxonomyConsistencyOnly, true);
    assert.notEqual(current.out, first); assert.notEqual(current.out, second);
    assert.ok(current.out.startsWith(join(workspace, ".tmp-qa", "admin-form-layout-taxonomy-current-")));
    const linkedWorkspace = join(base, "linked-workspace"), outside = join(base, "outside-target");
    await fs.mkdir(linkedWorkspace); await fs.mkdir(outside); await fs.writeFile(join(outside, "sentinel"), "untouched", { flag: "wx" });
    await fs.symlink(outside, join(linkedWorkspace, ".tmp-qa"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(() => prepare(linkedWorkspace), /symlink or junction/);
    assert.deepEqual(await fs.readdir(outside), ["sentinel"]); assert.equal(await fs.readFile(join(outside, "sentinel"), "utf8"), "untouched");
    check("actual Layout output helper creates fresh canonical prefixes without overwrite, preserves native default flow and rejects escaping junctions", true);
  } finally {
    assert.ok(base.startsWith(join(await fs.realpath(ROOT), ".tmp-qa") + sep));
    assert.equal(await fs.realpath(base), base);
    await fs.rm(base, { recursive: true, force: false });
  }
}

async function unifiedPresentationDependencies() {
  const [card, headers, styles] = await Promise.all([
    jiti.import<typeof import("../src/components/admin/ui/AdminCard.tsx")>("../src/components/admin/ui/AdminCard.tsx"),
    jiti.import<typeof import("../src/components/admin/ui/AdminModuleTabs.tsx")>("../src/components/admin/ui/AdminModuleTabs.tsx"),
    jiti.import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts"),
  ]);
  return { card, headers, styles };
}

function loadUnifiedFormOwners(source: string, dependencies: Awaited<ReturnType<typeof unifiedPresentationDependencies>>) {
  const tree = ts.createSourceFile("AdminForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const [module, binding] of [["./AdminCard", "AdminCard"], ["./AdminModuleTabs", "AdminModuleSectionHeader"]]) {
    assert.ok(tree.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module &&
      (node.importClause?.name?.text === binding || node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => item.name.text === binding && !item.propertyName))), `Canonical ${binding} import`);
  }
  const functions = ["AdminFormLayout", "AdminFormSection", "AdminFormField"].map(name => {
    const node = tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
    assert.ok(node?.body);
    assert.doesNotMatch(node.getText(tree), /presentation\s*===/u, `${name} has one shared presentation path`);
    return node.getText(tree);
  });
  const exports: Partial<typeof import("../src/components/admin/ui/AdminForm.tsx")> = {};
  new Function("React", "exports", "AdminCard", "AdminModuleSectionHeader", "adminFormLabelClassName", "adminFormHintClassName", "ADMIN_FORM_STACK_CLASS_NAME", ts.transpileModule(functions.join("\n"), {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText)({ createElement, Fragment }, exports, dependencies.card.default, dependencies.headers.AdminModuleSectionHeader, dependencies.styles.adminFormLabelClassName, dependencies.styles.adminFormHintClassName, "space-y-5");
  assert.ok(exports.AdminFormLayout && exports.AdminFormSection && exports.AdminFormField);
  return exports as Required<Pick<typeof import("../src/components/admin/ui/AdminForm.tsx"), "AdminFormLayout" | "AdminFormSection" | "AdminFormField">>;
}

async function verifyUnifiedCardAndHeader() {
  const { card, headers, styles } = await unifiedPresentationDependencies();
  const child = createElement("input", { name: "original_name", defaultValue: "original_value", required: true, disabled: true });
  for (const interactive of [false, true]) {
    const props = { id: "original-card", children: child, className: "original-class", interactive };
    const normal = renderToStaticMarkup(createElement(card.default, props));
    for (const presentation of ["default", "premium"] as const) assert.equal(renderToStaticMarkup(createElement(card.default, { ...props, presentation })), normal);
    assert.ok(normal.includes(styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME));
    assert.equal((normal.match(/name="original_name"/gu) ?? []).length, 1);
    assert.ok(normal.includes('id="original-card"') && normal.includes("original-class"));
    assert.equal(normal.includes("hover:-translate-y-0.5"), interactive);
    assert.equal(normal.includes("overflow-hidden"), false);
  }
  const props = { id: "original-section", sectionHeading: "Original heading", sectionDescription: "Original hint", sectionSummary: child, icon: "content" as const };
  for (const standalone of [false, true]) for (const sectionHeaderPresentation of [undefined, "default", "control", "panel", "premium"] as const) {
    const markup = renderToStaticMarkup(createElement(headers.AdminModuleSectionHeader, { ...props, sectionHeaderPresentation, standalone }));
    assert.ok(markup.includes(styles.ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME));
    assert.ok(markup.includes("Original heading") && markup.includes("Original hint"));
    assert.equal((markup.match(/data-admin-tab-section-accent=/gu) ?? []).length, 1);
    assert.equal((markup.match(/name="original_name"/gu) ?? []).length, 1);
    assert.equal(markup.includes("-mx-3"), !standalone);
  }
  const source = read("src/components/admin/ui/AdminCard.tsx"), header = read("src/components/admin/ui/AdminModuleTabs.tsx");
  assert.doesNotMatch(source, /presentation\s*===/u);
  assert.doesNotMatch(header, /from ["']\.\/AdminForm["']/u, "Header owner has no reverse Form import");
  assert.match(read("src/components/admin/ui/AdminForm.tsx"), /export\s*\{\s*AdminFormControlHeader\s*\}\s*from\s*["']\.\/AdminModuleTabs["']/u, "Existing ControlHeader import contract remains available");
  return true;
}

async function verifyUnifiedFormLayout() {
  const dependencies = await unifiedPresentationDependencies(), source = read("src/components/admin/ui/AdminForm.tsx");
  const verify = (candidate: string) => {
    const { AdminFormLayout: Layout } = loadUnifiedFormOwners(candidate, dependencies);
    const primary = createElement("input", { name: "primary", defaultValue: "same" });
    const media = createElement("div", { "data-original-aside": "" }, "Aside");
    const secondary = createElement("div", { "data-original-secondary": "" }, "Secondary");
    for (const aside of [undefined, media]) for (const mobileAsideFirst of [false, true]) {
      const props = { children: primary, aside, secondary, mobileAsideFirst, className: "custom-layout", asideClassName: "sticky-aside" };
      const original = Layout(props), markup = renderToStaticMarkup(original);
      for (const presentation of ["default", "panel"] as const) assert.equal(renderToStaticMarkup(Layout({ ...props, presentation })), markup);
      assert.ok(markup.includes("custom-layout") && markup.includes("space-y-5"));
      assert.equal(markup.includes("xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]"), Boolean(aside));
      assert.equal(markup.includes("order-first xl:order-none"), Boolean(aside && mobileAsideFirst));
      assert.equal((markup.match(/name="primary"/gu) ?? []).length, 1);
      assert.equal((markup.match(/data-original-secondary=/gu) ?? []).length, 1);
      assert.ok(markup.indexOf('name="primary"') < markup.indexOf("data-original-secondary="));
      if (aside) assert.ok(markup.includes("sticky-aside") && markup.indexOf('name="primary"') < markup.indexOf("data-original-aside="));
      let calls = 0;
      const delegated = Layout({ ...props, renderGrid: ({ children, className }) => { calls++; return createElement("div", { className }, children); } });
      assert.equal(calls, 1);
      const grid = renderToStaticMarkup(delegated);
      assert.equal((grid.match(/name="primary"/gu) ?? []).length, 1);
      assert.equal((grid.match(/data-original-secondary=/gu) ?? []).length, 1);
      assert.equal((grid.match(/data-original-aside=/gu) ?? []).length, Number(Boolean(aside)));
    }
  };
  verify(source);
  for (const mutant of [
    source.replace("<>{children}{aside}", "<>{null}{aside}"),
    source.replace("{secondary}</div>", "{null}</div>"),
    source.replaceAll("xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]", "xl:grid-cols-2"),
    source.replace('mobileAsideFirst ? "order-first xl:order-none"', 'false ? "order-first xl:order-none"'),
  ]) { assert.notEqual(mutant, source); assert.throws(() => verify(mutant)); }
  return true;
}

async function verifyUnifiedFormFields() {
  const dependencies = await unifiedPresentationDependencies(), source = read("src/components/admin/ui/AdminForm.tsx");
  const verify = (candidate: string) => {
    const { AdminFormSection: Section, AdminFormField: Field } = loadUnifiedFormOwners(candidate, dependencies);
    const child = createElement("input", { name: "native", defaultValue: "same", required: true, disabled: true });
    const header = createElement("div", { "data-explicit-header": "" }, "Explicit header");
    for (const explicit of [undefined, header]) {
      const props = { id: "original-section", title: "Original title", eyebrow: "Original eyebrow", description: "Original description", actions: createElement("button", { type: "button" }, "Original action"), header: explicit, children: child };
      const markup = renderToStaticMarkup(Section(props));
      assert.ok(markup.includes(dependencies.styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME));
      assert.equal((markup.match(/name="native"/gu) ?? []).length, 1);
      if (explicit) { assert.ok(markup.includes("Explicit header")); assert.equal(markup.includes("Original title"), false); }
      else for (const text of ["Original title", "Original eyebrow", "Original description", "Original action"]) assert.ok(markup.includes(text), text);
      for (const presentation of ["default", "panel"] as const) assert.equal(renderToStaticMarkup(Section({ ...props, presentation })), markup);
      const neutral = renderToStaticMarkup(Section({ ...props, surface: "neutral" }));
      assert.ok(neutral.includes('data-admin-form-section-surface="neutral"'));
      assert.equal(neutral.includes(dependencies.styles.ADMIN_CARD_PREMIUM_SURFACE_CLASS_NAME), false);
      assert.equal((neutral.match(/name="native"/gu) ?? []).length, 1);
      if (explicit) assert.ok(neutral.includes("Explicit header"));
      else for (const text of ["Original title", "Original eyebrow", "Original description", "Original action"]) assert.ok(neutral.includes(text));
    }
    for (const required of [false, true]) for (const hint of [undefined, "Original hint"]) for (const error of [undefined, "Original error"]) for (const labelClassName of [undefined, "original-label-port"]) {
      const props = { label: "Original label", required, hint, error, children: child, labelClassName };
      const normal = Field(props), markup = renderToStaticMarkup(normal);
      assert.equal(normal.type, "label");
      assert.ok(markup.includes("data-admin-form-label-text") && markup.includes("data-admin-form-field-control"));
      assert.equal((markup.match(/name="native"/gu) ?? []).length, 1);
      assert.equal(markup.includes('class="text-red-400">*</span>'), required);
      if (labelClassName) assert.ok(markup.includes(labelClassName));
      else assert.ok(normal.props.className.includes(dependencies.styles.adminFormLabelClassName({ textInset: true })));
      if (hint) assert.ok(Children.toArray(normal.props.children).some(node => isValidElement<{ className?: string; children?: ReactNode }>(node) && node.props.className === dependencies.styles.adminFormHintClassName({ textInset: true }) && node.props.children === hint));
      if (error) assert.ok(markup.includes('role="alert"') && markup.includes(error));
      for (const presentation of ["default", "panel"] as const) assert.equal(renderToStaticMarkup(Field({ ...props, presentation })), markup);
    }
  };
  verify(source);
  for (const [from, to] of [["{sectionHeader}", "{null}"], ['data-admin-form-field-control="" className="min-w-0">{children}', 'data-admin-form-field-control="" className="min-w-0">{null}'], ['data-admin-form-field-control=""', 'data-lost-control=""'], ['className="text-red-400"', 'className="text-white"'], ['role="alert"', 'role="status"'], ['from "./AdminCard"', 'from "./ParallelCard"'], ["labelClassName ??", "undefined ??"]]) {
    const mutant = source.replaceAll(from, to); assert.notEqual(mutant, source); assert.throws(() => verify(mutant));
  }
  return true;
}

async function verifyProjectFieldRowComposition() {
  const locationPath = "src/app/admin/projects/locations/ProjectLocationFormModal.tsx", trackingPath = "src/components/admin/projects/tracking/TrackingForms.tsx";
  const location = read(locationPath), tracking = read(trackingPath);
  const parse = (source: string) => ts.createSourceFile("field-rows.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements = (tree: ts.SourceFile) => {
    const nodes: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
    const visit = (node: ts.Node) => { if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node); ts.forEachChild(node, visit); };
    visit(tree); return nodes;
  };
  const attribute = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => node.attributes.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === name);
  const value = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => attribute(node, name)?.initializer?.getText();
  const contains = (parent: ts.Node, child: ts.Node) => parent.pos <= child.pos && parent.end >= child.end;
  const verify = (source: string, kind: "location" | "tracking") => {
    const tree = parse(source), nodes = elements(tree), name = kind === "location" ? "is_active" : "publication_status";
    const control = nodes.find(node => node.tagName.getText() === "AdminFormSwitch" && value(node, "name") === `"${name}"`);
    assert.ok(control && attribute(control, "embedded") && !attribute(control, "surface"));
    const grid = nodes.find(node => node.tagName.getText() === "AdminFormGrid" && contains(node.parent, control));
    assert.ok(grid && value(grid, "presentation") === '"aligned-fields"');
    assert.equal(source.slice(grid.pos, grid.parent.end).includes("ADMIN_FORM_SWITCH_SURFACE_CLASS_NAME"), false);
    if (kind === "location") {
      assert.equal(control.parent, grid.parent, "Location Switch is a direct shared Grid child without repeated surface");
      assert.ok(nodes.some(node => value(node, "name") === '"sort_order"' && contains(grid.parent, node)));
    } else {
      assert.equal(value(grid, "columns"), "{12}");
      const items = nodes.filter(node => node.tagName.getText() === "AdminFormGridItem" && contains(grid.parent, node));
      assert.deepEqual(items.map(node => value(node, "span")), ["{6}", "{3}", "{3}"], "Existing field spans and reading order remain6/3/3");
      assert.equal(control.parent, items[2].parent); assert.equal(attribute(items[2], "className"), undefined);
      assert.equal(value(control, "uncheckedValue"), '"draft"'); assert.equal(value(control, "value"), '"published"');
    }
  };
  verify(location, "location"); verify(tracking, "tracking");
  for (const [source, kind] of [[location, "location"], [tracking, "tracking"]] as const) {
    for (const mutant of [source.replace('presentation="aligned-fields"', 'presentation="plain"'), source.replace(/\n\s+embedded\b/u, "")]) {
      assert.notEqual(mutant, source); assert.throws(() => verify(mutant, kind));
    }
  }
  check("Location and Tracking actual mixed rows use canonical aligned fields, no repeated Switch surface and preserved6/3/3 composition", true);
  const { default: Switch } = await jiti.import<typeof import("../src/components/admin/ui/AdminFormSwitch.tsx")>("../src/components/admin/ui/AdminFormSwitch.tsx");
  for (const checked of [false, true]) for (const disabled of [false, true]) {
    const props = { name: "publication_status", label: "نشر", value: "published", uncheckedValue: "draft", defaultChecked: checked, disabled };
    const native = (markup: string) => markup.match(/<input\b[^>]*>/gu);
    const standard = renderToStaticMarkup(createElement(Switch, props));
    for (const embedded of [false, true]) assert.deepEqual(native(renderToStaticMarkup(createElement(Switch, { ...props, embedded }))), native(standard));
  }
  check("actual Shared Switch preserves checked/unchecked native tuple and pending-disabled payload through embedded composition", true);
  const runtime = read("src/components/admin/ui/AdminFormRuntime.tsx"), tree = parse(runtime);
  const grid = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormGrid"); assert.ok(grid);
  const gridSource = grid.getText(tree), embeddedSlot = "[&>[data-admin-form-grid-item]_[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:contents", ordinarySlot = "[&>[data-admin-form-grid-item]_[data-admin-form-switch-surface]]:row-start-2", directEmbeddedSlot = "[&>[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:grid-cols-1";
  const load = (source: string) => {
    const owner: Partial<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")> = {};
    new Function("React", "exports", ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)({ createElement }, owner);
    assert.ok(owner.AdminFormGrid); return owner.AdminFormGrid;
  };
  const Grid = load(gridSource), PreviousGrid = load(gridSource.replace(` ${embeddedSlot}`, "").replace(` ${directEmbeddedSlot}`, ""));
  for (const columns of [1, 2, 3, 4, 5, 6, 12] as const) for (const presentation of ["plain", "control-cards", "aligned-fields", "equal-height-columns"] as const) for (const fieldContainers of [false, true]) {
    const props = { columns, presentation, fieldContainers, children: createElement("input", { name: "original", defaultValue: "original" }) };
    const markup = renderToStaticMarkup(Grid(props)), previous = renderToStaticMarkup(PreviousGrid(props));
    assert.equal(markup.replace(` ${embeddedSlot}`.replaceAll("&", "&amp;").replaceAll(">", "&gt;"), "").replace(` ${directEmbeddedSlot}`.replaceAll("&", "&amp;").replaceAll(">", "&gt;"), ""), previous);
    assert.equal(Grid(props).props.className.includes(directEmbeddedSlot), presentation === "aligned-fields" && !fieldContainers, "Full-width Switch slots apply only to aligned field composition, leaving default/plain/card layouts exact");
  }
  const broadenedSwitchSlots = ["[&>*]:grid-cols-1", "[&>[data-admin-form-switch-surface]]:grid-cols-1", "[&>[data-admin-form-switch-surface=embedded]]:grid-cols-1", "[&_[data-admin-form-switch-surface=embedded]:not([data-admin-form-switch-layout=inline])]:grid-cols-1"];
  const hasSwitchSlots = (source: string) => [embeddedSlot, ordinarySlot, directEmbeddedSlot].every(token => source.includes(token)) && broadenedSwitchSlots.every(token => !source.includes(token));
  assert.ok(hasSwitchSlots(gridSource));
  for (const token of [embeddedSlot, ordinarySlot, directEmbeddedSlot]) assert.equal(hasSwitchSlots(gridSource.replace(token, "")), false);
  for (const replacement of broadenedSwitchSlots) {
    assert.equal(hasSwitchSlots(gridSource.replace(directEmbeddedSlot, replacement)), false, "A lost or broadened direct stacked Switch selector must fail");
    assert.equal(hasSwitchSlots(gridSource + replacement), false, "A second selector cannot leak the correction into inline/card/nested or unrelated controls");
  }
  const switchSource = read("src/components/admin/ui/AdminFormSwitch.tsx");
  assert.ok(switchSource.includes('relative inline-flex h-5 w-9 shrink-0') && switchSource.includes('"inline-flex min-h-11 items-center"'), "Native Switch glyph remains36x20 inside its existing44px hit slot, without Input-height adoption");
  check("shared Grid keeps full-width direct stacked Switch columns, nested field slots, natural glyph size and unchanged inline/card/default composition", true);
  const baselineIndex = process.argv.indexOf("--field-row-baseline");
  if (baselineIndex !== -1) {
    const baseline = resolve(ROOT, process.argv[baselineIndex + 1] ?? ""); assert.ok(baseline.startsWith(resolve(ROOT, ".tmp-qa") + sep));
    const nativeBindings = (source: string) => elements(parse(source)).filter(node => ["input", "textarea", "AdminFormSwitch", "AdminDatePicker", "AdminFormRuntime", "AdminMediaGalleryField", "TrackingVideoFields", "VenesiaModal", "AdminModalCancelButton", "AdminModalPrimaryButton"].includes(node.tagName.getText())).map(node => ({ tag: node.tagName.getText(), attributes: node.attributes.properties.filter(item => !ts.isJsxAttribute(item) || !["className", "surface", "embedded", "presentation"].includes(item.name.getText())).map(item => item.getText()) }));
    for (const [name, current, kind] of [["ProjectLocationFormModal.tsx", location, "location"], ["TrackingForms.tsx", tracking, "tracking"]] as const) {
      const before = readFileSync(join(baseline, name), "utf8");
      assert.throws(() => verify(before, kind), "Actual before source must expose the root composition gap");
      assert.deepEqual(nativeBindings(current), nativeBindings(before), "Every current native binding and domain command remains unchanged");
    }
    check("actual before sources fail composition protection while all native controls, Modal/Runtime and command bindings remain exact", true);
  }
}

await verifyProjectFieldRowComposition();

function closureStateIsConsistent(
  globalClosed: boolean,
  blockers: readonly unknown[],
) {
  return globalClosed ? blockers.length === 0 : blockers.length > 0;
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function collectTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

function sourcePathsFor(classification: AdminFormAdoptionClassification) {
  return ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
    (entry) => entry.classification === classification,
  ).flatMap((entry) => entry.sourceFiles);
}

type FormProgrammaticNavigationPrimitive =
  | "router.push"
  | "router.replace"
  | "router.back"
  | "location.assign"
  | "location.replace"
  | "location.href"
  | "history.pushState"
  | "history.replaceState";

type FormProgrammaticNavigationViolation = {
  sourceFile: string;
  primitive: FormProgrammaticNavigationPrimitive;
  line: number;
  column: number;
};

type NavigationAnalysisContext = {
  parsed: ts.SourceFile;
  nextRouterHookNames: ReadonlySet<string>;
  identifierInitializers: ReadonlyMap<string, readonly ts.Expression[]>;
  destructuredProperties: ReadonlyMap<
    string,
    readonly { expression: ts.Expression; propertyName: string }[]
  >;
  declaredNames: ReadonlySet<string>;
};

const FORM_RUNTIME_NAVIGATION_ADAPTER =
  "src/components/admin/ui/AdminFormRuntime.tsx";
const FORM_PROGRAMMATIC_NAVIGATION_CLASSIFICATIONS = new Set<
  AdminFormAdoptionClassification
>(["shared_reference", "shared_adopter"]);
const ROUTER_NAVIGATION_METHODS = new Set(["push", "replace", "back"]);
const LOCATION_NAVIGATION_METHODS = new Set(["assign", "replace"]);
const HISTORY_NAVIGATION_METHODS = new Set(["pushState", "replaceState"]);

function unwrapNavigationExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function staticNavigationProperty(
  expression: ts.Expression,
): { expression: ts.Expression; propertyName: string } | null {
  const current = unwrapNavigationExpression(expression);
  if (ts.isPropertyAccessExpression(current)) {
    return {
      expression: current.expression,
      propertyName: current.name.text,
    };
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression &&
    (ts.isStringLiteralLike(current.argumentExpression) ||
      ts.isNumericLiteral(current.argumentExpression))
  ) {
    return {
      expression: current.expression,
      propertyName: current.argumentExpression.text,
    };
  }
  return null;
}

function navigationPropertyChain(expression: ts.Expression): string[] | null {
  const current = unwrapNavigationExpression(expression);
  if (ts.isIdentifier(current)) return [current.text];
  const property = staticNavigationProperty(current);
  if (!property) return null;
  const parent = navigationPropertyChain(property.expression);
  return parent ? [...parent, property.propertyName] : null;
}

function collectNavigationAnalysisContext(
  parsed: ts.SourceFile,
): NavigationAnalysisContext {
  const nextRouterHookNames = new Set<string>();
  const identifierInitializers = new Map<string, ts.Expression[]>();
  const destructuredProperties = new Map<
    string,
    { expression: ts.Expression; propertyName: string }[]
  >();
  const declaredNames = new Set<string>();

  const declareBindingName = (name: ts.BindingName) => {
    if (ts.isIdentifier(name)) {
      declaredNames.add(name.text);
      return;
    }
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) declareBindingName(element.name);
    }
  };

  for (const statement of parsed.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const importClause = statement.importClause;
    if (importClause?.name) declaredNames.add(importClause.name.text);
    const bindings = importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      declaredNames.add(bindings.name.text);
    }
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        declaredNames.add(element.name.text);
        if (
          statement.moduleSpecifier.text === "next/navigation" &&
          (element.propertyName ?? element.name).text === "useRouter"
        ) {
          nextRouterHookNames.add(element.name.text);
        }
      }
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isParameter(node)) declareBindingName(node.name);
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name
    ) {
      declaredNames.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node)) {
      declareBindingName(node.name);
      if (node.initializer && ts.isIdentifier(node.name)) {
        const initializers = identifierInitializers.get(node.name.text) ?? [];
        initializers.push(node.initializer);
        identifierInitializers.set(node.name.text, initializers);
      }
      if (node.initializer && ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (!ts.isIdentifier(element.name)) continue;
          const property = element.propertyName ?? element.name;
          if (!ts.isIdentifier(property) && !ts.isStringLiteralLike(property)) {
            continue;
          }
          const aliases = destructuredProperties.get(element.name.text) ?? [];
          aliases.push({
            expression: node.initializer,
            propertyName: property.text,
          });
          destructuredProperties.set(element.name.text, aliases);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);

  return {
    parsed,
    nextRouterHookNames,
    identifierInitializers,
    destructuredProperties,
    declaredNames,
  };
}

type NavigationObjectKind = "router" | "location" | "history";

function navigationObjectKinds(
  expression: ts.Expression,
  context: NavigationAnalysisContext,
  seen = new Set<string>(),
): ReadonlySet<NavigationObjectKind> {
  const current = unwrapNavigationExpression(expression);
  const kinds = new Set<NavigationObjectKind>();
  const chain = navigationPropertyChain(current);
  if (chain) {
    const root = chain[0]!;
    const unshadowedRoot = !context.declaredNames.has(root);
    if (
      unshadowedRoot &&
      (chain.length === 1
        ? root === "location"
        : chain.length === 2 &&
          ["window", "globalThis", "self", "document"].includes(root) &&
          chain[1] === "location")
    ) {
      kinds.add("location");
    }
    if (
      unshadowedRoot &&
      (chain.length === 1
        ? root === "history"
        : chain.length === 2 &&
          ["window", "globalThis", "self"].includes(root) &&
          chain[1] === "history")
    ) {
      kinds.add("history");
    }
  }
  if (
    ts.isCallExpression(current) &&
    ts.isIdentifier(unwrapNavigationExpression(current.expression)) &&
    context.nextRouterHookNames.has(
      (unwrapNavigationExpression(current.expression) as ts.Identifier).text,
    )
  ) {
    kinds.add("router");
  }
  if (ts.isIdentifier(current)) {
    const seenKey = `object:${current.text}`;
    if (!seen.has(seenKey)) {
      const nextSeen = new Set(seen);
      nextSeen.add(seenKey);
      for (const initializer of
        context.identifierInitializers.get(current.text) ?? []) {
        for (const kind of navigationObjectKinds(
          initializer,
          context,
          nextSeen,
        )) {
          kinds.add(kind);
        }
      }
    }
  }
  return kinds;
}

function navigationCallPrimitives(
  expression: ts.Expression,
  context: NavigationAnalysisContext,
  seen = new Set<string>(),
): ReadonlySet<FormProgrammaticNavigationPrimitive> {
  const current = unwrapNavigationExpression(expression);
  const primitives = new Set<FormProgrammaticNavigationPrimitive>();
  const property = staticNavigationProperty(current);
  if (property) {
    const objectKinds = navigationObjectKinds(property.expression, context);
    if (
      ROUTER_NAVIGATION_METHODS.has(property.propertyName) &&
      objectKinds.has("router")
    ) {
      primitives.add(
        `router.${property.propertyName}` as FormProgrammaticNavigationPrimitive,
      );
    }
    if (
      LOCATION_NAVIGATION_METHODS.has(property.propertyName) &&
      objectKinds.has("location")
    ) {
      primitives.add(
        `location.${property.propertyName}` as FormProgrammaticNavigationPrimitive,
      );
    }
    if (
      HISTORY_NAVIGATION_METHODS.has(property.propertyName) &&
      objectKinds.has("history")
    ) {
      primitives.add(
        `history.${property.propertyName}` as FormProgrammaticNavigationPrimitive,
      );
    }
  }
  if (ts.isIdentifier(current)) {
    const seenKey = `call:${current.text}`;
    if (!seen.has(seenKey)) {
      const nextSeen = new Set(seen);
      nextSeen.add(seenKey);
      for (const initializer of
        context.identifierInitializers.get(current.text) ?? []) {
        for (const primitive of navigationCallPrimitives(
          initializer,
          context,
          nextSeen,
        )) {
          primitives.add(primitive);
        }
      }
      for (const alias of
        context.destructuredProperties.get(current.text) ?? []) {
        const objectKinds = navigationObjectKinds(alias.expression, context);
        if (
          ROUTER_NAVIGATION_METHODS.has(alias.propertyName) &&
          objectKinds.has("router")
        ) {
          primitives.add(
            `router.${alias.propertyName}` as FormProgrammaticNavigationPrimitive,
          );
        }
        if (
          LOCATION_NAVIGATION_METHODS.has(alias.propertyName) &&
          objectKinds.has("location")
        ) {
          primitives.add(
            `location.${alias.propertyName}` as FormProgrammaticNavigationPrimitive,
          );
        }
        if (
          HISTORY_NAVIGATION_METHODS.has(alias.propertyName) &&
          objectKinds.has("history")
        ) {
          primitives.add(
            `history.${alias.propertyName}` as FormProgrammaticNavigationPrimitive,
          );
        }
      }
    }
  }
  return primitives;
}

const NOTICE_QUERY_CLEANUP_OWNER = "src/components/admin/AdminNoticeDismissibleFrame.tsx";
const noticeQueryCleanupOwner = read(NOTICE_QUERY_CLEANUP_OWNER);
const topicMarkdownNoticeConsumer = read("src/components/admin/content/editors/article/TopicMarkdownEditor.tsx");
function normalizedNoticeAst(node: ts.Node): string {
  const children: string[] = [];
  ts.forEachChild(node, child => { children.push(normalizedNoticeAst(child)); });
  const text = ts.isIdentifier(node) || ts.isLiteralExpression(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text : undefined;
  return JSON.stringify([node.kind, text, children]);
}
const expectedNoticeDismissTree = ts.createSourceFile("notice-dismiss-contract.ts", `const dismiss = useCallback(() => {
  setDismissed(true);
  onDismiss?.();
  if (!dismissSearchParams.length) return;
  const url = new URL(window.location.href);
  let changed = false;
  dismissSearchParams.forEach((param) => {
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    changed = true;
  });
  if (changed) {
    window.history.replaceState(window.history.state, "", \`\${url.pathname}\${url.search}\${url.hash}\`);
  }
}, [dismissSearchParams, onDismiss]);`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const expectedNoticeDismissDeclaration = expectedNoticeDismissTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])[0];
assert.ok(expectedNoticeDismissDeclaration?.initializer);
const expectedNoticeDismissAst = normalizedNoticeAst(expectedNoticeDismissDeclaration.initializer);

function canonicalNoticeQueryCleanupCall(sourceFile: string, context: NavigationAnalysisContext): ts.CallExpression | undefined {
  if (sourceFile !== NOTICE_QUERY_CLEANUP_OWNER || context.declaredNames.has("window") || context.declaredNames.has("URL")) return;
  const tree = context.parsed;
  const canonicalHook = tree.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "react" && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(binding => binding.name.text === "useCallback" && (binding.propertyName ?? binding.name).text === "useCallback"));
  const frame = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminNoticeDismissibleFrame");
  const dismiss = frame?.body?.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find(node => ts.isIdentifier(node.name) && node.name.text === "dismiss");
  if (!canonicalHook || !dismiss?.initializer || normalizedNoticeAst(dismiss.initializer) !== expectedNoticeDismissAst) return;
  let cleanup: ts.CallExpression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && navigationPropertyChain(node.expression)?.join(".") === "window.history.replaceState") cleanup = node;
    ts.forEachChild(node, visit);
  };
  visit(dismiss.initializer);
  return cleanup;
}

function restoredDraftNoticeHasNoQueryCleanup(source: string, noticeSource: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const noticeImport = tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../AdminNotice");
  const noticeName = noticeImport?.importClause?.name?.text;
  if (!noticeName) return false;
  const candidates: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "dismissDraftRestoredNotice") callback = node.initializer;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === noticeName) {
      const onDismiss = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "onDismiss")?.initializer;
      if (onDismiss && ts.isJsxExpression(onDismiss) && onDismiss.expression && ts.isIdentifier(onDismiss.expression) && onDismiss.expression.text === "dismissDraftRestoredNotice") candidates.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const queryParams = candidates[0]?.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "dismissSearchParams")?.initializer;
  const expectedTree = ts.createSourceFile("restored-dismiss-contract.ts", "const dismissDraftRestoredNotice = useCallback(() => { setDraftRestored(false); sectionRef.current?.focus({ preventScroll: true }); }, []);", ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const expectedCallback = expectedTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])[0]?.initializer;
  const noticeTree = ts.createSourceFile("AdminNotice.tsx", noticeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const frameImport = noticeTree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./AdminNoticeDismissibleFrame");
  const frameName = frameImport?.importClause?.name?.text;
  let forwardsQueryParams = false;
  const visitNotice = (node: ts.Node) => {
    if (frameName && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(noticeTree) === frameName) {
      const value = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(noticeTree) === "dismissSearchParams")?.initializer;
      forwardsQueryParams = Boolean(value && ts.isJsxExpression(value) && value.expression && ts.isIdentifier(value.expression) && value.expression.text === "dismissSearchParams");
    }
    ts.forEachChild(node, visitNotice);
  };
  visitNotice(noticeTree);
  return candidates.length === 1 && Boolean(queryParams && ts.isJsxExpression(queryParams) && queryParams.expression && ts.isArrayLiteralExpression(queryParams.expression) && queryParams.expression.elements.length === 0) && Boolean(callback && expectedCallback && normalizedNoticeAst(callback) === normalizedNoticeAst(expectedCallback)) && forwardsQueryParams;
}

function collectFormProgrammaticNavigationViolations(input: {
  graph: ReadonlyMap<string, ts.SourceFile>;
  excludedNonFormCapabilityOwnerSourceFiles?: ReadonlySet<string>;
}) {
  const violations: FormProgrammaticNavigationViolation[] = [];
  for (const [sourceFile, parsed] of input.graph) {
    if (
      sourceFile === FORM_RUNTIME_NAVIGATION_ADAPTER ||
      input.excludedNonFormCapabilityOwnerSourceFiles?.has(sourceFile)
    ) {
      continue;
    }
    const context = collectNavigationAnalysisContext(parsed);
    // This exact existing feedback call only deletes query parameters on the current URL.
    // Every other history/router/location operation, including another call in this owner, is scanned.
    const noticeQueryCleanup = canonicalNoticeQueryCleanupCall(sourceFile, context);
    const record = (
      node: ts.Node,
      primitive: FormProgrammaticNavigationPrimitive,
    ) => {
      const position = parsed.getLineAndCharacterOfPosition(
        node.getStart(parsed),
      );
      violations.push({
        sourceFile,
        primitive,
        line: position.line + 1,
        column: position.character + 1,
      });
    };
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        for (const primitive of navigationCallPrimitives(
          node.expression,
          context,
        )) {
          if (primitive === "history.replaceState" && node === noticeQueryCleanup) continue;
          record(node, primitive);
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const property = staticNavigationProperty(node.left);
        if (
          property?.propertyName === "href" &&
          navigationObjectKinds(property.expression, context).has("location")
        ) {
          record(node, "location.href");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return violations;
}

const entriesById = new Map(
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => [entry.id, entry]),
);
const manifestSourceFiles = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.flatMap(
  (entry) => entry.sourceFiles,
);
const manifestSourceFileSet = new Set<string>(manifestSourceFiles);
const manifestExecutableGraphs = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map(
  (entry) =>
    collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: entry.sourceFiles,
      symbolAware: true,
    }),
);
const formCapabilityOwnerBoundarySourceFiles = new Set(
  Object.values(ADMIN_CURRENT_SHARED_CAPABILITY_SET).flatMap((capability) =>
    capability.sourceFiles.map(normalizePath),
  ),
);
const capabilityOwnerBoundarySupport = new Map<string, Set<string>>();
for (const capability of Object.values(
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
)) {
  for (const sourceFile of capability.sourceFiles) {
    const normalizedSourceFile = normalizePath(sourceFile);
    const supportedBoundaries =
      capabilityOwnerBoundarySupport.get(normalizedSourceFile) ??
      new Set<string>();
    capability.consumerBoundaries.forEach((boundary) =>
      supportedBoundaries.add(boundary),
    );
    capabilityOwnerBoundarySupport.set(
      normalizedSourceFile,
      supportedBoundaries,
    );
  }
}
const nonFormCapabilityOwnerBoundarySourceFiles = new Set(
  [...capabilityOwnerBoundarySupport]
    .filter(([, supportedBoundaries]) => !supportedBoundaries.has("form"))
    .map(([sourceFile]) => sourceFile),
);
const registeredFormProgrammaticNavigationGraphs =
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter((entry) =>
    FORM_PROGRAMMATIC_NAVIGATION_CLASSIFICATIONS.has(entry.classification),
  ).map((entry) => ({
    consumerId: entry.id,
    graph: collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: entry.sourceFiles,
      traversalBoundarySourceFiles: [
        ...formCapabilityOwnerBoundarySourceFiles,
      ],
      symbolAware: true,
    }),
  }));
const registeredFormProgrammaticNavigationViolations = [
  ...new Map(
    registeredFormProgrammaticNavigationGraphs
      .flatMap(({ graph }) =>
        collectFormProgrammaticNavigationViolations({
          graph,
          excludedNonFormCapabilityOwnerSourceFiles:
            nonFormCapabilityOwnerBoundarySourceFiles,
        }),
      )
      .map((violation) => [
        `${violation.sourceFile}:${violation.line}:${violation.column}:${violation.primitive}`,
        violation,
      ]),
  ).values(),
];
const programmaticNavigationViolationSummary =
  registeredFormProgrammaticNavigationViolations
    .map(
      (violation) =>
        `${violation.sourceFile}:${violation.line}:${violation.column} (${violation.primitive})`,
    )
    .join(", ") || "none";
const programmaticNavigationBehaviorProof =
  ADMIN_FORM_BEHAVIOR_PROOF_LEDGER.find(
    (proof) => proof.id === "form-dirty-guard-programmatic-navigation",
  );

const programmaticNavigationFixtureRoot =
  "src/fixtures/governance/form-navigation-root.tsx";
const programmaticNavigationFixtureChild =
  "src/fixtures/governance/form-navigation-bypass.tsx";
const programmaticNavigationFixtureGraph = collectExecutableSourceGraph({
  root: ROOT,
  entrySourceFiles: [programmaticNavigationFixtureRoot],
  sourceOverrides: new Map([
    [
      programmaticNavigationFixtureRoot,
      `import FormNavigationBypass from "./form-navigation-bypass";

export default function FormNavigationFixtureRoot() {
  return <FormNavigationBypass />;
}
`,
    ],
    [
      programmaticNavigationFixtureChild,
      `"use client";

import { useRouter } from "next/navigation";

export default function FormNavigationBypass() {
  const router = useRouter();
  const bypassGuard = () => {
    router.push("/admin/direct-push");
    router.replace("/admin/direct-replace");
    router.back();
    window.location.assign("/admin/location-assign");
    window.location.replace("/admin/location-replace");
    window.location.href = "/admin/location-href";
    window.history.pushState({}, "", "/admin/history-push");
    window.history.replaceState({}, "", "/admin/history-replace");
  };
  return <button onClick={bypassGuard}>Bypass</button>;
}
`,
    ],
  ]),
  symbolAware: true,
});
const programmaticNavigationFixtureViolations =
  collectFormProgrammaticNavigationViolations({
    graph: programmaticNavigationFixtureGraph,
  });
const programmaticNavigationFixturePrimitives = [
  ...new Set(
    programmaticNavigationFixtureViolations.map(
      (violation) => violation.primitive,
    ),
  ),
].sort();
const expectedProgrammaticNavigationFixturePrimitives: FormProgrammaticNavigationPrimitive[] =
  [
    "history.pushState",
    "history.replaceState",
    "location.assign",
    "location.href",
    "location.replace",
    "router.back",
    "router.push",
    "router.replace",
  ];

const programmaticNavigationBoundaryFixtureRoot =
  "src/fixtures/governance/form-navigation-boundary-root.tsx";
const programmaticNavigationBoundaryFixtureOwner =
  "src/fixtures/governance/form-navigation-boundary-owner.tsx";
const programmaticNavigationBoundaryFixtureUnreachable =
  "src/fixtures/governance/form-navigation-boundary-unreachable.tsx";
const programmaticNavigationBoundaryFixtureGraph =
  collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [programmaticNavigationBoundaryFixtureRoot],
    traversalBoundarySourceFiles: [
      programmaticNavigationBoundaryFixtureOwner,
    ],
    sourceOverrides: new Map([
      [
        programmaticNavigationBoundaryFixtureRoot,
        `import FormNavigationBoundaryOwner from "./form-navigation-boundary-owner";

export default function FormNavigationBoundaryRoot() {
  return <FormNavigationBoundaryOwner />;
}
`,
      ],
      [
        programmaticNavigationBoundaryFixtureOwner,
        `"use client";

import { useRouter } from "next/navigation";
import FormNavigationBoundaryUnreachable from "./form-navigation-boundary-unreachable";

export default function FormNavigationBoundaryOwner() {
  const router = useRouter();
  return (
    <button onClick={() => router.push("/admin/boundary-owner-bypass")}>
      <FormNavigationBoundaryUnreachable />
    </button>
  );
}
`,
      ],
      [
        programmaticNavigationBoundaryFixtureUnreachable,
        `"use client";

import { useRouter } from "next/navigation";

export default function FormNavigationBoundaryUnreachable() {
  const router = useRouter();
  return (
    <button onClick={() => router.replace("/admin/unreachable-bypass")}>
      Unreachable bypass
    </button>
  );
}
`,
      ],
    ]),
    symbolAware: true,
  });
const programmaticNavigationBoundaryFixtureViolations =
  collectFormProgrammaticNavigationViolations({
    graph: programmaticNavigationBoundaryFixtureGraph,
  });

function blockEditorKindFromProductIdentity(
  identity: (typeof PRODUCT_SURFACE_IDENTITIES)[number],
) {
  const prefix = "/admin/pages-blocks/blocks/";
  const suffix = "/[id]";
  if (
    identity.productSurfaceKind !== "builder" ||
    identity.workflowOwner !== "block_template_domain" ||
    !identity.route?.startsWith(prefix) ||
    !identity.route.endsWith(suffix)
  ) {
    return null;
  }
  const moduleKind = identity.route.slice(prefix.length, -suffix.length);
  return PAGE_MODULE_KINDS.includes(
    moduleKind as (typeof PAGE_MODULE_KINDS)[number],
  )
    ? moduleKind
    : null;
}

function collectBlockEditorCoverageFailures(input: {
  canonicalModuleKinds: readonly string[];
  formModuleKinds: readonly string[];
  productModuleKinds: readonly string[];
}) {
  const failures: string[] = [];
  const axes = [
    ["form", input.formModuleKinds],
    ["product", input.productModuleKinds],
  ] as const;
  for (const moduleKind of input.canonicalModuleKinds) {
    for (const [axis, values] of axes) {
      if (!values.includes(moduleKind)) {
        failures.push(`${moduleKind}:missing_${axis}_registration`);
      }
    }
  }
  for (const [axis, values] of axes) {
    for (const moduleKind of values) {
      if (!input.canonicalModuleKinds.includes(moduleKind)) {
        failures.push(`${moduleKind}:stale_${axis}_registration`);
      }
      if (values.filter((candidate) => candidate === moduleKind).length !== 1) {
        failures.push(`${moduleKind}:duplicate_${axis}_registration`);
      }
    }
  }
  return [...new Set(failures)];
}

function collectCapabilityDecisionIdentityFailures(
  entries: readonly {
    id: string;
    decisions: Readonly<Record<string, object>>;
  }[],
) {
  const firstOwnerByDecision = new Map<object, string>();
  const failures: string[] = [];
  for (const entry of entries) {
    for (const [capability, decision] of Object.entries(entry.decisions)) {
      const firstOwner = firstOwnerByDecision.get(decision);
      if (firstOwner) {
        failures.push(
          `${entry.id}:${capability}:shares_nested_decision_with:${firstOwner}`,
        );
      } else {
        firstOwnerByDecision.set(decision, `${entry.id}:${capability}`);
      }
    }
  }
  return failures;
}

const blockEditorEntries = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
  (
    entry,
  ): entry is (typeof ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST)[number] & {
    registryModuleKind: (typeof PAGE_MODULE_KINDS)[number];
  } => "registryModuleKind" in entry,
);
const blockEditorFeedbackDebtByKind = new Map<
  string,
  AdminBlockEditorFeedbackAdoptionDebt
>(
  ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.map((debt) => [
    debt.moduleKind,
    debt,
  ]),
);
const feedbackOwnerBoundarySourceFiles =
  ADMIN_CURRENT_SHARED_CAPABILITY_SET.feedback.sourceFiles;
const adminNoticeSourceFile = "src/components/admin/AdminNotice.tsx";
function hasDirectActionNotice(sourceFile: string) {
  const source = read(sourceFile);
  const tree = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const informational = ADMIN_BLOCK_EDITOR_INFORMATIONAL_NOTICE_SCOPES.filter(scope => scope.sourceFile === sourceFile);
  let found = false;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && informational.some(scope => scope.functionName === node.name?.text)) {
      // The exception is a static missing-editor-link explanation, with no
      // save result input. A new stateful/action notice in this scope fails.
      assert.doesNotMatch(node.getText(tree), /\b(saved|mediaSynchronizationWarning|useActionState|useState|useAdminFeedback)\b/);
      return;
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(tree) === "AdminNotice") found = true;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}
const blockEditorFeedbackTruthFailures = blockEditorEntries.flatMap(
  (entry) => {
    const ownershipGraph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: entry.sourceFiles,
      traversalBoundarySourceFiles: feedbackOwnerBoundarySourceFiles,
      symbolAware: true,
    });
    const debt = blockEditorFeedbackDebtByKind.get(entry.registryModuleKind);
    const feedbackOverride = entry.capabilityAudit.overrides.feedback;
    const ownsDirectNoticePath = ownershipGraph.has(adminNoticeSourceFile) &&
      [...ownershipGraph.keys()].some(sourceFile => sourceFile !== adminNoticeSourceFile && !new Set<string>(feedbackOwnerBoundarySourceFiles).has(sourceFile) && hasDirectActionNotice(sourceFile));
    const failures: string[] = [];
    if (ownsDirectNoticePath !== Boolean(debt)) {
      failures.push(`${entry.id}:direct_notice_debt_mismatch`);
    }
    if (debt && feedbackOverride?.state !== "missing_adoption") {
      failures.push(`${entry.id}:direct_notice_not_declared_missing`);
    }
    if (!debt && feedbackOverride?.state === "missing_adoption") {
      failures.push(`${entry.id}:stale_feedback_debt`);
    }
    if (
      debt &&
      (!debt.blocksGlobalClosure ||
        debt.owner !== "feedback_runtime" ||
        debt.sourceFiles.length === 0 ||
        debt.sourceFiles.some((sourceFile) =>
          !existsSync(absolutePath(sourceFile)),
        ) ||
        debt.requiredProof.length === 0 ||
        !debt.risk.trim() ||
        !debt.plannedPhase.trim())
    ) {
      failures.push(`${entry.id}:invalid_feedback_debt_contract`);
    }
    return failures;
  },
);
const formBlockEditorKinds = blockEditorEntries.flatMap((entry) =>
  entry.registryModuleKind ? [entry.registryModuleKind] : [],
);
const productBlockEditorKinds = PRODUCT_SURFACE_IDENTITIES.flatMap(
  (identity) => {
    const moduleKind = blockEditorKindFromProductIdentity(identity);
    return moduleKind ? [moduleKind] : [];
  },
);
const blockEditorCoverageFailures = collectBlockEditorCoverageFailures({
  canonicalModuleKinds: PAGE_MODULE_KINDS,
  formModuleKinds: formBlockEditorKinds,
  productModuleKinds: productBlockEditorKinds,
});
const blockEditorDecisionIdentityFailures =
  collectCapabilityDecisionIdentityFailures(
    blockEditorEntries.map((entry) => ({
      id: entry.id,
      decisions: entry.capabilityAudit.decisions,
    })),
  );
const futureBlockEditorFixture = "future-block-editor-fixture";
const unregisteredBlockEditorFailures = collectBlockEditorCoverageFailures({
  canonicalModuleKinds: [...PAGE_MODULE_KINDS, futureBlockEditorFixture],
  formModuleKinds: formBlockEditorKinds,
  productModuleKinds: [...productBlockEditorKinds, futureBlockEditorFixture],
});
const sharedNestedDecisionFixture = {
  state: "not_applicable",
  rationale: "Negative fixture for a shallow-shared nested decision.",
} as const;
const shallowSharedDecisionProfileFixture = {
  fixture_capability: sharedNestedDecisionFixture,
};
const shallowSharedDecisionIdentityFailures =
  collectCapabilityDecisionIdentityFailures([
    {
      id: "shallow-shared-decision-fixture-a",
      decisions: { ...shallowSharedDecisionProfileFixture },
    },
    {
      id: "shallow-shared-decision-fixture-b",
      decisions: { ...shallowSharedDecisionProfileFixture },
    },
  ]);

check(
  "Admin Interaction System is a governance/contracts umbrella, not a super-runtime",
  ADMIN_INTERACTION_SYSTEM.role === "governance_contracts_umbrella" &&
    ADMIN_INTERACTION_SYSTEM.ownsRuntime === false,
);
check(
  "Admin Interaction System closure state fails closed when adoption blockers exist",
  Object.keys(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).length ===
    ADMIN_INTERACTION_MODULES.length &&
    ADMIN_INTERACTION_MODULES.every(
      (module) => module.id in ADMIN_INTERACTION_SYSTEM_CLOSURE.components,
    ) &&
    ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosed ===
    Object.values(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).every(
      (component) => component.globalClosed,
    ) &&
    ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosureBlockers.length ===
      Object.values(ADMIN_INTERACTION_SYSTEM_CLOSURE.components).reduce(
        (total, component) =>
          total + component.globalClosureBlockers.length,
        0,
      ) &&
    closureStateIsConsistent(
      ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosed,
      ADMIN_INTERACTION_SYSTEM_CLOSURE.globalClosureBlockers,
    ),
);

const interactionModulesById = new Map(
  ADMIN_INTERACTION_MODULES.map((module) => [module.id, module]),
);
check(
  "the canonical Admin Interaction module inventory has unique explicit owners and no inferred module count",
  ADMIN_INTERACTION_MODULES.length > 0 &&
    interactionModulesById.size === ADMIN_INTERACTION_MODULES.length &&
    ADMIN_INTERACTION_MODULES.every(
      (module) =>
        module.responsibility.trim().length > 0 &&
        module.sourceFiles.length > 0 &&
        (module.id === "shared_capabilities"
          ? module.classification === "shared_capability_layer"
          : module.classification === "independent_runtime"),
    ),
);
check(
  "every declared Admin Interaction module owner exists",
  ADMIN_INTERACTION_MODULES.flatMap((module) => module.sourceFiles).every(
    (sourceFile) => existsSync(absolutePath(sourceFile)),
  ),
);
check(
  "Form adoption is scoped to the independent Form Runtime module",
  ADMIN_FORM_RUNTIME_MODULE.id === "form_runtime" &&
    ADMIN_FORM_RUNTIME_MODULE.governanceSystem === "admin_interaction_system" &&
    ADMIN_FORM_RUNTIME_MODULE.role === "independent_runtime" &&
    ADMIN_FORM_RUNTIME_MODULE.ownsSharedCapabilities === false &&
    ADMIN_FORM_SYSTEM_CLOSURE.module === ADMIN_FORM_RUNTIME_MODULE.id,
);

const interactionFormReferenceIds = new Set<string>(
  ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.map((entry) => entry.id),
);
check(
  "Admin Interaction Form references and Form shared-reference adopters match bidirectionally",
  interactionFormReferenceIds.size ===
    ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.length &&
    ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS.every(
      (entry) =>
        entry.module === "form_runtime" &&
        entriesById.has(entry.id) &&
        entry.sourceFiles.every((sourceFile) =>
          new Set<string>(entriesById.get(entry.id)?.sourceFiles ?? []).has(
            sourceFile,
          ),
        ),
    ) &&
    ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter(
      (entry) => entry.classification === "shared_reference",
    ).every((entry) => interactionFormReferenceIds.has(entry.id)),
);

const previewCapabilityAdopter = ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
  (entry) => entry.id === "topic-article-edit-preview-public",
);
const previewCapabilityGapIds = new Set<string>(
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.filter(
    (entry) => String(entry.status) === "gap",
  ).map((entry) => entry.id),
);
const previewCapabilityAdoptionIds = new Set<string>(
  ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.map((entry) => entry.id),
);
check(
  "Topic Article Edit is the shared Preview/Public reference adopter",
  previewCapabilityAdopter?.status === "adopted" &&
    previewCapabilityAdopter.capabilityOwner === "shared_capabilities" &&
    previewCapabilityAdopter.consumerBoundary ===
      "form_runtime_reference_consumer" &&
    previewCapabilityAdopter.sourceFiles.includes(
      "src/components/admin/content/editors/ArticleEditor.tsx",
    ),
);
check(
  "Preview/Public adoption IDs are unique and all capabilities keep their shared owner",
  previewCapabilityAdoptionIds.size ===
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.length &&
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.every(
      (entry) => entry.capabilityOwner === "shared_capabilities",
    ),
);
check(
  "Media Topic closes the remaining Preview/Public adoption gap",
  previewCapabilityGapIds.size === 0 &&
    ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find(
      (entry) => entry.id === "topic-media-edit-preview",
    )?.status === "adopted",
);

check(
  "Category and Series collections adopt the shared Preview/Public capability",
  [
    "topic-category-collection-preview",
    "topic-series-collection-preview",
  ].every(
    (id) =>
      ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION.find((entry) => entry.id === id)
        ?.status === "adopted",
  ),
);

check(
  "Category and Series Collection Runtime interaction gaps are closed",
  ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS.length === 0,
);
check(
  "every declared Admin Interaction adopter and gap source exists",
  [
    ...ADMIN_INTERACTION_FORM_REFERENCE_CONSUMERS,
    ...ADMIN_ENTITY_PREVIEW_CAPABILITY_ADOPTION,
    ...ADMIN_INTERACTION_COLLECTION_RUNTIME_GAPS,
  ].every((entry) =>
    entry.sourceFiles.every((sourceFile) =>
      existsSync(absolutePath(sourceFile)),
    ),
  ),
);

check(
  "Form Runtime closure claim includes the bounded shared legacy adoption",
  ADMIN_FORM_SYSTEM_CLOSURE.scope ===
    "reference_consumers_and_in_scope_generic_legacy_forms" &&
    ADMIN_FORM_SYSTEM_CLOSURE.allowedClaim ===
      "shared_legacy_form_adoption_closed",
);
check(
  "global Form Runtime closure is derived open from owner, adoption, exception, and behavioral-proof blockers",
  ADMIN_FORM_SYSTEM_CLOSURE.globalClosed ===
    (ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS.length === 0) &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers ===
      ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers.length > 0,
);
check(
  "source-only Form evidence remains distinct from Behavioral Proof and blocks global closure",
  ADMIN_FORM_BEHAVIOR_PROOF_LEDGER.some(
    (proof) =>
      proof.requiredForGlobalClosure && proof.state === "source_proven_only",
  ) &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosureBlockers.some((blocker) =>
      blocker.id.startsWith("form-behavior:"),
    ),
);
check(
  "manifest entry IDs are unique",
  entriesById.size === ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.length,
);
check(
  "each source file has exactly one manifest owner",
  new Set(manifestSourceFiles).size === manifestSourceFiles.length,
);
check(
  "every manifest source exists",
  manifestSourceFiles.every((sourceFile) =>
    existsSync(absolutePath(sourceFile)),
  ),
);
check(
  "every canonical Block Editor has one independent Form identity and one bidirectionally matching Product Surface identity",
  blockEditorCoverageFailures.length === 0 &&
    new Set(
      blockEditorEntries.map((entry) => entry.capabilityAudit.decisions),
    ).size === blockEditorEntries.length &&
    blockEditorDecisionIdentityFailures.length === 0 &&
    blockEditorEntries.every(
      (entry) =>
        entry.sourceFiles.length === 1 &&
        entry.sourceFiles[0] ===
          `src/app/admin/pages-blocks/blocks/${entry.registryModuleKind}/[id]/page.tsx`,
    ),
);
check(
  "direct Block Editor action feedback is declared as blocking debt instead of hidden behind not_applicable",
  blockEditorFeedbackDebtByKind.size ===
    ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.length &&
    blockEditorFeedbackTruthFailures.length === 0 &&
    ADMIN_BLOCK_EDITOR_FEEDBACK_ADOPTION_DEBT.every((debt) =>
      ADMIN_FORM_GLOBAL_CLOSURE_BLOCKERS.some(
        (blocker) =>
          blocker.id ===
          `form-missing-adoption:block-template-${debt.moduleKind}-editor:feedback`,
      ),
    ),
);
check(
  "Hero and Content delegate saved revision acceptance to the shared dirty guard instead of remounting on every server read",
  [
    ["src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx", "hero"],
    ["src/components/admin/page-blocks/ContentModuleEditClient.tsx", "block"],
  ].every(([file, entity]) => {
    const source = read(file);
    return source.includes(`<AdminFormRuntime key={${entity}.id}`) &&
      source.includes(`savedRevision={${entity}.updated_at}`) && source.includes("redirectAction=");
  }),
);
check(
  "a shallow-shared nested Block Editor decision fails the identity proof",
  shallowSharedDecisionIdentityFailures.length > 0,
);
check(
  "a canonical Block Editor added without its Form adoption identity fails closed",
  unregisteredBlockEditorFailures.includes(
    `${futureBlockEditorFixture}:missing_form_registration`,
  ),
);

check(
  "Form classifications are complete records from the canonical manifest rather than a copied consumer list",
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.every(
    (entry) =>
      entry.id.trim().length > 0 &&
      entry.label.trim().length > 0 &&
      entry.rationale.trim().length > 0 &&
      entry.sourceFiles.length > 0 &&
      (entry.classification === "specialized_exception" ||
      entry.classification === "explicit_exception"
        ? entry.exceptionContract.knownDebt.length > 0 &&
          entry.exceptionContract.reviewTrigger.trim().length > 0
        : !("exceptionContract" in entry)),
  ),
);

check(
  "in-scope generic adoption gaps are closed without claiming global Form Runtime closure",
  sourcePathsFor("legacy_generic_gap").length === 0 &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosed === false,
);

check(
  `registered shared Form consumers have no direct programmatic exit navigation outside the exact Form Runtime adapter; violations: ${programmaticNavigationViolationSummary}`,
  ADMIN_CURRENT_SHARED_CAPABILITY_SET.form_runtime.sourceFiles.includes(
    FORM_RUNTIME_NAVIGATION_ADAPTER,
  ) &&
    formCapabilityOwnerBoundarySourceFiles.has(
      FORM_RUNTIME_NAVIGATION_ADAPTER,
    ) &&
    !nonFormCapabilityOwnerBoundarySourceFiles.has(
      FORM_RUNTIME_NAVIGATION_ADAPTER,
    ) &&
    [...nonFormCapabilityOwnerBoundarySourceFiles].every(
      (sourceFile) =>
        formCapabilityOwnerBoundarySourceFiles.has(sourceFile) &&
        !capabilityOwnerBoundarySupport.get(sourceFile)?.has("form"),
    ) &&
    registeredFormProgrammaticNavigationGraphs.length ===
      ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.filter((entry) =>
        FORM_PROGRAMMATIC_NAVIGATION_CLASSIFICATIONS.has(entry.classification),
      ).length &&
    registeredFormProgrammaticNavigationViolations.length === 0,
);
check(
  "the canonical Notice dismiss call only removes query parameters while preserving current path, hash and history state",
  (() => {
    const tree = ts.createSourceFile(NOTICE_QUERY_CLEANUP_OWNER, noticeQueryCleanupOwner, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.ok(canonicalNoticeQueryCleanupCall(NOTICE_QUERY_CLEANUP_OWNER, collectNavigationAnalysisContext(tree)));
    assert.equal(collectFormProgrammaticNavigationViolations({ graph: new Map([[NOTICE_QUERY_CLEANUP_OWNER, tree]]) }).length, 0);
    let initializer: ts.Expression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "dismiss") initializer = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.ok(initializer);
    const historyState = { existing: "history state" };
    for (const [params, href, target] of [
      [[], "invalid URL deliberately proves the early return", undefined],
      [["notice", "error"], "https://example.test/admin/content?notice=saved&keep=1&error=old#original", "/admin/content?keep=1#original"],
      [["notice"], "https://example.test/admin/content?keep=1#original", undefined],
    ] as const) {
      const historyCalls: unknown[][] = [];
      const stateCalls: boolean[] = [];
      let dismissedCallbacks = 0;
      const fakeWindow = { location: { href }, history: { state: historyState, replaceState: (...args: unknown[]) => historyCalls.push(args) } };
      const dismiss: () => void = new Function("useCallback", "setDismissed", "onDismiss", "dismissSearchParams", "window", "URL", `return ${initializer.getText(tree)};`)(
        (callback: () => void) => callback,
        (value: boolean) => stateCalls.push(value),
        () => { dismissedCallbacks += 1; },
        params,
        fakeWindow,
        URL,
      );
      dismiss();
      assert.deepEqual(stateCalls, [true]);
      assert.equal(dismissedCallbacks, 1, "The existing dismissal callback still runs exactly once");
      assert.deepEqual(historyCalls, target ? [[historyState, "", target]] : []);
      if (target) assert.equal(historyCalls[0]?.[0], historyState, "Query cleanup preserves the exact current history state object");
      assert.equal(fakeWindow.location.href, href);
    }
    return true;
  })(),
);
check(
  "Notice query-cleanup classification rejects altered targets, state, mutation, early-return loss, shadowing and additional navigation",
  (() => {
    const violations = (source: string, sourceFile = NOTICE_QUERY_CLEANUP_OWNER) => collectFormProgrammaticNavigationViolations({ graph: new Map([[sourceFile, ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)]]) });
    assert.equal(violations(noticeQueryCleanupOwner, "src/fixtures/governance/parallel-notice.tsx").length, 1, "Identical syntax outside the canonical owner receives no classification");
    const mutations = [
      noticeQueryCleanupOwner.replace("new URL(window.location.href)", 'new URL("https://example.test/other")'),
      noticeQueryCleanupOwner.replace("${url.pathname}", "/other"),
      noticeQueryCleanupOwner.replace("${url.hash}", "#other"),
      noticeQueryCleanupOwner.replace("window.history.state,", "{},"),
      noticeQueryCleanupOwner.replace("window.history.replaceState(", "window.history.pushState("),
      noticeQueryCleanupOwner.replace("if (!dismissSearchParams.length) return;", ""),
      noticeQueryCleanupOwner.replace("url.searchParams.delete(param);", 'url.searchParams.set(param, "changed");'),
      `${noticeQueryCleanupOwner}\nconst URL = globalThis.URL;`,
    ];
    for (const [index, mutant] of mutations.entries()) {
      assert.notEqual(mutant, noticeQueryCleanupOwner);
      const mutantTree = ts.createSourceFile(NOTICE_QUERY_CLEANUP_OWNER, mutant, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      assert.equal(canonicalNoticeQueryCleanupCall(NOTICE_QUERY_CLEANUP_OWNER, collectNavigationAnalysisContext(mutantTree)), undefined, `Notice cleanup negative ${index + 1} cannot receive the proven same-route classification`);
      assert.equal(violations(mutant).length, 1, `Notice cleanup negative ${index + 1} retains its direct history violation`);
    }
    const shadowedWindow = ts.createSourceFile(NOTICE_QUERY_CLEANUP_OWNER, `${noticeQueryCleanupOwner}\nconst window = globalThis.window;`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(canonicalNoticeQueryCleanupCall(NOTICE_QUERY_CLEANUP_OWNER, collectNavigationAnalysisContext(shadowedWindow)), undefined, "A locally declared window cannot receive the canonical current-window cleanup classification");
    const additionalExit = `${noticeQueryCleanupOwner}\nwindow.location.assign("/admin/other");`;
    assert.deepEqual(violations(additionalExit).map(violation => violation.primitive), ["location.assign"], "Additional owner calls stay fully scanned while the exact cleanup remains classified");
    const additionalHistoryExit = `${noticeQueryCleanupOwner}\nwindow.history.replaceState({}, "", "/admin/other");`;
    assert.deepEqual(violations(additionalHistoryExit).map(violation => violation.primitive), ["history.replaceState"]);
    return true;
  })(),
);
check(
  "restored-draft Notice explicitly disables query cleanup and only dismisses its notice with focus preserved",
  restoredDraftNoticeHasNoQueryCleanup(topicMarkdownNoticeConsumer, maintenanceNoticeOwner) &&
    !restoredDraftNoticeHasNoQueryCleanup(topicMarkdownNoticeConsumer.replace("dismissSearchParams={[]}", 'dismissSearchParams={["notice"]}'), maintenanceNoticeOwner) &&
    !restoredDraftNoticeHasNoQueryCleanup(topicMarkdownNoticeConsumer.replace("dismissSearchParams={[]}", ""), maintenanceNoticeOwner) &&
    !restoredDraftNoticeHasNoQueryCleanup(topicMarkdownNoticeConsumer.replaceAll("setDraftRestored(false);", 'setDraftRestored(false); window.localStorage.clear();'), maintenanceNoticeOwner) &&
    !restoredDraftNoticeHasNoQueryCleanup(topicMarkdownNoticeConsumer, maintenanceNoticeOwner.replace("dismissSearchParams={dismissSearchParams}", "dismissSearchParams={undefined}")),
);
check(
  "a registered Form descendant using direct router, location, or history navigation fails the programmatic-navigation guard",
  programmaticNavigationFixtureViolations.length ===
    expectedProgrammaticNavigationFixturePrimitives.length &&
    programmaticNavigationFixtureViolations.every(
      (violation) =>
        violation.sourceFile === programmaticNavigationFixtureChild,
    ) &&
    expectedProgrammaticNavigationFixturePrimitives.every(
      (primitive, index) =>
        primitive === programmaticNavigationFixturePrimitives[index],
    ),
);
check(
  "a reachable Form-capable owner boundary is scanned for direct navigation while traversal stops at that owner",
  programmaticNavigationBoundaryFixtureGraph.has(
    programmaticNavigationBoundaryFixtureOwner,
  ) &&
    !programmaticNavigationBoundaryFixtureGraph.has(
      programmaticNavigationBoundaryFixtureUnreachable,
    ) &&
    programmaticNavigationBoundaryFixtureViolations.length === 1 &&
    programmaticNavigationBoundaryFixtureViolations[0]?.sourceFile ===
      programmaticNavigationBoundaryFixtureOwner &&
    programmaticNavigationBoundaryFixtureViolations[0]?.primitive ===
      "router.push",
);
check(
  "guarded programmatic navigation is behavior-verified by the mounted Chromium harness without closing unrelated Form blockers",
  programmaticNavigationBehaviorProof?.state === "behavior_verified" &&
    programmaticNavigationBehaviorProof.evidence.includes(
      "scripts/verify-admin-form-system.mts",
    ) &&
    programmaticNavigationBehaviorProof.evidence.includes(
      "scripts/qa-admin-form-guarded-navigation.mts",
    ) &&
    ADMIN_FORM_BEHAVIOR_PROOF_LEDGER.some(
      (proof) => proof.id === "form-save-parity-across-consumers" &&
        proof.state === "source_proven_only",
    ) &&
    ADMIN_FORM_SYSTEM_CLOSURE.globalClosed === false,
);

check(
  "Maintenance setting mutation stays unavailable until its current value is read successfully",
  !maintenanceSettingsPage.includes(".catch(() => false)") &&
    maintenanceSettingsPage.includes('status: "unavailable" as const') &&
    maintenanceSettingsPage.includes("initialReadState={maintenanceSetting}") &&
    hasMaintenanceUnavailableAlert(maintenanceSettingsPanel, maintenanceNoticeOwner) &&
    maintenanceSettingsPanel.includes(
      "disabled={pending || refreshPending || !readAvailable}",
    ) &&
    maintenanceSettingsPanel.includes(
      "open={readAvailable && confirmNextEnabled !== null}",
    ) &&
    maintenanceSettingsAction.indexOf("await getMaintenanceModeSetting();") >=
      0 &&
    maintenanceSettingsAction.indexOf("await getMaintenanceModeSetting();") <
      maintenanceSettingsAction.indexOf(
        "await setMaintenanceModeSetting(enabled);",
      ),
);
check(
  "Maintenance unavailable-state alert rejects parallel notices, changed severity, dismissal and lost shared alert semantics",
  !hasMaintenanceUnavailableAlert(maintenanceSettingsPanel.replace('/components/admin/AdminNotice"', '/components/admin/ParallelNotice"'), maintenanceNoticeOwner) &&
    !hasMaintenanceUnavailableAlert(maintenanceSettingsPanel.replace('variant="danger"', 'variant="info"'), maintenanceNoticeOwner) &&
    !hasMaintenanceUnavailableAlert(maintenanceSettingsPanel.replace('dismissible={false}', 'dismissible={true}'), maintenanceNoticeOwner) &&
    !hasMaintenanceUnavailableAlert(maintenanceSettingsPanel.replace('!readAvailable ? (', 'readAvailable ? ('), maintenanceNoticeOwner) &&
    !hasMaintenanceUnavailableAlert(maintenanceSettingsPanel, maintenanceNoticeOwner.replace('"danger" ? "alert"', '"danger" ? "status"')),
);

const formMutationOwnerSources = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
  absolutePath("src/app/maintenance/MaintenanceLoginForm.tsx"),
]
  .filter((sourceFile) => {
    const source = readFileSync(sourceFile, "utf8");
    return source.includes("<form") || source.includes("new FormData");
  })
  .map((sourceFile) => normalizePath(relative(ROOT, sourceFile)))
  .filter(
    (sourceFile) =>
      sourceFile !== "src/components/admin/ui/AdminFormRuntime.tsx",
  );
const unclassifiedFormMutationOwners = formMutationOwnerSources.filter(
  (sourceFile) =>
    !manifestSourceFileSet.has(sourceFile) &&
    !manifestExecutableGraphs.some((graph) => graph.has(sourceFile)),
);
check(
  "every Admin raw-form or imperative FormData owner is classified in the adoption manifest",
  unclassifiedFormMutationOwners.length === 0,
);
const sharedReferenceSources = sourcePathsFor("shared_reference");
const contentEditorShell = read(
  "src/components/admin/content/editors/ContentEditorShell.tsx",
);
check(
  "all reference consumers delegate their only form to AdminFormRuntime",
  sharedReferenceSources.every((sourceFile) => {
    const source = read(sourceFile);
    const delegatesDirectly =
      occurrenceCount(source, /<AdminFormRuntime\b/g) === 1 &&
      occurrenceCount(source, /<AdminFormActions\b/g) === 1;
    const delegatesThroughContentShell =
      occurrenceCount(source, /<ContentEditorShell\b/g) === 1;
    return (
      (delegatesDirectly || delegatesThroughContentShell) &&
      !source.includes("<form")
    );
  }) &&
    occurrenceCount(contentEditorShell, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(contentEditorShell, /<AdminFormActions\b/g) === 1 &&
    !contentEditorShell.includes("<form"),
);

const articleCreate = read(
  "src/components/admin/content/editors/ArticleCreateEditor.tsx",
);
const articleEdit = read(
  "src/components/admin/content/editors/ArticleEditor.tsx",
);
const categoryForm = read("src/app/admin/content/categories/CategoryForm.tsx");
const seriesForm = read("src/app/admin/content/series/SeriesForm.tsx");
const adminFormPresentation = read("src/components/admin/ui/AdminForm.tsx");
const adminPageExperience = read(
  "src/components/admin/ui/AdminPageExperience.tsx",
);
const mediaContentForm = read(
  "src/components/admin/content/editors/media/MediaContentForm.tsx",
);
const redirectForm = read("src/app/admin/seo/redirects/RedirectFormModal.tsx");
const createPageModal = read(
  "src/app/admin/pages-blocks/pages/CreatePageModal.tsx",
);
const topicFormDefinition = read(
  "src/components/admin/content/editors/content-form-definition.ts",
);
const topicCategorySelect = read(
  "src/components/admin/content/editors/ContentCategorySelect.tsx",
);
const topicSeriesSelect = read(
  "src/components/admin/content/editors/article/TopicSeriesFields.tsx",
);
const topicTabs = read(
  "src/components/admin/content/editors/ContentEditorShell.tsx",
);
const topicBasicPanel = read(
  "src/components/admin/content/editors/ContentBasicDataPanel.tsx",
);
const topicContentTypeControl = read(
  "src/components/admin/content/editors/TopicContentTypeControl.tsx",
);
const topicPreview = read("src/app/admin/content/topics/[id]/preview/page.tsx");
const projectPreview = read("src/app/admin/projects/[id]/preview/page.tsx");
const menuBuilderPage = read("src/app/admin/pages-blocks/menus/[id]/page.tsx");
const topicSeoPanel = read("src/components/admin/SeoPanel.tsx");
const sharedEntitySeoPanel = read(
  "src/components/admin/seo/AdminEntitySeoPanel.tsx",
);
const topicPublishingOptions = read(
  "src/components/admin/content/editors/ContentPublishingOptions.tsx",
);
const topicPublishChecklist = read(
  "src/components/admin/content-workflow/ContentReviewPanel.tsx",
);
const sharedEntityReviewPanel = read(
  "src/components/admin/review/AdminEntityReviewPanel.tsx",
);
const topicMediaSyncSignal = read(
  "src/components/admin/content/editors/article/TopicMediaCatalogSyncSignal.tsx",
);
const adminListboxSelect = read(
  "src/components/admin/ui/AdminListboxSelect.tsx",
);
const adminFormListboxSelect = read(
  "src/components/admin/ui/AdminFormListboxSelect.tsx",
);
const inlineListboxHandlerStart = adminListboxSelect.indexOf(
  "function handleInlineKeyDown",
);
const inlineListboxHandlerEnd = adminListboxSelect.indexOf(
  "\n  const menu =",
  inlineListboxHandlerStart,
);
const inlineListboxHandler = adminListboxSelect.slice(
  inlineListboxHandlerStart,
  inlineListboxHandlerEnd,
);
type ReviewPresentationDelegate = { module: string; exportName?: string; count: number };
function reviewPresentationDelegates(tree: ts.SourceFile, root: ts.Node, delegates: readonly ReviewPresentationDelegate[], selectedPresentation: "panel" | "forward" | "omitted" | "video-panel") {
  return delegates.every(delegate => {
    const imported = tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === delegate.module);
    const bindings = imported?.importClause?.namedBindings;
    const owner = delegate.exportName
      ? bindings && ts.isNamedImports(bindings) ? bindings.elements.find(binding => (binding.propertyName ?? binding.name).text === delegate.exportName)?.name.text : undefined
      : imported?.importClause?.name?.text;
    if (!owner) return false;
    const calls: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === owner) calls.push(node);
      ts.forEachChild(node, visit);
    };
    visit(root);
    return calls.length === delegate.count && calls.every(node => {
      const presentation = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "presentation");
      if (selectedPresentation === "omitted") return presentation === undefined;
      const value = presentation?.initializer;
      if (selectedPresentation === "panel") return Boolean(value && ts.isStringLiteral(value) && value.text === "panel");
      if (selectedPresentation === "video-panel") {
        const expression = value && ts.isJsxExpression(value) ? value.expression : undefined;
        return Boolean(expression && ts.isConditionalExpression(expression) &&
          ts.isIdentifier(expression.condition) && expression.condition.text === "videoPanel" &&
          ts.isStringLiteral(expression.whenTrue) && expression.whenTrue.text === "panel" &&
          ts.isIdentifier(expression.whenFalse) && expression.whenFalse.text === "undefined");
      }
      return Boolean(value && ts.isJsxExpression(value) && value.expression && ts.isIdentifier(value.expression) && value.expression.text === "presentation");
    });
  });
}
function hasReviewPresentationContract(source: string, owner: string, marker?: string, delegates: readonly ReviewPresentationDelegate[] = [], canonicalPresentationSource = sharedEntityReviewPanel) {
  const tree = ts.createSourceFile(`${owner}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === owner);
  const parameter = component?.parameters[0];
  if (!component?.body || !parameter || !ts.isObjectBindingPattern(parameter.name)) return false;
  const presentation = parameter.name.elements.find(node => (node.propertyName ?? node.name).getText(tree) === "presentation");
  if (!presentation?.initializer || !ts.isStringLiteral(presentation.initializer) || presentation.initializer.text !== "default") return false;
  const resolveType = (type: ts.TypeNode | undefined, sourceTree = tree, seen = new Set<string>()): ts.TypeNode | undefined => {
    if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) return type;
    const typeName = type.typeName.text;
    const identity = `${sourceTree.fileName}:${typeName}`;
    if (seen.has(identity)) return;
    const nextSeen = new Set(seen).add(identity);
    const alias = sourceTree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === typeName);
    if (alias) return resolveType(alias.type, sourceTree, nextSeen);
    const canonicalModule = owner === "ContentPublishingOptions" ? "../../review/AdminEntityReviewPanel" : "../review/AdminEntityReviewPanel";
    const canonicalImport = sourceTree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === canonicalModule);
    const bindings = canonicalImport?.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings) || !bindings.elements.some(binding => binding.name.text === typeName && (binding.propertyName ?? binding.name).text === "AdminEntityReviewPresentation")) return;
    const canonicalTree = ts.createSourceFile("AdminEntityReviewPanel.tsx", canonicalPresentationSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const canonicalAlias = canonicalTree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "AdminEntityReviewPresentation");
    return resolveType(canonicalAlias?.type, canonicalTree, nextSeen);
  };
  const props = resolveType(parameter.type);
  const member = props && ts.isTypeLiteralNode(props) ? props.members.find((node): node is ts.PropertySignature => ts.isPropertySignature(node) && node.name.getText(tree) === "presentation") : undefined;
  const variants = resolveType(member?.type);
  if (!member?.questionToken || !variants || !ts.isUnionTypeNode(variants) || variants.types.length !== 2 || !variants.types.every(node => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal))) return false;
  if (new Set(variants.types.map(node => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : "")).size !== 2 || !variants.types.every(node => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) && ["default", "panel"].includes(node.literal.text))) return false;
  const panel = component.body.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find(node => ts.isIdentifier(node.name) && node.name.text === "panel")?.initializer;
  if (!panel || !ts.isBinaryExpression(panel) || panel.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken || !ts.isIdentifier(panel.left) || panel.left.text !== "presentation" || !ts.isStringLiteral(panel.right) || panel.right.text !== "panel") return false;
  if (marker) {
    const markers: ts.JsxAttribute[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(tree) === marker) markers.push(node);
      ts.forEachChild(node, visit);
    };
    visit(component.body);
    const value = markers[0]?.initializer;
    const expression = value && ts.isJsxExpression(value) ? value.expression : undefined;
    if (markers.length !== 1 || !expression || !ts.isConditionalExpression(expression) || !ts.isIdentifier(expression.condition) || expression.condition.text !== "panel" || !ts.isStringLiteral(expression.whenTrue) || expression.whenTrue.text !== "panel" || !ts.isStringLiteral(expression.whenFalse) || expression.whenFalse.text !== "dashboard") return false;
  }
  return reviewPresentationDelegates(tree, component.body, delegates, "forward");
}
const publishingReviewDelegates = [{ module: "../../review/AdminEntityReviewPanel", exportName: "AdminEntityReviewDecisionCard", count: 2 }] as const;
const contentReviewDelegates = [{ module: "../review/AdminEntityReviewPanel", count: 1 }] as const;
const articleReviewDelegates = [{ module: "../../content-workflow/ContentReviewPanel", count: 1 }, { module: "./ContentPublishingOptions", count: 1 }] as const;
const mediaReviewDelegates = [{ module: "../../../content-workflow/ContentReviewPanel", count: 1 }, { module: "../ContentPublishingOptions", count: 1 }] as const;
const mediaContentFormSource = read("src/components/admin/content/editors/media/MediaContentForm.tsx");
function hasMediaReviewPanelContract(source: string) {
  const tree = ts.createSourceFile("MediaContentForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "MediaContentForm");
  const parameter = component?.parameters[0];
  if (!component?.body || !parameter || !ts.isObjectBindingPattern(parameter.name) ||
    !parameter.name.elements.some(binding => (binding.propertyName ?? binding.name).getText(tree) === "contentType")) return false;
  return reviewPresentationDelegates(tree, tree, mediaReviewDelegates, "panel");
}
check(
  "Topic Article create and edit share the unified action and mode contract",
  articleCreate.includes("action={saveContentForm}") &&
    articleCreate.includes('mode="create"') &&
    articleEdit.includes("action={saveContentForm}") &&
    articleEdit.includes('mode="edit"'),
);
check(
  "Topic Article Create and Edit mount one shared editor identity",
  [articleCreate, articleEdit].every((source) =>
    [
      "ContentEditorShell",
      "ContentBasicDataPanel",
      "TopicMarkdownEditor",
      "FaqEditor",
      "SeoPanel",
      "ContentPublishingOptions",
      "ContentReviewPanel",
    ].every(
      (owner) => occurrenceCount(source, new RegExp(`<${owner}\\b`, "g")) === 1,
    ),
  ) &&
    topicTabs.includes('variant="editor"') &&
    topicBasicPanel.includes('presentation = "default"') &&
    topicBasicPanel.includes('const panel = presentation === "panel";') &&
    topicBasicPanel.includes('data-content-basic-presentation={panel ? "panel" : "editor"}') &&
    occurrenceCount(topicSeoPanel, /<AdminEntitySeoPanel/g) === 1 &&
    occurrenceCount(topicSeoPanel, /<AdminFormLayout/g) === 0 &&
    occurrenceCount(topicSeoPanel, /<AdminSingleOpenAccordion/g) === 0 &&
    occurrenceCount(sharedEntitySeoPanel, /<AdminFormLayout/g) === 1 &&
    occurrenceCount(sharedEntitySeoPanel, /<AdminSingleOpenAccordion/g) === 1 &&
    sharedEntitySeoPanel.includes('defaultOpenId="search-result-preview"') &&
    sharedEntitySeoPanel.includes(
      'data-admin-seo-control-order="index-follow-canonical"',
    ) &&
    topicPublishingOptions.includes("data-content-publishing-options") &&
    topicPublishChecklist.includes("data-content-review-capability") &&
    hasReviewPresentationContract(topicPublishChecklist, "ContentReviewPanel", "data-content-review-presentation", contentReviewDelegates) &&
    topicPublishChecklist.includes("<AdminEntityReviewPanel") &&
    hasReviewPresentationContract(sharedEntityReviewPanel, "AdminEntityReviewPanel", "data-admin-entity-review-presentation") &&
    ![topicPublishChecklist, sharedEntityReviewPanel].some((source) =>
      source.includes("AdminSingleOpenAccordion"),
    ),
);
check(
  "retired Topic presentation branches cannot fork Create from Edit",
  !topicTabs.includes("variant?:") &&
    !topicBasicPanel.includes("editorPresentation") &&
    !topicSeoPanel.includes("presentation?:") &&
    !topicSeoPanel.includes("presentation ===") &&
    hasReviewPresentationContract(topicPublishingOptions, "ContentPublishingOptions", undefined, publishingReviewDelegates) &&
    hasReviewPresentationContract(topicPublishChecklist, "ContentReviewPanel", "data-content-review-presentation", contentReviewDelegates) &&
    ![articleCreate, articleEdit].some(
      (source) =>
        source.includes('variant="editor"') ||
        source.includes('presentation="editor"') ||
        source.includes('presentation="integrated"') ||
        source.includes('presentation="embedded"'),
    ),
);
check(
  "Article and all five Media Review and Publishing consumers explicitly adopt the canonical panel while Project retains its omitted dashboard default",
  [articleCreate, articleEdit].every(source => {
    const tree = ts.createSourceFile("ArticleEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return reviewPresentationDelegates(tree, tree, articleReviewDelegates, "panel");
  }) && (() => {
    const project = ts.createSourceFile("ProjectPublishChecklistPanel.tsx", read("src/components/admin/projects/ProjectPublishChecklistPanel.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return hasMediaReviewPanelContract(mediaContentFormSource) && reviewPresentationDelegates(project, project, [{ module: "../review/AdminEntityReviewPanel", count: 1 }], "omitted");
  })(),
);
check(
  "Media Review panel negatives reject type or record gates, changed presentation, missing or duplicate bindings and parallel owners",
  [
    mediaContentFormSource.replace('<ContentReviewPanel\n            presentation="panel"', '<ContentReviewPanel\n            presentation={contentType === "video" ? "panel" : undefined}'),
    mediaContentFormSource.replace('<ContentReviewPanel\n            presentation="panel"', '<ContentReviewPanel\n            presentation={values?.id === 1639 ? "panel" : undefined}'),
    mediaContentFormSource.replace('<ContentReviewPanel\n            presentation="panel"', '<ContentReviewPanel\n            presentation="default"'),
    mediaContentFormSource.replace('<ContentPublishingOptions\n                presentation="panel"', '<ContentPublishingOptions\n                presentation="default"'),
    mediaContentFormSource.replace('<ContentPublishingOptions\n                presentation="panel"', '<ContentPublishingOptions\n                presentation={undefined}'),
    mediaContentFormSource.replace('<ContentReviewPanel\n            presentation="panel"', '<ContentReviewPanel'),
    mediaContentFormSource.replace('from "../../../content-workflow/ContentReviewPanel"', 'from "../../../content-workflow/ParallelReviewPanel"'),
    `${mediaContentFormSource}\nconst duplicateReview = <ContentReviewPanel presentation="panel" />;`,
  ].every(mutated => mutated !== mediaContentFormSource && !hasMediaReviewPanelContract(mutated)),
);
check(
  "bounded Review presentation negatives reject changed defaults, unsupported variants, wrong dashboard markers, parallel owners and missing Article opt-ins",
  !hasReviewPresentationContract(topicPublishingOptions.replace('presentation = "default"', 'presentation = "panel"'), "ContentPublishingOptions", undefined, publishingReviewDelegates) &&
    !hasReviewPresentationContract(topicPublishingOptions.replace("presentation?: AdminEntityReviewPresentation", 'presentation?: "default" | "panel" | "editor"'), "ContentPublishingOptions", undefined, publishingReviewDelegates) &&
    !hasReviewPresentationContract(topicPublishingOptions.replace("type AdminEntityReviewPresentation", "type ParallelReviewPresentation"), "ContentPublishingOptions", undefined, publishingReviewDelegates) &&
    !hasReviewPresentationContract(topicPublishingOptions, "ContentPublishingOptions", undefined, publishingReviewDelegates, sharedEntityReviewPanel.replace('"default" | "panel"', '"default" | "panel" | "editor"')) &&
    !hasReviewPresentationContract(topicPublishingOptions.replaceAll("presentation={presentation}", "presentation={undefined}"), "ContentPublishingOptions", undefined, publishingReviewDelegates) &&
    !hasReviewPresentationContract(topicPublishChecklist.replace('panel ? "panel" : "dashboard"', 'panel ? "dashboard" : "panel"'), "ContentReviewPanel", "data-content-review-presentation", contentReviewDelegates) &&
    !hasReviewPresentationContract(sharedEntityReviewPanel.replace('panel ? "panel" : "dashboard"', 'panel ? "panel" : "default"'), "AdminEntityReviewPanel", "data-admin-entity-review-presentation") &&
    !hasReviewPresentationContract(topicPublishChecklist.replace('../review/AdminEntityReviewPanel"', '../review/ParallelReviewPanel"'), "ContentReviewPanel", "data-content-review-presentation", contentReviewDelegates) &&
    [articleCreate, articleEdit].every(source => {
      const missing = source.replace(/(<ContentReviewPanel\s+)presentation="panel"/, "$1");
      const tree = ts.createSourceFile("ArticleEditor.tsx", missing, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      return missing !== source && !reviewPresentationDelegates(tree, tree, articleReviewDelegates, "panel");
    }),
);
function hasTopicContentTypeListboxContract(source: string, basicPanelSource: string) {
  const tree = ts.createSourceFile("TopicContentTypeControl.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = new Set(tree.statements.flatMap((node) => ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../ui/AdminListboxSelect" && node.importClause?.name
    ? [node.importClause.name.text] : []));
  let sharedListboxes = 0;
  let nativeSelect = false;
  let presentationContract = false;
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === "presentation") presentationContract = true;
    if (ts.isStringLiteral(node) && node.text === "presentation" &&
      (ts.isPropertySignature(node.parent) || ts.isPropertyAssignment(node.parent) ||
        ts.isElementAccessExpression(node.parent) || ts.isComputedPropertyName(node.parent))) presentationContract = true;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(tree);
      if (owners.has(name)) sharedListboxes += 1;
      if (name === "select") nativeSelect = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  const basicTree = ts.createSourceFile("ContentBasicDataPanel.tsx", basicPanelSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let compactBoundary = false;
  const visitBasic = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(basicTree) === "presentation") {
      const value = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && ts.isStringLiteral(value) && value.text === "compact") compactBoundary = true;
    }
    ts.forEachChild(node, visitBasic);
  };
  visitBasic(basicTree);
  return owners.size === 1 && sharedListboxes === 1 && !nativeSelect && !presentationContract && !compactBoundary;
}
check(
  "Topic content type uses one shared listbox contract without a retired native branch",
  hasTopicContentTypeListboxContract(topicContentTypeControl, topicBasicPanel),
);
check(
  "Topic listbox guard ignores presentation and native-control terminology confined to comments",
  hasTopicContentTypeListboxContract(`${topicContentTypeControl}\n// presentation?: string; <select />`, `${topicBasicPanel}\n// presentation="compact"`),
);
check(
  "Topic listbox negative fixtures reject presentation contracts, executable selectors, JSX props, native or duplicate controls, parallel owners and compact boundaries",
  !hasTopicContentTypeListboxContract(topicContentTypeControl.replace("labelClassName?: string;", 'labelClassName?: string; presentation?: "editor";'), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(`${topicContentTypeControl}\nconst presentation = "editor";`, topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl.replace("<AdminListboxSelect", '<AdminListboxSelect presentation="editor"'), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl.replace("labelClassName?: string;", 'labelClassName?: string; "presentation"?: "editor";'), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl.replace("<AdminFormError", "<select /><AdminFormError"), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl.replace("<AdminFormError", "<AdminListboxSelect /><AdminFormError"), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl.replace('../../ui/AdminListboxSelect', '../../ui/ParallelListboxSelect'), topicBasicPanel) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl, `${topicBasicPanel}\nconst compact = <ContentBasicDataPanel presentation="compact" />;`) &&
    !hasTopicContentTypeListboxContract(topicContentTypeControl, `${topicBasicPanel}\nconst compact = <ContentBasicDataPanel presentation={"compact"} />;`),
);
check(
  "scoped preview and builder routes adopt shared header and domain status owners directly",
  [topicPreview, projectPreview, menuBuilderPage].every((source) =>
    source.includes("components/admin/ui"),
  ) &&
    topicPreview.includes("getContentStatusMetadata") &&
    projectPreview.includes("getProjectPublicationMetadata") &&
    !existsSync(absolutePath("src/components/admin/AdminPageHeader.tsx")) &&
    !existsSync(absolutePath("src/components/admin/AdminStatusBadge.tsx")),
);
check(
  "Topic mode identity, Preview, and media-signal differences remain declarative and unique",
  occurrenceCount(contentEditorShell, /name="content_type"/g) === 1 &&
    occurrenceCount(contentEditorShell, /name="id"/g) === 1 &&
    articleCreate.includes('mode="create"') &&
    articleCreate.includes('contentType="article"') &&
    !articleCreate.includes("entityId=") &&
    articleEdit.includes('mode="edit"') &&
    articleEdit.includes('contentType="article"') &&
    articleEdit.includes("entityId={topic.id}") &&
    occurrenceCount(articleCreate, /<AdminEntityPreviewActions\b/g) === 0 &&
    occurrenceCount(articleEdit, /<AdminEntityPreviewActions\b/g) === 1 &&
    [articleCreate, articleEdit].every(
      (source) =>
        occurrenceCount(source, /<TopicMediaCatalogSyncSignal\b/g) === 1,
    ) &&
    topicMediaSyncSignal.includes('form.addEventListener("admin-form-saved"') &&
    topicMediaSyncSignal.includes("window.localStorage.setItem("),
);
check(
  "Topic Article editors no longer reference the parallel SaveBar engine",
  !articleCreate.includes("SaveBar") && !articleEdit.includes("SaveBar"),
);
check(
  "Topic taxonomy errors target one stable visible dropdown presentation",
  topicFormDefinition.includes(
    'category_id: { tabId: "basic", targetId: "content-category-listbox" }',
  ) &&
    topicFormDefinition.includes(
      'series_id: { tabId: "basic", targetId: "content-series-listbox" }',
    ) &&
    topicCategorySelect.includes('id="content-category-popover"') &&
    topicCategorySelect.includes('focusTargetId="content-category-listbox"') &&
    topicSeriesSelect.includes('id="content-series-popover"') &&
    topicSeriesSelect.includes('focusTargetId="content-series-listbox"') &&
    ![topicCategorySelect, topicSeriesSelect].some(
      (source) =>
        /(?:^|[<\s])presentation=/m.test(source) ||
        /(?:^|\s)presentation\??:/.test(source) ||
        /(?:^|\s)presentation\s*===/.test(source) ||
        source.includes("inline="),
    ) &&
    adminFormListboxSelect.includes("triggerId={focusTargetId}") &&
    adminListboxSelect.includes("id={`${controlId}-listbox`}") &&
    adminListboxSelect.includes('role="listbox"'),
);
check(
  "Shared inline listbox skips disabled options and exposes only selectable active descendants",
  inlineListboxHandlerStart >= 0 &&
    inlineListboxHandlerEnd > inlineListboxHandlerStart &&
    inlineListboxHandler.includes("if (!selectableOptions.length) return") &&
    inlineListboxHandler.includes("selectableOptions.findIndex") &&
    !inlineListboxHandler.includes("visibleOptions") &&
    adminListboxSelect.includes(
      "onKeyDown={(event) => handleInlineKeyDown(event, option.value)}",
    ) &&
    adminListboxSelect.includes("const inlineTabStopValue =") &&
    adminListboxSelect.includes("selectableOptions[0]?.value") &&
    adminListboxSelect.includes(
      "tabIndex={option.value === inlineTabStopValue ? 0 : -1}",
    ) &&
    occurrenceCount(adminListboxSelect, /aria-activedescendant=\{/g) === 3 &&
    occurrenceCount(
      adminListboxSelect,
      /aria-activedescendant=\{[\s\S]{0,120}resolvedActiveValue/g,
    ) === 3 &&
    !/aria-activedescendant=\{[\s\S]{0,120}visibleOptions/.test(
      adminListboxSelect,
    ),
);
function hasInlineListboxPresentationContract(source: string, formSource: string) {
  const ports = ["inlineClassName", "inlineOptionsClassName", "inlineOptionClassName"];
  const tree = ts.createSourceFile("AdminListboxSelect.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const formTree = ts.createSourceFile("AdminFormListboxSelect.tsx", formSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const optionalProps = (root: ts.SourceFile, name: string, keys: readonly string[]) => {
    const declaration = root.statements.find((node): node is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(node) && node.name.text === name);
    const props = declaration?.type;
    return props && ts.isTypeLiteralNode(props) && keys.every(key =>
      props.members.some(member => ts.isPropertySignature(member) &&
        member.name.getText(root) === key && Boolean(member.questionToken)));
  };
  const component = tree.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "AdminListboxSelect");
  const bindings = component?.parameters[0]?.name;
  const disabledDefault = bindings && ts.isObjectBindingPattern(bindings)
    ? bindings.elements.find(binding => binding.name.getText(tree) === "disabled")?.initializer
    : undefined;
  const presentationDefault = bindings && ts.isObjectBindingPattern(bindings)
    ? bindings.elements.find(binding => binding.name.getText(tree) === "presentation")?.initializer?.getText(tree)
    : undefined;
  let inlinePanelClass: ts.Expression | undefined;
  const findInlinePanelClass = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "className" &&
      node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression &&
      node.initializer.expression.getText(tree).startsWith("inlineClassName ??")) {
      inlinePanelClass = node.initializer.expression;
    }
    ts.forEachChild(node, findInlinePanelClass);
  };
  findInlinePanelClass(tree);
  const preservesInlinePresentation = (() => {
    if (!inlinePanelClass) return false;
    const body = ts.transpileModule(`return (${inlinePanelClass.getText(tree)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const resolveClasses = new Function("inlineClassName", "cinematic", "ADMIN_CINEMATIC_GOLD_V1", body) as
      (override: string | undefined, cinematic: boolean, tokens: unknown) => string;
    const tokens = { collection: { menu: "canonical-collection-menu" } };
    return resolveClasses(undefined, false, tokens) === "rounded-2xl border border-white/10 bg-black/25 p-1.5" &&
      resolveClasses(undefined, true, tokens) === "rounded-2xl border p-1.5 canonical-collection-menu" &&
      [false, true].every(cinematic => resolveClasses("", cinematic, tokens) === "" && resolveClasses("consumer-inline-panel", cinematic, tokens) === "consumer-inline-panel");
  })();
  const forwarded: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(formTree) === "AdminListboxSelect") forwarded.push(node);
    ts.forEachChild(node, visit);
  };
  visit(formTree);
  const forwards = (key: string) => {
    const attribute = forwarded[0]?.attributes.properties.find((node): node is ts.JsxAttribute =>
      ts.isJsxAttribute(node) && node.name.getText(formTree) === key);
    return attribute?.initializer && ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression && ts.isIdentifier(attribute.initializer.expression) &&
      attribute.initializer.expression.text === key;
  };
  return Boolean(optionalProps(tree, "AdminListboxSelectProps", ports) &&
    optionalProps(formTree, "AdminFormListboxSelectProps", [...ports, "labelClassName", "presentation"]) &&
    optionalProps(tree, "AdminListboxSelectOption", ["icon"]) &&
    bindings && ts.isObjectBindingPattern(bindings) && ports.every(key =>
      bindings.elements.some(binding => binding.name.getText(tree) === key && !binding.initializer)) &&
    disabledDefault?.kind === ts.SyntaxKind.FalseKeyword &&
    presentationDefault === '"default"' && source.includes('const cinematic = presentation === "cinematic";') &&
    forwarded.length === 1 && ports.every(forwards) &&
    formSource.includes('from "./AdminListboxSelect"') &&
    preservesInlinePresentation &&
    source.includes('className={inlineOptionsClassName ?? `${ADMIN_FILTER_MENU_SCROLLBAR_CLASSES} max-h-44 overflow-y-auto p-0.5`}') &&
    source.includes('className={inlineOptionClassName?.(selectedOption) ?? `block w-full rounded-[8px] px-2.5 py-2 text-right text-sm transition') &&
    source.includes('{option.icon ? <span aria-hidden="true"') &&
    formSource.includes('presentation = "default"') &&
    formSource.includes('const titleClassName = presentation === "panel" ? adminFormLabelClassName({ textInset: true }) : labelClassName;') &&
    formSource.includes('className={titleClassName ?? "block text-sm font-medium text-white/70"}') &&
    formSource.includes('{titleClassName ? <span data-admin-form-label-text>') &&
    formSource.includes('className={presentation === "panel" ? adminFormHintClassName({ textInset: true }) : "text-xs leading-5 text-white/40"}'));
}
check(
  "Shared inline choice composition and inset label ports are optional and preserve existing listbox defaults",
  hasInlineListboxPresentationContract(adminListboxSelect, adminFormListboxSelect),
);
check(
  "Shared inline choice negatives reject changed defaults, missing fallback, required or lost ports, parallel selectors and exposed decorative icons",
  [
    [adminListboxSelect.replace('disabled = false', 'disabled = true'), adminFormListboxSelect],
    [adminListboxSelect.replace('inlineClassName?: string', 'inlineClassName: string'), adminFormListboxSelect],
    [adminListboxSelect.replace('inlineClassName ?? (cinematic', 'inlineClassName || (cinematic'), adminFormListboxSelect],
    [adminListboxSelect.replace('presentation = "default"', 'presentation = "cinematic"'), adminFormListboxSelect],
    [adminListboxSelect.replace('inlineClassName ?? (cinematic', 'inlineClassName ?? (false'), adminFormListboxSelect],
    [adminListboxSelect.replace('bg-black/25 p-1.5")', 'bg-black/20 p-1.5")'), adminFormListboxSelect],
    [adminListboxSelect.replace('inlineOptionClassName?.(selectedOption) ??', 'inlineOptionClassName?.(selectedOption) ||'), adminFormListboxSelect],
    [adminListboxSelect.replace('{option.icon ? <span aria-hidden="true"', '{option.icon ? <span aria-hidden="false"'), adminFormListboxSelect],
    [adminListboxSelect, adminFormListboxSelect.replace('inlineOptionsClassName={inlineOptionsClassName}', '')],
    [adminListboxSelect, adminFormListboxSelect.replace('from "./AdminListboxSelect"', 'from "./ParallelListboxSelect"')],
    [adminListboxSelect, adminFormListboxSelect.replace('{titleClassName ? <span data-admin-form-label-text>', '{titleClassName ? <span>')],
    [adminListboxSelect, adminFormListboxSelect.replace('presentation?: "default" | "panel"', 'presentation: "default" | "panel"')],
    [adminListboxSelect, adminFormListboxSelect.replace('presentation = "default"', 'presentation = "panel"')],
    [adminListboxSelect, adminFormListboxSelect.replace(': labelClassName;', ': undefined;')],
    [adminListboxSelect, adminFormListboxSelect.replace(': "text-xs leading-5 text-white/40"', ': "text-xs leading-5 text-white/48"')],
  ].every(([source, formSource]) => !hasInlineListboxPresentationContract(source, formSource)),
);
function hasInlineListboxDisabledContract(source: string) {
  const handlerStart = source.indexOf("function handleInlineKeyDown");
  const handlerEnd = source.indexOf("\n  const menu =", handlerStart);
  return handlerStart >= 0 && handlerEnd > handlerStart &&
    source.slice(handlerStart, handlerEnd).includes("if (disabled) return;") &&
    /function handleSelect\(next: string\) \{\s*if \(disabled\) return;/.test(source) &&
    source.includes("disabled={disabled || option.disabled}") &&
    source.includes("aria-disabled={disabled || option.disabled || undefined}");
}
check(
  "Shared inline choice selection respects disabled controls while retaining per-option eligibility",
  hasInlineListboxDisabledContract(adminListboxSelect) &&
    [
      adminListboxSelect.replace(/function handleSelect\(next: string\) \{\s*if \(disabled\) return;/, "function handleSelect(next: string) {"),
      adminListboxSelect.replace("disabled={disabled || option.disabled}", "disabled={option.disabled}"),
      adminListboxSelect.replace("aria-disabled={disabled || option.disabled || undefined}", "aria-disabled={option.disabled || undefined}"),
    ].every(source => !hasInlineListboxDisabledContract(source)),
);
check(
  "Shared Admin listbox owns the category-tree indentation presentation contract",
  adminListboxSelect.includes("depth?: number;") &&
    occurrenceCount(adminListboxSelect, /repeat\(option\.depth\)/g) === 2,
);
check(
  "CategoryForm wires create and edit modes to their correct shared-runtime actions",
  [
    'mode: "create" | "edit"',
    'const isEdit = mode === "edit"',
    "createCategoryForm,",
    "updateCategoryForm,",
    "const action = isEdit ? updateCategoryForm : createCategoryForm",
    "action={action}",
    "mode={mode}",
    'entityKey="category"',
  ].every((marker) => categoryForm.includes(marker)),
);
check(
  "SeriesForm wires create and edit modes to their correct shared-runtime actions",
  [
    'mode: "create" | "edit"',
    'const isEdit = mode === "edit"',
    "createSeriesForm,",
    "updateSeriesForm,",
    "const action = isEdit ? updateSeriesForm : createSeriesForm",
    "action={action}",
    "mode={mode}",
    'entityKey="series"',
  ].every((marker) => seriesForm.includes(marker)),
);

// A token on <AdminFormRuntime> spaces its one DOM fieldset, not the visible
// Sections below display:contents. Bind cadence to the actual inner DOM parent,
// keeping this source proof separate from normal/sticky browser geometry.
function hasCanonicalVisibleFormStack(source: string, tokenModule: string, contentOwner: string) {
  const tree = ts.createSourceFile("ReferenceForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tokenBindings = tree.statements.flatMap(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === tokenModule && !node.importClause?.isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
    ? node.importClause.namedBindings.elements.filter(binding => !binding.isTypeOnly && (binding.propertyName ?? binding.name).text === "ADMIN_FORM_STACK_CLASS_NAME").map(binding => binding.name.text) : []);
  if (tokenBindings.length !== 1) return false;
  const elements: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  const opening = (node: ts.JsxElement | ts.JsxSelfClosingElement) => ts.isJsxElement(node) ? node.openingElement : node;
  const named = (name: string) => elements.filter(node => opening(node).tagName.getText(tree) === name);
  const nearestElement = (node: ts.Node) => { let parent = node.parent; while (parent && !ts.isJsxElement(parent)) parent = parent.parent; return parent; };
  const actions = named("AdminFormActions"), content = named(contentOwner), runtimes = named("AdminFormRuntime");
  if (actions.length !== 1 || content.length === 0 || runtimes.length !== 1) return false;
  const stack = nearestElement(actions[0]);
  if (!stack || stack.openingElement.tagName.getText(tree) !== "div" || content.some(node => nearestElement(node) !== stack) ||
      content.some(node => node.end > actions[0].getStart(tree)) || nearestElement(stack) !== runtimes[0]) return false;
  const attributes = stack.openingElement.attributes.properties;
  if (attributes.some(attribute => ts.isJsxSpreadAttribute(attribute) || ts.isJsxAttribute(attribute) && ["style", "hidden"].includes(attribute.name.getText(tree)))) return false;
  const classes = attributes.filter((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "className");
  const value = classes.length === 1 ? classes[0].initializer : undefined;
  if (!value || !ts.isJsxExpression(value) || !value.expression || !ts.isIdentifier(value.expression) || value.expression.text !== tokenBindings[0]) return false;
  return !opening(runtimes[0]).attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "className" &&
    attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression &&
    ts.isIdentifier(attribute.initializer.expression) && attribute.initializer.expression.text === tokenBindings[0]);
}

check(
  "full-page reference forms adopt one shared presentation cadence and page surface",
  adminFormPresentation.includes(
    'export const ADMIN_FORM_STACK_CLASS_NAME = "space-y-5"',
  ) &&
    adminFormPresentation.includes("grid gap-6 xl:grid-cols") &&
    adminFormPresentation.includes("`${ADMIN_FORM_SECTION_SURFACE_CLASSES} p-5`") &&
    adminFormPresentation.includes('compactHeader ? "mb-4" : "mb-5"') &&
    adminPageExperience.includes(
      'data-admin-page-surface-owner="AdminPageExperience"',
    ) &&
    adminPageExperience.includes("flex flex-col gap-6") &&
    [articleCreate, articleEdit].every(
      (source) =>
        source.includes("<AdminPageExperience") &&
        !source.includes('<main className="space-y-7">'),
    ) &&
    hasCanonicalVisibleFormStack(contentEditorShell, "../../ui", "AdminModuleTabs") &&
    [categoryForm, seriesForm].every((source) =>
      hasCanonicalVisibleFormStack(source, "../../../../components/admin/ui", "AdminFormSection"),
    ),
);
for (const [label, source, tokenModule, contentOwner] of [
  ["Topic reference", contentEditorShell, "../../ui", "AdminModuleTabs"],
  ["Category", categoryForm, "../../../../components/admin/ui", "AdminFormSection"],
  ["Series", seriesForm, "../../../../components/admin/ui", "AdminFormSection"],
] as const) {
  const tree = ts.createSourceFile("ReferenceForm.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let action: ts.JsxSelfClosingElement | undefined;
  const visit = (node: ts.Node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminFormActions") action = node; ts.forEachChild(node, visit); };
  visit(tree); assert.ok(action);
  const stack = action.parent; assert.ok(ts.isJsxElement(stack));
  const stackSource = stack.getText(tree), stackBody = source.slice(stack.openingElement.end, stack.closingElement.getStart(tree)), actionSource = action.getText(tree);
  const withoutToken = stackSource.replace("className={ADMIN_FORM_STACK_CLASS_NAME}", "");
  for (const [defect, changed] of [
    ["lost inner token", source.replace(stackSource, withoutToken)],
    ["Runtime-only spacing", source.replace(stackSource, withoutToken).replace("<AdminFormRuntime", "<AdminFormRuntime className={ADMIN_FORM_STACK_CLASS_NAME}")],
    ["fragment without DOM spacing", source.replace(stackSource, `<>${stackBody}</>`)],
    ["Actions outside the stack", source.replace(stackSource, stackSource.replace(actionSource, "") + actionSource)],
    ["nested content wrapper", source.replace(stackSource, stackSource.replace(stackBody, `<div>${stackBody}</div>`))],
    ["local stack override", source.replace(stackSource, stackSource.replace("className={ADMIN_FORM_STACK_CLASS_NAME}", 'className="space-y-5"'))],
  ] as const) {
    check(`${label} cadence rejects ${defect} while Section and Actions owners remain present`, changed !== source && !hasCanonicalVisibleFormStack(changed, tokenModule, contentOwner));
  }
}
check(
  "Media Topic Create and Edit delegate lifecycle and presentation to the unified content owners",
  [
    "<ContentEditorShell",
    "<ContentBasicDataPanel",
    "<ContentPublishingOptions",
    "<ContentReviewPanel",
    "<MediaEntitySeoPanel",
  ].every((marker) => mediaContentForm.includes(marker)) &&
    !mediaContentForm.includes("<form") &&
    !mediaContentForm.includes("<AdminStickyFormBar") &&
    !mediaContentForm.includes(
      'className="w-full rounded-2xl border border-white/10 bg-black/30',
    ),
);
check(
  "Redirect and Page quick-create forms adopt the existing shared field presentation owners",
  redirectForm.includes("<AdminFormField") &&
    redirectForm.includes("<AdminFormGrid") &&
    redirectForm.includes("<AdminFormListboxSelect") &&
    !redirectForm.includes("adminFormLabelClassName") &&
    !redirectForm.includes("<select") &&
    createPageModal.includes("<AdminFormField") &&
    !createPageModal.includes("adminFormLabelClassName"),
);

const createPageSyntax = ts.createSourceFile(
  "CreatePageModal.tsx",
  createPageModal,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const createPageRuntimeNodes: Array<ts.JsxOpeningElement | ts.JsxSelfClosingElement> = [];
const visitCreatePageRuntime = (node: ts.Node) => {
  if (
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
    node.tagName.getText(createPageSyntax) === "AdminFormRuntime"
  ) {
    createPageRuntimeNodes.push(node);
  }
  ts.forEachChild(node, visitCreatePageRuntime);
};
visitCreatePageRuntime(createPageSyntax);
check(
  "Page quick-create invalidates only the Pages entity cache at its canonical Form Runtime before create-to-edit navigation",
  createPageRuntimeNodes.length === 1 &&
    createPageRuntimeNodes.every((node) => {
      const invalidation = node.attributes.properties.find(
        (property) => ts.isJsxAttribute(property) && property.name.getText(createPageSyntax) === "invalidateEntities",
      );
      if (!invalidation || !ts.isJsxAttribute(invalidation)) return false;
      const initializer = invalidation.initializer;
      if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression) return false;
      const expression = initializer.expression;
      return ts.isArrayLiteralExpression(expression) &&
        expression.elements.length === 1 &&
        ts.isStringLiteral(expression.elements[0]) &&
        expression.elements[0].text === "pages";
    }),
);

const runtime = read("src/components/admin/ui/AdminFormRuntime.tsx");
function verifySubmitFieldFinalization(source: string) {
  const tree = ts.createSourceFile("AdminFormRuntime.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reactDomImport = tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "react-dom");
  const imports = reactDomImport?.importClause?.namedBindings;
  assert.ok(imports && ts.isNamedImports(imports) && imports.elements.some((element) => element.name.text === "flushSync" && (!element.propertyName || element.propertyName.text === "flushSync")), "Finalization uses React's synchronous commit owner");
  const props = tree.statements.find((node): node is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(node) && node.name.text === "AdminFormRuntimeProps");
  let finalizationProp: ts.PropertySignature | undefined;
  const findProp = (node: ts.Node) => {
    if (ts.isPropertySignature(node) && node.name.getText(tree) === "finalizeFieldsOnSubmit") finalizationProp = node;
    ts.forEachChild(node, findProp);
  };
  assert.ok(props);
  findProp(props);
  assert.ok(finalizationProp?.questionToken && finalizationProp.type?.kind === ts.SyntaxKind.BooleanKeyword, "Finalization remains an optional boolean port");
  const instance = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormRuntimeInstance");
  const parameters = instance?.parameters[0]?.name;
  assert.ok(parameters && ts.isObjectBindingPattern(parameters));
  const binding = parameters.elements.find((element) => element.name.getText(tree) === "finalizeFieldsOnSubmit");
  assert.equal(binding?.initializer?.kind, ts.SyntaxKind.FalseKeyword, "Omitted consumers retain the existing submit lifecycle");
  const handlers: ts.ArrowFunction[] = [];
  const findHandler = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onSubmitCapture" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isArrowFunction(node.initializer.expression)) handlers.push(node.initializer.expression);
    ts.forEachChild(node, findHandler);
  };
  assert.ok(instance?.body);
  findHandler(instance.body);
  assert.equal(handlers.length, 1, "The existing form owns the only submit capture");
  const handlerSource = handlers[0].getText(tree);
  assert.doesNotMatch(handlerSource, /\b(?:window|document)\s*\.|\bactiveElement\b|\.blur\s*\(/, "Finalization targets its own form independently of focus");
  const compiled = ts.transpileModule(`const submit = ${handlerSource};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  for (const enabled of [false, true]) {
    for (const kind of ["input", "textarea", "select", "foreign", "button", "none"] as const) {
      const calls: string[] = [];
      let commitFieldDraft: (() => void) | undefined;
      const foreignForm = { dispatchEvent: () => { throw new Error("Another form must not receive finalization"); } };
      const form = {
        ownerDocument: { activeElement: null as unknown },
        value: "  Raw draft & slug  ",
        dispatchEvent(event: Event) {
          assert.equal(this, form, "The existing submit owner targets only its own form");
          assert.equal(event.type, "admin-form-before-submit");
          assert.equal(event.bubbles, false, "Field finalization must not escape to outer forms or document listeners");
          calls.push("finalize-event");
          // A field listener can schedule controlled React state. Commit it
          // before both the dirty baseline and failure-restoration snapshot.
          commitFieldDraft = () => { form.value = "raw-draft-and-slug"; };
          return true;
        },
      };
      const control = kind === "none" ? null : {
        tagName: kind === "textarea" ? "TEXTAREA" : kind === "select" ? "SELECT" : kind === "button" ? "BUTTON" : "INPUT",
        form: kind === "foreign" ? foreignForm : form,
        blur: () => { throw new Error("Field finalization must not depend on changing focus"); },
      };
      form.ownerDocument.activeElement = control;
      const submittedBaselineRef: { current: unknown } = { current: null };
      const submittedControlsRef: { current: unknown } = { current: null };
      const bindings = {
        finalizeFieldsOnSubmit: enabled,
        flushSync: (callback: () => void) => { calls.push("sync-start"); callback(); commitFieldDraft?.(); calls.push("sync-end"); },
        queueMicrotask: () => { calls.push("deferred"); },
        submittedBaselineRef,
        submittedControlsRef,
        serializeAdminForm: (target: typeof form) => { assert.equal(target, form); calls.push("serialize"); return target.value; },
        captureAdminFormControls: (target: typeof form) => { assert.equal(target, form); calls.push("capture"); return target.value; },
        clearFeedback: (channel: string) => { assert.equal(channel, "form:topic"); calls.push("feedback"); },
        feedbackChannel: "form:topic",
      };
      const submit = new Function(...Object.keys(bindings), `${compiled}\nreturn submit;`)(...Object.values(bindings)) as (event: { currentTarget: typeof form }) => void;
      submit({ currentTarget: form });
      assert.deepEqual(calls, [...(enabled ? ["sync-start", "finalize-event", "sync-end"] : []), "serialize", "capture", "feedback"], `${kind}, enabled=${enabled}: own-form finalization precedes both snapshots regardless of focus`);
      const expected = enabled ? "raw-draft-and-slug" : "  Raw draft & slug  ";
      assert.equal(submittedBaselineRef.current, expected, "The submitted dirty baseline uses the finalized value");
      assert.equal(submittedControlsRef.current, expected, "Failure restoration preserves exactly the finalized submitted draft");
    }
  }
}
check("Topic opt-in submit event synchronously commits only its own form's field drafts before baseline and failure snapshots regardless of focus; omitted consumers remain unchanged", (() => { verifySubmitFieldFinalization(runtime); return true; })());
const synchronousFinalization = runtime.match(/flushSync\(\(\) => \{\s*form\.dispatchEvent\(new Event\("admin-form-before-submit"\)\);\s*\}\);/)?.[0];
assert.ok(synchronousFinalization);
const finalizationMutations = [
  ["finalizeFieldsOnSubmit?: boolean;", "finalizeFieldsOnSubmit: boolean;"],
  ["finalizeFieldsOnSubmit = false", "finalizeFieldsOnSubmit = true"],
  ["if (finalizeFieldsOnSubmit) {", "if (true) {"],
  ["form.dispatchEvent", "document.dispatchEvent"],
  ['new Event("admin-form-before-submit")', 'new Event("unrelated-before-submit")'],
  ['new Event("admin-form-before-submit")', 'new Event("admin-form-before-submit", { bubbles: true })'],
  ['form.dispatchEvent(new Event("admin-form-before-submit"));', ""],
  [synchronousFinalization, 'form.dispatchEvent(new Event("admin-form-before-submit"));'],
  [synchronousFinalization, synchronousFinalization.replace("flushSync", "queueMicrotask")],
  ["if (finalizeFieldsOnSubmit) {", "submittedBaselineRef.current = serializeAdminForm(form); if (finalizeFieldsOnSubmit) {"],
  ["if (finalizeFieldsOnSubmit) {", "submittedControlsRef.current = captureAdminFormControls(form); if (finalizeFieldsOnSubmit) {"],
  ['from "react-dom"', 'from "parallel-react-dom"'],
  ["submittedBaselineRef.current = serializeAdminForm(form);", "submittedBaselineRef.current = '  Raw draft & slug  ';"],
  ["submittedControlsRef.current = captureAdminFormControls(form);", "submittedControlsRef.current = '  Raw draft & slug  ';"],
];
for (const [before, after] of finalizationMutations) {
  check(`Submit finalization rejects ${after}`, runtime.includes(before) && (() => { assert.throws(() => verifySubmitFieldFinalization(runtime.replace(before, after))); return true; })());
}
const contentFinalizationConsumers = collectTsxFiles(join(ROOT, "src")).filter((file) => file !== absolutePath(FORM_RUNTIME_NAVIGATION_ADAPTER) && readFileSync(file, "utf8").includes("finalizeFieldsOnSubmit")).map((file) => normalizePath(relative(ROOT, file))).sort();
check("Only the existing six-type Topic Content shell opts into submit finalization", JSON.stringify(contentFinalizationConsumers) === JSON.stringify(["src/components/admin/content/editors/ContentEditorShell.tsx"]) && /<AdminFormRuntime\b[^>]*\bfinalizeFieldsOnSubmit(?:\s|>)/.test(contentEditorShell) && !runtime.includes("finalizeActiveFieldOnSubmit") && !contentEditorShell.includes("finalizeActiveFieldOnSubmit"));
check(
  "Form error dismissal is opt-in, field-scoped and limited to its exact action result without mutating server errors",
  (() => {
    const tree = ts.createSourceFile("AdminFormRuntime.tsx", runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const instance = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormRuntimeInstance");
    assert.ok(instance?.body);
    const callbackSource = (name: string) => {
      const declaration = instance.body!.statements.filter(ts.isVariableStatement).flatMap((node) => [...node.declarationList.declarations]).find((node) => ts.isIdentifier(node.name) && node.name.text === name);
      assert.ok(declaration?.initializer && ts.isCallExpression(declaration.initializer));
      const callback = declaration.initializer.arguments[0];
      assert.ok(callback && ts.isArrowFunction(callback));
      return callback.getText(tree);
    };
    const clearSource = callbackSource("clearFieldErrors"), projectSource = callbackSource("context");
    const callback = (source: string, bindings: Record<string, unknown>) => new Function(...Object.keys(bindings), `${ts.transpileModule(`const callback = ${source};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\nreturn callback;`)(...Object.values(bindings));
    const state = { status: "error", fieldErrors: { video_url: ["previous provider error"], title: ["title required"] } };
    const originalErrors = structuredClone(state.fieldErrors);
    let projection: { revision: number; dismissedErrors?: { state: unknown; fields: readonly string[] } } = { revision: 0 };
    const clear = (names: readonly string[], pending = false, currentState = state) => callback(clearSource, { pending, state: currentState, setProjection: (update: (previous: typeof projection) => typeof projection) => { projection = update(projection); } })(names);
    const noop = () => {};
    const project = (currentState = state) => callback(projectSource, { projection, state: currentState, pending: false, mode: "edit", isDirty: true, notifyProjectionChange: noop, clearFieldErrors: noop, requestInternalNavigation: noop, requestClose: noop })() as { fieldErrors: Record<string, string[]>; state: unknown };
    assert.equal(project().fieldErrors, state.fieldErrors, "Omitted dismissal keeps the original field-error object");
    const initialProjection = projection;
    clear([], false);
    clear(["video_url"], true);
    assert.equal(projection, initialProjection, "Empty or pending requests leave the projection unchanged");
    clear(["video_url"]);
    assert.deepEqual(project().fieldErrors, { title: ["title required"] });
    assert.equal(project().state, state);
    assert.deepEqual(state.fieldErrors, originalErrors, "A context correction cannot erase the server action result");
    assert.equal(projection.revision, 1);
    const nextState = { ...state, fieldErrors: structuredClone(state.fieldErrors) };
    assert.equal(project(nextState).fieldErrors, nextState.fieldErrors, "A fresh action result restores validation even for the same field");
    clear(["title"], false, nextState);
    assert.deepEqual(project(nextState).fieldErrors, { video_url: ["previous provider error"] }, "Previous-result dismissals cannot carry into the new action result");
    let stateHooks = 0;
    const countStateHooks = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useState") stateHooks += 1;
      ts.forEachChild(node, countStateHooks);
    };
    countStateHooks(instance);
    assert.equal(stateHooks, 2, "Dismissal reuses the existing projection state alongside the existing initial action state");
    assert.doesNotMatch(clearSource, /\b(dispatch|setState|requestNavigation|requestClose)\s*\(/);
    return true;
  })(),
);
function verifySettingsRatioGridPort() {
  const runtimeSource=read("src/components/admin/ui/AdminFormRuntime.tsx");
  const extract=(source:string)=>{
    const tree=ts.createSourceFile("AdminFormRuntime.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const node=tree.statements.find((entry):entry is ts.FunctionDeclaration=>ts.isFunctionDeclaration(entry)&&entry.name?.text==="AdminFormGrid");
    assert.ok(node);return node.getText(tree);
  };
  const load=(source:string)=>{
    const owner:Partial<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")>={};
    new Function("React","exports",ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)({createElement},owner);
    assert.ok(owner.AdminFormGrid);return owner.AdminFormGrid;
  };
  const ratioClasses="grid-cols-1 items-start md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";
  const verify=(source:string)=>{
    const Grid=load(source),children=[createElement("input",{key:"native",name:"unchanged",defaultValue:"unchanged"})];
    assert.equal(Grid({children}).props.className,"grid min-w-0 gap-4 [&>*]:min-w-0 grid-cols-1 md:grid-cols-2");
    for(const columns of [1,2,3,4,5,6,12] as const)for(const presentation of ["plain","control-cards","aligned-fields","equal-height-columns"] as const)for(const density of ["default","compact","sections"] as const)for(const fieldContainers of [false,true]){
      const props={children,columns,presentation,density,fieldContainers,className:"existing-native-layout"},normal=Grid(props),ratio=Grid({...props,columnRatio:"3:2"});
      assert.equal(normal.props.children,children);assert.equal(ratio.props.children,children);
      assert.equal(ratio.props["data-admin-form-grid"],normal.props["data-admin-form-grid"]);
      if(columns===2)assert.equal(ratio.props.className,normal.props.className.replace("grid-cols-1 md:grid-cols-2",presentation==="equal-height-columns"?ratioClasses.replace("items-start ",""):ratioClasses));
      else assert.equal(renderToStaticMarkup(ratio),renderToStaticMarkup(normal),"The ratio port cannot change existing one/multi-column consumers");
    }
    assert.equal(Grid({children,columnRatio:"3:2"}).props.className,`grid min-w-0 gap-4 [&>*]:min-w-0 ${ratioClasses}`);
    assert.equal(Grid({children,density:"sections"}).props.className,Grid({children}).props.className.replace("gap-4","gap-5"),"Vertical section groups opt into the existing20px section rhythm without changing field defaults");
  };
  const actual=extract(runtimeSource);verify(actual);
  for(const mutant of [actual.replace('columnRatio,','columnRatio = "3:2",'),actual.replace('columns === 2 && columnRatio === "3:2"','columnRatio === "3:2"'),actual.replace('columnRatio === "3:2"','columnRatio === "lost-ratio"'),actual.replace('minmax(0,3fr)_minmax(0,2fr)','minmax(0,1fr)_minmax(0,1fr)'),actual.replaceAll('"equal-height-columns"','"lost-height-columns"'),actual.replace('density === "sections"','density === "lost-sections"'),actual.replace('md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]','xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]'),actual.replace('{children}','{null}')]){
    assert.notEqual(mutant,actual);assert.throws(()=>verify(mutant),"Default-off ratio, breakpoint, exact60/40 and native content are required");
  }
  const baselineIndex=process.argv.indexOf("--baseline-grid");
  if(baselineIndex!==-1){
    const baselinePath=resolve(ROOT,process.argv[baselineIndex+1]??"");assert.ok(baselinePath.startsWith(resolve(ROOT,".tmp-qa")+sep));
    const baselineSource=readFileSync(baselinePath,"utf8"),Baseline=load(extract(baselineSource)),Grid=load(actual),children=createElement("input",{name:"same-field",defaultValue:"same-value"});let comparisons=0,retainedRatioComparisons=0;
    for(const columns of [undefined,1,2,3,4,5,6,12] as const)for(const presentation of [undefined,"plain","control-cards","aligned-fields","equal-height-columns"] as const)for(const density of [undefined,"default","compact"] as const)for(const fieldContainers of [undefined,false,true]){
      const props={children,columns,presentation,density,fieldContainers};assert.equal(renderToStaticMarkup(Grid(props)),renderToStaticMarkup(Baseline(props)));comparisons++;if(presentation!=="equal-height-columns"||(columns!==undefined&&columns!==2)){const ratioProps={...props,columnRatio:"3:2" as const};assert.equal(renderToStaticMarkup(Grid(ratioProps)),renderToStaticMarkup(Baseline(ratioProps)));retainedRatioComparisons++;}
    }
    console.log("EVIDENCE "+JSON.stringify({scope:"settings-layout-refinement-grid-default-equivalence",comparisons,retainedRatioComparisons,baselineSha256:createHash("sha256").update(baselineSource).digest("hex"),currentSha256:createHash("sha256").update(runtimeSource).digest("hex")}));
  }
  return true;
}
check("shared Grid offers an explicit two-column60/40 ratio without changing defaults, native children or other columns",verifySettingsRatioGridPort());
check(
  "shared Admin form grids use the dense but comfortable 16px rhythm",
  (() => {
    const tree = ts.createSourceFile("AdminFormRuntime.tsx", runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === "AdminFormGrid");
    assert.ok(node);
    const verifySpacing = (source: string) => {
      const ownerExports: Partial<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")> = {};
      new Function("React", "exports", ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText)({ createElement }, ownerExports);
      assert.ok(ownerExports.AdminFormGrid);
      const Grid = ownerExports.AdminFormGrid;
      const children = [createElement("input", { key: "native", name: "same-field", defaultValue: "same-value" })];
      const normal = Grid({ children });
      assert.equal(normal.props.className, "grid min-w-0 gap-4 [&>*]:min-w-0 grid-cols-1 md:grid-cols-2");
      assert.equal(Grid({ children, density: "default" }).props.className, normal.props.className);
      const compact = Grid({ children, density: "compact" });
      assert.equal(compact.props.className, "grid min-w-0 gap-x-3 gap-y-2 [&>*]:min-w-0 grid-cols-1 md:grid-cols-2");
      assert.equal(compact.props["data-admin-form-grid"], normal.props["data-admin-form-grid"]);
      assert.equal(normal.props.children, children);
      assert.equal(compact.props.children, children, "The density opt-in preserves native fields and changes only outer spacing");
    };
    const actualSource = node.getText(tree);
    verifySpacing(actualSource);
    for (const mutant of [
      actualSource.replace('density = "default"', 'density = "compact"'),
      actualSource.replace('density === "compact"', 'density === "missing-compact"'),
      actualSource.replace("gap-x-3 gap-y-2", "gap-3"),
      actualSource.replace('"gap-4"', '"gap-5"'),
      actualSource.replace("{children}", "{null}"),
    ]) {
      assert.notEqual(mutant, actualSource);
      assert.throws(() => verifySpacing(mutant), "Default spacing, explicit compact gaps and original children are all required");
    }
    return true;
  })(),
);
check("Unified Layout defaults preserve natural flow, source order and explicit Grid delegation", await verifyUnifiedFormLayout());
check("Unified Section and Field defaults preserve metadata, labels and all native child contracts", await verifyUnifiedFormFields());
check("Unified Save and Close keep native pending, save-only and callback contracts", await verifyUnifiedFormActions());
const formRuntimeContract = read("src/lib/admin/form-runtime.ts");
const actionsSource = runtime.slice(
  runtime.indexOf("export function AdminFormActions"),
);
const createEditHandoffStart = runtime.indexOf(
  'if (state.mode === "create" && state.editHref)',
);
const createEditHandoffReplace = runtime.indexOf(
  "router.replace(editHref, { scroll: false })",
  createEditHandoffStart,
);
const createEditHandoffEnd = runtime.indexOf(
  "\n    const submittedBaseline =",
  createEditHandoffReplace,
);
const createEditHandoff = runtime.slice(
  createEditHandoffStart,
  createEditHandoffEnd,
);
const runtimeActionMarkers = [
  ...actionsSource.matchAll(/data-admin-form-action="([^"]+)"/g),
].map((match) => match[1]);
check(
  "shared action bar exposes exactly Save and Close",
  occurrenceCount(actionsSource, /<button\b/g) === 2 &&
    runtimeActionMarkers.length === 2 &&
    runtimeActionMarkers[0] === "save" &&
    runtimeActionMarkers[1] === "close",
);
check(
  "Close decision blocks pending, navigates clean, and confirms dirty forms",
  resolveAdminFormNavigationDecision({ pending: true, dirty: true }) ===
    "blocked_pending" &&
    resolveAdminFormNavigationDecision({ pending: false, dirty: false }) ===
      "navigate" &&
    resolveAdminFormNavigationDecision({ pending: false, dirty: true }) ===
      "confirm_discard",
);
check(
  "Form Runtime stays form-only and does not own Preview/Public capabilities",
  [runtime, formRuntimeContract].every(
    (source) =>
      !source.includes("AdminEntityPreview") &&
      !source.includes("internal-preview") &&
      !source.includes("public-view") &&
      !source.includes("previewCapability"),
  ) &&
    !actionsSource.includes("Preview") &&
    !actionsSource.includes("Public View") &&
    !actionsSource.includes("معاينة داخلية") &&
    !actionsSource.includes("النسخة العامة"),
);
check(
  "Form Runtime source exposes the pending, dirty-guard, feedback, and create-to-edit bindings without claiming mounted behavior",
  [
    "useActionState",
    "useAdminUnsavedChangesGuard",
    'window.addEventListener("beforeunload"',
    "publishFeedback",
    "state.editHref",
    "router.replace",
    "markClean(",
    "disabled={pending}",
    'aria-live="polite"',
  ].every((marker) => runtime.includes(marker)),
);
check(
  "create-to-edit source contract orders target validation, clean-state marking, callback, and replace",
  createEditHandoffStart >= 0 &&
    createEditHandoffReplace > createEditHandoffStart &&
    createEditHandoffEnd > createEditHandoffReplace &&
    runtime.includes("Boolean(state.editHref)") &&
    createEditHandoff.includes('resolveSafeInternalPath(state.editHref, "")') &&
    createEditHandoff.includes("markClean(submittedBaseline)") &&
    createEditHandoff.includes("onSuccess?.(state)") &&
    occurrenceCount(
      runtime,
      /router\.replace\(editHref, \{ scroll: false \}\)/g,
    ) === 1 &&
    createEditHandoff.indexOf("markClean(submittedBaseline)") <
      createEditHandoff.indexOf(
        "router.replace(editHref, { scroll: false })",
      ) &&
    createEditHandoff.indexOf("onSuccess?.(state)") <
      createEditHandoff.indexOf("router.replace(editHref, { scroll: false })"),
);
const formDomPreservation = read("src/lib/admin/form-dom-preservation.ts");
check(
  "shared runtime restores submitted DOM while successful RSC revisions stay server-owned",
  runtime.includes("captureAdminFormControls(form)") &&
    runtime.includes("restoreAdminFormControls(form, snapshot, {") &&
    runtime.includes("preserveServerOwned:") &&
    runtime.includes("useLayoutEffect(() =>") &&
    formDomPreservation.includes("form.elements") &&
    formDomPreservation.includes("serverOwnedNames") &&
    formDomPreservation.includes("!serverOwnedNames.has(name)") &&
    formDomPreservation.includes("entry.element.form !== form") &&
    formDomPreservation.includes(
      'hasAttribute("data-admin-form-server-owned")',
    ) &&
    contentEditorShell.includes('data-admin-form-server-owned=""') &&
    formDomPreservation.includes("new DataTransfer()"),
);
check(
  "Form Runtime source delegates pending field disabling to its shared fieldset boundary",
  /<fieldset\s+[\s\S]*?disabled=\{pending\}[\s\S]*?data-admin-form-fields=""[\s\S]*?>[\s\S]*?\{typeof children[\s\S]*?<\/fieldset>/.test(
    runtime,
  ),
);

const feedbackProvider = read("src/components/admin/AdminFeedbackProvider.tsx");
const adminNotice = read("src/components/admin/AdminNotice.tsx");
check(
  "pass-through feedback preserves pointer access for repair links and controls",
  feedbackProvider.includes("pointer-events-none") &&
    feedbackProvider.includes("[&_a]:pointer-events-auto") &&
    feedbackProvider.includes("[&_button]:pointer-events-auto") &&
    adminNotice.includes("href={action.href}"),
);

const markdownEditor = read(
  "src/components/admin/content/editors/article/TopicMarkdownEditor.tsx",
);
function verifyTopicFullDraftLifecycle(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "TopicFormDraftRecovery");
  assert.ok(owner?.body && owner.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword), "Full recovery extends the existing Topic draft owner");
  const callbacks = new Map<string, ts.ArrowFunction>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) callbacks.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  const bind = (name: string, bindings: Record<string, unknown>) => {
    const callback = callbacks.get(name);
    assert.ok(callback, `Missing actual draft lifecycle callback ${name}`);
    return new Function(...Object.keys(bindings), `${ts.transpileModule(`const callback = ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\nreturn callback;`)(...Object.values(bindings));
  };
  const signatureDeclaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "topicFormDraftSnapshotSignature");
  const groupDeclaration = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "groupTopicFormDraftCandidates");
  assert.ok(signatureDeclaration && groupDeclaration, "Existing draft owner groups full validated snapshot identities, not notice text");
  const topicFormDraftSnapshotSignature = new Function(`${ts.transpileModule(signatureDeclaration.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}\nreturn topicFormDraftSnapshotSignature;`)();
  const groupTopicFormDraftCandidates = new Function("topicFormDraftSnapshotSignature", `${ts.transpileModule(groupDeclaration.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}\nreturn groupTopicFormDraftCandidates;`)(topicFormDraftSnapshotSignature);
  for (const scenario of ["changed", "changed-with-pending-candidate", "equivalent-pending", "equivalent-adopted", "changed-baseline", "not-ready", "pending-save", "ended-session", "disposed", "unchanged"] as const) {
    const writes: Array<{ key: string; value: { fields: unknown; baselineFields: unknown } }> = [];
    const baseline = { title: ["Saved title"], slug: ["persisted-slug"] };
    const fields = scenario === "unchanged" ? baseline : { title: ["Unsaved title"], slug: ["manual-draft-"] };
    const scope = { actorId: 7, sessionVersion: 4, expiresAt: Date.now() + 60_000, contentType: "article" as const, entity: "42" };
    const other = createTopicFormDraft(scope, scenario === "changed-baseline" ? "another-server-revision" : "current-server-revision", "writer-B", scenario === "changed-with-pending-candidate" ? { title: ["Independent writer title"], slug: ["independent"] } : fields, undefined, baseline);
    const otherRaw = JSON.stringify(other), otherSnapshot = { key: "other-writer-key", raw: otherRaw, draft: other };
    const ownRawRef: { current: string | null } = { current: null };
    const persist = bind("persist", {
      disposed: scenario === "disposed", readyRef: { current: scenario !== "not-ready" },
      pendingRef: { current: scenario === "pending-save" }, expire: () => scenario === "ended-session",
      candidatesRef: { current: ["changed-with-pending-candidate", "equivalent-pending", "changed-baseline"].includes(scenario) ? [otherSnapshot] : [] },
      adoptedRef: { current: new Map(scenario === "equivalent-adopted" ? [[otherSnapshot.key, otherRaw]] : []) },
      topicFormDraftSnapshotSignature, parseTopicFormDraft,
      captureFields: () => ({ fields, excludedFields: [] }), form: {}, activeScope: scope,
      baselineFieldsRef: { current: baseline }, baselineRevisionRef: { current: "current-server-revision" },
      writerRef: { current: "writer-A" }, ownRawRef,
      setExcludedFields: () => {}, setUnavailable: () => {}, failStorage: () => { throw new Error("Unexpected storage failure"); },
      createTopicFormDraft: (actualScope: unknown, revision: string, writer: string, actualFields: unknown, _date: unknown, actualBaseline: unknown) => {
        assert.equal(actualScope, scope); assert.equal(revision, "current-server-revision"); assert.equal(writer, "writer-A");
        return createTopicFormDraft(scope, revision, writer, actualFields as Record<string, string[]>, undefined, actualBaseline as Record<string, string[]>);
      },
      getTopicFormDraftKey: () => "own-writer-key",
      window: { localStorage: { getItem: (key: string) => key === otherSnapshot.key ? otherRaw : null, setItem: (key: string, raw: string) => writes.push({ key, value: JSON.parse(raw) }) } },
    });
    persist();
    const shouldWrite = scenario === "changed" || scenario === "changed-with-pending-candidate" || scenario === "changed-baseline";
    assert.equal(writes.length, shouldWrite ? 1 : 0, `${scenario}: capture respects pending/ended boundaries and preserves edits while another candidate awaits a decision`);
    if (shouldWrite) { assert.equal(writes[0].key, "own-writer-key"); assert.deepEqual(writes[0].value.fields, fields); assert.deepEqual(writes[0].value.baselineFields, baseline); assert.ok(ownRawRef.current); }
    if (scenario === "equivalent-pending") {
      const peer = { key: "second-writer-key", raw: "exact-second-raw", draft: { ...other, writerId: "writer-C", savedAt: new Date(Date.now() + 1000).toISOString() } };
      const grouped = groupTopicFormDraftCandidates([otherSnapshot, peer]);
      assert.equal(grouped.length, 1); assert.deepEqual(grouped[0].aliases, [{ key: otherSnapshot.key, raw: otherRaw }, { key: peer.key, raw: peer.raw }]);
      for (const draft of [
        { ...peer.draft, fields: { ...peer.draft.fields, title: ["Different"] } },
        { ...peer.draft, baselineFields: { ...peer.draft.baselineFields, title: ["Different baseline"] } },
        { ...peer.draft, baselineRevision: "Different revision" },
        { ...peer.draft, scope: { ...scope, actorId: 8 } },
        { ...peer.draft, version: 99 }, { ...peer.draft, fieldVersion: 99 },
      ]) assert.equal(groupTopicFormDraftCandidates([otherSnapshot, { ...peer, draft }]).length, 2, "Distinct identity, version, baseline or content can never share a recovery decision");
    }
  }
  class DraftInputControl {
    disabled = false;
    name: string; value: string; type: string;
    constructor(name: string, value: string, type = "text") { this.name = name; this.value = value; this.type = type; }
  }
  class DraftTextareaControl {
    disabled = false;
    name: string; value: string;
    constructor(name: string, value: string) { this.name = name; this.value = value; }
  }
  for (const scenario of ["applied", "unprojected-date", "live-excluded-reference", "live-excluded-gallery", "live-file-blocked", "stale-candidate", "stale-alias", "pending-save", "expired"] as const) {
    const candidate = { key: "candidate-A", raw: "unchanged-original", aliases: scenario === "stale-alias" ? [{ key: "candidate-A", raw: "unchanged-original" }, { key: "candidate-B", raw: "unchanged-peer" }] : undefined, draft: { fields: { title: ["Local title"], published_at: ["2026-10-24"] } as Record<string, string[]>, baselineFields: { title: ["Saved title"], published_at: ["2026-10-23"] } as Record<string, string[]> } };
    const ignored = new Map(), adopted = new Map();
    const liveFields: Record<string, string[]> = scenario === "live-excluded-reference" ? { canonical_url: ["https://example.test/current?token=synthetic-private"] }
      : scenario === "live-excluded-gallery" ? { gallery_image_url: ["https://example.test/current?token=synthetic-private", "/live-second.jpg"], gallery_image_alt: ["Live first", "Live second"], gallery_image_caption: ["Current first caption", "Current second caption"] }
        : {};
    for (const name of Object.keys(liveFields)) { candidate.draft.fields[name] = ["Draft reference"]; candidate.draft.baselineFields[name] = ["Saved reference"]; }
    const projected: Record<string, string[]> = scenario === "unprojected-date" ? { title: ["Local title"] } : structuredClone(candidate.draft.fields);
    const controls = Object.entries(liveFields).flatMap(([name, values]) => values.map(value => new DraftInputControl(name, value)));
    if (scenario === "live-file-blocked") controls.push(new DraftInputControl("image", "", "file"));
    let restores = 0;
    let restoreBlocked = false;
    const restore = bind("restore", {
      runtime: { pending: scenario === "pending-save" }, expired: scenario === "expired",
      rootRef: { current: { closest: () => ({ elements: controls }) } },
      window: { localStorage: { getItem: (key: string) => scenario === "stale-candidate" || scenario === "stale-alias" && key === "candidate-B" ? "newer-raw" : candidate.raw } },
      setUnavailable: () => {}, captureFields: () => ({ fields: {}, excludedFields: scenario === "live-file-blocked" ? ["image"] : Object.keys(liveFields) }), scope: {}, choices: {},
      HTMLInputElement: DraftInputControl, HTMLTextAreaElement: DraftTextareaControl,
      mergeTopicFormDraftFields: () => ({ fields: projected, conflicts: [], retainedConflicts: [] }),
      ignoredRef: { current: ignored }, adoptedRef: { current: adopted }, candidatesRef: { current: [candidate] },
      setCandidates: () => {}, setRetainedConflict: () => {}, setRestored: () => {},
      setRestoreBlocked: (value: boolean) => { restoreBlocked = value; },
      onRestore: (fields: unknown) => { restores += 1; assert.equal(fields, projected); },
    });
    restore(candidate);
    const applied = ["applied", "unprojected-date", "live-excluded-reference", "live-excluded-gallery"].includes(scenario);
    assert.equal(restores, applied ? 1 : 0, `${scenario}: only an explicit current candidate can restore`);
    assert.equal(restoreBlocked, scenario === "live-file-blocked", "File inputs block remount without losing current native files or the candidate");
    if (applied) {
      assert.equal(ignored.has(candidate.key), scenario !== "applied", "A changed field that could not project must retain its original candidate");
      assert.equal(adopted.has(candidate.key), scenario === "applied", "Only fully applied candidates qualify for success cleanup");
      for (const [name, values] of Object.entries(liveFields)) assert.deepEqual(projected[name], values, "Excluded live references survive in memory, never in stored drafts");
    }
  }
  const baselineRevisionRef = { current: "old-server-revision" };
  const baselineFieldsRef = { current: { title: ["Old title"] } };
  const ownRawRef = { current: "own-raw" as string | null };
  const adopted = new Map([["adopted-key", "older-adopted-raw"]]);
  const retainedStorage = new Map([["own-key", "own-raw"], ["adopted-key", "newer-adopted-raw"], ["other-writer", "independent draft"]]);
  class SavedDraftEvent {
    detail: { savedRevision: string };
    constructor(detail: { savedRevision: string }) { this.detail = detail; }
  }
  const saved = bind("saved", {
    CustomEvent: SavedDraftEvent, baselineRevisionRef, baselineFieldsRef,
    window: { localStorage: retainedStorage }, activeScope: {}, writerRef: { current: "writer-A" }, ownRawRef,
    adoptedRef: { current: adopted },
    removeTopicFormDraftIfUnchanged: (storage: Map<string, string>, key: string, raw: string) => { if (storage.get(key) === raw) storage.delete(key); },
    getTopicFormDraftKey: () => "own-key", captureFields: () => ({ fields: { title: ["Accepted saved title"] }, excludedFields: [] }), form: {},
    setRestored: () => {}, failStorage: () => { throw new Error("Unexpected successful-save draft failure"); },
  });
  saved(new SavedDraftEvent({ savedRevision: "accepted-server-revision" }));
  assert.equal(baselineRevisionRef.current, "accepted-server-revision", "Accepted revision metadata updates before refreshed server props arrive");
  assert.deepEqual(baselineFieldsRef.current, { title: ["Accepted saved title"] });
  assert.equal(ownRawRef.current, null); assert.equal(adopted.size, 0);
  assert.deepEqual([...retainedStorage], [["adopted-key", "newer-adopted-raw"], ["other-writer", "independent draft"]], "Success never deletes a newer adopted source or independent writer");
}
check("Existing Topic draft lifecycle preserves independent unsaved edits, gates pending/expired sessions and retains changed fields that cannot project", (() => { verifyTopicFullDraftLifecycle(markdownEditor); return true; })());
for (const [before, after] of [
  ["!readyRef.current || pendingRef.current || expire()", "false"],
  ["pendingRef.current || expire()", "expire()"],
  ["pendingRef.current || expire()", "pendingRef.current"],
  ["pendingRef.current || expire()", "pendingRef.current || expire() || candidatesRef.current.length"],
  ["writerRef.current, captured.fields, undefined, baselineFieldsRef.current", "writerRef.current, baselineFieldsRef.current, undefined, baselineFieldsRef.current"],
  ["if (unapplied.length) ignoredRef.current.set", "if (false) ignoredRef.current.set"],
  ["window.localStorage.getItem(candidate.key) !== candidate.raw", "false"],
  ["merged.fields[name] = controls.map(element => element.value);", "merged.fields[name] = [];"],
  ['element.type === "file"', 'element.type === "never-file"'],
  ["baselineRevisionRef.current = event.detail.savedRevision;", "baselineRevisionRef.current = baselineRevisionRef.current;"],
] as const) {
  check(`Full Topic draft lifecycle rejects ${after}`, markdownEditor.includes(before) && (() => {
    let mutation = markdownEditor.replace(before, after);
    // Equivalent members also validate the representative. Removing only its
    // redundant check is harmless; the negative removes both exact-raw defenses.
    if (before === "window.localStorage.getItem(candidate.key) !== candidate.raw") mutation = mutation.replaceAll("window.localStorage.getItem(snapshot.key) !== snapshot.raw", "false");
    assert.throws(() => verifyTopicFullDraftLifecycle(mutation)); return true;
  })());
}
function verifyTopicFullDraftDiscard(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "TopicFormDraftRecovery");
  assert.ok(owner?.body);
  let discard: ts.ArrowFunction | undefined, opaqueFrame: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "discard" && node.initializer && ts.isArrowFunction(node.initializer)) discard = node.initializer;
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "data-topic-form-draft-opaque")) opaqueFrame = node;
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  assert.ok(discard && opaqueFrame);
  assert.equal(discard.parameters.length, 2);
  assert.ok(!discard.parameters[1].questionToken && !discard.parameters[1].initializer, "Every full-draft Discard requires the exact originally observed raw record");
  let click: ts.ArrowFunction | undefined;
  const findClick = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onClick" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isArrowFunction(node.initializer.expression)) click = node.initializer.expression;
    ts.forEachChild(node, findClick);
  };
  findClick(opaqueFrame);
  assert.ok(click && ts.isCallExpression(click.body) && ts.isIdentifier(click.body.expression) && click.body.expression.text === "discard" && click.body.arguments.length === 2, "The actual opaque prompt must pass both its observed key and raw snapshot");
  let map: ts.Node | undefined = opaqueFrame.parent;
  while (map && !(ts.isArrowFunction(map) && ts.isCallExpression(map.parent) && ts.isPropertyAccessExpression(map.parent.expression) && map.parent.expression.name.text === "map")) map = map.parent;
  assert.ok(map && ts.isArrowFunction(map));
  const parameter = map.parameters[0].name;
  const compile = (name: string, callback: ts.ArrowFunction, bindings: Record<string, unknown>) => new Function(...Object.keys(bindings), `${ts.transpileModule(`const ${name} = ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\nreturn ${name};`)(...Object.values(bindings));
  for (const scenario of ["opaque-unchanged", "opaque-newer", "opaque-missing", "valid-explicit-discard"] as const) {
    const key = "venesia-topic-editor-draft:topic:article:create", original = "observed opaque raw";
    const records = new Map([["admin-shell:proof:collapsed", "retained"]]);
    if (scenario !== "opaque-missing") records.set(key, scenario === "opaque-newer" ? "newer unseen raw" : original);
    let unavailable = false, lateReads = 0, removed = 0;
    let opaque = [{ key, raw: original }, { key: "unrelated-draft", raw: "unrelated raw" }];
    const candidatesRef = { current: [{ key, raw: original }, { key: "unrelated-candidate", raw: "unrelated candidate" }] };
    const actualDiscard = compile("discard", discard, {
      window: { localStorage: { getItem: (name: string) => { lateReads += 1; return records.get(name) ?? null; } } },
      removeTopicFormDraftIfUnchanged: (_storage: unknown, name: string, expected: string) => {
        assert.equal(expected, original, "A new value read at click time cannot replace the observed snapshot");
        if (records.get(name) !== expected) return false;
        removed += 1; records.delete(name); return true;
      },
      setUnavailable: (value: boolean) => { unavailable = value; }, candidatesRef,
      setCandidates: () => {}, setOpaqueDrafts: (update: (previous: typeof opaque) => typeof opaque) => { opaque = update(opaque); },
    });
    if (scenario === "valid-explicit-discard") actualDiscard(key, original);
    else {
      const bindings: Record<string, unknown> = { discard: actualDiscard };
      if (ts.isIdentifier(parameter)) bindings[parameter.text] = { key, raw: original };
      else if (ts.isObjectBindingPattern(parameter)) for (const element of parameter.elements) {
        const property = element.propertyName?.getText(tree) ?? element.name.getText(tree);
        bindings[element.name.getText(tree)] = property === "key" ? key : original;
      }
      else assert.fail("The opaque renderer must keep an observed snapshot binding");
      compile("click", click, bindings)();
    }
    const stale = scenario === "opaque-newer" || scenario === "opaque-missing";
    assert.equal(removed, stale ? 0 : 1, `${scenario}: only explicit Discard of the unchanged observed version can remove it`);
    assert.equal(unavailable, stale); assert.equal(lateReads, 0, "Discard never adopts raw bytes fetched after the prompt rendered");
    assert.equal(records.get("admin-shell:proof:collapsed"), "retained");
    if (scenario === "opaque-newer") assert.equal(records.get(key), "newer unseen raw");
    assert.equal(opaque.some(draft => draft.key === key), stale);
    assert.equal(candidatesRef.current.some(draft => draft.key === key), stale);
    assert.ok(opaque.some(draft => draft.key === "unrelated-draft"));
    assert.ok(candidatesRef.current.some(draft => draft.key === "unrelated-candidate"));
  }
}
check("Opaque and valid Topic Discard bind the observed raw snapshot, preserve unseen newer records and handle missing records without deleting other drafts", (() => { verifyTopicFullDraftDiscard(markdownEditor); return true; })());
function verifyTopicDraftNoticeDismissal(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "TopicFormDraftRecovery");
  assert.ok(owner?.body);
  const callbacks = new Map<string, ts.ArrowFunction>();
  let dismissed: ts.Expression | undefined, notice: ts.JsxOpeningElement | undefined, focus: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isArrowFunction(node.initializer)) callbacks.set(node.name.text, node.initializer);
      if (node.name.text === "dismissed") dismissed = node.initializer;
    }
    if (ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(tree) === "AdminNotice" && node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "onDismiss" && attribute.initializer?.getText(tree) === "{() => dismissNotice(candidate)}")) notice = node;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useLayoutEffect" && node.arguments[0] && ts.isArrowFunction(node.arguments[0]) && node.arguments[0].getText(tree).includes("focusPendingNoticeRef.current")) focus = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  assert.ok(notice && focus && dismissed);
  const attribute = (node: ts.JsxOpeningElement, name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer?.getText(tree);
  assert.equal(attribute(notice, "dismissSearchParams"), "{[]}");
  assert.equal(attribute(notice, "lifecycle"), '"manual"');
  assert.ok(notice.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "dismissible"));
  assert.equal(attribute(notice, "presentation"), '"compact"', "Draft uses the shared compact Notice row instead of a local row");
  assert.match(attribute(notice, "actionContent") ?? "", /<time[\s\S]*data-topic-form-draft-restore[\s\S]*data-topic-form-draft-discard/);
  const execute = (expression: ts.Expression, bindings: Record<string, unknown>) => new Function(...Object.keys(bindings), `${ts.transpileModule(`const actual = ${expression.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\nreturn actual;`)(...Object.values(bindings));
  const candidate = { key: "pending-A", raw: "exact observed draft raw", draft: { fields: { title: ["Local unsaved title"] } } };
  const candidatesRef = { current: [candidate] };
  const originalCandidates = candidatesRef.current;
  let dismissedNotices: Record<string, string> = { other: "other raw" };
  const setDismissedNotices = (update: Record<string, string> | ((previous: Record<string, string>) => Record<string, string>)) => { dismissedNotices = typeof update === "function" ? update(dismissedNotices) : update; };
  const forbidden = () => { throw new Error("Notice Close must never mutate drafts, fields or storage"); };
  const dismiss = callbacks.get("dismissNotice");
  assert.ok(dismiss);
  execute(dismiss, { setDismissedNotices, candidatesRef, candidate, window: { localStorage: new Proxy({}, { get: forbidden }) }, onRestore: forbidden, discard: forbidden, setCandidates: forbidden })(candidate);
  assert.deepEqual(dismissedNotices, { other: "other raw", "pending-A": candidate.raw });
  assert.equal(candidatesRef.current, originalCandidates, "Close preserves unresolved choice candidates");
  assert.equal(execute(dismissed, { dismissedNotices, candidate }), true);
  assert.equal(execute(dismissed, { dismissedNotices, candidate: { ...candidate, raw: "new unseen snapshot" } }), false, "Closing an older snapshot never hides a newer record with the same key");
  const equivalentCandidate = { ...candidate, aliases: [{ key: candidate.key, raw: candidate.raw }, { key: "pending-B", raw: "peer raw" }] };
  execute(dismiss, { setDismissedNotices, candidatesRef, candidate: equivalentCandidate, window: { localStorage: new Proxy({}, { get: forbidden }) }, onRestore: forbidden, discard: forbidden, setCandidates: forbidden })(equivalentCandidate);
  assert.equal((dismissedNotices as Record<string, string>)["pending-B"], "peer raw", "Close marks every exact equivalent member without touching storage");
  assert.equal(execute(dismissed, { dismissedNotices, candidate: equivalentCandidate }), true);
  assert.equal(execute(dismissed, { dismissedNotices, candidate: { ...equivalentCandidate, aliases: [equivalentCandidate.aliases[0], { key: "pending-B", raw: "new peer raw" }] } }), false, "A changed peer must reappear even when its representative raw is unchanged");
  const block = callbacks.get("blockUnresolved");
  assert.ok(block);
  const focusPendingNoticeRef = { current: false };
  const events: string[] = [], focused: unknown[] = [];
  const event = { preventDefault: () => events.push("prevent"), stopPropagation: () => events.push("stop"), stopImmediatePropagation: () => events.push("stop-immediate") };
  execute(block, { candidatesRef, focusPendingNoticeRef, setDismissedNotices, rootRef: new Proxy({}, { get: forbidden }) })(event);
  assert.deepEqual(events, ["prevent", "stop", "stop-immediate"], "Dismissal must not bypass the unresolved-choice save gate");
  assert.deepEqual(dismissedNotices, {}, "Save reopens the closed prompt without making a Restore/Discard decision");
  assert.equal(focusPendingNoticeRef.current, true);
  assert.equal(candidatesRef.current, originalCandidates);
  execute(focus, { focusPendingNoticeRef, rootRef: { current: { querySelector: (selector: string) => { assert.equal(selector, "[data-topic-form-draft-restore]"); return { closest: (target: string) => { assert.equal(target, "[data-topic-form-draft]"); return { scrollIntoView: (options: unknown) => focused.push(options) }; }, focus: (options: unknown) => focused.push(options) }; } } } })();
  assert.equal(focusPendingNoticeRef.current, false);
  assert.deepEqual(focused, [{ block: "center", behavior: "smooth" }, { preventScroll: true }], "Only the actual layout effect focuses Restore after the prompt commits");
  events.length = 0; candidatesRef.current = []; focusPendingNoticeRef.current = false; dismissedNotices = { "pending-A": candidate.raw };
  execute(block, { candidatesRef, focusPendingNoticeRef, setDismissedNotices, rootRef: new Proxy({}, { get: forbidden }) })(event);
  assert.deepEqual(events, []); assert.deepEqual(dismissedNotices, { "pending-A": candidate.raw });
  const endSession = callbacks.get("endSession");
  assert.ok(endSession);
  execute(endSession, { readyRef: { current: true }, sessionEnded: false, window: { localStorage: { setItem: () => {} } }, getTopicDraftSessionEndKey: () => "session-ended", activeScope: {}, disposed: false, setExpired: () => {}, setCandidates: () => {}, candidatesRef, setDismissedNotices, failStorage: forbidden })();
  assert.deepEqual(dismissedNotices, {}, "Known session end releases UI-only raw identity as well as pending candidates");
}
check("Actual full-form Draft Close hides only the exact prompt, protects pending choice and reopens/focuses Restore after Save without storage or field mutation", (() => { verifyTopicDraftNoticeDismissal(markdownEditor); return true; })());
function verifyAllDraftNoticePresentations(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owners = tree.statements.filter((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && ["TopicFormDraftRecovery", "AdminPublicRichContentEditor"].includes(node.name?.text ?? ""));
  assert.equal(owners.length, 2);
  const notices: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  let opaque: ts.JsxElement | undefined;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "AdminNotice") notices.push(node);
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === "data-topic-form-draft-opaque")) opaque = node;
    ts.forEachChild(node, visit);
  };
  for (const owner of owners) visit(owner);
  assert.ok(notices.length && opaque);
  const attribute = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) => node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(tree) === name)?.initializer?.getText(tree);
  for (const notice of notices) {
    assert.equal(attribute(notice, "presentation"), '"compact"', "Every current full-form and Markdown recovery state uses the canonical compact row");
    assert.equal(attribute(notice, "lifecycle"), '"manual"');
    assert.equal(attribute(notice, "dismissSearchParams"), "{[]}", "Draft Close never modifies unrelated notice query parameters");
    assert.ok(notice.attributes.properties.some(property => ts.isJsxAttribute(property) && property.name.getText(tree) === "dismissible"));
  }
  assert.ok(!opaque.getText(tree).includes("<AdminCard"), "Opaque legacy/unsupported records use the same notice owner");
  assert.match(opaque.getText(tree), /dismissedNotices\[key\] === raw \? null : <AdminNotice/u);
  assert.match(opaque.getText(tree), /onDismiss=\{\(\) => dismissNotice\(\{ key, raw \}\)\}/u);
  assert.ok(!opaque.getText(tree).includes("data-topic-form-draft-restore") && !opaque.getText(tree).includes("<pre"), "Unsupported records neither expose content nor gain Restore");
  const fullOwner = owners.find(owner => owner.name?.text === "TopicFormDraftRecovery")!;
  let dismiss: ts.ArrowFunction | undefined;
  const findDismiss = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "dismissNotice" && node.initializer && ts.isArrowFunction(node.initializer)) dismiss = node.initializer;
    ts.forEachChild(node, findDismiss);
  };
  findDismiss(fullOwner);
  assert.ok(dismiss);
  let dismissedNotices: Record<string, string> = {};
  const snapshot = { key: "opaque-key" as const, raw: "untrusted-unsupported-raw" };
  const forbidden = () => { throw new Error("Opaque Close must never adopt, restore, remove or expose its draft"); };
  const bindings = {
    setDismissedNotices: (update: (previous: Record<string, string>) => Record<string, string>) => { dismissedNotices = update(dismissedNotices); },
    window: { localStorage: new Proxy({}, { get: forbidden }) }, onRestore: forbidden, discard: forbidden,
    setOpaqueDrafts: forbidden, setCandidates: forbidden, candidatesRef: new Proxy({}, { get: forbidden }),
  };
  const compiled = ts.transpileModule(`const dismissNotice = ${dismiss.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function(...Object.keys(bindings), `${compiled}\nreturn dismissNotice;`)(...Object.values(bindings))(snapshot);
  assert.deepEqual(dismissedNotices, { "opaque-key": snapshot.raw });
  assert.equal(dismissedNotices[snapshot.key] === snapshot.raw, true);
  assert.equal(dismissedNotices[snapshot.key] === "newer unseen raw", false, "Newer raw is never hidden by an older visual dismissal");
}
check("Every current Draft notice including opaque/unsupported and Markdown states opts into the shared compact owner; opaque Close changes visual state only", (() => { verifyAllDraftNoticePresentations(markdownEditor); return true; })());
for (const [label, from, to] of [
  ["one state keeps stacked layout", 'presentation="compact"', 'presentation="default"'],
  ["one state clears unrelated query feedback", 'dismissSearchParams={[]}', 'dismissSearchParams={["notice"]}'],
  ["opaque Close hides newer raw", "dismissedNotices[key] === raw ? null", "Boolean(dismissedNotices[key]) ? null"],
  ["opaque Close discards", "onDismiss={() => dismissNotice({ key, raw })}", "onDismiss={() => discard(key, raw)}"],
  ["opaque gains restore", 'data-topic-form-draft-opaque=""', 'data-topic-form-draft-opaque="" data-topic-form-draft-restore=""'],
] as const) {
  assert.ok(markdownEditor.includes(from), `All-state Draft mutation changes actual source: ${label}`);
  assert.throws(() => verifyAllDraftNoticePresentations(markdownEditor.replace(from, to)));
  check(`All-state Draft notice rejects ${label}`, true);
}
function verifyMarkdownPendingNoticeClose(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminPublicRichContentEditor");
  assert.ok(owner?.body);
  let dismiss: ts.ArrowFunction | undefined, block: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "onDismiss" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isArrowFunction(node.initializer.expression) && node.initializer.expression.getText(tree).includes("setDismissedPendingNotices")) dismiss = node.initializer.expression;
    if (ts.isFunctionDeclaration(node) && node.name?.text === "blockUnresolvedDraftSubmit") block = node;
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  assert.ok(dismiss && block);
  const execute = (declaration: string, bindings: Record<string, unknown>, result: string) => new Function(...Object.keys(bindings), `${ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText}\nreturn ${result};`)(...Object.values(bindings));
  const pendingDraft = { content: "Legacy unsaved Markdown", legacy: true, baselineRevision: null };
  const pendingDraftRef = { current: pendingDraft as typeof pendingDraft | null };
  const focusPendingDraftNoticeRef = { current: false };
  let dismissedPendingNotices: Record<string, typeof pendingDraft> = {};
  const setDismissedPendingNotices = (update: Record<string, typeof pendingDraft> | ((previous: Record<string, typeof pendingDraft>) => Record<string, typeof pendingDraft>)) => { dismissedPendingNotices = typeof update === "function" ? update(dismissedPendingNotices) : update; };
  const forbidden = () => { throw new Error("Markdown Close only hides its notice, retaining readOnly and unresolved save protection"); };
  execute(`const actual = ${dismiss.getText(tree)};`, {
    setDismissedPendingNotices, draftIdentity: "legacy-article", pendingDraft, pendingDraftRef,
    window: { localStorage: new Proxy({}, { get: forbidden }) }, commitContent: forbidden,
    restorePendingDraft: forbidden, discardPendingDraft: forbidden, setPendingDraft: forbidden,
  }, "actual")();
  assert.equal(dismissedPendingNotices["legacy-article"], pendingDraft);
  assert.equal(pendingDraftRef.current, pendingDraft);
  const events: string[] = [];
  const actualBlock = execute(block.getText(tree), { pendingDraftRef, focusPendingDraftNoticeRef, setDismissedPendingNotices, sectionRef: new Proxy({}, { get: forbidden }) }, "blockUnresolvedDraftSubmit");
  actualBlock({ preventDefault: () => events.push("prevent"), stopPropagation: () => events.push("stop"), stopImmediatePropagation: () => events.push("stop-immediate") });
  assert.deepEqual(events, ["prevent", "stop", "stop-immediate"]);
  assert.deepEqual(dismissedPendingNotices, {}); assert.equal(focusPendingDraftNoticeRef.current, true);
  assert.equal(pendingDraftRef.current, pendingDraft);
  pendingDraftRef.current = null; events.length = 0; focusPendingDraftNoticeRef.current = false;
  actualBlock({ preventDefault: () => events.push("prevent"), stopPropagation: () => events.push("stop"), stopImmediatePropagation: () => events.push("stop-immediate") });
  assert.deepEqual(events, []); assert.equal(focusPendingDraftNoticeRef.current, false);
  assert.ok(owner.getText(tree).includes("readOnly={Boolean(pendingDraft)}"), "Hiding the prompt cannot unlock the unresolved editor");
}
check("Actual legacy Markdown Close retains the pending snapshot and readOnly state; existing submit gate reveals it without Restore/Discard", (() => { verifyMarkdownPendingNoticeClose(markdownEditor); return true; })());
for (const [label, from, to] of [
  ["legacy Close clears pending", "onDismiss={() => setDismissedPendingNotices(previous => ({ ...previous, [draftIdentity]: pendingDraft }))}", "onDismiss={() => { setDismissedPendingNotices(previous => ({ ...previous, [draftIdentity]: pendingDraft })); pendingDraftRef.current = null; }}"],
  ["legacy Close removes storage", "onDismiss={() => setDismissedPendingNotices(previous => ({ ...previous, [draftIdentity]: pendingDraft }))}", "onDismiss={() => { setDismissedPendingNotices(previous => ({ ...previous, [draftIdentity]: pendingDraft })); window.localStorage.clear(); }}"],
  ["legacy Save skips pending protection", "function blockUnresolvedDraftSubmit(event: SubmitEvent) {", "function blockUnresolvedDraftSubmit(event: SubmitEvent) { return;"],
  ["legacy Save does not reveal prompt", "      setDismissedPendingNotices({});", ""],
  ["hidden legacy editor becomes writable", "readOnly={Boolean(pendingDraft)}", "readOnly={false}"],
] as const) {
  assert.ok(markdownEditor.includes(from), `Markdown notice mutation changes actual source: ${label}`);
  assert.throws(() => verifyMarkdownPendingNoticeClose(markdownEditor.replace(from, to)));
  check(`Markdown Draft notice rejects ${label}`, true);
}
for (const [label, from, to] of [
  ["close restores implicitly", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw }));", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw })); onRestore(candidate.draft.fields);"],
  ["close discards implicitly", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw }));", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw })); discard(candidate.key, candidate.raw);"],
  ["close clears candidate gate", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw }));", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw })); candidatesRef.current = [];"],
  ["close deletes storage", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw }));", "setDismissedNotices(previous => ({ ...previous, [candidate.key]: candidate.raw })); window.localStorage.clear();"],
  ["newer raw hidden", "dismissedNotices[candidate.key] === candidate.raw", "Boolean(dismissedNotices[candidate.key])"],
  ["closed prompt not revealed by Save", "      setDismissedNotices({});", ""],
  ["unresolved Save allowed", "if (!candidatesRef.current.length) return;", "return;"],
  ["focus before prompt commit", "      focusPendingNoticeRef.current = true;", '      rootRef.current?.querySelector("[data-topic-form-draft-restore]")?.focus(); focusPendingNoticeRef.current = true;'],
  ["session keeps dismissed raw", "candidatesRef.current = []; setDismissedNotices({});", "candidatesRef.current = [];"],
] as const) {
  assert.ok(markdownEditor.includes(from), `Draft notice negative must mutate current source: ${label}`);
  let mutation = markdownEditor.replace(from, to);
  if (label === "newer raw hidden") mutation = mutation.replaceAll("dismissedNotices[snapshot.key] === snapshot.raw", "Boolean(dismissedNotices[snapshot.key])");
  assert.throws(() => verifyTopicDraftNoticeDismissal(mutation));
  check(`Draft notice dismissal rejects ${label}`, true);
}
for (const [before, after] of [
  ["expectedRaw: string", "expectedRaw?: string"],
  ["removeTopicFormDraftIfUnchanged(window.localStorage, key, expectedRaw)", 'removeTopicFormDraftIfUnchanged(window.localStorage, key, window.localStorage.getItem(key) ?? "")'],
  ["onClick={() => discard(key, raw)}", "onClick={() => discard(key)}"],
] as const) {
  check(`Topic Discard rejects ${after}`, markdownEditor.includes(before) && (() => { assert.throws(() => verifyTopicFullDraftDiscard(markdownEditor.replace(before, after))); return true; })());
}
check(
  "successful shared saves clear the Topic local draft through one runtime event",
  runtime.includes('new CustomEvent("admin-form-saved"') &&
    markdownEditor.includes(
      'form.addEventListener("admin-form-saved", clearSavedDraft)',
    ) &&
    markdownEditor.includes(
      'form.removeEventListener("admin-form-saved", clearSavedDraft)',
    ) &&
    markdownEditor.includes(
      "window.localStorage.removeItem(draftKeyRef.current)",
    ),
);

const publishingOptions = read(
  "src/components/admin/content/editors/ContentPublishingOptions.tsx",
);
check(
  "Form feedback uses the required provider, publishes initial route errors, and keeps the newest channel visible",
  runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("clearFormFeedback") &&
    runtime.includes("onNavigate: clearFormFeedback") &&
    articleCreate.includes("createAdminFormErrorState") &&
    articleEdit.includes("createAdminFormErrorState") &&
    feedbackProvider.includes("data-admin-feedback-channel") &&
    feedbackProvider.includes("[...globalEntries].reverse().map") &&
    feedbackProvider.includes("inlineEntries.map"),
);
check(
  "Topic publication is an optional field capability inside the shared save",
  [
    'name="is_featured"',
    'name="is_popular"',
    'name="status"',
    "TopicDateLabelField",
  ].every((marker) => publishingOptions.includes(marker)) &&
    !publishingOptions.includes("SaveBar"),
);
const articleSaveHelpers = read(
  "src/app/admin/content/topics/article-actions/helpers.ts",
);
function verifyTopicDraftDateTimeOwner(source: string) {
  const tree = ts.createSourceFile("TopicMarkdownEditor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const canonicalImport = tree.statements.find((node): node is ts.ImportDeclaration =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../../../lib/content-dates");
  assert.ok(canonicalImport?.importClause?.namedBindings && ts.isNamedImports(canonicalImport.importClause.namedBindings));
  const imports = canonicalImport.importClause.namedBindings.elements;
  assert.ok(["ADMIN_TIME_ZONE", "formatAdminDateTime"].every(name => imports.some(element => element.name.text === name && (!element.propertyName || element.propertyName.text === name))), "Draft timestamp consumes the actual shared date/time owner");
  const times: ts.JsxElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "time") times.push(node);
    ts.forEachChild(node, visit);
  };
  tree.forEachChild(visit);
  assert.equal(times.length, 1, "The current draft timestamp has one presentation owner");
  const time = times[0];
  const compiled = ts.transpileModule(`const renderTime = (candidate) => (${time.getText(tree)});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const calls: unknown[] = [];
  const renderTime = new Function("React", "formatAdminDateTime", "ADMIN_TIME_ZONE", `${compiled}\nreturn renderTime;`)(
    { createElement },
    (value: string | null | undefined, precision?: "date" | "date-time") => { calls.push(value); return formatAdminDateTime(value, precision); },
    ADMIN_TIME_ZONE,
  ) as (candidate: { draft: { savedAt: string | null | undefined } }) => ReactNode;
  const cases = [
    ["2026-11-30T22:00:00.000Z", "\u206601/12/2026, 12:00 AM\u2069"],
    ["2026-04-23T21:30:00.000Z", "\u206623/04/2026, 11:30 PM\u2069"],
    ["2026-04-23T22:30:00.000Z", "\u206624/04/2026, 01:30 AM\u2069"],
    ["2026-12-01T02:53:00.000+02:00", "\u206601/12/2026, 02:53 AM\u2069"],
    ["invalid", "—"], ["", "—"], [null, "—"], [undefined, "—"],
  ] as const;
  for (const [savedAt, expected] of cases) {
    const candidate = { draft: { savedAt } };
    const original = { ...candidate.draft };
    const element = renderTime(candidate);
    assert.ok(isValidElement<{ dateTime?: string | null; title: string; children: ReactNode }>(element));
    assert.equal(element.type, "time");
    assert.equal(element.props.dateTime, savedAt, "The raw stored timestamp is unchanged");
    assert.equal(element.props.children, expected, "Actual JSX uses fixed Cairo, bidi-isolated shared display and invalid fallback");
    assert.equal(element.props.title, `التوقيت: ${ADMIN_TIME_ZONE}`, "Timezone copy follows the existing owner token");
    assert.deepEqual(candidate.draft, original, "Date presentation cannot mutate a draft");
  }
  assert.deepEqual(calls, cases.map(([savedAt]) => savedAt), "Every render delegates its unmodified instant exactly once");
}
check("Actual Draft notice time delegates to the canonical Cairo display owner without mutating raw timestamps or recovery data", (() => { verifyTopicDraftDateTimeOwner(markdownEditor); return true; })());
for (const [label, changed] of [
  ["browser-local date formatting", markdownEditor.replace("formatAdminDateTime(candidate.draft.savedAt)", 'new Date(candidate.draft.savedAt).toLocaleString("ar-EG")')],
  ["date-only timestamp truncation", markdownEditor.replace("formatAdminDateTime(candidate.draft.savedAt)", 'formatAdminDateTime(candidate.draft.savedAt, "date")')],
  ["raw timestamp replacement", markdownEditor.replace("dateTime={candidate.draft.savedAt}", 'dateTime={"2026-01-01T00:00:00.000Z"}')],
  ["timezone identity drift", markdownEditor.replace("${ADMIN_TIME_ZONE}", "UTC")],
] as const) {
  assert.notEqual(changed, markdownEditor, `Draft date negative must mutate current source: ${label}`);
  assert.throws(() => verifyTopicDraftDateTimeOwner(changed));
  check(`Draft timestamp owner rejects ${label}`, true);
}
check(
  "Shared Date and Time owner fixes Admin presentation without changing the stored instant",
  ADMIN_DATE_TIME_PATTERN === "DD/MM/YYYY, hh:mm AM/PM" &&
    ADMIN_DATE_ONLY_PATTERN === "DD MMM YYYY" &&
    ADMIN_TIME_ZONE === "Africa/Cairo" &&
    formatAdminDateTime("2026-08-06T23:24:00.000Z") ===
      "\u206607/08/2026, 02:24 AM\u2069" &&
    formatAdminDateTime("2026-08-07") === "07 Aug 2026" &&
    formatAdminDateOnly("2026-08-07") === "07 Aug 2026" &&
    formatAdminDateOnly("2026-02-30") === "—",
);
check(
  "Admin timestamps keep numeric Latin presentation across Cairo midnight, noon, offsets, DST, and leap day",
  [
    ["2026-12-01T00:53:00.000Z", "01/12/2026, 02:53 AM"],
    ["2026-12-01T12:53:00.000Z", "01/12/2026, 02:53 PM"],
    ["2026-11-30T22:00:00.000Z", "01/12/2026, 12:00 AM"],
    ["2026-12-01T10:00:00.000Z", "01/12/2026, 12:00 PM"],
    ["2026-12-31T23:05:00.000Z", "01/01/2027, 01:05 AM"],
    ["2026-12-01T02:53:00.000+02:00", "01/12/2026, 02:53 AM"],
    ["2026-04-23T21:30:00.000Z", "23/04/2026, 11:30 PM"],
    ["2026-04-23T22:30:00.000Z", "24/04/2026, 01:30 AM"],
    ["2024-02-29T09:05:00.000Z", "29/02/2024, 11:05 AM"],
  ].every(([value, expected]) => {
    const actual = formatAdminDateTime(value);
    return actual === `\u2066${expected}\u2069` &&
      actual.slice(1, -1) === expected &&
      /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}, [0-9]{2}:[0-9]{2} (AM|PM)$/.test(actual.slice(1, -1));
  }),
);
check(
  "Admin date rendering keeps empty and invalid sentinels plus the independent date-only contract",
  [undefined, null, "", "   ", "invalid", "2026-13-01T00:00:00.000Z"].every(
    (value) => formatAdminDateTime(value) === "—",
  ) &&
    formatAdminDateTime("2026-02-30") === "—" &&
    formatAdminDateTime("2024-02-29") === "29 Feb 2024" &&
    formatAdminDateOnly("2026-12-01") === "01 Dec 2026" &&
    formatAdminDateOnly("2026-12-01T00:53:00.000Z") === "—",
);
check(
  "Admin timestamp serializer restores only its exact display envelope to the original export format",
  serializeAdminDateTimeDisplay("\u206601/12/2026, 02:53 PM\u2069") === "01 Dec 2026, 02:53 PM" &&
    serializeAdminDateTimeDisplay("عربي \"سطر\"\n\u206601/12/2026, 02:53 PM\u2069 · نهاية") === "عربي \"سطر\"\n01 Dec 2026, 02:53 PM · نهاية" &&
    [
      "01/12/2026, 02:53 PM", "—", "01 Dec 2026",
      "\u2066نص آخر\u2069", "\u2067اتجاه عربي\u2069", "\u200EABC\u200F",
      "\u206601/12/2026, 25:53 PM\u2069", "\u206601/12/2026, 02:53 pm\u2069",
      "\u206601/12/2026, 02:53 PM", "01/12/2026, 02:53 PM\u2069",
    ].every((value) => serializeAdminDateTimeDisplay(value) === value),
);
check(
  "Admin timestamp serialization preserves the original English month tokens without converting the displayed day or time",
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"].every((month, index) =>
    serializeAdminDateTimeDisplay(`\u206602/${String(index + 1).padStart(2, "0")}/2026, 12:00 AM\u2069`) === `02 ${month} 2026, 12:00 AM`,
  ),
);
const compactAdminDateCases = [
  ["2026-08-06T23:24:00.000Z", "07/08/2026"],
  ["2026-12-01T00:53:00.000Z", "01/12/2026"],
  ["2026-11-30T22:00:00.000Z", "01/12/2026"],
  ["2026-12-01T10:00:00.000Z", "01/12/2026"],
  ["2026-12-31T23:05:00.000Z", "01/01/2027"],
  ["2026-12-01T02:53:00.000+02:00", "01/12/2026"],
  ["2026-04-23T21:30:00.000Z", "23/04/2026"],
  ["2026-04-23T22:30:00.000Z", "24/04/2026"],
  ["2024-02-29T09:05:00.000Z", "29/02/2024"],
] as const;
check(
  "Compact Admin timestamp precision uses the same Cairo day across midnight, noon, offsets, DST, leap day and year boundaries",
  compactAdminDateCases.every(([value, expected]) => formatAdminDateTime(value, "date") === `\u2066${expected}\u2069`),
);
check(
  "Compact timestamp precision preserves invalid/empty sentinels and the independent date-only route",
  [undefined, null, "", "   ", "invalid", "2026-13-01T00:00:00.000Z", "2026-02-30"].every((value) => formatAdminDateTime(value, "date") === "—") &&
    formatAdminDateTime("2026-08-07", "date") === "07 Aug 2026" &&
    formatAdminDateTime("2024-02-29", "date") === "29 Feb 2024" &&
    formatAdminDateTime("2026-12-01", "date") === formatAdminDateOnly("2026-12-01"),
);
const datePrecisionInputs: (string | null | undefined)[] = [
  ...compactAdminDateCases.map(([value]) => value), undefined, null, "", "   ", "invalid",
  "2026-13-01T00:00:00.000Z", "2026-02-30", "2024-02-29", "2026-12-01",
  "2026-12-01T12:53:00", "0001-12-01T12:53:00.000Z", "+010000-12-01T12:53:00.000Z",
];
check(
  "Explicit full timestamp precision equals the unchanged default for every boundary input",
  datePrecisionInputs.every((value) => formatAdminDateTime(value, "date-time") === formatAdminDateTime(value)),
);
const datePrecisionBaselineArgument = process.argv.find((argument) => argument.startsWith("--date-precision-baseline-file="));
if (datePrecisionBaselineArgument) {
  const baselinePath = resolve(ROOT, datePrecisionBaselineArgument.slice("--date-precision-baseline-file=".length));
  const baseline: { entries: { path: string; sha256: string }[] } = JSON.parse(readFileSync(baselinePath, "utf8").replace(/^\uFEFF/u, ""));
  const ownerPath = "src/lib/content-dates.ts";
  const ownerSnapshot = resolve(dirname(baselinePath), "baseline", ownerPath);
  const ownerBytes = readFileSync(ownerSnapshot);
  assert.equal(createHash("sha256").update(ownerBytes).digest("hex"), baseline.entries.find((entry) => entry.path === ownerPath)?.sha256);
  const previousDates = await jiti.import<typeof import("../src/lib/content-dates.ts")>(ownerSnapshot);
  const previousTree = ts.createSourceFile(ownerPath, ownerBytes.toString("utf8"), ts.ScriptTarget.Latest, true);
  const currentTree = ts.createSourceFile(ownerPath, read(ownerPath), ts.ScriptTarget.Latest, true);
  const serializerBody = (tree: ts.SourceFile) => tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "serializeAdminDateTimeDisplay")?.body?.getText(tree);
  const formatterBinding = (tree: ts.SourceFile) => tree.statements.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []).find((node) => node.name.getText(tree) === "ADMIN_DATE_TIME_FORMATTER")?.getText(tree);
  check(
    "Captured full timestamp output and serializer/Intl owners remain exact after compact precision opt-in",
    datePrecisionInputs.every((value) => formatAdminDateTime(value) === previousDates.formatAdminDateTime(value)) &&
      serializerBody(currentTree) === serializerBody(previousTree) &&
      formatterBinding(currentTree) === formatterBinding(previousTree),
  );
}
const publicationForm = new FormData();
publicationForm.set("published_at", "2026-08-15");
const submittedPublicationDate = parseFormPublishedDate(publicationForm);
const firstPublishedAt = resolveTopicPublishedAt({
  formPublishedDate: submittedPublicationDate,
  currentPublishedAt: null,
  status: "published",
  nowIso: "2026-08-15T08:00:00.000Z",
});
check(
  "submitted first-publication date persists and survives unpublish or republish",
  articleSaveHelpers.includes(
    "publishedAt: parseFormPublishedDate(formData)",
  ) &&
    articleSaveHelpers.includes("published_at: resolveTopicPublishedAt({") &&
    publishingOptions.includes("disabled={Boolean(publishedAt)}") &&
    submittedPublicationDate === "2026-08-15" &&
    firstPublishedAt === "2026-08-15T12:00:00.000Z" &&
    resolveTopicPublishedAt({
      formPublishedDate: "2026-09-01",
      currentPublishedAt: firstPublishedAt,
      status: "published",
      nowIso: "2026-09-01T08:00:00.000Z",
    }) === firstPublishedAt &&
    resolveTopicPublishedAt({
      formPublishedDate: submittedPublicationDate,
      currentPublishedAt: firstPublishedAt,
      status: "unpublished",
      nowIso: "2026-09-01T08:00:00.000Z",
    }) === firstPublishedAt &&
    resolveTopicPublishedAt({
      formPublishedDate: submittedPublicationDate,
      currentPublishedAt: null,
      status: "unpublished",
      nowIso: "2026-08-15T08:00:00.000Z",
    }) === null,
);
check(
  "Topic PublishingOptions cannot reintroduce local Preview/Public ownership",
  [
    'from "next/link"',
    "AdminEntityPreviewActions",
    "AdminEntityPreviewCapability",
    "buildAdminContentPreviewCapability",
    "resolveAdminEntityPreviewActions",
    "previewCapability",
    "internal-preview",
    "public-view",
    "topicId",
    "previewLinkClassName",
    "data-topic-preview-links",
    "/admin/content/topics/${",
    "/topics/${",
    "معاينة داخلية",
    "النسخة العامة",
  ].every((marker) => !publishingOptions.includes(marker)) &&
    !/<(?:Link|a)\b/.test(publishingOptions) &&
    !/\bhref\s*=/.test(publishingOptions) &&
    !/\bslug\b/.test(publishingOptions),
);

const entityPreviewContract = read(
  "src/lib/admin/interaction-system/entity-preview-capability.ts",
);
const contentPreviewCapability = read(
  "src/lib/admin/content/entity-preview-capabilities.ts",
);
const entityPreviewActions = read(
  "src/components/admin/ui/AdminEntityPreviewActions.tsx",
);
check(
  "shared Preview/Public contract owns safe resolution and publication visibility",
  entityPreviewContract.includes("AdminEntityPreviewCapability") &&
    entityPreviewContract.includes("resolveAdminEntityPreviewActions") &&
    entityPreviewContract.includes("resolveSafeInternalPath") &&
    entityPreviewContract.includes(
      'capability.publicationStatus === "published"',
    ),
);
const unpublishedPreviewActions = resolveAdminEntityPreviewActions({
  entityType: "topic",
  entityId: 42,
  publicationStatus: "unpublished",
  routes: {
    internalPreview: "/admin/content/topics/42/preview",
    publicView: "/topics/reference-topic",
  },
  access: {
    "internal-preview": "allowed",
    "public-view": "allowed",
  },
});
const publishedPreviewActions = resolveAdminEntityPreviewActions({
  entityType: "topic",
  entityId: 42,
  publicationStatus: "published",
  routes: {
    internalPreview: "/admin/content/topics/42/preview",
    publicView: "/topics/reference-topic",
  },
  access: {
    "internal-preview": "disabled",
    "public-view": "allowed",
  },
});
check(
  "shared Preview/Public resolver behavior rejects unsafe or invalid declarations",
  resolveAdminEntityPreviewActions({
    entityType: "topic",
    entityId: 0,
    publicationStatus: "published",
    routes: {
      internalPreview: "/admin/content/topics/0/preview",
      publicView: "/topics/invalid",
    },
    access: {
      "internal-preview": "allowed",
      "public-view": "allowed",
    },
  }).length === 0 &&
    resolveAdminEntityPreviewActions({
      entityType: "topic",
      entityId: 42,
      publicationStatus: "published",
      routes: {
        internalPreview: "//example.com/preview",
        publicView: "https://example.com/topics/reference-topic",
      },
      access: {
        "internal-preview": "allowed",
        "public-view": "allowed",
      },
    }).length === 0,
);
check(
  "shared Preview/Public resolver behavior owns publication visibility and disabled state",
  unpublishedPreviewActions.length === 1 &&
    unpublishedPreviewActions[0]?.kind === "internal-preview" &&
    unpublishedPreviewActions[0]?.disabled === false &&
    publishedPreviewActions.length === 2 &&
    publishedPreviewActions[0]?.kind === "internal-preview" &&
    publishedPreviewActions[0]?.disabled === true &&
    publishedPreviewActions[1]?.kind === "public-view" &&
    publishedPreviewActions[1]?.disabled === false,
);
check(
  "content Preview/Public adapter uses canonical route builders",
  contentPreviewCapability.includes("buildAdminContentPreviewCapability") &&
    contentPreviewCapability.includes("adminContentTopicPreviewPath") &&
    contentPreviewCapability.includes("resolvePublicContentPath") &&
    !contentPreviewCapability.includes("AdminFormRuntime"),
);
const resolvedContentCapability = buildAdminContentPreviewCapability({
  entityType: "topic",
  id: 42,
  contentType: "article",
  slug: "reference-topic",
  publicationStatus: "published",
});
check(
  "content Preview/Public adapter behavior delegates to canonical route builders",
  resolvedContentCapability.routes.internalPreview ===
    adminContentTopicPreviewPath(42) &&
    resolvedContentCapability.routes.publicView ===
      resolvePublicContentPath("article", "reference-topic"),
);
const resolvedCategoryCapability =
  buildAdminCategoryCollectionPreviewCapability({
    id: 7,
    slug: "reference-category",
    isActive: true,
  });
const resolvedSeriesCapability = buildAdminSeriesCollectionPreviewCapability({
  id: 9,
});
const hiddenCategoryActions = resolveAdminEntityPreviewActions(
  buildAdminCategoryCollectionPreviewCapability({
    id: 8,
    slug: "hidden-category",
    isActive: false,
  }),
);
check(
  "taxonomy collection Preview/Public adapters declare only proven routes",
  resolvedCategoryCapability.routes.internalPreview === null &&
    resolvedCategoryCapability.routes.publicView ===
      "/topics?category=reference-category" &&
    resolvedSeriesCapability.routes.internalPreview ===
      "/admin/content/topics?series=9" &&
    resolvedSeriesCapability.routes.publicView === null &&
    hiddenCategoryActions.length === 1 &&
    hiddenCategoryActions[0]?.kind === "public-view" &&
    hiddenCategoryActions[0]?.href === "/topics?category=hidden-category",
);
check(
  "shared Preview/Public renderer owns labels, new-tab safety, and action presentation",
  entityPreviewActions.includes("resolveAdminEntityPreviewActions") &&
    entityPreviewActions.includes("data-admin-entity-preview-actions") &&
    entityPreviewActions.includes('target="_blank"') &&
    entityPreviewActions.includes('rel="noopener noreferrer"') &&
    entityPreviewActions.includes("معاينة داخلية") &&
    entityPreviewActions.includes("النسخة العامة") &&
    !entityPreviewActions.includes("AdminFormRuntime"),
);
const topicPreviewActionIndex = articleEdit.indexOf(
  "<AdminEntityPreviewActions",
);
const topicFormRuntimeIndex = articleEdit.indexOf("<ContentEditorShell");
check(
  "Topic Article mounts the shared Preview/Public adopter outside Form Runtime",
  articleEdit.includes("buildAdminContentPreviewCapability") &&
    articleEdit.includes("const previewCapability") &&
    articleEdit.includes(
      "<AdminEntityPreviewActions capability={previewCapability} />",
    ) &&
    occurrenceCount(articleEdit, /<AdminEntityPreviewActions\b/g) === 1 &&
    topicPreviewActionIndex >= 0 &&
    topicPreviewActionIndex < topicFormRuntimeIndex &&
    occurrenceCount(articleEdit, /<ContentEditorShell\b/g) === 1,
);

const mediaEditPage = read("src/app/admin/content/topics/[id]/page.tsx");
type MediaPreviewInput = Parameters<typeof buildAdminContentPreviewCapability>[0];
function mediaHeaderPreviewInput(source: string) {
  const tree = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const adopters: ts.JsxSelfClosingElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === "AdminEntityPreviewActions") adopters.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (adopters.length !== 1) return null;
  const capability = adopters[0]!.attributes.properties.find((node): node is ts.JsxAttribute => ts.isJsxAttribute(node) && node.name.getText(tree) === "capability")?.initializer;
  if (!capability || !ts.isJsxExpression(capability) || !capability.expression || !ts.isCallExpression(capability.expression)) return null;
  const call = capability.expression;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "buildAdminContentPreviewCapability" || call.arguments.length !== 1 || !ts.isObjectLiteralExpression(call.arguments[0]!)) return null;
  const argument = call.arguments[0]!;
  const actions = argument.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(tree) === "allowedActions")?.initializer;
  if (!actions || !ts.isArrayLiteralExpression(actions) || actions.elements.some((node) => !ts.isStringLiteral(node)) || actions.elements.map((node) => (node as ts.StringLiteral).text).join(",") !== "internal-preview,public-view") return null;
  return new Function("topic", "contentType", `return (${argument.getText(tree)});`) as (
    topic: { id: number; slug: string | null; status: string },
    contentType: MediaPreviewInput["contentType"],
  ) => MediaPreviewInput;
}
const readMediaPreviewInput = mediaHeaderPreviewInput(mediaEditPage);
check(
  "Media Edit explicitly adopts the same Preview/Public declaration outside its form without adding Create actions",
  readMediaPreviewInput &&
    mediaEditPage.includes('from "../../../../../lib/admin/content/entity-preview-capabilities"') &&
    mediaEditPage.indexOf("<AdminEntityPreviewActions") < mediaEditPage.indexOf("<MediaContentForm") &&
    !read("src/app/admin/content/topics/new/page.tsx").includes("AdminEntityPreviewActions") &&
    articleEdit.includes('allowedActions: ["internal-preview", "public-view"]'),
);
check(
  "Media Preview/Public declaration rejects internal-only, hardcoded navigation, duplicate actions, and omitted shared capability",
  !mediaHeaderPreviewInput(mediaEditPage.replace('["internal-preview", "public-view"]', '["internal-preview"]')) &&
    !mediaHeaderPreviewInput(mediaEditPage.replace("buildAdminContentPreviewCapability({", "parallelPreviewCapability({")) &&
    !mediaHeaderPreviewInput(mediaEditPage.replace("<AdminEntityPreviewActions", '<AdminEntityPreviewActions capability={{}} /><AdminEntityPreviewActions')) &&
    !mediaHeaderPreviewInput(mediaEditPage.replace(/capability=\{buildAdminContentPreviewCapability\(\{[\s\S]*?\}\)\}/, 'capability={{ entityType: "topic", entityId: 42, routes: { publicView: "/media-center/videos/hardcoded" }, access: { "public-view": "allowed" } }}')),
);
for (const contentType of MEDIA_EDITABLE_CONTENT_TYPES) {
  for (const [label, topic, expectedKinds] of [
    ["published", { id: 42, slug: "reference-media", status: "published" }, ["internal-preview", "public-view"]],
    ["draft", { id: 42, slug: "reference-media", status: "unpublished" }, ["internal-preview"]],
    ["missing public route", { id: 42, slug: null, status: "published" }, ["internal-preview"]],
    ["blank public route", { id: 42, slug: "   ", status: "published" }, ["internal-preview"]],
    ["unsaved", { id: 0, slug: "reference-media", status: "published" }, []],
  ] as const) {
    const capability = buildAdminContentPreviewCapability(readMediaPreviewInput!(topic, contentType));
    const actions = resolveAdminEntityPreviewActions(capability);
    assert.deepEqual(actions.map((action) => action.kind), expectedKinds, `${contentType}: ${label}`);
    assert.equal(capability.entityType, "topic");
    if (expectedKinds.some((kind) => kind === "internal-preview")) assert.equal(actions[0]?.href, adminContentTopicPreviewPath(topic.id));
    if (expectedKinds.some((kind) => kind === "public-view")) assert.equal(actions[1]?.href, resolvePublicContentPath(contentType, topic.slug!));
  }
  check(`${contentType} actual Media header declaration preserves published, draft, missing-route and unsaved eligibility`, true);
}

const categoryRowActions = read(
  "src/app/admin/content/categories/CategoryRowActions.tsx",
);
const seriesColumns = read("src/app/admin/content/series/series-columns.tsx");
const categoryListClient = read(
  "src/app/admin/content/categories/CategoriesListClient.tsx",
);
const seriesTableClient = read(
  "src/app/admin/content/series/SeriesTableClient.tsx",
);
check(
  "Category and Series collection Preview/Public actions resolve through the shared capability before Row Actions presentation",
  categoryRowActions.includes("AdminDataGridRowActions") &&
    categoryRowActions.includes(
      "buildAdminCategoryCollectionPreviewCapability",
    ) &&
    seriesColumns.includes("AdminDataGridRowActions") &&
    seriesColumns.includes("buildAdminSeriesCollectionPreviewCapability") &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes("resolveAdminEntityPreviewActions") &&
        !source.includes("previewHref") &&
        !source.includes("topicsPreviewHref"),
    ),
);
check(
  "Category and Series collections consume action-scoped pending and shared feedback",
  [categoryListClient, seriesTableClient].every(
    (source) =>
      source.includes("rowInteraction: instant.getRowInteraction") &&
      !source.includes("instant.rowPending") &&
      !source.includes("instant.bulkPending") &&
      !source.includes("router.refresh"),
  ) &&
    !read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "AdminFeedbackChannelViewport",
    ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      "publishFeedback(nextFeedback",
    ) &&
    read("src/components/admin/entity-list/AdminEntityList.tsx").includes(
      'placement: "global"',
    ),
);

const unifiedActionPath =
  "src/app/admin/content/topics/article-actions/save.ts";
const unifiedAction = read(unifiedActionPath);
const articleCreateDomain = read(
  "src/app/admin/content/topics/article-actions/create-domain.ts",
);
const preflightIndex = unifiedAction.indexOf(
  "const publishErrors = validateTopicFields(",
);
const uploadIndex = unifiedAction.indexOf("await uploadTopicImage(");
const createDelegateIndex = unifiedAction.indexOf(
  "await createArticleDomainRecord({",
);
const updateIndex = unifiedAction.indexOf(".update({");
check(
  "Topic Article has one unified create/edit action owner",
  existsSync(absolutePath(unifiedActionPath)) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/create.ts"),
    ) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/update.ts"),
    ) &&
    !existsSync(
      absolutePath("src/app/admin/content/topics/article-actions/status.ts"),
    ) &&
    unifiedAction.includes("export async function saveArticleContentAdapter") &&
    read("src/app/admin/content/topics/editor-actions/save.ts").includes(
      "export async function saveContentForm",
    ),
);
check(
  "publish preflight runs before Storage and database writes",
  preflightIndex >= 0 &&
    uploadIndex > preflightIndex &&
    createDelegateIndex > uploadIndex &&
    articleCreateDomain.includes(".insert({") &&
    updateIndex > uploadIndex,
);
check(
  "unified Topic save returns structured state without redirecting",
  unifiedAction.includes("AdminFormActionState") &&
    unifiedAction.includes("editHref:") &&
    unifiedAction.includes("fieldErrors") &&
    !unifiedAction.includes("redirect("),
);
check(
  "Topic Create alone receives the safe shared-runtime Edit handoff target",
  /\.\.\.\(mode === "create"\s*\?\s*\{\s*editHref: `\/admin\/content\/topics\/\$\{entityId\}`\s*\}\s*:\s*\{\}\s*\)/.test(
    unifiedAction,
  ) &&
    occurrenceCount(unifiedAction, /editHref:/g) === 1 &&
    articleCreate.includes('mode="create"') &&
    articleEdit.includes('mode="edit"') &&
    !articleCreate.includes("router.replace") &&
    !articleEdit.includes("router.replace"),
);
check(
  "obsolete Topic SaveBar and Previous button components are removed",
  !existsSync(absolutePath("src/components/admin/SaveBar.tsx")) &&
    !existsSync(
      absolutePath(
        "src/components/admin/content/editors/article/TopicPreviousTabButton.tsx",
      ),
    ),
);

const actualConfirmDebt = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
]
  .filter((sourceFile) =>
    readFileSync(sourceFile, "utf8").includes("window.confirm"),
  )
  .map((sourceFile) => normalizePath(relative(ROOT, sourceFile)))
  .sort();
const declaredConfirmDebt = [...ADMIN_FORM_CONFIRM_DEBT].sort();
check(
  "native confirm debt outside the reference scope stays explicit",
  actualConfirmDebt.length === declaredConfirmDebt.length &&
    declaredConfirmDebt.every(
      (sourceFile, index) => sourceFile === actualConfirmDebt[index],
    ),
);

for (const listPath of ["/admin/content/categories", "/admin/content/series", "/admin/projects/residential", "/admin/projects/commercial"]) {
  const original = `${listPath}?page=3&limit=30&q=${encodeURIComponent("اختبار")}&sort=name_desc`;
  const editPath = listPath.includes("/projects/") ? "/admin/projects/42" : `${listPath}/42`;
  const editHref = adminFormEditHref(editPath, original, listPath);
  const carried = new URL(editHref, "http://internal.invalid").searchParams.get("return_to");
  check(`edit return preserves the complete query for ${listPath}`, carried === original && resolveAdminFormReturnPath(carried, listPath) === original);
  check(`default list links retain their original destination for ${listPath}`, adminFormEditHref(editPath, listPath, listPath) === editPath);
  for (const unsafe of ["https://example.com/", "//example.com/", "/\\example.com/", "/admin/users-roles?page=3", `${listPath}/42?page=3`, `${listPath}-other?page=3`, "/admin/projects/../users-roles", `${listPath}\n?x=1`]) {
    check(`form return rejects a foreign or unsafe destination (${listPath}, ${JSON.stringify(unsafe)})`, resolveAdminFormReturnPath(unsafe, listPath) === listPath);
  }
  check(`form return rejects duplicate query values for ${listPath}`, resolveAdminFormReturnPath([original, original], listPath) === listPath);
}
check("form edit helper cannot create an external editor destination", adminFormEditHref("//example.com/editor", "/admin/content/categories?q=1", "/admin/content/categories") === "");
for (const file of ["src/app/admin/content/categories/CategoriesListClient.tsx", "src/app/admin/content/series/SeriesTableClient.tsx", "src/app/admin/projects/ProjectsTableClient.tsx"]) {
  const source = read(file);
  check(`return query delegates to the canonical writer in ${file}`, source.includes("writeAdminEntityListQuery(") && source.includes("currentListPath"));
}
for (const file of ["src/app/admin/content/categories/[id]/page.tsx", "src/app/admin/content/series/[id]/page.tsx", "src/app/admin/projects/[id]/page.tsx"]) {
  const source = read(file);
  check(`edit route validates and passes the Form close destination in ${file}`, source.includes("resolveAdminFormReturnPath(") && source.includes("closeHref={closeHref}"));
}

console.log(`verify:admin-form-system passed (${passed} assertions)`);

async function verifyUnifiedFormActions() {
const { headers } = await unifiedPresentationDependencies();
const adminFormPresentation = read("src/components/admin/ui/AdminForm.tsx"), runtime = read("src/components/admin/ui/AdminFormRuntime.tsx");

    const functionSource = (source: string, name: string) => {
      const tree = ts.createSourceFile("FormOwner.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const node = tree.statements.find((entry): entry is ts.FunctionDeclaration => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
      assert.ok(node);
      return node.getText(tree);
    };
    const compile = (source: string) => ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const runtimeTree = ts.createSourceFile("AdminFormRuntime.tsx", runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const actionClass = runtimeTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
      .find(node => node.name.getText(runtimeTree) === "actionButtonClassName");
    assert.ok(actionClass?.initializer && ts.isStringLiteral(actionClass.initializer));
    const actionClassValue = actionClass.initializer.text;
    const icon = createElement("svg", { "data-original-save-icon": "", "aria-hidden": true });
    const requestClose = () => undefined;
    const verifyActions = (presentationSource: string, runtimeSource: string) => {
      const formExports: Partial<typeof import("../src/components/admin/ui/AdminForm.tsx")> = {};
      new Function("React", "exports", "AdminFormControlHeader", "AdminModuleTabIcon", compile(functionSource(presentationSource, "AdminStickyFormBar")))({ createElement, Fragment }, formExports, headers.AdminFormControlHeader, headers.AdminModuleTabIcon);
      assert.ok(formExports.AdminStickyFormBar);
      for (const pending of [false, true]) {
        const actionExports: Partial<typeof import("../src/components/admin/ui/AdminFormRuntime.tsx")> = {};
        let context: { pending: boolean; requestClose: () => undefined } | null = { pending, requestClose };
        new Function("React", "exports", "useOptionalAdminFormRuntime", "AdminStickyFormBar", "actionButtonClassName", "AdminModuleTabIcon", compile(functionSource(runtimeSource, "AdminFormActions")))({ createElement, Fragment }, actionExports, () => context, formExports.AdminStickyFormBar, actionClassValue, headers.AdminModuleTabIcon);
        assert.ok(actionExports.AdminFormActions);
        const Actions = actionExports.AdminFormActions;
        for (const description of [undefined, null, "Original save description"]) {
          const props = { title: "Original save title", description, submitLabel: "Original save", pendingLabel: "Original pending", closeLabel: "Original close", className: "existing-bar" };
          const original = Actions(props);
          const accented = Actions({ ...props, icon });
          assert.equal(accented.props.icon, icon, "The original optional icon is forwarded without cloning or replacement");
          const controls = Children.toArray(accented.props.children);
          assert.equal(controls.length, 3, "Only the two native actions and existing live status are mounted");
          const saveOnly = Actions({ ...props, icon, showClose: false });
          const saveOnlyControls = Children.toArray(saveOnly.props.children);
          assert.equal(saveOnlyControls.length, 2, "The explicit Save-only port mounts one native Save and the existing live status");
          assert.ok(isValidElement<{ type: string; disabled: boolean; "data-admin-form-action": string }>(saveOnlyControls[0]));
          assert.equal(saveOnlyControls[0].props.type, "submit");
          assert.equal(saveOnlyControls[0].props.disabled, pending);
          assert.equal(saveOnlyControls[0].props["data-admin-form-action"], "save");
          assert.equal(renderToStaticMarkup(saveOnly).includes('data-admin-form-action="close"'), false, "Media Save-only cannot acquire a new Close command");
          const contextual = Actions({ ...props, pending: !pending });
          assert.equal(Children.toArray(contextual.props.children).map(node => renderToStaticMarkup(node)).join(""), controls.map(node => renderToStaticMarkup(node)).join(""), "The mounted Form Runtime remains pending authority when the optional native port is supplied");
          context = null;
          const nativeOnly = Actions({ ...props, icon, showClose: false, pending });
          assert.equal(nativeOnly.type, formExports.AdminStickyFormBar, "Specialized native forms use the exact shared Sticky Bar without a fabricated Runtime");
          assert.equal(renderToStaticMarkup(nativeOnly), renderToStaticMarkup(saveOnly), "Explicit native pending renders byte-equivalent Save-only controls and icon for false and true states");
          assert.throws(() => Actions({ ...props, showClose: false }), /must provide pending state/u);
          assert.throws(() => Actions({ ...props, pending }), /save-only contract/u);
          context = { pending, requestClose };
          const native = controls.slice(0, 2);
          for (const [index, node] of native.entries()) {
            assert.ok(isValidElement<{ type: string; disabled: boolean; onClick?: () => void; children?: ReactNode; "data-admin-form-action": string }>(node));
            assert.equal(node.type, "button");
            assert.equal(node.props.type, index === 0 ? "submit" : "button");
            assert.equal(node.props.disabled, pending);
            assert.equal(node.props["data-admin-form-action"], index === 0 ? "save" : "close");
            assert.equal(node.props.children, index === 0 ? pending ? props.pendingLabel : props.submitLabel : props.closeLabel);
            if (index === 1) assert.equal(node.props.onClick, requestClose, "Close still delegates to the exact runtime callback");
          }
          const status = controls[2];
          assert.ok(isValidElement<{ role: string; "aria-live": string; children?: ReactNode }>(status));
          assert.equal(status.props.role, "status");
          assert.equal(status.props["aria-live"], "polite");
          assert.equal(status.props.children, pending ? props.pendingLabel : "");
          assert.deepEqual(Children.toArray(original.props.children).map(node => renderToStaticMarkup(node)), controls.map(node => renderToStaticMarkup(node)), "Optional presentation leaves native action and status DOM byte-equivalent");
          const normal = renderToStaticMarkup(original);
          const markup = renderToStaticMarkup(accented);
          assert.ok(normal.includes("data-admin-form-control-header"));
          assert.ok(normal.includes("Original save title"));
          assert.ok(markup.includes('data-admin-form-control-presentation="leading-icon"'));
          assert.equal((markup.match(/data-original-save-icon/g) ?? []).length, 1);
          assert.equal(markup.includes('class="text-xs leading-5 text-white/55">Original save description</span>'), Boolean(description));
          assert.equal(markup.match(/<button\b/g)?.length, 2);
        }
      }
    };
    verifyActions(adminFormPresentation, runtime);
    const mutations: [string, string][] = [
      [adminFormPresentation, runtime.replace("showClose = true", "showClose = false")],
      [adminFormPresentation, runtime.replace("{showClose ? (", "{true ? (")],
      [adminFormPresentation, runtime.replace("externalPending === undefined || showClose", "false")],
      [adminFormPresentation, runtime.replace("icon={icon}", "icon={undefined}")],
      [adminFormPresentation.replace('presentation="leading-icon"', 'presentation="default"'), runtime],
      [adminFormPresentation.replace(functionSource(adminFormPresentation, "AdminStickyFormBar"), functionSource(adminFormPresentation, "AdminStickyFormBar").replace("{children}", "{null}")), runtime],
      [adminFormPresentation, runtime.replace('type="submit"', 'type="button"')],
      [adminFormPresentation, runtime.replaceAll("disabled={pending}", "disabled={false}")],
      [adminFormPresentation, runtime.replace("onClick={requestClose}", "onClick={undefined}")],
      [adminFormPresentation, runtime.replace('aria-live="polite"', 'aria-live="off"')],
    ];
    for (const [index, [presentationSource, runtimeSource]] of mutations.entries()) {
      assert.ok(presentationSource !== adminFormPresentation || runtimeSource !== runtime);
      assert.throws(() => verifyActions(presentationSource, runtimeSource), `Save icon negative ${index + 1} rejects lost owner forwarding or changed native interaction semantics`);
    }
    return true;
}
