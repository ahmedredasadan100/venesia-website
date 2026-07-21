/** Projects list config — safe for server (no React). */

export const PROJECTS_RESIDENTIAL_LIST_VIEW_KEY = "projects-residential";
export const PROJECTS_COMMERCIAL_LIST_VIEW_KEY = "projects-commercial";

export type ProjectResidentialColumnKey =
  | "selection"
  | "project"
  | "code"
  | "featured"
  | "publication_status"
  | "updated_at"
  | "actions";

export type ProjectCommercialColumnKey =
  | "selection"
  | "code"
  | "location"
  | "featured"
  | "publication_status"
  | "updated_at"
  | "actions";

export type ProjectColumnKey =
  | ProjectResidentialColumnKey
  | ProjectCommercialColumnKey;

export type ProjectColumnMeta<Key extends ProjectColumnKey = ProjectColumnKey> = {
  key: Key;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  /** CSS grid track — preserves the existing projects table layout contract. */
  gridTrack: string;
};

export const PROJECTS_RESIDENTIAL_COLUMNS = [
  {
    key: "selection",
    label: "تحديد",
    defaultVisible: true,
    hideable: false,
    gridTrack: "44px",
  },
  {
    key: "project",
    label: "المشروع",
    defaultVisible: true,
    hideable: false,
    gridTrack: "minmax(280px, 1fr)",
  },
  {
    key: "code",
    label: "الكود",
    defaultVisible: true,
    hideable: true,
    gridTrack: "104px",
  },
  {
    key: "featured",
    label: "مميز",
    defaultVisible: true,
    hideable: true,
    gridTrack: "80px",
  },
  {
    key: "publication_status",
    label: "حالة النشر",
    defaultVisible: true,
    hideable: true,
    gridTrack: "104px",
  },
  {
    key: "updated_at",
    label: "التحديث",
    defaultVisible: true,
    hideable: true,
    gridTrack: "124px",
  },
  {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
    // Track width is resolved at render time from action-button count presets.
    gridTrack: "actions",
  },
] as const satisfies readonly ProjectColumnMeta<ProjectResidentialColumnKey>[];

export const PROJECTS_COMMERCIAL_COLUMNS = [
  {
    key: "selection",
    label: "تحديد",
    defaultVisible: true,
    hideable: false,
    gridTrack: "44px",
  },
  {
    key: "code",
    label: "الكود",
    defaultVisible: true,
    hideable: false,
    gridTrack: "minmax(96px,110px)",
  },
  {
    key: "location",
    label: "الموقع / المنطقة",
    defaultVisible: true,
    hideable: true,
    gridTrack: "minmax(200px,1.2fr)",
  },
  {
    key: "featured",
    label: "مميز",
    defaultVisible: true,
    hideable: true,
    gridTrack: "90px",
  },
  {
    key: "publication_status",
    label: "حالة النشر",
    defaultVisible: true,
    hideable: true,
    gridTrack: "110px",
  },
  {
    key: "updated_at",
    label: "آخر تحديث",
    defaultVisible: true,
    hideable: true,
    gridTrack: "150px",
  },
  {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
    gridTrack: "actions",
  },
] as const satisfies readonly ProjectColumnMeta<ProjectCommercialColumnKey>[];

export const PROJECTS_RESIDENTIAL_DEFAULT_COLUMN_KEYS =
  PROJECTS_RESIDENTIAL_COLUMNS.filter((column) => column.defaultVisible).map(
    (column) => column.key,
  ) as ProjectResidentialColumnKey[];

export const PROJECTS_COMMERCIAL_DEFAULT_COLUMN_KEYS =
  PROJECTS_COMMERCIAL_COLUMNS.filter((column) => column.defaultVisible).map(
    (column) => column.key,
  ) as ProjectCommercialColumnKey[];

/** Persistable (hideable) keys only — locked columns are never stored. */
export const PROJECTS_RESIDENTIAL_PREFERENCE_COLUMN_KEYS = PROJECTS_RESIDENTIAL_COLUMNS.filter(
  (column) => column.hideable,
).map((column) => column.key) as ProjectResidentialColumnKey[];

export const PROJECTS_COMMERCIAL_PREFERENCE_COLUMN_KEYS = PROJECTS_COMMERCIAL_COLUMNS.filter(
  (column) => column.hideable,
).map((column) => column.key) as ProjectCommercialColumnKey[];

export function getProjectsListViewKey(
  type: "residential" | "commercial",
): string {
  return type === "residential"
    ? PROJECTS_RESIDENTIAL_LIST_VIEW_KEY
    : PROJECTS_COMMERCIAL_LIST_VIEW_KEY;
}

export function getProjectsColumnMeta(type: "residential" | "commercial") {
  return type === "residential"
    ? PROJECTS_RESIDENTIAL_COLUMNS
    : PROJECTS_COMMERCIAL_COLUMNS;
}

export function getProjectsDefaultColumnKeys(
  type: "residential" | "commercial",
): readonly ProjectColumnKey[] {
  return type === "residential"
    ? PROJECTS_RESIDENTIAL_DEFAULT_COLUMN_KEYS
    : PROJECTS_COMMERCIAL_DEFAULT_COLUMN_KEYS;
}

export function getProjectsPreferenceColumnKeys(
  type: "residential" | "commercial",
): readonly ProjectColumnKey[] {
  return type === "residential"
    ? PROJECTS_RESIDENTIAL_PREFERENCE_COLUMN_KEYS
    : PROJECTS_COMMERCIAL_PREFERENCE_COLUMN_KEYS;
}
