import type { Database } from "../database.types";
import type { PageBlockType } from "./types";
import {
  MEDIA_HUB_ASSIGNMENT_TABLE,
  MEDIA_HUB_TEMPLATE_TABLE,
} from "../media-hub-modules/registry";
import {
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_SIDEBAR_TEMPLATE_TABLE,
} from "../media-sidebar-modules/registry";
import {
  FEATURED_ASSIGNMENT_TABLE,
  FEATURED_TEMPLATE_TABLE,
} from "../featured-modules/registry";

type DatabaseTable = keyof Database["public"]["Tables"];

export const BLOCK_MODULE_REGISTRY = {
  content: {
    assignmentTable: "page_content_block_assignments",
    templateTable: "content_block_templates",
  },
  cta: {
    assignmentTable: "page_cta_block_assignments",
    templateTable: "cta_block_templates",
  },
  cards: {
    assignmentTable: "page_cards_block_assignments",
    templateTable: "cards_block_templates",
  },
  breadcrumb: {
    assignmentTable: "page_breadcrumb_block_assignments",
    templateTable: "breadcrumb_block_templates",
  },
  feed: {
    assignmentTable: "page_feed_module_assignments",
    templateTable: "feed_module_templates",
  },
  featured: {
    assignmentTable: FEATURED_ASSIGNMENT_TABLE,
    templateTable: FEATURED_TEMPLATE_TABLE,
  },
} satisfies Record<
  PageBlockType,
  { assignmentTable: DatabaseTable; templateTable: DatabaseTable }
>;

export type PageBlockAssignmentTable =
  (typeof BLOCK_MODULE_REGISTRY)[PageBlockType]["assignmentTable"];
export type PageBlockTemplateTable =
  (typeof BLOCK_MODULE_REGISTRY)[PageBlockType]["templateTable"];
export type PageModuleAssignmentTable =
  | PageBlockAssignmentTable
  | typeof MEDIA_SIDEBAR_ASSIGNMENT_TABLE
  | typeof MEDIA_HUB_ASSIGNMENT_TABLE;
export type PageModuleTemplateTable =
  | PageBlockTemplateTable
  | typeof MEDIA_SIDEBAR_TEMPLATE_TABLE
  | typeof MEDIA_HUB_TEMPLATE_TABLE
  | "hero_templates";

export const ASSIGNMENT_TABLES = Object.values(BLOCK_MODULE_REGISTRY).map((entry) => entry.assignmentTable);
export const ALL_ASSIGNMENT_TABLES = [
  ...ASSIGNMENT_TABLES,
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_HUB_ASSIGNMENT_TABLE,
] satisfies PageModuleAssignmentTable[];
