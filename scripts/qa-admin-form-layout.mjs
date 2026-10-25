import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
const require = createRequire(import.meta.url), root = process.cwd();
const recoveryPhase = process.env.ADMIN_UI_RECOVERY_PHASE;
assert(!recoveryPhase || ['before', 'after', 'owner-before', 'owner-after', 'layout-before', 'layout-after', 'consistency-before', 'consistency-after', 'button-refinement-before', 'button-refinement-after', 'pixel-refinement'].includes(recoveryPhase));
const leanPixelScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'pixel-refinement';
const pixelScreenshotEnabled = process.env.ADMIN_FORM_LAYOUT_SCREENSHOT !== '0';
const generatedSources = new Map(), compiledModuleCss = new Map();
const writeGeneratedFile = async (file, source) => leanPixelScope ? generatedSources.set(file, source) : writeFile(file, source);
const buttonRefinementScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'button-refinement';
const consistencyScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'consistency';
const settingsFamilyScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'settings-family';
const metaManagerScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'meta-manager';
let metaParserProof = null;
const settingsLayoutRefinement = settingsFamilyScope && ['general-security-password','general-security-final'].includes(process.env.ADMIN_FORM_LAYOUT_SETTINGS_REFINE);
assert(!process.env.ADMIN_FORM_LAYOUT_SETTINGS_REFINE || settingsLayoutRefinement,'The optional refinement filter belongs only to the affected General and Security layouts');
const settingsBefore = settingsFamilyScope && recoveryPhase === 'consistency-before';
let settingsProgress = null;
const settingsEvidenceRoot = path.join(root,'.tmp-qa/admin-development-batch-01/settings-family-adoption-20261025');
const metaEvidenceRoot = path.join(root,'.tmp-qa/admin-development-batch-01/meta-manager-adoption-20261025');
assert(!process.env.ADMIN_FORM_LAYOUT_FAMILY || (consistencyScope && process.env.ADMIN_FORM_LAYOUT_FAMILY==='taxonomy'),'The optional taxonomy family filter belongs to the existing consistency scope only');
const taxonomyConsistencyOnly = consistencyScope && process.env.ADMIN_FORM_LAYOUT_FAMILY==='taxonomy';
const fixtureScrollScope = taxonomyConsistencyOnly || settingsFamilyScope || metaManagerScope;
const finalVisualScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'final-visual';
const correctedLayout = recoveryPhase !== 'layout-before';
const boundedImages = !['before', 'after', 'owner-before'].includes(recoveryPhase);
const requestedOutput = process.env.ADMIN_FORM_LAYOUT_OUTPUT;
const out = requestedOutput ? path.resolve(root, requestedOutput) : path.join(root, leanPixelScope ? '.tmp-qa/content25-pixel-refinement' : recoveryPhase ? `.tmp-qa/admin-ui-recovery/${recoveryPhase}` : '.tmp-qa/admin-form-layout/browser');
assert(!requestedOutput || ((taxonomyConsistencyOnly || settingsFamilyScope || metaManagerScope) && out.startsWith(path.join(root, '.tmp-qa') + path.sep)), 'A bounded family output override must remain within the workspace .tmp-qa evidence tree');
assert(!metaManagerScope || requestedOutput,'MetaManager requires a fresh bounded evidence output');
if(settingsFamilyScope||metaManagerScope){try{await access(path.join(out,'receipt.json'));throw Error('Preserve the existing bounded attempt; choose a fresh output directory');}catch(error){if(error.code!=='ENOENT')throw error;}}
const settingsReadSources = new Map();
async function fixtureSource(file) {
    const relative=path.relative(root,file),snapshot=path.join(settingsEvidenceRoot,'before',relative);
    if(settingsBefore&&relative.replaceAll('\\','/').startsWith('src/')){try{const bytes=await readFile(snapshot);settingsReadSources.set(relative.replaceAll('\\','/'),createHash('sha256').update(bytes).digest('hex'));return bytes;}catch(error){if(error.code!=='ENOENT')throw error;}}
    return readFile(file);
}
const taxonomySourceFiles=['scripts/qa-admin-form-layout.mjs','scripts/fixtures/admin-form-layout-browser.jsx','scripts/verify-content-taxonomy-system.mts','src/app/admin/content/categories/CategoryForm.tsx','src/app/admin/content/series/SeriesForm.tsx','src/components/admin/content/CategoryColorPicker.tsx','src/app/admin/content/TaxonomyExpectedRevisionInput.tsx','src/components/admin/ui/AdminFormRuntime.tsx','src/components/admin/ui/AdminForm.tsx','src/components/admin/ui/AdminCard.tsx','src/components/admin/ui/AdminModuleTabs.tsx','src/components/admin/ui/AdminFormListboxSelect.tsx','src/components/admin/ui/AdminListboxSelect.tsx','src/components/admin/ui/AdminFormSwitch.tsx','src/lib/admin/admin-ui-styles.ts','src/app/globals.css','src/lib/admin/content/taxonomy-form-validation.ts','src/lib/admin/content/admin-tone-palette.ts','src/lib/admin/slug.ts','src/app/admin/content/taxonomy-form-actions.ts','src/lib/admin/content/taxonomy-mutations.ts'];
taxonomySourceFiles.push('src/components/admin/ui/AdminSlugField.tsx','src/lib/admin/form-system/adoption-manifest.ts','src/lib/admin/interaction-system/adoption-manifest.ts','src/components/admin/content/editors/ContentBasicDataPanel.tsx','src/components/admin/content/editors/ContentEditorShell.tsx','src/components/admin/content/editors/article/TopicCharacterField.tsx','src/components/admin/content/editors/article/TopicSlugInput.tsx','scripts/verify-admin-form-system.mts','scripts/verify-shared-specialized-editors-presentation.mts');
const fingerprintTaxonomySources=async()=>Object.fromEntries(await Promise.all(taxonomySourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));
const taxonomySourceHashes=consistencyScope?await fingerprintTaxonomySources():null;
const taxonomyPresentationReference = new Map();
await mkdir(out, { recursive: true });
if (!leanPixelScope) await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'RUNNING', phase: recoveryPhase ?? 'regression' }));
await writeGeneratedFile(path.join(out, 'loader.cjs'), `module.exports=s=>require('typescript').transpileModule(s,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;`);
await writeGeneratedFile(path.join(out, 'navigation.js'), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';const record=(method,href)=>(window.fixtureNavigation??=[]).push({method,href});export const useRouter=()=>({push(href){record('push',href)},replace(href){record('replace',href)},refresh(){},prefetch(){}});export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>'/admin/fixture';`);
await writeGeneratedFile(path.join(out, 'actions.js'), `const row={id:'pages:42',resourceId:42,resourceType:'pages',title:'من نحن',slug:'about',publicPath:'/about'};export const browseAdminLinksAjax=async()=>({ok:true,results:[row]});export const browseTopicCategoriesPickerAjax=async()=>({ok:true,items:[]});export const browseMenusPickerAjax=async()=>({ok:true,menus:[]});export const browseMenuItemsPickerAjax=async()=>({ok:true,items:[]});export const resolveAdminLinkAjax=async v=>({ok:true,display:{kind:v.link_kind,kindLabel:v.link_kind==='external'?'خارجي':'صفحة',title:v.link_kind==='external'?v.href:'من نحن',publicPath:(v.href||'/about')+(v.anchor?'#'+v.anchor:''),target:v.target||'_self'}});export const updateHeroTemplateDetails=async()=>{throw Error('No persistence transport permitted')};`);
await writeGeneratedFile(path.join(out, 'picker.js'), `import React from 'react';export default function Picker({open,onSelect,onClose}){return open?<button type="button" onClick={()=>{onSelect('/wide.png');onClose()}}>Select fixture media</button>:null;}`);
await writeGeneratedFile(path.join(out, 'settings-actions.js'), `
async function call(kind,args){const qa=window.settingsTransport??={behavior:'error',hold:false,calls:[]};const data=args.find(value=>value instanceof FormData),previous=args[0];qa.calls.push({kind,names:data?[...data.keys()]:[],argumentCount:args.length});if(qa.hold)await new Promise(resolve=>{qa.release=resolve;});if(qa.behavior==='throw'||(qa.behavior==='error'&&!data))throw Error('رفض محلي معزول');if(data){const field=qa.behavior==='logo-error'?'logoUrl':qa.behavior==='compact-logo-error'?'compactLogoUrl':kind==='company'?'name':'maxImageMb';const failed=['error','logo-error','compact-logo-error'].includes(qa.behavior);return {status:failed?'error':qa.behavior==='warning'?'warning':'success',mode:'edit',revision:(previous.revision??0)+1,savedRevision:'local:1',title:'نتيجة محلية معزولة',message:'تم اختبار النقل المحلي فقط.',...(failed?{fieldErrors:{[field]:['خطأ تحقق محلي']},focusTarget:field}:{})};}if(kind==='account')return {success:true,fullName:args[0].full_name,email:args[0].email};return {ok:true,feedbackStatus:qa.behavior==='warning'?'warning':'success',title:'نتيجة محلية معزولة',message:'تم اختبار النقل المحلي فقط.'};}
export const updateAdminCompanyAction=(...args)=>call('company',args),updateMaintenanceModeAction=(...args)=>call('maintenance',args),updateMediaSettingsAction=(...args)=>call('media',args),changeAdminPasswordAction=(...args)=>call('password',args),updateAdminSelfAccountAction=(...args)=>call('account',args),revokeAllAdminSessionsAction=(...args)=>call('sessions',args);
`);
if(metaManagerScope){
const metaActionSource=await readFile(path.join(root,'src/app/admin/seo/meta-manager/actions.ts'),'utf8'),metaTs=require('typescript'),metaActionTree=metaTs.createSourceFile('meta-actions.ts',metaActionSource,metaTs.ScriptTarget.Latest,true,metaTs.ScriptKind.TS),metaFunctions=new Map(metaActionTree.statements.filter(metaTs.isFunctionDeclaration).filter(node=>node.name).map(node=>[node.name.text,node]));
const metaParserDependencies=new Set();function includeMetaParser(name){if(metaParserDependencies.has(name))return;const node=metaFunctions.get(name);assert(node,'The actual MetaManager native parser must remain available');metaParserDependencies.add(name);const visit=entry=>{if(metaTs.isCallExpression(entry)&&metaTs.isIdentifier(entry.expression)&&metaFunctions.has(entry.expression.text))includeMetaParser(entry.expression.text);metaTs.forEachChild(entry,visit);};visit(node);}
includeMetaParser('buildSettingsFromForm');
metaParserProof={sourceFile:'src/app/admin/seo/meta-manager/actions.ts',sha256:createHash('sha256').update(metaActionSource).digest('hex'),declarations:[...metaParserDependencies],boundary:'Actual native parser dependency closure only; save/Auth/cache/SQL/provider owners are never evaluated.'};
await writeGeneratedFile(path.join(out,'meta-actions.js'),[...metaParserDependencies].map(name=>metaFunctions.get(name).getText(metaActionTree)).join('\n')+`
export async function saveGlobalSeoSettingsAction(previous,data){const qa=window.metaTransport??={field:'siteName',hold:false,calls:[]};const payload=buildSettingsFromForm(data);qa.calls.push({entries:[...data.entries()],payload,inherit:{index:payload.defaultRobotsIndex===undefined,follow:payload.defaultRobotsFollow===undefined}});if(qa.hold)await new Promise(resolve=>{qa.release=resolve;});const field=qa.field??'siteName';return{status:'error',mode:'edit',revision:(previous.revision??0)+1,title:'رفض محلي معزول',message:'لم يُرسل الحفظ إلى الخادم.',fieldErrors:{[field]:['خطأ تحقق محلي']},focusTarget:field};}
`);
}else await writeGeneratedFile(path.join(out,'meta-actions.js'),`export async function saveGlobalSeoSettingsAction(){throw Error('MetaManager local transport is unavailable outside its explicit fixture scope');}`);
await writeGeneratedFile(path.join(out, 'taxonomy-actions.js'), `
import {categoryTaxonomyFormInput,categoryTaxonomyFormSchema,seriesTaxonomyFormInput,seriesTaxonomyFormSchema,flattenTaxonomyValidationErrors} from ${JSON.stringify(path.join(root,'src/lib/admin/content/taxonomy-form-validation.ts').replaceAll('\\','/'))};
import {getDeterministicAdminTone} from ${JSON.stringify(path.join(root,'src/lib/admin/content/admin-tone-palette.ts').replaceAll('\\','/'))};
export const createSeriesForm=(previous,data)=>run('series','create',previous,data),updateSeriesForm=(previous,data)=>run('series','edit',previous,data),createCategoryForm=(previous,data)=>run('category','create',previous,data),updateCategoryForm=(previous,data)=>run('category','edit',previous,data);
async function run(kind,mode,previous,data){
    const qa=window.taxonomyTransport??={behavior:'error',hold:false,calls:[]};
    const fields=Object.fromEntries(data);window.consistencyTaxonomy=fields;
    const call={kind,mode,fields};qa.calls.push(call);
    const input=(kind==='series'?seriesTaxonomyFormInput:categoryTaxonomyFormInput)(data);
    const saved=JSON.parse(localStorage.getItem('taxonomy-'+kind)||'null');
    if(mode==='edit')input.slug=saved?.slug||(kind==='series'?'first':'market');
    const parsed=(kind==='series'?seriesTaxonomyFormSchema:categoryTaxonomyFormSchema).safeParse(input);
    const failure=(message,fieldErrors,code)=>({...previous,status:'error',revision:previous.revision+1,title:'رفض محلي معزول',message,fieldErrors,code,focusTarget:fieldErrors?Object.keys(fieldErrors)[0]:undefined});
    if(!parsed.success){call.outcome='validation';return failure('راجع الحقول الموضحة ثم حاول مرة أخرى.',flattenTaxonomyValidationErrors(parsed.error));}
    if(qa.hold)await new Promise(resolve=>{qa.release=resolve;});
    if(qa.behavior==='throw'){call.outcome='transport-failure';throw Error('Isolated local transport failure');}
    if(qa.behavior==='conflict'){call.outcome='revision-conflict';return failure('تم تعديل السجل من جلسة أخرى. راجع تغييراتك ثم أعد تحميل الصفحة قبل المحاولة مجددًا.',undefined,'revision_conflict');}
    if(qa.behavior==='relation-error'){const relation=kind==='series'?'category_id':'parent_id';call.outcome='relation-error';return failure('راجع العلاقة المحددة.',{[relation]:['علاقة غير متاحة محليًا.']});}
    if(qa.behavior==='color-error'){call.outcome='color-error';return failure('راجع اللون المحدد.',{color_token:['لون غير متاح محليًا.']});}
    if(qa.behavior!=='success'){call.outcome='rejected';return failure('لم يتم إرسال أي بيانات إلى الخادم',{name:['فشل حفظ تجريبي']});}
    const entityId=kind==='series'?187:17,savedRevision='2026-10-25T00:00:'+String(qa.calls.length).padStart(2,'0')+'.123456+00:00';
    const record={id:entityId,...parsed.data,...(kind==='category'?{color_token:parsed.data.color_token??getDeterministicAdminTone(input.slug)}:{}),status:parsed.data.is_published?'published':'unpublished',updated_at:savedRevision};
    localStorage.setItem('taxonomy-'+kind,JSON.stringify(record));call.outcome='success';call.savedRevision=savedRevision;
    return {status:'success',mode,revision:previous.revision+1,title:'حفظ محلي معزول',message:'تم تأكيد النقل المحلي فقط.',code:mode==='create'?'created':'updated',entityId,savedRevision,editHref:'/admin/content/'+(kind==='series'?'series':'categories')+'/'+entityId};
}
`);
const appCss = (await fixtureSource(path.join(root, 'src/app/globals.css'))).toString('utf8');
const fontCss = [300, 400, 500, 600, 700].map(weight => `@font-face{font-family:FixtureArabic;src:url("/font-${weight}.woff2");font-weight:${weight};font-display:swap}`).join('') + ':root{--font-arabic:FixtureArabic;--font-inter:Arial}';
const css = (await require('postcss')([require('@tailwindcss/postcss')({ base: root })]).process(appCss + '\n' + fontCss + '\n@source "' + root.replaceAll('\\', '/') + '/src";\n@source "' + root.replaceAll('\\', '/') + '/scripts/fixtures/admin-form-layout-browser.jsx";', { from: path.join(root, 'src/app/globals.css') })).css;
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const shim = name => {
    const file=path.join(out,name);if(!leanPixelScope)return file;
    let source=generatedSources.get(file);
    if(name==='navigation.js')source=source.replace("'next/dist/client/components/unstable-rethrow.browser'",JSON.stringify(require.resolve('next/dist/client/components/unstable-rethrow.browser').replaceAll('\\','/')));
    source=require('typescript').transpileModule(source,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;
    for(const name of ['react','react/jsx-runtime']) source=source.replaceAll(JSON.stringify(name),JSON.stringify(require.resolve(name).replaceAll('\\','/'))).replaceAll("'"+name+"'",JSON.stringify(require.resolve(name).replaceAll('\\','/')));
    return 'data:text/javascript;base64,'+Buffer.from(source,'utf8').toString('base64');
};
const fixtureResources = { apply(compiler) {
    compiler.hooks.compilation.tap('AdminFormFixtureResources', compilation => {
        webpack.NormalModule.getCompilationHooks(compilation).readResource.for(undefined).tapPromise('AdminFormFixtureResources', async context => {
            const file=context.resourcePath;
            if(file.endsWith('.module.css')){
                const scope=require('next/dist/compiled/postcss-modules-scope');
                const {getCssModuleLocalIdent}=require('next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent');
                const result=await require('postcss')([
                    require('next/dist/compiled/postcss-modules-values'),
                    require('next/dist/compiled/postcss-modules-local-by-default')({mode:'local'}),
                    require('next/dist/compiled/postcss-modules-extract-imports')(),
                    scope({generateScopedName:name=>getCssModuleLocalIdent({rootContext:root,resourcePath:file},null,name,{context:root})})
                ]).process((await fixtureSource(file)).toString('utf8'),{from:file});
                const locals={};result.root.walkRules(':export',rule=>{rule.walkDecls(decl=>{locals[decl.prop]=decl.value;});rule.remove();});
                compiledModuleCss.set(file,result.root.toString());
                return 'export default '+JSON.stringify(locals)+';';
            }
            if(settingsBefore&&/\.[jt]sx?$/.test(file)&&!file.includes('node_modules'))return (await fixtureSource(file)).toString('utf8');
            if(leanPixelScope&&/\.[jt]sx?$/.test(file)&&!file.includes('node_modules'))return require('typescript').transpileModule(await readFile(file,'utf8'),{compilerOptions:{jsx:4,target:9,module:99}}).outputText;
        });
    });
} };
const compiler = webpack({
    mode:'development',target:'web',entry:path.join(root,'scripts/fixtures/admin-form-layout-browser.jsx'),output:{path:out,filename:'bundle.js'},
    resolve:{extensions:['.tsx','.ts','.jsx','.js'],alias:{'server-only':false,...(leanPixelScope?{}:{'next/navigation$':shim('navigation.js')})}},
    plugins:[fixtureResources,...(leanPixelScope?[new webpack.NormalModuleReplacementPlugin(/^next\/navigation$/,shim('navigation.js'))]:[]),new webpack.NormalModuleReplacementPlugin(/^\.\/actions$/,resource=>{if(/[\\/]settings[\\/](general|security|media)$/.test(resource.context))resource.request=shim('settings-actions.js');else if(/[\\/]seo[\\/]meta-manager$/.test(resource.context))resource.request=shim('meta-actions.js');}),new webpack.NormalModuleReplacementPlugin(/taxonomy-form-actions$/,shim('taxonomy-actions.js')),new webpack.ProvidePlugin({process:require.resolve('next/dist/build/polyfills/process')}),new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$|^\.\.\/actions$/,shim('actions.js')),new webpack.NormalModuleReplacementPlugin(/AdminMediaPickerModal$/,shim('picker.js'))],
    module:{rules:[{test:/\.module\.css$/,type:'javascript/auto'},...(leanPixelScope?[]:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(out,'loader.cjs')}])]},devtool:false
});
let inMemoryBundle;
if(leanPixelScope)compiler.hooks.shouldEmit.tap('AdminFormFixtureMemory',()=>false);
await new Promise((resolve,reject)=>compiler.run((error,stats)=>{
    if(leanPixelScope&&stats&&!stats.hasErrors())inMemoryBundle=Buffer.from(stats.compilation.assets['bundle.js'].source());
    compiler.close(closeError=>error||closeError||stats.hasErrors()?reject(error||closeError||Error(stats.toString({all:false,errors:true}))):resolve());
}));
const binary = await require('sharp')({ create: { width: 400, height: 600, channels: 3, background: '#8d7044' } }).png().toBuffer();
async function inspectLinkIcons(fields) {
    const evidence = await fields.evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => ({
        family: element.closest('[data-family]')?.dataset.family ?? 'portal',
        presentation: element.dataset.adminLinkField,
        actionPresentation: element.querySelector('[data-admin-link-controls] > [data-admin-link-actions]') ? 'bare' : 'default',
        storyComposition: !!element.closest('[data-home-story-button-panel]'), viewportWidth: innerWidth,
        actions: [...element.querySelectorAll(':is([data-admin-link-controls] > button, [data-admin-link-controls] > [data-admin-link-actions] > button)')].map(button => {
            const svg = button.querySelector('svg'), text = button.querySelector('.sr-only'), path = svg.querySelector('path');
            const rect = element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height }; };
            const styles = element => { const s = getComputedStyle(element); return { display: s.display, visibility: s.visibility, opacity: s.opacity, stroke: s.stroke, color: s.color, position: s.position, clip: s.clip, clipPath: s.clipPath, overflow: s.overflow }; };
            return { label: text.textContent, disabled: button.matches(':disabled'), button: rect(button), icon: rect(svg), svg: styles(svg), path: styles(path), hiddenText: { ...rect(text), ...styles(text) }, dom: button.outerHTML };
        })
    })));
    assert(evidence.length > 0);
    for (const field of evidence) for (const action of field.actions) {
        assert(action.label.trim());
        // AdminLinkField defaults use 20px glyphs; bare uses the shared ActionIcon lg=22px protocol.
        const buttonSize=44,iconSize=field.actionPresentation === 'bare' ? 22 : 20;
        assert.equal(action.button.width,buttonSize);assert.equal(action.button.height,buttonSize);
        assert.equal(action.icon.width,iconSize);assert.equal(action.icon.height,iconSize);
        assert.notEqual(action.svg.display, 'none'); assert.equal(action.svg.visibility, 'visible'); assert.equal(action.svg.opacity, '1');
        assert.notEqual(action.path.stroke, 'none'); assert.notEqual(action.path.stroke, 'rgba(0, 0, 0, 0)');
        assert.equal(action.hiddenText.width, 1); assert.equal(action.hiddenText.height, 1);
        assert.equal(action.hiddenText.position, 'absolute'); assert.equal(action.hiddenText.clipPath, 'inset(50%)'); assert.equal(action.hiddenText.overflow, 'hidden');
    }
    return evidence;
}
async function measureFinalVisual(page, width) {
    const measured = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const pair = label => {
            const title = label.querySelector(':scope > span'), control = label.querySelector('input:not([type="hidden"]), textarea');
            const styles = getComputedStyle(title);
            return { name: control.name, label: rect(title), control: rect(control), gap: rect(control).y - rect(title).y - rect(title).height, typography: { size: styles.fontSize, weight: styles.fontWeight, color: styles.color, family: styles.fontFamily, lineHeight: styles.lineHeight } };
        };
        const media = document.querySelector('[data-family="image-position"] [data-admin-media-image-field]');
        const position = document.querySelector('[data-family="image-position"] [role="radiogroup"]').parentElement;
        const featured = document.querySelector('[data-family="featured-projects"] [name="selection_mode"]').closest('[data-admin-form-grid]');
        const fields = [...featured.children].map(field => {
            const label = field.querySelector(':scope > span'), control = field.querySelector('[role="combobox"], input:not([type="hidden"])'), hint = field.querySelector('p');
            const styles = getComputedStyle(label);
            return { label: rect(label), control: rect(control), gap: rect(control).y - rect(label).y - rect(label).height, hint: hint ? rect(hint) : null, typography: { size: styles.fontSize, weight: styles.fontWeight, color: styles.color, family: styles.fontFamily, lineHeight: styles.lineHeight } };
        });
        const labels = [...document.querySelectorAll('[data-family="gallery-fields"] label, [data-family="gallery-failure"] label, [data-family="image-position"] label, [data-family="intro-textareas"] label')].filter(label => label.querySelector(':scope > span') && label.querySelector('input:not([type="hidden"]), textarea')).map(pair).filter(field => field.name);
        return { media: rect(media), position: rect(position), positionBox: { border: getComputedStyle(position).borderTopWidth, background: getComputedStyle(position).backgroundColor }, featured: fields, labels };
    });
    if (correctedLayout) {
        assert.equal(measured.positionBox.border, '1px');
        if (width >= 768) {
            assert(Math.abs(measured.media.width - measured.position.width) < 1);
            assert(Math.abs(measured.media.height - measured.position.height) < 1);
            assert(Math.abs(measured.media.y - measured.position.y) < 1);
            assert(measured.media.x > measured.position.x, 'RTL image stays in first column');
            const fields = measured.featured;
            assert(fields.every(f => Math.abs(f.label.y - fields[0].label.y) < 1 && Math.abs(f.label.height - fields[0].label.height) < 1));
            assert(fields.every(f => Math.abs(f.control.y - fields[0].control.y) < 1 && f.control.height === 44));
        } else {
            assert(measured.position.y >= measured.media.y + measured.media.height + 8);
            assert(measured.featured.every((field, i, fields) => !i || field.label.y >= fields[i - 1].control.y + fields[i - 1].control.height + 8));
        }
        assert(measured.featured.every(f => f.gap >= 7 && f.gap <= 12));
        assert(measured.featured.every(f => !f.hint || f.hint.y >= f.control.y + f.control.height + 7));
        assert(measured.labels.every(p => p.gap >= 7 && p.gap <= 12), JSON.stringify({ width, labels: measured.labels }));
    }
    finalVisualGeometry.push({ width, ...measured });
}

