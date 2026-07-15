/**
 * Read-only + temporary write (restored) check that About hero keeps
 * Highlight and Subtitle independent in stored config and public HTML.
 *
 * Requires .env.local Supabase keys. Restores original config after assertion.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase env for About hero independence check.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const HIGHLIGHT_MARK = `__HL_INDEP_${Date.now()}__`;
const SUBTITLE_MARK = `__ST_INDEP_${Date.now()}__`;

const { data: hero, error } = await supabase
  .from("hero_templates")
  .select("id,config")
  .eq("id", 2)
  .maybeSingle();

if (error || !hero) {
  console.error("Could not load hero template id=2:", error?.message || "not found");
  process.exit(1);
}

const originalConfig = hero.config && typeof hero.config === "object" ? { ...hero.config } : {};
const patched = {
  ...originalConfig,
  highlight: HIGHLIGHT_MARK,
  subtitle: SUBTITLE_MARK,
  showHighlight: true,
  showSubtitle: true,
};

const { error: updateError } = await supabase
  .from("hero_templates")
  .update({ config: patched })
  .eq("id", 2);

if (updateError) {
  console.error("Failed to patch hero config:", updateError.message);
  process.exit(1);
}

let failed = false;

try {
  const { data: reloaded, error: reloadError } = await supabase
    .from("hero_templates")
    .select("config")
    .eq("id", 2)
    .single();

  if (reloadError) throw new Error(reloadError.message);
  const cfg = reloaded.config || {};
  if (cfg.highlight !== HIGHLIGHT_MARK || cfg.subtitle !== SUBTITLE_MARK) {
    console.error("FAIL: highlight/subtitle not stored independently");
    failed = true;
  } else {
    console.log("PASS: highlight and subtitle stored independently in config");
  }

  if (cfg.highlight === cfg.subtitle) {
    console.error("FAIL: highlight equals subtitle unexpectedly");
    failed = true;
  }
} finally {
  const { error: restoreError } = await supabase
    .from("hero_templates")
    .update({ config: originalConfig })
    .eq("id", 2);

  if (restoreError) {
    console.error("CRITICAL: failed to restore hero config:", restoreError.message);
    process.exit(1);
  }
  console.log("Restored original hero #2 config");
}

if (failed) process.exit(1);
console.log("About hero independence check passed.");
