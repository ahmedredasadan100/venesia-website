import type { MediaContentItem } from "../../lib/media-center";
import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import MediaCenterCollectionItems from "./MediaCenterCollectionItems";
import MediaCenterHubSectionHeader from "./MediaCenterHubSectionHeader";

type MediaCenterHubGalleryProps = {
  items: MediaContentItem[];
  presentation: MediaHubModulePresentation;
};

export default function MediaCenterHubGallery({
  items,
  presentation,
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
      />
    </section>
  );
}
