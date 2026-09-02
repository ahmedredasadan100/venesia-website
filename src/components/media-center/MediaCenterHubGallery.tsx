import type { MediaContentItem } from "../../lib/media-center";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import type { CollectionDisplayOverrides } from "../../lib/page-blocks/configs";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubGalleryProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
  display: CollectionDisplayOverrides;
};

export default function MediaCenterHubGallery({
  items,
  presentation,
  display,
}: MediaCenterHubGalleryProps) {
  if (!items.length) return null;

  return (
    <section>
      <MediaCenterHubSectionHeader
        presentation={presentation}
        href="/media-center/gallery"
      />
      <MediaCenterCollectionItems
        items={items}
        view={presentation.collectionView}
        display={display}
      />
    </section>
  );
}
