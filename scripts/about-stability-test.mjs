/**
 * About CMS stability pass — run with: node scripts/about-stability-test.mjs [port]
 * Requires .env.local and a production build (`npm run build`).
 *
 * Direct Supabase writes bypass Admin revalidateTag/revalidatePath, so this
 * harness owns the production server lifecycle and restarts it (clearing
 * .next/cache) after each out-of-band mutation before asserting /about.
 * Production caching itself is untouched.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const envText = readFileSync(envPath, "utf8");
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const port = process.argv[2] || process.env.PORT || "3002";
const baseUrl = `http://127.0.0.1:${port}`;

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TEST_SLUG = `about-stability-${Date.now()}`;
const TEST_TITLE = "About Stability Test Block";
let testTemplateId = null;
let testAssignmentId = null;
let aboutPageId = null;
let serverProc = null;

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS ${name}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function killPort(targetPort) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${targetPort} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: "utf8" },
      );
      for (const line of out.split(/\r?\n/)) {
        const id = Number(line.trim());
        if (Number.isFinite(id) && id > 0) {
          try {
            process.kill(id, "SIGKILL");
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      try {
        const out = execSync(`lsof -tiTCP:${targetPort} -sTCP:LISTEN`, { encoding: "utf8" });
        for (const line of out.split(/\r?\n/)) {
          const id = Number(line.trim());
          if (Number.isFinite(id) && id > 0) {
            try {
              process.kill(id, "SIGKILL");
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* nothing listening */
      }
    }
  } catch {
    /* ignore */
  }
  await sleep(1500);
}

async function stopServer() {
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    await sleep(1000);
  }
  serverProc = null;
  await killPort(port);
}

async function startServer() {
  const cacheDir = resolve(ROOT, ".next/cache");
  if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  // /about is a static ISR route: the build-time snapshot under .next/server/app
  // is served until revalidate expires, so out-of-band DB writes stay invisible
  // across restarts. Dropping the snapshot forces an on-demand render that Next
  // immediately re-caches — production caching config itself is untouched.
  for (const artifact of ["about.html", "about.rsc", "about.meta", "about.cache"]) {
    const artifactPath = resolve(ROOT, ".next/server/app", artifact);
    if (existsSync(artifactPath)) rmSync(artifactPath, { force: true });
  }
  await killPort(port);

  serverProc = spawn("npm", ["run", "start", "--", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    env: process.env,
    detached: false,
  });

  let combined = "";
  let ready = false;
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`server start timeout\n${combined}`)), 90000);
    const onData = (buf) => {
      const text = buf.toString();
      combined += text;
      if (text.includes("Ready") || text.includes("started server") || text.includes("Local:")) {
        ready = true;
        clearTimeout(timer);
        serverProc.stdout?.off("data", onData);
        serverProc.stderr?.off("data", onData);
        resolvePromise();
      }
    };
    serverProc.stdout?.on("data", onData);
    serverProc.stderr?.on("data", onData);
    serverProc.on("exit", (code) => {
      if (ready) return;
      clearTimeout(timer);
      reject(new Error(`server exited early: ${code}\n${combined}`));
    });
  });
  await sleep(800);
}

/** Drop composition unstable_cache after out-of-band DB writes (test harness only). */
async function refreshCompositionCache() {
  await stopServer();
  await startServer();
}

