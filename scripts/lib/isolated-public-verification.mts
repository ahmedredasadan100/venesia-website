import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import net from "node:net";
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEntitySeoPersistenceOwner } from "../backfill-entity-seo-scores.mts";
import type { TopicSeoSource } from "../../src/lib/admin/seo/entity-seo-persistence.ts";
import type { OwnedLocalHandle } from "./isolated-supabase.mts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const FIXTURE_SLUG = "isolated-public-property-ownership";
const FIXTURE_CATEGORY = "isolated-public-articles";
const FIXTURE_DATE = "2026-01-01T00:00:00.000Z";
const SOURCE_ROOTS = new Set(["src", "scripts", "sql", "tests", "docs", "public", ".github"]);
const SOURCE_ROOT_FILES = new Set([
  "AGENTS.md", "AI_ARCHITECTURE_PRINCIPLES.md", "CLAUDE.md", "README.md", ".gitignore",
  "eslint.config.mjs", "next.config.ts", "package-lock.json", "package.json", "playwright.config.ts",
  "postcss.config.mjs", "tsconfig.json", "vercel.json",
]);
const GATES = [
  { name: "normal-build", module: "next/dist/bin/next", args: ["build"], limitMs: 900_000 },
  { name: "product-surface-build", script: "scripts/verify-product-surface-identity.mts", args: ["--build"], limitMs: 180_000 },
  { name: "platform-contracts", script: "scripts/verify-platform.mts", args: ["--contracts-only"], limitMs: 180_000 },
  { name: "public-e2e", module: "playwright/cli.js", args: ["test", "tests/e2e/public-foundation.spec.ts", "tests/e2e/topic-view-integrity.spec.ts", "--workers=1", "--retries=0"], limitMs: 600_000 },
] as const;

/** Constructed only inside the canonical lifecycle; never returned by its handle. */
export type PrivatePublicVerificationContext = {
  runDirectory: string;
  apiPort: number;
  anonKey: string;
  serviceKey: string;
  cleanEnvironment(): NodeJS.ProcessEnv;
  assertOwned(): Promise<void>;
  sanitize(value: string): string;
  record(stage: string, values: Record<string, string | number | boolean | null>): void;
};
export type PublicGateRequest = {
  additionalSourceFiles: readonly string[];
  /** Fixed affected-build subset; omission retains the complete Public gate contract. */
  selection?: "build-contracts";
};
export type PublicFixtureReadiness = {
  status: "ready"; latestVersion: string; registeredMigrations: number;
  syntheticTopicCreated: boolean; syntheticCategoryCreated: boolean;
  articlePublicationValid: true; persistedSeoValid: true; searchCompositionReady: true;
  topicsCmsState: "absent"; topicsListingState: "fallback"; topicsManageabilityGap: true;
  requiredSearchCompositions: 2;
  localDataApiReadable: true; sourceOwnerFingerprint: string; fixtureContentSha256: string;
};
const prepared = new WeakMap<PrivatePublicVerificationContext, PublicFixtureReadiness>();
const completed = new WeakSet<PrivatePublicVerificationContext>();

function ownedPath(context: PrivatePublicVerificationContext, name: string) {
  assert.ok(!isAbsolute(name) && !name.split(/[\\/]/u).includes(".."));
  const path = resolve(context.runDirectory, name);
  assert.ok(path.startsWith(resolve(context.runDirectory) + sep));
  return path;
}
function receipt(context: PrivatePublicVerificationContext, name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  assert.equal(context.sanitize(text), text, "Public receipt contains a generated credential.");
  writeFileSync(ownedPath(context, name), `${text}\n`, { flag: "wx", mode: 0o600 });
}
const identifier = (value: string) => {
  assert.match(value, /^[a-z_][a-z0-9_]*$/u); return `"${value}"`;
};

