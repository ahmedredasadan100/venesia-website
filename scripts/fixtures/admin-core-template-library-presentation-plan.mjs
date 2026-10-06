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
 const [manifest,columns,pagination,utils,feed,featured,featuredConfig,searchOwner,deprecated]=await Promise.all([
  jiti.import(resolve(root,'src/lib/admin/interaction-system/adoption-manifest.ts')),
  jiti.import(resolve(root,'src/lib/page-blocks/admin-collection-columns.ts')),
  jiti.import(resolve(root,'src/lib/admin/entity-list/pagination.ts')),
  jiti.import(resolve(root,'src/lib/page-blocks/admin-utils.ts')),
  jiti.import(resolve(root,'src/lib/feed-modules/types.ts')),
  jiti.import(resolve(root,'src/lib/featured-modules/contract.ts')),
  jiti.import(resolve(root,'src/lib/featured-modules/config.ts')),
  jiti.import(resolve(root,'src/lib/admin/entity-list/search-normalization.ts')),
  jiti.import(resolve(root,'src/lib/page-blocks/deprecated-block-modules.ts')),
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
  // Execute only the actual selected page projection and query predicate in
  // controlled pure ports. Shared sibling table exports contribute no predicate.
  const queryDeclaration=declaration(file,'queryContract');
  const matchesProperties=walk(queryDeclaration.initializer,node=>ts.isPropertyAssignment(node)&&node.name.getText(file)==='matchesRow');assert.equal(matchesProperties.length,1);
  const matchesExpression=matchesProperties[0].initializer;assert.ok(ts.isArrowFunction(matchesExpression));
  const minimum=walk(queryDeclaration.initializer,node=>ts.isPropertyAssignment(node)&&node.name.getText(file)==='minLength');assert.equal(minimum.length,1);assert.ok(ts.isNumericLiteral(minimum[0].initializer));const searchMinLength=Number(minimum[0].initializer.text);assert.equal(searchMinLength,1,'Current one-character recipe requires the actual owner minimum.');
  function mode(name){const props=walk(page,node=>ts.isJsxAttribute(node)&&node.name.text===name);assert.ok(props.length<=1);if(props.length){assert.ok(ts.isStringLiteral(props[0].initializer));return props[0].initializer.text;}const defaults=walk(file,node=>ts.isBindingElement(node)&&node.name.getText(file)===name&&node.initializer);assert.equal(defaults.length,1);assert.ok(ts.isStringLiteral(defaults[0].initializer));return defaults[0].initializer.text;}
  const technicalIdentityMode=kind==='content'||kind==='hero'||detailField?null:mode('technicalIdentityMode'),variantFieldMode=technicalIdentityMode===null?null:mode('variantFieldMode');
  const matchesRow=Function('adminCollectionSearchIncludes','technicalIdentityMode','variantFieldMode','variantLabelByValue',transpile('const matches = '+matchesExpression.getText(file))+';return matches')(searchOwner.adminCollectionSearchIncludes,technicalIdentityMode,variantFieldMode,variantLabelByValue);
  const filterKeys=[...new Set(walk(matchesExpression,node=>ts.isPropertyAccessExpression(node)&&node.expression.getText(file)==='query.filters').map(node=>node.name.text))];
  const filterProperties=walk(queryDeclaration.initializer,node=>(ts.isPropertyAssignment(node)||ts.isShorthandPropertyAssignment(node))&&node.name.getText(file)==='filters');assert.equal(filterProperties.length,filterKeys.length?1:0);let filters={};
  if(filterProperties.length){const property=filterProperties[0],reference=ts.isShorthandPropertyAssignment(property)?property.name:property.initializer;assert.ok(ts.isIdentifier(reference));const filterDeclaration=declaration(file,reference.text);const definitions=walk(filterDeclaration.initializer,node=>ts.isObjectLiteralExpression(node)&&node.properties.some(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText(file)==='paramKey'));filters=Object.fromEntries(definitions.map(node=>{const stringProperty=name=>{const prop=node.properties.find(prop=>ts.isPropertyAssignment(prop)&&prop.name.getText(file)===name);if(!prop)return undefined;assert.ok(ts.isStringLiteral(prop.initializer));return prop.initializer.text;};return[stringProperty('paramKey'),stringProperty('defaultValue')??stringProperty('allValue')??'all'];}));assert.deepEqual(Object.keys(filters).sort(),filterKeys.sort());}

  const rowProps=walk(page,node=>ts.isJsxAttribute(node)&&['rows','heroes'].includes(node.name.text));assert.equal(rowProps.length,1);let projection=rowProps[0].initializer?.expression;assert.ok(projection);if(ts.isIdentifier(projection))projection=declaration(page,projection.text).initializer;assert.ok(projection);
  const projectSearchRows=Function('data','templates','templatesResult','isRetiredContentBlockTemplateSlug','parseFeaturedModuleConfig',transpile('const result = '+projection.getText(page))+';return result');
  const orderCalls=walk(page,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='order');for(const call of orderCalls){assert.ok(ts.isStringLiteral(call.arguments[0]));if(call.arguments[1]){assert.ok(ts.isObjectLiteralExpression(call.arguments[1]));assert.equal(call.arguments[1].properties.length,1);const property=call.arguments[1].properties[0];assert.ok(ts.isPropertyAssignment(property)&&property.name.getText(page)==='ascending'&&property.initializer.kind===ts.SyntaxKind.TrueKeyword);}}const orderKeys=orderCalls.map(node=>node.arguments[0]?.text).reverse();assert.deepEqual(orderKeys,detailField?['sort_order']:['sort_order','id']);
  const queryChain=walk(page,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='from'&&node.arguments[0]?.text===from[1]);assert.equal(queryChain.length,1);let chain=queryChain[0];const methods=[];while(ts.isPropertyAccessExpression(chain.parent)&&ts.isCallExpression(chain.parent.parent)){chain=chain.parent.parent;methods.push(chain.expression.name.text);}assert.deepEqual(methods,['select',...orderKeys.map(()=>'order')],'Additional dataset predicates/ranges require a source-specific projection.');
  const searchSourceHashes={presentation:hash(source),page:hash(pageSource),normalization:hash(readFileSync(resolve(root,'src/lib/admin/entity-list/search-normalization.ts'),'utf8')),boundedQuery:hash(readFileSync(resolve(root,'src/lib/admin/entity-list/bounded-client-pagination.ts'),'utf8')),url:hash(readFileSync(resolve(root,'src/lib/admin/entity-list/url-state.ts'),'utf8')),deprecated:hash(readFileSync(resolve(root,'src/lib/page-blocks/deprecated-block-modules.ts'),'utf8')),featuredConfig:hash(readFileSync(resolve(root,'src/lib/featured-modules/config.ts'),'utf8'))};
  const searchProjection=(rows,rawQuery)=>{assert.ok(Array.isArray(rows));const query=rawQuery.replace(/\s+/g,' ').trim();assert.ok(query===''||query.length>=searchMinLength);const ordered=[...rows].sort((a,b)=>{for(const key of orderKeys){const av=a[key],bv=b[key];const value=av==null?(bv==null?0:1):bv==null?-1:Number(av)-Number(bv);if(value)return value;}return 0;});const byId=new Map(ordered.map(row=>[Number(row.id),row]));assert.equal(byId.size,rows.length);const projected=projectSearchRows(ordered,ordered,{data:ordered},deprecated.isRetiredContentBlockTemplateSlug,featuredConfig.parseFeaturedModuleConfig).filter(row=>matchesRow(row,{search:query,filters}));const groups=[];for(const row of projected){const id=Number(row.id),original=byId.get(id);assert.ok(original&&Number.isSafeInteger(id));const key=JSON.stringify(orderKeys.map(key=>original[key]??null));if(groups.at(-1)?.key===key)groups.at(-1).ids.push(id);else groups.push({key,ids:[id]});}return groups.map(group=>group.ids);};
  specs.push({searchMinLength,searchSourceHashes,searchProjection,kind,consumer:consumer.id,route:consumer.route,table:from[1],preferenceId,viewKey,defaults,columns:config.columns,sorts,variants,detailField,detailValues,
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

/** Bounded recipes only; neither capability axes nor historical cells close here. */
export function coreTemplateSearchCases(namespace){
 assert.match(namespace,/^qa-library-presentation-[a-f0-9]{12}-[a-z-]+$/u);
 return [...['%','_','*',"'",'\\'].map((suffix,index)=>({id:'literal-'+index,query:namespace+suffix})),{id:'one-character',query:'q'},{id:'clear',query:''},{id:'namespace-restored',query:namespace}];
}
export function buildCoreTemplateSearchProjection(spec,rows,namespace){return{mode:'bounded-client',minLength:spec.searchMinLength,sourceHashes:spec.searchSourceHashes,cases:coreTemplateSearchCases(namespace).map(item=>({...item,groups:spec.searchProjection(rows,item.query)}))};}
export function assertCoreTemplateSearchIds(groups,ids,{offset=0,count=groups.flat().length}={}){
 assert.ok(Array.isArray(groups)&&groups.every(group=>Array.isArray(group)&&group.length));const expected=groups.flat();assert.equal(new Set(expected).size,expected.length);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,count);assert.ok(offset>=0&&offset+count<=expected.length);
 let cursor=0;for(const group of groups){const start=Math.max(offset,cursor),end=Math.min(offset+count,cursor+group.length);if(start<end){const actual=ids.slice(start-offset,end-offset);assert.ok(actual.every(id=>group.includes(id)),'Current declared order groups must be retained.');}cursor+=group.length;}
 if(offset===0&&count===expected.length)assert.deepEqual([...ids].sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b));
}
export function assertCoreTemplateSearchObservation(spec,nativeSearch,observation,binding){
 assert.ok(observation);assert.equal(nativeSearch.mode,'bounded-client');assert.equal(nativeSearch.minLength,spec.searchMinLength);assert.deepEqual(nativeSearch.sourceHashes,spec.searchSourceHashes);assert.deepEqual(observation.sourceHashes,nativeSearch.sourceHashes);
 assert.deepEqual(observation.binding,binding);assert.equal(observation.minLength,nativeSearch.minLength);assert.equal(observation.mode,nativeSearch.mode);assert.deepEqual(observation.automaticCoverage,[]);assert.equal(observation.globalClosed,false);assert.equal(observation.posts,0);
 assert.deepEqual(observation.cases.map(row=>row.id),nativeSearch.cases.map(row=>row.id));
 for(const [index,expected]of nativeSearch.cases.entries()){const actual=observation.cases[index];assert.equal(actual.query,expected.query);assert.equal(actual.inputValue,expected.query);assert.equal(actual.clearClicked,expected.id==='clear');assert.equal(actual.enterPressed,expected.id!=='clear');assert.equal(actual.limit,Math.max(...spec.pageSizeOptions));assert.equal(actual.firstPageParam,null);assert.equal(actual.queryParam,expected.query||null);assert.deepEqual(actual.unrelatedParams,[]);assert.equal(actual.pages.length,Math.max(1,Math.ceil(expected.groups.flat().length/actual.limit)));for(const [page,ids]of actual.pages.entries())assertCoreTemplateSearchIds(expected.groups,ids,{offset:page*actual.limit,count:Math.min(actual.limit,expected.groups.flat().length-page*actual.limit)});assertCoreTemplateSearchIds(expected.groups,actual.pages.flat());}
}

/** Retry only the existing Cards presentation body; the nine-library default stays intact. */
export const CORE_TEMPLATE_CARDS_SELECTION='template-cards-presentation';
export function selectCoreTemplatePresentationPlan(plan,selection){
 if(selection===null||selection===undefined)return plan;
 assert.equal(selection,CORE_TEMPLATE_CARDS_SELECTION);assert.ok(Array.isArray(plan));assert.equal(new Set(plan.map(row=>row.kind)).size,plan.length);
 const selected=plan.filter(row=>row.kind==='cards');assert.equal(selected.length,1);assert.equal(selected[0].consumer,'cards-template-library');return selected;
}
export function assertCoreTemplateCardsSelectionReceipt(browser,plan,canonicalRequiredCases){
 assert.equal(browser.scope,'core-closure');assert.equal(browser.cohort,'template-libraries');assert.equal(browser.journeySelection,CORE_TEMPLATE_CARDS_SELECTION);
 assert.equal(browser.status,'pass');assert.equal(browser.driverCompleted,true);assert.equal(browser.inventoryOnly,false);assert.deepEqual(browser.errors,[]);assert.equal(browser.wholeCohortExecuted,false);assert.equal(browser.globalClosed,false);
 const identities=rows=>{assert.ok(Array.isArray(rows)&&rows.length>0);assert.ok(rows.every(row=>typeof row.key==='string'&&row.key));assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);return rows.map(row=>{const value={...row};delete value.status;delete value.evidence;return value;}).sort((a,b)=>a.key.localeCompare(b.key));};
 assert.deepEqual(identities(browser.requiredCases),identities(canonicalRequiredCases));assert.ok(browser.requiredCases.every(row=>row.status==='open'&&row.evidence===null));
 const ids=selectCoreTemplatePresentationPlan(plan,CORE_TEMPLATE_CARDS_SELECTION).map(row=>'core-template-presentation-'+row.kind);
 assert.deepEqual(browser.selectedJourneyIds,ids);assert.deepEqual(browser.executedJourneyIds,ids);assert.deepEqual(browser.evidence.map(row=>row.id),['existing-auth-login',...ids]);assert.ok(browser.evidence.every(row=>row.status==='pass'&&Array.isArray(row.coverage)&&row.coverage.length===0));
 const login=browser.evidence[0];assert.equal(login.authenticated,true);assert.equal(login.sessionArtifactWritten,false);assert.match(login.dashboardState,/^Dashboard (?:جاهزة|جزئية|غير متاحة)$/u);
 const row=browser.evidence[1];assert.equal(row.moduleKind,'cards');assert.equal(row.consumer,'cards-template-library');assert.equal(row.nativeCheckpointIds.length,4);assert.equal(new Set(row.nativeCheckpointIds).size,4);assert.deepEqual(row.automaticCoverage,[]);assert.equal(row.globalClosed,false);
 assert.deepEqual(browser.databaseReadback,[]);assert.deepEqual(browser.readOnlyReadback,[]);assert.deepEqual(browser.menuIntegrityReadback,[]);
 return{selection:CORE_TEMPLATE_CARDS_SELECTION,selectedJourneyIds:ids,executedJourneyIds:[...ids],wholeCohortExecuted:false,automaticCoverage:[],globalClosed:false};
}
