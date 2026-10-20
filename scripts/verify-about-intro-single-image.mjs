/**
 * Verify About Intro Single Image module wiring only.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import ts from "typescript";

const root = resolve(process.cwd());
const failures = [];

function read(relPath) {
  const full = resolve(root, relPath);
  if (!existsSync(full)) {
    failures.push(`Missing file: ${relPath}`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function readStructuralTemplateSlugs(source) {
  const declaration = source.match(
    /export const STRUCTURAL_CONTENT_TEMPLATE_SLUGS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  );
  return new Set(
    Array.from(declaration?.[1].matchAll(/"([^"]+)"/g) ?? [], (match) => match[1]),
  );
}

function usesSharedStructuralSlugLock(source) {
  const tree = ts.createSourceFile("content-actions.ts", source, ts.ScriptTarget.Latest, true);
  const importedOwner = tree.statements.some((node) =>
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "../../../../../lib/page-blocks/module-edit-registry" &&
    !node.importClause?.isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) =>
      binding.name.text === "isStructuralContentTemplateSlug" && !binding.propertyName && !binding.isTypeOnly),
  );
  const update = tree.statements.find((node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "updateContentBlock");
  if (!importedOwner || !update?.body) return false;
  const declarations = new Map(update.body.statements.flatMap((node) =>
    ts.isVariableStatement(node) && (node.declarationList.flags & ts.NodeFlags.Const)
      ? node.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name))
        .map((declaration) => [declaration.name.text, declaration.initializer])
      : []));
  if (declarations.has("isStructuralContentTemplateSlug")) return false;
  const isIdentifier = (node, name) => Boolean(node && ts.isIdentifier(node) && node.text === name);
  const isExistingProperty = (node, name) => Boolean(node && ts.isPropertyAccessExpression(node) &&
    isIdentifier(node.expression, "existing") && node.name.text === name);
  const lock = declarations.get("slugLocked"), slug = declarations.get("slug");
  return Boolean(lock && ts.isCallExpression(lock) &&
    isIdentifier(lock.expression, "isStructuralContentTemplateSlug") && lock.arguments.length === 2 &&
    isExistingProperty(lock.arguments[0], "slug") && isExistingProperty(lock.arguments[1], "variant") &&
    slug && ts.isConditionalExpression(slug) && isIdentifier(slug.condition, "slugLocked") &&
    isExistingProperty(slug.whenTrue, "slug") && isIdentifier(slug.whenFalse, "requestedSlug"));
}

function usesSharedEditorialGeometry(source) {
  const tree = ts.createSourceFile("single-image.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importedOwner = tree.statements.some((node) =>
    ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "../../lib/page-blocks/configs" &&
    !node.importClause?.isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some((binding) =>
      binding.name.text === "EDITORIAL_IMAGE_GEOMETRY" && !binding.propertyName && !binding.isTypeOnly));
  let renderedFrame = false;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "className" &&
      node.initializer && ts.isJsxExpression(node.initializer) &&
      node.initializer.expression && ts.isTemplateExpression(node.initializer.expression)) {
      renderedFrame ||= node.initializer.expression.templateSpans.some(({ expression }) =>
        ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) &&
        expression.expression.text === "EDITORIAL_IMAGE_GEOMETRY" && expression.name.text === "frameClass");
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return importedOwner && renderedFrame;
}

const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const presentationRegistry = read("src/lib/page-composition/module-registry-metadata.ts");
const editor = read(
  "src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx",
);
const section = read("src/components/modules/AboutIntroSingleImageModuleSection.tsx");
const migration = read("sql/migrations/20250715120000_about_intro_single_image_module.sql");
const registry = read("src/lib/page-blocks/module-edit-registry.ts");
const configs = read("src/lib/page-blocks/configs.ts");
const slots = read("src/components/page-composition/slot-module-nodes.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");
const slotRegistry = read("src/lib/page-composition/slot-module-registry.ts");
const structuralTemplateSlugs = readStructuralTemplateSlugs(registry);
const jiti = createJiti(import.meta.url, { fsCache: false });
const { EDITORIAL_IMAGE_GEOMETRY } = await jiti.import("../src/lib/page-blocks/configs.ts");

assert(registry.includes('"about-intro-single-image"'), "Editor registry key missing");
assert(configs.includes("isAboutIntroSingleImageTemplate"), "Config detector missing");
assert(configs.includes("asAboutIntroSingleImageConfig"), "Config parser missing");
assert(configs.includes("AboutIntroSingleImageModuleConfig"), "Config type missing");
assert(client.includes("isAboutIntroSingleImage"), "Single-image editor key wiring missing");
assert(
  presentationRegistry.includes('labelAr: "من نحن — محتوى وصورة واحدة"'),
  "Single-image header metadata missing from the shared registry",
);
assert(client.includes("AboutIntroSingleImageModuleEditor"), "Single-image editor mount missing");
assert(editor.includes('name="image_position"'), "imagePosition field missing");
assert(!editor.includes("image_secondary"), "Single-image editor must not expose secondary image");
assert(!editor.includes('name="config_schema"'), "config_schema must live in ContentModuleEditClient only");
assert(
  EDITORIAL_IMAGE_GEOMETRY.frameClass === "aspect-[16/12]" &&
    JSON.stringify(EDITORIAL_IMAGE_GEOMETRY.ratio) === "[16,12]" &&
    usesSharedEditorialGeometry(section),
  "Public single-image frame must consume the canonical 16/12 editorial geometry",
);
assert(
  !usesSharedEditorialGeometry(section.replaceAll("EDITORIAL_IMAGE_GEOMETRY.frameClass", "EDITORIAL_IMAGE_GEOMETRY.ratio")) &&
    !usesSharedEditorialGeometry(section.replace("../../lib/page-blocks/configs", "../../lib/page-blocks/unrelated-owner")),
  "Editorial geometry guard must reject unused frame bindings and foreign owners",
);
assert(
  section.includes("slot-editorial-flow") &&
    section.includes("slot-editorial-flow--media-end") &&
    section.includes('data-module-presentation={showImage ? "editorial-flow" : undefined}'),
  "Public single-image module must adopt the shared reversible Presentation contract",
);
assert(!section.includes("lg:grid-cols-2"), "Public module must not restore a local parallel grid owner");
assert(section.includes("if (!content) return null"), "Empty content must return null");
assert(migration.includes("about-intro-single-image"), "Migration slug missing");
assert(migration.includes("where slug = 'about-intro'"), "Migration must look up about-intro by slug");
assert(migration.includes("where not exists"), "Migration must be idempotent");
assert(slots.includes("AboutIntroSingleImageModuleSection"), "Public slot renderer missing");
assert(slots.includes("isAboutIntroSingleImageContentBlock"), "Public detector missing");
assert(!slots.includes("template.id ==="), "Renderer must not hardcode template IDs");
assert(
  slotRegistry.includes("SLOT_MODULE_SLUG_METADATA") &&
    presentationRegistry.includes('"about-intro-single-image"'),
  "Slot registry must delegate slug metadata to the shared registry owner",
);
assert(actions.includes("buildAboutIntroSingleImageConfig"), "Save builder missing");
assert(
  structuralTemplateSlugs.has("about-intro-single-image"),
  "Single-image slug must be registered in the shared structural lock",
);
assert(
  usesSharedStructuralSlugLock(actions),
  "Server update must preserve slugs through the shared structural lock",
);
assert(
  !usesSharedStructuralSlugLock(actions.replaceAll("isStructuralContentTemplateSlug", "unrelatedHelper")) &&
    !usesSharedStructuralSlugLock(actions.replace("slugLocked ? existing.slug : requestedSlug", "slugLocked ? requestedSlug : existing.slug")) &&
    !usesSharedStructuralSlugLock(actions.replace("../../../../../lib/page-blocks/module-edit-registry", "../../../../../lib/page-blocks/unrelated-owner")),
  "Slug guard must reject missing owners, foreign imports and overwritten structural slugs",
);

if (failures.length) {
  console.error("verify-about-intro-single-image FAILED:");
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log("verify-about-intro-single-image OK");
