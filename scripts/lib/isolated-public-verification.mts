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
  selection?: "build-contracts" | "admin-interactions";
  /** Fixed local QA measurement, with an immutable reviewed source snapshot. */
  adminMeasurement?: {
    study?: "heavy-editor-performance";
    round?: "closure";
    phase: "before" | "after";
    frozenSourceManifest: string;
    controlDirectory: string;
    resumeAfterFromRuntime09?: true;
    resumeFinalAfterFromRuntime11?: true;
    resumeCorrectionAfterFromRuntime12?: true;
  };
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
const adminPhases = new WeakMap<PrivatePublicVerificationContext, Set<string>>();
const adminStudies = new WeakMap<PrivatePublicVerificationContext, "legacy" | "heavy-editor-performance" | "heavy-editor-closure">();
const adminStudyHarnesses = new WeakMap<PrivatePublicVerificationContext, Array<{ file: string; sha256: string }>>();
const adminCredentials = new WeakMap<PrivatePublicVerificationContext, { username: string; password: string; secret: string }>();

export const validateAcceptedAdminBefore09 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control");
  const lifecyclePath=join(control,"before-lifecycle.json"),lifecycle=JSON.parse(readFileSync(lifecyclePath,"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"before");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"bf1367d8554f1e547a18742da3381a1446d9662831547994c8ba1193189aac94");
  assert.equal(lifecycle.buildIdSha256,"b2a0619c2ce3a6906ca55d084386e33209c55b6c56811b18ff2cc7cd950f7950");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const beforeRoot=resolve(base,"production-runtime-09/admin-before"),jobs=readdirSync(control).filter(file=>/^before-job-[a-z0-9-]+\.json$/u.test(file));assert.equal(jobs.length,31);
  const receipts=jobs.map(file=>{
    const job=JSON.parse(readFileSync(join(control,file),"utf8"));const pointer=JSON.parse(readFileSync(join(control,`before-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(beforeRoot+sep),"Retained Before receipt must belong to runtime09");
    const raw=readFileSync(path),receipt=JSON.parse(raw.toString());assert.equal(receipt.id,job.id);assert.equal(receipt.phase,"before");assert.equal(receipt.status,pointer.status);assert.ok(["pass","fail"].includes(receipt.status));
    assert.ok(Array.isArray(receipt.measurements)&&Number.isFinite(receipt.finishedAt));
    return {id:job.id,status:receipt.status,path,sha256:createHash("sha256").update(raw).digest("hex")};
  });
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-09/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);
  return {lifecycle,receipts,beforeDatabase:"cleaned after fixture reset failure",afterDatabase:"fresh canonical owned DB; identical returned fixture model required",repeatedBeforeBuild:false,repeatedBeforeJobs:false};
};

export const validateAcceptedAdminAfter11 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control");
  const lifecyclePath=join(control,"after-lifecycle.json"),lifecycle=JSON.parse(readFileSync(lifecyclePath,"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"after");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"91aa9401a07482bddb53a71a80ace45acea36a4adb182d8b6afa36b054dd0aa2");
  assert.equal(lifecycle.buildIdSha256,"457638f37754fa57e57581a189d4eac4d97de867098f927d312f4baaffdb8f9f");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const afterRoot=resolve(base,"production-runtime-11/admin-after"),summaryPath=join(afterRoot,"browser-summary.json"),summaryRaw=readFileSync(summaryPath),summary=JSON.parse(summaryRaw.toString());
  assert.equal(summary.phase,"after");assert.ok(Array.isArray(summary.jobs)&&summary.jobs.length>0);assert.equal(new Set(summary.jobs).size,summary.jobs.length);
  const receipts=summary.jobs.map((file:string)=>{
    assert.match(file,/^after-job-[a-z0-9-]+\.json$/u);
    const job=JSON.parse(readFileSync(join(control,file),"utf8")),pointer=JSON.parse(readFileSync(join(control,`after-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(afterRoot+sep),"Retained After receipt must belong to runtime11");
    const raw=readFileSync(path),receipt=JSON.parse(raw.toString());assert.equal(receipt.id,job.id);assert.equal(receipt.phase,"after");assert.equal(receipt.status,pointer.status);assert.ok(["pass","fail"].includes(receipt.status));
    assert.ok(Array.isArray(receipt.measurements)&&Number.isFinite(receipt.finishedAt));
    return {id:job.id,status:receipt.status,path,sha256:digest(raw)};
  });
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-11/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);
  return {lifecycle,receipts,browserSummarySha256:digest(summaryRaw),priorDatabase:"cleaned normally after preserved browser summary",nextDatabase:"fresh canonical owned DB; fixture model equality required",repeatedPriorBuild:false,repeatedPriorJobs:false,retainedFailuresAreNotPasses:true};
};

export const validateAcceptedAdminAfter12 = () => {
  const base=resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17"),control=join(base,"control-final-delta");
  const lifecycle=JSON.parse(readFileSync(join(control,"after-lifecycle.json"),"utf8"));
  assert.equal(lifecycle.status,"pass");assert.equal(lifecycle.phase,"after");assert.equal(lifecycle.selection,"admin-interactions");
  assert.equal(lifecycle.sourceSha256,"ddc0d27237b435a2e766ae3adbef85a2853e32ab4c6ce4fd550871dfeb741a3d");
  assert.equal(lifecycle.buildIdSha256,"149049e42b900bd5021e71caa53ce13b938d692b5b88078d3fddba949a82a897");
  assert.deepEqual(lifecycle.gates.map((gate:{name:string;code:number})=>[gate.name,gate.code]),[["normal-build",0],["admin-interactions",0]]);
  const afterRoot=resolve(base,"production-runtime-12/admin-after"),jobs=readdirSync(control).filter(file=>/^after-job-[a-z0-9-]+\.json$/u.test(file));assert.equal(jobs.length,26);
  const receipts=jobs.map(file=>{
    const jobRaw=readFileSync(join(control,file)),job=JSON.parse(jobRaw.toString()),pointer=JSON.parse(readFileSync(join(control,`after-result-${job.id}.json`),"utf8"));
    const path=resolve(pointer.path);assert.ok(path.startsWith(afterRoot+sep),"Retained After receipt must belong to runtime12");
    const raw=readFileSync(path),retained=JSON.parse(raw.toString());assert.equal(retained.id,job.id);assert.equal(retained.phase,"after");assert.equal(retained.status,pointer.status);assert.ok(["pass","fail"].includes(retained.status));
    assert.equal(retained.scenarioSha256,digest(jobRaw));assert.ok(Array.isArray(retained.measurements)&&Number.isFinite(retained.finishedAt));
    return {file,id:job.id,status:retained.status,path,sha256:digest(raw)};
  });
  assert.equal(new Set(receipts.map(row=>row.id)).size,receipts.length);
  const summaryPath=join(afterRoot,"browser-driver-2/browser-summary.json"),summaryRaw=readFileSync(summaryPath),summary=JSON.parse(summaryRaw.toString());
  assert.equal(summary.phase,"after");assert.ok(Array.isArray(summary.jobs)&&summary.jobs.length>0);assert.equal(new Set(summary.jobs).size,summary.jobs.length);
  for(const file of summary.jobs){assert.match(file,/^after-job-[a-z0-9-]+\.json$/u);assert.ok(jobs.includes(file));}
  const cleanup=JSON.parse(readFileSync(join(base,"production-runtime-12/cleanup.json"),"utf8"));assert.equal(cleanup.status,"complete");assert.equal(cleanup.remainingOwnedResources,0);assert.equal(cleanup.originalResourcesUnchanged,true);assert.equal(cleanup.privateEnvRemoved,true);
  return {lifecycle,receipts,browserSummarySha256:digest(summaryRaw),terminalDriverJobs:summary.jobs.length,allCompletedJobs:receipts.length,summaryIsTerminalDriverSubset:true,priorDatabase:"cleaned normally after both driver attempts",nextDatabase:"fresh canonical owned DB; fixture model equality required",repeatedPriorBuild:false,repeatedPriorJobs:false,retainedFailuresAreNotPasses:true};
};

export function registerOwnedAdminMeasurement(context: PrivatePublicVerificationContext, credentials: { username: string; password: string; secret: string }) {
  assert.equal(adminCredentials.has(context), false);
  adminCredentials.set(context, Object.freeze({ ...credentials }));
}

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
  assert.ok(request.selection === undefined || request.selection === "build-contracts" || request.selection === "admin-interactions", "Unknown fixed Public gate selection.");
  const measurement = request.selection === "admin-interactions" ? request.adminMeasurement : undefined;
  assert.equal(Boolean(request.adminMeasurement), Boolean(measurement));
  const credentials = measurement ? adminCredentials.get(context) : undefined;
  const originalContext = context;
  let frozenDirectory: string | undefined;
  let frozenManifest: Array<{ file: string; sha256: string }> | undefined;
  if (measurement) {
    assert.ok(credentials, "The canonical owned local Admin fixture must be prepared first.");
    assert.ok(measurement.study === undefined || measurement.study === "heavy-editor-performance", "Unknown fixed Admin study.");
    assert.ok(measurement.round === undefined || (measurement.round === "closure" && measurement.study === "heavy-editor-performance"), "Unknown fixed Admin study round.");
    const study = measurement.study ?? "legacy";
    const studyIdentity = measurement.round === "closure" ? "heavy-editor-closure" : study;
    const priorStudy = adminStudies.get(context);
    assert.ok(priorStudy === undefined || priorStudy === studyIdentity, "An owned Admin fixture cannot change studies or rounds between phases.");
    adminStudies.set(context, studyIdentity);
    assert.ok(measurement.phase === "before" || measurement.phase === "after");
    const phases = adminPhases.get(context) ?? new Set<string>();
    assert.equal(phases.has(measurement.phase), false, "A successful measurement phase is one-shot.");
    if (study === "heavy-editor-performance") {
      assert.equal(measurement.resumeAfterFromRuntime09, undefined, "The new study cannot reuse a legacy Before phase.");
      assert.equal(measurement.resumeFinalAfterFromRuntime11, undefined);
      assert.equal(measurement.resumeCorrectionAfterFromRuntime12, undefined);
      const studyBase = resolve(ROOT, measurement.round === "closure" ? ".tmp-qa/heavy-editor-closure-2026-09-18" : ".tmp-qa/heavy-editor-performance-excellence-2026-09-18");
      assert.equal(resolve(measurement.frozenSourceManifest), join(studyBase, measurement.phase === "before" ? "baseline-source-manifest.json" : "after-source-manifest.json"));
      assert.equal(resolve(measurement.controlDirectory), join(studyBase, "control"));
      if (measurement.phase === "after") assert.ok(phases.has("before"), "The new study requires its own completed Before phase on the same fixture.");
    }
    if(measurement.resumeAfterFromRuntime09)assert.equal(measurement.phase,"after");
    if(measurement.resumeCorrectionAfterFromRuntime12){
      assert.equal(measurement.phase,"after");assert.equal(measurement.resumeAfterFromRuntime09,true);assert.equal(measurement.resumeFinalAfterFromRuntime11,true);
      assert.equal(resolve(measurement.frozenSourceManifest),resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17/after-source-manifest-v5.json"));
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,".tmp-qa/admin-near-instant-continuation-2026-09-17/control-final-correction"));
      receipt(context,"admin-retained-after-runtime12.json",validateAcceptedAdminAfter12());
    }
    if(measurement.resumeFinalAfterFromRuntime11){
      assert.equal(measurement.phase,"after");assert.equal(measurement.resumeAfterFromRuntime09,true);
      assert.equal(resolve(measurement.frozenSourceManifest),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/after-source-manifest-${measurement.resumeCorrectionAfterFromRuntime12?"v5":"v4"}.json`));
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/${measurement.resumeCorrectionAfterFromRuntime12?"control-final-correction":"control-final-delta"}`));
      receipt(context,"admin-retained-after-runtime11.json",validateAcceptedAdminAfter11());
    }
    if(measurement.phase==="after"&&!phases.has("before")){
      assert.equal(measurement.resumeAfterFromRuntime09,true,"After requires a completed or explicitly retained Before cohort");
      const retained=validateAcceptedAdminBefore09();
      assert.equal(resolve(measurement.controlDirectory),resolve(ROOT,`.tmp-qa/admin-near-instant-continuation-2026-09-17/${measurement.resumeCorrectionAfterFromRuntime12?"control-final-correction":measurement.resumeFinalAfterFromRuntime11?"control-final-delta":"control"}`));
      receipt(context,"admin-retained-before-runtime09.json",retained);
    }
    adminPhases.set(context, phases);
    const boundary = resolve(ROOT, study === "heavy-editor-performance"
      ? measurement.round === "closure" ? ".tmp-qa/heavy-editor-closure-2026-09-18" : ".tmp-qa/heavy-editor-performance-excellence-2026-09-18"
      : ".tmp-qa/admin-near-instant-continuation-2026-09-17") + sep;
    const manifestPath = resolve(measurement.frozenSourceManifest);
    assert.ok(manifestPath.startsWith(boundary) && realpathSync(manifestPath) === manifestPath && lstatSync(manifestPath).isFile());
    const frozen = JSON.parse(readFileSync(manifestPath, "utf8"));
    frozenDirectory = resolve(frozen.sourceDirectory);
    assert.ok(frozenDirectory.startsWith(boundary) && realpathSync(frozenDirectory) === frozenDirectory);
    frozenManifest = frozen.manifest.map((row: { file: string; sha256: string }) => ({ file: row.file, sha256: row.sha256 }));
    assert.ok(frozenManifest!.length > 100 && new Set(frozenManifest!.map(row => row.file)).size === frozenManifest!.length);
    for (const row of frozenManifest!) { safeSourcePath(row.file); assert.match(row.sha256, /^[a-f0-9]{64}$/u); }
    const control = resolve(measurement.controlDirectory);
    assert.ok(control.startsWith(boundary) && realpathSync(control) === control && lstatSync(control).isDirectory());
    const phaseDirectory = ownedPath(context, `admin-${measurement.phase}`);
    mkdirSync(phaseDirectory);
    const baseSanitize = context.sanitize;
    context = { ...context, runDirectory: phaseDirectory,
      sanitize: value => [credentials.username, credentials.password, credentials.secret].reduce((text, item) => text.replaceAll(item, "[REDACTED_LOCAL_ADMIN]"), baseSanitize(value)) };
  }
  const gates = measurement ? [GATES[0], { name: "admin-interactions", script: "scripts/qa-admin-production-interactions.mjs", args: [], limitMs: measurement.study === "heavy-editor-performance" ? 21_600_000 : 7_200_000 }] : request.selection === "build-contracts"
    ? GATES.filter(gate => gate.name !== "public-e2e") : GATES;
  assert.equal(gates.length, measurement ? 2 : request.selection === "build-contracts" ? 3 : 4);
  assert.equal(completed.has(originalContext), false, "Successful selected gates cannot be rerun in this fixture.");
  const sourceDirectory = ownedPath(context, "public-build-source");
  assert.equal(existsSync(sourceDirectory), false, "Preserve any prior build workspace.");
  const files = frozenManifest?.map(row => row.file) ?? await gitSourceInventory(context, request);
  const sourcePath = (file: string) => frozenDirectory ? join(frozenDirectory, file) : safeSourcePath(file);
  const manifest = files.map(file => {
    const original = sourcePath(file);
    assert.ok(lstatSync(original).isFile());
    assert.equal(realpathSync(original), original, "Public source must not traverse a symlink or junction.");
    const sha256 = digest(readFileSync(original));
    if (frozenManifest) assert.equal(sha256, frozenManifest.find(row => row.file === file)!.sha256);
    return { file, sha256 };
  });
  mkdirSync(sourceDirectory);
  const childEnvironment: NodeJS.ProcessEnv = { ...context.cleanEnvironment(), CI: "1", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${context.apiPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: context.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: context.serviceKey,
    ...(credentials ? { ADMIN_SESSION_SECRET: credentials.secret, ADMIN_SESSION_COOKIE_SECURE: "false" } : {}) };
  const children = new Set<ChildProcess>();
  let appPort: number | null = null;
  let appFailed = false;
  const reports: Array<{ name: string; code: number; stdoutSha256: string; stderrSha256: string }> = [];
  let buildIdSha256: string | null = null;
  const verifySource = () => {
    for (const row of manifest) { assert.equal(digest(readFileSync(sourcePath(row.file))), row.sha256); assert.equal(digest(readFileSync(join(sourceDirectory, row.file))), row.sha256); }
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
    for (const row of manifest) { const target = join(sourceDirectory, row.file); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, readFileSync(sourcePath(row.file)), { flag: "wx" }); }
    symlinkSync(join(ROOT, "node_modules"), join(sourceDirectory, "node_modules"), "junction");
    receipt(context, "public-source-manifest.json", { manifest, sourceSha256: digest(JSON.stringify(manifest)), environmentFilesCopied: false, generatedLocalCredentialsOnly: true });
    for (const gate of gates) {
      verifySource(); await context.assertOwned(); signal.throwIfAborted();
      let env: NodeJS.ProcessEnv = context.cleanEnvironment();
      if (gate.name === "normal-build") env = childEnvironment;
      if (gate.name !== "normal-build") assert.equal(digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID"))), buildIdSha256);
      if (gate.name === "public-e2e" || gate.name === "admin-interactions") {
        const measurementHarness = measurement ? ["scripts/qa-admin-production-interactions.mjs","scripts/fixtures/admin-atomic-readiness.mjs","scripts/fixtures/admin-interaction-server-trace.cjs"]
          .map(file=>({file,sha256:digest(readFileSync(safeSourcePath(file)))})) : null;
        if (measurement?.study === "heavy-editor-performance") {
          const priorHarness = adminStudyHarnesses.get(originalContext);
          if (priorHarness) assert.deepEqual(measurementHarness, priorHarness, "Both study phases require the same collector and trace source.");
          else adminStudyHarnesses.set(originalContext, measurementHarness!);
          for (const row of measurementHarness!) assert.equal(row.sha256, manifest.find(source => source.file === row.file)?.sha256, "The study harness must match its frozen source.");
        }
        if(measurementHarness) receipt(context,"admin-measurement-harness.json",{manifest:measurementHarness,diagnosticInstrumentation:true,productSourceUnchanged:true});
        appPort = await new Promise<number>((done, reject) => { const reservation = net.createServer(); reservation.once("error", reject);
          reservation.listen(0, "127.0.0.1", () => { const port = (reservation.address() as net.AddressInfo).port; reservation.close(error => error ? reject(error) : done(port)); }); });
        const app = spawn(process.execPath, [...(measurement?["--require",join(ROOT,"scripts/fixtures/admin-interaction-server-trace.cjs")]:[]),join(sourceDirectory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(appPort)],
          { cwd: sourceDirectory, env: measurement ? {...childEnvironment,
            QA_ADMIN_SERVER_TRACE_PATH:ownedPath(context,"admin-server-trace.jsonl"),
            ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_TRACE_CONTROL_PATH: join(resolve(measurement.controlDirectory), "server-trace-mode.json") } : {})} : childEnvironment, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
        if (measurement && credentials) env = { ...env, QA_ADMIN_USERNAME: credentials.username, QA_ADMIN_PASSWORD: credentials.password,
          QA_ADMIN_PHASE: measurement.phase, QA_ADMIN_CONTROL: resolve(measurement.controlDirectory), QA_ADMIN_OUTPUT: context.runDirectory,
          ...(measurement.study === "heavy-editor-performance" ? { QA_ADMIN_STUDY: measurement.study } : {}),
          QA_ADMIN_STORAGE_PUBLIC_PREFIXES: JSON.stringify(["cms-images","cms-documents"].map(bucket=>`http://127.0.0.1:${context.apiPort}/storage/v1/object/public/${bucket}/`)),
          QA_ADMIN_SOURCE_SHA256: digest(JSON.stringify(manifest)) };
      }
      context.record("public-gate-start", { gate: gate.name });
      const args = "script" in gate ? ["--experimental-strip-types", join(gate.name === "admin-interactions" ? ROOT : sourceDirectory, gate.script), ...gate.args]
        : [join(sourceDirectory, "node_modules", gate.module), ...gate.args];
      let result = await runChild(args, env, gate.name, gate.limitMs);
      if(measurement && gate.name==="admin-interactions") {
        if (measurement.study === "heavy-editor-performance" && measurement.phase === "before" && result.code !== 0) {
          receipt(context,"admin-before-driver-repair-rejected.json",{
            status:"rejected",driverCode:result.code,sameSessionRequired:true,cleanLifecycleRestartRequired:true,
          });
          assert.fail("Heavy Editor Before driver repair cannot preserve the same-session contract; complete owned cleanup and start a fresh lifecycle. No repair child was launched.");
        }
        // Eligible After/legacy repairs retain the successful build and owned
        // database. Only the fixed driver may retry.
        for(let attempt=1;result.code!==0 && attempt<=4;attempt++) {
          receipt(context,`admin-driver-failure-${attempt}.json`,{status:"paused-on-driver-error",code:result.code,buildIdSha256,sourceSha256:digest(JSON.stringify(manifest)),qualityPassClaimed:false});
          const commandPath=join(resolve(measurement.controlDirectory),`${measurement.phase}-driver-repair-${attempt}.json`),deadline=Date.now()+1_800_000;
          while(!existsSync(commandPath)&&Date.now()<deadline) {await context.assertOwned();signal.throwIfAborted();await new Promise(done=>setTimeout(done,1_000));}
          assert.ok(existsSync(commandPath),"Fixed Admin driver repair lease expired");
          assert.deepEqual(JSON.parse(readFileSync(commandPath,"utf8")),{operation:"retry-fixed-driver"});
          verifySource();assert.equal(digest(readFileSync(join(sourceDirectory,".next/BUILD_ID"))),buildIdSha256);
          if (measurement.study === "heavy-editor-performance") {
            for (const row of adminStudyHarnesses.get(originalContext)!) assert.equal(digest(readFileSync(safeSourcePath(row.file))), row.sha256, "The study collector cannot change during a cohort.");
          }
          const driverOutput=ownedPath(context,`browser-driver-${attempt+1}`);mkdirSync(driverOutput);
          receipt(context,`admin-driver-retry-${attempt+1}.json`,{driverSha256:digest(readFileSync(safeSourcePath("scripts/qa-admin-production-interactions.mjs"))),sourceSha256:digest(JSON.stringify(manifest)),buildIdSha256,output:driverOutput,originalReceiptsPreserved:true});
          result=await runChild(args,{...env,QA_ADMIN_OUTPUT:driverOutput,QA_ADMIN_DRIVER_ATTEMPT:String(attempt+1)},`${gate.name}-attempt-${attempt+1}`,gate.limitMs);
        }
      }
      assert.equal(appFailed, false, "Owned application process failed during Public verification.");
      const report = { name: gate.name, code: result.code, stdoutSha256: digest(result.stdout), stderrSha256: digest(result.stderr) };
      reports.push(report); receipt(context, `public-${gate.name}.json`, report);
      assert.equal(result.code, 0, `Required Public gate failed: ${gate.name}`);
      if (gate.name === "public-e2e") assert.equal(/(?:^|\n)\s*[1-9][0-9]*\s+(?:skipped|flaky)\b/iu.test(result.stdout), false, "Public E2E skipped/flaky coverage cannot pass.");
      if (gate.name === "normal-build") buildIdSha256 = digest(readFileSync(join(sourceDirectory, ".next/BUILD_ID")));
      context.record("public-gate-pass", { gate: gate.name });
    }
    verifySource();
    if (measurement) adminPhases.get(originalContext)!.add(measurement.phase);
    else completed.add(originalContext);
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
  if (measurement) { const value = { ...result, selection: "admin-interactions", phase: measurement.phase, ...(measurement.study ? { study: measurement.study } : {}), priorQualityGatesRerun: false };
    receipt(context, "admin-measurement-lifecycle.json", value); return value; }
  if (request.selection === "build-contracts") {
    const buildResult = { ...result, selection: "build-contracts", publicE2EReexecuted: false };
    receipt(context, "public-build-contract-gates.json", buildResult); return buildResult;
  }
  receipt(context, "public-four-gates.json", result); return result;
}
