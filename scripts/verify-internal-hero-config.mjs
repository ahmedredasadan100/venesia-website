/**
 * Verifies internal hero content-control parsing contracts.
 * Keep in sync with src/lib/hero/hero-content-controls.ts
 */

import { readFileSync } from "node:fs";
import strictAssert from "node:assert/strict";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import { Children, Fragment, createElement, isValidElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getModuleEditorSectionMetadata, MODULE_EDITOR_TAB_LABELS } from "../src/lib/page-composition/module-registry-metadata.ts";

import {
  DEFAULT_HERO_ELEMENT_ORDER,
  HERO_MEDIA_GEOMETRY,
  HERO_VARIANTS,
  heroFlexJustifyClass,
  normalizeHeroElementOrder,
  normalizeHeroTemplateProductConfig,
  parseOptionalBool,
  parseHeroTextAlignment,
  parseHeroContentControlsFormData,
  resolveDistinctHeroDescription,
  resolveHeroContentControls,
  resolveHeroContentControlsForVariant,
  resolveHeroFamily,
  resolveHeroImageCompositionPreset,
  resolveHeroMediaSlot,
} from "../src/lib/hero/hero-content-controls.ts";

if (process.argv.includes("--media-owner-capabilities")) {
  verifyMediaOwnerCapabilities();
  process.exit(0);
}

