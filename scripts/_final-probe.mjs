import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  let k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const home = await fetch("http://127.0.0.1:3000/");
const homeHtml = await home.text();
console.log("HOME wa.me:", [...new Set([...homeHtml.matchAll(/wa\.me\/[0-9]+/g)].map((m) => m[0]))]);
console.log("HOME 201000000000:", homeHtml.includes("201000000000"));

const { data: homeContact } = await sb
  .from("content_block_templates")
  .select("config")
  .eq("slug", "home-contact")
  .maybeSingle();
console.log("CMS home-contact button href:", homeContact?.config?.button?.href ?? homeContact?.config?.primaryCta?.href ?? "n/a");

const topicRes = await fetch("http://127.0.0.1:3000/topics/e2e-test-feed-topic-1");
const topicHtml = await topicRes.text();
const body = topicHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
console.log("TOPIC &lt;p&gt; escaped:", body.includes("&lt;p&gt;"));
console.log("TOPIC visible <p> outside rich-text:", /<p>/.test(body) && !body.includes("rich-text-content"));

const { data: topic } = await sb.from("topics").select("slug,content").eq("slug", "e2e-test-feed-topic-1").maybeSingle();
console.log("TOPIC content starts with:", String(topic?.content ?? "").slice(0, 80));

const { data: realTopic } = await sb
  .from("topics")
  .select("slug,content")
  .eq("status", "published")
  .is("deleted_at", null)
  .not("slug", "like", "e2e-%")
  .limit(1)
  .maybeSingle();
if (realTopic) {
  const r = await fetch(`http://127.0.0.1:3000/topics/${realTopic.slug}`);
  const h = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi, "");
  console.log(`REAL TOPIC ${realTopic.slug} HTML in body:`, String(realTopic.content ?? "").startsWith("<") && h.includes("<p>") && !h.includes("rich-text-content"));
}
