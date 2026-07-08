import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "sql", "migrations");

if (!existsSync(migrationsDir)) {
  console.error("FAIL: sql/migrations directory is missing.");
  process.exit(1);
}

const sqlFiles = readdirSync(migrationsDir)
  .filter((name) => name.toLowerCase().endsWith(".sql"))
  .sort();

if (sqlFiles.length === 0) {
  console.error("FAIL: sql/migrations exists but contains no .sql files.");
  process.exit(1);
}

console.log(`OK: sql/migrations contains ${sqlFiles.length} migration file(s).`);
for (const file of sqlFiles) {
  console.log(` - ${file}`);
}