function verifyMediaOwnerCapabilities() {
  const assert = strictAssert;
  const read = path => readFileSync(resolve(path), "utf8");
  const checks = [];
  const check = (name, verify) => { verify(); checks.push(name); console.log(`PASS ${name}`); };
  const gallerySource = read("src/components/admin/media/AdminMediaGalleryField.tsx");
  const heroSource = read("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx");
  const introSource = read("src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx");
  const tree = (file, value) => ts.createSourceFile(file, value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const allNodes = sourceFile => {
    const result = [];
    function visit(node) { result.push(node); ts.forEachChild(node, visit); }
    visit(sourceFile);
    return result;
  };
  const galleryTree = tree("Gallery.tsx", gallerySource);
  const declaration = (sourceFile, name) => {
    const matches = allNodes(sourceFile).filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(matches.length, 1, `Actual owner callback ${name}`);
    return matches[0].getText(sourceFile).replace(/^export\s+default\s+|^export\s+/u, "");
  };
  const enabled = (node, name, sourceFile) => {
    const value = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(sourceFile) === name);
    return Boolean(value && (!value.initializer || ts.isJsxExpression(value.initializer) && value.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword));
  };
  const heroCapabilities = source => {
    const sourceFile = tree("Hero.tsx", source);
    const galleries = allNodes(sourceFile).filter(node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === "AdminImagePathListField");
    return galleries.length === 2 && galleries.every(node => enabled(node, "enableDragDrop", sourceFile) && enabled(node, "dragFromImage", sourceFile));
  };
  check("Hero Desktop/Mobile adopt existing Gallery drag capabilities without replacing ordered native path bindings", () => {
    assert.equal(read("src/components/admin/page-blocks/AdminImagePathListField.tsx").trim(), 'export { default } from "../media/AdminMediaGalleryField";');
    assert.ok(heroCapabilities(heroSource));
    for (const port of ["enableDragDrop", "dragFromImage"]) {
      assert.ok(!heroCapabilities(heroSource.replace(`                          ${port}\r\n`, "").replace(`                          ${port}\n`, "")), `Omitted ${port} fails the same adoption check`);
      assert.ok(!heroCapabilities(heroSource.replace(port + "\r\n", port + "={false}\r\n").replace(port + "\n", port + "={false}\n")));
    }
    for (const binding of ['name="images"', 'defaultValue={imagesText}', 'name="mobile_images"', 'defaultValue={mobileImagesText}', 'resolveHeroMediaSlot(guidanceVariant, "desktop")', 'resolveHeroMediaSlot(guidanceVariant, "mobile")']) assert.ok(heroSource.includes(binding));
  });

  const introTree = tree("AboutIntro.tsx", introSource);
  check("Content Home Story preserves its applicable ordered image and Alt swap while fixed semantic slots stay fixed", () => {
    let state = { main: "/main.webp", secondary: "/secondary.webp", mainAlt: "Main Alt", secondaryAlt: "Secondary Alt" };
    const swap = new Function("setHomeStoryImages", ts.transpileModule(declaration(introTree, "swapHomeStoryImages"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn swapHomeStoryImages;")(update => { state = update(state); });
    swap(); assert.deepEqual(state, { main: "/secondary.webp", secondary: "/main.webp", mainAlt: "Secondary Alt", secondaryAlt: "Main Alt" });
    swap(); assert.deepEqual(state, { main: "/main.webp", secondary: "/secondary.webp", mainAlt: "Main Alt", secondaryAlt: "Secondary Alt" });
    assert.equal((introSource.match(/onClick=\{swapHomeStoryImages\}/gu) ?? []).length, 2);
    for (const field of ["image_main", "image_secondary", "image_main_alt", "image_secondary_alt"]) assert.ok(introSource.includes(`"${field}"`));
    for (const slot of ["main", "secondary", "accent"]) assert.ok(introSource.includes(`{ key: "${slot}", altKey: "${slot}Alt"`));
    assert.ok(!introSource.includes("AdminMediaGalleryField"), "Named Content slots are not converted into an unordered generic Gallery");
  });

  const compiledGallery = ts.transpileModule(["parsePaths", "normalizeItems", "resolveDefaultItems", "getDefaultKey", "AdminMediaGalleryField"].map(name => declaration(galleryTree, name)).join("\n"), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
  const handleTree = tree("AdminDataGrid.tsx", read("src/components/admin/ui/AdminDataGrid.tsx"));
  const Handle = new Function("React", ts.transpileModule(declaration(handleTree, "AdminDataGridReorderHandle"), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn AdminDataGridReorderHandle;")({ createElement });
  const ImageField = () => null;
  const Picker = () => null;
  const Stub = () => null;
  const rows = ["a", "b", "c"].map(key => ({ key, url: `/${key}.webp`, alt: `Alt ${key}`, caption: `Caption ${key}` }));
  function fixture({ controlled = false, runtimePending = false, nativePending = false, fieldsetPending = false, fieldErrors = {}, ...ports } = {}) {
    let slots = [], cursor = 0, effects = [], rendered, controlledRows = rows.map(item => ({ ...item })), controlledCalls = 0, dirtySignals = 0;
    const flags = { runtimePending, nativePending, fieldsetPending };
    const state = initializer => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initializer === "function" ? initializer() : initializer;
      return [slots[index], update => { slots[index] = typeof update === "function" ? update(slots[index]) : update; }];
    };
    const ref = initial => { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; };
    const effect = (callback, deps) => {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, itemIndex) => value !== previous[itemIndex])) effects.push(callback);
      slots[index] = deps;
    };
    const Element = class {};
    const Gallery = new Function("React", "useState", "useRef", "useLayoutEffect", "useFormStatus", "useOptionalAdminFormRuntime", "useAdminMediaReferenceState", "AdminDataGridReorderHandle", "AdminMediaImageField", "AdminMediaPickerModal", "AdminCard", "AdminModuleSectionHeader", "AdminMediaSlotGuidance", "AdminFormError", "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "Element", "Node", compiledGallery + "\nreturn AdminMediaGalleryField;")(
      { createElement, Fragment }, state, ref, effect, () => ({ pending: flags.nativePending }), () => ({ pending: flags.runtimePending, fieldErrors }), () => ({ available: true, deleted: [], missing: [], originals: [] }), Handle, ImageField, Picker, Stub, Stub, Stub, Stub, "canonical-charcoal", Element, Element,
    );
    const nodes = () => {
      const result = [];
      const visit = value => {
        if (!isValidElement(value)) return;
        result.push(value);
        for (const child of Children.toArray(value.props.children)) visit(child);
        if (value.props.previewOverlay) visit(value.props.previewOverlay);
      };
      visit(rendered); return result;
    };
    const render = () => {
      cursor = 0; effects = [];
      const identity = (item, index) => createElement("input", { key: item.key, type: "hidden", name: "domain_identity", value: `id-${item.key}`, "data-native-index": index });
      rendered = Gallery({ label: "Gallery", name: "gallery_url", valueMode: "items", altName: "gallery_alt", captionName: "gallery_caption", focusTargetId: "gallery-focus", altFocusTargetId: "gallery-alt-focus", ...(controlled ? { controlledItems: controlledRows, onItemsChange: update => { controlledRows = update(controlledRows); controlledCalls++; }, renderItemProjection: identity } : { defaultItems: rows }), ...ports });
      for (const node of nodes()) {
        if (node.props.ref) node.props.ref.current = node.type === "input" ? { dispatchEvent: event => { assert.equal(event.type, "input"); assert.equal(event.bubbles, true); dirtySignals++; } } : { closest: selector => { assert.equal(selector, "fieldset:disabled"); return flags.fieldsetPending ? {} : null; } };
      }
      for (const callback of effects) callback();
      return rendered;
    };
    render();
    return { nodes, render, flags, images: () => nodes().filter(node => node.type === ImageField), handles: () => nodes().filter(node => node.type === Handle), cards: () => nodes().filter(node => node.props["data-admin-media-gallery-card"] === "image"), action: name => nodes().filter(node => node.props["data-admin-media-gallery-action"] === name), picker: () => nodes().find(node => node.type === Picker), read: () => ({ controlledRows, controlledCalls, dirtySignals }) };
  }
  const event = () => ({ prevented: 0, stopped: 0, dataTransfer: { effectAllowed: "", dropEffect: "", setData() {} }, preventDefault() { this.prevented++; }, stopPropagation() { this.stopped++; } });
  const tuples = test => test.images().map(node => ({ url: node.props.value, alt: node.props.altValue, caption: node.props.captionValue }));
  const expected = order => order.map(key => { const row = rows.find(item => item.key === key); return { url: row.url, alt: row.alt, caption: row.caption }; });
  const order = (test, value) => assert.deepEqual(tuples(test), expected(value));
  check("Gallery omitted functional defaults and ordered path projection remain unchanged; controlled identity permits repeated URLs", () => {
    const bindings = allNodes(galleryTree).filter(node => ts.isBindingElement(node));
    for (const [name, value] of [["enableDragDrop", "false"], ["dragFromImage", "false"], ["allowAdd", "true"], ["allowReplace", "true"], ["allowRemove", "true"], ["allowReorder", "true"], ["showAlt", "true"], ["showCaption", "true"], ["selectionMode", '"single"'], ["density", '"default"'], ["presentation", '"default"'], ["actionPresentation", '"default"']]) assert.equal(bindings.find(node => node.name.getText(galleryTree) === name)?.initializer?.getText(galleryTree), value, `Omitted ${name}`);
    const paths = fixture({ valueMode: "paths", defaultValue: "/first.webp\n/second.webp", defaultItems: undefined });
    const projection = () => paths.nodes().find(node => node.type === "input" && node.props.name === "gallery_url").props.value;
    assert.equal(projection(), "/first.webp\n/second.webp");
    paths.action("move-down")[0].props.onClick(); paths.render(); assert.equal(projection(), "/second.webp\n/first.webp");
    const duplicates = fixture({ controlledItems: [{ ...rows[0], key: "persisted-1" }, { ...rows[0], key: "persisted-2", alt: "Distinct Alt" }], onItemsChange: () => {}, controlled: false });
    assert.equal(duplicates.images().length, 2);
    assert.deepEqual(duplicates.cards().map(node => node.props["data-gallery-item-key"]), ["persisted-1", "persisted-2"]);
    assert.equal(duplicates.images()[1].props.altValue, "Distinct Alt");
  });
  check("Actual Gallery owned and controlled modes move full tuples through arrows, shared keyboard handle and native image drag", () => {
    for (const controlled of [false, true]) {
      const test = fixture({ controlled, enableDragDrop: true, dragFromImage: true });
      order(test, ["a", "b", "c"]);
      assert.equal(test.action("move-up")[0].props.disabled, true);
      assert.equal(test.action("move-down")[2].props.disabled, true);
      test.action("move-down")[0].props.onClick(); test.render(); order(test, ["b", "a", "c"]);
      assert.equal(test.read().dirtySignals, 1);
      const keyEvent = { key: "End", preventDefault() {} };
      Handle(test.handles()[1].props).props.onKeyDown(keyEvent); test.render(); order(test, ["b", "c", "a"]);
      const start = event(); test.images()[2].props.previewSurfaceProps.onDragStart(start);
      assert.equal(start.dataTransfer.effectAllowed, "move");
      const drop = event(); test.cards()[0].props.onDragOver(drop); test.cards()[0].props.onDrop(drop); test.render(); order(test, ["a", "b", "c"]);
      assert.equal(drop.prevented, 2); assert.equal(test.read().dirtySignals, 3);
      if (controlled) {
        assert.equal(test.read().controlledCalls, 3);
        assert.deepEqual(test.nodes().filter(node => node.type === "input" && node.props.name === "domain_identity").map(node => node.props.value), ["id-a", "id-b", "id-c"]);
      }
      const before = test.read().dirtySignals;
      test.action("move-up")[0].props.onClick(); test.action("move-down")[2].props.onClick();
      test.render(); order(test, ["a", "b", "c"]); assert.equal(test.read().dirtySignals, before);
      const external = event(); test.cards()[1].props.onDrop(external); test.render(); order(test, ["a", "b", "c"]); assert.equal(external.prevented, 0);
    }
  });
  check("Actual Gallery honors functional flags and locks native drag, keyboard, picker and tuple updates during every existing Pending owner", () => {
    for (const lock of ["runtimePending", "nativePending", "fieldsetPending", "disabled"]) {
      const test = fixture({ controlled: true, enableDragDrop: true, dragFromImage: true, [lock]: true });
      test.action("move-down")[0].props.onClick();
      Handle(test.handles()[0].props).props.onKeyDown({ key: "End", preventDefault() {} });
      const start = event(); test.images()[0].props.previewSurfaceProps.onDragStart(start); assert.equal(start.prevented, 1);
      test.cards()[2].props.onDrop(event());
      test.images()[0].props.onRemove(); test.images()[0].props.onReplace(); test.images()[0].props.onAltValueChange("Changed");
      test.action("add")[0].props.onClick(); test.picker().props.onSelect("/changed.webp");
      test.render(); order(test, ["a", "b", "c"]); assert.equal(test.read().controlledCalls, 0); assert.equal(test.read().dirtySignals, 0);
    }
    const omitted = fixture();
    assert.equal(omitted.handles().length, 0); assert.equal(omitted.images()[0].props.previewSurfaceProps, undefined);
    const blocked = fixture({ allowReorder: false, enableDragDrop: true, dragFromImage: true });
    assert.equal(blocked.handles().length, 0); assert.equal(blocked.action("move-up").length, 0);
    assert.equal(blocked.images()[0].props.previewSurfaceProps, undefined);
    const interrupted = fixture({ controlled: true, enableDragDrop: true, dragFromImage: true });
    interrupted.images()[0].props.previewSurfaceProps.onDragStart(event()); interrupted.flags.fieldsetPending = true;
    interrupted.cards()[2].props.onDrop(event()); interrupted.flags.fieldsetPending = false;
    interrupted.cards()[2].props.onDrop(event()); interrupted.render(); order(interrupted, ["a", "b", "c"]);
  });
  check("Controlled Gallery retains domain add/remove confirmation hooks and picker cancellation without owning a second ordered collection", () => {
    let requestedAdd = 0, requestedRemove = null;
    const test = fixture({ controlled: true, onRequestAdd: () => { requestedAdd++; }, onRequestRemove: key => { requestedRemove = key; } });
    test.action("add")[0].props.onClick(); test.images()[1].props.onRemove(); test.render();
    assert.equal(requestedAdd, 1); assert.equal(requestedRemove, "b"); order(test, ["a", "b", "c"]);
    assert.equal(test.read().controlledCalls, 0, "Domain confirms removal before the only item authority changes");
    test.images()[0].props.onReplace(); test.render(); assert.equal(test.picker().props.open, true);
    test.picker().props.onClose(); test.render(); assert.equal(test.picker().props.open, false); order(test, ["a", "b", "c"]);
    assert.equal(test.read().controlledCalls, 0);
    test.images()[0].props.onReplace(); test.render(); test.picker().props.onSelect("/replacement.webp"); test.render();
    assert.equal(test.read().controlledRows[0].key, "a"); assert.equal(test.read().controlledRows[0].url, "/replacement.webp"); assert.equal(test.read().controlledRows[0].alt, "Alt a");
    assert.equal(test.read().controlledCalls, 1);
  });
  check("Gallery default and domain error aliases retain native field names and the same actionable aggregate focus", () => {
    for (const custom of [false, true]) {
      const imageKey = custom ? "project_images" : "gallery_url", altKey = custom ? "project_image_alt" : "gallery_alt";
      const test = fixture({ controlled: custom, ...(custom ? { errorName: imageKey, altErrorName: altKey } : {}), fieldErrors: { [imageKey]: ["Image error"], [altKey]: ["Alt error"] } });
      assert.equal(test.nodes()[0].props["aria-describedby"], `${imageKey}-error ${altKey}-error`);
      assert.equal(test.images()[0].props.name, "gallery_url"); assert.equal(test.images()[0].props.altName, "gallery_alt");
      assert.equal(test.images()[0].props.ariaInvalid, true); assert.equal(test.images()[0].props.ariaDescribedBy, `${imageKey}-error`);
      assert.equal(test.images()[0].props.altDescribedBy, `${altKey}-error`);
      assert.equal(test.nodes().filter(node => node.type === Stub && node.props.name === imageKey).length, 1);
      assert.equal(test.nodes().filter(node => node.type === Stub && node.props.name === altKey).length, 1);
    }
  });
  console.log(JSON.stringify({ status: "pass", count: checks.length, checks, scope: "Actual shared Gallery function/callbacks, shared handle and bounded source contracts; authenticated browser/save/reload and named Content ID schema remain Pending.", globalClosed: false }));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// Legacy empty config defaults
const legacy = resolveHeroContentControls({});
assert(
  legacy.showEyebrow &&
    legacy.showTitle &&
    legacy.showHighlight &&
    legacy.showSubtitle,
  "legacy shows all elements",
);
assert(
  legacy.titleBold === true && legacy.eyebrowBold === false,
  "legacy bold defaults",
);
assert(
  legacy.highlightBold === false && legacy.subtitleBold === false,
  "highlight/subtitle bold defaults",
);
assert(
  legacy.eyebrowAlignment === "right" && legacy.titleAlignment === "right",
  "legacy alignment right",
);
assert(
  JSON.stringify(legacy.heroElementOrder) ===
    JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER),
  "default element order",
);

// Independent highlight/subtitle — parsing keeps both fields (render tests elsewhere)
assert(
  typeof legacy.showHighlight === "boolean" &&
    typeof legacy.showSubtitle === "boolean",
  "highlight and subtitle have independent show flags",
);

// Bool parsing
assert(
  parseOptionalBool("true") === true && parseOptionalBool("false") === false,
  "bool string parsing",
);
assert(
  parseOptionalBool(undefined) === undefined,
  "bool missing stays undefined",
);

// Alignment parsing
assert(parseHeroTextAlignment("left") === "left", "alignment left");
assert(parseHeroTextAlignment("junk") === "right", "alignment fallback");

// Order validation
assert(
  JSON.stringify(
    normalizeHeroElementOrder(["cta", "title", "cta", "bogus"]),
  ) ===
    JSON.stringify([
      "cta",
      "title",
      "eyebrow",
      "highlight",
      "subtitle",
      "description",
    ]),
  "order dedupe + append missing",
);
assert(
  JSON.stringify(normalizeHeroElementOrder('["subtitle","highlight"]')) ===
    JSON.stringify([
      "subtitle",
      "highlight",
      "eyebrow",
      "title",
      "description",
      "cta",
    ]),
  "order from JSON string",
);

// Legacy Explore data is read into the one canonical CTA contract.
const withLegacyExplore = resolveHeroContentControls({
  showExploreLink: false,
  exploreAlignment: "center",
  descriptionAlignment: "justify",
});
assert(
  withLegacyExplore.showCta === false,
  "legacy Explore visibility maps to CTA",
);
assert(
  withLegacyExplore.ctaAlignment === "center",
  "legacy Explore alignment maps to CTA",
);
assert(
  withLegacyExplore.descriptionAlignment === "justify",
  "description justify alignment",
);
assert(
  JSON.stringify(normalizeHeroElementOrder(["explore", "title"])) ===
    JSON.stringify([
      "cta",
      "title",
      "eyebrow",
      "highlight",
      "subtitle",
      "description",
    ]),
  "legacy Explore order maps to canonical CTA",
);

// Hidden reserved-space contract markers (static source check)
const heroSource = readFileSync(
  resolve("src/components/sections/DynamicHeroSection.tsx"),
  "utf8",
);
const projectDetailsHeroSource = readFileSync(
  resolve("src/components/projects/details/ProjectDetailsHero.tsx"),
  "utf8",
);
const heroVisibilitySource = readFileSync(
  resolve("src/components/admin/page-blocks/ModuleEditorPresentation.tsx"),
  "utf8",
);
const heroVisibilityAdapterSource = readFileSync(
  resolve(
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroVisibilityAlignRow.tsx",
  ),
  "utf8",
);
const heroEditorSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx"),
  "utf8",
);
const heroCtaEditorSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx"),
  "utf8",
);
const heroOrderEditorSource = readFileSync(
  resolve(
    "src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx",
  ),
  "utf8",
);
const adminLinkFieldSource = readFileSync(
  resolve("src/components/admin/ui/AdminLinkField.tsx"),
  "utf8",
);
const adminFormSwitchSource = readFileSync(
  resolve("src/components/admin/ui/AdminFormSwitch.tsx"),
  "utf8",
);
const adminTextFormatControlsSource = readFileSync(
  resolve("src/components/admin/ui/AdminTextFormatControls.tsx"),
  "utf8",
);
const heroTextFieldSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx"),
  "utf8",
);
const projectsHubEditorSource = readFileSync(
  resolve("src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx"),
  "utf8",
);
const mediaGuidanceSource = readFileSync(
  resolve("src/components/admin/media/AdminMediaSlotGuidance.tsx"),
  "utf8",
);
const mediaGallerySource = readFileSync(
  resolve("src/components/admin/media/AdminMediaGalleryField.tsx"),
  "utf8",
);
const mediaImageFieldSource = readFileSync(
  resolve("src/components/admin/media/AdminMediaImageField.tsx"),
  "utf8",
);

