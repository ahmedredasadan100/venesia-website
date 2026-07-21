export type ProjectEntityListRow = {
  id: number;
  code: string;
  slug: string | null;
  arabic_name: string;
  location_label: string | null;
  map_area: string | null;
  featured: boolean;
  publication_status: string | null;
  status: string | null;
  updated_at: string;
};

export type ProjectEntityListMetrics = {
  published: number;
  featured: number;
};
