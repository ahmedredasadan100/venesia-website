export {
  PAGE_LAYOUT_SLOTS as PAGE_COMPOSITION_SLOTS,
  type PageLayoutSlot as PageCompositionSlot,
} from "../page-blocks/layout-slots";

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
