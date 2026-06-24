import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isFrameworkEntry(rel) {
  return (
    rel.endsWith("/page.tsx") ||
    rel.endsWith("/page.ts") ||
    rel.endsWith("/layout.tsx") ||
    rel.endsWith("/layout.ts") ||
    rel.endsWith("/route.ts") ||
    rel.endsWith("/loading.tsx") ||
    rel.endsWith("/error.tsx") ||
    rel.endsWith("/not-found.tsx") ||
    rel.endsWith("/global-error.tsx") ||
    rel.endsWith("/template.tsx") ||
    rel.endsWith("/default.tsx") ||
    rel.endsWith("/middleware.ts") ||
    rel === "middleware.ts" ||
    rel.endsWith("/sitemap.ts") ||
    rel.endsWith("/robots.ts")
  );
}

const allFiles = walk(ROOT);
const relFiles = allFiles.map((f) => toPosix(path.relative(ROOT, f)));
const fileContents = new Map(
  allFiles.map((f) => [toPosix(path.relative(ROOT, f)), fs.readFileSync(f, "utf8")]),
);
const allText = [...fileContents.values()].join("\n");

function importPatterns(rel) {
  const noExt = rel.replace(/\.(tsx?|jsx?)$/, "");
  const base = path.basename(noExt);
  const parts = noExt.split("/");
  const patterns = new Set([
    rel,
    noExt,
    `@/${noExt}`,
    `./${base}`,
    `../${base}`,
    `../../${base}`,
  ]);
  for (let i = 0; i < parts.length; i++) {
    patterns.add(parts.slice(i).join("/"));
    patterns.add(`@/${parts.slice(i).join("/")}`);
  }
  return [...patterns];
}

function isImported(rel) {
  if (isFrameworkEntry(rel)) return true;
  const patterns = importPatterns(rel);
  for (const [otherRel, content] of fileContents) {
    if (otherRel === rel) continue;
    for (const p of patterns) {
      const re = new RegExp(
        `(?:import|export)\\s+(?:[^'";\\n]+\\s+from\\s+)?['"][^'"]*${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
      );
      if (re.test(content)) return true;
      if (content.includes(`require("${p}")`) || content.includes(`require('${p}')`)) return true;
    }
  }
  return false;
}

const zeroImportFiles = relFiles.filter((rel) => !isImported(rel)).sort();

function extractNamedExports(content) {
  const names = new Set();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /export\s+const\s+([A-Za-z0-9_$]+)/g,
    /export\s+type\s+([A-Za-z0-9_$]+)/g,
    /export\s+interface\s+([A-Za-z0-9_$]+)/g,
    /export\s+enum\s+([A-Za-z0-9_$]+)/g,
    /export\s+\{\s*([^}]+)\s*\}/g,
  ];
  for (const re of patterns.slice(0, 5)) {
    let m;
    while ((m = re.exec(content))) names.add(m[1]);
  }
  for (const m of content.matchAll(/export\s+\{\s*([^}]+)\s*\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && name !== "type") names.add(name);
    }
  }
  return [...names];
}

const unusedExports = [];
for (const rel of relFiles) {
  const content = fileContents.get(rel);
  const exports = extractNamedExports(content);
  for (const name of exports) {
    if (name === "default") continue;
    const usage = new RegExp(`\\b${name}\\b`);
    let count = 0;
    for (const [otherRel, otherContent] of fileContents) {
      if (otherRel === rel) continue;
      if (usage.test(otherContent)) count++;
    }
    if (count === 0) unusedExports.push({ file: rel, export: name });
  }
}

const configFiles = relFiles.filter((rel) => rel.startsWith("config/")).sort();
const unusedConfigFiles = configFiles.filter((rel) => !isImported(rel));

const componentFiles = relFiles.filter(
  (rel) =>
    rel.includes("/components/") &&
    rel.endsWith(".tsx") &&
    !rel.includes(".test.") &&
    !rel.includes(".stories."),
);

const unusedComponents = componentFiles
  .filter((rel) => !isImported(rel))
  .sort();

const libFiles = relFiles.filter((rel) => rel.startsWith("lib/") && !isFrameworkEntry(rel));
const unusedLibFiles = libFiles.filter((rel) => !isImported(rel)).sort();

console.log(JSON.stringify({
  summary: {
    totalSourceFiles: relFiles.length,
    zeroImportFiles: zeroImportFiles.length,
    unusedComponents: unusedComponents.length,
    unusedLibFiles: unusedLibFiles.length,
    unusedConfigFiles: unusedConfigFiles.length,
    unusedNamedExports: unusedExports.length,
  },
  zeroImportFiles,
  unusedComponents,
  unusedLibFiles,
  unusedConfigFiles,
  unusedExports: unusedExports.slice(0, 80),
}, null, 2));
