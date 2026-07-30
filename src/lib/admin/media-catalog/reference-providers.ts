import "server-only";

import { isDeepStrictEqual } from "node:util";

import { parseManagedStorageAsset } from "../../storage/upload-cms-asset";
import { getSupabaseAdmin } from "../../supabase-admin";
import { getCanonicalMediaIdentityKey } from "./identity";
import type { CanonicalMediaIdentity, MediaReferenceState } from "./types";

const PROVIDER_PAGE_SIZE = 200;

export type DiscoveredMediaReference = {
  identity: CanonicalMediaIdentity;
  publicValue: string;
  domainKey: string;
  entityType: string;
  entityIdentity: string;
  entityLabel: string | null;
  fieldKey: string;
  editHref: string | null;
  publicHref: string | null;
  referenceState: MediaReferenceState;
  restorable: boolean;
};

export type DiscoveredMediaUsage = Omit<DiscoveredMediaReference, "identity">;

export class MediaReferenceProviderRebindError extends Error {
  readonly writeMayHaveCommitted: boolean;

  constructor(code: string, writeMayHaveCommitted: boolean) {
    super(code);
    this.name = "MediaReferenceProviderRebindError";
    this.writeMayHaveCommitted = writeMayHaveCommitted;
  }
}

export type MediaReferenceProvider = {
  readonly domainKey: string;
  readonly table: string;
  readonly entityType: string;
  readonly idField: string;
  readonly fields: readonly string[];
  readonly supportsRebind: boolean;
  scanAll(): Promise<DiscoveredMediaReference[]>;
  scanEntity(entityIdentity: string): Promise<DiscoveredMediaReference[]>;
  scanUsageByPublicValue(publicValue: string): Promise<DiscoveredMediaUsage[]>;
  rebind(reference: DiscoveredMediaReference, nextPublicValue: string): Promise<void>;
};

type ProviderConfig = {
  domainKey: string;
  table: string;
  entityType: string;
  idField?: string;
  labelField?: string;
  fields: readonly string[];
  jsonFields?: readonly string[];
  extraFields?: readonly string[];
  stateFields?: readonly string[];
  supportsRebind?: boolean;
  editHref: (row: Record<string, unknown>) => string | null;
  publicHref?: (row: Record<string, unknown>) => string | null;
  state?: (row: Record<string, unknown>) => { state: MediaReferenceState; restorable: boolean };
};

function valueText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function defaultReferenceState(row: Record<string, unknown>) {
  if (row.deleted_at) return { state: "soft_deleted" as const, restorable: true };
  const status = valueText(row.status ?? row.publication_status).toLowerCase();
  if (status === "draft" || status === "unpublished") return { state: "draft" as const, restorable: false };
  if (status === "archived") return { state: "archived" as const, restorable: true };
  return { state: "active" as const, restorable: false };
}

export function extractMediaCandidateValues(value: unknown): string[] {
  const results = new Set<string>();

  function visit(current: unknown) {
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (!trimmed) return;
      if (/^(https?:\/\/|\/images\/|\/files\/)/i.test(trimmed)) results.add(trimmed);
      for (const match of trimmed.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
        results.add(match[0].replace(/[),.;]+$/, ""));
      }
      for (const match of trimmed.matchAll(/(?<![A-Za-z0-9:/])\/(?:images|files)\/[^\s"'<>\\]+/gi)) {
        results.add(match[0].replace(/[),.;]+$/, ""));
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === "object") {
      Object.values(current as Record<string, unknown>).forEach(visit);
    }
  }

  visit(value);
  return [...results];
}

