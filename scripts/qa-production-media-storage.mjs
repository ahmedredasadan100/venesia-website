import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));
assert(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL is required");
assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const checks = [];
function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  assert(ok, name);
}

async function ensureBucket(id, options) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`List buckets: ${listError.message}`);

  if (buckets?.some((bucket) => bucket.id === id)) {
    const { error } = await supabase.storage.updateBucket(id, options);
    if (error) throw new Error(`Update ${id}: ${error.message}`);
    return "updated";
  }

  const { error } = await supabase.storage.createBucket(id, options);
  if (error) throw new Error(`Create ${id}: ${error.message}`);
  return "created";
}

const imageBucketResult = await ensureBucket("cms-images", {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
  ],
});
const documentBucketResult = await ensureBucket("cms-documents", {
  public: true,
  fileSizeLimit: 12 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf"],
});
check(
  "durable Storage buckets are provisioned",
  ["created", "updated"].includes(imageBucketResult) &&
    ["created", "updated"].includes(documentBucketResult),
  `images=${imageBucketResult}, documents=${documentBucketResult}`,
);

const runId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const objectPath = `images/topics/qa-production-media-${runId}.png`;
const topicSlug = `qa-production-media-${runId}`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let topicId = null;

try {
  const { error: uploadError } = await supabase.storage
    .from("cms-images")
    .upload(objectPath, png, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw new Error(`Upload QA image: ${uploadError.message}`);

  const { data: publicData } = supabase.storage
    .from("cms-images")
    .getPublicUrl(objectPath);
  const publicUrl = publicData.publicUrl;
  check(
    "upload returns a stable public URL",
    publicUrl.includes("/storage/v1/object/public/cms-images/images/topics/"),
    publicUrl,
  );

  const publicResponse = await fetch(publicUrl, { cache: "no-store" });
  check(
    "uploaded image is publicly readable",
    publicResponse.ok &&
      (publicResponse.headers.get("content-type") || "").startsWith("image/png"),
    `${publicResponse.status} ${publicResponse.headers.get("content-type") || ""}`,
  );

  const { data: listed, error: listError } = await supabase.storage
    .from("cms-images")
    .list("images/topics", { limit: 1000 });
  if (listError) throw new Error(`List QA image: ${listError.message}`);
  check(
    "uploaded image appears in the Storage-backed library",
    listed?.some((entry) => entry.name === objectPath.split("/").pop()),
  );

  const { data: inserted, error: insertError } = await supabase
    .from("topics")
    .insert({
      slug: topicSlug,
      title: `QA Production Media ${runId}`,
      excerpt: "Temporary QA topic for durable media storage verification.",
      content: "Temporary QA content.",
      image: publicUrl,
      image_alt: "Temporary durable media QA image",
      category: "QA",
      category_slug: "qa",
      content_type: "article",
      status: "draft",
      is_featured: false,
      is_popular: false,
      seo_keywords: [],
      faq: [],
    })
    .select("id, image, image_alt")
    .single();
  if (insertError || !inserted) {
    throw new Error(`Persist topic image: ${insertError?.message || "no row returned"}`);
  }
  topicId = inserted.id;
  check(
    "managed image URL and Alt Text persist in a topic",
    inserted.image === publicUrl && inserted.image_alt === "Temporary durable media QA image",
  );

  const { data: reloaded, error: reloadError } = await supabase
    .from("topics")
    .select("image, image_alt")
    .eq("id", topicId)
    .single();
  if (reloadError) throw new Error(`Reload topic: ${reloadError.message}`);
  check(
    "topic reload retains the managed image selection",
    reloaded?.image === publicUrl &&
      reloaded?.image_alt === "Temporary durable media QA image",
  );

  check(
    "legacy public image remains present without backfill",
    existsSync(resolve(ROOT, "public/images/venesia-5.png")),
  );
} finally {
  if (topicId != null) {
    const { error } = await supabase.from("topics").delete().eq("id", topicId);
    if (error) console.error(`Cleanup topic failed: ${error.message}`);
  }

  const { error: removeError } = await supabase.storage
    .from("cms-images")
    .remove([objectPath]);
  if (removeError) console.error(`Cleanup image failed: ${removeError.message}`);
}

const [{ count: topicCount, error: topicCountError }, { data: remaining, error: remainingError }] =
  await Promise.all([
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("slug", topicSlug),
    supabase.storage
      .from("cms-images")
      .list("images/topics", { search: objectPath.split("/").pop(), limit: 10 }),
  ]);
if (topicCountError) throw new Error(`Verify topic cleanup: ${topicCountError.message}`);
if (remainingError) throw new Error(`Verify image cleanup: ${remainingError.message}`);
check("temporary topic is deleted", topicCount === 0);
check(
  "temporary managed image is deleted",
  !(remaining ?? []).some((entry) => entry.name === objectPath.split("/").pop()),
);

console.log(`\nProduction media storage integration: ${checks.length}/${checks.length} checks passed.`);
