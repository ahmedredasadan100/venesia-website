import type { BreadcrumbBlockConfig, CardsBlockConfig, ContentBlockConfig, CtaBlockConfig } from "./configs";
import type { PageLayoutSlot } from "./layout-slots";

export { PAGE_LAYOUT_SLOTS, type PageLayoutSlot } from "./layout-slots";

export const PAGE_BLOCK_TYPES = ["content", "cta", "cards", "breadcrumb", "feed", "featured"] as const;
/** Assignable block types — Slider was never included; use Hero instead (see deprecated-block-modules.ts). */
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

export const PAGE_MODULE_KINDS = ["hero", ...PAGE_BLOCK_TYPES, "media-sidebar", "media-hub"] as const;
export type PageModuleKind = (typeof PAGE_MODULE_KINDS)[number];

export type PageBlockStatus = "published" | "unpublished";

export type PageBlockTemplateBase = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  variant: string;
  style_preset: string;
  status: PageBlockStatus | string;
  sort_order: number;
};

export type ResolvedPageBlock =
  | {
      assignmentId: number;
      blockType: "content";
      templateId: number;
      slot: PageLayoutSlot;
      sortOrder: number;
      isVisible: boolean;
      template: PageBlockTemplateBase & { config: ContentBlockConfig };
    }
  | {
      assignmentId: number;
      blockType: "cta";
      templateId: number;
      slot: PageLayoutSlot;
      sortOrder: number;
      isVisible: boolean;
      template: PageBlockTemplateBase & { config: CtaBlockConfig };
    }
  | {
      assignmentId: number;
      blockType: "cards";
      templateId: number;
      slot: PageLayoutSlot;
      sortOrder: number;
      isVisible: boolean;
      template: PageBlockTemplateBase & { config: CardsBlockConfig };
    }
  | {
      assignmentId: number;
      blockType: "breadcrumb";
      templateId: number;
      slot: PageLayoutSlot;
      sortOrder: number;
      isVisible: boolean;
      template: PageBlockTemplateBase & { config: BreadcrumbBlockConfig };
    };

/** Canonical pre-filter truth for a Page Block assignment on a public page. */
export type PageBlockPublicState = {
  assignmentId: number;
  blockType: PageBlockType;
  templateId: number;
  templateSlug: string;
  templateStatus: string;
  templatePublished: boolean;
  assignmentVisible: boolean;
  publiclyVisible: boolean;
};

export type PageBlockAssignmentRow = {
  id: number;
  page_id: number;
  template_id: number;
  slot: string;
  sort_order: number;
  /** Raw page-assignment visibility, independently editable while published. */
  is_visible: boolean;
  /** Effective public state: published template and visible assignment. */
  is_publicly_visible: boolean;
  updated_at: string;
  module_kind: PageModuleKind;
  block_type: PageBlockType | null;
  template_name: string;
  template_slug: string;
  template_status: string;
  template_variant: string;
  manages_assignment_on_page: boolean;
  assignment_note: string | null;
};