function mediaPublicValuesMatch(left: string, right: string) {
  if (left.trim() === right.trim()) return true;
  const leftManaged = parseManagedStorageAsset(left);
  const rightManaged = parseManagedStorageAsset(right);
  if (leftManaged && rightManaged) {
    return leftManaged.bucket === rightManaged.bucket && leftManaged.objectPath === rightManaged.objectPath;
  }

  const normalizeLegacyPath = (value: string) => {
    const trimmed = value.trim();
    let pathname = trimmed;
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        pathname = new URL(trimmed).pathname;
      } catch {
        return null;
      }
    } else {
      pathname = trimmed.split(/[?#]/, 1)[0];
    }
    if (!/^\/(?:images|files)\//i.test(pathname)) return null;
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  };

  const leftLegacy = normalizeLegacyPath(left);
  const rightLegacy = normalizeLegacyPath(right);
  return leftLegacy !== null && rightLegacy !== null && leftLegacy === rightLegacy;
}

function discoverRowUsage(config: ProviderConfig, row: Record<string, unknown>, requestedPublicValue: string) {
  const entityIdentity = valueText(row[config.idField ?? "id"]);
  const entityLabel = config.labelField ? valueText(row[config.labelField]) || null : entityIdentity;
  const state = config.state?.(row) ?? defaultReferenceState(row);
  const hits: DiscoveredMediaUsage[] = [];
  const seen = new Set<string>();

  for (const fieldKey of config.fields) {
    for (const publicValue of extractMediaCandidateValues(row[fieldKey])) {
      if (!mediaPublicValuesMatch(publicValue, requestedPublicValue)) continue;
      const key = `${fieldKey}:${publicValue}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        publicValue,
        domainKey: config.domainKey,
        entityType: config.entityType,
        entityIdentity,
        entityLabel,
        fieldKey,
        editHref: config.editHref(row),
        publicHref: config.publicHref?.(row) ?? null,
        referenceState: state.state,
        restorable: state.restorable,
      });
    }
  }
  return hits;
}

export function replaceMediaValue(value: unknown, previousValue: string, nextValue: string): unknown {
  if (typeof value === "string") return value.split(previousValue).join(nextValue);
  if (Array.isArray(value)) return value.map((item) => replaceMediaValue(item, previousValue, nextValue));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        replaceMediaValue(item, previousValue, nextValue),
      ]),
    );
  }
  return value;
}

function discoverRowReferences(config: ProviderConfig, row: Record<string, unknown>) {
  const entityIdentity = valueText(row[config.idField ?? "id"]);
  const entityLabel = config.labelField ? valueText(row[config.labelField]) || null : entityIdentity;
  const state = config.state?.(row) ?? defaultReferenceState(row);
  const references: DiscoveredMediaReference[] = [];
  const seen = new Set<string>();

  for (const fieldKey of config.fields) {
    for (const publicValue of extractMediaCandidateValues(row[fieldKey])) {
      const managed = parseManagedStorageAsset(publicValue);
      if (!managed) continue;
      const identity: CanonicalMediaIdentity = {
        provider: "supabase",
        bucket: managed.bucket,
        objectKey: managed.objectPath,
      };
      const key = `${getCanonicalMediaIdentityKey(identity)}:${fieldKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      references.push({
        identity,
        publicValue,
        domainKey: config.domainKey,
        entityType: config.entityType,
        entityIdentity,
        entityLabel,
        fieldKey,
        editHref: config.editHref(row),
        publicHref: config.publicHref?.(row) ?? null,
        referenceState: state.state,
        restorable: state.restorable,
      });
    }
  }
  return references;
}

function providerColumns(config: ProviderConfig) {
  return [...new Set([
    config.idField ?? "id",
    config.labelField,
    ...(config.stateFields ?? []),
    ...config.fields,
    ...(config.extraFields ?? []),
  ].filter(Boolean))].join(", ");
}

function createProvider(config: ProviderConfig): MediaReferenceProvider {
  const idField = config.idField ?? "id";

  async function fetchRows(entityIdentity?: string) {
    const supabase = getSupabaseAdmin();
    const rows: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
      let query = supabase.from(config.table).select(providerColumns(config)).order(idField, { ascending: true });
      if (entityIdentity !== undefined) query = query.eq(idField, entityIdentity);
      const { data, error } = await query.range(offset, offset + PROVIDER_PAGE_SIZE - 1);
      if (error) {
        throw new Error(`media_reference_provider:${config.domainKey}:${error.code ?? "query_failed"}`);
      }
      const pageRows = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...pageRows);
      if (entityIdentity !== undefined || pageRows.length < PROVIDER_PAGE_SIZE) break;
      offset += PROVIDER_PAGE_SIZE;
    }
    return rows;
  }

  return {
    domainKey: config.domainKey,
    table: config.table,
    entityType: config.entityType,
    idField,
    fields: config.fields,
    supportsRebind: config.supportsRebind ?? true,
    async scanAll() {
      const rows = await fetchRows();
      return rows.flatMap((row) => discoverRowReferences(config, row));
    },
    async scanEntity(entityIdentity) {
      const rows = await fetchRows(entityIdentity);
      return rows.flatMap((row) => discoverRowReferences(config, row));
    },
    async scanUsageByPublicValue(publicValue) {
      const rows = await fetchRows();
      return rows.flatMap((row) => discoverRowUsage(config, row, publicValue));
    },
    async rebind(reference, nextPublicValue) {
      if (config.supportsRebind === false) {
        throw new MediaReferenceProviderRebindError(
          `media_reference_rebind_unsupported:${config.domainKey}`,
          false,
        );
      }
      if (!config.fields.includes(reference.fieldKey)) {
        throw new MediaReferenceProviderRebindError(
          `media_reference_rebind_field_mismatch:${config.domainKey}`,
          false,
        );
      }
      const supabase = getSupabaseAdmin();
      const { data: row, error: readError } = await supabase
        .from(config.table)
        .select(`${idField}, ${reference.fieldKey}`)
        .eq(idField, reference.entityIdentity)
        .single();
      if (readError || !row) {
        throw new MediaReferenceProviderRebindError(
          `media_reference_rebind_read_failed:${config.domainKey}`,
          false,
        );
      }
      const currentValue = (row as unknown as Record<string, unknown>)[reference.fieldKey];
      const nextValue = replaceMediaValue(currentValue, reference.publicValue, nextPublicValue);
      if (isDeepStrictEqual(currentValue, nextValue)) {
        throw new MediaReferenceProviderRebindError(
          `media_reference_rebind_compare_failed:${config.domainKey}`,
          false,
        );
      }
      const { data: updatedRow, error: updateError } = await supabase
        .from(config.table)
        .update({ [reference.fieldKey]: nextValue })
        .eq(idField, reference.entityIdentity)
        .eq(
          reference.fieldKey,
          config.jsonFields?.includes(reference.fieldKey)
            ? JSON.stringify(currentValue)
            : currentValue,
        )
        .select(idField)
        .maybeSingle();
      if (!updateError && updatedRow) return;

      const { data: observedRow, error: verificationError } = await supabase
        .from(config.table)
        .select(`${idField}, ${reference.fieldKey}`)
        .eq(idField, reference.entityIdentity)
        .maybeSingle();
      if (verificationError || !observedRow) {
        throw new MediaReferenceProviderRebindError(
          `media_reference_rebind_state_uncertain:${config.domainKey}`,
          true,
        );
      }
      const observedValue = (observedRow as unknown as Record<string, unknown>)[reference.fieldKey];
      if (isDeepStrictEqual(observedValue, nextValue)) return;
      throw new MediaReferenceProviderRebindError(
        updateError
          ? `media_reference_rebind_write_failed:${config.domainKey}`
          : `media_reference_rebind_concurrent_change:${config.domainKey}`,
        false,
      );
    },
  };
}

