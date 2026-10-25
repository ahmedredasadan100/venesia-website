import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as videoPayload from "../src/lib/admin/media-topic-payload.ts";
import { mediaContentSlot } from "../src/lib/media-center/detail-page-config.ts";

import * as ts from "typescript";

import {
  CONTENT_EDITOR_ADOPTION_MANIFEST,
  CONTENT_EDITOR_ARCHITECTURE,
  CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER,
  CONTENT_EDITOR_EXECUTABLE_BINDINGS,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
  CONTENT_EDITOR_GLOBAL_CLOSURE,
  CONTENT_EDITOR_SOURCE_BLOCKERS,
  deriveContentEditorClosure,
} from "../src/lib/admin/content/content-editor-adoption-manifest.ts";
import {
  CONTENT_EDITOR_ADAPTERS,
  CONTENT_TYPES,
  MEDIA_EDITABLE_CONTENT_TYPES,
  type ContentType,
} from "../src/lib/admin/content/content-types.ts";
import {
  applyContentTemplatePreset,
  getContentTemplatePresets,
  isContentTemplatePresetApplicable,
  resolveContentTemplatePreset,
  VENESIA_CONTENT_TEMPLATE_PRESETS,
  type ContentTemplateContext,
  type ContentTemplateEditableValues,
} from "../src/lib/admin/content-workflow/content-template-presets.ts";
import {
  PRODUCT_SURFACE_IDENTITIES,
  type ProductSurfaceIdentity,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { GLOBAL_SEO_PUBLIC_CONSUMERS } from "../src/lib/admin/seo/global-seo-adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import {
  collectExecutableSourceGraph,
  graphUsesExecutableBinding,
  parseTypeScriptSource,
  type SourceOverrides,
} from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (process.argv.includes("--video-native-binding")) {
  const source = readFileSync(join(ROOT, "src/components/admin/content/editors/media/MediaVideoFields.tsx"), "utf8");
  assert.ok(hasCanonicalVideoPanelFields(source), "Omitted native binding must retain the complete existing Topic Video owner contract.");
  for (const [from, to] of [
    ['from "../../../../media-center/MediaDetailArticle"', 'from "./ParallelPlayer"'],
    ['label={nativeBinding ? "رابط الفيديو" : provider.urlLabel}', 'label="رابط YouTube"'],
    ["value={videoProvider}", 'value="youtube"'],
    ["onValueChange={onVideoThumbnailChange}", "onValueChange={() => {}}"],
    ['name="video_duration" defaultValue={defaultDuration ?? ""}', 'name="video_duration" defaultValue=""'],
    ["requestMetaEmbed={requestMetaEmbed}", "requestMetaEmbed={undefined}"],
  ]) {
    assert.ok(source.includes(from), `Affected negative probe must mutate current source: ${from}`);
    assert.ok(!hasCanonicalVideoPanelFields(source.replace(from, to)), `Omitted Topic preservation rejects ${from}`);
  }
  console.log("PASS existing Topic Video Panel owner retains native controls, provider/start/model/Meta/playback/default contracts and rejects six regressions; URL-only Project binding has separate targeted proof.");
  process.exit(0);
}
const PUBLIC_CONTENT_BINDING = [
  {
    sourceFile: "src/lib/content/public-content-read/owner.ts",
    exportNames: ["loadPublicContentDetail"],
  },
] as const;

type ContentEditorRouteIdentity = Pick<
  ProductSurfaceIdentity,
  "id" | "route" | "sourceFiles"
>;

type RegisteredContentEditor = {
  id: string;
  sourceFile: string;
};

type ContentEditorStateGuardSources = {
  picker: string;
  registry: string;
  stateOwner: string;
  markdownAdapter: string;
  richTextEditor: string;
  articleCreateConsumer: string;
  articleEditConsumer: string;
  mediaConsumer: string;
};

type ContentEditorStateGuardPrograms = {
  [Role in keyof ContentEditorStateGuardSources]: ts.SourceFile;
};

type ContentEditorStateGuardViolation =
  | "template_picker_dom_mutation"
  | "synthetic_editor_sync_event"
  | "writable_hidden_content_owner"
  | "submit_time_content_override"
  | "ui_only_preset_applicability"
  | "duplicate_writable_content_state"
  | "direct_editor_dom_manipulation"
  | "content_editor_key_remount"
  | "unvalidated_direct_preset_apply";

function readSource(sourceFile: string) {
  return readFileSync(join(ROOT, sourceFile), "utf8");
}

function readParsedSource(sourceFile: string) {
  return parseTypeScriptSource(sourceFile, readSource(sourceFile));
}

function parseContentEditorStateGuardSources(
  sources: ContentEditorStateGuardSources,
): ContentEditorStateGuardPrograms {
  return {
    picker: parseTypeScriptSource("ContentTemplatePicker.tsx", sources.picker),
    registry: parseTypeScriptSource(
      "content-template-presets.ts",
      sources.registry,
    ),
    stateOwner: parseTypeScriptSource("ContentEditorShell.tsx", sources.stateOwner),
    markdownAdapter: parseTypeScriptSource(
      "TopicMarkdownEditor.tsx",
      sources.markdownAdapter,
    ),
    richTextEditor: parseTypeScriptSource(
      "AdminRichTextEditor.tsx",
      sources.richTextEditor,
    ),
    articleCreateConsumer: parseTypeScriptSource(
      "ArticleCreateEditor.tsx",
      sources.articleCreateConsumer,
    ),
    articleEditConsumer: parseTypeScriptSource(
      "ArticleEditor.tsx",
      sources.articleEditConsumer,
    ),
    mediaConsumer: parseTypeScriptSource(
      "MediaContentForm.tsx",
      sources.mediaConsumer,
    ),
  };
}

function collectNodes<Node extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is Node,
) {
  const nodes: Node[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return nodes;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function expressionPath(expression: ts.Expression): readonly string[] | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) return [unwrapped.text];
  if (ts.isPropertyAccessExpression(unwrapped)) {
    const parent = expressionPath(unwrapped.expression);
    return parent ? [...parent, unwrapped.name.text] : null;
  }
  if (
    ts.isElementAccessExpression(unwrapped) &&
    unwrapped.argumentExpression &&
    ts.isStringLiteralLike(unwrapped.argumentExpression)
  ) {
    const parent = expressionPath(unwrapped.expression);
    return parent ? [...parent, unwrapped.argumentExpression.text] : null;
  }
  return null;
}

function pathEndsWith(
  actual: readonly string[] | null,
  expected: readonly string[],
) {
  if (!actual || actual.length < expected.length) return false;
  const offset = actual.length - expected.length;
  return expected.every((part, index) => actual[offset + index] === part);
}

function callName(node: ts.CallExpression | ts.NewExpression) {
  return expressionPath(node.expression)?.at(-1) ?? null;
}

function staticString(node: ts.Node | undefined): string | null {
  if (
    node &&
    (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ) {
    return node.text;
  }
  return null;
}

function hasCall(
  root: ts.Node,
  callee: string,
  argumentPaths: readonly (readonly string[] | null)[] = [],
) {
  return collectNodes(root, ts.isCallExpression).some((call) => {
    if (callName(call) !== callee) return false;
    return argumentPaths.every((expected, index) =>
      expected === null
        ? Boolean(call.arguments[index])
        : pathEndsWith(
            call.arguments[index]
              ? expressionPath(call.arguments[index])
              : null,
            expected,
          ),
    );
  });
}

function hasStaticCallArgument(
  root: ts.Node,
  callee: string,
  argumentIndex: number,
  expected: string,
) {
  return collectNodes(root, ts.isCallExpression).some(
    (call) =>
      callName(call) === callee &&
      staticString(call.arguments[argumentIndex]) === expected,
  );
}

function hasPropertyPath(root: ts.Node, expected: readonly string[]) {
  return collectNodes(root, ts.isPropertyAccessExpression).some((expression) =>
    pathEndsWith(expressionPath(expression), expected),
  );
}

function hasIdentifier(root: ts.Node, expected: string) {
  return collectNodes(root, ts.isIdentifier).some(
    (identifier) => identifier.text === expected,
  );
}

function jsxTagName(element: ts.JsxOpeningLikeElement) {
  return ts.isIdentifier(element.tagName)
    ? element.tagName.text
    : element.tagName.getText(element.getSourceFile());
}

function jsxElements(root: ts.Node, tagName: string) {
  return collectNodes(
    root,
    (
      node,
    ): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      jsxTagName(node) === tagName,
  );
}

function jsxAttribute(
  element: ts.JsxOpeningLikeElement,
  name: string,
): ts.JsxAttribute | undefined {
  return element.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(element.getSourceFile()) === name,
  );
}

function jsxAttributeExpression(
  element: ts.JsxOpeningLikeElement,
  name: string,
) {
  const initializer = jsxAttribute(element, name)?.initializer;
  return initializer &&
    ts.isJsxExpression(initializer) &&
    initializer.expression
    ? initializer.expression
    : null;
}

function jsxAttributeStaticString(
  element: ts.JsxOpeningLikeElement,
  name: string,
) {
  const initializer = jsxAttribute(element, name)?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  return ts.isJsxExpression(initializer)
    ? staticString(initializer.expression)
    : null;
}

function jsxHasAttributes(
  element: ts.JsxOpeningLikeElement,
  names: readonly string[],
) {
  return names.every((name) => Boolean(jsxAttribute(element, name)));
}

function functionDeclaration(root: ts.SourceFile, name: string) {
  return collectNodes(root, ts.isFunctionDeclaration).find(
    (declaration) => declaration.name?.text === name,
  );
}

function functionCalls(root: ts.SourceFile, name: string, callee: string) {
  const declaration = functionDeclaration(root, name);
  return Boolean(declaration && hasCall(declaration, callee));
}

function jsxAttributePathIs(
  element: ts.JsxOpeningLikeElement,
  name: string,
  expected: readonly string[],
) {
  const expression = jsxAttributeExpression(element, name);
  return pathEndsWith(expression ? expressionPath(expression) : null, expected);
}

function hasPropertyAssignmentPath(
  root: ts.Node,
  name: string,
  expected: readonly string[],
) {
  return collectNodes(root, ts.isPropertyAssignment).some((property) => {
    const propertyName =
      ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
        ? property.name.text
        : null;
    return (
      propertyName === name &&
      pathEndsWith(expressionPath(property.initializer), expected)
    );
  });
}

function hasTypeProperty(root: ts.Node, name: string) {
  return collectNodes(root, ts.isPropertySignature).some(
    (property) =>
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      property.name.text === name,
  );
}

function hasStaticString(root: ts.Node, expected: string) {
  return collectNodes(
    root,
    (
      node,
    ): node is ts.StringLiteralLike | ts.NoSubstitutionTemplateLiteral =>
      ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node),
  ).some((literal) => literal.text === expected);
}

function staticVariableValue(root: ts.Node, name: string) {
  const declaration = collectNodes(root, ts.isVariableDeclaration).find(
    (candidate) =>
      ts.isIdentifier(candidate.name) && candidate.name.text === name,
  );
  return declaration?.initializer
    ? staticString(declaration.initializer)
    : null;
}

function staticPropertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : null;
}

function objectLiteralProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
) {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      staticPropertyName(property.name) === name,
  )?.initializer;
}

function unwrapObjectLiteral(expression: ts.Expression | undefined) {
  if (!expression) return null;
  const unwrapped = unwrapExpression(expression);
  return ts.isObjectLiteralExpression(unwrapped) ? unwrapped : null;
}

function objectPathExpression(
  root: ts.Node,
  variableName: string,
  path: readonly string[],
) {
  const declaration = collectNodes(root, ts.isVariableDeclaration).find(
    (candidate) =>
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === variableName,
  );
  let current = unwrapObjectLiteral(declaration?.initializer);
  let value: ts.Expression | undefined;
  for (const [index, part] of path.entries()) {
    if (!current) return null;
    value = objectLiteralProperty(current, part);
    if (index < path.length - 1) current = unwrapObjectLiteral(value);
  }
  return value ?? null;
}

function staticObjectPath(
  root: ts.Node,
  variableName: string,
  path: readonly string[],
) {
  return staticString(objectPathExpression(root, variableName, path) ?? undefined);
}

function bindingIdentifiers(name: ts.BindingName): readonly string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingIdentifiers(element.name) : [],
  );
}

function identifiesWritableContentState(name: string) {
  const normalized = name.toLowerCase();
  return (
    normalized === "value" ||
    normalized === "setvalue" ||
    normalized.includes("content") ||
    normalized.includes("model")
  );
}

function collectContentEditorStateGuardViolations(
  sources: ContentEditorStateGuardSources,
): ContentEditorStateGuardViolation[] {
  const violations = new Set<ContentEditorStateGuardViolation>();
  const programs = parseContentEditorStateGuardSources(sources);
  const presetPrograms = [
    programs.picker,
    programs.registry,
    programs.stateOwner,
  ];
  const projectionPrograms = [
    programs.stateOwner,
    programs.markdownAdapter,
    programs.richTextEditor,
    programs.articleCreateConsumer,
    programs.articleEditConsumer,
    programs.mediaConsumer,
  ];

  const presetMutatesDom = presetPrograms.some((program) => {
    const hasForbiddenCall = collectNodes(program, ts.isCallExpression).some(
      (call) => {
        const name = callName(call);
        const path = expressionPath(call.expression);
        return (
          name === "querySelector" ||
          name === "dispatchEvent" ||
          name === "setTimeout" ||
          name === "setInterval" ||
          name === "requestAnimationFrame" ||
          (name === "getElementById" && pathEndsWith(path, ["document", name]))
        );
      },
    );
    const constructsForbiddenDomOwner = collectNodes(
      program,
      ts.isNewExpression,
    ).some((expression) =>
      ["MutationObserver", "CustomEvent"].some(
        (name) => callName(expression) === name,
      ),
    );
    const accessesFormElements = hasPropertyPath(program, ["form", "elements"]);
    const writesValue = collectNodes(program, ts.isBinaryExpression).some(
      (expression) =>
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        pathEndsWith(expressionPath(expression.left), ["value"]),
    );
    return (
      hasForbiddenCall ||
      constructsForbiddenDomOwner ||
      accessesFormElements ||
      writesValue
    );
  });
  if (presetMutatesDom) {
    violations.add("template_picker_dom_mutation");
  }

  const dispatchesSyntheticEditorEvent = [
    ...presetPrograms,
    ...projectionPrograms,
  ].some((program) =>
    collectNodes(program, ts.isCallExpression).some((call) => {
      if (callName(call) !== "dispatchEvent") return false;
      const event = call.arguments[0];
      if (!event || !ts.isNewExpression(event)) return false;
      const eventName = callName(event);
      const eventType = staticString(event.arguments?.[0]);
      return (
        (eventName === "Event" || eventName === "CustomEvent") &&
        (eventType === "input" || eventType === "change")
      );
    }),
  );
  if (dispatchesSyntheticEditorEvent) {
    violations.add("synthetic_editor_sync_event");
  }

  const hiddenContentInputs = projectionPrograms.flatMap((program) =>
    jsxElements(program, "input").filter((input) => {
      const nameExpression = jsxAttributeExpression(input, "name");
      return (
        jsxAttributeStaticString(input, "type") === "hidden" &&
        (jsxAttributeStaticString(input, "name") === "content" ||
          pathEndsWith(
            nameExpression ? expressionPath(nameExpression) : null,
            ["name"],
          ))
      );
    }),
  );
  if (
    hiddenContentInputs.some(
      (input) =>
        ["defaultValue", "ref", "onInput", "onChange"].some((name) =>
          Boolean(jsxAttribute(input, name)),
        ) ||
        !jsxAttribute(input, "value") ||
        !jsxAttribute(input, "readOnly"),
    )
  ) {
    violations.add("writable_hidden_content_owner");
  }

  const isCanonicalTopicDraftRead = (program: ts.SourceFile, expression: ts.NewExpression) => {
    if (program !== programs.markdownAdapter || expression.arguments?.length !== 1
      || !ts.isIdentifier(expression.arguments[0]!) || expression.arguments[0]!.text !== "form") return false;
    const canonicalImport = program.statements.some((node) => ts.isImportDeclaration(node)
      && staticString(node.moduleSpecifier) === "../../../../../lib/admin/content/topic-revision"
      && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && node.importClause.namedBindings.elements.some((binding) => binding.name.text === "collectTopicFormDraftFields"
        && (!binding.propertyName || binding.propertyName.text === "collectTopicFormDraftFields")));
    const collector = expression.parent;
    if (!canonicalImport || !ts.isCallExpression(collector) || !ts.isIdentifier(collector.expression)
      || collector.expression.text !== "collectTopicFormDraftFields" || collector.arguments[0] !== expression
      || !["activeScope.contentType", "scope.contentType"].includes(collector.arguments[1]?.getText(program) ?? "")) return false;
    let ancestor: ts.Node | undefined = collector.parent;
    while (ancestor) {
      if (ts.isFunctionDeclaration(ancestor) && ancestor.name?.text === "TopicFormDraftRecovery") {
        return Boolean(ancestor.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
      }
      ancestor = ancestor.parent;
    }
    return false;
  };
  const overridesContentAtSubmit = projectionPrograms.some(
    (program) =>
      collectNodes(program, ts.isNewExpression).some(
        (expression) => callName(expression) === "FormData" && !isCanonicalTopicDraftRead(program, expression),
      ) ||
      hasStaticCallArgument(program, "addEventListener", 0, "formdata") ||
      collectNodes(program, ts.isCallExpression).some(
        (call) =>
          (callName(call) === "set" || callName(call) === "append") &&
          staticString(call.arguments[0]) === "content",
      ),
  );
  if (overridesContentAtSubmit) {
    violations.add("submit_time_content_override");
  }

  if (
    !functionCalls(
      programs.registry,
      "getContentTemplatePresets",
      "isContentTemplatePresetApplicable",
    ) ||
    !functionCalls(
      programs.registry,
      "resolveContentTemplatePreset",
      "isContentTemplatePresetApplicable",
    ) ||
    !hasCall(programs.picker, "getContentTemplatePresets", [["context"]])
  ) {
    violations.add("ui_only_preset_applicability");
  }

  const writableContentStates = [
    programs.stateOwner,
    programs.articleCreateConsumer,
    programs.articleEditConsumer,
    programs.mediaConsumer,
  ].flatMap((program) =>
    collectNodes(program, ts.isVariableDeclaration).filter(
      (declaration) =>
        ts.isArrayBindingPattern(declaration.name) &&
        declaration.initializer &&
        ts.isCallExpression(declaration.initializer) &&
        callName(declaration.initializer) === "useState" &&
        bindingIdentifiers(declaration.name).some(
          identifiesWritableContentState,
        ),
    ),
  );
  if (writableContentStates.length !== 1) {
    violations.add("duplicate_writable_content_state");
  }

  const directlyManipulatesEditorDom = projectionPrograms.some((program) => {
    if (hasPropertyPath(program, ["view", "dom"])) return true;
    const writesEditorDom = collectNodes(program, ts.isBinaryExpression).some(
      (expression) => {
        if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
          return false;
        }
        const path = expressionPath(expression.left);
        return (
          pathEndsWith(path, ["view", "dom", "innerHTML"]) ||
          pathEndsWith(path, ["dom", "textContent"])
        );
      },
    );
    const queriesEditorDom = collectNodes(program, ts.isCallExpression).some(
      (call) => {
        if (callName(call) !== "querySelector") return false;
        const selector = staticString(call.arguments[0]);
        return Boolean(
          selector &&
            (selector.startsWith(".ProseMirror") ||
              selector.startsWith("[contenteditable")),
        );
      },
    );
    return writesEditorDom || queriesEditorDom;
  });
  if (directlyManipulatesEditorDom) {
    violations.add("direct_editor_dom_manipulation");
  }

  const keyedEditorProjection = projectionPrograms.some((program) =>
    ["AdminRichTextEditor", "TopicMarkdownEditor", "EditorContent"].some(
      (tagName) =>
        jsxElements(program, tagName).some((element) =>
          Boolean(jsxAttribute(element, "key")),
        ),
    ),
  );
  if (keyedEditorProjection) {
    violations.add("content_editor_key_remount");
  }

  if (
    !hasCall(programs.stateOwner, "resolveContentTemplatePreset", [
      ["presetKey"],
      ["templateContext"],
    ]) ||
    !hasCall(programs.stateOwner, "applyContentTemplatePreset", [
      null,
      ["presetKey"],
      ["templateContext"],
    ]) ||
    !hasCall(programs.picker, "onApplyPreset", [["selected", "key"]])
  ) {
    violations.add("unvalidated_direct_preset_apply");
  }

  return [...violations].sort();
}

