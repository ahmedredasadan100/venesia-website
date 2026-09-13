import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const nativeConsumers = ["menu-builder", "page-composition-and-seo", ...[
  "cta", "cards", "breadcrumb", "feed", "featured", "media-sidebar", "media-hub",
].map(kind => `block-template-${kind}-editor`)];
let protectedForms = 0;
for (const id of nativeConsumers) {
  const entry = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.find(row => row.id === id);
  assert.ok(entry, `${id}: existing consumer registration required`);
  const files = entry.sourceFiles.flatMap(file => {
    if (/(?:MenuBuilderClient|MenuItemForm|PageSeoPanel|ModuleEditClient)\.tsx$/.test(file)) return [file];
    if (!id.startsWith("block-template-")) return [];
    const page = read(file);
    const ast = ts.createSourceFile(file, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return ast.statements.flatMap(node => {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.endsWith("ModuleEditClient")) return [];
      const name = node.importClause?.name?.text;
      assert.ok(name && page.includes(`<${name}`), `${file}: registered route must render the protected editor`);
      return [path.posix.normalize(path.posix.join(path.posix.dirname(file), `${node.moduleSpecifier.text}.tsx`))];
    });
  });
  assert.ok(files.length, `${id}: actual operation source required`);
  for (const file of files) {
    const source = read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let forms = 0;
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "form") {
        forms++;
        const children = node.children.filter(child => !ts.isJsxText(child) || child.text.trim());
        assert.equal(children.length, 1, `${file}: the whole form body must be protected, not just a row table or submit button`);
        const body = children[0];
        assert.ok(ts.isJsxElement(body));
        assert.equal(body.openingElement.tagName.getText(ast), "AdminFormPendingFields", file);
        assert.ok(node.openingElement.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === "action"), `${file}: retain native Action ownership`);
        protectedForms++;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(forms, `${file}: form-level adoption required`);
    assert.match(source, /import\s*\{\s*AdminFormPendingFields\s*\}\s*from\s*["'][^"']*\/ui\/AdminFormRuntime["']/);
  }
}
for (const [id, file, pending] of [
  ["footer-builder", "src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx", "isPending"],
  ["security-settings", "src/app/admin/settings/security/SecuritySettingsClient.tsx", "isPending"],
]) {
  assert.ok(ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.some(row => row.id === id));
  const source = read(file);
  assert.ok(source.includes(`AdminFormPendingFields pending={${pending}}`));
  assert.ok(source.includes("shouldAcceptAdminFormSource({ pending: isPending"));
  assert.ok(source.includes("if (isPending) return;"));
  assert.ok(source.includes("dirty:"));
}
for (const file of ["src/app/admin/content/topics/new/page.tsx", "src/app/admin/content/topics/[id]/page.tsx"]) {
  const source = read(file);
  assert.ok(source.includes("MediaContentForm"));
  assert.ok(source.includes("errorMessage"));
  assert.equal(/<AdminNotice\b[^>]*message=\{errorMessage\}/.test(source), false, `${file}: one Feedback owner for legacy Media errors; existing success/media notices retain their contract`);
}
const runtime = read("src/components/admin/ui/AdminFormRuntime.tsx");
assert.ok(runtime.includes("useFormStatus()"));
assert.ok(runtime.includes("disabled={pending} inert={pending}"));
assert.ok(runtime.includes('form.addEventListener("submit", blockDuplicate, true)'));
assert.ok(runtime.includes('form.removeEventListener("submit", blockDuplicate, true)'));
const providers = read("src/lib/admin/links/providers/resources.ts");
assert.equal(providers.match(/request\.or\(filter\)/g)?.length, 4);
assert.equal(providers.match(/await request\.limit\(limit\)/g)?.length, 4);
assert.equal(providers.includes(".limit(200)"), false);
assert.ok(providers.includes("buildAdminListSearchOrFilter"));
const navigation = read("src/lib/navigation/get-public-navigation.ts");
assert.ok(navigation.includes("resolvePublicContentPath(row.content_type, row.slug)"));
assert.ok(navigation.includes("resolvePagePublicPath"));
assert.ok(navigation.includes('table === "topic_categories" || table === "topic_series"'));
assert.equal(navigation.match(/tags: \["navigation", "menus", "public-content", "topics", "projects", "page-composition"\]/g)?.length, 2);
console.log(`Shared corrections operation source proof PASS (${protectedForms} native forms; Footer/Security draft ownership; Media Feedback; Navigation/Search).`);
