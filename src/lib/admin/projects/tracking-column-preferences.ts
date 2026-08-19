export const PROJECT_TRACKING_COLUMN_CONTRACT_VERSION = 2;

export const PROJECT_TRACKING_COLUMN_KEYS = {
  stages: ["name", "status", "relations", "visibility", "order", "actions"],
  items: [
    "name",
    "status",
    "dates",
    "updates",
    "visibility",
    "order",
    "actions",
  ],
  updates: ["title", "date", "publication", "media", "actions"],
} as const;

export type ProjectTrackingColumnKind =
  keyof typeof PROJECT_TRACKING_COLUMN_KEYS;

export function getProjectTrackingColumnViewKey(
  kind: ProjectTrackingColumnKind,
) {
  return `project-tracking-${kind}`;
}

export function getProjectTrackingColumnKeys(kind: ProjectTrackingColumnKind) {
  return PROJECT_TRACKING_COLUMN_KEYS[kind];
}