// Follow actual JSX ownership rather than the pre-adoption spelling of cards.
// These predicates also run against deliberate regressions below.
function heroCompositionAst(source) {
  const tree = ts.createSourceFile("HeroComposition.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tags = [];
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) tags.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return {
    tags: name => tags.filter(node => node.tagName.getText(tree) === name),
    attr: (node, name) => node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(tree) === name)?.initializer?.getText(tree),
    inside: (node, parent) => node.pos > parent.pos && node.end < (ts.isJsxOpeningElement(parent) ? parent.parent.end : parent.end),
    canonical: (name, suffix) => tree.statements.some(node => ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith(suffix) &&
      node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some(binding => binding.name.text === name && !binding.propertyName)),
  };
}

function hasCompactHeroSettings(source) {
  const row = source.slice(source.indexOf("export function ModuleEditorVisibilityAlignRow("), source.indexOf("export function ModuleEditorIdentitySection("));
  const ast = heroCompositionAst(row);
  const root = ast.tags("AdminCard").find(node => ast.attr(node, "presentation") === '"premium"');
  const header = ast.tags("div").find(node => ast.attr(node, "data-module-editor-settings-header") === '""');
  const body = ast.tags("div").find(node => ast.attr(node, "data-module-editor-settings-body") === '""');
  return Boolean(root && header && body && ast.inside(header, root) && ast.inside(body, root) && header.end < body.pos &&
    ast.tags("AdminFormControlHeader").some(node => ast.inside(node, header) && ast.attr(node, "presentation") === '"compact-inline"') &&
    ast.attr(header, "className") === '"flex min-w-0 flex-wrap items-center gap-1"' &&
    row.includes('data-module-editor-settings-composition="compact-inline"') &&
    row.includes('renderControls(`تنسيق ${label}`, "format", "compact")') &&
    row.includes('renderControls(`إظهار ${label}`, "visibility", "compact")') &&
    row.includes("{submittedValues}") && !row.includes("controlsPlacement"));
}

function hasHeroCtaSections(source) {
  const ast = heroCompositionAst(source);
  const row = ast.tags("HeroVisibilityAlignRow").find(node => ast.attr(node, "label") === '"تنسيق الأزرار"');
  const grid = ast.tags("AdminFormGrid").find(node => ast.attr(node, "columns") === "{2}" && row && ast.inside(node, row));
  return Boolean(ast.canonical("ModuleEditorSection", "/ModuleEditorPresentation") &&
    ["AdminFormGrid", "AdminFormField", "AdminLinkField"].every(name => ast.canonical(name, "/ui")) && grid &&
    ast.attr(row, "showName") === '"show_cta"' && ast.attr(row, "alignmentName") === '"cta_alignment"' && ast.attr(row, "boldName") === '"cta_bold"' &&
    ["primary", "secondary"].every((kind, index) => {
      const title = index === 0 ? "الزر الأساسي" : "الزر الثانوي";
      const section = ast.tags("ModuleEditorSection").find(node => ast.attr(node, "title") === JSON.stringify(title) && ast.inside(node, grid));
      const field = ast.tags("AdminFormField").find(node => section && ast.inside(node, section) && ast.attr(node, "label") === JSON.stringify(`نص ${title}`));
      return section && ast.attr(section, "className") === '"h-full"' && field &&
        ast.tags("AdminFormGrid").some(node => ast.inside(node, section) && ast.attr(node, "columns") === "{1}") &&
        ast.tags("input").some(node => ast.inside(node, field) && ast.attr(node, "name") === `"${kind}_cta_label"` &&
          ast.attr(node, "defaultValue") === `{${kind}Label}` && ast.attr(node, "maxLength") === "{100}" && ast.attr(node, "aria-label") === JSON.stringify(`نص ${title}`)) &&
        ast.tags("AdminLinkField").some(node => ast.inside(node, section) && ast.attr(node, "prefix") === `"${kind}_cta"` &&
          ast.attr(node, "defaultValue") === `{${kind}Link}` && ast.attr(node, "presentation") === '"inline"' &&
          ast.attr(node, "actionPresentation") === '"bare"' && ast.attr(node, "chooseLinkLabel") === '"اختيار الرابط"' && ast.attr(node, "clearLinkLabel") === '"مسح"');
    }));
}

function hasHeroImageComposition(source) {
  const ast = heroCompositionAst(source);
  const container = ast.tags("div").find(node => ast.attr(node, "data-hero-image-composition") === '""');
  const card = ast.tags("AdminCard").find(node => container && ast.inside(node, container) && ast.attr(node, "presentation") === '"premium"' && ast.attr(node, "className") === '"h-full p-3"');
  return Boolean(card && ast.tags("AdminFormListboxSelect").some(node => ast.inside(node, card) &&
    ast.attr(node, "name") === '"image_composition"' && ast.attr(node, "label") === '"تكوين الصورة"' &&
    ast.attr(node, "sizing") === '"full"' && ast.attr(node, "presentation") === '"panel"' &&
    ast.attr(node, "defaultValue") === "{imageComposition}" && ast.attr(node, "options") === "{HERO_IMAGE_COMPOSITION_OPTIONS_AR}") &&
    source.indexOf('data-hero-image-composition=""') < source.indexOf('data-hero-media-section="desktop"'));
}

