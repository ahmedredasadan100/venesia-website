import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createJiti } from "jiti";
import { Fragment, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST, type AdminFormAdoptionEntry, type AdminFormPresentationRequirement } from "../src/lib/admin/form-system/adoption-manifest.ts";

import {
  slugifyFromTitle,
  validateSlugFormat,
} from "../src/lib/admin/slug.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME, adminFormFieldClassName, adminFormHintClassName, adminFormLabelClassName } =
  await createJiti(import.meta.url).import<typeof import("../src/lib/admin/admin-ui-styles.ts")>("../src/lib/admin/admin-ui-styles.ts");
const formPresentationOwner = ts.createSourceFile("AdminForm.tsx", read("src/components/admin/ui/AdminForm.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const stackTokenDeclaration = formPresentationOwner.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => ts.isIdentifier(node.name) && node.name.text === "ADMIN_FORM_STACK_CLASS_NAME");
assert.ok(stackTokenDeclaration?.initializer && ts.isStringLiteral(stackTokenDeclaration.initializer), "The canonical stack token remains an explicit shared owner value");
const ADMIN_FORM_STACK_CLASS_NAME = stackTokenDeclaration.initializer.text;

type Check = {
  section: string;
  label: string;
  ok: boolean;
  detail?: string;
};

const checks: Check[] = [];

function read(path: string) {
  const absolutePath = resolve(ROOT, path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function check(
  section: string,
  label: string,
  condition: unknown,
  detail?: string,
) {
  const ok = Boolean(condition);
  checks.push({ section, label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${section}] ${label}${detail ? `: ${detail}` : ""}`);
}

function occurrenceCount(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

function exportedFunctionSlice(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

// Bind the published timestamp to the actual status action result, not its
// local variable spelling, and only inside the live visibility adapter.
function categoryMutationCarriesPublishedAt(source: string): boolean {
  const file = ts.createSourceFile("CategoriesListClient.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = <T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] => {
    const found: T[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
    visit(root);
    return found;
  };
  const property = (object: ts.ObjectLiteralExpression, name: string) => object.properties.find(
    (node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === name,
  );
  const adapters = matches(file, ts.isVariableDeclaration).filter(node => ts.isIdentifier(node.name) && node.name.text === "toggleStatus");
  const initializer = adapters.length === 1 ? adapters[0].initializer : undefined;
  if (!initializer || !ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression) ||
      initializer.expression.text !== "useCallback" || !initializer.arguments[0] || !ts.isArrowFunction(initializer.arguments[0])) return false;
  const mutations = matches(initializer.arguments[0], ts.isCallExpression).filter(node => ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "instant" && node.expression.name.text === "mutateAsync");
  const options = mutations.length === 1 ? mutations[0].arguments[0] : undefined;
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const execute = property(options, "execute")?.initializer;
  if (!execute || !ts.isArrowFunction(execute) || !ts.isBlock(execute.body)) return false;
  const bindings = execute.body.statements.flatMap(statement => ts.isVariableStatement(statement) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 ? [...statement.declarationList.declarations] : []).filter(node =>
    ts.isIdentifier(node.name) && node.initializer && ts.isAwaitExpression(node.initializer) &&
    ts.isCallExpression(node.initializer.expression) && ts.isIdentifier(node.initializer.expression.expression) &&
    node.initializer.expression.expression.text === "toggleCategoryStatusAjax");
  if (bindings.length !== 1 || !ts.isIdentifier(bindings[0].name)) return false;
  const binding = bindings[0].name.text;
  return execute.body.statements.some(statement => {
    if (!ts.isReturnStatement(statement) || !statement.expression || !ts.isObjectLiteralExpression(statement.expression) ||
        statement.getStart(file) <= bindings[0].getStart(file)) return false;
    let ok = property(statement.expression, "ok")?.initializer;
    while (ok && ts.isAsExpression(ok)) ok = ok.expression;
    const timestamp = property(statement.expression, "publishedAt")?.initializer;
    return ok?.kind === ts.SyntaxKind.TrueKeyword && Boolean(timestamp && ts.isPropertyAccessExpression(timestamp) &&
      ts.isIdentifier(timestamp.expression) && timestamp.expression.text === binding && timestamp.name.text === "publishedAt");
  });
}

// The published column delegates presentation to the canonical grid owner;
// only the stored timestamp may cross that boundary, without a date fallback.
function categoryPublicationUsesSharedDateCell(source: string): boolean {
  const file = ts.createSourceFile("categories-columns.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = file.statements.filter(ts.isImportDeclaration).filter(node =>
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "../../../../components/admin/ui/AdminDataGrid" && !node.importClause?.isTypeOnly);
  const bindings = imports.flatMap(node => node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
    ? node.importClause.namedBindings.elements.filter(item => !item.isTypeOnly && (item.propertyName ?? item.name).text === "AdminDataGridDateTimeCell") : []);
  if (bindings.length !== 1) return false;
  const binding = bindings[0].name.text;
  let columns = 0, valid = false;
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const property = (name: string) => node.properties.find((item): item is ts.PropertyAssignment =>
        ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)?.initializer;
      const key = property("key"), render = property("renderCell");
      if (key && ts.isStringLiteral(key) && key.text === "published_at") {
        columns += 1;
        const parameter = render && ts.isArrowFunction(render) && render.parameters.length === 1 ? render.parameters[0].name : undefined;
        const rowBinding = parameter && ts.isObjectBindingPattern(parameter) && parameter.elements.length === 1 &&
          ts.isIdentifier(parameter.elements[0].name) && parameter.elements[0].name.text === "row" &&
          !parameter.elements[0].propertyName && !parameter.elements[0].initializer && !parameter.elements[0].dotDotDotToken;
        let body = rowBinding && render && ts.isArrowFunction(render) ? render.body : undefined;
        while (body && ts.isParenthesizedExpression(body)) body = body.expression;
        if (body && ts.isJsxSelfClosingElement(body) && ts.isIdentifier(body.tagName) && body.tagName.text === binding) {
          const attributes = body.attributes.properties;
          const values = attributes.filter((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText(file) === "value");
          const value = values.length === 1 && values[0].initializer;
          const fallback = attributes.find(item => ts.isJsxAttribute(item) && item.name.getText(file) === "fallback");
          valid = !attributes.some(ts.isJsxSpreadAttribute) && !fallback && Boolean(value && ts.isJsxExpression(value) && value.expression &&
            ts.isPropertyAccessExpression(value.expression) && ts.isIdentifier(value.expression.expression) &&
            value.expression.expression.text === "row" && value.expression.name.text === "published_at");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return columns === 1 && valid;
}

// The existing manifest owns applicability. Execute the actual consumer function
// for every declared surface, then verify each required role against its owner.
// Import markers are controlled boundaries only; no Action or hook is executed.
type TaxonomyPresentationContract = NonNullable<AdminFormAdoptionEntry["presentationContract"]>;
type TaxonomyElement = ReactElement<Record<string, unknown>>;
function taxonomyFormUsesCompletePanel(source: string, entity: "category" | "series", contract: TaxonomyPresentationContract, surfaces: readonly string[], failures?: string[]): boolean {
  try {
    const file = ts.createSourceFile(`${entity}Form.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const consumer = file.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) &&
      node.name?.text === (entity === "category" ? "CategoryForm" : "SeriesForm"));
    assert.ok(consumer && contract.requirements.length > 0);
    const modules: Record<string, readonly string[]> = {
      "../../../../components/admin/ui": ["AdminFormSection", "AdminFormField", "AdminSlugField", "ADMIN_FORM_STACK_CLASS_NAME", "adminFormFieldClassName"],
      "../../../../components/admin/ui/AdminFormRuntime": ["AdminFormRuntime", "AdminFormActions", "AdminFormError", "AdminFormGrid"],
      "../../../../components/admin/ui/AdminModuleTabs": ["AdminModuleSectionHeader", "AdminModuleTabIcon"],
      "../../../../components/admin/ui/AdminFormSwitch": ["AdminFormSwitch"],
      "../../../../components/admin/ui/AdminFormListboxSelect": ["AdminFormListboxSelect"],
      "../../../../components/admin/content/CategoryColorPicker": ["CategoryColorPicker"],
      "../../../../lib/admin/admin-ui-styles": ["ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "adminFormHintClassName", "adminFormLabelClassName"],
      "../TaxonomyExpectedRevisionInput": ["TaxonomyExpectedRevisionInput"],
      "../taxonomy-form-actions": ["createCategoryForm", "updateCategoryForm", "createSeriesForm", "updateSeriesForm"],
    };
    const helpers: Record<string, unknown> = { ADMIN_FORM_STACK_CLASS_NAME, ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
      adminFormFieldClassName, adminFormHintClassName, adminFormLabelClassName };
    const markers: Record<string, (props: Record<string, unknown>) => null> = {};
    const locals: Record<string, unknown> = {};
    const imported = new Set<string>();
    let stackClassBinding: string | undefined;
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
      const ownerModule = statement.moduleSpecifier.text, clause = statement.importClause;
      const imports: Array<[string, string]> = [];
      if (clause?.name) imports.push([clause.name.text, ownerModule.split("/").at(-1)!]);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const binding of clause.namedBindings.elements) {
        if (!binding.isTypeOnly) imports.push([binding.name.text, (binding.propertyName ?? binding.name).text]);
      }
      for (const [local, exported] of imports) {
        assert.ok(modules[ownerModule]?.includes(exported), `${exported} must resolve to its canonical owner`);
        assert.equal(imported.has(exported), false, "A shared owner has one imported binding");
        imported.add(exported);
        if (exported === "ADMIN_FORM_STACK_CLASS_NAME") stackClassBinding = local;
        locals[local] = Object.hasOwn(helpers, exported) ? helpers[exported] : (markers[exported] ??= () => null);
      }
    }
    const compiled: { default?: (props: Record<string, unknown>) => ReactNode } = {};
    new Function("React", "exports", ...Object.keys(locals), ts.transpileModule(consumer.getText(file), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText)({ createElement, Fragment }, compiled, ...Object.values(locals));
    assert.ok(compiled.default);
    const element = (node: unknown): TaxonomyElement => { assert.ok(isValidElement<Record<string, unknown>>(node)); return node; };
    const walk = (node: unknown): TaxonomyElement[] => {
      if (Array.isArray(node)) return node.flatMap(walk);
      if (!isValidElement<Record<string, unknown>>(node)) return [];
      return [node, ...walk(node.props.children), ...walk(node.props.header), ...walk(node.props.icon)];
    };
    const owned = (node: unknown, name: string) => walk(node).filter(child => child.type === markers[name]);
    const only = (node: unknown, name: string) => { const found = owned(node, name); assert.equal(found.length, 1, name); return found[0]; };
    const directChildren = (node: unknown): TaxonomyElement[] => Array.isArray(node) ? node.flatMap(directChildren) :
      isValidElement<Record<string, unknown>>(node) ? node.type === Fragment ? directChildren(node.props.children) : [node] : [];
    const sourceStacks: ts.JsxElement[] = [];
    const findSourceStacks = (node: ts.Node) => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "div" &&
          node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === "className" &&
            attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression &&
            ts.isIdentifier(attribute.initializer.expression) && attribute.initializer.expression.text === stackClassBinding)) sourceStacks.push(node);
      ts.forEachChild(node, findSourceStacks);
    };
    findSourceStacks(consumer);
    const text = (node: unknown): string => Array.isArray(node) ? node.map(text).join("") :
      isValidElement<Record<string, unknown>>(node) ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : "";
    const record = { id: entity === "category" ? 17 : 187, name: "Original taxonomy", slug: "original-taxonomy", parent_id: 18,
      category_id: 18, status: "published", color_token: "gold", updated_at: "2026-10-25T00:00:01.123456+00:00" };
    for (const mode of surfaces) {
      assert.ok(mode === "create" || mode === "edit", `Unverified taxonomy surface: ${mode}`);
      for (const pending of [false, true]) for (const hasErrors of [false, true]) for (const optionCount of [2, 8]) {
        const relation = entity === "category" ? "parent_id" : "category_id";
        const options = Array.from({ length: optionCount }, (_, index) => ({ value: String(index + 18), label: `Option ${index}` }));
        const root = element(compiled.default({ mode, [entity]: mode === "edit" ? record : undefined,
          [entity === "category" ? "parentOptions" : "categoryOptions"]: options }));
        assert.equal(root.type, markers.AdminFormRuntime);
        assert.equal(root.props.mode, mode); assert.equal(root.props.entityKey, entity);
        assert.equal(root.props.action, markers[`${mode === "edit" ? "update" : "create"}${entity === "category" ? "Category" : "Series"}Form`]);
        assert.equal(root.props.formId, `${entity}-taxonomy-form`);
        assert.equal(root.props.closeHref, `/admin/content/${entity === "category" ? "categories" : "series"}`);
        assert.deepEqual(root.props.invalidateEntities, entity === "category" ? ["categories", "topics", "series"] : ["series", "topics", "categories"]);
        const fieldErrors: Record<string, string[]> = hasErrors ? { name: ["name error"], [relation]: ["relation error"], slug: ["slug error"], is_published: ["state error"], color_token: ["color error"] } : {};
        assert.equal(typeof root.props.children, "function");
        const body = (root.props.children as (context: { pending: boolean; fieldErrors: Record<string, string[]> }) => ReactNode)({ pending, fieldErrors });
        const nodes = walk(body), sections = owned(body, "AdminFormSection"), grids = owned(body, "AdminFormGrid");
        const required: readonly AdminFormPresentationRequirement[] = contract.requirements.filter((requirement: AdminFormPresentationRequirement) => requirement.requirement === "required" &&
          (!requirement.conditions?.surfaces || requirement.conditions.surfaces.includes(mode)));
        assert.ok(required.length > 0, "Applicability must retain required presentation roles");
        assert.equal(new Set(required.map(requirement => requirement.target)).size, required.length, "Required presentation targets are unique");
        const requiredSections = required.filter(requirement => requirement.owner?.exportName === "AdminFormSection");
        assert.equal(sections.length, requiredSections.length, "Every applicable Section is rendered once; a main header alone is insufficient");
        const headers = owned(body, "AdminModuleSectionHeader");
        assert.equal(headers.length, sections.length);
        const ids = headers.map(header => header.props.id); assert.equal(new Set(ids).size, ids.length);
        const basic = sections.find(section => isValidElement<Record<string, unknown>>(section.props.header) && section.props.header.props.id === `${entity}-basic-data`);
        assert.ok(basic); const basicHeader = element(basic.props.header);
        const nameField = only(basic, "AdminFormField"), listbox = only(basic, "AdminFormListboxSelect"), toggle = only(basic, "AdminFormSwitch");
        const slug = owned(body, "AdminSlugField"), actions = only(body, "AdminFormActions");
        const stacks = nodes.filter(node => node.type === "div" && node.props.className === ADMIN_FORM_STACK_CLASS_NAME);
        const color = sections.find(section => isValidElement<Record<string, unknown>>(section.props.header) && section.props.header.props.id === "category-color");
        const inputs = nodes.filter(node => node.type === "input");
        const nameInput = inputs.filter(node => node.props.name === "name"); assert.equal(nameInput.length, 1);
        assert.equal(nameInput[0].props.defaultValue, mode === "edit" ? record.name : "");
        assert.equal(nameInput[0].props.required, true); assert.equal(nameInput[0].props.disabled, pending);
        assert.equal(nameInput[0].props["aria-invalid"], hasErrors);
        assert.equal(nameInput[0].props["aria-describedby"], hasErrors ? "name-error" : undefined);
        assert.equal(nameInput[0].props.className, adminFormFieldClassName(hasErrors ? "border-red-400/40" : ""));
        assert.equal(inputs.filter(node => node.props.name === "id").length, Number(mode === "edit"));
        const revisions = owned(body, "TaxonomyExpectedRevisionInput"); assert.equal(revisions.length, Number(mode === "edit"));
        if (mode === "edit") assert.equal(revisions[0].props.initialRevision, record.updated_at);
        assert.equal(grids.length, 1); assert.equal(only(basic, "AdminFormGrid"), grids[0]);
        assert.equal(basic.props.children, grids[0], "The primary fields remain the direct shared Grid content");
        assert.equal(grids[0].props.columns, mode === "edit" ? 3 : 4); assert.equal(grids[0].props.presentation, "aligned-fields");
        assert.equal(Boolean(grids[0].props.fieldContainers), false);
        assert.equal(slug.length, Number(mode === "create"));
        assert.equal(owned(basic, "AdminFormError").filter(node => node.props.name === "name").length, 1);
        assert.equal(owned(basic, "AdminFormError").filter(node => node.props.name === "is_published").length, 1);
        const panelHeader = (section: TaxonomyElement, heading: string, icon: string) => {
          assert.equal(section.props.presentation, "panel");
          const header = element(section.props.header); assert.equal(header.type, markers.AdminModuleSectionHeader);
          assert.equal(header.props.sectionHeading, heading); assert.equal(header.props.icon, icon);
          assert.equal(header.props.sectionHeaderPresentation, "premium");
          assert.equal(header.props.sectionHeaderClassName, ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME);
          assert.equal(header.props.standalone, undefined, "Embedded Panel headers retain their approved card margins");
          assert.equal(section.props.title, undefined); assert.equal(section.props.eyebrow, undefined);
          assert.equal(section.props.className, undefined, "Shared Section owns surface and spacing without local patch classes");
        };
        const checks: Record<string, () => void> = {
          sectionActionSpacing: () => {
            assert.ok(stackClassBinding, "The canonical stack token must be imported from the shared UI owner");
            assert.equal(sourceStacks.length, 1, "The visible DOM stack must use the imported canonical token, not a copied class literal");
            assert.equal(stacks.length, 1, "A single visible inner DOM stack must space the real Sections and Actions");
            assert.equal(root.props.className, undefined, "Spacing on the Runtime form cannot reach through its display:contents fieldset");
            const stack = stacks[0];
            assert.ok(directChildren(body).includes(stack), "The visible stack remains directly inside the Runtime fields");
            assert.equal(stack.props.style, undefined, "The shared stack token owns spacing without inline patches");
            assert.equal(stack.props.hidden, undefined, "The spacing stack must remain visible");
            assert.deepEqual(directChildren(stack.props.children), [...sections, actions], "All applicable Sections and final Actions must be direct siblings in one shared stack");
            assert.equal(walk(stack).filter(node => node.type === "input" && node.props.name === "id").length, 0, "Native identity remains outside the visible stack");
            assert.equal(owned(stack, "TaxonomyExpectedRevisionInput").length, 0, "Native revision remains outside the visible stack");
          },
          basicSection: () => {
            panelHeader(basic, entity === "category" ? "بيانات التصنيف" : "بيانات السلسلة", entity === "category" ? "categories" : "link");
            assert.equal(basicHeader.props.sectionDescription, entity === "category"
              ? "الاسم والرابط الودّي والعلاقة الهرمية هي مصدر بيانات التصنيف داخل نظام المحتوى."
              : "أنشئ علاقة واضحة بين السلسلة وتصنيفها، مع الحفاظ على رابط ثابت بعد أول حفظ.");
          },
          categoryColorSection: () => {
            assert.equal(entity, "category"); assert.ok(color); panelHeader(color, "لون التصنيف", "settings");
            assert.ok(sections.indexOf(color) > sections.indexOf(basic), "Color has its own following Section");
            assert.equal(owned(basic, "CategoryColorPicker").length, 0);
            const picker = only(color, "CategoryColorPicker"); assert.equal(picker.props.presentation, "panel");
            assert.equal(picker.props.defaultToken, mode === "edit" ? record.color_token : undefined);
            assert.equal(picker.props.previewName, mode === "edit" ? record.name : "معاينة التصنيف");
            assert.equal(owned(color, "AdminFormError").filter(node => node.props.name === "color_token").length, 1);
          },
          fieldLabels: () => {
            assert.equal(nameField.props.presentation, "panel"); assert.equal(nameField.props.required, true);
            assert.equal(nameField.props.label, entity === "category" ? "اسم التصنيف" : "اسم السلسلة");
            const publication = nodes.filter(node => node.type === "span" && text(node.props.children) === "حالة النشر" &&
              node.props.className === adminFormLabelClassName({ textInset: true }));
            assert.equal(publication.length, 1);
            assert.equal(walk(publication[0]).filter(node => Object.hasOwn(node.props, "data-admin-form-label-text")).length, 1);
            assert.equal(listbox.props.presentation, "panel");
            if (mode === "create") assert.equal(slug[0].props.labelClassName, adminFormLabelClassName({ textInset: true }));
          },
          fieldHints: () => {
            assert.equal(listbox.props.presentation, "panel"); assert.ok(typeof listbox.props.hint === "string" && listbox.props.hint.length > 0);
            if (mode === "create") assert.equal(slug[0].props.hintClassName, adminFormHintClassName({ textInset: true }));
          },
          createSlug: () => {
            assert.equal(mode, "create"); assert.equal(slug.length, 1);
            assert.equal(slug[0].props.sourceInputName, "name"); assert.equal(slug[0].props.error, hasErrors ? "slug error" : null);
          },
          relationSelect: () => {
            assert.equal(listbox.props.name, relation); assert.equal(listbox.props.focusTargetId, relation);
            assert.equal(listbox.props.presentation, "panel"); assert.equal(listbox.props.disabled, pending);
            assert.equal(listbox.props.required === true, entity === "series"); assert.equal(listbox.props.sizing, "full");
            assert.equal(listbox.props.defaultValue, mode === "edit" ? "18" : "");
            assert.equal(listbox.props.searchable, optionCount > 7); assert.equal(listbox.props.error, hasErrors ? "relation error" : null);
            assert.deepEqual(listbox.props.options, entity === "category" ? [{ value: "", label: "بدون تصنيف أب" }, ...options] : options);
          },
          publishSwitch: () => {
            assert.equal(toggle.props.name, "is_published"); assert.equal(toggle.props.label, "منشور");
            assert.equal(toggle.props.surface, true); assert.equal(toggle.props.disabled, pending);
            assert.equal(toggle.props.defaultChecked, mode === "edit");
            assert.equal(toggle.props.presentation, undefined); assert.equal(toggle.props.embedded, undefined);
          },
          formActions: () => {
            assert.equal(actions.props.description, null); const icon = element(actions.props.icon);
            assert.equal(icon.type, markers.AdminModuleTabIcon); assert.equal(icon.props.name, "content");
            assert.equal(actions.props.className, undefined, "The shared sticky owner retains its approved surface");
            for (const section of sections) assert.equal(owned(section, "AdminFormActions").length, 0, "Actions remain outside field Sections");
            assert.ok(nodes.indexOf(actions) > Math.max(...sections.map(section => nodes.indexOf(section))), "The shared Actions follow all Sections");
            assert.equal(nodes.filter(node => node.type === "button" || node.type === "form").length, 0, "No parallel local save or form owner");
          },
          feedbackStates: () => {
            assert.equal(nameInput[0].props.disabled, pending); assert.equal(nameInput[0].props["aria-invalid"], hasErrors);
            assert.equal(listbox.props.error, hasErrors ? "relation error" : null);
          },
        };
        const views: Record<string, { sourceFile: string; exportName: string; ports: Record<string, unknown> }> = {
          sectionActionSpacing: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "ADMIN_FORM_STACK_CLASS_NAME", ports: {
            className: stacks.length === 1 && sourceStacks.length === 1 ? "ADMIN_FORM_STACK_CLASS_NAME" : undefined,
          } },
          basicSection: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection", ports: { presentation: basic.props.presentation } },
          categoryColorSection: { sourceFile: "src/components/admin/ui/AdminForm.tsx", exportName: "AdminFormSection", ports: { presentation: color?.props.presentation } },
          fieldLabels: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormLabelClassName", ports: {
            textInset: String(nameField.props.presentation === "panel" && listbox.props.presentation === "panel" &&
              (mode === "edit" || slug[0].props.labelClassName === adminFormLabelClassName({ textInset: true }))),
          } },
          fieldHints: { sourceFile: "src/lib/admin/admin-ui-styles.ts", exportName: "adminFormHintClassName", ports: {
            textInset: String(listbox.props.presentation === "panel" &&
              (mode === "edit" || slug[0].props.hintClassName === adminFormHintClassName({ textInset: true }))),
          } },
          createSlug: { sourceFile: "src/components/admin/ui/AdminSlugField.tsx", exportName: "default", ports: {
            labelClassName: slug[0]?.props.labelClassName === adminFormLabelClassName({ textInset: true }) ? "adminFormLabelClassName({ textInset: true })" : undefined,
          } },
          relationSelect: { sourceFile: "src/components/admin/ui/AdminFormListboxSelect.tsx", exportName: "default", ports: { presentation: listbox.props.presentation } },
          publishSwitch: { sourceFile: "src/components/admin/ui/AdminFormSwitch.tsx", exportName: "default", ports: { surface: String(toggle.props.surface) } },
          formActions: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "AdminFormActions", ports: {
            icon: isValidElement<Record<string, unknown>>(actions.props.icon) && actions.props.icon.type === markers.AdminModuleTabIcon &&
              actions.props.icon.props.name === "content" ? "AdminModuleTabIcon(content)" : undefined,
          } },
          feedbackStates: { sourceFile: "src/components/admin/ui/AdminFormRuntime.tsx", exportName: "default", ports: {} },
        };
        for (const requirement of required) {
          assert.ok(checks[requirement.target], `Unverified required role: ${requirement.target}`);
          checks[requirement.target]();
          const view = views[requirement.target]; assert.ok(view);
          if (requirement.owner) assert.deepEqual({ sourceFile: view.sourceFile, exportName: view.exportName }, requirement.owner,
            `${requirement.target} retains the contract's canonical owner`);
          if (requirement.presentation) assert.equal(view.ports[requirement.presentation.port], requirement.presentation.value,
            `${requirement.target} renders its currently declared presentation`);
        }
      }
    }
    return true;
  } catch (error) {
    failures?.push(error instanceof Error ? error.message : String(error));
    return false;
  }
}
const paths = {
  runtimeCore: "src/lib/admin/form-runtime.ts",
  runtime: "src/components/admin/ui/AdminFormRuntime.tsx",
  formSwitch: "src/components/admin/ui/AdminFormSwitch.tsx",
  formListbox: "src/components/admin/ui/AdminFormListboxSelect.tsx",
  listbox: "src/components/admin/ui/AdminListboxSelect.tsx",
  feedbackProvider: "src/components/admin/AdminFeedbackProvider.tsx",
  noticeFrame: "src/components/admin/AdminNoticeDismissibleFrame.tsx",
  entityList: "src/components/admin/entity-list/AdminEntityList.tsx",
  categoryForm: "src/app/admin/content/categories/CategoryForm.tsx",
  categoryNew: "src/app/admin/content/categories/new/page.tsx",
  categoryEdit: "src/app/admin/content/categories/[id]/page.tsx",
  categoryClient: "src/app/admin/content/categories/CategoriesListClient.tsx",
  categoryColumns: "src/app/admin/content/categories/categories-columns.tsx",
  categoryRowActions:
    "src/app/admin/content/categories/CategoryRowActions.tsx",
  categoryActions: "src/app/admin/content/categories/actions.ts",
  taxonomyFormActions: "src/app/admin/content/taxonomy-form-actions.ts",
  taxonomyFormValidation:
    "src/lib/admin/content/taxonomy-form-validation.ts",
  articleTopicHelpers:
    "src/app/admin/content/topics/article-actions/helpers.ts",
  mediaTopicHelpers:
    "src/app/admin/content/topics/media-actions/helpers.ts",
  seriesForm: "src/app/admin/content/series/SeriesForm.tsx",
  seriesNew: "src/app/admin/content/series/new/page.tsx",
  seriesEdit: "src/app/admin/content/series/[id]/page.tsx",
  seriesClient: "src/app/admin/content/series/SeriesTableClient.tsx",
  seriesColumns: "src/app/admin/content/series/series-columns.tsx",
  dataGrid: "src/components/admin/ui/AdminDataGrid.tsx",
  rowActions: "src/components/admin/ui/AdminDataGridRowActions.tsx",
  previewActions: "src/components/admin/ui/AdminEntityPreviewActions.tsx",
  previewAdapters: "src/lib/admin/content/entity-preview-capabilities.ts",
  interactionManifest:
    "src/lib/admin/interaction-system/adoption-manifest.ts",
  categoryAdapter:
    "src/lib/admin/content/entity-list-adapters/categories.ts",
  seriesAdapter: "src/lib/admin/content/entity-list-adapters/series.ts",
  seriesActions: "src/app/admin/content/series/actions.ts",
  taxonomyMutations: "src/lib/admin/content/taxonomy-mutations.ts",
  instantMutation:
    "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
  instantMutationCache:
    "src/lib/admin/entity-list/data-engine/instant-mutation-cache.ts",
  migration:
    "sql/migrations/20260723040000_content_taxonomy_data_runtime.sql",
  consistencyMigration:
    "sql/migrations/20260907214608_p1_e_taxonomy_consistency.sql",
  lifecycleMigration:
    "sql/migrations/20260808120000_taxonomy_lifecycle_contract.sql",
  firstPublishMigration:
    "sql/migrations/20260807140000_topic_categories_first_publish_date.sql",
} as const;

