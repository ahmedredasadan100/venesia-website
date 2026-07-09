export type ProjectGridRow = {
  id: number;
  code: string;
  slug?: string | null;
  arabic_name: string;
  location_label: string;
  map_area: string;
  featured: boolean;
  publication_status: string | null;
  updated_at: string;
};

export type ProjectRowActionHandlers = {
  onTogglePublication: (id: number, status: string | null) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onRequestPermanentDelete: (item: ProjectGridRow) => void;
  isPending: boolean;
};