function hasGalleryDimensionDelegation(gallerySource, imageSource, guidanceSource) {
  const gallery = heroCompositionAst(gallerySource);
  const image = heroCompositionAst(imageSource);
  return gallery.tags("AdminMediaImageField").some(node => gallery.attr(node, "mediaSlot") === "{mediaSlot}" &&
    gallery.attr(node, "value") === "{item.url}" && gallery.attr(node, "showGuidance") === "{panel && showGuidance}" &&
    gallery.attr(node, "dimensionsPresentation") === '{panel ? "disclosure" : "default"}') &&
    image.tags("AdminMediaOriginalDimensions").some(node => image.attr(node, "value") === "{value}" && image.attr(node, "state") === "{referenceState}") &&
    image.tags("AdminMediaSlotGuidance").some(node => image.attr(node, "slot") === "{mediaSlot}" && image.attr(node, "presentation") === '"disclosure"') &&
    guidanceSource.includes('slot.design?.kind !== "recommended"') && guidanceSource.includes("slot.design.width") && guidanceSource.includes("slot.design.height") &&
    !guidanceSource.includes("slot.display") && !guidanceSource.includes("slot.note");
}
const moduleRegistryMetadataSource = readFileSync(
  resolve("src/lib/page-composition/module-registry-metadata.ts"),
  "utf8",
);
const publicMediaImageSource = readFileSync(
  resolve("src/components/public/PublicMediaImage.tsx"),
  "utf8",
);
const globalStylesSource = readFileSync(resolve("src/app/globals.css"), "utf8");
const heroContractSource = readFileSync(
  resolve("src/lib/hero/hero-content-controls.ts"),
  "utf8",
);
const genericHeroActionSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/hero/actions.ts"),
  "utf8",
);
const projectsHeroActionSource = readFileSync(
  resolve("src/app/admin/pages-blocks/blocks/content/actions.ts"),
  "utf8",
);
const internalPageLayoutSource = readFileSync(
  resolve("src/components/InternalPageLayout.tsx"),
  "utf8",
);
const mediaCenterConfigSource = readFileSync(
  resolve("src/lib/media-center-page-config.ts"),
  "utf8",
);
const heroClosureMigration = readFileSync(
  resolve(
    "sql/migrations/20260822090000_hero_platform_product_preset_closure.sql",
  ),
  "utf8",
);
assert(
  heroSource.includes("data-hero-slot-visible"),
  "reserved-space attribute present",
);
assert(
  heroSource.includes('visibility: "hidden"') ||
    heroSource.includes("visibility: 'hidden'"),
  "uses visibility hidden",
);
assert(
  heroSource.includes("inert: true") || heroSource.includes("inert:true"),
  "uses boolean inert true",
);
assert(
  !/inert:\s*""/.test(heroSource) && !/inert:\s*''/.test(heroSource),
  "does not pass empty-string inert",
);
assert(
  heroSource.includes("Fragment"),
  "empty slots use Fragment to avoid flex gap wrappers",
);
assert(
  heroVisibilitySource.includes(
    "value={String(enableVisibility ? show : showDefault)}",
  ) &&
    heroVisibilitySource.includes(
      "onChange={(event) => setShow(event.target.checked)}",
    ) &&
    heroVisibilityAdapterSource.includes(
      "ModuleEditorVisibilityAlignRow as default",
    ),
  "Hero visibility controls persist explicit false state",
);
assert(
  heroVisibilitySource.includes("AdminTextFormatControls") &&
    adminTextFormatControlsSource.includes('data-admin-text-format-bold=""') &&
    adminTextFormatControlsSource.includes("aria-pressed={bold}") &&
    adminTextFormatControlsSource.includes(
      "onClick={() => onBoldChange(!bold)}",
    ) &&
    heroVisibilitySource.includes(
      "value={String(submittedBold)}",
    ) &&
    heroVisibilitySource.includes("preserveUnsetBold = false") &&
    heroVisibilitySource.includes("boldName && submittedBold !== undefined"),
  "Hero text weight uses one shared toolbar button and preserves the canonical submitted field",
);
assert(
  adminTextFormatControlsSource.includes(
    "data-admin-text-alignment={option.value}",
  ) &&
    adminTextFormatControlsSource.includes("<svg") &&
    adminTextFormatControlsSource.includes("<path d={option.path} />") &&
    !adminTextFormatControlsSource.includes('label: "يمين"') &&
    !adminTextFormatControlsSource.includes('label: "وسط"') &&
    !adminTextFormatControlsSource.includes('label: "يسار"'),
  "Hero text alignment uses icon-only segmented controls with accessible labels",
);
const heroPresentationControlBindings = [
  ["show_eyebrow", "showEyebrow"],
  ["eyebrow_bold", "eyebrowBold"],
  ["eyebrow_alignment", "eyebrowAlignment"],
  ["show_title", "showTitle"],
  ["title_bold", "titleBold"],
  ["title_alignment", "titleAlignment"],
  ["show_highlight", "showHighlight"],
  ["highlight_bold", "highlightBold"],
  ["highlight_alignment", "highlightAlignment"],
  ["show_subtitle", "showSubtitle"],
  ["subtitle_bold", "subtitleBold"],
  ["subtitle_alignment", "subtitleAlignment"],
  ["show_description", "showDescription"],
  ["description_alignment", "descriptionAlignment"],
  ["show_cta", "showCta"],
  ["cta_alignment", "ctaAlignment"],
  ["show_project_download_action", "showProjectDownloadAction"],
  ["show_project_tracking_action", "showProjectTrackingAction"],
  ["show_project_reservation_action", "showProjectReservationAction"],
  ["project_action_order", "projectActionOrder"],
];
const heroPresentationEditorSources = `${heroEditorSource}\n${heroCtaEditorSource}\n${heroOrderEditorSource}`;
const heroPresentationRendererSources = `${heroSource}\n${projectDetailsHeroSource}`;
assert(
  heroPresentationControlBindings.every(
    ([fieldName, propertyName]) =>
      heroPresentationEditorSources.includes(fieldName) &&
      heroContractSource.includes(fieldName) &&
      heroPresentationRendererSources.includes(propertyName),
  ),
  "Every visible Hero presentation control maps through the canonical parser into the shared renderer",
);
assert(
  hasCompactHeroSettings(heroVisibilitySource) &&
    !hasCompactHeroSettings(heroVisibilitySource.replace('data-module-editor-settings-header=""', 'data-unowned-header=""')) &&
    !hasCompactHeroSettings(heroVisibilitySource.replace('renderControls(`تنسيق ${label}`, "format", "compact")', "null")) &&
    !hasCompactHeroSettings(heroVisibilitySource.replace('renderControls(`إظهار ${label}`, "visibility", "compact")', "null")),
  "Hero controls retain the actual compact inline shared header, formatting, visibility and content body; missing owners fail",
);
assert(
  /<input\s+type="hidden"\s+name="template_description"/.test(heroEditorSource) &&
    heroEditorSource.includes("<ModuleEditorIdentitySection") &&
    heroEditorSource.includes('nameLabel="اسم الهيرو"') &&
    heroEditorSource.includes('name="variant"') &&
    heroEditorSource.includes('label="نمط العرض"') &&
    heroVisibilitySource.includes('data-module-editor-identity=""') &&
    heroVisibilitySource.includes('name="name"') &&
    heroVisibilitySource.includes("<ModuleEditorStatusSwitch") &&
    heroVisibilitySource.includes("surface={false}") &&
    adminFormSwitchSource.includes("ADMIN_FORM_SWITCH_COMPACT_SURFACE_CLASS_NAME"),
  "Hero identity delegates name, variant and status to the shared identity owner while preserving internal metadata",
);
assert(
  /<HeroTextFieldRow\s+label="الوصف"\s+name="description"[\s\S]*?preserveRichText/.test(heroEditorSource) &&
    heroEditorSource.includes('defaultValue={String(config.description ?? "")}') &&
    heroEditorSource.includes('boldName="description_bold"') &&
    !heroEditorSource.includes("<AdminRichTextEditor") &&
    heroTextFieldSource.includes('name={preserveRichText ? `${name}_editor` : name}') &&
    heroTextFieldSource.includes("value={text === initialText ? defaultValue : text}") &&
    heroTextFieldSource.includes("onChange={(event) => setText(event.target.value)}") &&
    heroTextFieldSource.includes("<HeroVisibilityAlignRow"),
  "Hero compact description retains original rich value until authored text changes and uses the shared Bold control",
);
assert(
  hasHeroCtaSections(heroCtaEditorSource) &&
    !hasHeroCtaSections(heroCtaEditorSource.replaceAll("ModuleEditorSection", "UnownedSection")) &&
    !hasHeroCtaSections(heroCtaEditorSource.replaceAll("AdminFormField", "UnownedField")) &&
    !hasHeroCtaSections(heroCtaEditorSource.replace('columns={2}', 'columns={1}')) &&
    !hasHeroCtaSections(heroCtaEditorSource.replace('prefix="secondary_cta"', 'prefix="primary_cta"')) &&
    heroVisibilitySource.includes(
      "value={String(enableVisibility ? show : showDefault)}",
    ) &&
    adminLinkFieldSource.includes('data-admin-link-field={presentation}') &&
    adminLinkFieldSource.includes('data-admin-link-destination=""'),
  "Hero CTA retains the canonical formatting row and two balanced Section/Field link groups; unowned fields, collapsed columns and duplicated link tuples fail",
);
assert(
  heroOrderEditorSource.includes('data-project-hero-action-cards=""') &&
    heroOrderEditorSource.includes("PROJECT_HERO_ACTION_VISIBILITY_FIELDS") &&
    heroOrderEditorSource.includes('name="project_action_order"') &&
    heroOrderEditorSource.includes("normalizeProjectHeroActionOrder") &&
    projectDetailsHeroSource.includes("showProjectActions") &&
    projectDetailsHeroSource.includes(
      "showDownload={resolvedPresentation.showProjectDownloadAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "showTracking={resolvedPresentation.showProjectTrackingAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "showReservation={resolvedPresentation.showProjectReservationAction}",
    ) &&
    projectDetailsHeroSource.includes(
      "order={resolvedPresentation.projectActionOrder}",
    ),
  "Project Detail adopts three compact independently ordered action cards through the shared Hero control contract",
);
assert(
  !heroSource.includes("HeroExploreLink"),
  "parallel Explore renderer removed",
);
assert(
  heroSource.includes(
    "inline-flex w-fit max-w-full whitespace-normal rounded-full",
  ) && heroSource.includes("heroPillAlignmentClass"),
  "Home Hero badges hug their content without losing responsive wrapping or alignment",
);
assert(
  heroSource.includes("usesHomeCinematicTypography") &&
    heroSource.includes(
      'activeConfig.highlightBold ? "font-semibold" : "font-normal"',
    ) &&
    heroSource.includes("sm:text-5xl md:text-6xl lg:text-7xl"),
  "Home Hero highlight retains the cinematic hierarchy while consuming its Bold field",
);
assert(
  heroSource.includes('activeConfig.titleBold ? "font-bold" : "font-normal"') &&
    heroSource.includes(
      'activeConfig.subtitleBold ? "font-bold" : "font-normal"',
    ) &&
    heroSource.includes("heroTextAlignClass(activeConfig.titleAlignment)") &&
    heroSource.includes("heroTextAlignClass(activeConfig.subtitleAlignment)"),
  "Special Hero title and subtitle consume their canonical Bold and alignment fields",
);
assert(
  globalStylesSource.includes("@layer base {") &&
    /@layer base \{[\s\S]*h1,[\s\S]*font-weight: 600;[\s\S]*p \{[\s\S]*font-weight: 400;[\s\S]*\}/u.test(
      globalStylesSource,
    ),
  "Base typography remains a fallback layer so Hero font-weight utilities win in computed CSS",
);
assert(
  heroSource.includes('config.titleAlignment === "center"') &&
    heroSource.includes('? "mx-auto"') &&
    heroSource.includes('config.titleAlignment === "left"') &&
    heroSource.includes('? "mr-auto"'),
  "Standard Internal title alignment moves the bounded title block as well as its text",
);
assert(
  (heroEditorSource.match(/id: "media"/g) ?? []).length === 1 &&
    !heroEditorSource.includes('id: "media-desktop"') &&
    !heroEditorSource.includes('id: "media-mobile"') &&
    heroEditorSource.includes('data-hero-media-section="desktop"') &&
    heroEditorSource.includes('data-hero-media-section="mobile"') &&
    heroEditorSource.includes('name="images"') &&
    heroEditorSource.includes('name="mobile_images"') &&
    getModuleEditorSectionMetadata("hero", "media")?.navigationLabelAr === MODULE_EDITOR_TAB_LABELS.images &&
    MODULE_EDITOR_TAB_LABELS.images === "الصور" &&
    !moduleRegistryMetadataSource.includes('navigationLabelAr: "ديسكتوب"') &&
    !moduleRegistryMetadataSource.includes('navigationLabelAr: "موبايل"'),
  "Hero desktop and mobile galleries share one Images tab without changing their submitted fields",
);
assert(
  mediaGallerySource.includes('data-admin-media-gallery-card="image"') &&
    mediaGallerySource.includes('data-admin-media-gallery-card="add"') &&
    mediaGallerySource.includes("galleryCardHeightClass") &&
    mediaGallerySource.includes("إضافة صورة") &&
    !mediaGallerySource.includes("تصفح وإضافة") &&
    !mediaGallerySource.includes("لا توجد صور —") &&
    hasHeroImageComposition(heroEditorSource) &&
    !hasHeroImageComposition(heroEditorSource.replace('name="image_composition"', 'name="unsubmitted_composition"')) &&
    !hasHeroImageComposition(heroEditorSource.replace('label="تكوين الصورة"', 'aria-label="تكوين الصورة"')) &&
    !hasHeroImageComposition(heroEditorSource.replace('options={HERO_IMAGE_COMPOSITION_OPTIONS_AR}', 'options={[]}')),
  "Hero galleries use one equal-size add card and image composition is an independent text-style card",
);
assert(
  heroEditorSource.includes('mediaSlot={resolveHeroMediaSlot(guidanceVariant, "desktop")}') &&
    heroEditorSource.includes('mediaSlot={resolveHeroMediaSlot(guidanceVariant, "mobile")}') &&
    (heroEditorSource.match(/density="compact"/g) ?? []).length === 2 &&
    HERO_VARIANTS.every((variant) => {
      const desktop = resolveHeroMediaSlot(variant, "desktop");
      const mobile = resolveHeroMediaSlot(variant, "mobile");
      return desktop.owner === `hero/${variant}` &&
        mobile.owner === desktop.owner &&
        desktop.device === "desktop" && mobile.device === "mobile" &&
        desktop.slot !== mobile.slot && desktop.fit === "cover" && mobile.fit === "cover";
    }),
  "Hero compact galleries retain distinct desktop and mobile contracts in the shared presentation owner",
);
assert(
  hasGalleryDimensionDelegation(mediaGallerySource, mediaImageFieldSource, mediaGuidanceSource) &&
    !hasGalleryDimensionDelegation(mediaGallerySource.replace('mediaSlot={mediaSlot}', 'mediaSlot={undefined}'), mediaImageFieldSource, mediaGuidanceSource) &&
    !hasGalleryDimensionDelegation(mediaGallerySource, mediaImageFieldSource.replaceAll('AdminMediaOriginalDimensions', 'UnownedDimensions'), mediaGuidanceSource) &&
    !hasGalleryDimensionDelegation(mediaGallerySource, mediaImageFieldSource.replaceAll('AdminMediaSlotGuidance', 'UnownedGuidance'), mediaGuidanceSource) &&
    !hasGalleryDimensionDelegation(mediaGallerySource, mediaImageFieldSource, `${mediaGuidanceSource}\nslot.note`),
  "Media cards retain original dimensions and practical recommended sizes while technical guidance stays out of Admin",
);
assert(
  mediaGallerySource.includes("الصورة في أول الترتيب ولا يمكن تحريكها لأعلى") &&
    mediaGallerySource.includes(
      "الصورة في آخر الترتيب ولا يمكن تحريكها لأسفل",
    ) &&
    heroOrderEditorSource.includes("في أول الترتيب ولا يمكن تحريكه لأعلى") &&
    heroOrderEditorSource.includes("في آخر الترتيب ولا يمكن تحريكه لأسفل"),
  "Hero boundary controls explain every intentional disabled state",
);
assert(
  publicMediaImageSource.includes('loading={priority ? "eager" : undefined}') &&
    publicMediaImageSource.includes(
      'fetchPriority={priority ? "high" : undefined}',
    ) &&
    !publicMediaImageSource.includes("priority={priority}"),
  "Hero LCP images map the shared priority intent to Next 16 loading attributes",
);
assert(
  heroEditorSource.includes("AdminFormListboxSelect") &&
    heroEditorSource.includes('name="image_composition"') &&
    heroEditorSource.includes("HERO_IMAGE_COMPOSITION_OPTIONS_AR") &&
    !heroEditorSource.includes('name="image_position_class"'),
  "Hero image composition is persisted through a labelled Product preset",
);
assert(
  resolveHeroImageCompositionPreset("cover-upper") === "cover-upper" &&
    resolveHeroImageCompositionPreset("object-[42%_36%]") === "cover-upper" &&
    resolveHeroImageCompositionPreset("object-center") === "cover-center" &&
    resolveHeroImageCompositionPreset("object-[99%_1%]") === "cover-center",
  "Hero image composition resolver outputs Product presets and only reads legacy CSS",
);
assert(
  genericHeroActionSource.includes("resolveHeroImageCompositionPreset") &&
    genericHeroActionSource.includes("imageComposition:") &&
    !genericHeroActionSource.includes('formData.get("image_position_class")'),
  "Hero save persists semantic composition without a CSS-valued form field",
);
const normalizedLegacyConfig = normalizeHeroTemplateProductConfig(
  {
    imagePositionClassName: "object-[42%_36%]",
    heroLayout: "compact",
    eyebrowAlignment: "center",
    titleAlignment: "left",
    heroElementOrder: ["title", "eyebrow"],
  },
  "internal-page",
);
assert(
  normalizedLegacyConfig.imageComposition === "cover-upper" &&
    !("imagePositionClassName" in normalizedLegacyConfig) &&
    !("heroLayout" in normalizedLegacyConfig),
  "Hero persistence normalization removes legacy CSS and per-page height fields",
);
const standardizedInternalControls = resolveHeroContentControlsForVariant(
  {
    eyebrowAlignment: "center",
    eyebrowBold: true,
    titleAlignment: "left",
    titleBold: false,
    ctaAlignment: "center",
    heroElementOrder: ["cta", "title", "eyebrow"],
  },
  "internal-page",
);
assert(
  standardizedInternalControls.eyebrowAlignment === "center" &&
    standardizedInternalControls.eyebrowBold === true &&
    standardizedInternalControls.titleAlignment === "left" &&
    standardizedInternalControls.titleBold === false &&
    standardizedInternalControls.ctaAlignment === "center" &&
    JSON.stringify(standardizedInternalControls.heroElementOrder) ===
      JSON.stringify(DEFAULT_HERO_ELEMENT_ORDER),
  "Standard Internal Hero preserves canonical typography fields while keeping one element order",
);
assert(
  resolveHeroFamily("home-cinematic") === "special" &&
    resolveHeroFamily("projects-hub") === "special" &&
    resolveHeroFamily("project-detail") === "special" &&
    resolveHeroFamily("internal-page") === "standard-internal",
  "Hero variants resolve into the two Product families",
);
assert(
  heroSource.includes('data-hero-family="standard-internal"') &&
    heroSource.includes('data-hero-height-preset="standard-internal"') &&
    heroSource.includes(
      "data-hero-composition-baseline={STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE}",
    ) &&
    heroSource.includes('data-hero-composition-root="standard-internal"') &&
    heroSource.includes("HERO_MEDIA_GEOMETRY.internal.containerClass") &&
    HERO_MEDIA_GEOMETRY.internal.containerClass === "h-[min(62vh,580px)] min-h-[440px]" &&
    !heroSource.includes("h-[min(46vh,500px)]") &&
    !heroSource.includes("config.heroLayout"),
  "Family B owns one height and one composition anchor",
);
assert(
  heroSource.includes("STANDARD_INTERNAL_HERO_ELEMENT_ORDER.map") &&
    heroSource.includes(
      "flex-col px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16",
    ) &&
    !heroSource.includes("flex-col justify-end px-6") &&
    heroContractSource.includes(
      'STANDARD_INTERNAL_HERO_COMPOSITION_BASELINE = "topics"',
    ),
  "Standard composition fixes the Topics start baseline and Product order across the Family",
);
assert(
  !internalPageLayoutSource.includes("heroHeightClassName") &&
    !internalPageLayoutSource.includes("PublicMediaImage") &&
    internalPageLayoutSource.includes("shouldRenderHero") &&
    internalPageLayoutSource.includes("<DynamicHeroSection") &&
    internalPageLayoutSource.includes(
      "compositionFooter={resolvedHeroSlotContent}",
    ) &&
    heroSource.includes('data-hero-composition-footer="page-composition"'),
  "Static internal fallbacks delegate to the same shared Hero presentation owner",
);
assert(
  heroEditorSource.includes("isStandardInternal") &&
    !heroEditorSource.includes("enableAlignment={!isStandardInternal}") &&
    !heroEditorSource.includes("enableBold={!isStandardInternal}") &&
    heroVisibilitySource.includes(
      "alignment={hasAlignmentControl ? alignment : undefined}",
    ) &&
    heroVisibilitySource.includes(
      "bold={hasBoldControl ? (bold ?? false) : undefined}",
    ) &&
    heroEditorSource.includes("...(!isStandardInternal"),
  "Standard Internal CMS exposes supported typography tools while keeping ordering fixed",
);

// Exercise the actual shared row: the CTA-only unset opt-in must not alter
// Hero's default explicit boolean submission or its native Bold control.
const heroUiLoader = createJiti(import.meta.url, {
  fsCache: false,
  jsx: { runtime: "automatic" },
});
const [{ default: AdminCard }, { AdminFormControlHeader }, { default: AdminFormSwitch }, { default: AdminTextFormatControls }] = await Promise.all([
  heroUiLoader.import("../src/components/admin/ui/AdminCard.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminForm.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminFormSwitch.tsx"),
  heroUiLoader.import("../src/components/admin/ui/AdminTextFormatControls.tsx"),
]);
const heroRowTree = ts.createSourceFile("ModuleEditorPresentation.tsx", heroVisibilitySource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const heroRowNode = heroRowTree.statements.find(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === "ModuleEditorVisibilityAlignRow");
if (!heroRowNode || !heroRowNode.getText(heroRowTree).includes("<AdminCard")) {
  throw new Error("The actual shared Hero row must delegate its canonical surface to AdminCard.");
}
const compiledHeroRow = ts.transpileModule(heroRowNode.getText(heroRowTree).replace(/^export /u, ""), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const HeroVisibilityAlignRow = new Function(
  "React", "useState", "AdminCard", "AdminFormControlHeader", "AdminFormSwitch", "AdminTextFormatControls",
  `${compiledHeroRow}\nreturn ModuleEditorVisibilityAlignRow;`,
)({ createElement, Fragment }, useState, AdminCard, AdminFormControlHeader, AdminFormSwitch, AdminTextFormatControls);
assert(
  heroVisibilityAdapterSource.includes("ModuleEditorVisibilityAlignRow as default"),
  "Hero adapter retains the actual shared visibility and text-formatting owner",
);

const compactHeroMarkup = renderToStaticMarkup(createElement(HeroVisibilityAlignRow, {
  label: "عنوان الاختبار",
  showName: "show_title",
  alignmentName: "title_alignment",
  boldName: "title_bold",
  showDefault: true,
  alignmentDefault: "center",
}, createElement("input", { name: "authored_title", defaultValue: "نص محفوظ" })));
assert(
  compactHeroMarkup.includes('data-module-editor-settings-composition="compact-inline"') &&
    compactHeroMarkup.includes('aria-label="تنسيق عنوان الاختبار"') &&
    compactHeroMarkup.includes('aria-label="إظهار عنوان الاختبار"') &&
    compactHeroMarkup.indexOf('data-module-editor-settings-header=""') < compactHeroMarkup.indexOf('data-admin-text-format-bold=""') &&
    compactHeroMarkup.indexOf('data-admin-text-format-bold=""') < compactHeroMarkup.indexOf('data-module-editor-settings-body=""') &&
    compactHeroMarkup.indexOf('data-module-editor-settings-body=""') < compactHeroMarkup.indexOf('name="authored_title"') &&
    (compactHeroMarkup.match(/name="(?:show_title|title_alignment|title_bold|authored_title)"/gu) ?? []).length === 4,
  "Actual compact Hero row SSR keeps separate native visibility/format toolbars in the header, authored body and exactly one submitted field per value",
);

  for (const preserveUnsetBold of [false, true]) {
    for (const boldDefault of [undefined, false, true]) {
      for (const enableBold of [false, true]) {
        const markup = renderToStaticMarkup(createElement(HeroVisibilityAlignRow, {
          label: "عنوان الاختبار",
          showName: "show_title",
          alignmentName: "title_alignment",
          boldName: "title_bold",
          showDefault: false,
          alignmentDefault: "center",
          enableBold,
          ...(preserveUnsetBold ? { preserveUnsetBold } : {}),
          ...(boldDefault === undefined ? {} : { boldDefault }),
        }));
        const hiddenFields = [...markup.matchAll(/<input\b[^>]*>/gu)]
          .map(([tag]) => tag)
          .filter(tag => /\btype="hidden"/u.test(tag))
          .map(tag => [
            /\bname="([^"]+)"/u.exec(tag)?.[1],
            /\bvalue="([^"]*)"/u.exec(tag)?.[1],
          ]);
        const expectedBold = preserveUnsetBold ? boldDefault : (boldDefault ?? false);
        const boldInputs = hiddenFields.filter(([name]) => name === "title_bold");
        const boldButtons = [...markup.matchAll(/<button\b[^>]*>/gu)]
          .map(([tag]) => tag)
          .filter(tag => tag.includes('data-admin-text-format-bold=""'));
        const fieldsArePreserved =
          JSON.stringify(hiddenFields) === JSON.stringify([
            ["show_title", "false"],
            ["title_alignment", "center"],
            ...(expectedBold === undefined ? [] : [["title_bold", String(expectedBold)]]),
          ]) &&
          boldInputs.length === (expectedBold === undefined ? 0 : 1) &&
          boldButtons.length === (enableBold ? 1 : 0) &&
          boldButtons.every(tag =>
            tag.includes(`aria-pressed="${String(boldDefault ?? false)}"`) &&
            tag.includes('type="button"') &&
            !/\bdisabled(?:=|\s|>)/u.test(tag)) &&
          !markup.includes('name="undefined"');
        const submitted = new FormData();
        for (const [name, value] of hiddenFields) submitted.append(name, value);
        const heroRoundtrip = preserveUnsetBold ||
          ["home-cinematic", "internal-page", "project-detail"].every(variant => {
            const parsed = parseHeroContentControlsFormData(submitted);
            const saved = normalizeHeroTemplateProductConfig(parsed, variant);
            const reloaded = resolveHeroContentControlsForVariant(JSON.parse(JSON.stringify(saved)), variant);
            return reloaded.titleBold === expectedBold &&
              reloaded.showTitle === false && reloaded.titleAlignment === "center";
          });
        assert(
          fieldsArePreserved && heroRoundtrip,
          `Actual unified Hero row: Bold ${String(boldDefault)}, control ${enableBold ? "enabled" : "hidden"}, unset opt-in ${preserveUnsetBold} retains native submission and parser roundtrip`,
        );
      }
    }
  }