for (const [key, path] of Object.entries(paths)) {
  check("files", `${key} canonical file exists`, existsSync(resolve(ROOT, path)), path);
}

const runtimeCore = read(paths.runtimeCore);
const runtime = read(paths.runtime);
const formSwitch = read(paths.formSwitch);
const formListbox = read(paths.formListbox);
const listbox = read(paths.listbox);
const feedbackProvider = read(paths.feedbackProvider);
const noticeFrame = read(paths.noticeFrame);
const entityList = read(paths.entityList);
const categoryForm = read(paths.categoryForm);
const categoryNew = read(paths.categoryNew);
const categoryEdit = read(paths.categoryEdit);
const categoryClient = read(paths.categoryClient);
const categoryColumns = read(paths.categoryColumns);
const categoryRowActions = read(paths.categoryRowActions);
const categoryActions = read(paths.categoryActions);
const taxonomyFormActions = read(paths.taxonomyFormActions);
const taxonomyFormValidation = read(paths.taxonomyFormValidation);
const articleTopicHelpers = read(paths.articleTopicHelpers);
const mediaTopicHelpers = read(paths.mediaTopicHelpers);
const seriesForm = read(paths.seriesForm);
const seriesNew = read(paths.seriesNew);
const seriesEdit = read(paths.seriesEdit);
const seriesClient = read(paths.seriesClient);
const seriesColumns = read(paths.seriesColumns);
const dataGrid = read(paths.dataGrid);
const rowActions = read(paths.rowActions);
const previewActions = read(paths.previewActions);
const previewAdapters = read(paths.previewAdapters);
const interactionManifest = read(paths.interactionManifest);
const categoryAdapter = read(paths.categoryAdapter);
const seriesAdapter = read(paths.seriesAdapter);
const seriesActions = read(paths.seriesActions);
const taxonomyMutations = read(paths.taxonomyMutations);
const instantMutation = read(paths.instantMutation);
const instantMutationCache = read(paths.instantMutationCache);
const migration = read(paths.migration);
const consistencyMigration = read(paths.consistencyMigration);
const lifecycleMigration = read(paths.lifecycleMigration);
const firstPublishMigration = read(paths.firstPublishMigration);
const createCategory = exportedFunctionSlice(
  taxonomyFormActions,
  "createCategoryForm",
);
const createSeries = exportedFunctionSlice(
  taxonomyFormActions,
  "createSeriesForm",
);

