import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createJiti } from 'jiti';
import ts from 'typescript';

const hash = text => createHash('sha256').update(text).digest('hex');
function walk(node, predicate) { const found=[]; function visit(current){if(predicate(current))found.push(current);ts.forEachChild(current,visit);} visit(node);return found; }
const transpile = text => ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function declaration(file,name){const matches=walk(file,node=>ts.isVariableDeclaration(node)&&node.name.getText(file)===name);assert.equal(matches.length,1,`Expected current source declaration ${name}`);return matches[0];}
function literalVariants(page){const prop=walk(page,node=>ts.isJsxAttribute(node)&&node.name.text==='variantOptions');assert.equal(prop.length,1);const expression=prop[0].initializer?.expression;assert.ok(ts.isArrayLiteralExpression(expression));return Function('return ('+transpile('const value = '+expression.getText(page)).replace(/^const value = /,'').replace(/;\s*$/,'')+')')();}

/** Verification recipes derived from the current canonical columns, source
 * sort accessors and rendered header bindings. No capability registry is added. */
export async function loadCoreTemplatePresentationPlan(root=process.cwd()){
 const jiti=createJiti(resolve(root,'package.json'),{fsCache:false,moduleCache:false});
 const [manifest,columns,pagination,utils,feed,featured,featuredConfig]=await Promise.all([
  jiti.import(resolve(root,'src/lib/admin/interaction-system/adoption-manifest.ts')),
  jiti.import(resolve(root,'src/lib/page-blocks/admin-collection-columns.ts')),
  jiti.import(resolve(root,'src/lib/admin/entity-list/pagination.ts')),
  jiti.import(resolve(root,'src/lib/page-blocks/admin-utils.ts')),
  jiti.import(resolve(root,'src/lib/feed-modules/types.ts')),
  jiti.import(resolve(root,'src/lib/featured-modules/contract.ts')),
  jiti.import(resolve(root,'src/lib/featured-modules/config.ts')),
 ]);
 const surface=manifest.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(row=>row.id==='block-template-libraries');assert.ok(surface);
 const comparatorSource=readFileSync(resolve(root,'src/components/admin/table-engine/useAdminTable.ts'),'utf8');
 const comparatorFile=ts.createSourceFile('table.ts',comparatorSource,ts.ScriptTarget.Latest,true);
 const comparator=walk(comparatorFile,node=>ts.isFunctionDeclaration(node)&&node.name?.text==='compareValues');assert.equal(comparator.length,1);
 const compare=Function(transpile(comparator[0].getText(comparatorFile))+';return compareValues')();
 const specs=[];
 for(const consumer of surface.consumerAdoptionEvidence){
  const kind=consumer.id.replace(/-template-library$/,''),viewKey='page-composition:'+kind+'-templates';
  const entries=Object.entries(columns.PAGE_COMPOSITION_COLUMN_PREFERENCES).filter(([,value])=>value.viewKey===viewKey);assert.equal(entries.length,1);
  const [preferenceId,config]=entries[0];assert.ok(config.consumerSourceFiles.includes(consumer.presentationOwner));assert.equal(config.boundedClientPagination,true);
  const source=readFileSync(resolve(root,consumer.presentationOwner),'utf8'),file=ts.createSourceFile(consumer.presentationOwner,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const pagePath='src/app/admin/pages-blocks/blocks/'+kind+'/page.tsx',pageSource=readFileSync(resolve(root,pagePath),'utf8'),page=ts.createSourceFile(pagePath,pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const accessorsDeclaration=declaration(file,'sortAccessors');const objects=walk(accessorsDeclaration.initializer,node=>ts.isObjectLiteralExpression(node));assert.equal(objects.length,1);
  let variants=[];
  if(kind==='content'){const options=declaration(file,'VARIANT_OPTIONS').initializer;variants=Function('return '+transpile('const value = '+options.getText(file)).replace(/^const value = /,'').replace(/;\s*$/,''))();}
  else if(['cards','cta','breadcrumb'].includes(kind))variants=literalVariants(page);
  else if(kind==='feed')variants=feed.TOPICS_FEED_TYPES.map(value=>[value,feed.TOPICS_FEED_TYPE_LABELS_AR[value]]);
  else if(kind==='featured')variants=featured.FEATURED_EDITOR_PRESENTATION_VARIANTS.map(value=>[value,featured.FEATURED_PRESENTATION_LABELS_AR[value]]);
  const variantLabelByValue=new Map(variants),variantLabel=value=>variantLabelByValue.get(value)??value;
  const accessors=Function('statusMeta','variantLabelByValue','variantLabel',transpile('const accessors = '+objects[0].getText(file))+';return accessors')(utils.statusMeta,variantLabelByValue,variantLabel);
  const labels=new Map();
  for(const jsx of walk(file,node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(file)==='AdminDataGridSortLabel')){
   const keys=walk(jsx.openingElement,node=>ts.isCallExpression(node)&&(/(?:toggleSort|sortProps)$/.test(node.expression.getText(file)))).map(node=>node.arguments[0]?.text);assert.equal(new Set(keys).size,1);const key=keys[0];assert.ok(key&&Object.hasOwn(accessors,key));
   let label=jsx.children.filter(ts.isJsxText).map(node=>node.text.trim()).join('').trim();
   if(!label){const detail=walk(page,node=>ts.isJsxAttribute(node)&&node.name.text==='detailLabel');assert.equal(detail.length,1);label=detail[0].initializer.text;}
   assert.ok(label&&!labels.has(key));labels.set(key,label);
  }
  const alias=key=>key==='updatedAt'?'updated_at':key;
  const sorts=config.columns.filter(column=>column.defaultVisible&&Object.hasOwn(accessors,alias(column.key))).map(column=>({key:alias(column.key),columnKey:column.key,label:labels.get(alias(column.key))}));
  assert.ok(sorts.length>1&&sorts.every(row=>row.label));assert.deepEqual([...labels.keys()].filter(key=>config.columns.some(column=>alias(column.key)===key)).sort(),sorts.map(row=>row.key).sort());
  const from=pageSource.match(/\.from\("([a-z_]+)"\)/);assert.ok(from);assert.match(pageSource,/\.order\("sort_order"/);assert.match(source,/copyPublicLink:\s*hidden/);
  const defaults=config.columns.filter(column=>column.defaultVisible&&column.hideable).map(column=>column.key);assert.ok(defaults.includes('status'));
  const detailField=kind==='media-hub'?'section_key':kind==='media-sidebar'?'widget_key':null;
  let detailValues=[];
  if(detailField){const migration=kind==='media-hub'?'20250625300000_media_hub_modules.sql':'20250625200000_media_sidebar_modules.sql';const sql=readFileSync(resolve(root,'sql/migrations/'+migration),'utf8'),match=sql.match(new RegExp('check \\('+detailField+' in \\(([^)]*)\\)'));assert.ok(match);detailValues=[...match[1].matchAll(/'([^']+)'/g)].map(value=>value[1]);assert.ok(detailValues.length>1);}
  const project=row=>({...row,...(kind==='feed'?{variant:row.feed_type}:{}),...(kind==='featured'?{variant:featuredConfig.parseFeaturedModuleConfig(row.config).presentation.variant}:{}),...(detailField?{detail:row[detailField]}:{})});
  specs.push({kind,consumer:consumer.id,route:consumer.route,table:from[1],preferenceId,viewKey,defaults,columns:config.columns,sorts,variants,detailField,detailValues,
   pageSize:Number(pagination.ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE),pageSizeOptions:pagination.ADMIN_ENTITY_LIST_PAGE_SIZE_OPTIONS.map(Number),rowCount:2*Number(pagination.ADMIN_ENTITY_LIST_DEFAULT_PAGE_SIZE)+3,
   sourceHashes:{presentation:hash(source),page:hash(pageSource),sortOwner:hash(comparatorSource)},project,
   expectedIds(rows,key=null,direction='asc'){assert.ok(key===null||sorts.some(sort=>sort.key===key));assert.ok(['asc','desc'].includes(direction));const projected=rows.map(project);return(key===null?projected:[...projected].sort((a,b)=>{const value=compare(accessors[key](a),accessors[key](b));return direction==='asc'?value:-value;})).map(row=>Number(row.id));},
   sortValue(row,key){assert.ok(sorts.some(sort=>sort.key===key));return accessors[key](project(row));},statusLabel:utils.statusMeta,
  });
 }
 assert.equal(new Set(specs.map(row=>row.table)).size,specs.length);return specs;
}

export function assertCoreTemplatePresentationProjection(spec,rows,observation){
 assert.equal(rows.length,spec.rowCount);assert.equal(new Set(rows.map(row=>Number(row.id))).size,rows.length);
 assert.deepEqual(observation.sorts.map(row=>row.key),spec.sorts.map(row=>row.key),'No currently declared visible sort may be omitted or duplicated.');
 for(const sort of observation.sorts){assert.ok(new Set(rows.map(row=>String(spec.sortValue(row,sort.key)))).size>1,'The real fixture must distinguish this sort.');assert.deepEqual(sort.ascending,spec.expectedIds(rows,sort.key,'asc'));assert.deepEqual(sort.descending,spec.expectedIds(rows,sort.key,'desc'));assert.deepEqual(sort.reset,spec.expectedIds(rows));}
 assert.deepEqual(observation.pages.flat(),spec.expectedIds(rows));assert.equal(new Set(observation.pages.flat()).size,rows.length);assert.equal(observation.pages.length,Math.ceil(rows.length/spec.pageSize));
}
