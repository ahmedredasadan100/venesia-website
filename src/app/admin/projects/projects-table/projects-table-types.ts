import type { ProjectListType } from "../../../../lib/admin/projects/entity-list-contract";
import type { ProjectColumnKey } from "../../../../lib/admin/projects/projects-list-config";
import type { ProjectPublicationStatus } from "../../../../lib/admin/projects/project-publishing-capability";

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
  publication_status: ProjectPublicationStatus;
  published_at: string | null;
  updated_at: string;
};

export type { ProjectColumnKey };
