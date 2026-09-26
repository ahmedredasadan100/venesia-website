import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { expect } from 'playwright/test';

const routes = {
  'projects-hub': '/admin/projects', 'project-locations-hub': '/admin/projects/locations',
  'blocks-library-hub': '/admin/pages-blocks/blocks', 'construction-updates-hub': '/admin/projects/construction-updates',
  'dashboard-recent-content': '/admin', 'reports-hub': '/admin/reports', 'settings-pages': '/admin/settings/integrations',
  'sitemap-monitor': '/admin/seo/sitemap',
};
const categories = { analytics: 'التحليلات', advertising: 'الإعلانات', communication: 'التواصل', crm: 'CRM' };

export function buildCoreReadonlyHubPlan({ collectionAdoption, formManifest, reportDefinitions, integrationDefinitions }) {
  assert.ok(Array.isArray(collectionAdoption.surfaces) && Array.isArray(formManifest));
  const selected = Object.entries(routes).map(([id, route]) => {
    const declarations = collectionAdoption.surfaces.filter(row => row.id === id); assert.equal(declarations.length, 1);
    const declaration = declarations[0]; assert.equal(declaration.generic, false); assert.ok(declaration.routes.includes(route));
    return { id, route, sourceFiles: declaration.pageSourceFiles, workflow: declaration.workflowClassification };
  });
  const reports = collectionAdoption.surfaces.find(row => row.id === 'reports-hub');
  assert.ok(Array.isArray(reportDefinitions) && reportDefinitions.length > 0);
  assert.equal(new Set(reportDefinitions.map(row => row.id)).size, reportDefinitions.length);
  for (const report of reportDefinitions) {
    assert.ok(reports.routes.includes(report.href) && report.href === '/admin/reports/' + report.id);
    assert.ok(report.filters.some(row => row.id === 'all') && report.filters.some(row => row.id !== 'all'));
  }
  const commands = formManifest.find(row => row.id === 'activity-sitemap-media-commands');
  assert.ok(commands?.surfaces.includes('sitemap-check'));
  assert.ok(Array.isArray(integrationDefinitions) && integrationDefinitions.length > 0);
  assert.equal(new Set(integrationDefinitions.map(row => row.key)).size, integrationDefinitions.length);
  assert.ok(integrationDefinitions.every(row => Object.hasOwn(categories, row.category)));
  const remainingIds = ['security-settings', 'integrations-server-configuration', 'media-library-settings', 'maintenance-immediate-setting'];
  const remaining = remainingIds.map(id => {
    const declaration = formManifest.find(row => row.id === id); assert.ok(declaration);
    return { id, surfaces: declaration.surfaces, state: 'remaining-not-executed-by-readonly-hub-family' };
  });
  remaining.push({ id: commands.id, surfaces: commands.surfaces.filter(surface => ['media-command', 'media-usage'].includes(surface)), state: 'remaining-specialized-media-behavior' });
  return { selected, reports: reportDefinitions, integrations: integrationDefinitions, remaining };
}

