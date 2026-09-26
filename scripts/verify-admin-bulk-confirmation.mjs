import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from 'playwright/test';
const root = process.cwd(), out = path.resolve('.tmp-qa/admin-bulk-confirmation-regression', String(process.pid));
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const targets = ['src/components/admin/entity-list/AdminEntityList.tsx', 'src/components/admin/ui/AdminBulkActionBar.tsx'], files = targets.map(file => path.join(root, file));
const entry = path.join(out, 'entry.tsx');
fs.writeFileSync(entry, "import React,{StrictMode,useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport AdminEntityList from '@list';\nimport AdminEntityListSurface from '@src/components/admin/entity-list/AdminEntityListSurface';\nimport AdminBulkActionBar from '@bar';\nimport AdminFeedbackProvider from '@src/components/admin/AdminFeedbackProvider';\nconst params=new URLSearchParams(location.search),mode=params.get('mode')||'list',action=params.get('action')||'restore',custom=params.get('custom'),explicit=params.get('option')==='yes';\nconst rows=[{id:11,label:'Owned first'},{id:12,label:'Owned second'}];\nwindow.calls=[];window.confirmationCalls=[];window.nextOutcome=params.get('outcome');window.focusLog=[];document.addEventListener('focusin',event=>window.focusLog.push({tag:event.target.tagName,bulkSubmit:event.target.matches('[data-admin-bulk-action-bar] button[type=submit]'),feedback:event.target.hasAttribute('data-admin-feedback-entry'),critical:event.target.getAttribute('data-admin-feedback-critical'),dialogSubmit:event.target.hasAttribute('data-admin-confirm-submit'),surface:event.target.hasAttribute('data-admin-entity-list-surface')}));const pendingResolvers=[];window.release=()=>pendingResolvers.splice(0).forEach(resolve=>resolve());\nfunction App(){const[busy,setBusy]=useState(false),[ids,setIds]=useState([11,12]);\n const options=[{value:action,label:'Selected command',...(explicit?{confirmation:{title:'Option confirmation',description:'Declared option confirmation',confirmLabel:'Confirm option'}}:{})}];\n async function execute(value,selected){window.calls.push({action:value,ids:selected});setBusy(true);await new Promise(resolve=>pendingResolvers.push(resolve));setBusy(false);if(window.nextOutcome==='throw')throw new Error('Controlled execute rejection');return{ok:window.nextOutcome==='success'||params.get('success')==='yes',message:'Controlled command result'};}\n const bar=<AdminBulkActionBar selectedIds={ids} entityLabel=\"owned items\" options={options} onClearSelection={()=>setIds([])} isBusy={busy} {...(mode==='form'?{action:async data=>{await execute(data.get('bulk_action'),data.getAll('ids').map(Number));}}:{onExecute:execute})}/>;\n return <AdminFeedbackProvider><main><output data-calls>{window.calls.length}</output>{mode==='list'?<AdminEntityListSurface consumer=\"bounded-mounted-bulk\"><AdminEntityList listId=\"owned-mounted\" rows={rows} columns={[{key:'label',label:'Owned label',primary:true,primaryPresentation:'text-only',sticky:'start',defaultVisible:true,hideable:false,minWidth:150,width:200,renderCell:({row})=>row.label}]} getRowId={row=>row.id} getRowLabel={row=>row.label} sizingStrategy={{mode:'fixed'}} actionsColumnWidth={60} emptyState={{kind:'empty',title:'No rows'}} enableSelection selectionLabel=\"Select all owned rows\" bulkOptions={options} bulkEntityLabel=\"owned items\" onBulkExecute={execute} bulkInteraction={{isBlocked:busy}} getBulkConfirmation={custom!=='none'&&action!=='plain'?(value,selected)=>{window.confirmationCalls.push({action:value,ids:selected});return custom==='null'?null:{title:'Owned '+action,description:'Canonical list-owned confirmation',confirmLabel:'Confirm '+action,cancelLabel:'Cancel owned'};}:undefined} mapResultToFeedback={result=>({variant:result.ok?'success':'danger',title:'Controlled result',message:result.message})}/></AdminEntityListSurface>:bar}</main></AdminFeedbackProvider>;\n}\ncreateRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);\n");
await require('next/dist/build/swc').loadBindings();
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const aliases = { '@src': path.join(root, 'src'), '@list': path.join(root, targets[0]), '@bar': path.join(root, targets[1]) };
const compiler = webpack({ mode: 'development', target: 'web', context: root, entry, output: { path: out, filename: 'fixture.js' }, devtool: false, resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: aliases }, plugins: [new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') }), new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('development') })], module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: [{ loader: require.resolve('next/dist/build/webpack/loaders/next-swc-loader'), options: { rootDir: root, isServer: false, compilerType: 'client', hasReactRefresh: false, nextConfig: {}, jsConfig: {}, swcCacheDir: path.join(out, 'swc-cache'), serverComponents: false, serverReferenceHashSalt: 'bounded-bulk-confirmation-owner', esm: false, transpilePackages: [] } }] }] } });
await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => error || closeError || stats?.hasErrors() ? reject(error ?? closeError ?? Error(JSON.stringify(stats.toJson({ all: false, errors: true }).errors))) : resolve())));
const bundle = fs.readFileSync(path.join(out, 'fixture.js')), server = createServer((request, response) => { response.setHeader('content-type', request.url === '/fixture.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8'); response.end(request.url === '/fixture.js' ? bundle : '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser, activePage;
const findings = [], errors = [];
try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(), page = await context.newPage(), origin = 'http://127.0.0.1:' + server.address().port;
    activePage = page;
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const dialog = () => page.locator('[data-admin-confirm-dialog]'), bar = () => page.locator('[data-admin-bulk-action-bar]'), execute = () => bar().getByRole('button', { name: 'تنفيذ', exact: true }), calls = () => page.evaluate(() => window.calls.length);
    async function start(query) { await page.goto(origin + '/?' + query); if (query.includes('mode=list'))
        await page.getByRole('checkbox', { name: 'Select all owned rows', exact: true }).check(); await expect(execute()).toBeVisible(); assert.deepEqual(await page.evaluate(() => window.confirmationCalls), [], 'Custom confirmation must remain lazy until submit'); }
    async function cancel() { await dialog().locator('[data-admin-confirm-cancel]').click(); await expect(dialog()).toHaveCount(0); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
    await start('mode=list&action=restore');
    await execute().click();
    await expect(dialog()).toContainText('Owned restore');
    await cancel();
    const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, surface: document.activeElement.hasAttribute('data-admin-entity-list-surface'), text: document.activeElement.textContent?.slice(0, 35) }));
    assert.equal(await calls(), 0);
    await expect(execute()).toBeFocused();
    findings.push({ case: 'list-cancel-focus', focus, expectedSubmitFocus: true, zeroExecution: true });
    await start('mode=list&action=delete');
    await execute().click();
    await expect(dialog()).toHaveCount(1);
    await expect(dialog()).toContainText('Owned delete');
    await dialog().locator('[data-admin-confirm-submit]').click();
    await expect.poll(calls).toBe(1);
    findings.push({ case: 'delete-confirmations', confirmationsBeforeExecution: 1, callsAfterOneConfirmation: 1 });
    await page.evaluate(() => window.release());
    await expect(dialog()).toHaveCount(0);
    await start('mode=list&action=restore');
    await execute().click();
    await dialog().locator('[data-admin-confirm-submit]').evaluate(button => { button.click(); button.click(); });
    await expect.poll(calls).toBe(1);
    await expect(dialog().locator('[data-admin-confirm-submit]')).toBeDisabled();
    await expect(dialog().locator('[data-admin-confirm-cancel]')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog()).toHaveCount(1);
    await bar().locator('button[type=submit]').evaluate(button => button.click());
    assert.equal(await calls(), 1);
    await page.evaluate(() => window.release());
    await expect(dialog()).toHaveCount(0);
    findings.push({ case: 'list-pending-dedup', calls: 1, cancelDisabled: true, EscapeRetainsDialog: true, disabledBulkDoesNotRepeat: true });
    for (const mode of ['standalone', 'form']) {
        await start('mode=' + mode + '&action=delete');
        await execute().click();
        await expect(dialog()).toContainText('تأكيد حذف owned items');
        await cancel();
        await expect(execute()).toBeFocused();
        assert.equal(await calls(), 0);
        await execute().click();
        await dialog().locator('[data-admin-confirm-submit]').click();
        await expect.poll(calls).toBe(1);
        const pendingDisabled = await dialog().locator('[data-admin-confirm-submit]').isDisabled();
        if (mode === 'standalone') {
            assert.equal(pendingDisabled, true);
            await dialog().locator('[data-admin-confirm-submit]').evaluate(button => button.click());
            assert.equal(await calls(), 1);
        }
        const observedCalls = await calls();
        await page.evaluate(() => window.release());
        if (mode === 'standalone')
            await expect(dialog()).toHaveCount(0);
        findings.push({ case: mode + '-delete-contract', oneConfirmation: true, oneExecution: observedCalls === 1, cancelFocus: true, pendingDisabled, scope: mode === 'form' ? 'Action-only form pending behavior recorded as baseline compatibility, not changed by list consolidation.' : 'Existing callback pending dedup verified.' });
    }
    await start('mode=list&action=plain');
    await execute().click();
    await expect.poll(calls).toBe(1);
    await expect(dialog()).toHaveCount(0);
    await bar().locator('button[type=submit]').evaluate(button => button.click());
    assert.equal(await calls(), 1);
    await page.evaluate(() => window.release());
    findings.push({ case: 'list-no-confirmation-command', oneExecution: true });
    {
        for (const [query, title, callbackCount] of [
            ['mode=list&action=delete&custom=none', 'تأكيد حذف owned items', 0],
            ['mode=list&action=delete&custom=null', 'تأكيد حذف owned items', 1],
            ['mode=list&action=restore&custom=none&option=yes', 'Option confirmation', 0],
            ['mode=list&action=delete&option=yes', 'Owned delete', 1],
        ]) {
            await start(query);
            await execute().click();
            await expect(dialog()).toHaveCount(1);
            await expect(dialog()).toContainText(title);
            assert.equal(await calls(), 0);
            assert.equal(await page.evaluate(() => window.confirmationCalls.length), callbackCount);
            await cancel();
            await expect(execute()).toBeFocused();
            assert.equal(await calls(), 0);
            await execute().click();
            await dialog().locator('[data-admin-confirm-submit]').click();
            await expect.poll(calls).toBe(1);
            assert.deepEqual(await page.evaluate(() => window.calls[0]), { action: query.includes('action=delete') ? 'delete' : 'restore', ids: [11, 12] });
            await page.evaluate(() => window.release());
            await expect(dialog()).toHaveCount(0);
            findings.push({ case: 'single-confirmation-precedence', query, title, cancelFocus: true, zeroExecutionOnCancel: true, exactIdentityOneExecution: true, confirmationResolvedOnlyOnSubmit: true });
        }
    }
    for (const mode of ['standalone', 'form']) {
        await start('mode=' + mode + '&action=delete&option=yes');
        await execute().click();
        await expect(dialog()).toContainText('Option confirmation');
        await cancel();
        await expect(execute()).toBeFocused();
        assert.equal(await calls(), 0);
        await execute().click();
        await dialog().locator('[data-admin-confirm-submit]').click();
        await expect.poll(calls).toBe(1);
        assert.deepEqual(await page.evaluate(() => window.calls[0]), { action: 'delete', ids: [11, 12] });
        await page.evaluate(() => window.release());
        findings.push({ case: mode + '-option-precedence', exactIdentityOneExecution: true, cancelFocus: true });
    }
    {
        await start('mode=list&action=restore&success=yes');
        await execute().click();
        await dialog().locator('[data-admin-confirm-submit]').click();
        await expect.poll(calls).toBe(1);
        await page.evaluate(() => window.release());
        await expect(dialog()).toHaveCount(0);
        await expect(bar()).toHaveCount(0);
        await expect(page.locator('[data-admin-entity-list-surface]')).toBeFocused();
        findings.push({ case: 'success-unmounts-submit-restores-surface-focus', oneExecution: true, selectionCleared: true, safeFallbackAfterTriggerUnmount: true });
    }
    const selected = () => page.getByRole('checkbox', {name:'Select all owned rows',exact:true});
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for(const outcome of ['rejected-result','throw']) for(const action of ['restore','delete']) {
      await start('mode=list&action='+action+'&outcome='+outcome);
      await execute().click();await expect(dialog()).toHaveCount(1);await expect(dialog()).toContainText('Owned '+action);
      await dialog().locator('[data-admin-confirm-submit]').evaluate(button=>{button.click();button.click();});
      await expect.poll(calls).toBe(1);
      await expect(dialog().locator('[data-admin-confirm-submit]')).toBeDisabled();
      await expect(dialog().locator('[data-admin-confirm-cancel]')).toBeDisabled();
      await expect(bar().locator('button[type=submit]')).toBeDisabled();
      await page.keyboard.press('Escape');await expect(dialog()).toHaveCount(1);
      await bar().locator('button[type=submit]').evaluate(button=>button.click());assert.equal(await calls(),1);
      await page.evaluate(()=>window.release());
      await expect(dialog()).toHaveCount(0);
      const feedback=page.locator('[data-admin-feedback-entry][data-admin-feedback-channel="entity-list:owned-mounted"][data-admin-feedback-variant="danger"]');
      await expect(feedback).toHaveCount(1);await expect(feedback).toBeVisible();await expect(feedback).toHaveAttribute('data-admin-feedback-critical','true');
      await expect(execute()).toBeEnabled();await expect(selected()).toBeChecked();
      assert.deepEqual(await bar().locator('input[name=ids]').evaluateAll(inputs=>inputs.map(input=>Number(input.value))),[11,12]);
      await settle();
      const settledFocus=await page.evaluate(()=>({tag:document.activeElement.tagName,bulkSubmit:document.activeElement.matches('[data-admin-bulk-action-bar] button[type=submit]'),feedback:document.activeElement.hasAttribute('data-admin-feedback-entry'),surface:document.activeElement.hasAttribute('data-admin-entity-list-surface')}));
      const focusEvents=await page.evaluate(()=>window.focusLog);
      await expect(execute()).toBeFocused();
      assert.equal(focusEvents.some(event=>event.feedback&&event.critical==='true'),true,'Failure must use the actual critical Feedback Runtime focus path before the confirmation return frame.');
      assert.equal(await calls(),1,'Settled failure must not automatically repeat mutation.');
      const failureCall=await page.evaluate(()=>window.calls[0]);assert.deepEqual(failureCall,{action,ids:[11,12]});
      // Explicit retry must require one new confirmation, with exact retained IDs.
      await page.evaluate(()=>{window.nextOutcome='success';});
      await execute().click();await expect(dialog()).toHaveCount(1);assert.equal(await calls(),1);
      await dialog().locator('[data-admin-confirm-submit]').evaluate(button=>{button.click();button.click();});
      await expect.poll(calls).toBe(2);await expect(dialog().locator('[data-admin-confirm-submit]')).toBeDisabled();
      await dialog().locator('[data-admin-confirm-submit]').evaluate(button=>button.click());
      await bar().locator('button[type=submit]').evaluate(button=>button.click());assert.equal(await calls(),2);
      assert.deepEqual(await page.evaluate(()=>window.calls),[{action,ids:[11,12]},{action,ids:[11,12]}]);
      await page.evaluate(()=>window.release());await expect(dialog()).toHaveCount(0);await expect(bar()).toHaveCount(0);
      await expect(page.locator('[data-admin-entity-list-surface]')).toBeFocused();
      await expect(selected()).not.toBeChecked();
      await expect(feedback).toHaveCount(1);await expect(feedback).toBeVisible();
      findings.push({case:outcome+'-'+action,settledFocus,focusEvents,criticalFeedbackRevealedAndRetained:true,selectedIdsAfterFailure:[11,12],failureCalls:1,noAutomaticRetry:true,explicitRetryConfirmations:1,totalCalls:2,pendingDuplicatesDenied:true,retryExactIds:true,retrySuccessClearedSelection:true,retrySuccessFallbackSurface:true});
    }
    assert.deepEqual(errors, []);
    await context.close();
    const sourceFiles = [...targets, 'src/components/admin/entity-list/AdminFloatingLayerContext.tsx', 'src/components/admin/entity-list/AdminEntityListSurface.tsx', 'src/components/admin/ui/AdminConfirmDialog.tsx'];
    const result = { status: 'pass', checks: findings.length, findings, errors, sourceSha256: Object.fromEntries(sourceFiles.map((file, i) => [file, createHash('sha256').update(fs.readFileSync(i < 2 ? files[i] : path.join(root, file))).digest('hex')])), boundary: 'Actual installed React StrictMode and current list/bar/floating/dialog/selection owners mounted in Chromium. Only command response and mutation-busy prop are controlled. No application server, DB, network outside owned loopback, Docker or Product mutation.' };
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
}
catch (error) {
    const diagnostic = { error: error.message, errors, body: await activePage?.locator('body').innerText().catch(() => ''), findings };
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(diagnostic, null, 2) + '\n');
    console.log(JSON.stringify(diagnostic));
    throw error;
}
finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
