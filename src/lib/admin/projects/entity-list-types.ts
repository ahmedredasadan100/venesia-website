import type { ProjectListType } from "./entity-list-contract";
import type { ProjectPublicationStatus } from "./project-publishing-capability";

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
  publication_status: ProjectPublicationStatus;
  published_at: string | null;
  updated_at: string;
};

export type ProjectEntityListMetrics = {
  total: number;
};