function findSharedBoldButton(node) {
  if (!isValidElement(node)) return undefined;
  if (node.type === "button" && node.props["data-admin-text-format-bold"] === "") return node;
  for (const child of Children.toArray(node.props.children)) {
    const found = findSharedBoldButton(child);
    if (found) return found;
  }
  return undefined;
}
for (const bold of [false, true]) {
  let changedValue;
  const button = findSharedBoldButton(AdminTextFormatControls({
    bold,
    onBoldChange: next => { changedValue = next; },
  }));
  button?.props.onClick();
  assert(
    button?.props["aria-pressed"] === bold && changedValue === !bold,
    `Actual shared Bold button toggles ${bold} to ${!bold} through its existing callback`,
  );
}

// Resolve the actual Hero link/read chain. Only the registered pages provider
// uses in-memory fixture data; no database client or production data is called.
const heroLinkLoader = createJiti(import.meta.url, {
  fsCache: false,
  alias: { "server-only": resolve("node_modules/next/dist/compiled/server-only/empty.js") },
});
const { resolveHeroConfigLinks } = await heroLinkLoader.import("../src/lib/admin/links/hero-config.ts");
const { getHeroConfig, readHeroLinkTarget } = await heroLinkLoader.import("../src/lib/page-sections.ts");
const { ensureAdminLinkProvidersRegistered } = await heroLinkLoader.import("../src/lib/admin/links/providers/index.ts");
const { registerAdminLinkProvider } = await heroLinkLoader.import("../src/lib/admin/links/registry.ts");
ensureAdminLinkProvidersRegistered();
let heroTargetProviderReads = 0;
registerAdminLinkProvider({
  type: "pages",
  label: "صفحة اختبار",
  labelPlural: "صفحات اختبار",
  search: async () => { throw new Error("Hero target verification cannot search live providers."); },
  resolveMany: async ids => {
    if (JSON.stringify(ids) !== "[901]") throw new Error("Unexpected Hero target fixture resource.");
    heroTargetProviderReads += 1;
    return new Map([[901, "/about"]]);
  },
});
const heroTargetCases = [];
for (const target of [undefined, "_self", "_blank", null, "_top"]) {
  for (const [kind, link, href] of [
    ["internal", { link_kind: "internal", linked_type: "pages", linked_id: 901, href: "/stale", anchor: "team" }, "/about#team"],
    ["external", { link_kind: "external", href: "https://example.test/hero#team" }, "https://example.test/hero#team"],
    ["anchor", { link_kind: "anchor", href: "#team", anchor: "team" }, "#team"],
  ]) {
    const value = { ...link, ...(target === undefined ? {} : { target }) };
    heroTargetCases.push({
      label: `${kind} ${String(target)}`,
      config: { primaryCtaLink: value, secondaryCtaLink: { ...value } },
      href,
      target: target === "_blank" ? "_blank" : "_self",
      explicitTarget: target === "_blank" || target === "_self" ? target : undefined,
    });
  }
}
for (const [label, config] of [
  ["legacy href", { primaryCtaHref: "https://example.test/legacy", secondaryCtaHref: "https://example.test/legacy" }],
  ["legacy string link", { primaryCtaLink: "https://example.test/legacy", secondaryCtaLink: "https://example.test/legacy" }],
  ["legacy object without kind", { primaryCtaLink: { href: "https://example.test/legacy" }, secondaryCtaLink: { href: "https://example.test/legacy" } }],
]) heroTargetCases.push({ label, config, href: "https://example.test/legacy", target: "_self" });

