export type ArticleTopicCategoryRecord = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export function resolveArticleTopicCategory(
  categorySlug: string,
  categories: ArticleTopicCategoryRecord[],
):
  | { ok: true; category: { id: number; name: string; slug: string } }
  | { ok: false; message: string } {
  const trimmedSlug = categorySlug.trim();
  if (!trimmedSlug) return { ok: false, message: "التصنيف مطلوب." };

  const category = categories.find(
    (item) => item.slug === trimmedSlug && item.is_active !== false,
  );
  if (!category) {
    return { ok: false, message: "التصنيف المختار غير موجود أو غير مفعل." };
  }
  return {
    ok: true,
    category: { id: category.id, name: category.name, slug: category.slug },
  };
}
