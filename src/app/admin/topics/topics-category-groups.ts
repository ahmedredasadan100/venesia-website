import { isTestTopicCategory } from "../../../lib/admin/cms-test-data";
import {
  buildArticleTopicCategoryFilterGroups,
  type ArticleTopicCategoryRecord,
} from "../../../lib/admin/article-topic-categories";

export type TopicCategoryRecord = ArticleTopicCategoryRecord;

export type TopicCategoryGroup = {
  label: string;
  options: Array<{ id: number; slug: string; name: string }>;
};

export function buildTopicCategoryFilterGroups(categories: TopicCategoryRecord[]): TopicCategoryGroup[] {
  return buildArticleTopicCategoryFilterGroups(
    categories.filter(
      (category) => category.is_active !== false && !isTestTopicCategory(category.slug, category.name),
    ),
  );
}