check(
  "category-first-publish",
  "category publication is database-owned, immutable after first publish, and backfilled only in the migration",
  firstPublishMigration.includes("add column if not exists published_at timestamp with time zone") &&
    firstPublishMigration.includes("sync_topic_category_publication_compatibility") &&
    firstPublishMigration.includes("old.published_at is not null") &&
    firstPublishMigration.includes("new.published_at := old.published_at") &&
    firstPublishMigration.includes("categories.created_at") &&
    firstPublishMigration.includes("fallback is migration-only") &&
    firstPublishMigration.includes("topic_categories_published_at_required_when_published"),
);
check(
  "category-first-publish",
  "category writers and the canonical read model adopt stored published_at without a presentation fallback",
  taxonomyMutations.includes("published_at: z.string().nullable()") &&
    taxonomyFormActions.includes('.select("id, published_at, updated_at")') &&
    taxonomyFormActions.includes("mutation.category.published_at") &&
    categoryActions.includes('.select("id, is_active, status, published_at, updated_at")') &&
    categoryMutationCarriesPublishedAt(categoryClient) &&
    categoryPublicationUsesSharedDateCell(categoryColumns) &&
    !categoryColumns.includes("formatAdminDateTime(row.created_at ??") &&
    firstPublishMigration.includes("filtered.published_at"),
);

