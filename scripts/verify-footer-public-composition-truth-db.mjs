import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Supabase service credentials are required.");

const db = createClient(url, serviceRole, { auth: { persistSession: false } });
const [health, footerRows, auditRows] = await Promise.all([
  db.rpc("global_seo_infrastructure_health"),
  db.from("site_settings").select("key,value").like("key", "footer.%").order("key"),
  db.from("admin_audit_logs").select("action,entity_label,metadata")
    .eq("metadata->>migration", "20260805090000_footer_public_composition_truth_closure")
    .order("id"),
]);

const failures = [];
if (health.error) failures.push(`health RPC: ${health.error.message}`);
if (footerRows.error) failures.push(`footer inventory: ${footerRows.error.message}`);
if (auditRows.error) failures.push(`audit evidence: ${auditRows.error.message}`);

const proof = health.data ?? {};
const expectedKeys = ["footer.contact_items", "footer.legal", "footer.slots", "footer.social_links"];
const actualKeys = (footerRows.data ?? []).map((row) => row.key);
if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) failures.push(`Footer keys: ${actualKeys.join(", ")}`);
if (proof.footer_single_source !== true) failures.push("footer_single_source is not true");
if (proof.footer_orphan_setting_count !== 0) failures.push(`footer_orphan_setting_count=${String(proof.footer_orphan_setting_count)}`);
if (proof.home_composition_assignment_count !== 4) failures.push(`home assignments=${String(proof.home_composition_assignment_count)}`);
if (proof.media_hub_composition_assignment_count !== 5) failures.push(`hub assignments=${String(proof.media_hub_composition_assignment_count)}`);
if (proof.media_sidebar_composition_assignment_count !== 18) failures.push(`sidebar assignments=${String(proof.media_sidebar_composition_assignment_count)}`);
if (proof.media_hero_composition_assignment_count !== 6) failures.push(`hero assignments=${String(proof.media_hero_composition_assignment_count)}`);
if (proof.public_composition_unresolved_reference_count !== 0) failures.push(`unresolved references=${String(proof.public_composition_unresolved_reference_count)}`);
if (proof.footer_public_composition_audit_count !== 2 || (auditRows.data ?? []).length !== 2) failures.push("closure Audit row parity is not 2");

if (failures.length) {
  console.error("FAIL Footer/Public Composition DB proof:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("PASS Footer/Public Composition DB proof");
console.log(` - canonical Footer keys: ${actualKeys.join(", ")}`);
console.log(" - Home=4, Hub=5, Sidebar=18, Media heroes=6, unresolved references=0, Audit=2.");