const PROVIDER_CONFIGS = [
  {
    domainKey: "topics",
    table: "topics",
    entityType: "topic",
    labelField: "title",
    fields: ["image", "excerpt", "content", "media_payload"],
    jsonFields: ["media_payload"],
    extraFields: ["slug"],
    stateFields: ["status", "deleted_at"],
    editHref: (row) => `/admin/content/topics/${row.id}`,
    publicHref: (row) => (row.slug ? `/topics/${row.slug}` : null),
  },
  {
    domainKey: "topic_categories",
    table: "topic_categories",
    entityType: "topic_category",
    labelField: "name",
    fields: ["image"],
    stateFields: ["status"],
    editHref: (row) => `/admin/content/categories/${row.id}`,
  },
  {
    domainKey: "legacy_media_items",
    table: "media_items",
    entityType: "legacy_media_item",
    labelField: "title",
    fields: ["image", "og_image", "content"],
    stateFields: ["status", "deleted_at"],
    editHref: () => "/admin/content/topics",
  },
  {
    domainKey: "projects",
    table: "projects",
    entityType: "project",
    labelField: "arabic_name",
    fields: ["image", "hero_image", "small_box_image", "overview_main_image", "og_image"],
    editHref: (row) => `/admin/projects/${row.id}`,
    supportsRebind: false,
  },
  {
    domainKey: "project_media",
    table: "project_media",
    entityType: "project_media",
    fields: ["image"],
    extraFields: ["project_id"],
    editHref: (row) => `/admin/projects/${row.project_id}`,
    supportsRebind: false,
  },
  {
    domainKey: "project_floor_plans",
    table: "project_floor_plans",
    entityType: "project_floor_plan",
    fields: ["architectural_image", "furnishing_image"],
    extraFields: ["project_id"],
    editHref: (row) => `/admin/projects/${row.project_id}`,
    supportsRebind: false,
  },
  {
    domainKey: "project_videos",
    table: "project_videos",
    entityType: "project_video",
    fields: ["poster_image"],
    extraFields: ["project_id"],
    editHref: (row) => `/admin/projects/${row.project_id}`,
    supportsRebind: false,
  },
  {
    domainKey: "hero_templates",
    table: "hero_templates",
    entityType: "hero_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    editHref: (row) => `/admin/pages-blocks/blocks/hero/${row.id}`,
  },
  {
    domainKey: "content_block_templates",
    table: "content_block_templates",
    entityType: "content_block_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/content/${row.id}`,
  },
  {
    domainKey: "cta_block_templates",
    table: "cta_block_templates",
    entityType: "cta_block_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/cta/${row.id}`,
  },
  {
    domainKey: "cards_block_templates",
    table: "cards_block_templates",
    entityType: "cards_block_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/cards/${row.id}`,
  },
  {
    domainKey: "breadcrumb_block_templates",
    table: "breadcrumb_block_templates",
    entityType: "breadcrumb_block_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/breadcrumb/${row.id}`,
  },
  {
    domainKey: "feed_module_templates",
    table: "feed_module_templates",
    entityType: "feed_module_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/feed/${row.id}`,
  },
  {
    domainKey: "media_sidebar_module_templates",
    table: "media_sidebar_module_templates",
    entityType: "media_sidebar_module_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/media-sidebar/${row.id}`,
  },
  {
    domainKey: "media_hub_module_templates",
    table: "media_hub_module_templates",
    entityType: "media_hub_module_template",
    labelField: "name",
    fields: ["config"],
    jsonFields: ["config"],
    stateFields: ["status"],
    editHref: (row) => `/admin/pages-blocks/blocks/media-hub/${row.id}`,
  },
  {
    domainKey: "page_sections",
    table: "page_sections",
    entityType: "legacy_page_section",
    fields: ["config"],
    jsonFields: ["config"],
    extraFields: ["page_id"],
    editHref: () => "/admin/pages-blocks/pages",
  },
  {
    domainKey: "menu_items",
    table: "menu_items",
    entityType: "menu_item",
    labelField: "label",
    fields: ["href"],
    extraFields: ["menu_id"],
    editHref: (row) => `/admin/pages-blocks/menus/${row.menu_id}`,
  },
  {
    domainKey: "site_settings",
    table: "site_settings",
    entityType: "site_setting",
    idField: "key",
    labelField: "key",
    fields: ["value"],
    jsonFields: ["value"],
    editHref: (row) => {
      const key = valueText(row.key);
      if (key.startsWith("footer.")) return "/admin/pages-blocks/footer";
      if (key === "seo.global") return "/admin/seo/meta-manager";
      return "/admin/settings/general";
    },
  },
] satisfies ProviderConfig[];