const publicationColumnFixture = `
import { AdminDataGridDateTimeCell } from "../../../../components/admin/ui/AdminDataGrid";
const columns = [{ key: "published_at", renderCell: ({ row }) => (
  <AdminDataGridDateTimeCell value={row.published_at} fallbackTitle="—" />
) }];`;
check("category-first-publish", "the canonical date-cell binding accepts harmless import aliases",
  categoryPublicationUsesSharedDateCell(publicationColumnFixture) && categoryPublicationUsesSharedDateCell(publicationColumnFixture
    .replace("{ AdminDataGridDateTimeCell }", "{ AdminDataGridDateTimeCell as PublishedDate }")
    .replace("<AdminDataGridDateTimeCell", "<PublishedDate")));
for (const [label, changed] of [
  ["created timestamp", publicationColumnFixture.replace("value={row.published_at}", "value={row.created_at}")],
  ["updated timestamp fallback", publicationColumnFixture.replace("value={row.published_at}", "value={row.published_at ?? row.updated_at}")],
  ["fallback override", publicationColumnFixture.replace('fallbackTitle="—"', "fallback={row.created_at}")],
  ["prop spread", publicationColumnFixture.replace('fallbackTitle="—"', "{...override}")],
  ["unbound row", publicationColumnFixture.replace("({ row })", "({ category })")],
  ["unrelated column", publicationColumnFixture.replace('key: "published_at"', 'key: "created_at"')],
  ["duplicate published column", publicationColumnFixture + '\nconst duplicate = { key: "published_at", renderCell: () => null };'],
  ["parallel date owner", publicationColumnFixture.replace("components/admin/ui/AdminDataGrid", "components/admin/ui/ParallelDateGrid")],
  ["comment-only reference", "/* " + publicationColumnFixture + " */"],
] as const) {
  check("category-first-publish", label + " cannot satisfy the stored publication date-cell contract",
    changed !== publicationColumnFixture && !categoryPublicationUsesSharedDateCell(changed));
}