async function exerciseConsistencyButton(page) {
    const button=page.locator('[data-family="consistency-button"]');
    const picker=button.locator('[data-admin-link-controls] > button').first();
    await picker.press('Enter');
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    await dialog.getByRole('button',{name:'إغلاق',exact:true}).focus();await page.keyboard.press('Shift+Tab');
    await expect.poll(()=>dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'إغلاق',exact:true})).toBeFocused();
    await dialog.getByRole('button',{name:'إغلاق',exact:true}).press('Enter');await expect(picker).toBeFocused();
    await button.locator('[name="button_label"]').fill('زر محفوظ');
    await button.locator('[data-admin-link-field] label input').fill('overview');
    await button.getByRole('combobox').press('Enter');await page.getByRole('option',{name:'نافذة جديدة',exact:true}).click();
    await button.getByRole('radio',{name:'وسط',exact:true}).press('Enter');
    await expect(button.getByRole('radio',{name:'وسط',exact:true})).toBeFocused();
    await button.getByRole('radio',{name:'بدون أيقونة',exact:true}).press('Enter');
    await expect(button.getByRole('radiogroup',{name:'موضع الأيقونة',exact:true})).toHaveCount(0);
    await expect(button.locator('[name="button_icon_position"]')).toHaveValue('left');
    assert.equal(await button.locator('[name="button_icon_position"]').evaluate(e=>e.getBoundingClientRect().height),0,'Hidden icon position must not create a grid item');
    const compositionCards=button.locator('[data-home-story-button-card]');
    assert.equal(await compositionCards.count() || await button.locator('[data-module-editor-field-span="8"] [data-admin-form-grid] > div').count(),3,'Icon none leaves exactly three visible control cards');
    await button.getByRole('radio',{name:'سهم',exact:true}).press('Enter');
    await button.getByRole('radio',{name:'يمين النص',exact:true}).press('Enter');
    await button.getByRole('button',{name:'Save Button local',exact:true}).click();
    await button.getByRole('button',{name:'Reload Button local',exact:true}).click();
    for(const [name,value] of Object.entries({button_label:'زر محفوظ',button_open_target:'_blank',button_alignment:'center',button_icon:'arrow',button_icon_position:'right'}))await expect(button.locator('[name="'+name+'"]')).toHaveValue(value);
    await expect(button.locator('[data-admin-link-field] label input')).toHaveValue('overview');
    await button.locator('[data-admin-link-controls] > button').nth(1).press('Enter');
    await expect(button.locator('[data-admin-link-controls] > button')).toHaveCount(1);
    await button.locator('[data-admin-link-controls] > button').first().press('Enter');
    await dialog.getByRole('button',{name:/من نحن/}).click();
    await dialog.getByRole('button',{name:'اعتماد الرابط',exact:true}).click();
    await expect(button.locator('[data-admin-link-controls] > button')).toHaveCount(2);
    await expect(button.locator('[data-admin-link-controls] > button').first()).toBeFocused();
    await expect(button.locator('[data-admin-link-destination]').getByText('من نحن',{exact:true})).toBeVisible();
}

async function exerciseConsistency(page) {
    await page.setViewportSize({width:1440,height:1100});
    const featured=page.locator('[data-family="consistency-featured"]');
    const eyebrow=featured.locator('[name="eyebrow"]');
    const card=eyebrow.locator('xpath=ancestor::*[@data-module-editor-control-row][1]');
    await eyebrow.fill('نص تمهيدي محفوظ');
    const oldBold=await featured.locator('[name="eyebrow_bold"]').inputValue();
    await card.getByRole('button',{name:'تنسيق عريض',exact:true}).press('Enter');
    await expect(featured.locator('[name="eyebrow_bold"]')).toHaveValue(oldBold==='true'?'false':'true');
    await card.getByRole('button',{name:'محاذاة للوسط',exact:true}).press('Enter');
    await expect(featured.locator('[name="eyebrow_alignment"]')).toHaveValue('center');
    await card.getByRole('switch').press('Space');
    await expect(featured.locator('[name="show_eyebrow"]')).toHaveValue('false');
    await featured.locator('button[type="submit"]').click();
    await expect.poll(()=>page.evaluate(()=>localStorage.getItem('consistency-featured'))).not.toBeNull();
    await featured.getByRole('button',{name:'Reload Featured local',exact:true}).click();
    await featured.getByRole('tab').nth(1).click();
    await expect(featured.locator('[name="eyebrow"]')).toHaveValue('نص تمهيدي محفوظ');
    await expect(featured.locator('[name="eyebrow_alignment"]')).toHaveValue('center');
    await expect(featured.locator('[name="show_eyebrow"]')).toHaveValue('false');
    await exerciseConsistencyButton(page);
    const edit=page.locator('[data-family="consistency-topic-edit"]');
    await expect(edit.getByRole('combobox',{name:'نوع المحتوى',exact:true})).toBeDisabled();
    await edit.locator('[name="title"]').fill('عنوان محفوظ بعد رفض الحفظ');
    await edit.getByRole('combobox',{name:'اختر التصنيف',exact:true}).press('Enter');
    await page.getByRole('option',{name:'نصائح عقارية',exact:true}).click();
    await expect(edit.locator('select[name="series_id"]')).toHaveValue('');
    await edit.getByRole('combobox',{name:'اختر السلسلة',exact:true}).press('Enter');
    await expect(page.getByRole('option',{name:'السلسلة الأولى',exact:true})).toHaveCount(0);
    await page.getByRole('option',{name:'سلسلة النصائح',exact:true}).click();
    await edit.getByRole('button',{name:'Reject Topic local',exact:true}).click();
    await expect(edit.getByText('فشل حفظ تجريبي',{exact:true})).toBeVisible();
    await expect(edit.locator('[name="title"]')).toHaveValue('عنوان محفوظ بعد رفض الحفظ');
    await expect(edit.locator('select[name="category_id"]')).toHaveValue('18');await expect(edit.locator('select[name="series_id"]')).toHaveValue('188');
    const create=page.locator('[data-family="consistency-topic-create"]');
    await expect(create.getByRole('combobox',{name:'نوع المحتوى',exact:true})).toBeEnabled();
    await expect(create.getByRole('combobox',{name:'اختر التصنيف أولًا',exact:true})).toBeDisabled();
    await create.locator('[name="title"]').fill('New Article');await expect(create.locator('[name="slug"]')).toHaveValue('new-article');
    for(const kind of ['series','category']){
        const form=page.locator('[data-family="consistency-'+kind+'"]');const toggle=form.getByRole('switch',{name:'منشور',exact:true});
        const before=await form.locator('[data-admin-form-switch-surface]').boundingBox();
        await toggle.press('Space');await expect(toggle).not.toBeChecked();
        await form.locator('[name="name"]').fill('اسم محفوظ بعد رفض محلي');
        await form.getByRole('button',{name:'حفظ',exact:true}).click();
        await expect(form.getByText('فشل حفظ تجريبي',{exact:true})).toBeVisible();
        await expect(form.locator('[name="name"]')).toHaveValue('اسم محفوظ بعد رفض محلي');await expect(toggle).not.toBeChecked();
        const after=await form.locator('[data-admin-form-switch-surface]').boundingBox();assert.equal(after.height,before.height,'Error must not stretch natural publication switch');
        await form.screenshot({path:path.join(out,'consistency-'+kind+'-error-1440.png')});
    }
    return {featured:'Keyboard Bold/Alignment/Visibility; canonical buildFeaturedModuleConfig serialization and remount',button:'Keyboard picker trap/focus return, target/alignment/icon visibility/position, link anchor, FormData/remount, clear-link state',topics:'Edit content type lock, category/series dependent filtering and stale-series reset; rejected save retains fields; create disabled series and automatic slug',taxonomy:'Keyboard publication switch and rejected-save field preservation; error geometry retains natural toggle height',boundary:'Isolated in-memory/localStorage save transports only; no native Server Actions, database, publishing or production mutations'};
}

async function captureTaxonomyCreate(page) {
    await page.goto('http://127.0.0.1:48199/?scope=consistency&taxonomy=create'+(taxonomyConsistencyOnly?'&family=taxonomy':''));
    await page.locator('[data-family="consistency-series"] [name="slug"]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const rows=[];
    for(const width of [1440,1024,768,390,375]){
        await page.setViewportSize({width,height:1100});
        for(const kind of ['series','category']){
            const form=page.locator('[data-family="consistency-'+kind+'"]');
            const row=await form.evaluate(f=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};const grid=f.querySelector('[data-admin-form-grid]');return {overflow:f.scrollWidth>f.clientWidth+1,grid:rect(grid),children:[...grid.children].map(e=>({box:rect(e),label:rect(e.children[0]),control:rect(e.querySelector('input:not([type="hidden"]),[role="combobox"],[data-admin-form-switch-surface]'))})),toggle:rect(f.querySelector('[data-admin-form-switch-surface]'))};});
            assert.equal(row.overflow,false,JSON.stringify({kind,width,row}));assert(row.toggle.h<60);
            if(width>=1280)assert(row.children.slice(0,3).every(f=>Math.abs(f.control.y-row.children[0].control.y)<2),JSON.stringify({kind,width,row}));
            rows.push({kind,width,...row,panel:await inspectTaxonomyPanel(form.locator('form'),kind,'create',width)});
            if([1440,390].includes(width))await form.screenshot({path:path.join(out,'consistency-'+kind+'-create-'+width+'.png')});
        }
    }
    const form=page.locator('[data-family="consistency-series"]');
    await form.locator('[name="name"]').fill('New Series');await expect(form.locator('[name="slug"]')).toHaveValue('new-series');
    await expect(form.getByRole('switch',{name:'منشور',exact:true})).not.toBeChecked();
    return rows;
}

async function taxonomyRolePaint(form, headingId) {
    return form.evaluate((root, id) => {
        const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
        const text=e=>{const s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,opacity:s.opacity,inset:s.paddingInlineStart};};
        const identity=e=>{const frame=e.children[0],divider=e.children[1],body=e.children[2],title=body.firstElementChild,glyph=frame.querySelector('svg');return {frame:[box(frame).w,box(frame).h],glyph:[box(glyph).w,box(glyph).h],paths:[...glyph.querySelectorAll('path')].map(p=>p.getAttribute('d')),divider:[box(divider).w,box(divider).h],gap:getComputedStyle(e).gap,title:text(title),descriptionCount:body.children.length-1};};
        const header=root.querySelector('[data-admin-tab-section-heading="'+id+'"]'),card=header.parentElement,save=root.querySelector('[data-admin-form-action="save"]'),actions=save.closest('.sticky');
        const surface=e=>{const s=getComputedStyle(e);return {background:s.background,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,padding:s.padding,position:s.position};};
        const marked=[...root.querySelectorAll('[data-admin-form-label-text]')].map(e=>({text:e.textContent.trim(),paint:text(e),required:[...e.querySelectorAll('.text-red-400')].map(text),gap:getComputedStyle(e.parentElement).rowGap}));
        const hints=[...root.querySelectorAll('#admin-slug-hint,[data-admin-form-listbox] p:not([role])')].map(e=>({text:e.textContent.trim(),context:e.id==='admin-slug-hint'?'label':'standalone',paint:text(e)}));
        const color=root.querySelector('[data-admin-tab-section-heading="category-color"]'),fieldset=root.querySelector('fieldset:has(> input[name="color_token"])'),legend=fieldset?.querySelector('legend');
        return {header:{identity:identity(header.querySelector('[data-admin-form-control-header]')),surface:surface(header),card:surface(card)},actions:{identity:identity(actions.querySelector('[data-admin-form-control-header]')),surface:surface(actions),outside:!card.contains(actions),after:!!(card.compareDocumentPosition(actions)&Node.DOCUMENT_POSITION_FOLLOWING),buttons:[...actions.querySelectorAll('[data-admin-form-action]')].map(e=>({action:e.dataset.adminFormAction,type:e.type,box:box(e)}))},labels:marked,hints,color:color?{independent:color.parentElement!==card,after:!!(card.compareDocumentPosition(color.parentElement)&Node.DOCUMENT_POSITION_FOLLOWING),surface:surface(color.parentElement),header:surface(color),identity:identity(color.querySelector('[data-admin-form-control-header]')),containsPicker:color.parentElement.contains(fieldset),legend:{...box(legend),position:getComputedStyle(legend).position,clipPath:getComputedStyle(legend).clipPath},buttons:fieldset.querySelectorAll('button').length}:null};
    },headingId);
}

async function scrollTaxonomyFixture(page, target) {
    await page.evaluate(value=>{
        const host=document.querySelector('#root[data-taxonomy-scroll-host]');
        const top=value==='end'?(host??document.documentElement).scrollHeight:value;
        if(host)host.scrollTo(0,top);else scrollTo(0,top);
    },target);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function measureTaxonomySpacing(form, actionSelector = '[data-admin-form-action="save"]') {
    return form.evaluate((root, actionSelector) => {
        const box = element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
        const actions = root.querySelector(actionSelector).closest('.sticky');
        const sections = [...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header => header.parentElement);
        const stack = actions.parentElement, previous = actions.previousElementSibling, actionBox = box(actions);
        const visible = [...actions.querySelectorAll(actionSelector === '[data-admin-form-action="save"]' ? '[data-admin-form-action]' : actionSelector)].map(button => {
            const r = box(button), x = r.x + r.w / 2, y = r.y + r.h / 2;
            return {action:button.dataset.adminFormAction??'command',box:r,visible:r.y>=0&&r.y+r.h<=innerHeight,hit:document.elementFromPoint(x,y)?.closest('button')===button};
        });
        const host=document.querySelector('#root[data-taxonomy-scroll-host]');
        const ancestry=[];for(let e=actions;e;e=e.parentElement){const s=getComputedStyle(e);ancestry.push({tag:e.tagName,host:e===host,display:s.display,overflowX:s.overflowX,overflowY:s.overflowY,transform:s.transform,contain:s.contain,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop});}
        return {documentMode:document.compatMode,scrollingElement:document.scrollingElement.tagName,scrollContext:host?'controlled native #root scrollport; taxonomy fixture only':'document',ancestry,viewport:{width:innerWidth,height:innerHeight},scrollY:host?host.scrollTop:scrollY,form:box(root),sections:sections.map(box),actions:actionBox,
            sectionGaps:sections.slice(1).map((section,index)=>box(section).y-box(sections[index]).y-box(sections[index]).h),
            preActionsGap:actionBox.y-box(previous).y-box(previous).h,previousMarginEnd:getComputedStyle(previous).marginBlockEnd,
            stack:{tag:stack.tagName,className:stack.className,insidePendingFields:!!stack.closest('[data-admin-form-fields]'),isPendingFieldset:stack.matches('[data-admin-form-fields]'),runtimeToken:root.classList.contains('space-y-5'),sectionsDirect:sections.every(section=>section.parentElement===stack)},
            sticky:{position:getComputedStyle(actions).position,bottom:getComputedStyle(actions).bottom,viewportBottomGap:innerHeight-actionBox.y-actionBox.h},
            native:[...root.querySelectorAll('[name]')].map(e=>({name:e.name,value:e.value,checked:'checked' in e?e.checked:undefined,disabled:e.disabled})),visible};
    }, actionSelector);
}

function assertTaxonomySpacing(row, expected, kind) {
    assert.equal(row.stack.tag,'DIV','The canonical form stack owns a real inner layout box');
    assert.equal(row.stack.insidePendingFields,true);assert.equal(row.stack.isPendingFieldset,false);assert.equal(row.stack.runtimeToken,false);
    assert(row.stack.className.split(/\s+/).includes('space-y-5'),'The existing canonical stack token belongs inside the pending fieldset');
    assert.equal(row.stack.sectionsDirect,true,'Sections and Actions share the same actual stack container');
    assert.equal(row.sectionGaps.length,kind==='category'?1:0);
    for(const gap of [...row.sectionGaps,row.preActionsGap])assert(Math.abs(gap-expected)<0.5,`Expected the actual Topic ${expected}px section/actions rhythm; measured ${gap}px`);
}

async function captureTaxonomySpacing(page, before = false) {
    const cases=[];
    for(const width of [1440,390])for(const mode of ['edit','create'])for(const kind of ['series','category']){
        await page.setViewportSize({width,height:1600});
        await page.goto('http://127.0.0.1:48199/?scope=consistency&family=taxonomy&entity='+kind+(mode==='create'?'&taxonomy=create':''));
        const form=page.locator('[data-family="consistency-'+kind+'"] form');await form.locator('[name="name"]').waitFor();await page.evaluate(()=>document.fonts.ready);
        await scrollTaxonomyFixture(page,0);
        const normal=await measureTaxonomySpacing(form),reference=taxonomyPresentationReference.get(width>=768?'desktop':'mobile'),expected=reference.spacing.preActionsGap;
        const prefix='taxonomy-spacing-'+kind+'-'+mode+'-'+width;
        await form.screenshot({path:path.join(out,prefix+'-normal.png')});
        if(before){assert([...normal.sectionGaps,normal.preActionsGap].every(gap=>Math.abs(gap)<0.5),'The BEFORE receipt must reproduce the proven zero-gap defect');}
        else assertTaxonomySpacing(normal,expected,kind);
        let negatives;
        if(!before){
            negatives=[];
            for(const mutant of ['removed-token','misplaced-runtime-token']){
                await form.evaluate((root,mutation)=>{const stack=root.querySelector('[data-admin-form-action="save"]').closest('.sticky').parentElement;stack.dataset.qaOriginalClass=stack.className;stack.classList.remove('space-y-5');if(mutation==='misplaced-runtime-token')root.classList.add('space-y-5');},mutant);
                const measured=await measureTaxonomySpacing(form);assert.throws(()=>assertTaxonomySpacing(measured,expected,kind),'The existing geometry protection rejects '+mutant);
                assert([...measured.sectionGaps,measured.preActionsGap].every(gap=>Math.abs(gap)<0.5),'The negative must causally recreate the original missing cadence');
                negatives.push({mutation:mutant,rejected:true,sectionGaps:measured.sectionGaps,preActionsGap:measured.preActionsGap});
                await form.evaluate(root=>{const stack=root.querySelector('[data-admin-form-action="save"]').closest('.sticky').parentElement;stack.className=stack.dataset.qaOriginalClass;delete stack.dataset.qaOriginalClass;root.classList.remove('space-y-5');});
            }
            assertTaxonomySpacing(await measureTaxonomySpacing(form),expected,kind);
        }
        const stickyHeight=Math.max(210,Math.ceil(normal.form.h-70));
        await page.setViewportSize({width,height:stickyHeight});await scrollTaxonomyFixture(page,0);
        let sticky=await measureTaxonomySpacing(form);
        await writeFile(path.join(out,'spacing-current-case.json'),JSON.stringify({kind,mode,width,normal,sticky},null,2));
        assert.equal(sticky.sticky.position,'sticky');assert.equal(sticky.sticky.bottom,'20px');
        const isPinned=row=>Math.abs(row.sticky.viewportBottomGap-20)<1&&Math.abs(row.actions.y-(normal.actions.y-row.scrollY))>0.5;
        const initialSticky=sticky;
        if(!isPinned(sticky)){await scrollTaxonomyFixture(page,'end');sticky=await measureTaxonomySpacing(form);}
        sticky.sticky.active=isPinned(sticky);
        if(!before){assert.equal(sticky.sticky.active,true,'The actual Actions must visibly pin at the unchanged bottom-5 boundary: '+JSON.stringify({kind,mode,width,normal,sticky}));
            assert(sticky.visible.every(button=>button.visible&&button.hit),'Both native actions remain visible and hit-testable while sticky');}
        assert.deepEqual(sticky.native,normal.native,'Viewport and sticky movement preserve actual native field values and flags');
        assert.deepEqual(sticky.sectionGaps,normal.sectionGaps,'Sticky Actions preserve the normal section cadence');
        await page.screenshot({path:path.join(out,prefix+'-sticky.png')});
        await scrollTaxonomyFixture(page,'end');
        const bottom=await measureTaxonomySpacing(form);
        if(!before){assert.equal(bottom.previousMarginEnd,reference.spacing.previousMarginEnd,'Sticky keeps the exact reference space reserved in normal flow');
            assert.deepEqual(bottom.sectionGaps,normal.sectionGaps);assert(bottom.preActionsGap>0,'The final Section remains visibly separated from Actions at the bottom-sticky boundary');}
        assert(bottom.visible.every(button=>button.visible&&button.hit),'Both native actions remain reachable after scrolling to the last Section');
        await page.screenshot({path:path.join(out,prefix+'-bottom.png')});
        cases.push({kind,mode,width,status:before?'KNOWN_REGRESSION':'PASS',expectedReferenceGap:expected,normal,initialSticky,sticky,bottom,negatives,screenshots:['normal','sticky','bottom'].map(state=>prefix+'-'+state+'.png')});
    }
    return cases;
}

async function captureTaxonomyReference(page) {
    const references=[];
    for(const width of [1440,390]){
        await page.setViewportSize({width,height:1600});
        await page.goto('http://127.0.0.1:48199/?scope=consistency&family=taxonomy&entity=reference');
        const form=page.locator('[data-family="taxonomy-reference"] form');await form.locator('#content-title').waitFor();await page.evaluate(()=>document.fonts.ready);
        const paint=await taxonomyRolePaint(form,'content-basic-data'),spacing=await measureTaxonomySpacing(form);
        const hint=await page.locator('[data-taxonomy-reference-hint]').evaluate(e=>{const s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,opacity:s.opacity,inset:s.paddingInlineStart};});
        const labelHint=await page.locator('[data-taxonomy-reference-label-hint]').evaluate(e=>{const s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,opacity:s.opacity,inset:s.paddingInlineStart};});
        const title=paint.labels.find(label=>label.text.startsWith('العنوان'));
        assert(title,'Actual Topic title label is required as the presentation reference');assert.equal(title.paint.size,'12px');assert.equal(title.paint.inset,'12px');assert.equal(title.gap,'8px');assert.equal(title.required.length,1);
        assert.equal(spacing.stack.tag,'DIV');assert.equal(spacing.stack.insidePendingFields,true);assert.equal(spacing.stack.runtimeToken,false);assert.equal(spacing.preActionsGap,20,'The actual ContentEditorShell reference must prove its current 20px cadence');
        const reference={width,paint,spacing,referenceOwner:'Actual ContentEditorShell and ContentBasicDataPanel; single Basic tab, isolated save transport; no authenticated live-route proof',label:title.paint,required:title.required[0],hints:{standalone:hint,label:labelHint},hintBoundary:'Canonical shared helper probes in standalone and canonical label contexts; actual Topic basic-data Panel has no equivalent taxonomy relation hint. The helper inherits context weight.',screenshot:'taxonomy-topic-reference-'+width+'.png'};
        await form.screenshot({path:path.join(out,reference.screenshot)});
        const height=Math.max(210,Math.ceil(spacing.form.h-70));await page.setViewportSize({width,height});await scrollTaxonomyFixture(page,0);reference.initialSticky=await measureTaxonomySpacing(form);
        await scrollTaxonomyFixture(page,spacing.form.y+spacing.form.h+16-height);reference.bottom=await measureTaxonomySpacing(form);
        reference.sticky=[reference.initialSticky,reference.bottom].find(row=>Math.abs(row.sticky.viewportBottomGap-20)<1&&row.visible.every(button=>button.visible&&button.hit));
        await writeFile(path.join(out,'spacing-topic-reference-'+width+'.json'),JSON.stringify(reference,null,2));
        assert(reference.sticky,'The actual Topic Actions provide a genuinely pinned and hit-testable bottom-sticky reference');
        await scrollTaxonomyFixture(page,reference.sticky.scrollY);
        await page.screenshot({path:path.join(out,'taxonomy-topic-reference-sticky-'+width+'.png')});
        taxonomyPresentationReference.set(width>=768?'desktop':'mobile',reference);references.push(reference);
    }
    return references;
}

