import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url), root = process.cwd(), out = path.join(root, '.tmp-qa/admin-form-layout/browser');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'loader.cjs'), `module.exports=s=>require('typescript').transpileModule(s,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;`);
await writeFile(path.join(out, 'navigation.js'), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});const params=new URLSearchParams();export const useSearchParams=()=>params;export const usePathname=()=>'/admin/fixture';`);
await writeFile(path.join(out, 'actions.js'), `const row={id:'pages:42',resourceId:42,resourceType:'pages',title:'من نحن',slug:'about',publicPath:'/about'};export const browseAdminLinksAjax=async()=>({ok:true,results:[row]});export const browseTopicCategoriesPickerAjax=async()=>({ok:true,items:[]});export const browseMenusPickerAjax=async()=>({ok:true,menus:[]});export const browseMenuItemsPickerAjax=async()=>({ok:true,items:[]});export const resolveAdminLinkAjax=async v=>({ok:true,display:{kind:v.link_kind,kindLabel:'صفحة',title:v.link_kind==='external'?'External':'من نحن',publicPath:(v.href||'/about')+(v.anchor?'#'+v.anchor:''),target:v.target||'_self'}});export const updateHeroTemplateDetails=async()=>{throw Error('No persistence transport permitted')};`);
await writeFile(path.join(out, 'picker.js'), `import React from 'react';export default function Picker({open,onSelect,onClose}){return open?<button type="button" onClick={()=>{onSelect('/wide.png');onClose()}}>Select fixture media</button>:null;}`);
const css = (await require('postcss')([require('@tailwindcss/postcss')({ base: root })]).process('@import "tailwindcss";\n@source "' + root.replaceAll('\\', '/') + '/src";\n@source "' + root.replaceAll('\\', '/') + '/scripts/fixtures/admin-form-layout-browser.jsx";', { from: path.join(root, 'src/app/globals.css') })).css;
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const compiler = webpack({ mode: 'development', target: 'web', entry: path.join(root, 'scripts/fixtures/admin-form-layout-browser.jsx'), output: { path: out, filename: 'bundle.js' }, resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { 'server-only': false, 'next/navigation$': path.join(out, 'navigation.js') } }, plugins: [new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }), new webpack.NormalModuleReplacementPlugin(/lib\/admin\/links\/actions$|^\.\.\/actions$/, path.join(out, 'actions.js')), new webpack.NormalModuleReplacementPlugin(/AdminMediaPickerModal$/, path.join(out, 'picker.js'))], module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(out, 'loader.cjs') }] }, devtool: false });
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(e => error || e || stats.hasErrors() ? reject(error || e || Error(stats.toString({ all: false, errors: true }))) : resolve())));
const binary = await require('sharp')({ create: { width: 400, height: 600, channels: 3, background: '#8d7044' } }).png().toBuffer();
const browser = await chromium.launch({ headless: true });
const errors = [], geometry = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.route('**/*', async (route) => { const req = route.request(), url = new URL(req.url()); assert.equal(url.hostname, '127.0.0.1'); if (url.pathname === '/api/admin/media-library') {
        const b = req.postDataJSON();
        assert.equal(b.operation, 'reference_state');
        return route.fulfill({ json: { deleted: [], missing: [], originals: b.assets.map(value => ({ value, width: 400, height: 600 })) } });
    } if (url.pathname === '/preview-hero')
        return route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><section data-hero-family="fixture" style="height:600px;width:100%;position:relative"><img src="/original.png" style="height:100%;width:100%;object-fit:cover"></section></body></html>' }); if (url.pathname === '/bundle.js')
        return route.fulfill({ contentType: 'application/javascript', body: await readFile(path.join(out, 'bundle.js')) }); if (url.pathname === '/style.css')
        return route.fulfill({ contentType: 'text/css', body: css }); if (url.pathname.endsWith('.png') || url.pathname === '/_next/image')
        return route.fulfill({ contentType: 'image/png', body: binary }); assert.equal(req.method(), 'GET'); return route.fulfill({ contentType: 'text/html', body: '<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>' }); });
    await page.goto('http://127.0.0.1:48199/');
    await page.locator('[data-family="story"] img').first().waitFor();
    await page.locator('[data-family="hero-cta"] [data-admin-link-destination]').first().getByText('من نحن', { exact: true }).waitFor();
    await page.locator('[data-hero-image-composition]').scrollIntoViewIfNeeded();
    await page.locator('[data-hero-rendered-area-state="ready"]').waitFor();
    for (const width of [1440, 1024, 768, 430, 390, 375]) {
        await page.setViewportSize({ width, height: 1000 });
        const result = await page.evaluate(() => { const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }; return { overflow: document.documentElement.scrollWidth > innerWidth, families: [...document.querySelectorAll('[data-family]')].map(e => ({ family: e.dataset.family, overflow: e.scrollWidth > e.clientWidth + 1 })), panels: [...document.querySelector('[data-hero-image-composition] [data-admin-form-grid]').children].map(rect), controls: [...document.querySelector('[data-family="story"] [data-admin-form-grid="control-cards"]').children].filter(e => e.tagName !== 'INPUT').map(rect), gallery: [...document.querySelectorAll('[data-family="gallery"] [data-admin-media-gallery-card="image"]')].map(rect), images: [...document.querySelectorAll('[data-admin-media-image-card="selected"]')].map(e => ({ preview: rect(e), parent: rect(e.parentElement), fit: getComputedStyle(e.querySelector('img')).objectFit })), links: [...document.querySelectorAll('[data-admin-link-field]')].filter(e => e.getBoundingClientRect().width > 0).map(e => ({ field: rect(e), choose: rect(e.querySelector('button')), anchor: e.querySelector('label input') ? { input: rect(e.querySelector('label input')), label: rect(e.querySelector('label span')) } : null })) }; });
        assert(!result.overflow, JSON.stringify({ width, ...result }));
        assert(result.families.every(x => !x.overflow), JSON.stringify({ width, families: result.families }));
        assert(Math.abs(result.panels[0].w - result.panels[1].w) < 2);
        if (width >= 768)
            assert(Math.abs(result.panels[0].h - result.panels[1].h) < 2);
        assert(width < 768 ? result.panels[1].y > result.panels[0].y : Math.abs(result.panels[0].y - result.panels[1].y) < 2);
        assert(width < 768 ? result.gallery[1].y > result.gallery[0].y : Math.abs(result.gallery[0].y - result.gallery[1].y) < 2);
        if (width >= 1280) {
            assert.equal(result.controls.length, 3);
            assert(result.controls.every(x => Math.abs(x.y - result.controls[0].y) < 2));
        }
        if (width < 768)
            assert(result.controls.every((x, i) => !i || x.y > result.controls[i - 1].y));
        assert(result.images.every(x => Math.abs(x.preview.w - x.parent.w) < 3 && x.fit === 'cover'));
        assert(result.links.every(x => x.choose.w > x.field.w / 2 && (!x.anchor || x.anchor.input.y >= x.anchor.label.y + x.anchor.label.h)), JSON.stringify({ width, links: result.links }));
        geometry.push({ width, ...result });
        if ([1440, 390].includes(width))
            for (const family of ['story', 'hero-cta', 'gallery', 'hero', 'footer', 'menu', 'breadcrumb'])
                await page.locator(`[data-family="${family}"]`).screenshot({ path: path.join(out, `${family}-${width}.png`) });
    }
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
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'PASS', geometry, errors, scope: 'Actual components and CSS, controlled transport only; form serialization/remount and controlled Footer callback verified; no DB/storage writes' }, null, 2));
    console.log('PASS Admin form layout: representative families, desktop/mobile geometry, no overflow, current destination/anchor, controls, gallery, original dimensions and save/reload');
}
finally {
    await browser.close();
}
