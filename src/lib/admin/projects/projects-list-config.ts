/** Project list config for the clean Project Admin schema. */

export const PROJECTS_RESIDENTIAL_LIST_VIEW_KEY = "projects-residential";
export const PROJECTS_COMMERCIAL_LIST_VIEW_KEY = "projects-commercial";

export type ProjectColumnKey =
  | "project"
  | "english_name"
  | "slug"
  | "location"
  | "updated_at"
  | "actions";

export type ProjectColumnMeta = {
  key: ProjectColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  gridTrack: string;
};

export const PROJECTS_LIST_COLUMNS = [
  {
    key: "project",
    label: "المشروع",
    defaultVisible: true,
    hideable: false,
    gridTrack: "minmax(260px,1.3fr)",
  },
  {
    key: "english_name",
    label: "الاسم بالإنجليزية",
    defaultVisible: true,
    hideable: true,
    gridTrack: "minmax(190px,1fr)",
  },
  {
    key: "slug",
    label: "الرابط المختصر",
    defaultVisible: true,
    hideable: true,
    gridTrack: "minmax(170px,0.9fr)",
  },
  {
    key: "location",
    label: "الموقع",
    defaultVisible: true,
    hideable: true,
    gridTrack: "minmax(190px,1fr)",
  },
  {
    key: "updated_at",
    label: "آخر تحديث",
    defaultVisible: true,
    hideable: true,
    gridTrack: "140px",
  },
  {
    key: "actions",
    label: "الإجراءات",
    defaultVisible: true,
    hideable: false,
    gridTrack: "actions",
  },
] as const satisfies readonly ProjectColumnMeta[];

export const PROJECTS_DEFAULT_COLUMN_KEYS = PROJECTS_LIST_COLUMNS.filter(
  (column) => column.defaultVisible,
).map((column) => column.key) as ProjectColumnKey[];

export const PROJECTS_PREFERENCE_COLUMN_KEYS = PROJECTS_LIST_COLUMNS.filter(
  (column) => column.hideable,
).map((column) => column.key) as ProjectColumnKey[];

export function getProjectsListViewKey(
  type: "residential" | "commercial",
): string {
  return type === "residential"
    ? PROJECTS_RESIDENTIAL_LIST_VIEW_KEY
    : PROJECTS_COMMERCIAL_LIST_VIEW_KEY;
}

export function getProjectsColumnMeta() {
  return PROJECTS_LIST_COLUMNS;
}

export function getProjectsDefaultColumnKeys(): readonly ProjectColumnKey[] {
  return PROJECTS_DEFAULT_COLUMN_KEYS;
}

export function getProjectsPreferenceColumnKeys(): readonly ProjectColumnKey[] {
  return PROJECTS_PREFERENCE_COLUMN_KEYS;
}
