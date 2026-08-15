import type { Database } from "../database.types";

export type CmsBackupTable = {
  name: Extract<keyof Database["public"]["Tables"], string>;
  orderBy?: string;
};

/** Core CMS tables eligible for JSON backup. Extend as new entities ship. */
export const CMS_BACKUP_TABLES = [
  { name: "topics", orderBy: "id" },
  { name: "topic_categories", orderBy: "id" },
  { name: "topic_series", orderBy: "id" },
  { name: "pages", orderBy: "id" },
  { name: "hero_templates", orderBy: "id" },
  { name: "hero_assignments", orderBy: "id" },
  { name: "menus", orderBy: "id" },
  { name: "menu_items", orderBy: "sort_order" },
  { name: "site_settings", orderBy: "key" },
  { name: "projects", orderBy: "id" },
  { name: "project_floor_plans", orderBy: "id" },
  { name: "project_delivery_items", orderBy: "id" },
  { name: "project_media", orderBy: "id" },
] as const satisfies readonly CmsBackupTable[];

export type CmsBackupPayload = {
  exported_at: string;
  version: 1;
  tables: Record<string, unknown[]>;
  partial?: boolean;
  table_errors?: Record<string, string>;
};
