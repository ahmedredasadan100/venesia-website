export const ACTIVITY_LOG_LIST_VIEW_KEY = "activity-log";

export const ACTIVITY_LOG_DEFAULT_COLUMN_KEYS = [
  "created_at",
  "actor",
  "action",
  "entity_type",
  "entity",
  "ip",
  "details",
] as const;

export const ACTIVITY_LOG_PREFERENCE_COLUMN_KEYS = [
  "actor",
  "action",
  "entity_type",
  "entity",
  "ip",
  "details",
] as const;
