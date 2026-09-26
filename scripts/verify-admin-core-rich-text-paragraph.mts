import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createJiti } from "jiti";
import ts from "typescript";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TrailingNode } from "@tiptap/extensions";
import { EditorState } from "@tiptap/pm/state";
import { setBlockType } from "@tiptap/pm/commands";
import { assertCorePlainParagraphSnapshot } from "./fixtures/admin-core-domain-form-journeys.mjs";
const root=resolve(import.meta.dirname,".."),jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false});
const {richTextHtmlToMarkdown}=await jiti.import<typeof import("../src/lib/rich-text/html-utils.ts")>(resolve(root,"src/lib/rich-text/html-utils.ts"));
const ownerFile=resolve(root,"src/components/admin/AdminRichTextEditor.tsx"),source=readFileSync(ownerFile,"utf8"),tree=ts.createSourceFile(ownerFile,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let expression:ts.Expression|undefined;function visit(node:ts.Node){if(ts.isPropertyAssignment(node)&&node.name.getText(tree)==="extensions")expression=node.initializer;ts.forEachChild(node,visit);}visit(tree);assert.ok(expression);
// Evaluate the actual installed owner's extension expression with its current Article settings.
const extensions=new Function("StarterKit","Underline","Link","TextAlign","Placeholder","enableArticleStructure","isMinimal","withTextAlign","placeholder","return "+expression.getText(tree))(StarterKit,Underline,Link,TextAlign,Placeholder,true,false,true,"QA");
const schema=getSchema(extensions),pluginFactory=TrailingNode.config.addProseMirrorPlugins;assert.ok(pluginFactory);
const plugins=pluginFactory.call({name:TrailingNode.name,options:TrailingNode.options,editor:{schema}} as never);
const body="Authored core paragraph.",heading=schema.node("heading",{level:2},schema.text("Authored core paragraph"));
let state=EditorState.create({schema,doc:schema.node("doc",null,[heading]),plugins});
state=state.applyTransaction(state.tr.insertText(".",heading.nodeSize-1)).state;
assert.equal(state.doc.childCount,2);assert.equal(state.doc.lastChild?.type.name,"paragraph");assert.equal(state.doc.lastChild?.textContent,"");
assert.equal(setBlockType(schema.nodes.paragraph)(state,tr=>{state=state.applyTransaction(tr).state;}),true);
const paragraphs:string[]=[];state.doc.forEach(node=>{assert.equal(node.type.name,"paragraph");paragraphs.push(node.textContent);});
assert.deepEqual(paragraphs,[body,""]);
const escaped=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const snapshot={paragraphs,headings:0,html:paragraphs.map(text=>"<p>"+escaped(text)+"</p>").join(""),markdown:body};
const cases:string[]=[],test=(name:string,run:()=>unknown)=>{run();cases.push(name);};
test("Real installed StarterKit trailing-node transaction survives conversion as a legitimate empty paragraph",()=>assertCorePlainParagraphSnapshot(snapshot,body,richTextHtmlToMarkdown));
test("A single paragraph remains accepted when no cursor node is present",()=>assertCorePlainParagraphSnapshot({...snapshot,paragraphs:[body],html:"<p>"+body+"</p>"},body,richTextHtmlToMarkdown));
test("Empty trailing cursor br or whitespace does not author extra Markdown",()=>assertCorePlainParagraphSnapshot({...snapshot,paragraphs:[body," ",""],html:"<p>"+body+"</p><p> </p><p><br></p>"},body,richTextHtmlToMarkdown));
for(const [name,change]of[
 ["extra authored paragraph",{paragraphs:[body,"Hidden extra body"],html:"<p>"+body+"</p><p>Hidden extra body</p>"}],
 ["duplicate authored paragraph",{paragraphs:[body,body],html:"<p>"+body+"</p><p>"+body+"</p>"}],
 ["changed authored paragraph",{paragraphs:["Different body",""]}],
 ["missing authored paragraph",{paragraphs:[""]}],
 ["remaining heading",{headings:1,html:"<h2>"+body+"</h2><p></p>"}],
 ["extra authored list outside paragraph query",{html:snapshot.html+"<ul><li>Additional</li></ul>"}],
 ["formatting changes canonical Markdown",{html:"<p><strong>"+body+"</strong></p><p></p>"}],
 ["link changes canonical Markdown",{html:'<p><a href="/topics/other">'+body+"</a></p><p></p>"}],
 ["misaligned canonical projection",{html:'<p style="text-align: center">'+body+"</p><p></p>"}],
 ["stale submitted value despite correct editor DOM",{markdown:"stale"}],
 ["extra authored text despite correct submitted value",{html:snapshot.html+"Different body"}],
] as const)test("Reject "+name,()=>assert.throws(()=>assertCorePlainParagraphSnapshot({...snapshot,...change},body,richTextHtmlToMarkdown)));
const driver=readFileSync(resolve(root,"scripts/fixtures/admin-core-domain-form-journeys.mjs"),"utf8");
test("Driver retains exact create, reload and native persisted Markdown invariants",()=>{assert.match(driver,/await expect\(control\(form, "content"\)\)\.toHaveValue\(body\)/u);assert.match(driver,/richTextHtmlToMarkdown\(await editor\.innerHTML\(\)\)/u);assert.match(driver,/await reloadValues\(createFields, "basic"\)/u);assert.ok(driver.split('...(markdown ? { content: body } : {})').length>=4);assert.doesNotMatch(driver,/editor\.locator\("p"\)\.first\(/u);assert.match(driver,/querySelectorAll\("h1,h2,h3,h4,h5,h6"\)/u);});
test("Actual owner uses default trailing node, paragraph command and canonical Markdown serialization",()=>{assert.match(source,/StarterKit\.configure\(/u);assert.doesNotMatch(expression!.getText(tree),/trailingNode:\s*false/u);assert.match(source,/setParagraph\(\)\.run\(\)/u);assert.match(source,/richTextHtmlToMarkdown\(nextHtml\)/u);});
console.log(JSON.stringify({status:"pass",controls:cases.length,cases,installedEditorTransactionExecuted:true,applicationBrowserExecuted:false,productChanges:false}));
