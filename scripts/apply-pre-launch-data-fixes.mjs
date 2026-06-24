/**
 * Pre-launch data fixes (idempotent):
 * 1. home-contact WhatsApp → https://wa.me/201033766876
 * 2. e2e-test-feed-topic-1 → draft
 * 3. track-intro final body copy
 *
 * Usage: node scripts/apply-pre-launch-data-fixes.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");

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

const CORRECT_WA = "https://wa.me/201033766876";
const WRONG_WA = ["201000000000", "201012345678"];
const E2E_TOPIC_PREFIX = "e2e-test-feed-topic-";
const TRACK_INTRO_BODY =
  "بوابة متابعة المشروع تتيح لك الاطلاع على مراحل التنفيذ والتحديثات الميدانية ونسب الإنجاز، بشكل واضح يعكس ما يحدث على أرض الواقع. تواصل مع فريق فينيسيا للحصول على آخر المستجدات حول وحدتك.";

async function fixHomeContactWhatsApp() {
  const { data: template, error } = await supabase
    .from("content_block_templates")
    .select("id,slug,config")
    .eq("slug", "home-contact")
    .maybeSingle();

  if (error) throw new Error(`home-contact lookup: ${error.message}`);
  if (!template) throw new Error("home-contact template not found");

  const config = { ...(template.config ?? {}) };
  config.button = {
    ...(config.button ?? {}),
    href: CORRECT_WA,
  };

  const contacts = Array.isArray(config.contacts) ? [...config.contacts] : [];
  for (const item of contacts) {
    if (typeof item?.href === "string" && item.href.includes("wa.me")) {
      item.href = CORRECT_WA;
      item.value = "01033766876";
    }
  }
  config.contacts = contacts;

  const { error: updateError } = await supabase
    .from("content_block_templates")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", template.id);

  if (updateError) throw new Error(`home-contact update: ${updateError.message}`);

  console.log("OK home-contact WhatsApp updated (template id=%s)", template.id);
}

async function draftE2eTopics() {
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id,slug,status")
    .like("slug", `${E2E_TOPIC_PREFIX}%`);

  if (error) throw new Error(`topic lookup: ${error.message}`);
  if (!topics?.length) {
    console.log("SKIP no e2e test topics found");
    return;
  }

  for (const topic of topics) {
    if (topic.status === "draft") {
      console.log("SKIP %s already draft", topic.slug);
      continue;
    }

    const { error: updateError } = await supabase
      .from("topics")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", topic.id);

    if (updateError) throw new Error(`topic draft ${topic.slug}: ${updateError.message}`);
    console.log("OK %s set to draft (id=%s)", topic.slug, topic.id);
  }
}

async function fixTrackIntro() {
  const { data: template, error } = await supabase
    .from("content_block_templates")
    .select("id,slug,config")
    .eq("slug", "track-intro")
    .maybeSingle();

  if (error) throw new Error(`track-intro lookup: ${error.message}`);
  if (!template) throw new Error("track-intro template not found");

  const config = { ...(template.config ?? {}), body: TRACK_INTRO_BODY };

  const { error: updateError } = await supabase
    .from("content_block_templates")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("id", template.id);

  if (updateError) throw new Error(`track-intro update: ${updateError.message}`);

  console.log("OK track-intro body updated (template id=%s)", template.id);
}

async function verify() {
  const { data: homeContact } = await supabase
    .from("content_block_templates")
    .select("config")
    .eq("slug", "home-contact")
    .maybeSingle();

  const configJson = JSON.stringify(homeContact?.config ?? {});
  for (const bad of WRONG_WA) {
    if (configJson.includes(bad)) {
      throw new Error(`home-contact still contains ${bad}`);
    }
  }
  if (!configJson.includes("201033766876")) {
    throw new Error("home-contact missing correct WhatsApp");
  }

  const { data: e2ePublished } = await supabase
    .from("topics")
    .select("slug")
    .like("slug", `${E2E_TOPIC_PREFIX}%`)
    .eq("status", "published");

  if (e2ePublished?.length) {
    throw new Error(`e2e test topics still published: ${e2ePublished.map((t) => t.slug).join(", ")}`);
  }

  const { data: trackIntro } = await supabase
    .from("content_block_templates")
    .select("config")
    .eq("slug", "track-intro")
    .maybeSingle();

  const body = trackIntro?.config?.body ?? "";
  if (body.includes("يمكنك تعديل هذا النص من لوحة التحكم")) {
    throw new Error("track-intro still has admin placeholder text");
  }
  if (!body.includes("مراحل التنفيذ والتحديثات الميدانية")) {
    throw new Error("track-intro final body missing");
  }

  console.log("VERIFY OK — home WhatsApp, e2e topic, track intro");
}

async function main() {
  await fixHomeContactWhatsApp();
  await draftE2eTopics();
  await fixTrackIntro();
  await verify();
  console.log(JSON.stringify({ ok: true }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
