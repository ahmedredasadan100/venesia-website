import {
  asTopicsListingConfig,
  type TopicsListingBlockConfig,
} from "../../lib/page-blocks/configs";
import type { Topic } from "../../lib/topics/types";
import { CollectionListingPresentation } from "../collection-modules/CollectionListingPresenter";
import TopicCard from "./TopicCard";

type TopicsListingModuleProps = {
  topics: Topic[];
  config: TopicsListingBlockConfig;
};

/**
 * Presentation-only Topics Listing. The page supplies the resolved topics;
 * this component never queries, filters, searches, sorts, or paginates them.
 */
export default function TopicsListingModule({
  topics,
  config: rawConfig,
}: TopicsListingModuleProps) {
  const config = asTopicsListingConfig(rawConfig);

  return (
    <CollectionListingPresentation
      items={topics}
      itemLimit={config.itemLimit}
      presentation={config.presentation}
      itemsPerRow={config.itemsPerRow}
      keyForItem={(topic) => topic.id}
      renderItem={(topic) => (
        <TopicCard
          {...topic}
          displayOverrides={config.display}
        />
      )}
    />
  );
}
