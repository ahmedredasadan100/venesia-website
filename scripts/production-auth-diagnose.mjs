/**
 * Safe production auth probe — never prints secrets.
 * Usage: node scripts/production-auth-diagnose.mjs https://your-domain.com [username] [password]
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
const username = process.argv[3] ?? "admin";
const password = process.argv[4] ?? "";

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

async function postLogin(endpoint) {
  if (!password) {
    return { skipped: true, reason: "pass password as 4th CLI arg (never commit credentials)" };
  }
  return fetch(`${base}${endpoint}`, {
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
  hasAdminSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
  usesDatabaseAdminUsers: true,
});

const maintenanceLogin = await postLogin("/api/maintenance/login");
if (maintenanceLogin.skipped) {
  console.log("\n3) POST /api/maintenance/login: skipped —", maintenanceLogin.reason);
} else {
  const maintenanceCookies = parseSetCookie(maintenanceLogin.headers);
  const maintenanceMeta = cookieMeta(maintenanceCookies[0] ?? "");
  console.log("\n3) POST /api/maintenance/login");
  console.log({
    status: maintenanceLogin.status,
    hasSetCookie: maintenanceCookies.length > 0,
    cookieName: maintenanceMeta.name,
    sameCookieAsAdmin: maintenanceMeta.name === "venesia_admin_session",
  });
}

const maintenancePage = await fetch(`${base}/maintenance`, { redirect: "manual" });
console.log("\n/maintenance page");
console.log({ status: maintenancePage.status, is404: maintenancePage.status === 404 });

const loginRes = await postLogin("/api/admin/auth/login");
if (loginRes.skipped) {
  console.log("\n2) POST /api/admin/auth/login: skipped —", loginRes.reason);
  process.exit(0);
}

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
  console.log("→ invalid credentials or admin_users migration not applied.");
}

if (loginRes.status === 503) {
  console.log("→ ADMIN_SESSION_SECRET missing or no admin_users row in database.");
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

console.log("\n4) proxy.ts notes");
console.log({
  adminCookieName: "venesia_admin_session",
  adminPublicPaths: ["/admin/login", "/api/admin/auth/login"],
  maintenancePublicPaths: ["/maintenance", "/api/maintenance/login"],
  adminUsersTable: "admin_users",
});
