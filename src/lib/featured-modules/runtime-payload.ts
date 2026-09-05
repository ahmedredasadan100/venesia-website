import type { PageLayoutSlot } from "../page-blocks/layout-slots";
import {
  featuredModuleConfigSchema,
  parseFeaturedModuleConfig,
} from "./config";
import type { ResolvedFeaturedModule } from "./contract";

export const FEATURED_MODULE_CACHE_CONTRACT_VERSION =
  "featured-runtime-v2" as const;

export function buildFeaturedModuleCacheKey(
  pageSlug: string,
  contractVersion: string = FEATURED_MODULE_CACHE_CONTRACT_VERSION,
): string[] {
  return ["featured-module-state", contractVersion, pageSlug];
}

export type LoadedFeaturedModule = ResolvedFeaturedModule & {
  slot: PageLayoutSlot;
};

export type FeaturedModuleLoadResult = {
  modules: LoadedFeaturedModule[];
  hasAnyAssignmentRows: boolean;
  hasCompositionError: boolean;
};

export type FeaturedPayloadRecovery = {
  moduleIndex: number | null;
  assignmentId: number | null;
  fields: string[];
};

type FeaturedPayloadNormalization = {
  state: FeaturedModuleLoadResult;
  recoveries: FeaturedPayloadRecovery[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function configCandidate(
  module: Record<string, unknown>,
  itemLimit: unknown = module.itemLimit,
) {
  return {
    source: module.source,
    selection: module.selection,
    itemLimit,
    itemsPerView: module.itemsPerView,
    display: module.display,
    displayFormatting: module.displayFormatting,
    navigation: module.navigation,
    presentation: module.presentation,
  };
}

function normalizedIssueFields(
  issues: readonly { path: PropertyKey[] }[],
) {
  return [
    ...new Set(
      issues.map((issue) =>
        issue.path.length > 0 ? String(issue.path[0]) : "config",
      ),
    ),
  ].sort();
}

export function rememberFeaturedPayloadRecovery(
  rememberedKeys: Set<string>,
  recoveryKey: string,
  maxEntries: number,
): boolean {
  if (rememberedKeys.has(recoveryKey)) return false;
  if (maxEntries <= 0) return true;

  while (rememberedKeys.size >= maxEntries) {
    const oldestKey = rememberedKeys.values().next().value;
    if (oldestKey === undefined) break;
    rememberedKeys.delete(oldestKey);
  }
  rememberedKeys.add(recoveryKey);
  return true;
}

/**
 * Compatibility boundary for cached Featured payloads.
 *
 * Materialized items keep their original array and order. Only the runtime
 * configuration envelope is repaired through the canonical config parser.
 */
export function normalizeFeaturedModuleLoadResult(
  value: unknown,
): FeaturedPayloadNormalization {
  if (!isRecord(value)) {
    return {
      state: {
        modules: [],
        hasAnyAssignmentRows: false,
        hasCompositionError: true,
      },
      recoveries: [
        { moduleIndex: null, assignmentId: null, fields: ["payload"] },
      ],
    };
  }

  if (!Array.isArray(value.modules)) {
    return {
      state: {
        modules: [],
        hasAnyAssignmentRows: false,
        hasCompositionError: true,
      },
      recoveries: [
        { moduleIndex: null, assignmentId: null, fields: ["modules"] },
      ],
    };
  }

  const recoveries: FeaturedPayloadRecovery[] = [];
  let rejectedModule = false;
  const modules = value.modules.flatMap((rawModule, moduleIndex) => {
    if (!isRecord(rawModule) || !Array.isArray(rawModule.items)) {
      rejectedModule = true;
      recoveries.push({
        moduleIndex,
        assignmentId:
          isRecord(rawModule) && isSafeInteger(rawModule.assignmentId)
            ? rawModule.assignmentId
            : null,
        fields: [isRecord(rawModule) ? "items" : "module"],
      });
      return [];
    }

    const items = rawModule.items;
    const currentConfig = featuredModuleConfigSchema.safeParse(
      configCandidate(rawModule),
    );
    if (currentConfig.success) {
      return [rawModule as unknown as LoadedFeaturedModule];
    }

    const fields = normalizedIssueFields(currentConfig.error.issues);
    const canonicalFallback = parseFeaturedModuleConfig(
      configCandidate(rawModule),
    );
    const normalizedConfig =
      fields.includes("itemLimit") && items.length > canonicalFallback.itemLimit
        ? parseFeaturedModuleConfig(configCandidate(rawModule, items.length))
        : canonicalFallback;

    recoveries.push({
      moduleIndex,
      assignmentId: isSafeInteger(rawModule.assignmentId)
        ? rawModule.assignmentId
        : null,
      fields,
    });

    return [
      {
        ...rawModule,
        ...normalizedConfig,
        items,
      } as LoadedFeaturedModule,
    ];
  });

  const hasValidAssignmentFlag =
    typeof value.hasAnyAssignmentRows === "boolean";
  const hasValidErrorFlag = typeof value.hasCompositionError === "boolean";
  const hasAnyAssignmentRows = hasValidAssignmentFlag
    ? (value.hasAnyAssignmentRows as boolean)
    : modules.length > 0;
  const hasCompositionError =
    rejectedModule ||
    (hasValidErrorFlag ? (value.hasCompositionError as boolean) : false);
  if (!hasValidAssignmentFlag || !hasValidErrorFlag) {
    recoveries.push({
      moduleIndex: null,
      assignmentId: null,
      fields: [
        ...(!hasValidAssignmentFlag ? ["hasAnyAssignmentRows"] : []),
        ...(!hasValidErrorFlag ? ["hasCompositionError"] : []),
      ],
    });
  }

  if (recoveries.length === 0) {
    return {
      state: value as unknown as FeaturedModuleLoadResult,
      recoveries,
    };
  }

  return {
    state: {
      modules,
      hasAnyAssignmentRows,
      hasCompositionError,
    },
    recoveries,
  };
}
