import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars in .env.local");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function snapshot(plans) {
  return JSON.stringify(
    (plans ?? []).map((row) => ({
      area: row.area,
      label: row.label,
      plan_image: row.plan_image,
      sort_order: row.sort_order,
      featured: row.featured,
    })),
  );
}

const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("id")
  .order("id", { ascending: true })
  .limit(1)
  .maybeSingle();

if (projectError || !project) {
  throw new Error(projectError?.message ?? "No project found for RPC test");
}

const projectId = project.id;

const { data: beforePlans, error: beforeError } = await supabase
  .from("project_floor_plans")
  .select("area, label, plan_image, sort_order, featured")
  .eq("project_id", projectId)
  .order("sort_order", { ascending: true });

if (beforeError) throw new Error(beforeError.message);

console.log("Project:", projectId);
console.log("Floor plans before:", beforePlans?.length ?? 0);

const unchangedPayload = {
  p_project_id: projectId,
  p_floor_plans: (beforePlans ?? []).map((row, index) => ({
    area: row.area,
    label: row.label,
    plan_image: row.plan_image,
    featured: row.featured,
    sort_order: index,
    specs: [],
  })),
};

const { error: unchangedError } = await supabase.rpc("sync_project_children", unchangedPayload);
if (unchangedError) throw new Error(`Unchanged save failed: ${unchangedError.message}`);
console.log("OK: unchanged floor plans save");

const { data: afterUnchanged } = await supabase
  .from("project_floor_plans")
  .select("area, label, plan_image, sort_order, featured")
  .eq("project_id", projectId)
  .order("sort_order", { ascending: true });

if (snapshot(beforePlans) !== snapshot(afterUnchanged)) {
  throw new Error("Unchanged save mutated floor plans");
}

const modifiedPayload = {
  p_project_id: projectId,
  p_floor_plans: [
    ...(beforePlans ?? []).map((row, index) => ({
      area: row.area,
      label: row.label,
      plan_image: row.plan_image,
      featured: row.featured,
      sort_order: index,
      specs: [],
    })),
    {
      area: "RPC Test Area",
      label: "اختبار RPC",
      plan_image: "/images/projects/default.jpg",
      featured: false,
      sort_order: (beforePlans ?? []).length,
      specs: [{ label: "Test", value: "1" }],
    },
  ],
};

const { error: addError } = await supabase.rpc("sync_project_children", modifiedPayload);
if (addError) throw new Error(`Add floor plan failed: ${addError.message}`);
console.log("OK: add floor plan save");

const { data: afterAdd } = await supabase
  .from("project_floor_plans")
  .select("id, area, label, plan_image, sort_order, featured")
  .eq("project_id", projectId)
  .order("sort_order", { ascending: true });

if ((afterAdd?.length ?? 0) !== (beforePlans?.length ?? 0) + 1) {
  throw new Error("Add floor plan did not persist expected row count");
}

const restorePayload = {
  p_project_id: projectId,
  p_floor_plans: (beforePlans ?? []).map((row, index) => ({
    area: row.area,
    label: row.label,
    plan_image: row.plan_image,
    featured: row.featured,
    sort_order: index,
    specs: [],
  })),
};

const { error: restoreError } = await supabase.rpc("sync_project_children", restorePayload);
if (restoreError) throw new Error(`Restore failed: ${restoreError.message}`);
console.log("OK: restore original floor plans");

const invalidPayload = {
  p_project_id: projectId,
  p_floor_plans: { invalid: true },
};

const { error: invalidError } = await supabase.rpc("sync_project_children", invalidPayload);
if (!invalidError) {
  throw new Error("Expected invalid payload to fail");
}
console.log("OK: invalid payload rejected:", invalidError.message);

const { data: afterFailure } = await supabase
  .from("project_floor_plans")
  .select("area, label, plan_image, sort_order, featured")
  .eq("project_id", projectId)
  .order("sort_order", { ascending: true });

if (snapshot(beforePlans) !== snapshot(afterFailure)) {
  throw new Error("Invalid payload caused data loss");
}
console.log("OK: rollback preserved existing floor plans after invalid payload");

console.log("All sync_project_children RPC tests passed.");