function canonicalAdminRouteRoots(identity: ContentEditorRouteIdentity) {
  return identity.sourceFiles.filter(
    (sourceFile) =>
      sourceFile.startsWith("src/app/admin/") &&
      ["page.js", "page.jsx", "page.ts", "page.tsx"].some((fileName) =>
        sourceFile.endsWith(`/${fileName}`),
      ),
  );
}

function contentEditorRouteCoverage(input: {
  routeIdentities: readonly ContentEditorRouteIdentity[];
  registeredEditors: readonly RegisteredContentEditor[];
  sourceOverrides?: SourceOverrides;
}) {
  const registeredEditorRoutes = new Map<string, Set<string>>(
    input.registeredEditors.map((editor) => [editor.id, new Set()]),
  );
  const discoveredEditorSourceFiles = new Set<string>();
  const routesWithoutRegisteredEditor: string[] = [];
  const routeBindings = new Map<string, readonly string[]>();

  for (const identity of input.routeIdentities) {
    const routeRoots = canonicalAdminRouteRoots(identity);
    assert.ok(
      identity.route,
      `${identity.id} must retain its canonical Admin editor route.`,
    );
    assert.ok(
      routeRoots.length > 0,
      `${identity.id} must register at least one executable Admin page root.`,
    );
    for (const routeRoot of routeRoots) {
      assert.ok(
        input.sourceOverrides?.has(routeRoot) || existsSync(join(ROOT, routeRoot)),
        `${identity.id} registers missing route root ${routeRoot}.`,
      );
    }

    const graph = collectExecutableSourceGraph({
      root: ROOT,
      entrySourceFiles: routeRoots,
      sourceOverrides: input.sourceOverrides,
      symbolAware: true,
    });
    const reachableEditors = input.registeredEditors.filter((editor) =>
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: [{ sourceFile: editor.sourceFile, exportNames: ["default"] }],
        sourceOverrides: input.sourceOverrides,
      }),
    );
    for (const [sourceFile, parsed] of graph) {
      if (
        graphUsesExecutableBinding({
          root: ROOT,
          graph: new Map([[sourceFile, parsed]]),
          bindings: [
            {
              sourceFile: CONTENT_EDITOR_ARCHITECTURE.shellOwner,
              exportNames: ["default"],
            },
          ],
          sourceOverrides: input.sourceOverrides,
        })
      ) {
        discoveredEditorSourceFiles.add(sourceFile);
      }
    }
    routeBindings.set(
      identity.id,
      reachableEditors.map((editor) => editor.id),
    );
    if (reachableEditors.length === 0) {
      routesWithoutRegisteredEditor.push(identity.id);
    }
    for (const editor of reachableEditors) {
      registeredEditorRoutes.get(editor.id)?.add(identity.id);
    }
  }

  return {
    routeBindings,
    routesWithoutRegisteredEditor,
    unregisteredReachableEditorSourceFiles: [...discoveredEditorSourceFiles]
      .filter(
        (sourceFile) =>
          !input.registeredEditors.some(
            (editor) => editor.sourceFile === sourceFile,
          ),
      )
      .sort(),
    registeredEditorsWithoutRoute: input.registeredEditors
      .filter((editor) => registeredEditorRoutes.get(editor.id)?.size === 0)
      .map((editor) => editor.id),
  };
}

assert.deepEqual(
  CONTENT_EDITOR_ADOPTION_MANIFEST.map((entry) => entry.contentType),
  CONTENT_TYPES,
  "Content editor manifest must cover the executable content-type registry exactly once.",
);
assert.equal(
  new Set(CONTENT_EDITOR_ADOPTION_MANIFEST.map((entry) => entry.contentType))
    .size,
  CONTENT_EDITOR_ADOPTION_MANIFEST.length,
  "Content editor registrations must be unique.",
);
assert.deepEqual(CONTENT_EDITOR_ARCHITECTURE.proofBoundaries, {
  source: "source_and_executable_reachability",
  behavior: "behavior_verification_ledger",
});
assert.deepEqual(
  {
    globalClosed: CONTENT_EDITOR_ARCHITECTURE.globalClosed,
    globalClosureBlockers:
      CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers,
  },
  CONTENT_EDITOR_GLOBAL_CLOSURE,
  "Content Editor closure must be derived from the registered source gaps and behavior-proof ledger.",
);
assert.equal(
  CONTENT_EDITOR_ARCHITECTURE.globalClosed,
  CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.length === 0,
  "Content Editor global closure must equal the absence of derived blockers.",
);
const globalClosureBlockerIds = new Set(
  CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.map(
    (blocker) => blocker.id,
  ),
);
for (const sourceBlocker of CONTENT_EDITOR_SOURCE_BLOCKERS) {
  assert.ok(
    globalClosureBlockerIds.has(sourceBlocker.id),
    `Source-confirmed blocker ${sourceBlocker.id} must keep global closure open.`,
  );
}
assert.ok(
  !globalClosureBlockerIds.has("gallery-admin-shared-media-adoption") &&
    !CONTENT_EDITOR_SOURCE_BLOCKERS.some(
      (blocker) =>
        String(blocker.id) === "gallery-admin-shared-media-adoption",
    ),
  "Gallery Admin shared-media adoption must leave the blocker registry only after source and behavior proof.",
);
assert.ok(
  !globalClosureBlockerIds.has("gallery-public-projection") &&
    CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER.some(proof => proof.id === "gallery-public-projection" && proof.state === "source_proven_only" && proof.owner === "scripts/verify-public-content-delivery.mts"),
  "The old Gallery source defect is resolved with projection and renderer binding evidence, without claiming mounted public rendering or closing save parity.",
);
for (const proof of CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER) {
  const blockerId = `content-editor-behavior:${proof.id}`;
  assert.equal(
    globalClosureBlockerIds.has(blockerId),
    proof.requiredForGlobalClosure && proof.state !== "behavior_verified",
    `${proof.id} closure contribution must be derived from its behavioral proof state.`,
  );
}

const sourceProvenOnlyNegativeFixture = deriveContentEditorClosure({
  sourceBlockers: [],
  behaviorProofs: [
    {
      id: "negative-source-proof-is-not-behavior-proof",
      owner: "negative_fixture",
      state: "source_proven_only",
      requiredForGlobalClosure: true,
      rationale:
        "A passing source or executable graph cannot stand in for behavior verification.",
    },
  ],
});
assert.equal(
  sourceProvenOnlyNegativeFixture.globalClosed,
  false,
  "Negative fixture: source_proven_only must not close the Content Editor globally.",
);
assert.equal(
  sourceProvenOnlyNegativeFixture.globalClosureBlockers[0]?.evidence,
  "source_proven_only",
  "Negative fixture must preserve the evidence boundary on its derived blocker.",
);
assert.ok(
  CONTENT_EDITOR_ADOPTION_MANIFEST.every(
    (entry) => entry.currentContract === "topics_aggregate",
  ),
  "Every content type must retain the canonical Topics aggregate.",
);
assert.equal(CONTENT_EDITOR_ADAPTERS.article.supportsFaq, true);
assert.equal(CONTENT_EDITOR_ADAPTERS.video.body, "video");
assert.equal(CONTENT_EDITOR_ADAPTERS.gallery.body, "gallery");

const contentTemplatePresetRegistrySourceFile =
  "src/lib/admin/content-workflow/content-template-presets.ts";
const contentTemplatePickerSourceFile =
  "src/components/admin/content-workflow/ContentTemplatePicker.tsx";
const topicMarkdownEditorSourceFile =
  "src/components/admin/content/editors/article/TopicMarkdownEditor.tsx";
const richTextEditorSourceFile =
  "src/components/admin/AdminRichTextEditor.tsx";
const mediaContentFormSourceFile =
  "src/components/admin/content/editors/media/MediaContentForm.tsx";
const articleCreateEditorSourceFile =
  "src/components/admin/content/editors/ArticleCreateEditor.tsx";
const articleEditorSourceFile =
  "src/components/admin/content/editors/ArticleEditor.tsx";
const topicSeoPanelSourceFile = "src/components/admin/SeoPanel.tsx";

function assertExecutableSourceBinding(
  entrySourceFile: string,
  sourceFile: string,
  exportName: string,
) {
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [entrySourceFile],
    symbolAware: true,
  });
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: [{ sourceFile, exportNames: [exportName] }],
    }),
    `${entrySourceFile} must execute ${sourceFile}:${exportName}.`,
  );
}

assertExecutableSourceBinding(
  contentTemplatePickerSourceFile,
  contentTemplatePresetRegistrySourceFile,
  "getContentTemplatePresets",
);
for (const exportName of [
  "resolveContentTemplatePreset",
  "applyContentTemplatePreset",
]) {
  assertExecutableSourceBinding(
    CONTENT_EDITOR_ARCHITECTURE.shellOwner,
    contentTemplatePresetRegistrySourceFile,
    exportName,
  );
}
for (const articleSourceFile of [
  articleCreateEditorSourceFile,
  articleEditorSourceFile,
]) {
  for (const [sourceFile, exportName] of [
    [CONTENT_EDITOR_ARCHITECTURE.shellOwner, "default"],
    [topicMarkdownEditorSourceFile, "default"],
    [topicSeoPanelSourceFile, "default"],
    [CONTENT_EDITOR_ARCHITECTURE.reviewOwner, "default"],
  ] as const) {
    assertExecutableSourceBinding(articleSourceFile, sourceFile, exportName);
  }
}
for (const [sourceFile, exportName] of [
  [CONTENT_EDITOR_ARCHITECTURE.shellOwner, "default"],
  [contentTemplatePickerSourceFile, "default"],
  [topicMarkdownEditorSourceFile, "default"],
  [
    "src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx",
    "default",
  ],
  [CONTENT_EDITOR_ARCHITECTURE.reviewOwner, "default"],
] as const) {
  assertExecutableSourceBinding(mediaContentFormSourceFile, sourceFile, exportName);
}

const contentEditorStateGuardSources: ContentEditorStateGuardSources = {
  picker: readSource(contentTemplatePickerSourceFile),
  registry: readSource(contentTemplatePresetRegistrySourceFile),
  stateOwner: readSource(CONTENT_EDITOR_ARCHITECTURE.shellOwner),
  markdownAdapter: readSource(topicMarkdownEditorSourceFile),
  richTextEditor: readSource(richTextEditorSourceFile),
  articleCreateConsumer: readSource(articleCreateEditorSourceFile),
  articleEditConsumer: readSource(articleEditorSourceFile),
  mediaConsumer: readSource(mediaContentFormSourceFile),
};
const articleEditorPrograms = [
  readParsedSource(articleCreateEditorSourceFile),
  readParsedSource(articleEditorSourceFile),
];
const mediaContentForm = readParsedSource(mediaContentFormSourceFile);
const mediaPanelAdoptionSources = {
  consumer: mediaContentForm.text.replaceAll("\r\n", "\n"),
  seo: readSource("src/components/admin/content/editors/media/MediaEntitySeoPanel.tsx"),
};
function hasCanonicalMediaPanelAdoption(sources: typeof mediaPanelAdoptionSources) {
  const consumer = parseTypeScriptSource("MediaContentForm.tsx", sources.consumer);
  const seo = parseTypeScriptSource("MediaEntitySeoPanel.tsx", sources.seo);
  const tabs = collectNodes(consumer, ts.isObjectLiteralExpression);
  const seoTabs = tabs.filter((node) => staticString(objectLiteralProperty(node, "id")) === "seo");
  const reviewTabs = tabs.filter((node) => staticString(objectLiteralProperty(node, "id")) === "publish");
  const delegates = ["MediaEntitySeoPanel", "ContentReviewPanel", "ContentPublishingOptions"].map((tag) => jsxElements(consumer, tag));
  const display = jsxElements(consumer, "ContentDisplaySettings");
  const root = jsxElements(seo, "AdminEntitySeoPanel");
  const forwarded = root.length === 1 ? jsxAttributeExpression(root[0]!, "presentation") : null;
  const fallback = forwarded && ts.isBinaryExpression(forwarded)
    && forwarded.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    && ts.isIdentifier(forwarded.left) && forwarded.left.text === "presentation"
    ? unwrapExpression(forwarded.right) : null;
  const optionalPresentation = collectNodes(seo, ts.isPropertySignature).some((node) =>
    staticPropertyName(node.name) === "presentation" && node.questionToken && node.type
    && ts.isUnionTypeNode(node.type) && ["default", "premium", "panel"].every((value) =>
      node.type!.getText(seo).includes(`"${value}"`)));
  return delegates.every((nodes) => nodes.length === 1 && jsxAttributeStaticString(nodes[0]!, "presentation") === "panel")
    && seoTabs.length === 1 && !objectLiteralProperty(seoTabs[0]!, "sectionHeading") && !objectLiteralProperty(seoTabs[0]!, "sectionDescription")
    && reviewTabs.length === 1 && Boolean(objectLiteralProperty(reviewTabs[0]!, "sectionHeaderPresentation"))
    && staticString(unwrapExpression(objectLiteralProperty(reviewTabs[0]!, "sectionHeaderPresentation")!)) === "premium"
    && display.length === 1 && jsxAttributeStaticString(display[0]!, "presentation") === "premium-inline"
    && optionalPresentation && fallback && ts.isConditionalExpression(fallback)
    && fallback.condition.getText(seo) === 'contentType === "video"'
    && staticString(fallback.whenTrue) === "panel" && staticString(fallback.whenFalse) === "premium";
}
assert.ok(hasCanonicalMediaPanelAdoption(mediaPanelAdoptionSources),
  "All current Media Create/Edit consumers explicitly select canonical SEO, Review and Publishing panels, keep the premium Review header and approved inline Display, and retain omitted Media SEO defaults.");
for (const [role, label, from, to] of [
  ["consumer", "SEO panel omitted", '<MediaEntitySeoPanel seoSettings={seoSettings}\n            presentation="panel"', '<MediaEntitySeoPanel seoSettings={seoSettings}'],
  ["consumer", "Review panel omitted", '<ContentReviewPanel\n            presentation="panel"', '<ContentReviewPanel'],
  ["consumer", "Publishing panel omitted", '<ContentPublishingOptions\n                presentation="panel"', '<ContentPublishingOptions'],
  ["consumer", "Review premium header omitted", 'sectionHeaderPresentation: "premium" as const,', 'sectionHeaderPresentation: undefined,'],
  ["consumer", "SEO duplicate outer heading", 'navigationLabel: "SEO",', 'navigationLabel: "SEO", sectionHeading: "Duplicate SEO",'],
  ["consumer", "Display changed from approved inline", 'presentation="premium-inline"', 'presentation="panel"'],
  ["seo", "optional SEO presentation made required", 'presentation?: "default" | "premium" | "panel";', 'presentation: "default" | "premium" | "panel";'],
  ["seo", "SEO forwarding removed", 'presentation={presentation ?? (contentType === "video" ? "panel" : "premium")}', 'presentation={contentType === "video" ? "panel" : "premium"}'],
  ["seo", "omitted SEO defaults globally changed", 'presentation={presentation ?? (contentType === "video" ? "panel" : "premium")}', 'presentation={presentation ?? "panel"}'],
] as const) {
  assert.ok(mediaPanelAdoptionSources[role].includes(from), `Panel adoption negative fixture must mutate actual source: ${label}`);
  assert.ok(!hasCanonicalMediaPanelAdoption({ ...mediaPanelAdoptionSources, [role]: mediaPanelAdoptionSources[role].replace(from, to) }),
    `Panel adoption negative fixture: ${label} must fail closed.`);
}
for (const tag of ["MediaEntitySeoPanel", "ContentReviewPanel", "ContentPublishingOptions"]) {
  assert.ok(!hasCanonicalMediaPanelAdoption({ ...mediaPanelAdoptionSources, consumer: `${mediaPanelAdoptionSources.consumer}\nconst duplicate = <${tag} presentation="panel" />;` }),
    `Panel adoption negative fixture: duplicate ${tag} must fail closed.`);
}
const topicSeoPanel = readParsedSource(topicSeoPanelSourceFile);
const richTextEditor = readParsedSource(richTextEditorSourceFile);

assert.deepEqual(
  collectContentEditorStateGuardViolations(contentEditorStateGuardSources),
  [],
  "Content preset application and editor projection must retain one typed state owner without DOM synchronization workarounds.",
);

for (const articleEditor of articleEditorPrograms) {
  const shell = jsxElements(articleEditor, "ContentEditorShell").find(
    (element) =>
      jsxAttributePathIs(element, "initialModelValue", ["initialModelValue"]) &&
      jsxAttributePathIs(element, "templateContext", ["templateContext"]) &&
      jsxAttributePathIs(element, "tabs", ["renderTabs"]),
  );
  const markdown = jsxElements(articleEditor, "TopicMarkdownEditor").find(
    (element) =>
      jsxAttributePathIs(element, "value", ["model", "value", "content"]) &&
      Boolean(jsxAttribute(element, "onValueChange")),
  );
  const basic = jsxElements(articleEditor, "ContentBasicDataPanel").find(
    (element) =>
      jsxHasAttributes(element, [
        "controlledValues",
        "onControlledValueChange",
      ]),
  );
  const seo = jsxElements(articleEditor, "SeoPanel").find((element) =>
    jsxHasAttributes(element, [
      "controlledValues",
      "onControlledValueChange",
    ]),
  );
  const review = jsxElements(articleEditor, "ContentReviewPanel").find(
    (element) => Boolean(jsxAttribute(element, "controlledValues")),
  );
  assert.ok(
    shell && markdown && basic && seo && review,
    "Article Content Editors must project Basic, Markdown, SEO, and Review from the canonical typed model.",
  );
}
assert.ok(
  hasTypeProperty(topicSeoPanel, "controlledValues") &&
    hasPropertyAssignmentPath(topicSeoPanel, "description", [
      "props",
      "controlledValues",
      "excerpt",
    ]) &&
    jsxElements(topicSeoPanel, "AdminEntitySeoPanel").some((element) =>
      jsxAttributePathIs(element, "onControlledValueChange", [
        "props",
        "onControlledValueChange",
      ]),
    ),
  "Topic SEO must consume the canonical Content Editor projection instead of relying on a synthetic hidden-input event.",
);
assert.ok(
  collectNodes(richTextEditor, ts.isBinaryExpression).some(
    (expression) =>
      expression.operatorToken.kind ===
        ts.SyntaxKind.ExclamationEqualsEqualsToken &&
      pathEndsWith(expressionPath(expression.left), [
        "uncontrolledDefaultValue",
      ]) &&
      pathEndsWith(expressionPath(expression.right), ["normalizedDefaultValue"]),
  ) &&
    hasCall(richTextEditor, "setUncontrolledValue", [
      ["normalizedDefaultValue"],
    ]) &&
    hasCall(richTextEditor, "setUncontrolledDefaultValue", [
      ["normalizedDefaultValue"],
    ]),
  "Uncontrolled Rich Text consumers must resynchronize when their authoritative default changes.",
);
const mediaTemplateContentType = objectPathExpression(
  mediaContentForm,
  "templateContext",
  ["mediaContentType"],
);
assert.ok(
  staticObjectPath(mediaContentForm, "templateContext", ["target"]) ===
    "media" &&
    pathEndsWith(
      mediaTemplateContentType
        ? expressionPath(mediaTemplateContentType)
        : null,
      ["contentType"],
    ) &&
    jsxElements(mediaContentForm, "ContentEditorShell").some((element) =>
      jsxAttributePathIs(element, "templateContext", ["templateContext"]),
    ),
  "Media preset applicability must derive templateContext.mediaContentType from the actual Content Editor contentType.",
);