async function inspectTaxonomyPanel(form, kind, mode, width) {
    const paint = await form.evaluate((root, headingId) => {
        const rect = element => { const box=element.getBoundingClientRect();return {x:box.x,y:box.y,w:box.width,h:box.height}; };
        const header=root.querySelector('[data-admin-tab-section-heading="'+headingId+'"]'),card=header.parentElement;
        const identity=header.querySelector('[data-admin-form-control-header][data-admin-form-control-presentation="leading-icon"]');
        const title=identity.querySelector('[role="heading"]'),frame=identity.querySelector(':scope > span[aria-hidden="true"]'),glyph=frame.querySelector('svg');
        const grid=card.querySelector('[data-admin-form-grid]'),style=getComputedStyle(card),headerStyle=getComputedStyle(header);
        return {dir:getComputedStyle(root).direction,overflow:root.scrollWidth>root.clientWidth+1,headers:root.querySelectorAll('[data-admin-tab-section-heading]').length,headerPresentation:header.dataset.adminTabSectionPresentation,card:rect(card),padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft],header:rect(header),headerPadding:[headerStyle.paddingTop,headerStyle.paddingInlineStart,headerStyle.paddingInlineEnd],charcoal:headerStyle.getPropertyValue('--admin-section-header-surface').trim(),title:title.textContent,titleSize:getComputedStyle(title).fontSize,titleWeight:getComputedStyle(title).fontWeight,frame:rect(frame),glyph:rect(glyph),accentCount:header.querySelectorAll('[data-admin-tab-section-accent="premium"]').length,gridPresentation:grid.dataset.adminFormGrid,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,controlBoxes:[...grid.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]),button[role="combobox"]')].filter(e=>e.getBoundingClientRect().width>1).map(e=>({name:e.name||e.id,...rect(e)})),nativeSources:[...grid.querySelectorAll('select')].map(e=>({name:e.name,hidden:e.getAttribute('aria-hidden'),tabIndex:e.tabIndex,source:e.hasAttribute('data-admin-form-listbox-source')})),actions:root.querySelectorAll('[data-admin-form-action="save"]').length,closeActions:root.querySelectorAll('[data-admin-form-action="close"]').length,fields:[...root.querySelectorAll('[name]')].map(e=>e.name),bodyText:card.textContent};
    }, kind+'-basic-data');
    assert.equal(paint.dir,'rtl');assert.equal(paint.overflow,false);assert.equal(paint.headers,kind==='category'?2:1);assert.equal(paint.headerPresentation,'premium');
    assert.deepEqual(paint.padding,['12px','12px','12px','12px']);assert.deepEqual(paint.headerPadding,['12px','24px','12px']);
    assert.equal(paint.charcoal,'rgba(8,13,22,0.82)');assert.equal(paint.title,kind==='series'?'بيانات السلسلة':'بيانات التصنيف');
    assert.equal(paint.titleSize,'14px');assert.equal(paint.titleWeight,'600');assert.equal(paint.frame.w,40);assert.equal(paint.frame.h,40);assert.equal(paint.glyph.w,20);assert.equal(paint.glyph.h,20);assert.equal(paint.accentCount,1);
    assert.equal(paint.gridPresentation,'aligned-fields');assert.equal(paint.columns,mode==='edit'?(width>=768?3:1):(width>=1280?4:width>=640?2:1));
    assert(paint.controlBoxes.every(control=>control.h>=44&&control.x>=paint.card.x&&control.x+control.w<=paint.card.x+paint.card.w+1));
    assert.equal(paint.nativeSources.length,1);assert.equal(paint.nativeSources[0].name,kind==='series'?'category_id':'parent_id');assert.equal(paint.nativeSources[0].hidden,'true');assert.equal(paint.nativeSources[0].tabIndex,-1);assert.equal(paint.nativeSources[0].source,true);
    assert.equal(paint.actions,1);assert.equal(paint.closeActions,1);assert(!paint.bodyText.includes('BASIC DATA'));
    assert.equal(paint.fields.includes('slug'),mode==='create');assert.equal(paint.fields.includes('id'),mode==='edit');assert.equal(paint.fields.includes('expected_updated_at'),mode==='edit');assert.equal(paint.fields.includes('color_token'),kind==='category');
    const roles=await taxonomyRolePaint(form,kind+'-basic-data');
    if(taxonomyConsistencyOnly){
        const reference=taxonomyPresentationReference.get(width>=768?'desktop':'mobile');assert(reference,'Reference must be captured before consumer conformance');
        const sharedIdentity=identity=>({frame:identity.frame,glyph:identity.glyph,divider:identity.divider,gap:identity.gap,title:identity.title});
        assert.deepEqual(sharedIdentity(roles.header.identity),sharedIdentity(reference.paint.header.identity),'Basic Section must match actual Topic Panel identity');
        assert.deepEqual(roles.header.surface,reference.paint.header.surface);assert.deepEqual(roles.header.card,reference.paint.header.card);
        assert.equal(roles.labels.length,mode==='create'?4:3);
        for(const label of roles.labels){assert.deepEqual(label.paint,reference.label,'Every applicable visible title uses the actual Topic typography/inset');assert.equal(label.gap,'8px');for(const required of label.required)assert.deepEqual(required,reference.required);}
        assert.equal(roles.labels.filter(label=>label.required.length).length,(kind==='series'?2:1)+(mode==='create'?1:0));
        assert.equal(roles.hints.length,mode==='create'?2:1);for(const hint of roles.hints)assert.deepEqual(hint.paint,reference.hints[hint.context],'Applicable hints use the canonical helper owner in the same label or standalone context');
        assert.deepEqual(roles.actions.identity,reference.paint.actions.identity,'Actions identity matches the actual Topic owner and content glyph');assert.deepEqual(roles.actions.surface,reference.paint.actions.surface);assert.equal(roles.actions.outside,true);assert.equal(roles.actions.after,true);assert.deepEqual(roles.actions.buttons.map(b=>[b.action,b.type]),[['save','submit'],['close','button']]);
        if(kind==='category'){assert.equal(roles.color.independent,true);assert.equal(roles.color.after,true);assert.equal(roles.color.containsPicker,true);assert.deepEqual(roles.color.surface,roles.header.card);assert.deepEqual(roles.color.header,roles.header.surface);assert.deepEqual(sharedIdentity(roles.color.identity),sharedIdentity(reference.paint.header.identity));assert.equal(roles.color.legend.w,1);assert.equal(roles.color.legend.h,1);assert.equal(roles.color.legend.position,'absolute');assert.equal(roles.color.legend.clipPath,'inset(50%)');assert.equal(roles.color.buttons,11);}
        else assert.equal(roles.color,null);
    }
    return {kind,mode,width,...paint,roles};
}

async function exerciseTaxonomyPanels(page) {
    const cases=[];
    for(const width of [1440,390])for(const mode of ['edit','create'])for(const kind of ['series','category']){
        await page.evaluate(()=>{localStorage.removeItem('taxonomy-series');localStorage.removeItem('taxonomy-category');});
        await page.setViewportSize({width,height:1100});
        await page.goto('http://127.0.0.1:48199/?scope=consistency&family=taxonomy&entity='+kind+(mode==='create'?'&taxonomy=create':''));
        const family=page.locator('[data-family="consistency-'+kind+'"]'),form=family.locator('form[data-admin-form-runtime]');
        const name=form.locator('input[name="name"]'),save=form.locator('[data-admin-form-action="save"]'),close=form.locator('[data-admin-form-action="close"]');
        const relation=kind==='series'?'category_id':'parent_id',trigger=form.locator('button[id="'+relation+'"]'),toggle=form.getByRole('switch',{name:'منشور',exact:true});
        await name.waitFor();await page.evaluate(()=>document.fonts.ready);
        const normal=await inspectTaxonomyPanel(form,kind,mode,width),initialName=await name.inputValue(),initialChecked=await toggle.isChecked();
        const initialRevision=mode==='edit'?await form.locator('[name="expected_updated_at"]').inputValue():null;
        const screenshot=async state=>{const file='taxonomy-'+kind+'-'+mode+'-'+state+'-'+width+'.png';await form.screenshot({path:path.join(out,file)});return file;};
        const screenshots=[await screenshot('normal')];
        await expect(form).toHaveAttribute('data-admin-form-dirty','false');
        await page.emulateMedia({reducedMotion:'reduce'});const reduced=await inspectTaxonomyPanel(form,kind,mode,width);assert.deepEqual(reduced.roles,normal.roles,'Reduced-motion media retains the approved resting presentation and geometry');await page.emulateMedia({reducedMotion:'no-preference'});
        await name.focus();await expect(name).toBeFocused();assert.deepEqual((await taxonomyRolePaint(form,kind+'-basic-data')).labels,normal.roles.labels,'Keyboard focus preserves complete label presentation');
        const colorPalette=[];
        if(kind==='category'){
            const picker=form.locator('fieldset:has(> input[name="color_token"])'),buttons=picker.locator('button'),initialToken=await picker.locator('[name="color_token"]').inputValue();
            let initialIndex=0;
            for(let index=0;index<await buttons.count();index++){
                const button=buttons.nth(index);await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
                const token=await picker.locator('[name="color_token"]').inputValue();if(token===initialToken)initialIndex=index;
                assert.equal(await picker.locator('button[aria-pressed="true"]').count(),1);colorPalette.push({label:await button.textContent(),token});
            }
            assert.equal(new Set(colorPalette.map(item=>item.token)).size,11);assert.equal(colorPalette[0].token,'');await buttons.nth(initialIndex).click();await expect(picker.locator('[name="color_token"]')).toHaveValue(initialToken);await expect(form).toHaveAttribute('data-admin-form-dirty','false');
        }
        await name.fill(initialName+' معدل');await expect(form).toHaveAttribute('data-admin-form-dirty','true');
        await close.click();const dialog=page.getByRole('dialog',{name:'إغلاق دون حفظ؟',exact:true});await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(close).toBeFocused();
        assert.deepEqual(await page.evaluate(()=>window.fixtureNavigation??[]),[]);
        await name.fill(initialName);await expect(form).toHaveAttribute('data-admin-form-dirty','false');
        await name.fill('');await save.click();
        await expect(form.locator('#name-error')).toContainText('الاسم مطلوب.');await expect(name).toHaveAttribute('aria-invalid','true');await expect(name).toBeFocused();
        const invalid=await page.evaluate(()=>window.taxonomyTransport.calls.at(-1));assert.equal(invalid.outcome,'validation');assert.equal(invalid.fields.name,'');
        screenshots.push(await screenshot('validation'));
        const retainedName='Taxonomy '+kind+' '+mode+' '+width;
        await name.fill(retainedName);await trigger.press('Enter');
        const search=page.getByRole('searchbox',{name:'ابحث في التصنيفات',exact:true});await expect(search).toBeFocused();await search.fill('نصائح');await search.press('ArrowDown');await search.press('Enter');
        await expect(form.locator('select[name="'+relation+'"]')).toHaveValue('18');
        await expect(trigger).toBeFocused();await trigger.press('Enter');await search.press('Escape');await expect(trigger).toBeFocused();assert.equal(await page.evaluate(()=>window.taxonomyTransport.calls.length),1,'Listbox keyboard selection and Escape do not submit');
        await toggle.press('Space');assert.equal(await toggle.isChecked(),!initialChecked);
        const submitted=await form.evaluate(element=>Object.fromEntries(new FormData(element)));
        await page.evaluate(()=>{window.taxonomyTransport.behavior='error';window.taxonomyTransport.hold=true;});
        const beforePendingCalls=await page.evaluate(()=>window.taxonomyTransport.calls.length);await save.click();
        await expect(form).toHaveAttribute('aria-busy','true');await expect(name).toBeDisabled();await expect(trigger).toBeDisabled();await expect(toggle).toBeDisabled();await expect(save).toBeDisabled();await expect(close).toBeDisabled();
        const pending=await form.evaluate(element=>({disabled:[...element.querySelectorAll('input:not([type="hidden"]),select,button')].every(control=>control.matches(':disabled')),busy:element.getAttribute('aria-busy')}));assert.equal(pending.disabled,true);
        await save.evaluate(button=>button.click());assert.equal(await page.evaluate(()=>window.taxonomyTransport.calls.length),beforePendingCalls+1);
        screenshots.push(await screenshot('pending'));
        await page.evaluate(()=>{const qa=window.taxonomyTransport;qa.hold=false;qa.release();delete qa.release;});
        await expect(save).toBeEnabled();await expect(form.locator('#name-error')).toContainText('فشل حفظ تجريبي');await expect(name).toHaveValue(retainedName);await expect(form).toHaveAttribute('data-admin-form-dirty','true');
        assert.deepEqual(await form.evaluate(element=>Object.fromEntries(new FormData(element))),submitted);
        await page.evaluate(()=>{window.taxonomyTransport.behavior='throw';});await save.click();await expect(save).toBeEnabled();
        await expect(page.getByText('تعذر تأكيد الحفظ',{exact:true})).toBeVisible();assert.deepEqual(await form.evaluate(element=>Object.fromEntries(new FormData(element))),submitted);
        await page.evaluate(()=>{window.taxonomyTransport.behavior='relation-error';});await save.click();await expect(save).toBeEnabled();await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-invalid','true');
        assert.deepEqual(await form.evaluate(element=>Object.fromEntries(new FormData(element))),submitted);
        if(kind==='category'){
            await page.evaluate(()=>{window.taxonomyTransport.behavior='color-error';});await save.click();await expect(save).toBeEnabled();
            const colorSection=form.locator('[data-admin-tab-section-heading="category-color"]').locator('..');await expect(colorSection.getByText('لون غير متاح محليًا.',{exact:true})).toBeVisible();await expect(colorSection.locator('fieldset [name="color_token"]')).toHaveValue(submitted.color_token);assert.deepEqual(await form.evaluate(element=>Object.fromEntries(new FormData(element))),submitted);screenshots.push(await screenshot('color-error'));
        }
        await page.evaluate(()=>{window.taxonomyTransport.behavior='conflict';});await save.click();await expect(save).toBeEnabled();
        await expect(page.getByText('تم تعديل السجل من جلسة أخرى. راجع تغييراتك ثم أعد تحميل الصفحة قبل المحاولة مجددًا.',{exact:true})).toBeVisible();
        await expect(form).toHaveAttribute('data-admin-form-dirty','true');assert.deepEqual(await form.evaluate(element=>Object.fromEntries(new FormData(element))),submitted);
        if(mode==='edit')await expect(form.locator('[name="expected_updated_at"]')).toHaveValue(initialRevision);
        screenshots.push(await screenshot('conflict'));
        await page.evaluate(()=>{window.taxonomyTransport.behavior='success';});await save.click();
        const expectedList='/admin/content/'+(kind==='series'?'series':'categories');
        if(mode==='create')await expect.poll(()=>page.evaluate(()=>window.fixtureNavigation?.at(-1)?.method)).toBe('replace');
        else {await expect(form).toHaveAttribute('data-admin-form-dirty','false');await expect(save).toBeEnabled();}
        const transport=await page.evaluate(()=>({calls:window.taxonomyTransport.calls,navigation:window.fixtureNavigation??[]}));
        const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem('taxonomy-'+key)),kind);
        assert.equal(saved.name,retainedName);assert.equal(saved.status,initialChecked?'unpublished':'published');assert.equal(saved[relation],18);
        const success=transport.calls.at(-1);assert.equal(success.outcome,'success');assert.deepEqual(success.fields,submitted);
        if(mode==='edit'){await expect(form.locator('[name="expected_updated_at"]')).toHaveValue(saved.updated_at);assert.equal(saved.slug,kind==='series'?'first':'market');}
        else {assert.equal(transport.navigation.at(-1).href,expectedList+'/'+saved.id);await expect(save).toBeDisabled();}
        await page.goto('http://127.0.0.1:48199/?scope=consistency&family=taxonomy&entity='+kind);
        const reloaded=page.locator('[data-family="consistency-'+kind+'"] form[data-admin-form-runtime]');
        await expect(reloaded).toHaveAttribute('data-admin-form-mode','edit');await expect(reloaded.locator('[name="name"]')).toHaveValue(retainedName);await expect(reloaded.locator('[name="id"]')).toHaveValue(String(saved.id));await expect(reloaded.locator('[name="expected_updated_at"]')).toHaveValue(saved.updated_at);await expect(reloaded.locator('select[name="'+relation+'"]')).toHaveValue('18');await expect(reloaded).toHaveAttribute('data-admin-form-dirty','false');
        if(kind==='category')await expect(reloaded.locator('[name="color_token"]')).toHaveValue(saved.color_token);
        screenshots.push('taxonomy-'+kind+'-'+mode+'-local-reload-'+width+'.png');await reloaded.screenshot({path:path.join(out,screenshots.at(-1))});
        await reloaded.locator('[data-admin-form-action="close"]').click();assert.deepEqual(await page.evaluate(()=>window.fixtureNavigation),[{method:'push',href:expectedList}]);await expect(page.getByRole('dialog')).toHaveCount(0);
        cases.push({kind,mode,width,status:'PASS',normal,pending,reducedMotion:{restingRolesIdentical:true,media:'reduce'},colorPalette,keyboard:'Focus/name; searchable listbox filter/ArrowDown/Enter/Escape without submit; publication Space; dirty Close/Escape focus return',initialRevision,submitted,saved,transport,screenshots,proof:'Actual current taxonomy consumer and Form Runtime; native names, canonical taxonomy schema, local delayed/rejected/throw/relation/color/conflict/success ports and local saved-record remount. No hosted Action, Auth, SQL or database persistence claim.'});
    }
    return cases;
}

async function runSharedPresentation(page) {
    await page.goto('http://127.0.0.1:48199/?scope=shared-presentation');
    const main=page.locator('[data-family="shared-presentation"]');await main.waitFor();await page.evaluate(()=>document.fonts.ready);
    const results=[];
    for(const width of [1681,1280,1024,768,390,375]){
        await page.setViewportSize({width,height:936});
        const measured=await main.evaluate(root=>{
            const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
            return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,grids:[...root.querySelectorAll('[data-qa-grid-case]')].map(section=>{const grid=section.querySelector(':scope > [data-admin-form-grid]');return {spans:section.dataset.qaGridCase.split('-').map(Number),box:box(grid),gap:parseFloat(getComputedStyle(grid).columnGap),items:[...grid.children].map(box),overflow:grid.scrollWidth>grid.clientWidth+1};})};
        });
        assert.equal(measured.overflow,false);assert.equal(measured.grids.length,10);
        for(const grid of measured.grids){
            assert.equal(grid.overflow,false);assert.equal(grid.items.length,grid.spans.length);
            for(const [i,item] of grid.items.entries()){
                assert(item.x>=grid.box.x-1&&item.x+item.w<=grid.box.x+grid.box.w+1,'Grid item stays inside its actual owner');
                if(width>=1280){const track=(grid.box.w-11*grid.gap)/12,expected=track*grid.spans[i]+(grid.spans[i]-1)*grid.gap;assert(Math.abs(item.w-expected)<1);assert(Math.abs(item.y-grid.items[0].y)<1);if(i)assert(item.x+item.w<=grid.items[i-1].x-grid.gap+1,'12-column items retain RTL ordering');}
                else {assert(Math.abs(item.w-grid.box.w)<1);if(i)assert(item.y>=grid.items[i-1].y+grid.items[i-1].h+grid.gap-1,'Narrow grids stack without overlap');}
            }
        }
        results.push({width,gridCases:measured.grids.length,overflow:false});
    }
    await page.setViewportSize({width:1280,height:936});await page.mouse.move(0,0);
    const surface=e=>{const s=getComputedStyle(e);return {background:s.background,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,backdropFilter:s.backdropFilter,padding:s.padding};};
    const card=kind=>main.locator('[data-qa-card="'+kind+'"] > section');
    const defaultSurface=await card('implicit').evaluate(surface);
    assert.deepEqual(await card('default').evaluate(surface),defaultSurface,'Explicit and implicit default AdminCard remain identical');
    assert.deepEqual(await card('interactive').evaluate(surface),defaultSurface,'Interactive opt-in preserves the default resting surface');
    assert.equal(defaultSurface.borderRadius,'28px');assert(defaultSurface.background.includes('0.78'));
    const premiumSurface=await card('premium').evaluate(surface);assert(premiumSurface.background.includes('linear-gradient'));assert.notDeepEqual(premiumSurface,defaultSurface);
    assert.deepEqual(await card('premium-interactive').evaluate(surface),premiumSurface);
    const motion=e=>({translate:getComputedStyle(e).translate,transform:getComputedStyle(e).transform});
    for(const kind of ['implicit','premium']){const item=card(kind);const resting=await item.evaluate(motion);await item.hover();assert.deepEqual(await item.evaluate(motion),resting,'Noninteractive card remains stationary');await page.mouse.move(0,0);}
    for(const kind of ['interactive','premium-interactive']){const item=card(kind);const resting=await item.evaluate(motion);await item.hover();await expect.poll(()=>item.evaluate(motion)).not.toEqual(resting);await page.mouse.move(0,0);await expect.poll(()=>item.evaluate(motion)).toEqual(resting);}
    const sections=await main.locator('[data-qa-section] > section').evaluateAll(elements=>elements.map(e=>{const s=getComputedStyle(e),label=e.querySelector('label');return {surface:{background:s.background,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,padding:s.padding},title:getComputedStyle(e.querySelector('h2')).fontSize,description:getComputedStyle(e.querySelector('h2 + p')).fontSize,label:getComputedStyle(label.firstElementChild).fontSize,hint:getComputedStyle(label.children[1]).fontSize,input:getComputedStyle(label.querySelector('input')).fontSize};}));
    assert.deepEqual(sections[0],sections[1],'Default form section presentation remains unchanged');assert.equal(sections[0].surface.borderRadius,'28px');assert.equal(sections[0].title,'20px');assert.equal(sections[0].description,'14px');assert.equal(sections[0].label,'14px');assert.equal(sections[0].hint,'12px');assert.equal(sections[0].input,'14px');
    const choices=await main.locator('[data-qa-choice]').evaluateAll(elements=>elements.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {state:e.dataset.qaChoice,font:s.fontSize,height:r.height,width:r.width,border:s.borderColor,background:s.backgroundImage,opacity:s.opacity,cursor:s.cursor};}));
    assert(choices.every(choice=>choice.font==='14px'&&choice.height>=44&&choice.width>=44));const selected=choices.find(c=>c.state==='selected'),unselected=choices.find(c=>c.state==='unselected'),disabled=choices.find(c=>c.state==='disabled');assert(selected.background.includes('linear-gradient'));assert.notEqual(selected.border,unselected.border);assert.equal(disabled.opacity,'0.45');assert.equal(disabled.cursor,'not-allowed');
    await main.locator('[data-qa-choice="selected"]').click();assert.equal(await page.evaluate(()=>window.sharedChoiceClicked),'selected');await page.evaluate(()=>{window.sharedChoiceClicked=null;});const disabledChoice=main.locator('[data-qa-choice="disabled"]');await expect(disabledChoice).toBeDisabled();await disabledChoice.click({force:true});assert.equal(await page.evaluate(()=>window.sharedChoiceClicked),null,'Disabled choice cannot activate its handler');
    const legacyFields=await main.locator('[data-qa-field-default]').evaluateAll(elements=>elements.map(root=>{const label=root.querySelector('label'),title=label.querySelector('[data-admin-form-label-text]')??label.firstElementChild,hint=label.children[1],style=e=>{const s=getComputedStyle(e);return {size:s.fontSize,weight:s.fontWeight,color:s.color,lineHeight:s.lineHeight,inset:s.paddingInlineStart};};return {mode:root.dataset.qaFieldDefault,title:style(title),hint:style(hint),gap:getComputedStyle(label).rowGap};}));
    assert.deepEqual({...legacyFields[0],mode:'same'},{...legacyFields[1],mode:'same'},'Omitted and explicit default Field render identically');assert.equal(legacyFields[0].title.size,'14px');assert.equal(legacyFields[0].hint.size,'12px');assert.equal(legacyFields[2].title.size,'14px');assert.equal(legacyFields[2].title.color,legacyFields[0].title.color);assert.equal(legacyFields[2].title.inset,'12px');assert.equal(legacyFields[2].hint.size,'12px');
    const proof={grids:results,cardDefaultsIdentical:true,premiumOptIn:true,interactiveHover:true,defaultSectionAndTextScale:sections[0],legacyFields,choiceStates:choices};
    console.log('SHARED_PRESENTATION '+JSON.stringify(proof));return proof;
}

