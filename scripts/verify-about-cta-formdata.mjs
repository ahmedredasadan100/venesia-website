/**
 * Public About CTA copy and internal module metadata must remain separate.
 * The current shared form preserves internal_description as one hidden field.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { createJiti } from "jiti";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const client = read("src/components/admin/page-blocks/ContentModuleEditClient.tsx");
const editor = read("src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx");
const actions = read("src/app/admin/pages-blocks/blocks/content/actions.ts");

function inputFields(source) {
  const tree = ts.createSourceFile("editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fields = [];
  const visit = (node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ["input", "textarea"].includes(node.tagName.getText(tree))) {
      const props = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(p => [p.name.getText(tree), p.initializer]));
      const name = props.name && ts.isStringLiteral(props.name) ? props.name.text : null;
      fields.push({ name, tag: node.tagName.getText(tree), type: props.type?.getText(tree), value: props.value?.getText(tree) });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return fields;
}
const internal = inputFields(client).filter(f => f.name === "internal_description");
assert.equal(internal.length, 1, "One metadata field, independent of the active tab");
assert.equal(internal[0].type, '"hidden"');
assert.equal(internal[0].value, '{block.description ?? ""}');
assert.equal(inputFields(client).filter(f => f.name === "description").length, 0, "The shell must not collide with public description");
const copy = inputFields(editor).filter(f => f.name === "description");
assert.equal(copy.length, 1, "One public description field");
assert.equal(copy[0].tag, "textarea", "About CTA retains its plain text storage contract");
assert.ok(client.includes('usesAboutCtaConfig ? <input type="hidden" name="config_schema" value="about-cta" />'));
assert.ok(actions.includes('description: cleanText(formData.get("description"))'));

const tree = ts.createSourceFile("actions.ts", actions, ts.ScriptTarget.Latest, true);
const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "readTemplateInternalDescription");
assert.ok(node);
const compiled = ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { cleanText } = await createJiti(import.meta.url).import("../src/lib/page-blocks/admin-utils.ts");
const readInternal = new Function("cleanText", compiled + "\nreturn readTemplateInternalDescription;")(cleanText);
const data = new FormData();
data.set("config_schema", "about-cta");
data.set("description", "وصف عام *حرفي* <tag>\nفقرة ثانية");
data.set("internal_description", "بيانات داخلية محفوظة");
assert.equal(readInternal(data), "بيانات داخلية محفوظة");
assert.equal(data.get("description"), "وصف عام *حرفي* <tag>\nفقرة ثانية");
data.set("internal_description", "");
assert.equal(readInternal(data), null);
data.delete("internal_description");
assert.equal(readInternal(data), null, "A missing internal field must not fall back to About CTA public copy");
data.set("config_schema", "generic");
assert.equal(readInternal(data), data.get("description"), "Unrelated legacy fallback remains supported");
console.log("verify-about-cta-formdata OK: shell/consumer field uniqueness and actual internal-description reader isolation");