/** Node-only resolution for actual pure publication modules, without mocks. */
async function publicationOwner() {
  type Context = { parentURL?: string };
  type Result = { url: string };
  const { registerHooks } = nodeModule as unknown as { registerHooks(value: {
    resolve(specifier: string, context: Context, next: (specifier: string, context: Context) => Result): Result;
  }): { deregister(): void } };
  assert.equal(typeof registerHooks, "function");
  const sourceRoot = new URL("../../src/", import.meta.url);
  const hook = registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ERR_MODULE_NOT_FOUND"
        || !context.parentURL?.startsWith(sourceRoot.href) || !(specifier.startsWith("./") || specifier.startsWith("../"))
        || extname(specifier) || /[?#]/u.test(specifier)) throw error;
      const target = new URL(`${specifier}.ts`, context.parentURL);
      if (!target.href.startsWith(sourceRoot.href)) throw error;
      return next(target.href, context);
    }
  } });
  try { return await import("../../src/lib/admin/content-workflow/topic-publish-validation.ts"); }
  finally { hook.deregister(); }
}

export async function prepareOwnedPublicVerification(context: PrivatePublicVerificationContext, handle: OwnedLocalHandle): Promise<PublicFixtureReadiness> {
  await context.assertOwned();
  assert.equal(prepared.has(context), false, "Public fixture preparation is one-shot per owned run.");
  const files = readdirSync(join(ROOT, "sql/migrations")).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file)).sort();
  const registry = (await handle.query("select version,name from supabase_migrations.schema_migrations order by version")).rows;
  assert.deepEqual(registry.map(row => `${row.version}_${row.name}.sql`), files, "Public fixtures require the complete current application corpus.");
  const topicsPages = (await handle.query("select id,slug,path from public.pages where slug='topics' or path='/topics'")).rows;
  assert.equal(topicsPages.length, 0, "The approved fresh Public fixture requires the absent Topics CMS state; do not manufacture or repair it.");
  const seo = loadEntitySeoPersistenceOwner();
  const owner = await publicationOwner();
  const columns = [...new Set([...seo.TOPIC_SEO_SOURCE_COLUMNS, "id", "status", "deleted_at", "category_slug", "category_id", "canonical_url", "seo_score", "seo_score_version", "seo_score_input_hash"])];
  const readCandidates = () => handle.query(`select ${columns.map(identifier).join(",")} from public.topics
    where status='published' and deleted_at is null and content_type='article' and title like '%ملكية%' order by id`);
  const qualifies = (row: Record<string, unknown>) => {
    const input = owner.topicRowToPublishInput(row);
    if (owner.getTopicPublishValidationError(input) !== null || !/^#{2,4}\s+\S/mu.test(input.content)) return false;
    const score = seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource));
    return row.seo_score === score.seo_score && row.seo_score_version === score.seo_score_version && row.seo_score_input_hash === score.seo_score_input_hash;
  };
  let article = (await readCandidates()).rows.find(qualifies);
  let syntheticTopicCreated = false, syntheticCategoryCreated = false;
  if (!article) {
    assert.equal((await handle.query("select id from public.topics where slug=$1", [FIXTURE_SLUG])).rows.length, 0, "An incompatible existing fixture must not be repaired.");
    await handle.query("begin");
    try {
      // This category is synthetic fixture data, never an application default.
      let category = (await handle.query(`with recursive media as (
        select id from public.topic_categories where slug='media-center'
        union all select c.id from public.topic_categories c join media p on c.parent_id=p.id)
        select id,name,slug from public.topic_categories where parent_id is null and status='published'
          and is_active is true and id not in (select id from media) order by id limit 1`)).rows[0];
      if (!category) {
        assert.equal((await handle.query("select id from public.topic_categories where slug=$1", [FIXTURE_CATEGORY])).rows.length, 0);
        category = (await handle.query(`insert into public.topic_categories(name,slug,status,is_active,show_in_menu,created_at,updated_at)
          values('مقالات التحقق المعزول',$1,'published',true,false,$2,$2) returning id,name,slug`, [FIXTURE_CATEGORY, FIXTURE_DATE])).rows[0];
        syntheticCategoryCreated = true;
      }
      const row: Record<string, unknown> = {
        slug: FIXTURE_SLUG, title: "ملكية العقارات: دليل اصطناعي للتحقق من القراءة والبحث",
        excerpt: "مقال اصطناعي داخل بيئة الاختبار المعزولة للتحقق من عرض المحتوى العربي والبحث فيه والتنقل بين صفحاته.",
        content: "## ملكية العقارات\n\nهذا المقال بيانات اصطناعية للاختبار المعزول، ويتيح التحقق من القراءة والبحث دون استخدام بيانات حقيقية.\n\n### مراجعة المعلومات\n\nتعرض الفقرة بنية دلالية واضحة مع عنوان فرعي ومحتوى قابل للقراءة. يمكن العودة إلى [الموضوعات](/topics) لمتابعة التنقل.\n\n### التخطيط للخطوات التالية\n\nنستخدم هذه البيانات للتحقق من عرض المحتوى العربي وترتيب العناوين وسلوك الاقتراحات في البحث فقط.",
        image: "/images/venesia-5.png", image_alt: "صورة توضيحية لمقال التحقق المعزول",
        category: category.name, category_slug: category.slug, category_id: category.id,
        content_type: "article", status: "published", deleted_at: null,
        seo_title: "دليل ملكية العقارات وفهم خطوات الشراء والاستثمار الآمن",
        seo_description: "محتوى اصطناعي معزول يشرح ملكية العقارات وخطوات مراجعة المستندات والتخطيط المالي، لاختبار عرض المقالات والبحث والتنقل دون بيانات حقيقية.",
        seo_keywords: ["ملكية", "عقارات"], focus_keyword: "ملكية", canonical_url: null,
        og_image: null, og_image_alt: "", robots_index: true, robots_follow: true, faq: [],
        show_title_on_page: true, show_image_on_page: true, show_excerpt_on_page: true,
        created_at: FIXTURE_DATE, updated_at: FIXTURE_DATE, published_at: FIXTURE_DATE,
      };
      assert.ok(existsSync(join(ROOT, "public", String(row.image))));
      assert.equal(owner.getTopicPublishValidationError(owner.topicRowToPublishInput(row)), null, "Synthetic article must satisfy the current publication owner.");
      Object.assign(row, seo.deriveEntitySeoScore(seo.toTopicSeoScoreInput(row as TopicSeoSource)));
      const fields = Object.keys(row);
      await handle.query(`insert into public.topics(${fields.map(identifier).join(",")}) values(${fields.map((field, index) => `$${index + 1}${field === "faq" ? "::jsonb" : ""}`).join(",")})`,
        fields.map(field => field === "faq" ? JSON.stringify(row[field]) : row[field]));
      article = (await readCandidates()).rows.find(qualifies);
      assert.ok(article, "Synthetic article readback did not meet the canonical publication/SEO contract.");
      await handle.query("commit"); syntheticTopicCreated = true;
    } catch (error) { await handle.query("rollback"); throw error; }
  }
  const composition = (await handle.query(`select p.slug as page_slug,t.slug as template_slug,p.status as page_status,
      t.status as template_status,a.is_visible from public.pages p
      join public.page_content_block_assignments a on a.page_id=p.id
      join public.content_block_templates t on t.id=a.template_id
      where (p.slug,t.slug) in (('media-center-news','media-news-search'),('search','search-platform'))
      order by p.slug,t.slug`)).rows;
  assert.deepEqual(composition.map(row => [row.page_slug, row.template_slug]),
    [["media-center-news", "media-news-search"], ["search", "search-platform"]],
    "The existing Search composition migration must supply Media News and central Search without a fabricated Topics page.");
  assert.ok(composition.every(row => row.page_status === "published" && row.template_status === "published" && row.is_visible === true));
  const response = await fetch(`http://127.0.0.1:${context.apiPort}/rest/v1/topics?select=id&slug=eq.${encodeURIComponent(String(article.slug))}`,
    { headers: { apikey: context.anonKey, Authorization: `Bearer ${context.anonKey}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, "The current local Data API must expose the published article through the real role policy.");
  const result: unknown = await response.json(); assert.ok(Array.isArray(result) && result.length === 1);
  const semantic = Object.fromEntries(Object.entries(article).filter(([key]) => !["id", "category_id"].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
  const ready: PublicFixtureReadiness = { status: "ready", latestVersion: String(registry.at(-1)!.version), registeredMigrations: registry.length,
    syntheticTopicCreated, syntheticCategoryCreated, articlePublicationValid: true, persistedSeoValid: true,
    topicsCmsState: "absent", topicsListingState: "fallback", topicsManageabilityGap: true, requiredSearchCompositions: 2,
    searchCompositionReady: true, localDataApiReadable: true, sourceOwnerFingerprint: seo.sourceFingerprint, fixtureContentSha256: digest(JSON.stringify(semantic)) };
  prepared.set(context, ready); receipt(context, "public-fixture-readiness.json", ready);
  context.record("public-fixture-ready", { createdTopics: Number(syntheticTopicCreated), createdCategories: Number(syntheticCategoryCreated), registered: registry.length });
  return ready;
}

function safeSourcePath(file: string) {
  assert.ok(file && !isAbsolute(file) && !file.includes("\\") && sourceIncluded(file));
  return resolve(ROOT, file);
}
function sourceIncluded(file: string) {
  const parts = file.split("/");
  return (parts.length === 1 ? SOURCE_ROOT_FILES.has(file) : SOURCE_ROOTS.has(parts[0]))
    && !parts.some(part => !part || part === ".." || /^\.env/iu.test(part)
      || /^(?:\.git|\.tmp-qa|\.next|node_modules|\.codex|\.agents|\.vercel|\.supabase|debug\.log|protected|private)$/iu.test(part)
      || /(?:\.private\.|\.(?:pem|key)$)/iu.test(part));
}
async function gitSourceInventory(context: PrivatePublicVerificationContext, request: PublicGateRequest) {
  assert.ok(Array.isArray(request.additionalSourceFiles));
  const inventory = (options: string[]) => new Promise<string[]>((done, reject) => {
    const child = spawn("git", ["ls-files", ...options, "-z"], { cwd: ROOT, env: context.cleanEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let data = "", stopped = false;
    const stop = () => { if (stopped) return; stopped = true; void stopChild(child, context.cleanEnvironment()).catch(() => reject(new Error("Source inventory cleanup failed."))); };
    const timer = setTimeout(stop, 30_000);
    child.stdout.on("data", value => { data += String(value); if (data.length > 2_000_000) stop(); });
    child.once("error", () => { clearTimeout(timer); reject(new Error("Source inventory failed.")); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0 && !stopped) done(data.split("\0").filter(Boolean));
      else reject(new Error("Source inventory failed."));
    });
  });
  const tracked = await inventory(["--cached"]);
  const eligibleAdditional = new Set(await inventory(["--others", "--exclude-standard"]));
  const additional: string[] = [...request.additionalSourceFiles];
  assert.equal(new Set(additional).size, additional.length);
  for (const file of additional) {
    safeSourcePath(file); assert.match(file, /^(?:src|scripts|sql|tests|docs)\//u);
    assert.ok(eligibleAdditional.has(file), "Additional Public source must be a reviewed, nonignored new source file.");
  }
  return [...new Set([...tracked, ...additional])].filter(sourceIncluded).sort();
}

async function stopChild(child: ChildProcess, environment: NodeJS.ProcessEnv) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    await new Promise<void>((done, reject) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { env: environment, windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(() => { killer.kill(); reject(new Error("Owned child cleanup exceeded its bound.")); }, 15_000);
      killer.once("error", () => { clearTimeout(timer); reject(new Error("Owned child cleanup failed.")); });
      killer.once("close", code => {
        clearTimeout(timer);
        if (code === 0 || child.exitCode !== null || child.signalCode !== null) done();
        else reject(new Error("Owned child cleanup failed."));
      });
    });
  } else child.kill("SIGTERM");
  if (child.exitCode === null && child.signalCode === null) await new Promise<void>((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned child did not stop.")), 15_000);
    child.once("close", () => { clearTimeout(timer); done(); });
  });
}

export async function runOwnedPublicVerification(context: PrivatePublicVerificationContext, request: PublicGateRequest, signal: AbortSignal) {
  await context.assertOwned();
  const readiness = prepared.get(context); assert.ok(readiness, "Public fixture readiness must precede gates.");
  assert.ok(request.selection === undefined || request.selection === "build-contracts", "Unknown fixed Public gate selection.");
  const gates = request.selection === "build-contracts"
    ? GATES.filter(gate => gate.name !== "public-e2e") : GATES;
  assert.equal(gates.length, request.selection === "build-contracts" ? 3 : 4);
  assert.equal(completed.has(context), false, "Successful selected gates cannot be rerun in this fixture.");
  const sourceDirectory = ownedPath(context, "public-build-source");
  assert.equal(existsSync(sourceDirectory), false, "Preserve any prior build workspace.");
  const files = await gitSourceInventory(context, request);
  const manifest = files.map(file => {
    const original = safeSourcePath(file);
    assert.ok(lstatSync(original).isFile());
    assert.equal(realpathSync(original), original, "Public source must not traverse a symlink or junction.");
    return { file, sha256: digest(readFileSync(original)) };
  });
  mkdirSync(sourceDirectory);
  const childEnvironment: NodeJS.ProcessEnv = { ...context.cleanEnvironment(), CI: "1", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${context.apiPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: context.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: context.serviceKey };
  const children = new Set<ChildProcess>();
  let appPort: number | null = null;
  let appFailed = false;
  const reports: Array<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  let buildIdSha256: string | null = null;
  const verifySource = () => {
    for (const row of manifest) { assert.equal(digest(readFileSync(safeSourcePath(row.file))), row.sha256); assert.equal(digest(readFileSync(join(sourceDirectory, row.file))), row.sha256); }
    for (const name of readdirSync(sourceDirectory)) assert.equal(/^\.env(?:\.|$)/iu.test(name), false);
  };
  const runChild = (args: string[], env: NodeJS.ProcessEnv, name: string, limitMs: number) => new Promise<{ code: number; stdout: string; stderr: string }>((done, reject) => {
    signal.throwIfAborted();
    const child = spawn(process.execPath, args, { cwd: sourceDirectory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child); let stdout = "", stderr = "", failed = false;
    const abort = () => {
      if (failed) return;
      failed = true;
      void stopChild(child, context.cleanEnvironment()).catch(() => reject(new Error(`Public ${name} cleanup failed.`)));
    };
    signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, limitMs);
    child.stdout.on("data", value => { stdout += String(value); if (stdout.length > 8_000_000) abort(); });
    child.stderr.on("data", value => { stderr += String(value); if (stderr.length > 8_000_000) abort(); });
    child.once("error", () => { clearTimeout(timeout); signal.removeEventListener("abort", abort); reject(new Error(`Public ${name} process failed.`)); });
    child.once("close", code => {
      clearTimeout(timeout); signal.removeEventListener("abort", abort); children.delete(child);
      const cleanOutput = context.sanitize(stdout), cleanErrors = context.sanitize(stderr);
      writeFileSync(ownedPath(context, `public-${name}.stdout.log`), cleanOutput, { mode: 0o600 });
      writeFileSync(ownedPath(context, `public-${name}.stderr.log`), cleanErrors, { mode: 0o600 });
      if (failed) reject(new Error(`Public ${name} was aborted or exceeded its bound.`));
      else done({ code: code ?? -1, stdout: cleanOutput, stderr: cleanErrors });
    });
  });
  try {
    for (const row of manifest) { const target = join(sourceDirectory, row.file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(safeSourcePath(row.file)), { flag: "wx" }); }
    symlinkSync(join(ROOT, "node_modules"), join(sourceDirectory, "node_modules"), "junction");
    receipt(context, "public-source-manifest.json", { manifest, sourceSha256: digest(JSON.stringify(manifest)), environmentFilesCopied: false, generatedLocalCredentialsOnly: true });
    for (const gate of gates) {
      verifySource(); await context.assertOwned(); signal.throwIfAborted();
      let env: NodeJS.ProcessEnv = context.cleanEnvironment();
      if (gate.name === "normal-build") env = childEnvironment;
      if (gate.name !== "normal-build") assert.equal(digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID"))), buildIdSha256);
      if (gate.name === "public-e2e") {
        appPort = await new Promise<number>((done, reject) => { const reservation = net.createServer(); reservation.once("error", reject);
          reservation.listen(0, "127.0.0.1", () => { const port = (reservation.address() as net.AddressInfo).port; reservation.close(error => error ? reject(error) : done(port)); }); });
        const app = spawn(process.execPath, [join(sourceDirectory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(appPort)],
          { cwd: sourceDirectory, env: childEnvironment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        children.add(app); let appOutput = "";
        const captureAppOutput = (value: Buffer) => {
          if (appFailed) return;
          appOutput += String(value);
          if (appOutput.length > 8_000_000) { appFailed = true; void stopChild(app, context.cleanEnvironment()).catch(() => undefined); }
        };
        app.stdout!.on("data", captureAppOutput); app.stderr!.on("data", captureAppOutput);
        app.once("error", () => { appFailed = true; });
        app.once("close", () => { children.delete(app); writeFileSync(ownedPath(context, "public-server.log"), context.sanitize(appOutput), { mode: 0o600 }); });
        const origin = `http://127.0.0.1:${appPort}`; let ready = false;
        const deadline = Date.now() + 120_000;
        while (!ready && Date.now() < deadline) {
          signal.throwIfAborted(); assert.equal(appFailed, false, "Owned application process failed.");
          assert.equal(app.exitCode, null, "Owned application exited before readiness.");
          try { const result = await fetch(`${origin}/admin/login`, { redirect: "error", signal: AbortSignal.timeout(3_000) }); ready = result.status === 200; await result.body?.cancel(); } catch { /* bounded startup polling only */ }
          if (!ready) await new Promise(done => setTimeout(done, 500));
        }
        assert.ok(ready, "Owned application readiness failed.");
        env = { ...context.cleanEnvironment(), E2E_BASE_URL: origin, E2E_ADMIN_STORAGE_STATE: "", E2E_TOPICS_CMS_STATE: readiness.topicsCmsState };
      }
      context.record("public-gate-start", { gate: gate.name });
      const args = "script" in gate ? ["--experimental-strip-types", join(sourceDirectory, gate.script), ...gate.args]
        : [join(sourceDirectory, "node_modules", gate.module), ...gate.args];
      const result = await runChild(args, env, gate.name, gate.limitMs);
      assert.equal(appFailed, false, "Owned application process failed during Public verification.");
      const report = { name: gate.name, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
      reports.push(report); receipt(context, `public-${gate.name}.json`, report);
      assert.equal(result.code, 0, `Required Public gate failed: ${gate.name}`);
      if (gate.name === "public-e2e") assert.equal(/(?:^|\n)\s*[1-9][0-9]*\s+(?:skipped|flaky)\b/iu.test(result.stdout), false, "Public E2E skipped/flaky coverage cannot pass.");
      if (gate.name === "normal-build") buildIdSha256 = digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID")));
      context.record("public-gate-pass", { gate: gate.name });
    }
    verifySource(); completed.add(context);
  } finally {
    const childCleanup = await Promise.allSettled([...children].map(child => stopChild(child, context.cleanEnvironment())));
    assert.ok(childCleanup.every(result => result.status === "fulfilled"), "An owned Public process could not be stopped.");
    if (appPort !== null) {
      const releasedPort = appPort;
      await new Promise<void>((done, reject) => { const probe = net.createServer(); probe.once("error", reject);
        probe.listen(releasedPort, "127.0.0.1", () => probe.close(error => error ? reject(error) : done())); });
    }
    assert.equal(realpathSync(sourceDirectory), sourceDirectory);
    assert.ok(sourceDirectory.startsWith(realpathSync(context.runDirectory) + sep));
    rmSync(sourceDirectory, { recursive: true, force: false });
    receipt(context, "public-process-cleanup.json", { ownedProcessesStopped: true, loopbackPortReleased: true, buildWorkspaceRemoved: !existsSync(sourceDirectory), otherResourcesTouched: false });
  }
  const result = { status: "pass", gates: reports, buildIdSha256, sourceSha256: digest(JSON.stringify(manifest)), retainedGatesRerun: false };
  if (request.selection === "build-contracts") {
    const buildResult = { ...result, selection: "build-contracts", publicE2EReexecuted: false };
    receipt(context, "public-build-contract-gates.json", buildResult); return buildResult;
  }
  receipt(context, "public-four-gates.json", result); return result;
}