const resolvedHeroTargetCases = [];
for (const value of [undefined, null, "https://example.test", [], { target: "_top" }, { link_kind: "none", target: "_blank" }]) {
  assert(readHeroLinkTarget(value) === undefined, `Hero target reader rejects unsupported or unauthored target metadata: ${JSON.stringify(value)}`);
}
for (const target of ["_self", "_blank"]) {
  assert(readHeroLinkTarget({ link_kind: "external", target }) === target, `Hero target reader retains explicit ${target}`);
}
for (const fixture of heroTargetCases) {
  const stored = { title: "عنوان محفوظ", primaryCtaLabel: "الزر الأساسي", secondaryCtaLabel: "الزر الثانوي", ...fixture.config };
  const before = JSON.stringify(stored);
  const resolved = await resolveHeroConfigLinks(stored);
  for (const variant of ["home-cinematic", "internal-page"]) {
    const parsed = getHeroConfig({ variant, config: resolved });
    const targetsPreserved = ["primary", "secondary"].every(prefix =>
      parsed[`${prefix}CtaHref`] === fixture.href &&
      (parsed[`${prefix}CtaLink`]?.target === "_blank" ? "_blank" : "_self") === fixture.target);
    assert(
      targetsPreserved && parsed.title === stored.title && JSON.stringify(stored) === before,
      `${variant}: actual Hero link resolver and reader preserve ${fixture.label} without changing stored data or href resolution`,
    );
    resolvedHeroTargetCases.push({ ...fixture, variant, config: parsed });
  }
}
assert(heroTargetProviderReads === 10, "Hero internal targets resolve both buttons through the isolated canonical pages provider");

