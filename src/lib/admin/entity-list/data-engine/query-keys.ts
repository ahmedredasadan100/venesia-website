import {
  serializeAdminEntityListQuery,
  type AdminEntityListQuery,
} from "./contracts.ts";

const ROOT_KEY = "admin-entity-list" as const;

export const adminEntityListQueryKeys = {
  root: [ROOT_KEY] as const,
  entity: (entity: string) => [ROOT_KEY, entity] as const,
  queries: (entity: string) => [ROOT_KEY, entity, "query"] as const,
  query: (
    entity: string,
    query: AdminEntityListQuery<Record<string, unknown>, string>,
  ) =>
    [
      ROOT_KEY,
      entity,
      "query",
      serializeAdminEntityListQuery(query),
    ] as const,
  metrics: (entity: string) => [ROOT_KEY, entity, "metrics"] as const,
};