for (const findingId of [
  "adm-04-editor-state-binding",
  "adm-11-preset-applicability",
  "adm-12-specialized-field-errors",
] as const) {
  const proof = CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER.find(
    (candidate) => candidate.id === findingId,
  );
  assert.ok(proof, `${findingId} must remain recorded in the Content Editor ledger.`);
  assert.equal(
    proof.state,
    "behavior_verified",
    `${findingId} can close only with actual-component behavioral evidence.`,
  );
  assert.equal(
    proof.owner,
    "scripts/qa-admin-form-guarded-navigation.mts",
    `${findingId} must reference the mounted Chromium evidence owner.`,
  );
  assert.equal(
    proof.requiredForGlobalClosure,
    false,
    `${findingId} is a bounded finding and must not hide broader global blockers.`,
  );
}

for (const [findingId, evidenceOwner] of [
  [
    "adm-05-safe-content-duplication",
    "scripts/verify-content-duplication-safety.mts",
  ],
  [
    "adm-06-publish-title-quality-policy",
    "scripts/verify-content-publish-validation-truth.mts",
  ],
  [
    "adm-08-shared-gallery-authoring",
    "scripts/qa-admin-shared-gallery-authoring.mts",
  ],
] as const) {
  const proof = CONTENT_EDITOR_BEHAVIOR_PROOF_LEDGER.find(
    (candidate) => candidate.id === findingId,
  );
  assert.ok(proof, `${findingId} must be recorded in the Content Editor ledger.`);
  assert.ok(
    existsSync(join(ROOT, evidenceOwner)),
    `${findingId} must reference an existing rerunnable evidence owner.`,
  );
  assert.equal(
    proof.state,
    "behavior_verified",
    `${findingId} can close only with rerunnable behavioral evidence.`,
  );
  assert.equal(
    proof.owner,
    evidenceOwner,
    `${findingId} must reference its executable evidence owner.`,
  );
  assert.equal(
    proof.requiredForGlobalClosure,
    false,
    `${findingId} is bounded and must not hide broader Content Editor blockers.`,
  );
}

const packageScripts = (
  JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  }
).scripts ?? {};
assert.ok(
  packageScripts["verify:content-editor-adoption"]?.includes(
    "qa:shared-gallery-authoring",
  ) &&
    packageScripts["ci:check"]?.includes("verify:content-editor-adoption"),
  "ADM-08 behavioral proof must remain executable through the Content Editor CI path.",
);
const topicDraftQaRunner = readSource("scripts/qa-home-story-presentation.mjs");
const topicDraftQualityWorkflow = readSource(".github/workflows/quality-gate.yml");
function topicDraftBrowserQaIsIntegrated(scripts: Record<string, string>, workflow: string, runner: string) {
  const commands = (name: string) => (scripts[name] ?? "").split(/\s*&&\s*/);
  const editorGate = commands("verify:content-editor-adoption");
  const sourceIndex = editorGate.indexOf("node --experimental-strip-types scripts/verify-unified-content-editors-adoption.mts");
  const galleryIndex = editorGate.indexOf("npm run qa:shared-gallery-authoring");
  const draftIndex = editorGate.indexOf("npm run qa:topic-form-draft-recovery");
  const tree = parseTypeScriptSource("qa-home-story-presentation.mjs", runner);
  const fullEntry = tree.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node)
    && collectNodes(node.expression, ts.isCallExpression).some(call => pathEndsWith(expressionPath(call.expression), ["process", "argv", "includes"])
      && staticString(call.arguments[0]) === "--full-form-draft-only"));
  const existingRunner = collectNodes(tree, ts.isFunctionDeclaration).find(node => node.name?.text === "verifyTopicContentPresentation");
  const fullBranch = existingRunner && collectNodes(existingRunner, ts.isIfStatement).some(node => ts.isIdentifier(node.expression) && node.expression.text === "fullFormDraftOnly");
  return scripts["qa:topic-form-draft-recovery"] === "node scripts/qa-home-story-presentation.mjs --full-form-draft-only"
    && sourceIndex >= 0 && galleryIndex > sourceIndex && draftIndex > galleryIndex
    && commands("verify").includes("npm run verify:content-editor-adoption")
    && commands("ci:check").includes("npm run verify:content-editor-adoption")
    && /^\s+run:\s+npm run ci:check\s*$/m.test(workflow)
    && Boolean(fullEntry && hasCall(fullEntry.thenStatement, "verifyTopicContentPresentation") && fullBranch);
}
assert.ok(topicDraftBrowserQaIsIntegrated(packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner),
  "Full six-consumer Draft browser regressions must remain reachable through the existing Content Editor local/CI gate; isolated Source Proof cannot replace them.");