export const MEDIA_REFERENCE_PROVIDER_REGISTRY = PROVIDER_CONFIGS.map(createProvider);
export const MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION = "media-reference-providers-v2-project-entry";

export function getMediaReferenceProvider(domainKey: string) {
  return MEDIA_REFERENCE_PROVIDER_REGISTRY.find((provider) => provider.domainKey === domainKey) ?? null;
}

export function buildMediaReferenceWriteScope(
  domainKey: string,
  entityIdentity: string,
  intendedRow: Record<string, unknown>,
) {
  const provider = getMediaReferenceProvider(domainKey);
  if (!provider) throw new Error(`missing_media_reference_provider:${domainKey}`);
  return {
    domainKey: provider.domainKey,
    entityType: provider.entityType,
    entityIdentity,
    values: provider.fields.map((field) => intendedRow[field]),
  };
}

export function validateMediaReferenceProviderRegistry() {
  const keys = MEDIA_REFERENCE_PROVIDER_REGISTRY.map((provider) => provider.domainKey);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length) throw new Error(`duplicate_media_reference_provider:${duplicates.join(",")}`);
  return { version: MEDIA_REFERENCE_PROVIDER_REGISTRY_VERSION, providerCount: keys.length, keys };
}

export async function scanAllMediaReferenceProviders() {
  validateMediaReferenceProviderRegistry();
  const references: DiscoveredMediaReference[] = [];
  const uncertainties: string[] = [];

  for (const provider of MEDIA_REFERENCE_PROVIDER_REGISTRY) {
    try {
      references.push(...(await provider.scanAll()));
    } catch (error) {
      uncertainties.push(error instanceof Error ? error.message : `media_reference_provider:${provider.domainKey}:failed`);
    }
  }

  return { references, uncertainties };
}

export async function scanMediaUsageByPublicValue(publicValue: string) {
  validateMediaReferenceProviderRegistry();
  const references: DiscoveredMediaUsage[] = [];
  const uncertainties: string[] = [];

  for (let index = 0; index < MEDIA_REFERENCE_PROVIDER_REGISTRY.length; index += 4) {
    const batch = MEDIA_REFERENCE_PROVIDER_REGISTRY.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (provider) => {
        try {
          return { references: await provider.scanUsageByPublicValue(publicValue), uncertainty: null };
        } catch (error) {
          return {
            references: [] as DiscoveredMediaUsage[],
            uncertainty: error instanceof Error ? error.message : `media_reference_provider:${provider.domainKey}:failed`,
          };
        }
      }),
    );
    for (const result of results) {
      references.push(...result.references);
      if (result.uncertainty) uncertainties.push(result.uncertainty);
    }
  }

  return { references, uncertainties };
}
