import { getGlobalSeoDefaults } from "./global-seo-defaults";
import {
  GLOBAL_SEO_ENVIRONMENT_KEYS,
  readGlobalSeoEnvironmentSettings,
} from "./global-seo-environment";
import {
  GLOBAL_SEO_FIELD_KEYS,
  GLOBAL_SEO_SETTING_KEY,
  type GlobalSeoEffectiveContract,
  type GlobalSeoSettings,
  type GlobalSeoSettingsInput,
} from "./global-seo-types";
import {
  parseGlobalSeoPersistedValue,
  validateGlobalSeoSettingsInput,
} from "./parse-global-seo";

function hasValue(settings: GlobalSeoSettingsInput, key: keyof GlobalSeoSettings) {
  return Object.prototype.hasOwnProperty.call(settings, key) && settings[key] !== undefined;
}

export function resolveGlobalSeoEffectiveContract(input: {
  databaseValue?: unknown;
  databaseStatus: GlobalSeoEffectiveContract["databaseStatus"];
  databaseError?: string;
}): GlobalSeoEffectiveContract {
  const persistedSettings = parseGlobalSeoPersistedValue(input.databaseValue);
  const environmentSettings = readGlobalSeoEnvironmentSettings();
  const sourceIssues: GlobalSeoEffectiveContract["sourceIssues"] = [];
  for (const [source, candidate] of [
    ["database", persistedSettings],
    ["environment", environmentSettings],
  ] as const) {
    for (const issue of validateGlobalSeoSettingsInput(candidate)) {
      delete candidate[issue.field];
      sourceIssues.push({ source, field: issue.field, message: issue.message });
    }
  }
  const codeFallback = getGlobalSeoDefaults();
  const settings = {} as GlobalSeoSettings;
  const fields = {} as GlobalSeoEffectiveContract["fields"];

  for (const key of GLOBAL_SEO_FIELD_KEYS) {
    const persisted = hasValue(persistedSettings, key);
    const environment = hasValue(environmentSettings, key);
    const value = persisted
      ? persistedSettings[key]
      : environment
        ? environmentSettings[key]
        : codeFallback[key];
    const source = persisted ? "database" : environment ? "environment" : "code_fallback";

    (settings as Record<string, unknown>)[key] = value;
    fields[key] = {
      key,
      value: value as GlobalSeoSettings[keyof GlobalSeoSettings],
      source,
      persisted,
      environmentKey: GLOBAL_SEO_ENVIRONMENT_KEYS[key],
    };
  }

  return {
    settingKey: GLOBAL_SEO_SETTING_KEY,
    databaseStatus: input.databaseStatus,
    databaseError: input.databaseError,
    persistedSettings,
    settings,
    fields,
    sourceIssues,
  };
}
