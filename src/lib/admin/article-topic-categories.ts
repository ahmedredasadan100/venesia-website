import { isTestTopicCategory } from "./cms-test-data";

export const ARTICLE_ROOT_SLUG = "topics";
export const MEDIA_CENTER_ROOT_SLUG = "media-center";

export const MEDIA_CENTER_BRANCH_SLUGS = [
  MEDIA_CENTER_ROOT_SLUG,
  "media-news",
  "media-site-updates",
  "media-videos",
  "media-press",
  "media-gallery",
] as const;

export type ArticleTopicCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type ArticleTopicCategoryGroup = {
  label: string;
  options: Array<{ id: number; slug: string; name: string }>;
};

type CategoryNode = ArticleTopicCategoryRecord & {
  children: CategoryNode[];
};

export const ARTICLE_TOPIC_CATEGORY_ERROR =
  "التصنيف المختار غير مسموح للمقالات. اختر تصنيفًا فرعيًا تحت «موضوعات تهمك» فقط.";

export function isMediaCenterBranchSlug(slug: string) {
  return MEDIA_CENTER_BRANCH_SLUGS.includes(slug as (typeof MEDIA_CENTER_BRANCH_SLUGS)[number]);
}

function buildCategoryTree(categories: ArticleTopicCategoryRecord[]) {
  const nodeMap = new Map<number, CategoryNode>();

  categories.forEach((category) => {
    nodeMap.set(category.id, { ...category, children: [] });
  });

  const roots: CategoryNode[] = [];

  nodeMap.forEach((node) => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return { roots, nodeMap };
}

function collectLeafCategories(nodes: CategoryNode[]): Array<{ id: number; slug: string; name: string }> {
  return nodes.flatMap((node) => {
    if (node.children.length === 0) {
      return [{ id: node.id, slug: node.slug, name: node.name }];
    }

    return collectLeafCategories(node.children);
  });
}

export function filterArticleTopicCategoryRecords(categories: ArticleTopicCategoryRecord[]) {
  const { nodeMap } = buildCategoryTree(categories);
  const mediaRoot = [...nodeMap.values()].find((node) => node.slug === MEDIA_CENTER_ROOT_SLUG);

  const blockedIds = new Set<number>();
  if (mediaRoot) {
    const stack = [mediaRoot];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      blockedIds.add(node.id);
      stack.push(...node.children);
    }
  }

  return categories.filter(
    (category) =>
      category.is_active !== false &&
      !blockedIds.has(category.id) &&
      !isMediaCenterBranchSlug(category.slug) &&
      !isTestTopicCategory(category.slug, category.name),
  );
}

export function buildArticleTopicCategoryFilterGroups(
  categories: ArticleTopicCategoryRecord[],
): ArticleTopicCategoryGroup[] {
  const safeCategories = filterArticleTopicCategoryRecords(categories);
  const { roots } = buildCategoryTree(safeCategories);
  const topicsRoot = roots.find((node) => node.slug === ARTICLE_ROOT_SLUG);

  if (!topicsRoot || topicsRoot.children.length === 0) return [];

  const options = collectLeafCategories(topicsRoot.children);
  if (!options.length) return [];

  return [{ label: topicsRoot.name, options }];
}

export function resolveArticleTopicCategory(
  categorySlug: string,
  categories: ArticleTopicCategoryRecord[],
):
  | { ok: true; category: { id: number; name: string; slug: string } }
  | { ok: false; message: string } {
  const trimmedSlug = categorySlug.trim();
  if (!trimmedSlug) {
    return { ok: false, message: "التصنيف مطلوب." };
  }

  const { nodeMap } = buildCategoryTree(categories);
  const category = [...nodeMap.values()].find((node) => node.slug === trimmedSlug);

  if (!category || category.is_active === false) {
    return { ok: false, message: "التصنيف المختار غير موجود أو غير مفعل." };
  }

  if (category.slug === ARTICLE_ROOT_SLUG || category.children.length > 0) {
    return { ok: false, message: ARTICLE_TOPIC_CATEGORY_ERROR };
  }

  if (isMediaCenterBranchSlug(category.slug)) {
    return { ok: false, message: ARTICLE_TOPIC_CATEGORY_ERROR };
  }

  const topicsRoot = [...nodeMap.values()].find((node) => node.slug === ARTICLE_ROOT_SLUG);
  if (!topicsRoot) {
    return { ok: false, message: ARTICLE_TOPIC_CATEGORY_ERROR };
  }

  let current: CategoryNode | undefined = category;
  let underTopicsRoot = category.slug === ARTICLE_ROOT_SLUG;

  while (current) {
    if (current.slug === ARTICLE_ROOT_SLUG) {
      underTopicsRoot = true;
      break;
    }
    current = current.parent_id ? nodeMap.get(current.parent_id) : undefined;
  }

  if (!underTopicsRoot) {
    return { ok: false, message: ARTICLE_TOPIC_CATEGORY_ERROR };
  }

  return {
    ok: true,
    category: { id: category.id, name: category.name, slug: category.slug },
  };
}