async function runPixelRefinement(page) {
    await page.setViewportSize({width:1681,height:936});
    await page.goto('http://127.0.0.1:48199/?scope=pixel&tab=cta&returnPageId=1');
    const main=page.locator('[data-family="pixel-story"]');
    const header=main.locator('[data-admin-tab-section-heading="cta"]');
    await header.waitFor();await main.locator('[data-home-story-button-panel="data"]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await main.locator('[data-admin-link-destination]').getByText('من نحن',{exact:true}).waitFor();
    const headerTop=await header.evaluate(e=>e.getBoundingClientRect().y+scrollY);
    await page.evaluate(y=>scrollTo(0,y),headerTop-12);
    const screenshot=path.join(out,'content25-desktop.png');
    if(pixelScreenshotEnabled){await page.screenshot({path:screenshot});console.log('PIXEL_DESKTOP_CAPTURE '+screenshot);}
    else console.log('PIXEL_DESKTOP_CAPTURE skipped; approved PNG preserved');
    if(process.env.ADMIN_FORM_LAYOUT_PREVIEW_PATH){await page.screenshot({path:process.env.ADMIN_FORM_LAYOUT_PREVIEW_PATH});console.log('PIXEL_TEMP_PREVIEW '+process.env.ADMIN_FORM_LAYOUT_PREVIEW_PATH);}
    const measurements=[];
    for(const width of [1681,1280,1024,768,390,375]){
        await page.setViewportSize({width,height:936});
        const row=await main.evaluate(root=>{
            const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
            const heading=root.querySelector('[data-admin-tab-section-heading="cta"]');
            const button=root.querySelector('button[type="submit"]');const footer=button.closest('.sticky');
            const panels=[...root.querySelectorAll('[data-home-story-button-panel]')].map(e=>({kind:e.dataset.homeStoryButtonPanel,box:box(e),overflow:e.scrollWidth>e.clientWidth+1}));
            const cards=[...root.querySelectorAll('[data-home-story-button-card]')].map(e=>({kind:e.dataset.homeStoryButtonCard,box:box(e),control:box(e.querySelector('[role="combobox"],[role="radiogroup"]')),overflow:e.scrollWidth>e.clientWidth+1}));
            const link=root.querySelector('[data-admin-link-field]');const actions=[...link.querySelectorAll('[data-admin-link-controls] > button')].map(e=>({box:box(e),svg:box(e.querySelector('svg'))}));
            const hitAreas=[...root.querySelectorAll('[data-home-story-button-panel] button,[data-home-story-button-panel] input:not([type="hidden"]),[data-home-story-button-panel] [role="combobox"]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({label:e.getAttribute('aria-label')||e.name||e.textContent,box:box(e)}));
            const font=e=>getComputedStyle(e).fontSize;
            const controlHeaders=[...root.querySelectorAll('[data-home-story-button-card] [data-admin-form-control-header]')].map(e=>({title:font(e.firstElementChild.firstElementChild),description:font(e.firstElementChild.lastElementChild),frame:box(e.querySelector('[aria-hidden="true"]')),glyph:box(e.querySelector('svg'))}));
            const headingIdentities=heading.querySelectorAll('[data-admin-form-control-header][data-admin-form-control-presentation="leading-icon"]'),headingIdentity=headingIdentities[0],headingTitle=headingIdentity.querySelector('[role="heading"][aria-level="2"]'),headingFrame=headingIdentity.querySelector(':scope > span[aria-hidden="true"]');
            const scale={headingIdentityCount:headingIdentities.length,headingTitle:font(headingTitle),headingTitleWeight:getComputedStyle(headingTitle).fontWeight,headingDescription:font(headingTitle.parentElement.nextElementSibling),headingFrame:box(headingFrame),headingGlyph:box(headingFrame.querySelector('svg')),footerTitle:font(footer.querySelector('p')),footerDescription:font(footer.querySelector('p + p')),save:font(button),bodyControls:[...root.querySelectorAll('[data-home-story-button-panel] input:not([type="hidden"]),[data-home-story-button-panel] [role="radio"],[data-home-story-button-panel] [role="combobox"]')].map(font)};
            return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,heading:box(heading),panels,cards,footer:box(footer),actions,hitAreas,controlHeaders,scale};
        });
        measurements.push(row);
        if(width===375){
            const mobileSave=main.locator('button[type="submit"]');await mobileSave.scrollIntoViewIfNeeded();await expect(mobileSave).toBeInViewport({ratio:1});
            const painted=await mobileSave.evaluate(e=>{const r=e.getBoundingClientRect(),bar=e.closest('.sticky'),s=getComputedStyle(bar);return {box:{x:r.x,y:r.y,w:r.width,h:r.height},footerHeight:bar.getBoundingClientRect().height,visible:s.visibility,opacity:s.opacity,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e};});
            assert.equal(painted.visible,'visible');assert.equal(painted.opacity,'1');assert.equal(painted.hit,true);assert(painted.box.w>=44&&painted.box.h>=44);console.log('MOBILE_FOOTER_PAINT '+JSON.stringify(painted));
            if(process.env.ADMIN_FORM_LAYOUT_MOBILE_PREVIEW_PATH){await page.screenshot({path:process.env.ADMIN_FORM_LAYOUT_MOBILE_PREVIEW_PATH});console.log('PIXEL_TEMP_MOBILE_PREVIEW '+process.env.ADMIN_FORM_LAYOUT_MOBILE_PREVIEW_PATH);}
        }
        try{
            assert.equal(row.overflow,false);assert(row.panels.every(p=>!p.overflow));assert(row.cards.every(c=>!c.overflow));assert.equal(row.cards.length,4);
            const data=row.panels.find(p=>p.kind==='data'),appearance=row.panels.find(p=>p.kind==='appearance');
            assert(data&&appearance);
            if(width>=1280){assert(data.box.x>appearance.box.x);assert(Math.abs(data.box.y-appearance.box.y)<2);assert(Math.abs(data.box.h-appearance.box.h)<2);}
            else assert(appearance.box.y>=data.box.y+data.box.h);
            for(const card of row.cards){assert(card.box.x>=appearance.box.x&&card.box.x+card.box.w<=appearance.box.x+appearance.box.w+1);assert(card.box.y>=appearance.box.y&&card.box.y+card.box.h<=appearance.box.y+appearance.box.h+1);}
            if(width>=768){for(const pair of [[0,1],[2,3]]){const [a,b]=pair.map(i=>row.cards[i]);assert(Math.abs(a.control.y-b.control.y)<2,'Paired actual controls retain aligned baselines');assert(Math.abs(a.box.h-b.box.h)<2,'Paired control cards remain balanced');}}
            for(const action of row.actions){assert.equal(action.box.w,44);assert.equal(action.box.h,44);assert.equal(action.svg.w,20);assert.equal(action.svg.h,20);}
            assert.equal(row.controlHeaders.length,4);for(const header of row.controlHeaders){assert.equal(header.title,'14px');assert.equal(header.description,'12px');assert.equal(header.frame.w,40);assert.equal(header.frame.h,40);assert.equal(header.glyph.w,20);assert.equal(header.glyph.h,20);}
            assert.equal(row.scale.headingIdentityCount,1);assert.equal(row.scale.headingTitle,'14px');assert.equal(row.scale.headingTitleWeight,'600');assert.equal(row.scale.headingDescription,'12px');assert.equal(row.scale.headingFrame.w,40);assert.equal(row.scale.headingFrame.h,40);assert.equal(row.scale.headingGlyph.w,20);assert.equal(row.scale.headingGlyph.h,20);
            assert.equal(row.scale.footerTitle,'14px');assert.equal(row.scale.footerDescription,'12px');assert.equal(row.scale.save,'14px');assert(row.scale.bodyControls.every(size=>size==='14px'));
            assert(row.hitAreas.every(control=>control.box.w>=44&&control.box.h>=44),'Every body interaction retains a minimum44px hit area');

        }catch(error){if(pixelScreenshotEnabled&&width<=390)await page.screenshot({path:path.join(out,'content25-mobile-discrepancy.png')});throw error;}
    }
    console.log('PIXEL_GEOMETRY '+JSON.stringify(measurements.map(r=>({width:r.width,heading:r.heading,panels:r.panels,cards:r.cards.map(c=>({kind:c.kind,box:c.box})),footer:r.footer}))));
    console.log('STANDARD_SCALE '+JSON.stringify({baseline:{body:418,total:672},current:{body:measurements[0].panels[0].box.h,total:measurements[0].footer.y+measurements[0].footer.h-measurements[0].heading.y},scale:measurements[0].scale}));
    // Real parent lifecycle with an isolated deferred action: no persistence transport.
    await page.setViewportSize({width:1681,height:936});
    const input=main.locator('[name="button_label"]');
    await input.fill('اختبار حفظ محلي');
    const focus=await input.evaluate(e=>{const s=getComputedStyle(e);return {border:s.borderColor,outline:s.outline,shadow:s.boxShadow};});
    await input.press('Tab');
    const blurred=await input.evaluate(e=>{const s=getComputedStyle(e);return {border:s.borderColor,outline:s.outline,shadow:s.boxShadow};});
    console.log('PIXEL_INPUT_FOCUS '+JSON.stringify({focused:focus,blurred}));
    assert.notDeepEqual(focus,blurred,'Text input retains its shared visible focus feedback');
    const radio=main.getByRole('radio',{name:'وسط',exact:true});await radio.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(radio).toBeFocused();
    const radioFocus=await radio.evaluate(e=>({outline:getComputedStyle(e).outline,visible:e.matches(':focus-visible')}));assert(radioFocus.visible);assert(!radioFocus.outline.startsWith('none'));
    const save=main.locator('button[type="submit"]');await save.click();await expect(save).toBeDisabled();await expect(save).toHaveText('جارٍ الحفظ...');
    assert.equal(await page.evaluate(()=>window.pixelSubmitted.button_label),'اختبار حفظ محلي');
    await page.evaluate(()=>window.finishPixelSave());await expect(save).toBeEnabled();
    const footerStyle=element=>{const e=element.closest('.sticky'),s=getComputedStyle(e);return {background:s.background,border:s.border,padding:s.padding,marginTop:s.marginTop,minHeight:s.minHeight,buttonSize:getComputedStyle(element).fontSize};};
    const headingStyle=element=>{const s=getComputedStyle(element),identity=element.querySelector('[data-admin-form-control-header][data-admin-form-control-presentation="leading-icon"]'),title=identity.querySelector('[role="heading"][aria-level="2"]'),description=title.parentElement.nextElementSibling;return {background:s.background,border:s.border,padding:s.padding,title:getComputedStyle(title).fontSize,titleWeight:getComputedStyle(title).fontWeight,description:getComputedStyle(description).fontSize};};
    const ctaFooterStyle=await save.evaluate(footerStyle),ctaHeadingStyle=await header.evaluate(headingStyle);
    await main.getByRole('tab').nth(0).click();
    await expect(main.locator('[data-admin-tab-section-heading="cta"]')).toBeHidden();
    assert.deepEqual(await save.evaluate(footerStyle),ctaFooterStyle,'CTA and text tab use the same default footer');
    await main.getByRole('tab').nth(1).click();
    assert.deepEqual(await main.locator('[data-admin-tab-section-heading="images"]').evaluate(headingStyle),ctaHeadingStyle,'CTA and images tab use the same default heading owner');
    await main.getByRole('tab').nth(2).click();await expect(header).toBeVisible();
    assert.deepEqual(await save.evaluate(footerStyle),ctaFooterStyle);
    await page.goto('http://127.0.0.1:48199/?scope=consistency');
    await exerciseConsistencyButton(page);
    await page.goto('http://127.0.0.1:48199/');
    const defaultLink=page.locator('[data-family="footer"] [data-admin-link-field]');await defaultLink.locator('[data-admin-link-controls] > button').first().waitFor();
    await inspectLinkIcons(defaultLink);
    await runSharedPresentation(page);
    assert.deepEqual(errors,[]);
    console.log('PASS pixel-refinement: actual ContentModuleEditClient CTA header and save footer; six RTL widths; paired control baselines; keyboard picker select/clear and focus return; hidden icon position; isolated serialization/remount and pending save; inactive-tab styling isolation; unchanged default link icons; no live persistence. Screenshot output obeys ADMIN_FORM_LAYOUT_SCREENSHOT; no report or bundle retained.');
}

async function runButtonRefinement(page) {
    await page.goto('http://127.0.0.1:48199/?scope=consistency');
    const button=page.locator('[data-family="consistency-button"]');
    await button.locator('[data-admin-link-destination]').getByText('من نحن',{exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const rows=[];
    for(const width of [1440,1280,1024,768,390,375]){
        await page.setViewportSize({width,height:1100});
        await button.scrollIntoViewIfNeeded();
        const row=await button.evaluate(root=>{
            const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
            const outer=root.querySelector('[data-admin-form-grid]');
            const items=[...outer.children].map(item=>{const card=item.querySelector('[data-module-editor-field-span]').firstElementChild,style=getComputedStyle(card),box=rect(card),left=parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),right=parseFloat(style.borderRightWidth)+parseFloat(style.paddingRight),top=parseFloat(style.borderTopWidth)+parseFloat(style.paddingTop),bottom=parseFloat(style.borderBottomWidth)+parseFloat(style.paddingBottom);return {item:rect(item),card:box,content:{x:box.x+left,y:box.y+top,w:box.w-left-right,h:box.h-top-bottom},border:style.borderTopWidth,span:getComputedStyle(item).gridColumn};});
            const controlsGrid=outer.children[1].querySelector('[data-admin-form-grid]');
            const cards=[...controlsGrid.children].filter(c=>c.tagName!=='INPUT').map(c=>({box:rect(c),border:getComputedStyle(c).borderTopWidth,label:rect(c.querySelector(':scope > span')),control:rect(c.querySelector('[role="combobox"],[role="radiogroup"]')),fields:[...c.querySelectorAll('[name]')].map(i=>i.name)}));
            const typography=[...root.querySelectorAll('label > span,[role="radio"],[role="combobox"],input:not([type="hidden"])')].filter(e=>e.getBoundingClientRect().width>1).map((e,i)=>{const st=getComputedStyle(e);return {key:e.name||e.getAttribute('aria-label')||e.textContent||('control-'+i),fontSize:st.fontSize,fontWeight:st.fontWeight,lineHeight:st.lineHeight,fontFamily:st.fontFamily,color:st.color,backgroundColor:st.backgroundColor};});
            const rightChildren=[...outer.children[0].querySelector('[data-admin-form-grid]').children].map(rect);
            const link=root.querySelector('[data-admin-link-field]'),linkRow=link.querySelector('[data-admin-link-controls]');const linkGeometry={field:rect(link),row:rect(linkRow),destination:rect(link.querySelector('[data-admin-link-destination]')),actions:[...linkRow.querySelectorAll(':scope > button')].map(rect)};
            return {width:innerWidth,overflow:root.scrollWidth>root.clientWidth+1,outer:rect(outer),items,cards,typography,linkGeometry,rightChildren};
        });
        rows.push(row);geometry.push(row);
        assert.equal(row.overflow,false,JSON.stringify(row));
        const link=row.linkGeometry;assert(link.destination.x>=link.row.x-1&&link.destination.x+link.destination.w<=link.row.x+link.row.w+1);assert(link.actions.every(a=>a.x>=link.row.x-1&&a.x+a.w<=link.row.x+link.row.w+1));assert(link.actions[0].x+link.actions[0].w<=link.destination.x,'RTL link actions and destination cannot overlap');
        if(recoveryPhase==='button-refinement-after'){
            const near=(a,b)=>Math.abs(a-b)<2;
            assert(row.items.every(i=>i.border==='1px'),'Both outer groups use real shared control cards');
            assert.equal(row.cards.length,4);assert(row.cards.every(c=>c.border==='1px'),'Every behavior control has its shared card');
            const inside=(box,parent)=>box.x>=parent.x-1&&box.y>=parent.y-1&&box.x+box.w<=parent.x+parent.w+1&&box.y+box.h<=parent.y+parent.h+1;
            assert(row.cards.every(c=>inside(c.box,row.items[1].content)),JSON.stringify(row));assert(row.rightChildren.every(c=>inside(c,row.items[0].content)),JSON.stringify(row));
            if(width>=1280){assert(near(row.items[0].card.h,row.items[1].card.h),JSON.stringify(row.items));assert(near(row.items[1].item.w,2*row.items[0].item.w+16));assert(row.items[0].item.x>row.items[1].item.x);}
            if(width>=768){assert(row.cards.every((c,i,all)=>near(c.box.y,all[Math.floor(i/2)*2].box.y)&&near(c.box.w,all[0].box.w)&&near(c.box.h,all[Math.floor(i/2)*2].box.h)&&near(c.label.y,all[Math.floor(i/2)*2].label.y)&&near(c.control.y,all[Math.floor(i/2)*2].control.y)),JSON.stringify(row.cards));}
            else assert(row.cards.every((c,i,all)=>i===0||c.box.y>=all[i-1].box.y+all[i-1].box.h+8));
            for(const card of row.cards){assert(card.control.x>=card.box.x-1&&card.control.x+card.control.w<=card.box.x+card.box.w+1);assert(card.control.y>=card.label.y+card.label.h+4);}
            const before=JSON.parse(await readFile(path.join(root,'.tmp-qa/admin-ui-recovery/button-refinement-before/receipt.json'),'utf8'));
            assert.deepEqual(row.typography,before.rows.find(r=>r.width===width).typography,'Control labels, typography and colors remain unchanged');
            assert.deepEqual(row.cards.map(c=>c.fields),before.rows.find(r=>r.width===width).cards.map(c=>c.fields),'Target, alignment, icon and position retain exact control order');
        }
        linkEvidence.push({width,fields:await inspectLinkIcons(button.locator('[data-admin-link-field]'))});
        await button.screenshot({path:path.join(out,'content-button-'+width+'.png')});
    }
    if(recoveryPhase==='button-refinement-after')await exerciseConsistencyButton(page);
    assert.deepEqual(errors,[]);
    await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',phase:recoveryPhase,rows,linkEvidence,errors,journeys:recoveryPhase==='button-refinement-after'?'Reused actual Story keyboard link picker focus trap/return, target/alignment/icon conditional visibility and position, anchor, isolated serialization/remount and clear-link state':null,scope:'Only actual AboutIntroModuleEditor home-story CTA; real existing CSS and link controls; controlled local transports; no authenticated live route, native server persistence or production writes'},null,2));
    console.log('PASS '+recoveryPhase+' scoped actual Story button');
}

async function runConsistency(page) {
    if(taxonomyConsistencyOnly){
        const sharedDefaults=await runSharedPresentation(page),presentationReferences=await captureTaxonomyReference(page);
        const spacingBefore=recoveryPhase==='consistency-before',spacing=await captureTaxonomySpacing(page,spacingBefore);
        if(spacingBefore){
            assert.deepEqual(errors,[]);assert.deepEqual(await fingerprintTaxonomySources(),taxonomySourceHashes);
            await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'EXPECTED_REGRESSION',phase:recoveryPhase,familyFilter:'taxonomy',sourceHashes:taxonomySourceHashes,sharedDefaults,presentationReferences,spacing,errors,hostedDatabaseWrites:0,productionMutations:0,scope:'BEFORE causal reproduction: actual Category/Series Create/Edit at Desktop/Mobile RTL normal, genuine bottom-sticky and final-section scroll. The actual ContentEditorShell reference measures20px; affected consumers measure0px. Isolated components/CSS/transports only; no authenticated live-route observation or hosted writes.'},null,2));
            console.log('EXPECTED_REGRESSION taxonomy spacing BEFORE: 4 actual Create/Edit consumers x Desktop/Mobile; missing20px cadence reproduced and preserved');
            return;
        }
        await page.goto('http://127.0.0.1:48199/?scope=consistency&family=taxonomy');
        await page.locator('[data-family="consistency-series"] [name="name"]').waitFor();await page.evaluate(()=>document.fonts.ready);
        const measurements=[];
        for(const width of [1440,1024,768,390,375]){
            await page.setViewportSize({width,height:1100});
            for(const kind of ['series','category']){
                const form=page.locator('[data-family="consistency-'+kind+'"] form');
                measurements.push(await inspectTaxonomyPanel(form,kind,'edit',width));
                if([1440,390].includes(width))await form.screenshot({path:path.join(out,'taxonomy-'+kind+'-edit-normal-'+width+'.png')});
            }
            assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        }
        const taxonomyCreate=await captureTaxonomyCreate(page),taxonomyPanelJourneys=await exerciseTaxonomyPanels(page);
        assert.deepEqual(errors,[]);assert.deepEqual(await fingerprintTaxonomySources(),taxonomySourceHashes,'Taxonomy source must remain stable throughout the existing fixture run');
        await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',phase:recoveryPhase,familyFilter:'taxonomy',sourceHashes:taxonomySourceHashes,sharedDefaults,presentationReferences,spacing,measurements,taxonomyCreate,taxonomyPanelJourneys,errors,hostedDatabaseWrites:0,productionMutations:0,scope:'Affected Category/Series Create/Edit and shared opt-in default protection only, selected within the existing consistency runner/fixture. Actual ContentEditorShell cadence, Topic Panel identity/label/Actions and canonical helper hint comparisons; Desktop/Mobile normal/sticky/final-section geometry with removed/misplaced-token negative controls; actual canonical components, current CSS, shared taxonomy schema and isolated local transports/read-back; default seven-family consistency and its retained CTA failure are not relabelled PASS. No authenticated live-route, hosted Server Action, Auth, SQL or database persistence proof.'},null,2));
        console.log('PASS consistency-after taxonomy family: 4 actual Create/Edit consumers, 5 RTL widths, 8 Desktop/Mobile lifecycle journeys; no hosted writes');
        return;
    }
    await page.goto('http://127.0.0.1:48199/?scope=consistency');
    const featured = page.locator('[data-family="consistency-featured"]');
    await featured.getByRole('tab').nth(1).click();
    await featured.locator('[name="eyebrow"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const families = ['consistency-featured', 'consistency-button', 'consistency-topic-edit', 'consistency-topic-create', 'consistency-series', 'consistency-category', 'consistency-existing-aligned'];
    const measurements = [];
    for (const width of [1440, 1024, 768, 390, 375]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.evaluate(() => scrollTo(0, 0));
        const row = await page.evaluate(() => {
            const rect = e => { if (!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; };
            const visible = e => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height > 1;
            return { width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth, families:[...document.querySelectorAll('[data-family]')].map(f => ({family:f.dataset.family,overflow:f.scrollWidth>f.clientWidth+1,controls:[...f.querySelectorAll('input:not([type="hidden"]),textarea,[role="combobox"],[role="switch"],[data-admin-text-format-controls]')].filter(visible).map(c => ({name:c.name||c.getAttribute('aria-label')||c.getAttribute('role'),rect:rect(c),label:(() => {const id=c.getAttribute('aria-labelledby');const explicit=c.id ? f.querySelector('label[for="'+c.id+'"]') : null;const wrap=c.closest('[data-admin-form-listbox],label,[data-module-editor-control-row]');return rect((id&&document.getElementById(id))||explicit||wrap?.querySelector(':scope > span'));})(),hint:(() => {const id=c.getAttribute('aria-describedby');return rect(id&&document.getElementById(id));})(),html:c.outerHTML})), grids:[...f.querySelectorAll('[data-admin-form-grid]')].filter(visible).map(g=>({kind:g.dataset.adminFormGrid,rect:rect(g),columns:getComputedStyle(g).gridTemplateColumns,children:[...g.children].filter(visible).map(c=>({rect:rect(c),span:getComputedStyle(c).gridColumn,fields:[...c.querySelectorAll('[name]')].map(i=>i.name)}))}))}))};
        });
        if(recoveryPhase === 'consistency-after') row.details = await page.evaluate(() => {
            const rect = e => { if (!e) return null; const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}; };
            const root = family => document.querySelector('[data-family="'+family+'"]');
            const fields = grid => [...grid.children].filter(e=>e.tagName!=='INPUT').map(e=>({box:rect(e),label:rect(e.querySelector(':scope > span,:scope > label')), control:rect(e.querySelector('input:not([type="hidden"]),[role="combobox"],[role="radiogroup"],[data-admin-form-switch-surface]')),hint:rect(e.querySelector('p')),margin:getComputedStyle(e.children[0]).marginTop}));
            const featured=['eyebrow','title','presentation_description'].map(name=>{const input=root('consistency-featured').querySelector('[name="'+name+'"]'),card=input.closest('[data-module-editor-control-row]'),header=card.querySelector(':scope > div');return {name,card:rect(card),label:rect(header.querySelector(':scope > span')),tools:rect(card.querySelector('[data-admin-text-format-controls]')),input:rect(input)};});
            const buttonRoot=root('consistency-button');const buttonGrid=buttonRoot.querySelector('[data-admin-form-grid]');
            const topics=['edit','create'].map(mode=>{const panel=root('consistency-topic-'+mode).querySelector('[data-content-basic-panel]');const grids=[...panel.querySelectorAll('[data-admin-form-grid="aligned-fields"]')];return {mode,grids:grids.map(g=>({box:rect(g),fields:fields(g)})),panel:rect(panel.querySelector('section'))};});
            const taxonomy=['series','category'].map(kind=>{const f=root('consistency-'+kind),grid=f.querySelector('[data-admin-form-grid]'),toggle=f.querySelector('[data-admin-form-switch-surface]');return {kind,grid:rect(grid),fields:fields(grid),toggle:rect(toggle),switchTrack:rect(toggle?.querySelector('.relative'))};});
            const existing=root('consistency-existing-aligned').querySelector('[data-admin-form-grid="aligned-fields"]');
            return {featured,button:{grid:rect(buttonGrid),columns:getComputedStyle(buttonGrid).gridTemplateColumns,items:[...buttonGrid.children].map(c=>({box:rect(c),span:getComputedStyle(c).gridColumn})),controls:fields(buttonRoot.querySelector('[data-admin-form-grid="aligned-fields"]'))},topics,taxonomy,existing:fields(existing)};
        });
        measurements.push(row);
        if (recoveryPhase === 'consistency-after') {
            assert.equal(row.overflow, false, JSON.stringify(row));
            assert(row.families.every(f => !f.overflow), JSON.stringify(row.families.filter(f=>f.overflow)));
            const near=(a,b)=>Math.abs(a-b)<2;
            const d=row.details;
            assert(d.featured.every(f=>near(f.card.w,d.featured[0].card.w)&&near(f.card.h,d.featured[0].card.h)&&near(f.input.y-f.card.y,d.featured[0].input.y-d.featured[0].card.y)),JSON.stringify(d.featured));
            if(width>=1280){
                const [data,appearance]=d.button.items;assert(data.box.x>appearance.box.x);assert(near(data.box.y,appearance.box.y));assert(near(appearance.box.w,2*data.box.w+16),JSON.stringify(d.button));
                assert(d.button.controls.every((f,i,all)=>near(f.label.y,all[Math.floor(i/2)*2].label.y)&&near(f.control.y,all[Math.floor(i/2)*2].control.y)),JSON.stringify(d.button.controls));
                for(const t of d.topics) for(const g of t.grids){assert(g.fields.every(f=>f.control.x>=f.box.x-1&&f.control.x+f.control.w<=f.box.x+f.box.w+1),JSON.stringify(t));assert(g.fields.every(f=>near(f.control.y,g.fields[0].control.y)),JSON.stringify(t));}
                for(const t of d.taxonomy){assert(t.fields.every(f=>near(f.label.y,t.fields[0].label.y)),JSON.stringify(t));assert(near(t.fields[0].control.y,t.fields[1].control.y));}
                assert(d.existing.every(f=>near(f.control.y,d.existing[0].control.y)),JSON.stringify(d.existing));
            }
            if(width<768){assert(d.button.items[1].box.y>=d.button.items[0].box.y+d.button.items[0].box.h+8);}
            for(const t of d.taxonomy){assert(t.toggle.h<60&&t.switchTrack.h===20,JSON.stringify(t));}
            for(const t of d.topics) for(const g of t.grids) for(const f of g.fields){assert(!f.hint||f.hint.y>=f.control.y+f.control.h+6);}
        }
        if ([1440,390].includes(width)) for (const family of families) {
            const target=page.locator('[data-family="'+family+'"]');
            await target.screenshot({path:path.join(out,family+'-'+width+'.png')});
        }
        linkEvidence.push({width,fields:await inspectLinkIcons(page.locator('[data-family="consistency-button"] [data-admin-link-field]'))});
    }
    const journeys=recoveryPhase==='consistency-after'?await exerciseConsistency(page):null;
    const taxonomyCreate=recoveryPhase==='consistency-after'?await captureTaxonomyCreate(page):null;
    const taxonomyPanelJourneys=recoveryPhase==='consistency-after'?await exerciseTaxonomyPanels(page):null;
    assert.deepEqual(errors, []);
    assert.deepEqual(await fingerprintTaxonomySources(),taxonomySourceHashes,'Taxonomy source must remain stable throughout the existing fixture run');
    await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',phase:recoveryPhase,sourceHashes:taxonomySourceHashes,measurements,journeys,taxonomyCreate,taxonomyPanelJourneys,linkEvidence,errors,hostedDatabaseWrites:0,productionMutations:0,scope:'Actual FeaturedModuleEditClient, AboutIntroModuleEditor CTA, ContentBasicDataPanel with real AdminFormRuntime, SeriesForm and CategoryForm; current CSS; isolated link/media/taxonomy transports, canonical taxonomy schema and disposable localStorage read-back; no live Admin, native Server Action, Auth, SQL or DB persistence proof'},null,2));
    console.log('PASS '+recoveryPhase+' actual-component visual capture');
}

async function settingsPaint(page, family = 'settings-family') {
    return page.locator('[data-family="'+family+'"]').evaluate(root=>{
        const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
        const text=e=>{const s=getComputedStyle(e);return{size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,inset:s.paddingInlineStart};};
        const headers=[...root.querySelectorAll('[data-admin-tab-section-heading]')].filter(e=>e.getBoundingClientRect().width).map(e=>({id:e.dataset.adminTabSectionHeading,presentation:e.dataset.adminTabSectionPresentation,box:box(e),padding:getComputedStyle(e).padding,charcoal:getComputedStyle(e).getPropertyValue('--admin-section-header-surface').trim(),glyphs:[...e.querySelectorAll('svg')].map(box),card:{...box(e.parentElement),padding:getComputedStyle(e.parentElement).padding}}));
        const labels=[...root.querySelectorAll('[data-admin-form-label-text],[id^="integration-asset-"][id$="-label"]')].filter(e=>e.getBoundingClientRect().width).map(e=>({label:e.textContent.trim(),paint:text(e)}));
        const forms=[...root.querySelectorAll('form')].filter(e=>e.getBoundingClientRect().width).map(e=>({entity:e.dataset.adminFormEntity??'specialized',fields:[...e.querySelectorAll('input,textarea,select')].map(input=>({name:input.name,type:input.type,required:input.required,disabled:input.disabled,readOnly:input.readOnly,...(input.type==='password'?{masked:true,hasValue:!!input.value}:{value:input.value,checked:'checked'in input?input.checked:undefined})})),actions:[...e.querySelectorAll('button[type="submit"],[data-admin-form-action]')].map(button=>({type:button.type,action:button.dataset.adminFormAction??null,label:button.textContent.trim(),disabled:button.disabled}))}));
        const stacks=[...root.querySelectorAll('.space-y-5')].filter(e=>e.getBoundingClientRect().width).map(e=>{const children=[...e.children].filter(c=>getComputedStyle(c).display!=='none'&&getComputedStyle(c).display!=='contents'&&c.getBoundingClientRect().height>1);return{tag:e.tagName,classes:e.className,gaps:children.slice(1).map((child,index)=>box(child).y-box(children[index]).y-box(children[index]).h)};});
        return{direction:getComputedStyle(root).direction,overflow:root.scrollWidth>root.clientWidth+1,headers,labels,forms,stacks,tabs:[...root.querySelectorAll('[data-admin-tab-id]')].map(e=>e.dataset.adminTabId),feedback:[...root.querySelectorAll('[data-admin-feedback-entry]')].map(e=>({channel:e.dataset.adminFeedbackChannel,variant:e.dataset.adminFeedbackVariant})),scrollContext:'controlled native root; no live route proof'};
    });
}

async function runMetaManager(page){
    const priorPath=path.join(settingsEvidenceRoot,'final-layout/fixture-attempt01/receipt.json'),prior=JSON.parse(await readFile(priorPath,'utf8')),historical=JSON.parse(await readFile(path.join(settingsEvidenceRoot,'fixture-after-attempt07/receipt.json'),'utf8')).settingsProgress,changedOwner='src/components/admin/ui/AdminFormListboxSelect.tsx',ownerProof=JSON.parse(await readFile(path.join(metaEvidenceRoot,'owner-port-default-preservation.json'),'utf8'));assert.equal(prior.status,'PASS');assert.equal(ownerProof.status,'PASS');assert.equal(ownerProof.onlyOptionalPortChange,true);assert.equal(ownerProof.sha256,createHash('sha256').update(await readFile(path.join(root,changedOwner))).digest('hex'));assert.equal(createHash('sha256').update(await readFile(path.join(metaEvidenceRoot,'before',changedOwner))).digest('hex'),prior.sourceHashes[changedOwner]);
    const referenceBindings={};for(const file of taxonomySourceFiles.filter(file=>file.startsWith('src/')&&!file.endsWith('adoption-manifest.ts')&&file!==changedOwner)){const hash=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');assert.equal(hash,prior.sourceHashes[file],'Reference dependency changed: '+file);referenceBindings[file]=hash;}for(const reference of historical.references)taxonomyPresentationReference.set(reference.width>=768?'desktop':'mobile',reference);
    const files=[...new Set([...taxonomySourceFiles,'src/app/admin/seo/meta-manager/MetaManagerClient.tsx','src/app/admin/seo/meta-manager/page.tsx','src/app/admin/seo/meta-manager/actions.ts','src/lib/seo/global-seo-types.ts','src/lib/seo/global-seo-defaults.ts','src/lib/seo/global-seo-environment.ts','src/lib/seo/parse-global-seo.ts','src/components/admin/media/AdminMediaImageField.tsx','src/components/admin/media/AdminDeletedMediaNotice.tsx','src/components/admin/ui/AdminPageHeader.tsx','src/components/admin/ui/AdminPageContextHeader.tsx'])],fingerprint=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')]))),sourceHashes=await fingerprint(),matrix=[],journeys=[];
    const mediaOwnerProof=JSON.parse(await readFile(path.join(metaEvidenceRoot,'media-owner-default-preservation.json'),'utf8')),mediaRawProof=JSON.parse(await readFile(path.join(metaEvidenceRoot,'media-url-raw-preservation.json'),'utf8'));assert.equal(mediaOwnerProof.status,'PASS');assert.equal(mediaRawProof.status,'PASS');assert.equal(mediaOwnerProof.afterSha256,sourceHashes['src/components/admin/media/AdminMediaImageField.tsx']);assert.equal(mediaRawProof.ownerSha256,mediaOwnerProof.afterSha256);assert.equal(mediaRawProof.clientSha256,sourceHashes['src/app/admin/seo/meta-manager/MetaManagerClient.tsx']);
    settingsProgress={scope:'meta-manager',sourceHashes,matrix,journeys,parser:metaParserProof,reusedReference:{receipt:path.relative(root,priorPath),originalTopicReference:'fixture-after-attempt07/receipt.json',referenceBindings,ownerProof,gridProof:prior.reusedReference.gridProof},boundary:'Actual MetaManager component and compiled project CSS; synthetic public SEO props and deferred local Action using the actual native parser dependency closure. No live Next route, Auth, hosted save, SQL, provider or persistence proof.'};
    Object.assign(settingsProgress,{mediaOwnerProof,mediaRawProof,acceptance:{header:'Actual AdminPageHeader seo preset, icon and responsive symbol artwork',sections:'Actual canonical panels and premium charcoal headers',layout:'Existing shared Grid and Tabs; no parallel layout',spacing:'Natural20px edge and reserved20px in genuinely pinned controlled root',actionsBar:'Standalone canonical Actions identity compared with actual Topic',actionsBehavior:'Native dirty close/cancel focus and pending/rejection only',labels:'Current Topic panel-label typography and single12px inset',hintsErrorsRequiredFocus:'Source note11px/20px contextual typography; targeted returned errors and hidden-tab focus; required N/A because blank inherits',images:'Actual shared card owner; local reference-state and picker stub only',fields:'Actual31-field native parser; optional booleans/arrays/repeated socials',tabs:'Actual four tabs and field-metadata navigation',feedback:'Actual Runtime error/pending visuals; success/warning unchanged source, not replayed',dataGridToolbar:'Not Applicable: singleton global SEO form',responsiveRTL:'Desktop1440 and Mobile390',ownership:'Source/default/native proof plus isolated actual component',regression:'Focused structural positives/negatives; original before rejected; live approval remains Pending'}});
    const form=page.locator('form[data-admin-form-entity="global-seo-settings"]'),tab=id=>form.locator('[data-admin-tab-id="'+id+'"]'),setTransport=(field,hold=false)=>page.evaluate(({field,hold})=>{window.metaTransport??={calls:[]};Object.assign(window.metaTransport,{field,hold});},{field,hold}),count=()=>page.evaluate(()=>window.metaTransport?.calls.length??0);
    const natural=async(width)=>{for(let n=0;n<4;n++){const height=await page.locator('[data-family="meta-manager"]').evaluate(e=>Math.ceil(e.scrollHeight+128));assert(height<30000);await page.setViewportSize({width,height:Math.max(1600,height)});await scrollTaxonomyFixture(page,0);if(await page.locator('[data-family="meta-manager"]').evaluate(e=>e.scrollHeight+32<=innerHeight))return;}throw Error('MetaManager normal-flow viewport did not settle');};
    for(const width of [1440,390]){
        await page.setViewportSize({width,height:1600});await page.goto('http://127.0.0.1:48199/?scope=meta-manager');await form.waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('form').count(),1);await expect(page.locator('[data-admin-page-header-visual-preset="seo"]')).toHaveCount(1);await expect(page.locator('[data-admin-header-icon="seo"]')).toBeVisible();const artwork=page.locator('[data-admin-header-artwork="symbol"][data-admin-header-artwork-symbol="seo"]');await expect(artwork).toHaveCount(1);if(width>=640)await expect(artwork).toBeVisible();else await expect(artwork).toBeHidden();await expect(page.locator('[data-admin-page-header-title]')).toHaveText('Meta Manager');
        for(const id of ['defaults','identity','crawl','preview']){
            await tab(id).click();await natural(width);const paint=await settingsPaint(page,'meta-manager'),normal=await measureTaxonomySpacing(form),reference=taxonomyPresentationReference.get(width>=768?'desktop':'mobile');assert.equal(paint.direction,'rtl');assert.equal(paint.overflow,false);assert.equal(paint.headers.length,1);assert.equal(paint.headers[0].id,'global-seo-'+id);assert.equal(paint.headers[0].presentation,'premium');assert.equal(paint.headers[0].charcoal,'rgba(8,13,22,0.82)');assert.equal(normal.preActionsGap,20);assert.equal(normal.previousMarginEnd,'20px');assert.equal(normal.stack.tag,'DIV');assert.equal(normal.stack.runtimeToken,false);assert.equal(normal.stack.insidePendingFields,true);for(const label of paint.labels)for(const key of ['size','weight','lineHeight','color','inset'])assert.equal(label.paint[key],reference.label[key]);
            const roles=await form.evaluate(root=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};},bar=root.querySelector('[data-admin-form-action="save"]').closest('.sticky'),notes=[...root.querySelectorAll('[data-seo-effective-source]')].filter(e=>e.getBoundingClientRect().width);return{requiredMarkers:[...root.querySelectorAll('[data-admin-form-label-text]')].filter(e=>e.getBoundingClientRect().width&&e.querySelector('.text-red-400')).length,requiredInputs:root.querySelectorAll('input[required],textarea[required],select[required]').length,insidePanel:[...root.querySelectorAll('[data-admin-tab-section-heading]')].some(header=>header.parentElement.contains(bar)),nativeFormOwner:[...bar.querySelectorAll('button')].every(e=>e.form===root),actions:box(bar),notes:notes.map(e=>{const style=getComputedStyle(e);return{id:e.id,tag:e.tagName,source:e.dataset.seoEffectiveSource,context:e.closest('label')?'label':'standalone',size:style.fontSize,lineHeight:style.lineHeight,weight:style.fontWeight,color:style.color,inset:style.paddingInlineStart,display:style.display};})};});assert.equal(roles.requiredMarkers,0);assert.equal(roles.requiredInputs,0);assert.equal(roles.insidePanel,false);assert(roles.nativeFormOwner);for(const note of roles.notes){const expected=reference.hints[note.context];assert.equal(note.tag,'SPAN');for(const key of ['size','lineHeight','weight','color','inset'])assert.equal(note[key],expected[key],'Source note uses its current canonical contextual hint '+key);assert.equal(note.display,'block');}
            if(id==='defaults'){for(const field of ['defaultRobotsIndex','defaultRobotsFollow']){await expect(form.locator('#'+field)).toHaveAttribute('aria-describedby',field+'-source-note');await expect(form.locator('#'+field+'-source-note')).toBeVisible();}await expect(form.locator('[name="site_name"]')).toHaveValue('');await expect(form.locator('[name="site_name"]')).toHaveAttribute('placeholder','اسم بيئة محلية');await expect(form.locator('[name="default_title"]')).toHaveValue('عنوان محفوظ محليًا');}if(id==='preview')assert.equal(await form.locator('[role="tabpanel"]:visible input,[role="tabpanel"]:visible textarea,[role="tabpanel"]:visible select').count(),0);
            const ownerPaint=await taxonomyRolePaint(form,'global-seo-'+id);const {descriptionCount,...actionIdentity}=ownerPaint.actions.identity,{descriptionCount:referenceDescriptionCount,...referenceIdentity}=reference.paint.actions.identity;assert.equal(descriptionCount,1,'Meta retains its existing optional Actions description');assert.equal(referenceDescriptionCount,0,'Reused Topic reference omits the optional Actions description');assert.deepEqual(actionIdentity,referenceIdentity,'Meta Actions retain actual Topic icon frame/glyph/divider/title typography');assert.deepEqual(ownerPaint.actions.surface,reference.paint.actions.surface);assert(ownerPaint.actions.outside&&ownerPaint.actions.after);assert.deepEqual(ownerPaint.actions.buttons.map(row=>[row.action,row.type]),[['save','submit'],['close','button']]);const prefix=id+'-'+width,normalShot=prefix+'-normal.png';await form.screenshot({path:path.join(out,normalShot)});const height=Math.max(210,Math.ceil(normal.form.h-60));await page.setViewportSize({width,height});const samples=[];for(const scroll of [0,normal.form.y,Math.max(0,normal.form.y+normal.form.h-height-30)]){await scrollTaxonomyFixture(page,scroll);samples.push(await measureTaxonomySpacing(form));}const sticky=samples.find(row=>Math.abs(row.sticky.viewportBottomGap-20)<1&&row.preActionsGap<19.5&&row.visible.every(e=>e.visible&&e.hit));assert(sticky,'MetaManager Actions require a genuinely pinned controlled state');assert.equal(sticky.previousMarginEnd,'20px');await scrollTaxonomyFixture(page,sticky.scrollY);const stickyShot=prefix+'-sticky.png';await page.screenshot({path:path.join(out,stickyShot)});matrix.push({id,width,normal,paint,roles,ownerPaint,sticky,normalShot,stickyShot});
        }
        await tab('defaults').click();await natural(width);await expect(form.locator('select[name="default_robots_index"]')).toHaveValue('false');await expect(form.locator('select[name="default_robots_follow"]')).toHaveValue('inherit');await form.locator('[name="site_name"]').fill('اسم محلي معدّل');await form.locator('[name="default_title"]').fill('عنوان غير محفوظ');await expect(form).toHaveAttribute('data-admin-form-dirty','true');await form.locator('[data-admin-form-action="close"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();await expect(form.locator('[data-admin-form-action="close"]')).toBeFocused();
        for(const [field,name,value] of [['defaultRobotsIndex','default_robots_index','inherit'],['defaultRobotsFollow','default_robots_follow','false']]){const label=await form.locator('select[name="'+name+'"] option[value="'+value+'"]').textContent();await form.locator('#'+field).press('Enter');await page.getByRole('option',{name:label,exact:true}).click();await expect(form.locator('select[name="'+name+'"]').first()).toHaveValue(value);}
        const imageCases=await form.locator('[data-admin-media-image-field]').evaluateAll(owners=>owners.map(owner=>{const input=owner.querySelector('input[name]'),panel=owner.closest('[role="tabpanel"]'),tab=[...owner.closest('form').querySelectorAll('[role="tab"]')].find(tab=>tab.getAttribute('aria-controls')===panel.id);return{field:input.id,name:input.name,tab:tab.dataset.adminTabId,initialValue:input.value,placeholder:input.placeholder};}));assert.equal(imageCases.length,3);const images=[];
        for(const item of imageCases){await tab(item.tab).click();await natural(width);const owner=form.locator('[data-admin-media-image-field="'+item.name+'"]'),input=owner.locator('[name="'+item.name+'"]');await expect(input).toHaveCount(1);await expect(input).toHaveAttribute('type','text');await expect(input).toHaveAttribute('dir','ltr');await expect(input).toHaveAttribute('aria-describedby',item.field+'-source-note');assert.equal(await owner.locator('input,textarea,select').count(),1);await input.fill('https://');await expect(input).toHaveValue('https://');await expect(owner.getByText('أدخل مسار صورة أو رابطًا كاملًا للمعاينة',{exact:true})).toBeVisible();await expect(owner.locator('img')).toHaveCount(0);const external='https://local.example.test/seo.png';await input.fill(external);await expect(owner.locator('img')).toHaveAttribute('src',external);await expect(owner.locator('[data-media-original]')).toContainText(/400\s*×\s*600/u);await owner.locator('[data-admin-media-image-preview-trigger]').click();const preview=page.getByRole('dialog');await expect(preview).toBeVisible();await expect(preview.locator('img')).toHaveAttribute('src',external);await preview.getByRole('button',{name:'إغلاق',exact:true}).click();await owner.getByRole('button',{name:'استبدال',exact:true}).click();await page.getByRole('button',{name:'Select fixture media',exact:true}).click();await expect(input).toHaveValue('/wide.png');await owner.getByRole('button',{name:'إزالة',exact:true}).click();await expect(input).toHaveValue('');await expect(owner.locator('[data-admin-media-image-card="add"]')).toBeVisible();images.push({...item,singleNativeValue:true,partialDraftRetained:true,completeExternalPreview:true,expandedPreview:true,pickerSelection:'local stub only',replaceAndRemove:true,clearMeansInheritance:true});}
        await tab('identity').click();await form.locator('#organizationKnowsAbout').fill('  موضوع أول \nموضوع ثان,موضوع أول  ');await form.locator('[name="social_label"]').first().fill('منصة معدلة');await form.locator('[name="social_href"]').first().fill('https://local.example.test/changed');await tab('crawl').click();await form.locator('#robotsTxtAllow').fill('/one/\n/two/,/one/');await tab('preview').click();await expect(form.locator('[role="tabpanel"]:visible h3')).toHaveText('عنوان محفوظ محليًا');
        await tab('defaults').click();await natural(width);await setTransport('siteName',true);const before=await count();await form.locator('[data-admin-form-action="save"]').click();await expect(form.locator('[data-admin-form-action="save"]')).toBeDisabled();await expect.poll(count).toBe(before+1);assert(await form.evaluate(root=>[...root.querySelectorAll('input,textarea,select')].every(e=>e.matches(':disabled'))));await form.locator('[data-admin-form-action="save"]').evaluate(e=>e.click());assert.equal(await count(),before+1);const pendingShot='pending-'+width+'.png';await form.screenshot({path:path.join(out,pendingShot)});await page.evaluate(()=>{const qa=window.metaTransport;qa.hold=false;qa.release?.();delete qa.release;});await expect(form.locator('[data-admin-form-action="save"]')).toBeEnabled();await expect(form.locator('#siteName')).toBeFocused();await expect(form.locator('#siteName')).toHaveValue('اسم محلي معدّل');
        const captured=await page.evaluate(()=>window.metaTransport.calls.at(-1));assert.equal(captured.inherit.index,true);assert.equal(captured.payload.defaultRobotsFollow,false);assert.equal(captured.payload.defaultDescription,undefined);for(const item of images)assert.equal(captured.payload[item.field],undefined,'Cleared native image URL inherits instead of silently persisting Effective');assert.deepEqual(captured.payload.organizationKnowsAbout,['موضوع أول','موضوع ثان']);assert.deepEqual(captured.payload.robotsTxtAllow,['/one/','/two/']);assert.deepEqual(captured.payload.organizationSocialLinks,[{label:'منصة معدلة',href:'https://local.example.test/changed'},{label:'منصة ثانية',href:'https://local.example.test/second'}]);
        const focus=[];for(const [field,id] of [['siteName','defaults'],['organizationName','identity'],['siteUrl','crawl'],['organizationKnowsAbout','identity'],['robotsTxtAllow','crawl'],['organizationSocialLinks','identity'],['defaultRobotsIndex','defaults'],...imageCases.map(item=>[item.field,item.tab])]){await tab('preview').click();await setTransport(field);await form.locator('[data-admin-form-action="save"]').click();await expect(tab(id)).toHaveAttribute('aria-selected','true');const target=form.locator('#'+field);await expect(target).toBeFocused();await expect(target).toHaveAttribute('aria-invalid','true');if(field==='organizationSocialLinks')await expect(form.locator('[role="group"][aria-labelledby="organization-social-links-heading"]')).toHaveAttribute('aria-describedby',field+'-source-note '+field+'-error');const described=(await target.getAttribute('aria-describedby')).split(' ');assert(described.includes(field+'-source-note'));assert(described.includes(field+(field==='defaultRobotsIndex'?'-status':'-error')));await expect(form.locator('#'+field+'-source-note')).toBeVisible();focus.push({field,tab:id,focus:true,described});if(['organizationSocialLinks','defaultRobotsIndex','defaultOgImage'].includes(field)){await natural(width);await form.screenshot({path:path.join(out,'error-'+field+'-'+width+'.png')});}}
        journeys.push({width,dirtyCloseCancelFocus:true,nativeBooleanInheritance:true,images,actualParserPayload:captured,pendingNativeLock:true,duplicateBlocked:true,rejectedValuesRetained:true,effectivePreviewUnchanged:true,focus,pendingShot,transport:'deferred local rejection only; no save owner/Auth/SQL/provider executed'});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(await fingerprint(),sourceHashes,'MetaManager inputs stay frozen throughout the isolated run');await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',...settingsProgress,hostedDatabaseWrites:0,productionMutations:0,liveStatus:'OWNER_FUNCTIONAL_VISUAL_REVIEW_PENDING',globalClosed:false},null,2));console.log('PASS MetaManager four-tab Desktop/Mobile RTL presentation, controlled Sticky, truthful inheritance/native parser and local dirty/error/pending/focus workflows');
}

