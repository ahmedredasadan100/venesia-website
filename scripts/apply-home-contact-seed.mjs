/**
 * Applies sql/migrations/20250624200000_home_contact_module_seed.sql via Supabase JS
 * (same semantics as the SQL seed — idempotent upsert by slug / page+template).
 *
 * Usage: node scripts/apply-home-contact-seed.mjs
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TEMPLATE = {
  name: "Home — Contact",
  slug: "home-contact",
  description: "CTA الرئيسية — تواصل + صورة",
  variant: "about-cta",
  style_preset: "premium-dark",
  status: "published",
  sort_order: 30,
  config: {
    eyebrow: "Venesia Developments",
    title: "تبحث عن وحدة تناسب\nخطتك القادمة؟",
    description:
      "فريقنا الاستشاري جاهز لمساعدتك في اختيار المشروع الأنسب حسب موقعك، ميزانيتك، وهدفك الاستثماري.",
    button: {
      label: "تحدث مع مستشار الآن",
      href: "https://wa.me/201033766876",
    },
    note: "احجز استشارتك المجانية",
    image: "/images/home-cta-building-night.png",
    imageAlt: "",
    contacts: [
      {
        label: "تواصل عبر واتساب",
        value: "01033766876",
        href: "https://wa.me/201033766876",
      },
      {
        label: "الخط الساخن",
        value: "15875",
        href: "tel:15875",
      },
      {
        label: "البريد الإلكتروني",
        value: "info@venesia-developments.com",
        href: "mailto:info@venesia-developments.com",
      },
      {
        label: "ساعات العمل",
        value: "السبت – الخميس ٩ص – ٦م",
      },
    ],
  },
};

async function main() {
  const { data: existingTemplate, error: lookupError } = await supabase
    .from("content_block_templates")
    .select("id,slug,status")
    .eq("slug", "home-contact")
    .maybeSingle();

  if (lookupError) {
    console.error("Template lookup failed:", lookupError.message);
    process.exit(1);
  }

  let templateId = existingTemplate?.id ?? null;

  if (templateId) {
    const { error: updateError } = await supabase
      .from("content_block_templates")
      .update({
        name: TEMPLATE.name,
        description: TEMPLATE.description,
        variant: TEMPLATE.variant,
        style_preset: TEMPLATE.style_preset,
        status: TEMPLATE.status,
        config: TEMPLATE.config,
        sort_order: TEMPLATE.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    if (updateError) {
      console.error("Template update failed:", updateError.message);
      process.exit(1);
    }
    console.log("Updated content_block_templates slug=home-contact (id=%s)", templateId);
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("content_block_templates")
      .insert(TEMPLATE)
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("Template insert failed:", insertError?.message ?? "no data");
      process.exit(1);
    }
    templateId = inserted.id;
    console.log("Inserted content_block_templates slug=home-contact (id=%s)", templateId);
  }

  const { data: homePage, error: pageError } = await supabase
    .from("pages")
    .select("id,slug,status")
    .eq("slug", "home")
    .maybeSingle();

  if (pageError) {
    console.error("Home page lookup failed:", pageError.message);
    process.exit(1);
  }

  if (!homePage) {
    console.error("Migration seed skipped assignment: pages.slug='home' not found.");
    console.log(JSON.stringify({ ok: true, templateId, assignment: null, homePageMissing: true }));
    process.exit(0);
  }

  const { data: existingAssignment, error: assignLookupError } = await supabase
    .from("page_content_block_assignments")
    .select("id,slot,sort_order,is_visible")
    .eq("page_id", homePage.id)
    .eq("template_id", templateId)
    .maybeSingle();

  if (assignLookupError) {
    console.error("Assignment lookup failed:", assignLookupError.message);
    process.exit(1);
  }

  if (existingAssignment) {
    const { error: assignUpdateError } = await supabase
      .from("page_content_block_assignments")
      .update({
        slot: "main",
        sort_order: 30,
        is_visible: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAssignment.id);

    if (assignUpdateError) {
      console.error("Assignment update failed:", assignUpdateError.message);
      process.exit(1);
    }
    console.log(
      "Updated page_content_block_assignments id=%s (page=home, slot=main, sort_order=30)",
      existingAssignment.id,
    );
    console.log(
      JSON.stringify({
        ok: true,
        templateId,
        assignmentId: existingAssignment.id,
        slot: "main",
        sortOrder: 30,
        action: "updated",
      }),
    );
    return;
  }

  const { data: insertedAssignment, error: assignInsertError } = await supabase
    .from("page_content_block_assignments")
    .insert({
      page_id: homePage.id,
      template_id: templateId,
      slot: "main",
      sort_order: 30,
      is_visible: true,
    })
    .select("id,slot,sort_order,is_visible")
    .single();

  if (assignInsertError || !insertedAssignment) {
    console.error("Assignment insert failed:", assignInsertError?.message ?? "no data");
    process.exit(1);
  }

  console.log(
    "Inserted page_content_block_assignments id=%s (page=home, slot=main, sort_order=30)",
    insertedAssignment.id,
  );
  console.log(
    JSON.stringify({
      ok: true,
      templateId,
      assignmentId: insertedAssignment.id,
      slot: insertedAssignment.slot,
      sortOrder: insertedAssignment.sort_order,
      action: "inserted",
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
