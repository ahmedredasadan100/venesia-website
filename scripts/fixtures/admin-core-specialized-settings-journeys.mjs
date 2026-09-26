import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { expect } from "playwright/test";

const families = ["security-settings", "integrations-server-configuration", "maintenance-immediate-setting"];
const secret = (password, label) => createHmac("sha256", password).update("qa-specialized-settings/v1:" + label).digest("base64url");
const securityPath = "/admin/settings/security", integrationPath = "/admin/settings/integrations/server-configuration";
export function buildCoreSpecializedSettingsPlan({ manifest, definitions, surfaces, fixtures }) {
  const consumers = families.map(id => {
    const matches = manifest.filter(row => row.id === id); assert.equal(matches.length, 1);
    assert.ok(["specialized_exception", "explicit_exception"].includes(matches[0].classification));
    return { consumer: id, classification: matches[0].classification, surfaces: [...matches[0].surfaces] };
  });
  assert.deepEqual(consumers[0].surfaces, ["password", "session", "security-policy"]);
  assert.deepEqual(consumers[1].surfaces, ["provider-app-credentials", "vault-replacement", "configuration-test"]);
  assert.deepEqual(consumers[2].surfaces, ["immediate-toggle"]);
  assert.equal(new Set(definitions.map(row => row.key)).size, definitions.length);
  assert.deepEqual([...fixtures.providers].sort(), definitions.map(row => row.key).sort());
  assert.deepEqual([...surfaces].sort(), [...definitions.map(row => row.key), "whatsapp"].sort());
  for (const definition of definitions) {
    assert.equal(definition.fields.filter(field => !field.secret).length, 1);
    assert.ok(definition.fields.some(field => field.secret));
    for (const integration of definition.integrations) assert.ok(definition.fields.some(field => field.secret && field.requiredBy.includes(integration)), "An incomplete fixture must prevent every adapter test.");
  }
  assert.ok(Number.isSafeInteger(fixtures.securityActor.id) && fixtures.securityActor.id > 0);
  assert.equal(fixtures.securityActor.username, "qa_core_security_settings");
  return { consumers, providers: definitions, automaticCoverage: [], globalClosed: false,
    nonApplicability: [{ consumer: families[0], surface: "security-policy", reason: "Existing session policy is display-only; there is no policy-edit command." }, { consumer: families[1], surface: "provider-app-credentials", provider: "whatsapp", reason: "Meta owns the shared App credentials; WhatsApp has no separate save form." }],
    remaining: [{ consumer: families[1], surface: "configuration-test", reason: "External positive provider readiness, OAuth and synchronization are unexecuted; only the incomplete pre-adapter rejection is exercised." }] };
}

/** Playwright error call logs can contain fill values; sensitive failures expose only a fixed diagnostic. */
export async function fillCorePrivateField(field, value) {
  try { await field.fill(value); } catch { throw new Error("The private owned fixture field could not be filled; its value is redacted."); }
}

