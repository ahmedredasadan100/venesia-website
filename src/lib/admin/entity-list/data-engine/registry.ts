import "server-only";

import { categoriesEntityListAdapter } from "../../content/entity-list-adapters/categories";
import { seriesEntityListAdapter } from "../../content/entity-list-adapters/series";
import { topicsEntityListAdapter } from "../../content/entity-list-adapters/topics";
import { pagesEntityListAdapter } from "../../pages/entity-list-adapter";
import {
  parseAdminEntityListRequestQuery,
  type AdminEntityListQuery,
  type AdminEntityListQueryContract,
  type AdminEntityListResult,
} from "./contracts";

export const adminEntityListAdapterRegistry = {
  topics: topicsEntityListAdapter,
  categories: categoriesEntityListAdapter,
  series: seriesEntityListAdapter,
  pages: pagesEntityListAdapter,
} as const;

export type AdminEntityListEntityKey =
  keyof typeof adminEntityListAdapterRegistry;

export function isAdminEntityListEntityKey(
  value: string,
): value is AdminEntityListEntityKey {
  return Object.hasOwn(adminEntityListAdapterRegistry, value);
}

type ErasedAdapter = {
  entity: string;
  queryContract: AdminEntityListQueryContract<
    Record<string, unknown>,
    string
  >;
  resultSchema: {
    safeParse: (value: unknown) =>
      | { success: true; data: AdminEntityListResult<unknown, unknown> }
      | { success: false; error: unknown };
  };
  staleTimeMs: number;
  load: (
    query: AdminEntityListQuery<Record<string, unknown>, string>,
  ) => Promise<AdminEntityListResult<unknown, unknown>>;
};

export async function executeAdminEntityListAdapter(
  entity: AdminEntityListEntityKey,
  params: URLSearchParams,
) {
  const adapter = adminEntityListAdapterRegistry[entity] as unknown as ErasedAdapter;
  // Strict boundary: invalid raw input is rejected (400), never defaulted.
  const query = parseAdminEntityListRequestQuery(adapter.queryContract, params);
  const result = await adapter.load(query);
  const validated = adapter.resultSchema.safeParse(result);
  if (!validated.success) {
    throw new Error(`Invalid ${entity} entity-list adapter output`);
  }
  return {
    entity,
    query,
    result: validated.data,
    staleTimeMs: adapter.staleTimeMs,
  };
}
