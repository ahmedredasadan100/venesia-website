/**
 * Safe production auth probe — never prints secrets.
 * Usage: node scripts/production-auth-diagnose.mjs https://your-domain.com
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1].trim()] = value;
  }
}

loadEnv(".env.local");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const username = process.env.ADMIN_USERNAME?.trim() ?? "";
const password = process.env.ADMIN_PASSWORD ?? "";

function parseSetCookie(headers) {
  return headers.getSetCookie?.() ?? [];
}

function cookieMeta(line = "") {
  return {
    name: line.split("=")[0] || null,
    pathRoot: /Path=\//i.test(line),
    sameSiteLax: /SameSite=Lax/i.test(line),
    secure: /;\s*Secure/i.test(line),
    hasDomain: /;\s*Domain=/i.test(line),
  };
}

async function postLogin() {
  return fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

async function getWithCookies(cookieHeader, target) {
  return fetch(`${base}${target}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    redirect: "manual",
  });
}

console.log("=== Production auth diagnose ===");
console.log("baseUrl:", base);
console.log("envLoadedFromFile:", {
  hasAdminUsername: Boolean(username),
  hasAdminPassword: Boolean(password),
  hasAdminSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
});

const maintenanceLogin = await fetch(`${base}/api/maintenance/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
}).catch((error) => ({ error: error.message }));

if (maintenanceLogin instanceof Response) {
  const maintenanceCookies = parseSetCookie(maintenanceLogin.headers);
  const maintenanceMeta = cookieMeta(maintenanceCookies[0] ?? "");
  console.log("\n3) POST /api/maintenance/login");
  console.log({
    status: maintenanceLogin.status,
    hasSetCookie: maintenanceCookies.length > 0,
    cookieName: maintenanceMeta.name,
    sameCookieAsAdmin: maintenanceMeta.name === "venesia_admin_session",
  });
} else {
  console.log("\n3) POST /api/maintenance/login: unreachable", maintenanceLogin.error);
}

const maintenancePage = await fetch(`${base}/maintenance`, { redirect: "manual" });
console.log("\n/maintenance page");
console.log({ status: maintenancePage.status, is404: maintenancePage.status === 404 });

const loginRes = await postLogin();
const setCookies = parseSetCookie(loginRes.headers);
const cookieLine = setCookies[0] ?? "";
const meta = cookieMeta(cookieLine);
const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");

console.log("\n2) POST /api/admin/auth/login");
console.log({
  status: loginRes.status,
  hasSetCookie: setCookies.length > 0,
  cookieName: meta.name,
  pathRoot: meta.pathRoot,
  sameSiteLax: meta.sameSiteLax,
  secure: meta.secure,
  hasDomain: meta.hasDomain,
});

if (loginRes.status === 401) {
  console.log("→ credentials mismatch or env not loaded on server (Redeploy required after env change).");
}

if (loginRes.status === 503) {
  console.log("→ ADMIN_* env missing or ADMIN_SESSION_SECRET shorter than 16 chars on server.");
}

const adminRes = await getWithCookies(cookieHeader, "/admin");
const adminLocation = adminRes.headers.get("location") ?? "";

console.log("\n7a) GET /admin after login");
console.log({
  status: adminRes.status,
  redirectToLogin: adminLocation.includes("/admin/login"),
});

const adminNoCookie = await getWithCookies("", "/admin");
const noCookieLocation = adminNoCookie.headers.get("location") ?? "";

console.log("\n7c) GET /admin without cookie");
console.log({
  status: adminNoCookie.status,
  redirectToLogin: noCookieLocation.includes("/admin/login"),
});

const publicRes = await getWithCookies("", "/");
console.log("\n7d) GET / (public, no cookie)");
console.log({ status: publicRes.status, redirectedToMaintenance: (publicRes.headers.get("location") ?? "").includes("/maintenance") });

const publicWithCookie = await getWithCookies(cookieHeader, "/");
console.log("\n7e) GET / (public, with admin cookie)");
console.log({
  status: publicWithCookie.status,
  redirectedToMaintenance: (publicWithCookie.headers.get("location") ?? "").includes("/maintenance"),
});

if (loginRes.status === 200 && adminRes.status !== 200 && !adminLocation.includes("/admin") === false) {
  if (adminLocation.includes("/admin/login")) {
    console.log("\n→ login 200 but /admin redirects: cookie not stored or proxy cannot read it.");
  }
}

console.log("\n4) proxy.ts notes");
console.log({
  adminCookieName: "venesia_admin_session",
  adminPublicPaths: ["/admin/login", "/api/admin/auth/login"],
  maintenancePublicPaths: ["/maintenance", "/api/maintenance/login"],
  maintenanceModeStoredIn: "site_settings.maintenance_mode",
});
