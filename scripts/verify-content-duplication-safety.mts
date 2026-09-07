import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ACTION_PATH = "src/app/admin/content/topics/actions.ts";
const RESET_FIELDS = [
  "status",
  "published_at",
  "published_by",
  "views_count",
  "is_featured",
  "is_popular",
] as const;
const PRESERVED_FIELDS = [
  "content_type",
  "content",
  "excerpt",
  "date_label",
  "faq",
  "media_payload",
  "image",
  "image_alt",
  "media_project",
  "category",
  "category_slug",
  "category_id",
  "series",
  "series_slug",
  "series_id",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "focus_keyword",
  "canonical_url",
  "robots_index",
  "robots_follow",
  "og_image",
  "og_image_alt",
  "show_title_on_page",
  "show_image_on_page",
  "show_excerpt_on_page",
  "show_date_on_page",
  "show_category_on_page",
  "show_series_on_page",
  "show_intro_card_on_page",
  "show_faq_on_page",
  "show_faq_title_on_page",
] as const;

const source = readFileSync(join(ROOT, ACTION_PATH), "utf8");
const parsed = ts.createSourceFile(
  ACTION_PATH,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function findFunction(sourceFile: ts.SourceFile, name: string) {
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (!declaration?.body) {
    throw new Error(`Missing executable function ${name}.`);
  }
  return declaration as ts.FunctionDeclaration & { body: ts.Block };
}

function variableDeclaration(
  statement: ts.Statement,
  name: string,
): ts.VariableDeclaration | null {
  if (!ts.isVariableStatement(statement)) return null;
  return (
    statement.declarationList.declarations.find(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === name,
    ) ?? null
  );
}

function propertyName(property: ts.ObjectLiteralElementLike) {
  if (!property.name) return null;
  return ts.isIdentifier(property.name) ||
    ts.isStringLiteralLike(property.name) ||
    ts.isNumericLiteral(property.name)
    ? property.name.text
    : null;
}

function assertResetAssignmentsFollowEverySpread(
  literal: ts.ObjectLiteralExpression,
) {
  const spreadIndexes = literal.properties.flatMap((property, index) =>
    ts.isSpreadAssignment(property) ? [index] : [],
  );
  assert.ok(spreadIndexes.length > 0, "Duplicate payload must preserve the source contract through a spread.");
  const lastSpreadIndex = Math.max(...spreadIndexes);

  for (const field of RESET_FIELDS) {
    const assignmentIndex = literal.properties.findIndex(
      (property) =>
        ts.isPropertyAssignment(property) && propertyName(property) === field,
    );
    assert.ok(
      assignmentIndex > lastSpreadIndex,
      `${field} must be assigned after every source spread.`,
    );
  }
}

function parseNextRowLiteral(fixtureSource: string) {
  const fixture = ts.createSourceFile(
    "duplicate-fixture.ts",
    fixtureSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of fixture.statements) {
    const declaration = variableDeclaration(statement, "nextRow");
    const initializer = declaration?.initializer;
    if (initializer && ts.isObjectLiteralExpression(initializer)) {
      return initializer;
    }
  }
  throw new Error("Missing nextRow fixture.");
}

function containsCall(
  node: ts.Node,
  predicate: (call: ts.CallExpression) => boolean,
) {
  let found = false;
  const visit = (current: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(current) && predicate(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function callName(call: ts.CallExpression) {
  return ts.isIdentifier(call.expression)
    ? call.expression.text
    : ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name.text
      : null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const duplicateFunction = findFunction(parsed, "duplicateUnifiedContent");
const copyableStatement = duplicateFunction.body.statements.find(
  (statement) =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) =>
        ts.isObjectBindingPattern(declaration.name) &&
        declaration.name.elements.some(
          (element) =>
            Boolean(element.dotDotDotToken) &&
            ts.isIdentifier(element.name) &&
            element.name.text === "copyable",
        ),
    ),
);
const nextRowStatement = duplicateFunction.body.statements.find((statement) =>
  Boolean(variableDeclaration(statement, "nextRow")),
);
assert.ok(copyableStatement, "The real duplicate action must derive copyable fields.");
assert.ok(nextRowStatement, "The real duplicate action must build nextRow.");
const nextRowDeclaration = variableDeclaration(nextRowStatement, "nextRow");
assert.ok(
  nextRowDeclaration?.initializer &&
    ts.isObjectLiteralExpression(nextRowDeclaration.initializer),
  "nextRow must remain an executable object literal.",
);
assertResetAssignmentsFollowEverySpread(nextRowDeclaration.initializer);

assert.ok(
  containsCall(
    duplicateFunction,
    (call) =>
      callName(call) === "coordinateMediaReferenceEntityMutation" &&
      call.arguments.some(
        (argument) =>
          ts.isObjectLiteralExpression(argument) &&
          argument.properties.some(
            (property) =>
              (ts.isShorthandPropertyAssignment(property) &&
                property.name.text === "intendedRow") ||
              (ts.isPropertyAssignment(property) &&
                propertyName(property) === "intendedRow" &&
                ts.isIdentifier(property.initializer) &&
                property.initializer.text === "nextRow"),
          ),
      ),
  ),
  "The duplicate action must pass nextRow to the existing media coordination owner.",
);
assert.ok(
  containsCall(
    duplicateFunction,
    (call) =>
      callName(call) === "insert" &&
      call.arguments.length === 1 &&
      ts.isIdentifier(call.arguments[0]) &&
      call.arguments[0].text === "nextRow",
  ),
  "The duplicate action must insert the exact coordinated nextRow.",
);
assert.equal(
  containsCall(
    duplicateFunction,
    (call) => callName(call) === "update" || callName(call) === "delete",
  ),
  false,
  "The duplicate action must not mutate or delete the source row.",
);

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const executableSource = `
export function buildDuplicateRow(topic: Record<string, unknown>, slug: string, now: string, actor: { id: number }) {
${printer.printNode(ts.EmitHint.Unspecified, copyableStatement, parsed)}
${printer.printNode(ts.EmitHint.Unspecified, nextRowStatement, parsed)}
return nextRow;
}`;
const compiled = ts.transpileModule(executableSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "duplicate-row-runtime.ts",
}).outputText;
const executableModule = {
  exports: {} as {
    buildDuplicateRow(
      topic: Record<string, unknown>,
      slug: string,
      now: string,
      actor: { id: number },
    ): Record<string, unknown>;
  },
};
Function("exports", "module", compiled)(
  executableModule.exports,
  executableModule,
);

const contentTypes = [
  "article",
  "news",
  "press",
  "site_update",
  "video",
  "gallery",
] as const;
const now = "2026-09-07T10:00:00.000Z";

for (const [index, contentType] of contentTypes.entries()) {
  const original = deepFreeze({
    id: index + 1,
    title: `Original ${contentType}`,
    slug: `original-${contentType}`,
    content_type: contentType,
    status: "published",
    published_at: "2026-08-01T08:00:00.000Z",
    published_by: 7,
    views_count: 418,
    is_featured: true,
    is_popular: true,
    deleted_at: "2026-08-02T08:00:00.000Z",
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-08-03T08:00:00.000Z",
    created_by: 6,
    updated_by: 7,
    content: `Body ${contentType}`,
    excerpt: `Excerpt ${contentType}`,
    date_label: "2026-09-07",
    faq: [{ question: "Question", answer: "Answer" }],
    media_payload:
      contentType === "video"
        ? {
            kind: "video",
            provider: "youtube",
            video_url: "https://www.youtube.com/watch?v=duplicate-proof",
          }
        : contentType === "gallery"
          ? {
              kind: "gallery",
              images: [
                { url: "/images/gallery.jpg", alt: "Gallery alt", caption: "Caption" },
              ],
            }
          : null,
    image: "/images/cover.jpg",
    image_alt: "Cover alt",
    media_project: "project-alpha",
    category: "Category",
    category_slug: "category",
    category_id: 9,
    series: "Series",
    series_slug: "series",
    series_id: 12,
    seo_title: "SEO title",
    seo_description: "SEO description",
    seo_keywords: ["one", "two"],
    focus_keyword: "focus",
    canonical_url: "https://example.com/canonical",
    robots_index: true,
    robots_follow: true,
    og_image: "/images/og.jpg",
    og_image_alt: "OG alt",
    show_title_on_page: true,
    show_image_on_page: false,
    show_excerpt_on_page: true,
    show_date_on_page: false,
    show_category_on_page: true,
    show_series_on_page: false,
    show_intro_card_on_page: true,
    show_faq_on_page: false,
    show_faq_title_on_page: true,
  });
  const before = structuredClone(original);
  const duplicate = executableModule.exports.buildDuplicateRow(
    original,
    `${original.slug}-copy`,
    now,
    { id: 73 },
  );

  assert.deepEqual(original, before, `${contentType}: source row changed.`);
  assert.equal(duplicate.status, "unpublished");
  assert.equal(duplicate.published_at, null);
  assert.equal(duplicate.published_by, null);
  assert.equal(duplicate.views_count, 0);
  assert.equal(duplicate.is_featured, false);
  assert.equal(duplicate.is_popular, false);
  assert.equal(duplicate.deleted_at, null);
  assert.equal(duplicate.title, `${original.title} - نسخة`);
  assert.equal(duplicate.slug, `${original.slug}-copy`);
  assert.equal(duplicate.created_at, now);
  assert.equal(duplicate.updated_at, now);
  assert.equal(duplicate.created_by, 73);
  assert.equal(duplicate.updated_by, 73);
  assert.equal(Object.hasOwn(duplicate, "id"), false);
  for (const field of PRESERVED_FIELDS) {
    assert.deepEqual(
      duplicate[field],
      original[field],
      `${contentType}: intended field ${field} was not preserved.`,
    );
  }
}

assert.throws(
  () =>
    assertResetAssignmentsFollowEverySpread(
      parseNextRowLiteral(`const nextRow = {
        ...copyable,
        status: "unpublished",
        published_at: null,
        published_by: null,
        views_count: 0,
        is_featured: false,
        is_popular: false,
        ...lateCopyable,
      };`),
    ),
  /must be assigned after every source spread/u,
  "The guard must reject a late spread that can restore unsafe source values.",
);
assert.throws(
  () =>
    assertResetAssignmentsFollowEverySpread(
      parseNextRowLiteral(`const nextRow = {
        ...copyable,
        status: "unpublished",
        published_at: null,
        published_by: null,
        views_count: 0,
        is_featured: false,
      };`),
    ),
  /is_popular must be assigned after every source spread/u,
  "The guard must reject a missing mandatory reset.",
);

console.log(
  `verify:content-duplication-safety passed (${contentTypes.length} content types; AST ordering, executable payload, source immutability, and negative guards).`,
);