const publicationAdapterFixture = `
const toggleStatus = useCallback(async (category) => {
  return instant.mutateAsync({ execute: async () => {
    const saved = await toggleCategoryStatusAjax(category.id);
    return { ok: true as const, publishedAt: saved.publishedAt };
  } });
}, []);`;
check("category-first-publish", "a harmless action-result binding rename preserves publication provenance",
  categoryMutationCarriesPublishedAt(publicationAdapterFixture) &&
    categoryMutationCarriesPublishedAt(publicationAdapterFixture.replaceAll("saved", "renamedSaved")));
for (const [label, changed] of [
  ["fabricated fallback", publicationAdapterFixture.replace("publishedAt: saved.publishedAt", "publishedAt: saved.createdAt")],
  ["missing timestamp", publicationAdapterFixture.replace(", publishedAt: saved.publishedAt", "")],
  ["unrelated action result", publicationAdapterFixture.replace("await toggleCategoryStatusAjax(category.id)", "await unrelatedStatusAction(category.id)")],
] as const) {
  check("category-first-publish", label + " cannot satisfy the category action-to-publication contract",
    changed !== publicationAdapterFixture && !categoryMutationCarriesPublishedAt(changed));
}

// 1. Targeted shared Form Runtime contracts.
check(
  "form-runtime",
  "runtime exports the shared shell, grid, errors, actions, and dirty guard",
  runtime.includes("AdminFormRuntime") &&
    runtime.includes("AdminFormGrid") &&
    runtime.includes("AdminFormError") &&
    runtime.includes("AdminFormActions") &&
    runtime.includes("useAdminFormRuntime") &&
    runtime.includes("useAdminUnsavedChangesGuard"),
);
check(
  "form-runtime",
  "runtime exposes stable form, entity, dirty, and unsaved-dialog markers",
  runtime.includes("data-admin-form-runtime") &&
    runtime.includes("data-admin-form-entity") &&
    runtime.includes("data-admin-form-dirty") &&
    runtime.includes("data-admin-unsaved-dialog"),
);
check(
  "form-runtime",
  "dirty navigation uses the shared dialog and browser-unload protection without window.confirm",
  runtime.includes("AdminConfirmDialog") &&
    runtime.includes("beforeunload") &&
    !runtime.includes("window.confirm"),
);
check(
  "form-runtime",
  "shared grid owns responsive column behavior",
  runtime.includes("grid") &&
    /(?:sm|md|lg|xl):grid-cols/.test(runtime) &&
    !runtimeCore.toLowerCase().includes("categor") &&
    !runtimeCore.toLowerCase().includes("series"),
);
check(
  "form-runtime",
  "shared published-state control delegates to one switch primitive",
  formSwitch.includes("AdminFormSwitch") &&
    formSwitch.includes('role="switch"') &&
    formSwitch.includes('type="checkbox"') &&
    formSwitch.includes("peer-checked"),
);

