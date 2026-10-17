import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const finalVisualScope = process.env.ADMIN_FORM_LAYOUT_SCOPE === 'final-visual';
const correctedLayout = recoveryPhase !== 'layout-before';
const boundedImages = !['before', 'after', 'owner-before'].includes(recoveryPhase);
const out = path.join(root, leanPixelScope ? '.tmp-qa/content25-pixel-refinement' : recoveryPhase ? `.tmp-qa/admin-ui-recovery/${recoveryPhase}` : '.tmp-qa/admin-form-layout/browser');
await mkdir(out, { recursive: true });
if (!leanPixelScope) await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'RUNNING', phase: recoveryPhase ?? 'regression' }));
await writeGeneratedFile(path.join(out, 'loader.cjs'), `module.exports=s=>require('typescript').transpileModule(s,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;`);
await writeGeneratedFile(path.join(out, 'navigation.js'), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});export const useSearchParams=()=>new URLSearchParams(location.search);export const usePathname=()=>'/admin/fixture';`);
await writeGeneratedFile(path.join(out, 'actions.js'), `const row={id:'pages:42',resourceId:42,resourceType:'pages',title:'من نحن',slug:'about',publicPath:'/about'};export const browseAdminLinksAjax=async()=>({ok:true,results:[row]});export const browseTopicCategoriesPickerAjax=async()=>({ok:true,items:[]});export const browseMenusPickerAjax=async()=>({ok:true,menus:[]});export const browseMenuItemsPickerAjax=async()=>({ok:true,items:[]});export const resolveAdminLinkAjax=async v=>({ok:true,display:{kind:v.link_kind,kindLabel:v.link_kind==='external'?'خارجي':'صفحة',title:v.link_kind==='external'?v.href:'من نحن',publicPath:(v.href||'/about')+(v.anchor?'#'+v.anchor:''),target:v.target||'_self'}});export const updateHeroTemplateDetails=async()=>{throw Error('No persistence transport permitted')};`);
await writeGeneratedFile(path.join(out, 'picker.js'), `import React from 'react';export default function Picker({open,onSelect,onClose}){return open?<button type="button" onClick={()=>{onSelect('/wide.png');onClose()}}>Select fixture media</button>:null;}`);
await writeGeneratedFile(path.join(out, 'taxonomy-actions.js'), `export const createSeriesForm=reject,updateSeriesForm=reject,createCategoryForm=reject,updateCategoryForm=reject;async function reject(previous,data){window.consistencyTaxonomy=Object.fromEntries(data);return {...previous,status:'error',revision:previous.revision+1,title:'رفض محلي معزول',message:'لم يتم إرسال أي بيانات إلى الخادم',fieldErrors:{name:['فشل حفظ تجريبي']}}}`);
const appCss = await readFile(path.join(root, 'src/app/globals.css'), 'utf8');
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
                ]).process(await readFile(file,'utf8'),{from:file});
                const locals={};result.root.walkRules(':export',rule=>{rule.walkDecls(decl=>{locals[decl.prop]=decl.value;});rule.remove();});
                compiledModuleCss.set(file,result.root.toString());
                return 'export default '+JSON.stringify(locals)+';';
            }
            if(leanPixelScope&&/\.[jt]sx?$/.test(file)&&!file.includes('node_modules'))return require('typescript').transpileModule(await readFile(file,'utf8'),{compilerOptions:{jsx:4,target:9,module:99}}).outputText;
        });
    });
} };
const compiler = webpack({
    mode:'development',target:'web',entry:path.join(root,'scripts/fixtures/admin-form-layout-browser.jsx'),output:{path:out,filename:'bundle.js'},
    resolve:{extensions:['.tsx','.ts','.jsx','.js'],alias:{'server-only':false,...(leanPixelScope?{}:{'next/navigation$':shim('navigation.js')})}},
    plugins:[fixtureResources,...(leanPixelScope?[new webpack.NormalModuleReplacementPlugin(/^next\/navigation$/,shim('navigation.js'))]:[]),new webpack.NormalModuleReplacementPlugin(/taxonomy-form-actions$/,shim('taxonomy-actions.js')),new webpack.ProvidePlugin({process:require.resolve('next/dist/build/polyfills/process')}),new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$|^\.\.\/actions$/,shim('actions.js')),new webpack.NormalModuleReplacementPlugin(/AdminMediaPickerModal$/,shim('picker.js'))],
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
        storyComposition: !!element.closest('[data-home-story-button-panel]'), viewportWidth: innerWidth,
        actions: [...element.querySelectorAll('[data-admin-link-controls] > button')].map(button => {
            const svg = button.querySelector('svg'), text = button.querySelector('.sr-only'), path = svg.querySelector('path');
            const rect = element => { const box = element.getBoundingClientRect(); return { width: box.width, height: box.height }; };
            const styles = element => { const s = getComputedStyle(element); return { display: s.display, visibility: s.visibility, opacity: s.opacity, stroke: s.stroke, color: s.color, position: s.position, clip: s.clip, clipPath: s.clipPath, overflow: s.overflow }; };
            return { label: text.textContent, disabled: button.matches(':disabled'), button: rect(button), icon: rect(svg), svg: styles(svg), path: styles(path), hiddenText: { ...rect(text), ...styles(text) }, dom: button.outerHTML };
        })
    })));
    assert(evidence.length > 0);
    for (const field of evidence) for (const action of field.actions) {
        assert(action.label.trim());
        const buttonSize=44,iconSize=20;
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
    await page.goto('http://127.0.0.1:48199/?scope=consistency&taxonomy=create');
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
            rows.push({kind,width,...row});
            if([1440,390].includes(width))await form.screenshot({path:path.join(out,'consistency-'+kind+'-create-'+width+'.png')});
        }
    }
    const form=page.locator('[data-family="consistency-series"]');
    await form.locator('[name="name"]').fill('New Series');await expect(form.locator('[name="slug"]')).toHaveValue('new-series');
    await expect(form.getByRole('switch',{name:'منشور',exact:true})).not.toBeChecked();
    return rows;
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
    console.log('SHARED_PRESENTATION '+JSON.stringify({grids:results,cardDefaultsIdentical:true,premiumOptIn:true,interactiveHover:true,defaultSectionAndTextScale:sections[0],choiceStates:choices}));
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
            const scale={headingTitle:font(heading.querySelector('h2')),headingDescription:font(heading.querySelector('h2 + span')),headingFrame:box(heading.firstElementChild),headingGlyph:box(heading.querySelector('svg')),footerTitle:font(footer.querySelector('p')),footerDescription:font(footer.querySelector('p + p')),save:font(button),bodyControls:[...root.querySelectorAll('[data-home-story-button-panel] input:not([type="hidden"]),[data-home-story-button-panel] [role="radio"],[data-home-story-button-panel] [role="combobox"]')].map(font)};
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
            assert.equal(row.scale.headingTitle,width<640?'18px':'20px');assert.equal(row.scale.headingDescription,'14px');assert.equal(row.scale.headingFrame.w,width<640?44:48);assert.equal(row.scale.headingGlyph.w,20);
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
    const headingStyle=element=>{const s=getComputedStyle(element),title=element.querySelector('h2'),description=element.querySelector('h2 + span');return {background:s.background,border:s.border,padding:s.padding,title:getComputedStyle(title).fontSize,description:getComputedStyle(description).fontSize};};
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
    assert.deepEqual(errors, []);
    await writeFile(path.join(out,'receipt.json'),JSON.stringify({status:'PASS',phase:recoveryPhase,measurements,journeys,taxonomyCreate,linkEvidence,errors,scope:'Actual FeaturedModuleEditClient, AboutIntroModuleEditor CTA, ContentBasicDataPanel with real AdminFormRuntime, SeriesForm and CategoryForm; existing CSS; isolated link/media/taxonomy transports; no live Admin or DB persistence proof'},null,2));
    console.log('PASS '+recoveryPhase+' actual-component visual capture');
}

const browser = await chromium.launch({ headless: true });
const errors = [], geometry = [], linkEvidence = [], mediaZoom = [], finalVisualGeometry = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.route('**/*', async (route) => { const req = route.request(), url = new URL(req.url()); assert.equal(url.hostname, '127.0.0.1'); if (url.pathname === '/api/admin/media-library') {
        const b = req.postDataJSON();
        assert.equal(b.operation, 'reference_state');
        if (b.assets.includes('/unavailable.png')) return route.fulfill({ status: 503, json: { error: 'isolated_read_failure' } });
        return route.fulfill({ json: { deleted: b.assets.filter(value => value === '/deleted.png'), missing: b.assets.filter(value => value === '/missing.png'), originals: b.assets.filter(value => !['/deleted.png', '/missing.png'].includes(value)).map(value => ({ value, width: 400, height: 600 })) } });
    } if (/^\/font-\d+\.woff2$/.test(url.pathname)) return route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(root, 'src/assets/fonts/ibm-plex-sans-arabic-' + url.pathname.match(/\d+/)[0] + '.woff2')) }); if (url.pathname === '/preview-hero')
        return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><section data-hero-family="fixture" style="height:600px;width:100%;position:relative"><img src="/original.png" style="height:100%;width:100%;object-fit:cover"></section></body></html>' }); if (url.pathname === '/bundle.js')
        return route.fulfill({ contentType: 'application/javascript', body: leanPixelScope ? inMemoryBundle : await readFile(path.join(out, 'bundle.js')) }); if (url.pathname === '/style.css')
        return route.fulfill({ contentType: 'text/css', body: css+'\n'+[...compiledModuleCss.values()].join('\n') }); if (url.pathname.endsWith('.png') || url.pathname === '/_next/image')
        return route.fulfill({ contentType: 'image/png', body: binary }); assert.equal(req.method(), 'GET'); return route.fulfill({ contentType: 'text/html', body: '<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>' }); });
    if (leanPixelScope) { await runPixelRefinement(page); } else if (buttonRefinementScope) { await runButtonRefinement(page); } else if (consistencyScope) { await runConsistency(page); } else {
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
            const field = fields.nth(index), actions = field.locator('[data-admin-link-controls] > button');
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
    if(!leanPixelScope) await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'FAIL', phase: recoveryPhase ?? 'regression', error: String(error), geometry, errors }, null, 2));
    throw error;
}
finally {
    await browser.close();
}