// Render the exact public CTA functions with real Next Link and shared hooks;
// extraction avoids loading unrelated Hero media/domain resources in this test.
const heroCtaTree = ts.createSourceFile("DynamicHeroSection.tsx", heroSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const heroCtaFunctionNames = ["HeroPressableLink", "useIntentPrefetch", "HeroReservedSlot", "HeroCtaButtons"];
const heroCtaNodes = heroCtaFunctionNames.map(name => heroCtaTree.statements.find(node =>
  ts.isFunctionDeclaration(node) && node.name?.text === name));
if (heroCtaNodes.some(node => !node)) throw new Error("The public Hero CTA owners must be available to the rendering guard.");
const compiledHeroCta = ts.transpileModule(heroCtaNodes.map(node => node.getText(heroCtaTree)).join("\n"), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const [{ default: HeroNextLink }, { usePressFeedback }] = await Promise.all([
  heroUiLoader.import("next/link"),
  heroUiLoader.import("../src/hooks/use-press-feedback.ts"),
]);
const HeroCtaButtons = new Function(
  "React", "Link", "usePressFeedback", "useState", "heroFlexJustifyClass", "readHeroLinkTarget",
  `${compiledHeroCta}\nreturn HeroCtaButtons;`,
)({ createElement, Fragment }, HeroNextLink, usePressFeedback, useState, heroFlexJustifyClass, readHeroLinkTarget);
for (const fixture of resolvedHeroTargetCases) {
  const markup = renderToStaticMarkup(createElement(HeroCtaButtons, { config: fixture.config }));
  const anchors = [...markup.matchAll(/<a\b[^>]*>/gu)].map(([tag]) => tag);
  assert(
    anchors.length === 2 && anchors.every(tag => {
      const href = /\bhref="([^"]*)"/u.exec(tag)?.[1];
      const target = /\btarget="([^"]*)"/u.exec(tag)?.[1];
      const rel = /\brel="([^"]*)"/u.exec(tag)?.[1];
      return href === fixture.href && target === fixture.explicitTarget &&
        (target === "_blank"
          ? rel?.split(/\s+/u).includes("noopener") && rel.split(/\s+/u).includes("noreferrer")
          : rel === undefined);
    }),
    `${fixture.variant}: actual public Hero CTA anchors retain ${fixture.label} target, canonical href and safe new-window rel`,
  );
}
const heroWithoutLinks = getHeroConfig({ variant: "internal-page", config: await resolveHeroConfigLinks({}) });
assert(
  renderToStaticMarkup(createElement(HeroCtaButtons, { config: heroWithoutLinks })) === "",
  "Hero target adoption does not create buttons for absent links",
);

// Execute the two production composition expressions, including partial domain
// slides. A slide-owned href must not inherit unrelated manual link metadata.
function heroCompositionInitializer(functionName, variableName) {
  const owner = heroCtaTree.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  const declaration = owner?.body?.statements.filter(ts.isVariableStatement)
    .flatMap(node => node.declarationList.declarations)
    .find(node => ts.isIdentifier(node.name) && node.name.text === variableName);
  if (!declaration?.initializer) throw new Error(`Missing production Hero composition: ${functionName}.${variableName}`);
  return declaration.initializer.getText(heroCtaTree);
}
const composeHomeHero = new Function(
  "config", "activeSlide", "title", "highlight", "subtitle", "description",
  `return (${heroCompositionInitializer("HomeDynamicHero", "activeConfig")});`,
);
const composeInternalHero = new Function(
  "hero", "domainSlide",
  `return (${heroCompositionInitializer("DynamicHeroSection", "resolvedHero")});`,
);
const authoredHeroConfig = getHeroConfig({ variant: "home-cinematic", config: {
  title: "عنوان محفوظ",
  primaryCtaLabel: "أساسي", primaryCtaHref: "/manual-primary",
  primaryCtaLink: { link_kind: "internal", target: "_blank" },
  secondaryCtaLabel: "ثانوي", secondaryCtaHref: "/manual-secondary",
  secondaryCtaLink: { link_kind: "internal", target: "_self" },
} });
for (const [label, slide] of [
  ["no domain override", undefined],
  ["media-only slide", { desktopImage: "/fixture.webp" }],
  ["primary override", { primaryCtaLabel: "أساسي مستقل", primaryCtaHref: "/domain-primary" }],
  ["secondary override", { secondaryCtaLabel: "ثانوي مستقل", secondaryCtaHref: "/domain-secondary" }],
  ["both overrides", { primaryCtaLabel: "أساسي مستقل", primaryCtaHref: "/domain-primary", secondaryCtaLabel: "ثانوي مستقل", secondaryCtaHref: "/domain-secondary" }],
]) {
  const sourceHero = { variant: "internal-page", config: authoredHeroConfig };
  const before = JSON.stringify(sourceHero);
  const home = composeHomeHero(authoredHeroConfig, slide, "عنوان محفوظ", "", "", "");
  const internal = composeInternalHero(sourceHero, slide);
  for (const [variant, composed] of [["home/projects-hub", home], ["standard internal", internal.config]]) {
    assert(
      ["primary", "secondary"].every(prefix => {
        const hrefKey = `${prefix}CtaHref`;
        const linkKey = `${prefix}CtaLink`;
        const overridden = typeof slide?.[hrefKey] === "string";
        const expectedHref = variant === "standard internal" && slide
          ? slide[hrefKey] : (slide?.[hrefKey] ?? authoredHeroConfig[hrefKey]);
        return composed[hrefKey] === expectedHref &&
          composed[linkKey] === (overridden ? undefined : authoredHeroConfig[linkKey]);
      }) && JSON.stringify(sourceHero) === before &&
      (slide !== undefined || internal === sourceHero),
      `${variant}: actual ${label} composition clears only the target of a slide-owned href and retains existing fallback behavior`,
    );
  }
}
assert(
  !mediaCenterConfigSource.includes("heroImagePositionClassName") &&
    !internalPageLayoutSource.includes("heroImagePositionClassName"),
  "unused Media Center static fallback cannot create a parallel object-position path",
);
assert(
  heroClosureMigration.includes(
    "hero_image = '/images/projects/i87/hero.jpg'",
  ) &&
    heroClosureMigration.includes(
      "and hero_image = '/images/projects/b84/progress-04 - copy (6).jpg'",
    ) &&
    heroClosureMigration.includes("I87 does not use its canonical Hero asset"),
  "Hero closure migration repairs and asserts the canonical I87 Hero asset",
);
assert(
  !heroContractSource.includes('  "explore",'),
  "parallel Explore element removed from contract",
);
assert(
  genericHeroActionSource.includes("parseHeroContentControlsFormData") &&
    projectsHeroActionSource.includes("parseHeroContentControlsFormData"),
  "Generic and Projects Hub saves share one Hero presentation parser",
);