async function runSettingsLayoutRefinement(page) {
    const priorPath=path.join(settingsEvidenceRoot,'fixture-layout-refinement-attempt02/receipt.json'),prior=JSON.parse(await readFile(priorPath,'utf8')),historical=JSON.parse(await readFile(path.join(settingsEvidenceRoot,'fixture-after-attempt07/receipt.json'),'utf8')).settingsProgress;
    assert.equal(prior.status,'PASS');assert.equal(historical.references.length,2);
    const proofLog=await readFile(path.join(settingsEvidenceRoot,'final-layout/grid-guard.log'),'utf8'),proofLine=proofLog.split(/\r?\n/).find(line=>line.startsWith('EVIDENCE '));assert(proofLine);const gridProof=JSON.parse(proofLine.slice(9)),runtimeFile='src/components/admin/ui/AdminFormRuntime.tsx',runtimeHash=createHash('sha256').update(await readFile(path.join(root,runtimeFile))).digest('hex');assert.equal(gridProof.currentSha256,runtimeHash);assert.equal(gridProof.baselineSha256,prior.sourceHashes[runtimeFile]);
    const referenceBindings={};for(const file of taxonomySourceFiles.filter(file=>file.startsWith('src/')&&!file.endsWith('adoption-manifest.ts')&&file!==runtimeFile)){const hash=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');assert.equal(hash,historical.sourceHashes[file],'Reference dependency changed: '+file);referenceBindings[file]=hash;}
    for(const reference of historical.references)taxonomyPresentationReference.set(reference.width>=768?'desktop':'mobile',reference);
    const files=[...new Set([...taxonomySourceFiles,'src/app/admin/settings/general/CompanyIdentityPanel.tsx','src/app/admin/settings/security/SecuritySettingsClient.tsx'])],fingerprint=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')]))),sourceHashes=await fingerprint(),matrix=[];
    settingsProgress={scope:'settings-final-layout',sourceHashes,matrix,reusedReference:{receipt:path.relative(root,priorPath),originalReference:'fixture-after-attempt07/receipt.json',referenceBindings,priorGridProof:prior.reusedReference.gridProof,gridProof},boundary:'Only final General/password/account/Sessions presentation. Native business journeys and unaffected family cases are not rerun; incomplete family Mobile/live coverage remains Pending.'};
    const settleNatural=async(width)=>{for(let attempt=0;attempt<4;attempt++){const height=await page.locator('[data-family="settings-family"]').evaluate(e=>Math.ceil(e.scrollHeight+128));assert(height<30000);await page.setViewportSize({width,height:Math.max(1600,height)});await scrollTaxonomyFixture(page,0);if(await page.locator('[data-family="settings-family"]').evaluate(e=>e.scrollHeight+32<=innerHeight))return;}throw Error('Natural-flow viewport did not settle');};
    for(const width of [1440,390])for(const kind of ['general','password','account','sessions']){
        const surface=kind==='general'?'general':'security';await page.setViewportSize({width,height:1600});await page.goto('http://127.0.0.1:48199/?scope=settings-family&surface='+surface);await page.locator('[data-settings-surface="'+surface+'"]').waitFor();await page.evaluate(()=>document.fonts.ready);if(surface==='security')await page.locator('[data-admin-tab-id="'+kind+'"]').click();await settleNatural(width);
        const actionSelector=kind==='sessions'?'button[type="submit"]':'[data-admin-form-action="save"]';const form=kind==='general'?page.locator('form[data-admin-form-entity="admin-company-identity"]'):page.locator('form:visible'),normal=await measureTaxonomySpacing(form,actionSelector),paint=await settingsPaint(page);assert.equal(normal.preActionsGap,20);assert.equal(normal.previousMarginEnd,'20px');assert.equal(paint.overflow,false);for(const header of paint.headers){assert.equal(header.presentation,'premium');assert.equal(header.charcoal,'rgba(8,13,22,0.82)');}for(const label of paint.labels)for(const key of ['size','weight','lineHeight','color','inset'])assert.equal(label.paint[key],taxonomyPresentationReference.get(width>=768?'desktop':'mobile').label[key]);
        const layout=await form.evaluate((root,kind)=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};},save=root.querySelector(kind==='sessions'?'button[type="submit"]':'[data-admin-form-action="save"]'),bar=save.closest('.sticky'),common={direction:getComputedStyle(root).direction,nativeFormOwner:save.form===root&&[...root.querySelectorAll('input')].every(input=>input.form===root),barWidth:box(bar).w,formWidth:box(root).w,actionsTitle:bar.querySelector('[data-admin-form-control-header]').textContent.trim(),closeActions:bar.querySelectorAll('[data-admin-form-action="close"]').length};if(kind==='sessions'){const panel=root.querySelector('[data-admin-tab-section-heading="security-revoke-sessions"]').parentElement;return{...common,panel:box(panel),directSibling:panel.nextElementSibling===bar,barOutsidePanel:!panel.contains(bar),genericSaveActions:root.querySelectorAll('[data-admin-form-action="save"]').length,commandLabel:save.textContent.trim(),fields:root.querySelectorAll('input[type="password"]').length};}const ratio=root.querySelector('[data-admin-form-grid="equal-height-columns"]'),columns=[...ratio.children],base={...common,ratio:box(ratio),columns:columns.map(box),gap:getComputedStyle(ratio).gap,alignItems:getComputedStyle(ratio).alignItems,barOutsideGrid:!ratio.contains(bar),directSibling:ratio.nextElementSibling===bar};
            if(kind==='general'){const identity=root.querySelector('[data-admin-tab-section-heading="company-identity"]').parentElement,colors=root.querySelector('[data-admin-tab-section-heading="company-colors"]').parentElement,fields=[...identity.querySelectorAll('input:not([type="hidden"])')],logos=[...columns[1].querySelectorAll('[data-admin-media-image-field]')],cards=logos.map(e=>e.closest('section')),tabOrder=[...root.querySelectorAll('input:not([type="hidden"]),button,select,[tabindex]')].filter(e=>e.getBoundingClientRect().width&&e.tabIndex>=0&&!e.disabled).map(e=>e.name||e.id||e.getAttribute('aria-label'));return{...base,identity:box(identity),colors:box(colors),panelGap:box(colors).y-box(identity).y-box(identity).h,fields:fields.map(e=>({name:e.name,...box(e)})),logos:logos.map(e=>({name:e.dataset.adminMediaImageField,...box(e)})),cards:cards.map(box),panelsInRightColumn:columns[0].contains(identity)&&columns[0].contains(colors),logosInLeftColumn:logos.length===2&&logos.every(e=>columns[1].contains(e)),tabOrder};}
            const panel=root.querySelector('[data-admin-tab-section-heading="security-'+kind+'"]').parentElement,empty=columns[1],card=empty.firstElementChild,fields=[...panel.querySelectorAll('input')];return{...base,panel:box(panel),barOutsidePanel:!panel.contains(bar),empty:{...box(empty),display:getComputedStyle(empty).display,ariaHidden:empty.getAttribute('aria-hidden'),text:empty.textContent.trim(),focusable:empty.querySelectorAll('button,input,a,[tabindex]').length,card:box(card)},fields:fields.map(e=>({type:e.type,...box(e)})),expectedFields:kind==='password'?3:2};
        },kind);
        assert.equal(layout.direction,'rtl');assert(layout.directSibling&&layout.nativeFormOwner);if(kind!=='sessions'){assert.equal(layout.gap,'16px');assert.equal(layout.alignItems,'stretch');assert(layout.barOutsideGrid);}assert.equal(layout.barWidth,layout.formWidth);assert(layout.actionsTitle.includes('إجراءات النموذج'));
        if(kind!=='sessions'&&width>=768){assert(Math.abs(layout.columns[0].w/(layout.columns[0].w+layout.columns[1].w)-0.6)<0.001);assert(layout.columns[0].x>layout.columns[1].x);assert(Math.abs(layout.columns[0].y-layout.columns[1].y)<1);assert(Math.abs(layout.columns[0].h-layout.columns[1].h)<1);}else if(kind==='general'){assert(Math.abs(layout.columns[0].w-layout.columns[1].w)<1);assert(layout.columns[1].y>=layout.columns[0].y+layout.columns[0].h+15.5);}
        if(kind==='general'){assert(layout.panelsInRightColumn&&layout.logosInLeftColumn);assert.equal(layout.panelGap,20);assert.deepEqual(layout.fields.map(e=>e.name),['key','name','adminLabel','cmsLabel','publicWebsiteUrl']);assert.deepEqual(layout.logos.map(e=>e.name),['logoUrl','compactLogoUrl']);assert(layout.fields.every(e=>Math.abs(e.x-layout.fields[0].x)<1));assert(layout.fields.slice(1).every((e,index)=>e.y>=layout.fields[index].y+layout.fields[index].h));assert.equal(layout.cards[1].y-layout.cards[0].y-layout.cards[0].h,20);assert.deepEqual(layout.tabOrder.slice(0,5),layout.fields.map(e=>e.name));assert(layout.tabOrder.indexOf('logoUrl')>=5&&layout.tabOrder.indexOf('compactLogoUrl')>layout.tabOrder.indexOf('logoUrl'));assert.equal(layout.closeActions,1);}else if(kind==='sessions'){assert(layout.barOutsidePanel);assert.equal(layout.genericSaveActions,0);assert.equal(layout.commandLabel,'إلغاء جميع الجلسات');assert.equal(layout.fields,1);assert.equal(layout.closeActions,0);}else{assert(layout.barOutsidePanel);assert.equal(layout.fields.length,layout.expectedFields);assert(layout.fields.every(e=>Math.abs(e.x-layout.fields[0].x)<1));assert(layout.fields.slice(1).every((e,index)=>e.y>=layout.fields[index].y+layout.fields[index].h));assert.equal(layout.closeActions,0);assert.equal(layout.empty.ariaHidden,'true');assert.equal(layout.empty.text,'');assert.equal(layout.empty.focusable,0);if(width<768){assert.equal(layout.empty.display,'none');assert.equal(layout.empty.w,0);assert.equal(layout.empty.h,0);assert(Math.abs(layout.ratio.h-layout.columns[0].h)<1);}else{assert.equal(layout.empty.display,'grid');assert(Math.abs(layout.empty.card.h-layout.panel.h)<1);}}
        const prefix=kind+'-'+width,normalShot=prefix+'-normal.png';await form.screenshot({path:path.join(out,normalShot)});await page.setViewportSize({width,height:Math.max(210,Math.ceil(normal.form.h-60))});const candidates=[];for(const scroll of [0,normal.form.y,Math.max(0,normal.form.y+normal.form.h-Math.max(210,Math.ceil(normal.form.h-60))-30)]){await scrollTaxonomyFixture(page,scroll);candidates.push(await measureTaxonomySpacing(form,actionSelector));}const sticky=candidates.find(row=>Math.abs(row.sticky.viewportBottomGap-20)<1&&row.preActionsGap<19.5&&row.visible.every(e=>e.visible&&e.hit));assert(sticky,'A genuine controlled Sticky state with hit-testable native actions is required');assert.equal(sticky.previousMarginEnd,'20px');await scrollTaxonomyFixture(page,sticky.scrollY);const stickyShot=prefix+'-sticky.png';await page.screenshot({path:path.join(out,stickyShot)});matrix.push({kind,width,normal,paint,layout,sticky,normalShot,stickyShot});
        if(kind==='sessions'&&width===1440){try{await form.locator('input[type="password"]').fill('local-private-value');}catch{throw Error('A masked local Sessions interaction failed; its value is excluded from diagnostics.');}const trigger=form.locator('button[type="submit"]');await trigger.click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();await expect(trigger).toBeFocused();assert.equal(await page.evaluate(()=>window.settingsTransport?.calls.length??0),0);matrix.at(-1).confirmation={openCancelFocus:true,commandExecutions:0,privateValuesRecorded:false};}

    }
    assert.deepEqual(errors,[]);assert.deepEqual(await fingerprint(),sourceHashes);await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',...settingsProgress,hostedDatabaseWrites:0,productionMutations:0,businessJourneysRerun:false,liveStatus:'OWNER_FUNCTIONAL_VISUAL_REVIEW_PENDING',globalClosed:false},null,2));console.log('PASS final General/password/account/Sessions presentation: Desktop/Mobile RTL,60/40 equal-height, responsive empty panels and standalone20px save/command Actions with controlled Sticky');
}