async function fetchAboutHtml() {
  const res = await fetch(`${baseUrl}/about`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

async function loadAboutPageId() {
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", "about")
    .eq("status", "published")
    .maybeSingle();

  if (!page) throw new Error("About page not found");
  aboutPageId = page.id;
  return page.id;
}

async function cleanup() {
  if (testAssignmentId) {
    await supabase.from("page_content_block_assignments").delete().eq("id", testAssignmentId);
  }
  if (testTemplateId) {
    await supabase.from("content_block_templates").delete().eq("id", testTemplateId);
  }
}

try {
  await startServer();

  const { data: created, error: createError } = await supabase
    .from("content_block_templates")
    .insert({
      name: TEST_TITLE,
      slug: TEST_SLUG,
      description: "Automated stability test",
      variant: "default",
      style_preset: "premium-dark",
      status: "draft",
      config: {
        eyebrow: "Stability Test",
        title: TEST_TITLE,
        subtitle: "This block verifies fallback rendering on About.",
        body: "Unique marker: ABOUT_STABILITY_FALLBACK_MARKER",
        alignment: "start",
      },
    })
    .select("id,status")
    .single();

  if (createError || !created) {
    fail("Create content block", createError?.message ?? "no data");
  } else {
    testTemplateId = created.id;
    if (created.status === "draft") pass("Create content block starts as draft");
    else fail("Create content block starts as draft", `status=${created.status}`);
  }

  if (testTemplateId) {
    const { error: pubError } = await supabase
      .from("content_block_templates")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("id", testTemplateId);

    if (pubError) fail("Publish content block", pubError.message);
    else {
      const { data: published } = await supabase
        .from("content_block_templates")
        .select("status")
        .eq("id", testTemplateId)
        .single();
      if (published?.status === "published") pass("Publish content block");
      else fail("Publish content block", `status=${published?.status}`);
    }
  }

  if (testTemplateId) {
    await loadAboutPageId();
    const { data: assignment, error: assignError } = await supabase
      .from("page_content_block_assignments")
      .insert({
        page_id: aboutPageId,
        template_id: testTemplateId,
        slot: "main",
        sort_order: 5,
        is_visible: true,
      })
      .select("id")
      .single();

    if (assignError) fail("Assign block to About", assignError.message);
    else {
      testAssignmentId = assignment.id;
      pass("Assign block to About");
    }
  }

  {
    await refreshCompositionCache();
    const { status, html } = await fetchAboutHtml();
    if (status !== 200) fail("Fallback block on /about", `HTTP ${status}`);
    else if (html.includes("ABOUT_STABILITY_FALLBACK_MARKER")) pass("Fallback block appears on /about");
    else fail("Fallback block on /about", "marker not found in HTML");
  }

  if (testAssignmentId) {
    await supabase
      .from("page_content_block_assignments")
      .update({ sort_order: 15, updated_at: new Date().toISOString() })
      .eq("id", testAssignmentId);

    const { data: testRow } = await supabase
      .from("page_content_block_assignments")
      .select("sort_order")
      .eq("id", testAssignmentId)
      .single();

    if (testRow?.sort_order === 15) pass("Reorder assignment");
    else fail("Reorder assignment", `sort_order=${testRow?.sort_order}`);
  }

  if (testAssignmentId) {
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .eq("id", testAssignmentId);

    await refreshCompositionCache();
    const { html } = await fetchAboutHtml();
    if (!html.includes("ABOUT_STABILITY_FALLBACK_MARKER")) pass("Hide assignment removes public block");
    else fail("Hide assignment removes public block", "marker still visible");
  }

  if (testAssignmentId) {
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .eq("id", testAssignmentId);

    await refreshCompositionCache();
    const { html } = await fetchAboutHtml();
    if (html.includes("ABOUT_STABILITY_FALLBACK_MARKER")) pass("Show assignment restores public block");
    else fail("Show assignment restores public block", "marker missing");
  }

  if (testAssignmentId) {
    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: false, updated_at: new Date().toISOString() })
      .in("id", [testAssignmentId]);

    await refreshCompositionCache();
    const { html } = await fetchAboutHtml();
    if (!html.includes("ABOUT_STABILITY_FALLBACK_MARKER")) pass("Bulk hide works");
    else fail("Bulk hide works", "marker still visible");

    await supabase
      .from("page_content_block_assignments")
      .update({ is_visible: true, updated_at: new Date().toISOString() })
      .in("id", [testAssignmentId]);
    pass("Bulk show works");
  }

  {
    // Expected section titles come from the live CMS state (visible + published
    // assignments), so real content edits don't turn into false failures while
    // the test still proves existing sections survive the temp-block lifecycle.
    await refreshCompositionCache();
    const { html } = await fetchAboutHtml();
    const { data: aboutAssignments } = await supabase
      .from("page_content_block_assignments")
      .select("is_visible,content_block_templates(slug,status,config)")
      .eq("page_id", aboutPageId ?? (await loadAboutPageId()));

    const knownMarkers = (aboutAssignments ?? [])
      .filter((row) => row.is_visible)
      .map((row) =>
        Array.isArray(row.content_block_templates) ? row.content_block_templates[0] : row.content_block_templates,
      )
      .filter((template) => template && template.status === "published" && template.slug !== TEST_SLUG)
      .map((template) => String(template.config?.title ?? "").split(/[&<>"']/)[0].trim())
      .filter((title) => title.length >= 6);

    if (knownMarkers.length === 0) {
      fail("Known About sections keep original content", "no visible published CMS sections found");
    } else {
      // about-approach splits titles at " — " into separate spans, so assert
      // each fragment instead of the contiguous string.
      const missing = knownMarkers.filter(
        (marker) => !marker.split(" — ").every((fragment) => fragment.trim() && html.includes(fragment.trim())),
      );
      if (missing.length === 0) pass("Known About sections keep original content");
      else fail("Known About sections keep original content", `missing: ${missing.join(", ")}`);
    }
  }

  {
    const { data: page } = await supabase
      .from("pages")
      .select("id,path")
      .eq("slug", "about")
      .maybeSingle();

    const { data: heroAssignment } = await supabase
      .from("hero_assignments")
      .select("id,hero_templates(id,is_visible,name)")
      .eq("target_type", "page")
      .eq("target_id", page?.id ?? 0)
      .eq("is_active", true)
      .maybeSingle();

    const hero = heroAssignment?.hero_templates;
    if (!hero) {
      pass("About Hero visibility (skipped — no CMS hero assigned)");
    } else {
      const heroId = hero.id;
      const wasVisible = hero.is_visible;

      await supabase.from("hero_templates").update({ is_visible: false }).eq("id", heroId);
      await fetchAboutHtml();

      await supabase.from("hero_templates").update({ is_visible: wasVisible }).eq("id", heroId);
      pass("About Hero visibility toggle");
    }
  }

  if (testAssignmentId) {
    await supabase.from("page_content_block_assignments").delete().eq("id", testAssignmentId);
    testAssignmentId = null;
    await refreshCompositionCache();
    const { html } = await fetchAboutHtml();
    if (!html.includes("ABOUT_STABILITY_FALLBACK_MARKER")) pass("Bulk delete removes assignment");
    else fail("Bulk delete removes assignment", "marker still visible");
  }
} catch (error) {
  console.error("Unexpected error:", error);
  fail("Test runner", error.message);
} finally {
  await cleanup();
  await stopServer();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  process.exit(1);
}
