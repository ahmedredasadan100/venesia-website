import type { ProjectListType } from "../../../../lib/admin/projects/entity-list-contract";
import type { ProjectColumnKey } from "../../../../lib/admin/projects/projects-list-config";

export type ProjectGridRow = {
  id: number;
  type: ProjectListType;
  slug: string;
  arabic_name: string;
  english_name: string;
  location_label: string;
  city_name: string;
  main_area_name: string;
  sub_area_name: string;
  featured: boolean;
  updated_at: string;
};

export type ProjectTableSortState = {
  field: string;
  direction: "asc" | "desc";
};

export type { ProjectColumnKey };