const visibilityFields = {
  show_eyebrow: "showEyebrow",
  show_title: "showTitle",
  show_highlight: "showHighlight",
  show_subtitle: "showSubtitle",
  show_description: "showDescription",
  show_cta: "showCta",
  show_project_download_action: "showProjectDownloadAction",
  show_project_tracking_action: "showProjectTrackingAction",
  show_project_reservation_action: "showProjectReservationAction",
};
const visibleFormData = new FormData();
const hiddenFormData = new FormData();
for (const field of Object.keys(visibilityFields)) {
  // AdminFormSwitch submits its hidden fallback first and checked value last.
  visibleFormData.append(field, "false");
  visibleFormData.append(field, "true");
  hiddenFormData.append(field, "false");
}
const visibleControls = parseHeroContentControlsFormData(visibleFormData);
const hiddenControls = parseHeroContentControlsFormData(hiddenFormData);
assert(
  Object.values(visibilityFields).every(
    (field) => visibleControls[field] === true,
  ),
  "all Hero visibility switches persist the authoritative final FormData value",
);
assert(
  Object.values(visibilityFields).every(
    (field) => hiddenControls[field] === false,
  ),
  "all Hero visibility switches persist the explicit hidden fallback",
);
const formattingFormData = new FormData();
formattingFormData.set("eyebrow_alignment", "center");
formattingFormData.set("eyebrow_bold", "true");
formattingFormData.set("title_alignment", "left");
formattingFormData.set("title_bold", "false");
formattingFormData.set("highlight_alignment", "center");
formattingFormData.set("highlight_bold", "true");
formattingFormData.set("subtitle_alignment", "left");
formattingFormData.set("subtitle_bold", "true");
const formattingControls = parseHeroContentControlsFormData(formattingFormData);
assert(
  formattingControls.eyebrowAlignment === "center" &&
    formattingControls.eyebrowBold === true &&
    formattingControls.titleAlignment === "left" &&
    formattingControls.titleBold === false &&
    formattingControls.highlightAlignment === "center" &&
    formattingControls.highlightBold === true &&
    formattingControls.subtitleAlignment === "left" &&
    formattingControls.subtitleBold === true,
  "Hero formatting FormData preserves every supported alignment and Bold value",
);
assert(!heroSource.includes("goldAccent"), "About goldAccent merge removed");
assert(heroSource.includes("HomeDynamicHero"), "Home hero path still present");
assert(
  /function HomeDynamicHero[\s\S]*function InternalDynamicHero/.test(
    heroSource,
  ) ||
    /function InternalDynamicHero[\s\S]*function HomeDynamicHero/.test(
      heroSource,
    ) ||
    heroSource.includes('variant === "home-cinematic"'),
  "Home hero router gate preserved",
);

// Canonical content resolution keeps independently authored text and removes only duplicate description.
const independent = resolveHeroContentControls({ showHighlight: false, showSubtitle: true });
assert(
  independent.showHighlight === false && independent.showSubtitle === true &&
    resolveDistinctHeroDescription("Description", "Subtitle") === "Description" &&
    resolveDistinctHeroDescription("Subtitle", "Subtitle") === "",
  "actual Hero content owner preserves independent visibility and distinct description",
);

// Compatibility regressions execute the production parser/resolver, not local models.
assert(
  !/descriptionAlignment\s*===\s*"justify"\s*\?\s*"right"/u.test(
    `${heroEditorSource}\n${projectsHubEditorSource}`,
  ) &&
    (heroEditorSource.match(/alignmentDefault=\{controls.descriptionAlignment\}/gu) ?? []).length === 2 &&
    projectsHubEditorSource.includes("alignmentDefault={config.descriptionAlignment}") &&
    heroVisibilitySource.includes("useState<AdminTextAlignment>(alignmentDefault)") &&
    heroVisibilitySource.includes("value={hasAlignmentControl ? alignment : alignmentDefault}"),
  "Generic, Detail and Projects Hub editors pass supported description alignment unchanged into the shared submitted field",
);
for (const variant of HERO_VARIANTS) {
  for (const alignment of ["right", "center", "left", "justify"]) {
    const formData = new FormData();
    formData.set("description_alignment", alignment);
    const saved = normalizeHeroTemplateProductConfig(
      parseHeroContentControlsFormData(formData),
      variant,
    );
    const reloaded = resolveHeroContentControlsForVariant(
      JSON.parse(JSON.stringify(saved)),
      variant,
    );
    assert(
      reloaded.descriptionAlignment === alignment,
      `${variant}: authored ${alignment} description alignment survives parser, persistence normalization and reload`,
    );
  }
}
const invalidAlignmentForm = new FormData();
invalidAlignmentForm.set("description_alignment", "unsupported");
assert(
  parseHeroContentControlsFormData(invalidAlignmentForm).descriptionAlignment === "right",
  "invalid description alignment retains the canonical fallback",
);

const actionFields = [
  ["showProjectDownloadAction", "show_project_download_action"],
  ["showProjectTrackingAction", "show_project_tracking_action"],
  ["showProjectReservationAction", "show_project_reservation_action"],
];
const detailActionCases = [
  ["empty legacy config", {}, [true, true, true]],
  ["legacy collective false", { showCta: false }, [false, false, false]],
  ["legacy collective true", { showCta: true }, [true, true, true]],
  ["legacy snake string false", { show_cta: "false" }, [false, false, false]],
  ["legacy snake numeric false", { show_cta: 0 }, [false, false, false]],
  ["partial modern true", { showCta: false, showProjectDownloadAction: true }, [true, false, false]],
  ["partial modern false", { showCta: true, showProjectTrackingAction: false }, [true, false, true]],
  ["partial snake modern true", { show_cta: false, show_project_reservation_action: "true" }, [false, false, true]],
  ["partial snake modern false", { showCta: true, show_project_download_action: "false" }, [false, true, true]],
  ["explicit camel flags win", { showCta: false, showProjectDownloadAction: true, showProjectTrackingAction: false, showProjectReservationAction: true }, [true, false, true]],
  ["explicit snake flags win", { showCta: false, show_project_download_action: true, show_project_tracking_action: true, show_project_reservation_action: false }, [true, true, false]],
  ["explicit camel false wins over snake true", { showCta: true, showProjectDownloadAction: false, show_project_download_action: true }, [false, true, true]],
];
for (const [label, raw, expected] of detailActionCases) {
  const stored = { ...raw, projectActionOrder: ["reservation", "download", "tracking"], ctaAlignment: "left" };
  const before = JSON.stringify(stored);
  const resolved = resolveHeroContentControlsForVariant(stored, "project-detail");
  const formData = new FormData();
  for (const [key, field] of actionFields) formData.set(field, String(resolved[key]));
  formData.set("project_action_order", JSON.stringify(resolved.projectActionOrder));
  formData.set("cta_alignment", resolved.ctaAlignment);
  const saved = normalizeHeroTemplateProductConfig(parseHeroContentControlsFormData(formData), "project-detail");
  const reloaded = resolveHeroContentControlsForVariant(JSON.parse(JSON.stringify(saved)), "project-detail");
  assert(
    actionFields.every(([key], index) => resolved[key] === expected[index] && reloaded[key] === expected[index]) &&
      JSON.stringify(reloaded.projectActionOrder) === JSON.stringify(stored.projectActionOrder) &&
      reloaded.ctaAlignment === "left" && before === JSON.stringify(stored),
    `Project Detail ${label}: independent action visibility survives save/reload without changing order, alignment or input data`,
  );
}
assert(
  HERO_VARIANTS.filter((variant) => variant !== "project-detail").every((variant) => {
    const resolved = resolveHeroContentControlsForVariant({ showCta: false }, variant);
    return resolved.showCta === false && actionFields.every(([key]) => resolved[key] === true);
  }),
  "legacy Detail CTA compatibility leaves every other Hero variant unchanged",
);

if (process.exitCode) {
  console.error("\nInternal hero config verification failed.");
  process.exit(1);
}

console.log("\nInternal hero config verification passed.");
