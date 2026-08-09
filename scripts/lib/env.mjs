import { existsSync, readFileSync } from "node:fs";

/** Loads a local env file without overwriting process-level configuration. */
export function loadEnvFile(path) {
  if (!existsSync(path)) return false;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }

  return true;
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
