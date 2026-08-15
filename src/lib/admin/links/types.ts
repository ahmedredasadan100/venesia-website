export const ADMIN_LINK_KINDS = [
  "internal",
  "static_route",
  "external",
  "email",
  "phone",
  "anchor",
  "download",
  "legacy",
  "none",
] as const;

export type AdminLinkKind = (typeof ADMIN_LINK_KINDS)[number];

export const LINKED_RESOURCE_TYPES = [
  "pages",
  "projects",
  "topics",
  "topic_categories",
  "topic_series",
  "static_routes",
] as const;

export type LinkedResourceType = (typeof LINKED_RESOURCE_TYPES)[number];

export type AdminLinkTarget = "_self" | "_blank";

export type AdminLinkValue = {
  link_kind: AdminLinkKind;
  linked_type?: LinkedResourceType | null;
  linked_id?: number | null;
  href?: string | null;
  anchor?: string | null;
  target?: AdminLinkTarget | null;
  meta?: Record<string, string> | null;
};

export type LinkSearchResult = {
  id: string;
  resourceType: LinkedResourceType | "external";
  resourceId: number | null;
  title: string;
  slug: string | null;
  publicPath: string;
  subtitle?: string | null;
  level?: number;
  meta?: Record<string, string>;
};

export type AdminLinkProvider = {
  type: LinkedResourceType;
  label: string;
  labelPlural: string;
  hierarchical?: boolean;
  search: (query: string, limit: number) => Promise<LinkSearchResult[]>;
  resolveMany: (ids: number[]) => Promise<Map<number, string>>;
};

export type AdminLinkValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export type AdminLinkDisplay = {
  kind: AdminLinkKind;
  kindLabel: string;
  title: string;
  publicPath: string;
  target: AdminLinkTarget;
};
