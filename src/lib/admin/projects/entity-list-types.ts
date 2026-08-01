import type { ProjectListType } from "./entity-list-contract";

export type ProjectEntityListRow = {
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

export type ProjectEntityListMetrics = {
  total: number;
};
