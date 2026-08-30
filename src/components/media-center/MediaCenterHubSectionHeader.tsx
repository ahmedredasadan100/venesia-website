import type { ReactNode } from "react";

import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import CollectionSectionHeader from "../collection-modules/CollectionSectionHeader";

type MediaCenterHubSectionHeaderProps = {
  presentation: MediaHubModulePresentation;
  href: string;
  actions?: ReactNode;
};

export default function MediaCenterHubSectionHeader({
  presentation,
  href,
  actions,
}: MediaCenterHubSectionHeaderProps) {
  return <CollectionSectionHeader presentation={presentation} href={href} actions={actions} />;
}
