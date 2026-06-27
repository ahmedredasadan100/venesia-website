/**
 * Fix server action guards: strip all requireAdminSession() calls, then insert once
 * at the start of each exported async function body.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function fixFile(filePath) {
  let lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  lines = lines.filter((line) => !/^\s+await requireAdminSession\(\);\s*$/.test(line));

  const out = [];
  let i = 0;
  let inserted = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("export async function ")) {
      out.push(line);
      i += 1;
      continue;
    }

    out.push(line);
    i += 1;

    if (line.includes("{")) {
      const indent = (line.match(/^\s*/) ?? [""])[0];
      out.push(`${indent}  await requireAdminSession();`);
      inserted += 1;
      continue;
    }

    while (i < lines.length && !lines[i].includes("{")) {
      out.push(lines[i]);
      i += 1;
    }

    if (i >= lines.length) break;

    const braceLine = lines[i];
    out.push(braceLine);
    i += 1;

    const indent = (braceLine.match(/^\s*/) ?? [""])[0];
    out.push(`${indent}  await requireAdminSession();`);
    inserted += 1;
  }

  writeFileSync(filePath, out.join("\n"), "utf8");
  return { filePath, inserted };
}

const files = process.argv.slice(2).map((f) => resolve(f));
console.log(JSON.stringify(files.map(fixFile), null, 2));