async function runSettingsFamily(page) {
    const sourceFiles=[...new Set([...taxonomySourceFiles,...['general/CompanyIdentityPanel','general/MaintenanceModePanel','security/SecuritySettingsClient','media/MediaSettingsPanel','media/MediaRecoveryCenter'].map(name=>'src/app/admin/settings/'+name+'.tsx'),'src/components/admin/integrations/AdminIntegrationsPlatform.tsx','src/components/admin/integrations/IntegrationConnectionWizard.tsx','src/components/admin/integrations/IntegrationsServerConfiguration.tsx','src/components/admin/AdminPlaceholderPage.tsx','src/components/admin/ui/AdminMetricCard.tsx','src/components/admin/ui/AdminMetricCardsGrid.tsx'])];
    const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fixtureSource(path.join(root,file))).digest('hex')])));
    const sourceHashes=await hashes(),references=await captureTaxonomyReference(page),matrix=[],journeys=[];
    settingsProgress={scope:'settings-family',sourceHashes,references,matrix,journeys,boundary:'Partial completed isolated cases only; an incomplete attempt remains FAIL and cannot imply live or family completion.'};
    const surfaces=['general','security','media','integrations','connection','server-configuration','theme','appearance'];
    const navigate=async(surface,state)=>{await page.goto('http://127.0.0.1:48199/?scope=settings-family&surface='+surface+(state?'&state='+state:''));await page.locator('[data-settings-surface="'+surface+'"]').waitFor();await page.evaluate(()=>document.fonts.ready);await scrollTaxonomyFixture(page,0);};
    const saveShot=async(name)=>{await page.locator('[data-family="settings-family"]').screenshot({path:path.join(out,name+'.png')});return name+'.png';};
    const panelShots=async(prefix)=>{
        const descriptors=await page.locator('[data-family="settings-family"]').evaluate(root=>{for(const node of root.querySelectorAll('[data-settings-qa-panel]'))node.removeAttribute('data-settings-qa-panel');const nodes=[...new Set([...root.querySelectorAll('form,article'),...[...root.querySelectorAll('[data-admin-tab-section-heading]')].map(header=>header.parentElement)])].filter(e=>e.getBoundingClientRect().width>0);return nodes.map((node,index)=>{node.dataset.settingsQaPanel=String(index);return{index,role:node.dataset.adminFormEntity??node.querySelector('[data-admin-tab-section-heading]')?.dataset.adminTabSectionHeading??node.tagName};});});
        for(const row of descriptors){row.screenshot=prefix+'-panel-'+row.index+'.png';await page.locator('[data-settings-qa-panel="'+row.index+'"]').screenshot({path:path.join(out,row.screenshot)});}
        await scrollTaxonomyFixture(page,'end');const bottom=prefix+'-bottom.png';await page.screenshot({path:path.join(out,bottom)});await scrollTaxonomyFixture(page,0);return{panels:descriptors,bottom};
    };
    const transport=async(behavior,hold=false)=>page.evaluate(({behavior,hold})=>{window.settingsTransport??={calls:[]};Object.assign(window.settingsTransport,{behavior,hold});},{behavior,hold});
    const release=async()=>page.evaluate(()=>{const qa=window.settingsTransport;qa.hold=false;qa.release?.();delete qa.release;});
    const callCount=()=>page.evaluate(()=>window.settingsTransport?.calls.length??0);
    const fillPrivate=async(field,value)=>{try{await field.fill(value);}catch{throw new Error('A synthetic private-field interaction failed; its value is excluded from diagnostic output.');}};
    for(const width of [1440,390]){
        await page.setViewportSize({width,height:1600});
        for(const surface of surfaces){
            await navigate(surface);if(surface==='media')await page.getByText('ملف محلي',{exact:true}).first().waitFor();
            const panels=surface==='security'?['password','account','sessions']:surface==='connection'?[null,'selection']:[null];
            for(const panel of panels){if(surface==='security')await page.locator('[data-admin-tab-id="'+panel+'"]').click();else if(panel)await navigate(surface,panel);await scrollTaxonomyFixture(page,0);const normal=await settingsPaint(page);assert.equal(normal.direction,'rtl');assert.equal(normal.overflow,false);
                if(!settingsBefore){if(!['theme','appearance'].includes(surface))assert(normal.headers.length>0,'Applicable settings sections must be visibly mounted');for(const header of normal.headers){assert.equal(header.presentation,'premium','Every adopted settings Section uses the current approved panel header: '+header.id);assert.equal(header.charcoal,'rgba(8,13,22,0.82)');}const reference=taxonomyPresentationReference.get(width>=768?'desktop':'mobile').label;for(const label of normal.labels){for(const key of ['size','weight','lineHeight','color','inset'])assert.equal(label.paint[key],reference[key],'Applicable settings field title '+key+' matches the actual Topic panel');}}
                const prefix=surface+(panel?'-'+panel:'')+'-'+width;
                matrix.push({surface,panel,width,normal,screenshot:await saveShot(prefix),panelEvidence:await panelShots(prefix),liveStatus:'OWNER_REVIEW_PENDING'});
                if(!settingsBefore&&surface==='security'&&panel!=='sessions'){
                    const form=page.locator('form:visible').filter({has:page.locator('[data-admin-form-action="save"]')});await expect(form).toHaveCount(1);assert.equal(await form.locator('[data-admin-form-action="close"]').count(),0);
                    const measure=()=>form.evaluate(root=>{const save=root.querySelector('[data-admin-form-action="save"]'),bar=save.closest('.sticky'),previous=bar.previousElementSibling,box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};},header=bar.querySelector('[data-admin-form-control-header]'),frame=header.firstElementChild,glyph=frame.querySelector('svg');return{form:box(root),bar:box(bar),previous:box(previous),gap:box(bar).y-box(previous).y-box(previous).h,reserved:getComputedStyle(previous).marginBlockEnd,position:getComputedStyle(bar).position,bottom:getComputedStyle(bar).bottom,viewportBottom:innerHeight-box(bar).y-box(bar).h,identity:{frame:[box(frame).w,box(frame).h],glyph:[box(glyph).w,box(glyph).h],divider:[box(header.children[1]).w,box(header.children[1]).h]},save:box(save),hit:document.elementFromPoint(box(save).x+box(save).w/2,box(save).y+box(save).h/2)?.closest('button')===save};});
                    const resting=await measure();assert.equal(resting.gap,20);assert(Math.abs(resting.bar.w-resting.form.w)<1,'Security Save Bar fills its native form');const reference=taxonomyPresentationReference.get(width>=768?'desktop':'mobile').paint.actions.identity;assert.deepEqual(resting.identity.frame,reference.frame);assert.deepEqual(resting.identity.glyph,reference.glyph);assert.deepEqual(resting.identity.divider,reference.divider);
                    await page.setViewportSize({width,height:Math.max(210,Math.ceil(resting.form.h-60))});await scrollTaxonomyFixture(page,resting.form.y);const sticky=await measure();assert.equal(sticky.position,'sticky');assert.equal(sticky.bottom,'20px');assert(Math.abs(sticky.viewportBottom-20)<1);assert(sticky.hit);assert.equal(sticky.reserved,'20px');const screenshot=prefix+'-sticky.png';await page.screenshot({path:path.join(out,screenshot)});matrix.at(-1).saveBar={resting,sticky,screenshot,pendingOwner:'Existing Security transition; no generic Form Runtime'};await page.setViewportSize({width,height:1600});await scrollTaxonomyFixture(page,0);
                }
            }
            if(settingsBefore||['theme','appearance'].includes(surface))continue;
            if(surface==='general'){
                const form=page.locator('form[data-admin-form-entity="admin-company-identity"]'),name=form.locator('[name="name"]');await name.fill('تغيير محلي محفوظ في الذاكرة');await expect(form).toHaveAttribute('data-admin-form-dirty','true');
                await form.locator('[data-admin-form-action="close"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();await expect(form.locator('[data-admin-form-action="close"]')).toBeFocused();
                await transport('error',true);const calls=await callCount();await form.locator('[data-admin-form-action="save"]').click();await expect(form.locator('[data-admin-form-action="save"]')).toBeDisabled();await expect(name).toBeDisabled();await form.locator('[data-admin-form-action="save"]').evaluate(e=>e.click());assert.equal(await callCount(),calls+1);await release();await expect(name).toBeEnabled();await expect(name).toBeFocused();await expect(name).toHaveValue('تغيير محلي محفوظ في الذاكرة');
                const errorShot=await saveShot('general-error-'+width);
                for(const [behavior,target] of [['logo-error','logoUrl'],['compact-logo-error','compactLogoUrl']]){await transport(behavior);await form.locator('[data-admin-form-action="save"]').click();await expect(form.locator('#'+target)).toBeFocused();await expect(form.locator('[data-admin-media-image-field="'+target+'"][role="group"]')).toHaveAttribute('aria-invalid','true');await expect(form.locator('#'+target)).toHaveAttribute('aria-describedby',target+'-error');await expect(form.locator('#'+target+'-error')).toBeVisible();}
                await transport('warning');await form.locator('[data-admin-form-action="save"]').click();await expect(form).toHaveAttribute('data-admin-form-dirty','false');
                const normal=await measureTaxonomySpacing(form);assert.equal(normal.preActionsGap,20);assert(normal.sectionGaps.every(gap=>gap===20),'Both General panels retain the actual reference rhythm');await page.setViewportSize({width,height:Math.max(250,Math.ceil(normal.form.h-80))});await scrollTaxonomyFixture(page,0);const sticky=await measureTaxonomySpacing(form);assert(Math.abs(sticky.sticky.viewportBottomGap-20)<1);assert(sticky.visible.every(row=>row.hit&&row.visible));const stickyShot='general-sticky-'+width+'.png';await page.screenshot({path:path.join(out,stickyShot)});await page.setViewportSize({width,height:1600});
                await navigate('general');const maintenance=page.getByRole('button',{name:'تشغيل الصيانة',exact:true});await maintenance.click();await page.locator('[data-admin-confirm-cancel]').click();await expect(maintenance).toBeFocused();await expect(maintenance).toHaveAttribute('aria-pressed','false');await transport('error',true);await maintenance.click();await page.locator('[data-admin-confirm-submit]').click();await expect(page.locator('[data-admin-confirm-submit]')).toBeDisabled();await release();await expect(page.locator('[data-admin-confirm-submit]')).toBeEnabled();await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="settings-general-maintenance"]')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();await transport('warning');await maintenance.click();await page.locator('[data-admin-confirm-submit]').click();await expect(page.getByRole('button',{name:'إيقاف الصيانة',exact:true})).toHaveAttribute('aria-pressed','true');
                await navigate('general','unavailable');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'الحالة غير متاحة',exact:true})).toBeDisabled();journeys.push({surface,width,dirtyCancel:true,pendingDuplicateBlocked:true,rejectedInputFocusPreserved:true,warningClean:true,maintenanceCancelFailureWarning:true,unavailableGuard:true,normalGap:normal.preActionsGap,sticky,errorShot,stickyShot});
            }else if(surface==='security'){
                await page.locator('[data-admin-tab-id="password"]').click();const form=page.locator('form:visible'),fields=form.locator('input[type="password"]');for(let n=0;n<await fields.count();n++)await fillPrivate(fields.nth(n),n===2?'different-local-value':'local-private-value');await form.locator('button[type="submit"]').click();await expect(page.locator('[data-admin-feedback-variant="danger"]')).toBeVisible();for(let n=0;n<await fields.count();n++)await fillPrivate(fields.nth(n),'local-private-value');await transport('throw',true);const passwordCalls=await callCount();await form.locator('button[type="submit"]').click();await expect(form.locator('button[type="submit"]')).toBeDisabled();for(const field of await fields.all())await expect(field).toBeDisabled();await form.locator('button[type="submit"]').evaluate(e=>e.click());assert.equal(await callCount(),passwordCalls+1);await release();await expect(form.locator('button[type="submit"]')).toBeEnabled();assert.equal((await fields.nth(1).inputValue())==='local-private-value',true,'Rejected password remains available without recording its private value');
                await transport('success');await form.locator('button[type="submit"]').click();await expect(form.locator('button[type="submit"]')).toBeEnabled();for(const field of await fields.all())await expect.poll(async()=>(await field.inputValue())==='').toBe(true);
                await page.locator('[data-admin-tab-id="account"]').click();const account=page.locator('form:visible'),accountName=account.getByPlaceholder('الاسم الكامل',{exact:true}),accountEmail=account.getByPlaceholder('البريد الإلكتروني',{exact:true});await accountName.fill('اسم محلي معدّل');await accountEmail.fill('changed@example.test');const accountCalls=await callCount();await account.locator('button[type="submit"]').click();await expect(account.getByPlaceholder('مطلوبة لتأكيد تغيير البريد',{exact:true})).toHaveAttribute('aria-invalid','true');assert.equal(await callCount(),accountCalls,'Account validation prevents transport without confirming email change');await fillPrivate(account.getByPlaceholder('مطلوبة لتأكيد تغيير البريد',{exact:true}),'local-private-value');await transport('throw',true);await account.locator('button[type="submit"]').click();await expect(account.locator('button[type="submit"]')).toBeDisabled();for(const field of await account.locator('input').all())await expect(field).toBeDisabled();await account.locator('button[type="submit"]').evaluate(e=>e.click());assert.equal(await callCount(),accountCalls+1);await release();await expect(accountName).toBeEnabled();await expect(accountEmail).toHaveValue('changed@example.test');await expect(accountName).toHaveValue('اسم محلي معدّل');await transport('success');await account.locator('button[type="submit"]').click();await expect(account.getByPlaceholder('مطلوبة لتأكيد تغيير البريد',{exact:true})).toHaveCount(0);await expect(accountEmail).toHaveValue('changed@example.test');
                await page.locator('[data-admin-tab-id="sessions"]').click();await fillPrivate(page.locator('form:visible').getByPlaceholder('كلمة المرور الحالية',{exact:true}),'local-private-value');const trigger=page.getByRole('button',{name:'إلغاء جميع الجلسات',exact:true});await trigger.click();await page.locator('[data-admin-confirm-cancel]').click();await expect(trigger).toBeFocused();await transport('throw',true);await trigger.click();await page.locator('[data-admin-confirm-submit]').click();await expect(page.locator('[data-admin-confirm-submit]')).toBeDisabled();await release();await expect(page.locator('[data-admin-confirm-submit]')).toBeEnabled();await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="settings-security"][data-admin-feedback-variant="danger"]')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();await expect(trigger).toBeFocused();journeys.push({surface,width,mismatchRejected:true,pendingSettles:true,rejectedPrivateInputRetained:true,passwordSuccessClears:true,accountValidationPendingDuplicateFailureSuccess:true,confirmationCancelFocus:true,revokePendingFailure:true,privateValuesRecorded:false});
            }else if(surface==='media'){
                const form=page.locator('form[data-admin-form-entity="media-settings"]'),input=form.locator('[name="maxImageMb"]');assert.equal(await form.locator('[data-admin-form-action="close"]').count(),0,'Media settings remain Save only');await input.fill('3');await transport('error',true);await form.locator('button[type="submit"]').click();await expect(input).toBeDisabled();await release();await expect(input).toBeEnabled();await expect(input).toHaveValue('3');await transport('warning');await form.locator('button[type="submit"]').click();await expect(form).toHaveAttribute('data-admin-form-dirty','false');
                await scrollTaxonomyFixture(page,0);const normal=await measureTaxonomySpacing(form);assert.equal(normal.preActionsGap,20);await page.setViewportSize({width,height:Math.max(250,Math.ceil(normal.form.h-80))});await scrollTaxonomyFixture(page,normal.form.y);const sticky=await measureTaxonomySpacing(form);assert(Math.abs(sticky.sticky.viewportBottomGap-20)<1);assert(sticky.visible.every(row=>row.hit&&row.visible));const stickyShot='media-sticky-'+width+'.png';await page.screenshot({path:path.join(out,stickyShot)});await page.setViewportSize({width,height:1600});await scrollTaxonomyFixture(page,0);
                const recovery=page.getByRole('button',{name:'إلغاء حجز الحذف',exact:true});await recovery.click();await page.locator('[data-admin-confirm-cancel]').click();await expect(recovery).toBeFocused();await transport('error',true);await recovery.click();await page.locator('[data-admin-confirm-submit]').click();await expect(page.locator('[data-admin-confirm-submit]')).toBeDisabled();await release();await expect(page.locator('[data-admin-confirm-submit]')).toBeEnabled();await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="media-settings-recovery"]')).toBeVisible();await page.locator('[data-admin-confirm-cancel]').click();
                await navigate('media','unavailable');await expect(page.getByRole('button',{name:'تنفيذ الفحص والمزامنة',exact:true})).toBeDisabled();journeys.push({surface,width,saveOnly:true,pendingAndFailurePreserved:true,warningClean:true,normalGap:normal.preActionsGap,sticky,stickyShot,recoveryConfirmationCancelFocus:true,recoveryPendingFailure:true,reconciliationEligibility:true});
            }else if(surface==='integrations'){
                const search=page.getByRole('combobox',{name:'البحث في التكاملات',exact:true});await search.fill('no-local-result');await expect(page.getByText('لا توجد تكاملات',{exact:false}).first()).toBeVisible();await search.fill('');journeys.push({surface,width,searchReset:true,listboxes:await page.getByRole('combobox').count()});
            }else if(surface==='connection'){
                const trigger=page.getByRole('button',{name:'فصل الاتصال',exact:true});if(await trigger.count()){await trigger.click();await page.locator('[data-admin-confirm-cancel]').click();await expect(trigger).toBeFocused();}
                const boxes=page.getByRole('combobox'),boxCount=await boxes.count();for(let index=0;index<boxCount;index++){await boxes.nth(index).press('Enter');await page.getByRole('option').last().click();}
                const selection=page.locator('[data-admin-tab-section-heading="integration-asset-selection"]').locator('..').locator('button').last();await expect(selection).toHaveText('اختبار الاتصال وبدء المزامنة');await expect(selection).toBeEnabled();await transport('error',true);const calls=await callCount();await selection.click();await expect(selection).toBeDisabled();await selection.evaluate(e=>e.click());await expect.poll(callCount).toBe(calls+1);assert.equal(await callCount(),calls+1);await release();await expect(selection).toBeEnabled();await expect(page.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first()).toBeVisible();journeys.push({surface,width,confirmationCancel:true,listboxes:boxCount,keyboardAssetSelection:true,pendingDuplicateBlocked:true,rejectedSelectionRetained:true,externalReadinessProven:false});
            }else if(surface==='server-configuration'){
                const form=page.locator('form').first(),input=form.locator('input').first();await input.fill('local-public-replacement');for(const password of await form.locator('input[type="password"]').all())await fillPrivate(password,'local-private-value');await transport('error',true);const calls=await callCount();await form.locator('button[type="submit"]').click();await expect(form.locator('button[type="submit"]')).toBeDisabled();for(const field of await form.locator('input').all())await expect(field).toBeDisabled();await form.locator('button[type="submit"]').evaluate(e=>e.click());await expect.poll(callCount).toBe(calls+1);assert.equal(await callCount(),calls+1);assert.equal(await page.evaluate(()=>window.settingsTransport.calls.at(-1).expectedVersion),1);await release();await expect(form.locator('button[type="submit"]')).toBeEnabled();await expect(page.locator('[data-admin-feedback-variant="danger"]').first()).toBeVisible();for(const password of await form.locator('input[type="password"]').all())assert.equal((await password.inputValue())==='',true,'Native Vault submit clears private fields without recording private values');journeys.push({surface,width,pendingFailureSafe:true,pendingInputsLocked:true,duplicateBlocked:true,privateValuesRecorded:false,expectedVersionRetained:true});
            }
        }
    }
    assert.deepEqual(errors,[]);if(!settingsBefore)assert.deepEqual(await hashes(),sourceHashes,'Settings family sources remain stable during the targeted run');
    await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:settingsBefore?'BASELINE_CAPTURED':'PASS',scope:'settings-family',phase:recoveryPhase,sourceHashes,snapshotSources:Object.fromEntries(settingsReadSources),references,matrix,journeys,errors,hostedDatabaseWrites:0,productionMutations:0,liveStatus:'OWNER_FUNCTIONAL_VISUAL_REVIEW_PENDING',globalClosed:false,boundary:'Actual eight-route settings consumer family and current shared owners; server loaders replaced by fixed safe props, deferred local Action/fetch transports, no external provider/Auth/SQL/readiness proof. Standards-mode controlled native root only; no authenticated live route or real document Sticky claim. Default fixture scopes unchanged.'},null,2));
    console.log('PASS settings-family '+(settingsBefore?'immutable BEFORE snapshot':'targeted actual components, presentation and local journeys'));
}

