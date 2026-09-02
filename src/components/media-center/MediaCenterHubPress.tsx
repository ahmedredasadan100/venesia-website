import type { MediaContentItem } from "../../lib/media-center/types";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import type { CollectionDisplayOverrides } from "../../lib/page-blocks/configs";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubPressProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
};

export default function MediaCenterHubPress({
  items,
  presentation,
  display,
}: MediaCenterHubPressProps) {
  return (
    <section>
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/press"
      />
      <MediaCenterCollectionItems
        items={items}
        view={presentation.collectionView}
        display={display}
      />
    </section>
  );
}
