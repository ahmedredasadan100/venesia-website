export const MODULE_EDITOR_TERMINOLOGY = {
  internalModuleName: {
    canonical: "internal-module-name",
    labelAr: "اسم الموديول الداخلي",
  },
  eyebrow: {
    canonical: "eyebrow",
    labelAr: "النص التمهيدي",
  },
  sectionTitle: {
    canonical: "section-title",
    labelAr: "عنوان القسم",
  },
  shortDescription: {
    canonical: "short-description",
    labelAr: "الوصف المختصر",
  },
  shortContent: {
    canonical: "short-content",
    labelAr: "المحتوى القصير",
  },
  longContent: {
    canonical: "long-content",
    labelAr: "المحتوى الطويل",
  },
  imageAlt: {
    canonical: "image-alt",
    labelAr: "النص البديل للصورة",
  },
  visible: {
    canonical: "visible",
    labelAr: "ظاهر",
  },
  hidden: {
    canonical: "hidden",
    labelAr: "مخفي",
  },
} as const;

export type ModuleEditorFieldNature =
  | "short-text"
  | "short-description"
  | "long-content"
  | "binary-state"
  | "standard"
  | "technical"
  | "link"
  | "media";

export type ModuleEditorFieldSpan = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;

/** Stable editor identity; environment-specific record IDs do not identify a reference. */
export type ModuleEditorCompositionSource = {
  sourceFile: string;
  exportName: string;
  mode: Readonly<Record<string, string>>;
  section: string;
};

type ModuleEditorCompositionRelationship =
  | { role: "reference" }
  | {
      role: "adopter";
      reference: { moduleSlug: string; sectionId: string };
      contractDifferences: readonly string[];
    };

/** Declared presentation relationship, independent of capability adoption or visual approval. */
export type ModuleEditorCompositionApplicability = {
  source: ModuleEditorCompositionSource;
  rationale: string;
} & (
  | ({ functionalScope: "standalone-cta" } & ModuleEditorCompositionRelationship)
  | ({ functionalScope: "compact-inline-settings" } & (
      | {
          role: "reference";
          /** Supplied design identity; the textual full-width requirement takes precedence. */
          visualReference: {
            assetName: string;
            assetPath: string;
            sha256: string;
            inputPlacement: "full-card-internal-width";
          };
        }
      | Extract<ModuleEditorCompositionRelationship, { role: "adopter" }>
    ))
);

export type ResolvedModuleEditorCompositionApplicability = {
  applicability: ModuleEditorCompositionApplicability;
  reference: Extract<ModuleEditorCompositionApplicability, { role: "reference" }>;
};

export const MODULE_EDITOR_FIELD_PRESENTATION: Record<
  ModuleEditorFieldNature,
  { defaultSpan: ModuleEditorFieldSpan; multiline: boolean }
> = {
  "short-text": { defaultSpan: 3, multiline: false },
  "short-description": { defaultSpan: 6, multiline: true },
  "long-content": { defaultSpan: 12, multiline: true },
  "binary-state": { defaultSpan: 3, multiline: false },
  standard: { defaultSpan: 4, multiline: false },
  technical: { defaultSpan: 4, multiline: false },
  link: { defaultSpan: 6, multiline: false },
  media: { defaultSpan: 12, multiline: false },
};

export function getModuleEditorFieldSpan(
  nature: ModuleEditorFieldNature,
  span?: ModuleEditorFieldSpan,
): ModuleEditorFieldSpan {
  return span ?? MODULE_EDITOR_FIELD_PRESENTATION[nature].defaultSpan;
}
