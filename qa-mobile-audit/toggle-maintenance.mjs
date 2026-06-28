import fs from "fs";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1].trim()] = v;
  }
}

loadEnv(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const action = process.argv[2] ?? "read";

async function read() {
  const r = await fetch(`${url}/rest/v1/site_settings?select=value&key=eq.maintenance_mode&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log(JSON.stringify(await r.json(), null, 2));
}

async function set(enabled) {
  const r = await fetch(`${url}/rest/v1/site_settings?key=eq.maintenance_mode`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ value: { enabled } }),
  });
  console.log("status", r.status);
  console.log(JSON.stringify(await r.json(), null, 2));
}

if (action === "read") await read();
else if (action === "off") await set(false);
else if (action === "on") await set(true);
