import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
const require = createRequire(import.meta.url), root = process.cwd(), out = path.join(root, '.tmp-qa/admin-form-layout/browser');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'loader.cjs'), `module.exports=s=>require('typescript').transpileModule(s,{compilerOptions:{jsx:4,target:9,module:99}}).outputText;`);
await writeFile(path.join(out, 'navigation.js'), `export {unstable_rethrow} from 'next/dist/client/components/unstable-rethrow.browser';export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});const params=new URLSearchParams();export const useSearchParams=()=>params;export const usePathname=()=>'/admin/fixture';`);
await writeFile(path.join(out, 'actions.js'), `const row={id:'pages:42',resourceId:42,resourceType:'pages',title:'من نحن',slug:'about',publicPath:'/about'};export const browseAdminLinksAjax=async()=>({ok:true,results:[row]});export const browseTopicCategoriesPickerAjax=async()=>({ok:true,items:[]});export const browseMenusPickerAjax=async()=>({ok:true,menus:[]});export const browseMenuItemsPickerAjax=async()=>({ok:true,items:[]});export const resolveAdminLinkAjax=async v=>({ok:true,display:{kind:v.link_kind,kindLabel:v.link_kind==='external'?'خارجي':'صفحة',title:v.link_kind==='external'?v.href:'من نحن',publicPath:(v.href||'/about')+(v.anchor?'#'+v.anchor:''),target:v.target||'_self'}});export const updateHeroTemplateDetails=async()=>{throw Error('No persistence transport permitted')};`);
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
        const result = await page.evaluate(() => {
            const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
            return {
                overflow: document.documentElement.scrollWidth > innerWidth,
                families: [...document.querySelectorAll('[data-family]')].map(e => ({ family: e.dataset.family, overflow: e.scrollWidth > e.clientWidth + 1 })),
                panels: [...document.querySelector('[data-hero-image-composition] [data-admin-form-grid]').children].map(rect),
                controls: [...document.querySelector('[data-family="story"] [data-admin-form-grid="control-cards"]').children].filter(e => e.tagName !== 'INPUT').map(rect),
                ctaCards: [...document.querySelectorAll('[data-family="hero-cta"] [data-module-editor-cta-card]')].map(e => ({ kind: e.dataset.moduleEditorCtaCard, ...rect(e) })),
                gallery: [...document.querySelectorAll('[data-family="gallery"] [data-admin-media-gallery-card="image"]')].map(rect),
                images: [...document.querySelectorAll('[data-admin-media-image-card="selected"]')].map(e => ({ preview: rect(e), parent: rect(e.parentElement), fit: getComputedStyle(e.querySelector('img')).objectFit })),
                links: [...document.querySelectorAll('[data-admin-link-field]')].filter(e => e.getBoundingClientRect().width > 0).map(e => {
                    const row = e.querySelector('[data-admin-link-controls]');
                    const destination = e.querySelector('[data-admin-link-destination]');
                    return { field: rect(e), row: rect(row), destination: rect(destination),
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
            assert.equal(result.controls.length, 3);
            assert(result.controls.every(x => Math.abs(x.y - result.controls[0].y) < 2));
        }
        if (width < 768)
            assert(result.controls.every((x, i) => !i || x.y > result.controls[i - 1].y));
        assert(result.images.every(x => Math.abs(x.preview.w - x.parent.w) < 3 && x.fit === 'cover'));
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
        geometry.push({ width, ...result });
        if ([1440, 390].includes(width))
            for (const family of ['story', 'hero-cta', 'gallery', 'hero', 'footer', 'menu', 'breadcrumb'])
                await page.locator(`[data-family="${family}"]${family === 'hero-cta' ? ' [data-module-editor-cta-grid]' : ''}`).screenshot({ path: path.join(out, `${family}-${width}.png`) });
    }
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
    assert.deepEqual(errors, []);
    await writeFile(path.join(out, 'receipt.json'), JSON.stringify({ status: 'PASS', geometry, errors, ctaSaved: savedCta, scope: 'Actual components and CSS, controlled transport only; six RTL viewport geometries, accessible icon controls, keyboard picker focus/return, CTA select/clear and canonical FormData/remount, synchronized formatting, controlled Footer callback and inherited disabled state; no native DB/storage proof or writes' }, null, 2));
    console.log('PASS Admin form layout: six RTL widths; CTA cards, shared icon links, long paths, keyboard picker focus/return, select/clear, formatting, serialization/remount, disabled state and representative consumers');
}
finally {
    await browser.close();
}
