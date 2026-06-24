/**
 * Fix project image path case to match files on disk (Linux/Vercel safe).
 *
 * Usage:
 *   node scripts/fix-project-image-paths.mjs --dry-run
 *   node scripts/fix-project-image-paths.mjs --apply
 *   node scripts/fix-project-image-paths.mjs --verify [port]
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = resolve(ROOT, "public");
const dryRun = process.argv.includes("--dry-run");
const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify");
const port = process.argv.find((arg) => /^\d+$/.test(arg)) ?? "3021";

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** lowercase web path → canonical web path with correct casing */
const caseMap = new Map();

function indexImagesDir(absDir, webPrefix) {
  if (!existsSync(absDir)) return;

  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const absPath = join(absDir, entry.name);
    const webPath = `${webPrefix}/${entry.name}`.replace(/\\/g, "/");

    caseMap.set(webPath.toLowerCase(), webPath);

    if (entry.isDirectory()) {
      indexImagesDir(absPath, webPath);
    }
  }
}

indexImagesDir(join(PUBLIC_DIR, "images"), "/images");

function resolveImagePath(webPath) {
  if (!webPath || typeof webPath !== "string") return { path: webPath, changed: false, exists: false };
  if (!webPath.startsWith("/images/")) return { path: webPath, changed: false, exists: true };

  const canonical = caseMap.get(webPath.toLowerCase());
  if (canonical && canonical !== webPath) {
    const diskCanonical = join(PUBLIC_DIR, canonical.replace(/^\//, ""));
    return { path: canonical, changed: true, exists: existsSync(diskCanonical) };
  }

  const diskExact = join(PUBLIC_DIR, webPath.replace(/^\//, ""));
  if (existsSync(diskExact)) {
    return { path: webPath, changed: false, exists: true };
  }

  if (canonical) {
    const diskCanonical = join(PUBLIC_DIR, canonical.replace(/^\//, ""));
    return { path: canonical, changed: false, exists: existsSync(diskCanonical) };
  }

  return { path: webPath, changed: false, exists: false };
}

function fixLocationData(locationData) {
  if (!locationData || typeof locationData !== "object") return { value: locationData, changes: [] };

  const next = { ...locationData };
  const changes = [];

  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== "string" || !value.startsWith("/images/")) continue;
    const resolved = resolveImagePath(value);
    if (resolved.changed) {
      next[key] = resolved.path;
      changes.push({ field: `location_data.${key}`, from: value, to: resolved.path });
    }
  }

  return { value: next, changes };
}

const report = {
  mode: verifyOnly ? "verify" : dryRun ? "dry-run" : apply ? "apply" : "scan",
  projectUpdates: [],
  floorPlanUpdates: [],
  mediaUpdates: [],
  missing: [],
  verify: { before: [], after: [] },
};

const PROJECT_IMAGE_FIELDS = ["image", "hero_image", "overview_video_image", "district_image", "og_image"];

async function loadAllImagePaths() {
  const paths = new Set();

  const { data: projects } = await supabase.from("projects").select("*");
  for (const project of projects ?? []) {
    for (const field of PROJECT_IMAGE_FIELDS) {
      if (project[field]) paths.add(project[field]);
    }
    const loc = fixLocationData(project.location_data);
    for (const change of loc.changes) paths.add(change.from);

    const { data: plans } = await supabase
      .from("project_floor_plans")
      .select("plan_image")
      .eq("project_id", project.id);
    for (const plan of plans ?? []) {
      if (plan.plan_image) paths.add(plan.plan_image);
    }

    const { data: media } = await supabase
      .from("project_media")
      .select("image")
      .eq("project_id", project.id);
    for (const row of media ?? []) {
      if (row.image) paths.add(row.image);
    }
  }

  return [...paths].filter((p) => typeof p === "string" && p.startsWith("/images/"));
}

async function checkPathsHttp(paths, label) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const results = [];

  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { method: "HEAD", cache: "no-store" });
      results.push({ path, status: res.status, ok: res.ok });
    } catch (error) {
      results.push({ path, status: 0, ok: false, error: String(error) });
    }
  }

  report.verify[label] = results;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${label.toUpperCase()}: ${results.length - failed.length}/${results.length} OK`);
  for (const row of failed) {
    console.log(`  FAIL ${row.path} → ${row.status || row.error}`);
  }
  return failed;
}

async function applyFixes() {
  const { data: projects, error } = await supabase.from("projects").select("*");
  if (error) throw new Error(error.message);

  for (const project of projects ?? []) {
    const patch = {};
    const changes = [];

    for (const field of PROJECT_IMAGE_FIELDS) {
      const current = project[field];
      if (!current) continue;
      const resolved = resolveImagePath(current);
      if (!resolved.exists) {
        report.missing.push({ table: "projects", id: project.id, slug: project.slug, field, path: current });
      }
      if (resolved.changed) {
        patch[field] = resolved.path;
        changes.push({ field, from: current, to: resolved.path });
      }
    }

    const loc = fixLocationData(project.location_data);
    if (loc.changes.length) {
      patch.location_data = loc.value;
      changes.push(...loc.changes);
    }

    if (changes.length) {
      const entry = { id: project.id, slug: project.slug, changes };
      report.projectUpdates.push(entry);
      console.log("PROJECT %s:", project.slug, changes);

      if (apply) {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", project.id);
        if (updateError) throw new Error(`project ${project.slug}: ${updateError.message}`);
      }
    }

    const { data: plans } = await supabase
      .from("project_floor_plans")
      .select("id, plan_image")
      .eq("project_id", project.id);

    for (const plan of plans ?? []) {
      const resolved = resolveImagePath(plan.plan_image);
      if (!resolved.exists) {
        report.missing.push({
          table: "project_floor_plans",
          id: plan.id,
          projectSlug: project.slug,
          field: "plan_image",
          path: plan.plan_image,
        });
      }
      if (resolved.changed) {
        report.floorPlanUpdates.push({
          id: plan.id,
          projectSlug: project.slug,
          from: plan.plan_image,
          to: resolved.path,
        });
        console.log("  FLOOR_PLAN %s: %s → %s", project.slug, plan.plan_image, resolved.path);

        if (apply) {
          const { error: updateError } = await supabase
            .from("project_floor_plans")
            .update({ plan_image: resolved.path, updated_at: new Date().toISOString() })
            .eq("id", plan.id);
          if (updateError) throw new Error(`floor plan ${plan.id}: ${updateError.message}`);
        }
      }
    }

    const { data: media } = await supabase
      .from("project_media")
      .select("id, image")
      .eq("project_id", project.id);

    for (const row of media ?? []) {
      const resolved = resolveImagePath(row.image);
      if (!resolved.exists) {
        report.missing.push({
          table: "project_media",
          id: row.id,
          projectSlug: project.slug,
          field: "image",
          path: row.image,
        });
      }
      if (resolved.changed) {
        report.mediaUpdates.push({
          id: row.id,
          projectSlug: project.slug,
          from: row.image,
          to: resolved.path,
        });
        console.log("  MEDIA %s: %s → %s", project.slug, row.image, resolved.path);

        if (apply) {
          const { error: updateError } = await supabase
            .from("project_media")
            .update({ image: resolved.path, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (updateError) throw new Error(`media ${row.id}: ${updateError.message}`);
        }
      }
    }
  }
}

if (!verifyOnly) {
  if (!dryRun && !apply) {
    console.error("Pass --dry-run, --apply, or --verify");
    process.exit(1);
  }
  await applyFixes();
}

const samplePaths = await loadAllImagePaths();
const uniqueSample = [...new Set(samplePaths)].slice(0, 40);

if (verifyOnly || apply) {
  await checkPathsHttp(uniqueSample, apply ? "after" : "before");
}

console.log("\n=== IMAGE PATH REPORT ===");
console.log(
  JSON.stringify(
    {
      mode: report.mode,
      projectUpdates: report.projectUpdates.length,
      floorPlanUpdates: report.floorPlanUpdates.length,
      mediaUpdates: report.mediaUpdates.length,
      missing: report.missing.length,
      details: report,
    },
    null,
    2,
  ),
);

if (report.missing.length && apply) {
  console.warn("\nWARN: some paths still missing on disk — upload assets or fix CMS manually.");
}
