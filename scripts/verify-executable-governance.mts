import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";
import {
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  adminSharedCapabilityKeys,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import { PUBLIC_PAGE_ROUTE_REGISTRY } from "../src/lib/admin/links/static-routes.ts";
import { parseTypeScriptSource } from "./lib/typescript-executable-graph.mts";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CAPABILITY_GUARD = "scripts/verify-admin-row-actions-capability.mts";
const GOVERNANCE_SOURCES = [
  "src/lib/admin/interaction-system/adoption-manifest.ts",
  "src/lib/admin/form-system/adoption-manifest.ts",
  "src/lib/admin/links/static-routes.ts",
  "scripts/verify-platform.mts",
  "scripts/lib/typescript-executable-graph.mts",
] as const;
const FORBIDDEN_PROOF_PROPERTIES = new Set([
  "sourceProofTokens",
  "applicabilitySourceTokens",
  "localImplementationPatterns",
  "absenceMeansNotApplicable",
]);
const EXECUTABLE_CAPABILITY_FUNCTIONS = new Set([
  "consumerExecutableGraph",
  "resolveConsumerCapabilityAudit",
  "collectConsumerCapabilityAuditFailures",
]);

function parse(sourceFile: string) {
  return parseTypeScriptSource(
    sourceFile,
    readFileSync(join(ROOT, sourceFile), "utf8"),
  );
}

function staticPropertyName(name: ts.PropertyName) {
  return ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : null;
}

function collectForbiddenProofProperties(parsed: ts.SourceFile) {
  const failures: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isPropertySignature(node) ||
        ts.isPropertyDeclaration(node)) &&
      FORBIDDEN_PROOF_PROPERTIES.has(staticPropertyName(node.name) ?? "")
    ) {
      failures.push(`${parsed.fileName}:${staticPropertyName(node.name)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return failures;
}

function collectSingleArgumentAuditCalls(parsed: ts.SourceFile) {
  const failures: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "adminConsumerCapabilityAudit" &&
      node.arguments.length !== 2
    ) {
      failures.push(
        `${parsed.fileName}:${parsed.getLineAndCharacterOfPosition(node.pos).line + 1}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return failures;
}

function functionUsesTextualSourceInference(
  parsed: ts.SourceFile,
  functionName: string,
) {
  const declaration = parsed.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
  assert.ok(
    declaration,
    `${functionName} executable governance function is missing.`,
  );
  let failed = false;
  const visit = (node: ts.Node) => {
    if (failed) return;
    if (
      ts.isRegularExpressionLiteral(node) ||
      (ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "RegExp")
    ) {
      failed = true;
      return;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["includes", "match", "matchAll", "test"].includes(
        node.expression.name.text,
      ) &&
      ts.isIdentifier(node.expression.expression) &&
      ["source", "sourceText", "content", "text"].includes(
        node.expression.expression.text,
      )
    ) {
      failed = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  return failed;
}

const parsedGovernanceSources = GOVERNANCE_SOURCES.map(parse);
const forbiddenProofProperties = parsedGovernanceSources.flatMap(
  collectForbiddenProofProperties,
);
assert.deepEqual(
  forbiddenProofProperties,
  [],
  "Executable governance sources cannot declare token, regex, or absence-based proof metadata.",
);

const implicitAuditDefaults = parsedGovernanceSources.flatMap(
  collectSingleArgumentAuditCalls,
);
assert.deepEqual(
  implicitAuditDefaults,
  [],
  "Every capability audit registration must declare decisions and overrides explicitly.",
);

const capabilityGuard = parse(CAPABILITY_GUARD);
const textualCapabilityInference = [...EXECUTABLE_CAPABILITY_FUNCTIONS].filter(
  (functionName) =>
    functionUsesTextualSourceInference(capabilityGuard, functionName),
);
assert.deepEqual(
  textualCapabilityInference,
  [],
  "Capability applicability and Source Proof cannot use textual source inference.",
);

const capabilityKeys = adminSharedCapabilityKeys(
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
);
assert.ok(capabilityKeys.length > 0, "Current Shared Capability Set is empty.");
for (const capability of capabilityKeys) {
  const definition = ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability];
  if (definition.ownerAvailability === "available") {
    assert.ok(
      definition.executableBindings.length > 0,
      `${capability} is available without an executable owner binding.`,
    );
  }
}

const consumers = [
  ...ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.map(
    (surface) => `collection:${surface.id}`,
  ),
  ...ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => `form:${entry.id}`),
];
assert.equal(
  new Set(consumers).size,
  consumers.length,
  "Consumer registration IDs must be unique inside each typed boundary.",
);
assert.equal(
  new Set(PUBLIC_PAGE_ROUTE_REGISTRY.map((route) => route.href)).size,
  PUBLIC_PAGE_ROUTE_REGISTRY.length,
  "Public route registrations must be unique.",
);

console.log("Executable Contracts & Deterministic Governance");
console.log(
  `Capabilities ..................... ${capabilityKeys.length} explicit`,
);
console.log(
  `Consumers ........................ ${consumers.length} registered`,
);
console.log(
  `Admin route owners .............. ${ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.length} registered consumers`,
);
console.log(
  `Public routes .................... ${PUBLIC_PAGE_ROUTE_REGISTRY.length} registered`,
);
console.log("String/token/regex source proof .. ABSENT");
console.log("Hidden capability defaults ....... ABSENT");
console.log("Executable governance PASS");
