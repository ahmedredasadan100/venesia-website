import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createJiti} from "jiti";
import ts from "typescript";
export const PRESENTATION_CONTROL_KINDS=Object.freeze(["hero","content"]);
export const PRESENTATION_CONTROL_PHASES=Object.freeze(["baseline","draft","negative","serverRejected","saved","reloaded"]);
export const PRESENTATION_CONTROL_TABLES=Object.freeze({hero:"hero_templates",content:"content_block_templates"});
export const PRESENTATION_CONTROL_ASSETS=Object.freeze(["images/projects/c35/hero.jpg","images/projects/c35/cover.jpg","images/projects/c35/location-map.jpg"]);
export const PRESENTATION_CONTROL_VALUES=Object.freeze({eyebrow:"تمهيد مخصص للتحقق",title:"عنوان محفوظ من التحكم الحالي",highlight:"نص مميز محفوظ",subtitle:"عنوان فرعي محفوظ",description:"وصف محفوظ بالتنسيق الحالي",body:"نص المحتوى العام المحفوظ",primary:"افتح الوجهة الأولى",secondary:"وجهة ثانوية ممسوحة",hrefs:["https://example.invalid/first-control","https://example.invalid/saved-control"],format:{eyebrow:{visible:false,bold:true,alignment:"left"},title:{visible:true,bold:false,alignment:"center"},highlight:{visible:true,bold:true,alignment:"right"},subtitle:{visible:false,bold:true,alignment:"left"},description:{visible:true,bold:true,alignment:"center"},cta:{visible:true,bold:true,alignment:"center"}}});
export function buildCorePresentationControlsPlan({manifest,fixtures}){
 assert.ok(Array.isArray(fixtures.templates));assert.equal(fixtures.templates.length,2);
 const recipes=PRESENTATION_CONTROL_KINDS.map(kind=>{const owners=manifest.filter(row=>row.registryModuleKind===kind);assert.equal(owners.length,1);const surface=kind+":template-edit";assert.ok(owners[0].surfaces.includes(surface));const rows=fixtures.templates.filter(row=>row.kind===kind);assert.equal(rows.length,1);const row=rows[0];assert.ok(Number.isSafeInteger(row.id)&&row.id>0);assert.equal(row.slug,"qa-admin-page-interaction-"+kind+"-8");assert.equal(row.editPath,"/admin/pages-blocks/blocks/"+kind+"/"+row.id);return{...row,consumer:owners[0].id,surface,coverage:[]};});
 assert.deepEqual(fixtures.assets.map(row=>row.objectKey),PRESENTATION_CONTROL_ASSETS);fixtures.assets.forEach(row=>assert.equal(row.publicUrl,"/"+row.objectKey));return{recipes,automaticAxisCoverage:[],globalClosed:false,nonCapabilities:["Generic Content has no media/buttons/preset UI; hidden variant/style_preset are not edited.","Current internal-page Hero has no order tab; no other variant branch is adopted.","Unused Hero has no assigned public measurement path; no public rendering/fallback-size claim."]};
}
export function validatePresentationControlsRequest(input){assert.ok(input&&typeof input==="object"&&!Array.isArray(input));assert.deepEqual(Object.keys(input).sort(),["id","kind","phase","recipe"]);assert.match(input.id,/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu);assert.equal(input.kind,"presentation-controls-state");assert.ok(PRESENTATION_CONTROL_KINDS.includes(input.recipe));assert.ok(PRESENTATION_CONTROL_PHASES.includes(input.phase));return input;}
export function presentationControlForm(kind,fixtures){
 assert.ok(PRESENTATION_CONTROL_KINDS.includes(kind));const v=PRESENTATION_CONTROL_VALUES,form=new FormData();
 for(const name of kind==="hero"?["eyebrow","title","highlight","subtitle","description"]:["eyebrow","title","subtitle","body"])form.set(name,v[name]);
 for(const name of kind==="hero"?["eyebrow","title","highlight","subtitle","description","cta"]:["eyebrow","title","subtitle","description"]){const value=v.format[name];form.set("show_"+name,String(value.visible));form.set(name+"_bold",String(value.bold));form.set(name+"_alignment",value.alignment);}
 if(kind==="hero"){
  form.set("variant","internal-page");form.set("image_composition","cover-upper");form.set("images",[fixtures.assets[1].publicUrl,fixtures.assets[2].publicUrl].join("\n"));form.set("mobile_images","");form.set("primary_cta_label",v.primary);form.set("primary_cta_link_kind","external");form.set("primary_cta_link_href",v.hrefs[1]);form.set("primary_cta_link_target","_self");form.set("secondary_cta_label","");form.set("secondary_cta_link_kind","none");
 }
 return form;
}
/** Extract only reviewed pure declarations; never import or invoke Server Actions. */
export async function loadPresentationControlBuilders(root=resolve(import.meta.dirname,"../..")){
 const jiti=createJiti(import.meta.url,{fsCache:false,moduleCache:false,alias:{"server-only":resolve(root,"node_modules/next/dist/compiled/server-only/empty.js")}});
 const configs=await jiti.import(resolve(root,"src/lib/page-blocks/configs.ts")),utils=await jiti.import(resolve(root,"src/lib/page-blocks/admin-utils.ts")),hero=await jiti.import(resolve(root,"src/lib/hero/hero-content-controls.ts")),rich=await jiti.import(resolve(root,"src/lib/rich-text/html-utils.ts")),links=await jiti.import(resolve(root,"src/lib/admin/links/form-fields.ts")),serialized=await jiti.import(resolve(root,"src/lib/admin/links/serialize.ts")),validated=await jiti.import(resolve(root,"src/lib/admin/links/validate.ts"));
 const extract=(kind,names,deps,result)=>{const file=resolve(root,"src/app/admin/pages-blocks/blocks",kind,"actions.ts"),source=readFileSync(file,"utf8"),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const declarations=names.map(name=>{const nodes=tree.statements.filter(node=>(ts.isFunctionDeclaration(node)&&node.name?.text===name)||(ts.isVariableStatement(node)&&node.declarationList.declarations.some(decl=>decl.name.getText(tree)===name)));assert.equal(nodes.length,1);return nodes[0].getText(tree);}).join("\n");const code=ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function(...Object.keys(deps),code+"\nreturn "+result+";")(...Object.values(deps));};
 const heroBuilder=extract("hero",["cleanText","splitImages","buildHeroConfig"],{...hero,normalizeRichTextContent:rich.normalizeRichTextContent,parseAdminLinkFromFormData:links.parseAdminLinkFromFormData,serializeAdminLink:serialized.serializeAdminLink,isAdminLinkEmpty:validated.isAdminLinkEmpty},"buildHeroConfig");
 const contentBuilder=extract("content",["buildGenericContentConfig","CONTENT_FORMATTING_FIELDS","mergeSubmittedContentFormatting"],{cleanText:utils.cleanText,buildPageBlockTextFormattingPatch:configs.buildPageBlockTextFormattingPatch},"form=>mergeSubmittedContentFormatting(form,buildGenericContentConfig(form))");
 return{build:(kind,form)=>{assert.ok(PRESENTATION_CONTROL_KINDS.includes(kind));return JSON.parse(JSON.stringify(kind==="hero"?heroBuilder(form,"internal-page"):contentBuilder(form)));},configs,hero};
}
export function assertPresentationControlsConfig(kind,config,fixtures){
 const v=PRESENTATION_CONTROL_VALUES;for(const name of kind==="hero"?["eyebrow","title","highlight","subtitle"]:["eyebrow","title","subtitle","body"])assert.equal(config[name],v[name]);
 const fields=kind==="hero"?["eyebrow","title","highlight","subtitle","description","cta"]:["eyebrow","title","subtitle","description"];
 for(const field of fields){const upper=field[0].toUpperCase()+field.slice(1),expected=v.format[field];assert.equal(config["show"+upper],expected.visible);assert.equal(config[field+"Bold"],expected.bold);assert.equal(config[field+"Alignment"],expected.alignment);}
 if(kind==="hero"){assert.equal(config.description,"<p>"+v.description+"</p>");assert.deepEqual(config.images,[fixtures.assets[1].publicUrl,fixtures.assets[2].publicUrl]);assert.deepEqual(config.mobileImages,[]);assert.equal(config.imageComposition,"cover-upper");assert.equal(config.primaryCtaLabel,v.primary);assert.equal(config.primaryCtaLink.link_kind,"external");assert.equal(config.primaryCtaLink.href,v.hrefs[1]);assert.equal(config.primaryCtaLink.target,"_self");assert.equal(config.secondaryCtaLabel,"");assert.equal(config.secondaryCtaLink,null);}
}

/** Exact current Action normalization; every other physical column is preserved. */
export function assertPresentationControlsRow(kind,current,original,expectedConfig){
 assert.ok(PRESENTATION_CONTROL_KINDS.includes(kind));assert.ok(typeof current.updated_at==="string"||current.updated_at instanceof Date);assert.ok(Number.isFinite(new Date(current.updated_at).valueOf()));
 const expected={...original,config:expectedConfig,updated_at:current.updated_at};
 if(kind==="hero")Object.assign(expected,{description:original.description||null,variant:"internal-page",style_preset:original.style_preset||"cinematic-gold",source_type:"manual",source_id:null,source_slug:null,limit_count:1,is_visible:original.status==="published"});
 else Object.assign(expected,{description:original.description||null,variant:original.variant||"default",style_preset:original.style_preset||"premium-dark"});
 assert.deepEqual(current,expected,"Actual Action canonical normalization must be exact; no unrestricted metadata exclusions.");
}