const browser = await chromium.launch({ headless: true });
const errors = [], geometry = [], linkEvidence = [], mediaZoom = [], finalVisualGeometry = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.route('**/*', async (route) => { const req = route.request(), url = new URL(req.url()); if(metaManagerScope&&url.hostname==='local.example.test'&&req.resourceType()==='image')return route.fulfill({contentType:'image/png',body:binary}); assert.equal(url.hostname, '127.0.0.1');
    if(settingsFamilyScope&&url.pathname.startsWith('/api/admin/')){
        if(req.method()==='GET'&&url.pathname==='/api/admin/media-library/recovery')return route.fulfill({json:{available:true,generatedAt:'2026-10-25T00:00:00Z',warning:null,truncated:false,resultLimitPerType:20,context:{provider:'supabase',imageBucket:'images',environment:'fixture',environmentIdentity:'isolated-local',registryVersion:'local',runtimeState:'synced',lastSuccessfulRunIdentity:'local',lastSuccessfulRunAt:null},counts:{stuckDeletes:1,missingOrUncertainAssets:0,unresolvedLeaseBatches:0},items:[{id:'local-recovery',kind:'delete_reservation',state:'reserved',assetId:'local-asset',assetCount:1,assetLabel:'ملف محلي',publicValue:'/original.png',failureCode:'storage_uncertain',startedAt:null,updatedAt:null,expiresAt:null,lastStorageVerification:null,lastProviderScan:null,suggestedAction:'مراجعة محلية',allowedActions:['cancel_reservation'],blockedReasons:[]}]}});
        const input=req.postDataJSON(),operation=input.operation;
        const behavior=await page.evaluate(async ({operation,expectedVersion})=>{const qa=window.settingsTransport??={behavior:'error',hold:false,calls:[]};qa.calls.push({kind:'fetch',operation,...(expectedVersion===undefined?{}:{expectedVersion})});if(qa.hold)await new Promise(resolve=>{qa.release=resolve;});return qa.behavior;},{operation,expectedVersion:input.expectedVersion});
        if(url.pathname==='/api/admin/media-library'&&operation==='reference_state')return route.fulfill({json:{deleted:[],missing:[],originals:(input.assets??[]).map(value=>({value,width:400,height:600}))}});
        return route.fulfill({status:behavior==='error'||behavior==='throw'?400:200,json:behavior==='error'||behavior==='throw'?{ok:false,error:'integration_app_configuration_version_conflict'}:{ok:true,result:{message:'نتيجة محلية معزولة'},previewReliable:true,complete:true,toRegisterCount:1,discoveredReferenceCount:0,uncertainties:[]}});
    }
    if (url.pathname === '/api/admin/media-library') {
        const b = req.postDataJSON();
        assert.equal(b.operation, 'reference_state');
        if (b.assets.includes('/unavailable.png')) return route.fulfill({ status: 503, json: { error: 'isolated_read_failure' } });
        return route.fulfill({ json: { deleted: b.assets.filter(value => value === '/deleted.png'), missing: b.assets.filter(value => value === '/missing.png'), originals: b.assets.filter(value => !['/deleted.png', '/missing.png'].includes(value)).map(value => ({ value, width: 400, height: 600 })) } });
    } if (/^\/font-\d+\.woff2$/.test(url.pathname)) return route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(root, 'src/assets/fonts/ibm-plex-sans-arabic-' + url.pathname.match(/\d+/)[0] + '.woff2')) }); if (url.pathname === '/preview-hero')
        return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><section data-hero-family="fixture" style="height:600px;width:100%;position:relative"><img src="/original.png" style="height:100%;width:100%;object-fit:cover"></section></body></html>' }); if (url.pathname === '/bundle.js')
        return route.fulfill({ contentType: 'application/javascript', body: leanPixelScope ? inMemoryBundle : await readFile(path.join(out, 'bundle.js')) }); if (url.pathname === '/style.css')
        return route.fulfill({ contentType: 'text/css', body: css+'\n'+[...compiledModuleCss.values()].join('\n') }); if (url.pathname.endsWith('.png') || url.pathname === '/_next/image')
        return route.fulfill({ contentType: 'image/png', body: binary }); assert.equal(req.method(), 'GET'); return route.fulfill({ contentType: 'text/html', body: (fixtureScrollScope ? '<!doctype html><style>#root[data-taxonomy-scroll-host]{height:100dvh;overflow-y:auto}</style>' : '') + '<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><div id="root" ' + (fixtureScrollScope ? 'data-taxonomy-scroll-host' : '') + '></div><script src="/bundle.js"></script></body></html>' }); });
    if(metaManagerScope){await runMetaManager(page);}else if (settingsFamilyScope) { if(settingsLayoutRefinement)await runSettingsLayoutRefinement(page);else await runSettingsFamily(page); } else if (leanPixelScope) { await runPixelRefinement(page); } else if (buttonRefinementScope) { await runButtonRefinement(page); } else if (consistencyScope) { await runConsistency(page); } else {
    await page.goto('http://127.0.0.1:48199/');
    await page.locator('[data-family="story"] img').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('[data-family="hero-cta"] [data-admin-link-destination]').first().getByText('من نحن', { exact: true }).waitFor();
    await page.locator('[data-hero-image-composition]').scrollIntoViewIfNeeded();
    await page.locator('[data-hero-rendered-area-state="ready"]').waitFor();
    for (const width of [1440, 1024, 768, 430, 390, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        const result = await page.evaluate(() => {
            const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
            return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                families: [...document.querySelectorAll('[data-family]')].map(e => ({ family: e.dataset.family, overflow: e.scrollWidth > e.clientWidth + 1 })),
                panels: [...document.querySelector('[data-hero-image-composition] [data-admin-form-grid]').children].map(rect),
                controls: [...document.querySelector('[data-family="story"] [data-admin-form-grid="aligned-fields"], [data-family="story"] [data-admin-form-grid="control-cards"]').children].filter(e => e.tagName !== 'INPUT').map(rect),
                ctaCards: [...document.querySelectorAll('[data-family="hero-cta"] [data-module-editor-cta-card]')].map(e => ({ kind: e.dataset.moduleEditorCtaCard, ...rect(e) })),
                gallery: [...document.querySelectorAll('[data-family="gallery"] [data-admin-media-gallery-card="image"]')].map(rect),
                images: [...document.querySelectorAll('[data-admin-media-image-card="selected"], [data-admin-media-image-card="add"]')].map(e => ({ state: e.dataset.adminMediaImageCard, name: e.closest('[data-admin-media-image-field]').dataset.adminMediaImageField, frame: rect(e.querySelector(':scope > div') || e), preview: rect(e), parent: rect(e.parentElement), parentContentWidth: (() => { const s = getComputedStyle(e.parentElement); return e.parentElement.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); })(), fit: e.querySelector('img') ? getComputedStyle(e.querySelector('img')).objectFit : null })),
                fieldSpacing: [...document.querySelectorAll('[data-family="home-projects"] label, [data-family="story"] label, [data-family="breadcrumb"] label, [data-family="shared-labels"] label, [data-admin-media-image-field] label')].flatMap(label => {
                    const title = label.querySelector(':scope > span'), input = label.querySelector(':scope > input:not([type="hidden"])');
                    return title && input ? [{ name: input.name, title: rect(title), input: rect(input), gap: rect(input).y - rect(title).y - rect(title).h }] : [];
                }),
                cardAlignment: (() => { const group = document.querySelector('[data-family="home-projects"] [aria-label="محاذاة زر الكارت"][data-admin-text-format-controls]'); const title = group.parentElement.querySelector('span'); return { title: rect(title), group: rect(group), gap: rect(group).y - rect(title).y - rect(title).h }; })(),
                links: [...document.querySelectorAll('[data-admin-link-field]')].filter(e => e.getBoundingClientRect().width > 0).map(e => {
                    const row = e.querySelector('[data-admin-link-controls]');
                    const destination = e.querySelector('[data-admin-link-destination]');
                    return { family: e.closest('[data-family]')?.dataset.family, field: rect(e), row: rect(row), destination: rect(destination),
                        textInput: e.closest('[data-module-editor-cta-card]')?.querySelector('input[name$="_cta_label"]') ? rect(e.closest('[data-module-editor-cta-card]').querySelector('input[name$="_cta_label"]')) : null,
                        actions: [...row.querySelectorAll(':scope > button')].map(button => ({ ...rect(button), icon: rect(button.querySelector('svg')) })),
                        pathDirection: destination.querySelector('[dir="ltr"]')?.dir ?? null,
                        anchor: e.querySelector('label input') ? { input: rect(e.querySelector('label input')), label: rect(e.querySelector('label span')) } : null };
                }),
            };
        });
        assert(!result.overflow, JSON.stringify({ width, ...result }));
        assert(result.families.every(x => !x.overflow), JSON.stringify({ width, families: result.families }));
        assert(Math.abs(result.panels[0].w - result.panels[1].w) < 2);
        if (width >= 768)
            assert(Math.abs(result.panels[0].h - result.panels[1].h) < 2);
        assert(width < 768 ? result.panels[1].y > result.panels[0].y : Math.abs(result.panels[0].y - result.panels[1].y) < 2);
        assert(width < 768 ? result.gallery[1].y > result.gallery[0].y : Math.abs(result.gallery[0].y - result.gallery[1].y) < 2);
        if (width >= 1280) {
            assert([3, 4].includes(result.controls.length));
            assert(result.controls.every((x, i) => Math.abs(x.y - result.controls[result.controls.length === 4 ? Math.floor(i / 2) * 2 : 0].y) < 2));
        }
        if (width < 768)
            assert(result.controls.every((x, i) => !i || x.y > result.controls[i - 1].y));
        assert(result.images.every(x => Math.abs(x.preview.w - (boundedImages ? Math.min(384, x.parentContentWidth) : x.parentContentWidth)) < 3 && (x.fit === null || x.fit === 'cover')));
        if (boundedImages) assert(result.images.every(x => x.frame.h === 176), JSON.stringify({ width, images: result.images }));
        if (recoveryPhase !== 'before') {
            assert(result.fieldSpacing.every(field => field.gap >= 7 && field.gap <= 12), JSON.stringify({ width, spacing: result.fieldSpacing }));
            assert(result.cardAlignment.gap >= 7 && result.cardAlignment.gap <= 12, JSON.stringify({ width, alignment: result.cardAlignment }));
        }
        assert.equal(result.ctaCards.length, 2);
        const [primary, secondary] = result.ctaCards;
        assert.equal(primary.kind, 'primary'); assert.equal(secondary.kind, 'secondary');
        assert(width >= 1024 ? primary.x > secondary.x && Math.abs(primary.y - secondary.y) < 2 : secondary.y > primary.y, JSON.stringify({ width, cards: result.ctaCards }));
        assert(Math.abs(primary.w - secondary.w) < 2);
        for (const link of result.links) {
            assert(link.destination.w > 0 && link.actions.length >= 1 && link.actions.length <= 2);
            assert(link.destination.x >= link.row.x - 1 && link.destination.x + link.destination.w <= link.row.x + link.row.w + 1);
            assert(link.actions.every(action => action.w === 44 && action.h === 44 && action.icon.w === 20 && action.icon.h === 20), JSON.stringify({ width, link }));
            assert(link.actions.every(action => Math.abs((action.y + action.h / 2) - (link.destination.y + link.destination.h / 2)) < 2));
            assert(link.actions.every(action => action.x >= link.row.x - 1 && action.x + action.w <= link.row.x + link.row.w + 1));
            assert(link.actions[0].x + link.actions[0].w <= link.destination.x, 'RTL destination and actions must remain separate');
            if (link.actions.length === 2) assert(link.actions[1].x + link.actions[1].w <= link.actions[0].x);
            assert(link.pathDirection === null || link.pathDirection === 'ltr');
            assert(!link.anchor || link.anchor.input.y >= link.anchor.label.y + link.anchor.label.h + 4, 'Anchor label and input require visible spacing');
        }
        if (boundedImages) {
            for (const link of result.links.filter(link => ['hero-cta', 'cta-module'].includes(link.family))) {
                assert(link.textInput.w > 120 && link.field.y >= link.textInput.y + link.textInput.h + 8, JSON.stringify({ width, link }));
            }
        }
        linkEvidence.push({ width, fields: await inspectLinkIcons(page.locator('[data-admin-link-field]')) });
        geometry.push({ width, ...result });
        if (finalVisualScope) await measureFinalVisual(page, width);
        if (!finalVisualScope && [1440, 390].includes(width)) {
            for (const family of [...new Set(result.links.map(link => link.family))]) {
                const fields = page.locator(`[data-family="${family}"] [data-admin-link-field]`);
                for (let index = 0; index < await fields.count(); index++) {
                    await fields.nth(index).screenshot({ path: path.join(out, `link-${family}-${index}-${width}.png`) });
                }
            }
        }
        if ([1440, 390].includes(width))
            for (const family of (finalVisualScope ? ['image-position', 'featured-projects', 'gallery-fields', 'gallery-failure', 'intro-textareas', 'single', 'media-states', 'compact-gallery', 'hero'] : ['home-projects', 'shared-labels', 'media-states', 'single', 'story', 'hero-cta', 'gallery', 'hero', 'footer', 'menu', 'breadcrumb', 'cta-module', 'cards-module', 'about-cta', 'home-contact', 'about-cta-contacts', 'home-contact-contacts', 'footer-text', 'footer-media']))
                await page.locator(`[data-family="${family}"]${family === 'hero-cta' ? ' [data-module-editor-cta-grid]' : ''}`).screenshot({ path: path.join(out, `${family}-${width}.png`) });
    }
    if (finalVisualScope) {
        let journeys = null;
        if (correctedLayout) {
            const position = page.locator('[data-family="image-position"]');
            await position.getByRole('radio', { name: 'الصورة يمين', exact: true }).press('Enter');
            await expect(position.locator('[name="image_position"]')).toHaveValue('right');
            await position.locator('[name="image_main_alt"]').fill('بديل محفوظ بعد الترتيب');
            await position.locator('[name="beat_0_text"]').fill('وصف متعدد\nالسطور');
            await position.getByRole('button', { name: 'Save single', exact: true }).click();
            await expect(page.locator('[data-visual-save-status]')).toHaveText('rejected-single');
            await expect(position.locator('[name="image_main_alt"]')).toHaveValue('بديل محفوظ بعد الترتيب');
            await page.getByRole('button', { name: 'Allow local save', exact: true }).click();
            await position.getByRole('button', { name: 'Save single', exact: true }).click();
            await position.getByRole('button', { name: 'Reload single', exact: true }).click();
            await expect(position.locator('[name="image_position"]')).toHaveValue('right');
            await expect(position.locator('[name="image_main"]')).toHaveValue('/original.png');
            await expect(position.locator('[name="image_main_alt"]')).toHaveValue('بديل محفوظ بعد الترتيب');
            await expect(position.locator('[name="beat_0_text"]')).toHaveValue('وصف متعدد\nالسطور');
            const featured = page.locator('[data-family="featured-projects"]');
            const limit = featured.locator('[name="limit"]'), autoplay = featured.locator('[name="autoplay_ms"]');
            await expect(limit).toHaveAttribute('min', '1'); await expect(limit).toHaveAttribute('max', '48');
            await expect(autoplay).toHaveAttribute('min', '1000'); await expect(autoplay).toHaveAttribute('max', '60000'); await expect(autoplay).toHaveAttribute('step', '500');
            await featured.getByRole('combobox', { name: 'قاعدة الاختيار', exact: true }).press('Enter');
            await page.getByRole('option', { name: 'المشروعات ذات featured = true', exact: true }).click();
            await limit.fill('12'); await autoplay.fill('8000');
            await page.getByRole('button', { name: 'Reject local save', exact: true }).click();
            await featured.getByRole('button', { name: 'Save featured', exact: true }).click();
            await expect(page.locator('[data-visual-save-status]')).toHaveText('rejected-featured');
            await expect(limit).toHaveValue('12'); await expect(autoplay).toHaveValue('8000');
            await page.getByRole('button', { name: 'Allow local save', exact: true }).click();
            await featured.getByRole('button', { name: 'Save featured', exact: true }).click();
            await featured.getByRole('button', { name: 'Reload featured', exact: true }).click();
            await expect(limit).toHaveValue('12'); await expect(autoplay).toHaveValue('8000'); await expect(featured.locator('[name="selection_mode"]')).toHaveValue('featured_flag');
            await limit.fill('0'); assert.equal(await limit.evaluate(input => input.validity.valid), false); await limit.fill('');
            await featured.getByRole('button', { name: 'Save featured', exact: true }).click();
            await featured.getByRole('button', { name: 'Reload featured', exact: true }).click(); await expect(limit).toHaveValue('');
            const gallery = page.locator('[data-family="gallery-fields"]');
            await gallery.locator('[name="visual_alt"]').nth(0).fill('بديل معدل');
            await gallery.locator('[name="visual_caption"]').nth(0).fill('تعليق معدل');
            await gallery.locator('[data-admin-media-gallery-action="move-down"]').nth(0).press('Enter');
            await expect(gallery.locator('[name="visual_url"]').nth(1)).toHaveValue('/original.png');
            await expect(gallery.locator('[name="visual_alt"]').nth(1)).toHaveValue('بديل معدل');
            await page.getByRole('button', { name: 'Reject local save', exact: true }).click();
            await gallery.getByRole('button', { name: 'Save gallery', exact: true }).click();
            await expect(page.locator('[data-visual-save-status]')).toHaveText('rejected-gallery');
            await expect(gallery.locator('[name="visual_caption"]').nth(1)).toHaveValue('تعليق معدل');
            await page.getByRole('button', { name: 'Allow local save', exact: true }).click();
            await gallery.getByRole('button', { name: 'Save gallery', exact: true }).click();
            await gallery.getByRole('button', { name: 'Reload gallery', exact: true }).click();
            await expect(gallery.locator('[name="visual_url"]').nth(1)).toHaveValue('/original.png');
            await expect(gallery.locator('[name="visual_alt"]').nth(1)).toHaveValue('بديل معدل');
            await expect(gallery.locator('[name="visual_caption"]').nth(1)).toHaveValue('تعليق معدل');
            const missing = page.locator('[data-family="gallery-failure"]');
            await expect(missing.locator('[data-admin-media-preview-state="missing"]')).toBeVisible();
            await expect(missing.locator('[name="failed_url"]')).toHaveValue('/missing.png');
            await expect(missing.locator('[name="failed_alt"]')).toHaveValue('وصف محفوظ');
            await missing.locator('[data-admin-media-gallery-action="replace"]').click();
            await missing.getByRole('button', { name: 'Select fixture media', exact: true }).click();
            await expect(missing.locator('[name="failed_url"]')).toHaveValue('/wide.png');
            await expect(missing.locator('[name="failed_alt"]')).toHaveValue('وصف محفوظ');
            await missing.locator('[data-admin-media-gallery-action="remove"]').click();
            await expect(missing.locator('[name="failed_url"]')).toHaveCount(0);
            await expect(missing.locator('[name="failed_alt"]')).toHaveCount(0);
            await expect(missing.locator('[data-admin-media-gallery-action="add"]')).toBeVisible();
            journeys = { position: 'right and original URL/Alt/textarea retained through rejected save then canonical parse/remount', featured: 'selection_mode, limit, autoplay_ms retained; limits and blank optional value preserved', gallery: 'Alt/caption/reorder, rejected save, local remount, missing reference replacement and removal', boundary: 'Isolated form serialization and canonical parsers; native Server Actions and DB persistence not exercised' };
            const before = JSON.parse(await readFile(path.join(root, '.tmp-qa/admin-ui-recovery/layout-before/receipt.json'), 'utf8'));
            for (const row of finalVisualGeometry) {
                const previous = before.finalVisualGeometry.find(g => g.width === row.width);
                assert.deepEqual(row.featured.map(f => f.typography), previous.featured.map(f => f.typography), 'Featured typography must remain unchanged');
                assert.deepEqual(row.labels.map(f => ({ name: f.name, typography: f.typography })), previous.labels.filter(f => f.name).map(f => ({ name: f.name, typography: f.typography })), 'Field typography must remain unchanged');
            }
        }
        assert.deepEqual(errors, []);
        await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'PASS', phase: recoveryPhase, geometry, finalVisualGeometry, journeys, errors, scope: 'Targeted final visual geometry; existing UI source and CSS; no live server or DB persistence' }, null, 2));
        console.log('PASS targeted final visual geometry');
    } else {
    // Footer manual links render in a portal and must be opened through the real row action.
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('[data-family="footer-links"]').getByRole('button', { name: /تعديل/ }).click();
        const modal = page.getByRole('dialog', { name: 'تعديل رابط', exact: true });
        await expect(modal).toBeVisible();
        const fields = await inspectLinkIcons(modal.locator('[data-admin-link-field]'));
        assert.equal(fields.length, 1);
        assert.equal(fields[0].actions.length, 2);
        linkEvidence.push({ width, family: 'footer-links-modal', fields });
        await modal.screenshot({ path: path.join(out, `footer-links-modal-${width}.png`) });
        await modal.getByRole('button', { name: 'إغلاق', exact: true }).click();
    }
    if (boundedImages) {
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            const trigger = page.locator('[data-family="single"] [data-admin-media-image-preview-trigger]');
            if (width === 390) await trigger.click(); else await trigger.press('Enter');
            const modal = page.getByRole('dialog', { name: 'معاينة صورة المحتوى', exact: true });
            await expect(modal).toBeVisible();
            await expect(modal.getByRole('img')).toHaveCSS('object-fit', 'contain');
            await expect(modal.getByRole('img')).toHaveAttribute('alt', 'وصف');
            await expect.poll(() => modal.getByRole('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
            const frame = await modal.locator('[data-admin-media-image-expanded]').boundingBox();
            assert(frame.width <= width && frame.height === 700);
            await modal.screenshot({ path: path.join(out, `single-expanded-${width}.png`) });
            await modal.getByRole('button', { name: 'إغلاق', exact: true }).press('Tab');
            await expect.poll(() => modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
            await modal.getByRole('button', { name: 'إغلاق', exact: true }).press('Enter');
            await expect(trigger).toBeFocused();
            mediaZoom.push({ width, frame, keyboard: true, focusReturn: true, objectFit: 'contain' });
        }
        for (const state of ['deleted', 'missing', 'unavailable', 'empty']) await expect(page.locator(`[data-admin-media-image-field="state_${state}"] [data-admin-media-image-preview-trigger]`)).toHaveCount(0);
    }
    const home = page.locator('[data-family="home-projects"]');
    const cardAlignment = home.getByRole('toolbar', { name: 'محاذاة زر الكارت', exact: true });
    for (const [value, title] of [['left', 'محاذاة لليسار'], ['right', 'محاذاة لليمين'], ['center', 'محاذاة للوسط']]) {
        await cardAlignment.getByRole('button', { name: title, exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(home.locator('[name="card_cta_alignment"]')).toHaveValue(value);
        await expect(cardAlignment.getByRole('button', { name: title, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await home.locator('[name="projects_limit"]').fill('3');
    await home.locator('[name="card_cta_label"]').fill('زر مشروع محفوظ');
    const eyebrowTools = home.getByRole('toolbar', { name: 'إعدادات النص التمهيدي', exact: true });
    await eyebrowTools.getByRole('button', { name: 'تنسيق عريض', exact: true }).press('Enter');
    await eyebrowTools.getByRole('switch').press('Space');
    await home.getByRole('button', { name: 'Save Home fixture', exact: true }).click();
    const homeSaved = await page.evaluate(() => window.homeSaved);
    assert.equal(homeSaved.card_cta_alignment, 'center');
    assert.equal(homeSaved.eyebrow_bold, 'false');
    assert.equal(homeSaved.show_eyebrow, 'false');
    await home.getByRole('button', { name: 'Reload Home fixture', exact: true }).click();
    for (const [name, value] of Object.entries({ projects_limit: '3', card_cta_label: 'زر مشروع محفوظ', card_cta_alignment: 'center', eyebrow_bold: 'false', show_eyebrow: 'false' }))
        await expect(home.locator('[name="' + name + '"]')).toHaveValue(value);
    for (const state of ['deleted', 'missing', 'unavailable']) {
        const field = page.locator('[data-admin-media-image-field="state_' + state + '"]');
        await expect(field.locator('[data-admin-media-preview-state="' + state + '"]')).toBeVisible();
        await expect(field.locator('[name="state_' + state + '"]')).toHaveValue('/' + state + '.png');
        await expect(field.locator('[name="state_' + state + '_alt"]')).toHaveValue('وصف محفوظ');
    }
    const existingMedia = page.locator('[data-admin-media-image-field="state_existing"]');
    await existingMedia.getByRole('button', { name: 'استبدال', exact: true }).press('Enter');
    await existingMedia.getByRole('button', { name: 'Select fixture media', exact: true }).press('Enter');
    await expect(existingMedia.locator('[name="state_existing"]')).toHaveValue('/wide.png');
    await expect(existingMedia.locator('[name="state_existing_alt"]')).toHaveValue('وصف محفوظ');
    await existingMedia.getByRole('button', { name: 'إزالة', exact: true }).press('Enter');
    await expect(existingMedia.locator('[name="state_existing"]')).toHaveValue('');
    await expect(existingMedia.locator('[name="state_existing_alt"]')).toHaveValue('');
    await expect(existingMedia.getByRole('button', { name: 'اختيار صورة', exact: true })).toBeVisible();
    const cta = page.locator('[data-family="hero-cta"]');
    for (const [kind, label] of [['primary', 'نص الزر الأساسي'], ['secondary', 'نص الزر الثانوي']]) {
        const card = cta.locator(`[data-module-editor-cta-card="${kind}"]`);
        await expect(card.getByRole('textbox', { name: label, exact: true })).toBeVisible();
        assert.equal(await card.getByRole('textbox', { name: label, exact: true }).locator('..').innerText(), '', 'Redundant visible CTA text label is removed while aria-label remains');
        await expect(card.getByRole('button', { name: 'اختيار الرابط', exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'مسح', exact: true })).toBeVisible();
    }
    const primaryCard = cta.locator('[data-module-editor-cta-card="primary"]');
    const secondaryCard = cta.locator('[data-module-editor-cta-card="secondary"]');
    await expect(primaryCard.locator('[data-admin-link-destination]').getByText('من نحن', { exact: true })).toBeVisible();
    await expect(secondaryCard.locator('[data-admin-link-destination]').getByText('خارجي', { exact: true })).toBeVisible();
    const longPath = secondaryCard.locator('[data-admin-link-destination] [dir="ltr"]');
    assert((await longPath.textContent()).length > 300);
    assert.equal(await longPath.getAttribute('title'), await longPath.textContent(), 'Full destination remains inspectable despite visual truncation');
    await expect(page.locator('[data-family="hero-domain"]').getByRole('textbox', { name: 'نص زر فتح تفاصيل المشروع', exact: true })).toHaveValue('تفاصيل المشروع');
    await expect(page.locator('[data-family="hero-domain"] [data-admin-link-field]')).toHaveCount(0);
    const ordinaryAction = page.getByRole('button', { name: 'إجراء نصي عادي', exact: true });
    await expect(ordinaryAction).toBeEnabled();
    const ordinaryBox = await ordinaryAction.boundingBox();
    assert(ordinaryBox.width > 44 && ordinaryBox.height >= 44, 'Existing text buttons retain natural width and target height');
    await expect(page.getByRole('button', { name: 'إجراء نصي معطل', exact: true })).toBeDisabled();
    const disabled = page.locator('[data-family="disabled-link"]');
    for (const control of await disabled.locator('button, label input').all()) await expect(control).toBeDisabled();
    const empty = page.locator('[data-family="empty-link"]');
    await expect(empty.getByText('لم يتم اختيار رابط بعد.', { exact: true })).toBeVisible();
    await expect(empty.getByRole('button')).toHaveCount(1);
    await expect(empty.locator('label input')).toHaveCount(0);
    const choosePrimary = primaryCard.getByRole('button', { name: 'اختيار الرابط', exact: true });
    await choosePrimary.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await dialog.getByRole('button', { name: 'إغلاق', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'اعتماد الرابط', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'إغلاق', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible(); // Picker preserves the shared explicit-close policy.
    await dialog.getByRole('button', { name: 'إغلاق', exact: true }).press('Enter');
    await expect(dialog).toBeHidden();
    await expect(choosePrimary).toBeFocused();
    await expect(choosePrimary).toHaveCSS('outline-style', 'solid');
    await expect(choosePrimary).toHaveCSS('outline-width', '2px');
    await choosePrimary.press('Tab');
    await expect(primaryCard.getByRole('button', { name: 'مسح', exact: true })).toBeFocused();
    async function choosePage(card) {
        await card.getByRole('button', { name: 'اختيار الرابط', exact: true }).press('Enter');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('textbox', { name: 'ابحث داخل Pages...', exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: /من نحن/ }).click();
        await dialog.getByRole('button', { name: 'اعتماد الرابط', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(card.locator('[data-admin-link-destination]').getByText('من نحن', { exact: true })).toBeVisible();
    }
    for (const [card, prefix, anchor] of [[primaryCard, 'primary', 'primary-section'], [secondaryCard, 'secondary', 'secondary-section']]) {
        await card.getByRole('button', { name: 'مسح', exact: true }).press('Enter');
        await expect(card.getByText('لم يتم اختيار رابط بعد.', { exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'مسح', exact: true })).toHaveCount(0);
        await expect(cta.locator(`[name="${prefix}_cta_link_kind"]`)).toHaveValue('none');
        await choosePage(card);
        await card.locator('[data-admin-link-field] label input').fill('#' + anchor);
        await expect(cta.locator(`[name="${prefix}_cta_link_anchor"]`)).toHaveValue(anchor);
        await expect(card.locator('[data-admin-link-destination]').getByText('/about#' + anchor, { exact: true })).toBeVisible();
    }
    await cta.getByRole('textbox', { name: 'نص الزر الأساسي', exact: true }).fill('زر أساسي محفوظ');
    await cta.getByRole('textbox', { name: 'نص الزر الثانوي', exact: true }).fill('زر ثانوي محفوظ');
    await expect(primaryCard.getByRole('switch')).toBeChecked();
    await primaryCard.getByRole('switch').press('Space');
    await primaryCard.getByRole('button', { name: 'محاذاة للوسط', exact: true }).click();
    await primaryCard.getByRole('button', { name: 'تنسيق عريض', exact: true }).click();
    for (const card of [primaryCard, secondaryCard]) {
        await expect(card.getByRole('switch')).not.toBeChecked();
        await expect(card.getByRole('button', { name: 'محاذاة للوسط', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(card.getByRole('button', { name: 'تنسيق عريض', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await cta.getByRole('button', { name: 'Save CTA fixture', exact: true }).click();
    const savedCta = await page.evaluate(() => window.ctaSaved);
    assert.equal(savedCta.config.primaryLabel, 'زر أساسي محفوظ');
    assert.equal(savedCta.config.secondaryLabel, 'زر ثانوي محفوظ');
    assert.equal(savedCta.config.primaryLink.linked_id, 42);
    assert.equal(savedCta.config.secondaryLink.linked_id, 42);
    assert.equal(savedCta.config.primaryLink.anchor, 'primary-section');
    assert.equal(savedCta.config.secondaryLink.anchor, 'secondary-section');
    assert.equal(savedCta.config.showDefault, false);
    assert.equal(savedCta.config.alignmentDefault, 'center');
    assert.equal(savedCta.config.boldDefault, true);
    await cta.getByRole('button', { name: 'Reload CTA fixture', exact: true }).click();
    await expect(cta.locator('[name="primary_cta_label"]')).toHaveValue('زر أساسي محفوظ');
    await expect(cta.locator('[name="secondary_cta_label"]')).toHaveValue('زر ثانوي محفوظ');
    await expect(cta.locator('[name="primary_cta_link_anchor"]')).toHaveValue('primary-section');
    await expect(cta.locator('[name="secondary_cta_link_anchor"]')).toHaveValue('secondary-section');
    await expect(cta.locator('[name="show_cta"]')).toHaveValue('false');
    await expect(cta.locator('[name="cta_alignment"]')).toHaveValue('center');
    await expect(cta.locator('[name="cta_bold"]')).toHaveValue('true');
    await secondaryCard.getByRole('button', { name: 'مسح', exact: true }).press('Enter');
    await cta.getByRole('button', { name: 'Save CTA fixture', exact: true }).click();
    await cta.getByRole('button', { name: 'Reload CTA fixture', exact: true }).click();
    await expect(cta.locator('[name="secondary_cta_link_kind"]')).toHaveValue('none');
    await expect(cta.locator('[name="secondary_cta_link_anchor"]')).toHaveValue('');
    await expect(cta.locator('[name="primary_cta_link_anchor"]')).toHaveValue('primary-section');
    await expect(cta.locator('[name="secondary_cta_label"]')).toHaveValue('زر ثانوي محفوظ');
    const story = page.locator('[data-family="story"]');
    await story.locator('[name="button_label"]').fill('زر محفوظ');
    await story.locator('[name="image_main_alt"]').fill('وصف محفوظ');
    await story.locator('[data-admin-link-field] label input').fill('saved-anchor');
    await story.getByRole('radio', { name: 'وسط', exact: true }).click();
    await story.getByRole('button', { name: 'Save story', exact: true }).click();
    await story.getByRole('button', { name: 'Reload story', exact: true }).click();
    assert.equal(await story.locator('[name="button_label"]').inputValue(), 'زر محفوظ');
    assert.equal(await story.locator('[name="image_main_alt"]').inputValue(), 'وصف محفوظ');
    assert.equal(await story.locator('[name="button_alignment"]').inputValue(), 'center');
    assert.equal(await story.locator('[name="button_link_anchor"]').inputValue(), 'saved-anchor');
    assert.equal(await story.locator('[name="button_icon_position"]').inputValue(), 'left');
    const footer = page.locator('[data-family="footer"]');
    assert.equal(await footer.locator('input[type="hidden"]').count(), 0);
    await footer.locator('label input').fill('new-anchor');
    await footer.getByText('/about#new-anchor', { exact: true }).waitFor();
    await footer.getByRole('button', { name: 'مسح الرابط', exact: true }).click();
    await footer.getByText('لم يتم اختيار رابط بعد.', { exact: true }).waitFor();
    await footer.getByRole('button', { name: 'اختيار الرابط', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: path.join(out, 'picker-mobile.png') });
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق', exact: true }).click();
    const consumerJourneys = [];
    for (const family of ['home-projects', 'story', 'hero-cta', 'cta-module', 'cards-module', 'about-cta', 'home-contact', 'about-cta-contacts', 'home-contact-contacts', 'breadcrumb', 'menu', 'footer-text', 'footer-media']) {
        const fields = page.locator(`[data-family="${family}"] [data-admin-link-field]`);
        for (let index = 0; index < await fields.count(); index++) {
            const field = fields.nth(index), actions = field.locator(':is([data-admin-link-controls] > button, [data-admin-link-controls] > [data-admin-link-actions] > button)');
            if (await actions.count() === 2) await actions.nth(1).press('Enter');
            await expect(actions).toHaveCount(1);
            await actions.first().press('Enter');
            const picker = page.getByRole('dialog');
            await picker.getByRole('button', { name: /من نحن/ }).click();
            await picker.getByRole('button', { name: 'اعتماد الرابط', exact: true }).click();
            await expect(actions).toHaveCount(2);
            await expect(actions.first()).toBeFocused();
            await expect(field.locator('[data-admin-link-destination]').getByText('من نحن', { exact: true })).toBeVisible();
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: 1000 });
                linkEvidence.push({ width, state: 'selected-after-empty', fields: await inspectLinkIcons(field) });
                await field.screenshot({ path: path.join(out, `link-selected-${family}-${index}-${width}.png`) });
            }
            consumerJourneys.push({ family, index, clear: true, select: true, keyboard: true, focusReturn: true });
        }
    }
    const footerGrid = page.locator('[data-family="footer-links"]');
    await footerGrid.getByRole('button', { name: /تعديل/ }).click();
    const footerModal = page.getByRole('dialog', { name: 'تعديل رابط', exact: true });
    const footerActions = footerModal.locator('[data-admin-link-controls] > button');
    await footerActions.nth(1).press('Enter');
    await expect(footerModal.getByRole('button', { name: 'حفظ', exact: true })).toBeDisabled();
    await footerActions.first().press('Enter');
    const nestedPicker = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'اعتماد الرابط', exact: true }) });
    await nestedPicker.getByRole('button', { name: /من نحن/ }).click();
    await nestedPicker.getByRole('button', { name: 'اعتماد الرابط', exact: true }).click();
    await expect(footerActions).toHaveCount(2);
    await expect(footerActions.first()).toBeFocused();
    await footerModal.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(footerModal).toBeHidden();
    consumerJourneys.push({ family: 'footer-links-modal', clear: true, select: true, nestedModal: true, localDraftSave: true });
    for (const state of ['empty', 'missing']) {
        const field = page.locator(`[data-admin-media-image-field="state_${state}"]`);
        await field.getByRole('button', { name: state === 'empty' ? 'اختيار صورة' : 'اختيار بديل', exact: true }).press('Enter');
        await field.getByRole('button', { name: 'Select fixture media', exact: true }).press('Enter');
        await expect(field.locator(`[name="state_${state}"]`)).toHaveValue('/wide.png');
        await expect(field.locator('img')).toBeVisible();
        await expect(field.locator(`[name="state_${state}_alt"]`)).toHaveValue('وصف محفوظ');
    }
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'PASS', geometry, linkEvidence, mediaZoom, consumerJourneys, errors, ctaSaved: savedCta, homeSaved, scope: 'Actual components and CSS, controlled transport only; six RTL viewport geometries, computed SVG/stroke/sr-only clip-path evidence and cropped icons for every Page Blocks link consumer, actual Footer modal, image zoom with keyboard/pointer and focus return, accessible icon controls, keyboard picker focus/return, CTA select/clear and canonical FormData/remount, synchronized formatting, controlled Footer callback and inherited disabled state; Home Projects keyboard alignment/Bold/Visibility and FormData/parser/remount; media reference active/deleted/missing/unavailable/empty, replacement and clear; no native DB/storage proof or writes' }, null, 2));
    console.log('PASS Admin form layout: six RTL widths; CTA cards, shared icon links, long paths, keyboard picker focus/return, select/clear, formatting, serialization/remount, disabled state and representative consumers');
    }
    }
}
catch (error) {
    if(!leanPixelScope) await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'FAIL', phase: recoveryPhase ?? 'regression', error: String(error), geometry, errors, ...(settingsProgress?{settingsProgress}:{}) }, null, 2));
    throw error;
}
finally {
    await browser.close();
}
