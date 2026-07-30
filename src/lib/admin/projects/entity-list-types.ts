import type { ProjectListType } from "./entity-list-contract";

export type ProjectEntityListRow = {
  id: number;
  type: ProjectListType;
  slug: string;
  arabic_name: string;
  english_name: string;
  location_label: string;
  updated_at: string;
};

export type ProjectEntityListMetrics = {
  total: number;
};
