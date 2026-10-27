import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createJiti } from 'jiti';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';

// Bounded extension of qa-home-story-presentation. Real shared owners and
// consumers render unchanged. Only external read/action ports are controlled.
export async function verifyCinematicAdminPresentation(options = {}) {
  const root = process.cwd(), require = createRequire(import.meta.url);
  const moduleTitleShimmerBefore = options.moduleTitleShimmerBefore === true || process.argv.includes('--cinematic-module-title-shimmer-before');
  const moduleTitleShimmerOnly = options.moduleTitleShimmerOnly === true || process.argv.includes('--cinematic-module-title-shimmer-only') || moduleTitleShimmerBefore;
  const kpiAdoptionOnly = options.kpiAdoptionOnly === true || process.argv.includes('--cinematic-kpi-adoption-only');
  const systemwideAdoptionOnly = options.systemwideAdoptionOnly === true || process.argv.includes('--cinematic-systemwide-adoption-only') || kpiAdoptionOnly || moduleTitleShimmerOnly;
  const sidebarSelectionOnly = options.sidebarSelectionOnly === true || process.argv.includes('--cinematic-sidebar-selection-only');
  const finalAlignmentOnly = process.argv.includes('--cinematic-final-alignment-only');
  const dataGridRefinementOnly = process.argv.includes('--cinematic-datagrid-v11-only');
  const dataGridOnly = process.argv.includes('--cinematic-datagrid-only') || dataGridRefinementOnly || finalAlignmentOnly || sidebarSelectionOnly || systemwideAdoptionOnly;
  const refinementOnly = process.argv.includes('--cinematic-v11-only');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { topicsQueryContract } = await jiti.import(path.join(root, 'src/lib/admin/content/entity-list-contracts/topics.ts'));
  const { normalizeAdminEntityListQuery } = await jiti.import(path.join(root, 'src/lib/admin/entity-list/data-engine/contracts.ts'));
  const { ADMIN_COMPANY_DEFAULT } = await jiti.import(path.join(root, 'src/config/admin/company.ts'));
  const output = path.join(root, '.tmp-qa/admin-development-batch-01', moduleTitleShimmerOnly ? 'module-title-shimmer-20261024/' + (moduleTitleShimmerBefore ? 'before-fixture' : 'fixture') : kpiAdoptionOnly ? 'kpi-default-adoption-20261024/fixture' : systemwideAdoptionOnly ? 'systemwide-adoption-20261024/fixture' : sidebarSelectionOnly ? 'sidebar-selection-20261024/after' : finalAlignmentOnly ? 'cinematic-final-alignment-20261024' : dataGridRefinementOnly ? 'cinematic-datagrid-v11-20261024' : dataGridOnly ? 'cinematic-datagrid-v1-20261024' : 'cinematic-gold-v11-20261024');
  await mkdir(output, { recursive: true });
  const project = root.replaceAll('\\', '/');
  const frozenTitleOwners = new Set(['src/components/admin/ui/AdminPageContextHeader.tsx', 'src/lib/admin/admin-ui-styles.ts', 'src/app/globals.css']);
  const sourcePath = file => path.join(root, moduleTitleShimmerBefore && frozenTitleOwners.has(file) ? '.tmp-qa/admin-development-batch-01/module-title-shimmer-20261024/before/' + file : file);
  const read = file => readFile(sourcePath(file), 'utf8');
  const sourceFiles = new Map();
  for (const file of ['scripts/qa-home-story-presentation.mjs', 'scripts/fixtures/cinematic-admin-browser.mjs', 'package.json', 'package-lock.json', 'postcss.config.mjs', 'src/app/api/admin/entity-lists/[entity]/route.ts']) sourceFiles.set(file, await read(file));
  for (const weight of [300, 400, 500, 600, 700]) { const file = `src/assets/fonts/ibm-plex-sans-arabic-${weight}.woff2`; sourceFiles.set(file, await readFile(path.join(root, file))); }
  sourceFiles.set('src/assets/fonts/inter-variable.woff2', await readFile(path.join(root, 'src/assets/fonts/inter-variable.woff2')));
  const pagePath = 'src/app/admin/content/topics/page.tsx', pageSource = await read(pagePath);
  sourceFiles.set(pagePath, pageSource);
  const ast = ts.createSourceFile(pagePath, pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const headers = [], notices = [];
  function visit(node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) && (ts.isJsxSelfClosingElement(node) ? node.tagName : node.openingElement.tagName).getText(ast) === 'AdminPageContextHeader') headers.push(node.getText(ast));
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'AdminNotice') notices.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(headers.length, 1, 'One actual Topics route Module Header'); assert.equal(notices.length, 1, 'One actual Topics route load failure Notice');
  const familyHeaders = {};
  if (moduleTitleShimmerOnly) for (const family of ['categories', 'series']) {
    const file = `src/app/admin/content/${family}/page.tsx`, source = await read(file), tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), nodes = [];
    sourceFiles.set(file, source);
    const find = node => { const opening = ts.isJsxSelfClosingElement(node) ? node : ts.isJsxElement(node) ? node.openingElement : null; if (opening?.tagName.getText(tree) === 'AdminPageContextHeader' && opening.attributes.properties.some(item => ts.isJsxAttribute(item) && item.name.getText(tree) === 'actions')) nodes.push(node.getText(tree)); ts.forEachChild(node, find); }; find(tree); assert.equal(nodes.length, 1, 'One actual ready-state family route Header with its existing actions: ' + family); familyHeaders[family] = nodes[0];
  }
  const actionPath = 'src/app/admin/content/topics/actions.ts';
  const actionSource = await read(actionPath); sourceFiles.set(actionPath, actionSource);
  const actionAst = ts.createSourceFile(actionPath, actionSource, ts.ScriptTarget.Latest, true);
  const actionNames = actionAst.statements.filter(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)).map(node => node.name?.text).filter(Boolean);
  const deniedActionModules = new Map();
  if (systemwideAdoptionOnly) for (const file of ['src/app/admin/content/categories/actions.ts', ...(moduleTitleShimmerOnly ? ['src/app/admin/content/series/actions.ts'] : []), 'src/app/admin/projects/actions.ts', 'src/app/admin/projects/locations/actions.ts', 'src/app/admin/projects/locations/column-preferences.ts', 'src/app/admin/pages-blocks/blocks/content/actions.ts', 'src/app/admin/pages-blocks/column-preferences.ts']) {
    const source = await read(file); sourceFiles.set(file, source); const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const names = tree.statements.flatMap(node => ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.filter(item => !node.isTypeOnly && !item.isTypeOnly).map(item => item.name.text) : ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ? [node.name?.text] : []).filter(Boolean);
    assert.ok(names.length, 'Explicit external Action port exports discovered: ' + file);
    deniedActionModules.set(path.resolve(root, file).replace(/\.ts$/u, ''), names.map(name => `export async function ${name}(){window.fixtureEvents.push({kind:'denied-action',name:${JSON.stringify(name)}});throw Error('No hosted Action allowed in systemwide presentation proof');}`).join('\n'));
  }
  if (moduleTitleShimmerOnly) for (const file of ['src/lib/admin/auth/require-admin-session.ts', 'src/lib/admin/projects/tracking-hub.ts']) sourceFiles.set(file, await read(file));
  const entry = `import React from 'react';import{createRoot}from'react-dom/client';
import AuthenticatedLayout from '${project}/src/components/admin/AdminAuthenticatedLayout.tsx';
import Dashboard from '${project}/src/components/admin/dashboard/AdminDashboardView.tsx';
import Topics from '${project}/src/components/admin/content/TopicsListClient.tsx';
import Loading from '${project}/src/app/admin/loading.tsx';
import Header from '${project}/src/components/admin/ui/AdminPageContextHeader.tsx';
import Card from '${project}/src/components/admin/ui/AdminMetricCard.tsx';
import MetricGrid from '${project}/src/components/admin/ui/AdminMetricCardsGrid.tsx';
import AdminEntityList from '${project}/src/components/admin/entity-list/AdminEntityList.tsx';
import{AdminEntityListTableRegion}from'${project}/src/components/admin/entity-list/AdminEntityListSurface.tsx';
import AdminTablePagination from '${project}/src/components/admin/ui/AdminTablePagination.tsx';
import{TopicFormDraftRecovery}from'${project}/src/components/admin/content/editors/article/TopicMarkdownEditor.tsx';
import{createTopicFormDraft,getTopicFormDraftKey}from'${project}/src/lib/admin/content/topic-revision.ts';
import{formatAdminDateTime}from'${project}/src/lib/content-dates.ts';
import AdminPageContextHeader from '${project}/src/components/admin/ui/AdminPageContextHeader.tsx';
import AdminActionButton from '${project}/src/components/admin/ui/AdminActionButton.tsx';
import AdminNotice from '${project}/src/components/admin/AdminNotice.tsx';
import{AdminModuleTabIcon}from'${project}/src/components/admin/ui/AdminModuleTabs.tsx';
import{AdminDataGridActionIcon}from'${project}/src/components/admin/ui/AdminDataGrid.tsx';
import{PlusIcon}from'${project}/src/components/admin/AdminRowActions.tsx';
import{ADMIN_CONTENT_ROUTES}from'${project}/src/lib/admin/content-routes.ts';
import{ADMIN_COMPANY_DEFAULT}from'${project}/src/config/admin/company.ts';
import{ADMIN_NAVIGATION_REGISTRY}from'${project}/src/config/admin/navigation.ts';
import{resolveAdminNavigation}from'${project}/src/lib/admin/shell/navigation.ts';
import{topicsQueryContract}from'${project}/src/lib/admin/content/entity-list-contracts/topics.ts';
import{normalizeAdminEntityListQuery}from'${project}/src/lib/admin/entity-list/data-engine/contracts.ts';
import{DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS,UNIFIED_CONTENT_COLUMNS,UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH}from'${project}/src/components/admin/content/unified-content-columns.tsx';
import{SearchParamsContext,PathnameContext}from'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import{AppRouterContext}from'next/dist/shared/lib/app-router-context.shared-runtime.js';
import{RouterContext}from'next/dist/shared/lib/router-context.shared-runtime.js';
${systemwideAdoptionOnly ? `import Categories from '${project}/src/app/admin/content/categories/CategoriesListClient.tsx';
${moduleTitleShimmerOnly ? `import Series from '${project}/src/app/admin/content/series/SeriesTableClient.tsx';
import Construction from '${project}/src/app/admin/projects/construction-updates/page.tsx';` : ''}
import Projects from '${project}/src/app/admin/projects/ProjectsTableClient.tsx';
import Locations from '${project}/src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx';
import ContentBlocks from '${project}/src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx';
import AssignmentsGrid from '${project}/src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx';
import CompositionSurface from '${project}/src/app/admin/pages-blocks/pages/[id]/page-blocks/PageCompositionTableSurface.tsx';
import FooterLinks from '${project}/src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx';
import AdminPageHeader from '${project}/src/components/admin/ui/AdminPageHeader.tsx';
import BlockEditorContextHeader from '${project}/src/components/admin/page-blocks/BlockEditorContextHeader.tsx';
import{ModuleEditorHeader}from'${project}/src/components/admin/page-blocks/ModuleEditorPresentation.tsx';
import{useAdminGridSelection}from'${project}/src/components/admin/ui/useAdminGridSelection.ts';
import{getProjectsDefaultColumnKeys}from'${project}/src/lib/admin/projects/projects-list-config.ts';
import{getProjectLocationManagementDefaultColumnKeys}from'${project}/src/lib/admin/projects/location-management-contract.ts';` : ''}
const root=createRoot(document.getElementById('root')),q=new URLSearchParams(location.search),surface=q.get('surface')||(location.pathname==='/admin/content/topics'?'topics':'dashboard'),state=q.get('state')||'ready';
const surfacePaths={topics:'/admin/content/topics',categories:'/admin/content/categories',series:'/admin/content/series',construction:'/admin/projects/construction-updates',projects:'/admin/projects/residential',locations:'/admin/projects/locations/cities',modules:'/admin/pages-blocks/blocks/content',composition:'/admin/pages-blocks/pages/993',footer:'/admin/pages-blocks/footer'};
const pathname=q.get('nav-path')||surfacePaths[surface]||'/admin';
const navigation=${sidebarSelectionOnly || systemwideAdoptionOnly ? 'resolveAdminNavigation(ADMIN_NAVIGATION_REGISTRY)' : '[]'};
window.fixtureEvents=[];
window.fixtureNavigation=navigation;
window.fixtureTitleMinimum=UNIFIED_CONTENT_COLUMNS.find(column=>column.key==='title').minWidth;
const router={pathname,asPath:pathname,query:{},back(){},forward(){},prefetch:async href=>window.fixtureEvents.push({kind:'prefetch',href}),refresh(){},push(href){window.fixtureEvents.push({kind:'push',href});history.pushState({},'',href)},replace(href){window.fixtureEvents.push({kind:'replace',href});history.replaceState({},'',href)}};
const query=normalizeAdminEntityListQuery(topicsQueryContract,${dataGridOnly ? 'new URLSearchParams(location.search)' : 'new URLSearchParams()'});
const initial=window.fixtureTopics;
function DraftDate(){const[value,setValue]=React.useState('Saved title');const scope=React.useMemo(()=>({actorId:71,sessionVersion:2,expiresAt:window.fixtureDraftExpiresAt,contentType:'article',entity:'991'}),[]);return <form data-cinematic-date-form><TopicFormDraftRecovery scope={scope} baselineRevision="2026-10-24T02:00:00.000Z" restoreVersion={0} onRestore={fields=>setValue(fields.title?.[0]||'')}/><input name="title" value={value} onChange={e=>setValue(e.target.value)}/></form>}
if(surface==='draft-date'){const scope={actorId:71,sessionVersion:2,expiresAt:window.fixtureDraftExpiresAt,contentType:'article',entity:'991'},record=createTopicFormDraft(scope,'2026-10-24T02:00:00.000Z','date-probe',{title:['Local draft title']},'2026-10-24T03:00:00.000Z',{title:['Saved title']}),key=getTopicFormDraftKey(scope,'date-probe');if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(record));window.fixtureDate={key,raw:localStorage.getItem(key),expected:formatAdminDateTime(record.savedAt),savedAt:record.savedAt};}
const moduleHeader=${headers[0]};
${moduleTitleShimmerOnly ? `const categoryHeader=${familyHeaders.categories},seriesHeader=${familyHeaders.series};` : ''}
const loadError=state==='error'?'تعذر قراءة المؤشرات':null,loadNotice=${notices[0]};
const defaults=<div data-cinematic-defaults><Header title="افتراضي" description="وصف" actions={<button type="button">إجراء افتراضي</button>}/><Card label="مقياس افتراضي" value={37}/><Card label="مقياس تفاعلي" value={0} onClick={()=>window.fixtureEvents.push({kind:'default-click'})}/></div>;
const titleShimmerText=surface.includes('-long-')?'إدارة المحتوى والصفحات والتصنيفات وسلاسل الموضوعات ومتابعة تنفيذ المشروعات في لوحة الإدارة العربية':'إدارة التصنيفات';
const titleShimmerAlias=surface.split('-').at(-1),titleShimmerPresentation=titleShimmerAlias==='omitted'?undefined:titleShimmerAlias;
const titleShimmer=<Header title={titleShimmerText} presentation={titleShimmerPresentation} eyebrow="CANONICAL MODULE HEADER" description="الوصف المحفوظ يبقى مقروءًا وتظل إجراءات الصفحة قابلة للاستخدام." meta="12 عنصر" actions={<AdminActionButton variant="dark" onClick={()=>window.fixtureEvents.push({kind:'title-shimmer-action'})}>إجراء الصفحة الموجود</AdminActionButton>}/>;
const kpiProbes=<div data-kpi-default-probes className="space-y-6">{[undefined,'default','cinematic'].map((presentation,index)=><div key={index} data-kpi-alias={presentation||'omitted'}><MetricGrid presentation={presentation} ariaLabel={'مؤشرات الاسم '+index} items={[{label:'ثابت '+index,value:0,suffix:'/100',tone:'blue',compact:true,align:'center',icon:<AdminModuleTabIcon name="statistics"/>},{label:'تفاعلي '+index,value:37,tone:'green',onClick:()=>window.fixtureEvents.push({kind:'kpi-alias-click',alias:presentation||'omitted'}),active:true,icon:<AdminModuleTabIcon name="publish"/>}]}/></div>)}{[3,1].map(count=><div key={count} data-kpi-count={count}><MetricGrid items={Array.from({length:count},(_,index)=>({label:'قيمة '+count+'-'+index,value:index,icon:<AdminModuleTabIcon name="statistics"/>}))}/></div>)}</div>;
${systemwideAdoptionOnly ? `function FooterFixture(){const[links,setLinks]=React.useState(window.fixtureAdoption.footer);return <FooterLinks links={links} onChange={value=>{setLinks(value);window.fixtureEvents.push({kind:'footer-local-change',count:value.length})}}/>}
function CompositionFixture(){const[rows,setRows]=React.useState(window.fixtureAdoption.composition);const selection=useAdminGridSelection(rows.map(row=>'content:'+row.id));const grid=<AssignmentsGrid regionLabels={{main:'المحتوى الرئيسي'}} rows={rows} previewHref="/about" sort={{key:null,direction:'asc'}} onToggleSort={key=>window.fixtureEvents.push({kind:'composition-sort',key})} allSelected={selection.allSelected} selectedSet={selection.selectedSet} selectAllRef={selection.selectAllRef} onToggleAll={selection.toggleAll} onToggleSelect={selection.toggleOne} rowInteraction={()=>({pendingAction:null,pending:false,disabled:false})} onToggleVisibility={async()=>{throw Error('No domain mutation')}} getDisplayPositionOptions={()=>['main']} onDisplayPositionChange={()=>{throw Error('No domain mutation')}} onDuplicate={()=>{throw Error('No domain mutation')}} onDetach={()=>{throw Error('No domain mutation')}} getReorderPosition={row=>({position:rows.findIndex(item=>item.id===row.id),count:rows.length})} onReorder={(row,position)=>{const next=[...rows];next.splice(next.findIndex(item=>item.id===row.id),1);next.splice(position,0,row);setRows(next);window.fixtureEvents.push({kind:'composition-local-reorder',id:row.id,position})}} manualReorderEnabled visibleColumns={new Set(['module','status'])}/>;return <CompositionSurface feedback={null} toolbar={null} table={grid} pagination={null}/>}
const adoption=window.fixtureAdoption;
const headerFixtures=<div data-systemwide-header-probes className="space-y-6"><Header title="مالك الهيدر المشترك" description="الوصف الحقيقي محفوظ" meta="12 عنصر" badge="شارة محفوظة" status="empty" breadcrumb={<a href="/admin">مسار حقيقي</a>} actions={<AdminActionButton href="/admin/projects/new">إجراء موجود</AdminActionButton>}/><Header presentation="default" title="الاسم السابق للعرض"/><AdminPageHeader eyebrow="PROJECTS CONTROL" title="إدارة المشاريع" description="وصف المشروع الحقيقي" actions={<AdminActionButton href="/admin/projects/new">إضافة مشروع</AdminActionButton>}/><BlockEditorContextHeader backHref="/admin/pages-blocks/blocks/content" backLabel="العودة إلى القائمة" title="محتوى الصفحة" description="إعدادات المحتوى المحفوظة" status="published"/><ModuleEditorHeader moduleKind="content" moduleSlug="home-story" entityName="اسم محفوظ"/><form data-systemwide-form-actions onSubmit={event=>{event.preventDefault();window.fixtureEvents.push({kind:'form-native-submit'})}}><AdminActionButton type="submit" variant="primary">حفظ النموذج</AdminActionButton><AdminActionButton variant="dark" disabled>إجراء معطل</AdminActionButton><AdminActionButton variant="danger">إجراء خطر</AdminActionButton><AdminActionButton variant="ghost">إجراء هادئ</AdminActionButton></form><div data-cursor-semantic-probes><button type="button" onClick={()=>window.fixtureEvents.push({kind:'plain-semantic-action'})}>زر دلالي</button><button type="button" disabled className="cursor-pointer">معطل أساسي</button><button type="button" disabled className="cursor-pointer disabled:cursor-default">معطل افتراضي صريح</button><button type="button" disabled className="cursor-pointer disabled:cursor-wait">انتظار صريح</button><input aria-label="نص دلالي" type="text"/><input aria-label="ملف دلالي" type="file"/><input aria-label="اختيار دلالي" type="radio"/><select aria-label="قائمة دلالية"><option>خيار موجود</option></select><div data-decorative-hover className="hover:bg-white/10">زخرفة غير تفاعلية</div></div></div>;
${moduleTitleShimmerOnly ? `const construction=surface==='construction'?await Construction():null;` : ''}
const systemwide=surface==='categories'?<>${moduleTitleShimmerOnly ? '{categoryHeader}' : ''}<Categories initialQuery={adoption.categories.query} initialResult={adoption.categories.result}/></>:${moduleTitleShimmerOnly ? `surface==='series'?<>{seriesHeader}<Series initialQuery={adoption.series.query} initialResult={adoption.series.result}/></>:surface==='construction'?construction:` : ''}surface==='projects'?<Projects type="residential" basePath="/admin/projects/residential" initialQuery={adoption.projects.query} initialResult={adoption.projects.result} initialVisibleColumns={getProjectsDefaultColumnKeys()}/>:surface==='locations'?<Locations level="city" initialQuery={adoption.locations.query} initialResult={adoption.locations.result} initialVisibleColumns={getProjectLocationManagementDefaultColumnKeys('city')} initialPreferenceError={null}/>:surface==='modules'?<ContentBlocks rows={adoption.modules}/>:surface==='composition'?<CompositionFixture/>:surface==='footer'?<FooterFixture/>:surface==='header-probes'?headerFixtures:surface==='kpi-probes'?kpiProbes:null;` : ''}
const gridDefaults=<div data-cinematic-grid-defaults><AdminEntityList listId="fixture-default-grid" rows={initial.rows.slice(0,2)} columns={UNIFIED_CONTENT_COLUMNS} sizingStrategy={{mode:'flexible',columnKey:'title'}} sort={{key:'title',direction:'asc'}} sortMode={{mode:'callback',onToggle:key=>window.fixtureEvents.push({kind:'default-sort',key})}} actionsColumnWidth={UNIFIED_CONTENT_ACTIONS_COLUMN_WIDTH} emptyState={{mode:'filtered',systemEmpty:'لا توجد بيانات.',filteredEmpty:'لا توجد نتائج مطابقة.'}} getRowId={row=>row.id} getRowLabel={row=>row.title} initialVisibleColumns={DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS} defaultVisibleColumns={DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS} enableSelection/><AdminTablePagination basePath="/admin/defaults" totalCount={24} pageSize="10" pageSizeOptions={['10','25']} currentPage={1} totalPages={3} onPageChange={value=>window.fixtureEvents.push({kind:'default-page',value})}/></div>;
const content=${systemwideAdoptionOnly ? 'systemwide||' : ''}(surface.startsWith('title-shimmer-')?titleShimmer:surface==='draft-date'?<DraftDate/>:surface==='loading'?<Loading/>:surface==='defaults'?defaults:surface==='grid-continuous-region'?<AdminEntityListTableRegion presentation="cinematic" edgeMotion="continuous">{gridDefaults}</AdminEntityListTableRegion>:surface==='grid-default-region'?<AdminEntityListTableRegion>{gridDefaults}</AdminEntityListTableRegion>:surface==='grid-defaults'?gridDefaults:surface==='topics'?<div data-cinematic-topics>{moduleHeader}{loadError?loadNotice:null}<Topics categories={window.fixtureCategories||[]} series={window.fixtureSeries||[]} initialQuery={query} initialResult={initial} initialVisibleColumns={window.fixtureVisibleColumns||DEFAULT_UNIFIED_CONTENT_COLUMN_KEYS}/></div>:<Dashboard model={window.fixtureDashboard}/>);
root.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)}><AppRouterContext.Provider value={router}><RouterContext.Provider value={${sidebarSelectionOnly || systemwideAdoptionOnly ? 'router' : 'null'}}><PathnameContext.Provider value={pathname}><AuthenticatedLayout company={{...ADMIN_COMPANY_DEFAULT,source:'default'}} navigation={navigation}>{content}</AuthenticatedLayout></PathnameContext.Provider></RouterContext.Provider></AppRouterContext.Provider></SearchParamsContext.Provider>);`;
  const moduleData = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64');
  const fixtureActionModule = actionNames.map(name => dataGridOnly && !systemwideAdoptionOnly
    ? 'export async function ' + name + '(...args){const serialized=args.map(value=>value instanceof FormData?{form:[...value.entries()]}:value);const response=await fetch("/__fixture/action",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:' + JSON.stringify(name) + ',args:serialized})});if(!response.ok)throw Error("Denied local fixture action");return response.json();}'
    : 'export async function ' + name + '(){throw Error("Unexpected mutation: ' + name + '");}').join('\n');
  const webpack = require('next/dist/compiled/webpack/webpack').webpack;
  const compiler = webpack({ mode: 'development', target: 'web', context: root, entry: moduleData(entry), output: { path: output, filename: 'fixture.js' }, devtool: false, ...(moduleTitleShimmerOnly ? { experiments: { topLevelAwait: true } } : {}),
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false } },
    plugins: [new webpack.NormalModuleReplacementPlugin(/app[\\/]admin[\\/]content[\\/]topics[\\/]actions$/, moduleData(fixtureActionModule)),
      ...(systemwideAdoptionOnly ? [new webpack.NormalModuleReplacementPlugin(/(?:actions|column-preferences)(?:\.ts)?$/u, resource => { const key = path.resolve(resource.context, resource.request).replace(/\.ts$/u, ''); if (deniedActionModules.has(key)) resource.request = moduleData(deniedActionModules.get(key)); })] : []),
      ...(moduleTitleShimmerOnly ? [new webpack.NormalModuleReplacementPlugin(/lib[\\/]admin[\\/]auth[\\/]require-admin-session$/u, moduleData('export async function requireAdminSession(){window.fixtureEvents.push({kind:"isolated-construction-auth-port"});return null}')), new webpack.NormalModuleReplacementPlugin(/lib[\\/]admin[\\/]projects[\\/]tracking-hub$/u, moduleData('export async function loadProjectTrackingHub(){window.fixtureEvents.push({kind:"isolated-construction-read-port"});return window.fixtureAdoption.construction}'))] : []),
      new webpack.NormalModuleReplacementPlugin(/lib[\\/]admin[\\/]links[\\/]actions$/, moduleData(systemwideAdoptionOnly ? 'export async function resolveAdminLinkAjax(value){if(!["/about","/projects"].includes(value.href))throw Error("Unknown link outside finite Footer read fixture");window.fixtureEvents.push({kind:"resolved-local-link",href:value.href});return{ok:true,display:{kind:value.link_kind,kindLabel:"رابط محفوظ",title:value.href==="/about"?"من نحن":"المشروعات",publicPath:value.href,target:value.target||"_self"}}}export const browseAdminLinksAjax=blocked,browseTopicCategoriesPickerAjax=blocked,browseMenusPickerAjax=blocked,browseMenuItemsPickerAjax=blocked;function blocked(){throw Error("Picker browse outside bounded adoption fixture")}' : 'export const browseAdminLinksAjax=blocked,resolveAdminLinkAjax=blocked,browseTopicCategoriesPickerAjax=blocked,browseMenusPickerAjax=blocked,browseMenuItemsPickerAjax=blocked;function blocked(){throw Error("Unrelated picker transport outside Cinematic fixture")}')),
      new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }),
      { apply(c) { c.hooks.shouldEmit.tap('CinematicFixture', () => false); c.hooks.compilation.tap('CinematicFixture', compilation => { webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('CinematicFixture', async context => { if (/\.[jt]sx?$/.test(context.resourcePath) && !context.resourcePath.includes('node_modules')) { const relative = path.relative(root, context.resourcePath).replaceAll('\\', '/'), source = await read(relative); sourceFiles.set(relative, source); return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText; } }); }); } }],
  });
  let bundle;
  await new Promise((resolve, reject) => compiler.run((error, stats) => { if (!error && !stats.hasErrors()) bundle = Buffer.from(stats.compilation.assets['fixture.js'].source()); compiler.close(closeError => error || closeError || stats.hasErrors() ? reject(error || closeError || Error(stats.toString({ all: false, errors: true }))) : resolve()); }));
  const css = (await require('postcss')([require('@tailwindcss/postcss')({ base: root })]).process(await read('src/app/globals.css'), { from: path.join(root, 'src/app/globals.css') })).css;
  sourceFiles.set('src/app/globals.css', await read('src/app/globals.css'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  const hashes = Object.fromEntries([...sourceFiles].sort(([a], [b]) => a.localeCompare(b)).map(([file, source]) => [file, hash(source)]));
  await writeFile(path.join(output, 'browser-source-identity.json'), JSON.stringify({ status: 'FROZEN', hashes }, null, 2) + '\n');
  const metrics = { total: 901, published: 203, unpublished: 698, withSeries: 84, featured: 23, withoutImage: 42, seoAverage: 87, trashed: 3, staleScores: 0, error: null };
  const draftExpiresAt = Date.now() + 3600000;
  const stamp = '2026-10-24T03:00:00.000Z';
  const truth = { contractVersion: 'dashboard-truth-v1', checkedAt: stamp, kpis: { topics: { total: 901, published: 203, unpublished: 698, featured: 23 }, projects: { total: 14, published: 7, unpublished: 7 }, pages: { total: 63, published: 32, unpublished: 31 }, media: { total: 532, active: 530, issues: 2 }, categories: { total: 15, published: 10, unpublished: 5 } }, contentHealth: { topicsMissingImage: 42, topicsMissingSeoDescription: 20, categoriesMissingImage: 2, staleUnpublished: 1 }, recentTopics: [], recentProjects: [], databaseDiagnostics: { source: 'public.admin_dashboard_truth_v1()', migrationVersion: '20260807120000', migrationRegistered: true, rls: {}, missingIndexes: [], rpcAclServiceOnly: true, checkedAt: stamp } };
  const envelope = (key, data, state) => ({ key, label: key, source: 'controlled:' + key, status: state === 'error' ? 'unavailable' : 'ready', checkedAt: stamp, message: state === 'error' ? 'تعذر الاتصال بالمصدر' : 'قراءة ناجحة', data: state === 'error' ? null : data });
  function dashboardModel(state) { const data = structuredClone(truth); if (state === 'empty') { for (const values of Object.values(data.kpis)) for (const key of Object.keys(values)) values[key] = 0; for (const key of Object.keys(data.contentHealth)) data.contentHealth[key] = 0; } return { state: state === 'error' ? 'unavailable' : 'ready', checkedAt: stamp, readModel: envelope('read_model', data, state), audit: envelope('audit', { events: [], total: 0 }, state), media: envelope('media_diagnostics', { state: 'synced', provider: 'filesystem', environment: 'isolated', lastUpdatedAt: stamp, storageAssetCount: 532, catalogAssetCount: 532, warnings: [] }, state), cache: { status: 'ready', source: 'Next.js force-dynamic request-time rendering', checkedAt: stamp, message: 'request-time' } }; }
  // Disposable rows and transports belong to this existing presentation fixture.
  // They never resolve a database client, authenticated server action or remote URL.
  const fixtureCategories = [1, 2].map(id => ({ id, name: id === 1 ? 'تصنيف أول' : 'تصنيف ثان', slug: 'fixture-' + id, parent_id: null, sort_order: id, is_active: true, status: 'published', color_token: 'gold', depth: 0, children: [] }));
  const fixtureSeries = [{ id: 3, name: 'سلسلة تجريبية', status: 'published', deleted_at: null }];
  const gridRows = Array.from({ length: 24 }, (_, index) => ({ id: 71001 + index, title: 'موضوع سينمائي ' + String(index + 1).padStart(2, '0'), content_type: index % 2 ? 'news' : 'article', category_id: index % 2 + 1, category_name: index % 2 ? 'تصنيف ثان' : 'تصنيف أول', category_color_token: 'gold', series_id: index % 3 ? null : 3, series_name: index % 3 ? null : 'سلسلة تجريبية', status: index % 2 ? 'unpublished' : 'published', is_featured: index % 4 === 0, seo_score: 60 + index, views_count: 1200 + index, created_at: stamp, updated_at: stamp, published_at: index % 2 ? null : stamp, created_by_display: 'محرر تجريبي', updated_by_display: 'محرر تجريبي', published_by_display: 'محرر تجريبي', deleted_at: null }));
  const adoptionContracts = {}, adoptionRows = {}, adoptionData = {};
  if (systemwideAdoptionOnly) {
    adoptionContracts.categories = (await jiti.import(path.join(root, 'src/lib/admin/content/entity-list-contracts/categories.ts'))).categoriesQueryContract;
    adoptionContracts.projects = (await jiti.import(path.join(root, 'src/lib/admin/projects/entity-list-contract.ts'))).projectsQueryContract;
    adoptionContracts.locations = (await jiti.import(path.join(root, 'src/lib/admin/projects/location-management-contract.ts'))).projectLocationsQueryContract;
    if (moduleTitleShimmerOnly) {
      adoptionContracts.series = (await jiti.import(path.join(root, 'src/lib/admin/content/entity-list-contracts/series.ts'))).seriesQueryContract;
      adoptionRows.series = Array.from({ length: 24 }, (_, index) => ({ id: 87001 + index, name: 'سلسلة عرض ' + String(index + 1).padStart(2, '0'), slug: 'fixture-series-' + index, status: index % 2 ? 'unpublished' : 'published', sort_order: index, category_id: null, category_name: null, created_at: stamp, updated_at: stamp, deleted_at: null, topics_count: index + 1 }));
      adoptionData.construction = { schemaAvailable: true, projects: [2, 3, 4].map((stageCount, index) => ({ id: 88001 + index, slug: 'fixture-tracking-' + index, arabicName: 'مشروع متابعة معزول ' + index, type: 'residential', publicationStatus: 'published', stageCount, updateCount: [5, 7, 11][index] })) };
    }
    adoptionRows.categories = Array.from({ length: 24 }, (_, index) => ({ id: 81001 + index, name: 'تصنيف عرض ' + String(index + 1).padStart(2, '0'), slug: 'fixture-category-' + index, description: 'وصف تصنيف محفوظ', sort_order: index, is_active: true, parent_id: null, parent_name: null, status: index % 2 ? 'unpublished' : 'published', color_token: 'gold', published_at: stamp, created_at: stamp, updated_at: stamp, deleted_at: null, ownCount: 0, totalCount: 0, depth: 0, childCount: 0 }));
    adoptionRows.projects = Array.from({ length: 24 }, (_, index) => ({ id: 82001 + index, type: 'residential', slug: 'fixture-project-' + index, arabic_name: 'مشروع عرض ' + String(index + 1).padStart(2, '0'), english_name: 'Project ' + index, location_label: 'موقع محفوظ', city_name: 'القاهرة', main_area_name: 'منطقة محفوظة', sub_area_name: 'حي محفوظ', featured: index % 2 === 0, publication_status: index % 2 ? 'unpublished' : 'published', published_at: index % 2 ? null : stamp, updated_at: stamp }));
    adoptionRows.locations = Array.from({ length: 24 }, (_, index) => ({ id: 83001 + index, client_key: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), level: 'city', parent_id: 1, name_ar: 'مدينة عرض ' + String(index + 1).padStart(2, '0'), name_en: 'City ' + index, sort_order: index, is_active: index % 2 === 0, created_at: stamp, updated_at: stamp, parent_name_ar: 'محافظة محفوظة', parent_name_en: null, project_count: index === 0 ? 1 : 0, child_count: 0, delete_eligibility: { canDelete: index !== 0, disabledReason: index === 0 ? 'توجد مشروعات مرتبطة' : null }, visibility_eligibility: { canDeactivate: index !== 0, disabledReason: index === 0 ? 'توجد مشروعات مرتبطة' : null } }));
    for (const family of ['categories', 'projects', 'locations', ...(moduleTitleShimmerOnly ? ['series'] : [])]) adoptionData[family] = { query: normalizeAdminEntityListQuery(adoptionContracts[family], new URLSearchParams(family === 'projects' ? 'type=residential' : '')), result: adoptionResult(family) };
    adoptionData.modules = Array.from({ length: 14 }, (_, index) => ({ id: 84001 + index, name: 'بلوك عرض ' + String(index + 1).padStart(2, '0'), slug: 'fixture-content-' + index, description: 'وصف محتوى محفوظ', variant: 'default', status: index % 2 ? 'unpublished' : 'published', updated_at: stamp }));
    adoptionData.composition = [0, 1].map(index => ({ id: 85001 + index, page_id: 993, template_id: 84001 + index, slot: 'main', sort_order: index, is_visible: true, is_publicly_visible: true, updated_at: stamp, module_kind: 'content', block_type: 'content', template_name: 'محتوى مرتبط ' + (index + 1), template_slug: 'fixture-content-' + index, template_status: 'published', template_variant: 'default', manages_assignment_on_page: true, assignment_note: null }));
    adoptionData.footer = [0, 1].map(index => ({ label: 'رابط تذييل ' + (index + 1), href: index ? '/projects' : '/about', link: null, target: '_self', visible: true, sortOrder: index }));
  }
  function adoptionResult(family, params = new URLSearchParams()) {
    const query = normalizeAdminEntityListQuery(adoptionContracts[family], params), filters = query.filters;
    const source = adoptionRows[family].filter(row => (!query.search || [row.name, row.arabic_name, row.english_name, row.name_ar, row.slug].some(value => value?.includes(query.search))) && (!filters.status || filters.status === 'all' || (family === 'locations' ? row.is_active === (filters.status === 'active') : row.status === filters.status)) && (!filters.publicationStatus || filters.publicationStatus === 'all' || row.publication_status === filters.publicationStatus) && (!filters.featured || filters.featured === 'all' || row.featured === (filters.featured === 'yes')));
    const field = query.sort.field === 'tree' ? 'sort_order' : query.sort.field;
    source.sort((a, b) => { const l = a[field] ?? '', r = b[field] ?? '', order = typeof l === 'number' ? l - r : String(l).localeCompare(String(r), 'ar'); return (order || a.id - b.id) * (query.sort.direction === 'asc' ? 1 : -1); });
    const totalRows = source.length, totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize)), pageNumber = Math.min(query.page, totalPages);
    const familyMetrics = family === 'categories' ? { parentOptions: [], total: 24, published: 12, unpublished: 12, topics: kpiAdoptionOnly || moduleTitleShimmerOnly ? 322 : 0, series: kpiAdoptionOnly || moduleTitleShimmerOnly ? 21 : 0, trashed: 0 } : family === 'series' ? { total: 24, topics: 262, averageTopics: 10.9, published: 12, unpublished: 12, trashed: 0, categoryOptions: [], categoryDescendantIdsByValue: {} } : family === 'locations' ? { level: 'city', parentOptions: [{ id: 1, name_ar: 'محافظة محفوظة', name_en: null, is_active: true }] } : { total: 24 };
    return { rows: source.slice((pageNumber - 1) * query.pageSize, pageNumber * query.pageSize), pagination: { page: pageNumber, pageSize: query.pageSize, totalRows, totalPages }, metrics: familyMetrics, meta: { generatedAt: new Date().toISOString(), mode: query.mode } };
  }
  const gridTransport = { preference: null, failPreferences: false, holdActions: false, failActions: false, actions: [], heldActions: [] };
  function topicsResult(state, params = new URLSearchParams()) {
    const query = normalizeAdminEntityListQuery(topicsQueryContract, params);
    let rows = dataGridOnly && state !== 'empty' ? gridRows.filter(row => {
      const f = query.filters;
      return (f.view === 'trash' ? Boolean(row.deleted_at) : !row.deleted_at) && (!query.search || row.title.includes(query.search)) && (f.contentType === 'all' || row.content_type === f.contentType) && (!f.categoryId || row.category_id === f.categoryId) && (!f.seriesId || (f.seriesId === 'any' ? row.series_id !== null : row.series_id === f.seriesId)) && (f.status === 'all' || row.status === f.status) && (f.featured === 'all' || row.is_featured === (f.featured === 'yes')) && (f.image === 'all' || row.id % 2 === 0);
    }) : [];
    const fields = { category: 'category_name', series: 'series_name', featured: 'is_featured', seo: 'seo_score', views: 'views_count', created_by: 'created_by_display' }, field = fields[query.sort.field] || query.sort.field;
    rows.sort((a, b) => { const left = a[field] ?? '', right = b[field] ?? ''; const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'ar'); return (order || a.id - b.id) * (query.sort.direction === 'asc' ? 1 : -1); });
    const totalRows = rows.length, totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize)), page = Math.min(query.page, totalPages);
    return { rows: rows.slice((page - 1) * query.pageSize, page * query.pageSize), metrics: state === 'error' ? { ...metrics, error: 'تعذر قراءة المؤشرات' } : state === 'empty' ? Object.fromEntries(Object.keys(metrics).map(key => [key, key === 'seoAverage' || key === 'error' ? null : 0])) : metrics, pagination: { page, pageSize: query.pageSize, totalRows, totalPages }, meta: { generatedAt: new Date().toISOString(), mode: query.mode } };
  }
  const requests = [], forbidden = [], errors = [], cases = [], screenshots = [], moduleTitleGeometry = {};
  let retained = null;
  if (refinementOnly && process.argv.includes('--cinematic-v11-remaining-only')) {
    const folder = path.join(output, 'attempt-02-draft-scope'), previous = JSON.parse(await readFile(path.join(folder, 'browser-progress.json'), 'utf8')), identity = JSON.parse(await readFile(path.join(folder, 'browser-source-identity.json'), 'utf8'));
    assert.deepEqual(previous.errors, []); assert.deepEqual(previous.forbidden, []);
    assert.equal(previous.cases.filter(row => row.surface === 'cinematic-v11-ready').length, 2);
    assert.ok(previous.cases.every(row => row.width === 1440 || row.surface === 'v11-metric-hit-target'));
    const unchanged = Object.keys(identity.hashes).filter(file => file !== 'scripts/fixtures/cinematic-admin-browser.mjs');
    for (const file of unchanged) assert.equal(hashes[file], identity.hashes[file], 'Retained v1.1 Desktop input unchanged: ' + file);
    cases.push(...previous.cases); screenshots.push(...previous.screenshots.filter(file => !file.startsWith('v11-defaults-')));
    retained = { source: 'attempt-02-draft-scope/browser-progress.json', identity: 'attempt-02-draft-scope/browser-source-identity.json', cases: previous.cases.length, unchangedInputCount: unchanged.length, fixtureCorrection: 'Draft date fixture uses an actual eligible numeric record scope; Desktop Dashboard/Topics source and all non-fixture browser inputs remain identical.', skippedReplay: 'Completed Desktop Dashboard/Topics current typography, artwork, geometry, native callback, hover/focus progression and reduced-motion assertions.' };
  }
  const failureOnly = process.argv.includes('--cinematic-failure-only');
  if (process.argv.includes('--cinematic-remaining-only') || failureOnly) {
    const folder = failureOnly ? 'failed-query-locator-attempt' : 'failed-browser-clock-attempt';
    const previous = JSON.parse(await readFile(path.join(output, folder, 'browser-progress.json'), 'utf8'));
    const identity = JSON.parse(await readFile(path.join(output, folder, 'browser-source-identity.json'), 'utf8'));
    assert.equal(previous.cases.length, failureOnly ? 22 : 3); if (!failureOnly) assert.ok(previous.cases.every(row => row.surface === 'dashboard' && row.width === 1440)); assert.deepEqual(previous.errors, []); assert.deepEqual(previous.forbidden, []);
    const visualInputs = Object.keys(identity.hashes).filter(file => file.startsWith('src/') || file === 'postcss.config.mjs' || file === 'package-lock.json');
    visualInputs.forEach(file => assert.equal(hashes[file], identity.hashes[file], 'Retained Dashboard source/visual input unchanged: ' + file));
    cases.push(...previous.cases); screenshots.push(...previous.screenshots.filter(file => failureOnly || file.startsWith('dashboard-1440-')));
    retained = { source: folder + '/browser-progress.json', identity: folder + '/browser-source-identity.json', cases: previous.cases.length, unchangedVisualInputCount: visualInputs.length, skippedReplay: failureOnly ? 'All sixteen rendered state/viewport cases plus four KPI filters, reset and retained image filter' : 'Dashboard Desktop ready/empty/error', fixtureCorrection: failureOnly ? 'Query error asserts the shared owner region, including its real retained-result prefix, and controlled HTTP failure matches the existing route status/envelope.' : 'Topics API meta timestamp now reflects the current read, matching real controller stale-time semantics.' };
  }
  let holdReads = false, failReads = false;
  const held = [];
  const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1'); requests.push({ method: req.method, path: url.pathname, query: url.search });
      if (url.pathname === '/fixture.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); return; }
      if (url.pathname === '/fixture.css') { res.writeHead(200, { 'content-type': 'text/css' }); res.end(css); return; }
      if (url.pathname.startsWith('/fonts/')) { const name = path.basename(url.pathname); assert.match(name, /^(?:ibm-plex-sans-arabic-(?:300|400|500|600|700)|inter-variable)\.woff2$/u); res.writeHead(200, { 'content-type': 'font/woff2' }); res.end(await readFile(path.join(root, 'src/assets/fonts', name))); return; }
      if (dataGridOnly && url.pathname === '/__fixture/action' && req.method === 'POST') {
        assert.equal(finalAlignmentOnly, false, 'The final alignment delta permits no preference or domain action transport');
        assert.equal(systemwideAdoptionOnly, false, 'Systemwide adoption permits no preference or domain action transport');
        let body = ''; for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        assert.ok(['saveContentTablePreferences', 'bulkUpdateUnifiedContent', 'toggleUnifiedContentFeatured', 'setUnifiedContentStatus'].includes(input.name), 'Only explicit disposable presentation transports are available');
        gridTransport.actions.push(input);
        if (gridTransport.holdActions) await new Promise(resolve => gridTransport.heldActions.push(resolve));
        let result;
        if (input.name === 'saveContentTablePreferences') {
          result = gridTransport.failPreferences ? { ok: false, message: 'تعذر حفظ تفضيلات الأعمدة في العينة.' } : { ok: true, message: 'حفظ محلي معزول' };
          if (result.ok) gridTransport.preference = input.args[0];
        } else {
          const form = new FormData(); for (const [key, value] of input.args[0].form) form.append(key, value);
          const ids = input.name === 'bulkUpdateUnifiedContent' ? form.getAll('topic_ids').map(Number) : [Number(form.get('id'))];
          assert.ok(ids.length > 0 && ids.every(id => gridRows.some(row => row.id === id)), 'Actions cannot borrow hosted or unknown rows');
          result = gridTransport.failActions ? { ok: false, completion: 'not_committed', feedbackStatus: 'error', code: 'fixture_rejected', title: 'تعذر تنفيذ العملية', message: 'رفض معزول قابل لإعادة المحاولة' } : { ok: true, completion: 'committed', feedbackStatus: 'success', code: 'saved', entityId: ids[0], title: 'تم التنفيذ المعزول', message: 'تغيرت ذاكرة العينة فقط' };
          if (result.ok) for (const row of gridRows.filter(row => ids.includes(row.id))) {
            if (input.name === 'toggleUnifiedContentFeatured') row.is_featured = form.get('desired_featured') === 'true';
            if (input.name === 'setUnifiedContentStatus') row.status = form.get('next_status');
            if (form.get('bulk_action') === 'feature') row.is_featured = true;
          }
        }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(json(result)); return;
      }
      if (url.pathname === '/favicon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(await readFile(path.join(root, 'public/favicon.svg'))); return; }
      if (systemwideAdoptionOnly && url.pathname === '/__public-cursor') { res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); res.end('<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><button type="button">Public semantic control</button><div>Public plain surface</div></body></html>'); return; }
      if (dataGridOnly && url.pathname === '/admin/content/topics/search' && req.method === 'GET') {
        const results = gridRows.filter(row => row.title.includes(url.searchParams.get('q') || '')).slice(0, 8).map(({ id, title, category_name }) => ({ id, title, category_name }));
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ results })); return;
      }
      if (url.pathname === '/api/admin/entity-lists/topics' && req.method === 'GET') {
        const finish = () => { res.writeHead(failReads ? 500 : 200, { 'content-type': 'application/json' }); res.end(json(failReads ? { error: { code: 'list_load_failed', message: 'Unable to load the requested list.' } } : topicsResult('ready', url.searchParams))); };
        if (holdReads) held.push(finish); else finish(); return;
      }
      if (systemwideAdoptionOnly && req.method === 'GET' && url.pathname.startsWith('/api/admin/entity-lists/')) {
        const family = { categories: 'categories', ...(moduleTitleShimmerOnly ? { series: 'series' } : {}), projects: 'projects', project_locations_city: 'locations' }[url.pathname.split('/').at(-1)];
        if (family) { const finish = () => { res.writeHead(failReads ? 500 : 200, { 'content-type': 'application/json' }); res.end(json(failReads ? { error: { code: 'list_load_failed', message: 'Controlled read rejection.' } } : adoptionResult(family, url.searchParams))); }; if (holdReads) held.push(finish); else finish(); return; }
      }
      if (url.pathname === '/api/admin/auth/logout' && req.method === 'POST') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
      if (url.pathname.startsWith('/api/')) { forbidden.push({ method: req.method, path: url.pathname }); res.writeHead(418); res.end('Denied'); return; }
      const state = url.searchParams.get('state') || 'ready';
      const fonts = [300, 400, 500, 600, 700].map(weight => `@font-face{font-family:FixtureArabic;src:url(/fonts/ibm-plex-sans-arabic-${weight}.woff2);font-weight:${weight};font-display:block}`).join('') + '@font-face{font-family:FixtureInter;src:url(/fonts/inter-variable.woff2);font-weight:100 900;font-display:block}';
      res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); res.end(`<!doctype html><html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/fixture.css"><style>${fonts}:root{--font-arabic:FixtureArabic;--font-inter:FixtureInter}body{margin:0}</style></head><body><div id="root"></div><script>window.fixtureDraftExpiresAt=${draftExpiresAt};window.fixtureDashboard=${json(dashboardModel(state))};window.fixtureTopics=${json(topicsResult(state, dataGridOnly ? url.searchParams : new URLSearchParams()))};window.fixtureCategories=${json(dataGridOnly ? fixtureCategories : [])};window.fixtureSeries=${json(dataGridOnly ? fixtureSeries : [])};window.fixtureVisibleColumns=${json(dataGridOnly ? gridTransport.preference : null)};window.fixtureAdoption=${json(adoptionData)};</script><script src="/fixture.js"></script></body></html>`);
    } catch (error) { errors.push(String(error)); res.writeHead(500); res.end('Fixture failure'); }
  });
  let browser, page;
  async function screenshot(name, target) { const file = name + '.png'; if (target) await target.screenshot({ path: path.join(output, file) }); else await page.screenshot({ path: path.join(output, file), fullPage: true }); screenshots.push(file); await writeFile(path.join(output, 'browser-progress.json'), JSON.stringify({ status: 'RUNNING', cases, screenshots, errors, forbidden }, null, 2) + '\n'); }
  try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const logoutDestination = () => {
    const destination = new URL(ADMIN_COMPANY_DEFAULT.publicWebsiteUrl, origin);
    assert.equal(destination.origin, origin, 'Actual public logout destination stays inside the isolated fixture origin');
    return destination.href;
  };
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => { if (new URL(route.request().url()).origin !== origin) { forbidden.push(route.request().url()); await route.abort(); } else await route.continue(); });
  async function open(surface, state = 'ready', navPath = '') { holdReads = false; failReads = false; while (held.length) held.shift()(); await page.goto(origin + '/?surface=' + surface + '&state=' + state + (navPath ? '&nav-path=' + encodeURIComponent(navPath) : '')); await expect(page.locator('[data-admin-shell-header]')).toBeVisible({ timeout: dataGridOnly ? 30000 : 5000 }); await page.evaluate(() => document.fonts.ready); }
  async function noOverflow() { const result = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, viewport: innerWidth, elements: [...document.querySelectorAll('[data-admin-shell-header],[data-admin-page-header],[data-admin-metric-cards-viewport], [data-admin-metric-presentation]')].map(e => ({ width: e.clientWidth, scroll: e.scrollWidth, text: e.textContent.slice(0, 45) })) })); assert.ok(result.doc <= result.viewport + 1, JSON.stringify(result)); assert.ok(result.elements.every(row => row.scroll <= row.width + 1), JSON.stringify(result.elements)); return result; }
  const dashboardValues = ['901', '203', '14', '63', '532', '10'];
  const motion = locator => locator.evaluate(element => { const style = getComputedStyle(element), edge = getComputedStyle(element, '::after'); return { transform: style.transform, transitionDuration: style.transitionDuration, border: style.borderColor, outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, edge: { animationName: edge.animationName, animationDuration: edge.animationDuration, opacity: edge.opacity, pointerEvents: edge.pointerEvents, angle: edge.getPropertyValue('--admin-edge-angle') }, animations: element.getAnimations({ subtree: true }).map(animation => ({ name: animation.animationName || '', currentTime: animation.currentTime, playState: animation.playState })) }; });
  async function activeEdge(locator, trigger) {
    await page.mouse.move(0, 0);
    if (trigger === 'focus') { await page.keyboard.press('Tab'); await locator.focus(); await expect(locator).toBeFocused(); }
    else await locator.hover();
    const edgeOwner = locator.locator('xpath=ancestor-or-self::*[contains(concat(" ",normalize-space(@class)," ")," admin-cinematic-edge ")][1]');
    await expect.poll(async () => (await motion(edgeOwner)).edge.animationName).toContain('admin-edge-trace');
    const first = await motion(edgeOwner), trace = first.animations.find(animation => animation.name === 'admin-edge-trace');
    assert.ok(trace && trace.playState === 'running', 'Actual CSS edge animation runs on the current shared owner: ' + JSON.stringify(first));
    await expect.poll(async () => (await motion(edgeOwner)).animations.find(animation => animation.name === 'admin-edge-trace')?.currentTime).toBeGreaterThan(Number(trace.currentTime) + 40);
    const final = await motion(edgeOwner);
    assert.equal(final.edge.pointerEvents, 'none', 'Animated border never intercepts controls');
    assert.equal(final.edge.animationDuration, '1.15s', 'Recovered existing motion timing stays 1.15 seconds');
    return { first, final };
  }
  async function moduleTitleMotion(header, focusTarget) {
    if (focusTarget) { await page.keyboard.press('Tab'); await focusTarget.focus(); await expect(focusTarget).toBeFocused(); }
    const result = await header.evaluate(node => { const title = node.querySelector('h1'), style = getComputedStyle(title), dock = node.querySelector('[data-admin-page-header-actions-dock]'), ribbon = node.querySelector(':scope > svg[data-admin-header-background-lines]'); return { title: title.textContent, animation: style.animationName, duration: style.animationDuration, timing: style.animationTimingFunction, iterations: style.animationIterationCount, rootEdge: getComputedStyle(node, '::after').animationName, dockEdge: dock ? getComputedStyle(dock, '::after').animationName : 'none', ribbonCount: node.querySelectorAll('[data-admin-header-background-lines]').length, directRibbonOpacity: ribbon ? getComputedStyle(ribbon).opacity : null, otherSvg: [...node.querySelectorAll('svg')].filter(svg => svg !== ribbon).map(svg => ({ opacity: getComputedStyle(svg).opacity, ribbonHook: svg.hasAttribute('data-admin-header-background-lines') })) }; });
    assert.equal(result.animation, 'admin-module-title-shimmer'); assert.equal(result.duration, '2.8s'); assert.equal(result.timing, 'linear'); assert.equal(result.iterations, 'infinite'); assert.equal(result.rootEdge, 'none'); assert.equal(result.dockEdge, 'none');
    assert.equal(result.ribbonCount, 1); assert.equal(result.directRibbonOpacity, '0.7'); assert.ok(result.otherSvg.length >= 2 && result.otherSvg.every(svg => svg.opacity === '1' && svg.ribbonHook === false), 'Actual consumer foreground/artwork/action SVGs remain outside the direct background ribbon hook'); return result;
  }
  async function verifyModuleTitleShimmer() {
    const assertRgbaPaint = (actual, expected, message) => { const color = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/gu, alphas = value => [...value.matchAll(color)].map(match => Number(match[4])), alphaMask = value => value.replace(color, 'rgba($1, $2, $3, alpha)'); assert.equal(alphaMask(actual), alphaMask(expected), message); const observed = alphas(actual), declared = alphas(expected); assert.equal(observed.length, declared.length); observed.forEach((alpha, index) => { if (declared[index] === 0) assert.equal(alpha, 0, message + ': Tailwind neutral slots remain fully transparent'); else assert.ok(Math.abs(alpha - declared[index]) <= 1 / 255, message + ': Chromium alpha serialization remains within one 8-bit step'); }); };
    const moduleHeader = () => page.locator('[data-admin-page-header]:visible');
    const title = () => moduleHeader().locator('h1');
    const dock = () => moduleHeader().getByRole('region', { name: 'إجراءات الصفحة وبياناتها', exact: true });
    const action = () => moduleHeader().getByRole('button', { name: 'إجراء الصفحة الموجود', exact: true });
    const short = 'إدارة التصنيفات', long = 'إدارة المحتوى والصفحات والتصنيفات وسلاسل الموضوعات ومتابعة تنفيذ المشروعات في لوحة الإدارة العربية';
    const geometry = () => moduleHeader().evaluate(node => {
      const h1 = node.querySelector('h1'), dock = node.querySelector('[role="region"]'), action = dock.querySelector('button'), s = getComputedStyle(h1), range = document.createRange(); range.selectNodeContents(h1);
      const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; };
      return { header: rect(node), title: rect(h1), dock: rect(dock), action: rect(action), titleText: h1.textContent, childElements: h1.childElementCount, textNodes: [...h1.childNodes].map(child => child.nodeType), lines: [...new Set([...range.getClientRects()].map(r => Math.round(r.top + scrollY)))].length, typography: { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, direction: s.direction, wordBreak: s.wordBreak, whiteSpace: s.whiteSpace, display: s.display }, headerPadding: getComputedStyle(node).padding, actionText: action.textContent };
    });
    const titleStyle = () => title().evaluate(node => { const s = getComputedStyle(node), animation = node.getAnimations().find(item => item.animationName === 'admin-module-title-shimmer'); return { name: s.animationName, duration: s.animationDuration, timing: s.animationTimingFunction, iterations: s.animationIterationCount, size: s.backgroundSize, image: s.backgroundImage, repeat: s.backgroundRepeat, position: s.backgroundPositionX, color: s.color, fill: s.webkitTextFillColor, clip: s.backgroundClip, currentTime: animation?.currentTime ?? null, playState: animation?.playState ?? null }; });
    const edge = target => target.evaluate(node => { const s = getComputedStyle(node, '::after'); return { name: s.animationName, content: s.content, pointer: s.pointerEvents }; });
    const sharp = require('sharp');
    const beforePath = path.join(root, '.tmp-qa/admin-development-batch-01/module-title-shimmer-20261024/before-fixture/cinematic-browser.json');
    const before = moduleTitleShimmerBefore ? null : await readFile(beforePath, 'utf8').then(JSON.parse).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (before) { assert.equal(before.status, 'PASS'); assert.equal(before.version, 'admin-module-title-shimmer-before'); for (const file of frozenTitleOwners) assert.equal(before.sourceHashes[file], hash(await readFile(path.join(root, '.tmp-qa/admin-development-batch-01/module-title-shimmer-20261024/before', file))), 'Before receipt uses the frozen true owner source: ' + file); }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
      const variants = [];
      for (const length of ['short', 'long']) for (const alias of ['omitted', 'default', 'cinematic']) {
        await open(`title-shimmer-${length}-${alias}`); const expected = length === 'short' ? short : long;
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1); await expect(page.getByRole('heading', { level: 1, name: expected, exact: true })).toHaveCount(1); await expect(page.getByText(expected, { exact: true })).toHaveCount(1); await expect(title()).toHaveText(expected);
        assert.equal(await title().getAttribute('aria-hidden'), null); assert.equal(await title().getAttribute('aria-label'), null);
        const g = await geometry(); assert.equal(g.childElements, 0, 'Arabic text is one native heading without per-letter spans'); assert.deepEqual(g.textNodes, [3]); assert.equal(g.typography.direction, 'rtl'); assert.ok(g.title.width > 0); if (length === 'long') assert.ok(g.lines >= 2, 'Long Arabic title wraps naturally');
        const key = width + ':' + length + ':' + alias; moduleTitleGeometry[key] = g;
        if (before) assert.deepEqual(g, before.moduleTitleGeometry[key], 'Title/Header/Dock/Action geometry and typography match the frozen original owner: ' + key);
        const style = await titleStyle();
        if (moduleTitleShimmerBefore) { assert.equal(style.name, 'none'); assert.equal(style.color, 'rgb(246, 247, 250)'); }
        else {
          assert.notEqual(await title().getAttribute('data-admin-page-header-title'), null); assert.notEqual(await dock().getAttribute('data-admin-page-header-actions-dock'), null);
          assert.equal(style.name, 'admin-module-title-shimmer'); assert.equal(style.duration, '2.8s'); assert.equal(style.timing, 'linear'); assert.equal(style.iterations, 'infinite'); assert.equal(style.size, '300% 100%'); assert.equal(style.repeat, 'no-repeat'); assert.equal(style.clip, 'text'); assert.equal(style.fill, 'rgba(0, 0, 0, 0)'); assert.match(style.image, /repeating-linear-gradient\(90deg/u); assert.match(style.image, /rgb\(246, 247, 250\)/u); assert.match(style.image, /rgb\(216, 176, 104\)/u); assert.match(style.image, /rgb\(255, 243, 190\)/u);
          const frame = await moduleHeader().evaluate(node => { const s = getComputedStyle(node), ribbons = [...node.querySelectorAll('[data-admin-header-background-lines]')], ribbon = node.querySelector(':scope > svg[data-admin-header-background-lines]'); return { borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => ({ color: s['border' + side + 'Color'], width: s['border' + side + 'Width'], style: s['border' + side + 'Style'] })), background: s.backgroundImage, shadow: s.boxShadow, ribbonCount: ribbons.length, directRibbon: Boolean(ribbon), ribbon: ribbon ? { opacity: getComputedStyle(ribbon).opacity, pointerEvents: getComputedStyle(ribbon).pointerEvents, hidden: ribbon.getAttribute('aria-hidden'), focusable: ribbon.getAttribute('focusable') } : null, otherSvg: [...node.querySelectorAll('svg')].filter(svg => svg !== ribbon).map(svg => ({ opacity: getComputedStyle(svg).opacity, ribbonHook: svg.hasAttribute('data-admin-header-background-lines') })) }; });
          frame.borders.forEach(border => { assertRgbaPaint(border.color, 'rgba(216, 176, 104, 0.025)', 'The shared frame has the approved quiet border on all four sides'); assert.equal(border.width, '1px'); assert.equal(border.style, 'solid'); });
          assert.equal(frame.background, 'linear-gradient(110deg, rgb(16, 16, 12) 0%, rgb(0, 8, 16) 45%, rgb(9, 13, 18) 100%)', 'The original Module background remains intact');
          assertRgbaPaint(frame.shadow, 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(237, 200, 120, 0.52) 0px 2px 0px 0px inset, rgba(216, 176, 104, 0.045) 0px 5px 12px 0px inset, rgba(0, 0, 0, 0.48) 0px 9px 18px 0px, rgba(0, 0, 0, 0.56) 0px 24px 48px 0px, rgba(216, 176, 104, 0.105) 0px 18px 45px 0px, rgba(216, 176, 104, 0.055) 0px 36px 75px 0px', 'The four neutral Tailwind slots and all six approved Floating Gold layers compile without extras or reordering');
          assert.equal(frame.ribbonCount, 1); assert.equal(frame.directRibbon, true); assert.deepEqual(frame.ribbon, { opacity: '0.7', pointerEvents: 'none', hidden: 'true', focusable: 'false' }, 'Only the direct decorative SVG owns the quiet background-lines opacity');
          assert.ok(frame.otherSvg.every(svg => svg.opacity === '1' && svg.ribbonHook === false), 'Foreground, artwork and action SVG elements retain their opacity and remain outside the ribbon hook');
          style.frame = frame;
          await moduleHeader().hover(); assert.equal((await edge(moduleHeader())).name, 'none'); assert.equal((await edge(dock())).name, 'none');
        }
        await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await dock().focus(); await expect(dock()).toBeFocused(); assert.ok(parseFloat(await dock().evaluate(node => getComputedStyle(node).outlineWidth)) >= 2); await page.keyboard.press('Tab'); await expect(action()).toBeFocused(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => window.fixtureEvents.filter(row => row.kind === 'title-shimmer-action').length), 1, 'Native action and keyboard command remain usable'); assert.deepEqual(await geometry(), g, 'Keyboard and animation never move the Header or actions');
        if (!moduleTitleShimmerBefore) { assert.equal((await edge(moduleHeader())).name, 'none'); assert.equal((await edge(dock())).name, 'none'); }
        await noOverflow(); await screenshot(`module-title-${moduleTitleShimmerBefore ? 'before-' : ''}${width}-${length}-${alias}-rtl`); variants.push({ length, alias, geometry: g, style, exactHeadingAndArabicText: true, keyboardActionPreserved: true, beforeGeometryEqual: Boolean(before) });
      }
      for (const length of ['short', 'long']) { const group = variants.filter(row => row.length === length); assert.deepEqual(group[0].geometry, group[1].geometry); assert.deepEqual(group[0].geometry, group[2].geometry); }
      cases.push({ surface: moduleTitleShimmerBefore ? 'module-title-before-geometry' : 'module-title-current-inheritance', width, variants, oneNativeH1PerPage: true, noTextDuplicationOrLetterSplit: true, preservedGeometryAndTypography: true, frozenBeforeCompared: Boolean(before) });
      if (moduleTitleShimmerBefore) continue;

      await open('title-shimmer-long-omitted'); await title().hover(); const initialGeometry = await geometry(), frames = [];
      for (let index = 0; index < 14; index += 1) {
        const style = await titleStyle(), name = `module-title-${width}-natural-phase-${String(index).padStart(2, '0')}`; await screenshot(name, title()); const bytes = await readFile(path.join(output, name + '.png')), raw = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let goldCount = 0, goldX = 0, whiteCount = 0;
        for (let y = 0; y < raw.info.height; y += 1) for (let x = 0; x < raw.info.width; x += 1) { const at = (y * raw.info.width + x) * raw.info.channels, r = raw.data[at], g = raw.data[at + 1], b = raw.data[at + 2]; if (r > 150 && g > 100 && r >= g && r - b > 20 && g - b > 8) { goldCount += 1; goldX += x; } if (r > 210 && g > 210 && b > 210 && Math.abs(r - b) < 12) whiteCount += 1; }
        frames.push({ file: name + '.png', sha256: hash(bytes), atMs: style.currentTime, positionPercent: parseFloat(style.position), playState: style.playState, goldCount, goldCentroidX: goldCount ? goldX / goldCount : null, whiteCount, width: raw.info.width, height: raw.info.height }); assert.deepEqual(await geometry(), initialGeometry, 'Natural title animation has zero Header/Dock/Action layout shift'); assert.equal((await edge(moduleHeader())).name, 'none'); assert.equal((await edge(dock())).name, 'none'); await page.waitForTimeout(170);
      }
      assert.ok(new Set(frames.map(frame => frame.sha256)).size >= 4, 'Natural wall-time screenshots show changing rendered glyph pixels'); assert.ok(frames.some(frame => frame.goldCount > 20)); assert.ok(frames.some(frame => frame.whiteCount > 20)); assert.ok(frames.every(frame => frame.playState === 'running'));
      const leftward = frames.slice(1).map((frame, index) => ({ from: index, to: index + 1, deltaX: frame.goldCentroidX - frames[index].goldCentroidX, phaseDelta: frame.positionPercent - frames[index].positionPercent })).filter(pair => frames[pair.from].goldCount > 20 && frames[pair.to].goldCount > 20 && pair.phaseDelta > 0.5 && pair.deltaX < -frames[pair.from].width * 0.02);
      assert.ok(leftward.length >= 1, 'Rendered gold glyph centroid moves physically right to left during increasing native background phase: ' + JSON.stringify(frames)); cases.push({ surface: 'module-title-natural-rendered-shimmer', width, frames, leftwardPixelPairs: leftward, noCssOrAnimationTimeInjection: true, naturalWallTimeOnly: true, noLayoutShift: true, moduleAndDockBordersStatic: true });

      await page.emulateMedia({ reducedMotion: 'reduce' }); await open('title-shimmer-long-omitted'); const reduced = await titleStyle(); assert.equal(reduced.name, 'none'); assert.equal(reduced.image, 'none'); assert.equal(reduced.color, 'rgb(246, 247, 250)'); assert.equal(reduced.fill, 'rgb(246, 247, 250)'); assert.deepEqual(await geometry(), initialGeometry); await title().hover(); await dock().focus(); assert.equal((await edge(moduleHeader())).name, 'none'); assert.equal((await edge(dock())).name, 'none'); await screenshot(`module-title-${width}-reduced-motion-rtl`); cases.push({ surface: 'module-title-reduced-motion', width, reduced, staticWhiteReadable: true, sameGeometry: true });

      await page.emulateMedia({ reducedMotion: 'no-preference' }); await open('dashboard'); const systemMotion = await activeEdge(page.locator('[data-admin-shell-header]'), 'hover'); const metric = page.locator('[data-admin-metric-presentation="cinematic"]').first(), metricMotion = await activeEdge(metric, 'hover'); await expect.poll(async () => (await motion(metric)).transform).toMatch(/-4\)/u); await screenshot(`module-title-${width}-protected-system-kpi-rtl`);
      await open('topics'); const grid = page.locator('[data-admin-entity-list-table-region]'); await grid.getByRole('button', { name: 'الفلاتر', exact: true }).hover(); const gridMotion = await motion(grid); assert.equal(gridMotion.edge.animationName, 'admin-edge-trace'); assert.equal(gridMotion.edge.animationDuration, '1.15s'); assert.equal(await grid.evaluate(node => getComputedStyle(node, '::after').animationIterationCount), '1');
      let sidebar; if (width === 1440) { const aside = page.locator('[data-admin-navigation]:visible'); await expect(aside).toHaveAttribute('data-admin-sidebar-mode', 'expanded'); sidebar = await aside.evaluate(node => ({ width: node.getBoundingClientRect().width, position: getComputedStyle(node).position })); assert.equal(sidebar.width, 304); } else { const trigger = page.locator('[data-admin-shell-header]').getByRole('button', { name: 'فتح القائمة', exact: true }); await trigger.click(); await expect(page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true })).toHaveCount(0); await expect(trigger).toBeFocused(); sidebar = { mobileDrawerEscapeAndFocusRestoration: true }; }
      await noOverflow(); cases.push({ surface: 'module-title-protected-existing-owners', width, systemMotion, metricMotion, gridMotion, sidebar, systemKpiGridSidebarBehaviorRetained: true });

      const visualFamilies = [
        { surface: 'dashboard', count: 6, values: dashboardValues, artwork: ['content', 'published', 'projects', 'pages', 'media', 'taxonomy'], headerArtwork: 'statistics', buttons: 0 },
        { surface: 'topics', count: 6, values: ['901', '203', '698', '84', '23', '87/100'], artwork: ['content', 'published', 'unpublished', 'series', 'featured', 'seo'], headerArtwork: 'document', buttons: 5 },
        { surface: 'categories', count: 5, values: ['24', '322', '21', '12', '12'], artwork: ['taxonomy', 'content', 'series', 'published', 'unpublished'], headerArtwork: 'hierarchy', buttons: 3 },
        { surface: 'series', count: 5, values: ['24', '262', '10.9', '12', '12'], artwork: ['series', 'content', 'series', 'published', 'unpublished'], headerArtwork: 'linked-content', buttons: 3 },
        { surface: 'construction', count: 3, values: ['3', '9', '23'], artwork: ['projects', 'series', 'content'], headerArtwork: 'construction', buttons: 0 },
      ];
      for (const family of visualFamilies) {
        await page.mouse.move(0, 0); await open(family.surface); const header = page.locator('[data-admin-page-header]:visible'), metrics = page.locator('[data-admin-metric-presentation="cinematic"]'); await expect(header).toHaveCount(1); await expect(header).toHaveAttribute('data-admin-page-header-visual-preset', family.surface); await expect(header.locator('[data-admin-header-icon]')).toHaveCount(1); await expect(header.locator('[data-admin-header-icon]')).toHaveAttribute('aria-hidden', 'true'); await expect(header.locator('[data-admin-header-artwork]')).toHaveCount(1); await expect(header.locator('[data-admin-header-artwork]')).toHaveAttribute('data-admin-header-artwork', family.headerArtwork); await expect(metrics).toHaveCount(family.count); await expect(metrics.filter({ has: page.locator('[data-admin-metric-artwork]') })).toHaveCount(family.count);
        const titleMotion = await moduleTitleMotion(header);
        const snapshot = await metrics.evaluateAll(nodes => nodes.map(node => {
          const content = node.querySelector('[data-admin-metric-content]'), icon = node.querySelector('[data-admin-metric-icon]'), art = node.querySelector('[data-admin-metric-artwork]'), value = content.querySelector('p[dir="ltr"]'), s = getComputedStyle(node), artStyle = getComputedStyle(art);
          return { label: content.querySelector('p').textContent, value: value.textContent, kind: art.getAttribute('data-admin-metric-artwork'), art: { hidden: art.getAttribute('aria-hidden'), focusable: art.getAttribute('focusable'), opacity: artStyle.opacity, pointer: artStyle.pointerEvents, z: Number(artStyle.zIndex), position: artStyle.position, paths: [...art.querySelectorAll('path')].map(path => path.getAttribute('d')) }, icon: { hidden: icon.getAttribute('aria-hidden'), svg: icon.querySelector('svg').outerHTML, paths: [...icon.querySelectorAll('path')].map(path => path.getAttribute('d')), z: Number(getComputedStyle(icon).zIndex) }, contentZ: Number(getComputedStyle(content).zIndex), tag: node.tagName, minHeight: s.minHeight, height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width, padding: s.padding, valueSize: getComputedStyle(value).fontSize, valueOpacity: getComputedStyle(value).opacity, pressed: node.getAttribute('aria-pressed') };
        }));
        await writeFile(path.join(output, `visual-completeness-${family.surface}-${width}-measured.json`), JSON.stringify({ family: family.surface, width, snapshot }, null, 2) + '\n');
        assert.deepEqual(snapshot.map(row => row.value), family.values, 'Actual finite read-model values retain their real component binding'); assert.deepEqual(snapshot.map(row => row.kind), family.artwork, 'Every applicable real card receives its registered semantic scene'); assert.equal(snapshot.filter(row => row.tag === 'BUTTON').length, family.buttons);
        snapshot.forEach(row => { assert.equal(row.art.hidden, 'true'); assert.equal(row.art.focusable, 'false'); assert.equal(row.art.pointer, 'none'); assert.equal(row.art.position, 'absolute'); assert.ok(Number(row.art.opacity) > 0 && Number(row.art.opacity) <= .12); assert.ok(row.art.paths.length > 0); assert.ok(row.contentZ > row.art.z && row.icon.z > row.art.z); assert.equal(row.icon.hidden, 'true'); assert.equal(row.minHeight, '132px'); assert.equal(row.padding, '12px'); assert.equal(row.valueSize, '32px'); assert.equal(row.valueOpacity, '1'); assert.ok(row.height >= 132 - 1e-7, '132px rendered minimum allows only floating-point rectangle subtraction noise: ' + JSON.stringify(row)); assert.notEqual(row.art.paths.join('|'), row.icon.paths.join('|'), 'Semantic background scene is not a copy of the foreground icon paths'); if (row.tag === 'DIV') assert.equal(row.pressed, null); });
        const headerArt = await header.locator('[data-admin-header-artwork]').evaluate(node => { const s = getComputedStyle(node); return { pointer: s.pointerEvents, hidden: node.getAttribute('aria-hidden'), opacity: s.opacity, focusable: node.querySelector('svg').getAttribute('focusable') }; }); assert.equal(headerArt.pointer, 'none'); assert.equal(headerArt.hidden, 'true'); assert.equal(headerArt.focusable, 'false');
        const gridColumns = await metrics.first().evaluate(node => getComputedStyle(node.parentElement).gridTemplateColumns.split(' ').length); assert.equal(gridColumns, width === 1440 ? family.count : 2, 'Real item count fills each current grid without a synthetic card');
        await noOverflow(); await screenshot(`visual-completeness-${family.surface}-${width}-rtl`);
        const first = metrics.first(); await first.hover(); await expect.poll(async () => (await motion(first)).transform).toMatch(/-4\)/u); const hover = await motion(first); assert.equal(hover.edge.animationName, 'admin-edge-trace');
        if (family.buttons) { const published = metrics.filter({ has: page.locator('[data-admin-metric-content] p', { hasText: /^منشور$/u }) }); await page.keyboard.press('Tab'); await published.focus(); await page.keyboard.press('Enter'); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('published'); await expect(published).toHaveAttribute('aria-pressed', 'true'); await metrics.first().click(); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe(null); }
        await page.emulateMedia({ reducedMotion: 'reduce' }); await first.hover(); const reducedMetric = await motion(first); assert.equal(reducedMetric.edge.animationName, 'none'); assert.ok(reducedMetric.transform === 'none' || reducedMetric.transform === 'matrix(1, 0, 0, 1, 0, 0)'); assert.equal(await header.locator('h1').evaluate(node => getComputedStyle(node).color), 'rgb(246, 247, 250)'); await page.emulateMedia({ reducedMotion: 'no-preference' });
        cases.push({ surface: 'visual-completeness-' + family.surface, width, actualConsumerMounted: true, ...(family.surface === 'construction' ? { boundary: 'Exact async Server Page called through finite fixture-only auth/read ports, then its actual element tree renders; hosted auth/read correctness not claimed.' } : family.surface === 'categories' || family.surface === 'series' ? { boundary: 'Actual list client plus exact AST-extracted Header JSX from its current route; finite HTTP read ports; Domain/Preference Actions denied.' } : {}), snapshot, headerArt, titleMotion, foregroundIconsAndMetricFactsPreserved: true, explicitRequiredSemanticArtwork: true, noSyntheticSixthCard: true, existingFilterKeyboardCallbacksRetained: true, hover, reducedMotionRetained: true });
      }
    }
    assert.deepEqual(gridTransport.actions, []); assert.ok(requests.every(row => row.method === 'GET'));
  }
  async function verifyKpiAdoption() {
    const cards = () => page.locator('[data-admin-metric-presentation="cinematic"]');
    const rows = () => page.locator('tbody tr[data-entity-row-id]');
    const ids = () => rows().evaluateAll(nodes => nodes.map(node => Number(node.dataset.entityRowId)));
    const labels = ['إجمالي التصنيفات', 'إجمالي الموضوعات', 'إجمالي السلاسل', 'منشور', 'غير منشور'];
    const values = ['24', '322', '21', '12', '12'];
    const readCards = () => cards().evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node), content = node.querySelector('[data-admin-metric-content]'), icon = node.querySelector('[data-admin-metric-icon]'), label = content.querySelector('p'), value = content.querySelector('p[dir="ltr"]');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d'), color = style.getPropertyValue('--admin-metric-color').trim(), colors = /(?:rgba?|color)\([^)]*\)/gu, pixel = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = 'transparent'; context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
      const paint = { color, border: style.borderColor, shadow: style.boxShadow, shadowShape: style.boxShadow.replace(colors, 'COLOR'), shadowColors: [...style.boxShadow.matchAll(colors)].map(match => pixel(match[0])), expectedShadowColors: [60, 9, 8].map(percent => pixel('color-mix(in srgb, ' + color + ' ' + percent + '%, transparent)')).concat([pixel('rgba(0,0,0,0.65)')]), borderPixel: pixel(style.borderColor), expectedBorderPixel: pixel(node.getAttribute('aria-pressed') === 'true' ? color : 'color-mix(in srgb, ' + color + ' 25%, transparent)'), activeRingColor: pixel(color) };
      return { tag: node.tagName, label: label.textContent, value: value.textContent, type: node.getAttribute('type'), tabIndex: node.getAttribute('tabindex'), pressed: node.getAttribute('aria-pressed'), cursor: style.cursor, minHeight: style.minHeight, padding: style.padding, radius: style.borderRadius, background: style.backgroundImage, paint, labelSize: getComputedStyle(label).fontSize, valueSize: getComputedStyle(value).fontSize, valueWeight: getComputedStyle(value).fontWeight, icon: icon ? { hidden: icon.getAttribute('aria-hidden'), width: getComputedStyle(icon).width, svg: icon.querySelector('svg')?.outerHTML } : null, artwork: node.querySelector('[data-admin-metric-artwork]')?.getAttribute('data-admin-metric-artwork') ?? null };
    }));
    function premiumPaint(snapshot) { snapshot.forEach(row => { const paint = row.paint; assert.equal(paint.shadowColors.length, 8, 'Four existing Tailwind ring slots compose with exactly four approved KPI shadows'); assert.ok(paint.shadowShape.endsWith('COLOR 0px 2px 0px 0px inset, COLOR 0px 8px 18px 0px inset, COLOR 0px 0px 18px 0px, COLOR 0px 20px 45px 0px'), 'Premium Hybrid keeps exact normal inset/glow/depth geometry: ' + paint.shadow); paint.shadowColors.slice(-4).forEach((pixel, index) => pixel.forEach((value, channel) => assert.ok(Math.abs(value - paint.expectedShadowColors[index][channel]) <= 1, 'Actual semantic shadow color/alpha matches its approved mix within one raster channel step'))); paint.borderPixel.forEach((value, channel) => assert.ok(Math.abs(value - paint.expectedBorderPixel[channel]) <= 1, 'Normal border remains 25 percent or full semantic color when active')); if (row.pressed === 'true') { assert.ok(paint.shadowShape.includes('COLOR 0px 0px 0px 1px'), 'Active ring remains physically visible in the composed shadow'); assert.ok(paint.shadowColors.slice(0, 4).some(pixel => pixel.every((value, channel) => Math.abs(value - paint.activeRingColor[channel]) <= 1)), 'Active ring retains the full semantic color'); } }); }
    async function assertCategories() {
      await outside(); await expect.poll(() => cards().evaluateAll(nodes => nodes.reduce((count, node) => count + node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length, 0))).toBe(0);
      await expect(cards()).toHaveCount(5); await expect(rows()).toHaveCount(10);
      await expect(page.locator('[data-admin-metric-grid-presentation="cinematic"]')).toHaveCount(1);
      const snapshot = await readCards();
      premiumPaint(snapshot);
      assert.deepEqual(snapshot.map(row => row.label), labels); assert.deepEqual(snapshot.map(row => row.value), values);
      assert.deepEqual(snapshot.map(row => row.tag), ['BUTTON', 'DIV', 'DIV', 'BUTTON', 'BUTTON']);
      snapshot.forEach((row, index) => { assert.equal(row.minHeight, '132px'); assert.equal(row.padding, '12px'); assert.equal(row.valueSize, '32px'); assert.equal(row.valueWeight, '700'); assert.equal(row.labelSize, '13px'); assert.ok(row.icon?.svg); assert.equal(row.icon.hidden, 'true'); assert.equal(row.artwork, ['taxonomy', 'content', 'series', 'published', 'unpublished'][index], 'Categories explicitly adopts its approved semantic artwork without changing foreground icons'); assert.equal(row.cursor, row.tag === 'BUTTON' ? 'pointer' : 'default'); assert.equal(row.tabIndex, null); if (row.tag === 'BUTTON') assert.equal(row.type, 'button'); else assert.equal(row.pressed, null); });
      const grid = page.locator('[data-admin-metric-grid-presentation]');
      const geometry = await grid.evaluate(node => ({ columns: getComputedStyle(node).gridTemplateColumns.split(' ').length, width: node.getBoundingClientRect().width, childWidths: [...node.children].map(child => child.getBoundingClientRect().width), gap: parseFloat(getComputedStyle(node).columnGap) }));
      assert.equal(geometry.columns, page.viewportSize().width >= 1280 ? 5 : 2, 'Actual five-card Categories grid does not retain a phantom sixth desktop track');
      if (geometry.columns === 5) assert.ok(Math.abs(geometry.childWidths.reduce((a, b) => a + b, 0) + geometry.gap * 4 - geometry.width) < 1);
      return snapshot;
    }
    async function outside() { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
      await open('categories'); const before = await assertCategories(); const initialIds = await ids();
      await outside(); await noOverflow(); await screenshot(`kpi-categories-${width}-default-rtl`);
      const published = () => cards().filter({ has: page.locator('[data-admin-metric-content] p', { hasText: /^منشور$/u }) });
      const total = () => cards().filter({ has: page.locator('[data-admin-metric-content] p', { hasText: /^إجمالي التصنيفات$/u }) });
      const unpublished = () => cards().filter({ has: page.locator('[data-admin-metric-content] p', { hasText: /^غير منشور$/u }) });
      const requestCount = requests.length; await cards().nth(1).click(); await page.waitForTimeout(120); assert.equal(requests.length, requestCount, 'A static KPI does not navigate or load a filter'); assert.deepEqual(await ids(), initialIds);
      const hover = await activeEdge(published(), 'hover'); await expect.poll(async () => (await motion(published())).transform).toMatch(/-4\)/u); await screenshot(`kpi-categories-${width}-hover-rtl`); await outside();
      await page.keyboard.press('Tab'); await published().focus(); await expect(published()).toBeFocused(); await expect.poll(async () => (await motion(published())).transform).toMatch(/-4\)/u); const focus = await motion(published()); assert.ok(parseFloat(focus.outlineWidth) >= 2); await screenshot(`kpi-categories-${width}-focus-rtl`);
      await page.keyboard.press('Enter'); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('published'); await expect(published()).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('[data-admin-entity-list-pending="false"]')).toHaveCount(1); assert.equal((await ids()).length, 10);
      await unpublished().click(); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('unpublished'); await expect(unpublished()).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('[data-admin-entity-list-pending="false"]')).toHaveCount(1); const unpubIds = await ids(); assert.ok(unpubIds.every(id => (id - 81001) % 2 === 1));
      await total().focus(); await page.keyboard.press('Space'); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe(null); await expect(total()).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('[data-admin-entity-list-pending="false"]')).toHaveCount(1); assert.deepEqual(await ids(), initialIds); assert.deepEqual((await readCards()).map(row => row.icon.svg), before.map(row => row.icon.svg));
      await open('categories'); await assertCategories(); holdReads = true; const pendingIds = await ids(); await published().click(); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.deepEqual(await ids(), pendingIds); assert.deepEqual((await readCards()).map(row => row.value), values); await screenshot(`kpi-categories-${width}-pending-rtl`); holdReads = false; while (held.length) held.shift()(); await expect(page.locator('[data-admin-entity-list-pending="false"]')).toHaveCount(1);
      await open('categories'); await assertCategories(); const failureIds = await ids(); failReads = true; await unpublished().click(); await expect(page.getByRole('alert')).toContainText(/Unable to load|Controlled read/u); assert.deepEqual(await ids(), failureIds); assert.deepEqual((await readCards()).map(row => row.value), values); await screenshot(`kpi-categories-${width}-read-error-rtl`); failReads = false;
      cases.push({ surface: 'kpi-actual-categories-default', width, labels, values, actualClientMounted: true, staticCount: 2, filterButtons: 3, preservedIcons: true, requiredSemanticArtwork: true, keyboardEnterSpaceAndExactFilters: true, resetRestoresExactIds: true, pendingAndReadFailureRetainFactsAndIds: true, hover, focus });

      await open('kpi-probes'); await expect(cards()).toHaveCount(10); const aliasSnapshots = [];
      for (const alias of ['omitted', 'default', 'cinematic']) {
        const scope = page.locator(`[data-kpi-alias="${alias}"]`), staticCard = scope.locator('[data-admin-metric-presentation]').first(), interactive = scope.getByRole('button');
        await expect(scope.locator('[data-admin-metric-grid-presentation="cinematic"]')).toHaveCount(1); await expect(staticCard).toHaveText(/0\/100/u); assert.equal(await staticCard.evaluate(node => node.tagName), 'DIV'); await expect(interactive).toHaveAttribute('aria-pressed', 'true'); await interactive.click(); assert.ok(await page.evaluate(value => window.fixtureEvents.some(row => row.kind === 'kpi-alias-click' && row.alias === value), alias));
        await outside(); aliasSnapshots.push(await staticCard.evaluate(node => { const s = getComputedStyle(node), icon = node.querySelector('[data-admin-metric-icon]'), value = node.querySelector('p[dir="ltr"]'); return { minHeight: s.minHeight, padding: s.padding, radius: s.borderRadius, background: s.backgroundImage, color: s.color, valueSize: getComputedStyle(value).fontSize, iconWidth: getComputedStyle(icon).width, authoredSvg: icon.querySelector('svg').getAttribute('stroke-width'), tabIndex: node.getAttribute('tabindex'), cursor: s.cursor }; }));
      }
      assert.deepEqual(aliasSnapshots[0], aliasSnapshots[1]); assert.deepEqual(aliasSnapshots[0], aliasSnapshots[2]); await noOverflow(); await screenshot(`kpi-owner-aliases-${width}-rtl`); cases.push({ surface: 'kpi-official-default-aliases', width, aliases: ['omitted', 'default', 'cinematic'], identicalComputedGeometryAndPalette: true, zeroSuffixAndIconPreserved: true, nativeStaticAndInteractiveContracts: true, snapshots: aliasSnapshots });
      for (const count of [3, 1]) { const grid = page.locator(`[data-kpi-count="${count}"] [data-admin-metric-grid-presentation]`); await expect(grid.locator(':scope > *')).toHaveCount(count); assert.equal(await grid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), width >= 1280 ? count : Math.min(count, 2), 'Existing Grid fills the real count up to each responsive ceiling'); }

      const representatives = [];
      for (const surface of ['dashboard', 'topics']) { await open(surface); await expect(cards()).toHaveCount(6); await outside(); await expect.poll(() => cards().evaluateAll(nodes => nodes.reduce((count, node) => count + node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length, 0))).toBe(0); const snapshot = await readCards(); premiumPaint(snapshot); assert.deepEqual(snapshot.map(row => row.value), surface === 'dashboard' ? dashboardValues : ['901', '203', '698', '84', '23', '87/100']); assert.ok(snapshot.every(row => row.minHeight === before[0].minHeight && row.padding === before[0].padding && row.radius === before[0].radius && row.valueSize === before[0].valueSize)); assert.equal(snapshot.filter(row => row.tag === 'BUTTON').length, surface === 'dashboard' ? 0 : 5); if (surface === 'topics') { await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'منشور', exact: true }).click(); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('published'); } await noOverflow(); await screenshot(`kpi-reference-${surface}-${width}-rtl`); representatives.push({ surface, values: snapshot.map(row => row.value), paint: snapshot.map(row => row.paint), sameCanonicalGeometry: true, retainedArtwork: snapshot.map(row => row.artwork), staticOrFilteringSemantics: true }); }
      cases.push({ surface: 'kpi-unchanged-dashboard-topics-reference', width, representatives });

      await page.emulateMedia({ reducedMotion: 'reduce' }); await open('categories'); await assertCategories(); await published().hover(); await published().focus(); const reduced = await motion(published()); assert.equal(reduced.edge.animationName, 'none'); assert.ok(reduced.transform === 'none' || reduced.transform === 'matrix(1, 0, 0, 1, 0, 0)'); assert.ok(reduced.transitionDuration.split(',').every(value => parseFloat(value) <= 0.001)); await noOverflow(); await screenshot(`kpi-categories-${width}-reduced-motion-rtl`); cases.push({ surface: 'kpi-categories-reduced-motion', width, reduced, noAnimationOrLift: true });
    }
    assert.deepEqual(gridTransport.actions, []); assert.ok(requests.every(row => row.method === 'GET')); assert.equal(await page.evaluate(() => window.fixtureEvents.filter(row => row.kind === 'denied-action').length), 0);
  }
  async function verifySystemwideAdoption() {
    const cursor = async (target, expected) => { await expect(target).toBeVisible(); try { await expect.poll(() => target.evaluate(element => getComputedStyle(element).cursor)).toBe(expected); } catch (error) { const details = await target.evaluate(element => ({ html: element.outerHTML, cursor: getComputedStyle(element).cursor, disabled: element.matches(':disabled'), ariaDisabled: element.getAttribute('aria-disabled'), parents: [element.parentElement, element.parentElement?.parentElement].filter(Boolean).map(node => ({ html: node.outerHTML.slice(0, 500), cursor: getComputedStyle(node).cursor })) })); throw new Error('Cursor expected ' + expected + ': ' + JSON.stringify(details), { cause: error }); } };
    const rows = () => page.locator('tbody tr[data-entity-row-id]');
    const rowIds = () => rows().evaluateAll(nodes => nodes.map(node => Number(node.dataset.entityRowId)));
    const edge = target => target.evaluate(element => { const s = getComputedStyle(element, '::after'); return { content: s.content, name: s.animationName, iterations: s.animationIterationCount, duration: s.animationDuration, pointerEvents: s.pointerEvents }; });
    const toolbar = () => page.locator('[data-admin-collection-toolbar-owner]');
    async function outside() { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); }
    async function actualFrame(surface, width) {
      const grid = page.locator('[data-admin-data-grid-presentation="cinematic"]').first(); await expect(grid).toBeVisible();
      const region = page.locator('[data-admin-entity-list-table-region]').first(), framed = await region.count() ? region : grid;
      await expect(framed).toHaveAttribute('data-admin-edge-motion', 'entry');
      await framed.scrollIntoViewIfNeeded(); await outside(); await framed.hover({ position: { x: 6, y: 6 } });
      const frameEdge = await edge(framed); assert.equal(frameEdge.name, 'admin-edge-trace'); assert.equal(frameEdge.iterations, '1'); assert.equal(frameEdge.duration, '1.15s'); assert.equal(frameEdge.pointerEvents, 'none');
      if (await region.count()) { const nested = await edge(grid); assert.equal(nested.content, 'none', 'Only the actual TableRegion traces the composed collection edge'); assert.equal(nested.name, 'none'); }
      await screenshot(`systemwide-${surface}-${width}-rtl`); return { frameEdge, nestedGridSuppressed: await region.count() > 0, geometry: await noOverflow() };
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await open('dashboard'); const dashboardCards = page.locator('[data-admin-metric-presentation="cinematic"]'); await expect(dashboardCards).toHaveCount(6);
      for (const card of await dashboardCards.all()) { assert.equal(await card.evaluate(element => element.tagName), 'DIV'); await cursor(card, 'default'); }
      await cursor(page.locator('[data-admin-shell-header]').getByRole('button', { name: /خروج/u }), 'pointer'); await screenshot(`systemwide-dashboard-${width}-rtl`);
      await open('topics'); const published = page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'منشور', exact: true }); await cursor(published, 'pointer'); await published.click(); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('published'); await expect.poll(() => rows().count()).toBe(10);
      await cursor(toolbar().locator('input').first(), 'text'); await cursor(page.locator('th[data-admin-column-key="title"] button'), 'pointer'); await cursor(page.locator('thead input[type="checkbox"]'), 'pointer');
      await cursor(page.locator('[data-admin-pagination-slot="page"][aria-current="page"]'), 'default');
      const more = rows().first().locator('[data-admin-row-action="more"] button'); await more.click(); const menu = page.locator('[data-admin-row-actions-menu]'); await expect(menu).toBeVisible(); const available = menu.locator('[data-admin-row-action-menu-item]:not([aria-disabled="true"])').first(); await cursor(available, 'pointer'); await page.keyboard.press('Escape'); await expect(more).toBeFocused();
      const topicsFrame = await actualFrame('topics', width); cases.push({ surface: 'systemwide-dashboard-topics-cursors', width, dashboardDecorativeMetricDefault: true, topicsInteractiveMetricFiltersExactQuery: true, nativeInputsSortPaginationAndPortalCursors: true, menuEscapeFocus: true, ...topicsFrame });

      for (const family of ['categories', 'projects', 'locations']) {
        await open(family); await expect.poll(() => rows().count()).toBe(10); const initialIds = await rowIds();
        await expect(page.locator('[data-admin-data-grid-presentation="default"]')).toHaveCount(0); await expect(page.locator('[data-admin-pagination-presentation="cinematic"]')).toHaveCount(1);
        await expect(page.locator('thead input[type="checkbox"],tbody input[type="checkbox"],[data-admin-bulk-action-bar]')).toHaveCount(0);
        const search = toolbar().locator('input').first(); await cursor(search, 'text'); await search.fill('07'); await search.press('Enter'); await expect.poll(() => rows().count()).toBe(1); assert.equal(new URL(page.url()).searchParams.get('q'), '07');
        await toolbar().getByRole('button', { name: 'مسح', exact: true }).click(); await expect.poll(rowIds).toEqual(initialIds);
        const sort = page.locator('thead th[data-admin-column-key] button').first(); await cursor(sort, 'pointer'); await sort.click(); await expect.poll(() => new URL(page.url()).searchParams.get('sort')).not.toBe(null); await expect.poll(() => rows().count()).toBe(10);
        await page.locator('[data-admin-filter-trigger]').click(); const filter = page.getByRole('dialog', { name: 'الفلاتر', exact: true }); await expect(filter).toBeVisible(); const applyFilter = filter.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }); await expect(applyFilter).toBeDisabled(); await cursor(applyFilter, 'not-allowed'); await filter.getByRole('listbox').first().getByRole('option', { name: family === 'locations' ? 'نشط' : 'منشور', exact: true }).click(); await expect(applyFilter).toBeEnabled(); await cursor(applyFilter, 'pointer'); await page.keyboard.press('Escape'); await expect(page.locator('[data-admin-filter-trigger]')).toBeFocused();
        await toolbar().locator('[data-admin-toolbar-columns] button').click(); const columns = page.locator('[data-admin-column-menu]'); await expect(columns).toBeVisible(); await cursor(columns.locator('input[type="checkbox"]:not(:disabled)').first(), 'pointer'); await cursor(columns.locator('input[type="checkbox"]:disabled').first(), 'not-allowed'); await page.keyboard.press('Escape'); await expect(toolbar().locator('[data-admin-toolbar-columns] button')).toBeFocused();
        await page.locator('[data-admin-table-pagination] [data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2'); await expect.poll(() => rows().count()).toBe(10); assert.notDeepEqual(await rowIds(), initialIds);
        if (family === 'projects') assert.equal(new URL(page.url()).searchParams.get('type'), 'residential');
        const visual = await actualFrame(family, width); cases.push({ surface: 'systemwide-' + family, width, boundary: 'Actual named collection Client with controlled read-only paged data; route-level Header and hosted persistence are separate evidence.', searchClearSortPagination: true, filterAndColumnMenuKeyboard: true, selectionAndBulkNotInvented: true, lockedProjectType: family === 'projects', ...visual });
      }

      await open('modules'); const articles = page.locator('[data-admin-grid-row]'); await expect(articles).toHaveCount(10); const moduleCheck = articles.first().getByRole('checkbox'); await cursor(moduleCheck, 'pointer'); await moduleCheck.check(); await outside();
      await expect.poll(() => articles.first().locator(':scope > *').evaluateAll(nodes => nodes.every(element => getComputedStyle(element).backgroundColor === 'rgb(16, 32, 51)'))).toBe(true); await expect(page.locator('[data-admin-bulk-action-bar]')).toBeVisible(); await page.locator('[data-admin-bulk-action-bar]').getByRole('button', { name: 'إلغاء التحديد', exact: true }).click(); await expect(page.locator('[data-admin-bulk-action-bar]')).toHaveCount(0);
      const moduleVisual = await actualFrame('modules', width); cases.push({ surface: 'systemwide-content-modules', width, actualBoundedClientOwner: true, existingCheckboxSelectionAndBulkClear: true, navyLegacyRowAdoption: true, ...moduleVisual });

      await open('composition'); await expect(articles).toHaveCount(2); const compositionCheck = articles.first().getByRole('checkbox'); await compositionCheck.check(); await outside(); await expect.poll(() => articles.first().locator(':scope > *').evaluateAll(nodes => nodes.every(element => getComputedStyle(element).backgroundColor === 'rgb(16, 32, 51)'))).toBe(true);
      const handle = page.locator('[data-admin-grid-reorder-handle]').first(); await cursor(handle, 'grab'); await handle.hover(); await page.mouse.down(); await cursor(handle, 'grabbing'); await page.mouse.up(); await handle.focus(); await handle.press('End'); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'composition-local-reorder' && event.position === 1)));
      const compositionVisual = await actualFrame('composition', width); cases.push({ surface: 'systemwide-page-composition-subowner', width, boundary: 'Actual PageCompositionTableSurface + PageBlocksAssignmentsGrid/Row; existing shared Selection hook and local callback ports. Full PageBlocksClient save/publish is not claimed.', existingSelection: true, grabGrabbingAndKeyboardReorder: true, noHostedReorder: true, ...compositionVisual });

      await open('footer'); await expect(articles).toHaveCount(2); await expect(articles.locator('input[type="checkbox"]')).toHaveCount(0); await cursor(articles.first().locator('[title="تحريك لأعلى"]'), 'not-allowed'); await articles.first().locator('[title="تحريك لأسفل"]').click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'footer-local-change' && event.count === 2)));
      await articles.first().locator('[data-admin-row-action="edit"] button').click(); const footerModal = page.getByRole('dialog'); await expect(footerModal).toBeVisible(); await cursor(footerModal.getByRole('textbox').first(), 'text'); await page.keyboard.press('Escape'); await expect(footerModal).toHaveCount(0);
      const footerVisual = await actualFrame('footer', width); cases.push({ surface: 'systemwide-footer-links-subowner', width, boundary: 'Actual FooterLinksDataGrid editing local component state only; no Footer save action.', selectionNotInvented: true, localReorderRetained: true, disabledActionCursor: true, portalTextCursorAndEscape: true, ...footerVisual });

      await open('header-probes'); const probes = page.locator('[data-systemwide-header-probes]'), headers = probes.locator('[data-admin-page-header]'); await expect(headers).toHaveCount(5);
      for (const header of await headers.all()) { await expect(header).toHaveAttribute('data-admin-page-header-presentation', 'cinematic'); await expect(header).toHaveAttribute('data-admin-page-header-actions-presentation', 'cinematic'); }
      await expect(headers.first()).toHaveAttribute('data-admin-page-header-status', 'empty'); await expect(headers.first()).toContainText('الوصف الحقيقي محفوظ'); await expect(headers.first()).toContainText('12 عنصر'); await expect(headers.first()).toContainText('شارة محفوظة'); await expect(headers.first().getByRole('link', { name: 'مسار حقيقي', exact: true })).toHaveAttribute('href', '/admin'); for (let index = 0; index < 4; index += 1) await expect(headers.nth(index).locator('[data-admin-header-artwork]')).toHaveCount(0); await expect(headers.nth(4)).toHaveAttribute('data-admin-page-header-visual-preset', 'content'); await expect(headers.nth(4).locator('[data-admin-header-artwork="document"]')).toHaveCount(1);
      await expect(headers.nth(1).locator('a,button')).toHaveCount(0); await expect(headers.nth(3).getByRole('link', { name: 'العودة إلى القائمة', exact: true })).toHaveAttribute('href', '/admin/pages-blocks/blocks/content');
      const form = probes.locator('[data-systemwide-form-actions]'), save = form.getByRole('button', { name: 'حفظ النموذج', exact: true }); await expect(save).toHaveAttribute('type', 'submit'); await expect(save).toHaveAttribute('data-admin-action-presentation', 'cinematic'); await cursor(save, 'pointer'); await save.click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'form-native-submit'))); await cursor(form.getByRole('button', { name: 'إجراء معطل', exact: true }), 'not-allowed');
      const actionStyles = await form.locator('button').evaluateAll(nodes => nodes.map(element => { const s = getComputedStyle(element); return { label: element.textContent, height: element.getBoundingClientRect().height, image: s.backgroundImage, color: s.color, disabled: element.disabled }; })); assert.ok(actionStyles.every(item => item.height >= 44)); assert.ok(actionStyles[0].image.includes('gradient')); assert.equal(actionStyles[2].image, 'none'); assert.equal(actionStyles[3].image, 'none');
      const semantics = probes.locator('[data-cursor-semantic-probes]'); await cursor(semantics.getByRole('button', { name: 'زر دلالي', exact: true }), 'pointer'); await cursor(semantics.getByRole('button', { name: 'معطل أساسي', exact: true }), 'not-allowed'); await cursor(semantics.getByRole('button', { name: 'معطل افتراضي صريح', exact: true }), 'default'); await cursor(semantics.getByRole('button', { name: 'انتظار صريح', exact: true }), 'wait'); await cursor(semantics.getByRole('textbox', { name: 'نص دلالي', exact: true }), 'text'); await cursor(semantics.locator('input[type="file"]'), 'pointer'); await cursor(semantics.getByRole('radio'), 'pointer'); await cursor(semantics.getByRole('combobox'), 'pointer'); await semantics.locator('[data-decorative-hover]').hover(); await cursor(semantics.locator('[data-decorative-hover]'), 'default');
      await screenshot(`systemwide-header-wrappers-form-and-cursors-${width}-rtl`); cases.push({ surface: 'systemwide-header-wrappers-and-form-actions', width, boundary: 'Actual shared Header/wrapper/Button owners with local props/native submit; report/integration data views are not mounted.', omittedAndExplicitDefaultUseOfficialHeader: true, allWrappersAdopted: true, contentStatusBreadcrumbNoInventedActionsAndContextualArtwork: true, nativeFormSubmit: true, actionStyles, semanticFallbackCursorMatrix: true, disabledStateUtilitiesPreserved: true, decorativeHoverIsNotClickable: true, responsive: await noOverflow() });

      await open('modules'); await page.emulateMedia({ reducedMotion: 'reduce' }); await articles.first().hover(); const reducedGrid = await edge(page.locator('[data-admin-data-grid-presentation="cinematic"]').first()); assert.equal(reducedGrid.name, 'none'); const reducedCells = await articles.first().locator(':scope > *').evaluateAll(nodes => nodes.map(element => ({ property: getComputedStyle(element).transitionProperty, duration: getComputedStyle(element).transitionDuration }))); assert.ok(reducedCells.every(cell => cell.property === 'none' || cell.duration.split(',').every(value => parseFloat(value) === 0))); await page.emulateMedia({ reducedMotion: 'no-preference' }); cases.push({ surface: 'systemwide-reduced-motion', width, reducedGrid, reducedCells });
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await open('projects'); const retained = await rowIds(), projectSearch = toolbar().locator('input').first(); holdReads = true; await projectSearch.fill('08'); await projectSearch.press('Enter'); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.deepEqual(await rowIds(), retained); holdReads = false; while (held.length) held.shift()(); await expect.poll(() => rows().count()).toBe(1); const confirmed = await rowIds(); failReads = true; await projectSearch.fill('09'); await projectSearch.press('Enter'); await expect(page.getByRole('alert')).toContainText('Unable to load the requested list.'); assert.deepEqual(await rowIds(), confirmed); failReads = false; cases.push({ surface: 'systemwide-projects-query-failure', width: 1440, pendingRetainsRows: true, rejectedReadRetainsConfirmedRows: true, noSelectionOrBulkAdded: true });
    await page.goto(origin + '/__public-cursor'); assert.notEqual(await page.getByRole('button').evaluate(element => getComputedStyle(element).cursor), 'pointer'); cases.push({ surface: 'systemwide-cursor-public-scope-negative', sameCompiledCssWithoutAdminShell: true, adminCursorRulesInactive: true });
    assert.deepEqual(gridTransport.actions, [], 'Systemwide adoption invokes no domain or preference Action transport');
    assert.ok(!requests.some(request => request.method !== 'GET'), 'Representative adoption proof is read-only');
  }
  async function verifySidebarSelection() {
    const rows = () => page.locator('tbody tr[data-entity-row-id]');
    const ids = () => rows().evaluateAll(nodes => nodes.map(node => Number(node.dataset.entityRowId)));
    const toolbar = () => page.locator('[data-admin-collection-toolbar-owner]');
    const frame = () => page.locator('[data-admin-entity-list-table-region-presentation="cinematic"]');
    const bar = () => page.locator('[data-admin-bulk-action-bar]');
    const headerCheckbox = () => page.locator('thead input[type="checkbox"]');
    const paint = row => row.locator('td').evaluateAll(cells => cells.map(element => { const s = getComputedStyle(element); return { color: s.backgroundColor, image: s.backgroundImage, shadow: s.boxShadow, position: s.position }; }));
    const geometry = row => row.evaluate(element => { const r = element.getBoundingClientRect(), port = element.closest('[data-admin-data-grid-scroll]'), table = element.closest('table').getBoundingClientRect(); return { x: r.x + (port?.scrollLeft || 0), y: r.y - table.y, width: r.width, height: r.height, transform: getComputedStyle(element).transform }; });
    async function outside() { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); }
    async function settlePaint(row) { await expect.poll(() => row.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0); }
    async function settled(params = '') { await expect.poll(ids).toEqual(topicsResult('ready', new URLSearchParams(params)).rows.map(row => row.id)); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(0); }
    async function ready() { await open('topics'); await settled(); }
    const rgbaPaint = (actual, expected) => { const rgba = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/gu, colors = value => [...value.matchAll(rgba)].map(match => Number(match[4])); assert.equal(actual.replace(rgba, 'rgba($1, $2, $3, alpha)'), expected.replace(rgba, 'rgba($1, $2, $3, alpha)')); const observed = colors(actual), declared = colors(expected); assert.equal(observed.length, declared.length); observed.forEach((alpha, index) => { if (declared[index] === 0) assert.equal(alpha, 0); else assert.ok(Math.abs(alpha - declared[index]) <= 1 / 255, 'Compiled paint allows only Chromium alpha serialization rounding'); }); };
    function navy(cells, hovered = false) { assert.ok(cells.length > 0 && cells.every(cell => { const alphas = [...cell.image.matchAll(/rgba\(120,\s*189,\s*250,\s*([\d.]+)\)/gu)].map(match => Number(match[1])); return cell.color === (hovered ? 'rgb(20, 40, 61)' : 'rgb(16, 32, 51)') && alphas.length === 2 && Math.abs(alphas[0] - .035) <= .003 && Math.abs(alphas[1] - .012) <= .003; }), 'Every selected cell uses the approved navy/slate and two restrained cool stops, allowing Chromium alpha serialization rounding: ' + JSON.stringify(cells)); }
    function sameGeometry(before, after) { for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) <= 1, 'Selection/focus cannot move rows: ' + JSON.stringify({ before, after })); assert.ok(['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(after.transform)); }

    await page.setViewportSize({ width: 1440, height: 1000 }); await ready();
    const expanded = page.locator('[data-admin-navigation][data-admin-sidebar-mode="expanded"]');
    await expect(expanded).toHaveAttribute('data-admin-sidebar-presentation', 'default-v2');
    const registry = await page.evaluate(() => window.fixtureNavigation);
    assert.ok(registry.length > 5 && registry.every(item => item.enabled), 'Real resolved registry is supplied to the actual shell');
    const topLevel = await expanded.locator('[data-admin-nav-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-admin-nav-item')));
    assert.deepEqual(topLevel, registry.map(item => item.id), 'Current registry order and section identities are preserved');
    const contentGroup = expanded.locator('[data-admin-nav-group="content"]'), contentButton = contentGroup.locator('[data-admin-nav-item="content"]');
    await expect(contentButton).toHaveAttribute('aria-expanded', 'true'); await expect(contentButton).toHaveAttribute('data-admin-nav-active', 'true');
    const activeLeaf = expanded.locator('[data-admin-nav-child="topics"]'); await expect(activeLeaf).toHaveAttribute('aria-current', 'page'); await expect(activeLeaf).toHaveAttribute('href', '/admin/content/topics');
    await expect(expanded.locator('[aria-current="page"]')).toHaveCount(1);
    for (const item of registry) { const rendered = expanded.locator('[data-admin-nav-item="' + item.id + '"]'); await expect(rendered).toBeVisible(); if (!item.children?.length) await expect(rendered).toHaveAttribute('href', item.href); }
    await screenshot('sidebar-v2-1440-expanded-topics-rtl');
    await contentButton.click(); await expect(contentButton).toHaveAttribute('aria-expanded', 'false'); await expect(activeLeaf).not.toBeVisible();
    await page.keyboard.press('Tab'); await contentButton.focus(); await expect(contentButton).toBeFocused();
    const focus = await contentButton.evaluate(element => { const s = getComputedStyle(element); return { width: s.outlineWidth, style: s.outlineStyle }; }); assert.ok(parseFloat(focus.width) >= 2 && focus.style !== 'none');
    await contentButton.press('Enter'); await expect(activeLeaf).toBeVisible();
    await activeLeaf.focus(); await expect(activeLeaf).toBeFocused(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'prefetch' && event.href === '/admin/content/topics')));
    cases.push({ surface: 'sidebar-v2-expanded', width: 1440, registryIds: topLevel, activeParent: 'content', activeLeaf: 'topics', unchangedRegistryLinksAndOrder: true, activeGroupCanCloseAndReopen: true, keyboardFocus: focus, focusPrefetchRetained: true });

    await expanded.getByRole('button', { name: 'طي القائمة', exact: true }).click();
    const collapsed = page.locator('[data-admin-navigation][data-admin-sidebar-mode="collapsed"]'); await expect(collapsed).toBeVisible();
    const compactContent = collapsed.locator('[data-admin-nav-item="content"]'); await expect(compactContent).toHaveAttribute('aria-label', 'المحتوى'); await expect(compactContent).toHaveAttribute('data-admin-nav-active', 'true');
    await compactContent.click(); const submenu = page.locator('[data-admin-nav-submenu="content"]'); await expect(submenu).toBeVisible();
    for (const child of registry.find(item => item.id === 'content').children) await expect(submenu.locator('[data-admin-nav-child="' + child.id + '"]')).toHaveAttribute('href', child.href);
    await expect(submenu.locator('[data-admin-nav-child="topics"]')).toHaveAttribute('aria-current', 'page'); await screenshot('sidebar-v2-1440-collapsed-submenu-rtl');
    await page.keyboard.press('Escape'); await expect(submenu).not.toBeVisible(); await expect(compactContent).toBeFocused();
    await screenshot('sidebar-v2-1440-collapsed-rtl'); await page.reload(); await expect(collapsed).toBeVisible();
    await collapsed.getByRole('button', { name: 'فتح القائمة', exact: true }).click(); await expect(expanded).toBeVisible();
    cases.push({ surface: 'sidebar-v2-collapsed', width: 1440, activeAndAccessibleNamesRetained: true, allCurrentContentChildrenReachable: true, escapeReturnsGroupFocus: true, reloadPersistsCollapsedPreference: true, expandedRestored: true });

    await open('topics', 'ready', '/admin/projects/locations/new');
    await expect(expanded.locator('[data-admin-nav-item="projects"]')).toHaveAttribute('data-admin-nav-active', 'true');
    await expect(expanded.locator('[data-admin-nav-child="project-locations"]')).toHaveAttribute('aria-current', 'page'); await expect(expanded.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(expanded.locator('[data-admin-nav-child="projects-all"]')).not.toHaveAttribute('aria-current', 'page');
    await expanded.locator('[data-admin-nav-child="project-locations"]').click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'push' && event.href === '/admin/projects/locations')));
    await expect(page.locator('[data-admin-shell]')).toHaveAttribute('data-admin-navigation-pending', 'true');
    cases.push({ surface: 'sidebar-v2-nested-active-route', width: 1440, path: '/admin/projects/locations/new', mostSpecificLeafOnly: true, parentDistinct: true, actualRouterPushAndPendingSignal: true, boundary: 'Controlled Next router records the real link callback; hosted route data is not loaded.' });

    await page.setViewportSize({ width: 1440, height: 620 }); await ready(); const reports = expanded.locator('[data-admin-nav-item="reports"]'); await reports.click();
    await expanded.locator('[data-admin-nav-item="activity"]').scrollIntoViewIfNeeded();
    const scroll = await expanded.locator('nav').evaluate(element => { const r = element.getBoundingClientRect(); return { height: element.clientHeight, content: element.scrollHeight, overflow: getComputedStyle(element).overflowY, documentHeight: document.documentElement.scrollHeight, viewport: innerHeight, documentScroll: scrollY, navigationBottom: r.bottom }; });
    assert.equal(scroll.overflow, 'visible'); assert.ok(scroll.documentHeight > scroll.viewport && scroll.documentScroll > 0, 'Existing desktop document-scroll owner keeps long navigation reachable');
    const publicLink = expanded.getByRole('link', { name: 'الانتقال للموقع', exact: true }); await publicLink.scrollIntoViewIfNeeded(); await expect(publicLink).toBeVisible();
    const publicBounds = await publicLink.boundingBox(); assert.ok(publicBounds && publicBounds.y >= -1 && publicBounds.y + publicBounds.height <= 621);
    await screenshot('sidebar-v2-1440-short-viewport-scroll-rtl'); cases.push({ surface: 'sidebar-v2-scroll', width: 1440, height: 620, scroll, documentScrollOwnerPreserved: true, publicSiteLinkRetained: true });

    await page.setViewportSize({ width: 390, height: 844 }); await ready(); const trigger = page.locator('[data-admin-shell-header]').getByRole('button', { name: 'فتح القائمة', exact: true });
    await trigger.click(); const dialog = page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true }); await expect(dialog).toBeVisible(); await expect(dialog.locator('[data-admin-sidebar-mode="drawer"]')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'إغلاق قائمة الإدارة', exact: true })).toBeFocused();
    const modal = await dialog.evaluate(element => ({ bodyOverflow: getComputedStyle(document.body).overflow, mainInert: document.querySelector('main')?.inert, width: element.getBoundingClientRect().width, viewport: innerWidth, focusables: [...element.querySelectorAll('a[href],button,input,[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length).length }));
    assert.equal(modal.bodyOverflow, 'hidden'); assert.equal(modal.mainInert, true); assert.ok(modal.width <= modal.viewport + 1);
    const drawerScroll = await dialog.locator('nav').evaluate(element => { element.scrollTop = element.scrollHeight; return { overflow: getComputedStyle(element).overflowY, height: element.clientHeight, content: element.scrollHeight, top: element.scrollTop }; }); assert.equal(drawerScroll.overflow, 'auto'); assert.ok(drawerScroll.content > drawerScroll.height && drawerScroll.top > 0, 'Bounded mobile drawer owns long-menu scrolling');
    for (let index = 0; index <= modal.focusables; index++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Tab remains in the real mobile drawer'); }
    await screenshot('sidebar-v2-390-drawer-rtl'); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    assert.equal(await page.locator('main').evaluate(element => element.inert), false); assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    await trigger.click(); await dialog.getByRole('button', { name: 'إغلاق القائمة', exact: true }).click({ position: { x: 10, y: 10 } }); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    const mobileResponsive = await noOverflow(); await trigger.click(); await expect(dialog).toBeVisible(); await page.setViewportSize({ width: 1440, height: 1000 }); await expect(dialog).toHaveCount(0);
    assert.equal(await page.locator('main').evaluate(element => element.inert), false); assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    cases.push({ surface: 'sidebar-v2-mobile-drawer', width: 390, modal, drawerScroll, initialFocus: true, tabTrap: true, escapeAndBackdropClose: true, focusReturnAndScrollRestore: true, desktopResizeClearsDrawerAndLock: true, responsive: mobileResponsive });

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await ready(); await outside();
      const first = rows().first(), second = rows().nth(3), firstCheckbox = first.getByRole('checkbox'), secondCheckbox = second.getByRole('checkbox');
      await first.locator('[data-admin-column-key="title"]').scrollIntoViewIfNeeded(); await outside(); await settlePaint(first);
      const basePaint = await paint(first), initialGeometry = await geometry(first), currentIds = await ids();
      const collectionPaint = await frame().evaluate(node => { const s = getComputedStyle(node), toolbar = node.querySelector('[data-admin-collection-toolbar-owner]'); return { border: s.borderTopColor, shadow: s.boxShadow, background: s.backgroundImage, toolbarBackground: getComputedStyle(toolbar).backgroundImage, radius: s.borderRadius, padding: s.padding, overflow: [s.overflowX, s.overflowY] }; });
      rgbaPaint(collectionPaint.border, 'rgba(216, 176, 104, 0.045)');
      rgbaPaint(collectionPaint.shadow, 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(237, 200, 120, 0.52) 0px 2px 0px 0px inset, rgba(216, 176, 104, 0.035) 0px 6px 14px 0px inset, rgba(0, 0, 0, 0.55) 0px 12px 24px 0px, rgba(0, 0, 0, 0.42) 0px 28px 58px 0px');
      assert.equal(collectionPaint.background, 'linear-gradient(115deg, rgb(19, 28, 37), rgb(5, 12, 20) 55%, rgb(8, 15, 23))'); assert.equal(collectionPaint.toolbarBackground, 'linear-gradient(115deg, rgb(19, 30, 41), rgb(7, 17, 27))', 'Joined frame exposes the approved Toolbar background instead of covering it'); assert.equal(collectionPaint.radius, '20px'); assert.equal(collectionPaint.padding, '12px'); assert.deepEqual(collectionPaint.overflow, ['visible', 'visible']);
      await screenshot(`selection-v2-${width}-default-rtl`, frame()); await first.locator('[data-admin-column-key="title"]').hover(); await settlePaint(first); const hoverPaint = await paint(first);
      assert.ok(hoverPaint.every(cell => cell.color === 'rgb(13, 21, 29)' && cell.image.includes('0.035') && cell.image.includes('0.008')), 'Hover is quiet warm navy over the entire row'); assert.notDeepEqual(hoverPaint, basePaint); sameGeometry(initialGeometry, await geometry(first));
      await screenshot(`selection-v2-${width}-hover-rtl`, frame());
      await firstCheckbox.check(); await outside(); await settlePaint(first); const selectedPaint = await paint(first); navy(selectedPaint); sameGeometry(initialGeometry, await geometry(first));
      await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('1'); await expect(headerCheckbox()).not.toBeChecked(); assert.equal(await headerCheckbox().evaluate(element => element.indeterminate), true);
      const cue = await first.locator('td').first().evaluate(element => { const s = getComputedStyle(element, '::before'); return { width: s.width, color: s.backgroundColor, pointerEvents: s.pointerEvents }; }); assert.equal(cue.width, '2px'); assert.equal(cue.pointerEvents, 'none'); assert.notEqual(cue.color, 'rgba(0, 0, 0, 0)');
      const accent = await firstCheckbox.evaluate(element => getComputedStyle(element).accentColor); assert.notEqual(accent, 'auto');
      await screenshot(`selection-v2-${width}-single-rtl`, frame());
      await first.locator('[data-admin-column-key="title"]').hover(); await settlePaint(first); const singleSelectedHover = await paint(first); navy(singleSelectedHover, true); assert.notDeepEqual(singleSelectedHover, selectedPaint, 'Single selected row retains a distinct quiet hover over its approved navy selection'); await expect(firstCheckbox).toBeChecked(); await expect(first).toHaveAttribute('data-selected', 'true'); sameGeometry(initialGeometry, await geometry(first)); await screenshot(`selection-v2-${width}-single-hover-rtl`, frame()); await outside(); await settlePaint(first); navy(await paint(first));
      cases.push({ surface: 'selection-v2-single', width, collectionPaint, basePaint, hoverPaint, selectedPaint, singleSelectedHover, cue, accent, indeterminate: true, exactSelectedId: currentIds[0], noLayoutShift: true });

      await secondCheckbox.check(); await outside(); await settlePaint(second); navy(await paint(first)); navy(await paint(second)); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('2'); assert.equal(await headerCheckbox().evaluate(element => element.indeterminate), true);
      await screenshot(`selection-v2-${width}-multi-rtl`, frame());
      const selectedMultiHover = [];
      for (const [parity, selectedRow] of [['odd', first], ['even', second]]) { const beforeHover = await geometry(selectedRow); await selectedRow.locator('[data-admin-column-key="title"]').hover(); await settlePaint(selectedRow); const cells = await paint(selectedRow); navy(cells, true); await expect(selectedRow).toHaveAttribute('data-selected', 'true'); await expect(selectedRow.getByRole('checkbox')).toBeChecked(); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('2'); sameGeometry(beforeHover, await geometry(selectedRow)); await screenshot(`selection-v2-${width}-multi-${parity}-hover-rtl`, frame()); selectedMultiHover.push({ parity, paint: cells }); await outside(); await settlePaint(selectedRow); navy(await paint(selectedRow)); }
      const unselectedHoverDuringMulti = [];
      for (const [parity, index, color] of [['even', 1, 'rgb(8, 14, 19)'], ['odd', 2, 'rgb(13, 21, 29)']]) { const unselected = rows().nth(index), beforeHover = await geometry(unselected); await expect(unselected.getByRole('checkbox')).not.toBeChecked(); await unselected.locator('[data-admin-column-key="title"]').hover(); await settlePaint(unselected); const cells = await paint(unselected); assert.ok(cells.every(cell => cell.color === color && cell.image.includes('0.035') && cell.image.includes('0.008')), 'Unselected ' + parity + ' row retains its actual prior base precedence and visible warm hover layer during Multi-Select: ' + JSON.stringify(cells)); await expect(firstCheckbox).toBeChecked(); await expect(secondCheckbox).toBeChecked(); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('2'); sameGeometry(beforeHover, await geometry(unselected)); await screenshot(`selection-v2-${width}-multi-unselected-${parity}-hover-rtl`, frame()); unselectedHoverDuringMulti.push({ parity, index, paint: cells }); await outside(); }
      cases.push({ surface: 'selection-v2-multiple', width, exactSelectedIds: [currentIds[0], currentIds[3]], nonadjacent: true, selectedMultiHover, unselectedHoverDuringMulti, sameSingleRowIdentity: true, indeterminate: true });
      await headerCheckbox().check(); await outside(); await settlePaint(first); await expect(headerCheckbox()).toBeChecked(); assert.equal(await headerCheckbox().evaluate(element => element.indeterminate), false); await expect(rows().locator('input[type="checkbox"]:checked')).toHaveCount(currentIds.length); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText(String(currentIds.length));
      for (const row of await rows().all()) { await settlePaint(row); navy(await paint(row)); } assert.equal(currentIds.length, topicsQueryContract.defaultPageSize); assert.ok(currentIds.length < gridRows.length, 'Select All keeps the displayed-page scope');
      await screenshot(`selection-v2-${width}-all-page-rtl`, frame()); cases.push({ surface: 'selection-v2-select-all', width, selectedCount: currentIds.length, totalFixtureRows: gridRows.length, currentPageOnly: true, nativeHeaderChecked: true, noAccumulatedWarmFill: true });

      await first.locator('[data-admin-column-key="title"]').hover(); await settlePaint(first); const selectedHoverPaint = await paint(first); navy(selectedHoverPaint, true); await expect(first).toHaveAttribute('data-selected', 'true'); await expect(firstCheckbox).toBeChecked();
      await screenshot(`selection-v2-${width}-selected-hover-rtl`, frame()); await second.locator('[data-admin-column-key="title"]').hover(); await settlePaint(second); const selectedAllEvenHoverPaint = await paint(second); navy(selectedAllEvenHoverPaint, true); await expect(secondCheckbox).toBeChecked(); await expect(rows().locator('input[type="checkbox"]:checked')).toHaveCount(currentIds.length); await screenshot(`selection-v2-${width}-all-even-hover-rtl`, frame()); await outside(); await page.keyboard.press('Tab'); await firstCheckbox.focus(); await expect(firstCheckbox).toBeFocused(); await settlePaint(first); const selectedFocusPaint = await paint(first); navy(selectedFocusPaint); assert.notDeepEqual(selectedFocusPaint.map(cell => cell.shadow), selectedPaint.map(cell => cell.shadow), 'Keyboard focus is a separate cue while selection stays navy'); sameGeometry(initialGeometry, await geometry(first));
      const focus = await firstCheckbox.evaluate(element => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle })); assert.ok(parseFloat(focus.width) >= 2 && focus.style !== 'none'); await screenshot(`selection-v2-${width}-selected-keyboard-focus-rtl`, frame());
      cases.push({ surface: 'selection-v2-hover-focus', width, selectedHoverPaint, selectedAllEvenHoverPaint, selectedFocusPaint, independentFocus: focus, selectionRemainsChecked: true, noLayoutShift: true });

      await bar().getByRole('button', { name: 'إلغاء التحديد', exact: true }).click(); await expect(bar()).toHaveCount(0); await expect(headerCheckbox()).not.toBeChecked(); assert.equal(await headerCheckbox().evaluate(element => element.indeterminate), false);
      await firstCheckbox.check(); await secondCheckbox.check(); const selectedIds = [currentIds[0], currentIds[3]], attempts = gridTransport.actions.length;
      await bar().locator('button[aria-haspopup="listbox"]').click(); await page.getByRole('option', { name: 'حذف المحدد', exact: true }).click(); const dangerSubmit = bar().locator('[data-admin-bulk-action-tone="danger"]'); await expect(dangerSubmit).toHaveCount(1);
      let dangerPaint; await expect.poll(async () => { dangerPaint = await dangerSubmit.evaluate(element => { const s = getComputedStyle(element), canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d'); context.fillStyle = s.backgroundColor; context.fillRect(0, 0, 1, 1); return { color: s.backgroundColor, image: s.backgroundImage, pixel: [...context.getImageData(0, 0, 1, 1).data] }; }); return dangerPaint.image === 'none' && dangerPaint.pixel[3] >= 180 && dangerPaint.pixel[0] > dangerPaint.pixel[1] * 1.5 + 20 && dangerPaint.pixel[0] > dangerPaint.pixel[2] * 1.5 + 20; }, { message: 'Actual Topics destructive action settles to semantic red rather than sampling its first transparent transition frame' }).toBe(true);
      await bar().getByRole('button', { name: 'تنفيذ', exact: true }).click(); const confirmation = page.locator('[data-admin-confirm-dialog]'); await expect(confirmation).toBeVisible(); await confirmation.locator('[data-admin-confirm-cancel]').click(); await expect(confirmation).toHaveCount(0); assert.equal(gridTransport.actions.length, attempts); await expect(bar().getByRole('button', { name: 'تنفيذ', exact: true })).toBeFocused();
      gridTransport.holdActions = true; gridTransport.failActions = true; await bar().getByRole('button', { name: 'تنفيذ', exact: true }).click(); await confirmation.locator('[data-admin-confirm-submit]').click(); await expect.poll(() => gridTransport.heldActions.length).toBe(1); await expect(bar()).toHaveAttribute('aria-busy', 'true'); await expect(bar().locator('button[type="submit"]')).toBeDisabled();
      assert.deepEqual(gridTransport.actions.at(-1).args[0].form.filter(([key]) => key === 'topic_ids').map(([, value]) => Number(value)), selectedIds); await screenshot(`selection-v2-${width}-bulk-pending-rtl`, frame());
      gridTransport.holdActions = false; while (gridTransport.heldActions.length) gridTransport.heldActions.shift()(); await expect(bar()).not.toHaveAttribute('aria-busy', 'true'); await expect(firstCheckbox).toBeChecked(); await expect(secondCheckbox).toBeChecked(); await expect(page.getByText('رفض معزول قابل لإعادة المحاولة', { exact: true })).toBeVisible();
      gridTransport.failActions = false; await bar().getByRole('button', { name: 'تنفيذ', exact: true }).click(); await confirmation.locator('[data-admin-confirm-submit]').click(); await expect.poll(() => gridTransport.actions.length).toBe(attempts + 2); await expect(bar()).toHaveCount(0); await settled();
      assert.deepEqual(gridTransport.actions.at(-1).args[0].form.filter(([key]) => key === 'topic_ids').map(([, value]) => Number(value)), selectedIds);
      cases.push({ surface: 'selection-v2-bulk-lifecycle', width, exactSelectedIds: selectedIds, dangerSemantic: dangerPaint, cancelZeroCommands: true, pendingDisabled: true, errorRetainsSelection: true, retrySameIdsClearsSelectionOnCommit: true, boundary: 'Only disposable in-memory transport lifecycle; no hosted deletion or domain correctness claim.' });

      await ready(); const search = toolbar().locator('input').first(); await search.fill('08'); await search.press('Enter'); await settled('q=08'); await toolbar().getByRole('button', { name: 'مسح', exact: true }).click(); await settled();
      await page.locator('th[data-admin-column-key="title"] button').click(); await settled('sort=title_desc'); await expect(page.locator('th[data-admin-column-key="title"]')).toHaveAttribute('aria-sort', 'descending');
      await ready(); await page.locator('[data-admin-filter-trigger]').click(); const filterDialog = page.getByRole('dialog', { name: 'الفلاتر', exact: true }); await filterDialog.getByRole('listbox', { name: 'الحالة', exact: true }).getByRole('option', { name: 'منشور', exact: true }).click(); await filterDialog.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click(); await settled('status=published');
      await ready(); await rows().first().getByRole('checkbox').check(); await page.locator('[data-admin-table-pagination] [data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await settled('page=2'); await expect(bar()).toHaveCount(0);
      await toolbar().locator('[data-admin-toolbar-columns] button').click(); const columns = page.locator('[data-admin-column-menu]'); await expect(columns).toBeVisible(); await expect(columns.getByRole('checkbox')).not.toHaveCount(0); await page.keyboard.press('Escape'); await expect(toolbar().locator('[data-admin-toolbar-columns] button')).toBeFocused();
      cases.push({ surface: 'selection-v2-query-controls', width, searchClear: true, sort: true, filterApply: true, paginationResetsSelectionWithinExistingContract: true, columnMenuKeyboardRetained: true, responsive: await noOverflow() });
      await ready(); const pendingIds = await ids(), previousActions = gridTransport.actions.length; await rows().first().getByRole('checkbox').check(); holdReads = true; await search.fill('08'); await search.press('Enter'); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.deepEqual(await ids(), pendingIds); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('1'); holdReads = false; while (held.length) held.shift()(); await settled('q=08'); await expect(bar()).toHaveCount(0);
      await ready(); const failureIds = await ids(); await rows().first().getByRole('checkbox').check(); failReads = true; await search.fill('08'); await search.press('Enter'); await expect(page.locator('[data-admin-entity-list-query-error]')).toContainText(/Unable to load|Controlled read/u); assert.deepEqual(await ids(), failureIds); await expect(rows().first().getByRole('checkbox')).toBeChecked(); await expect(bar().locator('[data-admin-bulk-selected-count]')).toHaveText('1'); failReads = false; assert.equal(gridTransport.actions.length, previousActions, 'Read pending/failure verification invokes no action transport'); cases.at(-1).pendingAndFailedRead = { pendingRetainsRowsAndSelection: true, confirmedMembershipChangeResetsSelection: true, failedReadRetainsRowsAndSelection: true, zeroActionCommands: true };

      await open('grid-defaults'); const defaults = page.locator('[data-cinematic-grid-defaults]'); await expect(defaults.locator('[data-admin-data-grid-presentation="cinematic"]')).toHaveCount(1); await defaults.locator('tbody input[type="checkbox"]').first().check(); await outside(); await settlePaint(rows().first()); navy(await paint(rows().first()));
      await headerCheckbox().check(); await outside(); await settlePaint(rows().first()); await expect(defaults.locator('tbody input[type="checkbox"]:checked')).toHaveCount(2); for (const row of await rows().all()) { await settlePaint(row); navy(await paint(row)); } await screenshot(`selection-v2-${width}-default-semantic-grid-rtl`, defaults);
      cases.push({ surface: 'selection-v2-default-semantic-grid', width, selectionSharedWithCinematic: true, selectAllCurrentRows: 2, noConsumerOptInNeeded: true });

      await ready(); await page.emulateMedia({ reducedMotion: 'reduce' }); await rows().first().getByRole('checkbox').check(); await rows().first().hover();
      const reduced = await page.locator('[data-admin-navigation],tbody tr[data-entity-row-id],tbody td').evaluateAll(elements => elements.map(element => { const s = getComputedStyle(element); return { property: s.transitionProperty, duration: s.transitionDuration, runningAnimations: element.getAnimations().filter(animation => animation.playState === 'running').length }; }));
      assert.ok(reduced.every(value => (value.property === 'none' || value.duration.split(',').every(duration => parseFloat(duration) === 0)) && value.runningAnimations === 0), 'Sidebar/selection honor effective reduced motion: ' + JSON.stringify(reduced)); await page.emulateMedia({ reducedMotion: 'no-preference' });
      cases.push({ surface: 'sidebar-selection-v2-reduced-motion', width, effectiveMotionDisabled: true, reduced });
    }
    assert.ok(gridTransport.actions.every(action => action.name === 'bulkUpdateUnifiedContent'), 'The bounded delta executes only the explicit isolated bulk lifecycle; preferences and unrelated row actions remain untouched');
  }
  async function verifyFinalAlignment() {
    const rows = () => page.locator('tbody tr[data-entity-row-id]');
    const ids = () => rows().evaluateAll(nodes => nodes.map(node => Number(node.dataset.entityRowId)));
    const frame = () => page.locator('[data-admin-entity-list-table-region-presentation="cinematic"]');
    const toolbar = () => page.locator('[data-admin-collection-toolbar-owner]');
    const search = () => toolbar().locator('input').first();
    const moduleHeaderFor = surface => page.locator('[data-admin-page-header]').filter({ has: page.getByRole('heading', { name: surface === 'dashboard' ? 'لوحة التحكم' : 'إدارة الموضوعات', exact: true }) });
    async function settled(params = '') { await expect.poll(ids).toEqual(topicsResult('ready', new URLSearchParams(params)).rows.map(row => row.id)); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(0); }
    async function ready() { await open('topics'); await settled(); await expect(frame()).toHaveAttribute('data-admin-edge-motion', 'entry'); }
    async function outside() { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); }
    const edge = locator => locator.evaluate(element => { const s = getComputedStyle(element, '::after'); return { at: performance.now(), hover: element.matches(':hover'), focusWithin: element.matches(':focus-within'), keyboardWithin: element.matches(':has(:focus-visible)'), opacity: s.opacity, name: s.animationName, duration: s.animationDuration, iterations: s.animationIterationCount, fill: s.animationFillMode, angle: s.getPropertyValue('--admin-edge-angle'), transitionProperty: s.transitionProperty, transitionDuration: s.transitionDuration, pointerEvents: s.pointerEvents, animations: element.getAnimations({ subtree: true }).filter(animation => animation.animationName === 'admin-edge-trace').map(animation => ({ frameOwnsAnimation: animation.effect.target === element, currentTime: animation.currentTime, playState: animation.playState, timing: { duration: animation.effect.getComputedTiming().duration, iterations: animation.effect.getComputedTiming().iterations, progress: animation.effect.getComputedTiming().progress } })) }; });
    const running = state => state.animations.filter(animation => animation.playState === 'running');
    const paint = row => row.locator('td').evaluateAll(cells => cells.map(cell => { const s = getComputedStyle(cell); return { color: s.backgroundColor, image: s.backgroundImage, border: s.borderTopColor, shadow: s.boxShadow, duration: s.transitionDuration, position: s.position }; }));
    const rowGeometry = row => row.evaluate(element => { const rect = element.getBoundingClientRect(), scroll = element.closest('[data-admin-data-grid-scroll]'); return { x: rect.x + (scroll?.scrollLeft || 0), y: rect.y + scrollY, width: rect.width, height: rect.height, transform: getComputedStyle(element).transform }; });
    async function settledPaint(row) { await expect.poll(() => row.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0); }
    function unchangedGeometry(before, after) { for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) <= 1, 'Row tone cannot move or resize rows: ' + JSON.stringify({ before, after })); assert.ok(after.transform === 'none' || after.transform === 'matrix(1, 0, 0, 1, 0, 0)'); }
    async function headerSnapshot(surface) {
      await open(surface); await outside();
      const header = moduleHeaderFor(surface); await expect(header).toHaveAttribute('data-admin-page-header-presentation', 'cinematic');
      const labels = surface === 'dashboard' ? ['موضوع جديد', 'تصنيف جديد', 'الإعدادات'] : ['إضافة موضوع جديد', 'إدارة التصنيفات', 'سلاسل المحتوى', 'المحذوفات'];
      const hrefs = surface === 'dashboard' ? ['/admin/content/topics/new', '/admin/content/categories/new', '/admin/settings/general'] : ['/admin/content/topics/new', '/admin/content/categories', '/admin/content/series', '/admin/content/topics?view=trash'];
      for (let index = 0; index < labels.length; index++) await expect(header.getByRole('link', { name: labels[index], exact: true })).toHaveAttribute('href', hrefs[index]);
      await expect(header.getByRole('link')).toHaveCount(labels.length);
      const result = await header.evaluate(element => { const s = getComputedStyle(element), title = element.querySelector('h1'), description = title.nextElementSibling, font = node => { const style = getComputedStyle(node); return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight }; }; return { title: title.textContent, description: description.textContent, padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft], background: s.backgroundImage, border: s.borderColor, shadow: s.boxShadow, typography: { title: font(title), description: font(description) }, documentArtwork: element.querySelectorAll('[data-admin-header-artwork="document"]').length, actions: [...element.querySelectorAll('a')].map(link => { const style = getComputedStyle(link); return { href: link.getAttribute('href'), icon: link.querySelector('svg')?.outerHTML, height: link.getBoundingClientRect().height, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], size: style.fontSize, weight: style.fontWeight, background: style.backgroundImage, color: style.color }; }) }; });
      assert.equal(result.padding[0], '12px'); assert.equal(result.padding[2], '12px'); assert.ok(result.background.includes('gradient')); assert.ok(result.actions.every(action => action.icon && action.height >= 44));
      result.artwork = await header.locator('[data-admin-header-artwork]').evaluateAll(nodes => nodes.map(element => ({ kind: element.getAttribute('data-admin-header-artwork'), hidden: element.getAttribute('aria-hidden'), focusable: element.querySelector('svg').getAttribute('focusable'), pointerEvents: getComputedStyle(element).pointerEvents, opacity: getComputedStyle(element).opacity, strokes: [...element.querySelectorAll('[stroke-opacity]')].map(shape => Number(getComputedStyle(shape).strokeOpacity)), fills: [...element.querySelectorAll('[fill-opacity]')].map(shape => Number(getComputedStyle(shape).fillOpacity)) })));
      assert.equal(result.artwork.length, 1); assert.equal(result.artwork[0].kind, surface === 'dashboard' ? 'statistics' : 'document'); assert.equal(result.artwork[0].hidden, 'true'); assert.equal(result.artwork[0].focusable, 'false'); assert.equal(result.artwork[0].pointerEvents, 'none');
      if (surface === 'dashboard') { assert.ok(result.artwork[0].strokes.length >= 4 && result.artwork[0].strokes.every(opacity => opacity > 0 && opacity <= .42), 'Native statistics artwork keeps its internal strokes restrained rather than rendering the solid fallback glyph'); assert.ok(result.artwork[0].fills.length >= 4 && result.artwork[0].fills.every(opacity => opacity > 0 && opacity <= .13)); }
      if (surface === 'dashboard') { assert.equal(result.title, 'لوحة التحكم'); assert.equal(result.description, 'نظرة شاملة على المحتوى والمشاريع وحالة مصادر النظام.'); assert.equal(result.documentArtwork, 0); assert.notEqual(result.actions[0].background, result.actions[1].background); assert.deepEqual(result.actions[1].background, result.actions[2].background); }
      const shell = await page.locator('[data-admin-shell-header]').evaluate(element => ({ classes: element.className, html: element.innerHTML }));
      await screenshot(`final-alignment-${surface}-1440-header-rtl`); return { ...result, shell };
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const dashboard = await headerSnapshot('dashboard'), topics = await headerSnapshot('topics');
    for (const key of ['padding', 'background', 'border', 'shadow', 'typography']) assert.deepEqual(dashboard[key], topics[key], 'Both Module Headers adopt the same shared visual ruler: ' + key);
    assert.deepEqual(dashboard.shell, topics.shell, 'Module adoption leaves the distinct System Header untouched');
    const moduleHeader = moduleHeaderFor('topics'), titleMotion = await moduleTitleMotion(moduleHeader, moduleHeader.getByRole('link').first());
    const shellHeader = page.locator('[data-admin-shell-header]'), legacySystemMotion = await activeEdge(shellHeader.getByRole('button', { name: /خروج/u }), 'focus');
    assert.equal((await edge(shellHeader)).iterations, 'infinite');
    cases.push({ surface: 'final-alignment-header-adoption', width: 1440, dashboard, topics, titleMotion, legacySystemMotion, systemHeaderPreserved: true });

    await ready(); await frame().scrollIntoViewIfNeeded(); await outside();
    await expect.poll(async () => (await edge(frame())).opacity).toBe('0'); const baseline = await edge(frame()); assert.equal(baseline.hover, false); assert.equal(baseline.focusWithin, false); assert.equal(baseline.name, 'none');
    await screenshot('final-alignment-grid-1440-before-entry-rtl', frame());
    await frame().hover({ position: { x: 6, y: 6 } });
    await expect.poll(() => edge(frame())).toMatchObject({ hover: true, name: 'admin-edge-trace', iterations: '1', animations: [{ frameOwnsAnimation: true, playState: 'running' }] }); const entered = await edge(frame());
    assert.equal(entered.duration, '1.15s'); assert.equal(entered.iterations, '1'); assert.equal(entered.fill, 'both'); assert.equal(entered.pointerEvents, 'none');
    await expect.poll(async () => (await edge(frame())).animations[0]?.currentTime).toBeGreaterThan(Number(entered.animations[0].currentTime) + 80); const during = await edge(frame());
    await screenshot('final-alignment-grid-1440-during-cycle-rtl', frame());
    await expect.poll(async () => (await edge(frame())).animations[0]?.playState).toBe('finished'); const completed = await edge(frame());
    assert.equal(completed.hover, true); assert.equal(completed.angle.trim(), '360deg'); assert.equal(completed.animations[0].timing.progress, 1);
    await screenshot('final-alignment-grid-1440-after-cycle-held-rtl', frame());
    await page.waitForTimeout(1300); const held = await edge(frame()); assert.deepEqual(held.animations, completed.animations); assert.equal(held.angle.trim(), '360deg'); assert.equal(held.hover, true);
    await outside(); await expect.poll(async () => (await edge(frame())).opacity).toBe('0'); const exited = await edge(frame()); assert.equal(exited.name, 'none'); assert.deepEqual(exited.animations, []);
    await frame().hover({ position: { x: 6, y: 6 } }); await expect.poll(async () => running(await edge(frame())).length).toBe(1); const reentered = await edge(frame()); assert.ok(Number(reentered.animations[0].currentTime) < 1150);
    await screenshot('final-alignment-grid-1440-reentry-rtl', frame()); await expect.poll(async () => (await edge(frame())).animations[0]?.playState).toBe('finished');
    cases.push({ surface: 'final-alignment-entry-motion', width: 1440, baseline, entered, during, completed, held, exited, reentered, oneCycleStopsWhileHovered: true, newEntryRestarts: true });

    await outside(); const filter = page.locator('[data-admin-filter-trigger]'); await page.keyboard.press('Tab'); await filter.focus(); await expect(filter).toBeFocused();
    await expect.poll(async () => (await edge(frame())).opacity).toBe('0.42'); const keyboard = await edge(frame()); assert.equal(keyboard.hover, false); assert.equal(keyboard.keyboardWithin, true); assert.equal(keyboard.name, 'none'); assert.deepEqual(keyboard.animations, []);
    const focusControl = await filter.evaluate(element => { const s = getComputedStyle(element); return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle }; }); assert.ok(parseFloat(focusControl.outlineWidth) >= 2 && focusControl.outlineStyle !== 'none');
    await screenshot('final-alignment-grid-1440-keyboard-static-rtl', frame()); await filter.press('Enter'); await expect(page.getByRole('dialog', { name: 'الفلاتر', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(filter).toBeFocused(); assert.equal((await edge(frame())).name, 'none');
    cases.push({ surface: 'final-alignment-keyboard-static', width: 1440, keyboard, focusControl, filterEscapeReturnsFocus: true, noAmbientFocusAnimation: true });

    await outside(); const row = rows().first(), titleCell = row.locator('[data-admin-column-key="title"]'); await titleCell.scrollIntoViewIfNeeded(); await outside(); await settledPaint(row);
    const geometry = await rowGeometry(row), basePaint = await paint(row); await screenshot('final-alignment-grid-1440-row-default-rtl', frame());
    await titleCell.hover(); await settledPaint(row); const hoverPaint = await paint(row); unchangedGeometry(geometry, await rowGeometry(row));
    assert.ok(hoverPaint.every(cell => cell.color === 'rgb(13, 21, 29)' && cell.image.includes('0.035') && cell.image.includes('0.008') && cell.duration === '0.25s'), 'Approved full-row hover is quiet warm navy at the retained 250ms: ' + JSON.stringify(hoverPaint));
    assert.notDeepEqual(hoverPaint, basePaint); await screenshot('final-alignment-grid-1440-row-hover-rtl', frame());
    const more = row.locator('[data-admin-row-action="more"] button'); await more.scrollIntoViewIfNeeded(); await outside(); await page.keyboard.press('Tab'); await more.focus(); await settledPaint(row); const focusPaint = await paint(row); unchangedGeometry(geometry, await rowGeometry(row)); assert.notDeepEqual(focusPaint, basePaint); assert.notDeepEqual(focusPaint, hoverPaint);
    await screenshot('final-alignment-grid-1440-row-focus-rtl', frame()); await page.getByRole('checkbox', { name: 'تحديد ' + gridRows[0].title, exact: true }).check(); await outside(); await settledPaint(row); const selectedPaint = await paint(row);
    assert.ok(selectedPaint.every(cell => cell.image.includes('gradient'))); assert.notDeepEqual(selectedPaint, hoverPaint); assert.ok(Math.abs((await rowGeometry(row)).height - geometry.height) <= 1);
    assert.ok([...hoverPaint, ...selectedPaint].filter(cell => cell.position === 'sticky').every(cell => !cell.color.startsWith('rgba')), 'Pinned tracks keep opaque bases');
    await screenshot('final-alignment-grid-1440-row-selected-rtl', frame()); await page.locator('[data-admin-bulk-action-bar]').getByRole('button', { name: 'إلغاء التحديد', exact: true }).click();
    cases.push({ surface: 'final-alignment-row-tone', width: 1440, basePaint, hoverPaint, focusPaint, selectedPaint, unchangedGeometry: true, durationMs: 250, semanticActionsUnchanged: true });

    await ready(); await search().fill('08'); await search().press('Enter'); await settled('q=08'); await toolbar().getByRole('button', { name: 'مسح', exact: true }).click(); await settled();
    await filter.click(); const dialog = page.getByRole('dialog', { name: 'الفلاتر', exact: true }); await dialog.getByRole('listbox', { name: 'الحالة', exact: true }).getByRole('option', { name: 'منشور', exact: true }).click(); await dialog.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click(); await settled('status=published');
    await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'الموضوعات', exact: true }).click(); await settled();
    await page.getByRole('checkbox', { name: 'تحديد ' + gridRows[0].title, exact: true }).check(); await expect(page.locator('[data-admin-bulk-action-bar]')).toBeVisible(); await page.locator('[data-admin-bulk-action-bar]').getByRole('button', { name: 'إلغاء التحديد', exact: true }).click();
    const pagination = page.locator('[data-admin-table-pagination]'); await pagination.locator('[data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await settled('page=2');
    const nextSize = topicsQueryContract.pageSizeOptions.find(value => value > topicsQueryContract.defaultPageSize); await pagination.locator('button[aria-haspopup="listbox"]').click(); await page.locator('[data-admin-table-pagination-menu]').getByRole('option', { name: String(nextSize), exact: true }).click(); await settled('limit=' + nextSize);
    assert.equal(new URL(page.url()).searchParams.get('page'), null); assert.deepEqual(gridTransport.actions, []);
    cases.push({ surface: 'final-alignment-functional-smoke', width: 1440, searchClear: true, filterApplyReset: true, selectionCancel: true, pageTwo: true, pageSize: nextSize, zeroCommands: true });

    await open('grid-default-region'); const defaultRegion = page.locator('[data-admin-entity-list-table-region]'); await expect(defaultRegion).toHaveAttribute('data-admin-edge-motion', 'entry'); await expect(defaultRegion).toHaveAttribute('data-admin-entity-list-table-region-presentation', 'cinematic'); await outside(); assert.equal((await edge(defaultRegion)).name, 'none');
    await open('grid-continuous-region'); await expect(frame()).toHaveAttribute('data-admin-edge-motion', 'continuous'); await frame().hover(); const continuous = await edge(frame()); assert.equal(continuous.name, 'admin-edge-trace'); assert.equal(continuous.iterations, 'infinite');
    cases.push({ surface: 'final-alignment-default-and-continuous', width: 1440, officialDefaultEntry: true, explicitContinuousPreserved: true, continuous });

    await ready(); await page.emulateMedia({ reducedMotion: 'reduce' }); await rows().first().locator('[data-admin-column-key="title"]').hover();
    const reduced = await edge(frame()); assert.equal(reduced.name, 'none'); assert.deepEqual(running(reduced), []);
    const reducedCells = await rows().first().locator('td').evaluateAll(cells => cells.map(cell => { const s = getComputedStyle(cell); return { property: s.transitionProperty, duration: s.transitionDuration }; })); assert.ok(reducedCells.every(cell => cell.property === 'none' || cell.duration.split(',').every(value => parseFloat(value) === 0)));
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await filter.focus(); const reducedFocus = await edge(frame()); assert.equal(reducedFocus.name, 'none'); assert.deepEqual(running(reducedFocus), []); await page.emulateMedia({ reducedMotion: 'no-preference' });
    cases.push({ surface: 'final-alignment-reduced-motion', width: 1440, reduced, reducedFocus, reducedCells, effectiveMotionDisabled: true });

    await page.setViewportSize({ width: 390, height: 1000 });
    for (const surface of ['dashboard', 'topics']) { await open(surface); await noOverflow(); const header = moduleHeaderFor(surface); await expect(header).toHaveAttribute('data-admin-page-header-presentation', 'cinematic'); await expect(header.getByRole('link')).toHaveCount(surface === 'dashboard' ? 3 : 4); for (const link of await header.getByRole('link').all()) await expect(link).toBeVisible(); }
    await settled(); await search().fill('08'); await search().press('Enter'); await settled('q=08'); await toolbar().getByRole('button', { name: 'مسح', exact: true }).click(); await settled(); await filter.click(); await expect(page.getByRole('dialog', { name: 'الفلاتر', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(filter).toBeFocused();
    await page.getByRole('checkbox', { name: 'تحديد ' + gridRows[0].title, exact: true }).check(); await expect(page.locator('[data-admin-bulk-action-bar]')).toBeVisible(); await page.locator('[data-admin-bulk-action-bar]').getByRole('button', { name: 'إلغاء التحديد', exact: true }).click();
    await pagination.locator('[data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await settled('page=2'); const responsive = await noOverflow();
    await screenshot('final-alignment-390-functional-rtl'); assert.deepEqual(gridTransport.actions, []);
    cases.push({ surface: 'final-alignment-responsive-functional', width: 390, responsive, moduleActionsAvailable: true, searchClear: true, filterEscape: true, selectionCancel: true, pageTwo: true, noMobileRedesign: true });
  }
  async function verifyDataGridRefinement() {
    const rows = () => page.locator('tbody tr[data-entity-row-id]');
    const ids = () => rows().evaluateAll(nodes => nodes.map(node => Number(node.dataset.entityRowId)));
    const frame = () => page.locator('[data-admin-entity-list-table-region-presentation="cinematic"]');
    const toolbar = () => page.locator('[data-admin-collection-toolbar-owner]');
    const search = () => toolbar().locator('input').first();
    const expectedIds = params => topicsResult('ready', new URLSearchParams(params)).rows.map(row => row.id);
    async function settled(params = '') { await expect.poll(ids).toEqual(expectedIds(params)); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(0); }
    async function ready() { await open('topics'); await settled(); await expect(frame()).toHaveCount(1); }
    const style = target => target.evaluate(element => { const s = getComputedStyle(element), rect = element.getBoundingClientRect(), scrollport = element.closest('[data-admin-data-grid-scroll]'); return { layoutRect: { x: rect.x + (scrollport?.scrollLeft || 0), y: rect.y + scrollY, width: rect.width, height: rect.height }, background: s.backgroundImage, color: s.backgroundColor, border: s.borderTopColor, borderWidth: s.borderTopWidth, shadow: s.boxShadow, overflowX: s.overflowX, overflowY: s.overflowY, transform: s.transform, transitionProperty: s.transitionProperty, transitionDuration: s.transitionDuration, outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }; });
    const paint = row => row.locator('td').evaluateAll(cells => cells.map(cell => { const s = getComputedStyle(cell); return { background: s.backgroundImage, color: s.backgroundColor, shadow: s.boxShadow }; }));
    async function settlePaint(row) { await expect.poll(() => row.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0); }
    function noDisplacement(before, after) { for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(before[key] - after[key]) <= 1, 'Row interaction must not displace layout: ' + JSON.stringify({ before, after })); }
    function noLift(transform) { assert.ok(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)', 'Table rows retain their reading position: ' + transform); }
    async function bounds() {
      const pageBounds = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, direction: document.documentElement.dir }));
      assert.equal(pageBounds.direction, 'rtl'); assert.ok(pageBounds.width <= pageBounds.viewport + 1, JSON.stringify(pageBounds));
      const rect = await frame().boundingBox(); assert.ok(rect && rect.x >= -1 && rect.x + rect.width <= pageBounds.viewport + 1);
      const scroll = await frame().locator('[data-admin-data-grid-scroll]').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, direction: getComputedStyle(element).direction, overflow: getComputedStyle(element).overflowX }));
      assert.equal(scroll.direction, 'rtl'); assert.equal(scroll.overflow, 'auto'); assert.ok(scroll.width > 100);
      const titleWidth = await page.locator('thead th[data-admin-column-key="title"]').evaluate(element => element.getBoundingClientRect().width);
      const declaredMinimum = await page.evaluate(() => window.fixtureTitleMinimum); assert.ok(titleWidth >= declaredMinimum - 1);
      return { page: pageBounds, frame: rect, scroll, titleWidth, declaredMinimum };
    }
    async function visiblePortal(target) {
      await expect(target).toBeVisible();
      const actual = await target.evaluate(element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, outsideFrame: !element.closest('[data-admin-entity-list-table-region]') }; });
      assert.ok(actual.left >= -1 && actual.right <= actual.viewportWidth + 1 && actual.top >= -1 && actual.bottom <= actual.viewportHeight + 1, JSON.stringify(actual));
      assert.equal(actual.outsideFrame, true, 'The shared portal remains independent of the illuminated collection frame'); return actual;
    }
    async function opaqueStickyCells() {
      const sticky = await frame().locator('th,td').evaluateAll(cells => cells.filter(cell => getComputedStyle(cell).position === 'sticky').map(cell => { const s = getComputedStyle(cell); return { key: cell.getAttribute('data-admin-column-key'), color: s.backgroundColor, image: s.backgroundImage }; }));
      assert.ok(sticky.length > 0, 'The real collection retains its pinned tracks');
      assert.ok(sticky.every(cell => { const components = cell.color.match(/^rgba?\((.*)\)$/u)?.[1].split(',').map(value => value.trim()); return components && (components.length === 3 || Number(components[3]) === 1); }), 'Sticky cells retain an opaque base beneath decorative gradients: ' + JSON.stringify(sticky));
      return sticky;
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await ready(); await page.mouse.move(0, 0);
      const initialColumns = await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes => nodes.map(node => node.dataset.adminColumnKey));
      const frameStyle = await style(frame()); assert.equal(frameStyle.borderWidth, '1px'); assert.ok(frameStyle.background.includes('gradient')); assert.notEqual(frameStyle.shadow, 'none'); assert.equal(frameStyle.overflowX, 'visible'); assert.equal(frameStyle.overflowY, 'visible');
      for (const selector of ['[data-admin-collection-toolbar-owner]', '[data-admin-data-grid-scroll]', '[data-admin-table-pagination]']) await expect(frame().locator(selector)).toHaveCount(1);
      await screenshot(`datagrid-v11-${width}-default-rtl`, frame()); cases.push({ surface: 'datagrid-v11-frame', width, frame: frameStyle, geometry: await bounds(), sticky: await opaqueStickyCells(), columns: initialColumns, ids: await ids(), unifiedToolbarTablePagination: true });

      const row = rows().first(), title = row.locator('[data-admin-column-key="title"]'); await title.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
      const before = await style(row), basePaint = await paint(row); await title.hover();
      await expect.poll(() => paint(row)).not.toEqual(basePaint); await settlePaint(row); const hovered = await style(row), hoverPaint = await paint(row); noDisplacement(before.layoutRect, hovered.layoutRect); noLift(hovered.transform);
      await screenshot(`datagrid-v11-${width}-hover-rtl`, frame());
      const more = row.locator('[data-admin-row-action="more"] button'); await more.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); const focusBefore = await style(row);
      await page.keyboard.press('Tab'); await more.focus(); await expect(more).toBeFocused(); await settlePaint(row); const focused = await style(row), focusControl = await style(more); noDisplacement(focusBefore.layoutRect, focused.layoutRect); noLift(focused.transform); assert.ok(parseFloat(focusControl.outlineWidth) >= 2 && focusControl.outlineStyle !== 'none');
      await screenshot(`datagrid-v11-${width}-focus-rtl`, frame()); cases.push({ surface: 'datagrid-v11-row-interaction', width, basePaint, hoverPaint, hover: hovered, focus: focused, focusControl, noLayoutShiftOrLift: true });

      await more.press('ArrowDown'); const rowMenu = page.locator('[data-admin-row-actions-menu]'); const rowMenuBounds = await visiblePortal(rowMenu); await screenshot(`datagrid-v11-${width}-row-menu-rtl`); await page.keyboard.press('Escape'); await expect(rowMenu).toHaveCount(0); await expect(more).toBeFocused();
      const filterTrigger = page.locator('[data-admin-filter-trigger]'); await filterTrigger.click(); const filters = page.getByRole('dialog', { name: 'الفلاتر', exact: true }); const filterBounds = await visiblePortal(filters); await expect(filters.locator('[data-admin-filter-field]')).toHaveCount(6); await screenshot(`datagrid-v11-${width}-filters-rtl`); await page.keyboard.press('Escape'); await expect(filters).toHaveCount(0); await expect(filterTrigger).toBeFocused();
      const columnTrigger = toolbar().locator('[data-admin-toolbar-columns] button'); await columnTrigger.click(); const columnMenu = page.locator('[data-admin-column-menu]'); const columnBounds = await visiblePortal(columnMenu); await screenshot(`datagrid-v11-${width}-columns-rtl`); await page.keyboard.press('Escape'); await expect(columnMenu).toHaveCount(0); await expect(columnTrigger).toBeFocused();
      assert.deepEqual(await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes => nodes.map(node => node.dataset.adminColumnKey)), initialColumns); assert.deepEqual(gridTransport.actions, []);
      cases.push({ surface: 'datagrid-v11-floating-tools', width, rowMenuBounds, filterBounds, columnBounds, escapeReturnsFocus: true, noPreferenceSaveOrDomainCommand: true });

      await page.getByRole('checkbox', { name: 'تحديد ' + gridRows[0].title, exact: true }).check(); await page.getByRole('checkbox', { name: 'تحديد ' + gridRows[1].title, exact: true }).check();
      const bulk = page.locator('[data-admin-bulk-action-bar]'); await expect(bulk).toContainText('2'); await expect(row).toHaveAttribute('data-selected', 'true');
      await settlePaint(row); const selectedPaint = await paint(row), selected = await style(row); noLift(selected.transform); assert.ok(Math.abs(selected.rect.height - before.rect.height) <= 1); assert.notDeepEqual(selectedPaint, basePaint); assert.notDeepEqual(selectedPaint, hoverPaint, 'Selection remains distinguishable from hover'); assert.ok(selectedPaint.every(cell => ['rgb(16, 32, 51)', 'rgb(20, 40, 61)'].includes(cell.color) && cell.background.includes('120, 189, 250')), 'Approved selection uses navy/slate with restrained cool depth'); const selectedSticky = await opaqueStickyCells();
      await screenshot(`datagrid-v11-${width}-selection-rtl`, frame()); await bulk.getByRole('button', { name: 'إلغاء التحديد', exact: true }).click(); await expect(bulk).toHaveCount(0); assert.deepEqual(gridTransport.actions, []);
      cases.push({ surface: 'datagrid-v11-selection', width, selectedPaint, selected, selectedSticky, localSelectionOnly: true, unchangedRowHeight: true, zeroCommands: true });

      const pagination = page.locator('[data-admin-table-pagination]'); await pagination.locator('[data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await settled('page=2');
      const activePage = pagination.locator('[data-admin-pagination-slot="page"][aria-current="page"]'); await expect(activePage).toHaveText('2'); const activeStyle = await style(activePage); assert.ok(activeStyle.background.includes('gradient'));
      await screenshot(`datagrid-v11-${width}-pagination-rtl`, frame()); const sizeTrigger = pagination.locator('button[aria-haspopup="listbox"]'); await sizeTrigger.click(); const sizeMenu = page.locator('[data-admin-table-pagination-menu]'); const sizeBounds = await visiblePortal(sizeMenu); await screenshot(`datagrid-v11-${width}-page-size-rtl`); await page.keyboard.press('Escape'); await expect(sizeMenu).toHaveCount(0); await expect(sizeTrigger).toBeFocused();
      await sizeTrigger.click(); const nextSize = topicsQueryContract.pageSizeOptions.find(value => value > topicsQueryContract.defaultPageSize); await sizeMenu.getByRole('option', { name: String(nextSize), exact: true }).click(); await settled('limit=' + nextSize); assert.equal(new URL(page.url()).searchParams.get('page'), null);
      cases.push({ surface: 'datagrid-v11-pagination', width, activeStyle, sizeBounds, page: 2, pageSize: nextSize, exactReadRows: true, resetToFirstPage: true, geometry: await bounds() });

      await ready(); const retainedIds = await ids(); holdReads = true; await search().fill('08'); await search().press('Enter'); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.deepEqual(await ids(), retainedIds); await bounds();
      await screenshot(`datagrid-v11-${width}-pending-rtl`, frame()); holdReads = false; while (held.length) held.shift()(); await settled('q=08');
      failReads = true; await search().fill('09'); await search().press('Enter'); await expect(page.locator('[data-admin-entity-list-query-error]')).toContainText('تعذر تحديث النتائج'); assert.deepEqual(await ids(), expectedIds('q=08')); await bounds(); await screenshot(`datagrid-v11-${width}-error-rtl`, frame()); failReads = false;
      await open('topics', 'empty'); await expect(rows()).toHaveCount(0); await expect(frame()).toHaveCount(1); await expect(page.getByText('لا توجد موضوعات مطابقة للفلاتر الحالية.', { exact: true })).toBeVisible(); await screenshot(`datagrid-v11-${width}-empty-rtl`, frame()); await bounds();
      cases.push({ surface: 'datagrid-v11-state-layout', width, pendingRetainsRows: true, errorRetainsRows: true, emptyFrameRetained: true, noClippingOrPageOverflow: true });

      await open('grid-default-region'); const defaults = page.locator('[data-admin-entity-list-table-region]'); await expect(defaults).toHaveAttribute('data-admin-entity-list-table-region-presentation', 'cinematic');
      await expect(defaults.locator('[data-admin-data-grid-presentation="cinematic"]')).toHaveCount(1); await expect(defaults.locator('[data-admin-pagination-presentation="cinematic"]')).toHaveCount(1);
      const defaultStyle = await style(defaults); assert.ok(defaultStyle.background.includes('gradient')); assert.notEqual(defaultStyle.shadow, 'none'); await screenshot(`datagrid-v11-${width}-default-consumer-rtl`, defaults); await noOverflow();
      cases.push({ surface: 'datagrid-v11-default-consumer', width, defaultStyle, officialDefaultFrameAndControlsAdopted: true });

      await ready(); await page.emulateMedia({ reducedMotion: 'reduce' }); await rows().first().locator('[data-admin-column-key="title"]').hover();
      const reduced = await frame().evaluate(element => { const row = element.querySelector('tbody tr'), cell = row.querySelector('td'), frameStyle = getComputedStyle(element), rowStyle = getComputedStyle(row), cellStyle = getComputedStyle(cell); return { frameAnimation: frameStyle.animationName, rowTransform: rowStyle.transform, rowProperty: rowStyle.transitionProperty, rowDuration: rowStyle.transitionDuration, cellProperty: cellStyle.transitionProperty, cellDuration: cellStyle.transitionDuration, runningAnimations: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').map(animation => ({ name: animation.animationName || animation.transitionProperty || '', state: animation.playState })) }; });
      const effectiveOff = (property, duration) => property === 'none' || duration.split(',').every(value => parseFloat(value) === 0);
      assert.ok(effectiveOff(reduced.rowProperty, reduced.rowDuration)); assert.ok(effectiveOff(reduced.cellProperty, reduced.cellDuration)); assert.deepEqual(reduced.runningAnimations, []); noLift(reduced.rowTransform); await page.emulateMedia({ reducedMotion: 'no-preference' });
      cases.push({ surface: 'datagrid-v11-reduced-motion', width, reduced, effectiveMotionDisabled: true });
    }
    assert.deepEqual(gridTransport.actions, [], 'The visual delta round invokes no preference persistence or domain commands');
  }
  async function verifyDataGrid() {
    const resume = process.argv.includes('--cinematic-datagrid-remaining-only');
    if (resume) {
      const previousFolder = path.join(output, 'attempt-05-reduced-motion-css-semantics');
      const previous = JSON.parse(await readFile(path.join(previousFolder, 'browser-progress.json'), 'utf8'));
      const identity = JSON.parse(await readFile(path.join(previousFolder, 'browser-source-identity.json'), 'utf8'));
      const testedSource = await readFile(path.join(previousFolder, 'tested-fixture.mjs'), 'utf8');
      assert.equal(hash(testedSource), identity.hashes['scripts/fixtures/cinematic-admin-browser.mjs'], 'Original tested fixture bytes remain bound to the original receipt');
      const currentSource = await read('scripts/fixtures/cinematic-admin-browser.mjs');
      const entrySource = source => source.slice(source.indexOf('  const entry = '), source.indexOf('  const moduleData = '));
      assert.equal(entrySource(currentSource), entrySource(testedSource), 'Retained Desktop cases use byte-identical generated component entry code');
      const inputs = Object.keys(hashes).filter(file => file !== 'scripts/fixtures/cinematic-admin-browser.mjs');
      assert.deepEqual(inputs.sort(), Object.keys(identity.hashes).filter(file => file !== 'scripts/fixtures/cinematic-admin-browser.mjs').sort());
      for (const file of inputs) assert.equal(hashes[file], identity.hashes[file], 'Retained Desktop product/compiler/style/font input is unchanged: ' + file);
      assert.deepEqual(previous.errors, []); assert.deepEqual(previous.forbidden, []);
      assert.deepEqual(previous.cases.map(row => [row.surface, row.width]), ['datagrid-header-actions', 'datagrid-ready', 'datagrid-search-sort-filter-empty', 'datagrid-columns', 'datagrid-pagination', 'datagrid-selection-bulk', 'datagrid-row-menu', 'datagrid-query-failure', 'datagrid-default-consumer'].map(name => [name, 1440]));
      cases.push(...previous.cases); screenshots.push(...previous.screenshots);
      retained = { source: 'attempt-05-reduced-motion-css-semantics/browser-progress.json', originalIdentity: 'attempt-05-reduced-motion-css-semantics/browser-source-identity.json', originalTestedFixture: 'attempt-05-reduced-motion-css-semantics/tested-fixture.mjs', originalTestedFixtureSha256: hash(testedSource), entrySourceSha256: hash(entrySource(testedSource)), unchangedCompiledInputCount: inputs.length, cases: previous.cases.length, boundary: 'Nine completed Desktop cases retain their original tested receipt. All component-entry bytes and product/compiler/CSS/font source hashes match. Only the later reduced-motion assertion is corrected; this run executes Desktop reduced motion plus all Mobile cases. No compiled-output byte comparison or relabelled old fixture SHA is claimed.' };
    }
    const rowLocator = () => page.locator('tbody tr[data-entity-row-id]');
    const ids = () => rowLocator().evaluateAll(rows => rows.map(row => Number(row.dataset.entityRowId)));
    const toolbar = () => page.locator('[data-admin-collection-toolbar-owner]');
    const search = () => toolbar().locator('input').first();
    const expectedIds = params => topicsResult('ready', new URLSearchParams(params)).rows.map(row => row.id);
    async function settled(params = '') { await expect.poll(ids).toEqual(expectedIds(params)); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(0); }
    async function ready() { await open('topics'); await settled(); }
    async function columns() { await toolbar().locator('[data-admin-toolbar-columns] button').click(); await expect(page.locator('[data-admin-column-menu]')).toBeVisible(); return page.locator('[data-admin-column-menu]'); }
    async function geometry() {
      const result = await noOverflow();
      const grid = page.locator('[data-admin-data-grid-scroll]');
      const bounds = await grid.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, right: element.getBoundingClientRect().right, viewport: innerWidth, direction: getComputedStyle(element).direction }));
      assert.equal(bounds.direction, 'rtl'); assert.ok(bounds.right <= bounds.viewport + 1); assert.ok(bounds.width > 100);
      if (await page.locator('[data-admin-data-grid-presentation="cinematic"]').count()) {
        const width = await page.locator('thead th[data-admin-column-key="title"]').evaluate(element => element.getBoundingClientRect().width);
        const minimum = await page.evaluate(() => window.fixtureTitleMinimum);
        assert.ok(width >= minimum - 1, 'Cinematic flexible title must retain its declared minimum instead of being squeezed by fixed columns: ' + JSON.stringify({ width, minimum }));
      }
      return { page: result, grid: bounds, horizontalScrollContained: bounds.scroll >= bounds.width };
    }
    async function headerActions(surface, width) {
      await open(surface);
      const header = page.locator('[data-admin-page-header]').filter({ has: page.getByRole('heading', { name: surface === 'dashboard' ? 'لوحة التحكم' : 'إدارة الموضوعات', exact: true }) });
      const labels = surface === 'dashboard' ? ['موضوع جديد', 'تصنيف جديد', 'الإعدادات'] : ['إضافة موضوع جديد', 'إدارة التصنيفات', 'سلاسل المحتوى', 'المحذوفات'];
      const buttons = [];
      for (const label of labels) {
        const button = header.getByRole('link', { name: label, exact: true }); await expect(button).toBeVisible();
        const baseline = await button.evaluate(element => { const s = getComputedStyle(element); return { href: element.getAttribute('href'), height: element.getBoundingClientRect().height, padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft], size: s.fontSize, weight: s.fontWeight, background: s.backgroundImage, border: s.borderColor, color: s.color }; });
        assert.ok(baseline.height >= 44); assert.ok(baseline.background.includes('gradient'));
        await button.hover(); await page.keyboard.press('Tab'); await button.focus(); await expect(button).toBeFocused();
        const focus = await button.evaluate(element => { const s = getComputedStyle(element); return { width: s.outlineWidth, style: s.outlineStyle }; });
        assert.ok(parseFloat(focus.width) >= 2 && focus.style !== 'none'); buttons.push({ label, ...baseline, focus });
      }
      const scale = buttons.map(({ height, padding, size, weight }) => ({ height, padding, size, weight }));
      assert.ok(scale.every(value => JSON.stringify(value) === JSON.stringify(scale[0])), 'All Module Header roles use one control scale');
      // Dashboard now explicitly adopts the approved shared cinematic container.
      // Historical evidence is retained as recorded, never relabelled current.
      await expect(header).toHaveAttribute('data-admin-page-header-presentation', 'cinematic');
      await geometryForHeader(); await screenshot(`datagrid-${surface}-actions-${width}-rtl`);
      return buttons;
    }
    async function geometryForHeader() { return noOverflow(); }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (!(resume && width === 1440)) {
      const dashboardActions = await headerActions('dashboard', width), topicsActions = await headerActions('topics', width);
      assert.deepEqual(dashboardActions.map(({ height, padding, size, weight }) => ({ height, padding, size, weight }))[0], topicsActions.map(({ height, padding, size, weight }) => ({ height, padding, size, weight }))[0], 'Dashboard and Topics retain identical Module Header button scale');
      cases.push({ surface: 'datagrid-header-actions', width, dashboardActions, topicsActions, dashboardFunctionalIdentityRetained: true, dashboardContainerPresentation: 'cinematic' });
      await ready();
      await expect(page.locator('[data-admin-data-grid-presentation="cinematic"]')).toHaveCount(1);
      const initialColumns = await page.locator('thead th[data-admin-column-key]').evaluateAll(nodes => nodes.map(node => node.dataset.adminColumnKey));
      const firstRow = rowLocator().first(), beforeHover = await firstRow.evaluate(element => getComputedStyle(element).backgroundColor);
      await firstRow.hover(); const hover = await firstRow.evaluate(element => ({ color: getComputedStyle(element).backgroundColor, image: getComputedStyle(element).backgroundImage, duration: getComputedStyle(element).transitionDuration }));
      assert.ok(hover.image !== 'none' || hover.color !== beforeHover, 'Row hover uses the actual quiet shared presentation');
      await screenshot(`datagrid-topics-${width}-ready-rtl`); cases.push({ surface: 'datagrid-ready', width, ids: await ids(), columns: initialColumns, hover, geometry: await geometry() });

      await search().fill('05'); await search().press('Enter'); await settled('q=05');
      await toolbar().getByRole('button', { name: 'مسح', exact: true }).click(); await settled();
      const sort = page.locator('th[data-admin-column-key="title"] button'); await sort.click(); await settled('sort=title_desc'); await expect(page.locator('th[data-admin-column-key="title"]')).toHaveAttribute('aria-sort', 'descending');
      await ready(); await page.locator('[data-admin-filter-trigger]').click(); const dialog = page.getByRole('dialog', { name: 'الفلاتر', exact: true });
      await dialog.getByRole('listbox', { name: 'الحالة', exact: true }).getByRole('option', { name: 'منشور', exact: true }).click();
      await dialog.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click(); await settled('status=published');
      await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'الموضوعات', exact: true }).click(); await settled();
      await search().fill('غيرموجود'); await search().press('Enter'); await settled('q=غيرموجود'); await expect(page.getByText('لا توجد موضوعات مطابقة للفلاتر الحالية.', { exact: true })).toBeVisible();
      cases.push({ surface: 'datagrid-search-sort-filter-empty', width, exactRowsAndQueryPreserved: true });

      await ready(); let menu = await columns();
      await menu.getByRole('checkbox', { name: 'إخفاء عمود السلسلة', exact: true }).click(); await expect(page.locator('thead th[data-admin-column-key="series"]')).toHaveCount(0);
      await expect.poll(() => gridTransport.preference?.includes('series')).toBe(false);
      await page.keyboard.press('Escape'); await expect(toolbar().locator('[data-admin-toolbar-columns] button')).toBeFocused();
      await page.reload(); await settled(); await expect(page.locator('thead th[data-admin-column-key="series"]')).toHaveCount(0);
      menu = await columns(); gridTransport.failPreferences = true;
      await menu.getByRole('checkbox', { name: 'إخفاء عمود SEO', exact: true }).click();
      await expect(menu.getByRole('alert')).toContainText('تعذر حفظ'); await expect(page.locator('thead th[data-admin-column-key="seo"]')).toHaveCount(1);
      assert.ok(gridTransport.preference.includes('seo'), 'Failed preference cannot overwrite committed state'); gridTransport.failPreferences = false;
      await menu.getByRole('button', { name: 'استعادة الأعمدة الافتراضية', exact: true }).click(); await expect(menu).toHaveCount(0);
      await expect.poll(() => page.locator('thead th[data-admin-column-key]').evaluateAll(nodes => nodes.map(node => node.dataset.adminColumnKey))).toEqual(initialColumns);
      cases.push({ surface: 'datagrid-columns', width, hidePersistReload: true, saveFailureRollback: true, restoreDefaults: true, escapeFocus: true });

      await page.locator('[data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); await settled('page=2');
      await page.locator('[data-admin-table-pagination] button[aria-haspopup="listbox"]').click(); const nextSize = topicsQueryContract.pageSizeOptions.find(value => value > topicsQueryContract.defaultPageSize);
      await page.locator('[data-admin-table-pagination-menu]').getByRole('option', { name: String(nextSize), exact: true }).click(); await settled('limit=' + nextSize);
      cases.push({ surface: 'datagrid-pagination', width, pageTwo: true, pageSize: nextSize, resetToFirstPage: new URL(page.url()).searchParams.get('page') === null });

      await ready(); const firstTitle = gridRows[0].title, secondTitle = gridRows[1].title;
      await page.getByRole('checkbox', { name: 'تحديد ' + firstTitle, exact: true }).check(); await page.getByRole('checkbox', { name: 'تحديد ' + secondTitle, exact: true }).check();
      const bar = page.locator('[data-admin-bulk-action-bar]'); await expect(bar).toContainText('2');
      await bar.locator('button[aria-haspopup="listbox"]').click(); await page.getByRole('option', { name: 'حذف المحدد', exact: true }).click();
      const attempts = gridTransport.actions.length; await bar.getByRole('button', { name: 'تنفيذ', exact: true }).click(); const confirmation = page.locator('[data-admin-confirm-dialog]'); await expect(confirmation).toBeVisible();
      await confirmation.locator('[data-admin-confirm-cancel]').click(); await expect(confirmation).toHaveCount(0); assert.equal(gridTransport.actions.length, attempts); await expect(bar.getByRole('button', { name: 'تنفيذ', exact: true })).toBeFocused();
      gridTransport.holdActions = true; gridTransport.failActions = true;
      await bar.getByRole('button', { name: 'تنفيذ', exact: true }).click(); await confirmation.locator('[data-admin-confirm-submit]').click();
      await expect.poll(() => gridTransport.heldActions.length).toBe(1); await expect(bar).toHaveAttribute('aria-busy', 'true'); await expect(bar.locator('button[type="submit"]')).toBeDisabled();
      assert.deepEqual(gridTransport.actions.at(-1).args[0].form.filter(([key]) => key === 'topic_ids').map(([, value]) => Number(value)), [gridRows[0].id, gridRows[1].id], 'Actual bulk callback preserves the exact selected IDs');
      await screenshot(`datagrid-bulk-pending-${width}-rtl`); gridTransport.holdActions = false; while (gridTransport.heldActions.length) gridTransport.heldActions.shift()();
      await expect(bar).not.toHaveAttribute('aria-busy', 'true'); await expect(page.getByRole('checkbox', { name: 'تحديد ' + firstTitle, exact: true })).toBeChecked(); await expect(page.getByRole('checkbox', { name: 'تحديد ' + secondTitle, exact: true })).toBeChecked();
      assert.equal(gridTransport.actions.length, attempts + 1); gridTransport.failActions = false;
      await bar.getByRole('button', { name: 'إلغاء التحديد', exact: true }).click(); await expect(bar).toHaveCount(0);
      cases.push({ surface: 'datagrid-selection-bulk', width, exactSelectedIds: [gridRows[0].id, gridRows[1].id], cancelZeroExecution: true, pendingDisabled: true, oneIsolatedAttempt: true, rejectionRetainsSelectionAndRows: true });

      const more = rowLocator().first().locator('[data-admin-row-action="more"] button'); await more.focus(); await more.press('ArrowDown');
      const rowMenu = page.locator('[data-admin-row-actions-menu]'); await expect(rowMenu).toBeVisible(); const items = rowMenu.locator('[data-admin-row-action-menu-item]:not([aria-disabled="true"])'); await expect(items.first()).toBeFocused();
      await page.keyboard.press('End'); await expect(items.last()).toBeFocused(); await page.keyboard.press('Escape'); await expect(rowMenu).toHaveCount(0); await expect(more).toBeFocused();
      await more.click(); await rowMenu.locator('[data-admin-row-action-menu-item="information"]').click(); const information = page.locator('[data-admin-row-actions-information]'); await expect(information).toContainText('معلومات نشاط المحتوى'); await page.keyboard.press('Escape'); await expect(more).toBeFocused();
      cases.push({ surface: 'datagrid-row-menu', width, arrowOpenEndEscapeFocus: true, actualInformation: true, editPreviewLinksPreserved: await rowLocator().first().locator('[data-admin-row-action="edit"] a,[data-admin-row-action="preview"] a').count() === 2 });

      await ready(); holdReads = true; await search().fill('08'); await search().press('Enter'); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.equal((await ids()).length, 10);
      await screenshot(`datagrid-query-pending-${width}-rtl`); holdReads = false; while (held.length) held.shift()(); await settled('q=08');
      failReads = true; await search().fill('09'); await search().press('Enter'); await expect(page.locator('[data-admin-entity-list-query-error]')).toContainText('تعذر تحديث النتائج'); assert.deepEqual(await ids(), expectedIds('q=08')); failReads = false;
      await screenshot(`datagrid-query-error-${width}-rtl`); cases.push({ surface: 'datagrid-query-failure', width, pendingRetainsRows: true, failureRetainsLastRows: true });

      await open('grid-defaults'); const defaults = page.locator('[data-cinematic-grid-defaults]'); await expect(defaults.locator('[data-admin-data-grid-presentation="cinematic"]')).toHaveCount(1); await expect(defaults.locator('[data-admin-pagination-presentation="cinematic"]')).toHaveCount(1);
      await defaults.locator('[data-admin-pagination-slot="page"]').filter({ hasText: /^2$/u }).click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'default-page' && event.value === 2)));
      await screenshot(`datagrid-defaults-${width}-rtl`); cases.push({ surface: 'datagrid-default-consumer', width, officialDefaultPresentationAdopted: true, callbackPreserved: true, geometry: await geometry() });
      }
      await ready(); await page.emulateMedia({ reducedMotion: 'reduce' }); await rowLocator().first().hover();
      const reduced = await rowLocator().first().evaluate(element => { const s = getComputedStyle(element); return { animation: s.animationName, transitionProperty: s.transitionProperty, transition: s.transitionDuration, runningAnimations: element.getAnimations().filter(animation => animation.playState === 'running').length }; });
      assert.equal(reduced.animation, 'none'); assert.ok(reduced.transitionProperty === 'none' || reduced.transition.split(',').every(value => parseFloat(value) === 0), JSON.stringify(reduced)); assert.equal(reduced.runningAnimations, 0);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); cases.push({ surface: 'datagrid-reduced-motion', width, reduced });
    }
  }
  async function verifyRefinements() {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const surface of ['dashboard', 'topics']) {
        if (cases.some(row => row.surface === 'cinematic-v11-ready' && row.consumer === surface && row.width === width)) continue;
        await open(surface);
        const cards = surface === 'dashboard' ? page.getByRole('region', { name: 'مؤشرات Dashboard', exact: true }).locator(':scope > *') : page.locator('[data-admin-metric-cards-viewport] section').locator(':scope > *');
        await expect(cards).toHaveCount(6);
        const values = await cards.allTextContents(), expected = surface === 'dashboard' ? dashboardValues : ['901', '203', '698', '84', '23', '87'];
        expected.forEach((value, index) => assert.ok(values[index].includes(value), `${surface} metric ${index} retains source binding`));
        assert.ok(!values.some(value => /\+\d|من الشهر الماضي|نمو/u.test(value)), 'No illustrative trends enter real data');
        const artwork = await cards.locator('[data-admin-metric-artwork]').evaluateAll(nodes => nodes.map(node => ({ kind: node.getAttribute('data-admin-metric-artwork'), hidden: node.getAttribute('aria-hidden'), focusable: node.getAttribute('focusable'), pointerEvents: getComputedStyle(node).pointerEvents, opacity: getComputedStyle(node).opacity, paths: node.querySelectorAll('path,rect,circle,ellipse,line,polyline').length })));
        assert.equal(artwork.length, 6); assert.equal(new Set(artwork.map(row => row.kind)).size, 6);
        assert.ok(artwork.every(row => row.hidden === 'true' && row.focusable === 'false' && row.pointerEvents === 'none' && Number(row.opacity) > 0 && Number(row.opacity) < .2 && row.paths > 0), JSON.stringify(artwork));
        const metric = cards.nth(surface === 'topics' ? 1 : 0);
        const rest = await motion(metric), hover = await activeEdge(metric, 'hover');
        await expect.poll(async () => (await motion(metric)).transform).not.toBe(rest.transform);
        await expect.poll(async () => (await motion(metric)).transform).toMatch(/-4\)/u);
        const lifted = await motion(metric); assert.match(lifted.transform, /-4\)/u, 'Existing KPI lift is restored at four pixels');
        await screenshot(`v11-${surface}-${width}-metric-hover-rtl`);
        let focus = null;
        if (surface === 'topics') {
          focus = await activeEdge(metric, 'focus'); const focused = await motion(metric);
          assert.ok(parseFloat(focused.outlineWidth) >= 2 && focused.outlineStyle !== 'none');
          await screenshot(`v11-${surface}-${width}-metric-focus-rtl`);
          await metric.evaluate(element => element.blur());
          const header = page.locator('[data-admin-page-header-presentation="cinematic"]:visible');
          assert.equal(await header.evaluate(element => getComputedStyle(element).paddingTop), '12px');
          assert.equal(await header.evaluate(element => getComputedStyle(element).paddingBottom), '12px');
          for (const [label, href] of [['إضافة موضوع جديد', '/admin/content/topics/new'], ['إدارة التصنيفات', '/admin/content/categories'], ['سلاسل المحتوى', '/admin/content/series'], ['المحذوفات', '/admin/content/topics?view=trash']]) await expect(header.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
          const add = header.getByRole('link', { name: 'إضافة موضوع جديد', exact: true });
          const headerMotion = await moduleTitleMotion(header, add);
          assert.ok(await add.evaluate(element => { const box = element.getBoundingClientRect(), target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return target === element || element.contains(target); }), 'Header artwork and edge leave the actual action hit target available');
          cases.push({ surface: 'module-header-v11', width, motion: headerMotion, verticalPaddingPx: 12, exactActionsRetained: true });
          await add.evaluate(element => element.blur());
        }
        const shellHeader = page.locator('[data-admin-shell-header]');
        const shellMotion = await activeEdge(shellHeader.getByRole('button', { name: /خروج/u }), 'focus');
        await shellHeader.getByRole('button', { name: /خروج/u }).evaluate(element => element.blur());
        await page.mouse.move(0, 0);
        const geometry = await noOverflow();
        const typography = await cards.evaluateAll(nodes => nodes.map(node => { const label = node.querySelector('[data-admin-metric-content] p'), value = node.querySelector('[data-admin-metric-content] p[dir="ltr"]'); return { label: { family: getComputedStyle(label).fontFamily, size: getComputedStyle(label).fontSize, weight: getComputedStyle(label).fontWeight, height: label.getBoundingClientRect().height }, value: { family: getComputedStyle(value).fontFamily, size: getComputedStyle(value).fontSize, weight: getComputedStyle(value).fontWeight } }; }));
        await screenshot(`v11-${surface}-${width}-ready-rtl`);
        await page.emulateMedia({ reducedMotion: 'reduce' }); await metric.hover();
        const reduced = await motion(metric); assert.equal(reduced.edge.animationName, 'none'); assert.ok(reduced.transform === 'none' || reduced.transform === 'matrix(1, 0, 0, 1, 0, 0)');
        if (surface === 'topics') { await page.keyboard.press('Tab'); await metric.focus(); assert.equal((await motion(metric)).edge.animationName, 'none'); await metric.evaluate(element => element.blur()); }
        await shellHeader.getByRole('button', { name: /خروج/u }).focus(); assert.equal((await motion(shellHeader)).edge.animationName, 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        cases.push({ surface: 'cinematic-v11-ready', consumer: surface, width, values, artwork, typography, geometry, hover, focus, shellMotion, reducedMotion: { edgeNone: true, liftNone: true, sampled: reduced } });
        if (surface === 'topics' && width === 1440) {
          await metric.click(); await expect.poll(() => new URL(page.url()).searchParams.get('status')).toBe('published'); await expect(metric).toHaveAttribute('aria-pressed', 'true');
          cases.push({ surface: 'v11-metric-hit-target', exactFilterCallback: true, artworkDidNotIntercept: true });
        }
      }
      await open('defaults'); const defaults = page.locator('[data-cinematic-defaults]');
      await expect(defaults.locator('[data-admin-page-header-presentation="cinematic"]')).toHaveCount(1); await expect(defaults.locator('[data-admin-metric-presentation="cinematic"]')).toHaveCount(2); assert.equal(await defaults.locator('[data-admin-metric-artwork]').count(), 0, 'Official Module Header and KPI defaults adopt their canonical owners without inventing artwork');
      await defaults.getByRole('button', { name: 'مقياس تفاعلي', exact: true }).click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(event => event.kind === 'default-click')));
      await noOverflow(); await screenshot(`v11-defaults-${width}-rtl`); cases.push({ surface: 'v11-shared-defaults', width, officialHeaderDefaultAdopted: true, officialMetricDefaultAdopted: true, callbackRetained: true });
      await page.evaluate(() => localStorage.clear()); await open('draft-date');
      const notice = page.locator('[data-topic-form-draft="pending"]'), time = notice.locator('time'); await expect(notice).toHaveCount(1);
      const date = await page.evaluate(() => window.fixtureDate); await expect(time).toHaveAttribute('datetime', date.savedAt); await expect(time).toHaveText(date.expected); await expect(time).toHaveAttribute('title', 'التوقيت: Africa/Cairo');
      assert.ok(date.expected.includes('24/10/2026') && date.expected.includes('06:00 AM'));
      await expect(page.locator('[data-cinematic-date-form] input[name="title"]')).toHaveValue('Saved title');
      const raw = await page.evaluate(key => localStorage.getItem(key), date.key); assert.equal(raw, date.raw);
      await noOverflow(); await screenshot(`v11-draft-date-${width}-rtl`);
      await notice.getByRole('button', { name: 'إغلاق الإشعار', exact: true }).click(); await expect(time).toHaveCount(0); await expect(notice).toHaveAttribute('data-topic-form-draft-dismissed', 'true'); assert.equal(await page.evaluate(key => localStorage.getItem(key), date.key), raw);
      await page.reload(); await expect(time).toHaveCount(1); await expect(time).toHaveText(date.expected); assert.equal(await page.evaluate(key => localStorage.getItem(key), date.key), raw);
      cases.push({ surface: 'v11-draft-date', width, datetime: date.savedAt, displayed: date.expected, sharedTimeZone: 'Africa/Cairo', rawStorageUnchanged: true, fieldsUnchanged: true, closeAndReloadRetained: true });
    }
    await page.setViewportSize({ width: 390, height: 1000 }); await open('defaults'); await page.locator('[data-admin-shell-header]').getByRole('button', { name: 'فتح القائمة', exact: true }).click(); const menu = page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true }); await expect(menu).toBeVisible(); await menu.getByRole('button', { name: 'إغلاق القائمة', exact: true }).click({ position: { x: 10, y: 10 } }); await expect(menu).toHaveCount(0); cases.push({ surface: 'v11-mobile-menu', openAndClose: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await open('defaults'); await Promise.all([page.waitForURL(logoutDestination(), { waitUntil: 'load' }), page.locator('[data-admin-shell-header]').getByRole('button', { name: /خروج/u }).click()]); await expect.poll(() => requests.filter(row => row.path === '/api/admin/auth/logout').length).toBe(1); cases.push({ surface: 'v11-system-header-logout', localFakeEndpointOnly: true });
  }
  if (moduleTitleShimmerOnly) await verifyModuleTitleShimmer(); else if (kpiAdoptionOnly) await verifyKpiAdoption(); else if (systemwideAdoptionOnly) await verifySystemwideAdoption(); else if (sidebarSelectionOnly) await verifySidebarSelection(); else if (finalAlignmentOnly) await verifyFinalAlignment(); else if (dataGridRefinementOnly) await verifyDataGridRefinement(); else if (dataGridOnly) await verifyDataGrid(); else await verifyRefinements();
  if (!refinementOnly && !dataGridOnly) {
  for (const width of failureOnly ? [] : [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const surface of ['dashboard', 'topics']) {
      if (retained && width === 1440 && surface === 'dashboard') continue;
      await open(surface);
      const cards = surface === 'dashboard' ? page.getByRole('region', { name: 'مؤشرات Dashboard', exact: true }).locator(':scope > *') : page.locator('[data-admin-metric-cards-viewport] section').locator(':scope > *');
      await expect(cards).toHaveCount(6);
      const values = await cards.evaluateAll(elements => elements.map(element => element.textContent));
      const expected = surface === 'dashboard' ? dashboardValues : ['901', '203', '698', '84', '23', '87'];
      expected.forEach((value, index) => assert.ok(values[index].includes(value), `${surface} metric ${index} binds unique current read value`));
      assert.ok(!values.some(value => /\+\d|من الشهر الماضي|نمو/u.test(value)), 'No invented trend');
      if (surface === 'topics') {
        assert.ok(!values.some(value => value.includes('بدون صورة')), 'Image capability omitted only from KPI row');
        const header = page.locator('[data-admin-page-header]').filter({ has: page.getByRole('heading', { name: 'إدارة الموضوعات', exact: true }) });
        for (const [label, href] of [['إضافة موضوع جديد', '/admin/content/topics/new'], ['إدارة التصنيفات', '/admin/content/categories'], ['سلاسل المحتوى', '/admin/content/series'], ['المحذوفات', '/admin/content/topics?view=trash']]) await expect(header.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
        const active = cards.nth(1), before = await active.evaluate(element => ({ border: getComputedStyle(element).borderColor, outline: getComputedStyle(element).outlineWidth }));
        await active.hover(); await expect.poll(() => active.evaluate(element => getComputedStyle(element).borderColor)).not.toBe(before.border); await screenshot(`topics-${width}-metric-hover-rtl`);
        await page.keyboard.press('Tab'); await active.focus(); await expect(active).toBeFocused();
        const focus = await active.evaluate(element => ({ outline: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, color: getComputedStyle(element).outlineColor })); assert.ok(parseFloat(focus.outline) >= 2 && focus.style !== 'none' && focus.color !== 'rgba(0, 0, 0, 0)', 'Focusable metric exposes an actual visible outline, independent of its permanent shadow'); await screenshot(`topics-${width}-metric-focus-rtl`);
        await active.evaluate(element => element.blur());
        await page.mouse.move(0, 0);
      }
      const geometry = await noOverflow(); await screenshot(`${surface}-${width}-ready-rtl`); cases.push({ surface, state: 'ready', width, metrics: values, geometry });
      for (const state of ['empty', 'error']) {
        await open(surface, state); await expect(cards).toHaveCount(6);
        const text = await cards.allTextContents();
        if (state === 'error') assert.ok(text.every(value => value.includes(surface === 'dashboard' ? 'غير متاح' : '—')), 'Unavailable sources do not become zero');
        else assert.ok(text.every((value, index) => surface === 'topics' && index === 5 ? value.includes('—') : value.includes('0')), 'Actual source zero remains zero');
        await noOverflow(); await screenshot(`${surface}-${width}-${state}-rtl`); cases.push({ surface, state, width, metrics: text });
      }
    }
    await open('loading'); await expect(page.getByRole('heading', { name: 'جارٍ تحميل الصفحة', exact: true })).toBeVisible(); await noOverflow(); await screenshot(`loading-${width}-rtl`); cases.push({ surface: 'shared-loading', width });
    await open('defaults'); const defaults = page.locator('[data-cinematic-defaults]'); assert.equal(await defaults.locator('[data-admin-metric-presentation="cinematic"]').count(), 2); assert.equal(await defaults.locator('[data-admin-page-header-presentation="cinematic"]').count(), 1); assert.equal(await defaults.locator('[data-admin-metric-artwork]').count(), 0); await defaults.getByRole('button', { name: 'مقياس تفاعلي', exact: true }).click(); assert.ok(await page.evaluate(() => window.fixtureEvents.some(e => e.kind === 'default-click'))); await noOverflow(); await screenshot(`shared-defaults-${width}-rtl`); cases.push({ surface: 'shared-defaults', width, officialHeaderAndMetricDefaultContracts: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const filters = [['منشور', 'status', 'published'], ['غير منشور', 'status', 'unpublished'], ['مرتبطة بسلسلة', 'series', 'any'], ['مميزة', 'featured', 'yes']];
  for (const [label, param, value] of failureOnly ? [] : filters) {
    await open('topics'); const card = page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: label, exact: true }); await card.click(); await expect.poll(() => new URL(page.url()).searchParams.get(param)).toBe(value); await expect(card).toHaveAttribute('aria-pressed', 'true'); cases.push({ surface: 'topics-filter', label, param, value });
  }
  if (!failureOnly) {
  await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'الموضوعات', exact: true }).click(); await expect.poll(() => new URL(page.url()).searchParams.get('featured')).toBe(null); await expect(page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'الموضوعات', exact: true })).toHaveAttribute('aria-pressed', 'true'); cases.push({ surface: 'topics-reset', restoresActiveDefaultQuery: true });
  await page.getByRole('button', { name: 'الفلاتر', exact: true }).click(); const filterDialog = page.getByRole('dialog', { name: 'الفلاتر', exact: true }); await expect(filterDialog).toBeVisible(); await filterDialog.getByRole('listbox', { name: 'الصورة', exact: true }).getByRole('option', { name: 'بدون صورة', exact: true }).click(); await filterDialog.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click(); await expect.poll(() => new URL(page.url()).searchParams.get('image')).toBe('without'); cases.push({ surface: 'topics-image-filter', existingCapabilityRetained: true, removedFromKpiOnly: true });
  }
  await open('topics'); holdReads = true; await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'منشور', exact: true }).click(); await expect(page.locator('[data-admin-entity-list-pending="true"]')).toHaveCount(1); assert.ok((await page.locator('[data-admin-metric-cards-viewport]').textContent()).includes('901'), 'Pending retains last real metrics'); await screenshot('topics-pending-retains-metrics-rtl'); holdReads = false; while (held.length) held.shift()(); await expect(page.locator('[data-admin-entity-list-pending="false"]')).toHaveCount(1); cases.push({ surface: 'topics-pending', retainedRealMetrics: true });
  await open('topics'); failReads = true; await page.locator('[data-admin-metric-cards-viewport]').getByRole('button', { name: 'مميزة', exact: true }).click(); const queryError = page.locator('[data-admin-entity-list-query-error]'); await expect(queryError).toContainText('تعذر تحديث النتائج'); await expect(queryError).toContainText('الصفوف والعدّادات المعروضة تخص النتائج السابقة. Unable to load the requested list.'); assert.ok((await page.locator('[data-admin-metric-cards-viewport]').textContent()).includes('901'), 'Request failure retains visible prior metrics'); await screenshot('topics-query-failure-retains-metrics-rtl'); cases.push({ surface: 'topics-query-failure', retainedRealMetrics: true });
  await page.setViewportSize({ width: 390, height: 1000 }); await open('defaults'); await page.locator('[data-admin-shell-header]').getByRole('button', { name: 'فتح القائمة', exact: true }).click(); const menu = page.getByRole('dialog', { name: 'قائمة الإدارة', exact: true }); await expect(menu).toBeVisible(); await screenshot('system-header-390-open-menu-rtl'); await menu.getByRole('button', { name: 'إغلاق القائمة', exact: true }).click({ position: { x: 10, y: 10 } }); await expect(menu).toHaveCount(0); cases.push({ surface: 'system-header-mobile-menu', width: 390, openAndClose: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open('defaults'); const logout = page.locator('[data-admin-shell-header]').getByRole('button', { name: /خروج/u }), previousLogoutCount = requests.filter(row => row.path === '/api/admin/auth/logout').length; await Promise.all([page.waitForURL(logoutDestination(), { waitUntil: 'load' }), logout.click()]); await expect.poll(() => requests.filter(row => row.path === '/api/admin/auth/logout').length).toBe(previousLogoutCount + 1); cases.push({ surface: 'system-header', logoutPath: '/api/admin/auth/logout', logoutMethod: 'POST', isolatedOnly: true });
  }
  } catch (error) {
    if (dataGridOnly && page) await screenshot('datagrid-failure').catch(() => {});
    const browserState = dataGridOnly && page ? await page.evaluate(() => ({ url: location.href, ready: document.readyState, root: document.getElementById('root')?.innerHTML.slice(0, 2000), scripts: [...document.scripts].map(script => script.src) })).catch(() => null) : undefined;
    await writeFile(path.join(output, 'browser-failure.json'), JSON.stringify({ status: 'FAIL', message: String(error), cases, screenshots, errors, forbidden, ...(dataGridOnly ? { browserState, requests, isolatedActionTransports: gridTransport.actions, committedPreference: gridTransport.preference } : {}) }, null, 2) + '\n');
    throw error;
  } finally {
    holdReads = false; while (held.length) held.shift()();
    gridTransport.holdActions = false; while (gridTransport.heldActions.length) gridTransport.heldActions.shift()();
    try { await browser?.close(); } finally { server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
  const currentHashes = Object.fromEntries(await Promise.all(Object.keys(hashes).map(async file => [file, hash(await readFile(sourcePath(file)))])));
  assert.deepEqual(currentHashes, hashes, 'Final visual round runs on stable source bytes'); assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
  let reusedV10 = null;
  if (refinementOnly) {
    const priorPath = path.join(root, '.tmp-qa/admin-development-batch-01/cinematic-admin-ui-20261024/cinematic-browser.json'), priorBytes = await readFile(priorPath), prior = JSON.parse(priorBytes);
    assert.equal(prior.status, 'PASS'); assert.equal(prior.cases.length, 26);
    const paths = Object.keys(prior.sourceHashes).filter(file => file.startsWith('src/lib/admin/entity-list/') || file.startsWith('src/lib/admin/dashboard/') || file.includes('/entity-list-contracts/') || file.endsWith('src/app/api/admin/entity-lists/[entity]/route.ts') || file.endsWith('src/app/admin/content/topics/actions.ts') || file === 'src/app/admin/loading.tsx');
    assert.ok(paths.length > 5);
    for (const file of paths) assert.equal(hash(await readFile(path.join(root, file))), prior.sourceHashes[file], 'Reused v1.0 source semantics unchanged: ' + file);
    reusedV10 = { path: priorPath, sha256: hash(priorBytes), status: prior.status, originalCases: prior.cases.length, unchangedDataInputPaths: paths, scope: 'Existing metric definitions, query/default filters, loading and empty/error source semantics only. v1.1 visual proof is the new bounded round; v1.0 visuals are not relabelled current.' };
  }
  const dataGridRefinementMethod = 'Visual delta of actual Topics table/tools through the current canonical owners at Desktop/Mobile RTL. Tests cover the joined frame, row states without displacement, portal menus and focus, local selection, read-only pagination, state layout, default nonadopter and effective reduced motion. The historical DataGrid v1.0, Dashboard, Module/System Header, KPI and Batch matrices are not executed. Local preference/domain action transport count must remain zero. Actual served Next CSS and mockup comparison are separately evidenced on live routes.';
  const finalAlignmentMethod = 'Eight bounded final-alignment cases render the actual Dashboard and Topics components in the existing isolated fixture: shared Module Header adoption, preserved System Header and legacy motion, one-cycle Grid entry/held completion/exit/reentry, static keyboard cue, full-row color-only refinement, compact read-only functional smoke, default/continuous preservation, effective reduced motion, and one responsive functional smoke. Historical Batch/Gold/Grid matrices are not replayed or relabelled. Source-stable fixture timing is supplementary; the actual Next route temporal captures and served CSS are separate mandatory evidence. Preference and domain action transports are denied.';
  const sidebarSelectionMethod = 'Bounded delta in the existing cinematic fixture renders the actual AdminShell with its current resolved navigation registry and actual Topics/default semantic Entity Lists. Desktop expanded/collapsed/groups, longest active leaf, persistent collapse, keyboard/prefetch/router signals, scroll, mobile modal trap/Escape/backdrop/resize/focus return, navy single/multiple/page-only Select All/indeterminate/hover/independent focus, semantic danger bulk confirmation/pending/rejection/retry, query controls, default selection and effective reduced motion execute. Only the explicit bulk UI lifecycle uses disposable in-memory action transports. Prior Header/KPI/Batch matrices remain separate and are not replayed or relabelled. Actual authenticated application screenshots and Next-served CSS require separate live evidence.';
  const result = { status: 'PASS', version: moduleTitleShimmerOnly ? (moduleTitleShimmerBefore ? 'admin-module-title-shimmer-before' : 'admin-module-title-shimmer-visual-completeness') : kpiAdoptionOnly ? 'admin-kpi-default-adoption' : systemwideAdoptionOnly ? 'admin-systemwide-presentation-adoption' : sidebarSelectionOnly ? 'admin-sidebar-v2-selection-default-delta' : finalAlignmentOnly ? 'cinematic-final-visual-alignment' : dataGridRefinementOnly ? 'cinematic-datagrid-v1.1-delta' : dataGridOnly ? 'cinematic-datagrid-v1' : refinementOnly ? 'cinematic-gold-v1.1-delta' : 'cinematic-gold-current-full', createdAtUtc: new Date().toISOString(), globalClosed: false, ownerFunctionalApproval: 'PENDING', ownerVisualApproval: 'PENDING', method: moduleTitleShimmerOnly ? (moduleTitleShimmerBefore ? 'Frozen true pre-shimmer Header/CSS/module tokens are read through the existing webpack readResource and PostCSS seam, with all other current owners/finite read ports unchanged. One actual Header per page renders short and long Arabic titles with omitted/default/cinematic aliases for measured geometry. This is a distinct original-source receipt, not injected style or current Product evidence.' : 'Existing cinematic fixture renders one actual shared Header per page with short/long Arabic titles and all aliases, then captures native CSS wall-time rendered title pixels to prove a leftward gold wave without animation-time or style injection. Frozen original Header/CSS/token geometry is compared when available. Reduced motion, native keyboard actions and unchanged System/KPI/Grid/Sidebar owners execute with denied Actions/finite local reads. All five actual KPI consumers render registered foreground icons/semantic artwork with preserved real binding, static/filter commands and count geometry; Categories/Series Headers use exact route JSX, and exact async Construction Page uses finite external auth/read ports (no hosted auth/persistence claim). Actual authenticated Next delivery and Owner approval remain separate; older20/8matrices are not replayed or relabelled.') : kpiAdoptionOnly ? 'Eight bounded Desktop/Mobile RTL cases in the existing cinematic fixture render actual CategoriesListClient plus unchanged Dashboard/Topics and canonical Card/Grid alias/count probes. Real category controller callbacks, keyboard, active state, retained pending/error facts, static semantics, semantic icons, count-aware geometry, motion/focus/reduced motion execute with finite local read ports and denied domain/preference actions. Series and Construction coverage is source/SSR only. Sibling summary/report/integration families remain separately classified and are not visually adopted. Actual authenticated Next routes/CSS and Owner approval are separate. Prior systemwide20cases are not replayed or relabelled.' : systemwideAdoptionOnly ? 'Existing cinematic fixture renders actual Dashboard, Topics, CategoriesListClient, ProjectsTableClient, ProjectLocationsManagementClient, ContentBlocksTableClient, FooterLinksDataGrid, PageCompositionTableSurface plus AssignmentsGrid/Row, and current Header wrappers/ActionButton. Read-only family API ports are controlled; all domain/preference Actions denied. PageComposition/Footer mount named subowners only; report/integration data views are not mounted. Desktop/Mobile RTL, official omitted/default alias adoption, preserved query/navigation/native form/local reorder, semantic cursors including body portals and negative no-Admin scope, no invented selection, collection one-cycle edge and nested edge suppression, reduced motion and retained query failures are bounded proof. Actual authenticated routes and Next CSS delivery remain separate evidence; old acceptance matrices are not replayed or relabelled.' : sidebarSelectionOnly ? sidebarSelectionMethod : finalAlignmentOnly ? finalAlignmentMethod : dataGridRefinementOnly ? dataGridRefinementMethod : dataGridOnly ? 'Actual TopicsListClient, shared DataGrid, toolbar, Column Menu, Row Actions, Bulk, Pagination and unchanged Dashboard render in local Chromium. Only named external read/action ports are isolated; query semantics and rendering execute in current owners. Disposable in-memory rows are never hosted records. Exact route Module Header JSX is extracted from its current source. Desktop/Mobile RTL and browser reduced-motion are selected.' : 'Actual current components rendered in local Chromium with controlled read-only API and action-deny ports. Topics Module Header uses exact current route JSX AST. Actual query controller, shared owners/defaults, native callbacks and scoped local Draft date display execute. CSS pseudo animation currentTime proves progression and reduced-motion is checked with the browser media setting.', sourceHashes: hashes, ...(moduleTitleShimmerOnly ? { moduleTitleGeometry, frozenOriginalOwnerSources: moduleTitleShimmerBefore ? [...frozenTitleOwners] : [] } : {}), retained, reusedV10, cases, screenshots, requests, isolatedActionTransports: dataGridOnly ? gridTransport.actions : [], hostedDatabaseWrites: 0, productionMutations: 0, errors, forbidden, limitations: dataGridOnly ? ['Isolated transports prove UI lifecycle and preserved callback payloads; they do not prove hosted persistence, authorization, RLS or domain mutation correctness.', 'PostCSS fixture output does not prove that the running Next process serves the same CSS; actual-route verification is separate.', 'No full Batch QA, production, auth, storage, full Draft/Slug/Meta replay or Owner approval claim.'] : ['Controlled metric vectors prove existing source binding, not hosted count freshness.', 'Logout executes local fake endpoint only; actual authenticated session is untouched.', 'Minimal Draft date form executes the current recovery owner, formatting and visual-close behavior; prior full Draft Recovery proof remains separate.', 'No full Batch QA, production, RLS, auth or storage verification claim.'] };
  await writeFile(path.join(output, 'cinematic-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`PASS Cinematic Admin bounded Browser: ${cases.length} cases, ${screenshots.length} screenshots; no hosted writes.`);
}
