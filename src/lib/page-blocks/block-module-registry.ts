import type { PageBlockType } from "./types";
import { MEDIA_HUB_ASSIGNMENT_TABLE } from "../media-hub-modules/registry";
import { MEDIA_SIDEBAR_ASSIGNMENT_TABLE } from "../media-sidebar-modules/registry";

export const BLOCK_MODULE_REGISTRY: Record<
  PageBlockType,
  { assignmentTable: string; templateTable: string }
> = {
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
};

export const ASSIGNMENT_TABLES = Object.values(BLOCK_MODULE_REGISTRY).map((entry) => entry.assignmentTable);
export const ALL_ASSIGNMENT_TABLES = [
  ...ASSIGNMENT_TABLES,
  MEDIA_SIDEBAR_ASSIGNMENT_TABLE,
  MEDIA_HUB_ASSIGNMENT_TABLE,
];
