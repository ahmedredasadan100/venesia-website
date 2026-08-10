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
