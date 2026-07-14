/**
 * Read-only database health check for Venesia public/CMS tables.
 *
 * Usage:
 *   npm run verify:db-health
 *
 * Exits 0 when connection + core table reads succeed.
 * Exits 1 on missing env, connect failure, or real query/schema errors.
 * Does not print secrets, tokens, or connection strings.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TIMEOUT_MS = Number.parseInt(process.env.SUPABASE_FETCH_TIMEOUT_MS ?? "8000", 10) || 8000;

const CORE_CHECKS = [
  { name: "pages", select: "id", limit: 1 },
  { name: "site_settings", select: "key", limit: 1 },
  { name: "menus", select: "id", limit: 1 },
  { name: "projects", select: "id", limit: 1 },
  { name: "topics", select: "id", limit: 1 },
];

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function createTimedFetch(timeoutMs) {
  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
        timeoutError.name = "TimeoutError";
        timeoutError.code = "SUPABASE_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function maskEnvPresent(name) {
  return Boolean(process.env[name]?.trim());
}

function printResult(label, ok, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  loadEnvLocal();

  let failed = false;

  console.log("Venesia database health check (read-only)");
  console.log(`Timeout: ${TIMEOUT_MS}ms`);

  const hasUrl = maskEnvPresent("NEXT_PUBLIC_SUPABASE_URL");
  const hasAnon = maskEnvPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const hasService = maskEnvPresent("SUPABASE_SERVICE_ROLE_KEY");

  printResult("NEXT_PUBLIC_SUPABASE_URL present", hasUrl);
  printResult("NEXT_PUBLIC_SUPABASE_ANON_KEY present", hasAnon);
  printResult("SUPABASE_SERVICE_ROLE_KEY present", hasService);

  if (!hasUrl || !hasService) {
    console.error("\nMissing required Supabase server environment variables.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createTimedFetch(TIMEOUT_MS) },
  });

  try {
    const { error } = await supabase.from("pages").select("id").limit(1);
    if (error) {
      printResult("Supabase connectivity", false, error.message || error.code || "query failed");
      failed = true;
    } else {
      printResult("Supabase connectivity", true);
    }
  } catch (error) {
    printResult("Supabase connectivity", false, error?.message || "unexpected failure");
    failed = true;
  }

  for (const check of CORE_CHECKS) {
    try {
      const { error } = await supabase.from(check.name).select(check.select).limit(check.limit);
      if (error) {
        const schemaish =
          /does not exist|schema cache|PGRST205|42P01/i.test(String(error.message || "")) ||
          error.code === "42P01" ||
          error.code === "PGRST205";
        printResult(
          `table:${check.name}`,
          false,
          schemaish ? `schema/migration issue (${error.code || "unknown"})` : error.message || "query failed",
        );
        failed = true;
      } else {
        printResult(`table:${check.name}`, true);
      }
    } catch (error) {
      printResult(`table:${check.name}`, false, error?.message || "unexpected failure");
      failed = true;
    }
  }

  if (failed) {
    console.error("\nDatabase health check failed.");
    process.exit(1);
  }

  console.log("\nDatabase health check passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Database health check crashed:", error?.message || "unknown error");
  process.exit(1);
});
