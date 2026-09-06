import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function hasIndexedFieldLiteral(root: ts.Node, field: string) {
  const decimalDigits = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  return collectNodes(
    root,
    (
      node,
    ): node is ts.StringLiteralLike | ts.NoSubstitutionTemplateLiteral =>
      ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node),
  ).some((literal) => {
    if (!literal.text.startsWith(field)) return false;
    const suffix = literal.text.slice(field.length);
    return (
      suffix.startsWith("[") ||
      suffix.startsWith(".") ||
      (suffix.startsWith("-") && decimalDigits.has(suffix[1] ?? ""))
    );
  });
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

  const overridesContentAtSubmit = projectionPrograms.some(
    (program) =>
      collectNodes(program, ts.isNewExpression).some(
        (expression) => callName(expression) === "FormData",
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
  globalClosureBlockerIds.has("gallery-admin-shared-media-adoption"),
  "Gallery Admin shared-media adoption must remain an explicit closure blocker until it is fixed and verified.",
);
assert.ok(
  globalClosureBlockerIds.has("gallery-public-projection"),
  "Gallery Public projection must remain an explicit closure blocker until it is fixed and verified.",
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
const mediaGalleryFields = readParsedSource(
  "src/components/admin/content/editors/media/MediaGalleryFields.tsx",
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

for (const field of [
  "video_url",
  "video_duration",
  "video_thumbnail",
] as const) {
  const errorProjectionCount = jsxElements(
    mediaVideoFields,
    "AdminFormError",
  ).filter(
    (element) => jsxAttributeStaticString(element, "name") === field,
  ).length;
  assert.equal(
    errorProjectionCount,
    1,
    `${field} must project its specialized error exactly once.`,
  );
  assert.ok(
    hasStaticCallArgument(mediaVideoFields, "hasError", 0, field) &&
      hasStaticString(mediaVideoFields, `${field}-error`),
    `${field} must derive ARIA error state from AdminFormRuntime.`,
  );
}
const videoUrlControl = jsxElements(mediaVideoFields, "input").find(
  (element) => jsxAttributeStaticString(element, "name") === "video_url",
);
const videoDurationControl = jsxElements(mediaVideoFields, "input").find(
  (element) => jsxAttributeStaticString(element, "name") === "video_duration",
);
const videoThumbnailControl = jsxElements(
  mediaVideoFields,
  "AdminMediaImageField",
).find(
  (element) =>
    jsxAttributeStaticString(element, "name") === "video_thumbnail",
);
assert.ok(
  videoUrlControl &&
    jsxHasAttributes(videoUrlControl, ["aria-invalid", "aria-describedby"]) &&
    videoDurationControl &&
    jsxHasAttributes(videoDurationControl, [
      "aria-invalid",
      "aria-describedby",
    ]) &&
    videoThumbnailControl &&
    jsxAttributeStaticString(videoThumbnailControl, "focusTargetId") ===
      "video_thumbnail_control" &&
    jsxHasAttributes(videoThumbnailControl, [
      "ariaInvalid",
      "ariaDescribedBy",
    ]),
  "Video URL, duration, and thumbnail must bind errors to their visible controls.",
);
const actionableMediaPickerControls = jsxElements(
  adminMediaImageField,
  "button",
).filter((element) =>
  jsxAttributePathIs(element, "id", ["focusTargetId"]),
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
    actionableMediaPickerControls.length > 0 &&
    actionableMediaPickerControls.every((element) =>
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

for (const field of ["gallery_image_url", "gallery_image_alt"] as const) {
  const inputs = jsxElements(mediaGalleryFields, "input").filter(
    (element) => jsxAttributeStaticString(element, "name") === field,
  );
  const errors = jsxElements(mediaGalleryFields, "AdminFormError").filter(
    (element) => jsxAttributeStaticString(element, "name") === field,
  );
  assert.equal(
    errors.length,
    1,
    `${field} aggregate error must render exactly once in source, not once per error row.`,
  );
  assert.equal(
    inputs.length,
    1,
    `${field} must retain one repeated FormData control declaration.`,
  );
  assert.ok(
    inputs.every((element) =>
      jsxHasAttributes(element, ["id", "aria-invalid", "aria-describedby"]),
    ) &&
      hasStaticString(mediaGalleryFields, `${field}-error`) &&
      !hasIndexedFieldLiteral(mediaGalleryFields, field),
    `${field} must expose a stable aria-describedby error id.`,
  );
}
assert.ok(
  hasIdentifier(mediaGalleryFields, "altErrorIndex") &&
    hasPropertyPath(mediaGalleryFields, ["row", "url"]) &&
    hasCall(mediaGalleryFields, "trim") &&
    hasStaticString(mediaGalleryFields, "gallery_image_url") &&
    hasStaticString(mediaGalleryFields, "gallery_image_alt") &&
    hasIdentifier(mediaGalleryFields, "hasUrlError") &&
    hasIdentifier(mediaGalleryFields, "hasAltError"),
  "Gallery aggregate errors must bind once to the first suitable visible URL or missing Alt control.",
);

const specializedNavigationTargets = {
  content_type: "topic-content-type-popover-trigger",
  video_thumbnail: "video_thumbnail_control",
  gallery_image_url: "gallery_image_url",
  gallery_image_alt: "gallery_image_alt",
} as const;
for (const [field, targetId] of Object.entries(specializedNavigationTargets)) {
  assert.equal(
    staticObjectPath(contentFormNavigation, "CONTENT_FORM_NAVIGATION", [
      "fields",
      field,
      "tabId",
    ]),
    "basic",
    `${field} save errors must navigate to the Basic tab.`,
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
for (const [checkId, targetId] of [
  ["gallery-images", "gallery_image_url"],
  ["gallery-alt", "gallery_image_alt"],
] as const) {
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
  ...CONTENT_EDITOR_ARCHITECTURE.persistenceAdapters,
  ...CONTENT_EDITOR_EXECUTABLE_BINDINGS.map((binding) => binding.sourceFile),
]) {
  assert.ok(existsSync(join(ROOT, sourceFile)), `Missing Content owner ${sourceFile}.`);
}

console.log(
  `PASS Content Editor governance: ${executableSourceProofs.size} Admin and ${publicSourceProofs.size} Public consumers have source/executable proof; global closure remains ${CONTENT_EDITOR_ARCHITECTURE.globalClosed ? "closed" : "open"} with ${CONTENT_EDITOR_ARCHITECTURE.globalClosureBlockers.length} derived blocker(s).`,
);