for (const [label, scripts, workflow, runner] of [
  ["missing alias", { ...packageScripts, "qa:topic-form-draft-recovery": "" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["first-case subset", { ...packageScripts, "qa:topic-form-draft-recovery": "node scripts/qa-home-story-presentation.mjs --full-form-draft-only --draft-first-case" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["boundary-only subset", { ...packageScripts, "qa:topic-form-draft-recovery": "node scripts/qa-home-story-presentation.mjs --full-form-draft-only --draft-boundaries-only" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["ignored browser failure", { ...packageScripts, "qa:topic-form-draft-recovery": "node scripts/qa-home-story-presentation.mjs --full-form-draft-only || true" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["orphaned browser alias", { ...packageScripts, "verify:content-editor-adoption": packageScripts["verify:content-editor-adoption"].replace(" && npm run qa:topic-form-draft-recovery", "") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["local release disconnected", { ...packageScripts, verify: packageScripts.verify.replace("npm run verify:content-editor-adoption", "npm run lint") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["CI gate disconnected", { ...packageScripts, "ci:check": packageScripts["ci:check"].replace("npm run verify:content-editor-adoption", "npm run lint") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["workflow disconnected", packageScripts, topicDraftQualityWorkflow.replace("run: npm run ci:check", "run: npm run lint"), topicDraftQaRunner],
  ["full runner branch disconnected", packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner.replaceAll("--full-form-draft-only", "--disconnected-draft-flag")],
] as const) {
  assert.ok(!topicDraftBrowserQaIsIntegrated(scripts, workflow, runner), `Full Draft browser CI integration rejects ${label}.`);
}
function contentPanelGalleryQaIsIntegrated(scripts: Record<string, string>, workflow: string, runner: string) {
  if (/[|;\r\n]/.test(scripts["verify:content-editor-adoption"] ?? "")) return false;
  const commands = (name: string) => (scripts[name] ?? "").split(/\s*&&\s*/);
  const editorGate = commands("verify:content-editor-adoption");
  const sourceIndex = editorGate.indexOf("node --experimental-strip-types scripts/verify-unified-content-editors-adoption.mts");
  const galleryIndex = editorGate.indexOf("npm run qa:shared-gallery-authoring");
  const draftIndex = editorGate.indexOf("npm run qa:topic-form-draft-recovery");
  const panelIndex = editorGate.indexOf("npm run qa:content-panel-gallery");
  const tree = parseTypeScriptSource("qa-home-story-presentation.mjs", runner);
  const hasFlag = (root: ts.Node) => collectNodes(root, ts.isCallExpression).some((call) =>
    pathEndsWith(expressionPath(call.expression), ["process", "argv", "includes"])
    && staticString(call.arguments[0]) === "--content-panel-gallery-only");
  const entry = tree.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && hasFlag(node.expression));
  const existingRunner = functionDeclaration(tree, "verifyTopicContentPresentation");
  const flag = existingRunner && collectNodes(existingRunner, ts.isVariableDeclaration).some((node) =>
    ts.isIdentifier(node.name) && node.name.text === "contentPanelGalleryOnly" && node.initializer && hasFlag(node.initializer));
  const awaits = (root: ts.Node, name: string) => ts.isBlock(root) && root.statements.some((node) =>
    ts.isExpressionStatement(node) && ts.isAwaitExpression(node.expression)
    && ts.isCallExpression(node.expression.expression) && ts.isIdentifier(node.expression.expression.expression)
    && node.expression.expression.expression.text === name);
  const branch = existingRunner && collectNodes(existingRunner, ts.isIfStatement).some((node) =>
    ts.isIdentifier(node.expression) && node.expression.text === "contentPanelGalleryOnly"
    && awaits(node.thenStatement, "verifyContentPanelGalleryAdoption"));
  return scripts["qa:content-panel-gallery"] === "node scripts/qa-home-story-presentation.mjs --content-panel-gallery-only"
    && sourceIndex >= 0 && galleryIndex > sourceIndex && draftIndex > galleryIndex && panelIndex > draftIndex
    && commands("verify").includes("npm run verify:content-editor-adoption")
    && commands("ci:check").includes("npm run verify:content-editor-adoption")
    && /^\s+run:\s+npm run ci:check\s*$/m.test(workflow)
    && Boolean(entry && awaits(entry.thenStatement, "verifyTopicContentPresentation")
      && flag && branch
      && functionDeclaration(tree, "verifyContentPanelGalleryAdoption"));
}
assert.ok(contentPanelGalleryQaIsIntegrated(packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner),
  "The bounded Content Panel/Gallery browser regressions must run after existing Draft and Gallery checks through the current local and CI Content Editor gate, propagating failures through the existing runner.");
for (const [label, scripts, workflow, runner] of [
  ["missing panel alias", { ...packageScripts, "qa:content-panel-gallery": "" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["legacy Video flag", { ...packageScripts, "qa:content-panel-gallery": "node scripts/qa-home-story-presentation.mjs --video-panel-only" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["ignored panel alias failure", { ...packageScripts, "qa:content-panel-gallery": "node scripts/qa-home-story-presentation.mjs --content-panel-gallery-only || true" }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["orphaned panel alias", { ...packageScripts, "verify:content-editor-adoption": packageScripts["verify:content-editor-adoption"].replace(" && npm run qa:content-panel-gallery", "") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["ignored panel gate failure", { ...packageScripts, "verify:content-editor-adoption": `${packageScripts["verify:content-editor-adoption"]} || true` }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["panel local gate disconnected", { ...packageScripts, verify: packageScripts.verify.replace("npm run verify:content-editor-adoption", "npm run lint") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["panel CI gate disconnected", { ...packageScripts, "ci:check": packageScripts["ci:check"].replace("npm run verify:content-editor-adoption", "npm run lint") }, topicDraftQualityWorkflow, topicDraftQaRunner],
  ["panel workflow disconnected", packageScripts, topicDraftQualityWorkflow.replace("run: npm run ci:check", "run: npm run lint"), topicDraftQaRunner],
  ["panel runner flag disconnected", packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner.replaceAll("--content-panel-gallery-only", "--disconnected-panel-flag")],
  ["panel runner branch disconnected", packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner.replace(/if \(contentPanelGalleryOnly\)(?= \{\r?\n\s+await verifyContentPanelGalleryAdoption\()/, "if (false)")],
  ["panel failure no longer awaited", packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner.replace("await verifyContentPanelGalleryAdoption({", "void verifyContentPanelGalleryAdoption({")],
] as const) {
  assert.ok(JSON.stringify(scripts) !== JSON.stringify(packageScripts) || workflow !== topicDraftQualityWorkflow || runner !== topicDraftQaRunner,
    `Content Panel/Gallery CI negative fixture must mutate current bytes: ${label}.`);
  assert.ok(!contentPanelGalleryQaIsIntegrated(scripts, workflow, runner), `Content Panel/Gallery CI integration rejects ${label}.`);
}

function draftNoticeQaIsIntegrated(scripts: Record<string, string>, workflow: string, runner: string) {
  if (!contentPanelGalleryQaIsIntegrated(scripts, workflow, runner)) return false;
  const commands = (scripts["verify:content-editor-adoption"] ?? "").split("&&").map(value => value.trim());
  const tree = parseTypeScriptSource("qa-home-story-presentation.mjs", runner);
  const hasFlag = (root: ts.Node) => collectNodes(root, ts.isCallExpression).some(call =>
    pathEndsWith(expressionPath(call.expression), ["process", "argv", "includes"])
    && staticString(call.arguments[0]) === "--draft-notice-only");
  const awaits = (root: ts.Node, name: string) => ts.isBlock(root) && root.statements.some(node =>
    ts.isExpressionStatement(node) && ts.isAwaitExpression(node.expression)
    && ts.isCallExpression(node.expression.expression) && ts.isIdentifier(node.expression.expression.expression)
    && node.expression.expression.expression.text === name);
  const entry = tree.statements.find((node): node is ts.IfStatement => ts.isIfStatement(node) && hasFlag(node.expression));
  const existing = functionDeclaration(tree, "verifyTopicContentPresentation");
  const flag = existing && collectNodes(existing, ts.isVariableDeclaration).some(node =>
    ts.isIdentifier(node.name) && node.name.text === "draftNoticeOnly" && node.initializer && hasFlag(node.initializer));
  const branch = existing && collectNodes(existing, ts.isIfStatement).some(node =>
    ts.isIdentifier(node.expression) && node.expression.text === "draftNoticeOnly" && awaits(node.thenStatement, "verifyDraftNoticeUnification"));
  return scripts["qa:draft-notices"] === "node scripts/qa-home-story-presentation.mjs --draft-notice-only"
    && commands.indexOf("npm run qa:draft-notices") > commands.indexOf("npm run qa:content-panel-gallery")
    && Boolean(entry && awaits(entry.thenStatement, "verifyTopicContentPresentation") && flag && branch
      && functionDeclaration(tree, "verifyDraftNoticeUnification"));
}
assert.ok(draftNoticeQaIsIntegrated(packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner),
  "All Draft notice states have a bounded actual-component QA entry reachable through the existing local/CI gate with awaited failures.");
for (const [label, scripts, runner] of [
  ["missing alias", { ...packageScripts, "qa:draft-notices": "" }, topicDraftQaRunner],
  ["ignored alias failure", { ...packageScripts, "qa:draft-notices": "node scripts/qa-home-story-presentation.mjs --draft-notice-only || true" }, topicDraftQaRunner],
  ["orphaned alias", { ...packageScripts, "verify:content-editor-adoption": packageScripts["verify:content-editor-adoption"].replace(" && npm run qa:draft-notices", "") }, topicDraftQaRunner],
  ["ignored gate failure", { ...packageScripts, "verify:content-editor-adoption": `${packageScripts["verify:content-editor-adoption"]} || true` }, topicDraftQaRunner],
  ["disconnected flag", packageScripts, topicDraftQaRunner.replaceAll("--draft-notice-only", "--disconnected-notice-flag")],
  ["disconnected branch", packageScripts, topicDraftQaRunner.replace(/if \(draftNoticeOnly\)(?= \{\r?\n\s+await verifyDraftNoticeUnification\()/, "if (false)")],
  ["unawaited failure", packageScripts, topicDraftQaRunner.replace("await verifyDraftNoticeUnification({", "void verifyDraftNoticeUnification({")],
] as const) {
  assert.ok(JSON.stringify(scripts) !== JSON.stringify(packageScripts) || runner !== topicDraftQaRunner,
    `Draft notice CI negative fixture mutates current bytes: ${label}.`);
  assert.ok(!draftNoticeQaIsIntegrated(scripts, topicDraftQualityWorkflow, runner), `Draft notice CI rejects ${label}.`);
}

function unifiedImageQaIsIntegrated(scripts: Record<string, string>, workflow: string, runner: string) {
  if (!draftNoticeQaIsIntegrated(scripts, workflow, runner)) return false;
  const gate = scripts["verify:content-editor-adoption"] ?? "";
  if (/[|;\r\n]/u.test(gate)) return false;
  const commands = gate.split("&&").map(command => command.trim());
  const tree = parseTypeScriptSource("qa-home-story-presentation.mjs", runner);
  const owner = functionDeclaration(tree, "verifyTopicContentPresentation");
  const bounded = functionDeclaration(tree, "verifyUnifiedImageSystem");
  const flags = collectNodes(tree, ts.isCallExpression).filter(call => pathEndsWith(expressionPath(call.expression), ["process", "argv", "includes"]) && staticString(call.arguments[0]) === "--unified-image-only");
  const awaited = owner && collectNodes(owner, ts.isIfStatement).some(branch => ts.isIdentifier(branch.expression) && branch.expression.text === "unifiedImageOnly" && ts.isBlock(branch.thenStatement) && branch.thenStatement.statements.some(node => ts.isExpressionStatement(node) && ts.isAwaitExpression(node.expression) && ts.isCallExpression(node.expression.expression) && ts.isIdentifier(node.expression.expression.expression) && node.expression.expression.expression.text === "verifyUnifiedImageSystem"));
  return scripts["qa:unified-image"] === "node scripts/qa-home-story-presentation.mjs --unified-image-only" && commands.indexOf("npm run qa:unified-image") > commands.indexOf("npm run qa:draft-notices") && flags.length >= 2 && Boolean(owner && bounded && awaited);
}
assert.ok(unifiedImageQaIsIntegrated(packageScripts, topicDraftQualityWorkflow, topicDraftQaRunner), "Unified image QA uses the existing actual-consumer fixture and required gate with failure propagation.");
for (const [label, scripts, runner] of [
  ["missing alias", { ...packageScripts, "qa:unified-image": "" }, topicDraftQaRunner],
  ["ignored alias failure", { ...packageScripts, "qa:unified-image": packageScripts["qa:unified-image"] + " || true" }, topicDraftQaRunner],
  ["orphaned gate", { ...packageScripts, "verify:content-editor-adoption": packageScripts["verify:content-editor-adoption"].replace(" && npm run qa:unified-image", "") }, topicDraftQaRunner],
  ["ignored gate failure", { ...packageScripts, "verify:content-editor-adoption": packageScripts["verify:content-editor-adoption"] + " || true" }, topicDraftQaRunner],
  ["disconnected flag", packageScripts, topicDraftQaRunner.replaceAll("--unified-image-only", "--disconnected-image-flag")],
  ["unawaited failure", packageScripts, topicDraftQaRunner.replace("await verifyUnifiedImageSystem({", "void verifyUnifiedImageSystem({")],
] as const) {
  assert.ok(JSON.stringify(scripts) !== JSON.stringify(packageScripts) || runner !== topicDraftQaRunner, label + " mutates actual unified image QA integration.");
  assert.ok(!unifiedImageQaIsIntegrated(scripts, topicDraftQualityWorkflow, runner), "Unified image QA rejects " + label);
}

const negativeStateGuardFixtures: ReadonlyArray<{
  id: string;
  expected: ContentEditorStateGuardViolation;
  sources: ContentEditorStateGuardSources;
}> = [
  {
    id: "template-picker-dom-write",
    expected: "template_picker_dom_mutation",
    sources: {
      ...contentEditorStateGuardSources,
      picker:
        'document.getElementById("content")!.value = nextValue;',
    },
  },
  {
    id: "synthetic-input-sync",
    expected: "synthetic_editor_sync_event",
    sources: {
      ...contentEditorStateGuardSources,
      picker:
        'field.dispatchEvent(new Event("input", { bubbles: true }));',
    },
  },
  {
    id: "writable-hidden-content-owner",
    expected: "writable_hidden_content_owner",
    sources: {
      ...contentEditorStateGuardSources,
      richTextEditor:
        '<input type="hidden" name="content" defaultValue={content} onInput={syncContent} />;',
    },
  },
  {
    id: "submit-formdata-content-override",
    expected: "submit_time_content_override",
    sources: {
      ...contentEditorStateGuardSources,
      stateOwner:
        'form.addEventListener("formdata", (event) => event.formData.set("content", value.content));',
    },
  },
  ...[
    ["uncollected-formdata-in-draft-owner", 'export function TopicFormDraftRecovery() { const payload = new FormData(form); }'],
    ["foreign-form-draft-read", 'import { collectTopicFormDraftFields } from "../../../../../lib/admin/content/topic-revision"; export function TopicFormDraftRecovery() { return collectTopicFormDraftFields(new FormData(otherForm), scope.contentType); }'],
    ["parallel-draft-collector", 'import { collectTopicFormDraftFields } from "parallel-drafts"; export function TopicFormDraftRecovery() { return collectTopicFormDraftFields(new FormData(form), scope.contentType); }'],
    ["draft-read-outside-existing-owner", 'import { collectTopicFormDraftFields } from "../../../../../lib/admin/content/topic-revision"; export function ParallelDraftRecovery() { return collectTopicFormDraftFields(new FormData(form), scope.contentType); }'],
    ["content-write-inside-draft-owner", 'import { collectTopicFormDraftFields } from "../../../../../lib/admin/content/topic-revision"; export function TopicFormDraftRecovery() { const fields = collectTopicFormDraftFields(new FormData(form), scope.contentType); data.set("content", fields.content); }'],
  ].map(([id, markdownAdapter]) => ({
    id,
    expected: "submit_time_content_override" as const,
    sources: { ...contentEditorStateGuardSources, markdownAdapter },
  })),
  {
    id: "picker-only-applicability",
    expected: "ui_only_preset_applicability",
    sources: {
      ...contentEditorStateGuardSources,
      picker:
        "const presets = VENESIA_CONTENT_TEMPLATE_PRESETS.filter((preset) => preset.target === context.target);",
    },
  },
  {
    id: "parallel-writable-content-state",
    expected: "duplicate_writable_content_state",
    sources: {
      ...contentEditorStateGuardSources,
      stateOwner:
        "const [content, setContent] = useState(initial.content); const [editorContent, setEditorContent] = useState(initial.content);",
    },
  },
  {
    id: "direct-prosemirror-dom-write",
    expected: "direct_editor_dom_manipulation",
    sources: {
      ...contentEditorStateGuardSources,
      richTextEditor: "editor.view.dom.innerHTML = nextValue;",
    },
  },
  {
    id: "editor-key-remount",
    expected: "content_editor_key_remount",
    sources: {
      ...contentEditorStateGuardSources,
      markdownAdapter:
        '<AdminRichTextEditor key={content} name="content" label="Content" />;',
    },
  },
  {
    id: "direct-unvalidated-preset-apply",
    expected: "unvalidated_direct_preset_apply",
    sources: {
      ...contentEditorStateGuardSources,
      stateOwner:
        "resolveContentTemplatePreset(presetKey, templateContext); applyVisiblePresetDefaults(current, presetKey, templateContext);",
    },
  },
];

for (const fixture of negativeStateGuardFixtures) {
  assert.ok(
    collectContentEditorStateGuardViolations(fixture.sources).includes(
      fixture.expected,
    ),
    `Negative fixture ${fixture.id} must fail with ${fixture.expected}.`,
  );
}

assert.equal(
  new Set(VENESIA_CONTENT_TEMPLATE_PRESETS.map((preset) => preset.key)).size,
  VENESIA_CONTENT_TEMPLATE_PRESETS.length,
  "Content Template Registry keys must be unique.",
);
const mediaEditableContentTypeSet = new Set<string>(
  MEDIA_EDITABLE_CONTENT_TYPES,
);
for (const preset of VENESIA_CONTENT_TEMPLATE_PRESETS) {
  if (preset.target === "article") {
    assert.equal(
      preset.mediaContentType,
      undefined,
      `${preset.key} cannot combine Article applicability with Media metadata.`,
    );
  } else {
    assert.ok(
      preset.mediaContentType &&
        mediaEditableContentTypeSet.has(preset.mediaContentType),
      `${preset.key} must derive a valid Media content type from the canonical content registry.`,
    );
  }
}

const contentTemplateContexts: ReadonlyArray<{
  contentType: ContentType;
  context: ContentTemplateContext;
}> = CONTENT_TYPES.map((contentType) => ({
  contentType,
  context:
    contentType === "article"
      ? { target: "article" }
      : { target: "media", mediaContentType: contentType },
}));
const currentTemplateValues: ContentTemplateEditableValues = {
  title: "current title",
  excerpt: "current excerpt",
  content: "current content",
  seoTitle: "current SEO title",
  seoDescription: "current SEO description",
  focusKeyword: "current focus keyword",
};
const presetApplicabilityMatrix = new Map<ContentType, readonly string[]>();

for (const { contentType, context } of contentTemplateContexts) {
  const metadataApplicablePresets = VENESIA_CONTENT_TEMPLATE_PRESETS.filter(
    (preset) =>
      preset.target === context.target &&
      (context.target === "article"
        ? preset.mediaContentType === undefined
        : preset.mediaContentType === context.mediaContentType),
  );
  const visiblePresets = getContentTemplatePresets(context);
  presetApplicabilityMatrix.set(
    contentType,
    visiblePresets.map((preset) => preset.key),
  );
  assert.deepEqual(
    visiblePresets.map((preset) => preset.key),
    metadataApplicablePresets.map((preset) => preset.key),
    `${contentType} picker applicability must be derived from Registry metadata.`,
  );

  for (const preset of VENESIA_CONTENT_TEMPLATE_PRESETS) {
    const expectedApplicable = metadataApplicablePresets.includes(preset);
    assert.equal(
      isContentTemplatePresetApplicable(preset, context),
      expectedApplicable,
      `${preset.key} applicability must match its Registry metadata for ${contentType}.`,
    );
    assert.equal(
      resolveContentTemplatePreset(preset.key, context)?.key ?? null,
      expectedApplicable ? preset.key : null,
      `${preset.key} direct resolution must use the same applicability truth for ${contentType}.`,
    );

    const applied = applyContentTemplatePreset(
      currentTemplateValues,
      preset.key,
      context,
    );
    if (!expectedApplicable) {
      assert.equal(
        applied,
        null,
        `${preset.key} must fail closed when directly applied to ${contentType}.`,
      );
      continue;
    }

    assert.ok(applied, `${preset.key} must apply to ${contentType}.`);
    for (const field of Object.keys(currentTemplateValues) as Array<
      keyof ContentTemplateEditableValues
    >) {
      assert.equal(
        applied[field],
        preset.defaults[field] ?? currentTemplateValues[field],
        `${preset.key} must update only its Registry-declared ${field} default.`,
      );
    }
  }

  assert.equal(
    resolveContentTemplatePreset("__unknown_preset__", context),
    null,
    `${contentType} must reject an unknown preset key.`,
  );
  assert.equal(
    applyContentTemplatePreset(
      currentTemplateValues,
      "__unknown_preset__",
      context,
    ),
    null,
    `${contentType} must not mutate state for an unknown preset key.`,
  );
}

for (const mediaContentType of MEDIA_EDITABLE_CONTENT_TYPES) {
  const hasRegisteredPreset = VENESIA_CONTENT_TEMPLATE_PRESETS.some(
    (preset) =>
      preset.target === "media" &&
      preset.mediaContentType === mediaContentType,
  );
  if (!hasRegisteredPreset) {
    assert.deepEqual(
      presetApplicabilityMatrix.get(mediaContentType),
      [],
      `${mediaContentType} must not inherit a generic Media preset fallback.`,
    );
  }
}

const invalidMediaContexts = [
  { target: "media" },
  { target: "media", mediaContentType: "__unknown_content_type__" },
] as unknown as ContentTemplateContext[];
for (const context of invalidMediaContexts) {
  assert.deepEqual(
    getContentTemplatePresets(context),
    [],
    "Missing or unknown Media context must fail closed during display filtering.",
  );
  for (const preset of VENESIA_CONTENT_TEMPLATE_PRESETS) {
    assert.equal(
      resolveContentTemplatePreset(preset.key, context),
      null,
      `${preset.key} must fail closed for missing or unknown Media context.`,
    );
    assert.equal(
      applyContentTemplatePreset(currentTemplateValues, preset.key, context),
      null,
      `${preset.key} cannot be directly applied with missing or unknown Media context.`,
    );
  }
}

for (const preset of VENESIA_CONTENT_TEMPLATE_PRESETS.filter(
  (candidate) => candidate.target === "media",
)) {
  const missingMetadataFixture = {
    ...preset,
    mediaContentType: undefined,
  };
  for (const mediaContentType of MEDIA_EDITABLE_CONTENT_TYPES) {
    assert.equal(
      isContentTemplatePresetApplicable(missingMetadataFixture, {
        target: "media",
        mediaContentType,
      }),
      false,
      `Negative fixture: ${preset.key} without Media metadata must fail closed for ${mediaContentType}.`,
    );
  }
}

const mediaVideoFields = readParsedSource(
  "src/components/admin/content/editors/media/MediaVideoFields.tsx",
);
function hasCanonicalVideoDefaultFields(input: string) {
  const tree = parseTypeScriptSource("MediaVideoFields.tsx", input);
  const imports: ReadonlyArray<readonly [string, string, boolean?]> = [
    ["AdminModuleSectionHeader", "../../../ui/AdminModuleTabs"],
    ["AdminFormField", "../../../ui/AdminForm"],
    ["AdminFormGrid", "../../../ui/AdminFormRuntime"],
    ["AdminMediaImageField", "../../../media/AdminMediaImageField", true],
    ...["ADMIN_FORM", "ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME", "adminFormHintClassName", "adminFormLabelClassName"].map((name) => [name, "../../../../../lib/admin/admin-ui-styles"] as const),
  ];
  const canonicalImports = imports.every(([name, module, defaultImport]) => tree.statements.some((node) =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module &&
    (defaultImport ? node.importClause?.name?.text === name : node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
      node.importClause.namedBindings.elements.some((binding) => binding.name.text === name && !binding.propertyName))));
  const headers = jsxElements(tree, "AdminModuleSectionHeader"), media = jsxElements(tree, "AdminMediaImageField"), fields = jsxElements(tree, "AdminFormField");
  const labels = collectNodes(tree, ts.isVariableDeclaration).filter((node) => ts.isIdentifier(node.name) && node.name.text === "labelClassName");
  const labelCall = labels[0]?.initializer;
  const labelOptions = labelCall && ts.isCallExpression(labelCall) ? labelCall.arguments[0] : undefined;
  const labelInset = labelOptions && ts.isObjectLiteralExpression(labelOptions) ? objectLiteralProperty(labelOptions, "textInset") : undefined;
  const containers = collectNodes(tree, ts.isJsxElement).filter((node) => jsxTagName(node.openingElement) === "AdminFormGrid" && Boolean(jsxAttribute(node.openingElement, "fieldContainers")));
  const inputControl = (name: string) => jsxElements(tree, "input").find((node) => jsxAttributeStaticString(node, "name") === name);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => jsxAttributeExpression(node, name)?.getText(tree);
  return canonicalImports && headers.length === 1 && jsxAttributeStaticString(headers[0]!, "id") === "content-video-fields" &&
    jsxAttributeStaticString(headers[0]!, "sectionHeading") === "الفيديو والصورة المصغّرة" && jsxAttributeStaticString(headers[0]!, "icon") === "media" &&
    jsxAttributeStaticString(headers[0]!, "sectionHeaderPresentation") === "premium" && jsxAttributePathIs(headers[0]!, "sectionHeaderClassName", ["ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME"]) &&
    labels.length === 1 && labelCall && ts.isCallExpression(labelCall) && callName(labelCall) === "adminFormLabelClassName" && labelInset?.kind === ts.SyntaxKind.TrueKeyword &&
    fields.length === 3 && media.length === 1 && [...fields, ...media].every((node) => jsxAttributePathIs(node, "labelClassName", ["labelClassName"]) && !jsxHasAttributes(node, ["style"])) &&
    containers.length === 2 && containers.every((node) => !jsxAttribute(node.openingElement, "fieldContainers")?.initializer && !jsxAttribute(node.openingElement, "className") && !jsxAttribute(node.openingElement, "style")) &&
    value(containers[0]!.openingElement, "columns") === "1" && jsxElements(containers[0]!, "AdminFormField").length === 2 &&
    value(containers[1]!.openingElement, "columns") === "2" && jsxElements(containers[1]!, "AdminFormField").length === 1 && jsxElements(containers[1]!, "AdminMediaImageField").length === 1 &&
    jsxAttributeStaticString(media[0]!, "name") === "video_thumbnail" && jsxAttributeStaticString(media[0]!, "variant") === "card" &&
    value(media[0]!, "guidanceClassName") === "adminFormHintClassName({ textInset: true })" && jsxAttributePathIs(media[0]!, "originalDimensionsClassName", ["ADMIN_FORM", "helperTextInset"]) &&
    value(media[0]!, "defaultValue") === 'defaultThumbnail ?? ""' && !jsxAttribute(media[0]!, "onChange") && !jsxAttribute(media[0]!, "allowRemove") &&
    inputControl("video_provider") && jsxAttributeStaticString(inputControl("video_provider")!, "value") === "youtube" &&
    inputControl("video_url") && value(inputControl("video_url")!, "defaultValue") === 'defaultVideoUrl ?? ""' &&
    inputControl("video_duration") && value(inputControl("video_duration")!, "defaultValue") === 'defaultDuration ?? ""';
}
function videoPanelBranch(tree: ts.SourceFile) {
  return collectNodes(tree, ts.isIfStatement).find((node) =>
    ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    ts.isIdentifier(node.expression.left) && node.expression.left.text === "presentation" && staticString(node.expression.right) === "panel");
}
function omittedNativeVideoBindingSource(input: string) {
  const tree = parseTypeScriptSource("MediaVideoFields.tsx", input);
  const aliases = new Map<string, string>();
  const render = (node: ts.Node): string => {
    if (ts.isConditionalExpression(node) && ["nativeBinding", "!nativeBinding"].includes(node.condition.getText(tree))) return render(node.condition.getText(tree) === "nativeBinding" ? node.whenFalse : node.whenTrue);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && node.left.getText(tree).startsWith("nativeBinding?.")) return render(node.right);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && node.left.getText(tree) === "nativeBinding") return "null";
    if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)) return `{${aliases.get(node.expression.text)}}`;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "hasError" && node.arguments.length === 1 && ts.isIdentifier(node.arguments[0]!) && aliases.has(node.arguments[0]!.text)) return `hasError(${aliases.get(node.arguments[0]!.text)})`;
    if (ts.isTemplateExpression(node) && node.templateSpans.every(span => ts.isIdentifier(span.expression) && aliases.has(span.expression.text))) {
      return JSON.stringify(node.head.text + node.templateSpans.map(span => JSON.parse(aliases.get((span.expression as ts.Identifier).text)!) + span.literal.text).join(""));
    }
    const replacements: Array<{ start: number; end: number; text: string }> = [];
    ts.forEachChild(node, (child) => {
      const text = render(child);
      if (text !== child.getText(tree)) replacements.push({ start: child.getStart(tree), end: child.getEnd(), text });
    });
    let result = node.getText(tree);
    const start = node.getStart(tree);
    for (const replacement of replacements.sort((left, right) => right.start - left.start)) result = result.slice(0, replacement.start - start) + replacement.text + result.slice(replacement.end - start);
    return result;
  };
  for (const declaration of collectNodes(tree, ts.isVariableDeclaration)) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !declaration.initializer.getText(tree).includes("nativeBinding")) continue;
    const value = render(declaration.initializer);
    const parsed = parseTypeScriptSource("omitted-native-binding.ts", `const value = ${value};`);
    const literal = collectNodes(parsed, ts.isVariableDeclaration)[0]?.initializer;
    if (literal && ts.isStringLiteral(literal)) aliases.set(declaration.name.text, JSON.stringify(literal.text));
  }
  return render(tree);
}
function hasCanonicalVideoPanelFields(actualInput: string) {
  // Topic omits this functional binding port; inspect its executable branch, keeping all existing assertions.
  const input = omittedNativeVideoBindingSource(actualInput);
  const tree = parseTypeScriptSource("MediaVideoFields.tsx", input), branch = videoPanelBranch(tree);
  if (!branch) return false;
  const defaultSource = input.slice(0, branch.getStart(tree)) + input.slice(branch.end);
  if (!hasCanonicalVideoDefaultFields(defaultSource)) return false;
  const hasImport = (name: string, module: string, defaultImport = false) => tree.statements.some((node) =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module &&
    (defaultImport ? node.importClause?.name?.text === name : node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some((binding) => binding.name.text === name && !binding.propertyName)));
  const headers = jsxElements(branch, "AdminModuleSectionHeader"), cards = jsxElements(branch, "AdminCard"), selects = jsxElements(branch, "AdminFormListboxSelect"), media = jsxElements(branch, "AdminMediaImageField"), fields = jsxElements(branch, "AdminFormField");
  const controls = (name: string) => jsxElements(branch, "input").filter((node) => jsxAttributeStaticString(node, "name") === name);
  const value = (node: ts.JsxOpeningLikeElement, name: string) => jsxAttributeExpression(node, name)?.getText(tree);
  const grids = jsxElements(branch, "AdminFormGrid"), url = controls("video_url"), start = controls("video_start_seconds"), duration = controls("video_duration"), root = jsxElements(branch, "div").find((node) => jsxAttributeStaticString(node, "data-admin-media-video-presentation") === "panel");
  const options = selects[0] && jsxAttributeExpression(selects[0], "options");
  const optionsMap = options && ts.isCallExpression(options) &&
    ts.isPropertyAccessExpression(options.expression) &&
    ts.isIdentifier(options.expression.expression) && options.expression.expression.text === "VIDEO_PROVIDERS" &&
    options.expression.name.text === "map" && options.arguments.length === 1 &&
    ts.isArrowFunction(options.arguments[0]!) ? options.arguments[0] : undefined;
  const option = optionsMap && !ts.isBlock(optionsMap.body) ? unwrapObjectLiteral(optionsMap.body) : null;
  const playback = jsxElements(branch, "MediaVideoPlayback");
  const playbackItem = playback[0] ? unwrapObjectLiteral(jsxAttributeExpression(playback[0], "item") ?? undefined) : null;
  const providerChange = selects[0] ? jsxAttributeExpression(selects[0], "onChange") : undefined;
  const providerChangeBody = providerChange && ts.isArrowFunction(providerChange) && ts.isBlock(providerChange.body)
    ? providerChange.body : undefined;
  const providerChangeGuard = providerChangeBody && collectNodes(providerChangeBody, ts.isIfStatement).find((node) =>
    node.expression.getText(tree) === "isVideoProvider(nextValue) && nextValue !== videoProvider");
  const staleErrorClear = providerChangeGuard && collectNodes(providerChangeGuard.thenStatement, ts.isCallExpression).find((node) =>
    pathEndsWith(expressionPath(node.expression), ["formRuntime", "clearFieldErrors"]));
  const defaultPresentation = collectNodes(tree, ts.isBindingElement).find((node) => ts.isIdentifier(node.name) && node.name.text === "presentation");
  return Boolean(root && defaultPresentation && staticString(defaultPresentation.initializer) === "default" &&
    hasImport("AdminCard", "../../../ui/AdminCard", true) && hasImport("AdminFormListboxSelect", "../../../ui/AdminFormListboxSelect", true) &&
    hasImport("MediaVideoPlayback", "../../../../media-center/MediaDetailArticle") &&
    ["VIDEO_PROVIDERS", "isVideoProvider", "normalizeVideoStartSeconds", "resolveVideoPlayback"].every((name) => hasImport(name, "../../../../../lib/admin/media-topic-payload")) &&
    headers.length === 4 && ["content-video-fields", "video-settings", "video-preview", "video-thumbnail"].every((id, index) => jsxAttributeStaticString(headers[index]!, "id") === id) &&
    headers.every((node) => jsxAttributeStaticString(node, "sectionHeaderPresentation") === "premium" && jsxAttributePathIs(node, "sectionHeaderClassName", ["ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME"])) &&
    cards.length === 3 && cards.every((node) => jsxAttributeStaticString(node, "presentation") === "premium" && !jsxAttribute(node, "style")) &&
    grids.length === 2 && value(grids[0]!, "columns") === "2" && jsxAttributeStaticString(grids[0]!, "className") === "items-start" && value(grids[1]!, "columns") === "1" && Boolean(jsxAttribute(grids[1]!, "fieldContainers")) &&
    selects.length === 1 && jsxAttributeStaticString(selects[0]!, "name") === "video_provider" && value(selects[0]!, "value") === "videoProvider" && Boolean(jsxAttribute(selects[0]!, "inline")) && jsxAttributeStaticString(selects[0]!, "label") === "مزود الفيديو" && jsxAttributeStaticString(selects[0]!, "labelClassName") === "sr-only" &&
    jsxHasAttributes(selects[0]!, ["onChange", "error"]) && !jsxAttribute(selects[0]!, "defaultValue") &&
    providerChangeGuard && hasCall(providerChangeGuard.thenStatement, "onVideoProviderChange", [["nextValue"]]) &&
    staleErrorClear && staleErrorClear.arguments[0] && ts.isArrayLiteralExpression(staleErrorClear.arguments[0]) &&
    staticString(staleErrorClear.arguments[0].elements[0]) === "video_url" &&
    option && objectLiteralProperty(option, "value")?.getText(tree) === "item.value" && objectLiteralProperty(option, "label")?.getText(tree) === "item.label" &&
    jsxElements(option, "AdminModuleTabIcon").length === 1 && jsxAttributeExpression(jsxElements(option, "AdminModuleTabIcon")[0]!, "name")?.getText(tree) === 'item.value === "direct" ? "link" : item.value' &&
    fields.length === 2 && jsxAttributePathIs(fields[0]!, "label", ["provider", "urlLabel"]) && jsxAttributeStaticString(fields[1]!, "label") === "وقت البدء (بالثواني)" && fields.every((node) => jsxAttributePathIs(node, "labelClassName", ["labelClassName"])) &&
    url.length === 1 && value(url[0]!, "value") === "currentVideoUrl" && jsxAttributePathIs(url[0]!, "placeholder", ["provider", "urlPlaceholder"]) && jsxHasAttributes(url[0]!, ["onInput", "onChange", "aria-invalid", "aria-describedby"]) && !jsxAttribute(url[0]!, "defaultValue") &&
    start.length === 1 && jsxAttributeStaticString(start[0]!, "type") === "number" && value(start[0]!, "value") === "videoStartSeconds" && value(start[0]!, "min") === "0" && value(start[0]!, "step") === "1" && value(start[0]!, "disabled") === "!provider.supportsStartTime" && jsxHasAttributes(start[0]!, ["onInput", "onChange", "aria-invalid", "aria-describedby"]) &&
    duration.length === 1 && jsxAttributeStaticString(duration[0]!, "type") === "hidden" && value(duration[0]!, "defaultValue") === 'defaultDuration ?? ""' &&
    media.length === 1 && jsxAttributeStaticString(media[0]!, "name") === "video_thumbnail" && jsxAttributeStaticString(media[0]!, "variant") === "card" && value(media[0]!, "showLabel") === "false" && value(media[0]!, "defaultValue") === 'defaultThumbnail ?? ""' && value(media[0]!, "onValueChange") === "onVideoThumbnailChange" && value(media[0]!, "guidanceClassName") === "adminFormHintClassName({ textInset: true })" && jsxAttributePathIs(media[0]!, "originalDimensionsClassName", ["ADMIN_FORM", "helperTextInset"]) &&
    playback.length === 1 && playbackItem && objectLiteralProperty(playbackItem, "videoProvider")?.getText(tree) === "provider.value" && input.includes('VIDEO_PROVIDERS.find((item) => item.value === videoProvider)') && objectLiteralProperty(playbackItem, "videoUrl")?.getText(tree) === "currentVideoUrl" && objectLiteralProperty(playbackItem, "videoStartSeconds")?.getText(tree) === "startSeconds ?? 0" && objectLiteralProperty(playbackItem, "image")?.getText(tree) === '(videoThumbnail ?? defaultThumbnail ?? "").trim() || mainImage' &&
    jsxAttributePathIs(playback[0]!, "requestMetaEmbed", ["requestMetaEmbed"]) &&
    collectNodes(tree, ts.isPropertySignature).some((node) => staticPropertyName(node.name) === "requestMetaEmbed" && Boolean(node.questionToken)) &&
    jsxElements(branch, "iframe").length === 0 && jsxElements(branch, "video").length === 0 &&
    collectNodes(branch, ts.isCallExpression).some((node) => callName(node) === "normalizeVideoStartSeconds" && node.arguments[0]?.getText(tree) === "videoStartSeconds") &&
    collectNodes(branch, ts.isCallExpression).some((node) => callName(node) === "resolveVideoPlayback" && Boolean(unwrapObjectLiteral(node.arguments[0]))) &&
    !collectNodes(branch, ts.isCallExpression).some((node) => callName(node) === "useState") && !input.includes("setCustomValidity"));
}
assert.ok(hasCanonicalVideoPanelFields(mediaVideoFields.text), "Video panel must reuse canonical Cards, Charcoal Headers, provider metadata/selection, live model/start validation, playback and Media owners; preserve hidden duration and omitted default rendering.");
function hasCanonicalVideoConsumerBinding(input: string) {
  const tree = parseTypeScriptSource("MediaContentForm.tsx", input), controls = jsxElements(tree, "MediaVideoFields");
  const control = controls[0];
  const providerChange = control ? jsxAttributeExpression(control, "onVideoProviderChange") : undefined;
  const providerChangeBody = providerChange && ts.isArrowFunction(providerChange) && ts.isBlock(providerChange.body)
    ? providerChange.body : undefined;
  const sameProviderGuard = providerChangeBody?.statements[0];
  const incompatibleUrlGuard = providerChangeBody && collectNodes(providerChangeBody, ts.isIfStatement).find((node) =>
    node.expression.getText(tree) === "model.value.videoUrl && !normalizeVideoUrl(nextProvider, model.value.videoUrl)");
  const modelWrites = providerChangeBody ? collectNodes(providerChangeBody, ts.isCallExpression).filter((node) =>
    pathEndsWith(expressionPath(node.expression), ["model", "setField"])) : [];
  const hasCanonicalUrlImport = tree.statements.some((node) => ts.isImportDeclaration(node) &&
    staticString(node.moduleSpecifier) === "../../../../../lib/admin/media-topic-payload" &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) => binding.name.text === "normalizeVideoUrl" && !binding.propertyName));
  const hasCanonicalMetaReadImport = tree.statements.some((node) => ts.isImportDeclaration(node) &&
    staticString(node.moduleSpecifier) === "../../../../../app/admin/content/topics/media-actions/validation" &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) => binding.name.text === "readMediaVideoEmbed" && !binding.propertyName));
  return Boolean(controls.length === 1 && control && jsxAttributeStaticString(control, "presentation") === "panel" &&
    hasCanonicalMetaReadImport && jsxAttributePathIs(control, "requestMetaEmbed", ["readMediaVideoEmbed"]) &&
    jsxAttributeExpression(control, "videoUrl")?.getText(tree) === 'model.value.videoUrl ?? ""' &&
    jsxAttributeExpression(control, "onVideoUrlChange")?.getText(tree) === '(nextValue) => model.setField("videoUrl", nextValue)' &&
    jsxAttributeExpression(control, "videoProvider")?.getText(tree) === 'model.value.videoProvider ?? "youtube"' &&
    jsxAttributeExpression(control, "onVideoProviderChange")?.getText(tree).includes('model.setField("videoProvider", nextProvider)') &&
    hasCanonicalUrlImport && sameProviderGuard && ts.isIfStatement(sameProviderGuard) &&
    sameProviderGuard.expression.getText(tree) === 'nextProvider === (model.value.videoProvider ?? "youtube")' &&
    ts.isReturnStatement(sameProviderGuard.thenStatement) && !sameProviderGuard.thenStatement.expression &&
    incompatibleUrlGuard && collectNodes(incompatibleUrlGuard.thenStatement, ts.isCallExpression).some((node) =>
      pathEndsWith(expressionPath(node.expression), ["model", "setField"]) && staticString(node.arguments[0]) === "videoUrl" && staticString(node.arguments[1]) === "") &&
    modelWrites.length === 3 && ["videoProvider", "videoUrl", "videoStartSeconds"].every((name) =>
      modelWrites.filter((node) => staticString(node.arguments[0]) === name).length === 1) &&
    jsxAttributeExpression(control, "videoStartSeconds")?.getText(tree) === 'model.value.videoStartSeconds ?? ""' &&
    jsxAttributeExpression(control, "onVideoStartSecondsChange")?.getText(tree) === '(nextValue) => model.setField("videoStartSeconds", nextValue)' &&
    jsxAttributeExpression(control, "videoThumbnail")?.getText(tree) === 'model.value.videoThumbnail ?? ""' &&
    jsxAttributeExpression(control, "mainImage")?.getText(tree) === 'model.value.image ?? ""' &&
    jsxAttributeExpression(control, "onVideoThumbnailChange")?.getText(tree) === '(nextValue) => model.setField("videoThumbnail", nextValue)' &&
    jsxAttributePathIs(control, "defaultDuration", ["videoDefaults", "duration"]) &&
    jsxAttributePathIs(control, "defaultThumbnail", ["videoDefaults", "thumbnail"]));
}
assert.ok(hasCanonicalVideoConsumerBinding(mediaContentForm.text), "Actual Video Create/Edit must select panel and bind live URL through the existing editor model while retaining duration and thumbnail defaults.");
for (const [label, from, to] of [
  ["live model disconnected", 'videoUrl={model.value.videoUrl ?? ""}', 'videoUrl=""'],
  ["model update disconnected", 'model.setField("videoUrl", nextValue)', 'model.setField("content", nextValue)'],
  ["provider model disconnected", 'videoProvider={model.value.videoProvider ?? "youtube"}', 'videoProvider="youtube"'],
  ["same provider clears input", 'if (nextProvider === (model.value.videoProvider ?? "youtube")) return;', ""],
  ["parallel URL classifier", "normalizeVideoUrl(nextProvider, model.value.videoUrl)", "Boolean(model.value.videoUrl)"],
  ["incompatible URL retained", 'model.setField("videoUrl", "")', 'model.setField("videoUrl", model.value.videoUrl)'],
  ["thumbnail reset on provider change", 'model.setField("videoProvider", nextProvider);', 'model.setField("videoProvider", nextProvider); model.setField("videoThumbnail", "");'],
  ["main image projection disconnected", 'mainImage={model.value.image ?? ""}', 'mainImage=""'],
  ["start model disconnected", 'model.setField("videoStartSeconds", nextValue)', 'model.setField("videoUrl", nextValue)'],
  ["thumbnail projection disconnected", 'model.setField("videoThumbnail", nextValue)', 'model.setField("videoUrl", nextValue)'],
  ["historical duration lost", 'defaultDuration={videoDefaults.duration}', 'defaultDuration=""'],
  ["Meta read opt-in disconnected", "requestMetaEmbed={readMediaVideoEmbed}", "requestMetaEmbed={undefined}"],
  ["parallel Meta read action", 'from "../../../../../app/admin/content/topics/media-actions/validation"', 'from "./ParallelMetaRead"'],
] as const) {
  assert.ok(mediaContentForm.text.includes(from));
  assert.ok(!hasCanonicalVideoConsumerBinding(mediaContentForm.text.replace(from, to)), `Video consumer binding negative: ${label}.`);
}
for (const [label, from, to] of [
  ["parallel header", 'from "../../../ui/AdminModuleTabs"', 'from "../../../ui/ParallelHeader"'],
  ["old header", 'sectionHeaderPresentation="premium"', 'sectionHeaderPresentation="default"'],
  ["lost containers", "columns={1} fieldContainers", "columns={1}"],
  ["lost label inset", "adminFormLabelClassName({ textInset: true })", "adminFormLabelClassName({ textInset: false })"],
  ["parallel playback", 'from "../../../../media-center/MediaDetailArticle"', 'from "./ParallelPlayer"'],
  ["Meta read port disconnected", "requestMetaEmbed={requestMetaEmbed}", "requestMetaEmbed={undefined}"],
  ["Meta read port made required", "requestMetaEmbed?:", "requestMetaEmbed:"],
  ["dynamic label removed", 'label={nativeBinding ? "رابط الفيديو" : provider.urlLabel}', 'label="رابط YouTube"'],
  ["provider accessible label omitted", 'label="مزود الفيديو"', 'label=""'],
  ["redundant visible provider label restored", 'labelClassName="sr-only"', 'labelClassName={labelClassName}'],
  ["dynamic placeholder removed", 'placeholder={provider.urlPlaceholder}', 'placeholder="https://www.youtube.com"'],
  ["same provider resets context", "isVideoProvider(nextValue) && nextValue !== videoProvider", "isVideoProvider(nextValue)"],
  ["stale server errors retained", "formRuntime?.clearFieldErrors([", "formRuntime?.notifyProjectionChange(["],
  ["wrong persisted field", 'type="hidden" name="video_duration"', 'type="text" name="video_duration"'],
  ["lost preserved duration", 'name="video_duration" defaultValue={defaultDuration ?? ""}', 'name="video_duration" defaultValue=""'],
  ["noncanonical provider inventory", "options={VIDEO_PROVIDERS.map", "options={VIDEO_PROVIDERS.filter(() => false).map"],
  ["provider binding disconnected", "value={videoProvider}", 'value="youtube"'],
  ["parallel start parser", "normalizeVideoStartSeconds(videoStartSeconds)", "Number(videoStartSeconds)"],
  ["unsupported start enabled", "disabled={!provider.supportsStartTime}", "disabled={false}"],
  ["thumbnail projection lost", "onValueChange={onVideoThumbnailChange}", "onValueChange={() => {}}"],
  ["main image fallback lost", '(videoThumbnail ?? defaultThumbnail ?? "").trim() || mainImage', 'videoThumbnail ?? defaultThumbnail ?? ""'],
  ["cleared thumbnail resurrected", '(videoThumbnail ?? defaultThumbnail ?? "").trim() || mainImage', '(videoThumbnail || defaultThumbnail || "").trim() || mainImage'],
  ["disconnected live URL", "value={currentVideoUrl}", 'value=""'],
  ["duplicate thumbnail title", "showLabel={false}", "showLabel={true}"],
] as const) {
  assert.ok(mediaVideoFields.text.includes(from), `Negative fixture must mutate current source: ${label}`);
  assert.ok(!hasCanonicalVideoPanelFields(mediaVideoFields.text.replace(from, to)), `Negative Video panel fixture: ${label} must fail closed.`);
}
const videoImageProjectionSources = {
  consumer: mediaContentForm.text,
  basic: readSource("src/components/admin/content/editors/ContentBasicDataPanel.tsx"),
  image: readSource("src/components/admin/content/editors/article/TopicImageField.tsx"),
  model: readSource("src/components/admin/content/editors/ContentEditorShell.tsx"),
};
function hasCanonicalVideoMainImageProjection(sources: typeof videoImageProjectionSources) {
  const consumer = parseTypeScriptSource("MediaContentForm.tsx", sources.consumer);
  const basic = parseTypeScriptSource("ContentBasicDataPanel.tsx", sources.basic);
  const image = parseTypeScriptSource("TopicImageField.tsx", sources.image);
  const model = parseTypeScriptSource("ContentEditorShell.tsx", sources.model);
  const basicControl = jsxElements(consumer, "ContentBasicDataPanel")[0];
  const callback = basicControl && jsxAttributeExpression(basicControl, "onImageValueChange");
  const initialModel = collectNodes(consumer, ts.isVariableDeclaration).find((node) =>
    ts.isIdentifier(node.name) && node.name.text === "initialModelValue");
  const initialObject = initialModel?.initializer && unwrapObjectLiteral(initialModel.initializer);
  const videoProjection = initialObject?.properties.flatMap((node) => {
    if (!ts.isSpreadAssignment(node)) return [];
    const expression = unwrapExpression(node.expression);
    return ts.isConditionalExpression(expression) && expression.condition.getText(consumer) === "videoPanel" ? [expression] : [];
  })[0];
  const projectedValues = videoProjection ? unwrapObjectLiteral(videoProjection.whenTrue) : null;
  const topicImage = jsxElements(basic, "TopicImageField");
  const mediaImage = jsxElements(image, "AdminMediaImageField");
  const optionalProperty = (tree: ts.SourceFile, name: string) => collectNodes(tree, ts.isPropertySignature).some((node) =>
    staticPropertyName(node.name) === name && Boolean(node.questionToken));
  return Boolean(basicControl && callback && ts.isConditionalExpression(callback) &&
    callback.condition.getText(consumer) === "videoPanel" && callback.whenFalse.kind === ts.SyntaxKind.Identifier && callback.whenFalse.getText(consumer) === "undefined" &&
    ts.isArrowFunction(callback.whenTrue) && callback.whenTrue.body.getText(consumer) === 'model.setField("image", nextValue)' &&
    projectedValues && objectLiteralProperty(projectedValues, "image")?.getText(consumer) === 'values?.image ?? ""' &&
    optionalProperty(model, "image") && optionalProperty(basic, "onImageValueChange") && optionalProperty(image, "onValueChange") &&
    topicImage.length === 1 && jsxAttributePathIs(topicImage[0]!, "onValueChange", ["onImageValueChange"]) &&
    jsxAttributeExpression(topicImage[0]!, "defaultImage")?.getText(basic) === "values?.image" &&
    mediaImage.length === 1 && jsxAttributeStaticString(mediaImage[0]!, "name") === "image" &&
    jsxAttributePathIs(mediaImage[0]!, "onValueChange", ["onValueChange"]) &&
    jsxAttributeExpression(mediaImage[0]!, "defaultValue")?.getText(image) === 'defaultImage ?? ""' && !jsxAttribute(mediaImage[0]!, "value"));
}
assert.ok(hasCanonicalVideoMainImageProjection(videoImageProjectionSources),
  "Only Video projects the current main image through optional existing Media owner callbacks and the single Editor model; native image persistence and omitted consumers retain their defaults.");
for (const [role, label, from, to] of [
  ["consumer", "projection enabled for other Media", 'onImageValueChange={videoPanel ? (nextValue) => model.setField("image", nextValue) : undefined}', 'onImageValueChange={(nextValue) => model.setField("image", nextValue)}'],
  ["consumer", "main image initial model disconnected", 'image: values?.image ?? ""', 'image: ""'],
  ["basic", "Basic Media callback disconnected", "onValueChange={onImageValueChange}", "onValueChange={undefined}"],
  ["image", "canonical Media callback disconnected", "onValueChange={onValueChange}", "onValueChange={undefined}"],
  ["image", "optional callback made required", "onValueChange?:", "onValueChange:"],
  ["model", "single model image projection removed", "image?: string;", ""],
] as const) {
  assert.ok(videoImageProjectionSources[role].includes(from), `Main image projection negative fixture must mutate current source: ${label}`);
  assert.ok(!hasCanonicalVideoMainImageProjection({ ...videoImageProjectionSources, [role]: videoImageProjectionSources[role].replace(from, to) }),
    `Main image projection negative: ${label} must fail closed.`);
}

const metaVideoSources = {
  article: readSource("src/components/media-center/MediaDetailArticle.tsx"),
  playback: readSource("src/components/media-center/MediaVideoPlayback.tsx"),
  domain: readSource("src/lib/admin/media-topic-payload.ts"),
  action: readSource("src/app/admin/content/topics/media-actions/validation.ts"),
};
function hasCanonicalMetaVideoPlayback(sources: typeof metaVideoSources) {
  const article = parseTypeScriptSource("MediaDetailArticle.tsx", sources.article);
  const playback = parseTypeScriptSource("MediaVideoPlayback.tsx", sources.playback);
  const domain = parseTypeScriptSource("media-topic-payload.ts", sources.domain);
  const action = parseTypeScriptSource("validation.ts", sources.action);
  const namedImport = (tree: ts.SourceFile, name: string, module: string) => tree.statements.some((node) =>
    ts.isImportDeclaration(node) && staticString(node.moduleSpecifier) === module &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) => binding.name.text === name && !binding.propertyName));
  const variable = (tree: ts.SourceFile, name: string) => collectNodes(tree, ts.isVariableDeclaration).find((node) =>
    ts.isIdentifier(node.name) && node.name.text === name)?.initializer;
  const expression = (tree: ts.SourceFile, name: string) => variable(tree, name)?.getText(tree);
  const owner = collectNodes(playback, ts.isFunctionDeclaration).filter((node) => node.name?.text === "MediaVideoPlayback");
  const stableExports = article.statements.filter((node) => ts.isExportDeclaration(node) &&
    staticString(node.moduleSpecifier) === "./MediaVideoPlayback" && node.exportClause && ts.isNamedExports(node.exportClause) &&
    node.exportClause.elements.some((binding) => binding.name.text === "MediaVideoPlayback" && !binding.propertyName));
  const ownerProperties = owner[0] ? collectNodes(owner[0], ts.isPropertySignature) : [];
  const optionalPort = (name: string) => ownerProperties.some((node) => staticPropertyName(node.name) === name && Boolean(node.questionToken)) &&
    !collectNodes(playback, ts.isBindingElement).some((node) => ts.isIdentifier(node.name) && node.name.text === name && node.initializer);
  const providerArray = variable(domain, "VIDEO_PROVIDERS");
  const providers = providerArray ? unwrapExpression(providerArray) : undefined;
  const providerItems = providers && ts.isArrayLiteralExpression(providers)
    ? providers.elements.flatMap((node) => ts.isExpression(node) ? [unwrapObjectLiteral(node)] : []).filter((node): node is ts.ObjectLiteralExpression => Boolean(node))
    : [];
  const metaProviders = providerItems.filter((node) => ["facebook", "instagram"].includes(staticString(objectLiteralProperty(node, "value")) ?? ""));
  const metaMetadata = metaProviders.length === 2 && metaProviders.every((node) => {
    const provider = staticString(objectLiteralProperty(node, "value"));
    const metadata = unwrapObjectLiteral(objectLiteralProperty(node, "metaEmbed"));
    return staticString(objectLiteralProperty(node, "playbackMode")) === "external" && metadata &&
      staticString(objectLiteralProperty(metadata, "sdkUrl")) === (provider === "facebook"
        ? "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v25.0"
        : "https://www.instagram.com/embed.js") &&
      objectLiteralProperty(metadata, "minWidth")?.getText(domain) === (provider === "facebook" ? "220" : "326");
  }) && providerItems.filter((node) => !metaProviders.includes(node)).every((node) => !objectLiteralProperty(node, "metaEmbed"));
  const readAction = collectNodes(action, ts.isFunctionDeclaration).find((node) => node.name?.text === "readMediaVideoEmbed");
  const requestOwner = collectNodes(domain, ts.isFunctionDeclaration).find((node) => node.name?.text === "resolveMetaVideoEmbedRequest");
  const sourceOwner = collectNodes(domain, ts.isFunctionDeclaration).find((node) => node.name?.text === "resolveVideoSource");
  const facebookSource = sourceOwner && collectNodes(sourceOwner, ts.isIfStatement).find((node) =>
    node.expression.getText(domain) === 'provider === "facebook"')?.thenStatement;
  const sourceCallName = (node: ts.CallExpression) => ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text : callName(node);
  const facebookHostGate = facebookSource && collectNodes(facebookSource, ts.isCallExpression).find((node) =>
    sourceCallName(node) === "includes" && ts.isPropertyAccessExpression(node.expression) && ts.isArrayLiteralExpression(node.expression.expression));
  const facebookHosts = facebookHostGate && ts.isPropertyAccessExpression(facebookHostGate.expression) && ts.isArrayLiteralExpression(facebookHostGate.expression.expression)
    ? facebookHostGate.expression.expression.elements.map(staticString) : [];
  const canonicalRequest = Boolean(requestOwner && hasCall(requestOwner, "normalizeVideoUrl", [["payload", "provider"], ["payload", "video_url"]]) &&
    facebookSource && facebookHosts.length === 4 && ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"].every((host) => facebookHosts.includes(host)) &&
    !collectNodes(facebookSource, ts.isCallExpression).some((node) => !["includes", "test", "getAll", "get", "exec", "Boolean"].includes(sourceCallName(node) ?? "")));
  const firstReadStatement = readAction?.body?.statements[0];
  const lastReadStatement = readAction?.body?.statements.at(-1);
  const authenticatedRead = Boolean(namedImport(action, "readMetaVideoEmbed", "../../../../../lib/content/public-content-read/owner") &&
    firstReadStatement && ts.isExpressionStatement(firstReadStatement) && ts.isAwaitExpression(firstReadStatement.expression) &&
    ts.isCallExpression(firstReadStatement.expression.expression) && callName(firstReadStatement.expression.expression) === "requireAdminSession" &&
    lastReadStatement && ts.isReturnStatement(lastReadStatement) && lastReadStatement.expression && ts.isCallExpression(lastReadStatement.expression) &&
    callName(lastReadStatement.expression) === "readMetaVideoEmbed" && lastReadStatement.expression.arguments[0]?.getText(action) === "payload");
  const assignments = collectNodes(playback, ts.isBinaryExpression).filter((node) => node.operatorToken.kind === ts.SyntaxKind.EqualsToken);
  const assigns = (path: readonly string[], value: string | readonly string[]) => assignments.some((node) =>
    pathEndsWith(expressionPath(node.left), path) && (typeof value === "string" ? staticString(node.right) === value : pathEndsWith(expressionPath(node.right), value)));
  const sdkLoader = collectNodes(playback, ts.isFunctionDeclaration).find((node) => node.name?.text === "loadMetaSdk");
  const loaderOnload = assignments.find((node) => pathEndsWith(expressionPath(node.left), ["script", "onload"]));
  const instagramOnloadGate = loaderOnload && ts.isArrowFunction(loaderOnload.right) && ts.isBlock(loaderOnload.right.body)
    ? loaderOnload.right.body.statements[0] : undefined;
  const officialSdkReadiness = Boolean(sdkLoader && expression(playback, "previousInit") === "sdkWindow.fbAsyncInit" &&
    assigns(["sdkWindow", "fbAsyncInit"], ["onFacebookReady"]) && assigns(["sdkWindow", "fbAsyncInit"], ["previousInit"]) &&
    hasCall(sdkLoader, "previousInit") && instagramOnloadGate && ts.isIfStatement(instagramOnloadGate) &&
    instagramOnloadGate.expression.getText(playback) === 'provider === "instagram"' && hasCall(instagramOnloadGate.thenStatement, "ready"));
  const facebookInitialization = sdkLoader && collectNodes(sdkLoader, ts.isIfStatement).find((node) =>
    node.expression.getText(playback) === 'provider === "facebook"' && hasCall(node.thenStatement, "loadMetaSdk"));
  const instagramPrerequisite = facebookInitialization && collectNodes(facebookInitialization.thenStatement, ts.isAwaitExpression).find((node) =>
    ts.isCallExpression(node.expression) && callName(node.expression) === "loadMetaSdk" &&
    pathEndsWith(expressionPath(node.expression.arguments[0]!), ["instagram", "metaEmbed", "sdkUrl"]) &&
    staticString(node.expression.arguments[1]) === "instagram");
  const facebookScriptPromise = sdkLoader && collectNodes(sdkLoader, ts.isNewExpression).find((node) => callName(node) === "Promise");
  const instagramApiCheck = facebookInitialization && collectNodes(facebookInitialization.thenStatement, ts.isIfStatement).find((node) =>
    hasPropertyPath(node.expression, ["window", "instgrm", "Embeds"]) && ts.isThrowStatement(node.thenStatement));
  const officialSdkOrder = Boolean(sdkLoader && namedImport(playback, "VIDEO_PROVIDERS", "../../lib/admin/media-topic-payload") &&
    instagramPrerequisite && instagramApiCheck && facebookScriptPromise &&
    instagramPrerequisite.getStart(playback) < instagramApiCheck.getStart(playback) &&
    instagramApiCheck.end < facebookScriptPromise.getStart(playback) &&
    collectNodes(sdkLoader, ts.isCallExpression).filter((node) => callName(node) === "loadMetaSdk").length === 1 &&
    !hasCall(sdkLoader, "process") && collectNodes(sdkLoader, ts.isCallExpression).filter((node) => callName(node) === "createElement")
      .every((node) => staticString(node.arguments[0]) === "script"));
  const htmlSinks = collectNodes(playback, ts.isIdentifier).some((node) =>
    ["dangerouslySetInnerHTML", "innerHTML", "outerHTML", "srcdoc", "srcDoc", "insertAdjacentHTML", "createContextualFragment", "DOMParser"].includes(node.text)) ||
    collectNodes(playback, ts.isCallExpression).some((node) => ["eval", "Function", "write", "writeln", "fetch"].includes(callName(node) ?? "")) ||
    collectNodes(playback, ts.isNewExpression).some((node) => callName(node) === "Function") || jsxElements(playback, "script").length > 0;
  const autoplay = jsxElements(playback, "video").some((node) => jsxAttribute(node, "autoPlay") || jsxAttribute(node, "autoplay")) ||
    jsxElements(playback, "iframe").some((node) => (jsxAttributeStaticString(node, "allow") ?? "").includes("autoplay"));
  const sourceLink = jsxElements(playback, "a").some((node) => jsxAttributePathIs(node, "href", ["playback", "sourceUrl"]) &&
    jsxAttributeStaticString(node, "target") === "_blank" && jsxAttributeStaticString(node, "rel") === "noopener noreferrer");
  const cleanup = collectNodes(playback, ts.isReturnStatement).flatMap((node) => node.expression && ts.isArrowFunction(node.expression) && ts.isBlock(node.expression.body)
    ? [node.expression.body] : []).find((node) => hasStaticCallArgument(node, "unsubscribe", 0, "xfbml.ready"));
  const cleansUpPlayer = Boolean(cleanup && hasCall(cleanup, "pause") && hasCall(cleanup, "release") &&
    hasCall(cleanup, "disconnect") && hasCall(cleanup, "clearTimeout") && collectNodes(cleanup, ts.isCallExpression).some((node) =>
      callName(node) === "replaceChildren" && node.arguments.length === 0));
  const stateSetter = variable(playback, "setState");
  const failure = stateSetter && ts.isArrowFunction(stateSetter) && ts.isBlock(stateSetter.body)
    ? collectNodes(stateSetter.body, ts.isIfStatement).find((node) => node.expression.getText(playback) === 'state === "unavailable"')?.thenStatement
    : undefined;
  const stopsFailedPlayer = Boolean(failure && collectNodes(failure, ts.isBinaryExpression).some((node) =>
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && node.left.text === "active" && node.right.kind === ts.SyntaxKind.FalseKeyword) &&
    hasCall(failure, "clearTimeout") && hasCall(failure, "disconnect") && hasStaticCallArgument(failure, "unsubscribe", 0, "xfbml.ready") &&
    hasCall(failure, "release") && hasCall(failure, "pause") && collectNodes(failure, ts.isCallExpression).some((node) =>
      callName(node) === "replaceChildren" && node.arguments.length === 0));
  const sdkCompletion = collectNodes(playback, ts.isCallExpression).find((node) => ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "then" && ts.isCallExpression(node.expression.expression) && callName(node.expression.expression) === "loadMetaSdk");
  const sdkCompletionCallback = sdkCompletion?.arguments[0];
  const ignoresLateCompletion = Boolean(sdkCompletionCallback && ts.isArrowFunction(sdkCompletionCallback) && ts.isBlock(sdkCompletionCallback.body) &&
    sdkCompletionCallback.body.statements[0] && ts.isIfStatement(sdkCompletionCallback.body.statements[0]) &&
    sdkCompletionCallback.body.statements[0].expression.getText(playback) === "!active" && ts.isReturnStatement(sdkCompletionCallback.body.statements[0].thenStatement));
  const sdkResets = owner[0]?.body ? collectNodes(owner[0].body, ts.isCallExpression).filter(node =>
    callName(node) === "setSdkState" && node.arguments.length === 1 && node.arguments[0]?.kind === ts.SyntaxKind.NullKeyword) : [];
  const identityReset = owner[0]?.body?.statements.filter((node): node is ts.IfStatement => ts.isIfStatement(node) &&
    node.expression.getText(playback) === "sdkState && (!optedIn || sdkState.key !== requestKey)") ?? [];
  const resetsOnlyChangedIdentity = identityReset.length === 1 && sdkResets.length === 1 &&
    sdkResets[0]!.pos >= identityReset[0]!.thenStatement.pos && sdkResets[0]!.end <= identityReset[0]!.thenStatement.end;
  const stateProjection = jsxElements(playback, "div").find(node => jsxAttribute(node, "data-meta-embed-state"));
  const preservesFailedState = Boolean(stateProjection && jsxAttributeExpression(stateProjection, "data-meta-embed-state")?.getText(playback) ===
    'optedIn && requestKey ? (!fits && width !== null ? "narrow" : rejected || embedState === "unavailable" ? "unavailable" : embedEligible ? embedState : "loading") : undefined');
  const timerDelay = (root: ts.Node, callee?: string) => collectNodes(root, ts.isCallExpression).find((node) =>
    callName(node) === "setTimeout" && node.arguments[1] && ts.isNumericLiteral(node.arguments[1]) &&
    (!callee || hasStaticCallArgument(node.arguments[0]!, callee, 0, "unavailable")))?.arguments[1];
  const loaderTimeout = sdkLoader ? timerDelay(sdkLoader) : undefined;
  const playbackTimeout = owner[0] ? timerDelay(owner[0], "setState") : undefined;
  const boundedLifecycle = Boolean(loaderTimeout && playbackTimeout && Number(playbackTimeout.getText(playback).replaceAll("_", "")) >
    2 * Number(loaderTimeout.getText(playback).replaceAll("_", "")));
  return Boolean(owner.length === 1 && stableExports.length === 1 && namedImport(article, "MediaVideoPlayback", "./MediaVideoPlayback") &&
    collectNodes(article, ts.isFunctionDeclaration).every((node) => node.name?.text !== "MediaVideoPlayback") &&
    playback.statements[0] && ts.isExpressionStatement(playback.statements[0]) && staticString(playback.statements[0].expression) === "use client" &&
    namedImport(playback, "resolveVideoPlayback", "../../lib/admin/media-topic-payload") &&
    namedImport(playback, "resolveMetaVideoEmbedRequest", "../../lib/admin/media-topic-payload") &&
    optionalPort("metaEmbed") && optionalPort("requestMetaEmbed") &&
    expression(playback, "optedIn") === "Boolean(metaEmbed || requestMetaEmbed)" &&
    expression(playback, "checked") === "metaEmbed ?? (response?.key === requestKey ? response.result : undefined)" &&
    expression(playback, "approved") === 'checked?.status === "ready" && checked.provider === provider && checked.sourceUrl === sourceUrl' &&
    expression(playback, "fits") === "width !== null && width >= minWidth" &&
    expression(playback, "embedEligible") === 'Boolean(optedIn && approved && fits && embedState !== "unavailable")' &&
    resetsOnlyChangedIdentity && preservesFailedState &&
    expression(playback, "sdkUrl") === "request?.sdkUrl" && metaMetadata && authenticatedRead && canonicalRequest &&
    hasCall(playback, "loadMetaSdk", [["sdkUrl"], ["provider"]]) && assigns(["script", "src"], ["src"]) && officialSdkReadiness && officialSdkOrder &&
    assigns(["media", "dataset", "href"], ["sourceUrl"]) && assigns(["media", "dataset", "instgrmPermalink"], ["sourceUrl"]) &&
    assigns(["media", "dataset", "autoplay"], "false") &&
    assigns(["fallback", "className"], "fb-xfbml-parse-ignore") && hasCall(playback, "append", [["fallback"]]) &&
    hasStaticCallArgument(playback, "createElement", 0, "script") && hasStaticCallArgument(playback, "createElement", 0, "a") &&
    hasCall(playback, "parse", [["container"]]) && hasCall(playback, "process") &&
    hasStaticCallArgument(playback, "subscribe", 0, "xfbml.ready") && hasStaticCallArgument(playback, "unsubscribe", 0, "xfbml.ready") &&
    hasStaticCallArgument(playback, "subscribe", 0, "error") && hasCall(playback, "release") && hasCall(playback, "pause") &&
    cleansUpPlayer && stopsFailedPlayer && ignoresLateCompletion && boundedLifecycle &&
    hasCall(playback, "replaceChildren", [["media"]]) && sourceLink && !htmlSinks && !autoplay &&
    !collectNodes(playback, ts.isCallExpression).some((node) => ["normalizeVideoUrl", "parseMetaVideoEmbedResponse"].includes(callName(node) ?? "")));
}
assert.ok(hasCanonicalMetaVideoPlayback(metaVideoSources),
  "Meta playback must remain the single relocated shared owner with explicit optional opt-in, canonical identity/SDK metadata, authenticated read, inert reconstructed markup, no autoplay or raw HTML, scoped cleanup, narrow-width protection and external fallback. This is source proof, not live playback proof.");
for (const [role, label, from, to] of [
  ["article", "stable owner re-export removed", 'export { MediaVideoPlayback } from "./MediaVideoPlayback";', ""],
  ["article", "parallel player imported", 'import { MediaVideoPlayback } from "./MediaVideoPlayback";', 'import { MediaVideoPlayback } from "./ParallelPlayback";'],
  ["playback", "optional approved result made required", "metaEmbed?:", "metaEmbed:"],
  ["playback", "optional request port made required", "requestMetaEmbed?:", "requestMetaEmbed:"],
  ["playback", "Meta enabled for omitted consumers", "Boolean(metaEmbed || requestMetaEmbed)", "true"],
  ["playback", "stale preview response reused", "response?.key === requestKey ? response.result : undefined", "response?.result"],
  ["playback", "provider response identity unchecked", "checked.provider === provider", "Boolean(provider)"],
  ["playback", "source response identity unchecked", "checked.sourceUrl === sourceUrl", "Boolean(sourceUrl)"],
  ["playback", "official minimum width bypassed", "width >= minWidth", "width >= 0"],
  ["playback", "failed SDK made eligible on geometry changes", 'Boolean(optedIn && approved && fits && embedState !== "unavailable")', "Boolean(optedIn && approved && fits)"],
  ["playback", "request identity no longer resets failed SDK", "if (sdkState && (!optedIn || sdkState.key !== requestKey)) setSdkState(null);", ""],
  ["playback", "request reset incorrectly depends on width", "sdkState && (!optedIn || sdkState.key !== requestKey)", "sdkState && (!optedIn || sdkState.key !== requestKey || width)"],
  ["playback", "additional geometry reset revives failed SDK", "const renderWidth = Math.floor(width ?? 0);", "const renderWidth = Math.floor(width ?? 0); if (width) setSdkState(null);"],
  ["playback", "failed ineligible SDK displayed as loading", 'rejected || embedState === "unavailable" ? "unavailable"', 'rejected ? "unavailable"'],
  ["playback", "unapproved SDK URL source", "request?.sdkUrl", "item.videoUrl"],
  ["playback", "Facebook bootstrap load mistaken for SDK readiness", 'script.onload = () => { if (provider === "instagram") ready(); };', "script.onload = ready;"],
  ["playback", "existing Facebook initializer discarded", "const previousInit = sdkWindow.fbAsyncInit;", "const previousInit = undefined;"],
  ["playback", "Facebook initializes before Instagram prerequisite", 'await loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram");', 'void loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram");'],
  ["playback", "Facebook prerequisite recursively loads itself", 'loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram")', 'loadMetaSdk(instagram.metaEmbed.sdkUrl, "facebook")'],
  ["playback", "Instagram API prerequisite unchecked", 'if (!(window as MetaWindow).instgrm?.Embeds) throw new Error("Instagram SDK unavailable");', ""],
  ["playback", "loader mounts unsolicited Instagram content", 'await loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram");', 'await loadMetaSdk(instagram.metaEmbed.sdkUrl, "instagram"); window.instgrm.Embeds.process();'],
  ["playback", "invalid Facebook SDK fallback structure", 'fallback.className = "fb-xfbml-parse-ignore";', 'fallback.className = "fallback";'],
  ["playback", "autoplay enabled", 'media.dataset.autoplay = "false";', 'media.dataset.autoplay = "true";'],
  ["playback", "response HTML inserted", "container.replaceChildren(media);", 'container.innerHTML = "<script>untrusted</script>";'],
  ["playback", "generated iframe permits autoplay", 'allow="accelerometer;', 'allow="autoplay; accelerometer;'],
  ["playback", "unscoped SDK processing", "fb.XFBML.parse(container);", "fb.XFBML.parse(document.body);"],
  ["playback", "SDK ready subscription retained", 'sdkWindow.FB?.Event.unsubscribe("xfbml.ready", readyHandler)', 'sdkWindow.FB?.Event.subscribe("xfbml.ready", readyHandler)'],
  ["playback", "provider failure subscription retained", "releaseError?.release();", ""],
  ["playback", "old provider playback retained", "instance?.pause();", ""],
  ["playback", "failed provider lifecycle remains active", "active = false;", "active = true;"],
  ["playback", "failure no longer releases provider", 'if (state === "unavailable")', 'if (state === "mounted")'],
  ["playback", "late SDK completion restores failed DOM", "if (!active) return;", ""],
  ["playback", "outer timer expires before sequential SDK loaders", 'setState("unavailable"), 30000)', 'setState("unavailable"), 12000)'],
  ["playback", "source fallback removed", "href={playback.sourceUrl}", 'href="#"'],
  ["domain", "Facebook SDK host replaced", "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v25.0", "https://meta-embed.example/sdk.js"],
  ["domain", "Instagram SDK host replaced", "https://www.instagram.com/embed.js", "https://instagram.com.example/embed.js"],
  ["domain", "Meta default changed globally", 'playbackMode: "external", metaEmbed:', 'playbackMode: "embed", metaEmbed:'],
  ["domain", "short Facebook host accepted", '"m.facebook.com", "web.facebook.com"', '"m.facebook.com", "fb.watch"'],
  ["domain", "Share resolver introduced", 'const watch = /^\\/watch\\/?$/.test(url.pathname)', 'resolveShortShareUrl(url); const watch = /^\\/watch\\/?$/.test(url.pathname)'],
  ["domain", "Meta bypasses canonical URL classification", "normalizeVideoUrl(payload.provider, payload.video_url)", "payload.video_url"],
  ["action", "authenticated read bypassed", "  await requireAdminSession();", ""],
  ["action", "parallel embed read owner", "return readMetaVideoEmbed(payload);", "return readParallelEmbed(payload);"],
] as const) {
  assert.ok(metaVideoSources[role].includes(from), `Meta playback negative fixture must mutate current source: ${label}`);
  assert.ok(!hasCanonicalMetaVideoPlayback({ ...metaVideoSources, [role]: metaVideoSources[role].replaceAll(from, to) }),
    `Meta playback negative: ${label} must fail closed.`);
}
const adminMediaGalleryField = readParsedSource(
  CONTENT_EDITOR_ARCHITECTURE.mediaGalleryOwner,
);
const adminMediaImageField = readParsedSource(
  "src/components/admin/media/AdminMediaImageField.tsx",
);
const topicContentTypeControl = readParsedSource(
  "src/components/admin/content/editors/TopicContentTypeControl.tsx",
);
const contentFormNavigation = readParsedSource(
  "src/components/admin/content/editors/content-form-definition.ts",
);
const contentReviewCapability = readParsedSource(
  "src/lib/admin/content-workflow/content-review-capability.ts",
);
const adminFormRuntime = readParsedSource(
  CONTENT_EDITOR_ARCHITECTURE.formRuntimeOwner,
);
const adminModuleTabs = readParsedSource(CONTENT_EDITOR_ARCHITECTURE.tabsOwner);

assert.ok(
  ["input", "change"].every((eventType) =>
    collectNodes(adminFormRuntime, ts.isCallExpression).some(
      (call) =>
        pathEndsWith(expressionPath(call.expression), [
          "ownerDocument",
          "addEventListener",
        ]) &&
        staticString(call.arguments[0]) === eventType &&
        pathEndsWith(expressionPath(call.arguments[1]), ["handleFormChange"]) &&
        (!call.arguments[2] ||
          call.arguments[2].kind === ts.SyntaxKind.FalseKeyword),
    ),
  ) &&
    collectNodes(adminFormRuntime, ts.isCallExpression).some(
      (call) =>
        pathEndsWith(expressionPath(call.expression), ["form", "contains"]) &&
        pathEndsWith(expressionPath(call.arguments[0]), ["target"]),
    ),
  "Admin Form dirty tracking must run after React input ownership while remaining scoped to its form.",
);

function assertCanonicalVideoRuntimeErrors(input: string) {
  const raw = parseTypeScriptSource("MediaVideoFields.tsx", input), rawPanel = videoPanelBranch(raw);
  assert.ok(rawPanel, "The actual Video panel branch remains present");
  const omitted = parseTypeScriptSource("MediaVideoFields.omitted.tsx", omittedNativeVideoBindingSource(input));
  const omittedPanel = videoPanelBranch(omitted);
  assert.ok(omittedPanel, "The omitted-binding projection retains the actual panel branch");
  const defaultVideoSource = parseTypeScriptSource("MediaVideoFields.default.tsx", input.slice(0, rawPanel.getStart(raw)) + input.slice(rawPanel.end));
  for (const [presentation, scope] of [["panel", omittedPanel], ["default", defaultVideoSource]] as const) {
  const specializedFields = presentation === "panel"
    ? ["video_url", "video_start_seconds", "video_duration", "video_thumbnail"]
    : ["video_url", "video_duration", "video_thumbnail"];
  for (const field of specializedFields) {
    assert.equal(jsxElements(scope, "AdminFormError").filter((element) => jsxAttributeStaticString(element, "name") === field).length, 1, presentation + " " + field + " projects its specialized runtime error exactly once.");
    if (presentation === "panel" && field === "video_duration") continue;
    assert.ok(hasStaticCallArgument(scope, "hasError", 0, field) && hasStaticString(scope, field + "-error"), presentation + " " + field + " derives ARIA error state from AdminFormRuntime.");
  }
  const control = (name: string) => jsxElements(scope, "input").find((element) => jsxAttributeStaticString(element, "name") === name), url = control("video_url"), duration = control("video_duration"), thumbnail = jsxElements(scope, "AdminMediaImageField").find((element) => jsxAttributeStaticString(element, "name") === "video_thumbnail");
  assert.ok(url && jsxHasAttributes(url, ["aria-invalid", "aria-describedby"]) && duration && (presentation === "panel" ? jsxAttributeStaticString(duration, "type") === "hidden" : jsxHasAttributes(duration, ["aria-invalid", "aria-describedby"])) && thumbnail && jsxAttributeStaticString(thumbnail, "focusTargetId") === "video_thumbnail_control" && jsxHasAttributes(thumbnail, ["ariaInvalid", "ariaDescribedBy"]), presentation + " Video errors remain bound to eligible visible controls while panel retains duration as hidden metadata.");
  }
}
assertCanonicalVideoRuntimeErrors(mediaVideoFields.text);
function verifyVideoRuntimeErrorRendering(input: string) {
  assertCanonicalVideoRuntimeErrors(input);
  const tree = parseTypeScriptSource("MediaVideoFields.tsx", input);
  for (const [module, names] of [["../../../ui/AdminFormRuntime", ["AdminFormError", "AdminFormGrid", "useOptionalAdminFormRuntime"]], ["../../../media/AdminMediaImageField", ["default"]]] as const) {
    const declaration = tree.statements.find((node): node is ts.ImportDeclaration => ts.isImportDeclaration(node) && staticString(node.moduleSpecifier) === module && !node.importClause?.isTypeOnly);
    assert.ok(declaration?.importClause, "Native error and media ports retain their actual canonical imports");
    for (const name of names) {
      if (name === "default") assert.equal(declaration.importClause.name?.text, "AdminMediaImageField");
      else assert.ok(declaration.importClause.namedBindings && ts.isNamedImports(declaration.importClause.namedBindings) && declaration.importClause.namedBindings.elements.some(binding => !binding.isTypeOnly && !binding.propertyName && binding.name.text === name));
    }
  }
  const owner = tree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "MediaVideoFields");
  assert.ok(owner?.body);
  const errorTree = readParsedSource(CONTENT_EDITOR_ARCHITECTURE.formRuntimeOwner), errorOwner = errorTree.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "AdminFormError");
  assert.ok(errorOwner, "Execute the actual canonical runtime error renderer");
  const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const nativeRequire = createRequire(import.meta.url);
  const requireJsx = (name: string) => { assert.equal(name, "react/jsx-runtime", "Only the native JSX runtime is loaded by the extracted component"); return nativeRequire(name); };
  let fieldErrors: Record<string, string[]> = {};
  const useRuntime = () => ({ state: { status: Object.keys(fieldErrors).length ? "error" : "idle" }, fieldErrors });
  const ErrorOwner = new Function("exports", "require", "useOptionalAdminFormRuntime", compile(errorOwner.getText(errorTree)) + ";return exports.AdminFormError;")({}, requireJsx, useRuntime) as (props: { name?: string }) => ReactNode;
  const passthrough = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  // Geometry, picker transport and playback are explicit controlled ports here;
  // the actual Video component and actual Form Error emit the tested native DOM.
  const ports = {
    ...videoPayload, mediaContentSlot, useOptionalAdminFormRuntime: useRuntime,
    AdminFormError: ErrorOwner, AdminFormGrid: passthrough, AdminCard: passthrough, AdminFormField: passthrough,
    AdminModuleSectionHeader: () => null, AdminModuleTabIcon: () => null, AdminNotice: () => null, MediaVideoPlayback: () => null,
    ADMIN_FORM: { helperTextInset: "" }, ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME: "",
    adminChoiceButtonClassName: () => "", adminFormFieldClassName: () => "", adminFormHintClassName: () => "", adminFormLabelClassName: () => "",
    AdminFormListboxSelect: ({ name, value }: { name?: string; value?: string }) => createElement("input", { type: "hidden", name, value, readOnly: true }),
    AdminMediaImageField: ({ name, defaultValue, focusTargetId, ariaInvalid, ariaDescribedBy }: { name?: string; defaultValue?: string; focusTargetId?: string; ariaInvalid?: boolean; ariaDescribedBy?: string }) => createElement("div", null, createElement("input", { type: "hidden", name, defaultValue }), createElement("button", { type: "button", id: focusTargetId, "aria-invalid": ariaInvalid || undefined, "aria-describedby": ariaDescribedBy })),
  };
  const bindings = Object.keys(ports);
  const Video = new Function("exports", "require", ...bindings, compile(owner.getText(tree)) + ";return exports.default;")({}, requireJsx, ...Object.values(ports)) as (props: Record<string, unknown>) => ReactNode;
  const bound = { urlId: "bound-video-url", urlErrorName: "bound_video_url", thumbnailName: "video_poster_image", thumbnailAltName: "video_poster_alt", thumbnailAltId: "bound-video-alt", thumbnailAltErrorName: "bound_video_alt", thumbnailAlt: "Saved poster Alt", onThumbnailAltChange() {}, browseFolder: "images/projects/videos", mediaSlot: mediaContentSlot("videoPoster") };
  const modes = [
    { name: "omitted default", props: {}, panel: false, bound: false },
    { name: "explicit default", props: { presentation: "default" }, panel: false, bound: false },
    { name: "default ignores panel-only binding", props: { presentation: "default", nativeBinding: bound }, panel: false, bound: false },
    { name: "Topic panel", props: { presentation: "panel" }, panel: true, bound: false },
    { name: "bound panel", props: { presentation: "panel", nativeBinding: bound }, panel: true, bound: true },
  ];
  const attributes = (tag: string) => new Map(Array.from(tag.matchAll(/\s([\w:-]+)="([^"]*)"/gu), match => [match[1]!, match[2]!]));
  let cases = 0;
  for (const mode of modes) for (const errors of [false, true]) {
    const names = mode.bound ? [bound.thumbnailName] : mode.panel ? ["video_url", "video_start_seconds", "video_duration", "video_thumbnail"] : ["video_url", "video_duration", "video_thumbnail"];
    fieldErrors = errors ? Object.fromEntries([...names, bound.urlErrorName, bound.thumbnailAltErrorName].map(name => [name, [`Error ${name}`]])) : {};
    const html = renderToStaticMarkup(createElement(Video, { defaultVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", videoProvider: "youtube", videoStartSeconds: "15", defaultDuration: "12:34", defaultThumbnail: "/saved-poster.jpg", onVideoUrlChange() {}, onVideoThumbnailChange() {}, ...mode.props }));
    const tags = Array.from(html.matchAll(/<(?:input|button|p)\b[^>]*>/gu), match => attributes(match[0]));
    const alerts = tags.filter(tag => tag.get("role") === "alert");
    assert.equal(alerts.length, errors ? names.length : 0, `${mode.name} error count`);
    for (const name of names) assert.equal(alerts.filter(tag => tag.get("id") === `${name}-error`).length, errors ? 1 : 0, `${mode.name} canonical error name/id exactly once`);
    const control = (name: string) => { const found = tags.filter(tag => tag.get("name") === name); assert.equal(found.length, 1, `${mode.name} retains one ${name} native projection`); return found[0]!; };
    const url = control("video_url"), thumbnail = control(mode.bound ? bound.thumbnailName : "video_thumbnail");
    assert.equal(url.get("value"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(thumbnail.get("value"), "/saved-poster.jpg");
    assert.equal(url.get("aria-invalid"), errors ? "true" : undefined);
    assert.equal(url.get("aria-describedby"), errors ? `${mode.bound ? bound.urlErrorName : "video_url"}-error` : undefined);
    const picker = tags.filter(tag => tag.get("id") === (mode.bound ? `${bound.urlId}-thumbnail-control` : "video_thumbnail_control"));
    assert.equal(picker.length, 1); assert.equal(picker[0]!.get("aria-invalid"), errors ? "true" : undefined);
    assert.equal(picker[0]!.get("aria-describedby"), errors ? `${mode.bound ? bound.thumbnailName : "video_thumbnail"}-error` : undefined);
    if (mode.bound) {
      assert.equal(tags.filter(tag => tag.get("name") === "video_provider" || tag.get("name") === "video_start_seconds" || tag.get("name") === "video_duration").length, 0, "URL-only native binding cannot add Topic payload fields");
      assert.equal(control(bound.thumbnailAltName).get("value"), bound.thumbnailAlt);
      assert.equal(control(bound.thumbnailAltName).get("aria-describedby"), errors ? `${bound.thumbnailAltErrorName}-error` : undefined);
      assert.equal(alerts.some(tag => tag.get("id") === `${bound.urlErrorName}-error` || tag.get("id") === `${bound.thumbnailAltErrorName}-error`), false, "Bound URL/Alt errors remain with their existing outer aggregate owner");
    } else {
      assert.equal(control("video_duration").get("value"), "12:34");
      assert.equal(control("video_duration").get("type"), mode.panel ? "hidden" : undefined);
      assert.equal(control("video_provider").get("value"), "youtube");
      if (mode.panel) assert.equal(control("video_start_seconds").get("aria-describedby"), errors ? "video_start_seconds-error" : undefined);
    }
    cases++;
  }
  console.log(`PASS Video runtime error contract: ${cases} actual component/Error SSR states with controlled visual/media ports; canonical native values, names, IDs, ARIA, hidden duration and bound payload scope retained.`);
}
verifyVideoRuntimeErrorRendering(mediaVideoFields.text);
assertCanonicalVideoRuntimeErrors(mediaVideoFields.text.replace('nativeBinding?.urlErrorName ?? "video_url"', "nativeBinding?.urlErrorName ?? 'video_url'").replace('nativeBinding?.thumbnailName ?? "video_thumbnail"', "nativeBinding?.thumbnailName ?? 'video_thumbnail'"));
for (const [name, before, after] of [
  ["URL fallback", 'nativeBinding?.urlErrorName ?? "video_url"', 'nativeBinding?.urlErrorName ?? "wrong_url"'],
  ["thumbnail fallback", 'nativeBinding?.thumbnailName ?? "video_thumbnail"', 'nativeBinding?.thumbnailName ?? "wrong_thumbnail"'],
  ["lost bound URL error", 'nativeBinding?.urlErrorName ?? "video_url"', '"video_url"'],
  ["lost bound thumbnail name", 'nativeBinding?.thumbnailName ?? "video_thumbnail"', '"video_thumbnail"'],
  ["lost URL error", '<AdminFormError name={urlErrorName} />', '<span />'],
  ["lost thumbnail error", '<AdminFormError name={thumbnailName} />', '<span />'],
  ["detached URL hasError", 'hasError(urlErrorName)', 'hasError("unrelated_url")'],
  ["detached URL error ID", '`${urlErrorName}-error`', '`${urlErrorName}-detached`'],
  ["detached thumbnail hasError", 'hasError(thumbnailName)', 'hasError("unrelated_thumbnail")'],
  ["detached thumbnail error ID", '`${thumbnailName}-error`', '`${thumbnailName}-detached`'],
  ["thumbnail focus", '"video_thumbnail_control"', '"wrong_thumbnail_control"'],
  ["bound local duplicate error", '!nativeBinding ? <AdminFormError name={urlErrorName}', 'nativeBinding ? <AdminFormError name={urlErrorName}'],
  ["bound payload leak", '!nativeBinding ? <input type="hidden" name="video_duration"', 'nativeBinding ? <input type="hidden" name="video_duration"'],
  ["parallel runtime", 'from "../../../ui/AdminFormRuntime"', 'from "../../../ui/ParallelFormRuntime"'],
] as const) {
  const mutated = mediaVideoFields.text.replaceAll(before, after);
  assert.notEqual(mutated, mediaVideoFields.text, `${name} mutation changes actual source`);
  assert.equal((parseTypeScriptSource("video-negative.tsx", mutated) as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0, `${name} mutation remains syntax-valid`);
  assert.throws(() => verifyVideoRuntimeErrorRendering(mutated), `${name} mutation cannot bypass canonical native runtime errors`);
}
console.log("PASS Video runtime errors reject fourteen effective syntax-valid source regressions; original late native/default error assertions remain intact.");
assert.ok(["video_provider", "video_start_seconds"].every((name) =>
  collectNodes(contentFormNavigation, ts.isPropertyAssignment).some((node) =>
    staticPropertyName(node.name) === name &&
    unwrapObjectLiteral(node.initializer) &&
    staticString(objectLiteralProperty(unwrapObjectLiteral(node.initializer)!, "tabId")) === "video")),
"Video provider and start-time errors use the existing Content form navigation contract.");
// Preserve explicit error-focus IDs and the generated fallback used by ordinary pickers.
const mediaTriggerId = collectNodes(adminMediaImageField, ts.isVariableDeclaration)
  .filter((node) => ts.isIdentifier(node.name) && node.name.text === "triggerId");
const generatedMediaTriggerId = collectNodes(adminMediaImageField, ts.isVariableDeclaration)
  .filter((node) => ts.isIdentifier(node.name) && node.name.text === "generatedFocusTargetId");
assert.equal(mediaTriggerId.length, 1);
assert.equal(generatedMediaTriggerId.length, 1);
const triggerIdExpression = mediaTriggerId[0].initializer;
const generatedIdExpression = generatedMediaTriggerId[0].initializer;
assert.ok(triggerIdExpression && ts.isBinaryExpression(triggerIdExpression));
assert.equal(triggerIdExpression.operatorToken.kind, ts.SyntaxKind.QuestionQuestionToken);
assert.deepEqual(expressionPath(triggerIdExpression.left), ["focusTargetId"]);
assert.deepEqual(expressionPath(triggerIdExpression.right), ["generatedFocusTargetId"]);
assert.ok(generatedIdExpression && ts.isCallExpression(generatedIdExpression));
assert.equal(callName(generatedIdExpression), "useId");
assert.equal(generatedIdExpression.arguments.length, 0);
const actionableMediaPickerControls = jsxElements(
  adminMediaImageField,
  "button",
).filter((element) =>
  jsxAttributePathIs(element, "id", ["triggerId"]),
);
const mediaPickerFieldGroups = jsxElements(
  adminMediaImageField,
  "div",
).filter((element) =>
  Boolean(jsxAttribute(element, "data-admin-media-image-field")),
);
assert.ok(
  hasTypeProperty(adminMediaImageField, "focusTargetId") &&
    hasTypeProperty(adminMediaImageField, "ariaInvalid") &&
    hasTypeProperty(adminMediaImageField, "ariaDescribedBy") &&
    mediaPickerFieldGroups.length > 0 &&
    mediaPickerFieldGroups.every((element) =>
      jsxHasAttributes(element, ["role", "aria-invalid", "aria-describedby"]),
    ) &&
    actionableMediaPickerControls.length === 4 &&
    actionableMediaPickerControls.every((element) =>
      jsxAttributeStaticString(element, "type") === "button" &&
      !jsxAttribute(element, "role") &&
      !jsxAttribute(element, "aria-invalid") &&
      jsxHasAttributes(element, [
        "aria-haspopup",
        "aria-expanded",
        "aria-describedby",
        "onClick",
      ]),
    ),
  "The shared Media image presentation owner must retain native button semantics while putting thumbnail focus and dialog ARIA on its actionable visible picker.",
);

const galleryOwnerUse = jsxElements(
  mediaContentForm,
  "AdminMediaGalleryField",
).find(
  (element) =>
    jsxAttributeStaticString(element, "valueMode") === "items" &&
    jsxAttributeStaticString(element, "name") === "gallery_image_url" &&
    jsxAttributeStaticString(element, "altName") === "gallery_image_alt" &&
    jsxAttributeStaticString(element, "captionName") ===
      "gallery_image_caption",
);
assertExecutableSourceBinding(
  mediaContentFormSourceFile,
  CONTENT_EDITOR_ARCHITECTURE.mediaGalleryOwner,
  "default",
);
assert.ok(
  galleryOwnerUse &&
    jsxAttributeStaticString(galleryOwnerUse, "focusTargetId") ===
      "gallery_image_url" &&
    jsxAttributeStaticString(galleryOwnerUse, "altFocusTargetId") ===
      "gallery_image_alt" &&
    !existsSync(
      join(
        ROOT,
        "src/components/admin/content/editors/media/MediaGalleryFields.tsx",
      ),
    ),
  "Gallery create/edit must adopt the shared Media Gallery owner directly with canonical ordered item and validation targets, leaving no local implementation.",
);
function hasCanonicalGalleryPanelAdoption(input: string) {
  const tree = parseTypeScriptSource("MediaContentForm.tsx", input);
  const gallery = jsxElements(tree, "AdminMediaGalleryField");
  const enabled = (name: string) => {
    const attribute = gallery[0] && jsxAttribute(gallery[0], name);
    return attribute && (!attribute.initializer || jsxAttributeExpression(gallery[0]!, name)?.kind === ts.SyntaxKind.TrueKeyword);
  };
  const desktopColumns = gallery[0] && jsxAttributeExpression(gallery[0], "desktopColumns");
  return gallery.length === 1 && jsxAttributeStaticString(gallery[0]!, "presentation") === "panel"
    && jsxAttributeStaticString(gallery[0]!, "actionPresentation") === "card"
    && desktopColumns && ts.isNumericLiteral(desktopColumns) && desktopColumns.text === "4"
    && ["allowAdd", "allowReplace", "allowRemove", "allowReorder", "showAlt", "showCaption", "enableDragDrop"].every(enabled);
}
assert.ok(hasCanonicalGalleryPanelAdoption(mediaContentForm.text),
  "Gallery explicitly adopts the existing shared group panel and requested image capabilities; default consumers receive no new flags or drag behavior.");
const galleryConsumerSource = mediaContentForm.text.replaceAll("\r\n", "\n");
assert.ok(galleryConsumerSource.includes("desktopColumns={4}"), "Gallery Desktop grid negative fixtures must mutate the actual explicit four-column binding.");
for (const [label, replacement] of [["omitted", ""], ["wrong column count", "desktopColumns={2}"]] as const) {
  assert.ok(!hasCanonicalGalleryPanelAdoption(galleryConsumerSource.replace("desktopColumns={4}", replacement)),
    `Gallery Desktop grid negative fixture: ${label} must fail closed.`);
}
for (const capability of ["allowAdd", "allowReplace", "allowRemove", "allowReorder", "showAlt", "showCaption", "enableDragDrop"]) {
  const from = `            ${capability}\n`;
  assert.ok(galleryConsumerSource.includes(from), `Gallery capability negative fixture must mutate actual source: ${capability}`);
  assert.ok(!hasCanonicalGalleryPanelAdoption(galleryConsumerSource.replace(from, `            ${capability}={false}\n`)),
    `Gallery capability negative fixture: disabled ${capability} must fail closed.`);
}
const galleryUrlInputs = jsxElements(adminMediaGalleryField, "input").filter(
  (element) => jsxAttributePathIs(element, "name", ["props", "name"]),
);
const galleryItemOwners = jsxElements(adminMediaGalleryField, "AdminMediaImageField");
const galleryErrors = jsxElements(adminMediaGalleryField, "AdminFormError");
assert.ok(
  hasTypeProperty(adminMediaGalleryField, "valueMode") &&
    hasTypeProperty(adminMediaGalleryField, "defaultItems") &&
    hasTypeProperty(adminMediaGalleryField, "altName") &&
    hasTypeProperty(adminMediaGalleryField, "captionName") &&
    galleryUrlInputs.some(
      (element) => jsxAttributeStaticString(element, "type") === "hidden",
    ) &&
    galleryItemOwners.length === 1 &&
    jsxAttributeStaticString(galleryItemOwners[0]!, "variant") === "gallery" &&
    jsxAttributePathIs(galleryItemOwners[0]!, "value", ["item", "url"]) &&
    jsxAttributePathIs(galleryItemOwners[0]!, "altValue", ["item", "alt"]) &&
    jsxAttributePathIs(galleryItemOwners[0]!, "captionValue", ["item", "caption"]) &&
    jsxElements(adminMediaGalleryField, "textarea").length === 0 &&
    galleryErrors.length === 2 &&
    galleryErrors.some((element) =>
      jsxAttributePathIs(element, "name", ["errorName"]),
    ) &&
    galleryErrors.some((element) =>
      jsxAttributePathIs(element, "name", ["altErrorName"]),
    ) &&
    adminMediaGalleryField.text.includes('const errorName = props.valueMode === "items" ? props.errorName ?? props.name : props.name;') &&
    adminMediaGalleryField.text.includes('const altErrorName = props.valueMode === "items" ? props.altErrorName ?? props.altName : "";'),
  "Gallery delegates one controlled image/Alt/Caption item to the canonical ImageField while retaining collection projection and aggregate errors.",
);
function hasOptionalGalleryMetadataProjection(gallery: string, image: string) {
  const tree = parseTypeScriptSource("AdminMediaGalleryField.tsx", gallery);
  const owners = jsxElements(tree, "AdminMediaImageField");
  if (owners.length !== 1) return false;
  const owner = owners[0]!;
  const metadata = parseTypeScriptSource("AdminMediaImageField.tsx", image);
  const render = collectNodes(metadata, ts.isFunctionDeclaration).find(node => node.name?.text === "renderMetadataField");
  return Boolean(render) && [["showAlt", "altName", "alt"], ["showCaption", "captionName", "caption"]].every(([flag, field, value]) =>
    jsxAttributePathIs(owner, flag!, [flag!]) &&
    jsxAttributePathIs(owner, value! + "Value", ["item", value!]) &&
    Boolean(jsxAttribute(owner, field!))
  ) && render!.getText(metadata).includes('if (!(isAlt ? showAlt : showCaption)) return <input key={kind} type="hidden" name={fieldName} value={fieldValue} />;')
    && render!.getText(metadata).includes('const fieldValue = isAlt ? altValue : captionValue;')
    && render!.getText(metadata).includes('const fieldName = isAlt ? altName : captionName;')
    && render!.getText(metadata).includes('name: fieldName,') && render!.getText(metadata).includes('value: fieldValue,');
}
assert.ok(hasOptionalGalleryMetadataProjection(adminMediaGalleryField.text, adminMediaImageField.text),
  "Gallery forwards visibility and controlled tuples; ImageField alone preserves one editable or hidden native projection per metadata value.");
for (const [label, from, to] of [
  ["controlled Alt dropped", 'altValue={item.alt}', 'altValue=""'],
  ["controlled Caption dropped", 'captionValue={item.caption}', 'captionValue=""'],
  ["Alt visibility lost", 'showAlt={showAlt}', 'showAlt'],
  ["Caption visibility lost", 'showCaption={showCaption}', 'showCaption'],
] as const) {
  assert.ok(adminMediaGalleryField.text.includes(from), `Gallery metadata negative fixture must mutate actual source: ${label}`);
  assert.ok(!hasOptionalGalleryMetadataProjection(adminMediaGalleryField.text.replace(from, to), adminMediaImageField.text),
    `Gallery metadata negative fixture: ${label} must fail closed.`);
}
for (const [from, to] of [['value={fieldValue}', 'value=""'], ['const fieldName = isAlt ? altName : captionName;', 'const fieldName = altName;']] as const) {
  assert.ok(adminMediaImageField.text.includes(from));
  assert.ok(!hasOptionalGalleryMetadataProjection(adminMediaGalleryField.text, adminMediaImageField.text.replace(from, to)), "Image metadata hidden-value loss or name collision must fail the same canonical guard.");
}
assert.ok(
  hasIdentifier(adminMediaGalleryField, "altErrorIndex") &&
    hasCall(adminMediaGalleryField, "trim") &&
    hasIdentifier(adminMediaGalleryField, "hasUrlError") &&
    hasIdentifier(adminMediaGalleryField, "hasAltError") &&
    hasIdentifier(adminMediaGalleryField, "focusTargetId") &&
    hasIdentifier(adminMediaGalleryField, "altFocusTargetId") &&
    hasStaticString(adminMediaGalleryField, "input") &&
    hasCall(adminMediaGalleryField, "dispatchEvent") &&
    ["add", "replace", "remove", "move-up", "move-down"].every((action) =>
      hasStaticString(adminMediaGalleryField, action),
    ),
  "The shared Gallery owner must retain aggregate error focus and notify form and review ownership after every structural mutation.",
);

const specializedNavigationTargets = {
  content_type: { tabId: "basic", targetId: "topic-content-type-popover-trigger" },
  video_provider: { tabId: "video", targetId: "video-provider-option-youtube" },
  video_url: { tabId: "video", targetId: "video_url" },
  video_start_seconds: { tabId: "video", targetId: "video_start_seconds" },
  video_duration: { tabId: "video", targetId: "video_url" },
  video_thumbnail: { tabId: "video", targetId: "video_thumbnail_control" },
  gallery_image_url: { tabId: "gallery", targetId: "gallery_image_url" },
  gallery_image_alt: { tabId: "gallery", targetId: "gallery_image_alt" },
  gallery_image_caption: { tabId: "gallery", targetId: "gallery_image_url" },
} as const;
for (const [field, { tabId, targetId }] of Object.entries(specializedNavigationTargets)) {
  assert.equal(
    staticObjectPath(contentFormNavigation, "CONTENT_FORM_NAVIGATION", [
      "fields",
      field,
      "tabId",
    ]),
    tabId,
    `${field} save errors must navigate to their owning ${tabId} tab.`,
  );
  assert.equal(
    staticObjectPath(contentFormNavigation, "CONTENT_FORM_NAVIGATION", [
      "fields",
      field,
      "targetId",
    ]),
    targetId,
    `${field} save errors must navigate to their stable visible target.`,
  );
}
for (const [checkId, tabId, targetId] of [
  ["video-url", "video", "video_url"],
  ["gallery-images", "gallery", "gallery_image_url"],
  ["gallery-alt", "gallery", "gallery_image_alt"],
] as const) {
  assert.equal(
    staticObjectPath(contentReviewCapability, "COMMON_CORRECTION_TARGETS", [checkId, "tabId"]),
    tabId,
    `${checkId} Review correction must open its owning ${tabId} tab.`,
  );
  assert.equal(
    staticObjectPath(contentReviewCapability, "COMMON_CORRECTION_TARGETS", [
      checkId,
      "targetId",
    ]),
    targetId,
    `${checkId} Review correction must use the same visible Gallery target as save errors.`,
  );
}
const contentTypeListbox = jsxElements(
  topicContentTypeControl,
  "AdminListboxSelect",
).find(
  (element) =>
    jsxAttributeStaticString(element, "triggerId") ===
    "topic-content-type-popover-trigger",
);
assert.ok(
  contentTypeListbox &&
    jsxHasAttributes(contentTypeListbox, ["ariaInvalid", "ariaDescribedBy"]) &&
    hasStaticString(topicContentTypeControl, "content_type-error") &&
    jsxElements(topicContentTypeControl, "AdminFormError").some(
      (element) =>
        jsxAttributeStaticString(element, "name") === "content_type",
    ),
  "Content type failures must target the visible Listbox trigger instead of the hidden submission projection.",
);

const visibleFocusableSelector =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
for (const [owner, program] of [
  ["AdminFormRuntime", adminFormRuntime],
  ["AdminModuleTabs", adminModuleTabs],
] as const) {
  assert.ok(
    staticVariableValue(program, "focusableSelector") ===
      visibleFocusableSelector &&
      collectNodes(program, ts.isCallExpression).some(
        (call) =>
          pathEndsWith(expressionPath(call.expression), ["target", "matches"]) &&
          pathEndsWith(expressionPath(call.arguments[0]), [
            "focusableSelector",
          ]),
      ),
    `${owner} must exclude hidden, disabled, and negative-tabindex direct focus targets.`,
  );
}

assert.equal(
  new Set(CONTENT_EDITOR_EXECUTABLE_CONSUMERS.map((consumer) => consumer.id))
    .size,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS.length,
  "Executable editor consumer IDs must be unique.",
);
const canonicalContentEditorRouteIdentities = PRODUCT_SURFACE_IDENTITIES.filter(
  (identity) =>
    identity.scope === "admin_route" &&
    identity.productSurfaceKind === "editor" &&
    identity.workflowOwner === "content_domain",
);
assert.ok(
  canonicalContentEditorRouteIdentities.length > 0,
  "Product Surface Identity must expose the canonical Content Admin editor routes.",
);
const executableRouteCoverage = contentEditorRouteCoverage({
  routeIdentities: canonicalContentEditorRouteIdentities,
  registeredEditors: CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
});
assert.deepEqual(
  executableRouteCoverage.routesWithoutRegisteredEditor,
  [],
  "Every canonical Content Admin editor route must reach a registered executable editor.",
);
assert.deepEqual(
  executableRouteCoverage.registeredEditorsWithoutRoute,
  [],
  "Every registered executable editor must be reachable from a canonical Content Admin editor route.",
);
assert.deepEqual(
  executableRouteCoverage.unregisteredReachableEditorSourceFiles,
  [],
  "Every route-reachable Content Editor shell consumer must be registered.",
);

const unregisteredRouteSource =
  "src/app/admin/content/topics/__unregistered-editor-probe__/page.tsx";
const unregisteredEditorSource =
  "src/components/admin/content/editors/__UnregisteredEditorProbe.tsx";
const unregisteredEditorOverrides: SourceOverrides = new Map([
  [
    unregisteredRouteSource,
    `import ArticleEditor from "../../../../../components/admin/content/editors/ArticleEditor";
import UnregisteredEditor from "../../../../../components/admin/content/editors/__UnregisteredEditorProbe";
export default function UnregisteredEditorRouteProbe() {
  return <><ArticleEditor /><UnregisteredEditor /></>;
}`,
  ],
  [
    unregisteredEditorSource,
    'import ContentEditorShell from "./ContentEditorShell"; export default function UnregisteredEditorProbe() { return <ContentEditorShell>{null}</ContentEditorShell>; }',
  ],
]);
const unregisteredRouteFixture = contentEditorRouteCoverage({
  routeIdentities: [
    {
      id: "negative-unregistered-content-editor-route",
      route: "/admin/content/topics/__unregistered-editor-probe__",
      sourceFiles: [unregisteredRouteSource],
    },
  ],
  registeredEditors: CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
  sourceOverrides: unregisteredEditorOverrides,
});
assert.deepEqual(
  unregisteredRouteFixture.routesWithoutRegisteredEditor,
  [],
  "Negative fixture setup must retain a registered editor beside the unregistered editor.",
);
assert.deepEqual(
  unregisteredRouteFixture.unregisteredReachableEditorSourceFiles,
  [unregisteredEditorSource],
  "Negative fixture: an unregistered editor beside a registered editor on an existing route must fail closed.",
);

const orphanEditorFixture = contentEditorRouteCoverage({
  routeIdentities: canonicalContentEditorRouteIdentities,
  registeredEditors: [
    ...CONTENT_EDITOR_EXECUTABLE_CONSUMERS,
    {
      id: "negative-registered-editor-without-route",
      sourceFile: unregisteredEditorSource,
    },
  ],
  sourceOverrides: unregisteredEditorOverrides,
});
assert.deepEqual(
  orphanEditorFixture.registeredEditorsWithoutRoute,
  ["negative-registered-editor-without-route"],
  "Negative fixture: a registered editor without a canonical route binding must fail closed.",
);

const executableSourceProofs = new Set<string>();
for (const consumer of CONTENT_EDITOR_EXECUTABLE_CONSUMERS) {
  assert.ok(
    existsSync(join(ROOT, consumer.sourceFile)),
    `${consumer.id} registers missing source ${consumer.sourceFile}.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [consumer.sourceFile],
    symbolAware: true,
  });
  for (const binding of CONTENT_EDITOR_EXECUTABLE_BINDINGS) {
    assert.ok(
      graphUsesExecutableBinding({
        root: ROOT,
        graph,
        bindings: [binding],
      }),
      `${consumer.id} cannot reach ${binding.sourceFile}:${binding.exportNames.join(",")}.`,
    );
  }
  executableSourceProofs.add(consumer.id);
}
assert.equal(
  executableSourceProofs.size,
  CONTENT_EDITOR_EXECUTABLE_CONSUMERS.length,
  "Every registered Admin editor must have independent source/executable proof.",
);

const registeredPublicRoutes = new Set(
  PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href),
);
const globalSeoSourcesByRoute = new Map(
  GLOBAL_SEO_PUBLIC_CONSUMERS.map((consumer) => [
    consumer.route,
    consumer.sourceFile,
  ]),
);
const publicSourceProofs = new Set<string>();
for (const adoption of CONTENT_EDITOR_ADOPTION_MANIFEST) {
  assert.ok(
    registeredPublicRoutes.has(adoption.publicConsumer),
    `${adoption.contentType} registers an unreachable Public route.`,
  );
  const sourceFile = globalSeoSourcesByRoute.get(adoption.publicConsumer);
  assert.ok(
    sourceFile,
    `${adoption.contentType} Public route has no deterministic source registration.`,
  );
  const graph = collectExecutableSourceGraph({
    root: ROOT,
    entrySourceFiles: [sourceFile],
    symbolAware: true,
  });
  assert.ok(
    graphUsesExecutableBinding({
      root: ROOT,
      graph,
      bindings: PUBLIC_CONTENT_BINDING,
    }),
    `${adoption.contentType} Public consumer cannot reach the canonical Public Content owner.`,
  );
  publicSourceProofs.add(adoption.contentType);
}
assert.equal(
  publicSourceProofs.size,
  CONTENT_EDITOR_ADOPTION_MANIFEST.length,
  "Every registered Public content type must have independent source/executable proof.",
);

for (const sourceFile of [
  CONTENT_EDITOR_ARCHITECTURE.shellOwner,
  CONTENT_EDITOR_ARCHITECTURE.tabsOwner,
  CONTENT_EDITOR_ARCHITECTURE.formRuntimeOwner,
  CONTENT_EDITOR_ARCHITECTURE.saveOwner,
  CONTENT_EDITOR_ARCHITECTURE.basicDataOwner,
  CONTENT_EDITOR_ARCHITECTURE.reviewOwner,
  CONTENT_EDITOR_ARCHITECTURE.publishingOwner,
  CONTENT_EDITOR_ARCHITECTURE.displaySettingsOwner,
  CONTENT_EDITOR_ARCHITECTURE.seoOwner,
  CONTENT_EDITOR_ARCHITECTURE.mediaGalleryOwner,
  ...CONTENT_EDITOR_ARCHITECTURE.persistenceAdapters,
  ...CONTENT_EDITOR_EXECUTABLE_BINDINGS.map((binding) => binding.sourceFile),
]) {
  assert.ok(existsSync(join(ROOT, sourceFile)), `Missing Content owner ${sourceFile}.`);
}

console.log(
  `PASS Content Editor governance: ${executableSourceProofs.size} Admin and ${publicSourceProofs.size} Public consumers have source/executable proof; global closure remains ${CONTENT_EDITOR_ARCHITECTURE.globalClosed ? "closed" : "open"} with ${CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.length} derived blocker(s).`,
);
