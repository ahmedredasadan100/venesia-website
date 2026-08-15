export const PAGE_COMPOSITION_SLOTS = ["hero", "main", "sidebar", "bottom", "footer"] as const;

export type PageCompositionSlot = (typeof PAGE_COMPOSITION_SLOTS)[number];

export {
  getModuleEditorHeaderMetadata,
  getModuleEditorSectionOrder,
  getModuleEditorSectionMetadata,
  getModuleKindMetadata,
  getSlotCompatibilityLabel,
  getSlotModuleSlugMetadata,
  MODULE_KIND_METADATA,
  SLOT_MODULE_SLUG_METADATA,
} from "./module-registry-metadata";

export type {
  ModuleEditorIconToken,
  ModuleEditorSectionMetadata,
  ResolvedModuleEditorHeaderMetadata,
} from "./module-registry-metadata";