/** Runs only against the existing owned local app; secrets and retained cookies remain in memory. */
export async function runCoreSpecializedSettingsJourneys(ctx) {
  const { page, browser, origin, fixtures, run, observe, ownedNetworkOnly, nativeCheckpoint, login } = ctx;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.ok(login?.password && login?.username && typeof ownedNetworkOnly === "function");
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
  const { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST: manifest } = await jiti.import("../../src/lib/admin/form-system/adoption-manifest.ts");
  const { INTEGRATION_APP_CONFIGURATION_DEFINITIONS: definitions, INTEGRATION_APP_CONFIGURATION_SURFACES: surfaces } = await jiti.import("../../src/lib/admin/integrations/server-configuration-contract.ts");
  const plan = buildCoreSpecializedSettingsPlan({ manifest, definitions, surfaces, fixtures: fixtures.specializedSettings });
  const completed = [], checkpoints = [];
  const checkpoint = async (entity, phase, provider) => {
    const request = { id: randomUUID(), kind: "specialized-settings-state", entity, phase, ...(provider ? { provider } : {}) };
    const result = await nativeCheckpoint(request);
    for (const key of Object.keys(request)) assert.equal(result[key], request[key]);
    assert.equal(result.status, "pass"); checkpoints.push(result); return result;
  };
  const navigate = (target, path) => observe("specialized-navigation", () => target.goto(origin + path, { waitUntil: "domcontentloaded" }));
  const action = async (target, trigger, positive = true) => {
    const [response] = await observe("specialized-action-response", () => Promise.all([
      target.waitForResponse(response => response.request().method() === "POST" && response.request().headers()["next-action"] && new URL(response.url()).origin === origin), trigger(),
    ]));
    // Flight's action model may settle before EOF. HTTP acknowledgement alone is not semantic success.
    if (positive) assert.ok(response.status() < 400, "The owned action must acknowledge the command.");
    return response.status();
  };
  const newContext = async storageState => {
    const context = await browser.newContext({ ...(storageState ? { storageState } : {}) });
    context.setDefaultTimeout(30_000); context.setDefaultNavigationTimeout(60_000);
    await context.route("**/*", ownedNetworkOnly); return context;
  };
  const loginSecurity = async (target, password) => {
    await navigate(target, "/admin/login");
    await target.locator('input[name="username"]').fill(fixtures.specializedSettings.securityActor.username);
    await fillCorePrivateField(target.locator('input[name="password"]'), password);
    await Promise.all([target.waitForURL(url => url.pathname !== "/admin/login", { timeout: 60_000 }), target.getByRole("button", { name: "دخول لوحة التحكم", exact: true }).click()]);
    await navigate(target, securityPath); await expect(target.getByRole("heading", { name: "الأمان", exact: true })).toBeVisible();
  };
  const revokedCookieDenied = async storageState => {
    const retained = await newContext(storageState);
    try {
      const target = await retained.newPage(); await navigate(target, securityPath);
      await expect(target).toHaveURL(url => url.pathname === "/admin/login");
      await expect(target.locator('input[name="password"]')).toBeVisible();
    } finally { await retained.close(); }
  };
  const confirm = target => target.locator("[data-admin-confirm-submit]");
  const cancel = target => target.locator("[data-admin-confirm-cancel]");
  const danger = target => target.locator('[data-admin-feedback-entry][data-admin-feedback-variant="danger"]').first();
  const success = target => target.locator('[data-admin-feedback-entry][data-admin-feedback-variant="success"], [data-admin-feedback-entry][data-admin-feedback-variant="warning"]').first();

  await run("core-specialized-security-disposable-account", [], async () => {
    const context = await newContext(), target = await context.newPage();
    const initial = secret(login.password, "security:initial"), changed = secret(login.password, "security:changed");
    try {
      await loginSecurity(target, initial); await checkpoint("security", "baseline");
      const passwordForm = target.locator("form").filter({ has: target.getByRole("button", { name: "حفظ كلمة المرور", exact: true }) });
      const fillPassword = async (current, next, confirmation = next) => {
        await fillCorePrivateField(passwordForm.getByPlaceholder("كلمة المرور الحالية", { exact: true }), current);
        await fillCorePrivateField(passwordForm.getByPlaceholder("كلمة المرور الجديدة", { exact: true }), next);
        await fillCorePrivateField(passwordForm.getByPlaceholder("تأكيد كلمة المرور الجديدة", { exact: true }), confirmation);
      };
      await fillPassword(initial, changed, initial);
      await passwordForm.getByRole("button", { name: "حفظ كلمة المرور", exact: true }).click();
      await expect(danger(target)).toContainText("تأكيد كلمة المرور غير متطابق.");
      await fillPassword(secret(login.password, "security:wrong"), changed);
      await action(target, () => passwordForm.getByRole("button", { name: "حفظ كلمة المرور", exact: true }).click(), false);
      await expect(danger(target)).toContainText("تعذر تحديث كلمة المرور");
      assert.equal(await passwordForm.getByPlaceholder("كلمة المرور الجديدة", { exact: true }).inputValue() === changed, true, "Rejected input remains only in memory.");
      await checkpoint("security", "rejected");
      await target.locator('[data-admin-tab-id="account"]').click();
      const account = target.locator("form").filter({ has: target.getByRole("button", { name: "حفظ بيانات الحساب", exact: true }) });
      for (const [name, phase] of [["QA Core Security Edited", "account-saved"], ["QA Core Security", "account-restored"]]) {
        await account.getByPlaceholder("الاسم الكامل", { exact: true }).fill(name);
        await action(target, () => account.getByRole("button", { name: "حفظ بيانات الحساب", exact: true }).click());
        await expect(success(target)).toContainText("تم حفظ بيانات الحساب"); await checkpoint("security", phase);
        await navigate(target, securityPath); await target.locator('[data-admin-tab-id="account"]').click();
        await expect(account.getByPlaceholder("الاسم الكامل", { exact: true })).toHaveValue(name);
      }
      await target.locator('[data-admin-tab-id="password"]').click();
      const beforePasswordChange = await context.storageState();
      for (const [current, next, phase] of [[initial, changed, "password-changed"], [changed, initial, "password-restored"]]) {
        await fillPassword(current, next);
        await action(target, () => passwordForm.getByRole("button", { name: "حفظ كلمة المرور", exact: true }).click());
        await expect(success(target)).toContainText("تم تحديث كلمة المرور بنجاح.");
        assert.equal(await passwordForm.getByPlaceholder("كلمة المرور الجديدة", { exact: true }).inputValue() === "", true);
        await checkpoint("security", phase); await navigate(target, securityPath);
        await expect(target.getByRole("heading", { name: "الأمان", exact: true })).toBeVisible();
        if (phase === "password-changed") await revokedCookieDenied(beforePasswordChange);
      }
      await target.locator('[data-admin-tab-id="sessions"]').click();
      await expect(target.getByText("عند تغيير كلمة المرور أو البريد أو إلغاء الجلسات، يتم إبطال الجلسات النشطة الأخرى حسب", { exact: false })).toBeVisible();
      const sessions = target.locator("form").filter({ has: target.getByRole("button", { name: "إلغاء جميع الجلسات", exact: true }) });
      await fillCorePrivateField(sessions.getByPlaceholder("كلمة المرور الحالية", { exact: true }), initial);
      await sessions.getByRole("button", { name: "إلغاء جميع الجلسات", exact: true }).click(); await cancel(target).click();
      await expect(target.locator("[data-admin-confirm-dialog]")).toHaveCount(0);
      await checkpoint("security", "sessions-cancelled");
      const beforeRevoke = await context.storageState();
      await sessions.getByRole("button", { name: "إلغاء جميع الجلسات", exact: true }).click();
      await action(target, () => confirm(target).click());
      await expect(target).toHaveURL(url => url.pathname === "/admin/login");
      await checkpoint("security", "sessions-revoked"); await revokedCookieDenied(beforeRevoke);
      await loginSecurity(target, initial);
    } finally { await context.close(); }
    completed.push({ consumer: families[0], surfaces: ["password", "session"], accountNameSaveRestored: true, primaryActorUntouched: true, passwordRestored: true, retainedSignedCookiesDenied: 2, policyDisplayVerified: true });
  });

  for (const definition of plan.providers) await run(`core-specialized-integration-${definition.key}`, [], async () => {
    const provider = definition.key; let baselineVerified = false, removed = false, staleContext;
    const article = target => target.locator(`article#${provider}`);
    const input = (target, field) => article(target).locator(`input[name="${field.key}"]`);
    const checkSecretsBlank = async target => {
      for (const field of definition.fields.filter(field => field.secret)) assert.equal(await input(target, field).inputValue() === "", true, "Saved secrets must not return in the UI.");
    };
    const mutate = async (target, operation, trigger, expectedStatus = 200) => {
      const [response] = await observe("specialized-integration-response", () => Promise.all([
        target.waitForResponse(response => response.request().method() === "POST" && response.url() === `${origin}/api/admin/integrations/server-configuration/${provider}`), trigger(),
      ]));
      assert.equal(response.status(), expectedStatus); let payload;
      try { payload = await response.json(); } catch { throw new Error("The owned configuration response was not valid JSON; its body is redacted."); }
      assert.equal(payload.ok, expectedStatus === 200);
      const serialized = JSON.stringify(payload);
      for (const field of definition.fields.filter(field => field.secret)) for (const revision of ["a", "b"]) assert.equal(serialized.includes(secret(login.password, `integration:${provider}:${field.key}:${revision}`)), false, "API responses never return the synthetic secret.");
      if (expectedStatus === 409) assert.equal(payload.error, "integration_app_configuration_version_conflict");
      else await expect(article(target).getByRole("status").last()).toContainText(operation === "save" ? "حُفظ الإعداد داخل Vault" : operation === "test" ? "اكتمل الاختبار الآمن" : "حُذف App Configuration");
      await expect(article(target).locator('button[type="submit"]')).toBeEnabled(); return payload;
    };
    const save = target => mutate(target, "save", () => article(target).locator('button[type="submit"]').click());
    const remove = async () => {
      await article(page).getByRole("button", { name: "حذف App Configuration", exact: true }).click();
      await mutate(page, "remove", () => confirm(page).click());
      await expect(article(page).getByRole("button", { name: "حذف App Configuration", exact: true })).toBeDisabled();
    };
    try {
      await navigate(page, integrationPath); await checkpoint("integration", "baseline", provider); baselineVerified = true;
      await expect(article(page).locator('button[type="submit"]')).toBeEnabled();
      for (const field of definition.fields) await input(page, field).fill(field.secret ? "" : `qa-${provider}-application`);
      await save(page); await checkpoint("integration", "incomplete", provider);
      await navigate(page, integrationPath);
      for (const field of definition.fields.filter(field => field.secret)) await expect(article(page).getByText(new RegExp(`Missing:.*${field.key}`, "u")).first()).toBeVisible();
      const tested = await mutate(page, "test", () => article(page).getByRole("button", { name: "اختبار الإعداد", exact: true }).click());
      assert.deepEqual(tested.result.results.map(row => row.integration).sort(), [...definition.integrations].sort());
      assert.ok(tested.result.results.every(row => row.status === "configuration_incomplete" && row.safeErrorCode === "integration_app_configuration_incomplete"));
      await checkpoint("integration", "incomplete-tested", provider);
      staleContext = await newContext(await page.context().storageState()); const stale = await staleContext.newPage(); await navigate(stale, integrationPath);
      for (const field of definition.fields.filter(field => field.secret)) await fillCorePrivateField(input(page, field), secret(login.password, `integration:${provider}:${field.key}:a`));
      await save(page); await checkpoint("integration", "saved", provider); await checkSecretsBlank(page);
      await mutate(stale, "save", () => article(stale).locator('button[type="submit"]').click(), 409);
      await expect(article(stale).getByRole("alert")).toBeVisible(); await checkpoint("integration", "stale-rejected", provider);
      await staleContext.close(); staleContext = null;
      await navigate(page, integrationPath); await checkSecretsBlank(page); await save(page);
      await checkpoint("integration", "blank-preserved", provider);
      await navigate(page, integrationPath);
      for (const field of definition.fields.filter(field => field.secret)) await fillCorePrivateField(input(page, field), secret(login.password, `integration:${provider}:${field.key}:b`));
      await save(page); await checkpoint("integration", "replaced", provider); await navigate(page, integrationPath); await checkSecretsBlank(page);
      if (provider === "meta") { await expect(page.locator("article#whatsapp form")).toHaveCount(0); await expect(page.locator('article#whatsapp a[href="#meta"]')).toBeVisible(); }
      await article(page).getByRole("button", { name: "حذف App Configuration", exact: true }).click(); await cancel(page).click();
      await checkpoint("integration", "remove-cancelled", provider); await remove(); await checkpoint("integration", "removed", provider); removed = true;
    } finally {
      if (staleContext) await staleContext.close();
      if (baselineVerified && !removed) {
        await navigate(page, integrationPath);
        const button = article(page).getByRole("button", { name: "حذف App Configuration", exact: true });
        if (await button.isEnabled()) await remove();
        await checkpoint("integration", "cleanup", provider);
      }
    }
    completed.push({ consumer: families[1], provider, surfaces: ["provider-app-credentials", "vault-replacement", "configuration-test"], incompletePreAdapterTest: true, staleVersionRejected: true, blankSecretPreserved: true, secretReplaced: true, removedAndVaultClean: true, externalPositiveReadiness: "unexecuted" });
  });

  await run("core-specialized-maintenance-restored", [], async () => {
    let baselineVerified = false, restored = false;
    const anonymous = await newContext(), visitor = await anonymous.newPage();
    const enable = () => page.getByRole("button", { name: "تشغيل الصيانة", exact: true });
    const disable = () => page.getByRole("button", { name: "إيقاف الصيانة", exact: true });
    const turnOff = async () => {
      await disable().click(); await action(page, () => confirm(page).click());
      await expect(enable()).toHaveAttribute("aria-pressed", "false"); await expect(success(page)).toBeVisible();
    };
    try {
      await navigate(page, "/admin/settings/general"); await checkpoint("maintenance", "baseline"); baselineVerified = true;
      await expect(enable()).toHaveAttribute("aria-pressed", "false");
      await enable().click(); await cancel(page).click(); await checkpoint("maintenance", "cancelled");
      await enable().click(); await action(page, () => confirm(page).click());
      await expect(disable()).toHaveAttribute("aria-pressed", "true"); await expect(success(page)).toBeVisible();
      await checkpoint("maintenance", "enabled");
      // The existing proxy owner intentionally memoizes maintenance reads for 5 seconds.
      await observe("specialized-maintenance-policy-ttl", () => new Promise(resolve => setTimeout(resolve, 5_100)));
      await navigate(visitor, "/");
      await expect(visitor).toHaveURL(url => url.pathname === "/maintenance");
      await navigate(page, "/admin/settings/general"); await expect(disable()).toBeEnabled();
    } finally {
      try {
        if (baselineVerified) {
          await navigate(page, "/admin/settings/general");
          if (await disable().count() === 1) await turnOff();
          await expect(enable()).toHaveAttribute("aria-pressed", "false");
          await checkpoint("maintenance", "restored"); restored = true;
          await observe("specialized-maintenance-policy-ttl", () => new Promise(resolve => setTimeout(resolve, 5_100)));
          await navigate(visitor, "/"); await expect(visitor).toHaveURL(url => url.pathname === "/");
        }
      } finally { await anonymous.close(); }
    }
    assert.equal(restored, true); completed.push({ consumer: families[2], surface: "immediate-toggle", cancelPreserved: true, anonymousMaintenanceRedirect: true, adminRemainedAvailable: true, restoredInFinally: true, existingProxyTtlMs: 5_000 });
  });
  return { status: completed.length === 2 + definitions.length ? "pass" : "fail", globalClosed: false, automaticCoverage: [], consumers: plan.consumers, completed, checkpoints, nonApplicability: plan.nonApplicability, remaining: plan.remaining };
}
