export {
  PAGE_COMPOSITION_POSITIONS as PAGE_COMPOSITION_SLOTS,
  type PageCompositionPosition as PageCompositionSlot,
} from "./positions.ts";

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
