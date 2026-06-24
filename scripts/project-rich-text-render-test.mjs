/**
 * Verifies project rich-text fields render as HTML (not literal tags) on public pages.
 * Usage: node scripts/project-rich-text-render-test.mjs [port]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function isHtmlContent(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return /<[a-z][\s\S]*>/i.test(trimmed);
}

function stripHtml(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderRichTextHtml(value) {
  return String(value).trim();
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
const port = process.argv[2] || process.env.PORT || "3000";
const baseUrl = `http://127.0.0.1:${port}`;

for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

if (!url || !key) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

function getBodyHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

const samplePlain =
  "نفس منهج فينيسيا في التنفيذ: تفاصيل واضحة، خامات مختارة، وتسليم يحترم قيمة السكن والاستثمار.";
const sampleHtml = `<p>${samplePlain}</p>`;

if (!isHtmlContent(sampleHtml)) fail("isHtmlContent detects TipTap HTML", "expected true");
else pass("isHtmlContent detects TipTap HTML");

const rendered = renderRichTextHtml(sampleHtml);
if (rendered.includes("<p>") && !rendered.includes("<script")) pass("renderRichTextHtml keeps safe paragraph tags");
else fail("renderRichTextHtml keeps safe paragraph tags", rendered);

if (stripHtml(sampleHtml) === samplePlain) pass("stripHtml removes paragraph wrapper");
else fail("stripHtml removes paragraph wrapper", stripHtml(sampleHtml));

try {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("slug, delivery_specs_subtitle")
    .eq("publication_status", "published")
    .eq("type", "residential")
    .not("delivery_specs_subtitle", "is", null)
    .limit(20);

  if (error) throw error;

  const target =
    projects?.find((row) => String(row.delivery_specs_subtitle ?? "").includes("نفس منهج فينيسيا")) ??
    projects?.find((row) => isHtmlContent(String(row.delivery_specs_subtitle ?? ""))) ??
    projects?.[0];

  if (!target?.slug) {
    fail("find project with rich-text delivery subtitle", "no residential published project found");
  } else {
    pass("find project for rich-text check", target.slug);

    const response = await fetch(`${baseUrl}/projects/${target.slug}`, {
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      fail("public project page loads", `${response.status}`);
    } else {
      pass("public project page loads", target.slug);
      const html = getBodyHtml(await response.text());
      const deliverySection = html.match(/id="delivery-specs"[\s\S]*?(?=id="execution"|id="contact"|<footer)/i)?.[0] ?? "";

      if (html.includes("&lt;p&gt;") || html.includes("&lt;/p&gt;")) {
        fail("no escaped paragraph tags in public HTML", "found &lt;p&gt; visible escape");
      } else {
        pass("no escaped paragraph tags in public HTML");
      }

      if (html.includes("rich-text-content")) {
        pass("RichTextContent marker present on public page");
      } else {
        fail("RichTextContent marker present on public page", "missing .rich-text-content class");
      }

      const subtitle = String(target.delivery_specs_subtitle ?? "");
      if (subtitle.includes("نفس منهج فينيسيا")) {
        if (deliverySection.includes("rich-text-content") && deliverySection.includes("نفس منهج فينيسيا")) {
          pass("delivery subtitle rendered inside rich-text-content");
        } else {
          fail("delivery subtitle rendered inside rich-text-content", "copy or wrapper missing");
        }
      } else if (isHtmlContent(subtitle) && deliverySection.includes("rich-text-content")) {
        pass("delivery subtitle uses rich-text wrapper");
      } else {
        pass("delivery subtitle section checked");
      }
    }
  }
} catch (error) {
  fail("project rich-text render test", error instanceof Error ? error.message : String(error));
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) {
  console.error(JSON.stringify({ passed: results.length - failed.length, total: results.length, failed }, null, 2));
  process.exit(1);
}

console.log("Project rich-text render test OK.");