/** No external provider calls or credentials; selected real owner controls only. */
export async function runCoreReadonlyHubJourneys(ctx) {
  const { page, origin, fixtures, run, observe, nativeCheckpoint, actionResponse, assertActionAcknowledged } = ctx;
  assert.equal(new URL(origin).hostname, '127.0.0.1'); assert.equal(typeof nativeCheckpoint, 'function');
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const [collection, forms, reports, integrations, locations] = await Promise.all([
    jiti.import('../../src/lib/admin/interaction-system/adoption-manifest.ts'),
    jiti.import('../../src/lib/admin/form-system/adoption-manifest.ts'),
    jiti.import('../../src/lib/admin/reports/reports-information-architecture.ts'),
    jiti.import('../../src/lib/admin/integrations/integrations-contract.ts'),
    jiti.import('../../src/lib/admin/projects/location-management-contract.ts'),
  ]);
  const plan = buildCoreReadonlyHubPlan({ collectionAdoption: collection.ADMIN_COLLECTION_SURFACE_ADOPTION,
    formManifest: forms.ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST, reportDefinitions: reports.ADMIN_REPORT_DEFINITIONS,
    integrationDefinitions: integrations.INTEGRATION_DEFINITIONS });
  const outcomes = [], limits = [...plan.remaining];
  const main = page.locator('main').last();
  async function navigate(path) {
    assert.ok(path.startsWith('/admin') && !path.startsWith('//'));
    const leave = async dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss();
    page.on('dialog', leave);
    try { await observe('readonly-hub-navigation', () => page.goto(origin + path, { waitUntil: 'domcontentloaded' })); }
    finally { page.off('dialog', leave); }
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe(new URL(path, origin).pathname);
  }
  async function checkpoint(entity, fields = {}) {
    const request = { id: randomUUID(), kind: 'readonly-hub-state', entity, ...fields };
    const result = await nativeCheckpoint(request);
    assert.equal(result.id, request.id); assert.equal(result.kind, request.kind); assert.equal(result.entity, entity); assert.equal(result.status, 'pass');
    assert.ok(typeof result.ownedRunId === 'string' && result.ownedRunId); return result;
  }
  async function clickLocal(link, path) {
    assert.equal(await link.getAttribute('href'), path); await link.click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe(new URL(path, origin).pathname);
  }
  function outcome(value) { outcomes.push(value); return value; }
  async function listbox(label, option) {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
  let writes = 0, sitemapAllowed = false;
  const blockedWrites = [];
  const readonlyGuard = async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && !['GET', 'HEAD'].includes(request.method())) {
      if (sitemapAllowed && url.pathname === routes['sitemap-monitor'] && request.headers()['next-action']) { sitemapAllowed = false; writes++; }
      else { blockedWrites.push({ method: request.method(), path: url.pathname }); await route.abort('blockedbyclient'); return; }
    }
    await route.fallback();
  };
  await page.route('**/*', readonlyGuard);
  try {
    await run('readonly-hub-project-types-native-count-navigation', [], async () => {
      const native = await checkpoint('projects'); await navigate(routes['projects-hub']);
      for (const type of ['residential', 'commercial']) {
        const path = '/admin/projects/' + type, link = main.locator('a[href="' + path + '"]');
        await expect(link).toHaveCount(1); await expect(link.getByText(native.value[type] + ' مشروع', { exact: true })).toBeVisible();
        await clickLocal(link, path); await expect(main.locator('[data-admin-page-header]')).toBeVisible({ timeout: 60_000 }); await navigate(routes['projects-hub']);
      }
      return outcome({ consumer: 'projects-hub', native: native.id, counts: native.value, actualCardNavigation: true, boundary: 'Current project-type counts; no empty-database or mutation claim.' });
    });
    await run('readonly-hub-location-level-navigation', [], async () => {
      const clicked = [];
      for (const level of locations.PROJECT_LOCATION_LEVELS) {
        await navigate(routes['project-locations-hub']); const path = locations.projectLocationManagementPath(level);
        const link = main.locator('a[href="' + path + '"]'); await expect(link).toContainText(locations.PROJECT_LOCATION_LEVEL_CONFIG[level].label);
        await clickLocal(link, path); await expect(main.locator('[data-admin-page-header]')).toBeVisible({ timeout: 60_000 }); clicked.push(level);
      }
      return outcome({ consumer: 'project-locations-hub', levels: clicked, actualNavigation: true, boundary: 'Fixed structural navigation, no growing collection or database-count claim.' });
    });
    await run('readonly-hub-block-library-active-and-planned-controls', [], async () => {
      const library = collection.ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.find(row => row.id === 'block-template-libraries');
      const linked = library.consumerAdoptionEvidence.filter(row => !['media-hub-template-library', 'media-sidebar-template-library'].includes(row.id));
      for (const entry of linked) {
        await navigate(routes['blocks-library-hub']); const link = main.locator('a[href="' + entry.route + '"]'); await expect(link).toHaveCount(1);
        await clickLocal(link, entry.route); await expect(main.locator('[data-admin-page-header]')).toBeVisible({ timeout: 60_000 });
      }
      await navigate(routes['blocks-library-hub']);
      for (const label of ['معرض الصور', 'الأسئلة الشائعة']) {
        const heading = main.getByRole('heading', { level: 2, name: label, exact: true }); await expect(heading).toBeVisible();
        await expect(heading.locator('xpath=ancestor::a')).toHaveCount(0);
      }
      return outcome({ consumer: 'blocks-library-hub', activatedLibraries: linked.map(row => row.id), plannedCardsAreNonLinks: true,
        boundary: 'Planned non-links are observed availability limits. Media module routing and future planned functionality are not inferred.' });
    });
    await run('readonly-hub-tracking-native-aggregate-navigation', [], async () => {
      const native = await checkpoint('tracking', { projectId: Number(fixtures.project.id) }); await navigate(routes['construction-updates-hub']);
      const path = '/admin/projects/' + native.value.id + '/tracking', card = main.locator('a[href="' + path + '"]');
      await expect(main.getByText('نظام المتابعة متاح', { exact: true })).toBeVisible(); await expect(card).toContainText(native.value.title);
      for (const [label, field] of [['المراحل', 'stageCount'], ['التحديثات', 'updateCount']])
        await expect(card.locator('dt').filter({ hasText: new RegExp('^' + label + '$') }).locator('..').locator('dd')).toHaveText(String(native.value[field]));
      await clickLocal(card, path); await expect(main.locator('[data-admin-page-header]')).toBeVisible({ timeout: 60_000 });
      return outcome({ consumer: 'construction-updates-hub', native: native.id, project: native.value, actualNavigation: true, boundary: 'One owned populated project; the no-project database state was not seeded.' });
    });
    await run('readonly-dashboard-recent-owner-information-and-native-projection', [], async () => {
      const native = await checkpoint('dashboard'); assert.ok(Array.isArray(native.value) && native.value.length > 0);
      await navigate('/admin'); await expect(main.getByRole('heading', { level: 1, name: /^Dashboard (جاهزة|جزئية|غير متاحة)$/ })).toBeVisible({ timeout: 60_000 });
      const region = main.getByRole('region', { name: 'آخر المحتويات', exact: true }); await expect(region).toBeVisible();
      const ids = await region.locator('[data-admin-row-action="more"][data-admin-entity-id]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-admin-entity-id'))));
      assert.deepEqual(ids, native.value.map(row => row.id));
      for (const row of native.value) await expect(region.getByText(row.title, { exact: true })).toBeVisible();
      const row = native.value[0], trigger = region.locator('[data-admin-row-action="more"][data-admin-entity-id="' + row.id + '"] button'); await trigger.click();
      const menu = page.locator('[data-admin-row-actions-menu][data-admin-entity-type="dashboard_recent_topic"]');
      assert.deepEqual(await menu.locator('[data-admin-row-action-menu-item]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-admin-row-action-menu-item'))), ['information']);
      await menu.locator('[data-admin-row-action-menu-item="information"]').click();
      const information = page.locator('[data-admin-row-actions-information][data-admin-entity-type="dashboard_recent_topic"]'); await expect(information).toContainText(row.title);
      await information.getByRole('button', { name: 'رجوع', exact: true }).click(); await expect(menu).toBeVisible(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      const path = '/admin/content/topics/' + row.id; await clickLocal(region.locator('a[href="' + path + '"]'), path);
      return outcome({ consumer: 'dashboard-recent-content', native: native.id, ids, exactCurrentRecentProjection: true, informationBackEscapeFocus: true, mutatingControlsAbsent: true,
        boundary: 'Absent mutation controls are observed current Dashboard scope; no unavailable or empty database simulation.' });
    });
    await run('readonly-integrations-catalog-query-filter-empty-reset', [], async () => {
      await navigate(routes['settings-pages']); const section = main.locator('[aria-labelledby="available-integrations-heading"]'), cards = section.locator('article');
      await expect(cards).toHaveCount(plan.integrations.length, { timeout: 60_000 }); const originalUrl = page.url();
      const search = section.getByRole('searchbox', { name: 'البحث في التكاملات', exact: true });
      const first = plan.integrations[0]; await search.fill(first.label); await expect(cards).toHaveCount(1); await expect(cards).toContainText(first.label);
      await search.fill('no-owned-integration-' + randomUUID()); await expect(cards).toHaveCount(0);
      await expect(section.getByText('لا توجد تكاملات تطابق البحث الحالي', { exact: true })).toBeVisible();
      await section.getByRole('button', { name: 'عرض كل التكاملات', exact: true }).click(); await expect(cards).toHaveCount(plan.integrations.length);
      const category = first.category; await listbox('فلترة حسب الفئة', categories[category]);
      const expected = plan.integrations.filter(row => row.category === category); await expect(cards).toHaveCount(expected.length);
      for (const definition of expected) await expect(cards.getByText(definition.label, { exact: true })).toBeVisible();
      await section.getByRole('button', { name: 'إعادة التعيين', exact: true }).click(); await expect(cards).toHaveCount(plan.integrations.length);
      const statusControl = page.getByRole('combobox', { name: 'فلترة حسب حالة الاتصال', exact: true }); await statusControl.click();
      const options = await page.getByRole('option').allTextContents(); await page.keyboard.press('Escape');
      const candidates = options.map(label => label.trim()).filter(label => label && label !== 'كل الحالات');
      let selected, matching = [];
      for (const candidate of candidates) {
        const present = [];
        for (const definition of plan.integrations) {
          const card = cards.filter({ has: page.getByText(definition.label, { exact: true }) });
          if (await card.getByText(candidate, { exact: true }).count()) present.push(definition.key);
        }
        if (present.length) { selected = candidate; matching = present; break; }
      }
      assert.ok(selected && matching.length); await listbox('فلترة حسب حالة الاتصال', selected); await expect(cards).toHaveCount(matching.length);
      await section.getByRole('button', { name: 'إعادة التعيين', exact: true }).click(); await expect(cards).toHaveCount(plan.integrations.length);
      assert.equal(page.url(), originalUrl, 'This fixed catalog owns local filters, not URL query state.');
      await expect(section.getByRole('button', { name: 'إعادة التعيين', exact: true })).toBeDisabled();
      return outcome({ consumer: 'settings-pages', route: routes['settings-pages'], registryCards: plan.integrations.length, searchEmptyReset: true, category: category, status: selected,
        localQueryUrlUnchanged: true, boundary: 'Catalog controls only. Provider configuration, credentials, testing, authorization, sync and health are remaining work.' });
    });
    for (const report of plan.reports) await run('readonly-report-' + report.id + '-filter-query-contract', [], async () => {
      await navigate('/admin/reports'); const link = main.locator('a[href="' + report.href + '"]').first(); await expect(link).toBeVisible(); await clickLocal(link, report.href);
      await expect(main.getByRole('heading', { level: 1, name: report.label, exact: true })).toBeVisible({ timeout: 60_000 });
      const navigation = main.getByRole('navigation', { name: 'التقارير المستقلة', exact: true });
      await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute('href', report.href);
      const filter = report.filters.find(row => row.id === (report.id === 'analytics' ? 'content' : report.id === 'business' ? 'roi' : report.filters.find(item => item.id !== 'all').id));
      assert.ok(filter); const filters = main.locator('section[aria-label="Global Filters"]');
      const next = reports.buildAdminReportHref(report.id, { filter: filter.id });
      await clickLocal(filters.getByRole('link', { name: filter.label, exact: true }), next);
      await expect.poll(() => new URL(page.url()).searchParams.get('filter'), { timeout: 60_000 }).toBe(filter.id);
      await expect(filters.getByRole('link', { name: filter.label, exact: true })).toHaveAttribute('aria-current', 'true');
      let native;
      if (['analytics', 'business'].includes(report.id)) {
        await filters.getByRole('link', { name: 'آخر 90 يومًا', exact: true }).click();
        await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('last_90_days');
        await filters.getByRole('link', { name: 'الفترة السابقة', exact: true }).click();
        await expect.poll(() => new URL(page.url()).searchParams.get('compare')).toBe('previous_period');
        native = await checkpoint('analytics', { period: 'last_90_days', compare: 'previous_period' });
        assert.equal(native.value.storedReadModelCount, 0, 'The unavailable-source proof requires actual owned absence, never fabricated healthy metrics.');
        await expect(main.getByRole('heading', { name: 'لا توجد بيانات قابلة للعرض في هذا السياق', exact: true })).toBeVisible();
        await expect(main.locator('section').filter({ has: main.getByRole('heading', { name: 'حالة التقرير', exact: true }) }).getByText('غير متاح', { exact: true })).toBeVisible();
      }
      const current = page.url(); await observe('readonly-report-reload', () => page.reload({ waitUntil: 'domcontentloaded' })); assert.equal(page.url(), current);
      await expect(filters.getByRole('link', { name: filter.label, exact: true })).toHaveAttribute('aria-current', 'true');
      const exportHref = await main.getByRole('link', { name: 'تصدير CSV', exact: true }).getAttribute('href');
      const exportUrl = new URL(exportHref, origin); assert.equal(exportUrl.origin, origin); assert.equal(exportUrl.pathname, '/admin/reports/export');
      assert.equal(exportUrl.searchParams.get('report'), report.id); assert.equal(exportUrl.searchParams.get('filter'), filter.id);
      await navigate(report.href + '?unsupported_core_parameter=1');
      await expect(main.getByRole('heading', { name: 'سياق التقرير غير صالح', exact: true })).toBeVisible();
      await clickLocal(main.getByRole('link', { name: 'فتح التقرير بالسياق الأساسي', exact: true }), report.href);
      await expect(filters.getByRole('link', { name: 'الكل', exact: true })).toHaveAttribute('aria-current', 'true');
      return outcome({ consumer: 'reports-hub', report: report.id, filter: filter.id, reloadContextPreserved: true, exportLinkContextMatched: true,
        invalidQueryRejectedThenRecovered: true, ...(native ? { native: native.id, unavailableAnalyticsSourceProven: true } : {}),
        boundary: 'Real report query/navigation semantics. Export execution, print and all metric values are not inferred.' });
    });
    await navigate(routes['sitemap-monitor']);
    const sitemapHref = await main.getByRole('link', { name: 'فتح /sitemap.xml', exact: true }).getAttribute('href');
    const canonicalRow = main.getByRole('region', { name: 'Effective Source Contract', exact: true }).locator('article')
      .filter({ has: page.getByText('canonicalBaseUrl', { exact: true }) });
    await expect(canonicalRow).toHaveCount(1);
    const displayedCanonical = (await canonicalRow.locator(':scope > div').last().innerText()).trim();
    assert.equal(sitemapHref, displayedCanonical.replace(/\/$/, '') + '/sitemap.xml');
    const configuredSitemap = new URL(sitemapHref, origin);
    assert.ok(['http:', 'https:'].includes(configuredSitemap.protocol) && configuredSitemap.pathname.endsWith('/sitemap.xml'));
    // The canonical origin is displayed metadata. The existing check reads owned DB rows and validates strings; never navigate this link.
    await run('readonly-sitemap-local-check-pending-settlement', [], async () => {
      const button = main.getByRole('button', { name: 'تشغيل الفحص الكامل', exact: true }); await expect(button).toBeEnabled();
      const acknowledgement = actionResponse(); acknowledgement.catch(() => {}); sitemapAllowed = true;
      const clicked = button.click(); clicked.catch(() => {});
      await expect(main.getByRole('button', { name: 'جارٍ الفحص...', exact: true })).toBeDisabled();
      assertActionAcknowledged(await acknowledgement); await clicked; await expect(button).toBeEnabled({ timeout: 60_000 });
      await expect(main.getByRole('link', { name: 'فتح /sitemap.xml', exact: true })).toHaveAttribute('href', sitemapHref);
      const checkCount = main.getByText('Checks', { exact: true }).locator('..').locator('p').last();
      await expect(checkCount).toHaveText(/^[1-9][0-9]*$/);
      assert.equal(writes, 1); return outcome({ consumer: 'sitemap-monitor', localReadOnlyCheckAcknowledged: true, pendingSettled: true,
        configuredCanonicalSitemap: configuredSitemap.href, canonicalLinkUnchanged: true, canonicalLinkNavigated: false, externalUrlProbe: false,
        boundary: 'Existing string/owned-DB diagnostics only, even when canonical origin is Production metadata; no endpoint request, diagnostic-health or public-route proof.' });
    });
    assert.deepEqual(blockedWrites, [], 'Read-only Hub controls attempted an unexpected write.');
  } finally { await page.unrouteAll({ behavior: 'wait' }); }
  return { outcomes, limits, sourceInventory: plan.selected, globalClosed: false,
    boundary: 'Selected read-only owner families joined to fixed native counts where claimed. Remaining secret/security/media and unexecuted states stay open.' };
}
