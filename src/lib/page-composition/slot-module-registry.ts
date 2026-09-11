import {
  PAGE_MODULE_KINDS,
  type PageModuleKind,
} from "../page-blocks/types.ts";

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
} from "./module-registry-metadata.ts";

export type {
  ModuleEditorIconToken,
  ModuleEditorSectionMetadata,
  ResolvedModuleEditorHeaderMetadata,
} from "./module-registry-metadata.ts";

export type SlotModuleRendererKey =
  | "hero"
  | "block"
  | "feed"
  | "featured"
  | "media-sidebar"
  | "media-hub";

export type SlotModuleRegistration = Readonly<{
  kind: PageModuleKind;
  rendererKey: SlotModuleRendererKey;
}>;

const SLOT_MODULE_RENDERER_KEYS = {
  hero: "hero",
  content: "block",
  cta: "block",
  cards: "block",
  breadcrumb: "block",
  feed: "feed",
  featured: "featured",
  "media-sidebar": "media-sidebar",
  "media-hub": "media-hub",
} as const satisfies Record<PageModuleKind, SlotModuleRendererKey>;

/**
 * Canonical ordered registry for every active Page Composition module kind.
 * The order is inherited from PAGE_MODULE_KINDS; consumers must not maintain
 * a parallel kind inventory.
 */
export const SLOT_MODULE_REGISTRY: readonly SlotModuleRegistration[] =
  Object.freeze(
    PAGE_MODULE_KINDS.map((kind) =>
      Object.freeze({
        kind,
        rendererKey: SLOT_MODULE_RENDERER_KEYS[kind],
      }),
    ),
  );

export const REGISTERED_SLOT_MODULE_KINDS: readonly PageModuleKind[] =
  Object.freeze(SLOT_MODULE_REGISTRY.map((registration) => registration.kind));

const SLOT_MODULE_REGISTRATION_BY_KIND = new Map(
  SLOT_MODULE_REGISTRY.map((registration) => [registration.kind, registration]),
);

/** Fail closed for unknown or malformed module kinds; there is no fallback renderer. */
export function resolveSlotModuleRegistration(
  kind: string | null | undefined,
): SlotModuleRegistration | null {
  if (!kind) return null;
  return SLOT_MODULE_REGISTRATION_BY_KIND.get(kind as PageModuleKind) ?? null;
}
