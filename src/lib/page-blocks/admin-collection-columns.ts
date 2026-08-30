export type PageCompositionColumnMeta<Key extends string = string> = {
  key: Key;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
};

const contentTemplateColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "name", label: "الاسم", defaultVisible: true, hideable: false },
  { key: "slug", label: "المعرّف", defaultVisible: true, hideable: true },
  { key: "variant", label: "النمط", defaultVisible: true, hideable: true },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "updatedAt", label: "آخر تحديث", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const heroTemplateColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "name", label: "اسم الهيرو", defaultVisible: true, hideable: false },
  { key: "slug", label: "المعرّف", defaultVisible: true, hideable: true },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const blockTemplateColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "name", label: "الاسم", defaultVisible: true, hideable: false },
  { key: "slug", label: "المعرّف", defaultVisible: true, hideable: true },
  { key: "variant", label: "النمط", defaultVisible: true, hideable: true },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const breadcrumbTemplateColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "name", label: "الاسم", defaultVisible: true, hideable: false },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const blockSummaryColumns = [
  { key: "name", label: "الاسم", defaultVisible: true, hideable: false },
  { key: "slug", label: "المعرّف", defaultVisible: true, hideable: true },
  { key: "detail", label: "التفاصيل", defaultVisible: true, hideable: true },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const menuColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "name", label: "القائمة", defaultVisible: true, hideable: false },
  { key: "slug", label: "Slug", defaultVisible: true, hideable: true },
  { key: "itemCount", label: "العناصر", defaultVisible: true, hideable: true },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const menuItemColumns = [
  { key: "order", label: "الترتيب", defaultVisible: true, hideable: true },
  { key: "name", label: "اسم العنصر", defaultVisible: true, hideable: false },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

const pageAssignmentColumns = [
  { key: "selection", label: "التحديد", defaultVisible: true, hideable: false },
  { key: "template", label: "القالب", defaultVisible: true, hideable: false },
  { key: "module", label: "النوع", defaultVisible: true, hideable: true },
  { key: "slot", label: "موضع العرض", defaultVisible: true, hideable: false },
  { key: "status", label: "الحالة", defaultVisible: true, hideable: true },
  { key: "actions", label: "الإجراءات", defaultVisible: true, hideable: false },
] as const satisfies readonly PageCompositionColumnMeta[];

export const PAGE_COMPOSITION_COLUMN_PREFERENCES = {
  contentTemplates: {
    viewKey: "page-composition:content-templates",
    columns: contentTemplateColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
    ],
    boundedClientPagination: true,
  },
  heroTemplates: {
    viewKey: "page-composition:hero-templates",
    columns: heroTemplateColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  breadcrumbTemplates: {
    viewKey: "page-composition:breadcrumb-templates",
    columns: breadcrumbTemplateColumns,
    consumerSourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  cardsTemplates: {
    viewKey: "page-composition:cards-templates",
    columns: blockTemplateColumns,
    consumerSourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  ctaTemplates: {
    viewKey: "page-composition:cta-templates",
    columns: blockTemplateColumns,
    consumerSourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  feedTemplates: {
    viewKey: "page-composition:feed-templates",
    columns: blockTemplateColumns,
    consumerSourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  featuredTemplates: {
    viewKey: "page-composition:featured-templates",
    columns: blockTemplateColumns,
    consumerSourceFiles: [
      "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
    ],
    boundedClientPagination: true,
  },
  mediaHubTemplates: {
    viewKey: "page-composition:media-hub-templates",
    columns: blockSummaryColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
    ],
    boundedClientPagination: true,
  },
  mediaSidebarTemplates: {
    viewKey: "page-composition:media-sidebar-templates",
    columns: blockSummaryColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
    ],
    boundedClientPagination: true,
  },
  menus: {
    viewKey: "page-composition:menus",
    columns: menuColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    ],
    boundedClientPagination: true,
  },
  menuItems: {
    viewKey: "page-composition:menu-items",
    columns: menuItemColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
    ],
    boundedClientPagination: true,
  },
  pageAssignments: {
    viewKey: "page-composition:page-assignments",
    columns: pageAssignmentColumns,
    consumerSourceFiles: [
      "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
    ],
    boundedClientPagination: true,
  },
} as const;

export type PageCompositionColumnPreferenceId =
  keyof typeof PAGE_COMPOSITION_COLUMN_PREFERENCES;

export type PageCompositionColumnKey<
  Id extends PageCompositionColumnPreferenceId,
> = (typeof PAGE_COMPOSITION_COLUMN_PREFERENCES)[Id]["columns"][number]["key"];

export function isPageCompositionColumnPreferenceId(
  value: string,
): value is PageCompositionColumnPreferenceId {
  return Object.hasOwn(PAGE_COMPOSITION_COLUMN_PREFERENCES, value);
}

export function getPageCompositionColumnPreferenceConfig<
  Id extends PageCompositionColumnPreferenceId,
>(id: Id) {
  return PAGE_COMPOSITION_COLUMN_PREFERENCES[id];
}

export function getPageCompositionDefaultColumnKeys<
  Id extends PageCompositionColumnPreferenceId,
>(id: Id): PageCompositionColumnKey<Id>[] {
  return PAGE_COMPOSITION_COLUMN_PREFERENCES[id].columns
    .filter((column) => column.defaultVisible)
    .map((column) => column.key) as PageCompositionColumnKey<Id>[];
}

export function getPageCompositionPersistableColumnKeys<
  Id extends PageCompositionColumnPreferenceId,
>(id: Id): PageCompositionColumnKey<Id>[] {
  return PAGE_COMPOSITION_COLUMN_PREFERENCES[id].columns
    .filter((column) => column.hideable)
    .map((column) => column.key) as PageCompositionColumnKey<Id>[];
}

export function normalizePageCompositionVisibleColumnKeys<
  Id extends PageCompositionColumnPreferenceId,
>(
  id: Id,
  storedKeys: readonly string[] | null | undefined,
): PageCompositionColumnKey<Id>[] {
  const columns = PAGE_COMPOSITION_COLUMN_PREFERENCES[id].columns;
  const allowed = new Set<string>(columns.map((column) => column.key));
  const requested = storedKeys ?? getPageCompositionDefaultColumnKeys(id);
  const visible = requested.filter((key) => allowed.has(key)) as PageCompositionColumnKey<Id>[];

  for (const column of columns) {
    if (!column.hideable && !visible.includes(column.key as PageCompositionColumnKey<Id>)) {
      visible.push(column.key as PageCompositionColumnKey<Id>);
    }
  }

  return visible.length ? visible : getPageCompositionDefaultColumnKeys(id);
}
