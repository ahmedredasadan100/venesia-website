import type { MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubPressProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubPress({
  items,
  presentation,
}: MediaCenterHubPressProps) {
  return (
    <section>
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/press"
      />
      <MediaCenterCollectionItems items={items} view={presentation.collectionView} />
    </section>
  );
}
