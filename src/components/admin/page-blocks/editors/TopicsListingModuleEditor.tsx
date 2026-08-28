import {
  TOPICS_LISTING_ITEM_LIMITS,
  TOPICS_LISTING_ITEMS_PER_ROW,
  TOPICS_LISTING_PRESENTATIONS,
  type TopicsListingBlockConfig,
  type TopicsListingCollection,
  type TopicsListingPresentation,
} from "../../../../lib/page-blocks/configs";
import CollectionModuleEditor from "./CollectionModuleEditor";

type TopicsListingModuleEditorProps = {
  config: TopicsListingBlockConfig;
  categoryOptions: readonly {
    id: number;
    slug: string;
    name: string;
    parentId: number | null;
    depth: number;
  }[];
};

const PRESENTATION_LABELS: Record<TopicsListingPresentation, string> = {
  grid: "شبكة",
  list: "قائمة",
};

type TopicsCollectionOptionValue = "all-topics" | `category:${string}`;

function collectionValue(collection: TopicsListingCollection): TopicsCollectionOptionValue {
  return collection.type === "category"
    ? `category:${collection.categorySlug}`
    : "all-topics";
}

export default function TopicsListingModuleEditor({
  config,
  categoryOptions,
}: TopicsListingModuleEditorProps) {
  const selectedCollection = collectionValue(config.collection);
  const selectedCategorySlug =
    config.collection.type === "category" ? config.collection.categorySlug : null;
  const collectionOptions: { value: TopicsCollectionOptionValue; label: string }[] = [
    { value: "all-topics", label: "جميع الموضوعات" },
    ...categoryOptions.map((category) => ({
      value: `category:${category.slug}` as const,
      label: category.name,
      depth: category.depth,
    })),
  ];

  if (
    selectedCategorySlug &&
    !categoryOptions.some((category) => category.slug === selectedCategorySlug)
  ) {
    collectionOptions.push({
      value: selectedCollection,
      label: `${selectedCategorySlug} — غير متاح`,
    });
  }

  return (
    <CollectionModuleEditor
      selection={{
        name: "collection",
        label: "التصنيف",
        value: selectedCollection,
        options: collectionOptions,
      }}
      presentation={{
        value: config.presentation,
        options: TOPICS_LISTING_PRESENTATIONS.map((value) => ({
          value,
          label: PRESENTATION_LABELS[value],
        })),
      }}
      display={{
        itemsPerRow: {
          value: config.itemsPerRow,
          options: TOPICS_LISTING_ITEMS_PER_ROW.map((value) => ({
            value,
            label: String(value),
          })),
          supportedPresentations: ["grid"],
        },
        itemLimit: {
          value: config.itemLimit,
          options: TOPICS_LISTING_ITEM_LIMITS.map((value) => ({
            value,
            label: String(value),
          })),
        },
        overrides: config.display,
      }}
    />
  );
}