// 2. Category Create/Edit parity.
check(
  "category-parity",
  "category create and edit pages consume the same CategoryForm",
  categoryNew.includes("<CategoryForm") &&
    categoryEdit.includes("<CategoryForm") &&
    categoryNew.includes('mode="create"') &&
    categoryEdit.includes('mode="edit"'),
);
check(
  "category-parity",
  "CategoryForm delegates its only form to AdminFormRuntime",
  occurrenceCount(categoryForm, /<form\b/g) === 0 &&
    occurrenceCount(categoryForm, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(runtime, /<form\b/g) === 1,
);
check(
  "category-parity",
  "CategoryForm uses the shared grid owner for one responsive primary row",
  categoryForm.includes('<AdminFormGrid columns={isEdit ? 3 : 4} presentation="aligned-fields">') &&
    !categoryForm.includes("AdminFormGridItem") &&
    categoryForm.includes('sizing="full"') &&
    !categoryForm.includes("xl:pt-8") &&
    categoryForm.includes("AdminFormSwitch") &&
    categoryForm.includes("AdminFormListboxSelect") &&
    categoryForm.includes("AdminFormActions") &&
    categoryForm.indexOf('name="name"') < categoryForm.indexOf('name="parent_id"') &&
    categoryForm.indexOf('name="parent_id"') < categoryForm.indexOf('sourceInputName="name"') &&
    categoryForm.indexOf('sourceInputName="name"') < categoryForm.indexOf('name="is_published"') &&
    categoryForm.indexOf("<AdminFormSwitch") <
      categoryForm.indexOf("</AdminFormGrid>"),
);
check(
  "category-parity",
  "category sort order is removed from the form UI only",
  !categoryForm.includes('name="sort_order"') &&
    createCategory.includes("sort_order: 0") &&
    migration.includes("sort_order"),
);
check(
  "category-parity",
  "category editing navigates to the full edit page and no active modal consumer remains",
  categoryColumns.includes("/admin/content/categories/") &&
    !categoryClient.includes("CategoryEditModal") &&
    !categoryColumns.includes("CategoryEditModal"),
);

// 3. Series Create/Edit parity.
check(
  "series-parity",
  "series create and edit pages consume the same SeriesForm",
  seriesNew.includes("<SeriesForm") &&
    seriesEdit.includes("<SeriesForm") &&
    seriesNew.includes('mode="create"') &&
    seriesEdit.includes('mode="edit"'),
);
check(
  "series-parity",
  "SeriesForm delegates its only form to AdminFormRuntime",
  occurrenceCount(seriesForm, /<form\b/g) === 0 &&
    occurrenceCount(seriesForm, /<AdminFormRuntime\b/g) === 1 &&
    occurrenceCount(runtime, /<form\b/g) === 1,
);
check(
  "series-parity",
  "SeriesForm uses the same shared runtime primitives as CategoryForm",
  [
    "AdminFormGrid",
    "AdminFormSwitch",
    "AdminFormListboxSelect",
    "AdminFormActions",
  ].every((token) => categoryForm.includes(token) && seriesForm.includes(token)),
);
check(
  "series-parity",
  "SeriesForm uses the shared grid owner for one responsive primary row",
  seriesForm.includes('<AdminFormGrid columns={isEdit ? 3 : 4} presentation="aligned-fields">') &&
    !seriesForm.includes("AdminFormGridItem") &&
    seriesForm.includes('sizing="full"') &&
    !seriesForm.includes("xl:pt-8") &&
    seriesForm.indexOf("<AdminFormSwitch") <
      seriesForm.indexOf("</AdminFormGrid>"),
);
check(
  "series-parity",
  "series sort order is removed from the form UI and remains database-owned",
  !seriesForm.includes('name="sort_order"') &&
    !createSeries.includes("sort_order") &&
    consistencyMigration.includes("insert into public.topic_series") &&
    migration.includes("sort_order"),
);

// Complete presentation requirements come from the current consumer entries,
// independently of the dynamic shared capability axes and their audit count.
for (const [entity, source, manifestId] of [
  ["category", categoryForm, "topic-category-create-edit"],
  ["series", seriesForm, "topic-series-create-edit"],
] as const) {
  const entry: AdminFormAdoptionEntry | undefined = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.find(entry => entry.id === manifestId);
  assert.ok(entry?.presentationContract, `${manifestId} declares its current complete applicable presentation`);
  const contract = entry.presentationContract;
  const conformanceErrors: string[] = [];
  check("taxonomy-panel", `${entity} renders every currently required applicable presentation role across its declared surfaces and states`,
    taxonomyFormUsesCompletePanel(source, entity, contract, entry.surfaces, conformanceErrors), conformanceErrors.join("; "));
  check("taxonomy-panel", `${entity} preserves the existing action, revision, cache, field, and save-bar owners`,
    source.includes(`const action = isEdit ? update${entity === "category" ? "Category" : "Series"}Form : create${entity === "category" ? "Category" : "Series"}Form;`) &&
      source.includes("action={action}") && source.includes("mode={mode}") && source.includes(`entityKey="${entity}"`) &&
      source.includes("closeHref={closeHref}") && source.includes(`formId="${entity}-taxonomy-form"`) &&
      source.includes(`invalidateEntities={[${entity === "category" ? '"categories", "topics", "series"' : '"series", "topics", "categories"'}]}`) &&
      occurrenceCount(source, /<TaxonomyExpectedRevisionInput\b/g) === 1 && source.includes(`initialRevision={${entity}?.updated_at}`) &&
      source.includes(`defaultValue={${entity}?.name ?? ""}`) && source.includes('name="is_published"') &&
      source.includes(entity === "category" ? 'defaultChecked={category?.status === "published"}' : 'isEdit ? series?.status === "published" : false') &&
      (entity === "series" || (source.includes("<CategoryColorPicker") && source.includes("defaultToken={category?.color_token}") &&
        source.includes('previewName={category?.name || "معاينة التصنيف"}'))) &&
      occurrenceCount(source, /<AdminFormActions\b/g) === 1 && /<AdminFormSwitch\b[^>]*\bsurface\s*\/>/.test(source));
  const file = ts.createSourceFile("TaxonomyMutations.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const elements: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
  const visit = (node: ts.Node) => { if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, visit); };
  visit(file);
  const color = elements.find(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "AdminFormSection" &&
    node.openingElement.getText(file).includes('id="category-color"'))?.getText(file);
  const header = elements.find(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "AdminModuleSectionHeader" &&
    node.getText(file).includes(`id="${entity}-basic-data"`))?.getText(file);
  assert.ok(header);
  const stack = elements.find((node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "div" &&
    node.openingElement.getText(file).includes("className={ADMIN_FORM_STACK_CLASS_NAME}"));
  assert.ok(stack, `${entity} needs the visible canonical stack before mutation coverage can prove its placement`);
  const stackSource = stack.getText(file), stackBody = source.slice(stack.openingElement.end, stack.closingElement.getStart(file));
  const actionSource = elements.find(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "AdminFormActions")?.getText(file);
  assert.ok(actionSource);
  const withoutStackToken = stackSource.replace("className={ADMIN_FORM_STACK_CLASS_NAME}", "");
  const changes: Array<readonly [string, string]> = [
    ["lost visible stack token", source.replace(stackSource, withoutStackToken)],
    ["spacing token on Runtime only", source.replace(stackSource, withoutStackToken).replace("<AdminFormRuntime", "<AdminFormRuntime className={ADMIN_FORM_STACK_CLASS_NAME}")],
    ["fragment instead of visible stack", source.replace(stackSource, `<>${stackBody}</>`)],
    ["copied stack class without canonical token", source.replace(stackSource, stackSource.replace("className={ADMIN_FORM_STACK_CLASS_NAME}", `className=${JSON.stringify(ADMIN_FORM_STACK_CLASS_NAME)}`))],
    ["Actions outside visible stack", source.replace(stackSource, stackSource.replace(actionSource, "") + actionSource)],
    ["nested wrapper preventing direct sibling spacing", source.replace(stackSource, stackSource.replace(stackBody, `<div>${stackBody}</div>`))],
    ["hidden visible stack", source.replace(stackSource, stackSource.replace("<div ", "<div hidden "))],
    ["default section surface", source.replace(/(<AdminFormSection\s+)presentation="panel"/, '$1presentation="default"')],
    ["local section styling", source.replace(/(<AdminFormSection\s+)presentation="panel"/, '$1presentation="panel" className="p-9"')],
    ["lost canonical header slot", source.replace(`header={${header}}`, 'header={null}')],
    ["duplicate section header", source.replace(`header={${header}}`, `header={<>{${header}}{${header}}</>}`)],
    ["default section header", source.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"')],
    ["lost charcoal surface", source.replace("sectionHeaderClassName={ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME}", "")],
    ["lost name label adoption", source.replace(/(<AdminFormField\b[^>]*presentation=)"panel"/, '$1"default"')],
    ["lost relation label and hint adoption", source.replace(/(<AdminFormListboxSelect\s+)presentation="panel"/, '$1presentation="default"')],
    ["lost create Slug label", source.replace('labelClassName={adminFormLabelClassName({ textInset: true })}', 'labelClassName={undefined}')],
    ["lost create Slug hint", source.replace('hintClassName={adminFormHintClassName({ textInset: true })}', 'hintClassName={undefined}')],
    ["lost publication label", source.replace('<span className={adminFormLabelClassName({ textInset: true })}>', '<span className="text-sm text-white/70">')],
    ["bare default Actions", source.replace(/<AdminFormActions\b[^\n]*\/>/, '<AdminFormActions />')],
    ["lost Actions icon", source.replace('icon={<AdminModuleTabIcon name="content" />}', '')],
    ["lost Actions reference description", source.replace('description={null}', '')],
    ["changed columns", source.replace("columns={isEdit ? 3 : 4}", "columns={2}")],
    ["double grid surface", source.replace('presentation="aligned-fields"', 'presentation="control-cards"')],
    ["lost pending lock", source.replaceAll("disabled={pending}", "disabled={false}")],
    ["lost name error target", source.replace('<AdminFormError name="name"', '<AdminFormError name="other"')],
    ["lost revision binding", source.replace(`initialRevision={${entity}?.updated_at}`, 'initialRevision={undefined}')],
    ["changed create/edit Slug applicability", source.replace('{!isEdit ? (', '{isEdit ? (')],
    ["parallel Section owner", source.replace('  AdminFormSection,', '  ParallelFormSection as AdminFormSection,')],
    ["parallel header owner", source.replace('components/admin/ui/AdminModuleTabs"', 'components/admin/ui/ParallelModuleTabs"')],
    ["comment-only composition", `/* ${source} */`],
  ];
  if (entity === "category") {
    assert.ok(color);
    changes.push(["missing independent color Section", source.replace(color, "")]);
    changes.push(["default color legend presentation", source.replace(/(<CategoryColorPicker\s+)presentation="panel"/, '$1presentation="default"')]);
    changes.push(["default color Section header", source.replace(color, color.replace('sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"'))]);
    changes.push(["lost color value binding", source.replace('defaultToken={category?.color_token}', 'defaultToken={undefined}')]);
    changes.push(["lost color preview binding", source.replace('previewName={category?.name || "معاينة التصنيف"}', 'previewName="Lost preview"')]);
    changes.push(["lost color error association", source.replace('<AdminFormError name="color_token" />', '')]);
  }
  for (const [label, changed] of changes) {
    check("taxonomy-panel", `${entity} rejects ${label} as complete applicable adoption`, changed !== source &&
      !taxonomyFormUsesCompletePanel(changed, entity, contract, entry.surfaces));
  }
  check("taxonomy-panel", `${entity} rejects an unimplemented required presentation role added to the current contract`,
    !taxonomyFormUsesCompletePanel(source, entity, { ...contract, requirements: [...contract.requirements,
      { target: "unverified_future_required_role", requirement: "required", rationale: "Negative fixture: new required roles need executable conformance." }] }, entry.surfaces));
  const firstRequired = contract.requirements.findIndex(requirement => requirement.requirement === "required");
  assert.ok(firstRequired >= 0);
  check("taxonomy-panel", `${entity} rejects a required role whose declared owner no longer matches the rendered owner`,
    !taxonomyFormUsesCompletePanel(source, entity, { ...contract, requirements: contract.requirements.map((requirement, index) => index === firstRequired
      ? { ...requirement, owner: { sourceFile: "src/components/admin/ui/ParallelForm.tsx", exportName: "ParallelSection" } } : requirement) }, entry.surfaces));
}
// 4. Shared Select single-source Form contract.
check(
  "select-single-source",
  "shared form listbox contains exactly one native select source",
  occurrenceCount(formListbox, /<select\b/g) === 1 &&
    formListbox.includes("name={name}") &&
    !formListbox.includes('type="hidden"') &&
    formListbox.includes("data-admin-form-listbox"),
);
check(
  "select-single-source",
  "shared form listbox owns RTL, search, and async states",
  [
    'dir = "rtl"',
    "dir={dir}",
    "search",
    "loading",
    "error",
    "disabled",
  ].every((token) => formListbox.toLowerCase().includes(token.toLowerCase())),
);
check(
  "select-single-source",
  "search is delegated to the shared open listbox instead of rendering as a permanent form field",
  !formListbox.includes('type="search"') &&
    formListbox.includes("searchable={searchable}") &&
    formListbox.includes("searchPlaceholder={searchPlaceholder}") &&
    listbox.includes('data-admin-listbox-popover=""') &&
    listbox.includes('data-admin-listbox-search=""') &&
    listbox.indexOf('data-admin-listbox-search=""') >
      listbox.indexOf('data-admin-listbox-popover=""'),
);
check(
  "select-single-source",
  "delegated listbox owns the required keyboard contract",
  [
    "ArrowDown",
    "ArrowUp",
    "Enter",
    "Escape",
  ].every((token) => listbox.includes(token)) &&
    formListbox.includes("AdminListboxSelect"),
);
check(
  "select-single-source",
  "taxonomy forms use the shared listbox without local native selects",
  categoryForm.includes("AdminFormListboxSelect") &&
    seriesForm.includes("AdminFormListboxSelect") &&
    !categoryForm.includes("<select") &&
    !seriesForm.includes("<select"),
);
check(
  "select-single-source",
  "relation validation focuses the visible listbox trigger and keeps it interactive",
    formListbox.includes("focusTargetId") &&
    formListbox.includes("triggerId={focusTargetId}") &&
    formListbox.includes("ariaInvalid={Boolean(error)}") &&
    formListbox.includes("const unavailable = options.length === 0") &&
    formListbox.includes("disabled={disabled || loading}") &&
    categoryForm.includes('focusTargetId="parent_id"') &&
    seriesForm.includes('focusTargetId="category_id"') &&
    taxonomyFormActions.includes("messages.length > 0") &&
    taxonomyFormActions.includes("{ parent_id: [parentError] }") &&
    taxonomyFormActions.includes("{ category_id: [categoryError] }"),
);
check(
  "select-single-source",
  "category keeps the empty parent option while both taxonomy consumers expose no local search input",
  categoryForm.includes('{ value: "", label: "بدون تصنيف أب" }') &&
    !categoryForm.includes('type="search"') &&
    !seriesForm.includes('type="search"'),
);

// 5. Slug create/edit lock contract, including pure input behavior.
const categoryAutoSlug = slugifyFromTitle("Sample Category");
check(
  "slug-policy",
  "category create derives a valid slug when the field is empty",
  categoryAutoSlug === "sample-category" &&
    validateSlugFormat(categoryAutoSlug) === null &&
    occurrenceCount(
      taxonomyFormValidation,
      /slug:\s*rawSlug\s*\|\|\s*slugifyFromTitle\(name\)/g,
    ) === 2,
  categoryAutoSlug,
);
const seriesManualSlug = "manual-series-slug";
check(
  "slug-policy",
  "series create preserves a valid manually edited slug",
  validateSlugFormat(seriesManualSlug) === null &&
    taxonomyFormValidation.includes("const rawSlug = taxonomyFormDataValue"),
);
check(
  "slug-policy",
  "shared validation rejects malformed slugs",
  validateSlugFormat("Bad Slug!") !== null &&
    taxonomyFormValidation.includes("validateSlugFormat(value)"),
);
check(
  "slug-policy",
  "Article and Media topic payloads reuse the canonical slug owner",
  [articleTopicHelpers, mediaTopicHelpers].every(
    (source) =>
      source.includes('import { slugifyFromTitle } from "../../../../../lib/admin/slug"') &&
      !source.includes("normalizeArabicForSlug") &&
      !source.includes("export function createSlug"),
  ),
);
check(
  "slug-policy",
  "category and Series present their immutable slug on create only",
  categoryForm.includes("{!isEdit ? (") &&
    categoryForm.includes('mode === "edit"') &&
    seriesForm.includes('mode === "edit"') &&
    seriesForm.includes("{!isEdit ? (") &&
    !categoryForm.includes("readOnly={isEdit}") &&
    !seriesForm.includes("readOnly={isEdit}"),
);
const updateCategory = exportedFunctionSlice(
  taxonomyFormActions,
  "updateCategoryForm",
);
const updateSeries = exportedFunctionSlice(
  taxonomyFormActions,
  "updateSeriesForm",
);
check(
  "slug-policy",
  "server update actions do not accept a replacement slug",
  updateCategory.length > 0 &&
    updateSeries.length > 0 &&
    updateCategory.includes("slug: current.slug") &&
    updateSeries.includes("slug: current.slug") &&
    !updateCategory.includes("slug: rawInput.slug") &&
    !updateSeries.includes("slug: rawInput.slug"),
);

// 6. Shared form viewport + inline entity-list feedback contract.
check(
  "feedback",
  "feedback provider exposes shared publisher, hook, and viewport, and the runtime publishes through it",
  feedbackProvider.includes("AdminFeedbackProvider") &&
    feedbackProvider.includes("AdminFeedbackViewport") &&
    feedbackProvider.includes("useAdminFeedback") &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("publishFeedback"),
);
check(
  "feedback",
  "feedback viewport is fixed and success replacement is state-owned",
  feedbackProvider.includes("fixed") &&
    /set(?:Entries|Feedback|Items|Notices)/.test(feedbackProvider) &&
    feedbackProvider.includes('feedback.variant === "success"'),
);
check(
  "feedback",
  "feedback clears mobile sticky actions and returns to the desktop bottom rail",
  feedbackProvider.includes("top-4 bottom-auto") &&
    feedbackProvider.includes("sm:top-auto sm:bottom-6"),
);
check(
  "feedback",
  "feedback policies publish dismissible action outcomes without an auto-dismiss duration",
  !read("src/lib/admin/admin-action-feedback.ts").includes('lifecycle: "auto"') &&
    !read("src/lib/admin/admin-action-feedback.ts").includes("autoDismissMs: 5_000") &&
    noticeFrame.includes("ariaLive"),
);
check(
  "feedback",
  "form-level feedback stays global while field validation stays local",
  runtime.includes("useAdminFeedback") &&
    !runtime.includes("useOptionalAdminFeedback") &&
    runtime.includes("publishFeedback") &&
    runtime.includes("hasFieldErrors") &&
    runtime.includes('state.status === "error" && hasFieldErrors') &&
    categoryForm.includes("AdminFormError") &&
    seriesForm.includes("AdminFormError"),
);
check(
  "feedback",
  "entity lists publish through the shared global viewport without reserving page space",
  feedbackProvider.includes("AdminFeedbackViewport") &&
    feedbackProvider.includes("data-admin-feedback-viewport") &&
    feedbackProvider.includes('entry.placement === "global"') &&
    !feedbackProvider.includes("stabilizeLayout") &&
    !feedbackProvider.includes('h-[72px]') &&
    entityList.includes("useAdminFeedback") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes('placement: "global"') &&
    !entityList.includes("AdminFeedbackChannelViewport"),
);
check(
  "feedback",
  "feedback runtime owns inline smart reveal and reduced-motion focus",
  feedbackProvider.includes("latestEntry?.reveal") &&
    feedbackProvider.includes("getBoundingClientRect") &&
    feedbackProvider.includes("scrollIntoView") &&
    feedbackProvider.includes("prefers-reduced-motion: reduce") &&
    feedbackProvider.includes('prefersReducedMotion ? "auto" : "smooth"') &&
    feedbackProvider.includes("focus({ preventScroll: true })") &&
    entityList.includes("options.bulk === true") &&
    entityList.includes('result.code === "deleted"'),
);

// 7. Categories list query contract.
check(
  "categories-query",
  "categories adapter delegates to exactly one admin_list_categories RPC",
  /\.rpc\(\s*"admin_list_categories"/.test(categoryAdapter) &&
    occurrenceCount(categoryAdapter, /\.rpc\(/g) === 1 &&
    !categoryAdapter.includes("loadCategoriesListData") &&
    !categoryAdapter.includes(".slice("),
);
check(
  "categories-query",
  "categories read model owns search, filters, sorting, pagination, counts, and normalized page",
  [
    "admin_list_categories",
    "p_search",
    "p_status",
    "p_sort_field",
    "p_sort_direction",
    "p_page",
    "p_page_size",
    "total_count",
  ].every((token) => migration.includes(token)) &&
    migration.includes("normalized_state") &&
    migration.includes("'page'") &&
    migration.includes("metrics"),
);

// 8. Series list query contract.
check(
  "series-query",
  "series adapter delegates to exactly one admin_list_series RPC",
  /\.rpc\(\s*"admin_list_series"/.test(seriesAdapter) &&
    occurrenceCount(seriesAdapter, /\.rpc\(/g) === 1 &&
    !seriesAdapter.includes("loadSeriesListData") &&
    !seriesAdapter.includes(".slice("),
);
check(
  "series-query",
  "series read model owns search, status/category filters, sorting, pagination, counts, and normalized page",
  [
    "admin_list_series",
    "p_search",
    "p_status",
    "p_category_id",
    "p_sort_field",
    "p_sort_direction",
    "p_page",
    "p_page_size",
    "total_count",
  ].every((token) => migration.includes(token)) &&
    migration.includes("normalized_state") &&
    migration.includes("'page'") &&
    migration.includes("metrics"),
);

// 9. Mutation rollback / atomicity contracts.
for (const rpc of [
  "admin_update_topic_category",
  "admin_update_topic_series",
]) {
  check(
    "mutation-atomicity",
    `${rpc} is extended by the P1-E additive taxonomy migration`,
    consistencyMigration.includes(`function public.${rpc}`) &&
      consistencyMigration.includes("p_expected_updated_at timestamp with time zone") &&
      consistencyMigration.includes("'code', 'revision_conflict'"),
  );
  check(
    "mutation-atomicity",
    `${rpc} is called by the taxonomy mutation DAL`,
    new RegExp(`\\.rpc\\(\\s*["']${rpc}["']`).test(taxonomyMutations),
  );
}
for (const rpc of [
  "admin_move_topic_categories_to_trash",
  "admin_restore_topic_categories",
  "admin_permanently_delete_topic_categories",
  "admin_move_topic_series_to_trash",
  "admin_restore_topic_series",
  "admin_permanently_delete_topic_series",
]) {
  check(
    "mutation-atomicity",
    `${rpc} is defined by the lifecycle migration`,
    lifecycleMigration.includes(`function public.${rpc}`),
  );
  check(
    "mutation-atomicity",
    `${rpc} is called by the taxonomy mutation DAL`,
    taxonomyMutations.includes(`"${rpc}"`) &&
      taxonomyMutations.includes(".rpc(rpcName"),
  );
}
check(
  "mutation-atomicity",
  "atomic DAL contains no split client-side topics write",
  !taxonomyMutations.includes('.from("topics").update') &&
    !taxonomyMutations.includes('.from("topic_categories").update') &&
    !taxonomyMutations.includes('.from("topic_series").update'),
);
check(
  "mutation-atomicity",
  "category and series update actions delegate to atomic helpers",
  updateCategory.includes("updateTopicCategoryAtomically") &&
    updateSeries.includes("updateTopicSeriesAtomically") &&
    updateCategory.includes("expectedUpdatedAt: expectedRevision.value") &&
    updateSeries.includes("expectedUpdatedAt: expectedRevision.value"),
);
check(
  "mutation-atomicity",
  "Series create delegates validation and insertion to one governing RPC result",
  taxonomyMutations.includes('"admin_create_topic_series"') &&
    consistencyMigration.includes("function public.admin_create_topic_series") &&
    consistencyMigration.includes("for share") &&
    consistencyMigration.includes("insert into public.topic_series") &&
    createSeries.includes("createTopicSeriesAtomically") &&
    !createSeries.includes('.from("topic_series")'),
);
check(
  "mutation-atomicity",
  "Series create rejection returns before success audit and revalidation",
  createSeries.indexOf("if (!mutation.ok)") !== -1 &&
    createSeries.indexOf("if (!mutation.ok)") <
      createSeries.indexOf("await recordCmsAdminAudit") &&
    createSeries.indexOf("await recordCmsAdminAudit") <
      createSeries.indexOf("revalidateTaxonomyPaths"),
);
check(
  "lifecycle-owner",
  "Category and Series lifecycle actions delegate to the shared atomic Taxonomy owner",
  categoryActions.includes("moveTopicCategoriesToTrashAtomically") &&
    categoryActions.includes("restoreTopicCategoriesAtomically") &&
    categoryActions.includes("permanentlyDeleteTopicCategoriesAtomically") &&
    seriesActions.includes("moveTopicSeriesToTrashAtomically") &&
    seriesActions.includes("permanentlyDeleteTopicSeriesAtomically") &&
    seriesActions.includes("restoreTopicSeriesAtomically"),
);
check(
  "lifecycle-owner",
  "Lifecycle paths do not write taxonomy or Topic relationships directly",
  !exportedFunctionSlice(seriesActions, "deleteSeriesAjax").includes(
    '.from("topics")',
  ) &&
    !exportedFunctionSlice(seriesActions, "bulkSeriesActionAjax").includes(
      '.from("topics")',
    ) &&
    !exportedFunctionSlice(seriesActions, "deleteSeriesAjax").includes(
      '.from("topic_series").delete',
    ) &&
    !exportedFunctionSlice(seriesActions, "bulkSeriesActionAjax").includes(
      '.from("topic_series").delete',
    ) &&
    !seriesActions.includes("admin_list_series") &&
    !seriesActions.includes("unstable_cache") &&
    !categoryActions.includes('.from("topics").update') &&
    !taxonomyMutations.includes('"admin_delete_topic_category"') &&
    !taxonomyMutations.includes('"admin_delete_topic_series"'),
);
check(
  "lifecycle-relationships",
  "Lifecycle migration retires hard-delete RPCs and never transfers, detaches, or cascades Topic relationships",
  lifecycleMigration.includes(
    "drop function if exists public.admin_delete_topic_category",
  ) &&
    lifecycleMigration.includes(
      "drop function if exists public.admin_delete_topic_series",
    ) &&
    lifecycleMigration.includes("categories still have linked topics") &&
    lifecycleMigration.includes("series still have linked topics") &&
    !lifecycleMigration.includes("update public.topics") &&
    !lifecycleMigration.includes("delete from public.topics"),
);
check(
  "lifecycle-slugs",
  "Trash keeps unique slugs reserved and permanent deletion is the only row delete",
  lifecycleMigration.includes("taxonomy lifecycle requires topic_categories_slug_key") &&
    lifecycleMigration.includes("taxonomy lifecycle requires topic_series_slug_key") &&
    lifecycleMigration.includes("deleted_at = statement_timestamp()") &&
    occurrenceCount(lifecycleMigration, /delete from public\.topic_categories/g) === 1 &&
    occurrenceCount(lifecycleMigration, /delete from public\.topic_series/g) === 1,
);
check(
  "mutation-rollback",
  "generic mutation runtime cancels requests and restores exact snapshots",
  instantMutation.includes("cancelQueries") &&
    instantMutation.includes("snapshot") &&
    instantMutation.includes("restoreSnapshot") &&
    instantMutation.includes("invalidateQueries"),
);
check(
  "mutation-rollback",
  "taxonomy list consumers use the shared scoped instant-mutation runtime",
  categoryClient.includes("useAdminEntityInstantMutation") &&
    seriesClient.includes("useAdminEntityInstantMutation") &&
    instantMutationCache.includes("setAdminEntityListCachesInScope") &&
    !categoryClient.includes("router.refresh") &&
    !seriesClient.includes("router.refresh"),
);
check(
  "collection-interaction",
  "pending presentation identifies rowId plus action without a shared global mutation lock",
  [categoryClient, seriesClient].every(
    (source) =>
      source.includes("rowInteraction: instant.getRowInteraction") &&
      !source.includes("instant.rowPending") &&
      !source.includes("instant.bulkPending"),
  ) &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes('pendingAction === "visibility"') &&
        source.includes('pendingAction === "duplicate"') &&
        source.includes(
          'pendingAction === (isTrashView ? "permanent_delete" : "delete")',
        ) &&
        source.includes("interaction.pendingAction") &&
        !source.includes("interaction.isBlocked") &&
        !source.includes("localPending"),
    ),
);
check(
  "collection-interaction",
  "Categories and Series delegate visibility icon, tone, label, accessibility, and pending presentation",
  dataGrid.includes('action === "visibility"') &&
    dataGrid.includes("resolveAdminDataGridVisibilityAction") &&
    dataGrid.includes('tone: "dark" as const') &&
    dataGrid.includes('tone: "green" as const') &&
    dataGrid.includes("resolvedAriaPressed") &&
    dataGrid.includes("data-admin-visibility-state") &&
    rowActions.includes('dataGridAction: "visibility"') &&
    rowActions.includes('label: isVisible ? "إخفاء" : "إظهار"') &&
    rowActions.includes("isCurrentlyHidden: !isVisible") &&
    rowActions.includes("aria-busy={target.pending || undefined}") &&
    [categoryRowActions, seriesColumns].every(
      (source) =>
        source.includes("AdminDataGridRowActions") &&
        source.includes("isVisible:") &&
        !source.includes("title={isHidden") &&
        !source.includes("title={isActive") &&
        !source.includes("tone={isHidden") &&
        !source.includes("tone={isActive"),
    ),
);
check(
  "collection-interaction",
  "taxonomy collection outcomes use one shared feedback channel and no local notice engine",
  feedbackProvider.includes("AdminFeedbackChannelViewport") &&
    feedbackProvider.includes("entry.channel === channel") &&
    feedbackProvider.includes("entry.placement === placement") &&
    entityList.includes("publishFeedback(nextFeedback") &&
    entityList.includes('placement: "global"') &&
    [categoryRowActions, seriesColumns].every(
      (source) => !source.includes("AdminNotice"),
    ),
);
check(
  "collection-interaction",
  "Category and Series Preview/Public use the shared capability entry point with only proven routes",
  previewActions.includes('presentation === "data-grid-compact"') &&
    previewAdapters.includes("buildAdminCategoryCollectionPreviewCapability") &&
    previewAdapters.includes("/topics?category=") &&
    previewAdapters.includes('publicViewPublicationPolicy: "always"') &&
    previewAdapters.includes("buildAdminSeriesCollectionPreviewCapability") &&
    previewAdapters.includes("/admin/content/topics?series=") &&
    previewAdapters.includes("publicView: null") &&
    categoryRowActions.includes("AdminEntityPreviewActions") &&
    seriesColumns.includes("AdminEntityPreviewActions") &&
    interactionManifest.includes('status: "adopted"') &&
    !categoryRowActions.includes("previewHref") &&
    !seriesColumns.includes("topicsPreviewHref"),
);

const sections = new Map<string, { passed: number; total: number }>();
for (const result of checks) {
  const current = sections.get(result.section) ?? { passed: 0, total: 0 };
  current.total += 1;
  if (result.ok) current.passed += 1;
  sections.set(result.section, current);
}

console.log("\nContent Taxonomy verification summary:");
for (const [section, result] of sections) {
  console.log(` - ${section}: ${result.passed}/${result.total}`);
}

const failures = checks.filter((result) => !result.ok);
if (failures.length) {
  throw new assert.AssertionError({
    message: `${failures.length} Content Taxonomy contract checks failed`,
    actual: failures.map((failure) => `[${failure.section}] ${failure.label}`),
    expected: [],
  });
}

console.log(`verify:content-taxonomy passed (${checks.length} assertions)`);
